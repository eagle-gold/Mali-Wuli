import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { NiveauEducation, Prisma, PrismaClient } from "@prisma/client";
import { normaliserEducation } from "../education/catalog-service";
import { fusionnerEtablissementsDansTransaction } from "../education/deduplication-etablissements";

/**
 * Applique un plan figé de fusion de doublons exacts d’établissements
 * (PASSATION_IA/output/2026-09-29-dedup-mali/plan.json), groupe par groupe.
 *
 * Par défaut : simulation (--dry-run), aucune écriture en base.
 * Écriture uniquement avec --apply, une transaction par groupe :
 *   1. fusionnerEtablissementsDansTransaction (formations, avis, sources,
 *      alias, niveaux, offres ; ancienne fiche valide=false) ;
 *   2. SuggestionCatalogue.candidatId / canoniqueId / contexte (JSON) ;
 *   3. ForumQuestion.etablissementId ;
 *   4. Profil.onboardingDonnees, réécrit seulement si le JSON est identique à
 *      celui lu avant la transaction (sinon le groupe entier est annulé).
 *
 * Refus : plan de plus de 24 h (date d’extraction), ou fiche du plan modifiée
 * depuis l’extraction (updatedAt, valide, nom/ville normalisés, pays).
 * Seuls les groupes de classe SURE sont traités.
 *
 * Plan « cycles » (plan-cycles.json, sousCategorie CYCLES) : les fiches d’un
 * groupe n’ont pas le même nomNormalise (« X 1er cycle » / « X 2nd cycle ») ;
 * chaque fiche du plan porte alors son propre nomNormalise/villeNormalisee,
 * contrôlés à la place de ceux du groupe. miseAJourCanonique peut en plus
 * renommer le canonique (nom + nomNormalise, ancien libellé conservé en
 * EtablissementAlias) et ajouter des niveaux. Garde-fous du renommage : groupe
 * CYCLES uniquement, nomNormalise = normaliserEducation(nom), et chaque mot du
 * nouveau nom présent dans un nom du groupe (sauf « école », « de », « d »).
 *
 * Options : --plan <fichier> --journal <fichier> --limit N --apply
 * Exemple : tsx src/scripts/fusion-doublons-plan.ts --limit 1
 */

const DUREE_VALIDITE_MS = 24 * 60 * 60 * 1000;
const PLAN_PAR_DEFAUT = path.resolve(__dirname, "../../../PASSATION_IA/output/2026-09-29-dedup-mali/plan.json");

type FichePlan = { id: string; nom: string; updatedAt: string; nomNormalise?: string; villeNormalisee?: string };
type GroupePlan = {
  cle: string;
  nomNormalise: string;
  villeNormalisee: string;
  classe: "SURE" | "A_VERIFIER";
  sousCategorie?: string | null;
  canoniqueId: string | null;
  fusionnesIds: string[];
  miseAJourCanonique?: {
    statut?: "PUBLIC" | "PRIVE";
    sigle?: string;
    nom?: string;
    nomNormalise?: string;
    niveaux?: NiveauEducation[];
  } | null;
  fiches: FichePlan[];
};
type Plan = { version: number; extraitLe: string; groupes: GroupePlan[] };

type ModifSuggestion = { id: string; champs: string[]; updatedAtLu: string; contexteAvant?: unknown; contexteApres?: unknown; contexteCleAncienId?: boolean };
type ModifProfil = { id: string; chemins: string[]; avant: Prisma.JsonValue; apres: Prisma.JsonValue };
type EntreeJournal = {
  cle: string;
  canoniqueId: string;
  fusionnesIds: string[];
  statut: "simule" | "applique" | "deja_applique" | "echec";
  erreur?: string;
  compteursAvant?: Record<string, Record<string, number>>;
  compteursApres?: Record<string, Record<string, number>>;
  miseAJourCanonique?: Record<string, unknown> | null;
  suggestions: ModifSuggestion[];
  forumQuestions: string[];
  profils: Array<Omit<ModifProfil, "avant" | "apres">>;
  aSuivreManuellement: string[];
  horodatage: string;
};

const argument = (nom: string) => {
  const index = process.argv.indexOf(nom);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const appliquer = process.argv.includes("--apply");
if (appliquer && process.argv.includes("--dry-run")) throw new Error("--apply et --dry-run sont incompatibles.");
const cheminPlan = path.resolve(argument("--plan") ?? PLAN_PAR_DEFAUT);
const limiteBrute = argument("--limit");
const limite = limiteBrute === undefined ? Infinity : Number(limiteBrute);
if (!Number.isInteger(limite) && limite !== Infinity) throw new Error("--limit attend un entier positif.");
if (limite <= 0) throw new Error("--limit attend un entier positif.");
const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
const cheminJournal = path.resolve(
  argument("--journal") ?? path.join(path.dirname(cheminPlan), `journal-fusion-${appliquer ? "apply" : "dry-run"}-${horodatage}.json`),
);

const prisma = new PrismaClient();
const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  !!valeur && typeof valeur === "object" && !Array.isArray(valeur);

/**
 * Remplace chaque valeur chaîne strictement égale à un ancien id (jamais une
 * sous-chaîne). Si un objet porte `etablissementId` remplacé et un libellé
 * `etablissement`, le libellé prend le nom canonique.
 */
function remplacerIds(valeur: unknown, correspondances: Map<string, string>, nomCanonique: string, chemin: string, chemins: string[]): unknown {
  if (typeof valeur === "string") {
    const nouveau = correspondances.get(valeur);
    if (nouveau) chemins.push(chemin);
    return nouveau ?? valeur;
  }
  if (Array.isArray(valeur)) return valeur.map((item, index) => remplacerIds(item, correspondances, nomCanonique, `${chemin}[${index}]`, chemins));
  if (estObjet(valeur)) {
    const resultat: Record<string, unknown> = {};
    for (const [cle, item] of Object.entries(valeur)) resultat[cle] = remplacerIds(item, correspondances, nomCanonique, `${chemin}.${cle}`, chemins);
    if (typeof valeur.etablissementId === "string" && correspondances.has(valeur.etablissementId) && typeof valeur.etablissement === "string") {
      resultat.etablissement = nomCanonique;
    }
    return resultat;
  }
  return valeur;
}

async function compteurs(ids: string[]) {
  const resultat: Record<string, Record<string, number>> = {};
  for (const id of ids) {
    resultat[id] = {
      formations: await prisma.formation.count({ where: { etablissementId: id } }),
      avis: await prisma.avisEtablissement.count({ where: { etablissementId: id } }),
      sources: await prisma.etablissementSource.count({ where: { etablissementId: id } }),
      offres: await prisma.etablissementProgramme.count({ where: { etablissementId: id } }),
      alias: await prisma.etablissementAlias.count({ where: { etablissementId: id } }),
      niveaux: await prisma.etablissementNiveau.count({ where: { etablissementId: id } }),
      forum: await prisma.forumQuestion.count({ where: { etablissementId: id } }),
    };
  }
  return resultat;
}

const NIVEAUX_VALIDES = new Set<string>(Object.values(NiveauEducation));
const MOTS_AJOUTABLES = new Set(["ecole", "de", "d"]);

/**
 * Garde-fous du renommage (plan « cycles ») : renvoie un message d’erreur ou null.
 * Le nouveau nom ne peut que retirer des marqueurs de cycle, changer la casse
 * ou ajouter « École de/d’ » : aucun mot absent des noms du groupe.
 */
function controlerRenommage(groupe: GroupePlan) {
  const maj = groupe.miseAJourCanonique;
  if (!maj || (maj.nom === undefined && maj.nomNormalise === undefined)) return null;
  if (groupe.sousCategorie !== "CYCLES") return "renommage réservé aux groupes de sousCategorie CYCLES";
  if (typeof maj.nom !== "string" || typeof maj.nomNormalise !== "string") return "nom et nomNormalise doivent être fournis ensemble";
  const nom = maj.nom;
  if (!nom || nom !== nom.trim() || /\s{2}/.test(nom) || nom.length > 191) return `nom proposé invalide « ${nom} »`;
  if (normaliserEducation(nom) !== maj.nomNormalise) return `nomNormalise « ${maj.nomNormalise} » ≠ normaliserEducation(nom) « ${normaliserEducation(nom)} »`;
  if (!maj.nomNormalise) return "nomNormalise vide";
  const motsGroupe = new Set(groupe.fiches.flatMap((fiche) => [
    ...normaliserEducation(fiche.nom).split(" "),
    ...(fiche.nomNormalise ?? "").split(" "),
  ]));
  const motsInconnus = maj.nomNormalise.split(" ").filter((mot) => !motsGroupe.has(mot) && !MOTS_AJOUTABLES.has(mot));
  if (motsInconnus.length) return `nom proposé avec des mots absents du groupe : ${motsInconnus.join(", ")}`;
  return null;
}

function controlerNiveaux(groupe: GroupePlan) {
  const niveaux = groupe.miseAJourCanonique?.niveaux;
  if (niveaux === undefined) return null;
  if (!Array.isArray(niveaux) || niveaux.some((niveau) => !NIVEAUX_VALIDES.has(niveau))) return `niveaux invalides : ${JSON.stringify(niveaux)}`;
  return null;
}

/** Vérifie qu’une fiche n’a pas bougé depuis l’extraction du plan. */
function controlerFiche(groupe: GroupePlan, fiche: FichePlan, base: { updatedAt: Date; valide: boolean; paysCode: string; nomNormalise: string; villeNormalisee: string } | undefined) {
  if (!base) return `fiche ${fiche.id} introuvable`;
  if (base.paysCode !== "ML") return `fiche ${fiche.id} : pays ${base.paysCode}`;
  if (!base.valide) return `fiche ${fiche.id} déjà invalide`;
  // Plan « cycles » : chaque fiche porte son propre nom normalisé (« X 1er cycle », « X 2nd cycle »).
  const nomAttendu = fiche.nomNormalise ?? groupe.nomNormalise;
  const villeAttendue = fiche.villeNormalisee ?? groupe.villeNormalisee;
  if (base.nomNormalise !== nomAttendu || base.villeNormalisee !== villeAttendue) return `fiche ${fiche.id} : nom ou ville modifiés`;
  if (base.updatedAt.getTime() !== new Date(fiche.updatedAt).getTime()) {
    return `fiche ${fiche.id} modifiée depuis le plan (${base.updatedAt.toISOString()} ≠ ${fiche.updatedAt})`;
  }
  return null;
}

async function main() {
  const plan = JSON.parse(fs.readFileSync(cheminPlan, "utf8")) as Plan;
  if (plan.version !== 1 || !Array.isArray(plan.groupes)) throw new Error("Plan illisible (version attendue : 1).");
  const age = Date.now() - new Date(plan.extraitLe).getTime();
  if (!Number.isFinite(age) || age < 0 || age > DUREE_VALIDITE_MS) {
    throw new Error(`Plan refusé : extrait le ${plan.extraitLe}, plus de 24 h. Régénérer l’extraction et le plan.`);
  }

  const groupesSurs = plan.groupes.filter((groupe) => groupe.classe === "SURE");
  for (const groupe of groupesSurs) {
    const ids = groupe.fiches.map((fiche) => fiche.id);
    if (!groupe.canoniqueId || !ids.includes(groupe.canoniqueId) || !groupe.fusionnesIds.length
      || groupe.fusionnesIds.some((id) => !ids.includes(id) || id === groupe.canoniqueId)) {
      throw new Error(`Plan incohérent pour le groupe ${groupe.cle}.`);
    }
    const erreurMiseAJour = controlerRenommage(groupe) ?? controlerNiveaux(groupe);
    if (erreurMiseAJour) throw new Error(`Plan refusé pour le groupe ${groupe.cle} : ${erreurMiseAJour}.`);
  }
  const tousIds = groupesSurs.flatMap((groupe) => [groupe.canoniqueId as string, ...groupe.fusionnesIds]);
  if (new Set(tousIds).size !== tousIds.length) throw new Error("Plan refusé : une fiche apparaît dans plusieurs groupes.");

  // Contrôle global avant toute écriture : toute fiche modifiée bloque l’exécution.
  const base = new Map((await prisma.etablissement.findMany({
    where: { id: { in: tousIds } },
    select: { id: true, nom: true, updatedAt: true, valide: true, paysCode: true, nomNormalise: true, villeNormalisee: true, statut: true, sigle: true },
  })).map((fiche) => [fiche.id, fiche]));
  const aTraiter: GroupePlan[] = [];
  const dejaAppliques: GroupePlan[] = [];
  const anomalies: string[] = [];
  for (const groupe of groupesSurs) {
    const canonique = base.get(groupe.canoniqueId as string);
    // Reprise après un --limit : fusionnés invalides, canonique toujours valide.
    if (canonique?.valide && groupe.fusionnesIds.every((id) => base.get(id)?.valide === false)) {
      dejaAppliques.push(groupe);
      continue;
    }
    for (const fiche of groupe.fiches) {
      const erreur = controlerFiche(groupe, fiche, base.get(fiche.id));
      if (erreur) anomalies.push(`${groupe.cle} : ${erreur}`);
    }
    aTraiter.push(groupe);
  }
  if (anomalies.length) {
    console.error(JSON.stringify({ refus: "fiches modifiées depuis le plan", anomalies }, null, 2));
    throw new Error("Plan refusé : des fiches ont changé depuis l’extraction.");
  }

  const selection = aTraiter.slice(0, limite);
  const journal: { mode: string; plan: string; extraitLe: string; debut: string; fin?: string; groupesSurs: number; dejaAppliques: string[]; entrees: EntreeJournal[] } = {
    mode: appliquer ? "apply" : "dry-run",
    plan: cheminPlan,
    extraitLe: plan.extraitLe,
    debut: new Date().toISOString(),
    groupesSurs: groupesSurs.length,
    dejaAppliques: dejaAppliques.map((groupe) => groupe.cle),
    entrees: [],
  };
  const ecrireJournal = () => fs.writeFileSync(cheminJournal, `${JSON.stringify(journal, null, 2)}\n`);
  console.log(JSON.stringify({ mode: journal.mode, groupesSurs: groupesSurs.length, dejaAppliques: dejaAppliques.length, selection: selection.length, journal: cheminJournal }));

  for (const groupe of selection) {
    const canoniqueId = groupe.canoniqueId as string;
    const anciens = groupe.fusionnesIds;
    // Libellé recopié dans les snapshots : le nouveau nom si le plan renomme le canonique.
    const nomCanonique = groupe.miseAJourCanonique?.nom ?? base.get(canoniqueId)?.nom ?? canoniqueId;
    const correspondances = new Map(anciens.map((id) => [id, canoniqueId]));
    const entree: EntreeJournal = {
      cle: groupe.cle, canoniqueId, fusionnesIds: anciens, statut: "simule",
      suggestions: [], forumQuestions: [], profils: [], aSuivreManuellement: [], horodatage: new Date().toISOString(),
      miseAJourCanonique: null,
    };

    // Lecture des références sans clé étrangère (hors transaction, comparées ensuite).
    const motifs = anciens.map((id) => `%${id}%`);
    const suggestionsTexte = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM SuggestionCatalogue
      WHERE candidatId IN (${Prisma.join(anciens)}) OR canoniqueId IN (${Prisma.join(anciens)})
        OR ${Prisma.join(motifs.map((motif) => Prisma.sql`CAST(contexte AS CHAR) LIKE ${motif} OR contexteCle LIKE ${motif}`), " OR ")}`);
    const suggestions = await prisma.suggestionCatalogue.findMany({
      where: { id: { in: suggestionsTexte.map((ligne) => ligne.id) } },
      select: { id: true, candidatId: true, canoniqueId: true, contexte: true, contexteCle: true, updatedAt: true },
    });
    const modifsSuggestions: Array<ModifSuggestion & { data: Prisma.SuggestionCatalogueUpdateManyMutationInput }> = [];
    for (const suggestion of suggestions) {
      const champs: string[] = [];
      const data: Prisma.SuggestionCatalogueUpdateManyMutationInput = {};
      if (suggestion.candidatId && correspondances.has(suggestion.candidatId)) { champs.push("candidatId"); data.candidatId = canoniqueId; }
      if (suggestion.canoniqueId && correspondances.has(suggestion.canoniqueId)) { champs.push("canoniqueId"); data.canoniqueId = canoniqueId; }
      const chemins: string[] = [];
      const contexte = remplacerIds(suggestion.contexte, correspondances, nomCanonique, "$", chemins);
      if (chemins.length) { champs.push(...chemins.map((chemin) => `contexte${chemin.slice(1)}`)); data.contexte = contexte as Prisma.InputJsonValue; }
      const contexteCleAncienId = anciens.some((id) => suggestion.contexteCle.includes(id));
      // contexteCle entre dans l’empreinte unique (type, fingerprint) : ne pas la réécrire ici.
      if (contexteCleAncienId) entree.aSuivreManuellement.push(`SuggestionCatalogue ${suggestion.id} : contexteCle contient un ancien id (empreinte à recalculer à la main)`);
      if (!champs.length) {
        if (!contexteCleAncienId) entree.aSuivreManuellement.push(`SuggestionCatalogue ${suggestion.id} : ancien id présent dans le texte sans valeur exacte remplaçable`);
        continue;
      }
      modifsSuggestions.push({
        id: suggestion.id, champs, updatedAtLu: suggestion.updatedAt.toISOString(), contexteCleAncienId,
        contexteAvant: data.contexte ? suggestion.contexte : undefined, contexteApres: data.contexte ? contexte : undefined, data,
      });
    }
    entree.suggestions = modifsSuggestions.map(({ data: _data, ...reste }) => reste);

    const questions = await prisma.forumQuestion.findMany({ where: { etablissementId: { in: anciens } }, select: { id: true } });
    entree.forumQuestions = questions.map((question) => question.id);

    const profilsTexte = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM Profil WHERE onboardingDonnees IS NOT NULL AND (
        ${Prisma.join(motifs.map((motif) => Prisma.sql`CAST(onboardingDonnees AS CHAR) LIKE ${motif}`), " OR ")})`);
    const profils = await prisma.profil.findMany({ where: { id: { in: profilsTexte.map((ligne) => ligne.id) } }, select: { id: true, onboardingDonnees: true } });
    const modifsProfils: ModifProfil[] = [];
    for (const profil of profils) {
      const chemins: string[] = [];
      const apres = remplacerIds(profil.onboardingDonnees, correspondances, nomCanonique, "$", chemins) as Prisma.JsonValue;
      if (!chemins.length) {
        entree.aSuivreManuellement.push(`Profil ${profil.id} : ancien id présent dans le snapshot sans valeur exacte remplaçable`);
        continue;
      }
      modifsProfils.push({ id: profil.id, chemins, avant: profil.onboardingDonnees, apres });
    }
    entree.profils = modifsProfils.map(({ id, chemins }) => ({ id, chemins }));

    const ficheCanonique = base.get(canoniqueId);
    const miseAJour: Prisma.EtablissementUpdateInput = {};
    if (groupe.miseAJourCanonique?.statut && ficheCanonique?.statut === "INCONNU") miseAJour.statut = groupe.miseAJourCanonique.statut;
    if (groupe.miseAJourCanonique?.sigle && !ficheCanonique?.sigle) miseAJour.sigle = groupe.miseAJourCanonique.sigle;
    // Renommage (plan « cycles ») : l’ancien libellé du canonique devient un alias.
    const ancienNomCanonique = ficheCanonique ? { nom: ficheCanonique.nom, nomNormalise: ficheCanonique.nomNormalise } : null;
    const renommage = groupe.miseAJourCanonique?.nom && groupe.miseAJourCanonique.nomNormalise && ancienNomCanonique
      && groupe.miseAJourCanonique.nom !== ancienNomCanonique.nom
      ? { nom: groupe.miseAJourCanonique.nom, nomNormalise: groupe.miseAJourCanonique.nomNormalise }
      : null;
    if (renommage) { miseAJour.nom = renommage.nom; miseAJour.nomNormalise = renommage.nomNormalise; }
    const niveauxAjoutes = groupe.miseAJourCanonique?.niveaux ?? [];
    entree.miseAJourCanonique = Object.keys(miseAJour).length || niveauxAjoutes.length
      ? { ...miseAJour, ...(renommage ? { ancienNom: ancienNomCanonique?.nom } : {}), ...(niveauxAjoutes.length ? { niveaux: niveauxAjoutes } : {}) }
      : null;
    entree.compteursAvant = await compteurs([canoniqueId, ...anciens]);

    if (!appliquer) {
      console.log(JSON.stringify({ simulation: groupe.cle, canoniqueId, fusionnes: anciens, miseAJour: entree.miseAJourCanonique, suggestions: entree.suggestions.map((s) => ({ id: s.id, champs: s.champs })), forum: entree.forumQuestions, profils: entree.profils, compteursAvant: entree.compteursAvant, aSuivreManuellement: entree.aSuivreManuellement }));
      journal.entrees.push(entree);
      ecrireJournal();
      continue;
    }

    try {
      await prisma.$transaction(async (transaction) => {
        // Nouveau contrôle dans la transaction : rien ne doit avoir bougé.
        const actuelles = await transaction.etablissement.findMany({
          where: { id: { in: [canoniqueId, ...anciens] } },
          select: { id: true, updatedAt: true, valide: true, paysCode: true, nomNormalise: true, villeNormalisee: true },
        });
        for (const fiche of groupe.fiches) {
          const erreur = controlerFiche(groupe, fiche, actuelles.find((item) => item.id === fiche.id));
          if (erreur) throw new Error(erreur);
        }

        for (const ancien of anciens) await fusionnerEtablissementsDansTransaction(transaction, canoniqueId, ancien);
        if (Object.keys(miseAJour).length) await transaction.etablissement.update({ where: { id: canoniqueId }, data: miseAJour });
        if (renommage && ancienNomCanonique && ancienNomCanonique.nomNormalise !== renommage.nomNormalise) {
          // La recherche (alias.nomNormalise) retrouve encore l’ancien libellé.
          await transaction.etablissementAlias.upsert({
            where: { etablissementId_nomNormalise: { etablissementId: canoniqueId, nomNormalise: ancienNomCanonique.nomNormalise } },
            create: { etablissementId: canoniqueId, nom: ancienNomCanonique.nom, nomNormalise: ancienNomCanonique.nomNormalise },
            update: {},
          });
        }
        for (const niveau of niveauxAjoutes) {
          await transaction.etablissementNiveau.upsert({
            where: { etablissementId_niveau: { etablissementId: canoniqueId, niveau } },
            create: { etablissementId: canoniqueId, niveau },
            update: {},
          });
        }

        for (const modif of modifsSuggestions) {
          const resultat = await transaction.suggestionCatalogue.updateMany({
            where: { id: modif.id, updatedAt: new Date(modif.updatedAtLu) },
            data: modif.data,
          });
          if (resultat.count !== 1) throw new Error(`SuggestionCatalogue ${modif.id} modifiée depuis la lecture.`);
        }
        if (entree.forumQuestions.length) {
          await transaction.forumQuestion.updateMany({ where: { id: { in: entree.forumQuestions }, etablissementId: { in: anciens } }, data: { etablissementId: canoniqueId } });
        }
        for (const modif of modifsProfils) {
          // Comparaison du JSON complet : un formulaire enregistré entre-temps annule le groupe.
          const resultat = await transaction.profil.updateMany({
            where: { id: modif.id, onboardingDonnees: { equals: modif.avant as Prisma.InputJsonValue } },
            data: { onboardingDonnees: modif.apres as Prisma.InputJsonValue },
          });
          if (resultat.count !== 1) throw new Error(`Profil ${modif.id} : snapshot modifié depuis la lecture.`);
        }
      }, { maxWait: 10_000, timeout: 120_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      entree.statut = "applique";
      entree.compteursApres = await compteurs([canoniqueId, ...anciens]);
      console.log(JSON.stringify({ applique: groupe.cle, canoniqueId, fusionnes: anciens, compteursApres: entree.compteursApres }));
    } catch (erreur) {
      entree.statut = "echec";
      entree.erreur = erreur instanceof Error ? erreur.message : String(erreur);
      journal.entrees.push(entree);
      journal.fin = new Date().toISOString();
      ecrireJournal();
      throw new Error(`Groupe ${groupe.cle} annulé (transaction annulée) : ${entree.erreur}`);
    }
    journal.entrees.push(entree);
    ecrireJournal();
  }

  journal.fin = new Date().toISOString();
  ecrireJournal();
  console.log(JSON.stringify({ termine: true, mode: journal.mode, groupes: journal.entrees.length, journal: cheminJournal }));
}

main().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : "Fusion impossible");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

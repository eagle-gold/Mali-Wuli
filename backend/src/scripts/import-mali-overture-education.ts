import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ModeUtilisationSource,
  NiveauEducation,
  Prisma,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
} from "@prisma/client";
import {
  type CandidatOverture,
  type EcoleOverture,
  convertirFeatureOverture,
  lireFeaturesOverture,
  normaliserNomRapprochementOverture,
  normaliserRegionOvertureMali,
  normaliserTexteOverture,
  signatureBrancheOverture,
  localisationOvertureMali,
  trouverCorrespondanceOverture,
  villeCanoniqueOvertureMali,
} from "../education/mali-overture-education";
import type { LocalisationMali, ReferenceVoisinMali } from "../education/localisation-mali";

const prisma = new PrismaClient();
const CODE_SOURCE = "overture-places-mali";
const RELEASE_PAR_DEFAUT = "2026-08-19.0";
const PAGE_SOURCE = "https://docs.overturemaps.org/guides/places/";
const EXPLORATEUR_SOURCE = "https://explore.overturemaps.org/";
const CONDITIONS_SOURCE = "https://cdla.dev/permissive-2-0/";
const TAILLE_LOT = 500;

type CandidatIndexe = CandidatOverture & {
  nom: string;
  nomNormalise: string;
  ville: string | null;
  villeNormalisee: string;
  statut: StatutEtablissement;
};

type IndexEtablissements = {
  /** Fiches déjà localisées (commune + coordonnées), pour le kNN des lieux Overture. */
  voisins: ReferenceVoisinMali[];
  localisationConnue: Set<string>;
  candidats: Map<string, CandidatIndexe>;
  parNomExact: Map<string, Set<string>>;
  parNomRapproche: Map<string, Set<string>>;
};

type PlanEtablissement = {
  id: string;
  nouveau: boolean;
  nom: string;
  nomNormalise: string;
  type: TypeEtablissement;
  statut: StatutEtablissement;
  ville: string | null;
  villeNormalisee: string;
  latitude: number | null;
  longitude: number | null;
  niveaux: Set<NiveauEducation>;
  aliases: Map<string, string>;
  ecoles: EcoleOverture[];
  enrichirVille: boolean;
  enrichirVilleNormalisee: boolean;
  enrichirLatitude: boolean;
  enrichirLongitude: boolean;
  enrichirStatut: boolean;
  /** Détail administratif à écrire (null : déjà connu en base). */
  localisation: LocalisationMali | null;
};

type Statistiques = {
  featuresRecues: number;
  ecolesRetenues: number;
  nouveaux: number;
  rattachesReference: number;
  rattachesNomExact: number;
  rattachesNomRelache: number;
  ambigus: number;
  ignoresParRaison: Record<string, number>;
};

const argumentsCli = process.argv.slice(2);
const appliquer = argumentsCli.includes("--apply");
const dryRunExplicite = argumentsCli.includes("--dry-run");
if (appliquer && dryRunExplicite) throw new Error("Utilisez soit --apply, soit --dry-run, pas les deux.");

const indexRelease = argumentsCli.findIndex((argument) => argument === "--release");
const releaseDepuisOption = argumentsCli.find((argument) => argument.startsWith("--release="))?.slice("--release=".length);
const releaseOverture = releaseDepuisOption || (indexRelease >= 0 ? argumentsCli[indexRelease + 1] : undefined) || RELEASE_PAR_DEFAUT;
if (!/^\d{4}-\d{2}-\d{2}(?:\.\d+)?$/.test(releaseOverture)) {
  throw new Error("La release Overture doit suivre le format AAAA-MM-JJ.N (ex. 2026-08-19.0).");
}

const indexFile = argumentsCli.findIndex((argument) => argument === "--file");
const fichierDepuisOption = argumentsCli.find((argument) => argument.startsWith("--file="))?.slice("--file=".length);
const cheminFichier = fichierDepuisOption || (indexFile >= 0 ? argumentsCli[indexFile + 1] : undefined);
if (!cheminFichier || cheminFichier.startsWith("--")) {
  throw new Error("Usage : tsx src/scripts/import-mali-overture-education.ts --file /chemin/ecoles.geojson [--release 2026-08-19.0] --dry-run|--apply");
}
const cheminFichierValide: string = cheminFichier;

const empreinte = (valeur: string) => createHash("sha1").update(valeur).digest("hex").slice(0, 24);

const ajouterMapSet = (map: Map<string, Set<string>>, cle: string, id: string) => {
  if (!cle) return;
  const valeurs = map.get(cle);
  if (valeurs) valeurs.add(id);
  else map.set(cle, new Set([id]));
};

const decouper = <T>(elements: T[], taille = TAILLE_LOT) => {
  const lots: T[][] = [];
  for (let index = 0; index < elements.length; index += taille) lots.push(elements.slice(index, index + taille));
  return lots;
};

const objetJson = (valeur: Prisma.JsonValue | null): Record<string, unknown> | null => (
  valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? valeur as Record<string, unknown>
    : null
);

const texteJson = (objet: Record<string, unknown> | null, cle: string) => {
  const valeur = objet?.[cle];
  return typeof valeur === "string" && valeur.trim() ? valeur.trim() : null;
};

const ajouterLocalisation = (
  ensemble: Set<string>,
  valeur: string | null | undefined,
  region?: string | null,
) => {
  if (!valeur) return;
  const normalisee = normaliserTexteOverture(valeur);
  if (normalisee) ensemble.add(normalisee);
  const canonique = villeCanoniqueOvertureMali(valeur, region);
  if (canonique.villeNormalisee) ensemble.add(canonique.villeNormalisee);
};

const extraireContexteSource = (donneesBrutes: Prisma.JsonValue | null) => {
  const racine = objetJson(donneesBrutes);
  const administration = objetJson((racine?.administration ?? null) as Prisma.JsonValue | null);
  const adresse = objetJson((racine?.adresse ?? null) as Prisma.JsonValue | null);
  const regionsSources = [
    texteJson(racine, "region"),
    texteJson(administration, "region"),
    texteJson(adresse, "region"),
  ].filter((valeur): valeur is string => Boolean(valeur));
  const regionContexte = regionsSources[0];
  const localisations = new Set<string>();
  for (const valeur of [
    texteJson(racine, "villeSource"),
    texteJson(racine, "ville"),
    texteJson(racine, "localite"),
    texteJson(racine, "commune"),
    texteJson(administration, "localite"),
    texteJson(administration, "commune"),
    texteJson(adresse, "locality"),
  ]) ajouterLocalisation(localisations, valeur, regionContexte);
  const regions = new Set<string>();
  for (const valeur of regionsSources) {
    const normalisee = normaliserRegionOvertureMali(valeur);
    if (normalisee) regions.add(normalisee);
  }
  return { localisations, regions };
};

const ajouterCandidat = (index: IndexEtablissements, candidat: CandidatIndexe) => {
  index.candidats.set(candidat.id, candidat);
  for (const nom of candidat.nomsExacts) ajouterMapSet(index.parNomExact, nom, candidat.id);
  for (const nom of candidat.nomsRapproches) ajouterMapSet(index.parNomRapproche, nom, candidat.id);
};

/**
 * Rend immédiatement visibles les alias et le contexte ajoutés plus tôt dans le
 * même fichier. Sans cela, deux objets Overture d'un même campus peuvent être
 * planifiés séparément lorsque seul le second utilise un nouvel alias.
 */
const enrichirCandidatIndexe = (
  index: IndexEtablissements,
  candidat: CandidatIndexe,
  ecole: EcoleOverture,
) => {
  for (const nom of [ecole.nom, ...ecole.aliases]) {
    const exact = normaliserTexteOverture(nom);
    if (exact) {
      candidat.nomsExacts.add(exact);
      ajouterMapSet(index.parNomExact, exact, candidat.id);
    }
    const rapproche = normaliserNomRapprochementOverture(nom);
    if (rapproche.length >= 4) {
      candidat.nomsRapproches.add(rapproche);
      ajouterMapSet(index.parNomRapproche, rapproche, candidat.id);
    }
  }
  ecole.localisationsNormalisees.forEach((valeur) => candidat.localisationsNormalisees.add(valeur));
  if (ecole.regionNormalisee) candidat.regionsNormalisees.add(ecole.regionNormalisee);
  if (!candidat.signatureBranche && ecole.signatureBranche) candidat.signatureBranche = ecole.signatureBranche;
  if (!candidat.ville) candidat.ville = ecole.ville;
  if (!candidat.villeNormalisee) candidat.villeNormalisee = ecole.villeNormalisee;
  if (candidat.latitude === null) candidat.latitude = ecole.latitude;
  if (candidat.longitude === null) candidat.longitude = ecole.longitude;
  if (candidat.statut === StatutEtablissement.INCONNU && ecole.statut !== StatutEtablissement.INCONNU) {
    candidat.statut = ecole.statut;
  }
};

async function chargerIndex(): Promise<IndexEtablissements> {
  const etablissements = await prisma.etablissement.findMany({
    where: { paysCode: "ML", valide: true },
    include: {
      alias: { select: { nom: true, nomNormalise: true } },
      sources: { select: { donneesBrutes: true } },
    },
  });
  const index: IndexEtablissements = {
    voisins: [],
    localisationConnue: new Set(),
    candidats: new Map(),
    parNomExact: new Map(),
    parNomRapproche: new Map(),
  };
  for (const etablissement of etablissements) {
    const noms = [etablissement.nom, ...etablissement.alias.map(({ nom }) => nom)];
    const nomsExacts = new Set(noms.map(normaliserTexteOverture).filter(Boolean));
    const nomsRapproches = new Set(noms.map(normaliserNomRapprochementOverture).filter((nom) => nom.length >= 4));
    const localisationsNormalisees = new Set<string>();
    ajouterLocalisation(localisationsNormalisees, etablissement.ville);
    ajouterLocalisation(localisationsNormalisees, etablissement.villeNormalisee);
    // Avec ville = chef-lieu de région, la commune et la localité précisent le lieu.
    ajouterLocalisation(localisationsNormalisees, etablissement.commune);
    ajouterLocalisation(localisationsNormalisees, etablissement.localite);
    if (etablissement.communeCode || etablissement.commune || etablissement.region) index.localisationConnue.add(etablissement.id);
    if (etablissement.communeCode && etablissement.latitude !== null && etablissement.longitude !== null) {
      index.voisins.push({
        latitude: Number(etablissement.latitude),
        longitude: Number(etablissement.longitude),
        communeCode: etablissement.communeCode,
      });
    }
    const regionsNormalisees = new Set<string>();
    for (const source of etablissement.sources) {
      const contexte = extraireContexteSource(source.donneesBrutes);
      contexte.localisations.forEach((valeur) => localisationsNormalisees.add(valeur));
      contexte.regions.forEach((valeur) => regionsNormalisees.add(valeur));
    }
    ajouterCandidat(index, {
      id: etablissement.id,
      nom: etablissement.nom,
      nomNormalise: etablissement.nomNormalise,
      nomsExacts,
      nomsRapproches,
      signatureBranche: signatureBrancheOverture(etablissement.nom),
      type: etablissement.type,
      statut: etablissement.statut,
      ville: etablissement.ville,
      villeNormalisee: etablissement.villeNormalisee,
      localisationsNormalisees,
      regionsNormalisees,
      latitude: etablissement.latitude === null ? null : Number(etablissement.latitude),
      longitude: etablissement.longitude === null ? null : Number(etablissement.longitude),
    });
  }
  return index;
}

const candidatsPour = (index: IndexEtablissements, ecole: EcoleOverture) => {
  const ids = new Set<string>(index.parNomExact.get(ecole.nomNormalise) || []);
  for (const id of index.parNomRapproche.get(ecole.nomRapproche) || []) ids.add(id);
  return [...ids].map((id) => index.candidats.get(id)).filter((item): item is CandidatIndexe => Boolean(item));
};

const ajouterEcoleAuPlan = (planifie: PlanEtablissement, ecole: EcoleOverture) => {
  planifie.ecoles.push(ecole);
  for (const niveau of ecole.niveaux) planifie.niveaux.add(niveau);
  for (const alias of [ecole.nom, ...ecole.aliases]) {
    const nomNormalise = normaliserTexteOverture(alias);
    if (nomNormalise && nomNormalise !== planifie.nomNormalise) planifie.aliases.set(nomNormalise, alias);
  }
  if (planifie.statut === StatutEtablissement.INCONNU && ecole.statut !== StatutEtablissement.INCONNU) {
    planifie.statut = ecole.statut;
  }
};

function planifierImport(
  ecoles: EcoleOverture[],
  index: IndexEtablissements,
  references: Map<string, string>,
  statistiques: Statistiques,
) {
  const plan = new Map<string, PlanEtablissement>();
  const ambigus: Array<{ overtureId: string; nom: string; ville: string; candidats: string[] }> = [];
  for (const ecole of [...ecoles].sort((a, b) => a.identifiantExterne.localeCompare(b.identifiantExterne, "fr"))) {
    const referenceId = references.get(ecole.identifiantExterne);
    const resultat = referenceId
      ? { id: referenceId, raison: "reference" as const, candidats: [referenceId] }
      : trouverCorrespondanceOverture(ecole, candidatsPour(index, ecole));
    if (resultat.raison === "ambigu") {
      statistiques.ambigus += 1;
      ambigus.push({
        overtureId: ecole.identifiantExterne,
        nom: ecole.nom,
        ville: ecole.ville,
        candidats: resultat.candidats,
      });
      continue;
    }
    const id = resultat.id || `ml-overture-${empreinte(ecole.identifiantExterne)}`;
    const candidat = index.candidats.get(id);
    const nouveau = !candidat;
    if (nouveau) statistiques.nouveaux += 1;
    else if (resultat.raison === "reference") statistiques.rattachesReference += 1;
    else if (resultat.raison === "nom-exact") statistiques.rattachesNomExact += 1;
    else if (resultat.raison === "nom-relache") statistiques.rattachesNomRelache += 1;

    const localisation = localisationOvertureMali(ecole, index.voisins);
    let planifie = plan.get(id);
    if (!planifie) {
      planifie = {
        id,
        nouveau,
        nom: candidat?.nom || ecole.nom,
        nomNormalise: candidat?.nomNormalise || ecole.nomNormalise,
        type: candidat?.type || ecole.type,
        statut: candidat?.statut || ecole.statut,
        ville: candidat?.ville || localisation.ville || ecole.ville,
        villeNormalisee: candidat?.villeNormalisee || (localisation.ville ? localisation.villeNormalisee : ecole.villeNormalisee),
        localisation: index.localisationConnue.has(id) ? null : localisation,
        latitude: candidat?.latitude ?? ecole.latitude,
        longitude: candidat?.longitude ?? ecole.longitude,
        niveaux: new Set(),
        aliases: new Map(),
        ecoles: [],
        enrichirVille: Boolean(candidat && !candidat.ville?.trim()),
        enrichirVilleNormalisee: Boolean(candidat && !candidat.villeNormalisee.trim()),
        enrichirLatitude: Boolean(candidat && candidat.latitude === null),
        enrichirLongitude: Boolean(candidat && candidat.longitude === null),
        enrichirStatut: Boolean(candidat && candidat.statut === StatutEtablissement.INCONNU),
      };
      plan.set(id, planifie);
    }
    ajouterEcoleAuPlan(planifie, ecole);

    let candidatIndexe = candidat;
    if (!candidatIndexe) {
      candidatIndexe = {
        id,
        nom: ecole.nom,
        nomNormalise: ecole.nomNormalise,
        nomsExacts: new Set([ecole.nomNormalise, ...ecole.aliases.map(normaliserTexteOverture)]),
        nomsRapproches: new Set([ecole.nomRapproche, ...ecole.aliases.map(normaliserNomRapprochementOverture)].filter((nom) => nom.length >= 4)),
        signatureBranche: ecole.signatureBranche,
        type: ecole.type,
        statut: ecole.statut,
        ville: ecole.ville,
        villeNormalisee: ecole.villeNormalisee,
        localisationsNormalisees: new Set(ecole.localisationsNormalisees),
        regionsNormalisees: new Set(ecole.regionNormalisee ? [ecole.regionNormalisee] : []),
        latitude: ecole.latitude,
        longitude: ecole.longitude,
      };
      ajouterCandidat(index, candidatIndexe);
    }
    enrichirCandidatIndexe(index, candidatIndexe, ecole);
  }
  return { plan: [...plan.values()], ambigus };
}

async function garantirSource() {
  await prisma.paysEducation.findUniqueOrThrow({ where: { code: "ML" } });
  return prisma.sourceEducative.upsert({
    where: { code: CODE_SOURCE },
    create: {
      code: CODE_SOURCE,
      nom: "Overture Maps Places — établissements scolaires au Mali",
      url: PAGE_SOURCE,
      paysCode: "ML",
      licence: "CDLA-Permissive-2.0 (avec licences des sources par objet)",
      conditionsUrl: CONDITIONS_SOURCE,
      modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
      priorite: 45,
      actif: true,
    },
    update: {
      nom: "Overture Maps Places — établissements scolaires au Mali",
      url: PAGE_SOURCE,
      paysCode: "ML",
      licence: "CDLA-Permissive-2.0 (avec licences des sources par objet)",
      conditionsUrl: CONDITIONS_SOURCE,
      modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
      priorite: 45,
      actif: true,
    },
  });
}

async function appliquerPlan(plan: PlanEtablissement[], sourceId: string, release: string) {
  const nouveaux = plan.filter(({ nouveau }) => nouveau);
  for (const lot of decouper(nouveaux)) {
    await prisma.etablissement.createMany({
      data: lot.map((item) => ({
        id: item.id,
        nom: item.nom,
        nomNormalise: item.nomNormalise,
        type: item.type,
        paysCode: "ML",
        systemeEducatifCode: "ML",
        ville: item.ville,
        villeNormalisee: item.villeNormalisee,
        localite: item.localisation?.localite ?? null,
        commune: item.localisation?.commune ?? null,
        communeCode: item.localisation?.communeCode ?? null,
        cercle: item.localisation?.cercle ?? null,
        region: item.localisation?.region ?? null,
        statut: item.statut,
        latitude: item.latitude,
        longitude: item.longitude,
        valide: true,
      })),
      skipDuplicates: true,
    });
  }
  const existants = plan.filter(({ nouveau }) => !nouveau);
  for (const lot of decouper(existants, 100)) {
    const operations: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];
    for (const item of lot) {
      if (item.enrichirVille && item.ville) {
        operations.push(prisma.etablissement.updateMany({
          where: { id: item.id, OR: [{ ville: null }, { ville: "" }] },
          data: { ville: item.ville },
        }));
      }
      if (item.enrichirVilleNormalisee && item.villeNormalisee) {
        operations.push(prisma.etablissement.updateMany({
          where: { id: item.id, villeNormalisee: "" },
          data: { villeNormalisee: item.villeNormalisee },
        }));
      }
      if (item.enrichirLatitude && item.latitude !== null) {
        operations.push(prisma.etablissement.updateMany({
          where: { id: item.id, latitude: null },
          data: { latitude: item.latitude },
        }));
      }
      if (item.enrichirLongitude && item.longitude !== null) {
        operations.push(prisma.etablissement.updateMany({
          where: { id: item.id, longitude: null },
          data: { longitude: item.longitude },
        }));
      }
      if (item.localisation && item.localisation.resolution !== "aucune") {
        operations.push(prisma.etablissement.updateMany({
          where: { id: item.id, commune: null, communeCode: null, region: null },
          data: {
            localite: item.localisation.localite,
            commune: item.localisation.commune,
            communeCode: item.localisation.communeCode,
            cercle: item.localisation.cercle,
            region: item.localisation.region,
          },
        }));
      }
      if (item.enrichirStatut && item.statut !== StatutEtablissement.INCONNU) {
        operations.push(prisma.etablissement.updateMany({
          where: { id: item.id, statut: StatutEtablissement.INCONNU },
          data: { statut: item.statut },
        }));
      }
    }
    if (operations.length) await prisma.$transaction(operations);
  }
  const niveaux = plan.flatMap((item) => [...item.niveaux].map((niveau) => ({ etablissementId: item.id, niveau })));
  for (const lot of decouper(niveaux, 1_500)) await prisma.etablissementNiveau.createMany({ data: lot, skipDuplicates: true });
  const aliases = plan.flatMap((item) => [...item.aliases].map(([nomNormalise, nom]) => ({
    etablissementId: item.id,
    nom,
    nomNormalise,
  })));
  for (const lot of decouper(aliases, 1_000)) await prisma.etablissementAlias.createMany({ data: lot, skipDuplicates: true });

  const references = plan.flatMap((item) => item.ecoles.map((ecole) => ({ item, ecole })));
  for (const lot of decouper(references, 100)) {
    await prisma.$transaction(lot.map(({ item, ecole }) => {
      const donneesBrutes = {
        ...ecole.donneesBrutes,
        releaseOverture: release,
      } as Prisma.InputJsonValue;
      return prisma.etablissementSource.upsert({
        where: {
          sourceId_identifiantExterne: {
            sourceId,
            identifiantExterne: ecole.identifiantExterne,
          },
        },
        create: {
          id: `source-overture-${empreinte(ecole.identifiantExterne)}`,
          etablissementId: item.id,
          sourceId,
          identifiantExterne: ecole.identifiantExterne,
          urlSource: EXPLORATEUR_SOURCE,
          confiance: ecole.confiance,
          donneesBrutes,
        },
        update: {
          etablissementId: item.id,
          urlSource: EXPLORATEUR_SOURCE,
          confiance: ecole.confiance,
          vuLe: new Date(),
          donneesBrutes,
        },
      });
    }));
  }
}

async function importer() {
  const cheminAbsolu = resolve(cheminFichierValide);
  const contenu = await readFile(cheminAbsolu, "utf8");
  const features = lireFeaturesOverture(contenu);
  const statistiques: Statistiques = {
    featuresRecues: features.length,
    ecolesRetenues: 0,
    nouveaux: 0,
    rattachesReference: 0,
    rattachesNomExact: 0,
    rattachesNomRelache: 0,
    ambigus: 0,
    ignoresParRaison: {},
  };
  const ecoles: EcoleOverture[] = [];
  for (const feature of features) {
    const resultat = convertirFeatureOverture(feature);
    if (resultat.ecole) ecoles.push(resultat.ecole);
    else {
      const raison = resultat.raisonIgnoree || "inconnue";
      statistiques.ignoresParRaison[raison] = (statistiques.ignoresParRaison[raison] || 0) + 1;
    }
  }
  statistiques.ecolesRetenues = ecoles.length;

  const sourceExistante = await prisma.sourceEducative.findUnique({ where: { code: CODE_SOURCE } });
  const referencesSource = sourceExistante
    ? await prisma.etablissementSource.findMany({
      where: { sourceId: sourceExistante.id, etablissement: { paysCode: "ML", valide: true } },
      select: { identifiantExterne: true, etablissementId: true },
    })
    : [];
  const references = new Map(referencesSource.map(({ identifiantExterne, etablissementId }) => [identifiantExterne, etablissementId]));
  const index = await chargerIndex();
  const { plan, ambigus } = planifierImport(ecoles, index, references, statistiques);

  let importationId: string | null = null;
  if (appliquer) {
    const source = await garantirSource();
    const importation = await prisma.importEducation.create({ data: { sourceId: source.id, paysCode: "ML" } });
    importationId = importation.id;
    try {
      await appliquerPlan(plan, source.id, releaseOverture);
      await prisma.importEducation.update({
        where: { id: importation.id },
        data: {
          statut: statistiques.ambigus ? StatutImportEducation.PARTIEL : StatutImportEducation.TERMINE,
          ajoutes: plan.filter(({ nouveau }) => nouveau).length,
          modifies: plan.filter(({ nouveau }) => !nouveau).length,
          ignores: Object.values(statistiques.ignoresParRaison).reduce((total, valeur) => total + valeur, 0) + statistiques.ambigus,
          erreurs: 0,
          termineLe: new Date(),
          detail: {
            fichier: cheminAbsolu,
            releaseOverture,
            ...statistiques,
            ambigusNonImportes: ambigus.slice(0, 25),
            regle: "Catégorie scolaire primaire stricte ; confiance >= 0,7 ; rapprochement par nom + ville/administration + distance ; jamais par nom seul.",
          },
        },
      });
    } catch (error) {
      await prisma.importEducation.update({
        where: { id: importation.id },
        data: {
          statut: StatutImportEducation.ECHEC,
          erreurs: 1,
          termineLe: new Date(),
          detail: {
            message: error instanceof Error ? error.message : "Erreur inconnue",
            fichier: cheminAbsolu,
            releaseOverture,
          },
        },
      });
      throw error;
    }
  }

  console.log(JSON.stringify({
    mode: appliquer ? "apply" : "dry-run",
    fichier: cheminAbsolu,
    releaseOverture,
    ...statistiques,
    etablissementsPlanifies: plan.length,
    etablissementsCrees: plan.filter(({ nouveau }) => nouveau).length,
    etablissementsEnrichis: plan.filter(({ nouveau }) => !nouveau).length,
    provenancesPlanifiees: plan.reduce((total, item) => total + item.ecoles.length, 0),
    importationId,
    exemplesAmbigus: ambigus.slice(0, 25),
    avertissement: appliquer ? null : "Aucune écriture effectuée. Relancez avec --apply après contrôle.",
  }, null, 2));
}

importer()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

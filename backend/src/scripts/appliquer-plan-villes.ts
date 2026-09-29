import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { normaliserEducation } from "../education/catalog-service";

/**
 * Applique le plan figé « villes Mali » (règle du 2026-09-29 : ville = chef-lieu
 * de région ; commune, P-code, cercle, région et localité dans leurs colonnes).
 * Plan : PASSATION_IA/output/2026-09-29-villes-mali/plan-villes-region.json.
 *
 * Par défaut : SIMULATION, aucune écriture. Écriture seulement avec --apply.
 * Prérequis : migration 20260929120000_etablissement_localisation appliquée.
 *
 * Garde-fous :
 *  - plan de plus de 36 h (date d'extraction) refusé ;
 *  - seules les lignes `appliquer: true` (confiance HAUTE ou MOYENNE) sont traitées ;
 *  - par lots transactionnels de 200 ; dans chaque transaction, chaque fiche est
 *    relue et ignorée (journal) si ville, villeNormalisee ou valide ont changé
 *    depuis l'extraction ; l'écriture est conditionnée aux mêmes valeurs
 *    (updateMany … where) pour ne rien écraser d'une modification concurrente ;
 *  - villeNormalisee est recalculée avec normaliserEducation (catalog-service).
 *
 * Options : --plan <fichier> --journal <fichier> --limit N --apply
 * Exemple : npx tsx src/scripts/appliquer-plan-villes.ts --limit 50
 */

const DUREE_VALIDITE_MS = 36 * 60 * 60 * 1000;
const TAILLE_LOT = 200;
const PLAN_PAR_DEFAUT = path.resolve(__dirname, "../../../PASSATION_IA/output/2026-09-29-villes-mali/plan-villes-region.json");

export type LignePlanVille = {
  id: string;
  nom: string;
  villeActuelle: string | null;
  villeNormaliseeActuelle: string;
  valideActuel?: boolean;
  villeProposee: string;
  villeNormaliseeProposee?: string;
  localite: string | null;
  commune: string | null;
  communeCode: string | null;
  cercle: string | null;
  region: string | null;
  confiance: "HAUTE" | "MOYENNE" | "BASSE";
  appliquer: boolean;
};
export type PlanVilles = { extraitLe: string; regle?: string; fiches: LignePlanVille[] };

type EntreeJournal = {
  id: string;
  statut: "simule" | "applique" | "ignore_modifie" | "ignore_absent" | "echec";
  avant?: { ville: string | null; villeNormalisee: string; valide: boolean };
  apres?: Record<string, string | null>;
  raison?: string;
};

/** Refuse un plan trop ancien ou sans date d'extraction exploitable. */
export function verifierFraicheurPlan(plan: Pick<PlanVilles, "extraitLe">, maintenant = new Date()) {
  const extraitLe = new Date(plan.extraitLe);
  if (Number.isNaN(extraitLe.getTime())) throw new Error("Plan refusé : date d'extraction absente ou invalide.");
  const age = maintenant.getTime() - extraitLe.getTime();
  if (age < 0) throw new Error("Plan refusé : date d'extraction dans le futur.");
  if (age > DUREE_VALIDITE_MS) {
    throw new Error(`Plan refusé : extraction du ${plan.extraitLe}, plus de 36 h. Réextraire (SELECT) puis régénérer le plan.`);
  }
}

/** Données écrites pour une ligne du plan ; villeNormalisee recalculée. */
export function donneesLigne(ligne: LignePlanVille) {
  const ville = ligne.villeProposee.trim();
  const villeNormalisee = normaliserEducation(ville);
  if (!ville || !villeNormalisee) throw new Error(`Ligne ${ligne.id} : ville proposée vide.`);
  if (ligne.villeNormaliseeProposee !== undefined && ligne.villeNormaliseeProposee !== villeNormalisee) {
    throw new Error(`Ligne ${ligne.id} : villeNormaliseeProposee « ${ligne.villeNormaliseeProposee} » ≠ normaliserEducation « ${villeNormalisee} ».`);
  }
  const texte = (valeur: string | null, max = 191) => {
    const propre = valeur?.trim() || null;
    if (propre && propre.length > max) throw new Error(`Ligne ${ligne.id} : valeur trop longue (${propre.slice(0, 30)}…).`);
    return propre;
  };
  return {
    ville,
    villeNormalisee,
    localite: texte(ligne.localite),
    commune: texte(ligne.commune),
    communeCode: texte(ligne.communeCode, 24),
    cercle: texte(ligne.cercle),
    region: texte(ligne.region),
  };
}

/** La fiche en base est-elle encore celle que le plan a lue ? */
export function ficheInchangee(
  ligne: Pick<LignePlanVille, "villeActuelle" | "villeNormaliseeActuelle" | "valideActuel">,
  base: { ville: string | null; villeNormalisee: string; valide: boolean },
) {
  return base.ville === ligne.villeActuelle
    && base.villeNormalisee === ligne.villeNormaliseeActuelle
    && base.valide === (ligne.valideActuel ?? true);
}

async function main() {
  const argument = (nom: string) => {
    const index = process.argv.indexOf(nom);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const appliquer = process.argv.includes("--apply");
  const cheminPlan = path.resolve(argument("--plan") ?? PLAN_PAR_DEFAUT);
  const limiteBrute = argument("--limit");
  const limite = limiteBrute === undefined ? Infinity : Number(limiteBrute);
  if (limite !== Infinity && (!Number.isInteger(limite) || limite <= 0)) throw new Error("--limit attend un entier positif.");
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const cheminJournal = path.resolve(
    argument("--journal") ?? path.join(path.dirname(cheminPlan), `journal-villes-${appliquer ? "apply" : "simulation"}-${horodatage}.json`),
  );

  const plan = JSON.parse(fs.readFileSync(cheminPlan, "utf8")) as PlanVilles;
  verifierFraicheurPlan(plan);
  const lignes = plan.fiches.filter((ligne) => ligne.appliquer && ligne.confiance !== "BASSE").slice(0, limite);
  // Validation complète avant toute écriture.
  const donnees = new Map(lignes.map((ligne) => [ligne.id, donneesLigne(ligne)]));

  const prisma = new PrismaClient();
  const journal: EntreeJournal[] = [];
  const compteurs: Record<EntreeJournal["statut"], number> = { simule: 0, applique: 0, ignore_modifie: 0, ignore_absent: 0, echec: 0 };
  const ecrireJournal = () => fs.writeFileSync(cheminJournal, JSON.stringify({
    plan: cheminPlan,
    extraitLe: plan.extraitLe,
    mode: appliquer ? "apply" : "simulation",
    debut: horodatage,
    lignesRetenues: lignes.length,
    compteurs,
    entrees: journal,
  }, null, 1));

  try {
    for (let debut = 0; debut < lignes.length; debut += TAILLE_LOT) {
      const lot = lignes.slice(debut, debut + TAILLE_LOT);
      const entreesLot: EntreeJournal[] = [];
      try {
        await prisma.$transaction(async (transaction) => {
          const bases = await transaction.etablissement.findMany({
            where: { id: { in: lot.map(({ id }) => id) } },
            select: { id: true, ville: true, villeNormalisee: true, valide: true },
          });
          const parId = new Map(bases.map((base) => [base.id, base]));
          for (const ligne of lot) {
            const base = parId.get(ligne.id);
            if (!base) {
              entreesLot.push({ id: ligne.id, statut: "ignore_absent" });
              continue;
            }
            const avant = { ville: base.ville, villeNormalisee: base.villeNormalisee, valide: base.valide };
            if (!ficheInchangee(ligne, base)) {
              entreesLot.push({ id: ligne.id, statut: "ignore_modifie", avant, raison: "ville/villeNormalisee/valide modifiés depuis l'extraction" });
              continue;
            }
            const apres = donnees.get(ligne.id)!;
            if (appliquer) {
              const resultat = await transaction.etablissement.updateMany({
                where: { id: ligne.id, ville: base.ville, villeNormalisee: base.villeNormalisee, valide: base.valide },
                data: apres,
              });
              if (resultat.count !== 1) {
                entreesLot.push({ id: ligne.id, statut: "ignore_modifie", avant, raison: "modifiée pendant la transaction" });
                continue;
              }
            }
            entreesLot.push({ id: ligne.id, statut: appliquer ? "applique" : "simule", avant, apres });
          }
        }, { timeout: 60_000 });
      } catch (erreur) {
        // Lot annulé en entier : rien n'a été écrit pour ces fiches.
        entreesLot.length = 0;
        for (const ligne of lot) {
          entreesLot.push({ id: ligne.id, statut: "echec", raison: erreur instanceof Error ? erreur.message : String(erreur) });
        }
      }
      for (const entree of entreesLot) {
        compteurs[entree.statut] += 1;
        journal.push(entree);
      }
      ecrireJournal();
      console.log(`Lot ${debut / TAILLE_LOT + 1} : ${lot.length} fiches — ${JSON.stringify(compteurs)}`);
    }
  } finally {
    ecrireJournal();
    await prisma.$disconnect();
  }
  console.log(JSON.stringify({ mode: appliquer ? "apply" : "simulation", lignesRetenues: lignes.length, compteurs, journal: cheminJournal }, null, 2));
  if (compteurs.echec) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  });
}

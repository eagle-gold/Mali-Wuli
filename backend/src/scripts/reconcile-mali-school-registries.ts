import { Prisma, PrismaClient, TypeEtablissement } from "@prisma/client";
import { fusionnerEtablissements } from "../education/deduplication-etablissements";
import {
  type FicheReconciliationRegistre,
  type ReferenceReconciliationRegistre,
  planifierReconciliationRegistres,
} from "../education/mali-registry-reconciliation";
import {
  normaliserCodeOfficielMali,
  normaliserNomCampusMali,
} from "../education/mali-school-registries";

const prisma = new PrismaClient();
const APPLIQUER = process.argv.includes("--apply");
const PAYS_CODE = (process.argv.find((argument) => argument.startsWith("--country="))?.split("=")[1] || "ML").toUpperCase();

const objetJson = (valeur: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> | null => (
  valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? valeur as Record<string, Prisma.JsonValue>
    : null
);

const texteJson = (objet: Record<string, Prisma.JsonValue> | null, ...cles: string[]) => {
  for (const cle of cles) {
    const valeur = objet?.[cle];
    if (typeof valeur === "string" && valeur.trim()) return valeur.trim();
    if (typeof valeur === "number" && Number.isFinite(valeur)) return String(valeur);
  }
  return null;
};

const nombreJson = (objet: Record<string, Prisma.JsonValue> | null, ...cles: string[]) => {
  for (const cle of cles) {
    const valeur = objet?.[cle];
    if (typeof valeur === "number" && Number.isFinite(valeur)) return valeur;
    if (typeof valeur === "string") {
      const nombre = Number(valeur.trim().replace(",", "."));
      if (Number.isFinite(nombre)) return nombre;
    }
  }
  return null;
};

const codesJson = (objet: Record<string, Prisma.JsonValue> | null, ...cles: string[]) => {
  const candidats: unknown[] = [];
  for (const cle of cles) {
    const valeur = objet?.[cle];
    if (Array.isArray(valeur)) candidats.push(...valeur);
    else candidats.push(valeur);
  }
  return [...new Set(candidats
    .map(normaliserCodeOfficielMali)
    .filter((code): code is string => Boolean(code)))];
};

const referenceDepuisSource = (params: {
  sourceCode: string;
  identifiantExterne: string;
  nomEtablissement: string;
  donneesBrutes: Prisma.JsonValue | null;
}): ReferenceReconciliationRegistre => {
  const racine = objetJson(params.donneesBrutes);
  const administration = objetJson(racine?.administration);
  const centroide = objetJson(racine?.centroide);
  const nom = texteJson(racine, "nom", "name", "nomEtablissement", "nom_etablissement")
    || params.nomEtablissement;
  return {
    sourceCode: params.sourceCode,
    identifiantExterne: params.identifiantExterne,
    nom,
    cycle: texteJson(racine, "cycle", "niveau"),
    region: texteJson(administration, "region") || texteJson(racine, "region", "adm1_name"),
    cercle: texteJson(administration, "cercle") || texteJson(racine, "cercle", "adm2_name"),
    commune: texteJson(administration, "commune") || texteJson(racine, "commune", "adm3_name"),
    localite: texteJson(administration, "localite") || texteJson(racine, "localite", "adm4_name"),
    latitude: nombreJson(centroide, "latitude") || nombreJson(racine, "latitude"),
    longitude: nombreJson(centroide, "longitude") || nombreJson(racine, "longitude"),
    codesCluster: codesJson(racine, "codesCluster", "codeCluster"),
  };
};

async function chargerFiches(): Promise<FicheReconciliationRegistre[]> {
  const etablissements = await prisma.etablissement.findMany({
    where: {
      paysCode: PAYS_CODE,
      valide: true,
      type: { in: [TypeEtablissement.FONDAMENTALE, TypeEtablissement.LYCEE] },
      sources: { some: {} },
    },
    include: {
      alias: { select: { nom: true } },
      sources: {
        include: { source: { select: { code: true, priorite: true } } },
      },
      _count: {
        select: {
          formations: true,
          avis: true,
          programmes: true,
          alias: true,
          niveaux: true,
          sources: true,
        },
      },
    },
  });
  return etablissements.map((etablissement) => {
    const references = etablissement.sources.map((reference) => referenceDepuisSource({
      sourceCode: reference.source.code,
      identifiantExterne: reference.identifiantExterne,
      nomEtablissement: etablissement.nom,
      donneesBrutes: reference.donneesBrutes,
    }));
    const noms = [
      etablissement.nom,
      ...etablissement.alias.map(({ nom }) => nom),
      ...references.map(({ nom }) => nom),
    ];
    return {
      id: etablissement.id,
      nom: etablissement.nom,
      type: etablissement.type,
      nomsExacts: new Set(noms.map(normaliserNomCampusMali).filter(Boolean)),
      latitude: etablissement.latitude === null ? null : Number(etablissement.latitude),
      longitude: etablissement.longitude === null ? null : Number(etablissement.longitude),
      references,
      sourceCodes: new Set(etablissement.sources.map(({ source }) => source.code)),
      sourcePrioriteMin: Math.min(...etablissement.sources.map(({ source }) => source.priorite), 9_999),
      activite: etablissement._count.formations + etablissement._count.avis + etablissement._count.programmes,
      richesse: etablissement._count.alias + etablissement._count.niveaux + etablissement._count.sources,
      creeLe: etablissement.createdAt.getTime(),
    };
  });
}

async function reconcilier() {
  if (PAYS_CODE !== "ML") {
    throw new Error("Cette réconciliation est exclusivement conçue pour les registres scolaires du Mali (--country=ML).");
  }
  const fiches = await chargerFiches();
  const parId = new Map(fiches.map((fiche) => [fiche.id, fiche]));
  const resultat = planifierReconciliationRegistres(fiches);
  let fusionsEffectuees = 0;

  if (APPLIQUER) {
    for (const plan of resultat.plans) {
      for (const doublonId of plan.doublonIds) {
        await fusionnerEtablissements(prisma, plan.canoniqueId, doublonId);
        fusionsEffectuees += 1;
      }
    }
  }

  const exclusionsParRaison = Object.fromEntries(
    [...new Set(resultat.exclusions.map(({ raison }) => raison))]
      .sort()
      .map((raison) => [raison, resultat.exclusions.filter((exclusion) => exclusion.raison === raison).length]),
  );
  console.log(JSON.stringify({
    mode: APPLIQUER ? "APPLICATION" : "SIMULATION",
    commandeApplication: APPLIQUER ? null : "npm run education:reconcile:mali-registries -- --apply",
    paysCode: PAYS_CODE,
    ...resultat.statistiques,
    fusionsEffectuees,
    exclusionsParRaison,
    plans: resultat.plans.map((plan) => ({
      ...plan,
      canonique: {
        id: plan.canoniqueId,
        nom: parId.get(plan.canoniqueId)?.nom,
        sources: [...(parId.get(plan.canoniqueId)?.sourceCodes || [])].sort(),
      },
      doublons: plan.doublonIds.map((id) => ({
        id,
        nom: parId.get(id)?.nom,
        sources: [...(parId.get(id)?.sourceCodes || [])].sort(),
      })),
    })),
    exemplesExclusions: resultat.exclusions.slice(0, 100).map((exclusion) => ({
      ...exclusion,
      fiches: exclusion.ids.map((id) => ({ id, nom: parId.get(id)?.nom })),
    })),
    avertissement: APPLIQUER
      ? null
      : "Aucune écriture effectuée. Contrôlez les plans avant de relancer avec --apply.",
  }, null, 2));
}

if (require.main === module) {
  reconcilier()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}

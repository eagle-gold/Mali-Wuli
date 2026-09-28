import AdmZip from "adm-zip";
import { PrismaClient } from "@prisma/client";
import { fusionnerEtablissements } from "../education/deduplication-etablissements";
import {
  centroideGeometrie,
  choisirCanoniqueReconciliation,
  dedupliquerLignesOsm,
  distanceMetres,
  signaturesBrancheCompatibles,
  type LigneDeduplicationOsm,
} from "../education/import-mali-osm-utils";

const prisma = new PrismaClient();
const ARCHIVE = "https://production-raw-data-api.s3.amazonaws.com/ISO3/MLI/education_facilities/hotosm_mli_education_facilities_osm_geojson.zip";
const appliquer = process.argv.includes("--apply");
const paysCode = (process.argv.find((item) => item.startsWith("--country="))?.split("=")[1] || "ML").toUpperCase();

type ProprietesOsm = {
  id?: string;
  name?: string | null;
  name_en?: string | null;
  name_fr?: string | null;
  name_latin?: string | null;
  addr_city?: string | null;
  adm1_name?: string | null;
  adm2_name?: string | null;
  adm3_name?: string | null;
  adm3_pcode?: string | number | null;
  adm4_name?: string | null;
};

type FeatureOsm = {
  properties?: ProprietesOsm;
  geometry?: { type?: string; coordinates?: unknown };
};

type LigneReconciliation = LigneDeduplicationOsm;

type PlanFusion = {
  nomCampus: string;
  canonique: { id: string; nom: string };
  doublons: Array<{ id: string; nom: string }>;
  osmIds: string[];
  nomsOsm: string[];
  distanceMaximaleMetres: number;
  raisonChoixCanonique: "provenance-non-osm" | "fiche-la-plus-riche";
};

type Exclusion = {
  nomCampus: string;
  raison: "branche-distincte" | "grappes-chevauchantes" | "fiche-absente" | "plusieurs-canoniques";
  ids: string[];
  osmIds: string[];
  nomsOsm: string[];
};

const normaliser = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const pcode = (valeur?: string | number | null) => String(valeur ?? "").trim().toLocaleUpperCase("fr");

const distanceMaximale = (lignes: LigneReconciliation[]) => {
  let maximum = 0;
  for (let index = 0; index < lignes.length; index += 1) {
    for (let autre = index + 1; autre < lignes.length; autre += 1) {
      maximum = Math.max(maximum, distanceMetres(lignes[index], lignes[autre]));
    }
  }
  return Math.round(maximum);
};

async function chargerLignesOsm(
  idParOsm: Map<string, { id: string; type: LigneReconciliation["type"] }>,
) {
  const response = await fetch(ARCHIVE, {
    headers: { "User-Agent": "MaliWuli-Education-Reconciliation/0.1" },
  });
  if (!response.ok) throw new Error(`HOT/HDX Mali ${response.status}`);
  const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
  const entree = zip.getEntries().find(({ entryName }) => entryName.endsWith("education_facilities.geojson"));
  if (!entree) throw new Error("GeoJSON éducation Mali absent");
  const donnees = JSON.parse(entree.getData().toString("utf8")) as { features?: FeatureOsm[] };
  const lignes: LigneReconciliation[] = [];
  let sansReference = 0;
  let sansNom = 0;

  for (const feature of donnees.features || []) {
    const proprietes = feature.properties || {};
    const osmId = proprietes.id?.trim();
    const reference = osmId ? idParOsm.get(osmId) : undefined;
    if (!osmId || !reference) {
      sansReference += 1;
      continue;
    }
    const nom = (proprietes.name_fr
      || proprietes.name
      || proprietes.name_latin
      || proprietes.name_en)?.trim();
    if (!nom) {
      sansNom += 1;
      continue;
    }
    const coordonnees = centroideGeometrie(feature.geometry);
    const localite = proprietes.addr_city
      || proprietes.adm4_name
      || proprietes.adm3_name
      || proprietes.adm2_name
      || proprietes.adm1_name
      || "";
    lignes.push({
      id: reference.id,
      osmId,
      nom,
      type: reference.type,
      villeNormalisee: normaliser(localite),
      admin3Pcode: pcode(proprietes.adm3_pcode),
      admin3NomNormalise: normaliser(proprietes.adm3_name || ""),
      localiteNormalisee: normaliser(proprietes.addr_city || proprietes.adm4_name || localite),
      latitude: coordonnees.latitude,
      longitude: coordonnees.longitude,
      existant: true,
    });
  }
  return {
    lignes,
    totalFeatures: donnees.features?.length || 0,
    sansReference,
    sansNom,
  };
}

async function reconcilier() {
  if (paysCode !== "ML") {
    throw new Error("Ce rapprochement géographique est limité au catalogue OSM du Mali (--country=ML).");
  }
  const sourceOsm = await prisma.sourceEducative.findUniqueOrThrow({
    where: { code: "hotosm-mali-education" },
  });
  const references = await prisma.etablissementSource.findMany({
    where: {
      sourceId: sourceOsm.id,
      etablissement: { paysCode: "ML", valide: true },
    },
    select: {
      identifiantExterne: true,
      etablissementId: true,
      etablissement: { select: { type: true } },
    },
  });
  const idParOsm = new Map(references.map((reference) => [
    reference.identifiantExterne,
    { id: reference.etablissementId, type: reference.etablissement.type },
  ]));
  const chargement = await chargerLignesOsm(idParOsm);
  const deduplication = dedupliquerLignesOsm(chargement.lignes);
  const lignesParOsm = new Map(chargement.lignes.map((ligne) => [ligne.osmId, ligne]));
  const idsConcernes = [...new Set(deduplication.ambiguites.flatMap(({ idsExistants }) => idsExistants))];
  const etablissements = await prisma.etablissement.findMany({
    where: { id: { in: idsConcernes }, paysCode: "ML", valide: true },
    include: {
      sources: { select: { sourceId: true } },
      _count: true,
    },
  });
  const etablissementParId = new Map(etablissements.map((item) => [item.id, item]));
  const nombreGroupesParId = new Map<string, number>();
  for (const groupe of deduplication.ambiguites) {
    for (const id of groupe.idsExistants) {
      nombreGroupesParId.set(id, (nombreGroupesParId.get(id) || 0) + 1);
    }
  }

  const plans: PlanFusion[] = [];
  const exclusions: Exclusion[] = [];
  for (const groupe of deduplication.ambiguites) {
    const lignes = groupe.osmIds
      .map((osmId) => lignesParOsm.get(osmId))
      .filter((ligne): ligne is LigneReconciliation => Boolean(ligne));
    const nomsOsm = [...new Set(lignes.map(({ nom }) => nom))];
    const baseExclusion = {
      nomCampus: groupe.nomCampus,
      ids: groupe.idsExistants,
      osmIds: groupe.osmIds,
      nomsOsm,
    };
    if (!signaturesBrancheCompatibles(lignes.map(({ nom }) => nom))) {
      exclusions.push({ ...baseExclusion, raison: "branche-distincte" });
      continue;
    }
    if (groupe.idsExistants.some((id) => (nombreGroupesParId.get(id) || 0) > 1)) {
      exclusions.push({ ...baseExclusion, raison: "grappes-chevauchantes" });
      continue;
    }
    const fiches = groupe.idsExistants
      .map((id) => etablissementParId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (fiches.length !== groupe.idsExistants.length) {
      exclusions.push({ ...baseExclusion, raison: "fiche-absente" });
      continue;
    }
    const choixCanonique = choisirCanoniqueReconciliation(fiches.map((fiche) => ({
      id: fiche.id,
      provenanceNonOsm: fiche.sources.some(({ sourceId }) => sourceId !== sourceOsm.id),
      activite: fiche._count.formations + fiche._count.avis + fiche._count.programmes,
      richesse: fiche._count.alias + fiche._count.niveaux + fiche._count.sources,
      creeLe: fiche.createdAt.getTime(),
    })));
    if (choixCanonique.id === null) {
      exclusions.push({ ...baseExclusion, raison: "plusieurs-canoniques" });
      continue;
    }
    const canonique = fiches.find(({ id }) => id === choixCanonique.id)!;
    plans.push({
      nomCampus: groupe.nomCampus,
      canonique: { id: canonique.id, nom: canonique.nom },
      doublons: fiches
        .filter(({ id }) => id !== canonique.id)
        .map(({ id, nom }) => ({ id, nom })),
      osmIds: groupe.osmIds,
      nomsOsm,
      distanceMaximaleMetres: distanceMaximale(lignes),
      raisonChoixCanonique: choixCanonique.raison,
    });
  }

  let fusionsEffectuees = 0;
  if (appliquer) {
    for (const plan of plans) {
      for (const doublon of plan.doublons) {
        await fusionnerEtablissements(prisma, plan.canonique.id, doublon.id);
        fusionsEffectuees += 1;
      }
    }
  }

  console.log(JSON.stringify({
    mode: appliquer ? "APPLICATION" : "SIMULATION",
    commandeApplication: appliquer ? null : "npm run education:reconcile:mali -- --apply",
    source: ARCHIVE,
    totalFeatures: chargement.totalFeatures,
    referencesActives: references.length,
    lignesAnalysees: chargement.lignes.length,
    sansReference: chargement.sansReference,
    sansNom: chargement.sansNom,
    groupesGeographiquesCandidats: deduplication.statistiques.groupesCandidats,
    groupesExistantsAmbigus: deduplication.statistiques.groupesAmbigus,
    groupesRetenus: plans.length,
    fusionsPrevues: plans.reduce((total, plan) => total + plan.doublons.length, 0),
    fusionsEffectuees,
    exclusions: {
      total: exclusions.length,
      branchesDistinctes: exclusions.filter(({ raison }) => raison === "branche-distincte").length,
      grappesChevauchantes: exclusions.filter(({ raison }) => raison === "grappes-chevauchantes").length,
      fichesAbsentes: exclusions.filter(({ raison }) => raison === "fiche-absente").length,
      plusieursCanoniques: exclusions.filter(({ raison }) => raison === "plusieurs-canoniques").length,
    },
    plans,
    detailsExclusions: exclusions,
  }, null, 2));
}

reconcilier()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

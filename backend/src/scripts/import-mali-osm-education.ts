import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import {
  NiveauEducation,
  Prisma,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
} from "@prisma/client";
import {
  cleRapprochementEtablissement,
  villeRapprochementMali,
} from "../education/deduplication-etablissements";

const prisma = new PrismaClient();
const ARCHIVE = "https://production-raw-data-api.s3.amazonaws.com/ISO3/MLI/education_facilities/hotosm_mli_education_facilities_osm_geojson.zip";
const PAGE_SOURCE = "https://data.humdata.org/dataset/hotosm_mli_education_facilities";
const TAILLE_LOT = 700;

type Proprietes = {
  id?: string;
  name?: string | null;
  name_en?: string | null;
  name_fr?: string | null;
  name_latin?: string | null;
  amenity?: string | null;
  building?: string | null;
  operator_type?: string | null;
  addr_full?: string | null;
  addr_city?: string | null;
  source?: string | null;
  adm1_name?: string | null;
  adm2_name?: string | null;
  adm3_name?: string | null;
};

type Feature = {
  properties: Proprietes;
  geometry?: { type?: string; coordinates?: unknown };
};

type LigneImportee = {
  id: string;
  osmId: string;
  nom: string;
  nomNormalise: string;
  aliases: string[];
  type: TypeEtablissement;
  statut: StatutEtablissement;
  niveaux: NiveauEducation[];
  ville: string | null;
  villeNormalisee: string;
  latitude: number | null;
  longitude: number | null;
  existant: boolean;
  donneesBrutes: Prisma.InputJsonValue;
};

const normaliser = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const empreinte = (valeur: string) => createHash("sha1").update(valeur).digest("hex").slice(0, 24);

function classifier(proprietes: Proprietes, nom: string) {
  const categorie = normaliser(`${proprietes.amenity || ""} ${proprietes.building || ""} ${nom}`);
  if (/university|universite|faculte|institut superieur|ecole superieure/.test(categorie)) {
    return { type: /institut|ecole/.test(categorie) ? TypeEtablissement.ECOLE_SUPERIEURE : TypeEtablissement.UNIVERSITE, niveaux: [NiveauEducation.SUPERIEUR] };
  }
  if (/college|lycee|secondaire/.test(categorie)) {
    return { type: TypeEtablissement.LYCEE, niveaux: [NiveauEducation.SECONDAIRE] };
  }
  if (/kindergarten|maternelle|prescolaire/.test(categorie)) {
    return { type: TypeEtablissement.FONDAMENTALE, niveaux: [NiveauEducation.PRESCOLAIRE, NiveauEducation.PRIMAIRE] };
  }
  return { type: TypeEtablissement.FONDAMENTALE, niveaux: [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL] };
}

const statut = (valeur?: string | null) => {
  if (/private|prive/i.test(valeur || "")) return StatutEtablissement.PRIVE;
  if (/public|government/i.test(valeur || "")) return StatutEtablissement.PUBLIC;
  return StatutEtablissement.INCONNU;
};

const point = (geometry?: Feature["geometry"]) => {
  if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates)) return { longitude: null, latitude: null };
  const [longitude, latitude] = geometry.coordinates;
  return {
    longitude: typeof longitude === "number" ? longitude : null,
    latitude: typeof latitude === "number" ? latitude : null,
  };
};

async function enregistrerLot(lot: LigneImportee[], sourceId: string) {
  const nouvelles = [...new Map(lot.filter(({ existant }) => !existant).map((item) => [item.id, item])).values()];
  if (nouvelles.length) {
    const valeurs = Prisma.join(nouvelles.map((item) => Prisma.sql`(
      ${item.id}, ${item.nom}, ${item.nomNormalise}, ${item.type}::"TypeEtablissement", 'ML'::char(2),
      ${item.ville}, ${item.villeNormalisee}, ${item.statut}::"StatutEtablissement",
      ${item.latitude}::numeric, ${item.longitude}::numeric, true, NOW(), NOW()
    )`));
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Etablissement"
        (id, nom, "nomNormalise", type, "paysCode", ville, "villeNormalisee", statut, latitude, longitude, valide, "createdAt", "updatedAt")
      VALUES ${valeurs}
      ON CONFLICT (id) DO UPDATE SET
        nom=EXCLUDED.nom, "nomNormalise"=EXCLUDED."nomNormalise", type=EXCLUDED.type,
        ville=EXCLUDED.ville, "villeNormalisee"=EXCLUDED."villeNormalisee", statut=EXCLUDED.statut,
        latitude=COALESCE(EXCLUDED.latitude, "Etablissement".latitude),
        longitude=COALESCE(EXCLUDED.longitude, "Etablissement".longitude), valide=true, "updatedAt"=NOW()
    `);
    await prisma.etablissementNiveau.createMany({
      data: nouvelles.flatMap((item) => item.niveaux.map((niveau) => ({ etablissementId: item.id, niveau }))),
      skipDuplicates: true,
    });
    await prisma.etablissementAlias.createMany({
      data: nouvelles.flatMap((item) => item.aliases.map((alias) => ({ etablissementId: item.id, nom: alias, nomNormalise: normaliser(alias) }))),
      skipDuplicates: true,
    });
  }
  const uniques = [...new Map(lot.map((item) => [item.osmId, item])).values()];
  await prisma.etablissementSource.createMany({
    data: uniques.map((item) => ({
      id: `source-osm-${empreinte(item.osmId)}`,
      etablissementId: item.id,
      sourceId,
      identifiantExterne: item.osmId,
      urlSource: `https://www.openstreetmap.org/${item.osmId}`,
      confiance: 0.72,
      donneesBrutes: item.donneesBrutes,
    })),
    skipDuplicates: true,
  });
  await prisma.etablissementSource.updateMany({
    where: { sourceId, identifiantExterne: { in: uniques.map(({ osmId }) => osmId) } },
    data: { vuLe: new Date(), confiance: 0.72 },
  });
}

async function importer() {
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "hotosm-mali-education" } });
  const importation = await prisma.importEducation.create({ data: { sourceId: source.id, paysCode: "ML" } });
  const references = await prisma.etablissementSource.findMany({ where: { sourceId: source.id }, select: { identifiantExterne: true, etablissementId: true } });
  const idParOsm = new Map(references.map(({ identifiantExterne, etablissementId }) => [identifiantExterne, etablissementId]));
  const existantsMali = await prisma.etablissement.findMany({
    where: { paysCode: "ML", valide: true, sources: { none: { sourceId: source.id } } },
    include: { alias: true },
  });
  const canoniqueExact = new Map<string, string>();
  const canoniqueRapproche = new Map<string, string>();
  for (const item of existantsMali) {
    for (const nom of [item.nomNormalise, ...item.alias.map(({ nomNormalise }) => nomNormalise)]) {
      if (!nom) continue;
      const villeRapprochee = villeRapprochementMali(item.villeNormalisee);
      canoniqueExact.set(`${item.type}|${villeRapprochee}|${nom}`, item.id);
      const cle = cleRapprochementEtablissement({ nom, type: item.type, villeNormalisee: villeRapprochee });
      if (cle.slice(cle.lastIndexOf("|") + 1).length >= 4) canoniqueRapproche.set(cle, item.id);
    }
  }
  let recus = 0;
  let ajoutes = 0;
  let modifies = 0;
  let ignores = 0;
  let rattaches = 0;
  let lot: LigneImportee[] = [];
  try {
    const response = await fetch(ARCHIVE, { headers: { "User-Agent": "MaliWuli-Education-Catalog/0.1" } });
    if (!response.ok) throw new Error(`HOT/HDX Mali ${response.status}`);
    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
    const entree = zip.getEntries().find(({ entryName }) => entryName.endsWith("education_facilities.geojson"));
    if (!entree) throw new Error("GeoJSON éducation Mali absent");
    const donnees = JSON.parse(entree.getData().toString("utf8")) as { features?: Feature[] };
    for (const feature of donnees.features || []) {
      recus += 1;
      const osmId = feature.properties.id?.trim();
      const nom = (feature.properties.name_fr || feature.properties.name || feature.properties.name_latin || feature.properties.name_en)?.trim();
      if (!osmId || !nom) {
        ignores += 1;
        continue;
      }
      const nomNormalise = normaliser(nom);
      const classification = classifier(feature.properties, nom);
      const ville = feature.properties.addr_city || feature.properties.adm3_name || feature.properties.adm2_name || feature.properties.adm1_name || null;
      const villeNormalisee = normaliser(ville || "");
      const referenceId = idParOsm.get(osmId);
      const villeRapprochee = villeRapprochementMali(villeNormalisee);
      const cleExacte = `${classification.type}|${villeRapprochee}|${nomNormalise}`;
      const cleRapprochee = cleRapprochementEtablissement({ nom, type: classification.type, villeNormalisee: villeRapprochee });
      const canoniqueId = canoniqueExact.get(cleExacte) || canoniqueRapproche.get(cleRapprochee);
      const id = referenceId || canoniqueId || `ml-osm-${empreinte(osmId)}`;
      const estExistant = Boolean(referenceId || canoniqueId);
      if (referenceId) modifies += 1;
      else if (canoniqueId) rattaches += 1;
      else ajoutes += 1;
      const coordonnees = point(feature.geometry);
      const aliases = [...new Set([feature.properties.name, feature.properties.name_fr, feature.properties.name_en, feature.properties.name_latin]
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
        .filter((item) => normaliser(item) !== nomNormalise))];
      lot.push({
        id,
        osmId,
        nom,
        nomNormalise,
        aliases,
        type: classification.type,
        statut: statut(feature.properties.operator_type),
        niveaux: classification.niveaux,
        ville,
        villeNormalisee,
        latitude: coordonnees.latitude,
        longitude: coordonnees.longitude,
        existant: estExistant,
        donneesBrutes: {
          amenity: feature.properties.amenity || null,
          building: feature.properties.building || null,
          operatorType: feature.properties.operator_type || null,
          adresse: feature.properties.addr_full || null,
          sourceOsm: feature.properties.source || null,
          region: feature.properties.adm1_name || null,
          cercle: feature.properties.adm2_name || null,
          commune: feature.properties.adm3_name || null,
          geometrie: feature.geometry?.type || null,
        },
      });
      if (lot.length >= TAILLE_LOT) {
        await enregistrerLot(lot, source.id);
        lot = [];
      }
    }
    await enregistrerLot(lot, source.id);
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: {
        statut: StatutImportEducation.TERMINE,
        ajoutes,
        modifies,
        ignores,
        termineLe: new Date(),
        detail: { recus, rattaches, source: ARCHIVE, licence: "ODbL-1.0", avertissement: "OpenStreetMap n'est pas exhaustif" },
      },
    });
    console.log(JSON.stringify({ recus, ajoutes, modifies, rattaches, ignores }, null, 2));
  } catch (error) {
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: { statut: StatutImportEducation.ECHEC, erreurs: 1, termineLe: new Date(), detail: { message: error instanceof Error ? error.message : "Erreur inconnue" } },
    });
    throw error;
  }
}

importer()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());

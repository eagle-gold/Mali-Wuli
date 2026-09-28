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
  nomRapprochementEtablissement,
  villeRapprochementMali,
} from "../education/deduplication-etablissements";
import {
  ajouterCandidat,
  agregerLignesParId,
  centroideGeometrie,
  dedupliquerLignesOsm,
  groupeTypeRapprochement,
  resoudreCandidats,
} from "../education/import-mali-osm-utils";
import { villeCanoniqueMali } from "../education/normalisation-localisations";

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
  adm0_name?: string | null;
  adm0_pcode?: string | number | null;
  adm1_name?: string | null;
  adm1_pcode?: string | number | null;
  adm2_name?: string | null;
  adm2_pcode?: string | number | null;
  adm3_name?: string | null;
  adm3_pcode?: string | number | null;
  adm4_name?: string | null;
  adm4_pcode?: string | number | null;
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
  admin3Pcode: string;
  admin3NomNormalise: string;
  localiteNormalisee: string;
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

const pcode = (valeur?: string | number | null) => String(valeur ?? "").trim().toLocaleUpperCase("fr");

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

async function enregistrerLot(lot: LigneImportee[], sourceId: string) {
  const etablissements = agregerLignesParId(lot);
  const nouvelles = etablissements.filter(({ existant }) => !existant);
  if (nouvelles.length) {
    const valeurs = Prisma.join(nouvelles.map((item) => Prisma.sql`(
      ${item.id}, ${item.nom}, ${item.nomNormalise}, ${item.type}, ${"ML"}, ${"ML"},
      ${item.ville}, ${item.villeNormalisee}, ${item.statut},
      ${item.latitude}, ${item.longitude}, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
    )`));
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO Etablissement
        (id, nom, nomNormalise, type, paysCode, systemeEducatifCode,
         ville, villeNormalisee, statut, latitude, longitude,
         valide, createdAt, updatedAt)
      VALUES ${valeurs}
      ON DUPLICATE KEY UPDATE
        nom=VALUES(nom), nomNormalise=VALUES(nomNormalise), type=VALUES(type),
        systemeEducatifCode=VALUES(systemeEducatifCode),
        ville=VALUES(ville), villeNormalisee=VALUES(villeNormalisee), statut=VALUES(statut),
        latitude=COALESCE(VALUES(latitude), latitude),
        longitude=COALESCE(VALUES(longitude), longitude), valide=true,
        updatedAt=CURRENT_TIMESTAMP(3)
    `);
  }
  const niveaux = etablissements.flatMap((item) => (
    item.niveaux.map((niveau) => ({ etablissementId: item.id, niveau }))
  ));
  if (niveaux.length) {
    await prisma.etablissementNiveau.createMany({
      data: niveaux,
      skipDuplicates: true,
    });
  }
  const aliases = etablissements.flatMap((item) => item.aliases.map((alias) => ({
    etablissementId: item.id,
    nom: alias,
    nomNormalise: normaliser(alias),
  })));
  if (aliases.length) {
    await prisma.etablissementAlias.createMany({
      data: aliases,
      skipDuplicates: true,
    });
  }
  const idsBamako = [...new Set(lot
    .filter(({ villeNormalisee }) => villeNormalisee === "bamako")
    .map(({ id }) => id))];
  if (idsBamako.length) {
    // Les références OSM déjà connues ne passent pas dans l'upsert ci-dessus.
    // La ville canonique doit néanmoins rester corrigée lors de chaque réimport.
    await prisma.etablissement.updateMany({
      where: { id: { in: idsBamako }, paysCode: "ML" },
      data: { ville: "Bamako", villeNormalisee: "bamako" },
    });
  }
  const uniquesParOsm = new Map<string, LigneImportee>();
  for (const item of [...lot].sort((a, b) => a.osmId.localeCompare(b.osmId, "fr"))) {
    if (!uniquesParOsm.has(item.osmId)) uniquesParOsm.set(item.osmId, item);
  }
  const uniques = [...uniquesParOsm.values()];
  if (uniques.length) {
    const valeursSources = Prisma.join(uniques.map((item) => Prisma.sql`(
      ${`source-osm-${empreinte(item.osmId)}`}, ${item.id}, ${sourceId}, ${item.osmId},
      ${`https://www.openstreetmap.org/${item.osmId}`}, ${0.72}, CURRENT_TIMESTAMP(3),
      ${JSON.stringify(item.donneesBrutes)}
    )`));
    // L'upsert met aussi à jour le JSON brut : les pcodes ajoutés au schéma
    // HOT/HDX ne seraient sinon conservés qu'au tout premier import.
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO EtablissementSource
        (id, etablissementId, sourceId, identifiantExterne, urlSource,
         confiance, vuLe, donneesBrutes)
      VALUES ${valeursSources}
      ON DUPLICATE KEY UPDATE
        etablissementId=VALUES(etablissementId),
        urlSource=VALUES(urlSource),
        confiance=VALUES(confiance),
        vuLe=VALUES(vuLe),
        donneesBrutes=VALUES(donneesBrutes)
    `);
  }
}

const cleCanoniqueExacte = (type: TypeEtablissement, ville: string, nom: string) => (
  `${groupeTypeRapprochement(type)}|${ville}|${nom}`
);

const cleCanoniqueRapprochee = (type: TypeEtablissement, ville: string, nom: string) => (
  `${groupeTypeRapprochement(type)}|${ville}|${nomRapprochementEtablissement(nom)}`
);

const lotsSansSeparerIdentifiant = (lignes: LigneImportee[], tailleMaximale: number) => {
  const groupes = new Map<string, LigneImportee[]>();
  for (const ligne of lignes) {
    const groupe = groupes.get(ligne.id) || [];
    groupe.push(ligne);
    groupes.set(ligne.id, groupe);
  }
  const lots: LigneImportee[][] = [];
  let lot: LigneImportee[] = [];
  for (const groupe of groupes.values()) {
    if (lot.length && lot.length + groupe.length > tailleMaximale) {
      lots.push(lot);
      lot = [];
    }
    lot.push(...groupe);
  }
  if (lot.length) lots.push(lot);
  return lots;
};

async function importer() {
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "hotosm-mali-education" } });
  const importation = await prisma.importEducation.create({ data: { sourceId: source.id, paysCode: "ML" } });
  const references = await prisma.etablissementSource.findMany({ where: { sourceId: source.id }, select: { identifiantExterne: true, etablissementId: true } });
  const idParOsm = new Map(references.map(({ identifiantExterne, etablissementId }) => [identifiantExterne, etablissementId]));
  const existantsMali = await prisma.etablissement.findMany({
    where: { paysCode: "ML", valide: true, sources: { none: { sourceId: source.id } } },
    include: { alias: true },
  });
  const canoniqueExact = new Map<string, Set<string>>();
  const canoniqueRapproche = new Map<string, Set<string>>();
  for (const item of existantsMali) {
    for (const nom of [item.nomNormalise, ...item.alias.map(({ nomNormalise }) => nomNormalise)]) {
      if (!nom) continue;
      const villeRapprochee = villeRapprochementMali(item.villeNormalisee);
      ajouterCandidat(canoniqueExact, cleCanoniqueExacte(item.type, villeRapprochee, nom), item.id);
      const nomRapproche = nomRapprochementEtablissement(nom);
      if (nomRapproche.length >= 4) {
        ajouterCandidat(
          canoniqueRapproche,
          cleCanoniqueRapprochee(item.type, villeRapprochee, nom),
          item.id,
        );
      }
    }
  }
  let recus = 0;
  let ajoutes = 0;
  let modifies = 0;
  let ignores = 0;
  let rattachesCanoniques = 0;
  let ambiguitesCanoniques = 0;
  const exemplesAmbiguitesCanoniques: Array<{
    osmId: string;
    nom: string;
    ville: string;
    candidats: string[];
  }> = [];
  const lignesImportees: LigneImportee[] = [];
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
      const villeSource = feature.properties.addr_city
        || feature.properties.adm4_name
        || feature.properties.adm3_name
        || feature.properties.adm2_name
        || feature.properties.adm1_name
        || null;
      const { ville, villeNormalisee } = villeCanoniqueMali(villeSource, {
        region: feature.properties.adm1_name,
        cercle: feature.properties.adm2_name,
        commune: feature.properties.adm3_name,
      });
      const referenceId = idParOsm.get(osmId);
      const villeRapprochee = villeRapprochementMali(villeNormalisee);
      const cleExacte = cleCanoniqueExacte(classification.type, villeRapprochee, nomNormalise);
      const nomRapproche = nomRapprochementEtablissement(nom);
      const cleRapprochee = cleCanoniqueRapprochee(classification.type, villeRapprochee, nom);
      const resolution = referenceId || !villeRapprochee
        ? { id: null, candidats: [], ambigu: false }
        : resoudreCandidats(
          canoniqueExact.get(cleExacte),
          nomRapproche.length >= 4 ? canoniqueRapproche.get(cleRapprochee) : undefined,
        );
      if (resolution.ambigu) {
        ambiguitesCanoniques += 1;
        if (exemplesAmbiguitesCanoniques.length < 25) {
          exemplesAmbiguitesCanoniques.push({
            osmId,
            nom,
            ville: villeRapprochee,
            candidats: resolution.candidats,
          });
        }
      }
      const canoniqueId = resolution.id;
      const id = referenceId || canoniqueId || `ml-osm-${empreinte(osmId)}`;
      const estExistant = Boolean(referenceId || canoniqueId);
      if (referenceId) modifies += 1;
      else if (canoniqueId) rattachesCanoniques += 1;
      const coordonnees = centroideGeometrie(feature.geometry);
      const aliases = [...new Set([feature.properties.name, feature.properties.name_fr, feature.properties.name_en, feature.properties.name_latin]
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
        .filter((item) => normaliser(item) !== nomNormalise))];
      const admin3NomNormalise = normaliser(feature.properties.adm3_name || "");
      const localiteNormalisee = normaliser(
        feature.properties.addr_city || feature.properties.adm4_name || villeNormalisee,
      );
      lignesImportees.push({
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
        admin3Pcode: pcode(feature.properties.adm3_pcode),
        admin3NomNormalise,
        localiteNormalisee,
        latitude: coordonnees.latitude,
        longitude: coordonnees.longitude,
        existant: estExistant,
        donneesBrutes: {
          amenity: feature.properties.amenity || null,
          building: feature.properties.building || null,
          operatorType: feature.properties.operator_type || null,
          adresse: feature.properties.addr_full || null,
          sourceOsm: feature.properties.source || null,
          pays: feature.properties.adm0_name || null,
          paysPcode: feature.properties.adm0_pcode ?? null,
          region: feature.properties.adm1_name || null,
          regionPcode: feature.properties.adm1_pcode ?? null,
          cercle: feature.properties.adm2_name || null,
          cerclePcode: feature.properties.adm2_pcode ?? null,
          commune: feature.properties.adm3_name || null,
          communePcode: feature.properties.adm3_pcode ?? null,
          localite: feature.properties.adm4_name || null,
          localitePcode: feature.properties.adm4_pcode ?? null,
          villeSource,
          geometrie: feature.geometry?.type || null,
          centroide: coordonnees,
          sourceCatalogue: PAGE_SOURCE,
        },
      });
    }
    const deduplication = dedupliquerLignesOsm(lignesImportees);
    const etablissementsFinaux = agregerLignesParId(deduplication.lignes);
    ajoutes = etablissementsFinaux.filter(({ existant }) => !existant).length;
    const rattaches = rattachesCanoniques
      + deduplication.statistiques.lignesRattacheesAExistant;
    for (const lot of lotsSansSeparerIdentifiant(deduplication.lignes, TAILLE_LOT)) {
      await enregistrerLot(lot, source.id);
    }
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: {
        statut: StatutImportEducation.TERMINE,
        ajoutes,
        modifies,
        ignores,
        termineLe: new Date(),
        detail: {
          recus,
          rattaches,
          source: ARCHIVE,
          licence: "ODbL-1.0",
          avertissement: "OpenStreetMap n'est pas exhaustif",
          ambiguitesCanoniques,
          exemplesAmbiguitesCanoniques,
          deduplicationIntraFichier: deduplication.statistiques,
          exemplesAmbiguitesIntraFichier: deduplication.ambiguites.slice(0, 25),
        },
      },
    });
    console.log(JSON.stringify({
      recus,
      ajoutes,
      modifies,
      rattaches,
      ignores,
      ambiguitesCanoniques,
      deduplicationIntraFichier: deduplication.statistiques,
    }, null, 2));
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

import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { parse } from "csv-parse";
import {
  NiveauEducation,
  Prisma,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
} from "@prisma/client";

const prisma = new PrismaClient();
const ARCHIVE = "https://www150.statcan.gc.ca/n1/pub/37-26-0001/2022001/BDOEE_v2.1.zip";
const PAGE_SOURCE = "https://open.canada.ca/data/fr/dataset/4dd64c98-b12a-49c7-be29-21c77d22b675";
const TAILLE_LOT = 750;

type LigneCanada = Record<string, string | undefined>;
type LigneImportee = {
  id: string;
  identifiant: string;
  nom: string;
  nomNormalise: string;
  type: TypeEtablissement;
  niveaux: NiveauEducation[];
  ville: string | null;
  villeNormalisee: string;
  latitude: string | null;
  longitude: string | null;
  donneesBrutes: Prisma.InputJsonValue;
};

const normaliser = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const actif = (valeur?: string) => valeur === "1";
const coordonnee = (valeur?: string) => valeur && /^-?\d+(?:\.\d+)?$/.test(valeur.trim()) ? valeur.trim() : null;
const idTechnique = (prefixe: string, valeur: string) => `${prefixe}-${createHash("sha1").update(valeur).digest("hex").slice(0, 24)}`;

function classifier(ligne: LigneCanada) {
  const niveaux = [
    ...(actif(ligne.CITE010) || actif(ligne.CITE020) ? [NiveauEducation.PRESCOLAIRE] : []),
    ...(actif(ligne.CITE1) ? [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL] : []),
    ...(actif(ligne.CITE2) || actif(ligne.CITE3) ? [NiveauEducation.SECONDAIRE] : []),
    ...(actif(ligne.CITE4Plus) ? [NiveauEducation.PROFESSIONNEL, NiveauEducation.SUPERIEUR] : []),
  ];
  const type = actif(ligne.CITE2) || actif(ligne.CITE3)
    ? TypeEtablissement.LYCEE
    : actif(ligne.CITE4Plus)
      ? TypeEtablissement.ECOLE_SUPERIEURE
      : TypeEtablissement.FONDAMENTALE;
  return { type, niveaux: [...new Set(niveaux.length ? niveaux : [NiveauEducation.FONDAMENTAL])] };
}

async function enregistrerLot(lot: LigneImportee[], sourceId: string) {
  const unique = [...new Map(lot.map((item) => [item.id, item])).values()];
  if (!unique.length) return;
  const valeurs = Prisma.join(unique.map((item) => Prisma.sql`(
    ${item.id}, ${item.nom}, ${item.nomNormalise}, ${item.type}, ${"CA"}, ${"CA"},
    ${item.ville}, ${item.villeNormalisee}, ${StatutEtablissement.INCONNU},
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
      ville=VALUES(ville), villeNormalisee=VALUES(villeNormalisee),
      latitude=VALUES(latitude), longitude=VALUES(longitude), valide=true,
      updatedAt=CURRENT_TIMESTAMP(3)
  `);
  await prisma.etablissementNiveau.createMany({
    data: unique.flatMap((item) => item.niveaux.map((niveau) => ({ etablissementId: item.id, niveau }))),
    skipDuplicates: true,
  });
  await prisma.etablissementSource.createMany({
    data: unique.map((item) => ({
      id: idTechnique("source-statcan", item.identifiant),
      etablissementId: item.id,
      sourceId,
      identifiantExterne: item.identifiant,
      urlSource: PAGE_SOURCE,
      confiance: 0.94,
      donneesBrutes: item.donneesBrutes,
    })),
    skipDuplicates: true,
  });
  await prisma.etablissementSource.updateMany({
    where: { sourceId, identifiantExterne: { in: unique.map(({ identifiant }) => identifiant) } },
    data: { vuLe: new Date(), confiance: 0.94 },
  });
}

async function importer() {
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "statcan-odef" } });
  const importation = await prisma.importEducation.create({ data: { sourceId: source.id, paysCode: "CA" } });
  const existantes = await prisma.etablissementSource.findMany({
    where: { sourceId: source.id },
    select: { identifiantExterne: true, etablissementId: true },
  });
  const idParIdentifiant = new Map(existantes.map(({ identifiantExterne, etablissementId }) => [identifiantExterne, etablissementId]));
  let recus = 0;
  let ajoutes = 0;
  let modifies = 0;
  let ignores = 0;
  let lot: LigneImportee[] = [];
  try {
    const response = await fetch(ARCHIVE, { headers: { "User-Agent": "MaliWuli-Education-Catalog/0.1" } });
    if (!response.ok) throw new Error(`Statistique Canada ${response.status}`);
    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
    const entree = zip.getEntries().find(({ entryName }) => entryName.endsWith("BDOEE_v2_1.csv"));
    if (!entree) throw new Error("CSV BDOEE absent de l'archive");
    const csv = new TextDecoder("windows-1252").decode(entree.getData());
    const parser = parse(csv, { columns: true, delimiter: ",", bom: true, skip_empty_lines: true, relax_column_count: true });
    for await (const ligne of parser as AsyncIterable<LigneCanada>) {
      recus += 1;
      const identifiant = ligne.Index?.trim();
      const nom = ligne["Nom_Établissement"]?.trim();
      if (!identifiant || !nom) {
        ignores += 1;
        continue;
      }
      const classification = classifier(ligne);
      const ville = ligne.Ville?.trim() || null;
      const idExistant = idParIdentifiant.get(identifiant);
      if (idExistant) modifies += 1;
      else ajoutes += 1;
      lot.push({
        // Une source peut avoir été rattachée à un canonique par la déduplication.
        // Réutiliser ce lien évite de recréer l'ancien doublon lors d'un nouvel import.
        id: idExistant || `ca-statcan-${identifiant}`,
        identifiant,
        nom,
        nomNormalise: normaliser(nom),
        type: classification.type,
        niveaux: classification.niveaux,
        ville,
        villeNormalisee: normaliser(ville || ""),
        latitude: coordonnee(ligne.Latitude),
        longitude: coordonnee(ligne.Longitude),
        donneesBrutes: {
          index: identifiant,
          sourceId: ligne.Source_ID || null,
          autorite: ligne["Nom_Autorité"] || null,
          provinceTerritoire: ligne.Prov_Terr || null,
          codePostal: ligne.Code_Postale || null,
          fournisseur: ligne.Fournisseur || null,
          statutEcoleMinoriteLangueOfficielle: ligne.Statut_EMLO || null,
          niveauxCite: classification.niveaux,
        },
      });
      if (lot.length >= TAILLE_LOT) {
        await enregistrerLot(lot, source.id);
        if ((ajoutes + modifies) % 7500 === 0) console.log(`Canada : ${ajoutes + modifies} établissements traités`);
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
        detail: { recus, version: "BDOEE 2.1", datePublication: "2022-11-28", source: ARCHIVE },
      },
    });
    console.log(JSON.stringify({ recus, ajoutes, modifies, ignores }, null, 2));
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

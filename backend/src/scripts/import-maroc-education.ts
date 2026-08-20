import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import {
  NiveauEducation,
  Prisma,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
} from "@prisma/client";

const prisma = new PrismaClient();
const TAILLE_LOT = 600;

const RESSOURCES = [
  {
    cle: "public-primaire-2023",
    url: "https://data.gov.ma/data/fr/dataset/4de8f7dc-c536-44e8-93a8-3efd2aca2c52/resource/f1ac441c-01e5-4a63-ab3a-e45a930b9a07/download/etab_pub_primaire_juin-2023.xlsx",
    page: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-primaire",
    type: TypeEtablissement.FONDAMENTALE,
    statut: StatutEtablissement.PUBLIC,
    niveaux: [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL],
  },
  {
    cle: "public-collegial-2023",
    url: "https://data.gov.ma/data/fr/dataset/93f014c7-2b83-4fe9-b06b-48364bc8e8e8/resource/445627e2-b1ba-48f5-95ec-7e3aa9a1570f/download/etab_pub_collegial_juin-2023.xlsx",
    page: "https://data.gov.ma/data/fr/dataset/liste-de-etablissements-publics-collegial",
    type: TypeEtablissement.LYCEE,
    statut: StatutEtablissement.PUBLIC,
    niveaux: [NiveauEducation.FONDAMENTAL, NiveauEducation.SECONDAIRE],
  },
  {
    cle: "public-qualifiant-2023",
    url: "https://data.gov.ma/data/fr/dataset/17805f1b-6d88-41d5-ace9-bf0e4007e51f/resource/1e029230-76cd-4d91-995d-d15b859baf48/download/etab_pub_qualifiant_juin-2023.xlsx",
    page: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-qualifiants",
    type: TypeEtablissement.LYCEE,
    statut: StatutEtablissement.PUBLIC,
    niveaux: [NiveauEducation.SECONDAIRE],
  },
  {
    cle: "prive-2023",
    url: "https://data.gov.ma/data/fr/dataset/63ae019b-1e5c-409a-b53f-0ccac9ddc223/resource/4f6dd560-bad6-4418-b5e8-73ca57811b13/download/etab_priv_juin-2023.xlsx",
    page: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-prives-2023",
    type: TypeEtablissement.FONDAMENTALE,
    statut: StatutEtablissement.PRIVE,
    // Le fichier privé regroupe les cycles sans colonne de niveau.
    niveaux: [NiveauEducation.PRESCOLAIRE, NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL, NiveauEducation.SECONDAIRE],
  },
] as const;

type LigneMaroc = {
  id: string;
  identifiant: string;
  nom: string;
  nomNormalise: string;
  nomArabe: string | null;
  type: TypeEtablissement;
  statut: StatutEtablissement;
  niveaux: NiveauEducation[];
  ville: string | null;
  villeNormalisee: string;
  page: string;
  donneesBrutes: Prisma.InputJsonValue;
};

const normaliser = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const empreinte = (valeur: string) => createHash("sha1").update(valeur).digest("hex").slice(0, 24);

async function enregistrerLot(lot: LigneMaroc[], sourceId: string) {
  const unique = [...new Map(lot.map((item) => [item.id, item])).values()];
  if (!unique.length) return;
  const valeurs = Prisma.join(unique.map((item) => Prisma.sql`(
    ${item.id}, ${item.nom}, ${item.nomNormalise}, ${item.type}::"TypeEtablissement", 'MA'::char(2),
    ${item.ville}, ${item.villeNormalisee}, ${item.statut}::"StatutEtablissement", true, NOW(), NOW()
  )`));
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "Etablissement"
      (id, nom, "nomNormalise", type, "paysCode", ville, "villeNormalisee", statut, valide, "createdAt", "updatedAt")
    VALUES ${valeurs}
    ON CONFLICT (id) DO UPDATE SET
      nom=EXCLUDED.nom, "nomNormalise"=EXCLUDED."nomNormalise", type=EXCLUDED.type,
      ville=EXCLUDED.ville, "villeNormalisee"=EXCLUDED."villeNormalisee", statut=EXCLUDED.statut,
      valide=true, "updatedAt"=NOW()
  `);
  await prisma.etablissementNiveau.createMany({
    data: unique.flatMap((item) => item.niveaux.map((niveau) => ({ etablissementId: item.id, niveau }))),
    skipDuplicates: true,
  });
  await prisma.etablissementAlias.createMany({
    data: unique
      .filter((item): item is LigneMaroc & { nomArabe: string } => Boolean(item.nomArabe))
      .map((item) => ({ etablissementId: item.id, nom: item.nomArabe, nomNormalise: normaliser(item.nomArabe), langue: "ar" })),
    skipDuplicates: true,
  });
  await prisma.etablissementSource.createMany({
    data: unique.map((item) => ({
      id: `source-menps-${empreinte(item.identifiant)}`,
      etablissementId: item.id,
      sourceId,
      identifiantExterne: item.identifiant,
      urlSource: item.page,
      confiance: 0.96,
      donneesBrutes: item.donneesBrutes,
    })),
    skipDuplicates: true,
  });
  await prisma.etablissementSource.updateMany({
    where: { sourceId, identifiantExterne: { in: unique.map(({ identifiant }) => identifiant) } },
    data: { vuLe: new Date(), confiance: 0.96 },
  });
}

async function importer() {
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "menps-maroc" } });
  const importation = await prisma.importEducation.create({ data: { sourceId: source.id, paysCode: "MA" } });
  const references = await prisma.etablissementSource.findMany({ where: { sourceId: source.id }, select: { identifiantExterne: true } });
  const dejaConnus = new Set(references.map(({ identifiantExterne }) => identifiantExterne));
  let recus = 0;
  let ajoutes = 0;
  let modifies = 0;
  let ignores = 0;
  let lot: LigneMaroc[] = [];
  const repartition: Record<string, number> = {};
  try {
    for (const ressource of RESSOURCES) {
      const response = await fetch(ressource.url, { headers: { "User-Agent": "MaliWuli-Education-Catalog/0.1" } });
      if (!response.ok) throw new Error(`MENPS Maroc ${ressource.cle}: ${response.status}`);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await response.arrayBuffer());
      const feuille = workbook.worksheets[0];
      if (!feuille) continue;
      const entetes = new Map<string, number>();
      feuille.getRow(1).eachCell((cell, colonne) => entetes.set(cell.text.trim(), colonne));
      const texte = (ligne: ExcelJS.Row, colonne: string) => {
        const index = entetes.get(colonne);
        return index ? ligne.getCell(index).text.trim() : "";
      };
      for (let numero = 2; numero <= feuille.rowCount; numero += 1) {
        recus += 1;
        const ligne = feuille.getRow(numero);
        const nom = texte(ligne, "NOM_ETABL");
        const nomArabe = texte(ligne, "NOM_ETABA") || null;
        const ville = texte(ligne, "COMMUNE") || null;
        const province = texte(ligne, "PROVINCE") || null;
        if (!nom) {
          ignores += 1;
          continue;
        }
        const identifiant = `${ressource.cle}:${empreinte(`${normaliser(nom)}|${normaliser(nomArabe || "")}|${normaliser(ville || "")}|${normaliser(province || "")}`)}`;
        const id = `ma-menps-${empreinte(identifiant)}`;
        if (dejaConnus.has(identifiant)) modifies += 1;
        else ajoutes += 1;
        repartition[ressource.cle] = (repartition[ressource.cle] || 0) + 1;
        lot.push({
          id,
          identifiant,
          nom,
          nomNormalise: normaliser(nom),
          nomArabe,
          type: ressource.type,
          statut: ressource.statut,
          niveaux: [...ressource.niveaux],
          ville,
          villeNormalisee: normaliser(ville || ""),
          page: ressource.page,
          donneesBrutes: {
            version: "juin 2023",
            ressource: ressource.cle,
            nomArabe,
            adresse: texte(ligne, "AdresseL") || null,
            adresseArabe: texte(ligne, "AdresseA") || null,
            commune: ville,
            province,
            region: texte(ligne, "REGION") || null,
          },
        });
        if (lot.length >= TAILLE_LOT) {
          await enregistrerLot(lot, source.id);
          lot = [];
        }
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
        detail: { recus, repartition, version: "juin 2023", licence: "ODbL-1.0" },
      },
    });
    console.log(JSON.stringify({ recus, ajoutes, modifies, ignores, repartition }, null, 2));
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

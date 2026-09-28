import { createHash } from "node:crypto";
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
const EXPORT_ANNUAIRE = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/exports/csv?lang=fr&timezone=Europe%2FParis&use_labels=false&delimiter=%3B";
const PAGE_SOURCE = "https://data.education.gouv.fr/explore/dataset/fr-en-annuaire-education/";
const TAILLE_LOT = 750;

type LigneAnnuaire = Record<string, string | undefined>;

type EtablissementImporte = {
  id: string;
  uai: string;
  nom: string;
  nomNormalise: string;
  type: TypeEtablissement;
  niveaux: NiveauEducation[];
  ville: string | null;
  villeNormalisee: string;
  statut: StatutEtablissement;
  siteWeb: string | null;
  latitude: string | null;
  longitude: string | null;
  donneesBrutes: Prisma.InputJsonValue;
};

const normaliser = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const vrai = (valeur?: string) => valeur === "1" || valeur?.toLowerCase() === "true";

function classifier(ligne: LigneAnnuaire) {
  const description = normaliser(`${ligne.type_etablissement || ""} ${ligne.libelle_nature || ""}`);
  if (/lycee|college|secondaire|erea/.test(description)) {
    return {
      type: TypeEtablissement.LYCEE,
      niveaux: [
        NiveauEducation.SECONDAIRE,
        ...(vrai(ligne.post_bac) ? [NiveauEducation.SUPERIEUR] : []),
        ...(vrai(ligne.apprentissage) ? [NiveauEducation.PROFESSIONNEL] : []),
      ],
    };
  }
  return {
    type: TypeEtablissement.FONDAMENTALE,
    niveaux: [
      ...(vrai(ligne.ecole_maternelle) ? [NiveauEducation.PRESCOLAIRE] : []),
      ...(vrai(ligne.ecole_elementaire) ? [NiveauEducation.PRIMAIRE] : []),
      NiveauEducation.FONDAMENTAL,
    ],
  };
}

const identifiantTechnique = (prefixe: string, valeur: string) =>
  `${prefixe}-${createHash("sha1").update(valeur).digest("hex").slice(0, 24)}`;

async function enregistrerLot(lot: EtablissementImporte[], sourceId: string) {
  if (!lot.length) return;
  // Le jeu officiel peut contenir plusieurs lignes pour un même UAI (multi-UAI,
  // rattachements). La dernière ligne du lot enrichit la précédente sans jamais
  // tenter deux UPSERT du même identifiant dans une seule requête MySQL.
  const lotUnique = [...new Map(lot.map((item) => [item.id, item])).values()];
  const etablissementsSql = Prisma.join(lotUnique.map((item) => Prisma.sql`(
    ${item.id}, ${item.nom}, ${item.nomNormalise}, ${item.type},
    ${"FR"}, ${"FR"}, ${item.ville}, ${item.villeNormalisee}, ${item.statut},
    ${item.siteWeb}, ${item.latitude}, ${item.longitude}, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
  )`));
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO Etablissement
      (id, nom, nomNormalise, type, paysCode, systemeEducatifCode,
       ville, villeNormalisee, statut, siteWeb, latitude, longitude,
       valide, createdAt, updatedAt)
    VALUES ${etablissementsSql}
    ON DUPLICATE KEY UPDATE
      nom = VALUES(nom),
      nomNormalise = VALUES(nomNormalise),
      type = VALUES(type),
      systemeEducatifCode = VALUES(systemeEducatifCode),
      ville = VALUES(ville),
      villeNormalisee = VALUES(villeNormalisee),
      statut = VALUES(statut),
      siteWeb = COALESCE(VALUES(siteWeb), siteWeb),
      latitude = COALESCE(VALUES(latitude), latitude),
      longitude = COALESCE(VALUES(longitude), longitude),
      valide = true,
      updatedAt = CURRENT_TIMESTAMP(3)
  `);

  const niveaux = lotUnique.flatMap((item) => item.niveaux.map((niveau) => ({ id: item.id, niveau })));
  await prisma.etablissementNiveau.createMany({ data: niveaux.map(({ id, niveau }) => ({ etablissementId: id, niveau })), skipDuplicates: true });
  await prisma.etablissementSource.createMany({
    data: lotUnique.map((item) => ({
      id: identifiantTechnique("source-uai", item.uai),
      etablissementId: item.id,
      sourceId,
      identifiantExterne: item.uai,
      urlSource: PAGE_SOURCE,
      confiance: 0.99,
      donneesBrutes: item.donneesBrutes,
    })),
    skipDuplicates: true,
  });
  await prisma.etablissementSource.updateMany({
    where: { sourceId, identifiantExterne: { in: lotUnique.map(({ uai }) => uai) } },
    data: { vuLe: new Date(), confiance: 0.99 },
  });
}

async function importer() {
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "education-fr" } });
  const importation = await prisma.importEducation.create({ data: { sourceId: source.id, paysCode: "FR" } });
  const referencesExistantes = await prisma.etablissementSource.findMany({
    where: { sourceId: source.id },
    select: { identifiantExterne: true, etablissementId: true },
  });
  const idParUai = new Map(referencesExistantes.map(({ identifiantExterne, etablissementId }) => [identifiantExterne, etablissementId]));
  const vus = new Set<string>();
  let lot: EtablissementImporte[] = [];
  let recus = 0;
  let ajoutes = 0;
  let modifies = 0;
  let ignores = 0;

  try {
    const response = await fetch(EXPORT_ANNUAIRE, { headers: { "User-Agent": "MaliWuli-Education-Catalog/0.1" } });
    if (!response.ok) throw new Error(`Annuaire de l'Éducation ${response.status}`);
    const csv = Buffer.from(await response.arrayBuffer());
    const parser = parse(csv, { columns: true, delimiter: ";", bom: true, skip_empty_lines: true, relax_column_count: true });
    for await (const ligne of parser as AsyncIterable<LigneAnnuaire>) {
      recus += 1;
      const uai = ligne.identifiant_de_l_etablissement?.trim().toUpperCase();
      const nom = ligne.nom_etablissement?.trim();
      if (!uai || !nom || (ligne.etat && ligne.etat !== "OUVERT")) {
        ignores += 1;
        continue;
      }
      vus.add(uai);
      const classification = classifier(ligne);
      const ville = ligne.nom_commune?.trim() || null;
      const existant = idParUai.get(uai);
      const id = existant || `fr-uai-${uai.toLowerCase()}`;
      if (existant) modifies += 1;
      else ajoutes += 1;
      lot.push({
        id,
        uai,
        nom,
        nomNormalise: normaliser(nom),
        type: classification.type,
        niveaux: [...new Set(classification.niveaux)],
        ville,
        villeNormalisee: normaliser(ville || ""),
        statut: ligne.statut_public_prive?.toLowerCase() === "privé" || ligne.statut_public_prive?.toLowerCase() === "prive"
          ? StatutEtablissement.PRIVE
          : StatutEtablissement.PUBLIC,
        siteWeb: ligne.web?.trim() || null,
        latitude: ligne.latitude || null,
        longitude: ligne.longitude || null,
        donneesBrutes: {
          uai,
          nature: ligne.libelle_nature || null,
          codeNature: ligne.code_nature || null,
          codeCommune: ligne.code_commune || null,
          codePostal: ligne.code_postal || null,
          adresse: ligne.adresse_1 || null,
          dateMaj: ligne.date_maj_ligne || null,
          voies: {
            generale: vrai(ligne.voie_generale),
            technologique: vrai(ligne.voie_technologique),
            professionnelle: vrai(ligne.voie_professionnelle),
          },
        },
      });
      if (lot.length >= TAILLE_LOT) {
        await enregistrerLot(lot, source.id);
        if ((ajoutes + modifies) % 7500 === 0) console.log(`Annuaire France : ${ajoutes + modifies} établissements traités`);
        lot = [];
      }
    }
    await enregistrerLot(lot, source.id);

    const fermes = referencesExistantes.filter(({ identifiantExterne }) => !vus.has(identifiantExterne));
    for (let index = 0; index < fermes.length; index += 1000) {
      await prisma.etablissement.updateMany({
        where: { id: { in: fermes.slice(index, index + 1000).map(({ etablissementId }) => etablissementId) } },
        data: { valide: false },
      });
    }
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: {
        statut: StatutImportEducation.TERMINE,
        ajoutes,
        modifies,
        ignores,
        termineLe: new Date(),
        detail: { recus, ouverts: vus.size, fermes: fermes.length, source: EXPORT_ANNUAIRE },
      },
    });
    console.log(JSON.stringify({ recus, ajoutes, modifies, ignores, fermes: fermes.length }, null, 2));
  } catch (error) {
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: {
        statut: StatutImportEducation.ECHEC,
        erreurs: 1,
        termineLe: new Date(),
        detail: { message: error instanceof Error ? error.message : "Erreur inconnue" },
      },
    });
    throw error;
  }
}

importer()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

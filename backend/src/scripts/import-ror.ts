import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { parse } from "csv-parse";
import {
  NiveauEducation,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
} from "@prisma/client";

const prisma = new PrismaClient();
const ZENODO_ROR = "https://zenodo.org/api/records/6347574";
const PAYS_PAR_DEFAUT = ["ML", "FR", "US", "CA", "MA", "DZ", "CI", "RU", "SN", "GB"];

type RorMetadata = {
  doi?: string;
  files?: Array<{ key?: string; checksum?: string; links?: { self?: string } }>;
};

type RorCsv = Record<string, string | undefined>;

const normaliser = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const valeursSeparees = (valeur = "") =>
  valeur.split(";").map((item) => item.trim()).filter(Boolean);

const nomsAvecLangue = (valeur = "") =>
  valeur
    .split(/; (?=(?:[a-z]{2}|no_lang_code): )/i)
    .map((item) => item.replace(/^(?:[a-z]{2}|no_lang_code):\s*/i, "").trim())
    .filter(Boolean);

const domaine = (valeur?: string | null) => {
  if (!valeur) return "";
  try {
    return new URL(valeur).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return valeur.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").toLowerCase();
  }
};

const typeEtablissement = (nom: string) =>
  /\b(school|college|institute|institut|academy|ecole|polytechnic)\b/i.test(nom)
    ? TypeEtablissement.ECOLE_SUPERIEURE
    : TypeEtablissement.UNIVERSITE;

const estEtablissementDeFormation = (nom: string, aliases: string[]) => {
  const texte = normaliser(`${nom} ${aliases.join(" ")}`);
  return /univers|university|universidad|universitat|universitet|college|collège|school|ecole|école|lycee|lycée|institute|institut|polytech|conservatoire|faculty|faculté|faculte|higher education|enseignement superieur|enseignement supérieur|centre de formation/.test(texte);
};

async function telechargerDump() {
  const metadataResponse = await fetch(ZENODO_ROR, {
    headers: { Accept: "application/json", "User-Agent": "MaliWuli-Education-Catalog/0.1" },
  });
  if (!metadataResponse.ok) throw new Error(`Zenodo ROR ${metadataResponse.status}`);
  const metadata = (await metadataResponse.json()) as RorMetadata;
  const fichier = metadata.files?.find(({ key }) => key?.endsWith(".zip"));
  if (!fichier?.links?.self) throw new Error("Archive ROR introuvable dans les métadonnées Zenodo");

  const dumpResponse = await fetch(fichier.links.self, {
    headers: { "User-Agent": "MaliWuli-Education-Catalog/0.1" },
  });
  if (!dumpResponse.ok) throw new Error(`Téléchargement ROR ${dumpResponse.status}`);
  const archive = Buffer.from(await dumpResponse.arrayBuffer());
  const attendu = fichier.checksum?.replace(/^md5:/, "");
  const calcule = createHash("md5").update(archive).digest("hex");
  if (attendu && attendu !== calcule) throw new Error("Checksum MD5 du dump ROR invalide");

  const zip = new AdmZip(archive);
  const entreeCsv = zip.getEntries().find(({ entryName }) => entryName.endsWith(".csv"));
  if (!entreeCsv) throw new Error("CSV absent du dump ROR");
  return { csv: entreeCsv.getData(), doi: metadata.doi || null, fichier: fichier.key || null };
}

async function trouverCanonique(params: {
  paysCode: string;
  nom: string;
  aliases: string[];
  wikidataIds: string[];
  siteWeb?: string;
}) {
  if (params.wikidataIds.length) {
    const reference = await prisma.etablissementSource.findFirst({
      where: {
        source: { code: "wikidata" },
        identifiantExterne: { in: params.wikidataIds },
        etablissement: { paysCode: params.paysCode, valide: true },
      },
      include: { etablissement: true },
    });
    if (reference) return reference.etablissement;
  }

  const nomsNormalises = [...new Set([params.nom, ...params.aliases].map(normaliser).filter(Boolean))];
  const candidats = await prisma.etablissement.findMany({
    where: {
      paysCode: params.paysCode,
      valide: true,
      OR: [
        { nomNormalise: { in: nomsNormalises } },
        { alias: { some: { nomNormalise: { in: nomsNormalises } } } },
      ],
    },
  });
  if (candidats.length === 1) return candidats[0];
  if (candidats.length > 1) {
    const nomExact = candidats.filter(({ nomNormalise }) => nomNormalise === normaliser(params.nom));
    if (nomExact.length === 1) return nomExact[0];
    const domaineRor = domaine(params.siteWeb);
    const memeDomaine = candidats.filter(({ siteWeb }) => domaine(siteWeb) === domaineRor && domaineRor);
    if (memeDomaine.length === 1) return memeDomaine[0];
  }
  return null;
}

async function reconcilierDoublonsAvecRor(sourceId: string) {
  const canoniques = await prisma.etablissement.findMany({
    where: { valide: true, sources: { some: { sourceId } } },
    include: { alias: true },
  });
  const candidats = await prisma.etablissement.findMany({
    where: {
      valide: true,
      sources: { none: { sourceId } },
    },
    include: { alias: true, sources: { include: { source: true } } },
  });
  const proprietaires = new Map<string, Set<string>>();
  for (const canonique of canoniques) {
    for (const cle of new Set([canonique.nomNormalise, ...canonique.alias.map(({ nomNormalise }) => nomNormalise)])) {
      if (cle.length < 10) continue;
      const ids = proprietaires.get(`${canonique.paysCode}:${cle}`) || new Set<string>();
      ids.add(canonique.id);
      proprietaires.set(`${canonique.paysCode}:${cle}`, ids);
    }
  }
  const canoniqueParId = new Map(canoniques.map((item) => [item.id, item]));
  let fusionnes = 0;

  for (const candidat of candidats) {
    // Une source nationale/officielle distincte doit être arbitrée par l'admin,
    // même si un alias ROR lui ressemble. On ne fusionne ici que les anciens
    // imports génériques Hipo/Wikidata.
    if (candidat.sources.some(({ source }) => !["hipo", "wikidata"].includes(source.code))) continue;
    const ids = proprietaires.get(`${candidat.paysCode}:${candidat.nomNormalise}`);
    if (!ids || ids.size !== 1) continue;
    const canonique = canoniqueParId.get([...ids][0]);
    if (!canonique || canonique.id === candidat.id) continue;

    await prisma.formation.updateMany({ where: { etablissementId: candidat.id }, data: { etablissementId: canonique.id } });
    await prisma.avisEtablissement.updateMany({ where: { etablissementId: candidat.id }, data: { etablissementId: canonique.id } });
    await prisma.etablissementSource.updateMany({ where: { etablissementId: candidat.id }, data: { etablissementId: canonique.id } });
    for (const alias of [{ nom: candidat.nom, nomNormalise: candidat.nomNormalise }, ...candidat.alias]) {
      await prisma.etablissementAlias.upsert({
        where: { etablissementId_nomNormalise: { etablissementId: canonique.id, nomNormalise: alias.nomNormalise } },
        create: { etablissementId: canonique.id, nom: alias.nom, nomNormalise: alias.nomNormalise },
        update: { nom: alias.nom },
      });
    }
    await prisma.etablissement.update({ where: { id: candidat.id }, data: { valide: false } });
    fusionnes += 1;
  }
  return fusionnes;
}

async function importer() {
  const argumentPays = process.argv.find((argument) => argument.startsWith("--countries="));
  const paysDemandes = new Set(
    (argumentPays?.split("=")[1]?.split(",") || PAYS_PAR_DEFAUT).map((code) => code.trim().toUpperCase()),
  );
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "ror" } });
  const importation = await prisma.importEducation.create({ data: { sourceId: source.id } });
  const repartition: Record<string, number> = {};
  let recus = 0;
  let ajoutes = 0;
  let modifies = 0;
  let ignores = 0;

  try {
    const dump = await telechargerDump();
    const parser = parse(dump.csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
    for await (const ligne of parser as AsyncIterable<RorCsv>) {
      recus += 1;
      const paysCode = (ligne["locations.geonames_details.country_code"] || "").toUpperCase();
      const types = valeursSeparees(ligne.types);
      if (!paysDemandes.has(paysCode) || ligne.status !== "active" || !types.includes("education")) continue;

      const rorId = ligne.id?.replace(/^https:\/\/ror\.org\//, "").trim();
      const nom = ligne["names.types.ror_display"]?.trim();
      if (!rorId || !nom) {
        ignores += 1;
        continue;
      }
      const aliases = [...new Set([
        ...nomsAvecLangue(ligne["names.types.alias"]),
        ...nomsAvecLangue(ligne["names.types.label"]),
        ...nomsAvecLangue(ligne["names.types.acronym"]),
      ])].filter((alias) => normaliser(alias) !== normaliser(nom));
      const wikidataIds = valeursSeparees(ligne["external_ids.type.wikidata.all"]);
      const siteWeb = valeursSeparees(ligne["links.type.website"])[0];
      const ville = ligne["locations.geonames_details.name"]?.trim() || null;
      const reference = await prisma.etablissementSource.findUnique({
        where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: rorId } },
        include: { etablissement: true },
      });
      if (!estEtablissementDeFormation(nom, aliases)) {
        if (reference) {
          const autreSourceFiable = await prisma.etablissementSource.count({
            where: {
              etablissementId: reference.etablissementId,
              source: { code: { notIn: ["ror", "hipo", "wikidata"] } },
            },
          });
          if (!autreSourceFiable) {
            await prisma.etablissement.update({
              where: { id: reference.etablissementId },
              data: { valide: false },
            });
          }
        }
        ignores += 1;
        continue;
      }
      let etablissement = reference?.etablissement || await trouverCanonique({
        paysCode,
        nom,
        aliases,
        wikidataIds,
        siteWeb,
      });

      if (etablissement) {
        etablissement = await prisma.etablissement.update({
          where: { id: etablissement.id },
          data: {
            nomNormalise: normaliser(etablissement.nom),
            ville: etablissement.ville || ville,
            villeNormalisee: normaliser(etablissement.ville || ville || ""),
            siteWeb: etablissement.siteWeb || siteWeb || null,
            latitude: etablissement.latitude || (ligne["locations.geonames_details.lat"] || null),
            longitude: etablissement.longitude || (ligne["locations.geonames_details.lng"] || null),
            valide: true,
          },
        });
        modifies += 1;
      } else {
        etablissement = await prisma.etablissement.create({
          data: {
            id: `ror-${rorId}`,
            nom,
            nomNormalise: normaliser(nom),
            sigle: nomsAvecLangue(ligne["names.types.acronym"])[0] || null,
            type: typeEtablissement(nom),
            paysCode,
            systemeEducatifCode: paysCode,
            ville,
            villeNormalisee: normaliser(ville || ""),
            statut: StatutEtablissement.INCONNU,
            siteWeb: siteWeb || null,
            latitude: ligne["locations.geonames_details.lat"] || null,
            longitude: ligne["locations.geonames_details.lng"] || null,
          },
        });
        ajoutes += 1;
      }

      await prisma.etablissementNiveau.upsert({
        where: { etablissementId_niveau: { etablissementId: etablissement.id, niveau: NiveauEducation.SUPERIEUR } },
        create: { etablissementId: etablissement.id, niveau: NiveauEducation.SUPERIEUR },
        update: {},
      });
      for (const alias of aliases) {
        const nomNormalise = normaliser(alias);
        if (!nomNormalise) continue;
        await prisma.etablissementAlias.upsert({
          where: { etablissementId_nomNormalise: { etablissementId: etablissement.id, nomNormalise } },
          create: { etablissementId: etablissement.id, nom: alias, nomNormalise },
          update: { nom: alias },
        });
      }
      await prisma.etablissementSource.upsert({
        where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: rorId } },
        create: {
          etablissementId: etablissement.id,
          sourceId: source.id,
          identifiantExterne: rorId,
          urlSource: `https://ror.org/${rorId}`,
          confiance: 0.92,
          donneesBrutes: { doi: dump.doi, wikidataIds, aliases, status: ligne.status },
        },
        update: {
          etablissementId: etablissement.id,
          urlSource: `https://ror.org/${rorId}`,
          confiance: 0.92,
          vuLe: new Date(),
          donneesBrutes: { doi: dump.doi, wikidataIds, aliases, status: ligne.status },
        },
      });
      repartition[paysCode] = (repartition[paysCode] || 0) + 1;
      const totalTraites = ajoutes + modifies;
      if (totalTraites % 250 === 0) console.log(`ROR: ${totalTraites} établissements traités`);
    }

    const doublonsFusionnes = await reconcilierDoublonsAvecRor(source.id);
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: {
        statut: StatutImportEducation.TERMINE,
        ajoutes,
        modifies,
        ignores,
        termineLe: new Date(),
        detail: { recus, pays: [...paysDemandes], repartition, doi: dump.doi, fichier: dump.fichier, doublonsFusionnes },
      },
    });
    console.log(JSON.stringify({ recus, ajoutes, modifies, ignores, doublonsFusionnes, repartition, doi: dump.doi }, null, 2));
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

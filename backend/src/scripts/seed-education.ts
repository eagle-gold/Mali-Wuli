import { createHash } from "node:crypto";
import {
  NiveauEducation,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
  TypeProgrammeEducation,
} from "@prisma/client";
import { getCountries } from "@countrystatecity/countries";
import {
  DIPLOMES_GENERIQUES,
  DIPLOMES_PAR_PAYS,
  INSTITUTIONS_INTERNATIONALES,
  INSTITUTIONS_MALI,
  OFFRES_SPECIFIQUES,
  PROGRAMMES_GENERIQUES,
  PROGRAMMES_SPECIFIQUES,
  SERIES_GENERIQUES,
  SERIES_LYCEE_FRANCAIS_LIBERTE,
  SERIES_PAR_PAYS,
  SOURCES_EDUCATIVES,
  type InstitutionSeed,
  type ProgrammeSeed,
} from "../education/catalog-data";

const prisma = new PrismaClient();

const normaliser = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const identifiantStable = (prefixe: string, valeur: string) =>
  `${prefixe}-${createHash("sha1").update(valeur).digest("hex").slice(0, 20)}`;

const priorites = new Map(["ML", "CI", "NG", "NE", "MR", "FR"].map((code, index) => [code, index]));

async function semerPays() {
  const pays = await getCountries();
  const nomsFrancais = new Intl.DisplayNames(["fr"], { type: "region" });
  for (const item of pays) {
    await prisma.paysEducation.upsert({
      where: { code: item.iso2 },
      create: {
        code: item.iso2,
        codeIso3: item.iso3 || null,
        nom: nomsFrancais.of(item.iso2) || item.name,
        nomAnglais: item.name,
        drapeau: item.emoji,
        indicatif: item.phonecode?.replace(/^\+/, "") || null,
        prioriteDiaspora: priorites.get(item.iso2) ?? 999,
      },
      update: {
        codeIso3: item.iso3 || null,
        nom: nomsFrancais.of(item.iso2) || item.name,
        nomAnglais: item.name,
        drapeau: item.emoji,
        indicatif: item.phonecode?.replace(/^\+/, "") || null,
        prioriteDiaspora: priorites.get(item.iso2) ?? 999,
      },
    });
  }
  return pays.length;
}

async function semerSources() {
  for (const source of SOURCES_EDUCATIVES) {
    await prisma.sourceEducative.upsert({
      where: { code: source.code },
      create: source,
      update: source,
    });
  }
  return SOURCES_EDUCATIVES.length;
}

async function semerDiplome(paysCode: string, diplome: { nom: string; niveau: NiveauEducation; sigle?: string }) {
  const nomNormalise = normaliser(diplome.nom);
  return prisma.diplomeEducation.upsert({
    where: { paysCode_niveau_nomNormalise: { paysCode, niveau: diplome.niveau, nomNormalise } },
    create: { id: identifiantStable("diplome", `${paysCode}:${diplome.niveau}:${nomNormalise}`), paysCode, nomNormalise, ...diplome },
    update: { nom: diplome.nom, sigle: diplome.sigle || null, actif: true },
  });
}

async function semerDiplomes() {
  const pays = await prisma.paysEducation.findMany({ select: { code: true } });
  let total = 0;
  for (const { code } of pays) {
    const specifiques = DIPLOMES_PAR_PAYS[code] || [];
    const existants = new Set(specifiques.map((item) => normaliser(item.nom)));
    for (const diplome of [...specifiques, ...DIPLOMES_GENERIQUES.filter((item) => !existants.has(normaliser(item.nom)))]) {
      const enregistrement = await semerDiplome(code, diplome);
      const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "unesco-isced" } });
      await prisma.diplomeSource.upsert({
        where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: `diplome:${code}:${normaliser(diplome.nom)}` } },
        create: { diplomeId: enregistrement.id, sourceId: source.id, identifiantExterne: `diplome:${code}:${normaliser(diplome.nom)}`, urlSource: source.url, confiance: specifiques.includes(diplome) ? 0.72 : 0.55 },
        update: { diplomeId: enregistrement.id, vuLe: new Date() },
      });
      total += 1;
    }
  }
  return total;
}

async function semerProgramme(item: ProgrammeSeed) {
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: item.sourceCode } });
  const programme = await prisma.programmeEducation.upsert({
    where: { id: item.key },
    create: {
      id: item.key,
      paysCode: item.paysCode || null,
      parentId: item.parentKey || null,
      nom: item.nom,
      nomNormalise: normaliser(item.nom),
      sigle: item.sigle || null,
      type: item.type,
      niveau: item.niveau,
    },
    update: {
      paysCode: item.paysCode || null,
      parentId: item.parentKey || null,
      nom: item.nom,
      nomNormalise: normaliser(item.nom),
      sigle: item.sigle || null,
      type: item.type,
      niveau: item.niveau,
      actif: true,
    },
  });
  await prisma.programmeSource.upsert({
    where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: item.key } },
    create: { programmeId: programme.id, sourceId: source.id, identifiantExterne: item.key, urlSource: source.url, confiance: item.paysCode ? 0.85 : 0.65 },
    update: { programmeId: programme.id, vuLe: new Date() },
  });
  return programme;
}

async function semerProgrammes() {
  let total = 0;
  const programmesASemer: ProgrammeSeed[] = [
    ...PROGRAMMES_GENERIQUES,
    ...PROGRAMMES_SPECIFIQUES,
    ...SERIES_LYCEE_FRANCAIS_LIBERTE,
  ];
  for (const item of programmesASemer.filter((programme) => !programme.parentKey)) {
    await semerProgramme(item);
    total += 1;
  }
  for (const item of programmesASemer.filter((programme) => programme.parentKey)) {
    await semerProgramme(item);
    total += 1;
  }

  const pays = await prisma.paysEducation.findMany({ select: { code: true } });
  for (const { code } of pays) {
    const series = SERIES_PAR_PAYS[code] || SERIES_GENERIQUES;
    for (const [index, nom] of series.entries()) {
      await semerProgramme({
        key: `serie-${code.toLowerCase()}-${index}-${identifiantStable("", nom).slice(1, 9)}`,
        nom,
        paysCode: code,
        type: TypeProgrammeEducation.SERIE,
        niveau: NiveauEducation.SECONDAIRE,
        sourceCode: "unesco-isced",
      });
      total += 1;
    }
  }
  return total;
}

async function semerSeriesEtablissements(institutions: Map<string, string>) {
  const etablissementId = institutions.get("ml-lycee-liberte");
  if (!etablissementId) return 0;
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "eduscol-bac-fr" } });
  let total = 0;
  for (const serie of SERIES_LYCEE_FRANCAIS_LIBERTE) {
    const programme = await prisma.programmeEducation.findUniqueOrThrow({ where: { id: serie.key } });
    const identifiant = `ml-lycee-liberte:${serie.key}`;
    const offreId = `offre-serie-${serie.key}`;
    const offre = await prisma.etablissementProgramme.upsert({
      where: { id: offreId },
      create: {
        id: offreId,
        etablissementId,
        programmeId: programme.id,
        niveau: NiveauEducation.SECONDAIRE,
      },
      update: { actif: true },
    });
    await prisma.offreFormationSource.upsert({
      where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: identifiant } },
      create: {
        offreId: offre.id,
        sourceId: source.id,
        identifiantExterne: identifiant,
        urlSource: source.url,
        confiance: serie.key.includes("ancienne") ? 0.9 : 0.99,
      },
      update: { offreId: offre.id, urlSource: source.url, vuLe: new Date() },
    });
    total += 1;
  }
  return total;
}

async function semerInstitution(item: InstitutionSeed, paysCode: string) {
  const nomNormalise = normaliser(item.nom);
  const villeNormalisee = normaliser(item.ville || "");
  const etablissement = await prisma.etablissement.upsert({
    where: { id: item.key },
    create: {
      id: item.key,
      nom: item.nom,
      nomNormalise,
      sigle: item.sigle || null,
      type: item.type,
      paysCode,
      systemeEducatifCode: item.systemeEducatifCode || paysCode,
      ville: item.ville || null,
      villeNormalisee,
      statut: item.statut,
      description: item.description || null,
      siteWeb: item.siteWeb || null,
    },
    update: {
      nom: item.nom,
      nomNormalise,
      sigle: item.sigle || null,
      type: item.type,
      paysCode,
      systemeEducatifCode: item.systemeEducatifCode || paysCode,
      ville: item.ville || null,
      villeNormalisee,
      statut: item.statut,
      description: item.description || null,
      siteWeb: item.siteWeb || null,
      valide: true,
    },
  });
  for (const niveau of item.niveaux) {
    await prisma.etablissementNiveau.upsert({
      where: { etablissementId_niveau: { etablissementId: etablissement.id, niveau } },
      create: { etablissementId: etablissement.id, niveau },
      update: {},
    });
  }
  await prisma.etablissementAlias.deleteMany({
    where: { etablissementId: etablissement.id, nomNormalise },
  });
  for (const alias of item.aliases || []) {
    const aliasNormalise = normaliser(alias);
    await prisma.etablissementAlias.upsert({
      where: { etablissementId_nomNormalise: { etablissementId: etablissement.id, nomNormalise: aliasNormalise } },
      create: { etablissementId: etablissement.id, nom: alias, nomNormalise: aliasNormalise },
      update: { nom: alias },
    });
  }
  for (const reference of item.sources) {
    const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: reference.code } });
    await prisma.etablissementSource.upsert({
      where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: reference.identifiantExterne } },
      create: { etablissementId: etablissement.id, sourceId: source.id, identifiantExterne: reference.identifiantExterne, urlSource: reference.urlSource || source.url, confiance: reference.confiance },
      update: { etablissementId: etablissement.id, urlSource: reference.urlSource || source.url, confiance: reference.confiance, vuLe: new Date() },
    });
  }
  for (const code of new Set(item.sources.map(({ code }) => code))) {
    const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code } });
    const identifiants = item.sources
      .filter((reference) => reference.code === code)
      .map(({ identifiantExterne }) => identifiantExterne);
    await prisma.etablissementSource.deleteMany({
      where: {
        etablissementId: etablissement.id,
        sourceId: source.id,
        identifiantExterne: { notIn: identifiants },
      },
    });
  }
  return etablissement;
}

async function semerInstitutionsReferencees() {
  const map = new Map<string, string>();
  for (const item of INSTITUTIONS_MALI) map.set(item.key, (await semerInstitution(item, "ML")).id);
  for (const item of INSTITUTIONS_INTERNATIONALES) map.set(item.key, (await semerInstitution(item, "FR")).id);
  return map;
}

/**
 * Les identifiants officiels et les actes juridiques priment sur une décision IA.
 * Cette réconciliation retire du sélecteur les organisations dissoutes importées
 * par Wikidata et rattache les anciens noms Paris V / Paris VII à l'établissement
 * actuel portant le même code UAI.
 */
async function reconcilierParisCite() {
  const canonique = await prisma.etablissement.findUniqueOrThrow({ where: { id: "fr-universite-paris-cite" } });
  const anciensNoms = [
    "Université René Descartes (Paris V)",
    "Université Paris Descartes",
    "Université Diderot Paris 7",
    "Université Denis Diderot (Paris VII)",
    "Université Paris Diderot",
  ].map(normaliser);
  const doublons = await prisma.etablissement.findMany({
    where: { paysCode: "FR", id: { not: canonique.id }, nomNormalise: { in: anciensNoms } },
  });

  for (const doublon of doublons) {
    await prisma.formation.updateMany({
      where: { etablissementId: doublon.id },
      data: { etablissementId: canonique.id },
    });
    await prisma.etablissementSource.updateMany({
      where: { etablissementId: doublon.id },
      data: { etablissementId: canonique.id },
    });
    await prisma.etablissementAlias.upsert({
      where: { etablissementId_nomNormalise: { etablissementId: canonique.id, nomNormalise: doublon.nomNormalise } },
      create: { etablissementId: canonique.id, nom: doublon.nom, nomNormalise: doublon.nomNormalise },
      update: { nom: doublon.nom },
    });
    await prisma.etablissement.update({ where: { id: doublon.id }, data: { valide: false } });
  }

  const wikidata = await prisma.sourceEducative.findUnique({ where: { code: "wikidata" } });
  if (wikidata) {
    const organisationsDissoutes = await prisma.etablissementSource.findMany({
      where: {
        sourceId: wikidata.id,
        identifiantExterne: { in: ["Q2845896", "Q3491150", "Q209842"] },
      },
      select: { etablissementId: true },
    });
    await prisma.etablissement.updateMany({
      where: { id: { in: organisationsDissoutes.map(({ etablissementId }) => etablissementId) } },
      data: { valide: false },
    });
  }

  return { anciensNomsRattaches: doublons.length };
}

async function reconcilierSuccessionsFrancaises() {
  const source = await prisma.sourceEducative.findUnique({ where: { code: "esr-fr" } });
  const sourceRor = await prisma.sourceEducative.findUnique({ where: { code: "ror" } });
  if (!source || !sourceRor) return { anciensNomsRattaches: 0 };
  const successions = [
    {
      rorId: "03xjwb503",
      anciensNoms: ["Université Paris Sud (Paris XI)"],
      url: "https://www.universite-paris-saclay.fr/en/news/publication-legal-decree-creating-paris-saclay-university",
    },
    {
      rorId: "0199hds37",
      anciensNoms: ["Université Paris Nord (Paris XIII)"],
      url: "https://www.sorbonne-paris-nord.fr/",
    },
    {
      rorId: "05ggc9x40",
      anciensNoms: ["Université Val-de-Marne (Paris XII)"],
      url: "https://www.u-pec.fr/",
    },
    {
      rorId: "03x42jk29",
      anciensNoms: ["Université Paris-Est Marne-la-Vallée"],
      url: "https://lbmc.univ-gustave-eiffel.fr/toute-lactualite/actualites-details/creation-de-luniversite-eiffel",
    },
    {
      rorId: "052bz7812",
      anciensNoms: ["Université Paris-Dauphine (Paris IX)"],
      url: "https://dauphine.psl.eu/en/dauphine/about-dauphine/history",
    },
    {
      rorId: "02en5vm52",
      anciensNoms: [
        "Université Paris-Sorbonne (Paris IV)",
        "Université de Paris IV Sorbonne",
        "Sorbonne Université - Faculté des Sciences (Paris VI)",
      ],
      url: "https://www.sorbonne-universite.fr/universite/politique-detablissement/histoire-de-sorbonne-universite",
    },
    {
      rorId: "05q65zh81",
      anciensNoms: ["Ecole Nationale Supérieure de Chimie de Paris"],
      url: "https://www.chimieparistech.psl.eu/",
    },
  ];
  let anciensNomsRattaches = 0;

  for (const succession of successions) {
    const referenceRor = await prisma.etablissementSource.findUnique({
      where: { sourceId_identifiantExterne: { sourceId: sourceRor.id, identifiantExterne: succession.rorId } },
      include: { etablissement: true },
    });
    const canonique = referenceRor?.etablissement;
    if (!canonique) continue;
    const anciensNoms = succession.anciensNoms.map(normaliser);
    const doublons = await prisma.etablissement.findMany({
      where: { paysCode: "FR", id: { not: canonique.id }, valide: true, nomNormalise: { in: anciensNoms } },
      include: { alias: true },
    });
    for (const doublon of doublons) {
      await prisma.formation.updateMany({ where: { etablissementId: doublon.id }, data: { etablissementId: canonique.id } });
      await prisma.avisEtablissement.updateMany({ where: { etablissementId: doublon.id }, data: { etablissementId: canonique.id } });
      await prisma.etablissementSource.updateMany({ where: { etablissementId: doublon.id }, data: { etablissementId: canonique.id } });
      for (const alias of [{ nom: doublon.nom, nomNormalise: doublon.nomNormalise }, ...doublon.alias]) {
        await prisma.etablissementAlias.upsert({
          where: { etablissementId_nomNormalise: { etablissementId: canonique.id, nomNormalise: alias.nomNormalise } },
          create: { etablissementId: canonique.id, nom: alias.nom, nomNormalise: alias.nomNormalise },
          update: { nom: alias.nom },
        });
      }
      await prisma.etablissement.update({ where: { id: doublon.id }, data: { valide: false } });
      anciensNomsRattaches += 1;
    }
    await prisma.etablissementSource.upsert({
      where: {
        sourceId_identifiantExterne: {
          sourceId: source.id,
          identifiantExterne: `succession:${canonique.id}`,
        },
      },
      create: {
        etablissementId: canonique.id,
        sourceId: source.id,
        identifiantExterne: `succession:${canonique.id}`,
        urlSource: succession.url,
        confiance: 0.99,
        donneesBrutes: { anciensNoms: succession.anciensNoms },
      },
      update: {
        etablissementId: canonique.id,
        urlSource: succession.url,
        confiance: 0.99,
        vuLe: new Date(),
        donneesBrutes: { anciensNoms: succession.anciensNoms },
      },
    });
  }
  return { anciensNomsRattaches };
}

async function semerOffres(institutions: Map<string, string>) {
  let total = 0;
  for (const offre of OFFRES_SPECIFIQUES) {
    const etablissementId = institutions.get(offre.institutionKey);
    const programme = await prisma.programmeEducation.findUnique({ where: { id: offre.programmeKey } });
    if (!etablissementId || !programme) continue;
    const etablissement = await prisma.etablissement.findUniqueOrThrow({ where: { id: etablissementId } });
    const sourceProgramme = await prisma.programmeSource.findFirst({ where: { programmeId: programme.id }, include: { source: true } });
    for (const nomDiplome of offre.diplomes) {
      const diplome = await prisma.diplomeEducation.findFirst({
        where: { paysCode: etablissement.paysCode, nomNormalise: normaliser(nomDiplome) },
      });
      const identifiant = `${offre.institutionKey}:${offre.programmeKey}:${diplome?.id || "sans-diplome"}`;
      const enregistrement = await prisma.etablissementProgramme.upsert({
        where: { id: identifiantStable("offre", identifiant) },
        create: { id: identifiantStable("offre", identifiant), etablissementId, programmeId: programme.id, diplomeId: diplome?.id || null, niveau: programme.niveau },
        update: { diplomeId: diplome?.id || null, actif: true },
      });
      if (sourceProgramme) {
        await prisma.offreFormationSource.upsert({
          where: { sourceId_identifiantExterne: { sourceId: sourceProgramme.sourceId, identifiantExterne: identifiant } },
          create: { offreId: enregistrement.id, sourceId: sourceProgramme.sourceId, identifiantExterne: identifiant, urlSource: sourceProgramme.urlSource || sourceProgramme.source.url, confiance: 0.88 },
          update: { offreId: enregistrement.id, vuLe: new Date() },
        });
      }
      total += 1;
    }
  }
  return total;
}

type HipoUniversity = {
  alpha_two_code: string;
  domains: string[];
  name: string;
  web_pages: string[];
  "state-province": string | null;
};

async function importerHipo() {
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "hipo" } });
  const importation = await prisma.importEducation.create({ data: { sourceId: source.id } });
  try {
    const response = await fetch("https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json", {
      headers: { "User-Agent": "MaliWuli/0.1 education catalogue" },
    });
    if (!response.ok) throw new Error(`Hipo ${response.status}`);
    const donnees = (await response.json()) as HipoUniversity[];
    const paysConnus = new Set((await prisma.paysEducation.findMany({ select: { code: true } })).map(({ code }) => code));
    let ajoutes = 0;
    let modifies = 0;
    let ignores = 0;
    for (const universite of donnees) {
      const paysCode = universite.alpha_two_code?.toUpperCase();
      if (!/^[A-Z]{2}$/.test(paysCode) || !paysConnus.has(paysCode)) {
        ignores += 1;
        continue;
      }
      const externe = universite.domains[0] || `${paysCode}:${normaliser(universite.name)}`;
      const referenceExistante = await prisma.etablissementSource.findUnique({
        where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: externe } },
      });
      const nomNormalise = normaliser(universite.name);
      const ville = universite["state-province"] || null;
      const villeNormalisee = normaliser(ville || "");
      let etablissement = referenceExistante
        ? await prisma.etablissement.findUnique({ where: { id: referenceExistante.etablissementId } })
        : await prisma.etablissement.findFirst({
            where: { paysCode, OR: [{ nomNormalise }, { alias: { some: { nomNormalise } } }] },
          });
      const type = /institute|school|college|polytechnic/i.test(universite.name)
        ? TypeEtablissement.ECOLE_SUPERIEURE
        : TypeEtablissement.UNIVERSITE;
      if (etablissement) {
        etablissement = await prisma.etablissement.update({
          where: { id: etablissement.id },
          data: { siteWeb: etablissement.siteWeb || universite.web_pages[0] || null },
        });
        modifies += 1;
      } else {
        etablissement = await prisma.etablissement.create({
          data: {
            nom: universite.name,
            nomNormalise,
            type,
            paysCode,
            systemeEducatifCode: paysCode,
            ville,
            villeNormalisee,
            statut: StatutEtablissement.INCONNU,
            siteWeb: universite.web_pages[0] || null,
          },
        });
        ajoutes += 1;
      }
      await prisma.etablissementNiveau.upsert({
        where: { etablissementId_niveau: { etablissementId: etablissement.id, niveau: NiveauEducation.SUPERIEUR } },
        create: { etablissementId: etablissement.id, niveau: NiveauEducation.SUPERIEUR },
        update: {},
      });
      await prisma.etablissementSource.upsert({
        where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: externe } },
        create: { etablissementId: etablissement.id, sourceId: source.id, identifiantExterne: externe, urlSource: universite.web_pages[0] || source.url, confiance: 0.68 },
        update: { etablissementId: etablissement.id, urlSource: universite.web_pages[0] || source.url, vuLe: new Date() },
      });
    }
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: { statut: StatutImportEducation.TERMINE, ajoutes, modifies, ignores, termineLe: new Date(), detail: { recus: donnees.length } },
    });
    return { recus: donnees.length, ajoutes, modifies, ignores };
  } catch (error) {
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: { statut: StatutImportEducation.ECHEC, erreurs: 1, termineLe: new Date(), detail: { message: error instanceof Error ? error.message : "Erreur inconnue" } },
    });
    throw error;
  }
}

async function main() {
  const importerHipoDemande = process.argv.includes("--hipo");
  const pays = await semerPays();
  const sources = await semerSources();
  const diplomes = await semerDiplomes();
  const programmes = await semerProgrammes();
  const institutions = await semerInstitutionsReferencees();
  const seriesEtablissements = await semerSeriesEtablissements(institutions);
  const reconciliationParis = await reconcilierParisCite();
  const offres = await semerOffres(institutions);
  const hipo = importerHipoDemande ? await importerHipo() : null;
  const successionsFrancaises = await reconcilierSuccessionsFrancaises();

  console.log(JSON.stringify({ pays, sources, diplomes, programmes, institutionsReferencees: institutions.size, seriesEtablissements, reconciliationParis, successionsFrancaises, offres, hipo }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

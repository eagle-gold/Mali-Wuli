import { createHash } from "node:crypto";
import {
  ModeUtilisationSource,
  NiveauEducation,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
  TypeProgrammeEducation,
} from "@prisma/client";

const prisma = new PrismaClient();

const API_BASE = "https://api.campusmali.edu.ml/sigu/api/v1";
const URL_UNIVERSITES = `${API_BASE}/structure/universities?size=5000`;
const URL_COMPOSANTES = `${API_BASE}/structure/ies?size=5000`;
const SOURCE_CODE = "campus-mali-api";

type UniversiteCampus = {
  id: string;
  name: string;
  acronym?: string | null;
  description?: string | null;
  address?: string | null;
  contact?: string | null;
  website?: string | null;
  baseUrl: string;
};

type ComposanteCampus = {
  id: string;
  name: string;
  acronym?: string | null;
  type?: string | null;
  address?: string | null;
  contact?: string | null;
  instanceID: number;
  university: UniversiteCampus;
};

type OptionCampus = {
  id: number;
  uuid?: string | null;
  nom: string;
  codeOption?: string | null;
  mention?: string | null;
  cursus: string;
  filiere?: {
    id?: number | null;
    nom?: string | null;
    codeFiliere?: string | null;
  } | null;
};

type ReponsePage<T> = {
  status?: number;
  message?: string;
  data?: { content?: T[] };
};

type ConfigurationEtablissement = {
  id: string;
  nom?: string;
  sigle?: string;
  ville: string;
  type: TypeEtablissement;
  statut?: StatutEtablissement;
  aliases?: string[];
};

// Les UUID Campus Mali permettent de conserver les identifiants canoniques déjà
// utilisés par les profils et les pages d'établissement de Mali Wuli. UYOB et
// UKB sont les nouvelles dénominations officielles de l'ULSHB et de l'USJPB.
const ETABLISSEMENTS: Record<string, ConfigurationEtablissement> = {
  "06603469-9af0-4b40-aa9f-7fe4952fc834": {
    id: "ml-osm-8198c49accca33dc8c66ddf7",
    nom: "Centre de Recherche et de Formation pour les Industries Légères et Textiles",
    sigle: "CERFILTEX",
    ville: "Ségou",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
    aliases: [
      "CERFITEX",
      "CERFITex de Ségou",
      "Centre de Recherche et de Formation pour l’Industrie Textile",
    ],
  },
  "4d49e5cd-5a55-4506-b1aa-10fc817c9996": {
    id: "ml-eni-abt",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "958cf665-ae69-4e0f-a4f7-b41d47b82d5a": {
    id: "ml-osm-8d93c2d6c09ab10fc44e50f9",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "bab0ade7-45be-4dbb-a932-91dcd5390d7e": {
    id: "ml-infss",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "32d6d319-bc2b-4c9d-b84e-3d7bc6f0dabd": {
    id: "ml-injs",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "7dc97eee-adb9-404d-9000-c416147460e3": {
    id: "ml-ipr-ifra",
    ville: "Katibougou",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "11b12062-d322-42a1-bdf4-b25afffa7a9d": {
    id: "ml-izsej",
    nom: "Institut Zayed des Sciences Économiques et Juridiques de Bamako",
    sigle: "IZSEJ",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
    aliases: ["ZSEJ", "IZSEJB"],
  },
  "7fc3d939-0e7c-4b3e-9360-f4f1a3c6d24a": {
    id: "ml-ipu",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "d15c0f85-678f-48ad-82ee-3469de449da8": {
    id: "ml-iheri-abt",
    ville: "Tombouctou",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "24e02c6a-48e4-451a-8d52-ed73f9f172c4": {
    id: "ml-ulshb",
    nom: "Université Yambo Ouologuem de Bamako",
    sigle: "UYOB",
    ville: "Bamako",
    type: TypeEtablissement.UNIVERSITE,
    aliases: [
      "ULSHB",
      "Université des Lettres et des Sciences Humaines de Bamako",
      "Université des Lettres, Langues et des Sciences Humaines de Bamako",
    ],
  },
  "bff982c8-d1f8-4c08-adba-aa9841d71cbe": {
    id: "ml-segou",
    nom: "Université de Ségou",
    sigle: "US",
    ville: "Ségou",
    type: TypeEtablissement.UNIVERSITE,
  },
  "3eaed314-b775-46c6-b3e4-0d3d1ba4b12c": {
    id: "ml-sikasso",
    nom: "Université de Sikasso",
    sigle: "USI",
    ville: "Sikasso",
    type: TypeEtablissement.UNIVERSITE,
  },
  "8c0a3875-6ac3-412b-8608-0319e285b69a": {
    id: "ml-universite-tombouctou",
    ville: "Tombouctou",
    type: TypeEtablissement.UNIVERSITE,
  },
  "c6a3ac2a-f861-4883-9c0b-8bad98b58503": {
    id: "ml-ussgb",
    ville: "Bamako",
    type: TypeEtablissement.UNIVERSITE,
  },
  "958fabcd-a652-40b8-8d6c-ea599a56682d": {
    id: "ml-usttb",
    ville: "Bamako",
    type: TypeEtablissement.UNIVERSITE,
  },
  "18c7e923-60f3-4ddf-8bba-775e31ac95c7": {
    id: "ml-usjpb",
    nom: "Université Kurukan Fuga de Bamako",
    sigle: "UKB",
    ville: "Bamako",
    type: TypeEtablissement.UNIVERSITE,
    aliases: [
      "USJPB",
      "Université des Sciences Juridiques et Politiques de Bamako",
      "Université Kurukanfuga de Bamako",
    ],
  },
  "da744307-03bd-4c49-8438-3a40145ee846": {
    id: "ml-ens",
    nom: "École Normale Supérieure de Bamako",
    sigle: "ENSup",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "3dc405ff-24a5-4355-a6cf-5878454335bd": {
    id: "ml-esiau",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
    statut: StatutEtablissement.PRIVE,
  },
  "8f081ed1-2e62-4923-9763-e17b84281b76": {
    id: "ml-enetp",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
  "99773736-353e-4911-a155-5c22ae812a0c": {
    id: "ml-esjsc",
    ville: "Bamako",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
  },
};

const DIPLOMES: Record<string, { nom: string; sigle?: string }> = {
  DUT: { nom: "Diplôme universitaire de technologie", sigle: "DUT" },
  LICENCE: { nom: "Licence" },
  LICENCE_PRO: { nom: "Licence professionnelle" },
  MASTER: { nom: "Master" },
  DOCTORAT: { nom: "Doctorat / PhD" },
  DIU: { nom: "Diplôme interuniversitaire", sigle: "DIU" },
  INGENIEUR: { nom: "Diplôme d’ingénieur" },
  MAITRISE: { nom: "Maîtrise" },
};

const normaliser = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const nettoyer = (valeur: string) => valeur
  .replace(/[_]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const phrase = (valeur: string) => {
  const propre = nettoyer(valeur);
  if (!propre || propre !== propre.toLocaleUpperCase("fr")) return propre;
  const minuscules = propre.toLocaleLowerCase("fr");
  const capitalise = minuscules.charAt(0).toLocaleUpperCase("fr") + minuscules.slice(1);
  return capitalise
    .replace(/^dut\b/, "DUT")
    .replace(/^diu\b/, "DIU")
    .replace(/^licence\b/, "Licence")
    .replace(/^master\b/, "Master")
    .replace(/^doctorat\b/, "Doctorat")
    .replace(/^ingenieur\b/, "Ingénieur")
    .replace(/^maitrise\b/, "Maîtrise");
};

const identifiantStable = (prefixe: string, valeur: string) =>
  `${prefixe}-${createHash("sha1").update(valeur).digest("hex").slice(0, 24)}`;

const attendre = (duree: number) => new Promise((resolve) => setTimeout(resolve, duree));

async function chargerJson<T>(url: string, tentatives = 3): Promise<T> {
  let derniereErreur: unknown;
  for (let tentative = 1; tentative <= tentatives; tentative += 1) {
    try {
      const reponse = await fetch(url, {
        headers: { "User-Agent": "MaliWuli-Education-Catalog/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!reponse.ok) throw new Error(`Campus Mali ${reponse.status} pour ${url}`);
      return await reponse.json() as T;
    } catch (error) {
      derniereErreur = error;
      if (tentative < tentatives) await attendre(750 * tentative);
    }
  }
  throw derniereErreur;
}

async function chargerCatalogue() {
  const [reponseUniversites, reponseComposantes] = await Promise.all([
    chargerJson<ReponsePage<UniversiteCampus>>(URL_UNIVERSITES),
    chargerJson<ReponsePage<ComposanteCampus>>(URL_COMPOSANTES),
  ]);
  const universites = reponseUniversites.data?.content || [];
  const composantes = reponseComposantes.data?.content || [];
  if (universites.length < 15 || composantes.length < 25) {
    throw new Error(`Réponse Campus Mali incomplète (${universites.length} établissements, ${composantes.length} composantes).`);
  }

  const options: Array<{ composante: ComposanteCampus; url: string; option: OptionCampus }> = [];
  const echecs: Array<{ composante: string; url: string; message: string }> = [];
  const composantesChargees = new Set<string>();
  for (const composante of composantes) {
    const url = `${composante.university.baseUrl}/options/structure/${composante.instanceID}`;
    try {
      const lignes = await chargerJson<OptionCampus[]>(url);
      composantesChargees.add(composante.id);
      for (const option of lignes) {
        if (option?.nom?.trim() && option?.cursus?.trim()) options.push({ composante, url, option });
      }
    } catch (error) {
      echecs.push({
        composante: composante.acronym || composante.name,
        url,
        message: error instanceof Error ? error.message : "Erreur inconnue",
      });
    }
  }
  if (options.length < 450) {
    throw new Error(`Seulement ${options.length} formations Campus Mali reçues ; import annulé par sécurité.`);
  }
  return { universites, composantes, composantesChargees, options, echecs };
}

async function assurerSource() {
  return prisma.sourceEducative.upsert({
    where: { code: SOURCE_CODE },
    create: {
      code: SOURCE_CODE,
      nom: "Campus Mali — catalogue officiel des formations",
      url: URL_UNIVERSITES,
      paysCode: "ML",
      modeUtilisation: ModeUtilisationSource.API_OFFICIELLE,
      priorite: 5,
    },
    update: {
      nom: "Campus Mali — catalogue officiel des formations",
      url: URL_UNIVERSITES,
      paysCode: "ML",
      modeUtilisation: ModeUtilisationSource.API_OFFICIELLE,
      priorite: 5,
      actif: true,
    },
  });
}

async function assurerDiplomes() {
  const resultat = new Map<string, string>();
  for (const [cursus, diplome] of Object.entries(DIPLOMES)) {
    const nomNormalise = normaliser(diplome.nom);
    const enregistrement = await prisma.diplomeEducation.upsert({
      where: {
        paysCode_niveau_nomNormalise: {
          paysCode: "ML",
          niveau: NiveauEducation.SUPERIEUR,
          nomNormalise,
        },
      },
      create: {
        id: identifiantStable("diplome", `ML:SUPERIEUR:${nomNormalise}`),
        paysCode: "ML",
        nom: diplome.nom,
        nomNormalise,
        sigle: diplome.sigle || null,
        niveau: NiveauEducation.SUPERIEUR,
      },
      update: { nom: diplome.nom, sigle: diplome.sigle || null, actif: true },
    });
    resultat.set(cursus, enregistrement.id);
  }
  return resultat;
}

async function enregistrerEtablissements(
  sourceId: string,
  universites: UniversiteCampus[],
  composantes: ComposanteCampus[],
) {
  const ids = new Map<string, string>();
  let ajoutes = 0;
  let modifies = 0;
  const composantesParUniversite = new Map<string, ComposanteCampus[]>();
  for (const composante of composantes) {
    const liste = composantesParUniversite.get(composante.university.id) || [];
    liste.push(composante);
    composantesParUniversite.set(composante.university.id, liste);
  }

  for (const universite of universites) {
    const configuration = ETABLISSEMENTS[universite.id];
    if (!configuration) throw new Error(`Établissement Campus Mali non mappé : ${universite.id} (${universite.name}).`);
    const existant = await prisma.etablissement.findUnique({ where: { id: configuration.id } });
    const nom = configuration.nom || phrase(universite.name);
    const sigle = configuration.sigle || universite.acronym?.trim() || null;
    const villeNormalisee = normaliser(configuration.ville);
    await prisma.etablissement.upsert({
      where: { id: configuration.id },
      create: {
        id: configuration.id,
        nom,
        nomNormalise: normaliser(nom),
        sigle,
        type: configuration.type,
        paysCode: "ML",
        systemeEducatifCode: "ML",
        ville: configuration.ville,
        villeNormalisee,
        statut: configuration.statut || StatutEtablissement.PUBLIC,
        siteWeb: universite.website && !/portail\.campusmali/i.test(universite.website) ? universite.website : null,
      },
      update: {
        nom,
        nomNormalise: normaliser(nom),
        sigle,
        type: configuration.type,
        paysCode: "ML",
        systemeEducatifCode: "ML",
        ville: configuration.ville,
        villeNormalisee,
        statut: configuration.statut || StatutEtablissement.PUBLIC,
        valide: true,
        ...(universite.website && !/portail\.campusmali/i.test(universite.website)
          ? { siteWeb: universite.website }
          : {}),
      },
    });
    await prisma.etablissementNiveau.deleteMany({
      where: { etablissementId: configuration.id, niveau: { not: NiveauEducation.SUPERIEUR } },
    });
    await prisma.etablissementNiveau.upsert({
      where: {
        etablissementId_niveau: {
          etablissementId: configuration.id,
          niveau: NiveauEducation.SUPERIEUR,
        },
      },
      create: { etablissementId: configuration.id, niveau: NiveauEducation.SUPERIEUR },
      update: {},
    });

    const aliases = new Set([
      ...(configuration.aliases || []),
      universite.name,
      universite.acronym || "",
    ]);
    for (const alias of aliases) {
      const propre = nettoyer(alias);
      const aliasNormalise = normaliser(propre);
      if (!aliasNormalise || aliasNormalise === normaliser(nom)) continue;
      await prisma.etablissementAlias.upsert({
        where: {
          etablissementId_nomNormalise: {
            etablissementId: configuration.id,
            nomNormalise: aliasNormalise,
          },
        },
        create: {
          etablissementId: configuration.id,
          nom: propre,
          nomNormalise: aliasNormalise,
        },
        update: { nom: propre },
      });
    }

    const composantesOfficielles = composantesParUniversite.get(universite.id) || [];
    await prisma.etablissementSource.upsert({
      where: {
        sourceId_identifiantExterne: {
          sourceId,
          identifiantExterne: `universite:${universite.id}`,
        },
      },
      create: {
        etablissementId: configuration.id,
        sourceId,
        identifiantExterne: `universite:${universite.id}`,
        urlSource: universite.baseUrl,
        confiance: 0.99,
        donneesBrutes: {
          acronym: universite.acronym || null,
          address: universite.address || null,
          contact: universite.contact || null,
          composantes: composantesOfficielles.map((item) => ({
            id: item.id,
            instanceID: item.instanceID,
            nom: item.name,
            sigle: item.acronym || null,
            adresse: item.address || null,
          })),
        },
      },
      update: {
        etablissementId: configuration.id,
        urlSource: universite.baseUrl,
        confiance: 0.99,
        vuLe: new Date(),
        donneesBrutes: {
          acronym: universite.acronym || null,
          address: universite.address || null,
          contact: universite.contact || null,
          composantes: composantesOfficielles.map((item) => ({
            id: item.id,
            instanceID: item.instanceID,
            nom: item.name,
            sigle: item.acronym || null,
            adresse: item.address || null,
          })),
        },
      },
    });
    ids.set(universite.id, configuration.id);
    if (existant) modifies += 1;
    else ajoutes += 1;
  }
  return { ids, ajoutes, modifies };
}

async function importer() {
  const validationSeule = process.argv.includes("--validate-only");
  const catalogue = await chargerCatalogue();
  const uniques = new Set(catalogue.options.map(({ composante, option }) =>
    `${composante.university.id}:${normaliser(option.nom)}:${option.cursus.toUpperCase()}`));

  if (validationSeule) {
    console.log(JSON.stringify({
      etablissements: catalogue.universites.length,
      composantes: catalogue.composantes.length,
      formationsRecues: catalogue.options.length,
      formationsApresFusion: uniques.size,
      echecs: catalogue.echecs,
    }, null, 2));
    return;
  }

  const source = await assurerSource();
  const importation = await prisma.importEducation.create({
    data: { sourceId: source.id, paysCode: "ML" },
  });

  try {
    const diplomes = await assurerDiplomes();
    const etablissements = await enregistrerEtablissements(
      source.id,
      catalogue.universites,
      catalogue.composantes,
    );
    const groupes = new Map<string, Array<{ composante: ComposanteCampus; url: string; option: OptionCampus }>>();
    for (const ligne of catalogue.options) {
      const cle = `${ligne.composante.university.id}:${normaliser(ligne.option.nom)}:${ligne.option.cursus.toUpperCase()}`;
      const groupe = groupes.get(cle) || [];
      groupe.push(ligne);
      groupes.set(cle, groupe);
    }

    let programmesAjoutes = 0;
    let programmesModifies = 0;
    let offresAjoutees = 0;
    let offresModifiees = 0;
    const optionsActuellesParComposante = new Map<string, Set<string>>();
    const toutesLesOptionsActuelles = new Set<string>();

    for (const [cle, lignes] of groupes) {
      const premiere = lignes[0];
      const { composante, option } = premiere;
      const etablissementId = etablissements.ids.get(composante.university.id);
      if (!etablissementId) continue;
      const cursusBrut = option.cursus.toUpperCase();
      const cursus = cursusBrut === "LICENCE" && /licence\s+professionnelle/i.test(nettoyer(option.nom))
        ? "LICENCE_PRO"
        : cursusBrut;
      const diplomeId = diplomes.get(cursus);
      if (!diplomeId) throw new Error(`Cursus Campus Mali inconnu : ${cursus}.`);
      const nom = phrase(option.nom);
      const programmeId = identifiantStable("ml-campus", cle);
      const programmeExistant = await prisma.programmeEducation.findUnique({ where: { id: programmeId } });
      const description = nettoyer(`Composante : ${composante.name}${composante.acronym ? ` (${composante.acronym})` : ""}.`).slice(0, 190);
      await prisma.programmeEducation.upsert({
        where: { id: programmeId },
        create: {
          id: programmeId,
          paysCode: "ML",
          nom,
          nomNormalise: normaliser(nom),
          type: TypeProgrammeEducation.FORMATION,
          niveau: NiveauEducation.SUPERIEUR,
          codeOfficiel: option.codeOption?.trim() || option.filiere?.codeFiliere?.trim() || null,
          description,
        },
        update: {
          paysCode: "ML",
          nom,
          nomNormalise: normaliser(nom),
          type: TypeProgrammeEducation.FORMATION,
          niveau: NiveauEducation.SUPERIEUR,
          codeOfficiel: option.codeOption?.trim() || option.filiere?.codeFiliere?.trim() || null,
          description,
          actif: true,
        },
      });
      if (programmeExistant) programmesModifies += 1;
      else programmesAjoutes += 1;

      const offreId = identifiantStable("offre-campus", `${etablissementId}:${programmeId}:${diplomeId}`);
      const offreExistante = await prisma.etablissementProgramme.findUnique({ where: { id: offreId } });
      await prisma.etablissementProgramme.upsert({
        where: { id: offreId },
        create: {
          id: offreId,
          etablissementId,
          programmeId,
          diplomeId,
          niveau: NiveauEducation.SUPERIEUR,
        },
        update: {
          etablissementId,
          programmeId,
          diplomeId,
          niveau: NiveauEducation.SUPERIEUR,
          actif: true,
        },
      });
      if (offreExistante) offresModifiees += 1;
      else offresAjoutees += 1;

      for (const ligne of lignes) {
        const optionId = ligne.option.uuid?.trim()
          || `${ligne.composante.university.id}:${ligne.composante.id}:${ligne.option.id}`;
        const identifiantExterne = `option:${ligne.composante.id}:${optionId}`;
        const actuelles = optionsActuellesParComposante.get(ligne.composante.id) || new Set<string>();
        actuelles.add(identifiantExterne);
        toutesLesOptionsActuelles.add(identifiantExterne);
        optionsActuellesParComposante.set(ligne.composante.id, actuelles);
        await prisma.programmeSource.upsert({
          where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne } },
          create: {
            programmeId,
            sourceId: source.id,
            identifiantExterne,
            urlSource: ligne.url,
            confiance: 0.99,
          },
          update: {
            programmeId,
            urlSource: ligne.url,
            confiance: 0.99,
            vuLe: new Date(),
          },
        });
        await prisma.offreFormationSource.upsert({
          where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne } },
          create: {
            offreId,
            sourceId: source.id,
            identifiantExterne,
            urlSource: ligne.url,
            confiance: 0.99,
          },
          update: {
            offreId,
            urlSource: ligne.url,
            confiance: 0.99,
            vuLe: new Date(),
          },
        });
      }
    }

    let offresDesactivees = 0;
    const offresDejaDesactivees = new Set<string>();
    for (const composanteId of catalogue.composantesChargees) {
      const actuelles = optionsActuellesParComposante.get(composanteId) || new Set<string>();
      const anciennes = await prisma.offreFormationSource.findMany({
        where: {
          sourceId: source.id,
          identifiantExterne: {
            startsWith: `option:${composanteId}:`,
            ...(actuelles.size ? { notIn: [...actuelles] } : {}),
          },
        },
        select: { offreId: true },
      });
      for (const { offreId } of anciennes) {
        if (offresDejaDesactivees.has(offreId)) continue;
        const referencesActuelles = await prisma.offreFormationSource.count({
          where: {
            offreId,
            sourceId: source.id,
            identifiantExterne: { in: [...toutesLesOptionsActuelles] },
          },
        });
        if (referencesActuelles) continue;
        await prisma.etablissementProgramme.update({
          where: { id: offreId },
          data: { actif: false },
        });
        offresDejaDesactivees.add(offreId);
        offresDesactivees += 1;
      }
    }

    const statut = catalogue.echecs.length ? StatutImportEducation.PARTIEL : StatutImportEducation.TERMINE;
    const resultat = {
      etablissementsRecus: catalogue.universites.length,
      etablissementsAjoutes: etablissements.ajoutes,
      etablissementsModifies: etablissements.modifies,
      composantesRecues: catalogue.composantes.length,
      formationsRecues: catalogue.options.length,
      formationsApresFusion: groupes.size,
      doublonsFusionnes: catalogue.options.length - groupes.size,
      programmesAjoutes,
      programmesModifies,
      offresAjoutees,
      offresModifiees,
      offresDesactivees,
      echecs: catalogue.echecs,
    };
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: {
        statut,
        ajoutes: etablissements.ajoutes + programmesAjoutes + offresAjoutees,
        modifies: etablissements.modifies + programmesModifies + offresModifiees,
        ignores: resultat.doublonsFusionnes,
        erreurs: catalogue.echecs.length,
        termineLe: new Date(),
        detail: resultat,
      },
    });
    console.log(JSON.stringify(resultat, null, 2));
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

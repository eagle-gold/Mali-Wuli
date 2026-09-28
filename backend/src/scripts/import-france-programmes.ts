import { createHash } from "node:crypto";
import {
  NiveauEducation,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
  TypeProgrammeEducation,
} from "@prisma/client";
import { parse } from "csv-parse";

const prisma = new PrismaClient();
const BASE_ODS = "https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets";
const SESSION_MON_MASTER = 2025;
const ANNEE_PARCOURSUP = 2026;
const TAILLE_PAGE = 100;
const URL_MON_MASTER = "https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-mon_master/";
const URL_PARCOURSUP = "https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-cartographie_formations_parcoursup/";

const normaliser = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const motsPeuDistinctifs = new Set([
  "universite", "university", "ecole", "institut", "national", "nationale",
  "superieur", "superieure", "de", "du", "des", "d", "l", "la", "le", "les", "et", "the",
]);

const empreinteNom = (valeur: string) => normaliser(valeur)
  .replace(/\b(i|1er)\b/g, "1")
  .replace(/\b(ii|2e)\b/g, "2")
  .replace(/\b(iii|3e)\b/g, "3")
  .split(" ")
  .filter((mot) => mot && !motsPeuDistinctifs.has(mot))
  .sort()
  .join(" ");

const domaine = (valeur?: string | null) => {
  if (!valeur) return "";
  try {
    return new URL(/^https?:\/\//i.test(valeur) ? valeur : `https://${valeur}`)
      .hostname
      .toLocaleLowerCase("fr")
      .replace(/^www\./, "");
  } catch {
    return valeur.toLocaleLowerCase("fr").replace(/^www\./, "").replace(/\/$/, "");
  }
};

const identifiantStable = (prefixe: string, valeur: string) =>
  `${prefixe}-${createHash("sha1").update(valeur).digest("hex").slice(0, 24)}`;

// Les colonnes d'identifiants de provenance sont en VARCHAR(191). La base
// Hostinger n'active pas le mode SQL strict et tronque donc silencieusement les
// valeurs plus longues, ce qui peut transformer deux parcours distincts en une
// même clé unique. On conserve le préfixe (utile aux imports incrémentaux) et
// on remplace uniquement la fin par une empreinte stable.
const identifiantExterneStable = (valeur: string) => {
  const longueurMax = 191;
  if (valeur.length <= longueurMax) return valeur;
  const empreinte = createHash("sha1").update(valeur).digest("hex");
  return `${valeur.slice(0, longueurMax - empreinte.length - 1)}:${empreinte}`;
};

const phrase = (valeur: string) => {
  const propre = valeur.trim().replace(/\s+/g, " ");
  if (!propre || propre !== propre.toUpperCase()) return propre;
  const minuscules = propre.toLocaleLowerCase("fr");
  return minuscules.charAt(0).toLocaleUpperCase("fr") + minuscules.slice(1);
};

const tableau = (valeur: string[] | string | null | undefined) => {
  if (Array.isArray(valeur)) return valeur.map(phrase).filter(Boolean);
  // Dans l'export CSV ODS, les éléments d'une liste sont accolés avec une
  // virgule sans espace, tandis qu'une virgule faisant partie d'un intitulé
  // français est normalement suivie d'une espace (ex. « Langues, littératures »).
  // Cette distinction évite d'afficher plusieurs formations concaténées dans
  // un seul bouton sans casser les intitulés contenant de la ponctuation.
  return valeur ? valeur.split(/,(?=\S)/).map(phrase).filter(Boolean) : [];
};

type ReponseOds<T> = { total_count?: number; results?: T[] };

async function chargerToutesLesPages<T>(
  dataset: string,
  select: string,
  where: string,
  orderBy: string,
) {
  const lignes: T[] = [];
  for (let offset = 0; ; offset += TAILLE_PAGE) {
    const parametres = new URLSearchParams({
      select,
      where,
      order_by: orderBy,
      limit: String(TAILLE_PAGE),
      offset: String(offset),
    });
    const url = `${BASE_ODS}/${dataset}/records?${parametres}`;
    const reponse = await fetch(url, {
      headers: { "User-Agent": "MaliWuli-Education-Catalog/0.1" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!reponse.ok) throw new Error(`${dataset} : réponse ${reponse.status}`);
    const donnees = await reponse.json() as ReponseOds<T>;
    const page = donnees.results || [];
    lignes.push(...page);
    if (lignes.length >= (donnees.total_count || 0) || page.length < TAILLE_PAGE) break;
  }
  return lignes;
}

type ProgrammeImporte = {
  cle: string;
  nom: string;
  codeOfficiel?: string;
  parcours: string[];
  diplomeRecherche?: string;
  urlSource: string;
};

type LigneMonMaster = {
  eta_uai?: string;
  eta_nom?: string;
  inm?: string;
  mention?: string;
  parcours?: string;
};
type LigneParcoursup = {
  etab_uai?: string;
  etab_nom?: string;
  etab_url?: string;
  commune?: string;
  code_formation?: string;
  tf?: string[] | string;
  fl?: string[] | string;
  nm?: string[] | string;
};

const diplomeParType = (type: string) => {
  const cle = normaliser(type);
  if (cle.includes("bts")) return "bts btsa";
  if (cle.includes("but") || cle.includes("dut")) return "dut but";
  if (cle.includes("licence")) return "licence";
  if (cle.includes("ingenieur")) return "diplome d ingenieur";
  return undefined;
};

const ajouterMaster = (
  programmes: Map<string, ProgrammeImporte>,
  uai: string,
  ligne: LigneMonMaster,
) => {
  if (!ligne.mention) return;
  const nom = `Master — ${phrase(ligne.mention)}`;
  const cle = `mon-master:${uai}:${normaliser(nom)}`;
  const existant = programmes.get(cle) || {
    cle,
    nom,
    codeOfficiel: ligne.inm,
    parcours: [],
    diplomeRecherche: "master",
    urlSource: URL_MON_MASTER,
  };
  if (ligne.parcours && !existant.parcours.some((item) => normaliser(item) === normaliser(ligne.parcours || ""))) {
    existant.parcours.push(phrase(ligne.parcours));
  }
  programmes.set(cle, existant);
};

const ajouterParcoursup = (
  programmes: Map<string, ProgrammeImporte>,
  uai: string,
  ligne: LigneParcoursup,
) => {
  const formations = tableau(ligne.fl).length ? tableau(ligne.fl) : tableau(ligne.tf);
  const parcours = tableau(ligne.nm);
  for (const formation of formations) {
    // Parcoursup peut publier une même formation sous plusieurs codes techniques
    // (campus, modalité ou vœu distinct). Le catalogue utilisateur conserve une
    // seule formation et fusionne ses parcours.
    const cle = `parcoursup:${uai}:${normaliser(formation)}`;
    const existant = programmes.get(cle) || {
      cle,
      nom: formation,
      codeOfficiel: ligne.code_formation,
      parcours: [],
      diplomeRecherche: diplomeParType(`${tableau(ligne.tf).join(" ")} ${formation}`),
      urlSource: URL_PARCOURSUP,
    };
    for (const item of parcours) {
      if (!existant.parcours.some((parcoursExistant) => normaliser(parcoursExistant) === normaliser(item))) {
        existant.parcours.push(item);
      }
    }
    programmes.set(cle, existant);
  }
};

const canoniserProgrammes = (
  programmes: Iterable<ProgrammeImporte>,
  etablissementId: string,
) => {
  const resultat = new Map<string, ProgrammeImporte>();
  for (const programme of programmes) {
    const origine = programme.cle.startsWith("mon-master:") ? "mon-master" : "parcoursup";
    const cle = `${origine}:${etablissementId}:${normaliser(programme.nom)}`;
    const existant = resultat.get(cle) || { ...programme, cle, parcours: [] };
    for (const parcours of programme.parcours) {
      if (!existant.parcours.some((item) => normaliser(item) === normaliser(parcours))) {
        existant.parcours.push(parcours);
      }
    }
    resultat.set(cle, existant);
  }
  return [...resultat.values()];
};

async function lireProgrammes(uai: string) {
  const programmes = new Map<string, ProgrammeImporte>();
  const masters = await chargerToutesLesPages<LigneMonMaster>(
    "fr-esr-mon_master",
    "inm,mention,parcours",
    `session=${SESSION_MON_MASTER} and eta_uai=\"${uai}\"`,
    "mention,parcours",
  );
  for (const ligne of masters) {
    ajouterMaster(programmes, uai, ligne);
  }

  const parcoursup = await chargerToutesLesPages<LigneParcoursup>(
    "fr-esr-cartographie_formations_parcoursup",
    "code_formation,tf,fl,nm",
    `annee=${ANNEE_PARCOURSUP} and etab_uai=\"${uai}\"`,
    "fl",
  );
  for (const ligne of parcoursup) {
    ajouterParcoursup(programmes, uai, ligne);
  }
  return [...programmes.values()];
}

async function desactiverAnciennesOffres(
  etablissementId: string,
  sourceId: string,
  prefixes: string[],
  clesActuelles: Set<string>,
) {
  const anciennesSources = await prisma.offreFormationSource.findMany({
    where: {
      sourceId,
      offre: { etablissementId, actif: true },
      OR: prefixes.flatMap((prefixe) => [
        { identifiantExterne: { startsWith: `mon-master:${prefixe}:` } },
        { identifiantExterne: { startsWith: `parcoursup:${prefixe}:` } },
      ]),
    },
    select: { identifiantExterne: true, offreId: true, offre: { select: { programmeId: true } } },
  });
  const offresActuelles = new Set(
    anciennesSources
      .filter(({ identifiantExterne }) => clesActuelles.has(identifiantExterne))
      .map(({ offreId }) => offreId),
  );
  // Un premier import effectué avec une ancienne clé tronquée peut coexister
  // avec la clé stable actuelle sur la même offre. Cette offre reste active.
  const obsoletes = anciennesSources.filter(({ identifiantExterne, offreId }) =>
    !clesActuelles.has(identifiantExterne) && !offresActuelles.has(offreId));
  if (!obsoletes.length) return 0;
  await prisma.etablissementProgramme.updateMany({
    where: { id: { in: obsoletes.map(({ offreId }) => offreId) } },
    data: { actif: false },
  });
  await prisma.programmeEducation.updateMany({
    where: { id: { in: obsoletes.map(({ offre }) => offre.programmeId) } },
    data: { actif: false },
  });
  return obsoletes.length;
}

async function enregistrerProgramme(
  etablissementId: string,
  sourceId: string,
  programme: ProgrammeImporte,
) {
  const programmeId = identifiantStable("fr-programme", programme.cle);
  const cleProgrammeSource = identifiantExterneStable(programme.cle);
  const parent = await prisma.programmeEducation.upsert({
    where: { id: programmeId },
    create: {
      id: programmeId,
      paysCode: "FR",
      nom: programme.nom,
      nomNormalise: normaliser(programme.nom),
      type: TypeProgrammeEducation.FORMATION,
      niveau: NiveauEducation.SUPERIEUR,
      codeOfficiel: programme.codeOfficiel || null,
    },
    update: {
      nom: programme.nom,
      nomNormalise: normaliser(programme.nom),
      codeOfficiel: programme.codeOfficiel || null,
      actif: true,
    },
  });
  await prisma.programmeSource.upsert({
    where: { sourceId_identifiantExterne: { sourceId, identifiantExterne: cleProgrammeSource } },
    create: {
      programmeId: parent.id,
      sourceId,
      identifiantExterne: cleProgrammeSource,
      urlSource: programme.urlSource,
      confiance: 0.99,
    },
    update: { programmeId: parent.id, urlSource: programme.urlSource, confiance: 0.99, vuLe: new Date() },
  });

  for (const parcours of programme.parcours) {
    const cleParcours = `${programme.cle}:parcours:${normaliser(parcours)}`;
    const cleParcoursSource = identifiantExterneStable(cleParcours);
    const parcoursId = identifiantStable("fr-parcours", cleParcours);
    await prisma.programmeEducation.upsert({
      where: { id: parcoursId },
      create: {
        id: parcoursId,
        paysCode: "FR",
        parentId: parent.id,
        nom: parcours,
        nomNormalise: normaliser(parcours),
        type: TypeProgrammeEducation.PARCOURS,
        niveau: NiveauEducation.SUPERIEUR,
      },
      update: { parentId: parent.id, nom: parcours, nomNormalise: normaliser(parcours), actif: true },
    });
    await prisma.programmeSource.upsert({
      where: { sourceId_identifiantExterne: { sourceId, identifiantExterne: cleParcoursSource } },
      create: { programmeId: parcoursId, sourceId, identifiantExterne: cleParcoursSource, urlSource: programme.urlSource, confiance: 0.99 },
      update: { programmeId: parcoursId, urlSource: programme.urlSource, confiance: 0.99, vuLe: new Date() },
    });
  }

  const diplome = programme.diplomeRecherche
    ? await prisma.diplomeEducation.findFirst({
        where: { paysCode: "FR", nomNormalise: { contains: programme.diplomeRecherche } },
        orderBy: { nom: "asc" },
      })
    : null;
  const offreId = identifiantStable("fr-offre", `${etablissementId}:${parent.id}:${diplome?.id || "sans-diplome"}`);
  const offre = await prisma.etablissementProgramme.upsert({
    where: { id: offreId },
    create: {
      id: offreId,
      etablissementId,
      programmeId: parent.id,
      diplomeId: diplome?.id || null,
      niveau: NiveauEducation.SUPERIEUR,
    },
    update: { diplomeId: diplome?.id || null, actif: true },
  });
  await prisma.offreFormationSource.upsert({
    where: { sourceId_identifiantExterne: { sourceId, identifiantExterne: cleProgrammeSource } },
    create: { offreId: offre.id, sourceId, identifiantExterne: cleProgrammeSource, urlSource: programme.urlSource, confiance: 0.99 },
    update: { offreId: offre.id, urlSource: programme.urlSource, confiance: 0.99, vuLe: new Date() },
  });
}

type CatalogueUai = {
  uai: string;
  nom: string;
  villes: Set<string>;
  urls: Set<string>;
  programmes: Map<string, ProgrammeImporte>;
};

type EtablissementCandidat = {
  id: string;
  nom: string;
  nomNormalise: string;
  ville: string | null;
  siteWeb: string | null;
  alias: Array<{ nom: string }>;
  sources: Array<{ identifiantExterne: string }>;
};

async function chargerExportCsv<T>(dataset: string, where: string) {
  const url = `${BASE_ODS}/${dataset}/exports/csv?${new URLSearchParams({ where })}`;
  const reponse = await fetch(url, {
    headers: { "User-Agent": "MaliWuli-Education-Catalog/0.1" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!reponse.ok) throw new Error(`${dataset} : export CSV ${reponse.status}`);
  const parser = parse(Buffer.from(await reponse.arrayBuffer()), {
    columns: true,
    delimiter: ";",
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  const lignes: T[] = [];
  for await (const ligne of parser as AsyncIterable<T>) lignes.push(ligne);
  return lignes;
}

async function lireCataloguesUniversites() {
  const [masters, parcoursup] = await Promise.all([
    chargerExportCsv<LigneMonMaster>("fr-esr-mon_master", `session=${SESSION_MON_MASTER}`),
    chargerExportCsv<LigneParcoursup>("fr-esr-cartographie_formations_parcoursup", `annee=${ANNEE_PARCOURSUP}`),
  ]);
  const catalogues = new Map<string, CatalogueUai>();
  for (const ligne of masters) {
    const uai = ligne.eta_uai?.trim().toUpperCase();
    if (!uai || !/^[0-9]{7}[A-Z]$/.test(uai)) continue;
    const catalogue = catalogues.get(uai) || {
      uai,
      nom: phrase(ligne.eta_nom || uai),
      villes: new Set<string>(),
      urls: new Set<string>(),
      programmes: new Map<string, ProgrammeImporte>(),
    };
    ajouterMaster(catalogue.programmes, uai, ligne);
    catalogues.set(uai, catalogue);
  }
  for (const ligne of parcoursup) {
    const uai = ligne.etab_uai?.trim().toUpperCase();
    if (!uai || !/^[0-9]{7}[A-Z]$/.test(uai)) continue;
    // La majorité des établissements présents dans Parcoursup ne proposent
    // pas de master. Ils ne figurent donc pas dans l'export Mon Master et
    // étaient auparavant ignorés par le mode --all-universities.
    const catalogue = catalogues.get(uai) || {
      uai,
      nom: phrase(ligne.etab_nom || uai),
      villes: new Set<string>(),
      urls: new Set<string>(),
      programmes: new Map<string, ProgrammeImporte>(),
    };
    if (ligne.commune?.trim()) catalogue.villes.add(phrase(ligne.commune));
    if (ligne.etab_url?.trim()) catalogue.urls.add(ligne.etab_url.trim());
    ajouterParcoursup(catalogue.programmes, uai, ligne);
    catalogues.set(uai, catalogue);
  }
  return [...catalogues.values()];
}

const ajouterIndexUnique = <T,>(index: Map<string, T | null>, cle: string, valeur: T) => {
  if (!cle) return;
  const existant = index.get(cle);
  if (existant && existant !== valeur) index.set(cle, null);
  else if (existant === undefined) index.set(cle, valeur);
};

async function preparerResolutionEtablissements() {
  const candidats = await prisma.etablissement.findMany({
    where: { paysCode: "FR", valide: true },
    select: {
      id: true,
      nom: true,
      nomNormalise: true,
      ville: true,
      siteWeb: true,
      alias: { select: { nom: true } },
      sources: { select: { identifiantExterne: true } },
    },
  });
  const parUai = new Map<string, EtablissementCandidat>();
  const parNomCanonique = new Map<string, EtablissementCandidat | null>();
  const parEmpreinteCanonique = new Map<string, EtablissementCandidat | null>();
  const parAlias = new Map<string, EtablissementCandidat | null>();
  const parEmpreinteAlias = new Map<string, EtablissementCandidat | null>();
  const parDomaine = new Map<string, EtablissementCandidat | null>();
  for (const candidat of candidats) {
    for (const reference of candidat.sources) {
      if (/^[0-9]{7}[A-Z]$/.test(reference.identifiantExterne)) {
        parUai.set(reference.identifiantExterne, candidat);
      }
      if (reference.identifiantExterne.includes(".")) {
        ajouterIndexUnique(parDomaine, domaine(reference.identifiantExterne), candidat);
      }
    }
    ajouterIndexUnique(parDomaine, domaine(candidat.siteWeb), candidat);
    ajouterIndexUnique(parNomCanonique, normaliser(candidat.nom), candidat);
    ajouterIndexUnique(parEmpreinteCanonique, empreinteNom(candidat.nom), candidat);
    for (const alias of candidat.alias) {
      ajouterIndexUnique(parAlias, normaliser(alias.nom), candidat);
      ajouterIndexUnique(parEmpreinteAlias, empreinteNom(alias.nom), candidat);
    }
  }
  return {
    parUai,
    parNomCanonique,
    parEmpreinteCanonique,
    parAlias,
    parEmpreinteAlias,
    parDomaine,
  };
}

async function rattacherEtablissement(
  catalogue: CatalogueUai,
  sourceId: string,
  index: Awaited<ReturnType<typeof preparerResolutionEtablissements>>,
) {
  const urlCatalogue = catalogue.programmes.values().next().value?.urlSource || URL_MON_MASTER;
  const parDomaine = [...catalogue.urls]
    .map((url) => index.parDomaine.get(domaine(url)))
    .find((item): item is EtablissementCandidat => Boolean(item));
  const candidatUai = index.parUai.get(catalogue.uai);
  const candidatNomOfficiel = index.parNomCanonique.get(normaliser(catalogue.nom));
  // Un ancien import a pu rattacher un UAI à un alias historique. Lorsqu'une
  // fiche canonique porte exactement le nom officiel courant, elle doit gagner.
  const ancienRattachement = candidatUai
    && candidatNomOfficiel
    && candidatUai.id !== candidatNomOfficiel.id
    && candidatUai.nomNormalise !== normaliser(catalogue.nom)
    ? candidatUai
    : null;
  let candidat = (ancienRattachement ? candidatNomOfficiel : candidatUai)
    || parDomaine
    || candidatNomOfficiel
    || index.parEmpreinteCanonique.get(empreinteNom(catalogue.nom))
    || index.parAlias.get(normaliser(catalogue.nom))
    || index.parEmpreinteAlias.get(empreinteNom(catalogue.nom))
    || null;
  let cree = false;
  const ville = [...catalogue.villes][0] || null;
  const siteWeb = [...catalogue.urls][0] || null;
  if (!candidat) {
    const type = /\buniversit[ée]\b/i.test(catalogue.nom)
      ? TypeEtablissement.UNIVERSITE
      : TypeEtablissement.ECOLE_SUPERIEURE;
    candidat = await prisma.etablissement.create({
      data: {
        id: `fr-esr-uai-${catalogue.uai.toLocaleLowerCase("fr")}`,
        nom: catalogue.nom,
        nomNormalise: normaliser(catalogue.nom),
        type,
        paysCode: "FR",
        systemeEducatifCode: "FR",
        ville,
        villeNormalisee: normaliser(ville || ""),
        statut: StatutEtablissement.INCONNU,
        siteWeb,
      },
      select: {
        id: true,
        nom: true,
        nomNormalise: true,
        ville: true,
        siteWeb: true,
        alias: { select: { nom: true } },
        sources: { select: { identifiantExterne: true } },
      },
    });
    cree = true;
  } else {
    candidat = await prisma.etablissement.update({
      where: { id: candidat.id },
      data: {
        systemeEducatifCode: "FR",
        ville: candidat.ville || ville,
        villeNormalisee: normaliser(candidat.ville || ville || ""),
        siteWeb: siteWeb || candidat.siteWeb,
        valide: true,
      },
      select: {
        id: true,
        nom: true,
        nomNormalise: true,
        ville: true,
        siteWeb: true,
        alias: { select: { nom: true } },
        sources: { select: { identifiantExterne: true } },
      },
    });
  }
  await prisma.etablissementNiveau.upsert({
    where: { etablissementId_niveau: { etablissementId: candidat.id, niveau: NiveauEducation.SUPERIEUR } },
    create: { etablissementId: candidat.id, niveau: NiveauEducation.SUPERIEUR },
    update: {},
  });
  await prisma.etablissementSource.upsert({
    where: { sourceId_identifiantExterne: { sourceId, identifiantExterne: catalogue.uai } },
    create: {
      etablissementId: candidat.id,
      sourceId,
      identifiantExterne: catalogue.uai,
      urlSource: urlCatalogue,
      confiance: 0.99,
      donneesBrutes: { nomOfficiel: catalogue.nom, villes: [...catalogue.villes], urls: [...catalogue.urls] },
    },
    update: {
      etablissementId: candidat.id,
      urlSource: urlCatalogue,
      confiance: 0.99,
      vuLe: new Date(),
      donneesBrutes: { nomOfficiel: catalogue.nom, villes: [...catalogue.villes], urls: [...catalogue.urls] },
    },
  });
  if (normaliser(catalogue.nom) !== candidat.nomNormalise) {
    await prisma.etablissementAlias.upsert({
      where: { etablissementId_nomNormalise: { etablissementId: candidat.id, nomNormalise: normaliser(catalogue.nom) } },
      create: { etablissementId: candidat.id, nom: catalogue.nom, nomNormalise: normaliser(catalogue.nom), langue: "fr" },
      update: { nom: catalogue.nom, langue: "fr" },
    });
  }
  if (ancienRattachement) {
    // L'ancienne fiche reste consultable pour les parcours historiques, mais
    // elle ne doit plus remonter via le nom officiel de son successeur.
    await prisma.etablissementAlias.deleteMany({
      where: {
        etablissementId: ancienRattachement.id,
        nomNormalise: normaliser(catalogue.nom),
      },
    });
  }
  index.parUai.set(catalogue.uai, candidat);
  ajouterIndexUnique(index.parNomCanonique, normaliser(catalogue.nom), candidat);
  ajouterIndexUnique(index.parEmpreinteCanonique, empreinteNom(catalogue.nom), candidat);
  for (const url of catalogue.urls) ajouterIndexUnique(index.parDomaine, domaine(url), candidat);
  return { etablissement: candidat, cree, ancienRattachementId: ancienRattachement?.id };
}

const fusionnerProgramme = (cible: Map<string, ProgrammeImporte>, programme: ProgrammeImporte) => {
  const existant = cible.get(programme.cle) || { ...programme, parcours: [] };
  for (const parcours of programme.parcours) {
    if (!existant.parcours.some((item) => normaliser(item) === normaliser(parcours))) {
      existant.parcours.push(parcours);
    }
  }
  cible.set(programme.cle, existant);
};

async function enregistrerParLots(
  etablissementId: string,
  sourceId: string,
  programmes: ProgrammeImporte[],
) {
  for (let index = 0; index < programmes.length; index += 6) {
    await Promise.all(
      programmes.slice(index, index + 6).map((programme) =>
        enregistrerProgramme(etablissementId, sourceId, programme)),
    );
  }
}

async function importerToutesLesUniversites(sourceId: string) {
  const catalogues = await lireCataloguesUniversites();
  const index = await preparerResolutionEtablissements();
  const rattachements = new Map<string, {
    nom: string;
    uais: Set<string>;
    programmes: Map<string, ProgrammeImporte>;
    anciensRattachements: Set<string>;
  }>();
  let etablissementsCrees = 0;
  for (const catalogue of catalogues) {
    const { etablissement, cree, ancienRattachementId } = await rattacherEtablissement(catalogue, sourceId, index);
    if (cree) etablissementsCrees += 1;
    const rattachement = rattachements.get(etablissement.id) || {
      nom: etablissement.nom,
      uais: new Set<string>(),
      programmes: new Map<string, ProgrammeImporte>(),
      anciensRattachements: new Set<string>(),
    };
    rattachement.uais.add(catalogue.uai);
    if (ancienRattachementId) rattachement.anciensRattachements.add(ancienRattachementId);
    for (const programme of canoniserProgrammes(catalogue.programmes.values(), etablissement.id)) {
      fusionnerProgramme(rattachement.programmes, programme);
    }
    rattachements.set(etablissement.id, rattachement);
  }

  let totalProgrammes = 0;
  let totalObsoletes = 0;
  let indexEtablissement = 0;
  for (const [etablissementId, rattachement] of rattachements) {
    const programmes = [...rattachement.programmes.values()];
    await enregistrerParLots(etablissementId, sourceId, programmes);
    totalProgrammes += programmes.length;
    totalObsoletes += await desactiverAnciennesOffres(
      etablissementId,
      sourceId,
      [...rattachement.uais, etablissementId],
      new Set(programmes.map(({ cle }) => identifiantExterneStable(cle))),
    );
    for (const ancienId of rattachement.anciensRattachements) {
      totalObsoletes += await desactiverAnciennesOffres(
        ancienId,
        sourceId,
        [ancienId],
        new Set(),
      );
    }
    indexEtablissement += 1;
    if (indexEtablissement % 10 === 0 || indexEtablissement === rattachements.size) {
      console.log(`Import formations France : ${indexEtablissement}/${rattachements.size} établissements`);
    }
  }
  return {
    uai: catalogues.length,
    etablissements: rattachements.size,
    etablissementsCrees,
    programmes: totalProgrammes,
    obsoletes: totalObsoletes,
  };
}

async function importer() {
  const toutesLesUniversites = process.argv.includes("--all-universities");
  const argument = process.argv.find((item) => item.startsWith("--institution="));
  const source = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "esr-fr" } });
  const importation = await prisma.importEducation.create({ data: { sourceId: source.id, paysCode: "FR" } });
  if (toutesLesUniversites) {
    try {
      const resultat = await importerToutesLesUniversites(source.id);
      await prisma.importEducation.update({
        where: { id: importation.id },
        data: {
          statut: StatutImportEducation.TERMINE,
          ajoutes: resultat.programmes,
          termineLe: new Date(),
          detail: { ...resultat, sessionMonMaster: SESSION_MON_MASTER, anneeParcoursup: ANNEE_PARCOURSUP },
        },
      });
      console.log(JSON.stringify(resultat, null, 2));
      return;
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

  const etablissementId = argument?.split("=")[1] || "fr-universite-paris-cite";
  const etablissement = await prisma.etablissement.findUniqueOrThrow({
    where: { id: etablissementId },
    include: { sources: { where: { sourceId: source.id } } },
  });
  const uai = etablissement.sources.find(({ identifiantExterne }) => /^[0-9]{7}[A-Z]$/.test(identifiantExterne))?.identifiantExterne;
  if (!uai) throw new Error(`Aucun UAI officiel trouvé pour ${etablissement.nom}.`);

  try {
    const programmes = canoniserProgrammes(await lireProgrammes(uai), etablissement.id);
    await enregistrerParLots(etablissement.id, source.id, programmes);
    const obsoletes = await desactiverAnciennesOffres(
      etablissement.id,
      source.id,
      [uai, etablissement.id],
      new Set(programmes.map(({ cle }) => identifiantExterneStable(cle))),
    );
    await prisma.importEducation.update({
      where: { id: importation.id },
      data: {
        statut: StatutImportEducation.TERMINE,
        ajoutes: programmes.length,
        termineLe: new Date(),
        detail: { etablissementId, uai, programmes: programmes.length, obsoletes, sessionMonMaster: SESSION_MON_MASTER, anneeParcoursup: ANNEE_PARCOURSUP },
      },
    });
    console.log(JSON.stringify({ etablissement: etablissement.nom, uai, programmes: programmes.length, obsoletes }, null, 2));
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

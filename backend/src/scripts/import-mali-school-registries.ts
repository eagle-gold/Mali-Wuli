import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import {
  NiveauEducation,
  Prisma,
  PrismaClient,
  StatutEtablissement,
  StatutImportEducation,
  TypeEtablissement,
} from "@prisma/client";
import { SOURCES_EDUCATIVES } from "../education/catalog-data";
import {
  type AdministrationEcoleMali,
  type CampusRegistreEcoleMali,
  type CoordonneesEcoleMali,
  type LigneRegistreEcoleMali,
  type SourceRegistreMali,
  distanceMetres,
  lireCoordonneesMali,
  normaliserCodeOfficielMali,
  normaliserNomCampusMali,
  normaliserNomRapprochementMali,
  normaliserTexteEcoleMali,
  regrouperCampusRegistreMali,
  signatureAdministrationMali,
  signatureBrancheEcoleMali,
  signatureHierarchieMali,
  typesScolairesCompatibles,
} from "../education/mali-school-registries";

const prisma = new PrismaClient();
const APPLIQUER = process.argv.includes("--apply");
const SELECTION_SOURCE = process.argv.find((argument) => argument.startsWith("--source="))?.split("=")[1] || "all";
const TAILLE_LOT = 600;

const REGISTRES: Record<SourceRegistreMali, {
  page: string;
  fichier: string;
  confiance: number;
}> = {
  "ocha-men-mali-schools-2023": {
    page: "https://data.humdata.org/dataset/mali-schools",
    fichier: "https://data.humdata.org/dataset/52ba0caf-1caf-4e40-a0c4-7c9d17454f15/resource/c85aa3d0-b42b-47cf-b51c-0c4a2c1bcdca/download/ml_schools_octobre_2023.xlsx",
    confiance: 0.97,
  },
  "unicef-men-mali-schools-2013": {
    page: "https://github.com/jokkolabs/mali_schools",
    fichier: "https://raw.githubusercontent.com/jokkolabs/mali_schools/master/MLI_schools.csv",
    confiance: 0.94,
  },
};

type StatistiquesSource = {
  lignesRecues: number;
  lignesIgnorees: number;
  campus: number;
  nouveaux: number;
  rattaches: number;
  ambigus: number;
  correspondances: Record<ResultatCorrespondance["raison"], number>;
};

export type CandidatIndex = AdministrationEcoleMali & CoordonneesEcoleMali & {
  id: string;
  nouveau: boolean;
  nom: string;
  ville: string | null;
  nomsExacts: Set<string>;
  nomsRapproches: Set<string>;
  type: TypeEtablissement;
  statut: StatutEtablissement;
  villeNormalisee: string;
  signaturesAdministration: Set<string>;
  signaturesHierarchie: Set<string>;
  signaturesBranche: Set<string>;
  codesOfficiels: Set<string>;
  codesCluster: Set<string>;
  referencesSource: Set<string>;
};

export type IndexExistants = {
  candidats: Map<string, CandidatIndex>;
  parNomExact: Map<string, Set<string>>;
  parNomRapproche: Map<string, Set<string>>;
  parCodeOfficiel: Map<string, Set<string>>;
  parReference: Map<string, Set<string>>;
};

type CampusPlanifie = {
  id: string;
  nouveau: boolean;
  nom: string;
  nomNormalise: string;
  type: TypeEtablissement;
  statut: StatutEtablissement;
  ville: string | null;
  villeNormalisee: string;
  latitude: number | null;
  longitude: number | null;
  niveaux: Set<NiveauEducation>;
  aliases: Map<string, string>;
  campus: CampusRegistreEcoleMali[];
};

export type ResultatCorrespondance = {
  id: string | null;
  raison: "reference" | "code-officiel" | "nom-admin" | "nom-coordonnees" | "nom-relache-admin" | "nom-relache-admin-coordonnees" | "nouveau" | "ambigu";
  candidats?: string[];
};

const statistiquesVides = (): StatistiquesSource => ({
  lignesRecues: 0,
  lignesIgnorees: 0,
  campus: 0,
  nouveaux: 0,
  rattaches: 0,
  ambigus: 0,
  correspondances: {
    reference: 0,
    "code-officiel": 0,
    "nom-admin": 0,
    "nom-coordonnees": 0,
    "nom-relache-admin": 0,
    "nom-relache-admin-coordonnees": 0,
    nouveau: 0,
    ambigu: 0,
  },
});

const hachage = (valeur: string) => createHash("sha1").update(valeur).digest("hex").slice(0, 24);
const codeScolaireNumerique = (valeur: unknown) => {
  const code = normaliserCodeOfficielMali(valeur);
  return code && /^\d{5,12}$/.test(code) ? code : null;
};
const valeurTexte = (valeur: unknown) => {
  if (valeur === null || valeur === undefined) return null;
  if (typeof valeur === "object" && "result" in valeur && (valeur as { result?: unknown }).result !== undefined) {
    return valeurTexte((valeur as { result: unknown }).result);
  }
  const texte = String(valeur).trim().replace(/\s+/g, " ");
  return texte || null;
};

const ajouterMapSet = (map: Map<string, Set<string>>, cle: string, id: string) => {
  if (!cle) return;
  const valeurs = map.get(cle);
  if (valeurs) valeurs.add(id);
  else map.set(cle, new Set([id]));
};

const decouper = <T>(elements: T[], taille = TAILLE_LOT) => {
  const lots: T[][] = [];
  for (let index = 0; index < elements.length; index += taille) lots.push(elements.slice(index, index + taille));
  return lots;
};

async function telecharger(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "MaliWuli-Education-Catalog/1.0" } });
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}) : ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

const identifiant2023 = (params: {
  codeCluster: string | null;
  codeCps: string | null;
  cycle: string | null;
  nom: string;
  administration: AdministrationEcoleMali;
}) => {
  const stable = [
    params.codeCluster,
    params.codeCps,
    params.cycle,
    normaliserTexteEcoleMali(params.nom),
    signatureAdministrationMali(params.administration),
  ].filter(Boolean).join("|");
  return `men-2023:${params.codeCluster || params.codeCps || hachage(stable)}:${hachage(stable).slice(0, 10)}`;
};

async function lireRegistre2023(statistiques: StatistiquesSource) {
  const contenu = await telecharger(REGISTRES["ocha-men-mali-schools-2023"].fichier);
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(contenu as unknown as Parameters<typeof classeur.xlsx.load>[0]);
  const feuille = classeur.getWorksheet("BDD");
  if (!feuille) throw new Error("La feuille BDD du registre 2023 est absente.");
  const lignes: LigneRegistreEcoleMali[] = [];
  for (let numero = 4; numero <= feuille.rowCount; numero += 1) {
    const ligne = feuille.getRow(numero);
    statistiques.lignesRecues += 1;
    const nom = valeurTexte(ligne.getCell(9).value);
    if (!nom) {
      statistiques.lignesIgnorees += 1;
      continue;
    }
    const region = valeurTexte(ligne.getCell(3).value);
    const cercle = valeurTexte(ligne.getCell(5).value);
    const commune = valeurTexte(ligne.getCell(7).value);
    const cap = valeurTexte(ligne.getCell(2).value);
    // Le CAP est une circonscription éducative, pas une localité. Il reste dans
    // la provenance brute mais n'est jamais utilisé comme ville ou localité.
    const administration: AdministrationEcoleMali = { region, cercle, commune, localite: null };
    const codeCps = codeScolaireNumerique(ligne.getCell(10).value);
    const codeCluster = normaliserCodeOfficielMali(ligne.getCell(11).value);
    const cycle = valeurTexte(ligne.getCell(12).value);
    const coordonnees = lireCoordonneesMali(ligne.getCell(15).value, ligne.getCell(16).value);
    lignes.push({
      sourceCode: "ocha-men-mali-schools-2023",
      identifiantExterne: identifiant2023({ codeCluster, codeCps, cycle, nom, administration }),
      nom,
      cycle,
      statutBrut: valeurTexte(ligne.getCell(14).value),
      typeEnseignement: valeurTexte(ligne.getCell(13).value),
      codesOfficiels: codeCps ? [codeCps] : [],
      codesCluster: codeCluster ? [codeCluster] : [],
      ...administration,
      ...coordonnees,
      donneesBrutes: {
        registre: "Ministère de l'Éducation du Mali — octobre 2023",
        ligne: numero,
        ae: valeurTexte(ligne.getCell(1).value),
        cap,
        region,
        codeRegion: normaliserCodeOfficielMali(ligne.getCell(4).value),
        cercle,
        codeCercle: normaliserCodeOfficielMali(ligne.getCell(6).value),
        commune,
        codeCommune: normaliserCodeOfficielMali(ligne.getCell(8).value),
        codeCps,
        codeCluster,
        cycle,
        typeEnseignement: valeurTexte(ligne.getCell(13).value),
        statut: valeurTexte(ligne.getCell(14).value),
        longitude: coordonnees.longitude,
        latitude: coordonnees.latitude,
        fonctionnalite: valeurTexte(ligne.getCell(35).value),
      },
    });
  }
  return lignes;
}

type LigneCsv2013 = Record<string, string | undefined>;

async function lireRegistre2013(statistiques: StatistiquesSource) {
  const contenu = await telecharger(REGISTRES["unicef-men-mali-schools-2013"].fichier);
  const enregistrements = parse(contenu, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as LigneCsv2013[];
  const lignes: LigneRegistreEcoleMali[] = [];
  for (const [index, ligne] of enregistrements.entries()) {
    statistiques.lignesRecues += 1;
    const nom = valeurTexte(ligne.NOM_ETABLISSEMENT);
    if (!nom) {
      statistiques.lignesIgnorees += 1;
      continue;
    }
    const region = valeurTexte(ligne["Région"]);
    const cercle = valeurTexte(ligne.Cercle);
    const commune = valeurTexte(ligne.Commune);
    const localite = valeurTexte(ligne.Localites);
    const codeEtablissement = codeScolaireNumerique(ligne.CODE_ETABLISSEMENT);
    const administration: AdministrationEcoleMali = { region, cercle, commune, localite };
    const cycle = valeurTexte(ligne.CYCLE);
    const coordonnees = lireCoordonneesMali(ligne.X, ligne.Y);
    const fallback = hachage(`${normaliserTexteEcoleMali(nom)}|${signatureAdministrationMali(administration)}|${cycle || ""}`);
    lignes.push({
      sourceCode: "unicef-men-mali-schools-2013",
      identifiantExterne: `men-2013:${codeEtablissement || fallback}`,
      nom,
      cycle,
      statutBrut: valeurTexte(ligne.STATUT),
      typeEnseignement: null,
      codesOfficiels: codeEtablissement ? [codeEtablissement] : [],
      codesCluster: [],
      ...administration,
      ...coordonnees,
      donneesBrutes: {
        registre: "UNICEF et Ministère de l'Éducation du Mali — 2013",
        ligne: index + 2,
        region,
        ae: valeurTexte(ligne.AE),
        cap: valeurTexte(ligne.CAP),
        cercle,
        commune,
        localite,
        codeEtablissement,
        localisation: valeurTexte(ligne.Localisation),
        cycle,
        statut: valeurTexte(ligne.STATUT),
        longitude: coordonnees.longitude,
        latitude: coordonnees.latitude,
      },
    });
  }
  return lignes;
}

const objetJson = (valeur: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null => (
  valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? valeur as Record<string, Prisma.JsonValue>
    : null
);

const lireAdministrationBrute = (valeur: Prisma.JsonValue | null): AdministrationEcoleMali | null => {
  const objet = objetJson(valeur);
  if (!objet) return null;
  const administration = objetJson(objet.administration || null) || objet;
  const texte = (cle: string) => typeof administration[cle] === "string" ? administration[cle] as string : null;
  const resultat = {
    region: texte("region"),
    cercle: texte("cercle"),
    commune: texte("commune"),
    localite: texte("localite"),
  };
  return Object.values(resultat).some(Boolean) ? resultat : null;
};

const lireCodesBruts = (valeur: Prisma.JsonValue | null) => {
  const objet = objetJson(valeur);
  if (!objet) return [];
  const candidats: unknown[] = [objet.codeCps, objet.codeEtablissement, objet.codeOfficiel];
  if (Array.isArray(objet.codesOfficiels)) candidats.push(...objet.codesOfficiels);
  return candidats.map(normaliserCodeOfficielMali).filter((code): code is string => Boolean(code));
};

const lireCodesClusterBruts = (valeur: Prisma.JsonValue | null) => {
  const objet = objetJson(valeur);
  if (!objet) return [];
  const candidats: unknown[] = [objet.codeCluster];
  if (Array.isArray(objet.codesCluster)) candidats.push(...objet.codesCluster);
  return candidats.map(normaliserCodeOfficielMali).filter((code): code is string => Boolean(code));
};

export const indexVide = (): IndexExistants => ({
  candidats: new Map(),
  parNomExact: new Map(),
  parNomRapproche: new Map(),
  parCodeOfficiel: new Map(),
  parReference: new Map(),
});

export const ajouterCandidatIndex = (index: IndexExistants, candidat: CandidatIndex) => {
  index.candidats.set(candidat.id, candidat);
  for (const nom of candidat.nomsExacts) ajouterMapSet(index.parNomExact, nom, candidat.id);
  for (const nom of candidat.nomsRapproches) ajouterMapSet(index.parNomRapproche, nom, candidat.id);
  for (const code of candidat.codesOfficiels) ajouterMapSet(index.parCodeOfficiel, code, candidat.id);
  for (const reference of candidat.referencesSource) ajouterMapSet(index.parReference, reference, candidat.id);
};

async function chargerIndexExistants() {
  const index = indexVide();
  const etablissements = await prisma.etablissement.findMany({
    where: { paysCode: "ML", valide: true },
    include: {
      alias: { select: { nom: true } },
      sources: { include: { source: { select: { code: true } } } },
    },
  });
  for (const etablissement of etablissements) {
    const noms = [etablissement.nom, ...etablissement.alias.map(({ nom }) => nom)];
    const administrations = etablissement.sources
      .map(({ donneesBrutes }) => lireAdministrationBrute(donneesBrutes))
      .filter((administration): administration is AdministrationEcoleMali => Boolean(administration));
    ajouterCandidatIndex(index, {
      id: etablissement.id,
      nouveau: false,
      nom: etablissement.nom,
      ville: etablissement.ville,
      nomsExacts: new Set(noms.map(normaliserNomCampusMali).filter(Boolean)),
      nomsRapproches: new Set(noms.map(normaliserNomRapprochementMali).filter(Boolean)),
      type: etablissement.type,
      statut: etablissement.statut,
      villeNormalisee: etablissement.villeNormalisee,
      latitude: etablissement.latitude ? Number(etablissement.latitude) : null,
      longitude: etablissement.longitude ? Number(etablissement.longitude) : null,
      region: null,
      cercle: null,
      commune: null,
      localite: null,
      signaturesAdministration: new Set(administrations.map(signatureAdministrationMali)),
      signaturesHierarchie: new Set(administrations.map(signatureHierarchieMali)),
      signaturesBranche: new Set(noms.map(signatureBrancheEcoleMali).filter(Boolean)),
      codesOfficiels: new Set(etablissement.sources.flatMap(({ donneesBrutes }) => lireCodesBruts(donneesBrutes))),
      codesCluster: new Set(etablissement.sources.flatMap(({ donneesBrutes }) => lireCodesClusterBruts(donneesBrutes))),
      referencesSource: new Set(etablissement.sources.map(({ source, identifiantExterne }) => `${source.code}:${identifiantExterne}`)),
    });
  }
  return index;
}

const idsPourCles = (map: Map<string, Set<string>>, cles: Iterable<string>) => {
  const ids = new Set<string>();
  for (const cle of cles) for (const id of map.get(cle) || []) ids.add(id);
  return ids;
};

const filtrerCompatibles = (index: IndexExistants, ids: Iterable<string>, campus: CampusRegistreEcoleMali) => (
  [...ids].filter((id) => {
    const candidat = index.candidats.get(id);
    return candidat && typesScolairesCompatibles(candidat.type, campus.type);
  })
);

const resultatUnique = (ids: string[], raison: ResultatCorrespondance["raison"]): ResultatCorrespondance | null => {
  if (ids.length === 1) return { id: ids[0], raison };
  if (ids.length > 1) return { id: null, raison: "ambigu", candidats: ids };
  return null;
};

const signatureRenseignee = (signature: string) => signature.replace(/\|/g, "").length > 0;

const administrationsCompatibles = (candidat: CandidatIndex, campus: CampusRegistreEcoleMali) => {
  const signatureAdmin = signatureAdministrationMali(campus);
  const signatureHierarchie = signatureHierarchieMali(campus);
  if (!signatureRenseignee(signatureHierarchie)) return false;
  if (candidat.signaturesAdministration.has(signatureAdmin)) return true;
  if (!candidat.signaturesHierarchie.has(signatureHierarchie)) return false;

  // Deux localités explicitement différentes dans la même commune restent des
  // sites distincts. En revanche, une localité absente dans l'un des registres
  // n'est pas une contradiction administrative.
  const localiteCampus = signatureAdmin.split("|")[3] || "";
  return [...candidat.signaturesAdministration]
    .filter((signature) => signature.split("|").slice(0, 3).join("|") === signatureHierarchie)
    .some((signature) => {
      const localiteCandidate = signature.split("|")[3] || "";
      return !localiteCampus || !localiteCandidate || localiteCampus === localiteCandidate;
    });
};

const branchesCompatibles = (candidat: CandidatIndex, campus: CampusRegistreEcoleMali) => {
  const brancheCampus = signatureBrancheEcoleMali(campus.nom);
  return !brancheCampus || candidat.signaturesBranche.size === 0 || candidat.signaturesBranche.has(brancheCampus);
};

const nomsCompatibles = (candidat: CandidatIndex, campus: CampusRegistreEcoleMali) => (
  candidat.nomsExacts.has(campus.nomCampusNormalise)
  || candidat.nomsRapproches.has(campus.nomRapprochement)
);

const localisationCompatible = (candidat: CandidatIndex, campus: CampusRegistreEcoleMali, rayon = 300) => {
  if (administrationsCompatibles(candidat, campus)) return true;
  const distance = distanceMetres(candidat, campus);
  return distance !== null && distance <= rayon;
};

export function trouverCorrespondance(index: IndexExistants, campus: CampusRegistreEcoleMali): ResultatCorrespondance {
  const references = campus.lignes.map(({ sourceCode, identifiantExterne }) => `${sourceCode}:${identifiantExterne}`);
  const parReference = filtrerCompatibles(index, idsPourCles(index.parReference, references), campus);
  const reference = resultatUnique(parReference, "reference");
  if (reference) return reference;

  const parCode = filtrerCompatibles(index, idsPourCles(index.parCodeOfficiel, campus.codesOfficiels), campus);
  if (parCode.length > 1) return { id: null, raison: "ambigu", candidats: parCode };
  if (parCode.length === 1) {
    const candidat = index.candidats.get(parCode[0])!;
    if (
      nomsCompatibles(candidat, campus)
      && branchesCompatibles(candidat, campus)
      && localisationCompatible(candidat, campus)
    ) {
      return { id: candidat.id, raison: "code-officiel" };
    }
    // Un code réutilisé pour une autre école ne doit jamais devenir une preuve
    // de fusion, ni être contourné ensuite par un rapprochement plus faible.
    return { id: null, raison: "ambigu", candidats: [candidat.id] };
  }

  const candidatsNom = filtrerCompatibles(index, index.parNomExact.get(campus.nomCampusNormalise) || [], campus);
  // Un groupe déjà planifié depuis la même source peut être une autre branche
  // homonyme. Les rapprochements par nom/admin ci-dessous sont donc réservés
  // aux autres sources (ou aux données déjà présentes sans cette provenance).
  const candidatsNomAutreSource = candidatsNom.filter((id) => (
    ![...index.candidats.get(id)!.referencesSource].some((reference) => reference.startsWith(`${campus.sourceCode}:`))
  )).filter((id) => branchesCompatibles(index.candidats.get(id)!, campus));
  const memeAdministration = candidatsNomAutreSource.filter((id) => administrationsCompatibles(index.candidats.get(id)!, campus));
  if (memeAdministration.length === 1) return { id: memeAdministration[0], raison: "nom-admin" };
  if (memeAdministration.length > 1) {
    // Plusieurs campus homonymes peuvent exister dans la même commune. Des
    // coordonnées officielles ne servent qu'à départager ce groupe déjà
    // confirmé par le nom, la branche et l'administration.
    const prochesAdministration = memeAdministration.filter((id) => {
      const candidat = index.candidats.get(id)!;
      const distance = distanceMetres(candidat, campus);
      return distance !== null && distance <= 200;
    });
    if (prochesAdministration.length === 1) {
      return { id: prochesAdministration[0], raison: "nom-coordonnees" };
    }
    return { id: null, raison: "ambigu", candidats: memeAdministration };
  }

  const proches = candidatsNomAutreSource.filter((id) => {
    const candidat = index.candidats.get(id)!;
    const distance = distanceMetres(candidat, campus);
    return distance !== null && distance <= 200;
  });
  const coordonnees = resultatUnique(proches, "nom-coordonnees");
  if (coordonnees) return coordonnees;

  const candidatsRelachesTous = filtrerCompatibles(index, index.parNomRapproche.get(campus.nomRapprochement) || [], campus)
    .filter((id) => branchesCompatibles(index.candidats.get(id)!, campus));
  const candidatsRelachesProches = candidatsRelachesTous
    .filter((id) => {
      const candidat = index.candidats.get(id)!;
      if (!administrationsCompatibles(candidat, campus)) return false;
      const distance = distanceMetres(candidat, campus);
      return distance !== null && distance <= 200;
    });
  const relacheProche = resultatUnique(candidatsRelachesProches, "nom-relache-admin-coordonnees");
  if (relacheProche) return relacheProche;

  const brancheCampus = signatureBrancheEcoleMali(campus.nom);
  const candidatsRelachesSansCoordonnees = candidatsRelachesTous.filter((id) => {
    const candidat = index.candidats.get(id)!;
    if (brancheCampus || candidat.signaturesBranche.size > 0) return false;
    if (candidat.nomsExacts.has(campus.nomCampusNormalise)) return false;
    if (!administrationsCompatibles(candidat, campus)) return false;
    return distanceMetres(candidat, campus) === null;
  });
  const relacheAdmin = resultatUnique(candidatsRelachesSansCoordonnees, "nom-relache-admin");
  if (relacheAdmin) return relacheAdmin;

  return { id: null, raison: "nouveau" };
}

const fusionnerCampusPlanifie = (planifie: CampusPlanifie, campus: CampusRegistreEcoleMali) => {
  planifie.campus.push(campus);
  for (const niveau of campus.niveaux) planifie.niveaux.add(niveau);
  for (const alias of [campus.nom, ...campus.aliases]) {
    const normalise = normaliserTexteEcoleMali(alias);
    if (normalise && normalise !== planifie.nomNormalise) planifie.aliases.set(normalise, alias);
  }
  if (!planifie.ville && campus.ville) {
    planifie.ville = campus.ville;
    planifie.villeNormalisee = campus.villeNormalisee;
  }
  if (planifie.latitude === null && campus.latitude !== null) planifie.latitude = campus.latitude;
  if (planifie.longitude === null && campus.longitude !== null) planifie.longitude = campus.longitude;
  if (planifie.statut === StatutEtablissement.INCONNU && campus.statut !== StatutEtablissement.INCONNU) {
    planifie.statut = campus.statut;
  }
};

const enrichirCandidat = (index: IndexExistants, candidat: CandidatIndex, campus: CampusRegistreEcoleMali) => {
  candidat.nomsExacts.add(campus.nomCampusNormalise);
  candidat.nomsRapproches.add(campus.nomRapprochement);
  candidat.signaturesAdministration.add(signatureAdministrationMali(campus));
  candidat.signaturesHierarchie.add(signatureHierarchieMali(campus));
  const signatureBranche = signatureBrancheEcoleMali(campus.nom);
  if (signatureBranche) candidat.signaturesBranche.add(signatureBranche);
  for (const code of campus.codesOfficiels) {
    candidat.codesOfficiels.add(code);
    ajouterMapSet(index.parCodeOfficiel, code, candidat.id);
  }
  for (const code of campus.codesCluster) candidat.codesCluster.add(code);
  for (const ligne of campus.lignes) {
    const reference = `${ligne.sourceCode}:${ligne.identifiantExterne}`;
    candidat.referencesSource.add(reference);
    ajouterMapSet(index.parReference, reference, candidat.id);
  }
  ajouterMapSet(index.parNomExact, campus.nomCampusNormalise, candidat.id);
  ajouterMapSet(index.parNomRapproche, campus.nomRapprochement, candidat.id);
};

function planifier(
  index: IndexExistants,
  campusParSource: Map<SourceRegistreMali, CampusRegistreEcoleMali[]>,
  statistiques: Map<SourceRegistreMali, StatistiquesSource>,
) {
  const plan = new Map<string, CampusPlanifie>();
  const ambigus: Array<{ source: SourceRegistreMali; nom: string; administration: string; candidats: string[] }> = [];
  // Le registre officiel récent passe en premier. Le registre UNICEF complète les
  // régions absentes et se rattache par code officiel lorsqu'il recoupe 2023.
  const ordre: SourceRegistreMali[] = ["ocha-men-mali-schools-2023", "unicef-men-mali-schools-2013"];
  for (const sourceCode of ordre) {
    for (const campus of campusParSource.get(sourceCode) || []) {
      const resultat = trouverCorrespondance(index, campus);
      statistiques.get(sourceCode)!.correspondances[resultat.raison] += 1;
      if (resultat.raison === "ambigu") {
        statistiques.get(sourceCode)!.ambigus += 1;
        ambigus.push({
          source: sourceCode,
          nom: campus.nom,
          administration: signatureAdministrationMali(campus),
          candidats: resultat.candidats || [],
        });
        continue;
      }
      const id = resultat.id || `ml-registre-${hachage(campus.cle)}`;
      const candidatExistant = index.candidats.get(id);
      const nouveau = !candidatExistant;
      if (nouveau) statistiques.get(sourceCode)!.nouveaux += 1;
      else statistiques.get(sourceCode)!.rattaches += 1;
      let planifie = plan.get(id);
      if (!planifie) {
        planifie = {
          id,
          nouveau,
          nom: candidatExistant?.nom || campus.nom,
          nomNormalise: normaliserTexteEcoleMali(candidatExistant?.nom || campus.nom),
          type: candidatExistant?.type || campus.type,
          statut: candidatExistant?.statut || campus.statut,
          ville: candidatExistant?.ville || campus.ville,
          villeNormalisee: candidatExistant?.villeNormalisee || campus.villeNormalisee,
          latitude: candidatExistant?.latitude ?? campus.latitude,
          longitude: candidatExistant?.longitude ?? campus.longitude,
          niveaux: new Set(),
          aliases: new Map(),
          campus: [],
        };
        plan.set(id, planifie);
      }
      fusionnerCampusPlanifie(planifie, campus);
      const candidat = candidatExistant || {
        id,
        nouveau: true,
        nom: campus.nom,
        ville: campus.ville,
        nomsExacts: new Set<string>(),
        nomsRapproches: new Set<string>(),
        type: campus.type,
        statut: campus.statut,
        villeNormalisee: campus.villeNormalisee,
        latitude: campus.latitude,
        longitude: campus.longitude,
        region: campus.region,
        cercle: campus.cercle,
        commune: campus.commune,
        localite: campus.localite,
        signaturesAdministration: new Set<string>(),
        signaturesHierarchie: new Set<string>(),
        signaturesBranche: new Set<string>(),
        codesOfficiels: new Set<string>(),
        codesCluster: new Set<string>(),
        referencesSource: new Set<string>(),
      };
      if (!candidatExistant) ajouterCandidatIndex(index, candidat);
      enrichirCandidat(index, candidat, campus);
    }
  }
  return { plan: [...plan.values()], ambigus };
}

async function garantirSources(codes: SourceRegistreMali[]) {
  const definitions = SOURCES_EDUCATIVES.filter(({ code }) => codes.includes(code as SourceRegistreMali));
  if (definitions.length !== codes.length) throw new Error("Définition de provenance manquante dans catalog-data.ts.");
  for (const source of definitions) {
    await prisma.sourceEducative.upsert({ where: { code: source.code }, create: source, update: source });
  }
  return new Map((await prisma.sourceEducative.findMany({ where: { code: { in: codes } } })).map((source) => [source.code as SourceRegistreMali, source]));
}

async function appliquerPlan(
  plan: CampusPlanifie[],
  sources: Awaited<ReturnType<typeof garantirSources>>,
) {
  const nouveaux = plan.filter(({ nouveau }) => nouveau);
  for (const lot of decouper(nouveaux)) {
    await prisma.etablissement.createMany({
      data: lot.map((item) => ({
        id: item.id,
        nom: item.nom,
        nomNormalise: item.nomNormalise,
        type: item.type,
        paysCode: "ML",
        systemeEducatifCode: "ML",
        ville: item.ville,
        villeNormalisee: item.villeNormalisee,
        statut: item.statut,
        latitude: item.latitude,
        longitude: item.longitude,
        valide: true,
      })),
      skipDuplicates: true,
    });
  }

  // Les établissements déjà connus ne sont enrichis que par les champs qui
  // étaient absents ou INCONNU : les valeurs existantes ont été conservées
  // dans le plan et ne sont donc jamais écrasées par le registre.
  const existants = plan.filter(({ nouveau }) => !nouveau);
  for (const lot of decouper(existants, 250)) {
    await prisma.$transaction(lot.map((item) => prisma.etablissement.update({
      where: { id: item.id },
      data: {
        ville: item.ville,
        villeNormalisee: item.villeNormalisee,
        latitude: item.latitude,
        longitude: item.longitude,
        statut: item.statut,
      },
    })));
  }

  const niveaux = plan.flatMap((item) => [...item.niveaux].map((niveau) => ({ etablissementId: item.id, niveau })));
  for (const lot of decouper(niveaux, 1_500)) await prisma.etablissementNiveau.createMany({ data: lot, skipDuplicates: true });

  const aliases = plan.flatMap((item) => [...item.aliases].map(([nomNormalise, nom]) => ({
    etablissementId: item.id,
    nom,
    nomNormalise,
  })));
  for (const lot of decouper(aliases, 1_000)) await prisma.etablissementAlias.createMany({ data: lot, skipDuplicates: true });

  const references = plan.flatMap((item) => item.campus.flatMap((campus) => campus.lignes.map((ligne) => {
    const source = sources.get(ligne.sourceCode)!;
    return {
      id: `source-registre-${hachage(`${ligne.sourceCode}:${ligne.identifiantExterne}`)}`,
      etablissementId: item.id,
      sourceId: source.id,
      identifiantExterne: ligne.identifiantExterne,
      urlSource: REGISTRES[ligne.sourceCode].fichier,
      confiance: REGISTRES[ligne.sourceCode].confiance,
      donneesBrutes: {
        ...ligne.donneesBrutes,
        administration: {
          region: ligne.region,
          cercle: ligne.cercle,
          commune: ligne.commune,
          localite: ligne.localite,
        },
        codesOfficiels: ligne.codesOfficiels,
        codesCluster: ligne.codesCluster,
      } as Prisma.InputJsonValue,
    };
  })));
  for (const lot of decouper(references, 250)) {
    const vuLe = new Date();
    await prisma.$transaction(lot.map((reference) => prisma.etablissementSource.upsert({
      where: {
        sourceId_identifiantExterne: {
          sourceId: reference.sourceId,
          identifiantExterne: reference.identifiantExterne,
        },
      },
      create: { ...reference, vuLe },
      update: {
        etablissementId: reference.etablissementId,
        urlSource: reference.urlSource,
        confiance: reference.confiance,
        donneesBrutes: reference.donneesBrutes,
        vuLe,
      },
    })));
  }
}

type ImportationsEnCours = Map<SourceRegistreMali, string>;

async function demarrerImportations(
  sources: Awaited<ReturnType<typeof garantirSources>>,
): Promise<ImportationsEnCours> {
  const importations = new Map<SourceRegistreMali, string>();
  for (const [sourceCode, source] of sources) {
    const importation = await prisma.importEducation.create({
      data: {
        sourceId: source.id,
        paysCode: "ML",
        statut: StatutImportEducation.EN_COURS,
        detail: {
          fichier: REGISTRES[sourceCode].fichier,
          page: REGISTRES[sourceCode].page,
        },
      },
      select: { id: true },
    });
    importations.set(sourceCode, importation.id);
  }
  return importations;
}

async function terminerImportations(
  importations: ImportationsEnCours,
  statistiques: Map<SourceRegistreMali, StatistiquesSource>,
) {
  for (const [sourceCode, id] of importations) {
    const stats = statistiques.get(sourceCode)!;
    await prisma.importEducation.update({
      where: { id },
      data: {
        statut: stats.ambigus ? StatutImportEducation.PARTIEL : StatutImportEducation.TERMINE,
        ajoutes: stats.nouveaux,
        modifies: stats.rattaches,
        ignores: stats.lignesIgnorees + stats.ambigus,
        erreurs: 0,
        termineLe: new Date(),
        detail: {
          lignesRecues: stats.lignesRecues,
          campusConsolides: stats.campus,
          ambigusNonImportes: stats.ambigus,
          fichier: REGISTRES[sourceCode].fichier,
          page: REGISTRES[sourceCode].page,
          regle: "Identifiant de source, puis code officiel unique et cohérent ; sinon nom + administration ou proximité. Aucun rapprochement par nom seul.",
        },
      },
    });
  }
}

async function echouerImportations(importations: ImportationsEnCours, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  for (const [, id] of importations) {
    await prisma.importEducation.update({
      where: { id },
      data: {
        statut: StatutImportEducation.ECHEC,
        erreurs: 1,
        termineLe: new Date(),
        detail: { erreur: message },
      },
    });
  }
}

async function importer() {
  if (!Object.keys(REGISTRES).includes(SELECTION_SOURCE) && SELECTION_SOURCE !== "all") {
    throw new Error("--source doit valoir all, ocha-men-mali-schools-2023 ou unicef-men-mali-schools-2013");
  }
  const sourcesChoisies = (Object.keys(REGISTRES) as SourceRegistreMali[])
    .filter((source) => SELECTION_SOURCE === "all" || source === SELECTION_SOURCE);
  const statistiques = new Map<SourceRegistreMali, StatistiquesSource>(sourcesChoisies.map((source) => [source, statistiquesVides()]));
  const sources = APPLIQUER ? await garantirSources(sourcesChoisies) : null;
  const importations = sources ? await demarrerImportations(sources) : new Map<SourceRegistreMali, string>();
  try {
    const campusParSource = new Map<SourceRegistreMali, CampusRegistreEcoleMali[]>();
    for (const source of sourcesChoisies) {
      const stats = statistiques.get(source)!;
      const lignes = source === "ocha-men-mali-schools-2023"
        ? await lireRegistre2023(stats)
        : await lireRegistre2013(stats);
      const campus = regrouperCampusRegistreMali(lignes);
      stats.campus = campus.length;
      campusParSource.set(source, campus);
    }

    const index = await chargerIndexExistants();
    const { plan, ambigus } = planifier(index, campusParSource, statistiques);
    if (sources) {
      await appliquerPlan(plan, sources);
      await terminerImportations(importations, statistiques);
    }
    const rapport = {
      mode: APPLIQUER ? "apply" : "dry-run",
      sources: Object.fromEntries(statistiques),
      etablissementsPlanifies: plan.length,
      etablissementsCrees: plan.filter(({ nouveau }) => nouveau).length,
      exemplesNouveaux: plan
        .filter(({ nouveau }) => nouveau)
        .slice(0, 25)
        .map((item) => ({
          id: item.id,
          nom: item.nom,
          ville: item.ville,
          campus: item.campus.map((campus) => ({
            source: campus.sourceCode,
            administration: signatureAdministrationMali(campus),
            codesOfficiels: campus.codesOfficiels,
            codesCluster: campus.codesCluster,
          })),
        })),
      referencesSource: plan.reduce((total, item) => total + item.campus.reduce((sousTotal, campus) => sousTotal + campus.lignes.length, 0), 0),
      ambigus: ambigus.length,
      exemplesAmbigus: ambigus.slice(0, 25),
      avertissement: APPLIQUER
        ? null
        : "Aucune écriture effectuée. Relancez avec --apply après contrôle du rapport.",
    };
    console.log(JSON.stringify(rapport, null, 2));
  } catch (error) {
    if (importations.size) await echouerImportations(importations, error);
    throw error;
  }
}

if (require.main === module) {
  importer()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}

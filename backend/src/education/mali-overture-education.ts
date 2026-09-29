import {
  NiveauEducation,
  StatutEtablissement,
  TypeEtablissement,
} from "@prisma/client";
import { villeCanoniqueMali } from "./normalisation-localisations";
import {
  communeParVoisinsMali,
  localisationMali,
  type LocalisationMali,
  type ReferenceVoisinMali,
} from "./localisation-mali";

export type AdresseOverture = {
  freeform?: string | null;
  locality?: string | null;
  postcode?: string | null;
  region?: string | null;
  country?: string | null;
};

export type FeatureOverture = {
  id?: string;
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
  properties?: {
    names?: {
      primary?: string | null;
      common?: unknown;
      rules?: unknown;
    } | null;
    categories?: {
      primary?: string | null;
      alternate?: string[] | null;
    } | null;
    taxonomy?: {
      primary?: string | null;
      hierarchy?: string[] | null;
      alternates?: string[] | null;
    } | null;
    basic_category?: string | null;
    confidence?: number | null;
    addresses?: AdresseOverture[] | null;
    sources?: unknown;
    websites?: string[] | null;
    emails?: string[] | null;
    phones?: string[] | null;
    socials?: string[] | null;
    version?: number | null;
    [cle: string]: unknown;
  } | null;
};

export type EcoleOverture = {
  identifiantExterne: string;
  nom: string;
  nomNormalise: string;
  nomRapproche: string;
  signatureBranche: string;
  aliases: string[];
  categorie: string;
  confiance: number;
  type: TypeEtablissement;
  statut: StatutEtablissement;
  niveaux: NiveauEducation[];
  ville: string;
  villeNormalisee: string;
  region: string | null;
  regionNormalisee: string;
  localisationsNormalisees: Set<string>;
  latitude: number;
  longitude: number;
  donneesBrutes: Record<string, unknown>;
};

export type CandidatOverture = {
  id: string;
  nomsExacts: Set<string>;
  nomsRapproches: Set<string>;
  signatureBranche: string;
  type: TypeEtablissement;
  localisationsNormalisees: Set<string>;
  regionsNormalisees: Set<string>;
  latitude: number | null;
  longitude: number | null;
};

export type ResultatCorrespondanceOverture = {
  id: string | null;
  raison: "reference" | "nom-exact" | "nom-relache" | "nouveau" | "ambigu";
  candidats: string[];
};

export type ResultatLectureOverture = {
  ecole: EcoleOverture | null;
  raisonIgnoree?: string;
};

const CATEGORIES_SCOLAIRES = new Set([
  "school",
  "elementary_school",
  "middle_school",
  "high_school",
  "public_school",
  "private_school",
  "preschool",
  "religious_school",
]);

const SIGNAUX_SUPERIEUR = /\b(?:universit\w*|facult\w*|institut\w*|superieur\w*|ingenieur\w*|grande?s? ecole?s?|master\w*|bachelor\w*|licence\w*|seminaire\w*|architecture|mines?|petrole|intecsup|enetp|simplon|ecole\s+(?:de\s+)?sante|ecole\s+universitaire)\b/;
const SIGNAUX_HORS_SCOLAIRE = /\b(?:auto\s+ecole|ecole\s+de\s+conduite|driving\s+school)\b/;
const SIGNAUX_PROFESSIONNEL = /\b(?:hotelier\w*|musique|formation\s+professionnelle|enseignement\s+professionnel|professionnel\w*)\b/;
const SIGNAUX_LYCEE = /\b(?:lycee|secondaire|high\s+school|secondary\s+school)\b/;
const SIGNAUX_COLLEGE = /\b(?:college|middle\s+school)\b/;
const SIGNAUX_PRESCOLAIRE = /\b(?:maternelle|prescolaire|creche|jardin\s+d\s+enfant)\b/;
const SIGNAUX_FONDAMENTAL = /\b(?:fondamentale?|primaire|elementary\s+school)\b/;
const PREFIXE_SCOLAIRE = /^(?:(?:ecole|ecoles|lycee|lycees|college|colleges)(?: fondamentale?s?| privee?s?| publique?s?| maternelle?s?| primaire?s?| secondaire?s?)?|groupes? scolaires?|complexes? scolaires?|etablissements? scolaires?)\s+/;
const ARTICLE_INITIAL = /^(?:le|la|les|l)\s+/;
const LIMITE_MALI = {
  longitudeMin: -12.5,
  longitudeMax: 4.5,
  latitudeMin: 10,
  latitudeMax: 25.5,
};
const RAYON_TERRE_METRES = 6_371_000;

// Overture publie parfois le quartier comme `locality` sans renseigner BKO.
// Cette liste reste volontairement limitée aux quartiers connus du district :
// les communes voisines (Kati, Moribabougou, Baguinéda…) ne doivent pas être
// absorbées dans Bamako malgré leur proximité géographique.
const QUARTIERS_BAMAKO = new Set([
  "aci 2000",
  "bacodjicoroni",
  "baco djicoroni",
  "badalabougou",
  "bamako coura",
  "bamako koura",
  "banankabougou",
  "banconi",
  "bozola",
  "daoudabougou",
  "djikoroni",
  "djicoroni",
  "faladie",
  "hamdallaye",
  "hippodrome",
  "kalaban coura",
  "kalaban koura",
  "korofina",
  "lafiabougou",
  "magnambougou",
  "missabougou",
  "niamakoro",
  "niarela",
  "ntomikorobougou",
  "sabalibougou",
  "sebenikoro",
  "sebeninkoro",
  "senou",
  "sogoniko",
  "sotuba",
  "titibougou",
  "yirimadio",
  "yirimandio",
]);

export const normaliserTexteOverture = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

export const normaliserRegionOvertureMali = (valeur?: string | null) => {
  const normalisee = normaliserTexteOverture(valeur || "");
  if (/^(?:ml\s+)?bko$/.test(normalisee)
    || /^(?:district(?:\s+de)?\s+)?bamako(?:\s+district)?$/.test(normalisee)) return "bamako";
  return normalisee;
};

/**
 * Complète la normalisation partagée avec les quartiers présents dans Places.
 * La région BKO est le district de Bamako, pas une région homonyme distincte.
 */
export const villeCanoniqueOvertureMali = (valeur?: string | null, region?: string | null) => {
  const canonique = villeCanoniqueMali(valeur, { region });
  const localiteNormalisee = normaliserTexteOverture(valeur || "");
  const quartierSansOrientation = localiteNormalisee.replace(/\s+(?:nord|sud|est|ouest)$/, "");
  const dansDistrictBamako = normaliserRegionOvertureMali(region) === "bamako";
  if (canonique.villeNormalisee === "bamako"
    || dansDistrictBamako
    || QUARTIERS_BAMAKO.has(localiteNormalisee)
    || QUARTIERS_BAMAKO.has(quartierSansOrientation)) {
    return {
      ville: "Bamako",
      villeNormalisee: "bamako",
      modifiee: canonique.ville !== "Bamako" || canonique.villeNormalisee !== "bamako",
    };
  }
  return canonique;
};

/**
 * Retire uniquement les préfixes scolaires génériques. Les suffixes de campus
 * (A/B, I/II), le genre et le quartier restent intentionnellement présents.
 */
export const normaliserNomRapprochementOverture = (nom: string) => {
  let resultat = normaliserTexteOverture(nom);
  let precedent = "";
  while (resultat && resultat !== precedent) {
    precedent = resultat;
    resultat = resultat.replace(PREFIXE_SCOLAIRE, "").replace(ARTICLE_INITIAL, "").trim();
  }
  return resultat;
};

const romanVersNombre = (valeur: string) => {
  const table: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6" };
  return table[valeur] || valeur;
};

/** Marqueurs qui rendent deux branches homonymes incompatibles. */
export const signatureBrancheOverture = (nom: string) => {
  const normalise = normaliserTexteOverture(nom);
  const marqueurs: string[] = [];
  const commune = normalise.match(/\bcommune\s+(i{1,3}|iv|v|vi|[1-6])\b/);
  if (commune) marqueurs.push(`commune:${romanVersNombre(commune[1])}`);
  if (/\bfilles?\b/.test(normalise)) marqueurs.push("genre:filles");
  if (/\bgarcons?\b/.test(normalise)) marqueurs.push("genre:garcons");
  const annexe = normalise.match(/\b(?:annexe|campus|site|groupe)\s+([a-c]|i{1,3}|iv|v|vi|[1-6])\b/);
  if (annexe) marqueurs.push(`branche:${romanVersNombre(annexe[1])}`);
  const suffixe = normalise.match(/\b([a-c]|i{1,3}|iv|v|vi)\s*$/);
  if (suffixe && !/\b(?:mali|bamako|kayes|segou|sikasso|mopti|gao|kidal)\s*$/.test(normalise)) {
    marqueurs.push(`suffixe:${romanVersNombre(suffixe[1])}`);
  }
  return [...new Set(marqueurs)].sort().join("|");
};

const aliasesDepuisNoms = (noms: unknown): string[] => {
  if (!noms || typeof noms !== "object") return [];
  const objet = noms as { primary?: unknown; common?: unknown; rules?: unknown };
  const valeurs: string[] = [];
  const ajouter = (valeur: unknown) => {
    if (typeof valeur === "string" && valeur.trim()) valeurs.push(valeur.trim());
  };
  ajouter(objet.primary);
  if (Array.isArray(objet.common)) objet.common.forEach(ajouter);
  else if (objet.common && typeof objet.common === "object") Object.values(objet.common).forEach(ajouter);
  if (Array.isArray(objet.rules)) {
    for (const regle of objet.rules) {
      if (!regle || typeof regle !== "object") continue;
      const objetRegle = regle as Record<string, unknown>;
      ajouter(objetRegle.value);
      ajouter(objetRegle.name);
    }
  }
  return [...new Map(valeurs.map((valeur) => [normaliserTexteOverture(valeur), valeur])).values()];
};

const classification = (categorie: string, nomNormalise: string) => {
  if (SIGNAUX_PROFESSIONNEL.test(nomNormalise)) {
    return {
      type: TypeEtablissement.LYCEE,
      niveaux: [NiveauEducation.PROFESSIONNEL],
    };
  }
  if (categorie === "high_school" || SIGNAUX_LYCEE.test(nomNormalise)) {
    return {
      type: TypeEtablissement.LYCEE,
      niveaux: [NiveauEducation.SECONDAIRE],
    };
  }
  if (categorie === "middle_school" || SIGNAUX_COLLEGE.test(nomNormalise)) {
    return {
      type: TypeEtablissement.FONDAMENTALE,
      niveaux: [NiveauEducation.FONDAMENTAL],
    };
  }
  const estPrescolaire = categorie === "preschool" || SIGNAUX_PRESCOLAIRE.test(nomNormalise);
  const estFondamental = categorie === "elementary_school" || SIGNAUX_FONDAMENTAL.test(nomNormalise);
  if (estPrescolaire && estFondamental) {
    return {
      type: TypeEtablissement.FONDAMENTALE,
      niveaux: [NiveauEducation.PRESCOLAIRE, NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL],
    };
  }
  if (estPrescolaire) {
    return {
      type: TypeEtablissement.FONDAMENTALE,
      niveaux: [NiveauEducation.PRESCOLAIRE],
    };
  }
  return {
    type: TypeEtablissement.FONDAMENTALE,
    niveaux: [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL],
  };
};

const statutDepuisCategorie = (categorie: string, nomNormalise: string) => {
  if (categorie === "private_school" || /\b(?:privee?|private)\b/.test(nomNormalise)) return StatutEtablissement.PRIVE;
  if (categorie === "public_school" || /\b(?:publique?|public)\b/.test(nomNormalise)) return StatutEtablissement.PUBLIC;
  return StatutEtablissement.INCONNU;
};

const coordonneesMali = (feature: FeatureOverture) => {
  if (feature.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) return null;
  const [longitude, latitude] = feature.geometry.coordinates;
  if (typeof longitude !== "number" || !Number.isFinite(longitude)
    || typeof latitude !== "number" || !Number.isFinite(latitude)
    || longitude < LIMITE_MALI.longitudeMin || longitude > LIMITE_MALI.longitudeMax
    || latitude < LIMITE_MALI.latitudeMin || latitude > LIMITE_MALI.latitudeMax) return null;
  return { longitude, latitude };
};

const nettoyerJson = (valeur: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(valeur)) as Record<string, unknown>;

export const convertirFeatureOverture = (feature: FeatureOverture): ResultatLectureOverture => {
  const proprietes = feature.properties;
  const identifiantExterne = feature.id?.trim();
  if (!identifiantExterne || feature.type !== "Feature" || !proprietes) {
    return { ecole: null, raisonIgnoree: "feature-invalide" };
  }
  const categorie = (proprietes.categories?.primary || proprietes.taxonomy?.primary || "").trim();
  if (!CATEGORIES_SCOLAIRES.has(categorie)) return { ecole: null, raisonIgnoree: "categorie-non-scolaire" };
  if (typeof proprietes.confidence === "number" && proprietes.confidence < 0.7) {
    return { ecole: null, raisonIgnoree: "confiance-insuffisante" };
  }
  const aliases = aliasesDepuisNoms(proprietes.names);
  const nom = aliases[0];
  if (!nom) return { ecole: null, raisonIgnoree: "nom-manquant" };
  const nomNormalise = normaliserTexteOverture(nom);
  if (SIGNAUX_SUPERIEUR.test(nomNormalise) && !SIGNAUX_PROFESSIONNEL.test(nomNormalise)) {
    return { ecole: null, raisonIgnoree: "enseignement-superieur" };
  }
  if (SIGNAUX_HORS_SCOLAIRE.test(nomNormalise)) return { ecole: null, raisonIgnoree: "hors-scolaire" };
  const adresse = (proprietes.addresses || []).find(({ country }) => country?.toUpperCase() === "ML");
  if (!adresse) return { ecole: null, raisonIgnoree: "pays-non-malien" };
  const villeSource = adresse.locality?.trim();
  if (!villeSource) return { ecole: null, raisonIgnoree: "localisation-manquante" };
  const coordonnees = coordonneesMali(feature);
  if (!coordonnees) return { ecole: null, raisonIgnoree: "coordonnees-invalides" };
  const villeCanonique = villeCanoniqueOvertureMali(villeSource, adresse.region);
  if (villeCanonique.villeNormalisee === "bamako"
    && (coordonnees.longitude < -8.3 || coordonnees.longitude > -7.75
      || coordonnees.latitude < 12.4 || coordonnees.latitude > 12.85)) {
    return { ecole: null, raisonIgnoree: "coordonnees-incompatibles-localite" };
  }
  const regionNormalisee = normaliserRegionOvertureMali(adresse.region);
  const localisationsNormalisees = new Set([
    normaliserTexteOverture(villeSource),
    villeCanonique.villeNormalisee,
  ].filter(Boolean));
  const classee = classification(categorie, nomNormalise);
  return {
    ecole: {
      identifiantExterne,
      nom,
      nomNormalise,
      nomRapproche: normaliserNomRapprochementOverture(nom),
      signatureBranche: signatureBrancheOverture(nom),
      aliases: aliases.slice(1),
      categorie,
      confiance: typeof proprietes.confidence === "number" ? proprietes.confidence : 0.7,
      type: classee.type,
      statut: statutDepuisCategorie(categorie, nomNormalise),
      niveaux: classee.niveaux,
      ville: villeCanonique.ville || villeSource,
      villeNormalisee: villeCanonique.villeNormalisee,
      region: adresse.region?.trim() || null,
      regionNormalisee,
      localisationsNormalisees,
      latitude: coordonnees.latitude,
      longitude: coordonnees.longitude,
      donneesBrutes: nettoyerJson({
        overtureId: identifiantExterne,
        categorie,
        confiance: proprietes.confidence ?? null,
        adresse,
        sources: proprietes.sources ?? null,
        websites: proprietes.websites ?? null,
        emails: proprietes.emails ?? null,
        phones: proprietes.phones ?? null,
        socials: proprietes.socials ?? null,
        version: proprietes.version ?? null,
        geometrie: feature.geometry,
      }),
    },
  };
};

export const typesScolairesCompatiblesOverture = (a: TypeEtablissement, b: TypeEtablissement) => {
  const scolaire = new Set<TypeEtablissement>([TypeEtablissement.FONDAMENTALE, TypeEtablissement.LYCEE]);
  return a === b || (scolaire.has(a) && scolaire.has(b));
};

export const distanceMetresOverture = (
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
) => {
  if (typeof a.latitude !== "number" || typeof a.longitude !== "number"
    || typeof b.latitude !== "number" || typeof b.longitude !== "number"
    || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)
    || !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return Number.POSITIVE_INFINITY;
  const radians = (degres: number) => degres * Math.PI / 180;
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const deltaLatitude = radians(b.latitude - a.latitude);
  const deltaLongitude = radians(b.longitude - a.longitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * RAYON_TERRE_METRES * Math.asin(Math.min(1, Math.sqrt(haversine)));
};

const intersection = (a: Set<string>, b: Set<string>) => [...a].some((valeur) => Boolean(valeur) && b.has(valeur));

const branchesCompatibles = (a: string, b: string) => !a || !b || a === b;

/**
 * Un rapprochement exige toujours nom + localisation + distance. Un nom seul,
 * même exact, ne suffit jamais. Les cas concurrents restent en quarantaine.
 */
export const trouverCorrespondanceOverture = (
  ecole: EcoleOverture,
  candidats: Iterable<CandidatOverture>,
): ResultatCorrespondanceOverture => {
  const exacts: Array<{ id: string; distance: number }> = [];
  const relaches: Array<{ id: string; distance: number }> = [];
  const sansDistance = new Set<string>();
  for (const candidat of candidats) {
    if (!typesScolairesCompatiblesOverture(ecole.type, candidat.type)) continue;
    if (!branchesCompatibles(ecole.signatureBranche, candidat.signatureBranche)) continue;
    if (!intersection(ecole.localisationsNormalisees, candidat.localisationsNormalisees)) continue;
    if (ecole.regionNormalisee && candidat.regionsNormalisees.size
      && !candidat.regionsNormalisees.has(ecole.regionNormalisee)) continue;
    const exact = candidat.nomsExacts.has(ecole.nomNormalise);
    const relache = ecole.nomRapproche.length >= 4 && candidat.nomsRapproches.has(ecole.nomRapproche);
    if (!exact && !relache) continue;
    const distance = distanceMetresOverture(ecole, candidat);
    if (!Number.isFinite(distance)) {
      sansDistance.add(candidat.id);
      continue;
    }
    if (exact && distance <= 350) exacts.push({ id: candidat.id, distance });
    else if (relache && distance <= 150) relaches.push({ id: candidat.id, distance });
  }
  const uniques = (valeurs: Array<{ id: string; distance: number }>) => (
    [...new Map(valeurs.sort((a, b) => a.distance - b.distance).map((item) => [item.id, item])).values()]
  );
  const exactsUniques = uniques(exacts);
  if (exactsUniques.length === 1) return { id: exactsUniques[0].id, raison: "nom-exact", candidats: [exactsUniques[0].id] };
  if (exactsUniques.length > 1) return { id: null, raison: "ambigu", candidats: exactsUniques.map(({ id }) => id) };
  const relachesUniques = uniques(relaches);
  if (relachesUniques.length === 1) return { id: relachesUniques[0].id, raison: "nom-relache", candidats: [relachesUniques[0].id] };
  if (relachesUniques.length > 1) return { id: null, raison: "ambigu", candidats: relachesUniques.map(({ id }) => id) };
  if (sansDistance.size) return { id: null, raison: "ambigu", candidats: [...sansDistance].sort() };
  return { id: null, raison: "nouveau", candidats: [] };
};

export const lireFeaturesOverture = (contenu: string): FeatureOverture[] => {
  const texte = contenu.trim();
  if (!texte) return [];
  if (texte.startsWith("{")) {
    try {
      const json = JSON.parse(texte) as FeatureOverture | { type?: string; features?: FeatureOverture[] };
      if (json && "features" in json && Array.isArray(json.features)) return json.features;
      if ((json as FeatureOverture).type === "Feature") return [json as FeatureOverture];
    } catch {
      // Le fichier peut être du NDJSON : analyse ligne par ligne ci-dessous.
    }
  }
  return texte.split(/\r?\n/).filter(Boolean).map((ligne, index) => {
    try {
      const feature = JSON.parse(ligne) as FeatureOverture;
      if (feature.type !== "Feature") throw new Error("objet non Feature");
      return feature;
    } catch (error) {
      throw new Error(`NDJSON Overture invalide à la ligne ${index + 1}: ${error instanceof Error ? error.message : "JSON invalide"}`);
    }
  });
};

/**
 * Règle du 2026-09-29 (ville = chef-lieu de région) pour un lieu Overture, qui
 * n'a ni commune ni cercle : la localité est rapprochée d'un nom de commune
 * unique au Mali, sinon des fiches voisines déjà localisées (k=5, 3 km,
 * unanimité), sinon de la région Overture ; un quartier de Bamako reste Bamako.
 * Sans rien de tout cela, l'ancienne ville (localité) est conservée.
 */
export const localisationOvertureMali = (
  ecole: Pick<EcoleOverture, "ville" | "villeNormalisee" | "region" | "latitude" | "longitude" | "donneesBrutes">,
  voisins: readonly ReferenceVoisinMali[] = [],
): LocalisationMali => {
  const adresse = (ecole.donneesBrutes?.adresse || {}) as AdresseOverture;
  const localite = adresse.locality?.trim() || ecole.ville;
  const region = ecole.villeNormalisee === "bamako" ? "Bamako" : ecole.region;
  const parNom = localisationMali({ commune: localite, region, localite });
  if (parNom.resolution === "commune") return parNom;
  const voisine = communeParVoisinsMali(ecole, voisins);
  if (voisine && (!parNom.region || parNom.region === voisine.region)) {
    return localisationMali({ code: voisine.code, codeFiable: true, localite });
  }
  // Région seule : la localité n'est pas une commune reconnue.
  if (parNom.ville) return localisationMali({ region, localite });
  return {
    ville: ecole.ville,
    villeNormalisee: ecole.villeNormalisee,
    localite: null,
    commune: null,
    communeCode: null,
    cercle: null,
    region: null,
    resolution: "aucune",
  };
};

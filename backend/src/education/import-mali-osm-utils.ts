import {
  NiveauEducation,
  StatutEtablissement,
  TypeEtablissement,
} from "@prisma/client";

export type GeometrieGeoJson = {
  type?: string;
  coordinates?: unknown;
} | null | undefined;

export type Coordonnees = {
  longitude: number | null;
  latitude: number | null;
};

type Position = [number, number];

type CentroidePondere = {
  longitude: number;
  latitude: number;
  poids: number;
};

const EPSILON = 1e-12;
const RAYON_TERRE_METRES = 6_371_000;

const normaliser = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const positionValide = (valeur: unknown): valeur is Position => {
  if (!Array.isArray(valeur) || valeur.length < 2) return false;
  const [longitude, latitude] = valeur;
  return typeof longitude === "number"
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180
    && typeof latitude === "number"
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90;
};

const positionsAnneau = (valeur: unknown): Position[] => {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter(positionValide);
};

const moyennePositions = (positions: Position[]): CentroidePondere | null => {
  if (!positions.length) return null;
  const somme = positions.reduce(
    (acc, [longitude, latitude]) => ({
      longitude: acc.longitude + longitude,
      latitude: acc.latitude + latitude,
    }),
    { longitude: 0, latitude: 0 },
  );
  return {
    longitude: somme.longitude / positions.length,
    latitude: somme.latitude / positions.length,
    poids: 1,
  };
};

/**
 * Centroïde planaire d'un anneau GeoJSON. À l'échelle d'un établissement,
 * l'approximation lon/lat est largement inférieure à la précision d'OSM.
 */
const centroideAnneau = (anneau: unknown): CentroidePondere | null => {
  const positions = positionsAnneau(anneau);
  if (positions.length < 3) return moyennePositions(positions);

  let aireDoublee = 0;
  let longitudePonderee = 0;
  let latitudePonderee = 0;
  for (let index = 0; index < positions.length; index += 1) {
    const [longitudeA, latitudeA] = positions[index];
    const [longitudeB, latitudeB] = positions[(index + 1) % positions.length];
    const produitVectoriel = longitudeA * latitudeB - longitudeB * latitudeA;
    aireDoublee += produitVectoriel;
    longitudePonderee += (longitudeA + longitudeB) * produitVectoriel;
    latitudePonderee += (latitudeA + latitudeB) * produitVectoriel;
  }

  if (Math.abs(aireDoublee) <= EPSILON) return moyennePositions(positions);
  return {
    longitude: longitudePonderee / (3 * aireDoublee),
    latitude: latitudePonderee / (3 * aireDoublee),
    poids: Math.abs(aireDoublee) / 2,
  };
};

const centroidePolygone = (coordonnees: unknown): CentroidePondere | null => {
  if (!Array.isArray(coordonnees) || !coordonnees.length) return null;
  const anneaux = coordonnees
    .map((anneau) => centroideAnneau(anneau))
    .filter((item): item is CentroidePondere => Boolean(item));
  if (!anneaux.length) return null;

  // Le premier anneau est l'enveloppe ; les suivants sont des trous, quelle
  // que soit leur orientation dans le fichier source.
  let poidsNet = anneaux[0].poids;
  let longitudePonderee = anneaux[0].longitude * anneaux[0].poids;
  let latitudePonderee = anneaux[0].latitude * anneaux[0].poids;
  for (const trou of anneaux.slice(1)) {
    poidsNet -= trou.poids;
    longitudePonderee -= trou.longitude * trou.poids;
    latitudePonderee -= trou.latitude * trou.poids;
  }
  if (poidsNet > EPSILON) {
    return {
      longitude: longitudePonderee / poidsNet,
      latitude: latitudePonderee / poidsNet,
      poids: poidsNet,
    };
  }

  const toutesLesPositions = coordonnees.flatMap((anneau) => positionsAnneau(anneau));
  return moyennePositions(toutesLesPositions);
};

/** Extrait un point représentatif d'un Point, Polygon ou MultiPolygon. */
export const centroideGeometrie = (geometry?: GeometrieGeoJson): Coordonnees => {
  if (!geometry) return { longitude: null, latitude: null };
  if (geometry.type === "Point" && positionValide(geometry.coordinates)) {
    const [longitude, latitude] = geometry.coordinates;
    return { longitude, latitude };
  }
  if (geometry.type === "Polygon") {
    const centroide = centroidePolygone(geometry.coordinates);
    return centroide
      ? { longitude: centroide.longitude, latitude: centroide.latitude }
      : { longitude: null, latitude: null };
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    const polygones = geometry.coordinates
      .map((polygone) => centroidePolygone(polygone))
      .filter((item): item is CentroidePondere => Boolean(item));
    const poidsTotal = polygones.reduce((total, polygone) => total + polygone.poids, 0);
    if (poidsTotal > EPSILON) {
      return {
        longitude: polygones.reduce(
          (total, polygone) => total + polygone.longitude * polygone.poids,
          0,
        ) / poidsTotal,
        latitude: polygones.reduce(
          (total, polygone) => total + polygone.latitude * polygone.poids,
          0,
        ) / poidsTotal,
      };
    }
  }
  return { longitude: null, latitude: null };
};

export const groupeTypeRapprochement = (type: TypeEtablissement) => (
  type === TypeEtablissement.FONDAMENTALE || type === TypeEtablissement.LYCEE
    ? "SCOLAIRE"
    : type
);

const PREFIXE_CAMPUS_SCOLAIRE = /^(?:(?:ecole|ecoles|lycee|lycees|college|colleges)(?: fondamentale?s?| privee?s?| publique?s?| maternelle?s?| primaire?s?| secondaire?s?)?|groupes? scolaires?|complexes? scolaires?|etablissements? scolaires?)(?:\s+|$)/;
const ARTICLE_INITIAL = /^(?:le|la|les|l)\s+/;
const MOTS_NON_DISTINCTIFS = new Set([
  "de", "des", "du", "d", "et", "a",
  "cycle", "cycles", "premier", "premiere", "second", "seconde", "deuxieme",
  "1er", "1ere", "2e", "2eme",
]);
const VALEURS_BRANCHE = "a|b|c|i|ii|iii|iv|v|vi|1|2|3|1er|2e|2eme|3e|3eme|premier|deuxieme|troisieme";
const NOMBRE_BRANCHE: Record<string, string> = {
  i: "1",
  "1": "1",
  "1er": "1",
  premier: "1",
  ii: "2",
  "2": "2",
  "2e": "2",
  "2eme": "2",
  deuxieme: "2",
  iii: "3",
  "3": "3",
  "3e": "3",
  "3eme": "3",
  troisieme: "3",
  iv: "4",
  v: "5",
  vi: "6",
};

const normaliserValeurBranche = (valeur: string) => NOMBRE_BRANCHE[valeur] || valeur;

/**
 * Les sources maliennes publient souvent un même établissement une fois par
 * cycle ("[1er C]", "2ème cycle", "F1" / "F2"). Ces mentions décrivent le
 * niveau enseigné, pas une branche ni un campus distinct. On les retire donc
 * uniquement de la clé de rapprochement ; le libellé original reste conservé
 * comme alias après fusion.
 */
const retirerMarqueursCycle = (valeur: string) => valeur
  .replace(/\b(?:premier|premiere|1er|1ere|second|seconde|deuxieme|2e|2eme)\s+cycles?\b/g, " ")
  .replace(/\bcycles?\s*(?:premier|premiere|1er|1ere|second|seconde|deuxieme|2e|2eme)\b/g, " ")
  .replace(/\b(?:premier|premiere|1er|1ere|second|seconde|deuxieme|2e|2eme)\s*c\b/g, " ")
  .replace(/\bf\s*[12]\b/g, " ")
  .replace(/\s+/g, " ")
  .trim();

/**
 * Nom du campus utilisé pour les doublons OSM. On ne retire les préfixes de
 * cycle que pour les établissements scolaires, afin de ne pas confondre deux
 * facultés ou instituts supérieurs co-localisés.
 */
export const nomCampusRapprochement = (nom: string, type: TypeEtablissement) => {
  let resultat = normaliser(nom);
  if (groupeTypeRapprochement(type) === "SCOLAIRE") {
    let precedent = "";
    while (resultat && resultat !== precedent) {
      precedent = resultat;
      resultat = resultat.replace(PREFIXE_CAMPUS_SCOLAIRE, "").replace(ARTICLE_INITIAL, "").trim();
    }
    resultat = retirerMarqueursCycle(resultat);
  }
  const motsDistinctifs = resultat.split(" ").filter((mot) => mot.length >= 2 && !MOTS_NON_DISTINCTIFS.has(mot));
  return motsDistinctifs.length ? resultat : "";
};

/**
 * Conserve les marqueurs qui distinguent des branches pourtant susceptibles
 * de partager le même campus. Les écritures numériques équivalentes sont
 * ramenées à la même valeur (II, 2, 2e, deuxième).
 */
export const signatureBrancheDistincte = (nom: string): string | null => {
  // Un cycle scolaire est un niveau du même établissement. Le retirer avant
  // de chercher les vraies branches évite notamment d'interpréter le "C" de
  // "[1er C]" comme une branche C.
  const nomNormalise = retirerMarqueursCycle(normaliser(nom));
  const marqueurs = new Set<string>();
  if (/\bfilles?\b/.test(nomNormalise)) marqueurs.add("genre:filles");
  if (/\bgarcons?\b/.test(nomNormalise)) marqueurs.add("genre:garcons");

  for (const correspondance of nomNormalise.matchAll(/\b(i|ii|iii|iv|v|vi)\b/g)) {
    marqueurs.add(`branche:${normaliserValeurBranche(correspondance[1])}`);
  }
  for (const correspondance of nomNormalise.matchAll(
    /\b(?:ecoles?|lycees?|colleges?|groupes?(?: scolaires?)?|niveaux?)\s+(a|b|c)\b/g,
  )) {
    marqueurs.add(`branche:${correspondance[1]}`);
  }
  for (const correspondance of nomNormalise.matchAll(
    new RegExp(`\\b(?:branche|annexe|classe|serie)\\s*(${VALEURS_BRANCHE})\\b`, "g"),
  )) {
    marqueurs.add(`branche:${normaliserValeurBranche(correspondance[1])}`);
  }
  const suffixe = nomNormalise.match(/(?:^|\s)(a|b|c|1|2|3)$/);
  if (suffixe) marqueurs.add(`branche:${normaliserValeurBranche(suffixe[1])}`);

  return marqueurs.size ? [...marqueurs].sort().join("|") : null;
};

export const nomContientBrancheDistincte = (nom: string) => signatureBrancheDistincte(nom) !== null;

/**
 * Un groupe est sûr du point de vue des branches seulement si chaque ligne a
 * exactement la même signature. Cela rejette aussi tout mélange entre un nom
 * marqué et un nom sans marqueur.
 */
export const signaturesBrancheCompatibles = (noms: readonly string[]) => {
  if (!noms.length) return false;
  const signatures = noms.map(signatureBrancheDistincte);
  return signatures.every((signature) => signature === signatures[0]);
};

export type LigneDeduplicationOsm = {
  id: string;
  osmId: string;
  nom: string;
  type: TypeEtablissement;
  villeNormalisee: string;
  admin3Pcode: string;
  admin3NomNormalise: string;
  localiteNormalisee: string;
  latitude: number | null;
  longitude: number | null;
  existant: boolean;
};

export type AmbiguiteDeduplicationOsm = {
  nomCampus: string;
  osmIds: string[];
  idsExistants: string[];
};

export type StatistiquesDeduplicationOsm = {
  groupesCandidats: number;
  groupesFusionnes: number;
  lignesFusionnees: number;
  lignesRattacheesAExistant: number;
  groupesAmbigus: number;
};

const coordonneesValides = (ligne: LigneDeduplicationOsm): ligne is LigneDeduplicationOsm & {
  latitude: number;
  longitude: number;
} => typeof ligne.latitude === "number"
  && Number.isFinite(ligne.latitude)
  && ligne.latitude >= -90
  && ligne.latitude <= 90
  && typeof ligne.longitude === "number"
  && Number.isFinite(ligne.longitude)
  && ligne.longitude >= -180
  && ligne.longitude <= 180;

export const distanceMetres = (
  a: Pick<LigneDeduplicationOsm, "latitude" | "longitude">,
  b: Pick<LigneDeduplicationOsm, "latitude" | "longitude">,
) => {
  const latitudeAEnDegres = a.latitude;
  const longitudeAEnDegres = a.longitude;
  const latitudeBEnDegres = b.latitude;
  const longitudeBEnDegres = b.longitude;
  if (typeof latitudeAEnDegres !== "number"
    || typeof longitudeAEnDegres !== "number"
    || typeof latitudeBEnDegres !== "number"
    || typeof longitudeBEnDegres !== "number"
    || !Number.isFinite(latitudeAEnDegres)
    || !Number.isFinite(longitudeAEnDegres)
    || !Number.isFinite(latitudeBEnDegres)
    || !Number.isFinite(longitudeBEnDegres)
    || latitudeAEnDegres < -90
    || latitudeAEnDegres > 90
    || latitudeBEnDegres < -90
    || latitudeBEnDegres > 90
    || longitudeAEnDegres < -180
    || longitudeAEnDegres > 180
    || longitudeBEnDegres < -180
    || longitudeBEnDegres > 180) {
    return Number.POSITIVE_INFINITY;
  }
  const radians = (degres: number) => degres * Math.PI / 180;
  const latitudeA = radians(latitudeAEnDegres);
  const latitudeB = radians(latitudeBEnDegres);
  const deltaLatitude = radians(latitudeBEnDegres - latitudeAEnDegres);
  const deltaLongitude = radians(longitudeBEnDegres - longitudeAEnDegres);
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * RAYON_TERRE_METRES * Math.asin(Math.min(1, Math.sqrt(haversine)));
};

const localitesCompatibles = (a: LigneDeduplicationOsm, b: LigneDeduplicationOsm) => {
  if (a.admin3Pcode && b.admin3Pcode) return a.admin3Pcode === b.admin3Pcode;
  if (a.admin3NomNormalise && b.admin3NomNormalise) {
    return a.admin3NomNormalise === b.admin3NomNormalise;
  }
  if (a.localiteNormalisee && b.localiteNormalisee) {
    return a.localiteNormalisee === b.localiteNormalisee;
  }
  return false;
};

const memeCampusProche = (
  a: LigneDeduplicationOsm,
  b: LigneDeduplicationOsm,
  distanceMaximale: number,
) => localitesCompatibles(a, b) && distanceMetres(a, b) <= distanceMaximale;

/**
 * Dédoublonne exclusivement les objets OSM qui décrivent vraisemblablement le
 * même campus : même nom significatif, localité compatible et coordonnées à
 * 150 m maximum. Une absence de localité ou de coordonnées interdit la fusion.
 * Le regroupement est à lien complet pour éviter les chaînes A-B-C où A et C
 * seraient trop éloignés.
 */
export function dedupliquerLignesOsm<T extends LigneDeduplicationOsm>(
  entrees: readonly T[],
  distanceMaximale = 150,
) {
  const lignes = entrees.map((item) => ({ ...item })) as T[];
  const groupesParNom = new Map<string, number[]>();
  for (const [index, ligne] of lignes.entries()) {
    const nomCampus = nomCampusRapprochement(ligne.nom, ligne.type);
    if (!nomCampus || !coordonneesValides(ligne)) continue;
    const cle = `${groupeTypeRapprochement(ligne.type)}|${nomCampus}`;
    const indices = groupesParNom.get(cle) || [];
    indices.push(index);
    groupesParNom.set(cle, indices);
  }

  const statistiques: StatistiquesDeduplicationOsm = {
    groupesCandidats: 0,
    groupesFusionnes: 0,
    lignesFusionnees: 0,
    lignesRattacheesAExistant: 0,
    groupesAmbigus: 0,
  };
  const ambiguites: AmbiguiteDeduplicationOsm[] = [];

  for (const indices of groupesParNom.values()) {
    if (indices.length < 2) continue;
    const indicesTries = [...indices].sort((a, b) => (
      lignes[a].osmId.localeCompare(lignes[b].osmId, "fr")
      || lignes[a].id.localeCompare(lignes[b].id, "fr")
    ));
    const grappes: number[][] = [];
    for (const index of indicesTries) {
      const grappe = grappes.find((candidate) => candidate.every((autreIndex) => (
        memeCampusProche(lignes[index], lignes[autreIndex], distanceMaximale)
      )));
      if (grappe) grappe.push(index);
      else grappes.push([index]);
    }

    for (const grappe of grappes.filter((candidate) => candidate.length > 1)) {
      statistiques.groupesCandidats += 1;
      const idsExistants = [...new Set(
        grappe.filter((index) => lignes[index].existant).map((index) => lignes[index].id),
      )].sort();
      const nomCampus = nomCampusRapprochement(lignes[grappe[0]].nom, lignes[grappe[0]].type);
      if (idsExistants.length > 1) {
        statistiques.groupesAmbigus += 1;
        ambiguites.push({
          nomCampus,
          osmIds: grappe.map((index) => lignes[index].osmId),
          idsExistants,
        });
        continue;
      }

      const cibleId = idsExistants[0] || lignes[grappe[0]].id;
      let groupeModifie = false;
      for (const index of grappe) {
        const etaitExistant = lignes[index].existant;
        if (lignes[index].id !== cibleId) {
          lignes[index].id = cibleId;
          statistiques.lignesFusionnees += 1;
          groupeModifie = true;
        }
        if (idsExistants.length && !etaitExistant) {
          lignes[index].existant = true;
          statistiques.lignesRattacheesAExistant += 1;
          groupeModifie = true;
        }
      }
      if (groupeModifie) statistiques.groupesFusionnes += 1;
    }
  }

  return { lignes, statistiques, ambiguites };
}

export type LigneAgregationOsm = LigneDeduplicationOsm & {
  nomNormalise: string;
  aliases: string[];
  statut: StatutEtablissement;
  niveaux: NiveauEducation[];
};

const ORDRE_NIVEAUX: NiveauEducation[] = [
  NiveauEducation.PRESCOLAIRE,
  NiveauEducation.PRIMAIRE,
  NiveauEducation.FONDAMENTAL,
  NiveauEducation.SECONDAIRE,
  NiveauEducation.PROFESSIONNEL,
  NiveauEducation.SUPERIEUR,
  NiveauEducation.FORMATION_CONTINUE,
];

/** Agrège sans perte les niveaux et variantes de nom qui partagent un id final. */
export function agregerLignesParId<T extends LigneAgregationOsm>(entrees: readonly T[]): T[] {
  const groupes = new Map<string, T[]>();
  for (const item of entrees) {
    const groupe = groupes.get(item.id) || [];
    groupe.push(item);
    groupes.set(item.id, groupe);
  }

  return [...groupes.values()].map((groupe) => {
    const lignes = [...groupe].sort((a, b) => a.osmId.localeCompare(b.osmId, "fr"));
    const reference = lignes[0];
    const niveaux = [...new Set(lignes.flatMap((ligne) => ligne.niveaux))]
      .sort((a, b) => ORDRE_NIVEAUX.indexOf(a) - ORDRE_NIVEAUX.indexOf(b));
    const types = new Set(lignes.map(({ type }) => type));
    const typesTousScolaires = [...types].every((type) => groupeTypeRapprochement(type) === "SCOLAIRE");
    const type = typesTousScolaires && (
      types.has(TypeEtablissement.LYCEE) || niveaux.includes(NiveauEducation.SECONDAIRE)
    )
      ? TypeEtablissement.LYCEE
      : reference.type;
    const statutsConnus = [...new Set(
      lignes.map(({ statut: valeur }) => valeur).filter((valeur) => valeur !== StatutEtablissement.INCONNU),
    )];
    const statut = statutsConnus.length === 1 ? statutsConnus[0] : StatutEtablissement.INCONNU;
    const aliasParNomNormalise = new Map<string, string>();
    for (const ligne of lignes) {
      for (const alias of [ligne.nom, ...ligne.aliases]) {
        const nomNormalise = normaliser(alias);
        if (nomNormalise && nomNormalise !== reference.nomNormalise && !aliasParNomNormalise.has(nomNormalise)) {
          aliasParNomNormalise.set(nomNormalise, alias.trim());
        }
      }
    }
    const avecCoordonnees = lignes.find(coordonneesValides);

    return {
      ...reference,
      type,
      statut,
      niveaux,
      aliases: [...aliasParNomNormalise.values()],
      latitude: avecCoordonnees?.latitude ?? null,
      longitude: avecCoordonnees?.longitude ?? null,
      existant: lignes.some(({ existant }) => existant),
    };
  });
}

export type ResolutionCandidats = {
  id: string | null;
  candidats: string[];
  ambigu: boolean;
};

export const ajouterCandidat = (index: Map<string, Set<string>>, cle: string, id: string) => {
  const candidats = index.get(cle) || new Set<string>();
  candidats.add(id);
  index.set(cle, candidats);
};

/** Une correspondance n'est utilisable que si toutes les clés désignent un seul id. */
export const resoudreCandidats = (...candidats: Array<Iterable<string> | undefined>): ResolutionCandidats => {
  const ids = [...new Set(candidats.flatMap((ensemble) => ensemble ? [...ensemble] : []))].sort();
  return {
    id: ids.length === 1 ? ids[0] : null,
    candidats: ids,
    ambigu: ids.length > 1,
  };
};

export type CandidatCanoniqueReconciliation = {
  id: string;
  provenanceNonOsm: boolean;
  activite: number;
  richesse: number;
  creeLe: number;
};

export type ChoixCanoniqueReconciliation =
  | { id: null; raison: "plusieurs-canoniques" }
  | { id: string; raison: "provenance-non-osm" | "fiche-la-plus-riche" };

/**
 * Privilégie une provenance indépendante d'OSM, mais refuse de départager deux
 * canoniques externes. À défaut, conserve la fiche la plus utilisée et la plus
 * riche, avec un ordre stable en dernier recours.
 */
export const choisirCanoniqueReconciliation = (
  candidats: readonly CandidatCanoniqueReconciliation[],
): ChoixCanoniqueReconciliation => {
  const externes = candidats.filter(({ provenanceNonOsm }) => provenanceNonOsm);
  if (externes.length > 1) return { id: null, raison: "plusieurs-canoniques" };
  const pool = externes.length ? externes : [...candidats];
  const canonique = [...pool].sort((a, b) => (
    b.activite - a.activite
    || b.richesse - a.richesse
    || a.creeLe - b.creeLe
    || a.id.localeCompare(b.id, "fr")
  ))[0];
  if (!canonique) return { id: null, raison: "plusieurs-canoniques" };
  return {
    id: canonique.id,
    raison: externes.length ? "provenance-non-osm" : "fiche-la-plus-riche",
  };
};

import {
  NiveauEducation,
  StatutEtablissement,
  TypeEtablissement,
} from "@prisma/client";
import { villeCanoniqueMali } from "./normalisation-localisations";

export type SourceRegistreMali = "ocha-men-mali-schools-2023" | "unicef-men-mali-schools-2013";

export type AdministrationEcoleMali = {
  region: string | null;
  cercle: string | null;
  commune: string | null;
  localite: string | null;
};

export type CoordonneesEcoleMali = {
  latitude: number | null;
  longitude: number | null;
};

export type LigneRegistreEcoleMali = AdministrationEcoleMali & CoordonneesEcoleMali & {
  sourceCode: SourceRegistreMali;
  identifiantExterne: string;
  nom: string;
  cycle: string | null;
  statutBrut: string | null;
  typeEnseignement: string | null;
  codesOfficiels: string[];
  codesCluster: string[];
  donneesBrutes: Record<string, unknown>;
};

export type CampusRegistreEcoleMali = AdministrationEcoleMali & CoordonneesEcoleMali & {
  cle: string;
  sourceCode: SourceRegistreMali;
  nom: string;
  nomCampusNormalise: string;
  nomRapprochement: string;
  aliases: string[];
  ville: string | null;
  villeNormalisee: string;
  type: TypeEtablissement;
  statut: StatutEtablissement;
  niveaux: NiveauEducation[];
  codesOfficiels: string[];
  codesCluster: string[];
  lignes: LigneRegistreEcoleMali[];
};

const GENERIQUES_NOM = /^(?:(?:ecole|ecoles)(?: fondamentale?s?| privee?s?| publique?s?| primaire?s?| communautaire?s?| laique?s?)?|groupes? scolaires?|complexes? scolaires?|etablissements? scolaires?|college|lycee)\s+/;
// `c ycle` couvre aussi l'ancienne graphie OSM « [1er C]ycle » après
// normalisation de la ponctuation, sans retirer le suffixe de branche I/II.
const CYCLE_NOM = /\b(?:f\s*[12]|(?:1(?:er|ere|e)?|2(?:eme|e)?)\s*c(?:\s*ycle)?)\b/g;
const CYCLE_NOM_AFFICHE = /\s*[\[\]()]*(?:f\s*[12]|(?:1(?:er|ère|ere|e)?|2(?:ème|eme|e)?)\s*°?\s*(?:cycle|c))[\[\]()]*/giu;
const COMMUNE_PREFIXE = /^(?:commune(?:\s+(?:rurale|urbaine))?\s+(?:de|du|d')?\s*)/i;
const RAYON_MEME_CAMPUS_METRES = 250;

export const normaliserTexteEcoleMali = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[’']/g, " ")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

/** Retire seulement les marqueurs de cycle ; les suffixes A/B/I/II restent distinctifs. */
export const normaliserNomCampusMali = (nom: string) => normaliserTexteEcoleMali(nom)
  .replace(CYCLE_NOM, " ")
  .replace(/\s+/g, " ")
  .trim();

/** Version plus permissive, réservée à un rapprochement déjà confirmé par l'administration/les coordonnées. */
export const normaliserNomRapprochementMali = (nom: string) => normaliserNomCampusMali(nom)
  .replace(GENERIQUES_NOM, "")
  .trim();

export const normaliserCodeOfficielMali = (valeur: unknown) => {
  if (valeur === null || valeur === undefined) return null;
  if (typeof valeur !== "string" && typeof valeur !== "number") return null;
  const texte = typeof valeur === "number" && Number.isInteger(valeur)
    ? String(valeur)
    : String(valeur).trim().replace(/\.0+$/, "");
  const code = texte.replace(/\s+/g, "").toLocaleUpperCase("fr");
  return code && !/^(?:0|N\/A|N\/D|NA|ND|NEANT|NOUVEAU|AUCUN|SANS.?CODE|INCONNU)$/.test(code) ? code : null;
};

const nombreDecimal = (valeur: unknown) => {
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : null;
  if (typeof valeur !== "string") return null;
  const texte = valeur.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(texte)) return null;
  const nombre = Number(texte);
  return Number.isFinite(nombre) ? nombre : null;
};

const dansLeMali = (longitude: number, latitude: number) => (
  longitude >= -13.5 && longitude <= 5
  && latitude >= 9.5 && latitude <= 26
);

/** Accepte les décimales avec virgule et répare les couples latitude/longitude inversés. */
export const lireCoordonneesMali = (longitudeBrute: unknown, latitudeBrute: unknown): CoordonneesEcoleMali => {
  const longitude = nombreDecimal(longitudeBrute);
  const latitude = nombreDecimal(latitudeBrute);
  if (longitude === null || latitude === null || (longitude === 0 && latitude === 0)) {
    return { longitude: null, latitude: null };
  }
  if (dansLeMali(longitude, latitude)) return { longitude, latitude };
  if (dansLeMali(latitude, longitude)) return { longitude: latitude, latitude: longitude };
  return { longitude: null, latitude: null };
};

const normaliserDivisionAdministrative = (valeur: string | null, type: "region" | "cercle" | "commune" | "localite") => {
  let resultat = normaliserTexteEcoleMali(valeur || "");
  if (type === "region") resultat = resultat.replace(/^region\s+(?:de|du|d)\s+/, "");
  if (type === "cercle") resultat = resultat.replace(/^cercle\s+(?:de|du|d)\s+/, "");
  if (type === "commune") resultat = resultat.replace(/^commune(?:\s+(?:rurale|urbaine))?\s+(?:de|du|d)\s+/, "");
  return resultat.trim();
};

export const signatureAdministrationMali = (administration: AdministrationEcoleMali) => [
  normaliserDivisionAdministrative(administration.region, "region"),
  normaliserDivisionAdministrative(administration.cercle, "cercle"),
  normaliserDivisionAdministrative(administration.commune, "commune"),
  normaliserDivisionAdministrative(administration.localite, "localite"),
].join("|");

export const signatureHierarchieMali = (administration: AdministrationEcoleMali) => [
  normaliserDivisionAdministrative(administration.region, "region"),
  normaliserDivisionAdministrative(administration.cercle, "cercle"),
  normaliserDivisionAdministrative(administration.commune, "commune"),
].join("|");

const nombreRomain = (valeur: string) => {
  const nombres: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6" };
  return nombres[valeur] || valeur;
};

/** Marqueurs à ne jamais gommer lors d'un rapprochement relâché. */
export const signatureBrancheEcoleMali = (nom: string) => {
  const normalise = normaliserNomCampusMali(nom);
  const marqueurs: string[] = [];
  if (/\bfilles?\b/.test(normalise)) marqueurs.push("genre:filles");
  if (/\bgarcons?\b/.test(normalise)) marqueurs.push("genre:garcons");
  const branche = normalise.match(/\b(?:annexe|campus|site|groupe)\s+([a-c]|i{1,3}|iv|v|vi|[1-6])\b/);
  if (branche) marqueurs.push(`branche:${nombreRomain(branche[1])}`);
  const suffixe = normalise.match(/\b([a-c]|i{1,3}|iv|v|vi|[1-6])\s*$/);
  if (suffixe) marqueurs.push(`suffixe:${nombreRomain(suffixe[1])}`);
  return [...new Set(marqueurs)].sort().join("|");
};

export const distanceMetres = (a: CoordonneesEcoleMali, b: CoordonneesEcoleMali) => {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  const radians = (degres: number) => degres * Math.PI / 180;
  const deltaLat = radians(b.latitude - a.latitude);
  const deltaLon = radians(b.longitude - a.longitude);
  const latA = radians(a.latitude);
  const latB = radians(b.latitude);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export const niveauxDepuisCycleMali = (cycle: string | null) => {
  const valeur = normaliserTexteEcoleMali(cycle || "");
  if (/cdpe|prescolaire|maternelle/.test(valeur)) return [NiveauEducation.PRESCOLAIRE];
  if (/f\s*2|2(?:eme|e)?\s*cycle|second cycle/.test(valeur)) {
    return [NiveauEducation.FONDAMENTAL];
  }
  if (/f\s*1|1(?:er|ere|e)?\s*cycle|premier cycle/.test(valeur)) {
    return [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL];
  }
  return [NiveauEducation.FONDAMENTAL];
};

export const statutDepuisRegistreMali = (statuts: Array<string | null>) => {
  const texte = normaliserTexteEcoleMali(statuts.filter(Boolean).join(" "));
  if (/public|etat|gouvernement/.test(texte)) return StatutEtablissement.PUBLIC;
  if (/prive|confessionnel|laic/.test(texte)) return StatutEtablissement.PRIVE;
  return StatutEtablissement.INCONNU;
};

const villeDepuisAdministration = (administration: AdministrationEcoleMali) => {
  const bamako = [administration.region, administration.cercle, administration.commune]
    .some((item) => /(?:^|\s)bamako(?:\s|$)/.test(normaliserTexteEcoleMali(item || "")))
    || /^commune\s+(?:[1-6]|i{1,3}|iv|v|vi)$/.test(normaliserTexteEcoleMali(administration.commune || ""));
  const valeur = bamako
    ? "Bamako"
    : administration.localite
      || administration.commune?.replace(COMMUNE_PREFIXE, "").trim()
      || administration.cercle
      || administration.region;
  return villeCanoniqueMali(valeur || null, administration);
};

const intersectionNonVide = (a: string[], b: string[]) => {
  const valeurs = new Set(a.filter(Boolean));
  return b.some((valeur) => Boolean(valeur) && valeurs.has(valeur));
};

const cycleFondamental = (cycle: string | null): 1 | 2 | null => {
  const valeur = normaliserTexteEcoleMali(cycle || "");
  if (/(?:^|\s)(?:f\s*1|1(?:er|ere|e)?\s*(?:c|cycle)|premier\s+cycle)(?:\s|$)/.test(valeur)) return 1;
  if (/(?:^|\s)(?:f\s*2|2(?:eme|e)?\s*(?:c|cycle)|second\s+cycle)(?:\s|$)/.test(valeur)) return 2;
  return null;
};

const hierarchieSuffisante = (ligne: LigneRegistreEcoleMali) => [
  normaliserDivisionAdministrative(ligne.region, "region"),
  normaliserDivisionAdministrative(ligne.cercle, "cercle"),
  normaliserDivisionAdministrative(ligne.commune, "commune"),
].every(Boolean);

/**
 * Le registre 2013 attribue fréquemment un code différent à F1 et F2 alors
 * qu'ils se trouvent sur le même campus (par exemple Mali Univers). Lorsque
 * les deux cycles sont complémentaires, le nom nettoyé et toute la hiérarchie
 * sont identiques, l'absence de coordonnées ne doit pas créer deux fiches.
 */
const lignes2013CyclesComplementaires = (a: LigneRegistreEcoleMali, b: LigneRegistreEcoleMali) => {
  if (a.sourceCode !== "unicef-men-mali-schools-2013" || b.sourceCode !== a.sourceCode) return false;
  if (!hierarchieSuffisante(a) || !hierarchieSuffisante(b)) return false;
  if (normaliserNomCampusMali(a.nom) !== normaliserNomCampusMali(b.nom)) return false;
  if (signatureAdministrationMali(a) !== signatureAdministrationMali(b)) return false;

  const cycleA = cycleFondamental(a.cycle);
  const cycleB = cycleFondamental(b.cycle);
  if (cycleA === null || cycleB === null || cycleA === cycleB) return false;

  const brancheA = signatureBrancheEcoleMali(a.nom);
  const brancheB = signatureBrancheEcoleMali(b.nom);
  if (brancheA && brancheB && brancheA !== brancheB) return false;

  const distance = distanceMetres(a, b);
  return distance === null || distance <= RAYON_MEME_CAMPUS_METRES;
};

/**
 * Deux lignes d'un registre ne décrivent le même campus que si un identifiant
 * de site les relie, si leurs points sont réellement proches ou, pour le seul
 * registre 2013, si elles forment la paire F1/F2 strictement encadrée ci-dessus.
 */
export const lignesMemeCampusMali = (a: LigneRegistreEcoleMali, b: LigneRegistreEcoleMali) => {
  if (a.identifiantExterne === b.identifiantExterne) return true;
  if (intersectionNonVide(a.codesCluster, b.codesCluster)) return true;
  if (intersectionNonVide(a.codesOfficiels, b.codesOfficiels)) return true;
  const distance = distanceMetres(a, b);
  if (distance !== null && distance <= RAYON_MEME_CAMPUS_METRES) return true;
  return lignes2013CyclesComplementaires(a, b);
};

const partitionnerParCampusPhysique = (lignes: LigneRegistreEcoleMali[]) => {
  const groupes: LigneRegistreEcoleMali[][] = [];
  for (const ligne of lignes) {
    // Lien complet : évite qu'une chaîne A—B—C regroupe A et C alors que leurs
    // implantations ou identifiants ne sont pas compatibles.
    const groupe = groupes.find((candidat) => candidat.every((item) => lignesMemeCampusMali(ligne, item)));
    if (groupe) groupe.push(ligne);
    else groupes.push([ligne]);
  }
  return groupes;
};

const choisirNom = (lignes: LigneRegistreEcoleMali[]) => {
  const frequences = new Map<string, { nom: string; nombre: number }>();
  for (const ligne of lignes) {
    const nomNettoye = ligne.nom.replace(CYCLE_NOM_AFFICHE, " ").replace(/\s+/g, " ").trim() || ligne.nom.trim();
    const cle = normaliserTexteEcoleMali(nomNettoye);
    const entree = frequences.get(cle);
    if (entree) entree.nombre += 1;
    else frequences.set(cle, { nom: nomNettoye, nombre: 1 });
  }
  return [...frequences.values()].sort((a, b) => b.nombre - a.nombre || a.nom.length - b.nom.length)[0].nom;
};

const construireCampus = (lignes: LigneRegistreEcoleMali[], index: number): CampusRegistreEcoleMali => {
  const premiere = lignes[0];
  const nom = choisirNom(lignes);
  const niveaux = [...new Set(lignes.flatMap((ligne) => niveauxDepuisCycleMali(ligne.cycle)))];
  const coordonnees = lignes.find((ligne) => ligne.latitude !== null && ligne.longitude !== null)
    || { latitude: null, longitude: null };
  const administration = {
    region: premiere.region,
    cercle: premiere.cercle,
    commune: premiere.commune,
    localite: premiere.localite,
  };
  const ville = villeDepuisAdministration(administration);
  const nomCampusNormalise = normaliserNomCampusMali(nom);
  return {
    cle: [
      premiere.sourceCode,
      nomCampusNormalise,
      signatureAdministrationMali(administration),
      index,
      ...lignes.map(({ identifiantExterne }) => identifiantExterne).sort(),
    ].join("|"),
    sourceCode: premiere.sourceCode,
    nom,
    nomCampusNormalise,
    nomRapprochement: normaliserNomRapprochementMali(nom),
    aliases: [...new Map(lignes.map((ligne) => [normaliserTexteEcoleMali(ligne.nom), ligne.nom.trim()])).values()]
      .filter((alias) => normaliserTexteEcoleMali(alias) !== normaliserTexteEcoleMali(nom)),
    ...administration,
    ville: ville.ville,
    villeNormalisee: ville.villeNormalisee,
    latitude: coordonnees.latitude,
    longitude: coordonnees.longitude,
    // Dans ces deux registres maliens, F1/F2 sont les deux cycles de
    // l'enseignement fondamental. Ils ne décrivent pas des lycées.
    type: TypeEtablissement.FONDAMENTALE,
    statut: statutDepuisRegistreMali(lignes.map((ligne) => ligne.statutBrut)),
    niveaux,
    codesOfficiels: [...new Set(lignes.flatMap((ligne) => ligne.codesOfficiels))],
    codesCluster: [...new Set(lignes.flatMap((ligne) => ligne.codesCluster))],
    lignes,
  };
};

/**
 * Regroupe F1/F2 uniquement lorsque nom de campus ET hiérarchie administrative
 * complète correspondent. Des coordonnées distantes créent des branches séparées.
 */
export const regrouperCampusRegistreMali = (lignes: LigneRegistreEcoleMali[]) => {
  const groupes = new Map<string, LigneRegistreEcoleMali[]>();
  for (const ligne of lignes) {
    const cle = [
      ligne.sourceCode,
      normaliserNomCampusMali(ligne.nom),
      signatureAdministrationMali(ligne),
    ].join("|");
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(ligne);
    else groupes.set(cle, [ligne]);
  }
  return [...groupes.values()].flatMap((groupe) => (
    partitionnerParCampusPhysique(groupe).map((branche, index) => construireCampus(branche, index))
  ));
};

export const typesScolairesCompatibles = (a: TypeEtablissement, b: TypeEtablissement) => {
  const scolaires = new Set<TypeEtablissement>([TypeEtablissement.FONDAMENTALE, TypeEtablissement.LYCEE]);
  return a === b || (scolaires.has(a) && scolaires.has(b));
};

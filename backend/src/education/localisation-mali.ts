import referentiel from "./data/communes-mali.json";

/**
 * Localisation des établissements du Mali (décision du propriétaire, 2026-09-29) :
 * `ville` = chef-lieu de la RÉGION (découpage OCHA admin1 / COD-AB) de la commune ;
 * la commune officielle, son P-code, le cercle, la région et la localité (village,
 * quartier) sont conservés dans des colonnes dédiées.
 *
 * Référentiel versionné : `data/communes-mali.json` (717 communes : COD-AB via
 * HOT/HDX OSM adm3 + 22 communes vues seulement dans le registre MEN 2023).
 * Les régions créées en 2023 (Kita, Nioro, Dioïla…) ne figurent pas dans COD-AB :
 * elles sont rattachées à leur région OCHA d'origine.
 */

export type CommuneMali = {
  code: string;
  nom: string;
  cercle: string;
  cercleCode: string | null;
  region: string;
  regionCode: string | null;
  aVerifier: boolean;
  variantes: string[];
};

export type RegionMali = { code: string | null; nom: string; chefLieu: string };

export type LocalisationMali = {
  ville: string | null;
  villeNormalisee: string;
  localite: string | null;
  commune: string | null;
  communeCode: string | null;
  cercle: string | null;
  region: string | null;
  /** commune : commune du référentiel ; region : seule la région est sûre. */
  resolution: "commune" | "region" | "aucune";
};

/** Même règle que `normaliserEducation` (catalog-service.ts). */
export const normaliserLocalisation = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

export const REGIONS_MALI: RegionMali[] = referentiel.regions;
export const COMMUNES_MALI: CommuneMali[] = referentiel.communes;
export const CHEFS_LIEUX_MALI = REGIONS_MALI.map(({ chefLieu }) => chefLieu);
const CHEFS_LIEUX_NORMALISES = new Set(CHEFS_LIEUX_MALI.map(normaliserLocalisation));

export const estChefLieuMali = (ville?: string | null) => CHEFS_LIEUX_NORMALISES.has(normaliserLocalisation(ville || ""));

// ------------------------------------------------------------------ Régions
const REGION_PAR_CLE = new Map<string, RegionMali>();
for (const region of REGIONS_MALI) {
  REGION_PAR_CLE.set(normaliserLocalisation(region.nom), region);
  REGION_PAR_CLE.set(normaliserLocalisation(region.chefLieu), region);
  if (region.code) REGION_PAR_CLE.set(region.code.toLowerCase(), region);
}
const regionNommee = (nom: string) => REGION_PAR_CLE.get(normaliserLocalisation(nom))!;
for (const [alias, nom] of Object.entries({
  "district de bamako": "Bamako",
  "district bamako": "Bamako",
  bko: "Bamako",
  timbuktu: "Tombouctou",
  // Régions de 2023 -> région OCHA d'origine.
  nioro: "Kayes",
  "nioro du sahel": "Kayes",
  kita: "Kayes",
  dioila: "Koulikoro",
  nara: "Koulikoro",
  bougouni: "Sikasso",
  koutiala: "Sikasso",
  san: "Ségou",
  douentza: "Mopti",
  bandiagara: "Mopti",
})) REGION_PAR_CLE.set(alias, regionNommee(nom));

/** Région OCHA depuis un libellé (« SEGOU », « Region de Mopti », « BKO ») ou un P-code (ML04, ML0401, ML040101). */
export const regionMali = (valeur?: string | null): RegionMali | null => {
  const brut = (valeur || "").trim();
  if (!brut) return null;
  const pcode = brut.toUpperCase().replace(/^MLO/, "ML0").match(/^ML\d{2}/);
  if (pcode && REGION_PAR_CLE.has(pcode[0].toLowerCase())) return REGION_PAR_CLE.get(pcode[0].toLowerCase())!;
  const cle = normaliserLocalisation(brut).replace(/^region\s+(?:de|du|d)\s+/, "");
  return REGION_PAR_CLE.get(cle) || null;
};

// ------------------------------------------------------------------ Communes
const ROMAIN: Record<string, string> = { 1: "i", 2: "ii", 3: "iii", 4: "iv", 5: "v", 6: "vi" };
const EQUIVALENCES: Record<string, string> = { aguelhoc: "adjelhoc" };

export const cleCommuneMali = (valeur: string) => {
  let cle = normaliserLocalisation(valeur).replace(/'/g, " ");
  cle = cle.replace(/^(?:commune|cne|cr|cu)(?:\s+(?:rurale|urbaine))?\s+(?:de|du|d|des)\s+/, "");
  cle = cle.replace(/^(?:commune|cne)\s+(?:rurale|urbaine)\s+/, "");
  const bamako = cle.match(/^commune\s+(i{1,3}|iv|vi?|[1-6])(?:\s.*)?$/);
  if (bamako) return `commune ${ROMAIN[bamako[1]] || bamako[1]}`;
  cle = cle.replace(/\s([1-6])$/, (_, chiffre: string) => ` ${ROMAIN[chiffre]}`).replace(/\s+/g, "");
  return EQUIVALENCES[cle] || cle;
};

/** Clé phonétique grossière (Diougani/Dioungani, Marico/Mariko…). */
const squelette = (cle: string) => cle.startsWith("commune ")
  ? cle
  : cle.replace(/dj/g, "j").replace(/ou/g, "u").replace(/[cq]/g, "k").replace(/y/g, "i").replace(/h/g, "")
    .replace(/n(?=[gk])/g, "").replace(/(.)\1+/g, "$1");

const ALIAS_CERCLE: Record<string, string> = { baroueli: "baraoueli", ander: "anderamboukane" };
const cleCercle = (valeur?: string | null) => {
  const cle = normaliserLocalisation(valeur || "").replace(/^cercle\s+(?:de|du|d)\s+/, "");
  return ALIAS_CERCLE[cle] || cle;
};

const ajouter = (index: Map<string, Set<CommuneMali>>, cle: string, commune: CommuneMali) => {
  const valeurs = index.get(cle);
  if (valeurs) valeurs.add(commune);
  else index.set(cle, new Set([commune]));
};
const PAR_CODE = new Map(COMMUNES_MALI.map((commune) => [commune.code.toUpperCase(), commune]));
const EXACT = new Map<string, Set<CommuneMali>>();
const SQUELETTE = new Map<string, Set<CommuneMali>>();
const NATIONAL = new Map<string, Set<CommuneMali>>();
for (const commune of COMMUNES_MALI) {
  const cercle = cleCercle(commune.cercle);
  for (const nom of [commune.nom, ...commune.variantes]) {
    const cle = cleCommuneMali(nom);
    ajouter(EXACT, `${cercle}|${cle}`, commune);
    ajouter(SQUELETTE, `${cercle}|${squelette(cle)}`, commune);
    ajouter(NATIONAL, cle, commune);
    ajouter(NATIONAL, `~${squelette(cle)}`, commune);
  }
}
const unique = (valeurs?: Set<CommuneMali>) => (valeurs && valeurs.size === 1 ? [...valeurs][0] : null);

export type EntreeCommuneMali = {
  commune?: string | null;
  cercle?: string | null;
  region?: string | null;
  /** P-code de la source. */
  code?: string | null;
  /** true : le P-code fait foi (OSM adm3 / COD-AB) ; false : simple indice (MEN 2023, souvent décalé). */
  codeFiable?: boolean;
};

/** Commune du référentiel : P-code fiable, puis nom dans le cercle, variante phonétique, nom unique au Mali, P-code indicatif. */
export const trouverCommuneMali = (entree: EntreeCommuneMali): CommuneMali | null => {
  const code = (entree.code || "").trim().toUpperCase();
  if (code && entree.codeFiable && PAR_CODE.has(code)) return PAR_CODE.get(code)!;
  const cle = cleCommuneMali(entree.commune || "");
  if (!cle) return code ? PAR_CODE.get(code) || null : null;
  const region = regionMali(entree.region);
  let cercle = cleCercle(entree.cercle);
  if (cle.startsWith("commune ") && (!cercle || cercle === "bamako" || region?.code === "ML09")) cercle = "bamako";
  const trouvee = unique(EXACT.get(`${cercle}|${cle}`))
    || unique(SQUELETTE.get(`${cercle}|${squelette(cle)}`))
    || (cle.startsWith("commune ") ? null : unique(NATIONAL.get(cle)) || unique(NATIONAL.get(`~${squelette(cle)}`)))
    || (code ? PAR_CODE.get(code) || null : null);
  // Une région explicite contradictoire invalide un rapprochement national.
  if (trouvee && region && regionMali(trouvee.regionCode || trouvee.region)?.chefLieu !== region.chefLieu) return null;
  return trouvee;
};

// ------------------------------------------------------------------ Localisation complète
const ETIQUETTE_BAMAKO = /^(?:district(?: de)? )?bamako$|^commune (?:i{1,3}|iv|vi?|[1-6])(?: .*)?$/;
const colle = (valeur: string) => normaliserLocalisation(valeur).replace(/\s+/g, "");

const casseSoignee = (valeur: string) => {
  const texte = valeur.trim().replace(/\s+/g, " ");
  if (texte !== texte.toUpperCase()) return texte;
  const petits = new Set(["de", "du", "des", "la", "le", "les", "d", "et"]);
  return texte.toLowerCase().split(/(\s+|-|')/)
    .map((mot, index) => (index && petits.has(mot) ? mot : mot.charAt(0).toUpperCase() + mot.slice(1)))
    .join("");
};

const communeBrute = (valeur?: string | null) => {
  const texte = (valeur || "").trim().replace(/^commune(?:\s+(?:rurale|urbaine))?\s+(?:de|du|d')\s*/i, "");
  return texte ? casseSoignee(texte) : null;
};

export type EntreeLocalisationMali = EntreeCommuneMali & {
  /** Village, quartier ou ancienne valeur de `ville`. */
  localite?: string | null;
};

/**
 * Calcule ville (chef-lieu), commune, cercle, région et localité.
 * `localite` n'est gardée que si elle diffère de la ville et de la commune
 * (et n'est pas une étiquette « Commune V » / « District de Bamako »).
 */
export const localisationMali = (entree: EntreeLocalisationMali): LocalisationMali => {
  const commune = trouverCommuneMali(entree);
  const region = commune ? regionMali(commune.regionCode || commune.region) : regionMali(entree.region);
  const ville = region?.chefLieu || null;
  const nomCommune = commune?.nom || (region ? communeBrute(entree.commune) : null);
  const localiteBrute = (entree.localite || "").trim();
  const exclus = new Set([colle(ville || ""), colle(nomCommune || "")]);
  const localite = localiteBrute
    && !exclus.has(colle(localiteBrute))
    && !ETIQUETTE_BAMAKO.test(normaliserLocalisation(localiteBrute))
    ? casseSoignee(localiteBrute)
    : null;
  return {
    ville,
    villeNormalisee: normaliserLocalisation(ville || ""),
    localite,
    commune: nomCommune,
    communeCode: commune?.code || null,
    cercle: commune?.cercle || (region && entree.cercle ? casseSoignee(entree.cercle) : null),
    region: region?.nom || null,
    resolution: commune ? "commune" : region ? "region" : "aucune",
  };
};

/**
 * Clé de rapprochement des doublons au Mali. Avec une dizaine de villes
 * seulement, `type|ville|nom` rapprocherait des homonymes de communes
 * différentes : la commune (P-code, sinon nom) fait partie de la clé.
 * Sans commune connue, la clé porte la ville brute pour rester prudente.
 */
export const cleLocaliteRapprochementMali = (params: {
  villeNormalisee: string;
  communeCode?: string | null;
  commune?: string | null;
}) => {
  const commune = params.communeCode?.trim().toUpperCase() || cleCommuneMali(params.commune || "");
  return commune ? `${params.villeNormalisee}|${commune}` : `${params.villeNormalisee}|?`;
};

export type ReferenceVoisinMali = {
  latitude: number;
  longitude: number;
  communeCode: string;
};

const distanceMetres = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Commune déduite des plus proches fiches déjà localisées (k=5, 3 km,
 * au moins 3 voisins, unanimité) — même règle que le plan du 2026-09-29.
 */
export const communeParVoisinsMali = (
  point: { latitude: number | null; longitude: number | null },
  references: readonly ReferenceVoisinMali[],
  { k = 5, rayonMetres = 3_000, minimum = 3 } = {},
): CommuneMali | null => {
  if (typeof point.latitude !== "number" || typeof point.longitude !== "number") return null;
  const origine = { latitude: point.latitude, longitude: point.longitude };
  const voisins = references
    .map((reference) => ({ reference, distance: distanceMetres(origine, reference) }))
    .filter(({ distance }) => distance <= rayonMetres)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
  const codes = new Set(voisins.map(({ reference }) => reference.communeCode));
  if (voisins.length < minimum || codes.size !== 1) return null;
  return PAR_CODE.get([...codes][0].toUpperCase()) || null;
};

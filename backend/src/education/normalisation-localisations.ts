const normaliser = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const COMMUNE_BAMAKO = /^commune\s+(?:[1-6]|i{1,3}|iv|v|vi)(?:\s+(?:du\s+)?district(?:\s+de)?\s+bamako)?$/;
const DISTRICT_BAMAKO = /^(?:district(?:\s+de)?\s+)?bamako$/;
const QUARTIER_BAMAKO = /^bamako\b/;

export type VilleCanonique = {
  ville: string | null;
  villeNormalisee: string;
  modifiee: boolean;
};

export type ContexteAdministratifMali = {
  region?: string | null;
  cercle?: string | null;
  commune?: string | null;
};

/**
 * Le champ `ville` décrit la ville, pas la commune urbaine ni le quartier.
 * Les détails OSM restent disponibles dans la provenance brute de la source.
 */
export const villeCanoniqueMali = (
  valeur?: string | null,
  contexte: ContexteAdministratifMali = {},
): VilleCanonique => {
  const ville = valeur?.trim() || null;
  const villeNormalisee = normaliser(ville || "");
  const region = normaliser(contexte.region || "");
  const cercle = normaliser(contexte.cercle || "");
  const commune = normaliser(contexte.commune || "");
  const contexteBamako = (region === "bamako" || DISTRICT_BAMAKO.test(region))
    && (cercle === "bamako" || DISTRICT_BAMAKO.test(cercle))
    && COMMUNE_BAMAKO.test(commune);
  const estBamako = COMMUNE_BAMAKO.test(villeNormalisee)
    || DISTRICT_BAMAKO.test(villeNormalisee)
    || QUARTIER_BAMAKO.test(villeNormalisee)
    || contexteBamako;
  if (estBamako) {
    return {
      ville: "Bamako",
      villeNormalisee: "bamako",
      modifiee: ville !== "Bamako" || villeNormalisee !== "bamako",
    };
  }
  return { ville, villeNormalisee, modifiee: false };
};

export const villeNormaliseePourPays = (paysCode: string, valeur?: string | null): VilleCanonique => {
  if (paysCode.toUpperCase() === "ML") return villeCanoniqueMali(valeur);
  const ville = valeur?.trim() || null;
  return { ville, villeNormalisee: normaliser(ville || ""), modifiee: false };
};

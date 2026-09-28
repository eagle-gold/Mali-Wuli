export type DemarcheApresFormation =
  | "RECHERCHE_EMPLOI"
  | "POURSUITE_ETUDES"
  | "AUTRE_PROJET";

export type DelaiPremierEmploi =
  | "MOINS_3_MOIS"
  | "DE_3_A_6_MOIS"
  | "DE_7_A_12_MOIS"
  | "PLUS_12_MOIS"
  | "MOINS_DE_12_MOIS_DEPUIS_FIN"
  | "PAS_ENCORE";

export type LienEmploiFormation = "DIRECT" | "PARTIEL" | "AUCUN";

export type ReponseInsertion = {
  moisFin?: string | number | null;
  anneeFin?: string | number | null;
  demarcheApresFormation?: DemarcheApresFormation | null;
  delaiPremierEmploi?: DelaiPremierEmploi | null;
  emploiDansLes12Mois?: boolean | null;
  lienEmploiFormation?: LienEmploiFormation | null;
};

const DEMARCHES_VALIDES = new Set<DemarcheApresFormation>([
  "RECHERCHE_EMPLOI",
  "POURSUITE_ETUDES",
  "AUTRE_PROJET",
]);

const DELAIS_VALIDES = new Set<DelaiPremierEmploi>([
  "MOINS_3_MOIS",
  "DE_3_A_6_MOIS",
  "DE_7_A_12_MOIS",
  "PLUS_12_MOIS",
  "MOINS_DE_12_MOIS_DEPUIS_FIN",
  "PAS_ENCORE",
]);

const LIENS_VALIDES = new Set<LienEmploiFormation>(["DIRECT", "PARTIEL", "AUCUN"]);

const DELAIS_DANS_LES_12_MOIS = new Set<DelaiPremierEmploi>([
  "MOINS_3_MOIS",
  "DE_3_A_6_MOIS",
  "DE_7_A_12_MOIS",
]);

export const emploiTrouve = (delai?: DelaiPremierEmploi | null) =>
  Boolean(
    delai
    && DELAIS_VALIDES.has(delai)
    && delai !== "PAS_ENCORE"
    && delai !== "MOINS_DE_12_MOIS_DEPUIS_FIN",
  );

export const calculerEmploiDansLes12Mois = (
  delai?: DelaiPremierEmploi | null,
): boolean | null => {
  if (!delai || !DELAIS_VALIDES.has(delai) || delai === "MOINS_DE_12_MOIS_DEPUIS_FIN") return null;
  return DELAIS_DANS_LES_12_MOIS.has(delai);
};

export const reponseInsertionEstComplete = (reponse: ReponseInsertion) => {
  if (!reponse.demarcheApresFormation || !DEMARCHES_VALIDES.has(reponse.demarcheApresFormation)) return false;
  if (reponse.demarcheApresFormation !== "RECHERCHE_EMPLOI") return true;
  if (!reponse.delaiPremierEmploi || !DELAIS_VALIDES.has(reponse.delaiPremierEmploi)) return false;
  return !emploiTrouve(reponse.delaiPremierEmploi)
    || Boolean(reponse.lienEmploiFormation && LIENS_VALIDES.has(reponse.lienEmploiFormation));
};

export const ancienneteDepuisFinEnMois = (
  moisFin?: string | number | null,
  anneeFin?: string | number | null,
  maintenant = new Date(),
) => {
  const mois = Number(moisFin);
  const annee = Number(anneeFin);
  if (!dateValide(annee, mois)) return null;
  return (maintenant.getFullYear() - annee) * 12 + (maintenant.getMonth() + 1 - mois);
};

export const douzeMoisDepuisFinEcoules = (
  moisFin?: string | number | null,
  anneeFin?: string | number | null,
  maintenant = new Date(),
) => {
  const anciennete = ancienneteDepuisFinEnMois(moisFin, anneeFin, maintenant);
  return anciennete !== null && anciennete >= 12;
};

export const calculerTauxInsertion = (reponses: ReponseInsertion[], maintenant = new Date()) => {
  const reponsesExploitables = reponses.flatMap((reponse) => {
    if (reponse.demarcheApresFormation !== "RECHERCHE_EMPLOI"
      || !douzeMoisDepuisFinEcoules(reponse.moisFin, reponse.anneeFin, maintenant)) return [];
    const emploiDansLes12Mois = calculerEmploiDansLes12Mois(reponse.delaiPremierEmploi);
    return typeof emploiDansLes12Mois === "boolean" ? [emploiDansLes12Mois] : [];
  });
  const inseresDansLes12Mois = reponsesExploitables.filter(Boolean).length;

  return {
    inseresDansLes12Mois,
    repondants: reponsesExploitables.length,
    taux: reponsesExploitables.length
      ? Math.round((inseresDansLes12Mois / reponsesExploitables.length) * 100)
      : null,
  };
};

const anneeValide = (annee: number) =>
  Number.isInteger(annee) && annee >= 1900 && annee <= 2200;

const moisValide = (mois: number) => Number.isInteger(mois) && mois >= 1 && mois <= 12;

const dateValide = (annee: number, mois: number) => anneeValide(annee) && moisValide(mois);

/**
 * Retourne le premier jour du mois auquel un ancien élève peut déposer un avis.
 * Le recul commence après le départ de l’établissement. Un brevet obtenu
 * avant le bac, pendant la même scolarité, ne change pas cette date.
 */
export const dateOuvertureAvisEtablissementScolaire = (
  moisFin?: string | number | null,
  anneeFin?: string | number | null,
  _anneeObtention?: string | number | null,
) => {
  const mois = Number(moisFin);
  const fin = Number(anneeFin);
  if (!anneeValide(fin) || !moisValide(mois)) return null;

  return new Date(fin + 1, mois - 1, 1);
};

export const avisEtablissementScolaireEstDisponible = (
  statutDiplome: string,
  moisFin?: string | number | null,
  anneeFin?: string | number | null,
  anneeObtention?: string | number | null,
  maintenant = new Date(),
) => {
  if (statutDiplome !== "OBTENU") return false;
  const ouverture = dateOuvertureAvisEtablissementScolaire(
    moisFin,
    anneeFin,
    anneeObtention,
  );
  return Boolean(ouverture && ouverture.getTime() <= maintenant.getTime());
};

// Alias conservés pour les appels historiques. Les nouveaux écrans doivent
// utiliser les helpers génériques, communs aux écoles et aux lycées.
export const dateOuvertureAvisLycee = dateOuvertureAvisEtablissementScolaire;
export const avisLyceeEstDisponible = avisEtablissementScolaireEstDisponible;

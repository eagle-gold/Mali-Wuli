/** Titre affiché quand un membre n'a ni poste actuel, ni études supérieures en cours, ni titre à lui. */
export const TITRE_PAR_DEFAUT = "Membre du réseau";

/** Courte description d'un membre : son titre, ou le libellé par défaut. */
export function titreMembre(titre?: string | null) {
  return titre?.trim() || TITRE_PAR_DEFAUT;
}

/**
 * Titre d'un profil : la courte description affichée sous le nom, partout dans
 * le réseau (fil, commentaires, annuaire, messages), comme sur LinkedIn.
 * Le membre le saisit librement ; à défaut on propose un titre déduit de son
 * parcours, qu'il peut ensuite modifier.
 */
export const LONGUEUR_MAX_TITRE = 160;

type Nombre = string | number;
export type ExperienceTitre = {
  poste: string;
  structure: string;
  posteActuel: boolean;
  anneeDebut: Nombre;
  moisDebut: Nombre;
};
export type FormationTitre = { type: string; etablissement: string; statutDiplome: string };

const valeurDate = (annee: Nombre, mois: Nombre) => Number(annee) * 12 + Number(mois);

function tronquer(texte: string) {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= LONGUEUR_MAX_TITRE) return propre;
  let coupe = propre.slice(0, LONGUEUR_MAX_TITRE - 1);
  // Ne jamais laisser la moitié d'un caractère composé (emoji) : la base la refuserait.
  const dernier = coupe.charCodeAt(coupe.length - 1);
  if (dernier >= 0xd800 && dernier <= 0xdbff) coupe = coupe.slice(0, -1);
  return `${coupe.trimEnd()}…`;
}

/** « Poste chez Structure » pour le poste actuel le plus récent, sinon « Étudiant(e) à … » pour des études supérieures en cours. */
export function titreAutomatique(experiences: ExperienceTitre[], formations: FormationTitre[]): string | null {
  const actuelle = experiences
    .filter((experience) => experience.posteActuel && experience.poste.trim())
    .sort((a, b) => valeurDate(b.anneeDebut, b.moisDebut) - valeurDate(a.anneeDebut, a.moisDebut))[0];
  if (actuelle) {
    const structure = actuelle.structure.trim();
    return tronquer(structure ? `${actuelle.poste.trim()} chez ${structure}` : actuelle.poste);
  }
  const enCours = formations.find((formation) => formation.type === "universite" && formation.statutDiplome === "EN_COURS");
  if (enCours) {
    const etablissement = enCours.etablissement.trim();
    return tronquer(etablissement ? `Étudiant(e) à ${etablissement}` : "Étudiant(e)");
  }
  return null;
}

/**
 * Titre à enregistrer à la fin du questionnaire.
 * - saisi non vide : il l'emporte, sauf s'il est identique au titre que le
 *   parcours précédent produisait (donc jamais modifié par le membre) : il suit
 *   alors le nouveau parcours ;
 * - champ absent (ancien client) : le titre existant est conservé ;
 * - champ vide ou aucun titre existant : titre déduit du parcours (ou aucun).
 */
export function titreAEnregistrer(params: {
  saisi: string | undefined;
  existant: string | null | undefined;
  experiences: ExperienceTitre[];
  formations: FormationTitre[];
  /** Titre que le parcours enregistré jusqu'ici aurait produit (null si aucun). */
  ancienAutomatique?: string | null;
}): string | null {
  const saisi = params.saisi?.trim();
  if (saisi) {
    const resteAutomatique = Boolean(params.ancienAutomatique) && saisi === params.ancienAutomatique;
    if (!resteAutomatique) return tronquer(saisi);
    return titreAutomatique(params.experiences, params.formations);
  }
  const existant = params.existant?.trim();
  if (params.saisi === undefined && existant) return existant;
  return titreAutomatique(params.experiences, params.formations);
}

export type ExperienceBase = { poste: string; entreprise: string; estActuel: boolean; dateDebut: Date };
export type FormationBase = {
  type: string;
  statutDiplome: string;
  autreEtablissement: string | null;
  etablissement: { nom: string } | null;
};

/** Titre déduit d'un parcours déjà enregistré en base (même règle que le questionnaire). */
export function titreAutomatiqueDepuisBase(experiences: ExperienceBase[], formations: FormationBase[]): string | null {
  return titreAutomatique(
    experiences.map((experience) => ({
      poste: experience.poste,
      structure: experience.entreprise,
      posteActuel: experience.estActuel,
      anneeDebut: experience.dateDebut.getUTCFullYear(),
      moisDebut: experience.dateDebut.getUTCMonth() + 1,
    })),
    formations.map((formation) => ({
      type: formation.type,
      etablissement: formation.etablissement?.nom ?? formation.autreEtablissement ?? "",
      statutDiplome: formation.statutDiplome,
    })),
  );
}

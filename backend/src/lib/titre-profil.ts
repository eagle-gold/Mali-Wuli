/**
 * Titre d'un profil : la courte description affichée sous le nom, partout dans
 * le réseau (fil, commentaires, annuaire, messages), comme sur LinkedIn.
 *
 * Par défaut il est DYNAMIQUE : il suit le parcours du membre.
 *   - poste actuel                       → « Poste - Entreprise »
 *   - sinon études supérieures en cours  → « Étudiant(e) - Université »
 *   - sinon                              → « Membre du réseau »
 * Le membre peut le remplacer par ce qu'il veut. Un titre personnalisé est
 * alors marqué comme tel (Profil.titrePersonnalise) et n'est plus jamais
 * recalculé ; le membre peut revenir au titre par défaut à tout moment.
 */
export const LONGUEUR_MAX_TITRE = 160;
export const TITRE_PAR_DEFAUT = "Membre du réseau";

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

export function tronquerTitre(texte: string) {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= LONGUEUR_MAX_TITRE) return propre;
  let coupe = propre.slice(0, LONGUEUR_MAX_TITRE - 1);
  // Ne jamais laisser la moitié d'un caractère composé (emoji) : la base la refuserait.
  const dernier = coupe.charCodeAt(coupe.length - 1);
  if (dernier >= 0xd800 && dernier <= 0xdbff) coupe = coupe.slice(0, -1);
  return `${coupe.trimEnd()}…`;
}

/** Titre déduit du parcours, ou null s'il n'y a ni poste actuel ni études supérieures en cours. */
export function titreAutomatique(experiences: ExperienceTitre[], formations: FormationTitre[]): string | null {
  const actuelle = experiences
    .filter((experience) => experience.posteActuel && experience.poste.trim())
    .sort((a, b) => valeurDate(b.anneeDebut, b.moisDebut) - valeurDate(a.anneeDebut, a.moisDebut))[0];
  if (actuelle) {
    const structure = actuelle.structure.trim();
    return tronquerTitre(structure ? `${actuelle.poste.trim()} - ${structure}` : actuelle.poste);
  }
  const enCours = formations.find((formation) => formation.type === "universite" && formation.statutDiplome === "EN_COURS");
  if (enCours) {
    const etablissement = enCours.etablissement.trim();
    return tronquerTitre(etablissement ? `Étudiant(e) - ${etablissement}` : "Étudiant(e)");
  }
  return null;
}

/** Titre par défaut d'un parcours : toujours une valeur affichable. */
export function titreParDefaut(experiences: ExperienceTitre[], formations: FormationTitre[]): string {
  return titreAutomatique(experiences, formations) ?? TITRE_PAR_DEFAUT;
}

/**
 * Titre à montrer dans un document professionnel (CV, candidature) : le libellé
 * générique « Membre du réseau » n'y a pas sa place, l'appelant garde alors son propre repli.
 */
export function titreSignificatif(titre: string | null | undefined): string | null {
  const propre = titre?.trim();
  return propre && propre !== TITRE_PAR_DEFAUT ? propre : null;
}

export type TitreResolu = { titre: string; personnalise: boolean };

/**
 * Décide du titre à enregistrer.
 * - `saisi` non vide et différent du titre par défaut : titre personnalisé ;
 * - `saisi` vide ou identique au titre par défaut : retour au titre dynamique ;
 * - `saisi` absent (ancien client) : on ne touche pas à un titre personnalisé,
 *   un titre dynamique est simplement recalculé.
 */
export function resoudreTitre(params: {
  saisi: string | null | undefined;
  actuel: { titre: string | null; personnalise: boolean };
  defaut: string;
}): TitreResolu {
  const saisi = params.saisi == null ? params.saisi : tronquerTitre(params.saisi);
  if (saisi === undefined) {
    const garder = params.actuel.personnalise && Boolean(params.actuel.titre?.trim());
    return garder
      ? { titre: params.actuel.titre!.trim(), personnalise: true }
      : { titre: params.defaut, personnalise: false };
  }
  if (!saisi || saisi === params.defaut) return { titre: params.defaut, personnalise: false };
  return { titre: saisi, personnalise: true };
}

export type ExperienceBase = { poste: string; entreprise: string; estActuel: boolean; dateDebut: Date };
export type FormationBase = {
  type: string;
  statutDiplome: string;
  autreEtablissement: string | null;
  etablissement: { nom: string } | null;
};

/** Titre par défaut d'un parcours déjà enregistré en base (même règle que le questionnaire). */
export function titreParDefautDepuisBase(experiences: ExperienceBase[], formations: FormationBase[]): string {
  return titreParDefaut(
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

/** Sélection Prisma nécessaire pour calculer le titre par défaut d'un profil. */
export const selectionParcoursTitre = {
  experiences: { select: { poste: true, entreprise: true, estActuel: true, dateDebut: true } },
  formations: { select: { type: true, statutDiplome: true, autreEtablissement: true, etablissement: { select: { nom: true } } } },
} as const;

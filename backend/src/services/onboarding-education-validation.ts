import { TypeEtablissement } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type TypeFormationOnboarding = "ecole" | "lycee" | "universite";

export type FormationEducationSoumise = {
  type: TypeFormationOnboarding;
  pays: string;
  paysCode: string;
  systemeEducatifCode?: string;
  ville: string;
  etablissement: string;
  etablissementId: string;
  programme: string;
  programmeId: string;
  specialite: string;
  specialiteId?: string;
  diplome: string;
  diplomeId?: string;
};

export class ErreurCatalogueOnboarding extends Error {
  constructor(public readonly erreurs: string[]) {
    super(erreurs[0] || "Référence de formation invalide.");
    this.name = "ErreurCatalogueOnboarding";
  }
}

export const estIdCanonique = (id: string | null | undefined) =>
  Boolean(id?.trim() && !id!.startsWith("autre:"));

/**
 * Traduit le classement interne du catalogue vers les trois étapes visibles
 * de l'onboarding. Cette valeur vient exclusivement de la base, jamais du
 * type envoyé par le navigateur.
 */
export function typeFormationDepuisEtablissement(type: TypeEtablissement): TypeFormationOnboarding {
  if (type === TypeEtablissement.FONDAMENTALE) return "ecole";
  if (type === TypeEtablissement.LYCEE) return "lycee";
  return "universite";
}

const valeursUniques = (valeurs: Array<string | null | undefined>) => [
  ...new Set(valeurs.filter((valeur): valeur is string => Boolean(valeur))),
];

/**
 * Vérifie les identifiants canoniques avant toute règle métier (avis et taux
 * d'insertion), puis remplace les libellés/type/pays par leurs valeurs de base.
 * Les entrées explicitement « autre: » restent libres et ne sont pas publiées
 * comme des références canoniques.
 */
export async function verifierFormationsEducation<T extends FormationEducationSoumise>(
  formations: T[],
): Promise<T[]> {
  const idsEtablissements = valeursUniques(formations
    .filter(({ etablissementId }) => estIdCanonique(etablissementId))
    .map(({ etablissementId }) => etablissementId));
  const idsProgrammes = valeursUniques(formations.flatMap(({ programmeId, specialiteId }) => [
    estIdCanonique(programmeId) ? programmeId : null,
    estIdCanonique(specialiteId) ? specialiteId : null,
  ]));
  const idsDiplomes = valeursUniques(formations
    .map(({ diplomeId }) => estIdCanonique(diplomeId) ? diplomeId : null));
  const codesPays = valeursUniques(formations.flatMap(({ paysCode, systemeEducatifCode }) => [
    paysCode.toUpperCase(), systemeEducatifCode && systemeEducatifCode !== "AUTRE" ? systemeEducatifCode.toUpperCase() : null,
  ]));

  const [pays, etablissements, programmes, diplomes] = await Promise.all([
    prisma.paysEducation.findMany({
      where: { code: { in: codesPays } },
      select: { code: true, nom: true },
    }),
    prisma.etablissement.findMany({
      where: { id: { in: idsEtablissements } },
      select: {
        id: true,
        nom: true,
        type: true,
        paysCode: true,
        systemeEducatifCode: true,
        ville: true,
        valide: true,
        pays: { select: { nom: true } },
        programmes: {
          where: { actif: true },
          select: { programmeId: true, diplomeId: true },
        },
      },
    }),
    prisma.programmeEducation.findMany({
      where: { id: { in: idsProgrammes } },
      select: { id: true, nom: true, paysCode: true, parentId: true, actif: true },
    }),
    prisma.diplomeEducation.findMany({
      where: { id: { in: idsDiplomes } },
      select: { id: true, nom: true, paysCode: true, actif: true },
    }),
  ]);

  const paysParCode = new Map(pays.map((item) => [item.code, item]));
  const etablissementsParId = new Map(etablissements.map((item) => [item.id, item]));
  const programmesParId = new Map(programmes.map((item) => [item.id, item]));
  const diplomesParId = new Map(diplomes.map((item) => [item.id, item]));
  const erreurs: string[] = [];

  const resultat = formations.map((formation, index) => {
    const numero = index + 1;
    const paysCode = formation.paysCode.toUpperCase();
    const paysSoumis = paysParCode.get(paysCode);
    if (!paysSoumis) {
      erreurs.push(`Formation ${numero} : le pays sélectionné n'existe pas dans le catalogue.`);
    }

    const etablissement = estIdCanonique(formation.etablissementId)
      ? etablissementsParId.get(formation.etablissementId)
      : null;
    if (estIdCanonique(formation.etablissementId) && (!etablissement || !etablissement.valide)) {
      erreurs.push(`Formation ${numero} : l'établissement sélectionné est introuvable ou n'est plus disponible.`);
    }

    const typeCanonique = etablissement
      ? typeFormationDepuisEtablissement(etablissement.type)
      : formation.type;
    if (etablissement) {
      const categorieSuperieureSoumise = formation.type === "universite";
      const categorieSuperieureCanonique = typeCanonique === "universite";
      // École et lycée partagent le catalogue et les mêmes règles d'avis. Un
      // passage entre ces deux étapes est donc normalisé. En revanche, aucun
      // établissement scolaire ne peut être présenté comme supérieur (ou
      // inversement), car cela contournerait les règles d'avis/insertion.
      if (categorieSuperieureSoumise !== categorieSuperieureCanonique) {
        erreurs.push(`Formation ${numero} : le type envoyé ne correspond pas à l'établissement sélectionné.`);
      }
      if (etablissement.paysCode !== paysCode) {
        erreurs.push(`Formation ${numero} : le pays envoyé ne correspond pas à l'établissement sélectionné.`);
      }
    }

    const estScolaire = typeCanonique !== "universite";
    const systemeSoumis = formation.systemeEducatifCode?.trim().toUpperCase();
    if (systemeSoumis && systemeSoumis !== "AUTRE" && !paysParCode.has(systemeSoumis)) {
      erreurs.push(`Formation ${numero} : le programme scolaire sélectionné n'existe pas dans le catalogue.`);
    }
    const systemeEducatifCode = systemeSoumis || etablissement?.systemeEducatifCode || paysCode;
    // La localisation ne détermine pas le cursus : un établissement malien
    // suivant le programme français utilise uniquement les références FR.
    const codesReferentiel = new Set(estScolaire
      ? (systemeEducatifCode === "AUTRE" ? [] : [systemeEducatifCode])
      : [etablissement?.paysCode || paysCode,
        ...(etablissement?.systemeEducatifCode && etablissement.systemeEducatifCode !== "AUTRE"
          ? [etablissement.systemeEducatifCode] : [])]);
    const offres = estScolaire ? [] : etablissement?.programmes || [];
    const programme = estIdCanonique(formation.programmeId)
      ? programmesParId.get(formation.programmeId)
      : null;
    if (estIdCanonique(formation.programmeId)) {
      if (!programme?.actif) {
        erreurs.push(`Formation ${numero} : la formation choisie est introuvable ou inactive.`);
      } else if (
        offres.length > 0
        && !offres.some(({ programmeId }) => programmeId === programme.id)
      ) {
        erreurs.push(`Formation ${numero} : cette formation n'est pas rattachée à l'établissement sélectionné.`);
      } else if (!offres.length && programme.paysCode && !codesReferentiel.has(programme.paysCode)) {
        erreurs.push(`Formation ${numero} : cette formation ne correspond pas au référentiel de l'établissement.`);
      }
    }

    const specialite = estIdCanonique(formation.specialiteId)
      ? programmesParId.get(formation.specialiteId!)
      : null;
    if (estIdCanonique(formation.specialiteId)) {
      if (!specialite?.actif) {
        erreurs.push(`Formation ${numero} : la spécialité ou série choisie est introuvable ou inactive.`);
      } else if (programme && specialite.parentId !== programme.id) {
        erreurs.push(`Formation ${numero} : cette spécialité n'appartient pas à la formation sélectionnée.`);
      } else if (
        !programme
        && offres.length > 0
        && !offres.some(({ programmeId }) => programmeId === specialite.id)
      ) {
        erreurs.push(`Formation ${numero} : cette série n'est pas rattachée à l'établissement sélectionné.`);
      } else if (!programme && !offres.length && specialite.paysCode && !codesReferentiel.has(specialite.paysCode)) {
        erreurs.push(`Formation ${numero} : cette spécialité ne correspond pas au référentiel de l'établissement.`);
      }
    }

    const diplome = estIdCanonique(formation.diplomeId)
      ? diplomesParId.get(formation.diplomeId!)
      : null;
    if (estIdCanonique(formation.diplomeId)) {
      if (!diplome?.actif) {
        erreurs.push(`Formation ${numero} : le diplôme choisi est introuvable ou inactif.`);
      } else if (
        offres.length > 0
        && !offres.some((offre) => offre.diplomeId === diplome.id
          && (!programme || offre.programmeId === programme.id))
      ) {
        erreurs.push(`Formation ${numero} : ce diplôme n'est pas rattaché à la formation de cet établissement.`);
      } else if (!offres.length && !codesReferentiel.has(diplome.paysCode)) {
        erreurs.push(`Formation ${numero} : ce diplôme ne correspond pas au référentiel de l'établissement.`);
      }
    }

    return {
      ...formation,
      type: typeCanonique,
      paysCode: etablissement?.paysCode || paysCode,
      systemeEducatifCode,
      pays: etablissement?.pays.nom || paysSoumis?.nom || formation.pays,
      ville: etablissement?.ville || formation.ville,
      etablissement: etablissement?.nom || formation.etablissement,
      programme: programme?.nom || formation.programme,
      specialite: specialite?.nom || formation.specialite,
      diplome: diplome?.nom || formation.diplome,
    } as T;
  });

  if (erreurs.length) throw new ErreurCatalogueOnboarding(erreurs);
  return resultat;
}

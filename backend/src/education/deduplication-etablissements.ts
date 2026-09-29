import type { Prisma, PrismaClient, TypeEtablissement } from "@prisma/client";
import { normaliserEducation } from "./catalog-service";
import { villeCanoniqueMali } from "./normalisation-localisations";

const PREFIXE_GENERIQUE = /^(?:(?:ecole|ecoles)(?: fondamentale?s?| privee?s?| publique?s?| maternelle?s?| primaire?s?)?|groupes? scolaires?|complexes? scolaires?|etablissements? scolaires?)\s+/;
const ARTICLE_INITIAL = /^(?:le|la|les|l)\s+/;

/**
 * Nom utilisé uniquement pour rapprocher deux sources. Le libellé affiché reste
 * celui de la source canonique (ex. « École Les Lutins »).
 */
export const nomRapprochementEtablissement = (nom: string) =>
  normaliserEducation(nom)
    .replace(PREFIXE_GENERIQUE, "")
    .replace(ARTICLE_INITIAL, "")
    .trim();

/** Les six communes du district sont toutes des localisations de Bamako. */
export const villeRapprochementMali = (ville: string) => {
  return villeCanoniqueMali(ville).villeNormalisee;
};

export const cleRapprochementEtablissement = (params: {
  nom: string;
  type: TypeEtablissement;
  villeNormalisee: string;
}) => `${params.type}|${params.villeNormalisee}|${nomRapprochementEtablissement(params.nom)}`;

/** Fusion transactionnelle : les profils et toutes les provenances sont conservés. */
export async function fusionnerEtablissements(
  prisma: PrismaClient,
  canoniqueId: string,
  doublonId: string,
) {
  if (canoniqueId === doublonId) return;
  await prisma.$transaction((transaction) => fusionnerEtablissementsDansTransaction(transaction, canoniqueId, doublonId));
}

/**
 * Même fusion, exécutée dans une transaction fournie par l’appelant, afin de
 * regrouper plusieurs fusions et la réécriture des références sans clé
 * étrangère (snapshots, suggestions, forum) dans une seule unité atomique.
 */
export async function fusionnerEtablissementsDansTransaction(
  transaction: Prisma.TransactionClient,
  canoniqueId: string,
  doublonId: string,
) {
  if (canoniqueId === doublonId) return;

  // Lectures séquentielles : une transaction interactive n’utilise qu’une connexion.
  const canonique = await transaction.etablissement.findUniqueOrThrow({ where: { id: canoniqueId } });
  const doublon = await transaction.etablissement.findUniqueOrThrow({
    where: { id: doublonId },
    include: { alias: true, niveaux: true, programmes: true },
  });
  const typesScolaires = new Set<TypeEtablissement>(["FONDAMENTALE", "LYCEE"]);
  const typesCompatibles = canonique.type === doublon.type
    || (typesScolaires.has(canonique.type) && typesScolaires.has(doublon.type));
  if (canonique.paysCode !== doublon.paysCode || !typesCompatibles) {
    throw new Error("Fusion refusée : pays ou type d’établissement incompatibles.");
  }

  for (const niveau of doublon.niveaux) {
    await transaction.etablissementNiveau.upsert({
      where: { etablissementId_niveau: { etablissementId: canoniqueId, niveau: niveau.niveau } },
      create: { etablissementId: canoniqueId, niveau: niveau.niveau },
      update: {},
    });
  }

  const alias = [
    { nom: doublon.nom, nomNormalise: doublon.nomNormalise },
    ...doublon.alias.map(({ nom, nomNormalise }) => ({ nom, nomNormalise })),
  ];
  for (const item of alias) {
    await transaction.etablissementAlias.upsert({
      where: { etablissementId_nomNormalise: { etablissementId: canoniqueId, nomNormalise: item.nomNormalise } },
      create: { etablissementId: canoniqueId, nom: item.nom, nomNormalise: item.nomNormalise },
      update: { nom: item.nom },
    });
  }

  await transaction.formation.updateMany({ where: { etablissementId: doublonId }, data: { etablissementId: canoniqueId } });
  await transaction.avisEtablissement.updateMany({ where: { etablissementId: doublonId }, data: { etablissementId: canoniqueId } });
  await transaction.etablissementSource.updateMany({ where: { etablissementId: doublonId }, data: { etablissementId: canoniqueId } });

  for (const offre of doublon.programmes) {
    const offreCanonique = await transaction.etablissementProgramme.findFirst({
      where: {
        etablissementId: canoniqueId,
        programmeId: offre.programmeId,
        diplomeId: offre.diplomeId,
      },
    });
    if (offreCanonique) {
      await transaction.offreFormationSource.updateMany({
        where: { offreId: offre.id },
        data: { offreId: offreCanonique.id },
      });
      await transaction.etablissementProgramme.delete({ where: { id: offre.id } });
    } else {
      await transaction.etablissementProgramme.update({
        where: { id: offre.id },
        data: { etablissementId: canoniqueId },
      });
    }
  }

  await transaction.etablissement.update({
    where: { id: canoniqueId },
    data: {
      siteWeb: canonique.siteWeb || doublon.siteWeb,
      latitude: canonique.latitude || doublon.latitude,
      longitude: canonique.longitude || doublon.longitude,
    },
  });
  await transaction.etablissement.update({ where: { id: doublonId }, data: { valide: false } });
}

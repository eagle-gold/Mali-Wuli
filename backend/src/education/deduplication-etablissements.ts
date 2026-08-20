import type { PrismaClient, TypeEtablissement } from "@prisma/client";
import { normaliserEducation } from "./catalog-service";

const PREFIXE_GENERIQUE = /^(?:(?:ecole|ecoles)(?: fondamentale?s?| privee?s?| publique?s?| maternelle?s?| primaire?s?)?|groupes? scolaires?|complexes? scolaires?|etablissements? scolaires?)\s+/;
const ARTICLE_INITIAL = /^(?:le|la|les|l)\s+/;
const COMMUNE_BAMAKO = /^commune\s+(?:[1-6]|i{1,3}|iv|v|vi)$/;

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
  const villeNormalisee = normaliserEducation(ville);
  return COMMUNE_BAMAKO.test(villeNormalisee) ? "bamako" : villeNormalisee;
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

  const [canonique, doublon] = await Promise.all([
    prisma.etablissement.findUniqueOrThrow({ where: { id: canoniqueId } }),
    prisma.etablissement.findUniqueOrThrow({
      where: { id: doublonId },
      include: { alias: true, niveaux: true, programmes: true },
    }),
  ]);
  if (canonique.paysCode !== doublon.paysCode || canonique.type !== doublon.type) {
    throw new Error("Fusion refusée : pays ou type d’établissement incompatibles.");
  }

  await prisma.$transaction(async (transaction) => {
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
  });
}

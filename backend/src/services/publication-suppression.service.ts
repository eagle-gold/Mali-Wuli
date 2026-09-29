import { Prisma, type PrismaClient } from "@prisma/client";
import { COMMENTAIRE_ACTIF } from "./corbeille.service";

export class ErreurSuppressionPublication extends Error {
  constructor(public readonly statut: number, message: string) { super(message); }
}
export type ActeurPublication = { profilId: string; permissions: readonly string[] };
export const peutSupprimerPublication = (auteurId: string, acteur: ActeurPublication) =>
  auteurId === acteur.profilId || acteur.permissions.includes("PUBLICATIONS_MODERER");
export const peutSupprimerCommentaire = (auteurId: string, auteurPublicationId: string, acteur: ActeurPublication) =>
  auteurId === acteur.profilId || peutSupprimerPublication(auteurPublicationId, acteur);

/**
 * Suppression logique (corbeille 30 jours) : `deletedAt`/`deletedById` sont posés,
 * rien n'est effacé ; les médias restent en place pour permettre la restauration.
 * La purge (`purgerCorbeille`) efface physiquement après 30 jours.
 */
export function creerServiceSuppressionsPublications(db: PrismaClient, options: { maintenant?: () => Date } = {}) {
  const maintenant = options.maintenant || (() => new Date());
  async function supprimer(id: string, acteur: ActeurPublication) {
    return db.$transaction(async (tx) => {
      const publication = await tx.publication.findFirst({
        where: { id, deletedAt: null }, select: { id: true, auteurId: true, photoUrl: true },
      });
      if (!publication) throw new ErreurSuppressionPublication(404, "Publication introuvable.");
      if (!peutSupprimerPublication(publication.auteurId, acteur)) throw new ErreurSuppressionPublication(403, "Vous ne pouvez pas supprimer cette publication.");
      await tx.publication.update({ where: { id }, data: { deletedAt: maintenant(), deletedById: acteur.profilId } });
      return { auteurId: publication.auteurId, parAuteur: publication.auteurId === acteur.profilId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async function supprimerCommentaire(publicationId: string, commentaireId: string, acteur: ActeurPublication) {
    return db.$transaction(async (tx) => {
      const commentaire = await tx.commentairePublication.findFirst({
        where: { id: commentaireId, publicationId, ...COMMENTAIRE_ACTIF, publication: { deletedAt: null } },
        select: { id: true, auteurId: true, publication: { select: { auteurId: true } } },
      });
      if (!commentaire) throw new ErreurSuppressionPublication(404, "Commentaire introuvable.");
      if (!peutSupprimerCommentaire(commentaire.auteurId, commentaire.publication.auteurId, acteur)) {
        throw new ErreurSuppressionPublication(403, "Vous ne pouvez pas supprimer ce commentaire.");
      }
      await tx.commentairePublication.update({ where: { id: commentaire.id }, data: { deletedAt: maintenant(), deletedById: acteur.profilId } });
      return tx.commentairePublication.count({ where: { publicationId, ...COMMENTAIRE_ACTIF } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  return { supprimer, supprimerCommentaire };
}

import { Prisma, type PrismaClient } from "@prisma/client";

export class ErreurSuppressionPublication extends Error {
  constructor(public readonly statut: number, message: string) { super(message); }
}
export type ActeurPublication = { profilId: string; permissions: readonly string[] };
export const peutSupprimerPublication = (auteurId: string, acteur: ActeurPublication) =>
  auteurId === acteur.profilId || acteur.permissions.includes("PUBLICATIONS_MODERER");
export const peutSupprimerCommentaire = (auteurId: string, auteurPublicationId: string, acteur: ActeurPublication) =>
  auteurId === acteur.profilId || peutSupprimerPublication(auteurPublicationId, acteur);

/** Les fichiers et événements temps réel ne sont traités par la route qu'après commit. */
export function creerServiceSuppressionsPublications(db: PrismaClient) {
  async function supprimer(id: string, acteur: ActeurPublication) {
    return db.$transaction(async (tx) => {
      const publication = await tx.publication.findUnique({
        where: { id }, select: { id: true, auteurId: true, photoUrl: true },
      });
      if (!publication) throw new ErreurSuppressionPublication(404, "Publication introuvable.");
      if (!peutSupprimerPublication(publication.auteurId, acteur)) throw new ErreurSuppressionPublication(403, "Vous ne pouvez pas supprimer cette publication.");
      // Les réactions, commentaires et réponses ont déjà des FK ON DELETE CASCADE.
      await tx.publication.delete({ where: { id } });
      return publication.photoUrl;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async function supprimerCommentaire(publicationId: string, commentaireId: string, acteur: ActeurPublication) {
    return db.$transaction(async (tx) => {
      const commentaire = await tx.commentairePublication.findFirst({
        where: { id: commentaireId, publicationId },
        select: { id: true, auteurId: true, publication: { select: { auteurId: true } } },
      });
      if (!commentaire) throw new ErreurSuppressionPublication(404, "Commentaire introuvable.");
      if (!peutSupprimerCommentaire(commentaire.auteurId, commentaire.publication.auteurId, acteur)) {
        throw new ErreurSuppressionPublication(403, "Vous ne pouvez pas supprimer ce commentaire.");
      }
      await tx.commentairePublication.delete({ where: { id: commentaire.id } });
      return tx.commentairePublication.count({ where: { publicationId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  return { supprimer, supprimerCommentaire };
}

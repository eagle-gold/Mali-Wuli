import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { emailAdminPrincipal } from "../lib/roles";
import { supprimerPieceJointe } from "../lib/pieces-jointes";
import { supprimerUpload } from "../middlewares/upload.middleware";

/**
 * Suppression définitive d'un compte (droit à l'effacement, RGPD art. 17).
 *
 * Décision produit (2026-10-31) : le compte et toutes les données personnelles
 * sont supprimés ; les contenus que le membre a publiés (publications,
 * commentaires, réactions, offres, événements organisés, photos) le sont aussi.
 * Les conversations privées disparaissent ; dans un groupe, seuls ses messages
 * et sa participation sont retirés. Les fichiers envoyés sont effacés du disque
 * après validation de la transaction.
 */

export class SuppressionCompteImpossible extends Error {}

/** La confirmation exige l'adresse exacte du compte (casse et espaces ignorés). */
export function confirmationValide(saisie: unknown, emailCompte: string) {
  return typeof saisie === "string" && saisie.trim().toLowerCase() === emailCompte.trim().toLowerCase();
}

type Tx = Prisma.TransactionClient;

async function supprimerDonneesProfil(tx: Tx, profilId: string, userId: string, fichiers: string[], piecesJointes: string[]) {
  const auteurs = [profilId, userId];

  // Messagerie : conversations privées supprimées, groupes conservés sans lui.
  const adhesions = await tx.conversationMembre.findMany({
    where: { profilId },
    select: { conversationId: true, conversation: { select: { estGroupe: true } } },
  });
  const privees = adhesions.filter((a) => !a.conversation.estGroupe).map((a) => a.conversationId);
  // Pièces jointes des messages supprimés (stockage privé), effacées après validation.
  const pieces = await tx.pieceJointeMessage.findMany({
    where: { message: { OR: [{ conversationId: { in: privees } }, { auteurId: profilId }] } },
    select: { fichier: true },
  });
  piecesJointes.push(...pieces.map((piece) => piece.fichier));
  if (privees.length) {
    await tx.message.deleteMany({ where: { conversationId: { in: privees } } });
    await tx.conversationMembre.deleteMany({ where: { conversationId: { in: privees } } });
    await tx.conversation.deleteMany({ where: { id: { in: privees } } });
  }
  await tx.message.deleteMany({ where: { auteurId: profilId } });
  await tx.conversationMembre.deleteMany({ where: { profilId } });

  // Mise en relation et mentorat.
  await tx.synergie.deleteMany({ where: { OR: [{ demandeurId: profilId }, { recepteurId: profilId }] } });
  await tx.rendezVous.deleteMany({ where: { OR: [{ demandeurId: profilId }, { volontaire: { profilId } }] } });

  // Événements organisés : supprimés avec participants et photos.
  const evenements = await tx.evenement.findMany({
    where: { organisateurId: profilId },
    select: { id: true, photoCouverture: true, photos: { select: { url: true } } },
  });
  for (const evenement of evenements) {
    if (evenement.photoCouverture) fichiers.push(evenement.photoCouverture);
    fichiers.push(...evenement.photos.map((photo) => photo.url));
  }
  const idsEvenements = evenements.map((evenement) => evenement.id);
  if (idsEvenements.length) {
    await tx.evenementParticipant.deleteMany({ where: { evenementId: { in: idsEvenements } } });
    await tx.evenement.deleteMany({ where: { id: { in: idsEvenements } } });
  }
  const photos = await tx.evenementPhoto.findMany({ where: { auteurId: profilId }, select: { url: true } });
  fichiers.push(...photos.map((photo) => photo.url));
  await tx.evenementPhoto.deleteMany({ where: { auteurId: profilId } });
  await tx.evenementParticipant.deleteMany({ where: { profilId } });

  // Associations : affiliations retirées, responsabilité libérée.
  await tx.associationMembre.deleteMany({ where: { profilId } });
  await tx.association.updateMany({ where: { responsableId: profilId }, data: { responsableId: null } });

  // Offres publiées (candidatures et enregistrements suivent en cascade).
  await tx.offre.deleteMany({ where: { publieurId: profilId } });

  // Signalements émis par le membre.
  await tx.signalement.deleteMany({ where: { signaleurId: profilId } });

  // Fonctionnalités historiques sans clé étrangère.
  await tx.cercleMembre.deleteMany({ where: { profilId } });
  await tx.cercleMessage.deleteMany({ where: { auteurId: { in: auteurs } } });
  const questions = await tx.forumQuestion.findMany({ where: { auteurId: { in: auteurs } }, select: { id: true } });
  await tx.forumReponse.deleteMany({
    where: { OR: [{ auteurId: { in: auteurs } }, { questionId: { in: questions.map((question) => question.id) } }] },
  });
  await tx.forumQuestion.deleteMany({ where: { auteurId: { in: auteurs } } });
  await tx.annonce.deleteMany({ where: { auteurId: { in: auteurs } } });

  // Photos des publications, puis le profil : formations, expériences,
  // volontariat, publications, commentaires, réactions, candidatures et
  // notifications suivent en cascade.
  const publications = await tx.publication.findMany({
    where: { auteurId: profilId, photoUrl: { not: null } },
    select: { photoUrl: true },
  });
  fichiers.push(...publications.map((publication) => publication.photoUrl!));
  await tx.profil.delete({ where: { id: profilId } });
}

export async function supprimerCompte(userId: string) {
  const fichiers: string[] = [];
  const piecesJointes: string[] = [];

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, profil: { select: { id: true, photo: true, photoCouverture: true } } },
    });
    if (!user) throw new SuppressionCompteImpossible("Compte introuvable.");
    if (emailAdminPrincipal(user.email)) {
      throw new SuppressionCompteImpossible("Le compte de l’administrateur principal ne peut pas être supprimé.");
    }

    if (user.profil) {
      if (user.profil.photo) fichiers.push(user.profil.photo);
      if (user.profil.photoCouverture) fichiers.push(user.profil.photoCouverture);
      await supprimerDonneesProfil(tx, user.profil.id, user.id, fichiers, piecesJointes);
    }

    await tx.user.updateMany({ where: { parrainId: user.id }, data: { parrainId: null } });
    await tx.suggestionCatalogue.updateMany({ where: { valideParId: user.id }, data: { valideParId: null } });
    await tx.signalement.updateMany({ where: { traiteParId: user.id }, data: { traiteParId: null } });
    await tx.jetonRevoque.deleteMany({ where: { userId: user.id } });
    await tx.emailVerification.deleteMany({ where: { email: user.email } });
    await tx.loginOtpCode.deleteMany({ where: { email: user.email } });
    await tx.passwordResetCode.deleteMany({ where: { email: user.email } });
    // Les rôles délégués suivent en cascade.
    await tx.user.delete({ where: { id: user.id } });
  }, { timeout: 30_000 });

  // Après validation seulement : un échec de transaction ne doit effacer aucun fichier.
  for (const fichier of new Set(fichiers)) {
    try { supprimerUpload(fichier); } catch (err) { console.error("Fichier non supprimé après suppression de compte", err); }
  }
  for (const fichier of new Set(piecesJointes)) supprimerPieceJointe(fichier);
}

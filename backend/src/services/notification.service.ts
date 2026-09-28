import { Prisma, TypeNotification } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { emettreUtilisateur } from "../realtime/socket";

export type NouvelleNotification = {
  destinataireId: string;
  acteurId?: string | null;
  type: TypeNotification;
  titre: string;
  detail: string;
  href?: string | null;
  payload?: Prisma.InputJsonValue;
};

const acteurSelect = {
  id: true,
  photo: true,
  user: { select: { prenom: true, nom: true } },
} as const;

export async function creerNotification(donnees: NouvelleNotification) {
  if (donnees.acteurId && donnees.acteurId === donnees.destinataireId) return null;

  const destinataire = await prisma.profil.findUnique({
    where: { id: donnees.destinataireId },
    select: { userId: true },
  });
  if (!destinataire) return null;

  const notification = await prisma.notification.create({
    data: {
      destinataireId: donnees.destinataireId,
      acteurId: donnees.acteurId || null,
      type: donnees.type,
      titre: donnees.titre.slice(0, 191),
      detail: donnees.detail,
      href: donnees.href || null,
      payload: donnees.payload,
    },
    select: {
      id: true,
      type: true,
      titre: true,
      detail: true,
      href: true,
      payload: true,
      lue: true,
      createdAt: true,
      acteur: { select: acteurSelect },
    },
  });

  emettreUtilisateur(destinataire.userId, "nouvelle_notification", notification);
  return notification;
}

export async function creerNotifications(notifications: NouvelleNotification[]) {
  const resultats = await Promise.allSettled(
    notifications.map((notification) => creerNotification(notification)),
  );
  const echecs = resultats.filter((resultat) => resultat.status === "rejected");
  if (echecs.length > 0) {
    console.error(`[notifications] ${echecs.length} notification(s) n'ont pas pu être créées.`);
  }
  return resultats.flatMap((resultat) => resultat.status === "fulfilled" ? [resultat.value] : []);
}

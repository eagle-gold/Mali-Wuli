import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middlewares/auth.middleware";

const router = Router();

const listeSchema = z.object({
  cursor: z.string().trim().min(1).max(191).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

async function profilConnecte(userId?: string) {
  if (!userId) return null;
  return prisma.profil.findUnique({ where: { userId }, select: { id: true } });
}

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const query = listeSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Pagination invalide." });

  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });

    const [notifications, nonLues] = await Promise.all([
      prisma.notification.findMany({
        where: { destinataireId: profil.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.data.limite + 1,
        ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          type: true,
          titre: true,
          detail: true,
          href: true,
          payload: true,
          lue: true,
          createdAt: true,
          acteur: {
            select: {
              id: true,
              photo: true,
              user: { select: { prenom: true, nom: true } },
            },
          },
        },
      }),
      prisma.notification.count({ where: { destinataireId: profil.id, lue: false } }),
    ]);

    const hasMore = notifications.length > query.data.limite;
    const donnees = hasMore ? notifications.slice(0, query.data.limite) : notifications;
    return res.json({
      notifications: donnees,
      nonLues,
      hasMore,
      nextCursor: hasMore ? donnees[donnees.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("[GET /notifications]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/non-lues", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const nonLues = await prisma.notification.count({ where: { destinataireId: profil.id, lue: false } });
    return res.json({ nonLues });
  } catch (error) {
    console.error("[GET /notifications/non-lues]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.patch("/tout-lire", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const resultat = await prisma.notification.updateMany({
      where: { destinataireId: profil.id, lue: false },
      data: { lue: true },
    });
    return res.json({ misesAJour: resultat.count });
  } catch (error) {
    console.error("[PATCH /notifications/tout-lire]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.patch("/:id/lire", authenticate, async (req: AuthRequest, res: Response) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Identifiant invalide." });

  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const notification = await prisma.notification.findUnique({ where: { id: id.data } });
    if (!notification || notification.destinataireId !== profil.id) {
      return res.status(404).json({ message: "Notification introuvable." });
    }
    const miseAJour = await prisma.notification.update({ where: { id: id.data }, data: { lue: true } });
    return res.json({ notification: miseAJour });
  } catch (error) {
    console.error("[PATCH /notifications/:id/lire]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;

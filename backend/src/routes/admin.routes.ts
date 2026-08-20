import { StatutSuggestionCatalogue } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { publierSuggestion } from "../education/catalog-suggestion-service";
import { prismaEducation } from "../education/catalog-service";
import { authenticate, requireRole, type AuthRequest } from "../middlewares/auth.middleware";

const router = Router();

const isAdmin = [authenticate, requireRole("ADMIN", "MODERATEUR")];

router.get("/inscriptions", ...isAdmin, async (_req, res) => {
  res.json({ message: "Inscriptions en attente — à implémenter" });
});

router.put("/inscriptions/:id/valider", ...isAdmin, async (_req, res) => {
  res.json({ message: "Valider inscription — à implémenter" });
});

router.put("/inscriptions/:id/refuser", ...isAdmin, async (_req, res) => {
  res.json({ message: "Refuser inscription — à implémenter" });
});

router.get("/signalements", ...isAdmin, async (_req, res) => {
  res.json({ message: "Signalements — à implémenter" });
});

router.get("/stats", ...isAdmin, async (_req, res) => {
  res.json({ message: "Statistiques — à implémenter" });
});

router.get("/notifications", ...isAdmin, async (_req, res) => {
  try {
    const notifications = await prismaEducation.notificationAdmin.findMany({
      where: { traitee: false },
      include: {
        suggestion: {
          include: {
            contributions: {
              orderBy: { createdAt: "asc" },
              select: { id: true, libelleBrut: true, createdAt: true },
            },
          },
        },
      },
      orderBy: [{ lue: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    const notificationsEnrichies = await Promise.all(notifications.map(async (notification) => {
      const suggestion = notification.suggestion;
      if (!suggestion.candidatId) return { ...notification, suggestion: { ...suggestion, candidat: null } };
      const candidat = suggestion.type === "ETABLISSEMENT"
        ? await prismaEducation.etablissement.findUnique({
            where: { id: suggestion.candidatId },
            select: { id: true, nom: true },
          })
        : suggestion.type === "DIPLOME"
          ? await prismaEducation.diplomeEducation.findUnique({
              where: { id: suggestion.candidatId },
              select: { id: true, nom: true },
            })
          : await prismaEducation.programmeEducation.findUnique({
              where: { id: suggestion.candidatId },
              select: { id: true, nom: true },
            });
      return {
        ...notification,
        suggestion: {
          ...suggestion,
          candidat: candidat ? { id: candidat.id, libelle: candidat.nom } : null,
        },
      };
    }));
    res.json({ notifications: notificationsEnrichies });
  } catch (error) {
    console.error("Notifications admin :", error instanceof Error ? error.message : error);
    res.status(500).json({ message: "Impossible de charger les notifications." });
  }
});

router.get("/catalogue/suggestions", ...isAdmin, async (req, res) => {
  const statut = z.nativeEnum(StatutSuggestionCatalogue).safeParse(req.query.statut);
  try {
    const suggestions = await prismaEducation.suggestionCatalogue.findMany({
      where: statut.success ? { statut: statut.data } : undefined,
      include: { contributions: { select: { id: true, libelleBrut: true, createdAt: true } } },
      orderBy: [{ nombreContributeurs: "desc" }, { updatedAt: "desc" }],
      take: 200,
    });
    res.json({ suggestions });
  } catch (error) {
    console.error("Suggestions admin :", error instanceof Error ? error.message : error);
    res.status(500).json({ message: "Impossible de charger les propositions." });
  }
});

router.put(
  "/catalogue/suggestions/:id/accepter",
  ...isAdmin,
  async (req: AuthRequest, res) => {
    const body = z.object({ fusionnerAvecId: z.string().trim().min(1).optional() }).safeParse(req.body);
    if (!body.success || !req.userId) {
      res.status(400).json({ message: "Décision invalide." });
      return;
    }
    try {
      const suggestion = await publierSuggestion(
        String(req.params.id),
        req.userId,
        body.data.fusionnerAvecId,
      );
      res.json({ message: "Proposition publiée dans le catalogue.", suggestion });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Validation impossible.";
      res.status(message.includes("déjà été traitée") ? 409 : 400).json({ message });
    }
  },
);

router.put(
  "/catalogue/suggestions/:id/refuser",
  ...isAdmin,
  async (req: AuthRequest, res) => {
    if (!req.userId) {
      res.status(401).json({ message: "Identification requise." });
      return;
    }
    try {
      const resultat = await prismaEducation.suggestionCatalogue.updateMany({
        where: {
          id: String(req.params.id),
          statut: {
            in: [StatutSuggestionCatalogue.EN_ATTENTE, StatutSuggestionCatalogue.A_VALIDER],
          },
        },
        data: {
          statut: StatutSuggestionCatalogue.REFUSEE,
          valideParId: req.userId,
          valideLe: new Date(),
        },
      });
      if (!resultat.count) {
        res.status(409).json({ message: "Cette proposition a déjà été traitée." });
        return;
      }
      await prismaEducation.notificationAdmin.updateMany({
        where: { suggestionId: String(req.params.id) },
        data: { lue: true, traitee: true },
      });
      res.json({ message: "Proposition refusée." });
    } catch {
      res.status(404).json({ message: "Proposition introuvable." });
    }
  },
);

router.put("/notifications/:id/lire", ...isAdmin, async (req, res) => {
  try {
    await prismaEducation.notificationAdmin.update({
      where: { id: String(req.params.id) },
      data: { lue: true },
    });
    res.json({ message: "Notification lue." });
  } catch {
    res.status(404).json({ message: "Notification introuvable." });
  }
});

export default router;

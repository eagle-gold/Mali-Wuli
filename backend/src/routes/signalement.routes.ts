import type { PrismaClient } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, type AuthRequest } from "../middlewares/auth.middleware";
import { creationSignalementSchema, creerServiceSignalements, ErreurSignalement, type ServiceSignalements } from "../services/signalement.service";

/** POST /api/signalements — tout membre validé (les comptes refusés/suspendus/en attente sont bloqués par `authenticate`). */
export function creerRouteurSignalements(options: { db?: PrismaClient; service?: ServiceSignalements } = {}) {
  const service = options.service || creerServiceSignalements(options.db || prisma);
  const router = Router();
  router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
    const donnees = creationSignalementSchema.safeParse(req.body);
    if (!donnees.success) return res.status(400).json({ message: "Signalement invalide.", erreurs: donnees.error.flatten().fieldErrors });
    try {
      const signalement = await service.signaler(req.userId!, donnees.data);
      return res.status(201).json({ message: "Merci, votre signalement a été transmis à l'équipe de modération.", signalement });
    } catch (error) {
      if (error instanceof ErreurSignalement) return res.status(error.statut).json({ message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Signalement invalide." });
      if (error && typeof error === "object" && "code" in error && error.code === "P2034") return res.status(409).json({ message: "Signalement déjà en cours d'envoi. Réessayez." });
      console.error("[POST /signalements]", error);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  });
  return router;
}
export default creerRouteurSignalements();

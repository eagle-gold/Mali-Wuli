import type { PrismaClient } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, type AuthRequest } from "../middlewares/auth.middleware";
import { supprimerUpload } from "../middlewares/upload.middleware";
import { obtenirSocket } from "../realtime/socket";
import { creerServiceCorbeille, ErreurCorbeille, TYPES_CORBEILLE } from "../services/corbeille.service";

/** Corbeille 30 jours des publications et commentaires. Injection pour des tests sans base/fichiers/socket. */
export function creerRouteurCorbeille(options: {
  db?: PrismaClient;
  retirerMedia?: typeof supprimerUpload;
  obtenirSocket?: typeof obtenirSocket;
  maintenant?: () => Date;
} = {}) {
  const db = options.db || prisma;
  const retirerMedia = options.retirerMedia || supprimerUpload;
  const socket = options.obtenirSocket || obtenirSocket;
  const corbeille = creerServiceCorbeille(db, { maintenant: options.maintenant });
  const router = Router();
  const paramsSchema = z.object({ type: z.string().trim().toLowerCase(), id: z.string().trim().min(1).max(191) });

  async function profilDe(userId?: string) {
    return userId ? db.profil.findUnique({ where: { userId }, select: { id: true } }) : null;
  }
  function erreur(res: Response, error: unknown, contexte: string) {
    if (error instanceof ErreurCorbeille) return res.status(error.statut).json({ message: error.message });
    console.error(`[corbeille] ${contexte}`, error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
  function lireParams(req: AuthRequest) {
    const params = paramsSchema.safeParse(req.params);
    const type = params.success ? TYPES_CORBEILLE[params.data.type] : undefined;
    return params.success && type ? { type, id: params.data.id } : null;
  }

  router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const profil = await profilDe(req.userId);
      if (!profil) return res.status(404).json({ message: "Profil introuvable." });
      return res.json(await corbeille.lister(profil.id));
    } catch (error) { return erreur(res, error, "GET /corbeille"); }
  });

  router.post("/:type/:id/restaurer", authenticate, async (req: AuthRequest, res: Response) => {
    const params = lireParams(req);
    if (!params) return res.status(400).json({ message: "Élément invalide (publication ou commentaire attendu)." });
    try {
      const profil = await profilDe(req.userId);
      if (!profil) return res.status(404).json({ message: "Profil introuvable." });
      const resultat = await corbeille.restaurer(params.type, params.id, profil.id);
      try {
        socket()?.emit(params.type === "publication" ? "publication:restored" : "publication:commentRestored", resultat);
      } catch { console.error("[corbeille] Diffusion de la restauration différée."); }
      return res.json({ message: params.type === "publication" ? "Publication restaurée." : "Commentaire restauré.", ...resultat });
    } catch (error) { return erreur(res, error, "POST /corbeille/:type/:id/restaurer"); }
  });

  router.delete("/:type/:id", authenticate, async (req: AuthRequest, res: Response) => {
    const params = lireParams(req);
    if (!params) return res.status(400).json({ message: "Élément invalide (publication ou commentaire attendu)." });
    try {
      const profil = await profilDe(req.userId);
      if (!profil) return res.status(404).json({ message: "Profil introuvable." });
      const { photoUrl } = await corbeille.effacer(params.type, params.id, profil.id);
      if (photoUrl) {
        try { retirerMedia(photoUrl); } catch { console.error("[corbeille] Nettoyage média après effacement différé."); }
      }
      return res.json({ message: "Élément effacé définitivement.", type: params.type, id: params.id });
    } catch (error) { return erreur(res, error, "DELETE /corbeille/:type/:id"); }
  });

  return router;
}
export default creerRouteurCorbeille();

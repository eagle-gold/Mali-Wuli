import { Prisma } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, type AuthRequest, requirePermission } from "../middlewares/auth.middleware";
import { emettreUtilisateur, obtenirSocket } from "../realtime/socket";
import { creerNotification } from "../services/notification.service";
import { genererProfilCandidaturePdf } from "../services/profil-candidature.service";
import { envoyerCandidatureEmail } from "../services/email.service";
import { creerServiceOffres, ErreurOffre, champsOffreSchema, modifierOffreSchema, listeOffresSchema, candidatureSchema, revisionOffreSchema, type ActeurOffre, type ServiceOffres } from "../services/offre.service";
import { creerServiceCandidatures, type ServiceCandidatures } from "../services/candidature.service";

const serviceProduction = creerServiceOffres(prisma, { notifier: creerNotification, emettre: emettreUtilisateur });
const candidaturesProduction = creerServiceCandidatures(prisma, {
  genererPdf: genererProfilCandidaturePdf, envoyerEmail: envoyerCandidatureEmail, notifier: creerNotification,
  nouveauMessage: (message, destinataireUserId, auteurUserId) => {
    const io = obtenirSocket(); if (!io) return;
    const salle = `conversation:${message.conversationId}`;
    for (const evenement of ["nouveau_message", "message:created"]) {
      io.to(salle).emit(evenement, message);
      io.to(`user:${destinataireUserId}`).except(salle).emit(evenement, message);
      io.to(`user:${auteurUserId}`).except(salle).emit(evenement, { ...message, estMoi: true });
    }
  },
});
export function creerRouteurOffres(service: ServiceOffres = serviceProduction, candidatures: ServiceCandidatures = candidaturesProduction) {
  const router = Router();
  function erreur(res: Response, e: unknown) {
    if (e instanceof ErreurOffre) return res.status(e.statut).json({ message: e.message, ...(e.erreurs ? { erreurs: e.erreurs } : {}) });
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Informations de l’offre invalides.", erreurs: e.flatten().fieldErrors });
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") return res.status(404).json({ message: "Offre introuvable." });
      if (["P2034", "P2002"].includes(e.code)) return res.status(409).json({ message: "Une autre action est en cours. Actualisez son état avant de réessayer." });
    }
    console.error("[offres] Traitement impossible.");
    return res.status(500).json({ message: "Impossible de traiter cette demande." });
  }
  function traiter(fn: (req: AuthRequest, res: Response, a: ActeurOffre) => Promise<unknown>) {
    return async (req: AuthRequest, res: Response) => {
      try { return await fn(req, res, await service.acteur(req.userId, req.userRole, req.permissions)); }
      catch (e) { return erreur(res, e); }
    };
  }
  router.get("/", authenticate, traiter(async (req, res, a) => res.json(await service.liste(listeOffresSchema.parse(req.query), a))));
  router.get("/:id", authenticate, traiter(async (req, res, a) => res.json({ offre: await service.fiche(String(req.params.id), a) })));
  router.post("/", authenticate, traiter(async (req, res, a) => res.status(201).json({ offre: await service.creer(champsOffreSchema.parse(req.body), a), message: "Offre proposée. Elle sera visible après validation." })));
  router.patch("/:id", authenticate, traiter(async (req, res, a) => res.json({ offre: await service.modifier(String(req.params.id), modifierOffreSchema.parse(req.body), a), message: "Offre modifiée et renvoyée en validation." })));
  router.patch("/:id/validation", authenticate, requirePermission("OFFRES_MODERER"), traiter(async (req, res, a) => {
    const { valide, revision } = z.object({ valide: z.boolean(), revision: revisionOffreSchema }).strict().parse(req.body);
    return res.json({ offre: await service.valider(String(req.params.id), valide, revision, a), message: "Statut mis à jour." });
  }));
  router.delete("/:id", authenticate, traiter(async (req, res, a) => { await service.supprimer(String(req.params.id), a); return res.json({ message: "Offre supprimée." }); }));
  router.put("/:id/enregistrement", authenticate, traiter(async (req, res, a) => res.json(await service.enregistrer(String(req.params.id), a, true))));
  router.delete("/:id/enregistrement", authenticate, traiter(async (req, res, a) => res.json(await service.enregistrer(String(req.params.id), a, false))));
  router.post("/:id/candidatures", authenticate, traiter(async (req, res, a) => {
    const resultat = await candidatures.postuler(String(req.params.id), a, candidatureSchema.parse(req.body || {}));
    return res.status(resultat.httpStatus).json(resultat.payload);
  }));
  router.get("/:id/profil-candidature.pdf", authenticate, traiter(async (req, res, a) => {
    const { revision } = z.object({ revision: revisionOffreSchema }).parse(req.query);
    const pdf = await candidatures.apercuPdf(String(req.params.id), a, revision);
    return res.set({ "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="profil-candidature.pdf"', "Cache-Control": "private, no-store" }).send(pdf);
  }));
  return router;
}
export default creerRouteurOffres();

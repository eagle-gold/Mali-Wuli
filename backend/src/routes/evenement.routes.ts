import { Prisma } from "@prisma/client";
import { Router, type Response, type NextFunction, type RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, type AuthRequest, requirePermission } from "../middlewares/auth.middleware";
import { uploadEvenement, verifierImageChargee, supprimerUpload } from "../middlewares/upload.middleware";
import { emettreUtilisateur } from "../realtime/socket";
import { creerNotification, creerNotifications } from "../services/notification.service";
import {
  creerServiceEvenements, ErreurEvenement, creationEvenementSchema, modifierEvenementSchema,
  listeEvenementSchema, paginationEvenementSchema, type ActeurEvenement, type ServiceEvenements,
} from "../services/evenement.service";

const serviceProduction = creerServiceEvenements(prisma, {
  notifier: creerNotification, notifierPlusieurs: creerNotifications,
  emettre: (userId, evenementId, supprime) => emettreUtilisateur(userId, "evenement_modifie", { evenementId, ...(supprime ? { supprime: true } : {}) }),
});
type RequeteEvenement = AuthRequest & { acteurEvenement?: ActeurEvenement };
type MediaRoutes = { couverture: RequestHandler; photo: RequestHandler; verifier: RequestHandler; retirer: (url?: string | null) => void };
const mediaProduction: MediaRoutes = {
  couverture: uploadEvenement.single("couverture"), photo: uploadEvenement.single("photo"),
  verifier: verifierImageChargee, retirer: supprimerUpload,
};
const legendeSchema = z.object({ legende: z.string().trim().max(300).optional() });

export function creerRouteurEvenements(service: ServiceEvenements = serviceProduction, medias: MediaRoutes = mediaProduction) {
  const router = Router();
  function repondreErreur(res: Response, error: unknown) {
    if (error instanceof ErreurEvenement) return res.status(error.statut).json({ message: error.message, ...(error.erreurs ? { erreurs: error.erreurs } : {}) });
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Informations de l’événement invalides.", erreurs: error.flatten().fieldErrors });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return res.status(404).json({ message: "Événement ou photo introuvable." });
      if (error.code === "P2034") return res.status(409).json({ message: "Une autre modification est en cours. Actualisez puis réessayez." });
      if (error.code === "P2002") return res.status(409).json({ message: "Cette action est déjà enregistrée. Actualisez la page." });
    }
    console.error("[evenements]", error);
    return res.status(500).json({ message: "Impossible de traiter cet événement." });
  }
  function traiter(fn: (req: RequeteEvenement, res: Response, a: ActeurEvenement) => Promise<unknown>) {
    return async (req: RequeteEvenement, res: Response) => {
      try { return await fn(req, res, req.acteurEvenement || await service.acteur(req.userId, req.userRole, req.permissions)); }
      catch (error) { return repondreErreur(res, error); }
    };
  }
  function nettoyer(url?: string | null) {
    try { medias.retirer(url); } catch { console.error("[evenements] Nettoyage d’un ancien média à réessayer."); }
  }
  function preautoriser(couverture: boolean) {
    return async (req: RequeteEvenement, res: Response, next: NextFunction) => {
      try {
        req.acteurEvenement = await service.acteur(req.userId, req.userRole, req.permissions);
        await service.autoriserMedia(String(req.params.id), req.acteurEvenement, couverture);
        next();
      } catch (error) { repondreErreur(res, error); }
    };
  }
  router.get("/", authenticate, traiter(async (req, res, a) => res.json(await service.liste(listeEvenementSchema.parse(req.query), a))));
  router.get("/:id", authenticate, traiter(async (req, res, a) => res.json(await service.detail(String(req.params.id), a))));
  router.get("/:id/participants", authenticate, traiter(async (req, res, a) => res.json(await service.participants(String(req.params.id), a, paginationEvenementSchema.parse(req.query)))));
  router.get("/:id/photos", authenticate, traiter(async (req, res, a) => res.json(await service.photos(String(req.params.id), a, paginationEvenementSchema.parse(req.query)))));
  router.post("/", authenticate, traiter(async (req, res, a) => {
    const evenement = await service.creer(creationEvenementSchema.parse(req.body), a);
    return res.status(201).json({ evenement, message: evenement.valide ? "Événement publié." : "Événement proposé. Il sera visible après validation." });
  }));
  router.patch("/:id", authenticate, traiter(async (req, res, a) => {
    const evenement = await service.modifier(String(req.params.id), modifierEvenementSchema.parse(req.body), a);
    return res.json({ evenement, message: evenement.valide ? "Événement modifié." : "Événement modifié et renvoyé en validation." });
  }));
  router.patch("/:id/validation", authenticate, requirePermission("EVENEMENTS_MODERER"), traiter(async (req, res, a) => {
    const { valide } = z.object({ valide: z.boolean() }).parse(req.body);
    return res.json({ evenement: await service.valider(String(req.params.id), valide, a), message: "Statut mis à jour." });
  }));
  router.delete("/:id", authenticate, traiter(async (req, res, a) => {
    const urls = await service.supprimer(String(req.params.id), a);
    urls.forEach(nettoyer);
    return res.json({ message: "Événement annulé et supprimé." });
  }));
  router.post("/:id/participer", authenticate, traiter(async (req, res, a) => {
    const { dejaInscrit, ...resultat } = await service.participer(String(req.params.id), a);
    return res.status(dejaInscrit ? 200 : 201).json(resultat);
  }));
  router.delete("/:id/participer", authenticate, traiter(async (req, res, a) => res.json(await service.quitter(String(req.params.id), a))));
  router.post("/:id/couverture", authenticate, preautoriser(true), medias.couverture, medias.verifier, traiter(async (req, res, a) => {
    if (!req.file) throw new ErreurEvenement(400, "Choisissez une image de couverture.");
    const url = `/uploads/evenements/${req.file.filename}`;
    let enregistre = false;
    try {
      const { ancienMedia } = await service.modifierCouverture(String(req.params.id), url, a);
      enregistre = true;
      if (ancienMedia !== url) nettoyer(ancienMedia);
      return res.json({ evenement: await service.fiche(String(req.params.id), a) });
    } catch (error) { if (!enregistre) nettoyer(url); throw error; }
  }));
  router.delete("/:id/couverture", authenticate, traiter(async (req, res, a) => {
    const { ancienMedia } = await service.modifierCouverture(String(req.params.id), null, a);
    nettoyer(ancienMedia);
    return res.json({ evenement: await service.fiche(String(req.params.id), a) });
  }));
  router.post("/:id/photos", authenticate, preautoriser(false), medias.photo, medias.verifier, traiter(async (req, res, a) => {
    if (!req.file) throw new ErreurEvenement(400, "Choisissez une photo.");
    const url = `/uploads/evenements/${req.file.filename}`;
    let enregistre = false;
    try {
      const { legende } = legendeSchema.parse(req.body);
      const photo = await service.ajouterPhoto(String(req.params.id), url, legende || null, a);
      enregistre = true;
      return res.status(201).json({ photo, message: "Photo ajoutée à l’album." });
    } catch (error) { if (!enregistre) nettoyer(url); throw error; }
  }));
  router.delete("/:id/photos/:photoId", authenticate, traiter(async (req, res, a) => {
    const url = await service.supprimerPhoto(String(req.params.id), String(req.params.photoId), a);
    nettoyer(url);
    return res.json({ message: "Photo retirée de l’album." });
  }));
  return router;
}
export default creerRouteurEvenements();

import { Prisma } from "@prisma/client";
import { Router, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, type AuthRequest } from "../middlewares/auth.middleware";
import {
  supprimerUpload, uploadAvatar, uploadCouverture, verifierImageChargee,
} from "../middlewares/upload.middleware";
import { creerServiceAssociations, ErreurAssociation, type ServiceAssociations } from "../services/association.service";

const idSchema = z.string().trim().min(1).max(191);
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});
const texteOptionnel = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v === "" ? null : v);
const filtreOptionnel = z.string().trim().max(191).optional();
const listeSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(), pays: filtreOptionnel, ville: filtreOptionnel, vocation: filtreOptionnel,
});
const siteSchema = texteOptionnel(2000).refine((v) => {
  if (!v) return true;
  try { const url = new URL(v); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, "Le site doit être une URL HTTP ou HTTPS.");
const dateCreationSchema = z.string().trim().nullable().optional().transform((v, contexte) => {
  if (v === undefined) return undefined;
  if (!v) return null;
  const jour = v.slice(0, 10);
  const date = new Date(`${jour}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(v) || Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== jour || (v.includes("T") && Number.isNaN(new Date(v).getTime()))
    || jour > new Date().toISOString().slice(0, 10)) {
    contexte.addIssue({ code: z.ZodIssueCode.custom, message: "La date de fondation doit être une date valide passée ou actuelle." });
    return z.NEVER;
  }
  return date;
});
const donneesAssociationSchema = z.object({
  nom: z.string().trim().min(2).max(191), pays: z.string().trim().min(2).max(191),
  description: texteOptionnel(10000), ville: texteOptionnel(191), vocation: texteOptionnel(191),
  site: siteSchema, emailContact: texteOptionnel(191).refine((v) => !v || z.string().email().safeParse(v).success, "Adresse e-mail invalide."),
  dateCreation: dateCreationSchema, responsableId: idSchema.nullable().optional(), valide: z.boolean().optional(),
}).strict();
const creerAssociationSchema = donneesAssociationSchema.extend({
  description: z.string().trim().min(1, "La description est obligatoire.").max(10000),
  ville: z.string().trim().min(1, "La ville est obligatoire.").max(191),
  vocation: z.string().trim().min(1, "La vocation est obligatoire.").max(191),
  responsableId: idSchema,
});
const modifierAssociationSchema = donneesAssociationSchema.partial().refine(
  (v) => Object.keys(v).length > 0, "Au moins un champ doit être modifié.",
);
const suggestionSchema = z.object({
  nom: z.string().trim().min(2).max(191), pays: z.string().trim().min(2).max(191),
  ville: texteOptionnel(191), vocation: texteOptionnel(191), message: texteOptionnel(3000),
}).strict();

function lire<S extends z.ZodTypeAny>(schema: S, valeur: unknown): z.infer<S> {
  const resultat = schema.safeParse(valeur);
  if (!resultat.success) throw new ErreurAssociation(400, resultat.error.issues.map((i) => i.message).join(" "));
  return resultat.data;
}
function handler(action: (req: AuthRequest, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { void action(req, res).catch((erreur) => {
    if (erreur instanceof ErreurAssociation) res.status(erreur.statut).json({ message: erreur.message });
    else if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2025") res.status(404).json({ message: "Association introuvable." });
    else if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2034") res.status(409).json({ message: "L’association a changé. Actualisez avant de réessayer." });
    else next(erreur);
  }); };
}
const admin: RequestHandler = (req: AuthRequest, res, next) => {
  if (!req.permissions?.includes("ASSOCIATIONS_GERER")) return void res.status(403).json({ message: "Cette action est réservée à l’administration." });
  next();
};

/** Fabrique injectable : les tests exécutent les vrais handlers avec Prisma simulé, sans base ni serveur HTTP. */
export function creerRouteursAssociations(options: { service?: ServiceAssociations; authentifier?: RequestHandler; retirerMedia?: (url?: string | null) => void } = {}) {
  const service = options.service || creerServiceAssociations(prisma);
  const authentifier = options.authentifier || authenticate;
  const retirerMedia = options.retirerMedia || supprimerUpload;
  const router = Router();
  const onboarding = Router();
  router.use(authentifier);
  onboarding.use(authentifier);
  const identite = (req: AuthRequest) => service.acteur(req.userId, req.userRole, req.permissions);
  const id = (req: AuthRequest) => lire(idSchema, req.params.id);

  const lister = handler(async (req, res) => res.json(await service.liste(lire(listeSchema, req.query), await identite(req))));
  const mesAffiliations = handler(async (req, res) => res.json(await service.mesAssociations(await identite(req), false)));
  const demander = handler(async (req, res) => {
    lire(z.object({}).strict(), req.body || {});
    return res.json({ monAffiliation: await service.demanderAffiliation(id(req), await identite(req)) });
  });
  const quitter = handler(async (req, res) => {
    await service.quitter(id(req), await identite(req));
    return res.json({ message: "Votre affiliation a été retirée." });
  });
  const proposer = handler(async (req, res) => res.status(201).json({
    suggestion: await service.proposer(lire(suggestionSchema, req.body), await identite(req)),
  }));

  // Ces seules routes sont accessibles pendant la validation du compte.
  // Elles sont montées avant /api/onboarding ; aucune lecture de roster ou gestion d'autrui ici.
  onboarding.get("/", lister);
  onboarding.get("/mes", mesAffiliations);
  onboarding.post("/suggestions", proposer);
  onboarding.post("/:id/affiliation", demander);
  onboarding.delete("/:id/affiliation", quitter);

  router.get("/", lister);
  router.get("/mes", handler(async (req, res) => res.json(await service.mesAssociations(await identite(req), true))));
  router.get("/mes-affiliations", mesAffiliations);
  router.get("/responsables", admin, handler(async (req, res) => {
    const query = lire(z.object({ q: z.string().trim().max(100).default("") }), req.query);
    return res.json(await service.responsables(query.q, await identite(req)));
  }));
  router.post("/suggestions", proposer);
  router.get("/suggestions", admin, handler(async (req, res) => {
    const query = lire(paginationSchema.extend({ statut: z.enum(["EN_ATTENTE", "TRAITEE", "REFUSEE"]).optional() }), req.query);
    return res.json(await service.suggestions(query, await identite(req)));
  }));
  router.patch("/suggestions/:id", admin, handler(async (req, res) => {
    const body = lire(z.object({ statut: z.enum(["TRAITEE", "REFUSEE"]) }).strict(), req.body);
    return res.json({ suggestion: await service.traiterSuggestion(id(req), body.statut, await identite(req)) });
  }));
  router.post("/", admin, handler(async (req, res) => res.status(201).json({
    association: await service.enregistrer(lire(creerAssociationSchema, req.body), await identite(req)),
  })));
  router.patch("/:id", admin, handler(async (req, res) => res.json({
    association: await service.enregistrer(lire(modifierAssociationSchema, req.body), await identite(req), id(req)),
  })));
  router.delete("/:id", handler(async (req, res) => {
    const medias = await service.supprimer(id(req), await identite(req));
    for (const url of medias) {
      try { retirerMedia(url); } catch { console.error("[associations] Nettoyage média après suppression différé."); }
    }
    return res.json({ message: "Association supprimée." });
  }));
  router.post("/:id/affiliation", demander);
  router.delete("/:id/affiliation", quitter);
  router.get("/:id/affiliations", handler(async (req, res) => res.json(
    await service.membres(id(req), await identite(req), lire(paginationSchema, req.query), true),
  )));
  router.patch("/:id/affiliations/:profilId", handler(async (req, res) => {
    const body = lire(z.object({ decision: z.enum(["VERIFIE", "REFUSE"]) }).strict(), req.body);
    return res.json({ monAffiliation: await service.decider(id(req), lire(idSchema, req.params.profilId), body.decision, await identite(req)) });
  }));
  router.get("/:id/membres", handler(async (req, res) => res.json(
    await service.membres(id(req), await identite(req), lire(paginationSchema, req.query)),
  )));

  // Vérifier les droits avant multer : une requête interdite n'écrit aucun fichier.
  const gerant: RequestHandler = (req: AuthRequest, res, next) => {
    void identite(req).then((a) => service.autoriserGestion(id(req), a)).then(() => next()).catch((erreur) => {
      if (erreur instanceof ErreurAssociation) res.status(erreur.statut).json({ message: erreur.message });
      else next(erreur);
    });
  };
  for (const media of [
    { chemin: "photo", champ: "photo" as const, dossier: "avatars", upload: uploadAvatar.single("photo") },
    { chemin: "couverture", champ: "photoCouverture" as const, dossier: "couvertures", upload: uploadCouverture.single("couverture") },
  ]) {
    router.post(`/:id/${media.chemin}`, gerant, media.upload, verifierImageChargee, handler(async (req, res) => {
      if (!req.file) throw new ErreurAssociation(400, "Sélectionnez une image JPEG, PNG ou WebP.");
      const url = `/uploads/${media.dossier}/${req.file.filename}`;
      let enregistre = false;
      try {
        const acteur = await identite(req);
        const resultat = await service.modifierMedia(id(req), media.champ, url, acteur);
        enregistre = true;
        retirerMedia(resultat.ancienMedia);
        return res.json({ association: await service.fiche(id(req), acteur) });
      } catch (erreur) {
        if (!enregistre) retirerMedia(url);
        throw erreur;
      }
    }));
    router.delete(`/:id/${media.chemin}`, handler(async (req, res) => {
      const acteur = await identite(req);
      const resultat = await service.modifierMedia(id(req), media.champ, null, acteur);
      retirerMedia(resultat.ancienMedia);
      return res.json({ association: await service.fiche(id(req), acteur) });
    }));
  }
  router.get("/:id", handler(async (req, res) => {
    const acteur = await identite(req);
    const association = await service.fiche(id(req), acteur);
    const resultat = await service.membres(id(req), acteur, { page: 1, limite: 20 });
    return res.json({ association, membres: "membres" in resultat ? resultat.membres : [],
      totalMembres: resultat.total, page: resultat.page, totalPagesMembres: resultat.totalPages });
  }));
  return { router, onboarding };
}

const routeurs = creerRouteursAssociations();
export const onboardingAssociationsRouter = routeurs.onboarding;
export default routeurs.router;

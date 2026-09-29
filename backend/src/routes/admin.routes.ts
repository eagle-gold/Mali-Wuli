import { Prisma, StatutSuggestionCatalogue } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { publierSuggestion } from "../education/catalog-suggestion-service";
import { prismaEducation } from "../education/catalog-service";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole, requirePermission, type AuthRequest } from "../middlewares/auth.middleware";
import { revoquerSocketsUtilisateur } from "../realtime/socket";
import { envoyerEmail } from "../services/email.service";
import { EMAIL_ADMIN_PRINCIPAL, roleEffectif, droitsUtilisateur } from "../lib/roles";
import { COMMENTAIRE_ACTIF, PUBLICATION_ACTIVE } from "../services/corbeille.service";
import { creerServiceSignalements, ErreurSignalement, filtresSignalementsSchema, traitementSignalementSchema, type ServiceSignalements } from "../services/signalement.service";
import { creerServiceGestionMembres, ErreurGestionMembres, filtresMembres, changementRolesSchema, changementStatutSchema, type ServiceGestionMembres } from "../services/admin-membres.service";

const gestionProduction = creerServiceGestionMembres(prisma, {
  revoquerSockets: revoquerSocketsUtilisateur,
  notifierInscription: async (user, valide, raison) => {
    const texte = valide ? "Votre profil Mali Wuli est validé. Vous pouvez maintenant accéder à toute la communauté." : raison || "Votre profil ne peut pas encore être validé. Contactez l’équipe si vous souhaitez plus d’informations.";
    return envoyerEmail({ destinataire: user.email, sujet: valide ? "Votre profil Mali Wuli est validé" : "Mise à jour de votre inscription Mali Wuli", texte, html: `<h1>Mali Wuli</h1><p>${texte.replace(/[<>&]/g, "")}</p>` });
  },
});
export function creerRouteurAdmin(gestion: ServiceGestionMembres = gestionProduction, options: { signalements?: ServiceSignalements } = {}) {
const router = Router();
const signalements = options.signalements || creerServiceSignalements(prisma);
function traiter(fn: (req: AuthRequest, res: import("express").Response) => Promise<unknown>) {
  return async (req: AuthRequest, res: import("express").Response) => {
    try { return await fn(req, res); }
    catch (e) {
      if (e instanceof ErreurGestionMembres) return res.status(e.statut).json({ message: e.message });
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Informations invalides.", erreurs: e.flatten().fieldErrors });
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return res.status(409).json({ message: "Ce compte a changé. Actualisez puis réessayez." });
      console.error("[admin] Traitement impossible.");
      return res.status(500).json({ message: "Impossible de traiter cette demande." });
    }
  };
}

const adminOnly = [authenticate, requireRole("ADMIN")];
const membresManagers = [authenticate, (req: AuthRequest, res: import("express").Response, next: import("express").NextFunction) => {
  if (!req.permissions?.some(permission => permission === "MEMBRES_GERER" || permission === "ROLES_GERER")) return res.status(403).json({ message: "La gestion des membres ne fait pas partie de vos autorisations." });
  next();
}];
const inscriptionsModerators = [authenticate, requirePermission("INSCRIPTIONS_GERER")];
const catalogueModerators = [authenticate, requirePermission("CATALOGUE_GERER")];
const signalementsModerators = [authenticate, requirePermission("SIGNALEMENTS_CONSULTER")];

router.get("/inscriptions", ...inscriptionsModerators, async (req: AuthRequest, res) => {
  const query = z.object({
    statut: z.enum(["EN_ATTENTE", "VALIDE", "REFUSE", "SUSPENDU"]).default("EN_ATTENTE"),
    page: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(30),
  }).safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Filtres invalides." });
  const { statut, page, limite } = query.data;
  if (req.userRole !== "ADMIN" && statut !== "EN_ATTENTE") return res.status(403).json({ message: "Un modérateur consulte uniquement les inscriptions en attente." });
  try {
    const where = { statut, ...(req.userRole !== "ADMIN" ? { id: { not: req.userId }, email: { not: EMAIL_ADMIN_PRINCIPAL }, role: { notIn: ["ADMIN" as const, "MODERATEUR" as const] }, rolesDelegues: { none: {} } } : {}) };
    const [inscriptions, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limite,
        take: limite,
        select: {
          id: true,
          prenom: true,
          nom: true,
          email: true,
          emailVerifie: true,
          role: true,
          statut: true,
          createdAt: true,
          profil: {
            select: {
              id: true,
              pays: true,
              ville: true,
              titre: true,
              onboardingFini: true,
              estVolontaire: true,
              _count: { select: { formations: true, experiences: true } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return res.json({ inscriptions: inscriptions.map(u => ({ ...u, role: roleEffectif(u) })), total, page, limite, totalPages: Math.ceil(total / limite) });
  } catch (error) {
    console.error("[GET /admin/inscriptions]", error);
    return res.status(500).json({ message: "Impossible de charger les inscriptions." });
  }
});

router.get("/roles", ...membresManagers, traiter(async (req, res) => res.json(await gestion.roles(req.userId!))));
router.get("/membres", ...membresManagers, traiter(async (req, res) => res.json(await gestion.liste(req.userId!, filtresMembres.parse(req.query)))));
router.patch("/membres/:id/role", ...adminOnly, (_req, res) => res.status(409).json({ message: "Utilisez la nouvelle gestion des rôles cumulables." }));
router.patch("/membres/:id/roles", ...adminOnly, traiter(async (req, res) => {
  const id = z.string().trim().min(1).max(191).parse(req.params.id);
  return res.json(await gestion.modifierRoles(req.userId!, id, changementRolesSchema.parse(req.body)));
}));
router.patch("/membres/:id/statut", ...membresManagers, traiter(async (req, res) => {
  const id = z.string().trim().min(1).max(191).parse(req.params.id);
  return res.json(await gestion.modifierStatut(req.userId!, id, changementStatutSchema.parse(req.body)));
}));
router.put("/inscriptions/:id/valider", ...inscriptionsModerators, traiter(async (req, res) => {
  const id = z.string().trim().min(1).max(191).parse(req.params.id);
  return res.json(await gestion.deciderInscription(req.userId!, id, true));
}));
router.put("/inscriptions/:id/refuser", ...inscriptionsModerators, traiter(async (req, res) => {
  const id = z.string().trim().min(1).max(191).parse(req.params.id);
  const { raison } = z.object({ raison: z.string().trim().max(500).optional() }).strict().parse(req.body);
  return res.json(await gestion.deciderInscription(req.userId!, id, false, raison));
}));

// Le modérateur global traite le contenu et le catalogue. Les rôles et statistiques restent réservés au propriétaire.
router.get("/signalements", ...signalementsModerators, async (req, res) => {
  const filtres = filtresSignalementsSchema.safeParse(req.query);
  if (!filtres.success) return res.status(400).json({ message: "Filtres invalides." });
  try {
    return res.json(await signalements.lister(filtres.data));
  } catch (error) {
    console.error("[GET /admin/signalements]", error);
    return res.status(500).json({ message: "Impossible de charger les signalements." });
  }
});

// Traiter = consulter : la même permission couvre la prise en charge et la clôture.
router.put("/signalements/:id", ...signalementsModerators, async (req: AuthRequest, res) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  const donnees = traitementSignalementSchema.safeParse(req.body);
  if (!id.success || !donnees.success) return res.status(400).json({ message: "Décision invalide." });
  try {
    return res.json(await signalements.traiter(id.data, req.userId!, donnees.data));
  } catch (error) {
    if (error instanceof ErreurSignalement) return res.status(error.statut).json({ message: error.message });
    console.error("[PUT /admin/signalements/:id]", error);
    return res.status(500).json({ message: "Impossible de traiter ce signalement." });
  }
});

router.get("/stats", ...adminOnly, async (_req, res) => {
  try {
    const [membres, enAttente, publications, commentaires, messages, synergies, rendezVous] = await Promise.all([
      prisma.user.count({ where: { statut: "VALIDE" } }),
      prisma.user.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.publication.count({ where: { visible: true, ...PUBLICATION_ACTIVE } }),
      prisma.commentairePublication.count({ where: { ...COMMENTAIRE_ACTIF, publication: PUBLICATION_ACTIVE } }),
      prisma.message.count(),
      prisma.synergie.count({ where: { statut: "ACCEPTE" } }),
      prisma.rendezVous.count(),
    ]);
    return res.json({ membres, enAttente, publications, commentaires, messages, synergies, rendezVous });
  } catch (error) {
    console.error("[GET /admin/stats]", error);
    return res.status(500).json({ message: "Impossible de charger les statistiques." });
  }
});

router.get("/notifications", ...catalogueModerators, async (_req, res) => {
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

router.get("/catalogue/suggestions", ...catalogueModerators, async (req, res) => {
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
  ...catalogueModerators,
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
  ...catalogueModerators,
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

router.put("/notifications/:id/lire", ...catalogueModerators, async (req, res) => {
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

return router;
}
export default creerRouteurAdmin();

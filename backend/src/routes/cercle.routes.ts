import { Prisma } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import {
  formaterProfil,
  paginationMeta,
  paginationSchema,
  profilCourant,
  profilsParIds,
} from "../lib/community";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest, requirePermission } from "../middlewares/auth.middleware";
import { emettreUtilisateur } from "../realtime/socket";
import { creerNotification, creerNotifications } from "../services/notification.service";

const router = Router();

const listeSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  theme: z.string().trim().max(100).optional(),
  membre: z.enum(["tous", "mes-cercles"]).default("tous"),
});

const adhesionSchema = z.object({
  motivation: z.string().trim().max(500).optional(),
});

const membresSchema = paginationSchema.extend({
  statut: z.enum(["EN_ATTENTE", "ACCEPTE", "REFUSE"]).optional(),
});

const cercleSchema = z.object({
  nom: z.string().trim().min(3).max(120),
  theme: z.string().trim().min(2).max(100),
  description: z.string().trim().max(5000).optional().nullable(),
  presidentId: z.string().trim().min(1).max(191).optional(),
});

const modifierCercleSchema = cercleSchema
  .omit({ presidentId: true })
  .partial()
  .refine((valeur) => Object.keys(valeur).length > 0, "Au moins un champ doit être modifié.");

async function formatterCercles<T extends {
  id: string;
  presidentId: string;
  membres: Array<{ statut: "EN_ATTENTE" | "ACCEPTE" | "REFUSE" }>;
  _count: { membres: number };
}>(cercles: T[], profilId: string) {
  const presidents = await profilsParIds(cercles.map(({ presidentId }) => presidentId));
  const adhesionsPresident = cercles.length
    ? await prisma.cercleMembre.findMany({
        where: {
          statut: "ACCEPTE",
          OR: cercles.map((cercle) => ({
            cercleId: cercle.id,
            profilId: cercle.presidentId,
          })),
        },
        select: { cercleId: true, profilId: true },
      })
    : [];
  const presidentsDejaComptes = new Set(
    adhesionsPresident.map(({ cercleId, profilId: presidentId }) => `${cercleId}:${presidentId}`),
  );
  return cercles.map(({ membres, _count, ...cercle }) => ({
    ...cercle,
    president: formaterProfil(presidents.get(cercle.presidentId)),
    nbMembres:
      _count.membres +
      (presidentsDejaComptes.has(`${cercle.id}:${cercle.presidentId}`) ? 0 : 1),
    statutMembre:
      cercle.presidentId === profilId ? "PRESIDENT" : membres[0]?.statut ?? null,
  }));
}

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const query = listeSchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: "Filtres de cercles invalides." });
  }

  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const { page, limite, q, theme, membre } = query.data;
    const conditions: Prisma.CercleWhereInput[] = [];
    if (q) {
      conditions.push({
        OR: [
          { nom: { contains: q } },
          { theme: { contains: q } },
          { description: { contains: q } },
        ],
      });
    }
    if (membre === "mes-cercles") {
      conditions.push({
        OR: [
          { presidentId: profil.id },
          { membres: { some: { profilId: profil.id, statut: "ACCEPTE" } } },
        ],
      });
    }
    const where: Prisma.CercleWhereInput = {
      actif: true,
      ...(theme ? { theme } : {}),
      AND: conditions,
    };

    const [total, cercles] = await prisma.$transaction([
      prisma.cercle.count({ where }),
      prisma.cercle.findMany({
        where,
        orderBy: [{ nom: "asc" }, { id: "asc" }],
        skip: (page - 1) * limite,
        take: limite,
        include: {
          membres: {
            where: { profilId: profil.id },
            select: { statut: true },
            take: 1,
          },
          _count: { select: { membres: { where: { statut: "ACCEPTE" } } } },
        },
      }),
    ]);

    return res.json({
      cercles: await formatterCercles(cercles, profil.id),
      meta: paginationMeta(page, limite, total),
    });
  } catch (error) {
    console.error("[GET /cercles]", error);
    return res.status(500).json({ message: "Impossible de charger les cercles." });
  }
});

router.post(
  "/",
  authenticate,
  requirePermission("CERCLES_GERER"),
  async (req: AuthRequest, res: Response) => {
    const body = cercleSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        message: "Informations du cercle invalides.",
        erreurs: body.error.flatten().fieldErrors,
      });
    }
    try {
      const createur = await profilCourant(req.userId);
      if (!createur) return res.status(404).json({ message: "Profil introuvable." });
      const presidentId = body.data.presidentId || createur.id;
      const [president, doublon] = await Promise.all([
        prisma.profil.findUnique({ where: { id: presidentId }, select: { id: true, userId: true } }),
        prisma.cercle.findFirst({ where: { nom: body.data.nom, actif: true }, select: { id: true } }),
      ]);
      if (!president) return res.status(400).json({ message: "Président introuvable." });
      if (doublon) return res.status(409).json({ message: "Un cercle actif porte déjà ce nom." });

      const cercle = await prisma.$transaction(async (transaction) => {
        const cree = await transaction.cercle.create({
          data: {
            nom: body.data.nom,
            theme: body.data.theme,
            description: body.data.description || null,
            presidentId,
            actif: true,
          },
        });
        await transaction.cercleMembre.create({
          data: {
            cercleId: cree.id,
            profilId: presidentId,
            statut: "ACCEPTE",
            rejointLe: new Date(),
          },
        });
        return cree;
      });
      emettreUtilisateur(president.userId, "cercle_modifie", { cercleId: cercle.id });
      return res.status(201).json({
        message: "Cercle créé.",
        cercle: {
          ...cercle,
          president: formaterProfil((await profilsParIds([presidentId])).get(presidentId)),
          nbMembres: 1,
          statutMembre: presidentId === createur.id ? "PRESIDENT" : null,
        },
      });
    } catch (error) {
      console.error("[POST /cercles]", error);
      return res.status(500).json({ message: "Impossible de créer ce cercle." });
    }
  },
);

router.get("/:id/membres", authenticate, async (req: AuthRequest, res: Response) => {
  const query = membresSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Pagination invalide." });

  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const cercleId = String(req.params.id);
    const cercle = await prisma.cercle.findUnique({
      where: { id: cercleId },
      select: { id: true, actif: true, presidentId: true },
    });
    if (!cercle?.actif) return res.status(404).json({ message: "Cercle introuvable." });

    const peutVoirLesDemandes =
      cercle.presidentId === profil.id || req.permissions?.includes("CERCLES_GERER");
    const statut = peutVoirLesDemandes && query.data.statut ? query.data.statut : "ACCEPTE";
    const where = { cercleId, statut } as const;
    const { page, limite } = query.data;
    const [total, membres] = await prisma.$transaction([
      prisma.cercleMembre.count({ where }),
      prisma.cercleMembre.findMany({
        where,
        orderBy: [{ rejointLe: "asc" }, { profilId: "asc" }],
        skip: (page - 1) * limite,
        take: limite,
        select: {
          statut: true,
          motivation: peutVoirLesDemandes,
          rejointLe: true,
          profil: {
            select: {
              id: true,
              userId: true,
              photo: true,
              titre: true,
              pays: true,
              ville: true,
              situation: true,
              user: { select: { prenom: true, nom: true, statut: true } },
            },
          },
        },
      }),
    ]);

    return res.json({
      membres: membres.map(({ profil: membre, ...adhesion }) => ({
        ...adhesion,
        profil: formaterProfil(membre),
      })),
      meta: paginationMeta(page, limite, total),
    });
  } catch (error) {
    console.error("[GET /cercles/:id/membres]", error);
    return res.status(500).json({ message: "Impossible de charger les membres." });
  }
});

router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const cercle = await prisma.cercle.findFirst({
      where: { id: String(req.params.id), actif: true },
      include: {
        membres: {
          where: { profilId: profil.id },
          select: { statut: true },
          take: 1,
        },
        documents: { orderBy: { createdAt: "desc" }, take: 20 },
        reunions: { orderBy: { date: "asc" }, take: 20 },
        _count: { select: { membres: { where: { statut: "ACCEPTE" } } } },
      },
    });
    if (!cercle) return res.status(404).json({ message: "Cercle introuvable." });

    const [donnee] = await formatterCercles([cercle], profil.id);
    return res.json({ cercle: donnee });
  } catch (error) {
    console.error("[GET /cercles/:id]", error);
    return res.status(500).json({ message: "Impossible de charger ce cercle." });
  }
});

router.post("/:id/adherer", authenticate, async (req: AuthRequest, res: Response) => {
  const body = adhesionSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Motivation invalide." });

  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const cercle = await prisma.cercle.findFirst({
      where: { id: String(req.params.id), actif: true },
      select: { id: true, nom: true, presidentId: true },
    });
    if (!cercle) return res.status(404).json({ message: "Cercle introuvable." });
    if (cercle.presidentId === profil.id) {
      return res.status(409).json({ message: "Vous présidez déjà ce cercle." });
    }

    const adhesion = await prisma.cercleMembre.upsert({
      where: { cercleId_profilId: { cercleId: cercle.id, profilId: profil.id } },
      create: {
        cercleId: cercle.id,
        profilId: profil.id,
        statut: "ACCEPTE",
        motivation: body.data.motivation || null,
        rejointLe: new Date(),
      },
      update: {
        statut: "ACCEPTE",
        motivation: body.data.motivation || null,
        rejointLe: new Date(),
      },
    });

    const president = await prisma.profil.findUnique({
      where: { id: cercle.presidentId },
      select: { userId: true },
    });
    await creerNotification({
      destinataireId: cercle.presidentId,
      acteurId: profil.id,
      type: "CERCLE",
      titre: `Un membre a rejoint ${cercle.nom}`,
      detail: `${formaterProfil(profil)?.nomComplet} vient de rejoindre votre cercle.`,
      href: `/cercles#${encodeURIComponent(cercle.id)}`,
      payload: { cercleId: cercle.id },
    });
    if (req.userId) emettreUtilisateur(req.userId, "cercle_modifie", { cercleId: cercle.id });
    if (president) emettreUtilisateur(president.userId, "cercle_modifie", { cercleId: cercle.id });

    return res.status(201).json({
      message: "Vous avez rejoint le cercle.",
      adhesion,
      statutMembre: "ACCEPTE",
    });
  } catch (error) {
    console.error("[POST /cercles/:id/adherer]", error);
    return res.status(500).json({ message: "Impossible de rejoindre ce cercle." });
  }
});

router.delete("/:id/adherer", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const cercle = await prisma.cercle.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, presidentId: true },
    });
    if (!cercle) return res.status(404).json({ message: "Cercle introuvable." });
    if (cercle.presidentId === profil.id) {
      return res.status(409).json({ message: "Le président ne peut pas quitter son cercle." });
    }

    await prisma.cercleMembre.deleteMany({
      where: { cercleId: cercle.id, profilId: profil.id },
    });
    if (req.userId) emettreUtilisateur(req.userId, "cercle_modifie", { cercleId: cercle.id });
    return res.json({ message: "Vous avez quitté le cercle.", statutMembre: null });
  } catch (error) {
    console.error("[DELETE /cercles/:id/adherer]", error);
    return res.status(500).json({ message: "Impossible de quitter ce cercle." });
  }
});

router.patch("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const body = modifierCercleSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      message: "Modifications invalides.",
      erreurs: body.error.flatten().fieldErrors,
    });
  }
  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const existant = await prisma.cercle.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, presidentId: true, actif: true },
    });
    if (!existant) return res.status(404).json({ message: "Cercle introuvable." });
    if (existant.presidentId !== profil.id && !req.permissions?.includes("CERCLES_GERER")) {
      return res.status(403).json({ message: "Vous ne pouvez pas modifier ce cercle." });
    }
    const cercle = await prisma.cercle.update({
      where: { id: existant.id },
      data: {
        ...body.data,
        description:
          body.data.description === undefined ? undefined : body.data.description || null,
      },
    });
    const membres = await prisma.cercleMembre.findMany({
      where: { cercleId: cercle.id, statut: "ACCEPTE" },
      select: { profil: { select: { userId: true } } },
    });
    for (const membre of membres) {
      emettreUtilisateur(membre.profil.userId, "cercle_modifie", { cercleId: cercle.id });
    }
    return res.json({ message: "Cercle modifié.", cercle });
  } catch (error) {
    console.error("[PATCH /cercles/:id]", error);
    return res.status(500).json({ message: "Impossible de modifier ce cercle." });
  }
});

router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const existant = await prisma.cercle.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, nom: true, presidentId: true, actif: true },
    });
    if (!existant) return res.status(404).json({ message: "Cercle introuvable." });
    if (existant.presidentId !== profil.id && !req.permissions?.includes("CERCLES_GERER")) {
      return res.status(403).json({ message: "Vous ne pouvez pas désactiver ce cercle." });
    }
    if (!existant.actif) return res.json({ message: "Ce cercle est déjà désactivé.", actif: false });

    const membres = await prisma.cercleMembre.findMany({
      where: { cercleId: existant.id, statut: "ACCEPTE" },
      select: { profil: { select: { id: true, userId: true } } },
    });
    await prisma.cercle.update({ where: { id: existant.id }, data: { actif: false } });
    await creerNotifications(membres.map(({ profil: membre }) => ({
      destinataireId: membre.id,
      acteurId: profil.id,
      type: "CERCLE" as const,
      titre: `Le cercle ${existant.nom} a été désactivé`,
      detail: "Il n'est plus possible de rejoindre ce cercle.",
      href: "/cercles",
      payload: { cercleId: existant.id, actif: false },
    })));
    for (const membre of membres) {
      emettreUtilisateur(membre.profil.userId, "cercle_modifie", { cercleId: existant.id });
    }
    return res.json({ message: "Cercle désactivé.", actif: false });
  } catch (error) {
    console.error("[DELETE /cercles/:id]", error);
    return res.status(500).json({ message: "Impossible de désactiver ce cercle." });
  }
});

export default router;

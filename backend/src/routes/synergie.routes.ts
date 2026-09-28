import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middlewares/auth.middleware";
import { emettreUtilisateur } from "../realtime/socket";
import { creerNotification } from "../services/notification.service";

const router = Router();

const PROFIL_PUBLIC_SELECT = {
  id: true,
  photo: true,
  titre: true,
  ville: true,
  pays: true,
  bio: true,
  estVolontaire: true,
  user: { select: { prenom: true, nom: true } },
  experiences: {
    where: { estActuel: true },
    select: { poste: true, entreprise: true },
    take: 1,
  },
} as const;

const idSchema = z.string().trim().min(1).max(191);
const creationSchema = z.object({ recepteurProfilId: idSchema });
const decisionSchema = z.object({ decision: z.enum(["ACCEPTE", "REFUSE"]) });

function clePaire(a: string, b: string) {
  return [a, b].sort().join(":");
}

function nomProfil(profil: { user: { prenom: string | null; nom: string | null } }) {
  return [profil.user.prenom, profil.user.nom].filter(Boolean).join(" ") || "Un membre";
}

async function profilConnecte(userId?: string) {
  if (!userId) return null;
  return prisma.profil.findUnique({
    where: { userId },
    select: { id: true, userId: true, user: { select: { prenom: true, nom: true } } },
  });
}

function emettreAuxParticipants(
  userIds: string[],
  evenements: string[],
  donnees: unknown,
) {
  for (const userId of new Set(userIds)) {
    for (const evenement of evenements) emettreUtilisateur(userId, evenement, donnees);
  }
}

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });

    const [acceptees, envoyees, recues] = await Promise.all([
      prisma.synergie.findMany({
        where: { statut: "ACCEPTE", OR: [{ demandeurId: profil.id }, { recepteurId: profil.id }] },
        include: { demandeur: { select: PROFIL_PUBLIC_SELECT }, recepteur: { select: PROFIL_PUBLIC_SELECT } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.synergie.findMany({
        where: { demandeurId: profil.id, statut: "EN_ATTENTE" },
        include: { recepteur: { select: PROFIL_PUBLIC_SELECT } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.synergie.findMany({
        where: { recepteurId: profil.id, statut: "EN_ATTENTE" },
        include: { demandeur: { select: PROFIL_PUBLIC_SELECT } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return res.json({
      synergies: acceptees.map((synergie) => ({
        id: synergie.id,
        createdAt: synergie.createdAt,
        autre: synergie.demandeurId === profil.id ? synergie.recepteur : synergie.demandeur,
      })),
      envoyees: envoyees.map((synergie) => ({
        id: synergie.id,
        createdAt: synergie.createdAt,
        recepteur: synergie.recepteur,
      })),
      recues: recues.map((synergie) => ({
        id: synergie.id,
        createdAt: synergie.createdAt,
        demandeur: synergie.demandeur,
      })),
    });
  } catch (error) {
    console.error("[GET /synergies]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/suggestions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await prisma.profil.findUnique({
      where: { userId: req.userId },
      select: {
        id: true,
        synergiesEnvoyees: { select: { recepteurId: true } },
        synergiesRecues: { select: { demandeurId: true } },
      },
    });
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });

    const exclus = [
      profil.id,
      ...profil.synergiesEnvoyees.map(({ recepteurId }) => recepteurId),
      ...profil.synergiesRecues.map(({ demandeurId }) => demandeurId),
    ];
    const suggestions = await prisma.profil.findMany({
      where: { id: { notIn: exclus }, onboardingFini: true, user: { statut: "VALIDE" } },
      select: PROFIL_PUBLIC_SELECT,
      take: 12,
      orderBy: { createdAt: "desc" },
    });
    return res.json({ suggestions });
  } catch (error) {
    console.error("[GET /synergies/suggestions]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const donnees = creationSchema.safeParse(req.body);
  if (!donnees.success) return res.status(400).json({ message: "Destinataire invalide." });

  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    if (profil.id === donnees.data.recepteurProfilId) {
      return res.status(400).json({ message: "Impossible de créer une synergie avec vous-même." });
    }

    const recepteur = await prisma.profil.findFirst({
      where: { id: donnees.data.recepteurProfilId, onboardingFini: true, user: { statut: "VALIDE" } },
      select: { id: true, userId: true, user: { select: { prenom: true, nom: true } } },
    });
    if (!recepteur) return res.status(404).json({ message: "Membre introuvable." });

    const paire = clePaire(profil.id, recepteur.id);
    const existante = await prisma.synergie.findUnique({ where: { clePaire: paire } });
    if (existante) {
      const message = existante.statut === "ACCEPTE"
        ? "Vous êtes déjà en synergie."
        : existante.statut === "EN_ATTENTE"
          ? "Une demande est déjà en attente."
          : "Cette demande a déjà été traitée.";
      return res.status(409).json({ message, synergieId: existante.id });
    }

    const synergie = await prisma.synergie.create({
      data: { demandeurId: profil.id, recepteurId: recepteur.id, clePaire: paire },
      include: { recepteur: { select: PROFIL_PUBLIC_SELECT } },
    });
    const notification = await creerNotification({
      destinataireId: recepteur.id,
      acteurId: profil.id,
      type: "DEMANDE_SYNERGIE",
      titre: `${nomProfil(profil)} vous propose une synergie`,
      detail: "Consultez son profil puis acceptez ou refusez la demande.",
      href: "/synergies",
      payload: { synergieId: synergie.id },
    });
    emettreAuxParticipants(
      [profil.userId, recepteur.userId],
      ["synergie_creee", "synergie:created"],
      { synergieId: synergie.id },
    );
    return res.status(201).json({ message: "Demande envoyée.", synergie, notification });
  } catch (error) {
    console.error("[POST /synergies]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = idSchema.safeParse(req.params.id);
  const donnees = decisionSchema.safeParse(req.body);
  if (!id.success || !donnees.success) return res.status(400).json({ message: "Décision invalide." });

  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const synergie = await prisma.synergie.findUnique({
      where: { id: id.data },
      include: {
        demandeur: { select: { userId: true } },
        recepteur: { select: { userId: true } },
      },
    });
    if (!synergie) return res.status(404).json({ message: "Synergie introuvable." });
    if (synergie.recepteurId !== profil.id) return res.status(403).json({ message: "Non autorisé." });
    if (synergie.statut !== "EN_ATTENTE") return res.status(409).json({ message: "Demande déjà traitée." });

    const miseAJour = await prisma.synergie.update({
      where: { id: synergie.id },
      data: { statut: donnees.data.decision },
      include: { demandeur: { select: PROFIL_PUBLIC_SELECT } },
    });
    await creerNotification({
      destinataireId: synergie.demandeurId,
      acteurId: profil.id,
      type: donnees.data.decision === "ACCEPTE" ? "SYNERGIE_ACCEPTEE" : "SYNERGIE_REFUSEE",
      titre: donnees.data.decision === "ACCEPTE"
        ? `${nomProfil(profil)} a accepté votre synergie`
        : `${nomProfil(profil)} a refusé votre demande`,
      detail: donnees.data.decision === "ACCEPTE"
        ? "Vous pouvez maintenant échanger et suivre vos publications respectives."
        : "Vous pourrez découvrir d’autres profils dans l’annuaire.",
      href: "/synergies",
      payload: { synergieId: synergie.id },
    });
    emettreAuxParticipants(
      [synergie.demandeur.userId, synergie.recepteur.userId],
      ["synergie_mise_a_jour", "synergie:updated"],
      { synergieId: synergie.id, statut: donnees.data.decision },
    );
    return res.json({
      message: donnees.data.decision === "ACCEPTE" ? "Synergie acceptée." : "Demande refusée.",
      synergie: miseAJour,
    });
  } catch (error) {
    console.error("[PUT /synergies/:id]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Identifiant invalide." });
  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const synergie = await prisma.synergie.findUnique({
      where: { id: id.data },
      include: {
        demandeur: { select: { userId: true } },
        recepteur: { select: { userId: true } },
      },
    });
    if (!synergie) return res.status(404).json({ message: "Synergie introuvable." });
    const appartient = synergie.demandeurId === profil.id || synergie.recepteurId === profil.id;
    if (!appartient) return res.status(403).json({ message: "Non autorisé." });
    if (synergie.statut === "EN_ATTENTE" && synergie.demandeurId !== profil.id) {
      return res.status(403).json({ message: "Seul l’expéditeur peut annuler cette demande." });
    }
    await prisma.synergie.delete({ where: { id: synergie.id } });
    emettreAuxParticipants(
      [synergie.demandeur.userId, synergie.recepteur.userId],
      ["synergie_supprimee", "synergie:deleted"],
      { synergieId: synergie.id },
    );
    return res.json({ message: "Synergie supprimée." });
  } catch (error) {
    console.error("[DELETE /synergies/:id]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;

import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middlewares/auth.middleware";
import { obtenirSocket } from "../realtime/socket";
import { creerNotifications } from "../services/notification.service";

const router = Router();

const PROFIL_SELECT = {
  id: true,
  titre: true,
  ville: true,
  photo: true,
  userId: true,
  user: { select: { prenom: true, nom: true } },
} as const;

const idSchema = z.string().trim().min(1).max(191);
const listeMessagesSchema = z.object({
  cursor: idSchema.optional(),
  limite: z.coerce.number().int().min(1).max(100).default(30),
});
const nouvelleConversationSchema = z.object({
  destinataireId: idSchema,
  premierMessage: z.string().trim().min(1).max(4000).optional(),
});
const nouveauMessageSchema = z.object({ contenu: z.string().trim().min(1).max(4000) });
const rechercheSchema = z.object({ q: z.string().trim().max(100).default("") });

function initiales(prenom?: string | null, nom?: string | null) {
  return `${prenom?.[0] || ""}${nom?.[0] || ""}`.toUpperCase() || "?";
}

function nomComplet(prenom?: string | null, nom?: string | null) {
  return [prenom, nom].filter(Boolean).join(" ") || "Un membre";
}

function cleDirecte(a: string, b: string) {
  return [a, b].sort().join(":");
}

async function profilConnecte(userId?: string) {
  if (!userId) return null;
  return prisma.profil.findUnique({ where: { userId }, select: PROFIL_SELECT });
}

async function diffuserMessage(
  conversationId: string,
  auteurId: string,
  message: {
    id: string;
    conversationId: string;
    contenu: string;
    createdAt: Date;
    lu: boolean;
    estMoi: boolean;
    auteur: { id: string; initiales: string; photo: string | null };
  },
) {
  const participants = await prisma.conversationMembre.findMany({
    where: { conversationId },
    select: { profilId: true, profil: { select: { userId: true } } },
  });
  const io = obtenirSocket();
  io?.to(`conversation:${conversationId}`).emit("nouveau_message", message);
  io?.to(`conversation:${conversationId}`).emit("message:created", message);
  for (const participant of participants) {
    if (participant.profilId === auteurId) continue;
    io?.to(`user:${participant.profil.userId}`)
      .except(`conversation:${conversationId}`)
      .emit("nouveau_message", message);
    io?.to(`user:${participant.profil.userId}`)
      .except(`conversation:${conversationId}`)
      .emit("message:created", message);
  }
  return participants;
}

async function enregistrerEtDiffuserMessage(params: {
  conversationId: string;
  auteur: NonNullable<Awaited<ReturnType<typeof profilConnecte>>>;
  contenu: string;
}) {
  const message = await prisma.$transaction(async (transaction) => {
    const cree = await transaction.message.create({
      data: {
        conversationId: params.conversationId,
        auteurId: params.auteur.id,
        contenu: params.contenu,
      },
    });
    await transaction.conversation.update({
      where: { id: params.conversationId },
      data: { dernierMessageLe: cree.createdAt },
    });
    return cree;
  });

  const payload = {
    id: message.id,
    conversationId: message.conversationId,
    contenu: message.contenu,
    createdAt: message.createdAt,
    lu: false,
    estMoi: false,
    auteur: {
      id: params.auteur.id,
      initiales: initiales(params.auteur.user.prenom, params.auteur.user.nom),
      photo: params.auteur.photo,
    },
  };

  const participants = await diffuserMessage(params.conversationId, params.auteur.id, payload);
  const destinataires = participants
    .filter(({ profilId }) => profilId !== params.auteur.id)
    .map(({ profilId }) => ({
      destinataireId: profilId,
      acteurId: params.auteur.id,
      type: "NOUVEAU_MESSAGE" as const,
      titre: `${nomComplet(params.auteur.user.prenom, params.auteur.user.nom)} vous a écrit`,
      detail: params.contenu.slice(0, 240),
      href: `/messages?conversation=${params.conversationId}`,
      payload: { conversationId: params.conversationId, messageId: message.id },
    }));
  void creerNotifications(destinataires);
  return payload;
}

router.get("/conversations", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });

    const appartenances = await prisma.conversationMembre.findMany({
      where: { profilId: profil.id },
      include: {
        conversation: {
          include: {
            participants: { include: { profil: { select: PROFIL_SELECT } } },
            messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
          },
        },
      },
    });

    const conversations = await Promise.all(appartenances.map(async (appartenance) => {
      const conversation = appartenance.conversation;
      const depuis = appartenance.dernierLuLe || appartenance.rejointLe;
      const nonLus = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          auteurId: { not: profil.id },
          createdAt: { gt: depuis },
        },
      });
      const participants = conversation.participants
        .filter(({ profilId }) => profilId !== profil.id)
        .map(({ profil: autre }) => ({
          id: autre.id,
          prenom: autre.user.prenom,
          nom: autre.user.nom,
          initiales: initiales(autre.user.prenom, autre.user.nom),
          titre: autre.titre,
          ville: autre.ville,
          photo: autre.photo,
        }));
      return {
        id: conversation.id,
        titre: conversation.titre,
        estGroupe: conversation.estGroupe,
        participants,
        dernierMessage: conversation.messages[0] || null,
        nonLus,
        updatedAt: conversation.dernierMessageLe || conversation.createdAt,
      };
    }));
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return res.json({ conversations });
  } catch (error) {
    console.error("[GET /messages/conversations]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/conversations/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = idSchema.safeParse(req.params.id);
  const query = listeMessagesSchema.safeParse(req.query);
  if (!id.success || !query.success) return res.status(400).json({ message: "Pagination invalide." });

  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const appartenance = await prisma.conversationMembre.findUnique({
      where: { conversationId_profilId: { conversationId: id.data, profilId: profil.id } },
    });
    if (!appartenance) return res.status(403).json({ message: "Accès refusé." });

    const [messages, conversation] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: id.data },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.data.limite + 1,
        ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
        include: { auteur: { select: PROFIL_SELECT } },
      }),
      prisma.conversation.findUnique({
        where: { id: id.data },
        include: { participants: { include: { profil: { select: PROFIL_SELECT } } } },
      }),
    ]);
    if (!conversation) return res.status(404).json({ message: "Conversation introuvable." });

    await prisma.$transaction([
      prisma.conversationMembre.update({
        where: { conversationId_profilId: { conversationId: id.data, profilId: profil.id } },
        data: { dernierLuLe: new Date() },
      }),
      prisma.message.updateMany({
        where: { conversationId: id.data, auteurId: { not: profil.id }, lu: false },
        data: { lu: true },
      }),
    ]);
    obtenirSocket()?.to(`conversation:${id.data}`).emit("messages_lus", {
      conversationId: id.data,
      profilId: profil.id,
    });

    const hasMore = messages.length > query.data.limite;
    const page = hasMore ? messages.slice(0, query.data.limite) : messages;
    const messagesFormates = page.reverse().map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      contenu: message.contenu,
      lu: message.auteurId !== profil.id || message.lu,
      createdAt: message.createdAt,
      estMoi: message.auteurId === profil.id,
      auteur: {
        id: message.auteur.id,
        initiales: initiales(message.auteur.user.prenom, message.auteur.user.nom),
        photo: message.auteur.photo,
      },
    }));
    const autresParticipants = conversation.participants
      .filter(({ profilId }) => profilId !== profil.id)
      .map(({ profil: autre }) => ({
        id: autre.id,
        prenom: autre.user.prenom,
        nom: autre.user.nom,
        initiales: initiales(autre.user.prenom, autre.user.nom),
        titre: autre.titre,
        ville: autre.ville,
        photo: autre.photo,
      }));

    return res.json({
      conversation: {
        id: conversation.id,
        titre: conversation.titre,
        estGroupe: conversation.estGroupe,
        participants: autresParticipants,
      },
      messages: messagesFormates,
      hasMore,
      nextCursor: hasMore ? page[0]?.id ?? null : null,
    });
  } catch (error) {
    console.error("[GET /messages/conversations/:id]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/conversations", authenticate, async (req: AuthRequest, res: Response) => {
  const donnees = nouvelleConversationSchema.safeParse(req.body);
  if (!donnees.success) return res.status(400).json({ message: "Destinataire ou message invalide." });

  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    if (profil.id === donnees.data.destinataireId) {
      return res.status(400).json({ message: "Impossible de vous écrire à vous-même." });
    }
    const destinataire = await prisma.profil.findFirst({
      where: { id: donnees.data.destinataireId, onboardingFini: true, user: { statut: "VALIDE" } },
      select: { id: true },
    });
    if (!destinataire) return res.status(404).json({ message: "Destinataire introuvable." });

    const cle = cleDirecte(profil.id, destinataire.id);
    const conversation = await prisma.conversation.upsert({
      where: { cleDirecte: cle },
      create: {
        cleDirecte: cle,
        estGroupe: false,
        participants: { create: [{ profilId: profil.id }, { profilId: destinataire.id }] },
      },
      update: {},
      select: { id: true },
    });
    const message = donnees.data.premierMessage
      ? await enregistrerEtDiffuserMessage({
          conversationId: conversation.id,
          auteur: profil,
          contenu: donnees.data.premierMessage,
        })
      : null;
    return res.status(201).json({ conversationId: conversation.id, message });
  } catch (error) {
    console.error("[POST /messages/conversations]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/conversations/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  const id = idSchema.safeParse(req.params.id);
  const donnees = nouveauMessageSchema.safeParse(req.body);
  if (!id.success || !donnees.success) return res.status(400).json({ message: "Message invalide." });

  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const membre = await prisma.conversationMembre.findUnique({
      where: { conversationId_profilId: { conversationId: id.data, profilId: profil.id } },
      select: { conversationId: true },
    });
    if (!membre) return res.status(403).json({ message: "Accès refusé." });
    const message = await enregistrerEtDiffuserMessage({
      conversationId: id.data,
      auteur: profil,
      contenu: donnees.data.contenu,
    });
    return res.status(201).json({ message });
  } catch (error) {
    console.error("[POST /messages/conversations/:id/messages]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/membres/recherche", authenticate, async (req: AuthRequest, res: Response) => {
  const query = rechercheSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Recherche invalide." });
  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const q = query.data.q;
    const membres = await prisma.profil.findMany({
      where: {
        id: { not: profil.id },
        onboardingFini: true,
        user: {
          statut: "VALIDE",
          ...(q ? { OR: [{ prenom: { contains: q } }, { nom: { contains: q } }] } : {}),
        },
      },
      select: PROFIL_SELECT,
      take: 12,
      orderBy: { createdAt: "desc" },
    });
    return res.json({
      membres: membres.map((membre) => ({
        id: membre.id,
        prenom: membre.user.prenom,
        nom: membre.user.nom,
        initiales: initiales(membre.user.prenom, membre.user.nom),
        titre: membre.titre,
        ville: membre.ville,
        photo: membre.photo,
      })),
    });
  } catch (error) {
    console.error("[GET /messages/membres/recherche]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;

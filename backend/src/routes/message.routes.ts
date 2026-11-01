import fs from "fs";
import { NextFunction, Router, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  cheminPieceJointe,
  contentDisposition,
  detecterType,
  dossierPiecesJointes,
  nettoyerNomFichier,
  NOMBRE_MAX_PIECES,
  nomFichierStockage,
  supprimerPieceJointe,
  TAILLE_MAX_PIECE,
} from "../lib/pieces-jointes";
import { enregistrerActivite, estEnLigne } from "../lib/presence";
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
  user: { select: { prenom: true, nom: true, derniereActiviteLe: true } },
} as const;

const PIECE_SELECT = { id: true, nom: true, mime: true, taille: true } as const;

type ProfilResume = {
  id: string;
  titre: string | null;
  ville: string | null;
  photo: string | null;
  userId: string;
  user: { prenom: string | null; nom: string | null; derniereActiviteLe: Date | null };
};
type PieceResume = { id: string; nom: string; mime: string; taille: number };

/** Interlocuteur avec sa présence : « en ligne » ou date de dernière activité. */
function participantDe(autre: ProfilResume) {
  return {
    id: autre.id,
    prenom: autre.user.prenom,
    nom: autre.user.nom,
    initiales: initiales(autre.user.prenom, autre.user.nom),
    titre: autre.titre,
    ville: autre.ville,
    photo: autre.photo,
    enLigne: estEnLigne(autre.userId),
    derniereActiviteLe: autre.user.derniereActiviteLe,
  };
}

function pieceDe(piece: PieceResume) {
  return { ...piece, estImage: piece.mime.startsWith("image/") };
}

/** Aperçu d'un message dans la liste et les notifications. */
function apercuMessage(contenu: string, pieces: { mime: string }[]) {
  if (contenu.trim()) return contenu;
  if (!pieces.length) return "";
  const images = pieces.filter(({ mime }) => mime.startsWith("image/")).length;
  if (images === pieces.length) return images > 1 ? `${images} photos` : "Photo";
  return pieces.length > 1 ? `${pieces.length} pièces jointes` : "Pièce jointe";
}

const idSchema = z.string().trim().min(1).max(191);
const listeMessagesSchema = z.object({
  cursor: idSchema.optional(),
  limite: z.coerce.number().int().min(1).max(100).default(30),
});
const nouvelleConversationSchema = z.object({
  destinataireId: idSchema,
  premierMessage: z.string().trim().min(1).max(4000).optional(),
});
const nouveauMessageSchema = z.object({ contenu: z.string().trim().max(4000).default("") });
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
    piecesJointes: ReturnType<typeof pieceDe>[];
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

type PieceAEnregistrer = { nom: string; mime: string; taille: number; fichier: string };

async function enregistrerEtDiffuserMessage(params: {
  conversationId: string;
  auteur: NonNullable<Awaited<ReturnType<typeof profilConnecte>>>;
  contenu: string;
  pieces?: PieceAEnregistrer[];
}) {
  const message = await prisma.$transaction(async (transaction) => {
    const cree = await transaction.message.create({
      data: {
        conversationId: params.conversationId,
        auteurId: params.auteur.id,
        contenu: params.contenu,
        piecesJointes: params.pieces?.length ? { create: params.pieces } : undefined,
      },
      include: { piecesJointes: { select: PIECE_SELECT, orderBy: { createdAt: "asc" } } },
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
    piecesJointes: message.piecesJointes.map(pieceDe),
  };
  void enregistrerActivite(params.auteur.userId, message.createdAt);

  const participants = await diffuserMessage(params.conversationId, params.auteur.id, payload);
  const destinataires = participants
    .filter(({ profilId }) => profilId !== params.auteur.id)
    .map(({ profilId }) => ({
      destinataireId: profilId,
      acteurId: params.auteur.id,
      type: "NOUVEAU_MESSAGE" as const,
      titre: `${nomComplet(params.auteur.user.prenom, params.auteur.user.nom)} vous a écrit`,
      detail: apercuMessage(params.contenu, message.piecesJointes).slice(0, 240),
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
            messages: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
              include: { piecesJointes: { select: { mime: true } } },
            },
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
        .map(({ profil: autre }) => participantDe(autre));
      const dernier = conversation.messages[0];
      return {
        id: conversation.id,
        titre: conversation.titre,
        estGroupe: conversation.estGroupe,
        participants,
        dernierMessage: dernier
          ? {
              id: dernier.id,
              conversationId: dernier.conversationId,
              auteurId: dernier.auteurId,
              contenu: apercuMessage(dernier.contenu, dernier.piecesJointes),
              createdAt: dernier.createdAt,
              lu: dernier.lu,
            }
          : null,
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
        include: {
          auteur: { select: PROFIL_SELECT },
          piecesJointes: { select: PIECE_SELECT, orderBy: { createdAt: "asc" } },
        },
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
      piecesJointes: message.piecesJointes.map(pieceDe),
    }));
    const autresParticipants = conversation.participants
      .filter(({ profilId }) => profilId !== profil.id)
      .map(({ profil: autre }) => participantDe(autre));

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

type RequeteMessagerie = AuthRequest & { profilMessagerie?: NonNullable<Awaited<ReturnType<typeof profilConnecte>>> };

/** Droits vérifiés AVANT multer : une requête refusée n'écrit aucun fichier. */
async function verifierMembreConversation(req: RequeteMessagerie, res: Response, next: NextFunction) {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Conversation invalide." });
  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const membre = await prisma.conversationMembre.findUnique({
      where: { conversationId_profilId: { conversationId: id.data, profilId: profil.id } },
      select: { conversationId: true },
    });
    if (!membre) return res.status(403).json({ message: "Accès refusé." });
    req.profilMessagerie = profil;
    return next();
  } catch (error) {
    console.error("[POST /messages/conversations/:id/messages]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
}

const televerserPieces = multer({
  storage: multer.diskStorage({
    destination: (_req, _fichier, callback) => callback(null, dossierPiecesJointes),
    filename: (_req, fichier, callback) => callback(null, nomFichierStockage(fichier.originalname)),
  }),
  limits: { fileSize: TAILLE_MAX_PIECE, files: NOMBRE_MAX_PIECES, fields: 5 },
  // Noms de fichiers accentués : busboy décode en latin1 par défaut.
  ...({ defParamCharset: "utf8" } as object),
}).array("fichiers", NOMBRE_MAX_PIECES);

function recevoirPieces(req: RequeteMessagerie, res: Response, next: NextFunction) {
  televerserPieces(req, res, (erreur: unknown) => {
    if (!erreur) return next();
    for (const fichier of (req.files as Express.Multer.File[] | undefined) || []) supprimerPieceJointe(fichier.filename);
    if (erreur instanceof multer.MulterError) {
      const messages: Partial<Record<string, string>> = {
        LIMIT_FILE_SIZE: "Chaque fichier doit faire 10 Mo au maximum.",
        LIMIT_FILE_COUNT: `Vous pouvez joindre ${NOMBRE_MAX_PIECES} fichiers au maximum par message.`,
        LIMIT_UNEXPECTED_FILE: `Vous pouvez joindre ${NOMBRE_MAX_PIECES} fichiers au maximum par message.`,
      };
      return res.status(erreur.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: messages[erreur.code] || "Envoi de fichier invalide." });
    }
    console.error("[POST /messages/conversations/:id/messages] fichiers", erreur);
    return res.status(500).json({ message: "Les fichiers n’ont pas pu être reçus." });
  });
}

/** Contrôle la nature réelle de chaque fichier reçu ; supprime tout en cas de refus. */
function piecesValidees(fichiers: Express.Multer.File[]): { pieces: PieceAEnregistrer[] } | { refus: string } {
  const pieces: PieceAEnregistrer[] = [];
  for (const fichier of fichiers) {
    const nom = nettoyerNomFichier(fichier.originalname);
    let type: ReturnType<typeof detecterType> = null;
    try {
      const descripteur = fs.openSync(fichier.path, "r");
      try {
        const entete = Buffer.alloc(Math.min(8192, fichier.size));
        fs.readSync(descripteur, entete, 0, entete.length, 0);
        type = detecterType(entete, nom);
      } finally {
        fs.closeSync(descripteur);
      }
    } catch {
      type = null;
    }
    if (!type || fichier.size === 0) return { refus: `« ${nom} » n’est pas un format accepté (images, PDF, documents Office ou texte).` };
    pieces.push({ nom, mime: type.mime, taille: fichier.size, fichier: fichier.filename });
  }
  return { pieces };
}

router.post(
  "/conversations/:id/messages",
  authenticate,
  verifierMembreConversation,
  recevoirPieces,
  async (req: RequeteMessagerie, res: Response) => {
    const fichiers = (req.files as Express.Multer.File[] | undefined) || [];
    const nettoyer = () => fichiers.forEach((fichier) => supprimerPieceJointe(fichier.filename));
    const donnees = nouveauMessageSchema.safeParse(req.body || {});
    if (!donnees.success) { nettoyer(); return res.status(400).json({ message: "Message trop long (4 000 caractères au maximum)." }); }
    if (!donnees.data.contenu && !fichiers.length) return res.status(400).json({ message: "Écrivez un message ou joignez un fichier." });

    const validation = piecesValidees(fichiers);
    if ("refus" in validation) { nettoyer(); return res.status(400).json({ message: validation.refus }); }

    try {
      const message = await enregistrerEtDiffuserMessage({
        conversationId: String(req.params.id),
        auteur: req.profilMessagerie!,
        contenu: donnees.data.contenu,
        pieces: validation.pieces,
      });
      return res.status(201).json({ message });
    } catch (error) {
      nettoyer();
      console.error("[POST /messages/conversations/:id/messages]", error);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ─── GET /api/messages/pieces-jointes/:id ────────────────────────────────────
// Réservé aux membres de la conversation. Les images s'affichent dans la page,
// les autres fichiers sont toujours téléchargés (jamais interprétés).
router.get("/pieces-jointes/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Pièce jointe invalide." });
  try {
    const profil = await profilConnecte(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const piece = await prisma.pieceJointeMessage.findUnique({
      where: { id: id.data },
      select: { nom: true, mime: true, taille: true, fichier: true, message: { select: { conversationId: true } } },
    });
    const membre = piece && await prisma.conversationMembre.findUnique({
      where: { conversationId_profilId: { conversationId: piece.message.conversationId, profilId: profil.id } },
      select: { conversationId: true },
    });
    // Même réponse pour « absente » et « interdite » : on ne révèle pas son existence.
    if (!piece || !membre) return res.status(404).json({ message: "Pièce jointe introuvable." });
    const chemin = cheminPieceJointe(piece.fichier);
    if (!chemin || !fs.existsSync(chemin)) return res.status(404).json({ message: "Ce fichier n’est plus disponible." });

    const image = piece.mime.startsWith("image/");
    res.setHeader("Content-Type", piece.mime);
    res.setHeader("Content-Length", String(piece.taille));
    res.setHeader("Content-Disposition", contentDisposition(piece.nom, image && req.query.telecharger !== "1"));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return fs.createReadStream(chemin).on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    console.error("[GET /messages/pieces-jointes/:id]", error);
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

import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { z } from "zod";
import { verifierTokenAcces } from "../lib/auth-token";
import { prisma } from "../lib/prisma";

type SocketIdentity = {
  userId: string;
  profilId: string;
  prenom: string;
};

let socketServer: Server | null = null;

const conversationIdSchema = z.string().trim().min(1).max(191);
const typingSchema = z.object({ conversationId: conversationIdSchema });

async function appartientConversation(profilId: string, conversationId: string) {
  const membre = await prisma.conversationMembre.findUnique({
    where: { conversationId_profilId: { conversationId, profilId } },
    select: { conversationId: true },
  });
  return Boolean(membre);
}

export function initialiserSocket(httpServer: HttpServer, origins: string[]) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET doit être défini avant de démarrer Socket.io.");

  const io = new Server(httpServer, {
    cors: { origin: origins, methods: ["GET", "POST"] },
    transports: ["polling", "websocket"],
  });

  io.use(async (socket, next) => {
    const token = z.string().min(1).safeParse(socket.handshake.auth?.token);
    if (!token.success) return next(new Error("Non authentifié"));

    try {
      const decoded = verifierTokenAcces(token.data);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          prenom: true,
          statut: true,
          emailVerifie: true,
          tokenVersion: true,
          profil: { select: { id: true } },
        },
      });
      if (
        !user?.profil ||
        !user.emailVerifie ||
        user.statut !== "VALIDE" ||
        user.tokenVersion !== decoded.tokenVersion
      ) {
        return next(new Error("Session révoquée ou compte indisponible"));
      }

      socket.data.identite = {
        userId: user.id,
        profilId: user.profil.id,
        prenom: user.prenom?.trim() || "Un membre",
      } satisfies SocketIdentity;
      return next();
    } catch {
      return next(new Error("Token invalide ou expiré"));
    }
  });

  io.on("connection", (socket) => {
    const identite = socket.data.identite as SocketIdentity;
    socket.join(`user:${identite.userId}`);

    socket.on("rejoindre_conversation", async (valeur: unknown, accuserReception?: (resultat: object) => void) => {
      const resultat = conversationIdSchema.safeParse(valeur);
      if (!resultat.success || !(await appartientConversation(identite.profilId, resultat.data))) {
        accuserReception?.({ ok: false, erreur: "Accès refusé" });
        return;
      }
      await socket.join(`conversation:${resultat.data}`);
      accuserReception?.({ ok: true });
    });

    socket.on("quitter_conversation", async (valeur: unknown) => {
      const resultat = conversationIdSchema.safeParse(valeur);
      if (resultat.success) await socket.leave(`conversation:${resultat.data}`);
    });

    socket.on("en_train_decrire", async (valeur: unknown) => {
      const resultat = typingSchema.safeParse(valeur);
      if (!resultat.success || !(await appartientConversation(identite.profilId, resultat.data.conversationId))) return;

      socket.to(`conversation:${resultat.data.conversationId}`).emit("interlocuteur_ecrit", {
        conversationId: resultat.data.conversationId,
        profilId: identite.profilId,
        prenom: identite.prenom,
      });
    });
  });

  socketServer = io;
  return io;
}

export function obtenirSocket() {
  return socketServer;
}

export function emettreUtilisateur(userId: string, evenement: string, donnees: unknown) {
  socketServer?.to(`user:${userId}`).emit(evenement, donnees);
}

export function emettreConversation(conversationId: string, evenement: string, donnees: unknown) {
  socketServer?.to(`conversation:${conversationId}`).emit(evenement, donnees);
}

/** Coupe immédiatement les connexions temps réel associées aux sessions révoquées. */
export function revoquerSocketsUtilisateur(userId: string) {
  socketServer?.in(`user:${userId}`).disconnectSockets(true);
}

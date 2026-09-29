import "dotenv/config";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { createServer } from "http";
import multer from "multer";
import { prisma } from "./lib/prisma";
import { supprimerUpload, uploadRoot } from "./middlewares/upload.middleware";
import { planifierPurgeCorbeille } from "./services/corbeille.service";
import { initialiserSocket } from "./realtime/socket";
import adminRoutes from "./routes/admin.routes";
import associationRoutes, { onboardingAssociationsRouter } from "./routes/association.routes";
import authRoutes from "./routes/auth.routes";
import cercleRoutes from "./routes/cercle.routes";
import corbeilleRoutes from "./routes/corbeille.routes";
import educationRoutes from "./routes/education.routes";
import evenementRoutes from "./routes/evenement.routes";
import messageRoutes from "./routes/message.routes";
import notificationRoutes from "./routes/notification.routes";
import offreRoutes from "./routes/offre.routes";
import onboardingRoutes from "./routes/onboarding.routes";
import publicationRoutes from "./routes/publication.routes";
import signalementRoutes from "./routes/signalement.routes";
import synergieRoutes from "./routes/synergie.routes";
import userRoutes from "./routes/user.routes";
import volontaireRoutes from "./routes/volontaire.routes";

const app = express();
const httpServer = createServer(app);
// Hostinger termine TLS devant le processus Node. Un seul proxy de confiance
// permet à Express et au limiteur de requêtes de retrouver l'IP réelle.
app.set("trust proxy", 1);
const originesConfigurees = (
  process.env.FRONTEND_URL || "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origine) => origine.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Les domaines publics doivent rester autorises meme si le superviseur
// Hostinger conserve temporairement une ancienne valeur de FRONTEND_URL.
// La meme liste est reutilisee plus bas par Socket.IO.
const origins = Array.from(new Set([
  ...originesConfigurees,
  "https://mali-wuli.com",
  "https://www.mali-wuli.com",
]));

const corsOptions: cors.CorsOptions = {
  credentials: true,
  origin: (origine, callback) => {
    if (!origine || origins.includes(origine.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origine non autorisée par CORS."));
  },
};

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/uploads", express.static(uploadRoot, { fallthrough: false, maxAge: "1d" }));

app.use("/api/auth", authRoutes);
app.use("/api/onboarding/associations", onboardingAssociationsRouter);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/associations", associationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/synergies", synergieRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/publications", publicationRoutes);
app.use("/api/corbeille", corbeilleRoutes);
app.use("/api/signalements", signalementRoutes);
app.use("/api/cercles", cercleRoutes);
app.use("/api/volontaires", volontaireRoutes);
app.use("/api/evenements", evenementRoutes);
app.use("/api/offres", offreRoutes);
app.use("/api/education", educationRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "OK", database: "OK", app: "Mali Wuli API", version: "1.1.0" });
  } catch {
    return res.status(503).json({ status: "DEGRADED", database: "ERROR", app: "Mali Wuli API" });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const [membres, pays, volontaires, cercles] = await Promise.all([
      prisma.user.count({ where: { statut: "VALIDE" } }),
      prisma.profil.findMany({
        where: { user: { statut: "VALIDE" }, pays: { not: null } },
        select: { pays: true },
        distinct: ["pays"],
      }),
      prisma.profil.count({ where: { estVolontaire: true, user: { statut: "VALIDE" } } }),
      prisma.cercle.count({ where: { actif: true } }),
    ]);
    return res.json({ membres, pays: pays.length, volontaires, cercles });
  } catch (error) {
    console.error("[GET /stats]", error);
    return res.status(500).json({ message: "Impossible de charger les statistiques." });
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Le fichier dépasse la taille autorisée."
      : "Le fichier envoyé est invalide.";
    return res.status(400).json({ message });
  }
  if (error instanceof Error && error.message.startsWith("Format non supporté")) {
    return res.status(400).json({ message: error.message });
  }
  if (error instanceof Error && error.message.includes("CORS")) {
    return res.status(403).json({ message: "Origine non autorisée." });
  }
  console.error("[HTTP]", error);
  return res.status(500).json({ message: "Erreur serveur." });
});

const io = initialiserSocket(httpServer, origins);
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";

// Hostinger charge le point d'entrée via son superviseur (il n'est donc pas
// toujours `require.main`). Seul l'environnement de tests désactive l'écoute.
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, HOST, () => {
    console.log(`Serveur Mali Wuli démarré sur http://${HOST}:${PORT}`);
  });
}

// Corbeille : purge au démarrage puis toutes les 24 h (non bloquant, erreurs journalisées).
// Désactivable avec CORBEILLE_PURGE_DISABLED=true (tests, maintenance).
const arreterPurgeCorbeille = planifierPurgeCorbeille(prisma, supprimerUpload);

async function arreter() {
  arreterPurgeCorbeille?.();
  io.close();
  httpServer.close();
  await prisma.$disconnect();
}

process.once("SIGTERM", () => void arreter());
process.once("SIGINT", () => void arreter());

export { app, httpServer, io };

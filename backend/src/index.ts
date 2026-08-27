import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

// Routes
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import synergieRoutes from "./routes/synergie.routes";
import messageRoutes from "./routes/message.routes";
import cercleRoutes from "./routes/cercle.routes";
import volontaireRoutes from "./routes/volontaire.routes";
import evenementRoutes from "./routes/evenement.routes";
import offreRoutes from "./routes/offre.routes";
import educationRoutes from "./routes/education.routes";
import adminRoutes from "./routes/admin.routes";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io — messagerie temps réel
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000" },
});

io.on("connection", (socket) => {
  console.log("🔌 Nouvelle connexion socket :", socket.id);

  socket.on("rejoindre_conversation", (conversationId: string) => {
    socket.join(conversationId);
  });

  socket.on("envoyer_message", (data) => {
    io.to(data.conversationId).emit("nouveau_message", data);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Déconnexion socket :", socket.id);
  });
});

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/synergies", synergieRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/cercles", cercleRoutes);
app.use("/api/volontaires", volontaireRoutes);
app.use("/api/evenements", evenementRoutes);
app.use("/api/offres", offreRoutes);
app.use("/api/education", educationRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", app: "Mali Wuli API", version: "1.0.0" });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";
httpServer.listen(Number(PORT), HOST, () => {
  console.log(`🚀 Serveur Mali Wuli démarré sur http://localhost:${PORT}`);
});

export { io };

import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/conversations", authenticate, async (_req, res) => {
  res.json({ message: "Mes conversations — à implémenter" });
});

router.get("/conversations/:id", authenticate, async (_req, res) => {
  res.json({ message: "Messages d'une conversation — à implémenter" });
});

router.post("/conversations", authenticate, async (_req, res) => {
  res.json({ message: "Créer conversation — à implémenter" });
});

router.post("/conversations/:id/messages", authenticate, async (_req, res) => {
  res.json({ message: "Envoyer message — à implémenter" });
});

export default router;

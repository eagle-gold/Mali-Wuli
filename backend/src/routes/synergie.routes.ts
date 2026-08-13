import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  res.json({ message: "Mes synergies — à implémenter" });
});

router.get("/suggestions", authenticate, async (_req, res) => {
  res.json({ message: "Suggestions synergies — à implémenter" });
});

router.post("/", authenticate, async (_req, res) => {
  res.json({ message: "Envoyer demande synergie — à implémenter" });
});

router.put("/:id", authenticate, async (_req, res) => {
  res.json({ message: "Répondre synergie — à implémenter" });
});

export default router;

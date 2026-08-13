import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  res.json({ message: "Liste des événements — à implémenter" });
});

router.post("/", authenticate, async (_req, res) => {
  res.json({ message: "Proposer un événement — à implémenter" });
});

router.post("/:id/participer", authenticate, async (_req, res) => {
  res.json({ message: "Participer à un événement — à implémenter" });
});

export default router;

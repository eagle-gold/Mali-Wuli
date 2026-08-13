import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  res.json({ message: "Liste des cercles — à implémenter" });
});

router.get("/:id", authenticate, async (_req, res) => {
  res.json({ message: "Détail cercle — à implémenter" });
});

router.post("/:id/adherer", authenticate, async (_req, res) => {
  res.json({ message: "Demande adhésion cercle — à implémenter" });
});

export default router;

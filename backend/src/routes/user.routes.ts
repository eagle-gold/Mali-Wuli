import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  res.json({ message: "Annuaire membres — à implémenter" });
});

router.get("/:id", authenticate, async (_req, res) => {
  res.json({ message: "Profil membre — à implémenter" });
});

router.put("/me", authenticate, async (_req, res) => {
  res.json({ message: "Mise à jour profil — à implémenter" });
});

export default router;

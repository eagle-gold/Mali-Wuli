import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  res.json({ message: "Liste des volontaires — à implémenter" });
});

router.get("/:id/creneaux", authenticate, async (_req, res) => {
  res.json({ message: "Créneaux disponibles — à implémenter" });
});

router.post("/:id/reserver", authenticate, async (_req, res) => {
  res.json({ message: "Réserver un créneau — à implémenter" });
});

export default router;

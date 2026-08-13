import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  res.json({ message: "Liste des offres — à implémenter" });
});

router.post("/", authenticate, async (_req, res) => {
  res.json({ message: "Déposer une offre — à implémenter" });
});

export default router;

import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Forum
router.get("/forum", authenticate, async (_req, res) => {
  res.json({ message: "Questions du forum — à implémenter" });
});

router.post("/forum", authenticate, async (_req, res) => {
  res.json({ message: "Poser une question — à implémenter" });
});

// Établissements
router.get("/etablissements", authenticate, async (_req, res) => {
  res.json({ message: "Liste établissements — à implémenter" });
});

router.get("/etablissements/:id", authenticate, async (_req, res) => {
  res.json({ message: "Fiche établissement — à implémenter" });
});

// Associations
router.get("/associations", authenticate, async (_req, res) => {
  res.json({ message: "Liste associations — à implémenter" });
});

router.post("/associations/:id/affilier", authenticate, async (_req, res) => {
  res.json({ message: "Demande affiliation — à implémenter" });
});

export default router;

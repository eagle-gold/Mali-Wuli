import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();

const isAdmin = [authenticate, requireRole("ADMIN", "MODERATEUR")];

router.get("/inscriptions", ...isAdmin, async (_req, res) => {
  res.json({ message: "Inscriptions en attente — à implémenter" });
});

router.put("/inscriptions/:id/valider", ...isAdmin, async (_req, res) => {
  res.json({ message: "Valider inscription — à implémenter" });
});

router.put("/inscriptions/:id/refuser", ...isAdmin, async (_req, res) => {
  res.json({ message: "Refuser inscription — à implémenter" });
});

router.get("/signalements", ...isAdmin, async (_req, res) => {
  res.json({ message: "Signalements — à implémenter" });
});

router.get("/stats", ...isAdmin, async (_req, res) => {
  res.json({ message: "Statistiques — à implémenter" });
});

export default router;

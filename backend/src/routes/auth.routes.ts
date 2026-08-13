import { Router } from "express";

const router = Router();

// POST /api/auth/register
router.post("/register", async (_req, res) => {
  res.json({ message: "Inscription — à implémenter" });
});

// POST /api/auth/verify-email
router.post("/verify-email", async (_req, res) => {
  res.json({ message: "Vérification email — à implémenter" });
});

// POST /api/auth/login
router.post("/login", async (_req, res) => {
  res.json({ message: "Connexion — à implémenter" });
});

// POST /api/auth/resend-code
router.post("/resend-code", async (_req, res) => {
  res.json({ message: "Renvoi code — à implémenter" });
});

export default router;

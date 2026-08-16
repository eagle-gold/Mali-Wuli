import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// Génère un code à 6 chiffres
const genererCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  const { prenom, nom, email, dateNaissance, motDePasse, parrainCode } = req.body;

  if (!prenom || !nom || !email || !dateNaissance || !motDePasse) {
    return res.status(400).json({ message: "Tous les champs obligatoires doivent être remplis." });
  }

  if (motDePasse.length < 8) {
    return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." });
  }

  try {
    // Vérifier si l'email existe déjà
    const existant = await prisma.user.findUnique({ where: { email } });
    if (existant) {
      return res.status(409).json({ message: "Un compte existe déjà avec cet email." });
    }

    // Trouver le parrain si un code est fourni
    let parrainId: string | undefined;
    if (parrainCode) {
      const parrain = await prisma.user.findUnique({ where: { id: parrainCode } });
      if (parrain) parrainId = parrain.id;
    }

    // Hasher le mot de passe
    const hash = await bcrypt.hash(motDePasse, 12);

    // Générer le code de vérification
    const code = genererCode();
    const expiration = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        prenom,
        nom,
        email,
        dateNaissance: new Date(dateNaissance),
        motDePasse: hash,
        codeVerif: code,
        codeExpire: expiration,
        cguAccepteLe: new Date(),
        parrainId,
      },
    });

    // TODO: Envoyer l'email avec le code (nodemailer)
    // Pour l'instant on log le code en développement
    console.log(`📧 Code de vérification pour ${email}: ${code}`);

    return res.status(201).json({
      message: "Compte créé. Vérifiez votre email.",
      userId: user.id,
      // En dev uniquement — à retirer en production !
      codeDevOnly: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur. Réessayez." });
  }
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
router.post("/verify-email", async (req: Request, res: Response) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ message: "Données manquantes." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });
    if (user.emailVerifie) return res.status(400).json({ message: "Email déjà vérifié." });
    if (user.codeVerif !== code) return res.status(400).json({ message: "Code incorrect." });
    if (!user.codeExpire || user.codeExpire < new Date()) {
      return res.status(400).json({ message: "Code expiré. Demandez-en un nouveau." });
    }

    // Marquer l'email comme vérifié
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifie: true, codeVerif: null, codeExpire: null },
    });

    // Créer le profil vide
    await prisma.profil.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return res.json({ message: "Email vérifié avec succès." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  const { email, motDePasse } = req.body;

  if (!email || !motDePasse) {
    return res.status(400).json({ message: "Email et mot de passe requis." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profil: true },
    });

    if (!user) return res.status(401).json({ message: "Email ou mot de passe incorrect." });
    if (!user.emailVerifie) return res.status(401).json({ message: "Vérifiez votre email avant de vous connecter.", code: "EMAIL_NON_VERIFIE", userId: user.id });
    if (user.statut === "REFUSE") return res.status(403).json({ message: "Votre compte a été refusé." });
    if (user.statut === "SUSPENDU") return res.status(403).json({ message: "Votre compte est suspendu." });

    const motDePasseValide = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!motDePasseValide) return res.status(401).json({ message: "Email ou mot de passe incorrect." });

    // Générer le JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        role: user.role,
        statut: user.statut,
        onboardingFini: user.profil?.onboardingFini ?? false,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─── POST /api/auth/resend-code ──────────────────────────────────────────────
router.post("/resend-code", async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ message: "userId manquant." });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });
    if (user.emailVerifie) return res.status(400).json({ message: "Email déjà vérifié." });

    const code = genererCode();
    const expiration = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { codeVerif: code, codeExpire: expiration },
    });

    // TODO: envoyer l'email
    console.log(`📧 Nouveau code pour ${user.email}: ${code}`);

    return res.json({
      message: "Nouveau code envoyé.",
      codeDevOnly: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;

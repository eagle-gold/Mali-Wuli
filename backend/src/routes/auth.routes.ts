import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// Génère un code à 6 chiffres
const genererCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const normaliserEmail = (email: unknown) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const emailEstValide = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const estCodeDeTest = (code: unknown) =>
  process.env.NODE_ENV === "development" && code === "123456";

// ─── POST /api/auth/request-email-code ──────────────────────────────────────
router.post("/request-email-code", async (req: Request, res: Response) => {
  const email = normaliserEmail(req.body.email);

  if (!emailEstValide(email)) {
    return res.status(400).json({ message: "Adresse e-mail invalide." });
  }

  try {
    const utilisateurExistant = await prisma.user.findUnique({ where: { email } });
    if (utilisateurExistant?.motDePasse) {
      return res.status(409).json({ message: "Un compte existe déjà avec cet e-mail." });
    }

    const code = genererCode();
    const codeExpire = new Date(Date.now() + 15 * 60 * 1000);
    const verification = await prisma.emailVerification.upsert({
      where: { email },
      create: { email, code, codeExpire },
      update: { code, codeExpire, verifieLe: null },
    });

    // TODO: Envoyer l'e-mail avec Nodemailer.
    console.log(`📧 Code de préinscription pour ${email}: ${code}`);

    return res.json({
      message: "Code envoyé.",
      verificationId: verification.id,
      codeDevOnly: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Impossible d'envoyer le code." });
  }
});

// ─── POST /api/auth/verify-registration-email ───────────────────────────────
router.post("/verify-registration-email", async (req: Request, res: Response) => {
  const { verificationId, code } = req.body;
  const email = normaliserEmail(req.body.email);

  if (!verificationId || !email || !code) {
    return res.status(400).json({ message: "Données de vérification manquantes." });
  }

  try {
    const verification = await prisma.emailVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification || verification.email !== email) {
      return res.status(404).json({ message: "Demande de vérification introuvable." });
    }
    if (verification.code !== code && !estCodeDeTest(code)) {
      return res.status(400).json({ message: "Code incorrect." });
    }
    if (verification.codeExpire < new Date() && !estCodeDeTest(code)) {
      return res.status(400).json({ message: "Code expiré. Demandez-en un nouveau." });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET manquant");
    const user = await prisma.$transaction(async (transaction) => {
      await transaction.emailVerification.update({
        where: { id: verification.id },
        data: { verifieLe: new Date() },
      });
      return transaction.user.upsert({
        where: { email },
        create: {
          email,
          emailVerifie: true,
          cguAccepteLe: new Date(),
          profil: { create: {} },
        },
        update: {
          emailVerifie: true,
          profil: { upsert: { create: {}, update: {} } },
        },
      });
    });
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      secret,
      { expiresIn: "7d" },
    );

    return res.json({
      message: "Adresse e-mail confirmée et compte créé.",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─── POST /api/auth/resend-registration-code ────────────────────────────────
router.post("/resend-registration-code", async (req: Request, res: Response) => {
  const { verificationId } = req.body;

  if (!verificationId) {
    return res.status(400).json({ message: "Demande de vérification manquante." });
  }

  try {
    const verification = await prisma.emailVerification.findUnique({
      where: { id: verificationId },
    });
    if (!verification) {
      return res.status(404).json({ message: "Demande de vérification introuvable." });
    }

    const code = genererCode();
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: {
        code,
        codeExpire: new Date(Date.now() + 15 * 60 * 1000),
        verifieLe: null,
      },
    });

    // TODO: Envoyer l'e-mail avec Nodemailer.
    console.log(`📧 Nouveau code de préinscription pour ${verification.email}: ${code}`);

    return res.json({
      message: "Nouveau code envoyé.",
      codeDevOnly: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Impossible de renvoyer le code." });
  }
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  const { prenom, nom, dateNaissance, motDePasse, parrainCode, registrationToken } = req.body;
  let email = normaliserEmail(req.body.email);
  let emailDejaVerifie = false;
  let sessionUserId: string | undefined;

  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  if (bearerToken) {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error("JWT_SECRET manquant");
      const payload = jwt.verify(bearerToken, secret) as { userId?: string };
      sessionUserId = payload.userId;
    } catch {
      return res.status(401).json({ message: "Session expirée ou invalide." });
    }
  }

  if (registrationToken) {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error("JWT_SECRET manquant");

      const payload = jwt.verify(registrationToken, secret) as {
        email?: string;
        purpose?: string;
      };
      if (payload.purpose !== "registration" || !payload.email) {
        return res.status(401).json({ message: "Validation de l'e-mail invalide." });
      }

      email = normaliserEmail(payload.email);
      const verification = await prisma.emailVerification.findUnique({ where: { email } });
      if (!verification?.verifieLe) {
        return res.status(401).json({ message: "L'adresse e-mail doit être confirmée." });
      }
      emailDejaVerifie = true;
    } catch {
      return res.status(401).json({ message: "Validation de l'e-mail expirée ou invalide." });
    }
  }

  if (!prenom || !nom || !email || !dateNaissance || !motDePasse) {
    return res.status(400).json({ message: "Tous les champs obligatoires doivent être remplis." });
  }

  if (motDePasse.length < 8) {
    return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." });
  }

  try {
    // Vérifier si l'email existe déjà
    const existant = await prisma.user.findUnique({ where: { email } });
    if (existant && existant.motDePasse) {
      return res.status(409).json({ message: "Un compte existe déjà avec cet email." });
    }
    if (existant && sessionUserId !== existant.id && !emailDejaVerifie) {
      return res.status(401).json({
        message: "Reconnectez-vous à la session créée après la vérification de votre e-mail.",
      });
    }

    // Trouver le parrain si un code est fourni
    let parrainId: string | undefined;
    if (parrainCode) {
      const parrain = await prisma.user.findUnique({ where: { id: parrainCode } });
      if (parrain) parrainId = parrain.id;
    }

    // Hasher le mot de passe
    const hash = await bcrypt.hash(motDePasse, 12);

    // Générer un code uniquement pour l'ancien parcours compatible.
    const compteEstVerifie = emailDejaVerifie || existant?.emailVerifie || false;
    const code = compteEstVerifie ? null : genererCode();
    const expiration = compteEstVerifie ? null : new Date(Date.now() + 15 * 60 * 1000);

    // Créer l'utilisateur
    const donneesCompte = {
      prenom,
      nom,
      email,
      dateNaissance: new Date(dateNaissance),
      motDePasse: hash,
      codeVerif: code,
      codeExpire: expiration,
      emailVerifie: compteEstVerifie,
      cguAccepteLe: existant?.cguAccepteLe ?? new Date(),
      parrainId,
    };
    const user = existant
      ? await prisma.user.update({
          where: { id: existant.id },
          data: { ...donneesCompte, profil: { upsert: { create: {}, update: {} } } },
        })
      : await prisma.user.create({
          data: { ...donneesCompte, profil: emailDejaVerifie ? { create: {} } : undefined },
        });

    if (user.emailVerifie) {
      await prisma.emailVerification.deleteMany({ where: { email } });
      return res.status(201).json({
        message: "Compte créé. Votre adresse e-mail est confirmée.",
        userId: user.id,
        emailVerifie: true,
      });
    }

    // Ancien parcours conservé pour compatibilité.
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
    if (user.codeVerif !== code && !estCodeDeTest(code)) return res.status(400).json({ message: "Code incorrect." });
    if ((!user.codeExpire || user.codeExpire < new Date()) && !estCodeDeTest(code)) {
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

    if (!user.motDePasse) {
      return res.status(409).json({ message: "Terminez la création de votre profil avant de vous connecter." });
    }
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

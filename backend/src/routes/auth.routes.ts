import { Router, Request, Response } from "express";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { rateLimit } from "express-rate-limit";
import {
  signerTokenAcces,
  signerTokenInscription,
  verifierTokenInscription,
} from "../lib/auth-token";
import { prisma } from "../lib/prisma";
import { roleEffectif, rolePourInscription, droitsUtilisateur } from "../lib/roles";
import { revoquerSocketsUtilisateur } from "../realtime/socket";
import {
  envoyerCodeConnexion,
  envoyerCodeReinitialisation,
  envoyerCodeVerification,
} from "../services/email.service";

const lireEntierConfiguration = (
  nom: string,
  valeurParDefaut: number,
  minimum: number,
  maximum: number,
) => {
  const valeur = Number.parseInt(process.env[nom] || "", 10);
  return Number.isFinite(valeur) && valeur >= minimum && valeur <= maximum
    ? valeur
    : valeurParDefaut;
};

// Pendant la phase de test, une rafale raisonnable doit pouvoir etre envoyee
// sans verrouiller l'equipe pendant quinze minutes. Ces valeurs restent
// configurables pour etre durcies sans nouveau deploiement de code.
const fenetreAuthentificationSecondes = lireEntierConfiguration(
  "AUTH_RATE_WINDOW_SECONDS",
  60,
  10,
  3600,
);
const nombreRequetesAuthentificationParFenetre = lireEntierConfiguration(
  "AUTH_RATE_LIMIT",
  120,
  10,
  1000,
);
const fenetreEnvoiCodeSecondes = lireEntierConfiguration(
  "AUTH_CODE_RATE_WINDOW_SECONDS",
  60,
  10,
  3600,
);
const nombreEnvoisCodeParFenetre = lireEntierConfiguration(
  "AUTH_CODE_RATE_LIMIT",
  12,
  2,
  100,
);
const fenetreDemandeOtpSecondes = lireEntierConfiguration(
  "LOGIN_OTP_RATE_WINDOW_SECONDS",
  60,
  10,
  3600,
);
const nombreDemandesOtpParFenetre = lireEntierConfiguration(
  "LOGIN_OTP_RATE_LIMIT",
  10,
  2,
  100,
);
const delaiEntreDemandesOtpSecondes = lireEntierConfiguration(
  "LOGIN_OTP_COOLDOWN_SECONDS",
  5,
  1,
  300,
);

const router = Router();
const limiteAuthentification = rateLimit({
  windowMs: fenetreAuthentificationSecondes * 1000,
  limit: nombreRequetesAuthentificationParFenetre,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Trop de tentatives. Patientez un court instant avant de réessayer.",
    retryAfterSeconds: fenetreAuthentificationSecondes,
  },
});
const limiteEnvoiCode = rateLimit({
  windowMs: fenetreEnvoiCodeSecondes * 1000,
  limit: nombreEnvoisCodeParFenetre,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Trop de codes ont été demandés. Patientez un court instant puis réessayez.",
    retryAfterSeconds: fenetreEnvoiCodeSecondes,
  },
});
const limiteConnexion = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Trop de tentatives de connexion. Réessayez dans quelques minutes." },
});
const limiteDemandeOtpParEmail = rateLimit({
  windowMs: fenetreDemandeOtpSecondes * 1000,
  limit: nombreDemandesOtpParFenetre,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `connexion-otp-demande:${normaliserEmail(req.body?.email)}`,
  message: {
    message: "Trop de codes ont été demandés. Patientez un court instant puis réessayez.",
    retryAfterSeconds: fenetreDemandeOtpSecondes,
  },
  // La limite IP est déjà appliquée par `limiteEnvoiCode`. Cette seconde
  // couche protège une même adresse contre des demandes distribuées.
  validate: { keyGeneratorIpFallback: false },
});
const limiteDemandeOtpCooldown = rateLimit({
  windowMs: delaiEntreDemandesOtpSecondes * 1000,
  limit: 1,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `connexion-otp-cooldown:${normaliserEmail(req.body?.email)}`,
  message: {
    message: "Un code vient déjà d'être demandé. Patientez quelques secondes avant de réessayer.",
    retryAfterSeconds: delaiEntreDemandesOtpSecondes,
  },
  validate: { keyGeneratorIpFallback: false },
});
const limiteVerificationOtpParEmail = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `connexion-otp-verification:${normaliserEmail(req.body?.email)}`,
  message: { message: "Trop de tentatives de connexion. Réessayez dans quelques minutes." },
  validate: { keyGeneratorIpFallback: false },
});

router.use(limiteAuthentification);

// Génère un code à 6 chiffres
const genererCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const normaliserEmail = (email: unknown) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const emailEstValide = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const motDePasseEstValide = (motDePasse: string) =>
  motDePasse.length >= 8 &&
  /[a-z]/.test(motDePasse) &&
  /[A-Z]/.test(motDePasse) &&
  /\d/.test(motDePasse);

const convertirDateNaissance = (valeur: unknown) => {
  if (typeof valeur !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const date = new Date(`${valeur}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(valeur)) return null;

  const dateLimite = new Date();
  dateLimite.setUTCHours(0, 0, 0, 0);
  dateLimite.setUTCFullYear(dateLimite.getUTCFullYear() - 16);
  return date <= dateLimite ? date : null;
};

const estCodeDeTest = (code: unknown) =>
  process.env.NODE_ENV === "development" && code === "123456";

const messageReinitialisation =
  "Si un compte correspond à cette adresse, un code de réinitialisation vient d'être envoyé.";
const messageCodeReinitialisationInvalide =
  "Code invalide ou expiré. Demandez-en un nouveau.";
const messageDemandeConnexion =
  "Si un compte correspond à cette adresse, un code de connexion vient d'être envoyé.";
const messageCodeConnexionInvalide =
  "Code invalide ou expiré. Demandez un nouveau code de connexion.";
const hashCodeFactice =
  "$2a$10$YqZ3c7bebK6IMmyZQr/X8OxFJO.E2SeysA8D4X0TGhUtlmJXPy46u";

class ReinitialisationInvalide extends Error {}

const comptePeutSeConnecter = (utilisateur: {
  emailVerifie: boolean;
  prenom: string | null;
  nom: string | null;
  statut: string;
} | null | undefined) => Boolean(
  utilisateur?.emailVerifie &&
  utilisateur.prenom &&
  utilisateur.nom &&
  utilisateur.statut !== "REFUSE" &&
  utilisateur.statut !== "SUSPENDU",
);

// ─── POST /api/auth/request-email-code ──────────────────────────────────────
router.post("/request-email-code", limiteEnvoiCode, async (req: Request, res: Response) => {
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

    await envoyerCodeVerification(email, code);

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

    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { verifieLe: new Date() },
    });
    // Ce jeton ne permet d'appeler aucune route protégée. Il sert uniquement à
    // terminer POST /auth/register et expire rapidement.
    const registrationToken = signerTokenInscription(email, verification.id);

    return res.json({
      message: "Adresse e-mail confirmée. Finalisez maintenant votre compte.",
      registrationToken,
      email,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─── POST /api/auth/resend-registration-code ────────────────────────────────
router.post("/resend-registration-code", limiteEnvoiCode, async (req: Request, res: Response) => {
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

    await envoyerCodeVerification(verification.email, code);

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
  const prenom = typeof req.body.prenom === "string" ? req.body.prenom.trim() : "";
  const nom = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
  const motDePasse = typeof req.body.motDePasse === "string" ? req.body.motDePasse : "";
  const parrainCode = typeof req.body.parrainCode === "string" ? req.body.parrainCode.trim() : "";
  const registrationToken = typeof req.body.registrationToken === "string"
    ? req.body.registrationToken.trim()
    : "";
  const dateNaissanceFournie = typeof req.body.dateNaissance === "string"
    ? req.body.dateNaissance.trim()
    : "";
  const dateNaissance = dateNaissanceFournie
    ? convertirDateNaissance(dateNaissanceFournie)
    : undefined;
  if (!registrationToken) {
    return res.status(401).json({ message: "Confirmez d'abord votre adresse e-mail." });
  }

  let inscription: ReturnType<typeof verifierTokenInscription>;
  try {
    inscription = verifierTokenInscription(registrationToken);
  } catch {
    return res.status(401).json({ message: "Validation de l'e-mail expirée ou invalide." });
  }

  const email = normaliserEmail(inscription.email);
  const emailFourni = normaliserEmail(req.body.email);
  if (emailFourni && emailFourni !== email) {
    return res.status(401).json({ message: "L'adresse e-mail ne correspond pas à la validation." });
  }

  if (!prenom || !nom || !email || !motDePasse) {
    return res.status(400).json({ message: "Tous les champs obligatoires doivent être remplis." });
  }

  if (!motDePasseEstValide(motDePasse)) {
    return res.status(400).json({
      message: "Le mot de passe doit contenir au moins 8 caractères, une minuscule, une majuscule et un chiffre.",
    });
  }

  // Ce champ n'est plus demandé à l'inscription. Il reste accepté pour les
  // anciennes versions du client, avec la même validation qu'auparavant.
  if (dateNaissanceFournie && !dateNaissance) {
    return res.status(400).json({
      message: "Indiquez une date de naissance valide. Vous devez avoir au moins 16 ans.",
    });
  }

  try {
    const verification = await prisma.emailVerification.findFirst({
      where: {
        id: inscription.verificationId,
        email,
        verifieLe: { not: null },
      },
    });
    if (!verification) {
      return res.status(401).json({ message: "L'adresse e-mail doit être confirmée." });
    }

    // Vérifier si l'email existe déjà
    const existant = await prisma.user.findUnique({ where: { email } });
    if (existant && existant.motDePasse) {
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

    // Créer le compte final et consommer la vérification dans la même
    // transaction. Le premier véritable JWT n'est émis qu'après cette étape.
    const roleAttribue = rolePourInscription(email, existant?.role);
    const donneesCompte = {
      prenom,
      nom,
      email,
      dateNaissance,
      motDePasse: hash,
      codeVerif: null,
      codeExpire: null,
      emailVerifie: true,
      cguAccepteLe: existant?.cguAccepteLe ?? new Date(),
      parrainId,
      role: roleAttribue,
      // Aucune validation par l'équipe : un compte créé accède immédiatement
      // au réseau. Un compte existant conserve son statut (ex. suspendu) ;
      // l'administrateur principal reste toujours actif.
      statut: roleAttribue === Role.ADMIN ? "VALIDE" as const : (existant?.statut ?? "VALIDE" as const),
    };
    const user = await prisma.$transaction(async (transaction) => {
      const compte = existant
        ? await transaction.user.update({
            where: { id: existant.id },
            data: { ...donneesCompte, profil: { upsert: { create: {}, update: {} } } },
            include: { rolesDelegues: { select: { code: true } } },
          })
        : await transaction.user.create({
            data: { ...donneesCompte, profil: { create: {} } },
            include: { rolesDelegues: { select: { code: true } } },
          });
      await transaction.emailVerification.delete({ where: { id: verification.id } });
      return compte;
    });

    const token = signerTokenAcces(user);

    return res.status(201).json({
      message: "Compte créé. Votre adresse e-mail est confirmée.",
      token,
      user: {
        id: user.id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        role: roleEffectif(user),
        ...droitsUtilisateur(user),
        statut: user.statut,
        onboardingFini: false,
      },
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

// ─── POST /api/auth/login/otp/request ───────────────────────────────────────
// La réponse est strictement identique pour une adresse connue, inconnue ou
// momentanément interdite. Le hash coûteux est également calculé dans tous les
// cas pour réduire les différences de temps observables.
router.post(
  "/login/otp/request",
  limiteEnvoiCode,
  limiteDemandeOtpParEmail,
  limiteDemandeOtpCooldown,
  async (req: Request, res: Response) => {
    const email = normaliserEmail(req.body.email);
    if (!emailEstValide(email)) {
      return res.status(400).json({ message: "Adresse e-mail invalide." });
    }

    try {
      const code = randomInt(100000, 1000000).toString();
      const codeHash = await bcrypt.hash(code, 10);
      const utilisateur = await prisma.user.findUnique({
        where: { email },
        select: {
          email: true,
          emailVerifie: true,
          prenom: true,
          nom: true,
          statut: true,
        },
      });

      if (comptePeutSeConnecter(utilisateur)) {
        await prisma.loginOtpCode.upsert({
          where: { email },
          create: {
            email,
            codeHash,
            expireLe: new Date(Date.now() + 10 * 60 * 1000),
          },
          update: {
            codeHash,
            expireLe: new Date(Date.now() + 10 * 60 * 1000),
            tentatives: 0,
            utiliseLe: null,
          },
        });

        // La durée du transport e-mail ne doit pas permettre de distinguer
        // une adresse inscrite d'une adresse inconnue via le temps de réponse.
        setImmediate(() => {
          void envoyerCodeConnexion(utilisateur!.email, code).catch((erreurEmail) => {
            console.error("Impossible d'envoyer l'e-mail de connexion.", erreurEmail);
          });
        });
      } else {
        // Un changement de statut ou la suppression d'un compte invalide aussi
        // tout code qui aurait été émis auparavant.
        await prisma.loginOtpCode.deleteMany({ where: { email } });
      }

      return res.json({
        message: messageDemandeConnexion,
        expiresInSeconds: 600,
        retryAfterSeconds: delaiEntreDemandesOtpSecondes,
      });
    } catch (err) {
      console.error(err);
      // Ne jamais révéler ici si l'incident concernait une adresse existante.
      return res.json({
        message: messageDemandeConnexion,
        expiresInSeconds: 600,
        retryAfterSeconds: delaiEntreDemandesOtpSecondes,
      });
    }
  },
);

// ─── POST /api/auth/login/otp/verify ────────────────────────────────────────
router.post(
  "/login/otp/verify",
  limiteConnexion,
  limiteVerificationOtpParEmail,
  async (req: Request, res: Response) => {
    const email = normaliserEmail(req.body.email);
    const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
    if (!emailEstValide(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: messageCodeConnexionInvalide });
    }

    try {
      const demande = await prisma.loginOtpCode.findUnique({ where: { email } });
      const maintenant = new Date();
      // Une comparaison bcrypt est effectuée même sans demande afin de ne pas
      // transformer cet endpoint en outil de découverte de comptes.
      const codeValide = await bcrypt.compare(code, demande?.codeHash ?? hashCodeFactice);
      const demandeUtilisable = Boolean(
        demande &&
        !demande.utiliseLe &&
        demande.expireLe > maintenant &&
        demande.tentatives < 5,
      );

      if (!demande || !demandeUtilisable || !codeValide) {
        if (demande && demandeUtilisable) {
          await prisma.loginOtpCode.updateMany({
            where: {
              id: demande.id,
              codeHash: demande.codeHash,
              utiliseLe: null,
              expireLe: { gt: maintenant },
              tentatives: { lt: 5 },
            },
            data: {
              tentatives: { increment: 1 },
              // La cinquième erreur clôt définitivement ce code.
              utiliseLe: demande.tentatives >= 4 ? maintenant : undefined,
            },
          });
        }
        return res.status(400).json({ message: messageCodeConnexionInvalide });
      }

      const resultat = await prisma.$transaction(async (transaction) => {
        // Réclamation atomique : si deux vérifications correctes arrivent en
        // parallèle, une seule peut consommer ce code.
        const reclamation = await transaction.loginOtpCode.updateMany({
          where: {
            id: demande.id,
            codeHash: demande.codeHash,
            utiliseLe: null,
            expireLe: { gt: maintenant },
            tentatives: { lt: 5 },
          },
          data: { utiliseLe: maintenant },
        });
        if (reclamation.count !== 1) return null;

        const utilisateur = await transaction.user.findUnique({
          where: { email },
          include: { profil: true, rolesDelegues: { select: { code: true } } },
        });
        // Le statut est relu au moment exact de la consommation. Le code reste
        // consommé si le compte vient d'être suspendu ou refusé.
        return comptePeutSeConnecter(utilisateur) ? utilisateur : null;
      });

      if (!resultat) {
        return res.status(400).json({ message: messageCodeConnexionInvalide });
      }

      const token = signerTokenAcces(resultat);
      return res.json({
        token,
        user: {
          id: resultat.id,
          prenom: resultat.prenom,
          nom: resultat.nom,
          email: resultat.email,
          role: roleEffectif(resultat),
          ...droitsUtilisateur(resultat),
          statut: resultat.statut,
          onboardingFini: resultat.profil?.onboardingFini ?? false,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Impossible de vous connecter pour le moment." });
    }
  },
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Les membres choisissent librement entre mot de passe et OTP. Le commutateur
// permet encore de desactiver le mot de passe explicitement si necessaire.
router.post("/login", limiteConnexion, async (req: Request, res: Response) => {
  if (process.env.ENABLE_PASSWORD_LOGIN === "false") {
    return res.status(404).json({ message: "Route introuvable." });
  }

  const email = normaliserEmail(req.body.email);
  const motDePasse = typeof req.body.motDePasse === "string" ? req.body.motDePasse : "";

  if (!email || !motDePasse) {
    return res.status(400).json({ message: "Email et mot de passe requis." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profil: true, rolesDelegues: { select: { code: true } } },
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

    // Une connexion par mot de passe invalide un éventuel code OTP en attente.
    await prisma.loginOtpCode.deleteMany({ where: { email } });

    const token = signerTokenAcces(user);

    return res.json({
      token,
      user: {
        id: user.id,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        role: roleEffectif(user),
        ...droitsUtilisateur(user),
        statut: user.statut,
        onboardingFini: user.profil?.onboardingFini ?? false,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
// La réponse est volontairement identique qu'un compte existe ou non afin de
// ne pas transformer ce point d'entrée en annuaire d'adresses e-mail.
router.post("/forgot-password", limiteEnvoiCode, async (req: Request, res: Response) => {
  const email = normaliserEmail(req.body.email);

  if (!emailEstValide(email)) {
    return res.status(400).json({ message: "Adresse e-mail invalide." });
  }

  try {
    const code = randomInt(100000, 1000000).toString();
    // Le hash est calculé même lorsque l'adresse n'existe pas, ce qui limite
    // les différences de temps de réponse observables entre les deux cas.
    const codeHash = await bcrypt.hash(code, 10);
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerifie: true, motDePasse: true },
    });

    if (user?.emailVerifie && user.motDePasse) {
      await prisma.passwordResetCode.upsert({
        where: { email },
        create: {
          email,
          codeHash,
          expireLe: new Date(Date.now() + 15 * 60 * 1000),
        },
        update: {
          codeHash,
          expireLe: new Date(Date.now() + 15 * 60 * 1000),
          tentatives: 0,
          utiliseLe: null,
        },
      });

      try {
        await envoyerCodeReinitialisation(user.email, code);
      } catch (erreurEmail) {
        // Ne pas modifier la réponse publique : cela révélerait l'existence du
        // compte. L'erreur reste visible dans les journaux d'exploitation.
        console.error("Impossible d'envoyer l'e-mail de réinitialisation.", erreurEmail);
      }
    }

    return res.json({ message: messageReinitialisation });
  } catch (err) {
    console.error(err);
    // Même en cas d'incident interne, ne pas révéler si l'adresse est connue.
    return res.json({ message: messageReinitialisation });
  }
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
router.post("/reset-password", limiteConnexion, async (req: Request, res: Response) => {
  const email = normaliserEmail(req.body.email);
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
  const motDePasse = typeof req.body.motDePasse === "string" ? req.body.motDePasse : "";

  if (!emailEstValide(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: messageCodeReinitialisationInvalide });
  }
  if (!motDePasseEstValide(motDePasse)) {
    return res.status(400).json({
      message: "Le nouveau mot de passe doit contenir au moins 8 caractères, une minuscule, une majuscule et un chiffre.",
    });
  }

  try {
    const demande = await prisma.passwordResetCode.findUnique({ where: { email } });
    const maintenant = new Date();

    if (
      !demande ||
      demande.utiliseLe ||
      demande.expireLe <= maintenant ||
      demande.tentatives >= 5
    ) {
      return res.status(400).json({ message: messageCodeReinitialisationInvalide });
    }

    const codeValide = await bcrypt.compare(code, demande.codeHash);
    if (!codeValide) {
      const tentatives = demande.tentatives + 1;
      await prisma.passwordResetCode.update({
        where: { id: demande.id },
        data: {
          tentatives,
          utiliseLe: tentatives >= 5 ? maintenant : undefined,
        },
      });
      return res.status(400).json({ message: messageCodeReinitialisationInvalide });
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, 12);
    const utilisateurId = await prisma.$transaction(async (transaction) => {
      // La réclamation atomique garantit que deux requêtes simultanées ne
      // peuvent pas consommer le même code.
      const reclamation = await transaction.passwordResetCode.updateMany({
        where: {
          id: demande.id,
          utiliseLe: null,
          tentatives: { lt: 5 },
          expireLe: { gt: maintenant },
        },
        data: { utiliseLe: maintenant },
      });
      if (reclamation.count !== 1) throw new ReinitialisationInvalide();

      const utilisateur = await transaction.user.findFirst({
        where: { email, emailVerifie: true },
        select: { id: true },
      });
      if (!utilisateur) throw new ReinitialisationInvalide();
      await transaction.user.update({
        where: { id: utilisateur.id },
        data: {
          motDePasse: motDePasseHash,
          tokenVersion: { increment: 1 },
        },
      });
      await transaction.loginOtpCode.deleteMany({ where: { email } });
      return utilisateur.id;
    });

    revoquerSocketsUtilisateur(utilisateurId);

    return res.json({
      message: "Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.",
    });
  } catch (err) {
    if (err instanceof ReinitialisationInvalide) {
      return res.status(400).json({ message: messageCodeReinitialisationInvalide });
    }
    console.error(err);
    return res.status(500).json({ message: "Impossible de modifier le mot de passe." });
  }
});

// ─── POST /api/auth/resend-code ──────────────────────────────────────────────
router.post("/resend-code", limiteEnvoiCode, async (req: Request, res: Response) => {
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

    await envoyerCodeVerification(user.email, code);

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

import bcrypt from "bcryptjs";
import { AddressInfo } from "net";
import { httpServer, io } from "../index";
import { prisma } from "../lib/prisma";

type Reponse = { status: number; json: Record<string, any> };

async function main() {
  // Le smoke valide explicitement le parcours public demande, meme si
  // l'environnement local d'un operateur l'a temporairement desactive.
  process.env.ENABLE_PASSWORD_LOGIN = "true";
  const suffixe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `otp-smoke-${suffixe}@example.invalid`;
  const emailInconnu = `otp-unknown-${suffixe}@example.invalid`;
  const code = "654321";

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const port = (httpServer.address() as AddressInfo).port;

  const appel = async (chemin: string, body: object): Promise<Reponse> => {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth${chemin}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() as Record<string, any> };
  };

  try {
    const motDePasse = "Compatibilite123!";
    await prisma.user.create({
      data: {
        email,
        prenom: "Test",
        nom: "OTP",
        motDePasse: await bcrypt.hash(motDePasse, 10),
        emailVerifie: true,
        statut: "VALIDE",
        profil: { create: { onboardingFini: true } },
      },
    });

    const connexionMotDePasse = await appel("/login", {
      email,
      motDePasse,
    });
    if (connexionMotDePasse.status !== 200 || !connexionMotDePasse.json.token) {
      throw new Error("La connexion publique par mot de passe doit retourner une session.");
    }

    const [demandeConnue, demandeInconnue] = await Promise.all([
      appel("/login/otp/request", { email }),
      appel("/login/otp/request", { email: emailInconnu }),
    ]);
    if (demandeConnue.status !== 200 || demandeInconnue.status !== 200) {
      throw new Error("La demande OTP doit répondre 200 sans révéler l'existence du compte.");
    }
    if (demandeConnue.json.message !== demandeInconnue.json.message) {
      throw new Error("La réponse de demande permet d'énumérer les comptes.");
    }
    if (await prisma.loginOtpCode.findUnique({ where: { email: emailInconnu } })) {
      throw new Error("Une adresse inconnue ne doit pas créer de code persistant.");
    }

    await prisma.loginOtpCode.update({
      where: { email },
      data: {
        codeHash: await bcrypt.hash(code, 10),
        expireLe: new Date(Date.now() + 10 * 60 * 1000),
        tentatives: 0,
        utiliseLe: null,
      },
    });

    const erreur = await appel("/login/otp/verify", { email, code: "000001" });
    if (erreur.status !== 400) throw new Error("Un code incorrect doit être refusé.");
    const apresErreur = await prisma.loginOtpCode.findUniqueOrThrow({ where: { email } });
    if (apresErreur.tentatives !== 1) throw new Error("Une erreur doit incrémenter les tentatives.");

    const succes = await appel("/login/otp/verify", { email, code });
    if (succes.status !== 200 || !succes.json.token || succes.json.user?.email !== email) {
      throw new Error("Le code correct doit retourner la session et le membre.");
    }

    const reutilisation = await appel("/login/otp/verify", { email, code });
    if (reutilisation.status !== 400) throw new Error("Un code consommé ne doit pas être réutilisable.");

    await prisma.loginOtpCode.update({
      where: { email },
      data: {
        codeHash: await bcrypt.hash(code, 10),
        expireLe: new Date(Date.now() + 10 * 60 * 1000),
        tentatives: 0,
        utiliseLe: null,
      },
    });

    // Simule un renvoi entre la lecture et la réclamation d'un ancien code :
    // le verrou optimiste sur le hash doit empêcher l'ancien code de consommer
    // la nouvelle demande, même si l'upsert a conservé le même identifiant.
    const ancienneDemande = await prisma.loginOtpCode.findUniqueOrThrow({ where: { email } });
    const nouveauHash = await bcrypt.hash("123456", 10);
    await prisma.loginOtpCode.update({
      where: { email },
      data: { codeHash: nouveauHash, tentatives: 0, utiliseLe: null },
    });
    const reclamationPerimee = await prisma.loginOtpCode.updateMany({
      where: {
        id: ancienneDemande.id,
        codeHash: ancienneDemande.codeHash,
        utiliseLe: null,
      },
      data: { utiliseLe: new Date() },
    });
    if (reclamationPerimee.count !== 0) {
      throw new Error("Un ancien code ne doit pas pouvoir consommer le code renvoyé.");
    }

    await prisma.loginOtpCode.update({
      where: { email },
      data: {
        codeHash: await bcrypt.hash(code, 10),
        expireLe: new Date(Date.now() + 10 * 60 * 1000),
        tentatives: 0,
        utiliseLe: null,
      },
    });
    const concurrence = await Promise.all([
      appel("/login/otp/verify", { email, code }),
      appel("/login/otp/verify", { email, code }),
    ]);
    const succesConcurrents = concurrence.filter((reponse) => reponse.status === 200).length;
    if (succesConcurrents !== 1) {
      throw new Error("Une seule vérification concurrente doit pouvoir consommer le code.");
    }

    process.stdout.write("login-otp-smoke-ok\n");
  } finally {
    await prisma.loginOtpCode.deleteMany({ where: { email: { in: [email, emailInconnu] } } });
    await prisma.user.deleteMany({ where: { email } });
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

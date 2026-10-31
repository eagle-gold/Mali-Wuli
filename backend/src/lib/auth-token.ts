import { randomUUID } from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";

type AccessTokenPayload = JwtPayload & {
  purpose: "access";
  userId: string;
  tokenVersion: number;
};

type RegistrationTokenPayload = JwtPayload & {
  purpose: "registration";
  email: string;
  verificationId: string;
};

function secretJwt() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET manquant");
  return secret;
}

export function signerTokenAcces(user: { id: string; tokenVersion: number }) {
  return jwt.sign(
    {
      purpose: "access",
      userId: user.id,
      tokenVersion: user.tokenVersion,
    },
    secretJwt(),
    // Identifiant unique de la session : permet de révoquer un seul appareil.
    { expiresIn: "7d", jwtid: randomUUID() },
  );
}

export function verifierTokenAcces(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, secretJwt());
  if (
    typeof payload === "string" ||
    payload.purpose !== "access" ||
    typeof payload.userId !== "string" ||
    !Number.isInteger(payload.tokenVersion) ||
    Number(payload.tokenVersion) < 0
  ) {
    throw new Error("Token d'accès invalide");
  }
  return payload as AccessTokenPayload;
}

export function signerTokenInscription(email: string, verificationId: string) {
  return jwt.sign(
    {
      purpose: "registration",
      email,
      verificationId,
    },
    secretJwt(),
    { expiresIn: "30m" },
  );
}

export function verifierTokenInscription(token: string): RegistrationTokenPayload {
  const payload = jwt.verify(token, secretJwt());
  if (
    typeof payload === "string" ||
    payload.purpose !== "registration" ||
    typeof payload.email !== "string" ||
    typeof payload.verificationId !== "string"
  ) {
    throw new Error("Token d'inscription invalide");
  }
  return payload as RegistrationTokenPayload;
}

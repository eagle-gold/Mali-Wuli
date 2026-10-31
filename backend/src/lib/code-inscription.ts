import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

/** Essais autorisés pour un même code de vérification d'e-mail. */
export const TENTATIVES_CODE_MAX = 5;
/** Durée de validité d'un code de vérification d'e-mail. */
export const VALIDITE_CODE_MS = 15 * 60 * 1000;

/** Code à 6 chiffres issu d'un générateur cryptographique. */
export function genererCodeVerification() {
  return randomInt(100000, 1_000_000).toString();
}

/** Le code n'est jamais stocké en clair. */
export function hacherCodeVerification(code: string) {
  return bcrypt.hash(code, 10);
}

export function formatCodeValide(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

/** Compare un code saisi à son empreinte ; un format invalide n'est jamais comparé. */
export async function codeCorrespond(code: unknown, empreinte: string) {
  if (!formatCodeValide(code)) return false;
  return bcrypt.compare(code, empreinte);
}

export function tentativesRestantes(tentativesConsommees: number) {
  return Math.max(0, TENTATIVES_CODE_MAX - tentativesConsommees);
}

/** Message affiché après un code incorrect. */
export function messageCodeIncorrect(tentativesConsommees: number) {
  const restantes = tentativesRestantes(tentativesConsommees);
  if (restantes === 0) return "Code incorrect. Trop de tentatives : demandez un nouveau code.";
  return `Code incorrect. Il vous reste ${restantes} essai${restantes > 1 ? "s" : ""}.`;
}

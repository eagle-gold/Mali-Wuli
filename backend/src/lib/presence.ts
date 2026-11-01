import { prisma } from "./prisma";

/**
 * Présence des membres. « En ligne » = au moins une connexion temps réel
 * ouverte (l'espace membre ouvre le socket sur toutes ses pages).
 * Compteur en mémoire : valable pour un seul processus Node (cas actuel,
 * Hostinger). Avec plusieurs instances, il faudra un stockage partagé.
 */
const connexions = new Map<string, number>();

/** Renvoie vrai à la première connexion du membre (il vient d'apparaître). */
export function connexionOuverte(userId: string) {
  const nombre = (connexions.get(userId) || 0) + 1;
  connexions.set(userId, nombre);
  return nombre === 1;
}

/** Renvoie vrai à la fermeture de sa dernière connexion (il vient de partir). */
export function connexionFermee(userId: string) {
  const nombre = Math.max(0, (connexions.get(userId) || 0) - 1);
  if (nombre === 0) connexions.delete(userId);
  else connexions.set(userId, nombre);
  return nombre === 0;
}

export function estEnLigne(userId: string) {
  return (connexions.get(userId) || 0) > 0;
}

/** Enregistre la dernière activité ; une erreur de base n'interrompt jamais l'action en cours. */
export async function enregistrerActivite(userId: string, date = new Date()) {
  try {
    await prisma.user.update({ where: { id: userId }, data: { derniereActiviteLe: date } });
  } catch (erreur) {
    console.error("Dernière activité non enregistrée", erreur);
  }
  return date;
}

export function reinitialiserPresencePourTests() {
  connexions.clear();
}

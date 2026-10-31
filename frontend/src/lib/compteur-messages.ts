import { useSyncExternalStore } from "react";

/**
 * Nombre de messages non lus, partagé entre l'en-tête (qui le charge) et la
 * barre de navigation mobile (qui l'affiche) sans requête supplémentaire.
 */
let valeur = 0;
const abonnes = new Set<() => void>();

export function definirMessagesNonLus(nombre: number) {
  const suivant = Number.isFinite(nombre) && nombre > 0 ? Math.floor(nombre) : 0;
  if (suivant === valeur) return;
  valeur = suivant;
  abonnes.forEach((notifier) => notifier());
}

export function lireMessagesNonLus() {
  return valeur;
}

function abonner(notifier: () => void) {
  abonnes.add(notifier);
  return () => { abonnes.delete(notifier); };
}

export function useMessagesNonLus() {
  return useSyncExternalStore(abonner, lireMessagesNonLus, () => 0);
}

/** Libellé court d'une pastille de compteur. */
export function libellePastille(nombre: number) {
  return nombre > 99 ? "99+" : String(nombre);
}

/** Règles identiques à celles du serveur (backend/src/routes/auth.routes.ts). */
export function criteresMotDePasse(valeur: string) {
  return [
    { cle: "longueur", libelle: "8 caractères minimum", valide: valeur.length >= 8 },
    { cle: "minuscule", libelle: "Une minuscule", valide: /[a-z]/.test(valeur) },
    { cle: "majuscule", libelle: "Une majuscule", valide: /[A-Z]/.test(valeur) },
    { cle: "chiffre", libelle: "Un chiffre", valide: /\d/.test(valeur) },
  ] as const;
}

export function motDePasseValide(valeur: string) {
  return criteresMotDePasse(valeur).every((critere) => critere.valide);
}

export type Robustesse = { niveau: 0 | 1 | 2 | 3 | 4; libelle: string };

/**
 * Indication de robustesse : les règles obligatoires, puis la longueur et la
 * variété (caractère spécial) pour distinguer « correct » de « excellent ».
 */
export function robustesseMotDePasse(valeur: string): Robustesse {
  if (!valeur) return { niveau: 0, libelle: "" };
  const respectees = criteresMotDePasse(valeur).filter((critere) => critere.valide).length;
  if (respectees < 4) return { niveau: respectees >= 3 ? 2 : 1, libelle: "Trop faible" };
  const bonus = Number(valeur.length >= 12) + Number(/[^A-Za-z0-9]/.test(valeur));
  if (bonus === 0) return { niveau: 3, libelle: "Correct" };
  return { niveau: 4, libelle: bonus === 2 ? "Excellent" : "Solide" };
}

export function emailValide(valeur: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim());
}

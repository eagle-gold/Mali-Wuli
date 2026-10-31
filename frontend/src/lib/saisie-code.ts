export const LONGUEUR_CODE = 6;

/**
 * Insère une saisie (un chiffre, un collage ou un remplissage automatique du
 * téléphone) à partir d'une case. Renvoie les cases et la case à activer.
 */
export function insererDansCode(cases: readonly string[], index: number, saisie: string) {
  const chiffres = saisie.replace(/\D/g, "");
  const suivant = [...cases];
  if (!chiffres) {
    suivant[index] = "";
    return { cases: suivant, focus: index };
  }
  // Un code complet collé n'importe où remplace tout.
  const depart = chiffres.length >= cases.length ? 0 : index;
  let position = depart;
  for (const chiffre of chiffres.slice(0, cases.length - depart)) {
    suivant[position] = chiffre;
    position += 1;
  }
  return { cases: suivant, focus: Math.min(position, cases.length - 1) };
}

export function codeComplet(cases: readonly string[]) {
  return cases.length === LONGUEUR_CODE && cases.every((chiffre) => /^\d$/.test(chiffre));
}

/** « 0:42 » pour un compte à rebours en secondes. */
export function formaterDecompte(secondes: number) {
  const s = Math.max(0, Math.ceil(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

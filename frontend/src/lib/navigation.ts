/** Une rubrique est active sur sa page et ses sous-pages, jamais sur un simple préfixe (/offres ≠ /offresX). */
export function rubriqueActive(chemin: string | null | undefined, href: string) {
  if (!chemin) return false;
  return chemin === href || chemin.startsWith(`${href}/`);
}

export const RESEAUX_SOCIAUX = [
  { cle: "linkedin", nom: "LinkedIn", exemple: "https://www.linkedin.com/in/votre-profil" },
  { cle: "facebook", nom: "Facebook", exemple: "https://www.facebook.com/votre.profil" },
  { cle: "instagram", nom: "Instagram", exemple: "https://www.instagram.com/votre.profil" },
  { cle: "tiktok", nom: "TikTok", exemple: "https://www.tiktok.com/@votre.profil" },
] as const;

export type ReseauSocial = typeof RESEAUX_SOCIAUX[number]["cle"];
export type ReseauxSociaux = Partial<Record<ReseauSocial, string | null>>;
export const LONGUEUR_MAX_LIEN_SOCIAL = 500;

/** Même contrat que l’API : URL HTTP(S), sans identifiants, longueur après normalisation comprise. */
export function lienSocialSur(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const texte = valeur.trim();
  if (!texte || texte.length > LONGUEUR_MAX_LIEN_SOCIAL) return null;
  try {
    const url = new URL(texte);
    const normalisee = url.toString();
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || normalisee.length > LONGUEUR_MAX_LIEN_SOCIAL) return null;
    return normalisee;
  } catch { return null; }
}

export function erreurLienSocial(valeur: unknown, nom: string): string | null {
  if (valeur == null || (typeof valeur === "string" && !valeur.trim())) return null;
  if (typeof valeur === "string" && valeur.trim().length > LONGUEUR_MAX_LIEN_SOCIAL) return `Le lien ${nom} ne doit pas dépasser 500 caractères.`;
  if (!lienSocialSur(valeur)) return `Pour ${nom}, indiquez une adresse complète en http:// ou https://, sans identifiants, de 500 caractères maximum.`;
  return null;
}

/** Les quatre clés restent présentes : une chaîne vide signifie un effacement volontaire. */
export function normaliserReseauxSociaux(valeurs: ReseauxSociaux): Record<ReseauSocial, string> {
  return Object.fromEntries(RESEAUX_SOCIAUX.map(({ cle }) => [cle, lienSocialSur(valeurs[cle]) || ""])) as Record<ReseauSocial, string>;
}

export function liensSociauxAffichables(valeurs: ReseauxSociaux) {
  return RESEAUX_SOCIAUX.flatMap((reseau) => {
    const href = lienSocialSur(valeurs[reseau.cle]);
    return href ? [{ ...reseau, href }] : [];
  });
}

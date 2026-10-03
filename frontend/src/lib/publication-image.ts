/** Formats et taille acceptés par le serveur pour la photo d’une publication. */
export const FORMATS_IMAGE_PUBLICATION = ["image/jpeg", "image/png", "image/webp"] as const;
export const TAILLE_MAX_IMAGE_PUBLICATION = 10 * 1024 * 1024;

/** Renvoie un message d’erreur lisible, ou null si le fichier peut être envoyé. */
export function erreurImagePublication(fichier: { type: string; size: number }): string | null {
  if (!(FORMATS_IMAGE_PUBLICATION as readonly string[]).includes(fichier.type)) {
    return "Format non supporté. Utilisez une image JPEG, PNG ou WebP.";
  }
  if (fichier.size <= 0) return "Ce fichier est vide.";
  if (fichier.size > TAILLE_MAX_IMAGE_PUBLICATION) return "L’image dépasse 10 Mo. Choisissez une image plus légère.";
  return null;
}

export const TAILLE_MAX_PHOTO = 10 * 1024 * 1024;
export function erreurPhoto(fichier: Pick<File, "type" | "size">): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(fichier.type)) return "Choisissez une image JPEG, PNG ou WebP.";
  if (fichier.size > TAILLE_MAX_PHOTO) return "Cette image dépasse la limite de 10 Mo.";
  if (fichier.size === 0) return "Ce fichier est vide.";
  return null;
}

/** Un seul envoi actif. Une demande d’arrêt ne coupe jamais une sauvegarde en cours. */
export async function envoyerPhotosEnSerie<T, R>(
  photos: readonly T[],
  envoyer: (photo: T) => Promise<R>,
  callbacks: { doitArreter: () => boolean; resultat: (photo: T, result: { ok: true; valeur: R } | { ok: false; erreur: unknown }) => void },
) {
  let envoyees = 0;
  let echouees = 0;
  for (const photo of photos) {
    if (callbacks.doitArreter()) break;
    try {
      const valeur = await envoyer(photo);
      envoyees++;
      callbacks.resultat(photo, { ok: true, valeur });
    } catch (erreur) {
      echouees++;
      callbacks.resultat(photo, { ok: false, erreur });
    }
  }
  return { envoyees, echouees, nonEnvoyees: photos.length - envoyees - echouees };
}

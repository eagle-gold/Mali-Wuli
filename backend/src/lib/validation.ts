import { z } from "zod";

/**
 * URL externe cliquable. `z.string().url()` accepte aussi des protocoles tels
 * que `javascript:` et `data:` ; ils ne doivent jamais être persistés puis
 * injectés dans un lien du frontend.
 */
export function urlHttpSchema(longueurMax = 1_000) {
  return z.string()
    .trim()
    .min(1)
    .max(longueurMax)
    .refine((valeur) => {
      try {
        const url = new URL(valeur);
        return (url.protocol === "http:" || url.protocol === "https:")
          && Boolean(url.hostname)
          && !url.username
          && !url.password;
      } catch {
        return false;
      }
    }, "Utilisez une adresse web commençant par http:// ou https://.")
    .transform((valeur) => new URL(valeur).toString());
}

/**
 * Texte saisi dans un champ multiligne. Un envoi multipart (photo jointe)
 * transforme chaque saut de ligne LF en CRLF : on revient à LF avant de
 * mesurer la longueur, pour que la limite soit la même avec ou sans photo.
 */
export function texteMultiligneSchema(longueurMax: number) {
  return z.preprocess(
    (valeur) => (typeof valeur === "string" ? valeur.replace(/\r\n?/g, "\n") : valeur),
    z.string().trim().max(longueurMax),
  );
}

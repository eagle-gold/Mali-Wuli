import { z } from "zod";
import { urlHttpSchema } from "./validation";

export const CHAMPS_LIENS_SOCIAUX = ["linkedin", "facebook", "instagram", "tiktok"] as const;
export type ChampLienSocial = typeof CHAMPS_LIENS_SOCIAUX[number];
export type LiensSociaux = Record<ChampLienSocial, string | null>;
type LiensSociauxFacultatifs = Partial<Record<ChampLienSocial, string | null | undefined>>;

// La longueur persistée est vérifiée aussi après normalisation : les caractères
// Unicode d'une URL peuvent être encodés sur plusieurs caractères ASCII.
export const schemaLienSocial = z.preprocess(
  (valeur) => typeof valeur === "string" ? valeur.trim() : valeur,
  z.union([
    urlHttpSchema(500).refine((valeur) => valeur.length <= 500, "Le lien doit contenir au maximum 500 caractères."),
    z.literal("").transform(() => null),
    z.null(),
  ]).optional(),
);

export const champsLiensSociaux = {
  linkedin: schemaLienSocial,
  facebook: schemaLienSocial,
  instagram: schemaLienSocial,
  tiktok: schemaLienSocial,
};

export const selectionLiensSociaux = {
  linkedin: true, facebook: true, instagram: true, tiktok: true,
} as const;

/** L'API expose toujours les quatre valeurs, même pour un ancien profil. */
export function liensSociauxProfil(profil: LiensSociauxFacultatifs): LiensSociaux {
  return Object.fromEntries(CHAMPS_LIENS_SOCIAUX.map((champ) => {
    // Un lien ancien invalide reste conservé en base tant qu'il est omis, mais
    // ne devient jamais un lien cliquable dans une réponse publique.
    const lecture = schemaLienSocial.safeParse(profil[champ]);
    return [champ, lecture.success ? lecture.data ?? null : null];
  })) as LiensSociaux;
}

/** undefined signifie conserver ; null ou vide signifie effacer explicitement. */
export function modificationsLiensSociaux(donnees: LiensSociauxFacultatifs): Partial<LiensSociaux> {
  const modifications: Partial<LiensSociaux> = {};
  for (const champ of CHAMPS_LIENS_SOCIAUX) {
    if (donnees[champ] !== undefined) modifications[champ] = donnees[champ] || null;
  }
  return modifications;
}

/**
 * Salaire d'une offre : saisie structurée côté formulaire, stockée dans le
 * champ texte existant `salaire` (190 caractères max côté backend) sous une
 * forme stable, par exemple « 400 000 – 550 000 FCFA / mois ».
 */

export const DEVISES_SALAIRE = [
  { value: "FCFA", label: "FCFA (XOF)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "GNF", label: "GNF" },
  { value: "MAD", label: "MAD" },
  { value: "XAF", label: "XAF" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD" },
] as const;

export const PERIODES_SALAIRE = [
  { value: "MOIS", label: "par mois", suffixe: "/ mois" },
  { value: "AN", label: "par an", suffixe: "/ an" },
  { value: "JOUR", label: "par jour", suffixe: "/ jour" },
  { value: "HEURE", label: "par heure", suffixe: "/ heure" },
  { value: "MISSION", label: "total mission", suffixe: "pour la mission" },
] as const;

export type Periode = (typeof PERIODES_SALAIRE)[number]["value"];

export type SalaireStructure = {
  minimum: string;
  maximum: string;
  devise: string;
  periode: Periode;
  /** Ancienne valeur libre impossible à interpréter, conservée telle quelle. */
  repli: string;
};

export const SALAIRE_VIDE: SalaireStructure = { minimum: "", maximum: "", devise: "FCFA", periode: "MOIS", repli: "" };

const ESPACES = /[\s  ]/g;

const lireNombre = (texte: string) => {
  const brut = texte.replace(ESPACES, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(brut)) return null;
  return Number(brut);
};

export const formaterMontant = (valeur: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(valeur);

/** Valeur envoyée au backend, ou `null` si aucun salaire n'est indiqué. */
export function composerSalaire(s: SalaireStructure): { valeur: string | null; erreur?: string } {
  const minimum = s.minimum.trim() ? lireNombre(s.minimum) : null;
  const maximum = s.maximum.trim() ? lireNombre(s.maximum) : null;
  if ((s.minimum.trim() && minimum === null) || (s.maximum.trim() && maximum === null)) return { valeur: null, erreur: "Indiquez des montants valides (chiffres uniquement)." };
  if (minimum === null && maximum !== null) return { valeur: null, erreur: "Indiquez le montant minimum." };
  if (minimum === null) {
    const repli = s.repli.trim();
    return { valeur: repli || null, erreur: repli.length > 190 ? "Le salaire doit contenir au maximum 190 caractères." : undefined };
  }
  if (maximum !== null && maximum < minimum) return { valeur: null, erreur: "Le montant maximum doit être supérieur au minimum." };
  const periode = PERIODES_SALAIRE.find((p) => p.value === s.periode) || PERIODES_SALAIRE[0];
  const montants = maximum !== null && maximum !== minimum
    ? `${formaterMontant(minimum)} – ${formaterMontant(maximum)}`
    : formaterMontant(minimum);
  return { valeur: `${montants} ${s.devise} ${periode.suffixe}` };
}

/** Relit une valeur composée par `composerSalaire` ; sinon la garde en repli. */
export function analyserSalaire(valeur: string | null | undefined): SalaireStructure {
  const texte = (valeur || "").trim();
  if (!texte) return { ...SALAIRE_VIDE };
  const devises = DEVISES_SALAIRE.map((d) => d.value).join("|");
  const suffixes = PERIODES_SALAIRE.map((p) => p.suffixe.replace("/", "\\/")).join("|");
  const nombre = "\\d[\\d\\s\\u00a0\\u202f]*(?:,\\d{1,2})?";
  const correspondance = new RegExp(`^(${nombre})(?:\\s*[–-]\\s*(${nombre}))?\\s+(${devises})\\s+(${suffixes})$`).exec(texte);
  if (!correspondance) return { ...SALAIRE_VIDE, repli: texte };
  const [, minimum, maximum, devise, suffixe] = correspondance;
  const min = lireNombre(minimum);
  const max = maximum ? lireNombre(maximum) : null;
  const periode = PERIODES_SALAIRE.find((p) => p.suffixe === suffixe);
  if (min === null || (maximum && max === null) || !periode) return { ...SALAIRE_VIDE, repli: texte };
  return { minimum: String(min), maximum: max === null ? "" : String(max), devise, periode: periode.value, repli: "" };
}

/**
 * Classes des composants du design system (docs/design-system.md).
 * Fonctions pures : réutilisables sur un <button>, un <Link> ou un <a>.
 */

export type VarianteBouton = "primaire" | "secondaire" | "discret" | "inverse" | "danger";
export type TailleBouton = "sm" | "md" | "lg";

const BASE_BOUTON =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition " +
  "duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const VARIANTES: Record<VarianteBouton, string> = {
  primaire: "bg-brand text-white shadow-card hover:bg-brand-700 focus-visible:ring-brand focus-visible:ring-offset-surface",
  secondaire:
    "border border-line-strong bg-surface-raised text-ink hover:border-brand hover:text-brand " +
    "focus-visible:ring-brand focus-visible:ring-offset-surface",
  discret: "text-brand hover:bg-brand-50 focus-visible:ring-brand focus-visible:ring-offset-surface",
  inverse:
    "bg-surface-raised text-bark-900 shadow-card hover:bg-white focus-visible:ring-gold focus-visible:ring-offset-bark",
  danger: "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger focus-visible:ring-offset-surface",
};

const TAILLES: Record<TailleBouton, string> = {
  sm: "min-h-9 px-3.5 text-sm",
  md: "min-h-11 px-5 text-sm sm:text-[15px]",
  lg: "min-h-12 px-6 text-base sm:min-h-14 sm:px-7",
};

export function classesBouton({
  variante = "primaire",
  taille = "md",
  pleineLargeur = false,
  className,
}: {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  pleineLargeur?: boolean;
  className?: string;
} = {}) {
  return [BASE_BOUTON, VARIANTES[variante], TAILLES[taille], pleineLargeur && "w-full", className]
    .filter(Boolean)
    .join(" ");
}

export type TonPastille = "neutre" | "marque" | "or" | "argile" | "danger";

const TONS: Record<TonPastille, string> = {
  neutre: "bg-surface-sunken text-ink-soft",
  marque: "bg-brand-50 text-brand",
  or: "bg-gold/15 text-bark-700",
  argile: "bg-clay/10 text-clay",
  danger: "bg-danger/10 text-danger",
};

export function classesPastille(ton: TonPastille = "neutre", className?: string) {
  return ["inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONS[ton], className]
    .filter(Boolean)
    .join(" ");
}

/** Carte standard : surface claire, filet doux, ombre légère. */
export function classesCarte({ interactive = false, className }: { interactive?: boolean; className?: string } = {}) {
  return [
    "rounded-2xl border border-line-soft bg-surface shadow-card",
    interactive && "transition duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-raised",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Champ de formulaire standard (input, select, textarea) : 48 px de haut,
 * anneau de focus doux. Utilisé par l'authentification et l'onboarding.
 */
export const CLASSE_CHAMP =
  "block w-full min-w-0 rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink " +
  "shadow-[inset_0_1px_2px_rgb(var(--mw-ink)/0.04)] outline-none transition placeholder:text-ink-muted/70 " +
  "hover:border-ink-muted/50 focus:border-brand focus:ring-4 focus:ring-brand/15 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted";

/** Variante en erreur du champ standard. */
export const CLASSE_CHAMP_INVALIDE = CLASSE_CHAMP.replace(
  "border-line-strong",
  "border-danger",
).replace("focus:border-brand focus:ring-brand/15", "focus:border-danger focus:ring-danger/15");

/** Libellé de champ standard. */
export const CLASSE_LIBELLE = "mb-2 block text-sm font-semibold text-ink";

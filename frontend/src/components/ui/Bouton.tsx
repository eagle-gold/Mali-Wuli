import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { classesBouton, type TailleBouton, type VarianteBouton } from "./classes";

type Apparence = { variante?: VarianteBouton; taille?: TailleBouton; pleineLargeur?: boolean };

/** Bouton d'action du design system. `type="button"` par défaut. */
export const Bouton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Apparence>(
  function Bouton({ variante, taille, pleineLargeur, className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={classesBouton({ variante, taille, pleineLargeur, className })} {...props} />;
  },
);

/** Lien de navigation présenté comme un bouton. */
export function LienBouton({ variante, taille, pleineLargeur, className, ...props }: ComponentProps<typeof Link> & Apparence) {
  return <Link className={classesBouton({ variante, taille, pleineLargeur, className })} {...props} />;
}

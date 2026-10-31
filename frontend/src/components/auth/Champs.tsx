"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { criteresMotDePasse, robustesseMotDePasse } from "@/lib/mot-de-passe";
import { CLASSE_CHAMP, CLASSE_CHAMP_INVALIDE } from "@/components/ui/classes";

export const classesChamp = (invalide: boolean) => `${invalide ? CLASSE_CHAMP_INVALIDE : CLASSE_CHAMP} h-12`;

/** Message d'erreur lié au champ par aria-describedby. */
export function MessageChamp({ id, erreur, aide }: { id: string; erreur?: string; aide?: ReactNode }) {
  if (erreur) {
    return (
      <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
        <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />{erreur}
      </p>
    );
  }
  return aide ? <p id={id} className="mt-2 text-sm text-ink-muted">{aide}</p> : null;
}

type ChampProps = InputHTMLAttributes<HTMLInputElement> & { label: string; erreur?: string; aide?: ReactNode };

/** Champ texte étiqueté, avec erreur accessible. */
export const ChampTexte = forwardRef<HTMLInputElement, ChampProps>(function ChampTexte({ label, erreur, aide, id, className = "", ...props }, ref) {
  const genere = useId();
  const idChamp = id || genere;
  const idMessage = `${idChamp}-message`;
  return (
    <div className={className}>
      <label htmlFor={idChamp} className="mb-2 block text-sm font-semibold text-ink">{label}</label>
      <input
        ref={ref}
        id={idChamp}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur || aide ? idMessage : undefined}
        className={classesChamp(Boolean(erreur))}
        {...props}
      />
      <MessageChamp id={idMessage} erreur={erreur} aide={aide} />
    </div>
  );
});

const COULEURS_ROBUSTESSE = ["bg-line-soft", "bg-danger", "bg-clay", "bg-gold", "bg-brand"] as const;

/** Mot de passe avec affichage, jauge de robustesse et règles en direct. */
export function ChampMotDePasse({ label, valeur, onChange, erreur, autoComplete = "new-password", afficherRegles = true }: {
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  erreur?: string;
  autoComplete?: string;
  afficherRegles?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const robustesse = robustesseMotDePasse(valeur);
  const criteres = criteresMotDePasse(valeur);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={valeur}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={`${id}-regles${erreur ? ` ${id}-message` : ""}`}
          className={`${classesChamp(Boolean(erreur))} pr-12`}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((precedent) => !precedent)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-sunken hover:text-ink focus-anneau"
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {afficherRegles && (
        <div id={`${id}-regles`} className="mt-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((palier) => (
                <span key={palier} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${robustesse.niveau >= palier ? COULEURS_ROBUSTESSE[robustesse.niveau] : "bg-line-soft"}`} />
              ))}
            </div>
            <span className="min-w-[72px] text-right text-xs font-semibold text-ink-muted" aria-live="polite">{robustesse.libelle}</span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5" aria-label="Règles du mot de passe">
            {criteres.map((critere) => (
              <li key={critere.cle} className={`flex items-center gap-1.5 text-[13px] transition-colors ${critere.valide ? "text-brand" : "text-ink-muted"}`}>
                <span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded-full transition ${critere.valide ? "bg-brand text-white" : "border border-line-strong"}`}>
                  {critere.valide && <Check size={11} strokeWidth={3} />}
                </span>
                {critere.libelle}
                <span className="sr-only">{critere.valide ? " : respecté" : " : à respecter"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <MessageChamp id={`${id}-message`} erreur={erreur} />
    </div>
  );
}

/** Bandeau d'alerte (erreur de formulaire ou information). */
export function Alerte({ ton = "erreur", children }: { ton?: "erreur" | "info" | "succes"; children: ReactNode }) {
  const styles = {
    erreur: "border-danger/25 bg-danger/[0.06] text-danger",
    info: "border-line bg-surface-sunken text-ink-soft",
    succes: "border-brand/25 bg-brand-50 text-brand-800",
  }[ton];
  return (
    <div role={ton === "erreur" ? "alert" : "status"} className={`mb-6 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium leading-relaxed ${styles}`}>
      {ton === "succes" ? <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0" /> : <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

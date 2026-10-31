"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { codeComplet, insererDansCode, LONGUEUR_CODE } from "@/lib/saisie-code";

/** Saisie d'un code à 6 chiffres : collage, remplissage automatique, flèches, retour arrière. */
export default function SaisieCode({
  cases,
  onChange,
  onComplet,
  invalide = false,
  desactive = false,
  idDescription,
}: {
  cases: string[];
  onChange: (cases: string[]) => void;
  onComplet: (code: string) => void;
  invalide?: boolean;
  desactive?: boolean;
  idDescription?: string;
}) {
  const champs = useRef<(HTMLInputElement | null)[]>([]);

  // Au montage et dès que la saisie redevient possible (après une erreur ou un
  // renvoi), le focus revient sur la première case vide.
  useEffect(() => {
    if (desactive) return;
    const premiereVide = cases.findIndex((chiffre) => !chiffre);
    champs.current[premiereVide === -1 ? 0 : premiereVide]?.focus();
  }, [desactive]); // eslint-disable-line react-hooks/exhaustive-deps

  const appliquer = (index: number, saisie: string) => {
    const resultat = insererDansCode(cases, index, saisie);
    onChange(resultat.cases);
    champs.current[resultat.focus]?.focus();
    if (codeComplet(resultat.cases) && !codeComplet(cases)) onComplet(resultat.cases.join(""));
  };

  const surTouche = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !cases[index] && index > 0) {
      event.preventDefault();
      const suivant = [...cases];
      suivant[index - 1] = "";
      onChange(suivant);
      champs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      champs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < LONGUEUR_CODE - 1) {
      event.preventDefault();
      champs.current[index + 1]?.focus();
    }
  };

  const surCollage = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    appliquer(index, event.clipboardData.getData("text"));
  };

  return (
    <div role="group" aria-label="Code à 6 chiffres" aria-describedby={idDescription} className="flex justify-between gap-2 sm:gap-2.5">
      {cases.map((chiffre, index) => (
        <input
          key={index}
          ref={(element) => { champs.current[index] = element; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Chiffre ${index + 1} sur ${LONGUEUR_CODE}`}
          aria-invalid={invalide || undefined}
          disabled={desactive}
          value={chiffre}
          onChange={(event) => appliquer(index, event.target.value.slice(chiffre ? 1 : 0) || event.target.value)}
          onKeyDown={(event) => surTouche(index, event)}
          onPaste={(event) => surCollage(index, event)}
          onFocus={(event) => event.target.select()}
          className={`h-14 w-full min-w-0 rounded-xl border bg-surface text-center font-display text-2xl font-bold text-ink outline-none transition focus:ring-4 disabled:opacity-60 sm:h-16 ${
            invalide
              ? "border-danger focus:ring-danger/15"
              : chiffre
                ? "border-brand/60 bg-brand-50/40 focus:border-brand focus:ring-brand/15"
                : "border-line-strong focus:border-brand focus:ring-brand/15"
          }`}
        />
      ))}
    </div>
  );
}

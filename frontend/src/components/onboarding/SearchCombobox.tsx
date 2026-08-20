"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type SearchOption = {
  id: string;
  label: string;
  secondary?: string;
};

type SearchComboboxProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  onSelect: (option: SearchOption) => void;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  minChars?: number;
  helperText?: string;
  emptyMessage?: string;
  otherLabel?: string;
  onOther?: () => void;
};

const INPUT_CLASS =
  "w-full rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] py-4 pl-12 pr-14 text-base text-[#2e261f] outline-none transition focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20 disabled:cursor-not-allowed disabled:bg-[#f2eadf] disabled:text-[#9d8f7e] sm:text-lg";

const normaliser = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const scoreOption = (option: SearchOption, recherche: string) => {
  if (!recherche) return 0;
  const libelle = normaliser(option.label);
  const secondaire = normaliser(option.secondary || "");
  if (libelle === recherche) return 4;
  if (libelle.startsWith(recherche)) return 3;
  if (libelle.includes(recherche)) return 2;
  return secondaire.includes(recherche) ? 1 : 0;
};

export default function SearchCombobox({
  id,
  label,
  value,
  placeholder,
  options,
  onChange,
  onSelect,
  loading = false,
  disabled = false,
  required = false,
  minChars = 0,
  helperText,
  emptyMessage = "Aucun résultat trouvé.",
  otherLabel,
  onOther,
}: SearchComboboxProps) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const peutAfficher = ouvert && value.trim().length >= minChars;
  const optionsTriees = useMemo(() => {
    const recherche = normaliser(value);
    return options
      .map((option, index) => ({ option, index, score: scoreOption(option, recherche) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ option }) => option);
  }, [options, value]);

  useEffect(() => setActif(-1), [options, value]);

  const choisir = (option: SearchOption) => {
    onSelect(option);
    setOuvert(false);
    setActif(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOuvert(false);
      return;
    }
    if (!peutAfficher) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActif((index) => Math.min(index + 1, optionsTriees.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActif((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home" && optionsTriees.length) {
      event.preventDefault();
      setActif(0);
    } else if (event.key === "End" && optionsTriees.length) {
      event.preventDefault();
      setActif(optionsTriees.length - 1);
    } else if (event.key === "Enter" && actif >= 0) {
      event.preventDefault();
      choisir(optionsTriees[actif]);
    }
  };

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-base font-semibold text-[#2e261f]">
        {label} {required && <span className="text-[#c65327]">*</span>}
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b7a68]" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${id}-resultats`}
          aria-expanded={peutAfficher}
          aria-activedescendant={actif >= 0 ? `${id}-option-${actif}` : undefined}
          aria-busy={loading}
          autoComplete="off"
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onFocus={() => setOuvert(true)}
          onBlur={() => window.setTimeout(() => setOuvert(false), 150)}
          onChange={(event) => {
            onChange(event.target.value);
            setOuvert(true);
            setActif(-1);
          }}
          onKeyDown={handleKeyDown}
          className={INPUT_CLASS}
        />
        {loading ? (
          <span
            aria-label="Recherche en cours"
            className="absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-1"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0d6738]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0d6738] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0d6738] [animation-delay:300ms]" />
          </span>
        ) : value && !disabled ? (
          <button
            type="button"
            aria-label={`Effacer ${label.toLocaleLowerCase("fr")}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              setOuvert(true);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#74685c] transition hover:bg-[#eee2d0] hover:text-[#2e261f]"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {peutAfficher && (
        <div
          id={`${id}-resultats`}
          role="listbox"
          aria-label={`Résultats pour ${label}`}
          className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-[14px] border border-[#dfc9a8] bg-white p-2 shadow-lg"
        >
          {optionsTriees.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1 text-xs text-[#74685c]">
              <span>{optionsTriees.length} résultat{optionsTriees.length > 1 ? "s" : ""} proposé{optionsTriees.length > 1 ? "s" : ""}</span>
              <span className="hidden sm:inline">↑ ↓ pour parcourir · Entrée pour choisir</span>
            </div>
          )}

          {optionsTriees.map((option, index) => (
            <button
              key={option.id}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === actif}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActif(index)}
              onClick={() => choisir(option)}
              className={`flex w-full min-w-0 flex-col items-start gap-1 rounded-[10px] px-4 py-3 text-left text-sm transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:text-base ${
                index === actif
                  ? "bg-[#eaf1e9] text-[#0d6738]"
                  : "text-[#2e261f] hover:bg-[#f6efe3]"
              }`}
            >
              <span className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{option.label}</span>
              {option.secondary && (
                <span className="max-w-full break-words text-xs text-[#74685c] [overflow-wrap:anywhere] sm:shrink-0 sm:text-sm">{option.secondary}</span>
              )}
            </button>
          ))}

          {loading && optionsTriees.length === 0 && (
            <div aria-hidden="true" className="space-y-2 px-2 py-1">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-12 animate-pulse rounded-[10px] bg-[#f6efe3]" />
              ))}
            </div>
          )}

          {!loading && optionsTriees.length === 0 && (
            <p className="px-4 py-3 text-sm text-[#74685c]">{emptyMessage}</p>
          )}

          {otherLabel && onOther && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onOther();
                setOuvert(false);
              }}
              className="mt-1 w-full rounded-[10px] border border-dashed border-[#d7b98d] px-4 py-3 text-left text-sm font-semibold text-[#0d6738] hover:bg-[#f6efe3] sm:text-base"
            >
              + {otherLabel}
            </button>
          )}
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {loading ? "Recherche en cours" : peutAfficher ? `${optionsTriees.length} résultats disponibles` : ""}
      </span>
      {helperText && <p className="mt-2 text-xs text-[#74685c]">{helperText}</p>}
    </div>
  );
}

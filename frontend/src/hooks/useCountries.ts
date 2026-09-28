"use client";

import { useEffect, useState } from "react";

export type PaysOption = { code: string; nom: string; drapeau?: string };

export function useCountries() {
  const [pays, setPays] = useState<PaysOption[]>([]);

  useEffect(() => {
    const controleur = new AbortController();
    fetch("/api/locations/countries", { signal: controleur.signal })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Pays indisponibles")),
      )
      .then((donnees: { pays?: PaysOption[] }) => setPays(donnees.pays || []))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setPays([]);
      });
    return () => controleur.abort();
  }, []);

  return pays;
}

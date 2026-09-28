"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api, { type OptionsSessionPassive } from "@/lib/api";
import { EVENEMENT_SESSION, lireJetonSession, type CompteSession } from "@/lib/session";

export type SessionAccueil = { etat: "loading" | "visitor" | "authenticated" | "unavailable"; compte: CompteSession | null; refusAcces?: string };

export function useSessionAccueil() {
  const [session, setSession] = useState<SessionAccueil>({ etat: "loading", compte: null });
  const [revision, setRevision] = useState(0);
  const derniereSessionValidee = useRef<{ jeton: string; compte: CompteSession } | null>(null);
  const actualiser = useCallback(() => setRevision((valeur) => valeur + 1), []);

  useEffect(() => {
    let actif = true;
    let requete = 0;
    let controleur: AbortController | null = null;
    const verifier = async () => {
      const numero = ++requete;
      controleur?.abort();
      const jeton = lireJetonSession();
      if (!jeton) {
        derniereSessionValidee.current = null;
        setSession({ etat: "visitor", compte: null });
        return;
      }
      const precedente = derniereSessionValidee.current;
      if (precedente?.jeton !== jeton) {
        derniereSessionValidee.current = null;
        setSession({ etat: "loading", compte: null });
      }
      const abort = new AbortController();
      controleur = abort;
      try {
        // Cette lecture facultative ne quitte pas l’accueil si la session est expirée.
        const options: OptionsSessionPassive = { signal: abort.signal, sessionPassive: true };
        const { data } = await api.get<CompteSession>("/users/me/session", options);
        if (!actif || abort.signal.aborted || numero !== requete) return;
        if (lireJetonSession() !== jeton) { void verifier(); return; }
        derniereSessionValidee.current = { jeton, compte: data };
        setSession({ etat: "authenticated", compte: data });
      } catch (error) {
        if (!actif || abort.signal.aborted || numero !== requete) return;
        if (lireJetonSession() !== jeton) { void verifier(); return; }
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          derniereSessionValidee.current = null;
          setSession({ etat: "visitor", compte: null });
        } else if (status === 403) {
          derniereSessionValidee.current = null;
          const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
          const motifsConnus = ["Confirmez votre adresse e-mail avant de continuer.", "Votre compte est suspendu.", "Votre compte a été refusé."];
          setSession({ etat: "unavailable", compte: null, refusAcces: typeof message === "string" && motifsConnus.includes(message) ? message : "Ce compte ne peut pas accéder au réseau pour le moment." });
        } else if (precedente?.jeton === jeton) {
          // Un problème réseau ne déconnecte pas une session déjà vérifiée.
          setSession({ etat: "authenticated", compte: precedente.compte });
        } else setSession({ etat: "unavailable", compte: null });
      }
    };
    const stockage = (event: StorageEvent) => { if (!event.key || event.key === "mali_wuli_token") void verifier(); };
    const recontroler = () => { void verifier(); };
    const redevenirVisible = () => { if (document.visibilityState === "visible") void verifier(); };
    void verifier();
    window.addEventListener("storage", stockage);
    window.addEventListener("focus", recontroler);
    window.addEventListener("pageshow", recontroler);
    document.addEventListener("visibilitychange", redevenirVisible);
    window.addEventListener("online", recontroler);
    window.addEventListener(EVENEMENT_SESSION, recontroler);
    return () => {
      actif = false; controleur?.abort();
      window.removeEventListener("storage", stockage);
      window.removeEventListener("focus", recontroler);
      window.removeEventListener("pageshow", recontroler);
      document.removeEventListener("visibilitychange", redevenirVisible);
      window.removeEventListener("online", recontroler);
      window.removeEventListener(EVENEMENT_SESSION, recontroler);
    };
  }, [revision]);
  return { ...session, actualiser };
}

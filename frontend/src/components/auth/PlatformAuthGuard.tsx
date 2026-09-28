"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";
import { destinationSession, EVENEMENT_SESSION, lireJetonSession, type CompteSession } from "@/lib/session";
import { SessionMembreContext } from "./SessionMembreContext";

export default function PlatformAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionVerifiee, setSessionVerifiee] = useState<{ jeton: string; compte: CompteSession } | null>(null);
  const [erreur, setErreur] = useState("");
  const [revision, setRevision] = useState(0);
  const actualiser = useCallback(() => setRevision((valeur) => valeur + 1), []);
  const contexte = useMemo(() => sessionVerifiee ? { compte: sessionVerifiee.compte, actualiser } : null, [sessionVerifiee, actualiser]);

  useEffect(() => {
    let actif = true;
    let numero = 0;
    let controleur: AbortController | null = null;
    let jetonEnCours = "";
    const verifier = async () => {
      const jeton = lireJetonSession();
      // Focus + visibilité peuvent arriver ensemble : une seule lecture suffit.
      if (controleur && !controleur.signal.aborted && jetonEnCours === jeton) return;
      const requete = ++numero;
      controleur?.abort();
      setErreur("");
      setSessionVerifiee((precedente) => precedente?.jeton === jeton ? precedente : null);
      if (!jeton) { setSessionVerifiee(null); router.replace("/login"); return; }
      const abort = new AbortController();
      controleur = abort;
      jetonEnCours = jeton;
      try {
        const { data } = await api.get<CompteSession>("/users/me/session", { signal: abort.signal });
        if (!actif || abort.signal.aborted || requete !== numero) return;
        if (lireJetonSession() !== jeton) { void verifier(); return; }
        setSessionVerifiee({ jeton, compte: data });
        const destination = destinationSession(data, pathname);
        if (destination !== pathname) { router.replace(destination); return; }
      } catch (error) {
        if (!actif || abort.signal.aborted || requete !== numero) return;
        if (lireJetonSession() !== jeton) { void verifier(); return; }
        const statut = (error as { response?: { status?: number } })?.response?.status;
        if (statut === 401 || statut === 403) setSessionVerifiee(null);
        if (statut === 401) {
          router.replace("/login"); return;
        }
        setErreur((error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Impossible de vérifier votre session pour le moment. Vérifiez votre connexion puis réessayez.");
      } finally {
        if (controleur === abort) { controleur = null; jetonEnCours = ""; }
      }
    };
    const stockage = (event: StorageEvent) => { if (!event.key || event.key === "mali_wuli_token") void verifier(); };
    const recontroler = () => { void verifier(); };
    const redevenirVisible = () => { if (document.visibilityState === "visible") void verifier(); };
    void verifier();
    window.addEventListener("storage", stockage);
    window.addEventListener(EVENEMENT_SESSION, recontroler);
    window.addEventListener("online", recontroler);
    window.addEventListener("focus", recontroler);
    window.addEventListener("pageshow", recontroler);
    document.addEventListener("visibilitychange", redevenirVisible);
    return () => {
      actif = false; controleur?.abort();
      window.removeEventListener("storage", stockage);
      window.removeEventListener(EVENEMENT_SESSION, recontroler);
      window.removeEventListener("online", recontroler);
      window.removeEventListener("focus", recontroler);
      window.removeEventListener("pageshow", recontroler);
      document.removeEventListener("visibilitychange", redevenirVisible);
    };
  }, [pathname, router, revision]);

  if (!sessionVerifiee || sessionVerifiee.jeton !== lireJetonSession() || destinationSession(sessionVerifiee.compte, pathname) !== pathname) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--color-page)] px-4">
      <div className="max-w-lg rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] px-8 py-7 text-center shadow-sm">
        {erreur ? <><p role="alert" className="text-[#735133]">{erreur}</p><button type="button" onClick={() => setRevision((valeur) => valeur + 1)} className="mt-5 rounded-xl bg-[#0d6738] px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d6738]">Réessayer</button></> : <><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-4 border-[#d8c5a7] border-t-[#0d6738]" aria-hidden="true" /><p role="status" className="mt-4 font-semibold text-[#2e261f]">Vérification de votre session…</p></>}
      </div>
    </main>;
  }
  return <SessionMembreContext.Provider value={contexte}>{children}</SessionMembreContext.Provider>;
}

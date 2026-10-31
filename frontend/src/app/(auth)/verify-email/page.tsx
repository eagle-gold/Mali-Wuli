"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { MailCheck } from "lucide-react";
import CoqueAuth from "@/components/auth/CoqueAuth";
import { Alerte } from "@/components/auth/Champs";
import SaisieCode from "@/components/auth/SaisieCode";
import { classesBouton } from "@/components/ui/classes";
import api from "@/lib/api";
import { codeComplet, formaterDecompte, LONGUEUR_CODE } from "@/lib/saisie-code";
import { terminerSession } from "@/lib/session";

const DELAI_RENVOI_S = 30;
const casesVides = () => Array<string>(LONGUEUR_CODE).fill("");

function secondesAvantRenvoi() {
  const envoyeLe = Number(localStorage.getItem("mali_wuli_code_envoye_le")) || 0;
  return Math.max(0, DELAI_RENVOI_S - (Date.now() - envoyeLe) / 1000);
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [cases, setCases] = useState(casesVides);
  const [verification, setVerification] = useState(false);
  const [erreur, setErreur] = useState("");
  const [bloque, setBloque] = useState(false);
  const [info, setInfo] = useState("");
  const [attente, setAttente] = useState(0);
  const [renvoi, setRenvoi] = useState(false);

  useEffect(() => {
    const adresse = localStorage.getItem("mali_wuli_pending_email") || "";
    if (!adresse || !localStorage.getItem("mali_wuli_pending_verificationId")) {
      router.replace("/register");
      return;
    }
    setEmail(adresse);
    setAttente(secondesAvantRenvoi());
  }, [router]);

  const enAttente = attente > 0;
  useEffect(() => {
    if (!enAttente) return;
    const minuteur = window.setInterval(() => setAttente(secondesAvantRenvoi()), 1000);
    return () => window.clearInterval(minuteur);
  }, [enAttente]);

  const verifier = useCallback(async (code: string) => {
    if (verification) return;
    setVerification(true);
    setErreur("");
    setInfo("");
    try {
      const { data } = await api.post<{ registrationToken: string }>("/auth/verify-registration-email", {
        verificationId: localStorage.getItem("mali_wuli_pending_verificationId"),
        email,
        code,
      });
      terminerSession();
      localStorage.setItem("mali_wuli_registration_token", data.registrationToken);
      localStorage.removeItem("mali_wuli_pending_verificationId");
      localStorage.removeItem("mali_wuli_code_envoye_le");
      router.push("/register/details");
    } catch (err) {
      const reponse = axios.isAxiosError<{ message?: string; code?: string }>(err) ? err.response : undefined;
      const tropDeTentatives = reponse?.data?.code === "TROP_DE_TENTATIVES";
      setBloque(tropDeTentatives || reponse?.data?.code === "CODE_EXPIRE");
      setErreur(reponse?.data?.message || (reponse ? "Code incorrect ou expiré." : "Connexion impossible. Vérifiez votre réseau puis réessayez."));
      setCases(casesVides());
      setVerification(false);
    }
  }, [email, router, verification]);

  const renvoyer = async () => {
    if (attente > 0 || renvoi) return;
    setRenvoi(true);
    setErreur("");
    try {
      await api.post("/auth/resend-registration-code", { verificationId: localStorage.getItem("mali_wuli_pending_verificationId") });
      localStorage.setItem("mali_wuli_code_envoye_le", String(Date.now()));
      setAttente(DELAI_RENVOI_S);
      setCases(casesVides());
      setBloque(false);
      setInfo(`Un nouveau code a été envoyé à ${email}.`);
    } catch (err) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setErreur(message || "Impossible de renvoyer le code. Réessayez dans un instant.");
    } finally {
      setRenvoi(false);
    }
  };

  const modifierAdresse = () => {
    localStorage.removeItem("mali_wuli_pending_verificationId");
    localStorage.removeItem("mali_wuli_registration_token");
    localStorage.removeItem("mali_wuli_code_envoye_le");
    router.push("/register");
  };

  return (
    <CoqueAuth
      titre="Vérifiez votre e-mail"
      sousTitre={<>
        Saisissez le code à 6 chiffres envoyé à&nbsp;:
        <span className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3.5 py-2.5">
          <strong className="min-w-0 truncate font-semibold text-ink">{email || "votre adresse"}</strong>
          <button type="button" onClick={modifierAdresse} className="shrink-0 rounded text-sm font-semibold text-brand underline-offset-4 hover:underline focus-anneau">Modifier</button>
        </span>
      </>}
      etape={{ courante: 2, total: 3, libelle: "Vérification" }}
      lienHaut={{ texte: "Déjà membre ?", libelle: "Se connecter", href: "/login" }}
      pied={<span className="inline-flex items-center gap-1.5"><MailCheck size={15} aria-hidden="true" />Rien reçu ? Pensez à regarder dans les courriers indésirables.</span>}
    >
      {info && !erreur && <Alerte ton="succes">{info}</Alerte>}
      {erreur && <Alerte>{erreur}</Alerte>}
      <form onSubmit={(event) => { event.preventDefault(); if (codeComplet(cases)) void verifier(cases.join("")); }} className="space-y-6">
        <SaisieCode
          cases={cases}
          onChange={(suivant) => { setCases(suivant); if (erreur && !bloque) setErreur(""); }}
          onComplet={(code) => { if (!bloque) void verifier(code); }}
          invalide={Boolean(erreur) && !bloque}
          desactive={verification || bloque}
        />
        <button type="submit" disabled={!codeComplet(cases) || verification || bloque} aria-busy={verification} className={classesBouton({ taille: "lg", pleineLargeur: true })}>
          {verification ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Vérification…</> : "Vérifier"}
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-ink-muted">
        {attente > 0 ? (
          <p aria-live="polite">Vous pourrez demander un nouveau code dans <span className="font-semibold tabular-nums text-ink">{formaterDecompte(attente)}</span></p>
        ) : (
          <p>Vous n’avez pas reçu le code ?{" "}
            <button type="button" onClick={renvoyer} disabled={renvoi} className="rounded font-semibold text-brand underline-offset-4 hover:underline focus-anneau disabled:opacity-60">
              {renvoi ? "Envoi…" : "Renvoyer un code"}
            </button>
          </p>
        )}
      </div>
    </CoqueAuth>
  );
}

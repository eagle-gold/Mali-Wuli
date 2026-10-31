"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { Check, MailCheck } from "lucide-react";
import CoqueAuth from "@/components/auth/CoqueAuth";
import { Alerte, ChampMotDePasse, ChampTexte } from "@/components/auth/Champs";
import SaisieCode from "@/components/auth/SaisieCode";
import { classesBouton } from "@/components/ui/classes";
import api from "@/lib/api";
import { emailValide, motDePasseValide } from "@/lib/mot-de-passe";
import { codeComplet, formaterDecompte, LONGUEUR_CODE } from "@/lib/saisie-code";

const DELAI_RENVOI_S = 30;
const casesVides = () => Array<string>(LONGUEUR_CODE).fill("");

function secondesAvantRenvoi() {
  const envoyeLe = Number(sessionStorage.getItem("mali_wuli_reset_envoye_le")) || 0;
  return Math.max(0, DELAI_RENVOI_S - (Date.now() - envoyeLe) / 1000);
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailConnu, setEmailConnu] = useState(false);
  const [cases, setCases] = useState(casesVides);
  const [motDePasse, setMotDePasse] = useState("");
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [renvoi, setRenvoi] = useState(false);
  const [attente, setAttente] = useState(0);
  const [erreur, setErreur] = useState("");
  const [information, setInformation] = useState("");
  const [termine, setTermine] = useState(false);

  useEffect(() => {
    const adresse = sessionStorage.getItem("mali_wuli_reset_email") || "";
    setEmail(adresse);
    setEmailConnu(Boolean(adresse));
    setAttente(secondesAvantRenvoi());
  }, []);

  const enAttente = attente > 0;
  useEffect(() => {
    if (!enAttente) return;
    const minuteur = window.setInterval(() => setAttente(secondesAvantRenvoi()), 1000);
    return () => window.clearInterval(minuteur);
  }, [enAttente]);

  const erreurCode = soumis && !codeComplet(cases) ? "Saisissez les 6 chiffres du code." : undefined;
  const erreurMotDePasse = soumis && !motDePasseValide(motDePasse) ? "Le mot de passe ne respecte pas encore toutes les règles." : undefined;

  const valider = async (event: FormEvent) => {
    event.preventDefault();
    setSoumis(true);
    setErreur("");
    setInformation("");
    if (!emailValide(email) || !codeComplet(cases) || !motDePasseValide(motDePasse) || envoi) return;
    setEnvoi(true);
    try {
      await api.post("/auth/reset-password", { email: email.trim().toLowerCase(), code: cases.join(""), motDePasse });
      sessionStorage.removeItem("mali_wuli_reset_email");
      sessionStorage.removeItem("mali_wuli_reset_envoye_le");
      setTermine(true);
    } catch (err) {
      const reponse = axios.isAxiosError<{ message?: string }>(err) ? err.response : undefined;
      setErreur(reponse?.data?.message || (reponse ? "Impossible de modifier le mot de passe. Réessayez." : "Connexion impossible. Vérifiez votre réseau."));
      setCases(casesVides());
      // L'alerte du serveur suffit : pas de second message sur les cases vidées.
      setSoumis(false);
    } finally {
      setEnvoi(false);
    }
  };

  const renvoyer = async () => {
    if (!emailValide(email) || renvoi || enAttente) return;
    setRenvoi(true);
    setErreur("");
    try {
      const adresse = email.trim().toLowerCase();
      await api.post("/auth/forgot-password", { email: adresse });
      sessionStorage.setItem("mali_wuli_reset_email", adresse);
      sessionStorage.setItem("mali_wuli_reset_envoye_le", String(Date.now()));
      setAttente(DELAI_RENVOI_S);
      setCases(casesVides());
      setInformation("Si cette adresse correspond à un compte, un nouveau code vient d’être envoyé.");
    } catch (err) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setErreur(message || "Impossible de renvoyer le code.");
    } finally {
      setRenvoi(false);
    }
  };

  if (termine) {
    return (
      <CoqueAuth titre="Mot de passe modifié" sousTitre="Votre nouveau mot de passe est enregistré. Par sécurité, vos autres sessions ont été déconnectées.">
        <div className="-mt-2 mb-7 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-raised"><Check size={30} strokeWidth={2.8} aria-hidden="true" /></span>
        </div>
        <Link href="/login" className={classesBouton({ taille: "lg", pleineLargeur: true })}>Se connecter</Link>
      </CoqueAuth>
    );
  }

  return (
    <CoqueAuth
      titre="Nouveau mot de passe"
      sousTitre={emailConnu
        ? <>
            Saisissez le code envoyé à&nbsp;:
            <span className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3.5 py-2.5">
              <strong className="min-w-0 truncate font-semibold text-ink">{email}</strong>
              <Link href="/forgot-password" className="shrink-0 rounded text-sm font-semibold text-brand underline-offset-4 hover:underline focus-anneau">Modifier</Link>
            </span>
          </>
        : "Saisissez votre adresse, le code reçu par e-mail, puis votre nouveau mot de passe."}
      lienHaut={{ texte: "Vous vous en souvenez ?", libelle: "Se connecter", href: "/login" }}
      pied={<span className="inline-flex items-center gap-1.5"><MailCheck size={15} aria-hidden="true" />Rien reçu ? Pensez à regarder dans les courriers indésirables.</span>}
    >
      {information && !erreur && <Alerte ton="succes">{information}</Alerte>}
      {erreur && <Alerte>{erreur}</Alerte>}
      <form onSubmit={valider} noValidate className="space-y-6">
        {!emailConnu && (
          <ChampTexte label="Adresse e-mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} erreur={soumis && !emailValide(email) ? "Saisissez une adresse e-mail valide." : undefined} />
        )}
        <div>
          <p id="libelle-code" className="mb-2 text-sm font-semibold text-ink">Code reçu par e-mail</p>
          <SaisieCode
            cases={cases}
            onChange={(suivant) => { setCases(suivant); setErreur(""); }}
            onComplet={() => document.querySelector<HTMLInputElement>('input[autocomplete="new-password"]')?.focus()}
            invalide={Boolean(erreurCode)}
            desactive={envoi}
            idDescription="libelle-code"
          />
          {erreurCode && <p className="mt-2 text-sm font-medium text-danger">{erreurCode}</p>}
          <p className="mt-3 text-sm text-ink-muted">
            {enAttente
              ? <>Nouveau code possible dans <span className="font-semibold tabular-nums text-ink">{formaterDecompte(attente)}</span></>
              : <>Pas de code ? <button type="button" onClick={renvoyer} disabled={renvoi || !emailValide(email)} className="rounded font-semibold text-brand underline-offset-4 hover:underline focus-anneau disabled:opacity-60">{renvoi ? "Envoi…" : "Renvoyer un code"}</button></>}
          </p>
        </div>
        <ChampMotDePasse label="Nouveau mot de passe" valeur={motDePasse} onChange={(valeur) => { setMotDePasse(valeur); setErreur(""); }} erreur={erreurMotDePasse} />
        <button type="submit" disabled={envoi} aria-busy={envoi} className={classesBouton({ taille: "lg", pleineLargeur: true })}>
          {envoi ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Enregistrement…</> : "Enregistrer le mot de passe"}
        </button>
      </form>
    </CoqueAuth>
  );
}

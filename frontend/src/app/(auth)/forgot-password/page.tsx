"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import CoqueAuth from "@/components/auth/CoqueAuth";
import { Alerte, ChampTexte } from "@/components/auth/Champs";
import { classesBouton } from "@/components/ui/classes";
import api from "@/lib/api";
import { emailValide } from "@/lib/mot-de-passe";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [touche, setTouche] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const precedent = sessionStorage.getItem("mali_wuli_reset_email");
    if (precedent) setEmail(precedent);
  }, []);

  const envoyer = async (event: FormEvent) => {
    event.preventDefault();
    setTouche(true);
    if (!emailValide(email) || envoi) return;
    setEnvoi(true);
    setErreur("");
    const adresse = email.trim().toLowerCase();
    try {
      await api.post("/auth/forgot-password", { email: adresse });
      sessionStorage.setItem("mali_wuli_reset_email", adresse);
      sessionStorage.setItem("mali_wuli_reset_envoye_le", String(Date.now()));
      router.push("/reset-password");
    } catch (err) {
      const reponse = axios.isAxiosError<{ message?: string }>(err) ? err.response : undefined;
      setErreur(reponse?.status === 429
        ? "Trop de demandes. Patientez un instant puis réessayez."
        : reponse?.data?.message || "Le service est momentanément indisponible. Réessayez dans quelques instants.");
      setEnvoi(false);
    }
  };

  return (
    <CoqueAuth
      titre="Mot de passe oublié ?"
      sousTitre="Indiquez l’adresse de votre compte. Si elle est reconnue, vous recevrez un code valable 15 minutes pour choisir un nouveau mot de passe."
      lienHaut={{ texte: "Vous vous en souvenez ?", libelle: "Se connecter", href: "/login" }}
    >
      {erreur && <Alerte>{erreur}</Alerte>}
      <form onSubmit={envoyer} noValidate className="space-y-6">
        <ChampTexte
          label="Adresse e-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={email}
          onChange={(event) => { setEmail(event.target.value); setErreur(""); }}
          onBlur={() => setTouche(true)}
          erreur={touche && email.trim() && !emailValide(email) ? "Saisissez une adresse e-mail valide." : undefined}
        />
        <button type="submit" disabled={envoi} aria-busy={envoi} className={classesBouton({ taille: "lg", pleineLargeur: true })}>
          {envoi ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Envoi du code…</> : "Recevoir un code"}
        </button>
      </form>
      <p className="mt-6 text-center">
        <Link href="/login" className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-ink-soft underline-offset-4 hover:text-brand hover:underline focus-anneau">
          <ArrowLeft size={15} aria-hidden="true" />Retour à la connexion
        </Link>
      </p>
    </CoqueAuth>
  );
}

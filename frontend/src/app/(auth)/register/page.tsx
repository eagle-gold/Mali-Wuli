"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import axios from "axios";
import CoqueAuth from "@/components/auth/CoqueAuth";
import { Alerte, ChampTexte } from "@/components/auth/Champs";
import { classesBouton } from "@/components/ui/classes";
import api from "@/lib/api";
import { emailValide } from "@/lib/mot-de-passe";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [touche, setTouche] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<{ texte: string; compteExistant?: boolean } | null>(null);
  const erreurChamp = touche && email.trim() && !emailValide(email) ? "Saisissez une adresse e-mail valide, par exemple awa@exemple.com." : undefined;

  useEffect(() => {
    const parrain = new URLSearchParams(window.location.search).get("parrain")?.trim();
    if (parrain) localStorage.setItem("mali_wuli_parrain_code", parrain);
    const enAttente = localStorage.getItem("mali_wuli_pending_email");
    if (enAttente) setEmail(enAttente);
  }, []);

  const envoyer = async (event: FormEvent) => {
    event.preventDefault();
    setTouche(true);
    if (!emailValide(email) || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const adresse = email.trim().toLowerCase();
      const { data } = await api.post<{ verificationId: string }>("/auth/request-email-code", { email: adresse });
      localStorage.setItem("mali_wuli_pending_email", adresse);
      localStorage.setItem("mali_wuli_pending_verificationId", data.verificationId);
      localStorage.setItem("mali_wuli_code_envoye_le", String(Date.now()));
      localStorage.removeItem("mali_wuli_registration_token");
      router.push("/verify-email");
    } catch (err) {
      if (axios.isAxiosError<{ message?: string }>(err)) {
        if (err.response?.status === 409) setErreur({ texte: "Un compte existe déjà avec cette adresse.", compteExistant: true });
        else if (err.response?.status === 429) setErreur({ texte: err.response.data?.message || "Trop de demandes. Patientez un instant puis réessayez." });
        else if (!err.response) setErreur({ texte: "Connexion impossible. Vérifiez votre réseau puis réessayez." });
        else setErreur({ texte: err.response.data?.message || "Impossible d’envoyer le code. Réessayez." });
      } else setErreur({ texte: "Impossible d’envoyer le code. Réessayez." });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <CoqueAuth
      titre="Créez votre compte"
      sousTitre="Rejoignez le réseau des talents du Mali et de sa diaspora. C’est gratuit."
      etape={{ courante: 1, total: 3, libelle: "Adresse e-mail" }}
      lienHaut={{ texte: "Déjà membre ?", libelle: "Se connecter", href: "/login" }}
    >
      {erreur && (
        <Alerte>
          {erreur.texte}
          {erreur.compteExistant && <> <Link href="/login" className="font-semibold underline underline-offset-2">Se connecter</Link> ou <Link href="/forgot-password" className="font-semibold underline underline-offset-2">réinitialiser le mot de passe</Link>.</>}
        </Alerte>
      )}
      <form onSubmit={envoyer} noValidate className="space-y-6">
        <ChampTexte
          label="Adresse e-mail"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={email}
          onChange={(event) => { setEmail(event.target.value); setErreur(null); }}
          onBlur={() => setTouche(true)}
          erreur={erreurChamp}
          aide="Nous vous enverrons un code à 6 chiffres pour la confirmer."
        />
        <button type="submit" disabled={envoi} aria-busy={envoi} className={classesBouton({ taille: "lg", pleineLargeur: true, className: "group" })}>
          {envoi ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Envoi du code…</> : <>Continuer<ArrowRight size={18} aria-hidden="true" className="transition group-hover:translate-x-0.5" /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-[13px] leading-relaxed text-ink-muted">
        En créant un compte, vous vous engagez à respecter l’esprit du réseau : entraide, respect et aucun démarchage commercial.
      </p>
    </CoqueAuth>
  );
}

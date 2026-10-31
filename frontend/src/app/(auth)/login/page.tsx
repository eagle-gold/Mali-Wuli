"use client";

import { ArrowRight, KeyRound, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import CoqueAuth from "@/components/auth/CoqueAuth";
import { Alerte, ChampMotDePasse, ChampTexte } from "@/components/auth/Champs";
import SaisieCode from "@/components/auth/SaisieCode";
import { classesBouton } from "@/components/ui/classes";
import { formaterDecompte, LONGUEUR_CODE } from "@/lib/saisie-code";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { enregistrerSession } from "@/lib/session";

type ModeConnexion = "otp" | "mot-de-passe";
type EtapeConnexion = "email" | "code";
type ActionEnCours = "demande" | "verification" | "renvoi" | "mot-de-passe" | null;

type ReponseDemandeCode = {
  message?: string;
  retryAfterSeconds?: number;
};

type ReponseConnexion = {
  token: string;
  user: {
    id: string;
    onboardingFini: boolean;
  };
};

type ErreurApi = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      retryAfterSeconds?: number;
    };
  };
};

const DELAI_RENVOI_PAR_DEFAUT = 60;

function normaliserEmail(email: string) {
  return email.trim().toLowerCase();
}

function messageErreur(
  error: unknown,
  contexte: "demande" | "verification" | "mot-de-passe",
) {
  const erreurApi = error as ErreurApi;
  const statut = erreurApi.response?.status;
  const messageServeur = erreurApi.response?.data?.message;

  if (statut === 429) {
    return "Trop de demandes ont été effectuées. Patientez un instant avant de réessayer.";
  }

  if (contexte === "verification" && (statut === 400 || statut === 401)) {
    return "Ce code est incorrect ou a expiré. Vérifiez les six chiffres ou demandez un nouveau code.";
  }

  if (contexte === "mot-de-passe" && statut === 401) {
    return !messageServeur || /incorrect/i.test(messageServeur)
      ? "Adresse e-mail ou mot de passe incorrect."
      : messageServeur;
  }

  if (contexte === "mot-de-passe" && statut === 404) {
    return "La connexion par mot de passe est momentanément indisponible. Recevez plutôt un code par e-mail.";
  }

  if (statut && statut >= 500) {
    return "Le service de connexion est momentanément indisponible. Réessayez dans quelques instants.";
  }

  return (
    messageServeur ||
    (contexte === "demande"
      ? "Impossible d’envoyer le code. Vérifiez votre connexion et réessayez."
      : "Connexion impossible. Vérifiez votre connexion et réessayez.")
  );
}

export default function LoginPage() {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [modeConnexion, setModeConnexion] = useState<ModeConnexion>("otp");
  const [etape, setEtape] = useState<EtapeConnexion>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [emailTouche, setEmailTouche] = useState(false);
  const [actionEnCours, setActionEnCours] = useState<ActionEnCours>(null);
  const [secondesAvantRenvoi, setSecondesAvantRenvoi] = useState(0);
  const [erreur, setErreur] = useState("");
  const [information, setInformation] = useState("");

  const emailNormalise = normaliserEmail(email);
  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalise);
  const emailInvalide = email.trim().length > 0 && !emailValide;
  const codeValide = /^\d{6}$/.test(code);
  const casesCode = Array.from({ length: LONGUEUR_CODE }, (_, index) => code[index] || "");
  const chargement = actionEnCours !== null;

  useEffect(() => {
    if (secondesAvantRenvoi <= 0) return;

    const minuteur = window.setTimeout(() => {
      setSecondesAvantRenvoi((secondes) => Math.max(0, secondes - 1));
    }, 1000);

    return () => window.clearTimeout(minuteur);
  }, [secondesAvantRenvoi]);

  useEffect(() => {
    // La saisie du code gère son propre focus.
    if (etape === "email") emailInputRef.current?.focus();
  }, [etape, modeConnexion]);

  const finaliserConnexion = (reponse: ReponseConnexion) => {
    enregistrerSession(reponse.token, reponse.user.id);
    localStorage.removeItem("mali_wuli_registration_token");
    localStorage.removeItem("mali_wuli_pending_email");
    localStorage.removeItem("mali_wuli_pending_verificationId");

    router.replace(reponse.user.onboardingFini ? "/dashboard" : "/onboarding");
  };

  const choisirMode = (mode: ModeConnexion) => {
    if (chargement || mode === modeConnexion) return;
    setModeConnexion(mode);
    setEtape("email");
    setCode("");
    setMotDePasse("");
    setErreur("");
    setInformation("");
    setSecondesAvantRenvoi(0);
  };

  const demanderCode = async (estRenvoi = false) => {
    setEmailTouche(true);
    if (!emailValide || chargement) return;

    setActionEnCours(estRenvoi ? "renvoi" : "demande");
    setErreur("");
    setInformation("");

    try {
      const reponse = await api.post<ReponseDemandeCode>("/auth/login/otp/request", {
        email: emailNormalise,
      });
      const delai = Math.max(
        1,
        Number(reponse.data.retryAfterSeconds) || DELAI_RENVOI_PAR_DEFAUT,
      );

      setSecondesAvantRenvoi(delai);
      setCode("");
      setEtape("code");
      setInformation(
        estRenvoi
          ? "Un nouveau code vient de vous être envoyé."
          : "Code envoyé. Consultez votre boîte e-mail, y compris vos courriers indésirables.",
      );
    } catch (error: unknown) {
      const erreurApi = error as ErreurApi;
      const attente = Number(erreurApi.response?.data?.retryAfterSeconds);
      if (Number.isFinite(attente) && attente > 0) {
        setSecondesAvantRenvoi(Math.ceil(attente));
      }
      setErreur(messageErreur(error, "demande"));
    } finally {
      setActionEnCours(null);
    }
  };

  const handleDemande = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await demanderCode(false);
  };

  const handleVerification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (codeValide) await verifierCode(code);
  };

  const verifierCode = async (valeur: string) => {
    if (!/^\d{6}$/.test(valeur) || chargement) return;

    setActionEnCours("verification");
    setErreur("");
    setInformation("");

    try {
      const reponse = await api.post<ReponseConnexion>("/auth/login/otp/verify", {
        email: emailNormalise,
        code: valeur,
      });

      finaliserConnexion(reponse.data);
    } catch (error: unknown) {
      setErreur(messageErreur(error, "verification"));
      setCode("");
    } finally {
      setActionEnCours(null);
    }
  };

  const handleConnexionMotDePasse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailTouche(true);
    if (!emailValide || !motDePasse || chargement) return;

    setActionEnCours("mot-de-passe");
    setErreur("");
    setInformation("");

    try {
      const reponse = await api.post<ReponseConnexion>("/auth/login", {
        email: emailNormalise,
        motDePasse,
      });
      finaliserConnexion(reponse.data);
    } catch (error: unknown) {
      setErreur(messageErreur(error, "mot-de-passe"));
    } finally {
      setActionEnCours(null);
    }
  };

  const changerAdresse = () => {
    setEtape("email");
    setCode("");
    setErreur("");
    setInformation("");
    setSecondesAvantRenvoi(0);
  };

  const enChargement = (action: ActionEnCours, texte: string, repos: React.ReactNode) =>
    actionEnCours === action
      ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{texte}</>
      : repos;

  const titre = etape === "code" ? "Vérifiez votre e-mail" : "Bon retour parmi nous";
  const sousTitre = etape === "code"
    ? <>
        Saisissez le code à 6 chiffres envoyé à&nbsp;:
        <span className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3.5 py-2.5">
          <strong className="min-w-0 truncate font-semibold text-ink">{emailNormalise}</strong>
          <button type="button" onClick={changerAdresse} disabled={chargement} className="shrink-0 rounded text-sm font-semibold text-brand underline-offset-4 hover:underline focus-anneau">Modifier</button>
        </span>
      </>
    : modeConnexion === "otp"
      ? "Recevez un code de connexion par e-mail : aucun mot de passe à retenir."
      : "Connectez-vous avec votre adresse e-mail et votre mot de passe.";

  return (
    <CoqueAuth
      titre={titre}
      sousTitre={sousTitre}
      lienHaut={{ texte: "Pas encore membre ?", libelle: "Créer un compte", href: "/register" }}
      pied={etape === "code" ? <span className="inline-flex items-center gap-1.5"><MailCheck size={15} aria-hidden="true" />Rien reçu ? Pensez à regarder dans les courriers indésirables.</span> : undefined}
    >
      {erreur && <Alerte>{erreur}</Alerte>}
      {information && !erreur && <Alerte ton="succes">{information}</Alerte>}

      {etape === "code" && modeConnexion === "otp" ? (
        <>
          <form onSubmit={handleVerification} className="space-y-6">
            <SaisieCode
              cases={casesCode}
              onChange={(cases) => { setCode(cases.join("")); if (erreur) setErreur(""); }}
              onComplet={(valeur) => void verifierCode(valeur)}
              invalide={Boolean(erreur)}
              desactive={actionEnCours === "verification"}
            />
            <button type="submit" disabled={!codeValide || chargement} aria-busy={actionEnCours === "verification"} className={classesBouton({ taille: "lg", pleineLargeur: true })}>
              {enChargement("verification", "Connexion…", "Se connecter")}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-ink-muted">
            {secondesAvantRenvoi > 0 ? (
              <p aria-live="polite">Vous pourrez demander un nouveau code dans <span className="font-semibold tabular-nums text-ink">{formaterDecompte(secondesAvantRenvoi)}</span></p>
            ) : (
              <p>Vous n’avez pas reçu le code ?{" "}
                <button type="button" onClick={() => void demanderCode(true)} disabled={chargement} className="rounded font-semibold text-brand underline-offset-4 hover:underline focus-anneau disabled:opacity-60">
                  {actionEnCours === "renvoi" ? "Envoi…" : "Renvoyer un code"}
                </button>
              </p>
            )}
          </div>
        </>
      ) : (
        <form onSubmit={modeConnexion === "otp" ? handleDemande : handleConnexionMotDePasse} noValidate className="space-y-5">
          <ChampTexte
            ref={emailInputRef}
            label="Adresse e-mail"
            type="email"
            name="email"
            inputMode="email"
            autoComplete={modeConnexion === "otp" ? "email" : "username"}
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => { setEmail(event.target.value); setErreur(""); }}
            erreur={emailInvalide && emailTouche ? "Saisissez une adresse e-mail valide." : undefined}
            onBlur={() => setEmailTouche(true)}
          />
          {modeConnexion === "mot-de-passe" && (
            <div>
              <ChampMotDePasse label="Mot de passe" valeur={motDePasse} onChange={(valeur) => { setMotDePasse(valeur); setErreur(""); }} autoComplete="current-password" afficherRegles={false} />
              <p className="mt-2 text-right">
                <Link href="/forgot-password" className="rounded text-sm font-semibold text-brand underline-offset-4 hover:underline focus-anneau">Mot de passe oublié ?</Link>
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={chargement || (modeConnexion === "mot-de-passe" && !motDePasse)}
            aria-busy={chargement}
            className={classesBouton({ taille: "lg", pleineLargeur: true, className: "group" })}
          >
            {modeConnexion === "otp"
              ? enChargement("demande", "Envoi du code…", <>Recevoir un code<ArrowRight size={18} aria-hidden="true" className="transition group-hover:translate-x-0.5" /></>)
              : enChargement("mot-de-passe", "Connexion…", "Se connecter")}
          </button>
        </form>
      )}

      {etape === "email" && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line-soft" />ou<span className="h-px flex-1 bg-line-soft" />
          </div>
          <button
            type="button"
            onClick={() => choisirMode(modeConnexion === "otp" ? "mot-de-passe" : "otp")}
            disabled={chargement}
            className={classesBouton({ variante: "secondaire", taille: "lg", pleineLargeur: true })}
          >
            {modeConnexion === "otp" ? <><KeyRound size={18} aria-hidden="true" />Utiliser mon mot de passe</> : <><Mail size={18} aria-hidden="true" />Recevoir plutôt un code par e-mail</>}
          </button>
        </>
      )}
    </CoqueAuth>
  );
}

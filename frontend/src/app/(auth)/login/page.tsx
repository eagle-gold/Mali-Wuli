"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
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
    return messageServeur || "Adresse e-mail ou mot de passe incorrect.";
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
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [modeConnexion, setModeConnexion] = useState<ModeConnexion>("otp");
  const [etape, setEtape] = useState<EtapeConnexion>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [actionEnCours, setActionEnCours] = useState<ActionEnCours>(null);
  const [secondesAvantRenvoi, setSecondesAvantRenvoi] = useState(0);
  const [erreur, setErreur] = useState("");
  const [information, setInformation] = useState("");

  const emailNormalise = normaliserEmail(email);
  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalise);
  const emailInvalide = email.trim().length > 0 && !emailValide;
  const codeValide = /^\d{6}$/.test(code);
  const chargement = actionEnCours !== null;

  useEffect(() => {
    if (secondesAvantRenvoi <= 0) return;

    const minuteur = window.setTimeout(() => {
      setSecondesAvantRenvoi((secondes) => Math.max(0, secondes - 1));
    }, 1000);

    return () => window.clearTimeout(minuteur);
  }, [secondesAvantRenvoi]);

  useEffect(() => {
    if (modeConnexion === "otp" && etape === "code") {
      codeInputRef.current?.focus();
    } else {
      emailInputRef.current?.focus();
    }
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
    setMotDePasseVisible(false);
    setErreur("");
    setInformation("");
    setSecondesAvantRenvoi(0);
  };

  const demanderCode = async (estRenvoi = false) => {
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
    if (!codeValide || chargement) return;

    setActionEnCours("verification");
    setErreur("");
    setInformation("");

    try {
      const reponse = await api.post<ReponseConnexion>("/auth/login/otp/verify", {
        email: emailNormalise,
        code,
      });

      finaliserConnexion(reponse.data);
    } catch (error: unknown) {
      setErreur(messageErreur(error, "verification"));
      setCode("");
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
    } finally {
      setActionEnCours(null);
    }
  };

  const handleConnexionMotDePasse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-page)] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-6 shadow-sm sm:p-8">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-[#0d6738]">
          {modeConnexion === "otp"
            ? `Code reçu par e-mail · étape ${etape === "email" ? "1" : "2"} sur 2`
            : "Avec mon mot de passe"}
        </p>
        <h1 className="mb-3 text-center font-display text-3xl font-bold text-[#2e261f]">
          Se connecter
        </h1>
        <p className="mb-5 text-center text-sm leading-relaxed text-[#776b5e]">
          {modeConnexion === "mot-de-passe"
            ? "Connectez-vous avec le mot de passe créé lors de votre inscription."
            : etape === "email"
              ? "Nous vous envoyons un code à 6 chiffres par e-mail. Aucun mot de passe n’est nécessaire."
              : "Saisissez les 6 chiffres reçus dans votre e-mail."}
        </p>

        <div
          className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-[#f2e8d9] p-1.5"
          role="group"
          aria-label="Choisir une méthode de connexion"
        >
          <button
            type="button"
            onClick={() => choisirMode("otp")}
            disabled={chargement}
            aria-pressed={modeConnexion === "otp"}
            className={`min-h-12 rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-1 ${
              modeConnexion === "otp"
                ? "bg-[#0d6738] text-white shadow-sm"
                : "bg-transparent text-[#2e261f] hover:bg-[#fffbf5]"
            }`}
          >
            Recevoir un code
          </button>
          <button
            type="button"
            onClick={() => choisirMode("mot-de-passe")}
            disabled={chargement}
            aria-pressed={modeConnexion === "mot-de-passe"}
            className={`min-h-12 rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-1 ${
              modeConnexion === "mot-de-passe"
                ? "bg-[#0d6738] text-white shadow-sm"
                : "bg-transparent text-[#2e261f] hover:bg-[#fffbf5]"
            }`}
          >
            Utiliser mon mot de passe
          </button>
        </div>

        {erreur && (
          <p
            id="erreur-connexion"
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700"
          >
            {erreur}
          </p>
        )}

        {information && (
          <p
            role="status"
            aria-live="polite"
            className="mb-5 rounded-xl border border-[#bfddcd] bg-[#edf7f1] px-4 py-3 text-sm leading-relaxed text-[#0d6738]"
          >
            {information}
          </p>
        )}

        {modeConnexion === "mot-de-passe" ? (
          <form
            onSubmit={handleConnexionMotDePasse}
            className="space-y-5"
            aria-busy={chargement}
          >
            <div>
              <label
                htmlFor="email-mot-de-passe"
                className="mb-1.5 block text-sm font-semibold text-[#2e261f]"
              >
                Adresse e-mail
              </label>
              <input
                ref={emailInputRef}
                id="email-mot-de-passe"
                name="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErreur("");
                }}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="vous@exemple.com"
                aria-invalid={Boolean(erreur) || emailInvalide}
                aria-describedby={
                  erreur ? "erreur-connexion" : emailInvalide ? "aide-email-mot-de-passe" : undefined
                }
                required
                className="w-full rounded-xl border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3.5 text-base text-[#2e261f] outline-none transition focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
              />
              {emailInvalide && (
                <p
                  id="aide-email-mot-de-passe"
                  className="mt-2 text-xs leading-relaxed text-[#9b3b2b]"
                >
                  Saisissez une adresse complète, par exemple vous@exemple.com.
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label
                  htmlFor="mot-de-passe"
                  className="block text-sm font-semibold text-[#2e261f]"
                >
                  Mot de passe
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-[#0d6738] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#0d6738]"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="mot-de-passe"
                  name="motDePasse"
                  type={motDePasseVisible ? "text" : "password"}
                  value={motDePasse}
                  onChange={(event) => {
                    setMotDePasse(event.target.value);
                    setErreur("");
                  }}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  aria-invalid={Boolean(erreur)}
                  aria-describedby={erreur ? "erreur-connexion" : undefined}
                  required
                  className="w-full rounded-xl border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3.5 pr-12 text-base text-[#2e261f] outline-none transition focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
                />
                <button
                  type="button"
                  onClick={() => setMotDePasseVisible((visible) => !visible)}
                  aria-label={motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#776b5e] hover:text-[#0d6738] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0d6738]"
                >
                  {motDePasseVisible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!emailValide || !motDePasse || chargement}
              className={`w-full rounded-xl py-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 ${
                emailValide && motDePasse && !chargement
                  ? "bg-[#0d6738] text-white hover:bg-[#09572f]"
                  : "cursor-not-allowed bg-[#eee2d0] text-[#8a7c6b]"
              }`}
            >
              {actionEnCours === "mot-de-passe" ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        ) : etape === "email" ? (
          <form onSubmit={handleDemande} className="space-y-5" aria-busy={chargement}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[#2e261f]">
                Adresse e-mail
              </label>
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErreur("");
                }}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="send"
                placeholder="vous@exemple.com"
                aria-invalid={Boolean(erreur) || emailInvalide}
                aria-describedby={
                  erreur ? "erreur-connexion" : emailInvalide ? "aide-email" : undefined
                }
                required
                className="w-full rounded-xl border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3.5 text-base text-[#2e261f] outline-none transition focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
              />
              {emailInvalide && (
                <p id="aide-email" className="mt-2 text-xs leading-relaxed text-[#9b3b2b]">
                  Saisissez une adresse complète, par exemple vous@exemple.com.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!emailValide || chargement}
              className={`w-full rounded-xl py-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 ${
                emailValide && !chargement
                  ? "bg-[#0d6738] text-white hover:bg-[#09572f]"
                  : "cursor-not-allowed bg-[#eee2d0] text-[#8a7c6b]"
              }`}
            >
              {actionEnCours === "demande" ? "Envoi du code…" : "Recevoir mon code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerification} className="space-y-5" aria-busy={chargement}>
            <div className="rounded-xl border border-[#eadcc5] bg-[#f8f1e6] px-4 py-3">
              <p className="text-xs font-medium text-[#776b5e]">Code envoyé à</p>
              <p className="mt-0.5 break-all text-sm font-semibold text-[#2e261f]">
                {emailNormalise}
              </p>
              <button
                type="button"
                onClick={changerAdresse}
                disabled={chargement}
                className="mt-2 min-h-11 text-sm font-semibold text-[#0d6738] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#0d6738]"
              >
                Changer d’adresse e-mail
              </button>
            </div>

            <div>
              <label htmlFor="code-otp" className="mb-1.5 block text-sm font-semibold text-[#2e261f]">
                Code reçu par e-mail (6 chiffres)
              </label>
              <input
                ref={codeInputRef}
                id="code-otp"
                name="code"
                type="text"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setErreur("");
                }}
                autoComplete="one-time-code"
                inputMode="numeric"
                enterKeyHint="done"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                aria-invalid={Boolean(erreur)}
                aria-describedby={`aide-code${erreur ? " erreur-connexion" : ""}`}
                required
                className="w-full rounded-xl border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3.5 text-center font-mono text-2xl font-bold tracking-[0.4em] text-[#2e261f] outline-none transition placeholder:tracking-[0.4em] placeholder:text-[#c8b99f] focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
              />
              <p id="aide-code" className="mt-2 text-xs leading-relaxed text-[#776b5e]">
                Le code est temporaire et ne peut être utilisé qu’une seule fois.
              </p>
            </div>

            <button
              type="submit"
              disabled={!codeValide || chargement}
              className={`w-full rounded-xl py-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 ${
                codeValide && !chargement
                  ? "bg-[#0d6738] text-white hover:bg-[#09572f]"
                  : "cursor-not-allowed bg-[#eee2d0] text-[#8a7c6b]"
              }`}
            >
              {actionEnCours === "verification" ? "Vérification…" : "Se connecter"}
            </button>

            <div className="text-center text-sm">
              {secondesAvantRenvoi > 0 ? (
                <p className="text-[#776b5e]">
                  Nouveau code disponible dans {secondesAvantRenvoi} s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void demanderCode(true)}
                  disabled={chargement}
                  className="min-h-11 font-semibold text-[#0d6738] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#0d6738]"
                >
                  {actionEnCours === "renvoi" ? "Renvoi en cours…" : "Renvoyer un code"}
                </button>
              )}
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[#2e261f]">
          Pas encore membre ?{" "}
          <Link href="/register" className="font-semibold text-[#0d6738] hover:underline">
            S&apos;inscrire
          </Link>
        </p>
      </section>
    </main>
  );
}

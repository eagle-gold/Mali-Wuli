"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";

const emailEstValide = (valeur: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim());

const criteresMotDePasse = (valeur: string) => [
  { label: "8 caractères minimum", valide: valeur.length >= 8 },
  { label: "Une minuscule", valide: /[a-z]/.test(valeur) },
  { label: "Une majuscule", valide: /[A-Z]/.test(valeur) },
  { label: "Un chiffre", valide: /\d/.test(valeur) },
];

const motDePasseEstValide = (valeur: string) =>
  criteresMotDePasse(valeur).every((critere) => critere.valide);

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [renvoiEnCours, setRenvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [information, setInformation] = useState("");
  const [termine, setTermine] = useState(false);

  useEffect(() => {
    setEmail(sessionStorage.getItem("mali_wuli_reset_email") || "");
  }, []);

  const formulaireValide =
    emailEstValide(email) &&
    /^\d{6}$/.test(code) &&
    motDePasseEstValide(motDePasse) &&
    confirmation === motDePasse;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErreur("");
    setInformation("");

    if (!motDePasseEstValide(motDePasse)) {
      setErreur("Le mot de passe ne respecte pas encore toutes les règles de sécurité.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    if (!formulaireValide || loading) return;

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: email.trim().toLowerCase(),
        code,
        motDePasse,
      });
      sessionStorage.removeItem("mali_wuli_reset_email");
      setTermine(true);
      setCode("");
      setMotDePasse("");
      setConfirmation("");
    } catch (err: unknown) {
      const erreurApi = err as { response?: { data?: { message?: string } } };
      setErreur(
        erreurApi.response?.data?.message ||
          "Impossible de modifier le mot de passe. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!emailEstValide(email) || renvoiEnCours) return;

    setRenvoiEnCours(true);
    setErreur("");
    setInformation("");
    const emailNormalise = email.trim().toLowerCase();
    try {
      await api.post("/auth/forgot-password", { email: emailNormalise });
      sessionStorage.setItem("mali_wuli_reset_email", emailNormalise);
      setCode("");
      setInformation("Si cette adresse correspond à un compte, un nouveau code a été envoyé.");
    } catch (err: unknown) {
      const erreurApi = err as { response?: { data?: { message?: string } } };
      setErreur(erreurApi.response?.data?.message || "Impossible de renvoyer le code.");
    } finally {
      setRenvoiEnCours(false);
    }
  };

  if (termine) {
    return (
      <main className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4 py-10">
        <section className="bg-surface rounded-2xl shadow-sm border border-line w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#e2efe8] text-2xl font-bold text-brand">
            ✓
          </div>
          <h1 className="font-display text-3xl font-bold text-ink mb-3">
            Mot de passe modifié
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-ink-muted">
            Votre nouveau mot de passe est enregistré. Vous pouvez maintenant vous connecter.
          </p>
          <Link
            href="/login"
            className="block w-full rounded-xl bg-brand py-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Se connecter
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4 py-10">
      <section className="bg-surface rounded-2xl shadow-sm border border-line w-full max-w-md p-8">
        <h1 className="font-display text-3xl font-bold text-ink mb-3">
          Choisissez un nouveau mot de passe
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted mb-7">
          Saisissez le code reçu par e-mail, puis créez un mot de passe d&apos;au moins
          8 caractères.
        </p>

        {erreur && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {erreur}
          </p>
        )}
        {information && (
          <p className="mb-5 rounded-xl border border-[#bcd8ca] bg-[#edf6f1] px-4 py-3 text-sm text-brand">
            {information}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErreur("");
              }}
              autoComplete="email"
              inputMode="email"
              required
              className="w-full border border-line-strong rounded-xl px-4 py-3 text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand text-sm"
            />
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-ink mb-1">
              Code à 6 chiffres
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setErreur("");
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              required
              className="w-full border border-line-strong rounded-xl px-4 py-3 text-center text-xl font-bold tracking-[0.45em] text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="motDePasse" className="block text-sm font-medium text-ink mb-1">
              Nouveau mot de passe
            </label>
            <input
              id="motDePasse"
              type="password"
              value={motDePasse}
              onChange={(event) => {
                setMotDePasse(event.target.value);
                setErreur("");
              }}
              minLength={8}
              autoComplete="new-password"
              required
              className="w-full border border-line-strong rounded-xl px-4 py-3 text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand text-sm"
            />
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1" aria-label="Règles du mot de passe">
              {criteresMotDePasse(motDePasse).map((critere) => (
                <li
                  key={critere.label}
                  className={`text-xs ${critere.valide ? "text-brand" : "text-ink-muted"}`}
                >
                  {critere.valide ? "✓" : "○"} {critere.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="confirmation" className="block text-sm font-medium text-ink mb-1">
              Confirmez le mot de passe
            </label>
            <input
              id="confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setErreur("");
              }}
              minLength={8}
              autoComplete="new-password"
              required
              className="w-full border border-line-strong rounded-xl px-4 py-3 text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={!formulaireValide || loading}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors ${
              formulaireValide && !loading
                ? "bg-brand text-white hover:bg-brand-700"
                : "bg-[#eee2d0] text-[#ad9d89] cursor-not-allowed"
            }`}
          >
            {loading ? "Modification en cours..." : "Modifier mon mot de passe"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Retour à la connexion
          </Link>
          <button
            type="button"
            onClick={handleResend}
            disabled={!emailEstValide(email) || renvoiEnCours}
            className="font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:text-[#ad9d89]"
          >
            {renvoiEnCours ? "Envoi..." : "Renvoyer un code"}
          </button>
        </div>
      </section>
    </main>
  );
}

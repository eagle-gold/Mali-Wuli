"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import api from "@/lib/api";

const emailEstValide = (valeur: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim());

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const emailValide = emailEstValide(email);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailValide || loading) return;

    setLoading(true);
    setErreur("");
    const emailNormalise = email.trim().toLowerCase();

    try {
      await api.post("/auth/forgot-password", { email: emailNormalise });
      sessionStorage.setItem("mali_wuli_reset_email", emailNormalise);
      router.push("/reset-password");
    } catch (err: unknown) {
      const erreurApi = err as { response?: { data?: { message?: string } } };
      setErreur(
        erreurApi.response?.data?.message ||
          "Le service est momentanément indisponible. Réessayez dans quelques instants.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4 py-10">
      <section className="bg-[#fffbf5] rounded-2xl shadow-sm border border-[#e4d2b3] w-full max-w-md p-8">
        <h1 className="font-display text-3xl font-bold text-[#292119] mb-3">
          Mot de passe oublié
        </h1>
        <p className="text-sm leading-relaxed text-[#776b5e] mb-8">
          Entrez l&apos;adresse e-mail de votre compte. Si elle est reconnue, vous recevrez
          un code à 6 chiffres valable 15 minutes.
        </p>

        {erreur && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {erreur}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#2e261f] mb-1">
              Adresse e-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErreur("");
              }}
              placeholder="prenom.nom@exemple.com"
              autoComplete="email"
              inputMode="email"
              required
              autoFocus
              className="w-full border border-[#dfc9a8] rounded-xl px-4 py-3 text-[#2e261f] bg-[#fffbf5] focus:outline-none focus:ring-2 focus:ring-[#0d6738] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={!emailValide || loading}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors ${
              emailValide && !loading
                ? "bg-[#0d6738] text-white hover:bg-[#09572f]"
                : "bg-[#eee2d0] text-[#ad9d89] cursor-not-allowed"
            }`}
          >
            {loading ? "Envoi en cours..." : "Recevoir mon code"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-semibold text-[#0d6738] hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const emailEstValide = (valeur: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim());

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const emailValide = emailEstValide(email);

  useEffect(() => {
    const parrain = new URLSearchParams(window.location.search).get("parrain")?.trim();
    if (parrain) localStorage.setItem("mali_wuli_parrain_code", parrain);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailValide || loading) return;

    setLoading(true);
    setErreur("");

    try {
      const res = await api.post("/auth/request-email-code", {
        email: email.trim(),
      });

      localStorage.setItem("mali_wuli_pending_email", email.trim().toLowerCase());
      localStorage.setItem("mali_wuli_pending_verificationId", res.data.verificationId);
      localStorage.removeItem("mali_wuli_registration_token");
      router.push("/verify-email");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setErreur(error.response?.data?.message || "Impossible d'envoyer le code. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4 py-10">
      <section className="bg-surface rounded-2xl shadow-sm border border-line w-full max-w-md p-8">
        <h1 className="font-display text-3xl font-bold text-ink mb-3">
          Créer votre compte
        </h1>
        <p className="text-sm text-ink leading-relaxed mb-8">
          Entrez votre adresse e-mail : nous vous envoyons un code à 6 chiffres pour
          confirmer que c&apos;est bien vous.
        </p>

        {erreur && (
          <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erreur}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
              Adresse e-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="prenom.nom@exemple.com"
              autoComplete="email"
              className="w-full border border-line-strong rounded-xl px-4 py-3 text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={!emailValide || loading}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors ${
              emailValide && !loading
                ? "bg-brand text-white hover:bg-brand-700"
                : "bg-[#eee2d0] text-[#ad9d89] cursor-not-allowed"
            }`}
          >
            {loading ? "Envoi en cours..." : "Recevoir mon code"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-ink leading-relaxed">
          En continuant, vous acceptez les conditions d&apos;utilisation du réseau :
          entraide, respect, zéro démarchage. {" "}
          <a href="/cgu" className="text-brand font-medium underline">
            Voir plus
          </a>
        </p>
      </section>
    </main>
  );
}

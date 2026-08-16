"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const INPUT = "w-full border border-sable-200 rounded-xl px-4 py-3 text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert text-sm";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", dateNaissance: "", motDePasse: "", cgu: false,
  });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [erreurGlobale, setErreurGlobale] = useState("");

  const set = (field: string, value: string | boolean) =>
    setForm((p) => ({ ...p, [field]: value }));

  const valider = () => {
    const e: Record<string, string> = {};
    if (!form.prenom.trim()) e.prenom = "Le prénom est obligatoire.";
    if (!form.nom.trim()) e.nom = "Le nom est obligatoire.";
    if (!form.email.includes("@")) e.email = "Email invalide.";
    if (!form.dateNaissance) e.dateNaissance = "La date de naissance est obligatoire.";
    if (form.motDePasse.length < 8) e.motDePasse = "8 caractères minimum.";
    if (!form.cgu) e.cgu = "Vous devez accepter les CGU.";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = valider();
    if (Object.keys(e2).length > 0) { setErreurs(e2); return; }
    setErreurs({});
    setLoading(true);
    setErreurGlobale("");
    try {
      const res = await api.post("/auth/register", {
        prenom: form.prenom,
        nom: form.nom,
        email: form.email,
        dateNaissance: form.dateNaissance,
        motDePasse: form.motDePasse,
      });
      // Stocker l'email pour la vérification
      localStorage.setItem("mali_wuli_pending_email", form.email);
      localStorage.setItem("mali_wuli_pending_userId", res.data.userId);
      router.push("/verify-email");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setErreurGlobale(error.response?.data?.message || "Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sable-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-sable-100 w-full max-w-md p-8">
        <h1 className="font-display text-3xl font-bold text-terre mb-1 text-center">
          Rejoindre Mali Wuli
        </h1>
        <p className="text-center text-sm text-terre-300 mb-8">
          Création de compte — environ 5 minutes
        </p>

        {erreurGlobale && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">
            {erreurGlobale}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-terre mb-1">Prénom</label>
              <input type="text" value={form.prenom} onChange={(e) => set("prenom", e.target.value)}
                className={INPUT} />
              {erreurs.prenom && <p className="text-xs text-red-500 mt-1">{erreurs.prenom}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-terre mb-1">Nom</label>
              <input type="text" value={form.nom} onChange={(e) => set("nom", e.target.value)}
                className={INPUT} />
              {erreurs.nom && <p className="text-xs text-red-500 mt-1">{erreurs.nom}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-terre mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              className={INPUT} />
            {erreurs.email && <p className="text-xs text-red-500 mt-1">{erreurs.email}</p>}
          </div>

          {/* Date de naissance */}
          <div>
            <label className="block text-sm font-medium text-terre mb-1">Date de naissance</label>
            <input type="date" value={form.dateNaissance} onChange={(e) => set("dateNaissance", e.target.value)}
              className={INPUT} />
            {erreurs.dateNaissance && <p className="text-xs text-red-500 mt-1">{erreurs.dateNaissance}</p>}
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-terre mb-1">Mot de passe</label>
            <input type="password" value={form.motDePasse} onChange={(e) => set("motDePasse", e.target.value)}
              placeholder="8 caractères minimum" className={INPUT} />
            {erreurs.motDePasse && <p className="text-xs text-red-500 mt-1">{erreurs.motDePasse}</p>}
          </div>

          {/* CGU */}
          <div className="flex items-start gap-3">
            <input type="checkbox" id="cgu" checked={form.cgu}
              onChange={(e) => set("cgu", e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-vert" />
            <label htmlFor="cgu" className="text-sm text-terre-300 leading-relaxed">
              J'accepte les{" "}
              <a href="/cgu" className="text-vert underline">CGU</a>{" "}et la{" "}
              <a href="/confidentialite" className="text-vert underline">politique de confidentialité</a>
            </label>
          </div>
          {erreurs.cgu && <p className="text-xs text-red-500 -mt-3">{erreurs.cgu}</p>}

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl text-white font-semibold text-sm transition-colors
              ${loading ? "bg-sable-200 cursor-not-allowed" : "bg-vert hover:bg-vert-500"}`}
          >
            {loading ? "Création en cours..." : "Créer mon compte"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-terre-300">
          Déjà membre ?{" "}
          <a href="/login" className="text-vert font-medium hover:underline">Se connecter</a>
        </p>
      </div>
    </div>
  );
}

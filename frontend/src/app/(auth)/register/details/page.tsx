"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { enregistrerSession } from "@/lib/session";

const criteresMotDePasse = (valeur: string) => [
  { label: "8 caractères minimum", valide: valeur.length >= 8 },
  { label: "Une lettre minuscule", valide: /[a-z]/.test(valeur) },
  { label: "Une lettre majuscule", valide: /[A-Z]/.test(valeur) },
  { label: "Un chiffre", valide: /\d/.test(valeur) },
];

const motDePasseEstValide = (valeur: string) =>
  criteresMotDePasse(valeur).every((critere) => critere.valide);

export default function RegisterDetailsPage() {
  const router = useRouter();
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [chargementCompte, setChargementCompte] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  const criteres = useMemo(() => criteresMotDePasse(motDePasse), [motDePasse]);
  const motsDePasseIdentiques = motDePasse !== "" && motDePasse === confirmation;
  const formulaireValide =
    prenom.trim().length >= 2 &&
    nom.trim().length >= 2 &&
    motDePasseEstValide(motDePasse) &&
    motsDePasseIdentiques &&
    Boolean(email);

  useEffect(() => {
    let actif = true;

    const chargerCompte = async () => {
      const registrationToken = localStorage.getItem("mali_wuli_registration_token");
      const emailStocke = localStorage.getItem("mali_wuli_pending_email")?.trim() || "";
      if (!registrationToken || !emailStocke) {
        router.replace("/register");
        return;
      }

      if (actif) {
        setEmail(emailStocke.toLowerCase());
        setChargementCompte(false);
      }
    };

    void chargerCompte();
    return () => {
      actif = false;
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formulaireValide || loading) return;

    setLoading(true);
    setErreur("");

    try {
      const parrainCode = localStorage.getItem("mali_wuli_parrain_code")?.trim() || undefined;
      const registrationToken = localStorage.getItem("mali_wuli_registration_token");
      if (!registrationToken) {
        router.replace("/register");
        return;
      }
      const reponse = await api.post("/auth/register", {
        prenom: prenom.trim(),
        nom: nom.trim(),
        email,
        motDePasse,
        parrainCode,
        registrationToken,
      });

      enregistrerSession(reponse.data.token, reponse.data.user.id);
      localStorage.removeItem("mali_wuli_pending_email");
      localStorage.removeItem("mali_wuli_pending_verificationId");
      localStorage.removeItem("mali_wuli_registration_token");
      localStorage.removeItem("mali_wuli_parrain_code");
      router.replace("/onboarding");
    } catch (err: unknown) {
      const erreurApi = err as { response?: { data?: { message?: string } } };
      setErreur(
        erreurApi.response?.data?.message ||
          "Impossible de finaliser votre compte. Vérifiez les informations puis réessayez.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4 py-10">
      <section className="bg-[#fffbf5] rounded-2xl shadow-sm border border-[#e4d2b3] w-full max-w-lg p-8">
        <div className="mb-7">
          <div className="mb-4 flex gap-2" aria-label="Étape 2 sur 2">
            <span className="h-2 w-9 rounded-full bg-[#0d6738]" />
            <span className="h-2 w-9 rounded-full bg-[#0d6738]" />
          </div>
          <h1 className="font-display text-3xl font-bold text-[#2e261f] mb-2">
            Finalisez votre compte
          </h1>
          <p className="text-sm leading-relaxed text-[#776b5e]">
            {chargementCompte ? (
              "Vérification de votre adresse e-mail…"
            ) : (
              <>
                Adresse vérifiée : <strong className="text-[#2e261f]">{email}</strong>
              </>
            )}
          </p>
        </div>

        {erreur && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {erreur}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prenom" className="block text-sm font-medium text-[#2e261f] mb-1">
                Prénom <span className="text-[#a44d28]">*</span>
              </label>
              <input
                id="prenom"
                type="text"
                value={prenom}
                onChange={(event) => {
                  setPrenom(event.target.value);
                  setErreur("");
                }}
                autoComplete="given-name"
                minLength={2}
                maxLength={100}
                required
                className="w-full border border-[#dfc9a8] rounded-xl px-4 py-3 text-[#2e261f] bg-[#fffbf5] focus:outline-none focus:ring-2 focus:ring-[#0d6738] text-sm"
              />
            </div>
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-[#2e261f] mb-1">
                Nom <span className="text-[#a44d28]">*</span>
              </label>
              <input
                id="nom"
                type="text"
                value={nom}
                onChange={(event) => {
                  setNom(event.target.value);
                  setErreur("");
                }}
                autoComplete="family-name"
                minLength={2}
                maxLength={100}
                required
                className="w-full border border-[#dfc9a8] rounded-xl px-4 py-3 text-[#2e261f] bg-[#fffbf5] focus:outline-none focus:ring-2 focus:ring-[#0d6738] text-sm"
              />
            </div>
          </div>

          <div className="border-t border-[#ead8bd] pt-5">
            <label htmlFor="motDePasse" className="block text-sm font-medium text-[#2e261f] mb-1">
              Mot de passe <span className="text-[#a44d28]">*</span>
            </label>
            <div className="relative">
              <input
                id="motDePasse"
                type={motDePasseVisible ? "text" : "password"}
                value={motDePasse}
                onChange={(event) => {
                  setMotDePasse(event.target.value);
                  setErreur("");
                }}
                autoComplete="new-password"
                required
                className="w-full border border-[#dfc9a8] rounded-xl px-4 py-3 pr-12 text-[#2e261f] bg-[#fffbf5] focus:outline-none focus:ring-2 focus:ring-[#0d6738] text-sm"
              />
              <button
                type="button"
                onClick={() => setMotDePasseVisible((visible) => !visible)}
                aria-label={motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#776b5e] hover:text-[#0d6738]"
              >
                {motDePasseVisible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            <ul className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2" aria-label="Règles du mot de passe">
              {criteres.map((critere) => (
                <li
                  key={critere.label}
                  className={`text-xs ${critere.valide ? "text-[#0d6738]" : "text-[#776b5e]"}`}
                >
                  {critere.valide ? "✓" : "○"} {critere.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="confirmation" className="block text-sm font-medium text-[#2e261f] mb-1">
              Confirmez le mot de passe <span className="text-[#a44d28]">*</span>
            </label>
            <div className="relative">
              <input
                id="confirmation"
                type={confirmationVisible ? "text" : "password"}
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setErreur("");
                }}
                autoComplete="new-password"
                required
                className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm text-[#2e261f] bg-[#fffbf5] focus:outline-none focus:ring-2 ${
                  confirmation && !motsDePasseIdentiques
                    ? "border-red-300 focus:ring-red-300"
                    : "border-[#dfc9a8] focus:ring-[#0d6738]"
                }`}
              />
              <button
                type="button"
                onClick={() => setConfirmationVisible((visible) => !visible)}
                aria-label={confirmationVisible ? "Masquer la confirmation" : "Afficher la confirmation"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#776b5e] hover:text-[#0d6738]"
              >
                {confirmationVisible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {confirmation && (
              <p className={`mt-1.5 text-xs ${motsDePasseIdentiques ? "text-[#0d6738]" : "text-red-600"}`}>
                {motsDePasseIdentiques
                  ? "✓ Les mots de passe correspondent."
                  : "Les mots de passe ne correspondent pas."}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!formulaireValide || loading || chargementCompte}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors ${
              formulaireValide && !loading && !chargementCompte
                ? "bg-[#0d6738] text-white hover:bg-[#09572f]"
                : "bg-[#eee2d0] text-[#ad9d89] cursor-not-allowed"
            }`}
          >
            {loading ? "Création du compte..." : "Continuer vers mon profil"}
          </button>
        </form>
      </section>
    </main>
  );
}

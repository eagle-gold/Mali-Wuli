"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const [renvoiOk, setRenvoiOk] = useState(false);
  const [email, setEmail] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const codeComplet = code.every(Boolean);
  const codeSaisi = code.join("");

  useEffect(() => {
    setEmail(localStorage.getItem("mali_wuli_pending_email") || "");
  }, []);

  const appliquerCode = (valeur: string) => {
    const chiffres = valeur.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(Array.from({ length: CODE_LENGTH }, (_, index) => chiffres[index] || ""));
    setErreur("");
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const nouveauCode = [...code];
    nouveauCode[index] = value;
    setCode(nouveauCode);
    setErreur("");

    if (value && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    appliquerCode(event.clipboardData.getData("text"));
    inputs.current[CODE_LENGTH - 1]?.focus();
  };

  const handleVerify = async () => {
    if (!codeComplet) {
      setErreur("Entrez les 6 chiffres du code.");
      return;
    }

    setLoading(true);
    setErreur("");

    try {
      const verificationId = localStorage.getItem("mali_wuli_pending_verificationId");
      const res = await api.post("/auth/verify-registration-email", {
        verificationId,
        email,
        code: codeSaisi,
      });
      localStorage.setItem("mali_wuli_token", res.data.token);
      localStorage.setItem("mali_wuli_user_id", res.data.user.id);
      localStorage.removeItem("mali_wuli_pending_email");
      localStorage.removeItem("mali_wuli_pending_verificationId");
      localStorage.removeItem("mali_wuli_registration_token");
      router.push("/onboarding");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setErreur(error.response?.data?.message || "Code incorrect ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!codeComplet) {
      setErreur(
        "Pour continuer, consultez votre boîte e-mail, saisissez ici le code à 6 chiffres reçu, puis cliquez sur « Confirmer ».",
      );
      return;
    }

    void handleVerify();
  };

  const handleResend = async () => {
    setErreur("");
    setRenvoiOk(false);

    try {
      const verificationId = localStorage.getItem("mali_wuli_pending_verificationId");
      await api.post("/auth/resend-registration-code", { verificationId });
      appliquerCode("");
      setRenvoiOk(true);
      setTimeout(() => setRenvoiOk(false), 5000);
    } catch {
      setErreur("Impossible de renvoyer le code.");
    }
  };

  const handleBack = () => {
    localStorage.removeItem("mali_wuli_pending_email");
    localStorage.removeItem("mali_wuli_pending_verificationId");
    localStorage.removeItem("mali_wuli_registration_token");
    router.push("/register");
  };

  return (
    <main className="min-h-screen bg-[#f6efe3] flex items-center justify-center px-4 py-10">
      <section className="bg-[#fffbf5] rounded-2xl shadow-sm border border-[#e4d2b3] w-full max-w-md p-8 text-center">
        <nav className="flex items-center justify-between mb-7" aria-label="Navigation de l'inscription">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-semibold text-[#2e261f] hover:text-[#0d6738] hover:underline"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="text-sm font-semibold text-[#0d6738] hover:underline"
          >
            Suivant
          </button>
        </nav>

        <h1 className="font-display text-3xl font-bold text-[#2e261f] mb-3">
          Confirmez votre e-mail
        </h1>
        <p className="text-sm text-[#2e261f] mb-8">
          Code à 6 chiffres envoyé à {" "}
          <strong>{email || "votre adresse e-mail"}</strong>
        </p>

        <div
          className="flex justify-center gap-2 mb-6"
          onPaste={handlePaste}
          aria-label="Code de confirmation"
        >
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              aria-label={`Chiffre ${index + 1}`}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className={`h-14 w-11 sm:w-12 rounded-xl border text-center text-xl font-bold text-[#2e261f] outline-none transition-colors focus:ring-2 focus:ring-[#0d6738] ${
                digit
                  ? "border-[#0d6738] bg-[#eaf1e9]"
                  : "border-[#dfc9a8] bg-[#fffbf5]"
              }`}
            />
          ))}
        </div>

        {erreur && <p role="alert" className="text-sm text-red-600 mt-4">{erreur}</p>}
        {renvoiOk && <p className="text-sm text-[#0d6738] mt-4">Code renvoyé !</p>}

        <button
          type="button"
          onClick={handleVerify}
          disabled={!codeComplet || loading}
          className={`w-full py-4 rounded-xl font-semibold text-sm mt-6 transition-colors ${
            codeComplet && !loading
              ? "bg-[#0d6738] text-white hover:bg-[#09572f]"
              : "bg-[#eee2d0] text-[#ad9d89] cursor-not-allowed"
          }`}
        >
          {loading ? "Vérification..." : "Confirmer"}
        </button>

        <p className="mt-5 text-sm text-[#2e261f]">
          Pas reçu ? {" "}
          <button
            type="button"
            onClick={handleResend}
            className="font-semibold text-[#0d6738] hover:underline"
          >
            Renvoyer le code
          </button>
        </p>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { terminerSession } from "@/lib/session";

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
    const emailEnAttente = localStorage.getItem("mali_wuli_pending_email") || "";
    const verificationId = localStorage.getItem("mali_wuli_pending_verificationId");
    if (!emailEnAttente || !verificationId) {
      router.replace("/register");
      return;
    }
    setEmail(emailEnAttente);
  }, [router]);

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
      terminerSession();
      localStorage.setItem("mali_wuli_registration_token", res.data.registrationToken);
      localStorage.removeItem("mali_wuli_pending_verificationId");
      router.push("/register/details");
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
    <main className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4 py-10">
      <section className="bg-surface rounded-2xl shadow-sm border border-line w-full min-w-0 max-w-md p-5 text-center sm:p-8">
        <nav className="flex items-center justify-between mb-7" aria-label="Navigation de l'inscription">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-semibold text-ink hover:text-brand hover:underline"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="text-sm font-semibold text-brand hover:underline"
          >
            Suivant
          </button>
        </nav>

        <h1 className="font-display text-3xl font-bold text-ink mb-3">
          Confirmez votre e-mail
        </h1>
        <p className="break-words text-sm text-ink mb-8">
          Code à 6 chiffres envoyé à {" "}
          <strong>{email || "votre adresse e-mail"}</strong>
        </p>

        <div
          className="mx-auto mb-6 grid w-full max-w-[328px] grid-cols-6 gap-1.5 sm:gap-2"
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
              className={`h-12 w-full min-w-0 sm:h-14 rounded-xl border text-center text-xl font-bold text-ink outline-none transition-colors focus:ring-2 focus:ring-brand ${
                digit
                  ? "border-brand bg-[#eaf1e9]"
                  : "border-line-strong bg-surface"
              }`}
            />
          ))}
        </div>

        {erreur && <p role="alert" className="text-sm text-red-600 mt-4">{erreur}</p>}
        {renvoiOk && <p className="text-sm text-brand mt-4">Code renvoyé !</p>}

        <button
          type="button"
          onClick={handleVerify}
          disabled={!codeComplet || loading}
          className={`w-full py-4 rounded-xl font-semibold text-sm mt-6 transition-colors ${
            codeComplet && !loading
              ? "bg-brand text-white hover:bg-brand-700"
              : "bg-[#eee2d0] text-[#ad9d89] cursor-not-allowed"
          }`}
        >
          {loading ? "Vérification..." : "Confirmer"}
        </button>

        <p className="mt-5 text-sm text-ink">
          Pas reçu ? {" "}
          <button
            type="button"
            onClick={handleResend}
            className="font-semibold text-brand hover:underline"
          >
            Renvoyer le code
          </button>
        </p>
      </section>
    </main>
  );
}

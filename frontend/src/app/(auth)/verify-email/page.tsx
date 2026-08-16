"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const [renvoiOk, setRenvoiOk] = useState(false);
  const [email, setEmail] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const e = localStorage.getItem("mali_wuli_pending_email") || "";
    setEmail(e);
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length < 6) { setErreur("Entrez les 6 chiffres du code."); return; }
    setLoading(true);
    setErreur("");
    try {
      const userId = localStorage.getItem("mali_wuli_pending_userId");
      await api.post("/auth/verify-email", { userId, code: fullCode });
      router.push("/onboarding");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setErreur(error.response?.data?.message || "Code incorrect ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const userId = localStorage.getItem("mali_wuli_pending_userId");
      await api.post("/auth/resend-code", { userId });
      setRenvoiOk(true);
      setTimeout(() => setRenvoiOk(false), 5000);
    } catch {
      setErreur("Impossible de renvoyer le code.");
    }
  };

  return (
    <div className="min-h-screen bg-sable-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-sable-100 w-full max-w-md p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-vert-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-vert" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-bold text-terre mb-2">Vérifiez votre email</h1>
        <p className="text-sm text-terre-300 mb-8">
          Nous avons envoyé un code à 6 chiffres à{" "}
          <strong className="text-terre">{email || "votre adresse email"}</strong>.
          <br />Le code est valable 15 minutes.
        </p>

        {/* Inputs code */}
        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl transition-colors
                ${digit ? "border-vert text-vert" : "border-sable-200 text-terre"}
                focus:outline-none focus:border-vert`}
            />
          ))}
        </div>

        {erreur && (
          <p className="text-sm text-red-500 mb-4">{erreur}</p>
        )}
        {renvoiOk && (
          <p className="text-sm text-vert mb-4">Code renvoyé !</p>
        )}

        <button
          onClick={handleVerify}
          disabled={loading}
          className={`w-full py-4 rounded-xl text-white font-semibold text-sm mb-4 transition-colors
            ${loading ? "bg-sable-200 cursor-not-allowed" : "bg-vert hover:bg-vert-500"}`}
        >
          {loading ? "Vérification..." : "Vérifier mon adresse"}
        </button>

        <button
          onClick={handleResend}
          className="text-sm text-terre-300 hover:text-vert transition-colors"
        >
          Je n'ai pas reçu le code — Renvoyer
        </button>
      </div>
    </div>
  );
}

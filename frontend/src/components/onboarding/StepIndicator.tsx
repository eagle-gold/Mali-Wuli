"use client";

import { Check } from "lucide-react";

interface Step {
  number: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: Step[];
}

/** Progression du questionnaire : barre segmentée, libellés dès la tablette. */
export default function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  const courante = steps.find((step) => step.number === currentStep);
  const pourcentage = Math.round(((currentStep - 1) / steps.length) * 100);
  return (
    <nav aria-label="Progression du questionnaire">
      <div className="flex items-baseline justify-between gap-3 sm:hidden">
        <p className="text-sm font-semibold text-ink">{courante?.label}</p>
        <p className="text-xs font-semibold text-ink-muted">Étape {currentStep} sur {steps.length}</p>
      </div>
      <ol className="mt-3 flex gap-1.5 sm:mt-0 sm:gap-3">
        {steps.map((step) => {
          const termine = currentStep > step.number;
          const actuel = currentStep === step.number;
          return (
            <li key={step.number} aria-current={actuel ? "step" : undefined} className="min-w-0 flex-1">
              <span className={`block h-1 rounded-full transition-colors duration-500 ${termine || actuel ? "bg-brand" : "bg-line-soft"}`} aria-hidden="true" />
              <span className="mt-2.5 hidden items-center gap-2 sm:flex">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    termine ? "bg-brand text-white" : actuel ? "bg-ink text-white" : "border border-line-strong text-ink-muted"
                  }`}
                >
                  {termine ? <Check size={13} strokeWidth={3} /> : step.number}
                </span>
                <span className={`truncate text-sm font-semibold ${actuel ? "text-ink" : termine ? "text-brand" : "text-ink-muted"}`}>{step.label}</span>
              </span>
              <span className="sr-only">
                {step.label}{termine ? " : terminé" : actuel ? " : étape en cours" : " : à venir"}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">Étape {currentStep} sur {steps.length}, {courante?.label}. {pourcentage} % du questionnaire terminé.</p>
    </nav>
  );
}

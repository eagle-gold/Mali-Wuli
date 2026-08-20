"use client";

interface Step {
  number: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: Step[];
}

export default function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <nav aria-label="Progression du questionnaire">
      <ol className="grid grid-cols-4 gap-2 sm:gap-4">
        {steps.map((step) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const isActive = isCompleted || isCurrent;

          return (
            <li
              key={step.number}
              aria-current={isCurrent ? "step" : undefined}
              className="min-w-0"
            >
              <div
                className={`mb-3 h-1 w-full rounded-full transition-colors ${
                  isActive ? "bg-[#0d6738]" : "bg-[#e3d8c4]"
                }`}
              />

              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors sm:h-8 sm:w-8 sm:text-sm ${
                    isCurrent
                      ? "bg-[#2e261f] text-white"
                      : isCompleted
                        ? "bg-[#0d6738] text-white"
                        : "bg-[#e3d8c4] text-[#ad9d89]"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>

                <span
                  className={`hidden min-w-0 truncate text-[11px] font-semibold transition-colors min-[420px]:block sm:text-base lg:text-lg ${
                    isCurrent
                      ? "text-[#2e261f]"
                      : isCompleted
                        ? "text-[#0d6738]"
                        : "text-[#ad9d89]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

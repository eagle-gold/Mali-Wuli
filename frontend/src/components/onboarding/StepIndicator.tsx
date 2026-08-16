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
    <div className="flex items-center w-full mb-8">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;

        return (
          <div key={step.number} className="flex items-center flex-1">
            {/* Cercle + label */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                  ${isCompleted ? "bg-vert text-white" : ""}
                  ${isCurrent ? "bg-terre text-white" : ""}
                  ${!isCompleted && !isCurrent ? "bg-sable-200 text-terre-300" : ""}
                `}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap
                  ${isCompleted ? "text-vert" : ""}
                  ${isCurrent ? "text-terre font-bold" : ""}
                  ${!isCompleted && !isCurrent ? "text-terre-300" : ""}
                `}
              >
                {step.label}
              </span>
            </div>

            {/* Ligne de connexion */}
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${isCompleted ? "bg-vert" : "bg-sable-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

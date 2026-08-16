"use client";

import { useState } from "react";
import StepIndicator from "@/components/onboarding/StepIndicator";
import StepInformations, { type InfoData } from "@/components/onboarding/StepInformations";
import StepFormations, { type Formation } from "@/components/onboarding/StepFormations";
import StepExperiences, { type Experience } from "@/components/onboarding/StepExperiences";
import StepMentorat, { type MentoratData } from "@/components/onboarding/StepMentorat";


const STEPS = [
  { number: 1, label: "Informations" },
  { number: 2, label: "Formations" },
  { number: 3, label: "Expériences" },
  { number: 4, label: "Mentorat" },
];

type OnboardingData = {
  informations?: InfoData;
  formations?: Formation[];
  experiences?: Experience[];
  mentorat?: MentoratData;
};


export default function OnboardingPage() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0); // 0 = écran de bienvenue
  const [data, setData] = useState<OnboardingData>({});

  // Écran de bienvenue
  if (step === 0) {
    return (
      <div className="min-h-screen bg-sable-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-4">

          {/* Header terre */}
          <div className="bg-terre rounded-2xl p-8 text-white">
            <p className="text-xs font-semibold tracking-widest text-sable-200 uppercase mb-3">
              Bienvenue sur Mali Wuli
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-4">
              Un seul réseau pour les talents du Mali, ici et ailleurs.
            </h1>
            <p className="text-sable-200 text-sm leading-relaxed">
              Mali Wuli relie ceux qui cherchent et ceux qui proposent : mentorat, orientation,
              chantiers concrets, emplois et cercles de réflexion. Un seul espace, les mêmes droits
              pour tous : chacun y demande, y propose et y répond librement.
            </p>
          </div>

          {/* Étapes */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-sable-100">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-laterite text-white uppercase tracking-wide">
                Environ 5 minutes
              </span>
              <span className="text-sm text-terre-300">Quatre étapes courtes. Vous pouvez compléter le reste plus tard.</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { num: "ÉTAPE 1", titre: "Où vous vivez", desc: "Pays et ville : c'est ce qui relie le pays et la diaspora." },
                { num: "ÉTAPE 2", titre: "Vos formations", desc: "École, lycée, université, et votre avis noté sur chacune pour guider les plus jeunes." },
                { num: "ÉTAPE 3", titre: "Vos expériences", desc: "Postes et missions : ce qui permet aux autres de savoir quoi vous demander." },
                { num: "ÉTAPE 4", titre: "Le mentorat", desc: "Voulez-vous ouvrir des créneaux ? Vous choisissez lesquels, et vous restez libre." },
              ].map((s) => (
                <div key={s.num} className="bg-sable-50 rounded-xl p-3 border border-sable-100">
                  <p className="text-xs font-bold text-laterite mb-1">{s.num}</p>
                  <p className="text-sm font-semibold text-terre mb-1">{s.titre}</p>
                  <p className="text-xs text-terre-300 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-4 rounded-xl bg-vert text-white font-semibold text-sm hover:bg-vert-500 transition-colors"
            >
              Commencer le questionnaire
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Écran de fin
  if (step === 5 as unknown as number) {
    return (
      <div className="min-h-screen bg-sable-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-sable-100 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-vert-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-vert" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-terre mb-2">Bienvenue sur Mali Wuli !</h2>
          <p className="text-sm text-terre-300 mb-6">
            Votre profil est en cours de validation par l'équipe. Vous recevrez une notification dès que vous pourrez accéder à la communauté.
          </p>
          <div className="bg-sable-50 rounded-xl p-4 mb-6 text-sm text-terre-300">
            <p className="font-medium text-terre mb-1">Invitez vos proches</p>
            <p className="text-xs mb-3">Partagez votre lien d'invitation et agrandissez la communauté !</p>
            <div className="flex gap-2">
              <input
                readOnly
                value="https://maliwuli.com/invite/votre-code"
                className="flex-1 border border-sable-200 rounded-lg px-3 py-2 text-xs bg-white"
              />
              <button className="px-3 py-2 bg-vert text-white rounded-lg text-xs font-medium">
                Copier
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sable-50 px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">

        {/* Step indicator */}
        <StepIndicator currentStep={step} steps={STEPS} />

        {/* Étapes */}
        {step === 1 && (
          <StepInformations
            initialData={data.informations}
            onBack={() => setStep(0)}
            onNext={(d) => { setData((p) => ({ ...p, informations: d })); setStep(2); }}
          />
        )}
        {step === 2 && (
          <StepFormations
            initialData={data.formations}
            onBack={() => setStep(1)}
            onNext={(d) => { setData((p) => ({ ...p, formations: d })); setStep(3); }}
          />
        )}
        {step === 3 && (
          <StepExperiences
            initialData={data.experiences}
            onBack={() => setStep(2)}
            onNext={(d) => { setData((p) => ({ ...p, experiences: d })); setStep(4); }}
          />
        )}
        {step === 4 && (
          <StepMentorat
            onBack={() => setStep(3)}
            onNext={(d) => {
              setData((p) => ({ ...p, mentorat: d }));
              // TODO : envoyer les données à l'API
              console.log("Onboarding complet :", { ...data, mentorat: d });
              setStep(5 as unknown as 4);
            }}
          />
        )}
      </div>
    </div>
  );
}

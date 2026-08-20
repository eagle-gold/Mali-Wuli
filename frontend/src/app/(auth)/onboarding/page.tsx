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
      <main className="min-h-screen overflow-x-hidden bg-[#f6efe3] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-[1040px] space-y-6">

          {/* Header terre */}
          <section className="rounded-[22px] bg-[#735133] px-6 py-8 text-[#fffaf4] sm:px-10 sm:py-10 lg:px-12 lg:py-11">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#fffaf4] sm:text-base">
              Bienvenue sur Mali Wuli
            </p>
            <h1 className="mb-5 max-w-[850px] font-display text-3xl font-bold leading-[1.2] sm:text-4xl lg:text-[40px]">
              Un seul réseau pour les talents du Mali, ici et ailleurs.
            </h1>
            <p className="max-w-[900px] text-base leading-[1.7] text-[#fffaf4] sm:text-[17px] lg:text-lg">
              Mali Wuli relie ceux qui cherchent et ceux qui proposent : mentorat, orientation,
              chantiers concrets, emplois et cercles de réflexion.
            </p>
          </section>

          {/* Étapes */}
          <section className="rounded-[22px] border border-[#e4d2b3] bg-[#fffbf5] p-5 shadow-sm sm:p-8 lg:p-9">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="rounded-[9px] border border-[#edc9b7] bg-[#f8e4d7] px-3 py-2 text-sm font-bold uppercase tracking-[0.04em] text-[#2e261f] sm:text-base">
                Environ 5 minutes
              </span>
              <span className="text-sm text-[#2e261f] sm:text-base">
                Quatre étapes courtes. Vous pouvez compléter le reste plus tard.
              </span>
            </div>

            <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { num: "ÉTAPE 1", titre: "Vos informations", desc: "Nom, prénom et lieu de résidence : de quoi vous identifier dans l'annuaire." },
                { num: "ÉTAPE 2", titre: "Vos formations", desc: "École, lycée, université, et votre avis noté sur chacune pour guider les plus jeunes." },
                { num: "ÉTAPE 3", titre: "Vos expériences", desc: "Postes et missions : ce qui permet aux autres de savoir quoi vous demander." },
                { num: "ÉTAPE 4", titre: "Le mentorat", desc: "Voulez-vous ouvrir des créneaux ? Vous choisissez lesquels, et vous restez libre." },
              ].map((s) => (
                <article key={s.num} className="min-h-[200px] rounded-[18px] border border-[#ead8bd] bg-[#fffbf5] p-5 lg:min-h-[210px]">
                  <p className="mb-2 text-sm font-bold text-[#c65327] sm:text-base">{s.num}</p>
                  <h2 className="mb-2 font-sans text-lg font-bold text-[#2e261f]">{s.titre}</h2>
                  <p className="text-[15px] leading-[1.55] text-[#2e261f] lg:text-base">{s.desc}</p>
                </article>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full rounded-full bg-[#0d6738] px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-[#09572f] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 sm:text-lg"
            >
              Commencer le questionnaire
            </button>
          </section>
        </div>
      </main>
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
    <div className="min-h-screen overflow-x-hidden bg-[#f6efe3]">
      <div className="border-b border-[#ead8bd] bg-[#fffbf5] px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-[1320px]">
          <StepIndicator currentStep={step} steps={STEPS} />
        </div>
      </div>

      <main className="mx-auto w-full min-w-0 max-w-[1320px] overflow-x-hidden px-4 py-8 sm:px-6 sm:py-12">

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
      </main>
    </div>
  );
}

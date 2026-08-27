"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function EcranConfirmation({ data, onBack }: { data: OnboardingData; onBack: () => void }) {
  const router = useRouter();
  const [lienInvitation, setLienInvitation] = useState("https://maliwuli.com/invite/votre-code");
  const [lienCopie, setLienCopie] = useState(false);

  useEffect(() => {
    const codeExistant = localStorage.getItem("mali_wuli_invitation_code")?.trim();
    const codeInvitation = codeExistant || `mw-${crypto.randomUUID().slice(0, 8)}`;
    if (!codeExistant) localStorage.setItem("mali_wuli_invitation_code", codeInvitation);
    setLienInvitation(`https://maliwuli.com/invite/${codeInvitation}`);
  }, []);

  const formationsNotees = useMemo(() => (data.formations || []).filter((formation) => [
    formation.noteEnseignants,
    formation.noteContenu,
    formation.noteCadre,
    formation.noteInsertion,
  ].some((note) => typeof note === "number" && note > 0)).length, [data.formations]);

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(lienInvitation);
      setLienCopie(true);
      window.setTimeout(() => setLienCopie(false), 2_000);
    } catch {
      setLienCopie(false);
    }
  };

  const residence = data.informations?.ville?.trim()
    || data.informations?.pays?.trim()
    || "Non renseignée";

  return (
    <main className="min-h-screen bg-[#f6efe3] px-4 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-[984px] rounded-[20px] border border-[#e4d2b3] bg-[#fffbf5] px-5 py-8 shadow-sm sm:px-10 sm:py-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e3f0e9] text-[#0d6738] sm:h-[68px] sm:w-[68px]">
          <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4 4L19 6.5" />
          </svg>
        </div>

        <h1 className="text-center font-display text-4xl font-bold leading-tight text-[#735133] sm:text-5xl">
          Bienvenue sur Mali Wuli !
        </h1>
        <p className="mx-auto mt-4 max-w-[730px] text-center text-base font-semibold leading-relaxed text-[#17120f] sm:text-lg">
          Votre profil est en cours de validation par l’équipe. Vous recevrez un e-mail dès que vous pourrez accéder à la communauté.
        </p>

        <div className="mt-8 rounded-[16px] bg-[#f6efe3] px-4 py-6 sm:px-7">
          <h2 className="text-center text-2xl font-bold text-[#2e261f]">Invitez vos proches</h2>
          <p className="mt-1 text-center text-base text-[#a44d28] sm:text-lg">
            Partagez votre lien d’invitation et agrandissez la communauté !
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Lien d’invitation"
              readOnly
              value={lienInvitation}
              className="min-w-0 flex-1 rounded-[11px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none sm:text-base"
            />
            <button
              type="button"
              onClick={copierLien}
              className="rounded-[11px] bg-[#0d6738] px-6 py-3 font-semibold text-white transition hover:bg-[#09572f] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2"
            >
              {lienCopie ? "Copié !" : "Copier"}
            </button>
          </div>
          <p aria-live="polite" className="sr-only">{lienCopie ? "Lien d’invitation copié." : ""}</p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { valeur: String(formationsNotees), libelle: "formation(s) notée(s)", couleur: "text-[#0d6738]" },
            { valeur: String(data.experiences?.length || 0), libelle: "expérience(s)", couleur: "text-[#0d6738]" },
            { valeur: residence, libelle: "résidence", couleur: "text-[#17120f]" },
            { valeur: data.mentorat?.estVolontaire ? "Oui" : "Non", libelle: "mentorat", couleur: "text-[#0d6738]" },
          ].map((item) => (
            <article key={item.libelle} className="min-w-0 rounded-[15px] border border-[#ead8bd] bg-[#fffbf5] px-5 py-5">
              <p className={`break-words text-2xl font-bold ${item.couleur}`}>{item.valeur}</p>
              <p className="mt-1 text-base leading-snug text-[#2e261f]">{item.libelle}</p>
            </article>
          ))}
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mt-7 w-full rounded-[11px] bg-[#0d6738] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#09572f] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 sm:text-lg"
        >
          Découvrir votre profil en attendant
        </button>
        <button
          type="button"
          onClick={onBack}
          className="mx-auto mt-4 block px-4 py-1 text-base font-semibold text-[#2e261f] hover:text-[#0d6738]"
        >
          ‹ Revenir au mentorat
        </button>
      </section>
    </main>
  );
}


export default function OnboardingPage() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0); // 0 = écran de bienvenue
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
  if (step === 5) {
    return <EcranConfirmation data={data} onBack={() => setStep(4)} />;
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
            initialData={data.mentorat}
            onBack={() => setStep(3)}
            onNext={(d) => {
              setData((p) => ({ ...p, mentorat: d }));
              // TODO : envoyer les données à l'API
              console.log("Onboarding complet :", { ...data, mentorat: d });
              setStep(5);
            }}
          />
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ArrowRight, BriefcaseBusiness, Check, Copy, GraduationCap, Landmark, Sprout, UserRound } from "lucide-react";
import { classesBouton } from "@/components/ui/classes";
import StepIndicator from "@/components/onboarding/StepIndicator";
import StepAssociations from "@/components/onboarding/StepAssociations";
import StepInformations, { type InfoData } from "@/components/onboarding/StepInformations";
import StepFormations, { type Formation } from "@/components/onboarding/StepFormations";
import StepExperiences, { type Experience } from "@/components/onboarding/StepExperiences";
import StepMentorat, { type MentoratData } from "@/components/onboarding/StepMentorat";
import { avisEtablissementScolaireEstDisponible } from "@/lib/education/suivi";
import api from "@/lib/api";


const STEPS = [
  { number: 1, label: "Informations" },
  { number: 2, label: "Formations" },
  { number: 3, label: "Expériences" },
  { number: 4, label: "Mentorat" },
  { number: 5, label: "Associations" },
];

const ETAPES_BIENVENUE = [
  { titre: "Vos informations", description: "Votre nom, votre ville et, si vous le souhaitez, vos réseaux.", Icone: UserRound, facultatif: false },
  { titre: "Vos formations", description: "École, lycée, université, et votre avis pour guider les plus jeunes.", Icone: GraduationCap, facultatif: false },
  { titre: "Vos expériences", description: "Postes et missions : ce sur quoi les membres peuvent vous solliciter.", Icone: BriefcaseBusiness, facultatif: false },
  { titre: "Le mentorat", description: "Ouvrez quelques créneaux si vous le souhaitez. Vous restez libre.", Icone: Sprout, facultatif: false },
  { titre: "Vos associations", description: "Rattachez votre profil aux associations dont vous êtes membre.", Icone: Landmark, facultatif: true },
] as const;

type OnboardingData = {
  informations?: InfoData;
  formations?: Formation[];
  experiences?: Experience[];
  mentorat?: MentoratData;
};

const PROFILE_STORAGE_KEY = "mali_wuli_onboarding_profile";

const sauvegarderProfilLocal = (profil: OnboardingData) => {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profil));
  } catch {
    // Le parcours reste utilisable lorsque le stockage du navigateur est bloqué.
  }
};

function EcranConfirmation({ data, onBack }: { data: OnboardingData; onBack: () => void }) {
  const router = useRouter();
  const [lienInvitation, setLienInvitation] = useState("");
  const [lienCopie, setLienCopie] = useState(false);

  useEffect(() => {
    let actif = true;
    const chargerLien = async () => {
      try {
        const { data: compte } = await api.get<{ id: string }>("/users/me");
        if (actif) {
          const origine = window.location.origin;
          setLienInvitation(`${origine}/register?parrain=${encodeURIComponent(compte.id)}`);
        }
      } catch {
        if (actif) setLienInvitation(`${window.location.origin}/register`);
      }
    };
    void chargerLien();
    return () => { actif = false; };
  }, []);

  const formationsNotees = useMemo(() => (data.formations || []).filter((formation) => {
    const estEtablissementScolaire = formation.type === "ecole" || formation.type === "lycee";
    if (estEtablissementScolaire && !avisEtablissementScolaireEstDisponible(
      formation.statutDiplome,
      formation.moisFin,
      formation.anneeFin,
      formation.anneePromo,
    )) return false;

    return [
      formation.noteEnseignants,
      formation.noteContenu,
      formation.noteCadre,
    ].some((note) => typeof note === "number" && note > 0);
  }).length, [data.formations]);

  const copierLien = async () => {
    if (!lienInvitation) return;
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
  const prenom = data.informations?.prenom?.trim();

  return (
    <main className="px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
      <section aria-labelledby="titre-fin" className="mx-auto w-full max-w-[640px] animate-apparition text-center">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-brand/15 motion-safe:animate-ping [animation-iteration-count:2]" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white shadow-raised">
            <Check size={38} strokeWidth={2.8} aria-hidden="true" />
          </span>
        </div>
        <h1 id="titre-fin" className="mt-7 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
          {prenom ? `Votre profil est prêt, ${prenom} !` : "Votre profil est prêt !"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-ink-muted">
          Vous avez dès maintenant accès à toute la communauté Mali Wuli.
        </p>

        <dl className="mt-10 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
          {[
            { valeur: String(data.formations?.length || 0), libelle: "Formations", detail: formationsNotees ? `${formationsNotees} notée${formationsNotees > 1 ? "s" : ""}` : undefined },
            { valeur: String(data.experiences?.length || 0), libelle: "Expériences" },
            { valeur: residence, libelle: "Résidence" },
            { valeur: data.mentorat?.estVolontaire ? "Oui" : "Non", libelle: "Mentor" },
          ].map((item) => (
            <div key={item.libelle} className="min-w-0 rounded-2xl border border-line-soft bg-surface px-4 py-4 shadow-card">
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">{item.libelle}</dt>
              <dd className="mt-1.5 truncate text-2xl font-bold tabular-nums tracking-tight text-ink" title={item.valeur}>{item.valeur}</dd>
              {item.detail && <dd className="text-xs text-ink-muted">{item.detail}</dd>}
            </div>
          ))}
        </dl>

        <div className="mt-8 rounded-2xl border border-line-soft bg-surface p-5 text-left shadow-card sm:p-6">
          <h2 className="font-display text-xl font-bold text-ink">Invitez vos proches</h2>
          <p className="mt-1 text-[15px] text-ink-muted">Chaque nouveau membre fait grandir l’arbre. Partagez votre lien d’invitation.</p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <input
              aria-label="Lien d’invitation"
              readOnly
              value={lienInvitation}
              placeholder="Préparation de votre lien…"
              onFocus={(event) => event.target.select()}
              className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-sunken px-4 text-sm text-ink-soft outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
            <button type="button" onClick={copierLien} disabled={!lienInvitation} className={classesBouton({ variante: lienCopie ? "secondaire" : "primaire", className: "h-12" })}>
              {lienCopie ? <><Check size={16} aria-hidden="true" />Copié</> : <><Copy size={16} aria-hidden="true" />Copier le lien</>}
            </button>
          </div>
          <p aria-live="polite" className="sr-only">{lienCopie ? "Lien d’invitation copié." : ""}</p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              sauvegarderProfilLocal(data);
              router.replace("/profil");
            }}
            className={classesBouton({ taille: "lg", className: "group" })}
          >
            Découvrir mon profil<ArrowRight size={18} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
          </button>
          <button type="button" onClick={() => router.replace("/dashboard")} className={classesBouton({ variante: "secondaire", taille: "lg" })}>
            Aller au fil d’actualité
          </button>
        </div>
        <button type="button" onClick={onBack} className="mt-6 rounded text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-anneau">
          Revenir aux associations
        </button>
      </section>
    </main>
  );
}


export default function OnboardingPage() {
  const router = useRouter();
  const [editionAssociations, setEditionAssociations] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0); // 0 = écran de bienvenue
  const [data, setData] = useState<OnboardingData>({});
  const [chargementInitial, setChargementInitial] = useState(true);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState("");

  useEffect(() => {
    let actif = true;
    let profilLocal: OnboardingData = {};
    try {
      const profilExistant = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (profilExistant) {
        profilLocal = JSON.parse(profilExistant) as OnboardingData;
        setData(profilLocal);
      }
    } catch {
      // Une ancienne valeur illisible ne doit jamais bloquer l'inscription.
    }

    const etapes: Record<string, 1 | 2 | 3 | 4 | 5> = {
      informations: 1,
      formations: 2,
      experiences: 3,
      mentorat: 4,
      associations: 5,
    };
    const etapeDemandee = new URLSearchParams(window.location.search).get("etape");
    setEditionAssociations(etapeDemandee === "associations");
    if (etapeDemandee && etapes[etapeDemandee]) setStep(etapes[etapeDemandee]);

    const chargerProfil = async () => {
      try {
        const reponse = await api.get<OnboardingData>("/onboarding");
        if (!actif) return;
        setData(reponse.data);
        sauvegarderProfilLocal(reponse.data);
      } catch {
        // Le cache local permet de continuer temporairement hors connexion. La
        // prochaine sauvegarde complète resynchronisera les données en base.
        if (actif) setData(profilLocal);
      } finally {
        if (actif) setChargementInitial(false);
      }
    };
    void chargerProfil();
    return () => {
      actif = false;
    };
  }, []);

  const enregistrerEtContinuer = <Cle extends keyof OnboardingData,>(
    cle: Cle,
    valeur: NonNullable<OnboardingData[Cle]>,
    prochaineEtape: 2 | 3 | 4 | 5,
  ) => {
    setData((precedent) => {
      const profil = { ...precedent, [cle]: valeur };
      sauvegarderProfilLocal(profil);
      return profil;
    });
    setStep(prochaineEtape);
  };

  const terminerOnboarding = async () => {
    if (enregistrementEnCours) return;
    const profilComplet: OnboardingData = { ...data };
    setData(profilComplet);
    sauvegarderProfilLocal(profilComplet);
    setErreurEnregistrement("");

    if (!profilComplet.informations || !profilComplet.formations || !profilComplet.experiences || !profilComplet.mentorat) {
      setErreurEnregistrement("Une étape précédente est incomplète. Revenez la vérifier avant de terminer.");
      return;
    }

    setEnregistrementEnCours(true);
    try {
      await api.post("/onboarding", profilComplet);
      setStep(6);
    } catch (erreur) {
      const message = axios.isAxiosError<{ message?: string }>(erreur)
        ? erreur.response?.data?.message
        : undefined;
      setErreurEnregistrement(message || "Nous n'avons pas pu enregistrer votre profil. Vérifiez votre connexion puis réessayez.");
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  if (chargementInitial) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <p role="status" aria-live="polite" className="flex items-center gap-3 text-sm font-medium text-ink-muted">
          <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
          Chargement de votre profil…
        </p>
      </main>
    );
  }

  // Écran de bienvenue
  if (step === 0) {
    const prenom = data.informations?.prenom?.trim();
    return (
      <main className="px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
        <section aria-labelledby="titre-bienvenue" className="mx-auto w-full max-w-[640px] animate-apparition">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1 text-xs font-semibold text-ink-soft shadow-card">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
            Environ 5 minutes
          </p>
          <h1 id="titre-bienvenue" className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            {prenom ? <>Bienvenue, {prenom}.<br /></> : <>Bienvenue.<br /></>}
            <span className="text-brand">Construisons votre profil.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Un profil complet permet aux membres de vous trouver, de savoir comment vous aider et comment vous pouvez les aider.
          </p>

          <ol className="mt-9 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
            {ETAPES_BIENVENUE.map(({ titre, description, Icone, facultatif }, index) => (
              <li key={titre} className="flex items-start gap-4 px-5 py-4 sm:px-6">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
                  <Icone size={20} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                    <span><span className="sr-only">Étape {index + 1} : </span>{titre}</span>
                    {facultatif && <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Facultatif</span>}
                  </h2>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{description}</p>
                </div>
              </li>
            ))}
          </ol>

          <button type="button" onClick={() => setStep(1)} className={classesBouton({ taille: "lg", pleineLargeur: true, className: "group mt-8" })}>
            Commencer<ArrowRight size={18} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
          </button>
          <p className="mt-4 text-center text-sm text-ink-muted">Vous pourrez tout modifier plus tard depuis votre profil.</p>
        </section>
      </main>
    );
  }

  // Écran de fin
  if (step === 6) {
    return <EcranConfirmation data={data} onBack={() => setStep(5)} />;
  }

  return (
    <div className="pb-16">
      <div className="mx-auto w-full max-w-[920px] px-4 pt-6 sm:px-6 sm:pt-10">
        <StepIndicator currentStep={step} steps={STEPS} />
      </div>

      <main className="mx-auto w-full min-w-0 max-w-[920px] px-4 pt-6 sm:px-6 sm:pt-8">

        {(enregistrementEnCours || erreurEnregistrement) && (
          <div
            role={erreurEnregistrement ? "alert" : "status"}
            className={`mb-5 rounded-xl border px-4 py-3 text-sm font-medium ${
              erreurEnregistrement
                ? "border-danger/25 bg-danger/[0.06] text-danger"
                : "border-brand/25 bg-brand-50 text-brand-800"
            }`}
          >
            {erreurEnregistrement || "Enregistrement sécurisé de votre profil…"}
          </div>
        )}

        {/* Étapes */}
        {step === 1 && (
          <StepInformations
            initialData={data.informations}
            onBack={() => setStep(0)}
            onNext={(d) => enregistrerEtContinuer("informations", d, 2)}
          />
        )}
        {step === 2 && (
          <StepFormations
            initialData={data.formations}
            onBack={() => setStep(1)}
            onNext={(d) => enregistrerEtContinuer("formations", d, 3)}
          />
        )}
        {step === 3 && (
          <StepExperiences
            initialData={data.experiences}
            onBack={() => setStep(2)}
            onNext={(d) => enregistrerEtContinuer("experiences", d, 4)}
          />
        )}
        {step === 4 && (
          <StepMentorat
            initialData={data.mentorat}
            onBack={() => setStep(3)}
            libelleSuivant="Continuer vers les associations"
            onNext={(d) => enregistrerEtContinuer("mentorat", d, 5)}
          />
        )}
        {step === 5 && (
          <StepAssociations onBack={() => setStep(4)} onNext={() => editionAssociations ? router.push("/profil") : void terminerOnboarding()} enregistrementEnCours={enregistrementEnCours} edition={editionAssociations} />
        )}
      </main>
    </div>
  );
}

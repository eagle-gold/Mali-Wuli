"use client";

import { useEffect, useState } from "react";

type PlageMentorat = {
  debut: string;
  fin: string;
};

export type DisponibiliteMentorat = {
  jour: string;
  ouvert: boolean;
  plages: PlageMentorat[];
};

export interface MentoratData {
  estVolontaire: boolean;
  sujets: string[];
  precisionsSujets: Record<string, string>;
  duree: number | null;
  format: string | null;
  fuseauHoraire: string;
  dateDebut: string;
  dateFin: string | null;
  disponibilites: DisponibiliteMentorat[];
  maxRdvMois: number | null;
}

interface StepMentoratProps {
  onNext: (data: MentoratData) => void;
  onBack: () => void;
  initialData?: MentoratData;
}

const SUJETS = [
  { nom: "Orientation post-bac", exemple: "Ex. : filières scientifiques, séries du bac malien" },
  { nom: "Choix d’études à l’étranger", exemple: "Ex. : France, Canada, Maroc" },
  { nom: "Bourses & dossiers", exemple: "Ex. : Campus France, lettres de motivation, bourses Erasmus" },
  { nom: "Préparation aux concours", exemple: "Ex. : ENA, médecine, écoles d’ingénieurs" },
  { nom: "Préparation d’entretien", exemple: "Ex. : simulation RH, entretien technique, prise de parole" },
  { nom: "Relecture de CV / portfolio", exemple: "Ex. : CV junior, profil LinkedIn, portfolio design" },
  { nom: "Premier emploi", exemple: "Ex. : candidatures, recherche d’offres, premiers mois en poste" },
  { nom: "Reconversion", exemple: "Ex. : passer de la finance au numérique" },
  { nom: "Création d’entreprise", exemple: "Ex. : idée, business plan, financement au Mali" },
  { nom: "Mentorat métier", exemple: "Ex. : sage-femme, développeur, chef de projet" },
  { nom: "Autre expertise", exemple: "Ex. : droit minier, agriculture, marchés publics" },
] as const;

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DUREES = [20, 30, 45];
const FORMATS = ["Visio", "Téléphone", "Sur place"];
const MAX_RDV = [1, 2, 4, null] as const;
const FUSEAUX = [
  { value: "Africa/Bamako", label: "Bamako / Abidjan / Dakar (GMT)" },
  { value: "Europe/Paris", label: "Paris / Bruxelles (GMT+1 / GMT+2)" },
  { value: "Africa/Casablanca", label: "Casablanca (GMT+1)" },
  { value: "Africa/Algiers", label: "Alger (GMT+1)" },
  { value: "Europe/London", label: "Londres (GMT / GMT+1)" },
  { value: "America/Toronto", label: "Montréal / Toronto (GMT-5 / GMT-4)" },
  { value: "America/New_York", label: "New York / Washington (GMT-5 / GMT-4)" },
];

const HEURES = Array.from({ length: 36 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const heures = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { value, label: `${heures} h ${String(minutes).padStart(2, "0")}` };
});

const minutesDepuisMinuit = (heure: string) => {
  const [heures, minutes] = heure.split(":").map(Number);
  return heures * 60 + minutes;
};

const heureDepuisMinutes = (total: number) => {
  const borne = Math.min(Math.max(total, 6 * 60), 23 * 60 + 30);
  return `${String(Math.floor(borne / 60)).padStart(2, "0")}:${String(borne % 60).padStart(2, "0")}`;
};

const disponibilitesInitiales = (): DisponibiliteMentorat[] =>
  JOURS.map((jour, index) => ({
    jour,
    ouvert: index === 0,
    plages: index === 0 ? [{ debut: "09:00", fin: "12:00" }] : [],
  }));

const nombreCreneaux = (plages: PlageMentorat[], duree: number) =>
  plages.reduce((total, plage) => {
    const amplitude = minutesDepuisMinuit(plage.fin) - minutesDepuisMinuit(plage.debut);
    return total + Math.max(0, Math.floor(amplitude / duree));
  }, 0);

const BOUTON_CHOIX =
  "rounded-[16px] border px-5 py-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2";
const PETIT_BOUTON =
  "rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm font-semibold text-[#2e261f] transition hover:border-[#0d6738] hover:text-[#0d6738]";

interface EnteteEtapeMentoratProps {
  numero: number;
  titre: string;
  instruction: string;
  terminee: boolean;
  active: boolean;
  infoOuverte: boolean;
  onOpenInfo: () => void;
}

function EnteteEtapeMentorat({ numero, titre, instruction, terminee, active, infoOuverte, onOpenInfo }: EnteteEtapeMentoratProps) {
  return (
    <div className="mb-4 flex items-center gap-3" aria-current={active ? "step" : undefined}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          terminee
            ? "bg-[#0d6738] text-white"
            : active
              ? "bg-[#2e261f] text-white"
              : "bg-[#eee2d0] text-[#2e261f]"
        }`}
      >
        {numero}
      </span>
      <h2 className="font-sans text-lg font-bold text-[#2e261f]">{titre}</h2>
      <button
        type="button"
        aria-label={`Afficher l’aide de l’étape ${numero} : ${instruction}`}
        aria-expanded={infoOuverte}
        onClick={onOpenInfo}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#8e806f] bg-transparent text-[9px] font-bold leading-none text-[#2e261f] transition hover:border-[#0d6738] hover:text-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]/30"
      >
        i
      </button>
    </div>
  );
}

export default function StepMentorat({ onNext, onBack, initialData }: StepMentoratProps) {
  const [estVolontaire, setEstVolontaire] = useState<boolean | null>(initialData?.estVolontaire ?? null);
  const [sujets, setSujets] = useState<string[]>(initialData?.sujets || []);
  const [precisionsSujets, setPrecisionsSujets] = useState<Record<string, string>>(initialData?.precisionsSujets || {});
  const [messageSujet, setMessageSujet] = useState("");
  const [messageDuree, setMessageDuree] = useState("");
  const [etapeInfoOuverte, setEtapeInfoOuverte] = useState<number | null>(null);
  const [duree, setDuree] = useState<number | null>(initialData?.duree ?? null);
  const [format, setFormat] = useState<string | null>(initialData?.format ?? null);
  const [fuseauHoraire, setFuseauHoraire] = useState(initialData?.fuseauHoraire || "Africa/Bamako");
  const [dateDebut, setDateDebut] = useState(initialData?.dateDebut || "");
  const [dateFin, setDateFin] = useState(initialData?.dateFin || "");
  const [sansDateFin, setSansDateFin] = useState(initialData ? initialData.dateFin === null : true);
  const [disponibilites, setDisponibilites] = useState<DisponibiliteMentorat[]>(
    initialData?.disponibilites?.length ? initialData.disponibilites : disponibilitesInitiales,
  );
  const [maxRdvMois, setMaxRdvMois] = useState<number | null>(initialData?.maxRdvMois ?? null);

  const fuseauLibelle = FUSEAUX.find(({ value }) => value === fuseauHoraire)?.label || fuseauHoraire;
  const joursOuverts = disponibilites.filter(({ ouvert, plages }) => ouvert && plages.length > 0);
  const totalCreneaux = duree === null ? 0 : joursOuverts.reduce(
    (total, jour) => total + nombreCreneaux(jour.plages, duree),
    0,
  );
  const toutesLesPlagesSontValides = duree !== null && joursOuverts.every((jour) =>
    jour.plages.every((plage) => nombreCreneaux([plage], duree) > 0),
  );
  const precisionsCompletes = sujets.every((sujet) => precisionsSujets[sujet]?.trim());
  const canContinue = estVolontaire === false || (
    estVolontaire === true && sujets.length > 0 && precisionsCompletes && duree !== null && format !== null && totalCreneaux > 0 &&
    toutesLesPlagesSontValides
  );
  const etapesConfiguration = [
    {
      numero: 1,
      id: "mentorat-reponse",
      libelle: "Votre réponse",
      instruction: "Choisissez « Oui, je veux mentorer » ou « Pas pour l’instant ».",
      actionCourte: "choisir une réponse",
      terminee: estVolontaire !== null,
    },
    {
      numero: 2,
      id: "mentorat-sujets",
      libelle: "Vos sujets",
      instruction: "Choisissez au moins un sujet sur lequel vous pouvez aider.",
      actionCourte: "choisir un sujet",
      terminee: estVolontaire === true && sujets.length > 0,
    },
    {
      numero: 3,
      id: "mentorat-precisions",
      libelle: "Vos précisions",
      instruction: "Ajoutez une précision concrète pour chaque sujet sélectionné.",
      actionCourte: "préciser vos sujets",
      terminee: estVolontaire === true && sujets.length > 0 && Boolean(precisionsCompletes),
    },
    {
      numero: 4,
      id: "mentorat-duree",
      libelle: "La durée",
      instruction: "Choisissez la durée d’un rendez-vous de mentorat.",
      actionCourte: "choisir une durée",
      terminee: estVolontaire === true && duree !== null,
    },
    {
      numero: 5,
      id: "mentorat-format",
      libelle: "Le format",
      instruction: "Choisissez comment se dérouleront vos rendez-vous : en visio, par téléphone ou sur place.",
      actionCourte: "choisir un format",
      terminee: estVolontaire === true && format !== null,
    },
    {
      numero: 6,
      id: "mentorat-disponibilites",
      libelle: "Vos créneaux",
      instruction: "Vérifiez qu’au moins un créneau est ouvert et suffisamment long.",
      actionCourte: "vérifier vos créneaux",
      terminee: estVolontaire === true && totalCreneaux > 0 && toutesLesPlagesSontValides,
    },
  ];
  const prochaineEtape = estVolontaire === false
    ? undefined
    : etapesConfiguration.find(({ terminee }) => !terminee);
  const etapeInfoAffichee = etapeInfoOuverte === null
    ? undefined
    : etapesConfiguration.find(({ numero }) => numero === etapeInfoOuverte);

  useEffect(() => {
    if (etapeInfoOuverte === null) return;
    const fermerAvecEchap = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEtapeInfoOuverte(null);
    };
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.body.style.overflow = overflowPrecedent;
      window.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [etapeInfoOuverte]);

  const faireDefilerVers = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const toggleSujet = (sujet: string) => {
    setMessageSujet("");
    setMessageDuree("");
    setSujets((precedents) => {
      if (precedents.includes(sujet)) {
        setPrecisionsSujets((precisions) => {
          const prochaines = { ...precisions };
          delete prochaines[sujet];
          return prochaines;
        });
        return precedents.filter((item) => item !== sujet);
      }
      if (precedents.length >= 3) {
        setMessageSujet("Choisissez au maximum trois sujets pour que votre profil reste clair.");
        return precedents;
      }
      return [...precedents, sujet];
    });
  };

  const choisirDuree = (valeur: number) => {
    if (sujets.length === 0) {
      setMessageDuree("Choisissez d’abord au moins un sujet de mentorat, puis sélectionnez la durée du rendez-vous.");
      return;
    }
    setMessageDuree("");
    setDuree((precedente) => precedente === valeur ? null : valeur);
  };

  const choisirFormat = (valeur: string) => {
    setFormat((precedent) => precedent === valeur ? null : valeur);
  };

  const toggleJour = (jour: string) => {
    setDisponibilites((precedentes) => precedentes.map((item) => {
      if (item.jour !== jour) return item;
      const ouvert = !item.ouvert;
      return {
        ...item,
        ouvert,
        plages: ouvert && item.plages.length === 0 ? [{ debut: "09:00", fin: "10:00" }] : item.plages,
      };
    }));
  };

  const mettreAJourPlage = (jour: string, index: number, champ: keyof PlageMentorat, valeur: string) => {
    setDisponibilites((precedentes) => precedentes.map((item) => item.jour === jour
      ? { ...item, plages: item.plages.map((plage, plageIndex) => plageIndex === index ? { ...plage, [champ]: valeur } : plage) }
      : item));
  };

  const retirerPlage = (jour: string, index: number) => {
    setDisponibilites((precedentes) => precedentes.map((item) => {
      if (item.jour !== jour) return item;
      const plages = item.plages.filter((_, plageIndex) => plageIndex !== index);
      return { ...item, plages, ouvert: plages.length > 0 };
    }));
  };

  const ajouterPlage = (jour: string) => {
    setDisponibilites((precedentes) => precedentes.map((item) => {
      if (item.jour !== jour || item.plages.length >= 3) return item;
      const derniereFin = item.plages.at(-1)?.fin || "14:00";
      const debutMinutes = Math.min(minutesDepuisMinuit(derniereFin), 22 * 60);
      const nouvellePlage = {
        debut: heureDepuisMinutes(debutMinutes),
        fin: heureDepuisMinutes(debutMinutes + 60),
      };
      return { ...item, plages: [...item.plages, nouvellePlage] };
    }));
  };

  const appliquerATousLesJoursOuverts = (jourSource: string) => {
    const plagesSource = disponibilites.find(({ jour }) => jour === jourSource)?.plages || [];
    setDisponibilites((precedentes) => precedentes.map((item) => item.ouvert
      ? { ...item, plages: plagesSource.map((plage) => ({ ...plage })) }
      : item));
  };

  const recap = duree !== null && format !== null
    ? `Rendez-vous de ${duree} min en ${format.toLowerCase()}, ${joursOuverts.length} jour(s) ouvert(s) et ${totalCreneaux} créneau(x) par semaine, ${maxRdvMois === null ? "sans plafond mensuel" : `maximum ${maxRdvMois} par mois`}, heures de ${fuseauLibelle}${dateDebut ? `, à partir du ${new Date(`${dateDebut}T12:00:00`).toLocaleDateString("fr-FR")}` : ", disponible dès maintenant"}${sansDateFin || !dateFin ? ", sans date de fin" : `, jusqu’au ${new Date(`${dateFin}T12:00:00`).toLocaleDateString("fr-FR")}`}. Modifiable à tout moment depuis votre profil.`
    : "";

  const terminer = () => {
    if (!canContinue || estVolontaire === null) return;
    const precisionsRetenues = Object.fromEntries(
      sujets.map((sujet) => [sujet, precisionsSujets[sujet]?.trim() || ""]),
    );
    onNext({
      estVolontaire,
      sujets: estVolontaire ? sujets : [],
      precisionsSujets: estVolontaire ? precisionsRetenues : {},
      duree,
      format,
      fuseauHoraire,
      dateDebut: estVolontaire ? dateDebut : "",
      dateFin: estVolontaire && !sansDateFin && dateFin ? dateFin : null,
      disponibilites: estVolontaire ? disponibilites : [],
      maxRdvMois,
    });
  };

  const continuerOuTerminer = () => {
    if (canContinue) {
      terminer();
      return;
    }
    if (prochaineEtape) faireDefilerVers(prochaineEtape.id);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] bg-[#735133] px-6 py-8 text-[#fffaf4] sm:px-10 sm:py-10">
        <h1 className="mb-4 max-w-[900px] font-display text-3xl font-bold leading-tight sm:text-4xl">
          Souhaitez-vous être volontaire pour le mentorat ?
        </h1>
        <p className="max-w-[930px] text-base leading-[1.7] sm:text-lg">
          Un lycéen de Sikasso qui hésite entre deux concours, une sage-femme de Kayes qui cherche une formation,
          un jeune diplômé qui prépare un entretien : ils ouvrent votre profil et réservent un créneau, comme on
          prend rendez-vous. Vous restez maître de votre agenda et pouvez tout fermer en un clic.
        </p>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            ["Vous choisissez la durée", "20, 30 ou 45 minutes. Jamais plus si vous ne le voulez pas."],
            ["Aucune obligation", "Vous fixez un plafond mensuel, le calendrier s’arrête tout seul."],
            ["Gratuit, toujours", "Le mentorat ne se monnaie pas sur Mali Wuli. C’est la charte."],
          ].map(([titre, texte]) => (
            <article key={titre} className="rounded-[16px] bg-white/10 px-5 py-5">
              <h2 className="mb-2 font-sans text-base font-bold">{titre}</h2>
              <p className="text-sm leading-relaxed text-[#fffaf4]">{texte}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#ead8bd] bg-[#fffbf5] p-5 shadow-sm sm:p-8">
        <div id="mentorat-reponse" className="scroll-mt-8">
          <EnteteEtapeMentorat
            numero={1}
            titre="Choisissez votre réponse"
            instruction={etapesConfiguration[0].instruction}
            terminee={etapesConfiguration[0].terminee}
            active={prochaineEtape?.numero === 1}
            infoOuverte={etapeInfoOuverte === 1}
            onOpenInfo={() => setEtapeInfoOuverte(1)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={estVolontaire === true}
              onClick={() => setEstVolontaire(true)}
              className={`${BOUTON_CHOIX} ${estVolontaire === true ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#ead8bd] bg-[#fffbf5] hover:border-[#0d6738]"}`}
            >
              <span className={`mb-1 block text-base font-bold ${estVolontaire === true ? "text-white" : "text-[#2e261f]"}`}>
                Oui, je veux mentorer
              </span>
              <span className={`block text-sm ${estVolontaire === true ? "text-white" : "text-[#2e261f]"}`}>J’ouvre des créneaux et je réponds aux demandes.</span>
            </button>
            <button
              type="button"
              aria-pressed={estVolontaire === false}
              onClick={() => setEstVolontaire(false)}
              className={`${BOUTON_CHOIX} ${estVolontaire === false ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#ead8bd] bg-[#fffbf5] hover:border-[#735133]"}`}
            >
              <span className={`mb-1 block text-base font-bold ${estVolontaire === false ? "text-white" : "text-[#2e261f]"}`}>Pas pour l’instant</span>
              <span className={`block text-sm ${estVolontaire === false ? "text-white" : "text-[#2e261f]"}`}>Je rejoins le réseau sans ouvrir de créneaux.</span>
            </button>
          </div>
        </div>

        {estVolontaire === false && (
          <p className="mt-5 rounded-[14px] bg-[#f6efe3] px-5 py-4 text-sm leading-relaxed text-[#2e261f]">
            Aucun souci, vous pourrez ouvrir des créneaux à tout moment depuis votre profil. En attendant, vous
            pouvez répondre au forum, rejoindre un cercle ou recommander une offre d’emploi.
          </p>
        )}

        {etapeInfoAffichee && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2e261f]/45 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setEtapeInfoOuverte(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titre-modal-etape-mentorat"
              className="w-full max-w-md rounded-[22px] border border-[#ead8bd] bg-[#fffbf5] p-6 shadow-2xl sm:p-7"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4f0e8] text-sm font-bold text-[#0d6738]">i</span>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0d6738]">
                    Étape {etapeInfoAffichee.numero} sur 6
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Fermer la fenêtre d’aide"
                  onClick={() => setEtapeInfoOuverte(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-[#2e261f] transition hover:bg-[#f1e4d1]"
                >
                  ×
                </button>
              </div>
              <h3 id="titre-modal-etape-mentorat" className="mb-3 font-display text-2xl font-bold text-[#2e261f]">
                {etapeInfoAffichee.libelle}
              </h3>
              <p className="text-base leading-relaxed text-[#2e261f]">{etapeInfoAffichee.instruction}</p>
              <button
                type="button"
                onClick={() => setEtapeInfoOuverte(null)}
                className="mt-6 w-full rounded-full bg-[#0d6738] px-5 py-3 font-semibold text-white transition hover:bg-[#09572f]"
              >
                J’ai compris
              </button>
            </div>
          </div>
        )}

        {estVolontaire === true && (
          <div className="mt-7 space-y-8 border-t border-[#ead8bd] pt-7">
            <div id="mentorat-sujets" className="scroll-mt-8">
              <EnteteEtapeMentorat
                numero={2}
                titre="Choisissez vos sujets"
                instruction={etapesConfiguration[1].instruction}
                terminee={etapesConfiguration[1].terminee}
                active={prochaineEtape?.numero === 2}
                infoOuverte={etapeInfoOuverte === 2}
                onOpenInfo={() => setEtapeInfoOuverte(2)}
              />
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-sans text-lg font-bold text-[#2e261f]">Sur quoi pouvez-vous aider ?</h2>
                  <p className="text-sm text-[#2e261f]">Deux ou trois suffisent : ce sont les sujets affichés sur votre profil.</p>
                </div>
                <span className="rounded-full bg-[#f6efe3] px-3 py-1 text-xs font-semibold text-[#2e261f]">{sujets.length}/3 sujet(s)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUJETS.map(({ nom }) => {
                  const selectionne = sujets.includes(nom);
                  return (
                    <button
                      key={nom}
                      type="button"
                      aria-pressed={selectionne}
                      onClick={() => toggleSujet(nom)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${selectionne ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#ead8bd] bg-[#fffbf5] text-[#2e261f] hover:border-[#0d6738] hover:text-[#0d6738]"}`}
                    >
                      {nom}
                    </button>
                  );
                })}
              </div>
              {messageSujet && <p role="alert" className="mt-3 text-sm font-medium text-[#a44824]">{messageSujet}</p>}
            </div>

            {sujets.length > 0 && (
              <div id="mentorat-precisions" className="scroll-mt-8 rounded-[16px] border border-[#ead8bd] bg-[#fffdf9] p-4 sm:p-5">
                <EnteteEtapeMentorat
                  numero={3}
                  titre="Précisez votre aide"
                  instruction={etapesConfiguration[2].instruction}
                  terminee={etapesConfiguration[2].terminee}
                  active={prochaineEtape?.numero === 3}
                  infoOuverte={etapeInfoOuverte === 3}
                  onOpenInfo={() => setEtapeInfoOuverte(3)}
                />
                <h3 className="mb-1 font-sans text-base font-bold text-[#2e261f]">Précisez pour chaque sujet</h3>
                <p className="mb-4 text-sm text-[#2e261f]">Soyez concret : la personne comprend immédiatement ce qu’elle peut vous demander.</p>
                <div className="space-y-4">
                  {sujets.map((sujet) => {
                    const configuration = SUJETS.find(({ nom }) => nom === sujet);
                    return (
                      <div key={sujet} className="grid min-w-0 gap-2 sm:grid-cols-[250px_minmax(0,1fr)] sm:items-center sm:gap-4">
                        <label htmlFor={`precision-${sujet}`} className="text-sm font-semibold text-[#2e261f]">{sujet} <span className="text-[#c65327]">*</span></label>
                        <input
                          id={`precision-${sujet}`}
                          value={precisionsSujets[sujet] || ""}
                          maxLength={180}
                          onChange={(event) => setPrecisionsSujets((precedentes) => ({ ...precedentes, [sujet]: event.target.value }))}
                          placeholder={configuration?.exemple}
                          className="min-w-0 rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div id="mentorat-duree" className="scroll-mt-8">
              <EnteteEtapeMentorat
                numero={4}
                titre="Choisissez la durée"
                instruction={etapesConfiguration[3].instruction}
                terminee={etapesConfiguration[3].terminee}
                active={prochaineEtape?.numero === 4}
                infoOuverte={etapeInfoOuverte === 4}
                onOpenInfo={() => setEtapeInfoOuverte(4)}
              />
              <div className="grid grid-cols-3 gap-2">
                {DUREES.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={duree === valeur}
                    onClick={() => choisirDuree(valeur)}
                    className={`${PETIT_BOUTON} ${duree === valeur ? "!border-[#0d6738] !bg-[#0d6738] !text-white" : ""}`}
                  >
                    {valeur} min
                  </button>
                ))}
              </div>
              {messageDuree && <p role="alert" className="mt-3 text-sm font-semibold text-[#a44824]">{messageDuree}</p>}
            </div>

            <div id="mentorat-format" className="scroll-mt-8">
              <EnteteEtapeMentorat
                numero={5}
                titre="Choisissez le format"
                instruction={etapesConfiguration[4].instruction}
                terminee={etapesConfiguration[4].terminee}
                active={prochaineEtape?.numero === 5}
                infoOuverte={etapeInfoOuverte === 5}
                onOpenInfo={() => setEtapeInfoOuverte(5)}
              />
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={format === valeur}
                    onClick={() => choisirFormat(valeur)}
                    className={`${PETIT_BOUTON} ${format === valeur ? "!border-[#0d6738] !bg-[#0d6738] !text-white" : ""}`}
                  >
                    {valeur}
                  </button>
                ))}
              </div>
            </div>

            <div id="mentorat-disponibilites" className="scroll-mt-8">
              <EnteteEtapeMentorat
                numero={6}
                titre="Ouvrez vos créneaux"
                instruction={etapesConfiguration[5].instruction}
                terminee={etapesConfiguration[5].terminee}
                active={prochaineEtape?.numero === 6}
                infoOuverte={etapeInfoOuverte === 6}
                onOpenInfo={() => setEtapeInfoOuverte(6)}
              />
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-sans text-lg font-bold text-[#2e261f]">Vos disponibilités</h3>
                  <p className="text-sm text-[#2e261f]">Ouvrez les jours qui vous vont et réglez les heures précisément.</p>
                </div>
                <span className="rounded-full bg-[#e3f0e9] px-4 py-2 text-sm font-semibold text-[#0d6738]">{joursOuverts.length} jour(s), {totalCreneaux} créneau(x)</span>
              </div>

              <div className="mb-5 grid gap-4 md:grid-cols-3">
                <div className="min-w-0">
                  <label htmlFor="fuseau-mentorat" className="mb-2 block text-sm font-semibold text-[#2e261f]">Votre fuseau horaire</label>
                  <select id="fuseau-mentorat" value={fuseauHoraire} onChange={(event) => setFuseauHoraire(event.target.value)} className="w-full rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none focus:border-[#0d6738]">
                    {FUSEAUX.map((fuseau) => <option key={fuseau.value} value={fuseau.value}>{fuseau.label}</option>)}
                  </select>
                  <p className="mt-2 text-xs text-[#2e261f]">Les créneaux suivront ce fuseau, même en voyage.</p>
                </div>
                <div>
                  <label htmlFor="debut-mentorat" className="mb-2 block text-sm font-semibold text-[#2e261f]">Disponible à partir du</label>
                  <input id="debut-mentorat" type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className="w-full rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none focus:border-[#0d6738]" />
                  <p className="mt-2 text-xs text-[#2e261f]">Laissez vide pour être disponible dès maintenant.</p>
                </div>
                <div>
                  <label htmlFor="fin-mentorat" className="mb-2 block text-sm font-semibold text-[#2e261f]">Jusqu’au <span className="font-normal">(optionnel)</span></label>
                  <input id="fin-mentorat" type="date" min={dateDebut || undefined} value={dateFin} disabled={sansDateFin} onChange={(event) => setDateFin(event.target.value)} className="w-full rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none disabled:bg-[#f1e4d1] disabled:text-[#2e261f] disabled:opacity-60 focus:border-[#0d6738]" />
                  <label className="mt-2 flex items-center gap-2 text-xs text-[#2e261f]">
                    <input type="checkbox" checked={sansDateFin} onChange={(event) => setSansDateFin(event.target.checked)} className="h-4 w-4 accent-[#0d6738]" />
                    Sans date de fin
                  </label>
                </div>
              </div>

              <div className="overflow-hidden rounded-[16px] border border-[#ead8bd] bg-[#fffdf9]">
                {disponibilites.map((disponibilite) => (
                  <div key={disponibilite.jour} className="grid min-w-0 border-b border-[#ead8bd] last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)]">
                    <label className="flex cursor-pointer items-center gap-3 border-b border-[#ead8bd] px-4 py-4 md:border-b-0 md:border-r">
                      <input type="checkbox" checked={disponibilite.ouvert} onChange={() => toggleJour(disponibilite.jour)} className="h-5 w-5 accent-[#0d6738]" />
                      <span className="font-semibold text-[#2e261f]">{disponibilite.jour}</span>
                    </label>
                    <div className="min-w-0 px-4 py-4">
                      {!disponibilite.ouvert ? (
                        <button type="button" onClick={() => toggleJour(disponibilite.jour)} className="text-left text-sm text-[#2e261f] hover:text-[#0d6738]">
                          Indisponible — cliquez pour ouvrir ce jour
                        </button>
                      ) : (
                        <div className="space-y-3">
                          {disponibilite.plages.map((plage, index) => {
                            const plageValide = minutesDepuisMinuit(plage.fin) > minutesDepuisMinuit(plage.debut);
                            return (
                              <div key={`${disponibilite.jour}-${index}`} className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-[#2e261f]">
                                <span>de</span>
                                <select aria-label={`Heure de début ${disponibilite.jour}, plage ${index + 1}`} value={plage.debut} onChange={(event) => mettreAJourPlage(disponibilite.jour, index, "debut", event.target.value)} className="rounded-[10px] border border-[#dfc9a8] bg-[#fffbf5] px-3 py-2 outline-none focus:border-[#0d6738]">
                                  {HEURES.map((heure) => <option key={heure.value} value={heure.value}>{heure.label}</option>)}
                                </select>
                                <span>à</span>
                                <select aria-label={`Heure de fin ${disponibilite.jour}, plage ${index + 1}`} value={plage.fin} onChange={(event) => mettreAJourPlage(disponibilite.jour, index, "fin", event.target.value)} className="rounded-[10px] border border-[#dfc9a8] bg-[#fffbf5] px-3 py-2 outline-none focus:border-[#0d6738]">
                                  {HEURES.map((heure) => <option key={heure.value} value={heure.value}>{heure.label}</option>)}
                                </select>
                                <span className={`font-semibold ${plageValide && duree !== null ? "text-[#0d6738]" : "text-[#a44824]"}`}>
                                  {duree === null ? "Choisissez d’abord une durée" : plageValide ? `${nombreCreneaux([plage], duree)} créneau(x) de ${duree} min` : "L’heure de fin doit être plus tard"}
                                </span>
                                <button type="button" onClick={() => retirerPlage(disponibilite.jour, index)} className="ml-auto font-semibold text-[#2e261f] hover:text-[#a44824]">Retirer</button>
                              </div>
                            );
                          })}
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-[#0d6738]">
                            <button type="button" disabled={disponibilite.plages.length >= 3} onClick={() => ajouterPlage(disponibilite.jour)} className="disabled:cursor-not-allowed disabled:opacity-40">+ Ajouter une plage</button>
                            <button type="button" disabled={disponibilite.plages.length === 0} onClick={() => appliquerATousLesJoursOuverts(disponibilite.jour)} className="disabled:cursor-not-allowed disabled:opacity-40">Appliquer à tous les jours ouverts</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[#f6efe3] px-5 py-4">
              <span className="text-sm font-semibold text-[#2e261f]">Pas plus de</span>
              {MAX_RDV.map((valeur) => (
                <button key={valeur ?? "illimite"} type="button" aria-pressed={maxRdvMois === valeur} onClick={() => setMaxRdvMois(valeur)} className={`${PETIT_BOUTON} !px-4 !py-2 ${maxRdvMois === valeur ? "!border-[#0d6738] !bg-[#0d6738] !text-white" : ""}`}>
                  {valeur === null ? "Sans limite" : valeur}
                </button>
              ))}
              <span className="text-sm font-semibold text-[#2e261f]">rendez-vous par mois.</span>
            </div>

            {totalCreneaux > 0 && (
              <p className="rounded-[14px] border border-[#efcdbb] bg-[#f8e4d7] px-5 py-4 text-sm leading-relaxed text-[#2e261f]">
                <strong>Récapitulatif :</strong> {recap}
              </p>
            )}
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 border-t border-[#ead8bd] pt-6 sm:flex-row">
          <button type="button" onClick={onBack} className="rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-6 py-3 font-semibold text-[#2e261f] hover:bg-[#f6efe3]">Retour</button>
          <button type="button" onClick={continuerOuTerminer} className={`flex-1 rounded-full px-6 py-4 text-base font-semibold transition ${canContinue ? "bg-[#0d6738] text-white hover:bg-[#09572f]" : "bg-[#eee2d0] text-[#2e261f] hover:bg-[#e4d5bf]"}`}>
            {canContinue ? "Terminer mon inscription" : `Continuer — étape ${prochaineEtape?.numero || 1} : ${prochaineEtape?.actionCourte || "choisir une réponse"}`}
          </button>
        </div>
        {!canContinue && prochaineEtape && (
          <p role="status" className="mt-3 rounded-[12px] border border-[#ead8bd] bg-[#f6efe3] px-4 py-3 text-center text-sm font-medium text-[#2e261f]">
            <strong>Étape {prochaineEtape.numero} sur 6 :</strong> {prochaineEtape.instruction}
          </p>
        )}
      </section>
    </div>
  );
}

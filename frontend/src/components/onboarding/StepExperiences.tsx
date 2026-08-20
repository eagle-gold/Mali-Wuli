"use client";

import { useEffect, useMemo, useState } from "react";
import SearchCombobox, { type SearchOption } from "./SearchCombobox";

export interface Experience {
  id: string;
  poste: string;
  structure: string;
  typeContrat: string;
  pays: string;
  paysCode: string;
  ville: string;
  /** Conservé pour relire les anciennes données locales. */
  lieu?: string;
  anneeDebut: string;
  anneeFin: string;
  posteActuel: boolean;
  description: string;
}

interface StepExperiencesProps {
  onNext: (data: Experience[]) => void;
  onBack: () => void;
  initialData?: Experience[];
}

type PaysOption = { code: string; nom: string; drapeau: string };
type VilleOption = { id: number; nom: string; region: string };

const TYPES_CONTRAT = [
  "CDI",
  "CDD",
  "Stage",
  "Alternance",
  "Freelance",
  "Entrepreneuriat",
  "Mission",
  "Bénévolat",
  "Engagement associatif",
  "Autre",
];

const PAYS_DE_SECOURS: PaysOption[] = [
  { code: "ML", nom: "Mali", drapeau: "🇲🇱" },
  { code: "CI", nom: "Côte d’Ivoire", drapeau: "🇨🇮" },
  { code: "NG", nom: "Nigéria", drapeau: "🇳🇬" },
  { code: "NE", nom: "Niger", drapeau: "🇳🇪" },
  { code: "MR", nom: "Mauritanie", drapeau: "🇲🇷" },
  { code: "FR", nom: "France", drapeau: "🇫🇷" },
];

const FIELD_CLASS =
  "w-full min-w-0 rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-5 py-4 text-base text-[#2e261f] outline-none transition focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20 disabled:cursor-not-allowed disabled:bg-[#eee2d0] disabled:text-[#776b5e] sm:text-lg";
const LABEL_CLASS = "mb-2 block text-base font-semibold text-[#2e261f]";

const creerExperienceVide = (): Omit<Experience, "id"> => ({
  poste: "",
  structure: "",
  typeContrat: "CDI",
  pays: "Mali",
  paysCode: "ML",
  ville: "",
  lieu: "",
  anneeDebut: "",
  anneeFin: "",
  posteActuel: false,
  description: "",
});

const normaliserAncienneExperience = (experience: Experience): Experience => {
  if (experience.paysCode && experience.pays && experience.ville) return experience;
  const [ville = "", pays = ""] = (experience.lieu || "").split(",").map((partie) => partie.trim());
  const paysConnu = PAYS_DE_SECOURS.find((option) => option.nom === pays);
  return {
    ...experience,
    pays: experience.pays || pays || "Mali",
    paysCode: experience.paysCode || paysConnu?.code || "ML",
    ville: experience.ville || ville,
  };
};

const initialesStructure = (structure: string) => {
  const mots = structure.trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "EX";
  if (mots.length === 1) return mots[0].slice(0, 2).toLocaleUpperCase("fr");
  return `${mots[0][0]}${mots[1][0]}`.toLocaleUpperCase("fr");
};

function ExperienceCard({
  experience,
  onModifier,
  onRetirer,
}: {
  experience: Experience;
  onModifier: () => void;
  onRetirer: () => void;
}) {
  const localisation = [experience.ville, experience.pays].filter(Boolean).join(", ") || experience.lieu;

  return (
    <article className="mb-5 flex min-w-0 gap-4 rounded-[18px] border border-[#e4d2b3] bg-[#fffbf5] p-4 sm:gap-5 sm:p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-[#e1f1e6] text-sm font-bold text-[#0d6738] sm:h-14 sm:w-14 sm:text-base">
        {initialesStructure(experience.structure)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-bold text-[#2e261f] [overflow-wrap:anywhere] sm:text-lg">
                {experience.poste}
              </h3>
              <span className="rounded-[7px] bg-[#eee2d0] px-3 py-1 text-xs font-bold text-[#2e261f] sm:text-sm">
                {experience.typeContrat}
              </span>
            </div>
            <p className="mt-1 break-words text-sm text-[#2e261f] [overflow-wrap:anywhere] sm:text-base">
              {experience.structure} · {localisation} · {experience.anneeDebut} → {experience.posteActuel ? "aujourd’hui" : experience.anneeFin}
            </p>
            {experience.description && (
              <p className="mt-2 break-words text-sm leading-relaxed text-[#56493e] [overflow-wrap:anywhere] sm:text-base">
                {experience.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-4 sm:flex-col sm:items-end sm:gap-2">
            <button type="button" onClick={onModifier} className="text-sm font-semibold text-[#0d6738] hover:underline sm:text-base">
              Modifier
            </button>
            <button type="button" onClick={onRetirer} className="text-sm font-semibold text-[#2e261f] hover:text-[#b84f25] sm:text-base">
              Retirer
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ExperienceForm({
  initialData,
  onSave,
  onCancel,
}: {
  initialData?: Experience;
  onSave: (experience: Experience) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Experience, "id">>(() =>
    initialData ? normaliserAncienneExperience(initialData) : creerExperienceVide(),
  );
  const [pays, setPays] = useState<PaysOption[]>(PAYS_DE_SECOURS);
  const [villes, setVilles] = useState<VilleOption[]>([]);
  const [rechercheVille, setRechercheVille] = useState(false);

  const set = <K extends keyof Omit<Experience, "id">>(champ: K, valeur: Omit<Experience, "id">[K]) =>
    setForm((precedent) => ({ ...precedent, [champ]: valeur }));

  useEffect(() => {
    let actif = true;
    fetch("/api/locations/countries")
      .then((reponse) => reponse.ok ? reponse.json() : Promise.reject(new Error("Pays indisponibles")))
      .then((donnees: { pays?: PaysOption[] }) => {
        if (actif && donnees.pays?.length) setPays(donnees.pays);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    const recherche = form.ville.trim();
    if (recherche.length < 2) {
      setVilles([]);
      setRechercheVille(false);
      return;
    }
    let actif = true;
    const temporisateur = window.setTimeout(() => {
      setRechercheVille(true);
      const parametres = new URLSearchParams({ country: form.paysCode, q: recherche, limit: "60" });
      fetch(`/api/locations/cities?${parametres}`)
        .then((reponse) => reponse.ok ? reponse.json() : Promise.reject(new Error("Villes indisponibles")))
        .then((donnees: { villes?: VilleOption[] }) => {
          if (actif) setVilles(donnees.villes || []);
        })
        .catch(() => {
          if (actif) setVilles([]);
        })
        .finally(() => {
          if (actif) setRechercheVille(false);
        });
    }, 250);
    return () => {
      actif = false;
      window.clearTimeout(temporisateur);
    };
  }, [form.paysCode, form.ville]);

  const villeOptions = useMemo<SearchOption[]>(() => villes.map((ville) => ({
    id: String(ville.id),
    label: ville.nom,
    secondary: ville.region,
  })), [villes]);

  const canSave = Boolean(
    form.poste.trim()
    && form.structure.trim()
    && form.typeContrat
    && form.paysCode
    && form.ville.trim()
    && form.anneeDebut
    && (form.posteActuel || form.anneeFin)
    && form.description.trim(),
  );

  return (
    <section className="mb-6 rounded-[18px] border border-[#cfe0d2] bg-[#f4f0e6] p-5 sm:p-7">
      <h3 className="mb-5 text-lg font-bold text-[#2e261f] sm:text-xl">
        {initialData ? "Modifier l’expérience" : "Nouvelle expérience"}
      </h3>

      <div className="mb-5 grid min-w-0 gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="experience-poste" className={LABEL_CLASS}>Intitulé du poste <span className="text-[#c65327]">*</span></label>
          <input id="experience-poste" value={form.poste} onChange={(event) => set("poste", event.target.value)} placeholder="Ex. Cheffe de projet" className={FIELD_CLASS} />
        </div>
        <div className="min-w-0">
          <label htmlFor="experience-structure" className={LABEL_CLASS}>Structure <span className="text-[#c65327]">*</span></label>
          <input id="experience-structure" value={form.structure} onChange={(event) => set("structure", event.target.value)} placeholder="Entreprise, association, administration…" className={FIELD_CLASS} />
        </div>
      </div>

      <div className="mb-5 grid min-w-0 gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="experience-contrat" className={LABEL_CLASS}>Type de contrat <span className="text-[#c65327]">*</span></label>
          <select id="experience-contrat" value={form.typeContrat} onChange={(event) => set("typeContrat", event.target.value)} className={FIELD_CLASS}>
            {TYPES_CONTRAT.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="experience-pays" className={LABEL_CLASS}>Pays <span className="text-[#c65327]">*</span></label>
          <select
            id="experience-pays"
            value={form.paysCode}
            onChange={(event) => {
              const selection = pays.find((item) => item.code === event.target.value);
              if (!selection) return;
              setForm((precedent) => ({ ...precedent, pays: selection.nom, paysCode: selection.code, ville: "", lieu: "" }));
            }}
            className={FIELD_CLASS}
          >
            {pays.map((item) => <option key={item.code} value={item.code}>{item.drapeau} {item.nom}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-5 max-w-full md:w-[calc(50%-0.625rem)]">
        <SearchCombobox
          id="experience-ville"
          label="Ville"
          value={form.ville}
          placeholder="Recherchez la ville"
          options={villeOptions}
          loading={rechercheVille}
          minChars={2}
          required
          helperText="Tapez au moins 2 lettres, puis sélectionnez la ville."
          onChange={(value) => setForm((precedent) => ({ ...precedent, ville: value, lieu: `${value}, ${precedent.pays}` }))}
          onSelect={(option) => setForm((precedent) => ({ ...precedent, ville: option.label, lieu: `${option.label}, ${precedent.pays}` }))}
        />
      </div>

      <div className="mb-5">
        <label className={LABEL_CLASS}>Période <span className="text-[#c65327]">*</span></label>
        <div className="grid min-w-0 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <input aria-label="Année de début" type="number" min="1940" max="2100" value={form.anneeDebut} onChange={(event) => set("anneeDebut", event.target.value)} placeholder="Année de début" className={FIELD_CLASS} />
          <span aria-hidden="true" className="hidden text-lg text-[#776b5e] sm:block">→</span>
          <input
            aria-label="Année de fin"
            type="number"
            min="1940"
            max="2100"
            value={form.posteActuel ? "" : form.anneeFin}
            onChange={(event) => set("anneeFin", event.target.value)}
            placeholder={form.posteActuel ? "aujourd’hui" : "Année de fin"}
            disabled={form.posteActuel}
            className={FIELD_CLASS}
          />
          <label className="flex cursor-pointer items-center gap-3 whitespace-nowrap text-base font-semibold text-[#2e261f] lg:pl-1">
            <input
              type="checkbox"
              checked={form.posteActuel}
              onChange={(event) => setForm((precedent) => ({ ...precedent, posteActuel: event.target.checked, anneeFin: event.target.checked ? "" : precedent.anneeFin }))}
              className="h-5 w-5 accent-[#0d6738]"
            />
            Poste actuel
          </label>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="experience-description" className={LABEL_CLASS}>Ce que vous y faites <span className="text-[#c65327]">*</span></label>
        <textarea
          id="experience-description"
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          placeholder="Missions, réalisations, sujets sur lesquels vous pouvez aider les autres membres…"
          rows={4}
          className={`${FIELD_CLASS} resize-y`}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} className="rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-7 py-4 text-base font-semibold text-[#2e261f] hover:bg-[#f6efe3]">
          Annuler
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return;
            onSave({ ...form, lieu: `${form.ville}, ${form.pays}`, id: initialData?.id || crypto.randomUUID() });
          }}
          className={`flex-1 rounded-[14px] px-7 py-4 text-base font-semibold text-white transition-colors ${canSave ? "bg-[#0d6738] hover:bg-[#09572f]" : "cursor-not-allowed bg-[#aa997f]"}`}
        >
          {initialData ? "Enregistrer les modifications" : "Enregistrer cette expérience"}
        </button>
      </div>
    </section>
  );
}

export default function StepExperiences({ onNext, onBack, initialData }: StepExperiencesProps) {
  const [experiences, setExperiences] = useState<Experience[]>(() => (initialData || []).map(normaliserAncienneExperience));
  const [formOuvert, setFormOuvert] = useState(false);
  const [editionId, setEditionId] = useState<string | null>(null);
  const experienceEnEdition = editionId ? experiences.find((experience) => experience.id === editionId) : undefined;

  const fermerFormulaire = () => {
    setFormOuvert(false);
    setEditionId(null);
  };

  const sauvegarder = (experience: Experience) => {
    setExperiences((precedentes) => {
      const index = precedentes.findIndex((item) => item.id === experience.id);
      if (index < 0) return [...precedentes, experience];
      return precedentes.map((item) => item.id === experience.id ? experience : item);
    });
    fermerFormulaire();
  };

  return (
    <section className="min-w-0 rounded-[22px] border border-[#e4d2b3] bg-[#fffbf5] p-5 shadow-sm sm:p-8 lg:p-9">
      <h2 className="mb-2 font-display text-2xl font-bold text-[#2e261f] sm:text-3xl">Vos expériences</h2>
      <p className="mb-7 max-w-[1050px] text-sm leading-relaxed text-[#2e261f] sm:text-base">
        Postes, missions, stages, engagements associatifs. C’est ce qui permet aux autres membres de savoir quoi vous demander, et à vous de recevoir les bonnes sollicitations.
      </p>

      {experiences.map((experience) => (
        <ExperienceCard
          key={experience.id}
          experience={experience}
          onModifier={() => {
            setEditionId(experience.id);
            setFormOuvert(true);
          }}
          onRetirer={() => {
            setExperiences((precedentes) => precedentes.filter((item) => item.id !== experience.id));
            if (editionId === experience.id) fermerFormulaire();
          }}
        />
      ))}

      {formOuvert ? (
        <ExperienceForm key={editionId || "nouvelle"} initialData={experienceEnEdition} onSave={sauvegarder} onCancel={fermerFormulaire} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditionId(null);
            setFormOuvert(true);
          }}
          className="mb-6 w-full rounded-[14px] border border-dashed border-[#d7b98d] px-5 py-4 text-base font-semibold text-[#0d6738] transition-colors hover:border-[#0d6738] hover:bg-[#f6efe3]"
        >
          + Ajouter une expérience
        </button>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-7 py-4 text-base font-semibold text-[#2e261f] hover:bg-[#f6efe3]">
          Retour
        </button>
        <button
          type="button"
          onClick={() => onNext(experiences)}
          className={`flex-1 rounded-full px-8 py-4 text-base font-semibold text-white transition-colors sm:text-lg ${experiences.length ? "bg-[#0d6738] hover:bg-[#09572f]" : "bg-[#aa997f] hover:bg-[#96866e]"}`}
        >
          {experiences.length ? "Continuer vers le mentorat" : "Passer cette étape"}
        </button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import SearchCombobox, { type SearchOption } from "./SearchCombobox";
import {
  MOIS,
  anneeEstValide,
  formaterMoisAnnee,
  normaliserAnnee,
  periodeEstValide,
  trierParDateDebut,
} from "@/lib/periode";

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
  moisDebut: string;
  anneeDebut: string;
  moisFin: string;
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
  "w-full min-w-0 rounded-[14px] border border-line-strong bg-surface px-5 py-4 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-[#eee2d0] disabled:text-ink-muted sm:text-lg";
const LABEL_CLASS = "mb-2 block text-base font-semibold text-ink";

const creerExperienceVide = (): Omit<Experience, "id"> => ({
  poste: "",
  structure: "",
  typeContrat: "CDI",
  pays: "Mali",
  paysCode: "ML",
  ville: "",
  lieu: "",
  moisDebut: "",
  anneeDebut: "",
  moisFin: "",
  anneeFin: "",
  posteActuel: false,
  description: "",
});

const normaliserAncienneExperience = (experience: Experience): Experience => {
  const [ville = "", pays = ""] = (experience.lieu || "").split(",").map((partie) => partie.trim());
  const paysConnu = PAYS_DE_SECOURS.find((option) => option.nom === pays);
  return {
    ...experience,
    pays: experience.pays || pays || "Mali",
    paysCode: experience.paysCode || paysConnu?.code || "ML",
    ville: experience.ville || ville,
    moisDebut: experience.moisDebut || "",
    moisFin: experience.moisFin || "",
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
    <article className="mb-5 flex min-w-0 gap-4 rounded-[18px] border border-line bg-surface p-4 sm:gap-5 sm:p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-[#e1f1e6] text-sm font-bold text-brand sm:h-14 sm:w-14 sm:text-base">
        {initialesStructure(experience.structure)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="titre-element break-words [overflow-wrap:anywhere]">
                {experience.poste}
              </h3>
              <span className="rounded-[7px] bg-[#eee2d0] px-3 py-1 text-xs font-bold text-ink sm:text-sm">
                {experience.typeContrat}
              </span>
            </div>
            <p className="mt-1 break-words text-sm text-ink [overflow-wrap:anywhere] sm:text-base">
              {experience.structure} · {localisation} · {formaterMoisAnnee(experience.moisDebut, experience.anneeDebut)} → {experience.posteActuel ? "aujourd’hui" : formaterMoisAnnee(experience.moisFin, experience.anneeFin)}
            </p>
            {experience.description && (
              <p className="mt-2 break-words text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere] sm:text-base">
                {experience.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-4 sm:flex-col sm:items-end sm:gap-2">
            <button type="button" onClick={onModifier} className="text-sm font-semibold text-brand hover:underline sm:text-base">
              Modifier
            </button>
            <button type="button" onClick={onRetirer} className="text-sm font-semibold text-ink hover:text-[#b84f25] sm:text-base">
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

  const anneesCompletes = anneeEstValide(form.anneeDebut)
    && (form.posteActuel || anneeEstValide(form.anneeFin));
  const periodeCompleteEtValide = form.posteActuel
    ? Boolean(form.moisDebut && anneeEstValide(form.anneeDebut))
    : periodeEstValide(form.moisDebut, form.anneeDebut, form.moisFin, form.anneeFin);
  const canSave = Boolean(
    form.poste.trim()
    && form.structure.trim()
    && form.typeContrat
    && form.paysCode
    && form.ville.trim()
    && anneesCompletes
    && periodeCompleteEtValide
    && form.description.trim(),
  );

  return (
    <section className="mb-6 rounded-[18px] border border-[#cfe0d2] bg-[#f4f0e6] p-5 sm:p-7">
      <h3 className="mb-5 titre-element">
        {initialData ? "Modifier l’expérience" : "Nouvelle expérience"}
      </h3>

      <div className="mb-5 grid min-w-0 gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="experience-poste" className={LABEL_CLASS}>Intitulé du poste <span className="text-clay">*</span></label>
          <input id="experience-poste" value={form.poste} onChange={(event) => set("poste", event.target.value)} placeholder="Ex. Cheffe de projet" className={FIELD_CLASS} />
        </div>
        <div className="min-w-0">
          <label htmlFor="experience-structure" className={LABEL_CLASS}>Structure <span className="text-clay">*</span></label>
          <input id="experience-structure" value={form.structure} onChange={(event) => set("structure", event.target.value)} placeholder="Entreprise, association, administration…" className={FIELD_CLASS} />
        </div>
      </div>

      <div className="mb-5 grid min-w-0 gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="experience-contrat" className={LABEL_CLASS}>Type de contrat <span className="text-clay">*</span></label>
          <select id="experience-contrat" value={form.typeContrat} onChange={(event) => set("typeContrat", event.target.value)} className={FIELD_CLASS}>
            {TYPES_CONTRAT.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="experience-pays" className={LABEL_CLASS}>Pays <span className="text-clay">*</span></label>
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
        <label className={LABEL_CLASS}>Période <span className="text-clay">*</span></label>
        <div className="grid min-w-0 items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <select aria-label="Mois de début" value={form.moisDebut} onChange={(event) => set("moisDebut", event.target.value)} className={FIELD_CLASS}>
              <option value="">Mois de début</option>
              {MOIS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input aria-label="Année de début" type="text" inputMode="numeric" maxLength={4} value={form.anneeDebut} onChange={(event) => set("anneeDebut", normaliserAnnee(event.target.value))} placeholder="Année de début" className={FIELD_CLASS} />
          </div>
          <span aria-hidden="true" className="hidden text-lg text-ink-muted sm:block">→</span>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <select aria-label="Mois de fin" value={form.posteActuel ? "" : form.moisFin} onChange={(event) => set("moisFin", event.target.value)} disabled={form.posteActuel} className={FIELD_CLASS}>
              <option value="">{form.posteActuel ? "Aujourd’hui" : "Mois de fin"}</option>
              {MOIS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input
              aria-label="Année de fin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={form.posteActuel ? "" : form.anneeFin}
              onChange={(event) => set("anneeFin", normaliserAnnee(event.target.value))}
              placeholder={form.posteActuel ? "Aujourd’hui" : "Année de fin"}
              disabled={form.posteActuel}
              className={FIELD_CLASS}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 whitespace-nowrap text-base font-semibold text-ink lg:pl-1">
            <input
              type="checkbox"
              checked={form.posteActuel}
              onChange={(event) => setForm((precedent) => ({
                ...precedent,
                posteActuel: event.target.checked,
                moisFin: event.target.checked ? "" : precedent.moisFin,
                anneeFin: event.target.checked ? "" : precedent.anneeFin,
              }))}
              className="h-5 w-5 accent-brand"
            />
            Poste actuel
          </label>
        </div>
        {(form.anneeDebut && !anneeEstValide(form.anneeDebut)) || (!form.posteActuel && form.anneeFin && !anneeEstValide(form.anneeFin)) ? (
          <p className="mt-2 text-sm font-medium text-[#a44824]">Une année doit contenir exactement 4 chiffres.</p>
        ) : null}
        {!form.posteActuel && anneesCompletes && form.moisDebut && form.moisFin && !periodeCompleteEtValide ? (
          <p className="mt-2 text-sm font-medium text-[#a44824]">La date de début doit être antérieure ou égale à la date de fin.</p>
        ) : null}
      </div>

      <div className="mb-6">
        <label htmlFor="experience-description" className={LABEL_CLASS}>Ce que vous y faites <span className="text-clay">*</span></label>
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
        <button type="button" onClick={onCancel} className="rounded-[14px] border border-line-strong bg-surface px-7 py-4 text-base font-semibold text-ink hover:bg-surface-sunken">
          Annuler
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return;
            onSave({ ...form, lieu: `${form.ville}, ${form.pays}`, id: initialData?.id || crypto.randomUUID() });
          }}
          className={`flex-1 rounded-[14px] px-7 py-4 text-base font-semibold text-white transition-colors ${canSave ? "bg-brand hover:bg-brand-700" : "cursor-not-allowed bg-[#aa997f]"}`}
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
    <section className="min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-sm sm:p-8 lg:p-9">
      <h2 className="mb-2 titre-section">Vos expériences</h2>
      <p className="mb-7 max-w-[1050px] text-sm leading-relaxed text-ink sm:text-base">
        Postes, missions, stages, engagements associatifs. C’est ce qui permet aux autres membres de savoir quoi vous demander, et à vous de recevoir les bonnes sollicitations.
      </p>

      {trierParDateDebut(experiences).map((experience) => (
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
          className="mb-6 w-full rounded-[14px] border border-dashed border-[#d7b98d] px-5 py-4 text-base font-semibold text-brand transition-colors hover:border-brand hover:bg-surface-sunken"
        >
          + Ajouter une expérience
        </button>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="rounded-[14px] border border-line-strong bg-surface px-7 py-4 text-base font-semibold text-ink hover:bg-surface-sunken">
          Retour
        </button>
        <button
          type="button"
          onClick={() => onNext(trierParDateDebut(experiences))}
          className={`flex-1 rounded-full px-8 py-4 text-base font-semibold text-white transition-colors sm:text-lg ${experiences.length ? "bg-brand hover:bg-brand-700" : "bg-[#aa997f] hover:bg-[#96866e]"}`}
        >
          {experiences.length ? "Continuer vers le mentorat" : "Passer cette étape"}
        </button>
      </div>
    </section>
  );
}

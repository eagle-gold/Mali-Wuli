"use client";

import { useState } from "react";

export interface Experience {
  id: string;
  poste: string;
  structure: string;
  typeContrat: string;
  lieu: string;
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

const TYPES_CONTRAT = [
  "CDI", "CDD", "Stage", "Alternance", "Freelance",
  "Entrepreneuriat", "Mission", "Bénévolat", "Autre",
];

function ExperienceCard({ exp, onRetirer }: { exp: Experience; onRetirer: () => void }) {
  return (
    <div className="border border-sable-200 rounded-xl p-4 mb-3 bg-white">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-terre text-sm">{exp.poste}</p>
          <p className="text-xs text-terre-300">{exp.structure} · {exp.lieu}</p>
          <p className="text-xs text-terre-300">
            {exp.anneeDebut} → {exp.posteActuel ? "aujourd'hui" : exp.anneeFin}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-sable-100 text-terre-300">{exp.typeContrat}</span>
          </p>
          {exp.description && <p className="text-xs text-terre-300 mt-1 italic">{exp.description}</p>}
        </div>
        <button onClick={onRetirer} className="text-xs text-terre-300 hover:text-laterite ml-2">
          Retirer
        </button>
      </div>
    </div>
  );
}

function ExperienceForm({ onSave, onCancel }: { onSave: (e: Experience) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    poste: "",
    structure: "",
    typeContrat: "CDI",
    lieu: "",
    anneeDebut: "",
    anneeFin: "",
    posteActuel: false,
    description: "",
  });

  const set = (field: keyof typeof form, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  const canSave = form.poste && form.structure && form.anneeDebut;

  return (
    <div className="border border-sable-200 rounded-xl p-5 mb-4 bg-sable-50">
      <h3 className="font-semibold text-terre mb-4">Nouvelle expérience</h3>

      {/* Poste + Structure */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-terre mb-1">Intitulé du poste</label>
          <input
            type="text"
            value={form.poste}
            onChange={(e) => set("poste", e.target.value)}
            className="w-full border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-terre mb-1">Structure</label>
          <input
            type="text"
            value={form.structure}
            onChange={(e) => set("structure", e.target.value)}
            className="w-full border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          />
        </div>
      </div>

      {/* Type de contrat + Lieu */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-terre mb-1">Type de contrat</label>
          <select
            value={form.typeContrat}
            onChange={(e) => set("typeContrat", e.target.value)}
            className="w-full border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          >
            {TYPES_CONTRAT.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-terre mb-1">Lieu</label>
          <input
            type="text"
            value={form.lieu}
            onChange={(e) => set("lieu", e.target.value)}
            placeholder="Ville, Pays"
            className="w-full border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          />
        </div>
      </div>

      {/* Période */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-terre mb-1">Période</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={form.anneeDebut}
            onChange={(e) => set("anneeDebut", e.target.value)}
            placeholder="2013"
            className="flex-1 border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          />
          <span className="text-terre-300">→</span>
          <input
            type="number"
            value={form.posteActuel ? "" : form.anneeFin}
            onChange={(e) => set("anneeFin", e.target.value)}
            placeholder={form.posteActuel ? "aujourd'hui" : "2024"}
            disabled={form.posteActuel}
            className={`flex-1 border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre focus:outline-none focus:ring-2 focus:ring-vert
              ${form.posteActuel ? "bg-sable-100 text-terre-300" : "bg-white"}`}
          />
          <label className="flex items-center gap-2 text-xs text-terre cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={form.posteActuel}
              onChange={(e) => set("posteActuel", e.target.checked)}
              className="accent-vert"
            />
            Poste actuel
          </label>
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-terre mb-1">Ce que vous y faites (2 lignes suffisent)</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Missions, réalisations, ce sur quoi vous pouvez aider les autres membres..."
          rows={3}
          className="w-full border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert resize-y"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-sable-200 text-terre text-sm font-medium hover:bg-sable-100 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => canSave && onSave({ ...form, id: Date.now().toString() })}
          className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors
            ${canSave ? "bg-vert hover:bg-vert-500" : "bg-sable-200 cursor-not-allowed"}`}
        >
          Enregistrer cette expérience
        </button>
      </div>
    </div>
  );
}

export default function StepExperiences({ onNext, onBack, initialData }: StepExperiencesProps) {
  const [experiences, setExperiences] = useState<Experience[]>(initialData || []);
  const [formOuvert, setFormOuvert] = useState(false);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-sable-100">
      <h2 className="font-display text-2xl font-bold text-terre mb-1">Vos expériences</h2>
      <p className="text-sm text-terre-300 mb-6">
        Postes, missions, stages, engagements associatifs. C'est ce qui permet aux autres membres de savoir quoi vous
        demander, et à vous de recevoir les bonnes sollicitations.
      </p>

      {/* Expériences ajoutées */}
      {experiences.map((e) => (
        <ExperienceCard key={e.id} exp={e} onRetirer={() => setExperiences((p) => p.filter((x) => x.id !== e.id))} />
      ))}

      {/* Formulaire */}
      {formOuvert ? (
        <ExperienceForm onSave={(e) => { setExperiences((p) => [...p, e]); setFormOuvert(false); }} onCancel={() => setFormOuvert(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setFormOuvert(true)}
          className="w-full py-3 rounded-xl border border-dashed border-sable-300 text-sm text-terre-300 hover:border-vert hover:text-vert transition-colors mb-4"
        >
          + Ajouter une expérience
        </button>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2 border-t border-sable-100">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-sable-200 text-terre text-sm font-medium hover:bg-sable-100 transition-colors"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={() => onNext(experiences)}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-colors"
          style={{ backgroundColor: "#b8a898" }}
        >
          Passer cette étape
        </button>
      </div>
    </div>
  );
}

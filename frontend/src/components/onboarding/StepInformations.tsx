"use client";

import { useState } from "react";

interface StepInformationsProps {
  onNext: (data: InfoData) => void;
  onBack: () => void;
  initialData?: InfoData;
}

export interface InfoData {
  prenom: string;
  nom: string;
  telephone: string;
  indicatif: string;
  pays: string;
  ville: string;
}

const PAYS = ["Mali", "France", "Canada", "Sénégal", "Côte d'Ivoire", "Maroc", "États-Unis", "Belgique", "Autre"];

const INDICATIFS = [
  { pays: "Mali", code: "+223" },
  { pays: "France", code: "+33" },
  { pays: "Canada", code: "+1" },
  { pays: "Sénégal", code: "+221" },
  { pays: "Côte d'Ivoire", code: "+225" },
  { pays: "Maroc", code: "+212" },
  { pays: "États-Unis", code: "+1" },
  { pays: "Belgique", code: "+32" },
];

export default function StepInformations({ onNext, onBack, initialData }: StepInformationsProps) {
  const [form, setForm] = useState<InfoData>(
    initialData || { prenom: "", nom: "", telephone: "", indicatif: "+223", pays: "Mali", ville: "" }
  );

  const handleChange = (field: keyof InfoData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canContinue = form.prenom && form.nom && form.pays && form.ville;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-sable-100">
      <h2 className="font-display text-2xl font-bold text-terre mb-1">Vos informations personnelles</h2>
      <p className="text-sm text-terre-300 mb-6">
        Ce qui vous identifie dans l'annuaire et permet aux autres membres de vous retrouver.
        Les champs marqués d'un astérisque sont obligatoires.
      </p>

      {/* Prénom + Nom */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-terre mb-1">Prénom *</label>
          <input
            type="text"
            value={form.prenom}
            onChange={(e) => handleChange("prenom", e.target.value)}
            className="w-full border border-sable-200 rounded-xl px-4 py-3 text-terre focus:outline-none focus:ring-2 focus:ring-vert bg-sable-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-terre mb-1">Nom *</label>
          <input
            type="text"
            value={form.nom}
            onChange={(e) => handleChange("nom", e.target.value)}
            className="w-full border border-sable-200 rounded-xl px-4 py-3 text-terre focus:outline-none focus:ring-2 focus:ring-vert bg-sable-50"
          />
        </div>
      </div>

      {/* Téléphone */}
      <div className="mb-1">
        <label className="block text-sm font-medium text-terre mb-1">
          Numéro de téléphone <span className="text-terre-300 font-normal">: optionnel</span>
        </label>
        <div className="flex gap-2">
          <select
            value={form.indicatif}
            onChange={(e) => handleChange("indicatif", e.target.value)}
            className="border border-sable-200 rounded-xl px-3 py-3 text-terre bg-sable-50 focus:outline-none focus:ring-2 focus:ring-vert"
          >
            {INDICATIFS.map((i) => (
              <option key={i.pays} value={i.code}>
                {i.pays} ({i.code})
              </option>
            ))}
          </select>
          <input
            type="tel"
            value={form.telephone}
            onChange={(e) => handleChange("telephone", e.target.value)}
            className="flex-1 border border-sable-200 rounded-xl px-4 py-3 text-terre bg-sable-50 focus:outline-none focus:ring-2 focus:ring-vert"
          />
        </div>
      </div>
      <p className="text-xs text-terre-300 mb-4">
        Jamais affiché publiquement. Sert uniquement à confirmer un rendez-vous.
      </p>

      {/* Pays + Ville */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-terre mb-1">Pays de résidence *</label>
          <select
            value={form.pays}
            onChange={(e) => handleChange("pays", e.target.value)}
            className="w-full border border-sable-200 rounded-xl px-4 py-3 text-terre bg-sable-50 focus:outline-none focus:ring-2 focus:ring-vert"
          >
            {PAYS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-terre mb-1">Ville *</label>
          <input
            type="text"
            value={form.ville}
            onChange={(e) => handleChange("ville", e.target.value)}
            placeholder="Ex : Bamako"
            className="w-full border border-sable-200 rounded-xl px-4 py-3 text-terre bg-sable-50 focus:outline-none focus:ring-2 focus:ring-vert"
          />
        </div>
      </div>

      {/* Aperçu annuaire */}
      {form.prenom && form.nom && form.ville && form.pays && (
        <div className="bg-sable-50 border border-sable-200 rounded-xl px-4 py-3 mb-6 text-sm text-terre-300">
          Vous apparaîtrez comme{" "}
          <strong className="text-terre">
            {form.prenom} {form.nom} · {form.ville}, {form.pays}
          </strong>{" "}
          dans l'annuaire.
        </div>
      )}

      {/* Boutons */}
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-sable-200 text-terre text-sm font-medium hover:bg-sable-100 transition-colors"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={() => canContinue && onNext(form)}
          disabled={!canContinue}
          className={`flex-1 py-3 rounded-xl text-white font-semibold transition-colors
            ${canContinue ? "bg-vert hover:bg-vert-500 cursor-pointer" : "bg-sable-200 cursor-not-allowed"}
          `}
        >
          Continuer
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

export interface MentoratData {
  estVolontaire: boolean;
  sujets: string[];
  duree: number;
  format: string;
  disponibilites: { jour: string; plage: string }[];
  maxRdvMois: number | null;
}

interface StepMentoratProps {
  onNext: (data: MentoratData) => void;
  onBack: () => void;
}

const SUJETS = [
  "Orientation post-bac",
  "Choix d'études à l'étranger",
  "Bourses & dossiers",
  "Préparation d'entretien",
  "Relecture de CV / portfolio",
  "Premier emploi",
  "Reconversion",
  "Création d'entreprise",
  "Mentorat métier",
];

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const PLAGES = [
  { label: "Matin", horaire: "8 h – 12 h" },
  { label: "Après-midi", horaire: "13 h – 17 h" },
  { label: "Soir", horaire: "18 h – 21 h" },
];
const DUREES = [20, 30, 45];
const FORMATS = ["Visio", "Téléphone", "Sur place"];
const MAX_RDV = [1, 2, 4, null]; // null = Sans limite

export default function StepMentorat({ onNext, onBack }: StepMentoratProps) {
  const [estVolontaire, setEstVolontaire] = useState<boolean | null>(null);
  const [sujets, setSujets] = useState<string[]>([]);
  const [duree, setDuree] = useState(30);
  const [format, setFormat] = useState("Visio");
  const [disponibilites, setDisponibilites] = useState<{ jour: string; plage: string }[]>([]);
  const [maxRdvMois, setMaxRdvMois] = useState<number | null>(2);

  const toggleSujet = (s: string) =>
    setSujets((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  const toggleDispo = (jour: string, plage: string) => {
    setDisponibilites((p) => {
      const existe = p.some((d) => d.jour === jour && d.plage === plage);
      return existe ? p.filter((d) => !(d.jour === jour && d.plage === plage)) : [...p, { jour, plage }];
    });
  };

  const isDispo = (jour: string, plage: string) =>
    disponibilites.some((d) => d.jour === jour && d.plage === plage);

  const canContinue = estVolontaire === false ||
    (estVolontaire === true && sujets.length > 0 && disponibilites.length > 0);

  // Récapitulatif
  const recap = estVolontaire
    ? `Rendez-vous de ${duree} min en ${format.toLowerCase()}, ${disponibilites.length} plage(s) par semaine, maximum ${maxRdvMois === null ? "sans limite" : maxRdvMois + " par mois"}. Modifiable à tout moment depuis votre profil.`
    : "";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-sable-100">
      <h2 className="font-display text-2xl font-bold text-terre mb-1">Le mentorat</h2>
      <p className="text-sm text-terre-300 mb-6">
        Les volontaires Mali Wuli partagent leur expérience lors d'appels vidéo avec des jeunes ou des membres
        en questionnement, selon leurs disponibilités.
      </p>

      {/* Choix oui / non */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setEstVolontaire(true)}
          className={`p-4 rounded-xl border-2 text-left transition-colors
            ${estVolontaire === true
              ? "border-vert bg-vert-50"
              : "border-sable-200 bg-white hover:border-vert"}`}
        >
          <p className={`font-semibold text-sm mb-1 ${estVolontaire === true ? "text-vert" : "text-terre"}`}>
            Oui, je veux mentorer
          </p>
          <p className="text-xs text-terre-300">J'ouvre des créneaux et je réponds aux demandes.</p>
        </button>
        <button
          type="button"
          onClick={() => setEstVolontaire(false)}
          className={`p-4 rounded-xl border-2 text-left transition-colors
            ${estVolontaire === false
              ? "border-terre bg-sable-50"
              : "border-sable-200 bg-white hover:border-terre"}`}
        >
          <p className={`font-semibold text-sm mb-1 ${estVolontaire === false ? "text-terre" : "text-terre"}`}>
            Pas pour l'instant
          </p>
          <p className="text-xs text-terre-300">Je rejoins le réseau sans ouvrir de créneaux.</p>
        </button>
      </div>

      {/* Formulaire volontaire */}
      {estVolontaire === true && (
        <div className="space-y-6">

          {/* Sujets */}
          <div>
            <h3 className="font-semibold text-terre mb-1">Sur quoi pouvez-vous aider ?</h3>
            <p className="text-xs text-terre-300 mb-3">Deux ou trois suffisent, c'est ce qui apparaîtra sur votre profil.</p>
            <div className="flex flex-wrap gap-2">
              {SUJETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSujet(s)}
                  className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors
                    ${sujets.includes(s)
                      ? "bg-vert text-white border-vert"
                      : "bg-white text-terre border-sable-200 hover:border-vert"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Durée + Format */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-terre mb-3">Durée d'un rendez-vous</h3>
              <div className="flex gap-2">
                {DUREES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuree(d)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors
                      ${duree === d
                        ? "bg-terre text-white border-terre"
                        : "bg-white text-terre border-sable-200 hover:border-terre"}`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-terre mb-3">Format</h3>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors
                      ${format === f
                        ? "bg-vert-50 text-vert border-vert"
                        : "bg-white text-terre border-sable-200 hover:border-vert"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Disponibilités */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-terre">Vos disponibilités</h3>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                disponibilites.length > 0
                  ? "bg-vert-100 text-vert"
                  : "bg-sable-100 text-terre-300"
              }`}>
                {disponibilites.length > 0 ? `${disponibilites.length} plage(s) ouverte(s)` : "Aucune plage ouverte"}
              </span>
            </div>
            <p className="text-xs text-terre-300 mb-3">Cochez les plages où l'on peut vous appeler. Heures de Bamako (GMT).</p>

            <div className="border border-sable-200 rounded-xl overflow-hidden">
              {/* En-tête */}
              <div className="grid grid-cols-4 bg-sable-50 border-b border-sable-200">
                <div className="px-4 py-2 text-xs font-semibold text-terre-300 uppercase tracking-wide">Jour</div>
                {PLAGES.map((p) => (
                  <div key={p.label} className="px-4 py-2 text-xs font-semibold text-terre text-center">{p.label}</div>
                ))}
              </div>

              {/* Lignes */}
              {JOURS.map((jour, ji) => (
                <div
                  key={jour}
                  className={`grid grid-cols-4 border-b last:border-b-0 border-sable-100 ${
                    ji % 2 === 0 ? "bg-white" : "bg-sable-50/50"
                  }`}
                >
                  <div className="px-4 py-3 text-sm font-semibold text-terre flex items-center">{jour}</div>
                  {PLAGES.map((plage) => {
                    const actif = isDispo(jour, plage.label);
                    return (
                      <div key={plage.label} className="px-4 py-3 flex items-center justify-center">
                        <label className={`flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 transition-colors ${
                          actif ? "bg-vert-50" : ""
                        }`}>
                          <input
                            type="checkbox"
                            checked={actif}
                            onChange={() => toggleDispo(jour, plage.label)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${
                            actif ? "bg-vert border-vert" : "border-sable-200 bg-white"
                          }`}>
                            {actif && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-xs whitespace-nowrap ${
                            actif ? "text-vert font-semibold" : "text-terre-300"
                          }`}>
                            {plage.horaire}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Max RDV par mois */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-terre">Pas plus de</span>
            {MAX_RDV.map((val) => (
              <button
                key={val ?? "illimite"}
                type="button"
                onClick={() => setMaxRdvMois(val)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors
                  ${maxRdvMois === val
                    ? "bg-terre text-white border-terre"
                    : "bg-white text-terre border-sable-200 hover:border-terre"}`}
              >
                {val === null ? "Sans limite" : val}
              </button>
            ))}
            <span className="text-sm text-terre">rendez-vous par mois.</span>
          </div>

          {/* Récapitulatif */}
          {disponibilites.length > 0 && (
            <div className="bg-sable-100 border border-sable-200 rounded-xl px-4 py-3 text-sm text-terre-300">
              <span className="font-medium text-terre">Récapitulatif : </span>{recap}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-sable-100">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-sable-200 text-terre text-sm font-medium hover:bg-sable-100 transition-colors"
        >
          Retour
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() =>
            canContinue &&
            onNext({ estVolontaire: estVolontaire!, sujets, duree, format, disponibilites, maxRdvMois })
          }
          className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-colors
            ${canContinue ? "bg-vert hover:bg-vert-500 cursor-pointer" : "bg-sable-200 cursor-not-allowed"}`}
        >
          Terminer mon inscription
        </button>
      </div>
    </div>
  );
}

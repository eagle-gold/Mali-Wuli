"use client";

import { useState } from "react";
import StarRating from "./StarRating";

export interface Formation {
  id: string;
  type: "ecole" | "lycee" | "universite";
  pays: string;
  ville: string;
  etablissement: string;
  anneeDebut: string;
  anneeFin: string;
  diplomeObtenu: boolean;
  anneePromo: string;
  noteEnseignants: number | null;
  noteContenu: number | null;
  noteCadre: number | null;
  noteInsertion: number | null;
  commentaire: string;
}

interface StepFormationsProps {
  onNext: (data: Formation[]) => void;
  onBack: () => void;
  initialData?: Formation[];
}

const TYPE_LABELS = { ecole: "ÉCOLE", lycee: "LYCÉE", universite: "UNIVERSITÉ" };

const PAYS = ["Mali", "France", "Canada", "Sénégal", "Côte d'Ivoire", "Maroc", "États-Unis", "Belgique", "Autre"];

function FormationCard({ formation, onRetirer }: { formation: Formation; onRetirer: () => void }) {
  const initiales = formation.etablissement.slice(0, 2).toUpperCase();
  const moyenneNotes = [formation.noteEnseignants, formation.noteContenu, formation.noteCadre, formation.noteInsertion]
    .filter((n) => n !== null) as number[];
  const moyenne = moyenneNotes.length > 0 ? (moyenneNotes.reduce((a, b) => a + b, 0) / moyenneNotes.length).toFixed(1) : null;

  return (
    <div className="border border-sable-200 rounded-xl p-4 mb-3 bg-white flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-sable-200 flex items-center justify-center text-xs font-bold text-terre flex-shrink-0">
        {initiales}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-semibold text-terre text-sm">{formation.etablissement}</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-sable-100 text-terre-300 font-medium">
              {TYPE_LABELS[formation.type]}
            </span>
            {formation.diplomeObtenu && (
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-vert-100 text-vert font-medium">
                DIPLÔME OBTENU
              </span>
            )}
          </div>
          <button onClick={onRetirer} className="text-xs text-terre-300 hover:text-laterite flex-shrink-0">
            Retirer
          </button>
        </div>
        <p className="text-xs text-terre-300 mt-0.5">
          {formation.ville}, {formation.pays} · {formation.anneeDebut} – {formation.anneeFin || "aujourd'hui"}
          {formation.anneePromo && ` · promo ${formation.anneePromo}`}
        </p>
        {moyenne && (
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <svg key={s} className={`w-3.5 h-3.5 ${s <= Math.round(parseFloat(moyenne)) ? "text-yellow-400" : "text-sable-200"}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            <span className="text-xs text-terre-300 ml-1">{moyenne}/5</span>
          </div>
        )}
        {formation.commentaire && (
          <p className="text-xs text-terre-300 mt-1 italic">« {formation.commentaire} »</p>
        )}
      </div>
    </div>
  );
}

function FormationForm({
  type,
  onSave,
  onCancel,
}: {
  type: "ecole" | "lycee" | "universite";
  onSave: (f: Formation) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Formation, "id">>({
    type,
    pays: "Mali",
    ville: "",
    etablissement: "",
    anneeDebut: "",
    anneeFin: "",
    diplomeObtenu: true,
    anneePromo: "",
    noteEnseignants: null,
    noteContenu: null,
    noteCadre: null,
    noteInsertion: null,
    commentaire: "",
  });

  const set = (field: keyof typeof form, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  const titres = { ecole: "École fréquentée", lycee: "Lycée fréquenté", universite: "Université ou école privée" };

  const canSave =
    form.pays && form.ville && form.etablissement && form.anneeDebut &&
    (form.noteEnseignants !== null || form.noteContenu !== null);

  return (
    <div className="border border-sable-200 rounded-xl p-5 mb-4 bg-sable-50">
      <h3 className="font-semibold text-terre mb-1">{titres[type]}</h3>
      <p className="text-xs text-terre-300 mb-4">Commencez par le lieu : la liste des établissements se met à jour en fonction.</p>

      {/* Pays + Ville */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-terre mb-1">Pays</label>
          <select
            value={form.pays}
            onChange={(e) => set("pays", e.target.value)}
            className="w-full border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          >
            {PAYS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-terre mb-1">Ville</label>
          <input
            type="text"
            value={form.ville}
            onChange={(e) => set("ville", e.target.value)}
            placeholder="Choisissez la ville"
            className="w-full border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          />
        </div>
      </div>

      {/* Établissement */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-terre mb-1">
          Nom de l'établissement · <span className="font-normal text-terre-300">choisissez d'abord la ville</span>
        </label>
        <input
          type="text"
          value={form.etablissement}
          onChange={(e) => set("etablissement", e.target.value)}
          placeholder="Choisissez l'établissement"
          className="w-full border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
        />
      </div>

      {/* Années */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-terre mb-1">Années</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={form.anneeDebut}
            onChange={(e) => set("anneeDebut", e.target.value)}
            placeholder="2014"
            className="flex-1 border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          />
          <span className="text-terre-300">→</span>
          <input
            type="number"
            value={form.anneeFin}
            onChange={(e) => set("anneeFin", e.target.value)}
            placeholder="2018"
            className="flex-1 border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
          />
        </div>
      </div>

      {/* Diplôme */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-terre mb-2">Diplôme obtenu ?</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set("diplomeObtenu", true)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border
              ${form.diplomeObtenu ? "bg-vert text-white border-vert" : "bg-white text-terre border-sable-200"}`}
          >
            Oui, diplôme obtenu
          </button>
          <button
            type="button"
            onClick={() => set("diplomeObtenu", false)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border
              ${!form.diplomeObtenu ? "bg-vert text-white border-vert" : "bg-white text-terre border-sable-200"}`}
          >
            Non / en cours
          </button>
        </div>
        {form.diplomeObtenu && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-terre mb-1">Année de votre promotion</label>
            <input
              type="number"
              value={form.anneePromo}
              onChange={(e) => set("anneePromo", e.target.value)}
              placeholder="2018"
              className="w-40 border border-sable-200 rounded-xl px-3 py-2.5 text-sm text-terre bg-white focus:outline-none focus:ring-2 focus:ring-vert"
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mb-4">
        <h4 className="font-semibold text-terre text-sm mb-0.5">Votre avis sur cette formation</h4>
        <p className="text-xs text-terre-300 mb-3">3 notes sur 5, puis un mot sur votre expérience. Ces avis sont visibles par les lycéens et étudiants du réseau.</p>
        <div className="divide-y divide-sable-100">
          <StarRating label="Qualité des enseignants" description="Compétence, disponibilité, suivi" value={form.noteEnseignants} onChange={(v) => set("noteEnseignants", v)} />
          <StarRating label="Contenu de la formation" description="Programme, niveau, utilité réelle" value={form.noteContenu} onChange={(v) => set("noteContenu", v)} />
          <StarRating label="Cadre & équipements" description="Locaux, bibliothèque, labos, vie étudiante" value={form.noteCadre} onChange={(v) => set("noteCadre", v)} />
          <StarRating label="Insertion professionnelle" description="Débouchés, réseau, reconnaissance du diplôme" value={form.noteInsertion} onChange={(v) => set("noteInsertion", v)} />
        </div>
      </div>

      {/* Commentaire */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-terre mb-1">Commentaire global sur votre expérience</label>
        <textarea
          value={form.commentaire}
          onChange={(e) => set("commentaire", e.target.value)}
          placeholder="Ce que vous diriez à quelqu'un qui hésite à s'y inscrire..."
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
          Enregistrer cette formation
        </button>
      </div>
      {!canSave && (
        <p className="text-xs text-terre-300 mt-2">
          Lieu, établissement, diplôme (et année de promo), les notes et le commentaire sont nécessaires pour enregistrer.
        </p>
      )}
    </div>
  );
}

export default function StepFormations({ onNext, onBack, initialData }: StepFormationsProps) {
  const [formations, setFormations] = useState<Formation[]>(initialData || []);
  const [formOuvert, setFormOuvert] = useState<"ecole" | "lycee" | "universite" | null>(null);

  const handleSave = (f: Formation) => {
    setFormations((p) => [...p, f]);
    setFormOuvert(null);
  };

  const handleRetirer = (id: string) => {
    setFormations((p) => p.filter((f) => f.id !== id));
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-sable-100">
      <h2 className="font-display text-2xl font-bold text-terre mb-1">Votre parcours de formation</h2>
      <p className="text-sm text-terre-300 mb-6">
        Ajoutez vos établissements, école, lycée, université ou école privée. Pour chacun, quelques notes et un commentaire :
        c'est ce qui construit le guide d'orientation du réseau.
      </p>

      {/* Formations ajoutées */}
      {formations.map((f) => (
        <FormationCard key={f.id} formation={f} onRetirer={() => handleRetirer(f.id)} />
      ))}

      {/* Formulaire ouvert */}
      {formOuvert && (
        <FormationForm type={formOuvert} onSave={handleSave} onCancel={() => setFormOuvert(null)} />
      )}

      {/* Boutons d'ajout */}
      {!formOuvert && (
        <div className="flex flex-wrap gap-2 mb-6">
          {(["ecole", "lycee", "universite"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormOuvert(type)}
              className="px-4 py-2 rounded-xl border border-sable-200 text-sm text-terre font-medium hover:border-vert hover:text-vert transition-colors"
            >
              + Ajouter {type === "ecole" ? "une école" : type === "lycee" ? "un lycée" : "une université ou école privée"}
            </button>
          ))}
        </div>
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
          onClick={() => onNext(formations)}
          className="flex-1 py-3 rounded-xl font-semibold text-sm transition-colors bg-sable-300 text-white hover:bg-sable-400"
          style={{ backgroundColor: formations.length > 0 ? "#2e7d32" : "#b8a898" }}
        >
          {formations.length > 0 ? "Continuer vers les expériences" : "Passer cette étape"}
        </button>
      </div>
    </div>
  );
}

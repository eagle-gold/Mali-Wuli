// Offres d'emploi
export default function OffresPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-terre">Offres d'emploi</h1>
        <button className="btn-primary text-sm">Déposer une offre</button>
      </div>
      {/* Filtres */}
      <div className="card flex flex-wrap gap-3">
        <select className="border border-sable-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les types</option>
          <option>CDI</option>
          <option>CDD</option>
          <option>Stage</option>
          <option>Alternance</option>
          <option>Freelance</option>
        </select>
        <select className="border border-sable-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les secteurs</option>
        </select>
        <select className="border border-sable-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les pays</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-terre cursor-pointer">
          <input type="checkbox" /> Télétravail
        </label>
      </div>
      {/* Liste offres */}
      <div className="space-y-4">
        <div className="card text-terre-300 text-sm italic">
          Aucune offre disponible pour le moment.
        </div>
      </div>
    </div>
  );
}

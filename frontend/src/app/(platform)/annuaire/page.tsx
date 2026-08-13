// Annuaire des membres
export default function AnnuairePage() {
  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-bold text-terre mb-6">Annuaire</h1>
      {/* Filtres */}
      <div className="card mb-6 flex flex-wrap gap-3">
        <input type="text" placeholder="Rechercher un membre..." className="border border-sable-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]" />
        <select className="border border-sable-200 rounded-lg px-3 py-2">
          <option value="">Tous les pays</option>
        </select>
        <select className="border border-sable-200 rounded-lg px-3 py-2">
          <option value="">Tous les secteurs</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-terre cursor-pointer">
          <input type="checkbox" /> Volontaires uniquement
        </label>
      </div>
      {/* Liste membres */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card text-terre-300 text-sm italic col-span-full">
          Aucun membre trouvé.
        </div>
      </div>
    </div>
  );
}

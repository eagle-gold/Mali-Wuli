// Volontaires — mentorat
export default function VolontairesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-terre">Volontaires</h1>
        <button className="btn-primary text-sm">Devenir volontaire</button>
      </div>
      {/* Filtres */}
      <div className="card flex flex-wrap gap-3">
        <select className="border border-sable-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Toutes les spécialités</option>
        </select>
        <select className="border border-sable-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les secteurs</option>
        </select>
      </div>
      {/* Liste volontaires */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card text-terre-300 text-sm italic col-span-full">
          Aucun volontaire disponible pour le moment.
        </div>
      </div>
    </div>
  );
}

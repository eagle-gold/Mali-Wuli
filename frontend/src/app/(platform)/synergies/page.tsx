// Synergies — mises en relation
export default function SynergiesPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold text-terre">Synergies</h1>
      <div className="flex gap-4 border-b border-sable-200 pb-2">
        {["Mes synergies", "Demandes", "Suggestions"].map((tab) => (
          <button key={tab} className="text-sm font-medium text-terre-300 hover:text-vert pb-2 border-b-2 border-transparent hover:border-vert transition-all">
            {tab}
          </button>
        ))}
      </div>
      <div className="card text-terre-300 text-sm italic">
        Aucune synergie pour le moment. Découvrez les suggestions !
      </div>
    </div>
  );
}

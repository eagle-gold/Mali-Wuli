// Événements — en ligne et présentiel
export default function EvenementsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-terre">Événements</h1>
        <button className="btn-primary text-sm">Proposer un événement</button>
      </div>
      <div className="flex gap-4 border-b border-sable-200 pb-2">
        {["À venir", "Passés"].map((tab) => (
          <button key={tab} className="text-sm font-medium text-terre-300 hover:text-vert pb-2 border-b-2 border-transparent hover:border-vert">
            {tab}
          </button>
        ))}
      </div>
      <div className="card text-terre-300 text-sm italic">
        Aucun événement à venir.
      </div>
    </div>
  );
}

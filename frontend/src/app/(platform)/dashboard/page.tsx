// Tableau de bord — espace membre
export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold text-terre">
        Bonjour 👋
      </h1>
      {/* Annonces épinglées */}
      <section>
        <h2 className="text-lg font-semibold text-terre mb-3">Annonces</h2>
        <div className="card text-terre-300 text-sm italic">Aucune annonce pour le moment.</div>
      </section>
      {/* Suggestions de synergies */}
      <section>
        <h2 className="text-lg font-semibold text-terre mb-3">Suggestions de synergies</h2>
        <div className="card text-terre-300 text-sm italic">Aucune suggestion pour le moment.</div>
      </section>
      {/* Prochains RDV */}
      <section>
        <h2 className="text-lg font-semibold text-terre mb-3">Prochains rendez-vous</h2>
        <div className="card text-terre-300 text-sm italic">Aucun rendez-vous prévu.</div>
      </section>
    </div>
  );
}

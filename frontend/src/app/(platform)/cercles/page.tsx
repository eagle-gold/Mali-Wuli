// Cercles — think tanks thématiques
export default function CerclesPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold text-terre">Cercles</h1>
      <p className="text-terre-300 text-sm">
        Les cercles sont des groupes de réflexion thématiques (santé, tech, éducation, entrepreneuriat…).
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card text-terre-300 text-sm italic col-span-full">
          Aucun cercle disponible pour le moment.
        </div>
      </div>
    </div>
  );
}

// Espace administration — réservé à l'équipe Mali Wuli
export default function AdminPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold text-terre">Administration</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "Inscriptions en attente", count: 0, href: "/admin/inscriptions" },
          { title: "Offres à valider", count: 0, href: "/admin/offres" },
          { title: "Événements à valider", count: 0, href: "/admin/evenements" },
          { title: "Photos à valider", count: 0, href: "/admin/photos" },
          { title: "Signalements", count: 0, href: "/admin/signalements" },
          { title: "Membres", count: 0, href: "/admin/membres" },
          { title: "Cercles", count: 0, href: "/admin/cercles" },
          { title: "Établissements", count: 0, href: "/admin/etablissements" },
          { title: "Statistiques", count: null, href: "/admin/stats" },
        ].map((item) => (
          <a key={item.href} href={item.href} className="card hover:border-vert transition-colors cursor-pointer">
            <p className="font-semibold text-terre">{item.title}</p>
            {item.count !== null && (
              <p className="text-3xl font-bold text-vert mt-2">{item.count}</p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

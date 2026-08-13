// Page vitrine publique — accessible à tous les visiteurs

export default function HomePage() {
  return (
    <main className="min-h-screen bg-sable-50">
      {/* HERO */}
      <section className="bg-terre text-white py-20 px-6 text-center">
        <h1 className="font-display text-4xl md:text-6xl font-bold mb-4">
          Mali Wuli
        </h1>
        <p className="text-sable-200 text-lg md:text-xl max-w-2xl mx-auto mb-8">
          « Le réseau qui unit les talents du Mali et de sa diaspora. »
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/register" className="btn-primary text-center">
            Rejoindre la communauté
          </a>
          <a href="/login" className="btn-secondary text-center">
            Se connecter
          </a>
        </div>
      </section>

      {/* CHIFFRES */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "Membres", value: "0" },
            { label: "Pays représentés", value: "0" },
            { label: "Volontaires", value: "0" },
            { label: "Cercles", value: "0" },
          ].map((stat) => (
            <div key={stat.label} className="card">
              <p className="text-4xl font-bold text-vert">{stat.value}</p>
              <p className="text-terre mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold text-terre mb-12">
            Comment ça marche ?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Je m'inscris", desc: "Crée ton profil en 5 minutes." },
              { step: "2", title: "L'équipe valide", desc: "Chaque profil est vérifié avant d'accéder à la communauté." },
              { step: "3", title: "Je crée mes synergies", desc: "Connecte-toi, trouve un mentor, rejoins un cercle." },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-vert text-white flex items-center justify-center text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-terre text-lg">{item.title}</h3>
                <p className="text-terre-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-terre text-sable-100 py-8 px-6 text-center text-sm">
        <p>© 2026 Mali Wuli — Projet Amélioration du Capital Humain Malien</p>
        <div className="flex justify-center gap-6 mt-3">
          <a href="/cgu" className="hover:text-white">CGU</a>
          <a href="/confidentialite" className="hover:text-white">Confidentialité</a>
          <a href="/contact" className="hover:text-white">Contact</a>
        </div>
      </footer>
    </main>
  );
}

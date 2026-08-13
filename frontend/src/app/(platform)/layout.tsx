// Layout de la plateforme — navigation mobile + sidebar desktop
import type { ReactNode } from "react";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-sable-50 flex flex-col">
      {/* Header */}
      <header className="bg-terre text-white h-16 flex items-center px-6 justify-between sticky top-0 z-50">
        <span className="font-display font-bold text-xl">Mali Wuli</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-sable-200">Mon profil</span>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <nav className="hidden md:flex flex-col w-56 bg-white border-r border-sable-200 p-4 gap-1 sticky top-16 h-[calc(100vh-64px)]">
          {[
            { label: "Accueil", href: "/dashboard" },
            { label: "Annuaire", href: "/annuaire" },
            { label: "Synergies", href: "/synergies" },
            { label: "Messages", href: "/messages" },
            { label: "Agenda", href: "/agenda" },
            { label: "Volontaires", href: "/volontaires" },
            { label: "Cercles", href: "/cercles" },
            { label: "Éducation", href: "/education" },
            { label: "Événements", href: "/evenements" },
            { label: "Offres", href: "/offres" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-lg text-sm text-terre hover:bg-sable-100 hover:text-vert transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Contenu principal */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Navigation mobile basse */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-sable-200 flex justify-around py-2 z-50">
        {[
          { label: "Accueil", href: "/dashboard" },
          { label: "Agenda", href: "/agenda" },
          { label: "Synergies", href: "/synergies" },
          { label: "Messages", href: "/messages" },
          { label: "+", href: "#" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex flex-col items-center text-xs text-terre-300 hover:text-vert"
          >
            <span className="text-lg">{item.label === "+" ? "➕" : ""}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

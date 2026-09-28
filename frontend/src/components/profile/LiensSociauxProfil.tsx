import { LOGOS_RESEAUX } from "./LogosReseaux";
import { liensSociauxAffichables, type ReseauxSociaux } from "@/lib/reseaux-sociaux";

export default function LiensSociauxProfil({ liens }: { liens: ReseauxSociaux }) {
  const reseaux = liensSociauxAffichables(liens);
  if (!reseaux.length) return null;
  return <section className="min-w-0 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 sm:p-7" aria-label="Réseaux sociaux">
    <h2 className="font-display text-2xl font-bold leading-tight text-[#2e261f] sm:text-3xl">Réseaux sociaux</h2>
    <ul className="mt-4 flex flex-wrap gap-3">
      {reseaux.map(({ cle, nom, href }) => {
        const Logo = LOGOS_RESEAUX[cle];
        return <li key={cle}><a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dfc9a8] px-3 py-2 text-sm font-medium text-[#0d6738] transition hover:bg-[#f3eadd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d6738]">
          <Logo width={18} height={18} aria-hidden="true" className="shrink-0" /><span>{nom}</span><span className="sr-only"> (nouvel onglet)</span>
        </a></li>;
      })}
    </ul>
  </section>;
}

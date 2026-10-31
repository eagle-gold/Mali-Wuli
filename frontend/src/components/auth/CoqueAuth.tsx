import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import LogoMaliWuliImage from "@/components/LogoMaliWuliImage";

/**
 * Coque des écrans d'authentification : barre minimale, carte centrée,
 * progression facultative. Une seule tâche par écran.
 */
export default function CoqueAuth({
  titre,
  sousTitre,
  etape,
  lienHaut,
  children,
  pied,
}: {
  titre: string;
  sousTitre?: ReactNode;
  etape?: { courante: number; total: number; libelle?: string };
  lienHaut?: { texte: string; libelle: string; href: string };
  children: ReactNode;
  pied?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-page">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--mw-gold)/0.13),transparent_70%)]" />
      <header className="relative">
        <div className="mx-auto flex h-header max-w-6xl items-center justify-between gap-4 px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 rounded-xl focus-anneau" aria-label="Mali Wuli, accueil">
            <LogoMaliWuliImage compact />
            <span className="font-display text-xl font-bold tracking-tight text-ink">Mali Wuli</span>
          </Link>
          {lienHaut && (
            <p className="text-sm text-ink-muted">
              <span className="hidden sm:inline">{lienHaut.texte} </span>
              <Link href={lienHaut.href} className="rounded font-semibold text-brand underline-offset-4 hover:underline focus-anneau">{lienHaut.libelle}</Link>
            </p>
          )}
        </div>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-8">
        <div className="w-full max-w-[448px] animate-apparition">
          <section aria-labelledby="titre-auth" className="rounded-3xl border border-line-soft bg-surface-raised px-6 py-8 shadow-raised sm:px-10 sm:py-10">
            {etape && (
              <div className="mb-7">
                <div className="flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: etape.total }, (_, index) => (
                    <span key={index} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${index < etape.courante ? "bg-brand" : "bg-line-soft"}`} />
                  ))}
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Étape {etape.courante} sur {etape.total}{etape.libelle ? ` · ${etape.libelle}` : ""}
                </p>
              </div>
            )}
            <h1 id="titre-auth" className="font-display text-[1.85rem] font-bold leading-tight tracking-tight text-ink sm:text-[2.1rem]">{titre}</h1>
            {sousTitre && <div className="mt-2.5 text-[15px] leading-relaxed text-ink-muted">{sousTitre}</div>}
            <div className="mt-8">{children}</div>
          </section>
          {pied && <div className="mt-6 text-center text-sm text-ink-muted">{pied}</div>}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            <LockKeyhole size={13} aria-hidden="true" />
            Votre profil n’est visible que des membres connectés.
          </p>
        </div>
      </main>
    </div>
  );
}

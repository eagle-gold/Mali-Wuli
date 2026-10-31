import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import LogoMaliWuliImage from "@/components/LogoMaliWuliImage";
import { EtatPage } from "@/components/ui/EtatPage";
import { classesBouton } from "@/components/ui/classes";

export const metadata: Metadata = { title: "Page introuvable — Mali Wuli", robots: { index: false } };

export default function PageIntrouvable() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-page px-5">
      <Link href="/" aria-label="Accueil Mali Wuli" className="mb-4 rounded-xl focus-anneau"><LogoMaliWuliImage /></Link>
      <p className="font-display text-7xl font-bold text-brand/20" aria-hidden="true">404</p>
      <EtatPage
        icone={<Compass size={26} />}
        titre="Cette page s’est égarée"
        actions={<>
          <Link href="/" className={classesBouton()}>Retour à l’accueil</Link>
          <Link href="/dashboard" className={classesBouton({ variante: "secondaire" })}>Mon espace</Link>
        </>}
      >
        Le lien est peut-être incorrect ou la page a été déplacée.
      </EtatPage>
    </main>
  );
}

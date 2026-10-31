"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { EtatPage } from "@/components/ui/EtatPage";
import { classesBouton } from "@/components/ui/classes";

/** Erreur inattendue dans une page : l'en-tête et la navigation restent disponibles. */
export default function ErreurPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-page px-5">
      <EtatPage
        role="alert"
        icone={<TriangleAlert size={26} />}
        titre="Un problème est survenu"
        actions={<>
          <button type="button" onClick={reset} className={classesBouton()}><RefreshCw size={16} aria-hidden="true" />Réessayer</button>
          <Link href="/" className={classesBouton({ variante: "secondaire" })}>Retour à l’accueil</Link>
        </>}
      >
        La page n’a pas pu s’afficher. Réessayez ; si le problème persiste, revenez un peu plus tard.
        {error.digest && <span className="mt-2 block text-xs">Référence : {error.digest}</span>}
      </EtatPage>
    </main>
  );
}

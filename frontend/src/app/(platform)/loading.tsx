import { Squelette } from "@/components/ui/EtatPage";

/** Chargement d'une page membre : silhouette de contenu plutôt qu'un simple indicateur. */
export default function ChargementPageMembre() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <span className="sr-only">Chargement de la page…</span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-2xl border border-line-soft bg-surface p-5 shadow-card">
          <div className="flex items-center gap-3">
            <Squelette className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2"><Squelette className="h-4 w-1/3" /><Squelette className="h-3 w-1/4" /></div>
          </div>
          <Squelette className="mt-5 h-3 w-full" />
          <Squelette className="mt-2 h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}

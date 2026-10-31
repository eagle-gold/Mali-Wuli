"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import LogoMaliWuliImage from "@/components/LogoMaliWuliImage";
import { fermerSocket } from "@/hooks/useSocket";
import { terminerSession } from "@/lib/session";

/** En-tête du questionnaire de profil : une seule tâche, pas de navigation du site. */
export default function EnTeteOnboarding() {
  const router = useRouter();
  const deconnecter = () => {
    fermerSocket();
    terminerSession();
    localStorage.removeItem("mali_wuli_registration_token");
    router.replace("/login");
  };
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-page/90 backdrop-blur-md">
      <div className="mx-auto flex h-header max-w-6xl items-center justify-between gap-4 px-5 lg:px-8">
        <div className="flex items-center gap-2.5">
          <LogoMaliWuliImage compact />
          <span className="font-display text-xl font-bold tracking-tight text-ink">Mali Wuli</span>
          <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <span className="hidden text-sm font-medium text-ink-muted sm:block">Création de votre profil</span>
        </div>
        <button type="button" onClick={deconnecter} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink-soft transition hover:bg-surface-sunken hover:text-ink focus-anneau">
          <LogOut size={16} aria-hidden="true" />
          <span>Se déconnecter</span>
        </button>
      </div>
    </header>
  );
}

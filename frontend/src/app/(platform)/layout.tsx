// Layout de la plateforme — navigation mobile + sidebar desktop
import type { ReactNode } from "react";
import Link from "next/link";
import { MemberHeader } from "@/components/MaliWuliHeader";
import PlatformAuthGuard from "@/components/auth/PlatformAuthGuard";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformAuthGuard>
      <div className="min-h-screen min-h-dvh min-w-0 bg-[var(--color-page)] flex flex-col">
        <MemberHeader />

        <main className="min-w-0 flex-1 bg-[var(--color-page)] pb-20 md:pb-0">
          {children}
        </main>

        {/* Navigation mobile basse */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-sable-200 flex justify-around py-2 z-50">
          {[
            { label: "Accueil", href: "/dashboard" },
            { label: "Agenda", href: "/agenda" },
            { label: "Messages", href: "/messages" },
            { label: "Profil", href: "/profil" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center text-xs text-terre-300 hover:text-vert"
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </PlatformAuthGuard>
  );
}

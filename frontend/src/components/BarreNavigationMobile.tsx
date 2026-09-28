"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Home, MessageCircle, UserRound } from "lucide-react";

const LIENS = [
  { label: "Accueil", href: "/dashboard", Icone: Home },
  { label: "Offres", href: "/offres", Icone: BriefcaseBusiness },
  { label: "Messages", href: "/messages", Icone: MessageCircle },
  { label: "Profil", href: "/profil", Icone: UserRound },
];

/** Navigation principale du téléphone et de la tablette ; le bureau utilise l'en-tête. */
export default function BarreNavigationMobile() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-[#e4d2b3] bg-[#fffbf5] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {LIENS.map(({ label, href, Icone }) => {
        const actif = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0d6738] ${
              actif ? "text-[#0d6738]" : "text-[#8a6f55] hover:text-[#0d6738]"
            }`}
          >
            <Icone aria-hidden="true" size={22} strokeWidth={actif ? 2.4 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

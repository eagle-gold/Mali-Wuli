"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Home, MessageCircle, UserRound, UsersRound } from "lucide-react";
import { libellePastille, useMessagesNonLus } from "@/lib/compteur-messages";
import { rubriqueActive } from "@/lib/navigation";

const LIENS = [
  { label: "Accueil", href: "/dashboard", Icone: Home },
  { label: "Annuaire", href: "/annuaire", Icone: UsersRound },
  { label: "Offres", href: "/offres", Icone: BriefcaseBusiness },
  { label: "Messages", href: "/messages", Icone: MessageCircle },
  { label: "Profil", href: "/profil", Icone: UserRound },
];

/** Navigation principale du téléphone et de la tablette ; le bureau utilise l'en-tête. */
export default function BarreNavigationMobile() {
  const pathname = usePathname();
  const messagesNonLus = useMessagesNonLus();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(var(--mw-ink)/0.25)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {LIENS.map(({ label, href, Icone }) => {
          const actif = rubriqueActive(pathname, href);
          const pastille = href === "/messages" && messagesNonLus > 0;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                aria-label={pastille ? `${label}, ${messagesNonLus} non lus` : undefined}
                className={`group flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                  actif ? "text-brand" : "text-ink-muted hover:text-brand"
                }`}
              >
                <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition ${actif ? "bg-brand-50" : "group-hover:bg-surface-sunken"}`}>
                  <Icone aria-hidden="true" size={21} strokeWidth={actif ? 2.4 : 2} />
                  {pastille && (
                    <span aria-hidden="true" className="absolute right-1.5 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white ring-2 ring-surface-raised">
                      {libellePastille(messagesNonLus)}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

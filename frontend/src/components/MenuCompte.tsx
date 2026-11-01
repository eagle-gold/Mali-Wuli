"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Pencil, ShieldCheck, Trash2, type LucideIcon, Settings } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import ImageAvecRepli from "@/components/ui/ImageAvecRepli";

type Props = {
  nom: string;
  titre?: string | null;
  initiales: string;
  photo: string | null;
  administration: boolean;
  onOuverture?: () => void;
  onDeconnexion: () => void;
};

function Avatar({ photo, initiales, taille }: { photo: string | null; initiales: string; taille: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: taille, height: taille }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4eee1] font-bold text-brand"
    >
      <ImageAvecRepli src={photo} width={taille} height={taille} className="h-full w-full object-cover" repli={initiales} />
    </span>
  );
}

function Entree({ href, Icone, libelle, onClick }: {
  href: string;
  Icone: LucideIcon;
  libelle: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink-soft transition hover:bg-surface-sunken hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Icone aria-hidden="true" size={18} className="shrink-0" />
      {libelle}
    </Link>
  );
}

/** Menu du compte façon LinkedIn : avatar + flèche, profil, corbeille, déconnexion. */
export default function MenuCompte({ nom, titre, initiales, photo, administration, onOuverture, onDeconnexion }: Props) {
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const idPanneau = useId();
  const profilActif = pathname === "/profil" || pathname.startsWith("/profil/");
  // Déjà dans le questionnaire : un lien vers lui-même ne ferait rien.
  const surQuestionnaire = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  useEffect(() => { setOuvert(false); }, [pathname]);

  useEffect(() => {
    if (!ouvert) return;
    const clicExterieur = (event: PointerEvent) => {
      if (!racine.current?.contains(event.target as Node)) setOuvert(false);
    };
    const echap = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOuvert(false);
      window.setTimeout(() => declencheur.current?.focus(), 0);
    };
    document.addEventListener("pointerdown", clicExterieur);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", clicExterieur);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  const fermer = () => setOuvert(false);

  return (
    <div ref={racine} className="relative hidden h-full items-center lg:flex">
      <button
        ref={declencheur}
        type="button"
        aria-haspopup="true"
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => {
          setOuvert((valeur) => {
            if (!valeur) onOuverture?.();
            return !valeur;
          });
        }}
        className="flex h-12 items-center gap-1 rounded-full pr-2 text-bark-text transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {/* Nom accessible en texte (et non aria-label) : les initiales visibles restent décoratives. */}
        <span className="sr-only">Menu du compte de {nom}</span>
        <span className={`flex rounded-full border-2 transition ${ouvert || profilActif ? "border-gold" : "border-white/25"}`}>
          <Avatar photo={photo} initiales={initiales} taille={44} />
        </span>
        <ChevronDown aria-hidden="true" size={18} className={`transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div
          id={idPanneau}
          className="absolute right-0 top-full z-50 mt-1 w-[320px] rounded-2xl border border-line bg-surface p-3 text-ink shadow-xl"
        >
          <div className="flex items-center gap-3 px-1 pb-3 pt-1">
            <Avatar photo={photo} initiales={initiales} taille={56} />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold leading-tight">{nom}</p>
              {titre ? <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink-muted">{titre}</p> : null}
            </div>
          </div>
          <Link
            href="/profil"
            onClick={fermer}
            className="flex min-h-10 w-full items-center justify-center rounded-full border border-brand px-4 text-sm font-bold text-brand transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Voir le profil
          </Link>

          <div className="mt-3 border-t border-[#eadfca] pt-3">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-[#9a8a76]">Compte</p>
            {!surQuestionnaire && <Entree href="/onboarding?etape=informations" Icone={Pencil} libelle="Modifier mes infos" onClick={fermer} />}
            <Entree href="/corbeille" Icone={Trash2} libelle="Corbeille" onClick={fermer} />
            <Entree href="/parametres" Icone={Settings} libelle="Paramètres et confidentialité" onClick={fermer} />
          </div>

          {administration && (
            <div className="mt-2 border-t border-[#eadfca] pt-3">
              <p className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-[#9a8a76]">Gérer</p>
              <Entree href="/admin" Icone={ShieldCheck} libelle="Administration" onClick={fermer} />
            </div>
          )}

          <div className="mt-2 border-t border-[#eadfca] pt-2">
            <button
              type="button"
              onClick={() => { fermer(); onDeconnexion(); }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-ink-soft transition hover:bg-surface-sunken hover:text-[#a22922] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <LogOut aria-hidden="true" size={18} className="shrink-0" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

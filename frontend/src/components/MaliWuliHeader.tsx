"use client";

import Image from "next/image";
import LogoMaliWuli from "@/components/LogoMaliWuliImage";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import MenuCompte from "@/components/MenuCompte";
import { titreMembre } from "@/lib/titre-membre";
import NotificationsPopover from "@/components/notifications/NotificationsPopover";
import { useSessionMembre } from "@/components/auth/SessionMembreContext";
import api from "@/lib/api";
import { EVENEMENT_SESSION, lireJetonSession, terminerSession, type CompteSession } from "@/lib/session";
import { aAccesAdministration, type AutorisationsUtilisateur } from "@/lib/autorisations";
import { urlMediaBackend } from "@/lib/media";
import { fermerSocket, useSocket } from "@/hooks/useSocket";
import { definirMessagesNonLus, libellePastille } from "@/lib/compteur-messages";
import { rubriqueActive } from "@/lib/navigation";
import { classesBouton } from "@/components/ui/classes";
import type {
  ConversationsResponseApi,
  MessageApi,
} from "@/types/api";

const LIENS_MEMBRE = [
  { label: "Accueil", href: "/dashboard", Icone: Home },
  { label: "Annuaire", href: "/annuaire", Icone: UsersRound },
  { label: "Événements", href: "/evenements", Icone: CalendarDays },
  { label: "Offres", href: "/offres", Icone: BriefcaseBusiness },
  { label: "Établissements", href: "/education", Icone: GraduationCap },
];

/** Rubriques déjà présentes dans la barre du bas (mobile et tablette). */
const HREFS_BARRE_MOBILE = new Set(["/dashboard", "/annuaire", "/offres"]);

function PastilleCompteur({ valeur, variante }: { valeur: number; variante: "orange" | "jaune" }) {
  if (valeur < 1) return null;
  return (
    <span
      aria-hidden="true"
      className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ring-2 ring-bark ${
        variante === "orange" ? "bg-clay text-white" : "bg-gold text-ink"
      }`}
    >
      {libellePastille(valeur)}
    </span>
  );
}

export function PublicHeader() {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const pathname = usePathname();
  // `null` permet de conserver exactement le meme rendu cote serveur et au
  // premier rendu client. Les boutons publics ne clignotent donc pas avant la
  // lecture de la session, stockee uniquement dans le navigateur.
  const [sessionLocalePresente, setSessionLocalePresente] = useState<boolean | null>(null);

  useEffect(() => {
    const actualiserSession = () => {
      setSessionLocalePresente(Boolean(lireJetonSession()));
    };

    const redevenirVisible = () => { if (document.visibilityState === "visible") actualiserSession(); };
    actualiserSession();
    window.addEventListener(EVENEMENT_SESSION, actualiserSession);
    window.addEventListener("pageshow", actualiserSession);
    document.addEventListener("visibilitychange", redevenirVisible);
    window.addEventListener("storage", actualiserSession);
    window.addEventListener("focus", actualiserSession);
    return () => {
      window.removeEventListener(EVENEMENT_SESSION, actualiserSession);
      window.removeEventListener("pageshow", actualiserSession);
      document.removeEventListener("visibilitychange", redevenirVisible);
      window.removeEventListener("storage", actualiserSession);
      window.removeEventListener("focus", actualiserSession);
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-bark-line/70 bg-bark text-[#f4eee1] shadow-card">
      <div className="mx-auto flex h-header w-full max-w-[1280px] items-center gap-5 px-4 sm:px-6 lg:gap-10 lg:px-8">
        <Link href="/" aria-label="Accueil Mali Wuli" className="flex shrink-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
          <LogoMaliWuli compact />
          <span className="font-display text-xl font-bold tracking-tight text-[#fdfaf3]">Mali Wuli</span>
        </Link>

        <div className="ml-auto hidden min-h-11 min-w-[280px] items-center justify-end gap-3 md:flex">
          {sessionLocalePresente === true ? (
            <>
              <Link
                href="/dashboard"
                className={classesBouton({ variante: "inverse" })}
              >
                Mon espace
              </Link>
              <Link
                href="/profil"
                aria-label="Ouvrir mon profil"
                title="Mon profil"
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/25 bg-[#f4eee1] text-brand transition hover:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <UserRound aria-hidden="true" size={24} />
              </Link>
            </>
          ) : sessionLocalePresente === false ? (
            <>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-surface transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-[15px]"
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                className={classesBouton({ variante: "inverse" })}
              >
                Créer mon profil
              </Link>
            </>
          ) : (
            <span aria-hidden="true" className="h-11 w-[280px]" />
          )}
        </div>

        <button
          type="button"
          aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOuvert}
          onClick={() => setMenuOuvert((ouvert) => !ouvert)}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-surface transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold md:hidden"
        >
          {menuOuvert ? <X size={23} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOuvert && (
        <div className="border-t border-white/15 bg-bark px-4 pb-5 pt-3 md:hidden">
          <nav aria-label="Accès au compte" className="mx-auto grid max-w-[720px] gap-1">
            {sessionLocalePresente === true ? (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/dashboard" onClick={() => setMenuOuvert(false)} className="rounded-full bg-brand px-4 py-3 text-center text-sm font-semibold text-white">
                  Mon espace
                </Link>
                <Link href="/profil" onClick={() => setMenuOuvert(false)} className="flex items-center justify-center gap-2 rounded-full border border-[#9a826b] px-4 py-3 text-center text-sm font-semibold">
                  <UserRound aria-hidden="true" size={18} />
                  Mon profil
                </Link>
              </div>
            ) : sessionLocalePresente === false ? (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/register" onClick={() => setMenuOuvert(false)} className="rounded-full border border-[#9a826b] px-4 py-3 text-center text-sm font-semibold">
                  Créer un compte
                </Link>
                <Link href="/login" onClick={() => setMenuOuvert(false)} className="rounded-full bg-brand px-4 py-3 text-center text-sm font-semibold text-white">
                  Se connecter
                </Link>
              </div>
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
}

function profilAffiche(data: CompteSession) {
  const utilisateur = data.user || data;
  const profil = data.profil || utilisateur.profil;
  const prenom = utilisateur.prenom?.trim() || "";
  const nom = utilisateur.nom?.trim() || "";
  return {
    utilisateur,
    nom: [prenom, nom].filter(Boolean).join(" ") || "Mon profil",
    initiales: `${prenom.charAt(0)}${nom.charAt(0)}`.toLocaleUpperCase("fr"),
    photo: urlMediaBackend(profil?.photo),
    titre: titreMembre(profil?.titre),
  };
}

export function MemberHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const sessionMembre = useSessionMembre();
  const actualiserSession = sessionMembre?.actualiser;
  const socket = useSocket();
  const [recherche, setRecherche] = useState("");
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [messagesNonLus, setMessagesNonLus] = useState(0);
  // Partir du compte déjà vérifié par le garde : pas d'initiales par défaut au premier rendu.
  const profilInitial = sessionMembre ? profilAffiche(sessionMembre.compte) : null;
  const [nomProfil, setNomProfil] = useState(profilInitial?.nom ?? "Mon profil");
  const [initialesProfil, setInitialesProfil] = useState(profilInitial?.initiales ?? "");
  const [autorisations, setAutorisations] = useState<AutorisationsUtilisateur | null>(profilInitial?.utilisateur ?? null);
  const [photoProfil, setPhotoProfil] = useState<string | null>(profilInitial?.photo ?? null);
  const [titreProfil, setTitreProfil] = useState<string | null>(profilInitial?.titre ?? null);
  const messagesConnus = useRef(new Set<string>());

  const appliquerProfil = useCallback((data: CompteSession) => {
      const affiche = profilAffiche(data);
      setAutorisations(affiche.utilisateur);
      setNomProfil(affiche.nom);
      setInitialesProfil(affiche.initiales);
      setPhotoProfil(affiche.photo);
      setTitreProfil(affiche.titre);
  }, []);

  useEffect(() => {
    if (sessionMembre) appliquerProfil(sessionMembre.compte);
  }, [sessionMembre?.compte, appliquerProfil]);

  const chargerProfil = useCallback(async () => {
    if (actualiserSession) { actualiserSession(); return; }
    // L'en-tête de l'onboarding n'est pas sous le garde de la plateforme.
    const jeton = lireJetonSession();
    if (!jeton) { setAutorisations(null); return; }
    try {
      const { data } = await api.get<CompteSession>("/users/me/session");
      if (lireJetonSession() !== jeton) return;
      appliquerProfil(data);
    } catch {
      if (lireJetonSession() !== jeton) return;
      setAutorisations(null);
      // Le lien profil reste disponible avec son avatar de secours.
    }
  }, [actualiserSession, appliquerProfil]);

  const chargerMessagesNonLus = useCallback(async () => {
    try {
      const { data } = await api.get<ConversationsResponseApi>("/messages/conversations");
      const total = (Array.isArray(data.conversations) ? data.conversations : [])
        .reduce((somme, conversation) => somme + Math.max(0, Number(conversation.nonLus) || 0), 0);
      setMessagesNonLus(total);
      definirMessagesNonLus(total);
    } catch {
      // Un compteur indisponible ne doit pas bloquer la navigation.
    }
  }, []);

  useEffect(() => {
    if (!actualiserSession) void chargerProfil();
    void chargerMessagesNonLus();
    setMenuOuvert(false);
  }, [actualiserSession, chargerMessagesNonLus, chargerProfil, pathname]);

  useEffect(() => {
    if (actualiserSession) return;
    const recontroler = () => { void chargerProfil(); };
    const redevenirVisible = () => { if (document.visibilityState === "visible") recontroler(); };
    window.addEventListener(EVENEMENT_SESSION, recontroler);
    window.addEventListener("pageshow", recontroler);
    document.addEventListener("visibilitychange", redevenirVisible);
    return () => {
      window.removeEventListener(EVENEMENT_SESSION, recontroler);
      window.removeEventListener("pageshow", recontroler);
      document.removeEventListener("visibilitychange", redevenirVisible);
    };
  }, [actualiserSession, chargerProfil]);

  useEffect(() => {
    const actualiser = () => void chargerMessagesNonLus();
    window.addEventListener("mali-wuli:messages-lus", actualiser);
    return () => window.removeEventListener("mali-wuli:messages-lus", actualiser);
  }, [chargerMessagesNonLus]);

  useEffect(() => {
    if (!socket) return;
    const recevoirMessage = (message: MessageApi) => {
      if (!message?.id || messagesConnus.current.has(message.id)) return;
      messagesConnus.current.add(message.id);
      void chargerMessagesNonLus();
    };
    const resynchroniser = () => {
      void chargerProfil();
      void chargerMessagesNonLus();
    };
    socket.on("nouveau_message", recevoirMessage);
    socket.on("message:created", recevoirMessage);
    socket.on("connect", resynchroniser);
    return () => {
      socket.off("nouveau_message", recevoirMessage);
      socket.off("message:created", recevoirMessage);
      socket.off("connect", resynchroniser);
    };
  }, [chargerMessagesNonLus, chargerProfil, socket]);

  const rechercher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMenuOuvert(false);
    const valeur = recherche.trim();
    router.push(valeur ? `/annuaire?recherche=${encodeURIComponent(valeur)}` : "/annuaire");
  };

  const liensMembre = aAccesAdministration(autorisations)
    ? [...LIENS_MEMBRE, { label: "Administration", href: "/admin", Icone: ShieldCheck }]
    : LIENS_MEMBRE;
  const estActif = (href: string) => rubriqueActive(pathname, href);
  const deconnecter = () => {
    fermerSocket();
    terminerSession();
    localStorage.removeItem("mali_wuli_registration_token");
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-bark-line/70 bg-bark text-bark-text shadow-card">
      <div className="mx-auto flex h-header w-full max-w-[1280px] items-center gap-3 px-3 sm:px-5 lg:gap-4 lg:px-6">
        <Link href="/dashboard" aria-label="Accueil Mali Wuli" className="shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
          <LogoMaliWuli compact />
        </Link>

        <form onSubmit={rechercher} role="search" className="relative hidden w-[240px] shrink-0 xl:block">
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#d7cab7]" />
          <input
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher sur Mali Wuli"
            aria-label="Rechercher sur Mali Wuli"
            className="h-10 w-full rounded-full border border-white/10 bg-bark-400/80 py-2 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[#d7cab7] hover:bg-bark-400 focus:border-gold focus:bg-bark-400 focus-visible:ring-2 focus-visible:ring-gold/30"
          />
        </form>

        <nav aria-label="Navigation membre" className="hidden h-full min-w-0 flex-1 items-stretch justify-center lg:flex">
          {liensMembre.map(({ label, href, Icone }) => {
            const actif = estActif(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={actif ? "page" : undefined}
                className={`group relative flex min-w-[76px] max-w-[112px] flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold ${
                  actif ? "text-gold" : "text-bark-text hover:text-white"
                }`}
              >
                <Icone aria-hidden="true" size={22} strokeWidth={actif ? 2.3 : 1.9} className="transition group-hover:-translate-y-px" />
                <span className="truncate">{label}</span>
                <span aria-hidden="true" className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-gold transition ${actif ? "opacity-100" : "opacity-0"}`} />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex h-full shrink-0 items-center gap-2 sm:gap-3 lg:ml-0">
          <Link
            href="/messages"
            aria-label={messagesNonLus > 0 ? `Messages, ${messagesNonLus} non lus` : "Messages"}
            aria-current={estActif("/messages") ? "page" : undefined}
            className={`relative hidden h-11 w-11 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:flex ${
              estActif("/messages") ? "bg-white/15 text-gold" : "bg-white/10 text-bark-text hover:bg-white/15 hover:text-white"
            }`}
          >
            <MessageCircle aria-hidden="true" size={21} />
            <PastilleCompteur valeur={messagesNonLus} variante="orange" />
          </Link>
          <NotificationsPopover onOpen={() => setMenuOuvert(false)} />
          <MenuCompte
            nom={nomProfil}
            titre={titreProfil}
            initiales={initialesProfil}
            photo={photoProfil}
            administration={aAccesAdministration(autorisations)}
            onOuverture={() => setMenuOuvert(false)}
            onDeconnexion={deconnecter}
          />
          <button
            type="button"
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOuvert}
            onClick={() => setMenuOuvert((ouvert) => !ouvert)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-bark-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:hidden"
          >
            {menuOuvert ? <X size={22} /> : <Menu size={23} />}
          </button>
        </div>
      </div>

      {menuOuvert && (
        <nav aria-label="Navigation membre mobile" className="grid max-h-[calc(100dvh-var(--mw-header-h))] grid-cols-2 gap-2 overflow-y-auto border-t border-white/15 bg-bark p-3 lg:hidden">
          <form onSubmit={rechercher} role="search" className="relative col-span-2 mb-2">
            <Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#d7cab7]" />
            <input type="search" value={recherche} onChange={(event) => setRecherche(event.target.value)}
              placeholder="Rechercher sur Mali Wuli" aria-label="Rechercher sur Mali Wuli"
              className="h-12 w-full min-w-0 rounded-full border border-white/20 bg-bark-400 py-3 pl-11 pr-4 text-base text-white outline-none placeholder:text-sm placeholder:text-[#d7cab7] focus:border-gold" />
          </form>
          {liensMembre.filter(({ href }) => !HREFS_BARRE_MOBILE.has(href)).map(({ label, href, Icone }) => {
            const actif = estActif(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOuvert(false)}
                aria-current={actif ? "page" : undefined}
                className={`flex min-w-0 items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold ${actif ? "bg-white/10 text-gold" : "text-[#f4eee1] hover:bg-white/5"}`}
              >
                <Icone aria-hidden="true" size={20} className="shrink-0" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/corbeille"
            onClick={() => setMenuOuvert(false)}
            aria-current={estActif("/corbeille") ? "page" : undefined}
            className={`flex min-w-0 items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold ${estActif("/corbeille") ? "bg-white/10 text-gold" : "text-[#f4eee1] hover:bg-white/5"}`}
          >
            <Trash2 aria-hidden="true" size={20} className="shrink-0" />
            Corbeille
          </Link>
          <button type="button" onClick={deconnecter} className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#f4eee1] hover:bg-white/5">
            <LogOut aria-hidden="true" size={20} />
            Se déconnecter
          </button>
        </nav>
      )}
    </header>
  );
}

export function AuthFlowHeader() {
  const pathname = usePathname();
  return pathname === "/onboarding" ? <MemberHeader /> : <PublicHeader />;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  Check,
  Clock3,
  Mail,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import {
  chargerPageNotificationsVisibles,
  lireNotificationsNonLuesVisibles,
  notificationEstVisible,
} from "@/lib/notifications";
import { useSocket } from "@/hooks/useSocket";
import type { NotificationApi, NotificationsResponseApi } from "@/types/api";

type TonNotification = "vert" | "orange" | "sable";

type PresentationNotification = {
  ton: TonNotification;
  Icone: LucideIcon;
  action?: "ouvrir";
};

const TONS: Record<TonNotification, string> = {
  vert: "bg-[#e3f1eb] text-[#0d6738]",
  orange: "bg-[#f8e4d8] text-[#bd592d]",
  sable: "bg-[#f1e6d4] text-[#765131]",
};

function presentationDe(type: string): PresentationNotification {
  switch (type) {
    case "NOUVEAU_MESSAGE":
      return { ton: "orange", Icone: Mail, action: "ouvrir" };
    case "RENDEZ_VOUS":
      return { ton: "vert", Icone: Clock3, action: "ouvrir" };
    case "EVENEMENT":
      return { ton: "sable", Icone: CalendarClock };
    case "OFFRE":
      return { ton: "sable", Icone: Star };
    case "NOUVELLE_REACTION":
      return { ton: "sable", Icone: Star };
    default:
      return { ton: "vert", Icone: Check };
  }
}

function ancienneteDe(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 2) return "maintenant";
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 7) return `${jours} j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

function hrefSecurise(href?: string | null) {
  return href?.startsWith("/") && !href.startsWith("//") ? href : undefined;
}

function texteErreur(erreur: unknown, secours: string) {
  const reponse = (erreur as { response?: { data?: { message?: unknown; error?: unknown } } })?.response?.data;
  if (typeof reponse?.message === "string") return reponse.message;
  if (typeof reponse?.error === "string") return reponse.error;
  return secours;
}

type NotificationsPopoverProps = {
  onOpen?: () => void;
};

export default function NotificationsPopover({ onOpen }: NotificationsPopoverProps) {
  const pathname = usePathname();
  const socket = useSocket();
  const [ouvert, setOuvert] = useState(false);
  const [notifications, setNotifications] = useState<NotificationApi[]>([]);
  const [nombreNonLues, setNombreNonLues] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [annonce, setAnnonce] = useState("");
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const notificationsConnues = useRef(new Set<string>());
  const ouvertRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  const nonLuesConnues = useRef(new Set<string>());
  const revisionNotifications = useRef(0);
  const lectureNonLues = useRef<{ revision: number; promise: Promise<NotificationApi[]> } | null>(null);

  useEffect(() => {
    ouvertRef.current = ouvert;
  }, [ouvert]);

  const chargerPage = useCallback(async (cursor: string | null, limite: number) => {
    const { data } = await api.get<NotificationsResponseApi>("/notifications", {
      params: { limite, ...(cursor ? { cursor } : {}) },
    });
    return data;
  }, []);

  const lireNonLues = useCallback(() => {
    const revision = revisionNotifications.current;
    if (lectureNonLues.current?.revision === revision) return lectureNonLues.current.promise;
    const promise = lireNotificationsNonLuesVisibles(chargerPage);
    lectureNonLues.current = { revision, promise };
    const terminer = () => {
      if (lectureNonLues.current?.promise === promise) lectureNonLues.current = null;
    };
    void promise.then(terminer, terminer);
    return promise;
  }, [chargerPage]);

  const chargerCompteur = useCallback(async () => {
    const revision = revisionNotifications.current;
    try {
      const nonLues = await lireNonLues();
      if (revision !== revisionNotifications.current) return;
      nonLuesConnues.current = new Set(nonLues.map(({ id }) => id));
      setNombreNonLues(nonLuesConnues.current.size);
    } catch {
      // Le panneau affichera l'erreur détaillée uniquement lorsqu'il sera ouvert.
    }
  }, [lireNonLues]);

  const chargerNotifications = useCallback(async (ajouter = false) => {
    if (ajouter) setChargementPlus(true);
    else setChargement(true);
    setErreur("");
    if (!ajouter) void chargerCompteur();
    try {
      const data = await chargerPageNotificationsVisibles(chargerPage, ajouter ? nextCursorRef.current : null);
      const recues = data.notifications;
      recues.forEach(({ id }) => notificationsConnues.current.add(id));
      setNotifications((precedentes) => {
        if (!ajouter) return recues;
        const ids = new Set(precedentes.map(({ id }) => id));
        return [...precedentes, ...recues.filter(({ id }) => !ids.has(id))];
      });
      setHasMore(Boolean(data.hasMore));
      nextCursorRef.current = data.nextCursor || null;
      setNextCursor(nextCursorRef.current);
    } catch (erreurChargee) {
      setErreur(texteErreur(erreurChargee, "Impossible de charger vos notifications."));
    } finally {
      setChargement(false);
      setChargementPlus(false);
    }
  }, [chargerCompteur, chargerPage]);

  useEffect(() => {
    void chargerCompteur();
  }, [chargerCompteur]);

  useEffect(() => {
    if (ouvert) void chargerNotifications(false);
  }, [chargerNotifications, ouvert]);

  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  useEffect(() => {
    if (!ouvert) return;

    const fermerAuClicExterieur = (event: PointerEvent) => {
      if (!racine.current?.contains(event.target as Node)) setOuvert(false);
    };
    const fermerAvecEchap = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOuvert(false);
      window.setTimeout(() => declencheur.current?.focus(), 0);
    };

    document.addEventListener("pointerdown", fermerAuClicExterieur);
    document.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerAuClicExterieur);
      document.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [ouvert]);

  useEffect(() => {
    if (!socket) return;
    const recevoirNotification = (notification: NotificationApi) => {
      if (!notification?.id || !notificationEstVisible(notification) || notificationsConnues.current.has(notification.id)) return;
      notificationsConnues.current.add(notification.id);
      revisionNotifications.current += 1;
      setNotifications((precedentes) => [notification, ...precedentes]);
      if (!notification.lue) nonLuesConnues.current.add(notification.id);
      setNombreNonLues(nonLuesConnues.current.size);
      setAnnonce(notification.titre || "Nouvelle notification reçue.");
      void chargerCompteur();
    };
    const resynchroniser = () => {
      void chargerCompteur();
      if (ouvertRef.current) void chargerNotifications(false);
    };

    socket.on("nouvelle_notification", recevoirNotification);
    socket.on("connect", resynchroniser);
    return () => {
      socket.off("nouvelle_notification", recevoirNotification);
      socket.off("connect", resynchroniser);
    };
  }, [chargerCompteur, chargerNotifications, socket]);

  const marquerCommeLue = async (id: string) => {
    const notification = notifications.find((element) => element.id === id);
    if (!notification || notification.lue || actionEnCours) return;
    revisionNotifications.current += 1;
    nonLuesConnues.current.delete(id);
    setNotifications((precedentes) => precedentes.map((element) => element.id === id ? { ...element, lue: true } : element));
    setNombreNonLues(nonLuesConnues.current.size);
    try {
      await api.patch(`/notifications/${id}/lire`);
    } catch (erreurLecture) {
      setNotifications((precedentes) => precedentes.map((element) => element.id === id ? { ...element, lue: false } : element));
      nonLuesConnues.current.add(id);
      setNombreNonLues(nonLuesConnues.current.size);
      setAnnonce(texteErreur(erreurLecture, "La notification n’a pas pu être marquée comme lue."));
    } finally {
      revisionNotifications.current += 1;
      void chargerCompteur();
    }
  };

  const toutMarquerCommeLu = async () => {
    if (actionEnCours || nombreNonLues < 1) return;
    setActionEnCours(true);
    try {
      const nonLues = await lireNonLues();
      revisionNotifications.current += 1;
      let echecs = 0;
      // Le endpoint global lirait aussi les notifications masquées.
      for (let debut = 0; debut < nonLues.length; debut += 10) {
        const lot = nonLues.slice(debut, debut + 10);
        const resultats = await Promise.allSettled(lot.map(({ id }) => api.patch(`/notifications/${id}/lire`)));
        const lues = new Set(lot.filter((_, index) => resultats[index].status === "fulfilled").map(({ id }) => id));
        echecs += lot.length - lues.size;
        lues.forEach((id) => nonLuesConnues.current.delete(id));
        setNotifications((liste) => liste.map((notification) => lues.has(notification.id) ? { ...notification, lue: true } : notification));
        setNombreNonLues(nonLuesConnues.current.size);
      }
      setAnnonce(echecs
        ? "Certaines notifications n’ont pas pu être marquées comme lues. Réessayez."
        : "Toutes les notifications sont marquées comme lues.");
    } catch (erreurLecture) {
      setAnnonce(texteErreur(erreurLecture, "Impossible de tout marquer comme lu."));
    } finally {
      revisionNotifications.current += 1;
      await Promise.all([chargerCompteur(), chargerNotifications(false)]);
      setActionEnCours(false);
    }
  };

  const fermerApresNavigation = (id: string) => {
    void marquerCommeLue(id);
    setOuvert(false);
  };

  const notificationsAffichees = useMemo(() => notifications.map((notification) => ({
    notification,
    presentation: presentationDe(notification.type),
    anciennete: ancienneteDe(notification.createdAt),
    href: hrefSecurise(notification.href),
  })), [notifications]);

  return (
    <div ref={racine} className="relative flex h-full items-center">
      <button
        ref={declencheur}
        type="button"
        aria-label={nombreNonLues > 0 ? `${nombreNonLues} notifications non lues` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-controls="panneau-notifications"
        onClick={() => {
          setOuvert((valeur) => {
            const prochainEtat = !valeur;
            if (prochainEtat) onOpen?.();
            return prochainEtat;
          });
        }}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full text-[#e5ddcf] transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#f4b400] sm:h-12 sm:w-12 ${ouvert ? "bg-white/20 text-white" : "bg-white/10"}`}
      >
        <Bell aria-hidden="true" size={23} />
        {nombreNonLues > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f4b400] px-1 text-[11px] font-bold text-[#2e261f] shadow-sm">
            {nombreNonLues > 99 ? "99+" : nombreNonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <section
          id="panneau-notifications"
          role="dialog"
          aria-modal="false"
          aria-labelledby="titre-notifications"
          className="fixed inset-x-3 top-[84px] z-[70] max-h-[calc(100dvh-172px)] overflow-y-auto overscroll-contain rounded-2xl border border-[#e9dcc8] bg-[#fffaf3] text-[#2d241d] shadow-[0_24px_55px_rgba(73,52,34,0.22)] sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+12px)] sm:w-[528px] md:[max-height:min(642px,calc(100dvh-120px))]"
        >
          <header className="sticky top-0 z-10 flex min-h-[64px] items-center justify-between gap-4 border-b border-[#eee3d2] bg-[#fffaf3]/95 px-5 py-4 backdrop-blur-sm sm:px-6">
            <h2 id="titre-notifications" className="titre-section leading-none">Notifications</h2>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-[#887764] min-[420px]:inline sm:text-base">cette semaine</span>
              {nombreNonLues > 0 && (
                <button
                  type="button"
                  disabled={actionEnCours}
                  onClick={() => void toutMarquerCommeLu()}
                  className="min-h-9 rounded-lg px-2 text-xs font-bold text-[#0d6738] hover:bg-[#e3f1eb] focus:outline-none focus:ring-2 focus:ring-[#0d6738] disabled:opacity-60 sm:text-sm"
                >
                  Tout lire
                </button>
              )}
            </div>
          </header>

          <div aria-live="polite">
            {chargement && notifications.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-[#887764]">Chargement des notifications…</p>
            ) : erreur && notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-[#bd592d]" role="alert">{erreur}</p>
                <button type="button" onClick={() => void chargerNotifications(false)} className="mt-3 min-h-10 rounded-lg border border-[#0d6738] px-4 text-sm font-bold text-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">Réessayer</button>
              </div>
            ) : notificationsAffichees.length ? (
              notificationsAffichees.map(({ notification, presentation, anciennete, href }) => {
                const { Icone } = presentation;
                return (
                  <article
                    key={notification.id}
                    className={`grid grid-cols-[42px_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-[#f0e7da] px-4 py-[18px] last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-5 ${notification.lue ? "bg-[#fffdf9]" : "bg-[#fff9ef]"}`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full sm:h-11 sm:w-11 ${TONS[presentation.ton]}`} aria-hidden="true">
                      <Icone size={17} strokeWidth={2.1} fill={Icone === Star ? "currentColor" : "none"} />
                    </span>

                    <div className="min-w-0">
                      {href && !presentation.action ? (
                        <Link
                          href={href}
                          onClick={() => fermerApresNavigation(notification.id)}
                          className="rounded-sm text-base font-bold leading-snug text-[#2d241d] hover:text-[#0d6738] hover:underline focus:outline-none focus:ring-2 focus:ring-[#0d6738] sm:text-lg"
                        >
                          {notification.titre}
                        </Link>
                      ) : (
                        <h3 className="text-base font-bold leading-snug text-[#2d241d] sm:text-lg">{notification.titre}</h3>
                      )}
                      {notification.detail && <p className="mt-1 text-sm leading-snug text-[#887764] sm:text-base">{notification.detail}</p>}

                      {presentation.action === "ouvrir" && href && (
                        <Link
                          href={href}
                          onClick={() => fermerApresNavigation(notification.id)}
                          className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#0d6738] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#09572f] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 sm:text-base"
                        >
                          Ouvrir
                        </Link>
                      )}
                    </div>

                    <span className="pt-0.5 text-xs text-[#a39583] sm:text-sm">{anciennete}</span>
                    {!notification.lue && <span className="sr-only">Notification non lue</span>}
                  </article>
                );
              })
            ) : (
              <p className="px-6 py-12 text-center text-sm text-[#887764]">Vous n’avez aucune notification pour le moment.</p>
            )}
          </div>

          {hasMore && nextCursor && (
            <div className="border-t border-[#eee3d2] bg-[#fffdf9] p-3 text-center">
              <button
                type="button"
                disabled={chargementPlus}
                onClick={() => void chargerNotifications(true)}
                className="min-h-10 rounded-lg px-4 text-sm font-bold text-[#0d6738] hover:bg-[#e3f1eb] focus:outline-none focus:ring-2 focus:ring-[#0d6738] disabled:opacity-60"
              >
                {chargementPlus ? "Chargement…" : "Afficher plus"}
              </button>
            </div>
          )}

          <p className="sr-only" role="status" aria-live="polite">{annonce}</p>
        </section>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  GraduationCap,
  HandHeart,
  Landmark,
  Menu,
  MessageCircle,
  Plus,
  Sprout,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import LogoMaliWuliImage from "@/components/LogoMaliWuliImage";
import { classesBouton } from "@/components/ui/classes";
import { useSessionAccueil } from "@/hooks/useSessionAccueil";
import { destinationSession } from "@/lib/session";
import ArbreDiaspora from "./ArbreDiaspora";
import { ETAPES, FAQ, FONCTIONNALITES, type IconeFonctionnalite } from "./landing-data";

const NAVIGATION = [
  { href: "#fonctionnalites", label: "Le réseau" },
  { href: "#comment-ca-marche", label: "Comment ça marche" },
  { href: "#faq", label: "Questions" },
] as const;

const ICONES: Record<IconeFonctionnalite, LucideIcon> = {
  fil: HandHeart,
  mentorat: Sprout,
  offres: BriefcaseBusiness,
  annuaire: UsersRound,
  evenements: CalendarDays,
  associations: Landmark,
  etablissements: GraduationCap,
  messages: MessageCircle,
};

/** Appels à l'action selon la session : visiteur, membre connecté ou session en cours de vérification. */
function useAppelsAction() {
  const session = useSessionAccueil();
  const connecte = session.etat === "authenticated" && !!session.compte;
  const espace = connecte && session.compte ? destinationSession(session.compte) : "/register";
  return {
    session,
    connecte,
    principal: connecte ? { href: espace, label: "Retrouver mon espace" } : { href: "/register", label: "Créer mon profil gratuitement" },
    secondaire: connecte ? null : { href: "/login", label: "Se connecter" },
  };
}

function EnTeteAccueil({ appels }: { appels: ReturnType<typeof useAppelsAction> }) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [defile, setDefile] = useState(false);
  const boutonMenu = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const surDefilement = () => setDefile(window.scrollY > 8);
    surDefilement();
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => window.removeEventListener("scroll", surDefilement);
  }, []);

  useEffect(() => {
    if (!menuOuvert) return;
    const surTouche = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOuvert(false); boutonMenu.current?.focus(); }
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [menuOuvert]);

  const { session, connecte, principal } = appels;
  const enVerification = session.etat === "loading";

  return (
    <header className={`sticky top-0 z-50 border-b transition-colors duration-300 ${defile || menuOuvert ? "border-line-soft bg-page/90 backdrop-blur-md" : "border-transparent bg-page"}`}>
      <div className="mx-auto flex h-header max-w-6xl items-center gap-6 px-5 lg:px-8">
        <a href="#haut" className="flex items-center gap-2.5 rounded-xl focus-anneau" aria-label="Mali Wuli, haut de page">
          <LogoMaliWuliImage compact />
          <span className="font-display text-xl font-bold tracking-tight text-ink">Mali Wuli</span>
        </a>
        <nav aria-label="Sections de l’accueil" className="ml-6 hidden items-center gap-1 md:flex">
          {NAVIGATION.map((lien) => (
            <a key={lien.href} href={lien.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-sunken hover:text-ink focus-anneau">
              {lien.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {enVerification ? (
            <span className="h-11 w-40" aria-hidden="true" />
          ) : connecte ? (
            <Link href={principal.href} className={classesBouton({ taille: "md", className: "hidden sm:inline-flex" })}>Mon espace</Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-sunken focus-anneau sm:inline-flex">Se connecter</Link>
              <Link href="/register" className={classesBouton({ className: "hidden sm:inline-flex" })}>Créer mon profil</Link>
            </>
          )}
          <button
            ref={boutonMenu}
            type="button"
            onClick={() => setMenuOuvert((ouvert) => !ouvert)}
            aria-expanded={menuOuvert}
            aria-controls="menu-accueil"
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-ink transition hover:bg-surface-sunken focus-anneau md:hidden"
          >
            {menuOuvert ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menuOuvert && (
        <nav id="menu-accueil" aria-label="Menu de l’accueil" className="border-t border-line-soft bg-page px-5 pb-6 pt-2 md:hidden">
          <ul className="divide-y divide-line-soft">
            {NAVIGATION.map((lien) => (
              <li key={lien.href}>
                <a href={lien.href} onClick={() => setMenuOuvert(false)} className="flex items-center justify-between py-4 text-base font-semibold text-ink focus-anneau">
                  {lien.label}<ArrowRight size={18} aria-hidden="true" className="text-ink-muted" />
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3">
            <Link href={principal.href} className={classesBouton({ pleineLargeur: true, taille: "lg" })}>{connecte ? "Mon espace" : "Créer mon profil"}</Link>
            {!connecte && <Link href="/login" className={classesBouton({ variante: "secondaire", pleineLargeur: true, taille: "lg" })}>Se connecter</Link>}
          </div>
        </nav>
      )}
    </header>
  );
}

function Hero({ appels }: { appels: ReturnType<typeof useAppelsAction> }) {
  const { principal, secondaire, session } = appels;
  return (
    <section id="haut" aria-labelledby="titre-accueil" className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_35%,rgb(var(--mw-gold)/0.16),transparent_70%),radial-gradient(45%_45%_at_10%_90%,rgb(var(--mw-brand)/0.10),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:pb-24 lg:pt-16">
        <div className="animate-apparition">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised/80 px-3.5 py-1.5 text-xs font-semibold text-ink-soft shadow-card sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            « Mali Wuli » : Mali, lève-toi
          </p>
          <h1 id="titre-accueil" className="mt-6 font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-[3.6rem] xl:text-[3.9rem]">
            Les talents du Mali, <span className="italic text-brand">ici et ailleurs</span>, enfin réunis.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Mali Wuli est le réseau professionnel qui relie celles et ceux qui vivent au Mali et la diaspora&nbsp;: mentorat, emploi, entraide et rencontres.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={principal.href}
              aria-disabled={session.etat === "loading" || undefined}
              onClick={(event) => { if (session.etat === "loading") event.preventDefault(); }}
              className={classesBouton({ taille: "lg", className: "group" })}
            >
              {principal.label}
              <ArrowRight size={18} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
            </Link>
            {secondaire && (
              <Link href={secondaire.href} className={classesBouton({ variante: "secondaire", taille: "lg" })}>{secondaire.label}</Link>
            )}
          </div>
          {session.refusAcces && <p role="alert" className="mt-4 text-sm font-medium text-danger">{session.refusAcces}</p>}
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            {["Gratuit, sans cotisation", "Profil visible des seuls membres", "Au Mali et dans le monde entier"].map((texte) => (
              <li key={texte} className="flex items-center gap-2">
                <Check size={16} strokeWidth={2.6} aria-hidden="true" className="text-brand" />{texte}
              </li>
            ))}
          </ul>
        </div>
        <figure className="relative mx-auto w-full max-w-[640px]">
          <ArbreDiaspora />
          <figcaption className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-medium text-ink-muted sm:text-sm">
            <span className="rounded-full bg-surface-raised/80 px-3 py-1 ring-1 ring-line-soft">Le tronc : le Mali</span>
            <span className="rounded-full bg-surface-raised/80 px-3 py-1 ring-1 ring-line-soft">Les branches : la diaspora</span>
            <span className="rounded-full bg-surface-raised/80 px-3 py-1 ring-1 ring-line-soft">Chaque feuille : un membre</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Fonctionnalites() {
  return (
    <section id="fonctionnalites" aria-labelledby="titre-fonctionnalites" className="scroll-mt-20 border-y border-line-soft bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="surtitre">Le réseau</p>
          <h2 id="titre-fonctionnalites" className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            Tout ce qu’il faut pour s’entraider, au même endroit.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Une feuille seule ne fait pas un arbre. Sur Mali Wuli, chaque membre peut donner et recevoir.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FONCTIONNALITES.map(({ icone, titre, description }, index) => {
            const Icone = ICONES[icone];
            const vedette = index < 2;
            const large = index >= FONCTIONNALITES.length - 2;
            return (
              <li
                key={titre}
                className={`group relative flex flex-col rounded-2xl border p-6 transition duration-300 hover:-translate-y-0.5 ${
                  vedette
                    ? "border-bark-700 bg-bark text-[#f4eee1] shadow-raised sm:col-span-1 lg:col-span-2"
                    : "border-line-soft bg-surface-raised shadow-card hover:shadow-raised"
                } ${large ? "lg:col-span-2" : ""}`}
              >
                <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-xl ${vedette ? "bg-gold text-bark-900" : "bg-brand-50 text-brand"}`}>
                  <Icone size={22} />
                </span>
                <h3 className={`mt-5 font-display font-bold leading-snug ${vedette ? "text-2xl text-white" : "text-xl text-ink"}`}>{titre}</h3>
                <p className={`mt-2 leading-relaxed ${vedette ? "text-base text-bark-text" : "text-[15px] text-ink-muted"}`}>{description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function CommentCaMarche({ lien }: { lien: { href: string; label: string } }) {
  return (
    <section id="comment-ca-marche" aria-labelledby="titre-etapes" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="surtitre">Comment ça marche</p>
          <h2 id="titre-etapes" className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
            De l’inscription à la première rencontre.
          </h2>
          <Link href={lien.href} className={classesBouton({ className: "mt-8" })}>
            {lien.label}<ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <ol className="relative space-y-5 before:absolute before:bottom-8 before:left-[27px] before:top-8 before:w-px before:bg-line sm:before:left-[31px]">
          {ETAPES.map((etape) => (
            <li key={etape.numero} className="relative flex gap-5 rounded-2xl border border-line-soft bg-surface p-5 shadow-card sm:gap-6 sm:p-6">
              <span aria-hidden="true" className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand font-display text-lg font-bold text-white ring-4 ring-page sm:h-16 sm:w-16 sm:text-xl">
                {etape.numero}
              </span>
              <div className="pt-1">
                <h3 className="font-display text-xl font-bold text-ink sm:text-2xl">{etape.titre}</h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{etape.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Metaphore() {
  return (
    <section aria-labelledby="titre-metaphore" className="relative overflow-hidden bg-bark-900 py-20 text-[#f4eee1] sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
      <div className="relative mx-auto max-w-4xl px-5 text-center lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Notre raison d’être</p>
        <h2 id="titre-metaphore" className="mt-4 font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
          Un baobab dont les racines sont au Mali et les branches partout dans le monde.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-bark-text">
          Étudiants, ingénieurs, médecins, entrepreneurs, artisans : vos parcours sont une richesse. Mali Wuli les rend visibles et les relie, pour que chaque expérience profite au pays et à celles et ceux qui le construisent.
        </p>
        <dl className="mx-auto mt-12 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
          {[
            ["Le tronc", "Le Mali et celles et ceux qui y vivent, au cœur du réseau."],
            ["Les branches", "La diaspora, de Dakar à Montréal, de Paris à Abidjan."],
            ["Les feuilles", "Chaque membre, avec son parcours et ce qu’il peut offrir."],
          ].map(([terme, definition]) => (
            <div key={terme} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <dt className="font-display text-lg font-bold text-gold">{terme}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-bark-text">{definition}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function QuestionsFrequentes() {
  return (
    <section id="faq" aria-labelledby="titre-faq" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:px-8">
        <div>
          <p className="surtitre">Questions fréquentes</p>
          <h2 id="titre-faq" className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">Vos questions, nos réponses.</h2>
        </div>
        <div className="divide-y divide-line rounded-2xl border border-line-soft bg-surface shadow-card">
          {FAQ.map((item) => (
            <details key={item.question} className="group px-5 sm:px-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-5 text-left text-base font-semibold text-ink focus-anneau sm:text-lg">
                {item.question}
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-brand transition group-open:rotate-45 group-open:bg-brand group-open:text-white">
                  <Plus size={16} strokeWidth={2.5} />
                </span>
              </summary>
              <p className="-mt-1 pb-5 pr-12 leading-relaxed text-ink-muted">{item.reponse}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppelFinal({ lien }: { lien: { href: string; label: string } }) {
  return (
    <section aria-labelledby="titre-appel" className="mx-auto max-w-6xl px-5 pb-20 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-14 text-center shadow-raised sm:px-12 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgb(var(--mw-gold)/0.22),transparent_70%)]" />
        <div className="relative">
          <h2 id="titre-appel" className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
            Il ne manque plus que votre feuille.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Rejoignez le réseau, partagez votre parcours et aidez la prochaine génération à grandir.</p>
          <Link href={lien.href} className={classesBouton({ variante: "inverse", taille: "lg", className: "mt-8 focus-visible:ring-offset-brand" })}>
            {lien.label}<ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PiedDePage({ connecte }: { connecte: boolean }) {
  return (
    <footer className="border-t border-line-soft bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-start sm:justify-between lg:px-8">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <LogoMaliWuliImage compact />
            <span className="font-display text-lg font-bold text-ink">Mali Wuli</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">Le réseau qui relie les talents du Mali et de sa diaspora.</p>
        </div>
        <nav aria-label="Pied de page" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          {NAVIGATION.map((lien) => (
            <a key={lien.href} href={lien.href} className="rounded py-1 text-ink-soft transition hover:text-brand focus-anneau">{lien.label}</a>
          ))}
          {connecte ? (
            <Link href="/dashboard" className="rounded py-1 text-ink-soft transition hover:text-brand focus-anneau">Mon espace</Link>
          ) : (
            <>
              <Link href="/register" className="rounded py-1 text-ink-soft transition hover:text-brand focus-anneau">Créer un compte</Link>
              <Link href="/login" className="rounded py-1 text-ink-soft transition hover:text-brand focus-anneau">Se connecter</Link>
            </>
          )}
        </nav>
      </div>
      <div className="border-t border-line-soft">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-ink-muted lg:px-8">© {new Date().getFullYear()} Mali Wuli</p>
      </div>
    </footer>
  );
}

export default function LandingArbre() {
  const appels = useAppelsAction();
  return (
    <div className="min-h-screen bg-page text-ink">
      <a href="#contenu" className="sr-only z-[60] rounded-full bg-brand px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3">
        Aller au contenu
      </a>
      <EnTeteAccueil appels={appels} />
      <main id="contenu">
        <Hero appels={appels} />
        <Fonctionnalites />
        <CommentCaMarche lien={appels.principal} />
        <Metaphore />
        <QuestionsFrequentes />
        <AppelFinal lien={appels.principal} />
      </main>
      <PiedDePage connecte={appels.connecte} />
    </div>
  );
}

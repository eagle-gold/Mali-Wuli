"use client";

import Link from "next/link";
import { LogoArbreImage } from "@/components/LogoMaliWuliImage";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowRight, Menu, Minus, Plus, X } from "lucide-react";
import LandingTree, { type TreeSelection } from "./LandingTree";
import { COUNTRIES, PEOPLE, MALI_PEOPLE, STEPS, OPPORTUNITIES, EVENTS, FAQ } from "./landing-data";
import { clamp } from "./tree-geometry";
import styles from "./LandingArbre.module.css";
import { useSessionAccueil } from "@/hooks/useSessionAccueil";
import { destinationSession } from "@/lib/session";

const NAVIGATION = [
  { href: "#comment-ca-marche", label: "Comment ça marche" },
  { href: "#opportunites", label: "Opportunités" },
  { href: "#evenements", label: "Événements" },
  { href: "#faq", label: "FAQ" },
] as const;

type FocusTarget = Element & { focus?: (options?: FocusOptions) => void };

export default function LandingArbre() {
  const router = useRouter();
  const session = useSessionAccueil();
  const connecte = session.etat === "authenticated" && !!session.compte;
  const sessionConnue = connecte || session.etat === "visitor";
  const destination = (chemin = "/dashboard") => connecte && session.compte
    ? destinationSession(session.compte, chemin)
    : session.etat === "visitor" ? "/register" : "#";
  const lienEspace = (chemin = "/dashboard") => ({
    href: destination(chemin),
    "aria-disabled": !sessionConnue || undefined,
    tabIndex: sessionConnue ? undefined : -1,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (!sessionConnue) { event.preventDefault(); if (session.etat === "unavailable") session.actualiser(); }
    },
  });
  const ouvrirMonEspace = () => { if (sessionConnue) router.push(destination()); };

  const heroRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<FocusTarget | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [progress, setProgress] = useState(0);
  const [intro, setIntro] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<TreeSelection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openQuestions, setOpenQuestions] = useState<number[]>([]);


  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 700px)");
    const update = () => { setReducedMotion(motionQuery.matches); setMobile(mobileQuery.matches); };
    update();
    motionQuery.addEventListener("change", update);
    mobileQuery.addEventListener("change", update);
    return () => { motionQuery.removeEventListener("change", update); mobileQuery.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    if (reducedMotion) { setIntro(1); return; }
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = clamp((performance.now() - started) / 1900);
      setIntro(next);
      if (next === 1) window.clearInterval(timer);
    }, 30);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const hero = heroRef.current;
      if (!hero) return;
      const bounds = hero.getBoundingClientRect();
      const span = Math.max(1, bounds.height - window.innerHeight);
      setProgress(reducedMotion ? 1 : clamp((-bounds.top / span) * (mobile ? 1.2 : 1)));
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); window.cancelAnimationFrame(frame); };
  }, [reducedMotion, mobile]);

  const closeSelection = useCallback(() => {
    setSelected(null);
    triggerRef.current?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menuOpen) { setMenuOpen(false); menuButtonRef.current?.focus(); }
      else if (selected) closeSelection();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeSelection, menuOpen, selected]);

  useEffect(() => {
    if (!selected) return;
    titleRef.current?.focus({ preventScroll: true });
  }, [selected]);

  useEffect(() => {
    if (!selected || !mobile) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [selected, mobile]);

  const showSelection = (selection: TreeSelection) => {
    if (!selected) triggerRef.current = document.activeElement as FocusTarget | null;
    setMenuOpen(false);
    setSelected(selection);
  };

  const scrollToFullTree = () => {
    const hero = heroRef.current;
    if (!hero) return;
    const top = hero.getBoundingClientRect().top + window.scrollY;
    const span = Math.max(0, hero.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + span * (mobile ? 0.75 : 0.89), behavior: reducedMotion || mobile ? "auto" : "smooth" });
  };

  const trapMobileFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!mobile || event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  let caption = "";
  let captionSub = "";
  let captionOpacity = 0;
  if (progress >= 0.02 && progress < 0.24) {
    caption = "Le tronc, c'est le Mali et ceux qui y vivent. Chaque branche, un pays.";
    captionSub = "Cliquez sur une feuille du tronc ou sur une branche.";
    captionOpacity = clamp((progress - 0.02) / 0.04) * clamp((0.24 - progress) / 0.03);
  } else if (progress >= 0.24 && progress < 0.62) {
    caption = "Chaque feuille, une personne.";
    captionSub = "Cliquez sur une feuille pour découvrir un membre.";
    captionOpacity = clamp((progress - 0.24) / 0.04) * clamp((0.62 - progress) / 0.03);
  } else if (progress >= 0.62 && progress < 0.8) {
    caption = "Il ne manque plus qu'une feuille…";
    captionSub = "La vôtre.";
    captionOpacity = clamp((progress - 0.62) / 0.04) * clamp((0.8 - progress) / 0.03);
  }
  const finalOpacity = clamp((progress - 0.8) / 0.08);
  const finalVisible = finalOpacity > 0.5;
  const country = selected?.type === "country" ? COUNTRIES[selected.index] : undefined;
  const selectedPeople = selected?.type === "mali" ? MALI_PEOPLE : selected?.type === "country" ? PEOPLE.slice(selected.index * 3, selected.index * 3 + 3) : [];
  const panelKicker = selected?.type === "person" ? `FEUILLE · ${selected.person.country.toLocaleUpperCase("fr")}` : selected?.type === "mali" ? "LE TRONC" : "BRANCHE";
  const panelTitle = selected?.type === "person" ? selected.person.name : selected?.type === "mali" ? "Mali" : country?.name;
  const panelSubtitle = selected?.type === "person" ? `${selected.person.job} · ${selected.person.city}` : selected?.type === "mali" ? "214 membres au pays · les racines du réseau" : country ? `${country.count} membres · ${Math.round(country.count / 4)} offres en cours` : "";

  return (
    <main className={styles.landing} data-session-state={session.etat}>
      <a href="#comment-ca-marche" className={styles.skipLink}>Passer l’animation et découvrir Mali Wuli</a>
      <div ref={heroRef} id="arbre" className={styles.scrollScene} data-reduced-motion={reducedMotion}>
        <div className={styles.stickyScene}>
          <header className={styles.header}>
            <a href="#arbre" className={styles.brand} aria-label="Mali Wuli, accueil">
              {/* Local asset supplied with the approved design. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <LogoArbreImage />
              <span>Mali Wuli</span>
            </a>
            <nav className={styles.desktopNav} aria-label="Découvrir Mali Wuli" aria-hidden={!finalVisible} style={{ opacity: finalOpacity, pointerEvents: finalVisible ? "auto" : "none" }}>
              {NAVIGATION.map((item) => <a key={item.href} href={item.href} tabIndex={finalVisible ? 0 : -1}>{item.label}</a>)}
            </nav>
            <div className={styles.headerActions}>
              {connecte ? <>
                <Link {...lienEspace("/profil")} className={styles.login}>Mon profil</Link>
                <Link {...lienEspace()} className={styles.profileButton}>Mon espace</Link>
              </> : session.etat === "visitor" ? <>
                <Link href="/login" className={styles.login}>Se connecter</Link>
                <Link href="/register" className={styles.profileButton}>Créer mon profil</Link>
              </> : session.etat === "unavailable" ? session.refusAcces
                ? <Link href="/login" className={`${styles.login} ${styles.sessionOtherAccount}`}>Se connecter avec un autre compte</Link>
                : <button type="button" className={styles.profileButton} onClick={session.actualiser}>Vérifier ma session</button>
                : <span className={styles.sessionPlaceholder} role="status">Vérification de la session…</span>}
              <button ref={menuButtonRef} type="button" className={styles.menuButton} onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-hidden={!finalVisible} tabIndex={finalVisible ? 0 : -1} style={{ opacity: finalOpacity, pointerEvents: finalVisible ? "auto" : "none" }}>
                {menuOpen ? <X size={21} /> : <Menu size={21} />}
              </button>
            </div>
            {session.refusAcces && <p role="alert" className={styles.sessionError}>{session.refusAcces}</p>}
            {menuOpen && finalVisible && <nav id="landing-mobile-menu" className={styles.mobileNav} aria-label="Découvrir Mali Wuli sur mobile">{NAVIGATION.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}<ArrowRight size={16} aria-hidden="true" /></a>)}</nav>}
          </header>
          <div className={styles.treeFrame}>
            <LandingTree progress={progress} intro={intro} selected={selected} onSelect={showSelection} onSignup={ouvrirMonEspace} signupDisabled={!sessionConnue} signupLabel={connecte ? "Retrouver mon espace Mali Wuli" : "Vous ? Ajouter ma feuille et créer mon profil"} onClose={closeSelection} />
          </div>
          <div className={styles.caption} style={{ opacity: captionOpacity }} aria-hidden={captionOpacity < 0.1}>
            <p>{caption}</p><span>{captionSub}</span>
          </div>
          <div className={styles.scrollHint} style={{ opacity: clamp(1 - progress / 0.03) * intro }} aria-hidden="true"><span>FAITES DÉFILER</span><i /></div>
          <button type="button" className={styles.completeTree} onClick={scrollToFullTree} tabIndex={progress < 0.03 ? 0 : -1} aria-hidden={progress >= 0.03} style={{ opacity: progress < 0.03 ? intro : 0, pointerEvents: progress < 0.03 ? "auto" : "none" }}>Voir l’arbre complet</button>
          <div className={styles.finalBanner} style={{ opacity: finalOpacity, transform: `translateY(${(1 - finalOpacity) * 20}px)`, pointerEvents: finalVisible ? "auto" : "none" }}>
            <div><p className={styles.eyebrow}>MALIENS D’ICI ET D’AILLEURS</p><h1>L’arbre grandit avec chacun de nous.</h1></div>
            <Link {...lienEspace()} className={styles.primaryButton} tabIndex={finalVisible && sessionConnue ? 0 : -1} aria-hidden={!finalVisible}>{connecte ? "Retrouver mon espace" : "Ajouter ma feuille, c’est gratuit"}</Link>
          </div>

          {selected && <>
            <div className={styles.sheetBackdrop} onClick={closeSelection} aria-hidden="true" />
            <div ref={panelRef} className={styles.detailPanel} role="dialog" aria-modal={mobile || undefined} aria-labelledby="landing-panel-title" aria-describedby="landing-panel-description" onKeyDown={trapMobileFocus}>
              <div className={styles.panelHeading}>
                <div><p className={styles.eyebrow}>{panelKicker}</p><h2 ref={titleRef} id="landing-panel-title" tabIndex={-1}>{panelTitle}</h2><p id="landing-panel-description">{panelSubtitle}</p></div>
                <button type="button" className={styles.closeButton} onClick={closeSelection} aria-label="Fermer la fiche"><X size={20} /></button>
              </div>
              {selected.type === "person" && <>
                <p className={styles.offerPill}>{selected.person.offer}</p>
                <Link {...lienEspace("/annuaire")} className={styles.primaryButton}>{connecte ? "Découvrir les membres" : "Entrer en contact"}</Link>
                {session.etat === "visitor" && <p className={styles.smallCentered}>Réservé aux membres : créez votre profil pour écrire.</p>}
              </>}
              {selectedPeople.length > 0 && <ul className={styles.peopleList}>{selectedPeople.map((person) => <li key={`${person.country}-${person.name}`}><button type="button" onClick={() => showSelection({ type: "person", person })}><span className={styles.smallAvatar} aria-hidden="true">{person.name.slice(0, 2).toLocaleUpperCase("fr")}</span><span><strong>{person.name}</strong><span>{person.job} · {person.city}</span></span><ArrowRight size={16} aria-hidden="true" /></button></li>)}</ul>}

            </div>
          </>}
        </div>
      </div>

      <section id="comment-ca-marche" className={styles.howSection} aria-labelledby="how-heading">
        <div className={styles.howGrid}>
          <div><p className={styles.eyebrow}>COMMENT ÇA MARCHE</p><h2 id="how-heading">De l’inscription à la première rencontre</h2></div>
          <div className={styles.steps}>{STEPS.map((step) => <article key={step.number} className={styles.stepCard}><span className={styles.stepNumber}>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
        </div>
      </section>

      <section id="opportunites" className={styles.opportunitySection} aria-labelledby="opportunity-heading">
        <div className={styles.container}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>OPPORTUNITÉS</p><h2 id="opportunity-heading">Le fil du réseau</h2><p className={styles.sectionDescription}>Emplois, demandes de mentorat, coups de main : chaque jour, les membres publient ce qu’ils offrent et ce qu’ils cherchent. Un simple « Répondre » peut changer un parcours.</p></div><Link {...lienEspace()} className={styles.lightTextButton}>{connecte ? "Voir tout le fil" : "Voir tout le fil après inscription"} <ArrowRight size={16} aria-hidden="true" /></Link></div>
          <div className={styles.opportunityGrid}>{OPPORTUNITIES.map((opportunity) => <article key={opportunity.name} className={styles.postCard}>
            <div className={styles.postHeader}><span className={styles.avatar} style={{ backgroundColor: opportunity.backgroundColor, color: opportunity.color }} aria-hidden="true">{opportunity.initials}</span><div className={styles.postIdentity}><strong>{opportunity.name}</strong><p>{opportunity.role}</p><span>{opportunity.time}</span></div><Link {...lienEspace("/annuaire")} className={styles.followButton}>{connecte ? "Annuaire" : "+ Suivre"}</Link></div>
            <p className={styles.postText}>{opportunity.text}</p>
            <div className={styles.postOffer} style={{ backgroundColor: opportunity.backgroundColor }}><span style={{ color: opportunity.color }}>{opportunity.tag}</span><h3>{opportunity.title}</h3><p>{opportunity.meta}</p></div>
            <div className={styles.postCounts}><span>{opportunity.likes} soutiens</span><span>{opportunity.comments} réponses</span></div>
            <div className={styles.postActions}><Link {...lienEspace()}>Soutenir</Link><Link {...lienEspace()}>Répondre</Link><Link {...lienEspace(opportunity.tag === "EMPLOI" ? "/offres" : "/dashboard")}>{connecte ? opportunity.tag === "EMPLOI" ? "Voir les offres" : "Voir le fil" : opportunity.cta}</Link></div>
          </article>)}</div>
        </div>
      </section>

      <section id="evenements" className={styles.eventsSection} aria-labelledby="events-heading"><div className={styles.container}>
        <h2 id="events-heading">Événements à venir</h2><p className={styles.sectionDescription}>Forums emploi, afterworks, webinaires : se retrouver en vrai, à Bamako comme dans la diaspora, ou en ligne depuis n’importe où.</p>
        <div className={styles.eventsGrid}>{EVENTS.map((event) => <article key={event.title} className={styles.eventCard}><div className={styles.calendar} aria-hidden="true"><span>{event.month}</span><strong>{event.day}</strong></div><div><h3>{event.title}</h3><p className={styles.eventLocation}>{event.location}</p><p>{event.description}</p><Link {...lienEspace("/evenements")} className={styles.eventButton}>{connecte ? "Voir les événements" : "Rejoindre le réseau"} <ArrowRight size={14} aria-hidden="true" /></Link></div></article>)}</div>
      </div></section>

      <section id="faq" className={styles.faqSection} aria-labelledby="faq-heading"><div className={styles.faqGrid}><div><p className={styles.eyebrow}>FAQ</p><h2 id="faq-heading">Vos questions</h2></div><div>{FAQ.map((item, index) => {
        const open = openQuestions.includes(index);
        return <div key={item.question} className={styles.faqItem}><h3><button type="button" aria-expanded={open} aria-controls={`landing-faq-${index}`} onClick={() => setOpenQuestions((previous) => previous.includes(index) ? previous.filter((value) => value !== index) : [...previous, index])}>{item.question}{open ? <Minus size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}</button></h3><div id={`landing-faq-${index}`} hidden={!open}><p>{item.answer}</p></div></div>;
      })}</div></div></section>

      <section className={styles.closingSection} aria-labelledby="closing-heading"><div className={styles.closingContent}><h2 id="closing-heading">Il ne manque plus que votre feuille.</h2><Link {...lienEspace()} className={styles.creamButton}>{connecte ? "Retrouver mon espace" : "Ajouter ma feuille, c’est gratuit"}</Link></div></section>
    </main>
  );
}

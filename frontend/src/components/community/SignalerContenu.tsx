"use client";

import { Flag, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { MOTIFS_SIGNALEMENT, type MotifSignalement, type TypeCibleSignalement } from "@/lib/moderation";

const LONGUEUR_MAX_DETAILS = 1000;
const MESSAGE_SUCCES = "Merci, l’équipe de modération va examiner ce signalement.";

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  cibleType: TypeCibleSignalement;
  cibleId: string;
  /** Complément du titre : « cette publication », « le profil de Awa »… */
  libelleCible?: string;
  /** Élément qui reprend le focus à la fermeture (ex. bouton ⋯ quand l’entrée de menu a disparu). */
  retourFocus?: RefObject<HTMLElement | null>;
};

type Etat = { type: "formulaire" } | { type: "succes"; message: string } | { type: "deja"; message: string };

const SELECTEUR_FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modale de signalement (POST /api/signalements).
 * Dialogue modal : focus piégé, Échap ferme, focus rendu à l’élément d’origine.
 */
export default function SignalerContenu({ ouvert, onFermer, cibleType, cibleId, libelleCible = "ce contenu", retourFocus }: Props) {
  const [motif, setMotif] = useState<MotifSignalement | "">("");
  const [details, setDetails] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [etat, setEtat] = useState<Etat>({ type: "formulaire" });
  const dialogue = useRef<HTMLDivElement>(null);
  const origine = useRef<HTMLElement | null>(null);
  const enCoursRef = useRef(false);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  const retourFocusRef = useRef(retourFocus);
  retourFocusRef.current = retourFocus;
  const titreId = useId();
  const descriptionId = useId();
  const detailsId = useId();
  const aideDetailsId = useId();

  useEffect(() => {
    if (!ouvert) return;
    origine.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMotif(""); setDetails(""); setErreur(""); setEtat({ type: "formulaire" });
    const debordement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => dialogue.current?.querySelector<HTMLElement>('input[name="motif-signalement"]')?.focus());
    const clavier = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (enCoursRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        fermerRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogue.current) return;
      const elements = Array.from(dialogue.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE))
        .filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (!elements.length) return;
      const premier = elements[0];
      const dernier = elements[elements.length - 1];
      const actif = document.activeElement;
      if (!dialogue.current.contains(actif)) { event.preventDefault(); premier.focus(); }
      else if (event.shiftKey && actif === premier) { event.preventDefault(); dernier.focus(); }
      else if (!event.shiftKey && actif === dernier) { event.preventDefault(); premier.focus(); }
    };
    document.addEventListener("keydown", clavier, true);
    return () => {
      document.removeEventListener("keydown", clavier, true);
      document.body.style.overflow = debordement;
      const element = retourFocusRef.current?.current || origine.current;
      if (element && document.contains(element)) requestAnimationFrame(() => element.focus());
    };
  }, [ouvert]);

  if (!ouvert || typeof document === "undefined") return null;

  const envoyer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!motif || enCoursRef.current) return;
    if (details.length > LONGUEUR_MAX_DETAILS) return;
    enCoursRef.current = true; setEnCours(true); setErreur("");
    try {
      await api.post("/signalements", { cibleType, cibleId, motif, ...(details.trim() ? { details: details.trim() } : {}) });
      setEtat({ type: "succes", message: MESSAGE_SUCCES });
    } catch (error) {
      const statut = (error as { response?: { status?: number } })?.response?.status;
      if (statut === 409) setEtat({ type: "deja", message: "Vous avez déjà signalé ce contenu : votre signalement est en cours d’examen par l’équipe de modération." });
      else if (statut === 429) setErreur("Vous avez atteint la limite de signalements pour aujourd’hui. Réessayez demain.");
      else if (statut === 404) setErreur("Ce contenu n’existe plus ou n’est plus visible.");
      else setErreur(messageErreur(error, "Le signalement n’a pas pu être envoyé. Réessayez."));
    } finally {
      enCoursRef.current = false; setEnCours(false);
    }
  };

  const boutonSecondaire = "inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-[#4f4339] hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60";

  let contenu: ReactNode;
  if (etat.type !== "formulaire") {
    contenu = <div className="px-5 py-5">
      <p role="status" className={`rounded-xl border p-3 text-sm leading-6 ${etat.type === "succes" ? "border-[#c8dccd] bg-[#edf4ee] text-brand" : "border-line bg-[#fff8ec] text-[#6b4f2e]"}`}>{etat.message}</p>
      <div className="mt-4 flex justify-end">
        <button type="button" autoFocus onClick={onFermer} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-bold text-white hover:bg-[#0a552e] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2">Fermer</button>
      </div>
    </div>;
  } else {
    contenu = <form onSubmit={(event) => void envoyer(event)} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Motif du signalement <span className="text-danger" aria-hidden="true">*</span><span className="sr-only">(obligatoire)</span></legend>
          <div className="mt-2 space-y-2">
            {MOTIFS_SIGNALEMENT.map((option) => {
              const choisi = motif === option.code;
              return <label key={option.code} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-brand ${choisi ? "border-brand bg-[#edf4ee]" : "border-line bg-white hover:bg-surface"}`}>
                <input type="radio" name="motif-signalement" value={option.code} checked={choisi} onChange={() => setMotif(option.code)} disabled={enCours} className="mt-1 h-4 w-4 accent-brand" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{option.libelle}</span>
                  <span className="block text-xs leading-5 text-ink-muted">{option.aide}</span>
                </span>
              </label>;
            })}
          </div>
        </fieldset>
        <label htmlFor={detailsId} className="mt-4 block text-sm font-semibold text-ink">Détails <span className="font-normal text-ink-muted">(facultatif)</span></label>
        <textarea
          id={detailsId}
          value={details}
          onChange={(event) => setDetails(event.target.value.slice(0, LONGUEUR_MAX_DETAILS))}
          maxLength={LONGUEUR_MAX_DETAILS}
          rows={4}
          disabled={enCours}
          aria-describedby={aideDetailsId}
          placeholder="Aidez l’équipe de modération à comprendre le problème."
          className="mt-1 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-6 text-[#342a22] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-70"
        />
        <p id={aideDetailsId} className="mt-1 text-right text-xs text-[#8b7b69]" aria-live="polite">{details.length}/{LONGUEUR_MAX_DETAILS}</p>
        {erreur && <p role="alert" className="mt-2 rounded-lg border border-[#e8c8b8] bg-[#fff4ef] p-3 text-sm text-danger">{erreur}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-5 py-3">
        <button type="button" onClick={onFermer} disabled={enCours} className={boutonSecondaire}>Annuler</button>
        <button type="submit" disabled={!motif || enCours} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-[#0a552e] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          {enCours ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : <Flag aria-hidden="true" size={16} />}
          {enCours ? "Envoi…" : "Envoyer le signalement"}
        </button>
      </div>
    </form>;
  }

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !enCoursRef.current) onFermer(); }}
      className="fixed inset-0 z-[130] flex items-end justify-center bg-[#241a12]/55 p-0 font-sans backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <div
        ref={dialogue}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        aria-describedby={descriptionId}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-surface text-ink shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <h2 id={titreId} className="titre-section">Signaler {libelleCible}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink-muted">Votre signalement est confidentiel : la personne concernée ne saura pas qui l’a envoyé.</p>
          </div>
          <button type="button" onClick={onFermer} disabled={enCours} aria-label="Fermer la fenêtre de signalement" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5e5044] transition hover:bg-[#f2e7d8] focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50">
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        {contenu}
      </div>
    </div>,
    document.body,
  );
}

/** Bouton discret « Signaler » + modale, pour les fiches (association, établissement, événement, offre, profil). */
export function BoutonSignaler({ cibleType, cibleId, libelleCible, className = "" }: { cibleType: TypeCibleSignalement; cibleId: string; libelleCible?: string; className?: string }) {
  const [ouvert, setOuvert] = useState(false);
  return <>
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => setOuvert(true)}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-muted transition hover:bg-surface-sunken hover:text-danger focus:outline-none focus:ring-2 focus:ring-brand ${className}`}
    >
      <Flag aria-hidden="true" size={14} />
      Signaler
    </button>
    <SignalerContenu ouvert={ouvert} onFermer={() => setOuvert(false)} cibleType={cibleType} cibleId={cibleId} libelleCible={libelleCible} />
  </>;
}

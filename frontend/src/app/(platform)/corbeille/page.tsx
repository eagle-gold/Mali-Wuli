"use client";

import Link from "next/link";
import { ArrowLeft, LoaderCircle, MessageCircle, Newspaper, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { effacerDeLaCorbeille, restaurerDepuisCorbeille, type ElementCorbeille, type ReponseCorbeille } from "@/lib/moderation";

const DATE_COURTE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
const dateFr = (valeur: string, options: Intl.DateTimeFormatOptions = { ...DATE_COURTE, hour: "2-digit", minute: "2-digit" }) => {
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? "date inconnue" : new Intl.DateTimeFormat("fr-FR", options).format(date);
};
const cle = (element: Pick<ElementCorbeille, "type" | "id">) => `${element.type}:${element.id}`;

const BOUTON_SECONDAIRE = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#e4d2b3] bg-white px-3 text-sm font-semibold text-[#4f4339] transition hover:bg-[#f5ecdf] focus:outline-none focus:ring-2 focus:ring-[#0d6738] disabled:cursor-not-allowed disabled:opacity-60";
const BOUTON_PRIMAIRE = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0d6738] px-3 text-sm font-bold text-white transition hover:bg-[#0a552e] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60";
const BOUTON_DANGER = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#a3321f] px-3 text-sm font-bold text-white transition hover:bg-[#8a2918] focus:outline-none focus:ring-2 focus:ring-[#a3321f] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60";

function CarteElement({ element, enCours, onRestaurer, onEffacer }: {
  element: ElementCorbeille;
  enCours: "restaurer" | "effacer" | null;
  onRestaurer: () => void;
  onEffacer: () => void;
}) {
  const [confirmation, setConfirmation] = useState(false);
  const titreConfirmationId = useId();
  const boutonEffacer = useRef<HTMLButtonElement>(null);
  const estPublication = element.type === "publication";
  const libelle = estPublication ? "Publication" : "Commentaire";
  const Icone = estPublication ? Newspaper : MessageCircle;
  const annuler = () => { setConfirmation(false); requestAnimationFrame(() => boutonEffacer.current?.focus()); };

  return (
    <li className="rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[#806f5e]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#efe4d2] px-3 py-1 text-xs font-bold text-[#664e39]">
          <Icone aria-hidden="true" size={13} />{libelle}
        </span>
        {element.thematique && <span className="text-xs font-semibold text-[#664e39]">{element.thematique}</span>}
        {element.supprimeParModeration && <span className="rounded-full bg-[#fbeae4] px-3 py-1 text-xs font-bold text-[#a3321f]">Retiré par la modération</span>}
      </div>
      <h2 className="mt-3 titre-element">{estPublication ? "Publication supprimée" : "Commentaire supprimé"}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#342a22] [overflow-wrap:anywhere]">
        {element.apercu ? `${element.apercu}${element.apercu.length >= 200 ? "…" : ""}` : <span className="italic text-[#806f5e]">(sans texte)</span>}
      </p>
      <dl className="mt-3 grid gap-1 text-xs text-[#806f5e] sm:grid-cols-2 sm:text-sm">
        <div><dt className="inline">Supprimé le </dt><dd className="inline font-semibold text-[#4f4339]">{dateFr(element.supprimeLe)}</dd></div>
        <div><dt className="inline">Effacement définitif le </dt><dd className="inline font-semibold text-[#a3321f]">{dateFr(element.effacementDefinitifLe, DATE_COURTE)}</dd></div>
      </dl>

      {element.raisonBlocage && (!element.peutRestaurer || !element.peutEffacer) && (
        <p className="mt-3 rounded-lg border border-[#e4d2b3] bg-[#fff8ec] p-3 text-sm text-[#6b4f2e]">{element.raisonBlocage}</p>
      )}

      {(element.peutRestaurer || element.peutEffacer) && !confirmation && (
        <div className="mt-4 flex flex-wrap gap-2">
          {element.peutRestaurer && (
            <button type="button" disabled={Boolean(enCours)} onClick={onRestaurer} className={BOUTON_PRIMAIRE}>
              {enCours === "restaurer" ? <LoaderCircle aria-hidden="true" size={15} className="animate-spin" /> : <RotateCcw aria-hidden="true" size={15} />}
              {enCours === "restaurer" ? "Restauration…" : "Restaurer"}
            </button>
          )}
          {element.peutEffacer && (
            <button ref={boutonEffacer} type="button" disabled={Boolean(enCours)} onClick={() => setConfirmation(true)} className={BOUTON_SECONDAIRE + " text-[#a3321f]"}>
              <Trash2 aria-hidden="true" size={15} />
              Supprimer définitivement
            </button>
          )}
        </div>
      )}

      {confirmation && (
        <section
          role="alertdialog"
          aria-labelledby={titreConfirmationId}
          onKeyDown={(event) => { if (event.key === "Escape" && !enCours) { event.preventDefault(); annuler(); } }}
          className="mt-4 rounded-xl border border-[#ddc1af] bg-[#fff8f0] p-3"
        >
          <h3 id={titreConfirmationId} className="text-sm font-bold text-[#2f261e]">Supprimer définitivement {estPublication ? "cette publication" : "ce commentaire"} ?</h3>
          <p className="mt-1 text-sm text-[#4f4339]">
            {estPublication ? "La publication, ses commentaires, ses réactions et sa photo seront effacés." : "Le commentaire et ses réponses seront effacés."}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#a3321f]">Cette action est définitive : il ne sera plus possible de restaurer.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" autoFocus disabled={Boolean(enCours)} onClick={annuler} className={BOUTON_SECONDAIRE}>Annuler</button>
            <button type="button" disabled={Boolean(enCours)} onClick={onEffacer} className={BOUTON_DANGER}>
              {enCours === "effacer" && <LoaderCircle aria-hidden="true" size={15} className="animate-spin" />}
              {enCours === "effacer" ? "Suppression…" : "Confirmer la suppression définitive"}
            </button>
          </div>
        </section>
      )}
    </li>
  );
}

export default function CorbeillePage() {
  const socket = useSocket();
  const [donnees, setDonnees] = useState<ReponseCorbeille | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [action, setAction] = useState<{ cle: string; type: "restaurer" | "effacer" } | null>(null);
  const [annonce, setAnnonce] = useState<{ texte: string; erreur?: boolean; lien?: string } | null>(null);
  const verrou = useRef(false);

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setChargement(true);
    try {
      const { data } = await api.get<ReponseCorbeille>("/corbeille");
      setDonnees(data);
      setErreur("");
    } catch (error) {
      if (!silencieux) setErreur(messageErreur(error, "La corbeille n’a pas pu être chargée."));
    } finally {
      if (!silencieux) setChargement(false);
    }
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  useEffect(() => {
    if (!socket) return;
    const actualiser = () => void charger(true);
    const evenements = ["publication:restored", "publication:commentRestored", "publication:deleted", "publication:commentDeleted"];
    evenements.forEach((evenement) => socket.on(evenement, actualiser));
    return () => evenements.forEach((evenement) => socket.off(evenement, actualiser));
  }, [charger, socket]);

  const executer = async (element: ElementCorbeille, type: "restaurer" | "effacer") => {
    if (verrou.current) return;
    verrou.current = true;
    setAction({ cle: cle(element), type });
    setAnnonce(null);
    try {
      if (type === "restaurer") {
        const { data } = await restaurerDepuisCorbeille(element.type, element.id);
        setAnnonce({ texte: data.message || (element.type === "publication" ? "Publication restaurée." : "Commentaire restauré."), lien: "/dashboard" });
      } else {
        await effacerDeLaCorbeille(element.type, element.id);
        setAnnonce({ texte: "Élément effacé définitivement." });
      }
      setDonnees((actuelles) => actuelles && { ...actuelles, elements: actuelles.elements.filter((e) => cle(e) !== cle(element)) });
      void charger(true);
    } catch (error) {
      setAnnonce({ texte: messageErreur(error, type === "restaurer" ? "La restauration a échoué." : "L’effacement a échoué."), erreur: true });
      void charger(true);
    } finally {
      verrou.current = false;
      setAction(null);
    }
  };

  const elements = donnees?.elements || [];
  const duree = donnees?.dureeConservationJours || 30;

  return (
    <div className="min-h-full min-w-0 bg-[var(--color-page)] px-4 py-6 font-sans text-[#2f261e] [overflow-wrap:anywhere] sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/profil" className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#695c4b] transition hover:text-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">
          <ArrowLeft aria-hidden="true" size={18} />
          Retour au profil
        </Link>
        <header className="rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 sm:p-6">
          <h1 className="titre-section">Corbeille</h1>
          <p className="mt-2 text-sm leading-6 text-[#695c4b] sm:text-base">
            Vos publications et commentaires supprimés restent ici {duree} jours. Vous pouvez les restaurer pendant ce délai ; ensuite, ils sont effacés automatiquement et définitivement.
          </p>
        </header>

        <div aria-live="polite" className="mt-4">
          {annonce && (
            <p role={annonce.erreur ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${annonce.erreur ? "border-[#e8c8b8] bg-[#fff4ef] text-[#a3321f]" : "border-[#c8dccd] bg-[#edf4ee] text-[#0d6738]"}`}>
              {annonce.texte}
              {annonce.lien && <> <Link href={annonce.lien} className="font-semibold underline underline-offset-2">Voir le fil</Link></>}
            </p>
          )}
        </div>

        {chargement && !donnees ? (
          <div role="status" className="mt-4 flex items-center gap-3 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 text-[#695c4b]">
            <LoaderCircle aria-hidden="true" size={20} className="animate-spin text-[#0d6738]" />
            Chargement de la corbeille…
          </div>
        ) : erreur && !donnees ? (
          <div role="alert" className="mt-4 rounded-2xl border border-[#e8c8b8] bg-[#fffbf5] p-5 text-center">
            <p className="font-semibold text-[#a3321f]">{erreur}</p>
            <button type="button" onClick={() => void charger()} className={BOUTON_PRIMAIRE + " mt-4"}>
              <RefreshCw aria-hidden="true" size={15} />Réessayer
            </button>
          </div>
        ) : !elements.length ? (
          <div className="mt-4 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-8 text-center">
            <Trash2 aria-hidden="true" size={28} className="mx-auto text-[#b99a77]" />
            <p className="mt-3 titre-element">Votre corbeille est vide</p>
            <p className="mt-1 text-sm text-[#806f5e]">Les publications et commentaires que vous supprimez apparaîtront ici pendant {duree} jours.</p>
          </div>
        ) : (
          <ul aria-label="Éléments supprimés" className="mt-4 space-y-3">
            {elements.map((element) => (
              <CarteElement
                key={cle(element)}
                element={element}
                enCours={action?.cle === cle(element) ? action.type : null}
                onRestaurer={() => void executer(element, "restaurer")}
                onEffacer={() => void executer(element, "effacer")}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

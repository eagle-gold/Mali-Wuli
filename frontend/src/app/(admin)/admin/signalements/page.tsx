"use client";

import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Hand, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import api from "@/lib/api";
import { aPermission, type AutorisationsUtilisateur } from "@/lib/autorisations";
import { messageErreur } from "@/lib/community";
import {
  LIBELLES_STATUT_SIGNALEMENT,
  LIBELLES_TYPE_CIBLE,
  STATUTS_SIGNALEMENT,
  TYPES_CIBLE_SIGNALEMENT,
  libelleMotif,
  type SignalementAdmin,
  type StatutSignalement,
  type TypeCibleSignalement,
} from "@/lib/moderation";

const CLASSE_STATUT: Record<StatutSignalement, string> = {
  EN_ATTENTE: "bg-[#f8e4d7] text-[#9a441f]",
  EN_COURS: "bg-[#fff1c7] text-[#6b4f00]",
  TRAITE: "bg-[#e1f1e6] text-[#0d6738]",
  REJETE: "bg-[#efe9e1] text-[#5e5044]",
};
const bouton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dfc9a8] bg-white px-4 text-sm font-semibold text-[#735133] hover:bg-[#f6efe3] focus:outline-none focus:ring-2 focus:ring-[#0d6738] disabled:cursor-not-allowed disabled:opacity-50";
const primaire = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0d6738] px-4 text-sm font-bold text-white hover:bg-[#09572f] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const danger = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#a3321f] px-4 text-sm font-bold text-white hover:bg-[#8a2918] focus:outline-none focus:ring-2 focus:ring-[#a3321f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const selectClasse = "mt-1 min-h-11 w-full rounded-xl border border-[#dfc9a8] bg-white px-3 text-sm text-[#2e261f] outline-none focus:ring-2 focus:ring-[#0d6738]";

const dateFr = (valeur: string | null) => {
  if (!valeur) return "";
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const nomSignaleur = (s: SignalementAdmin) => [s.signaleur?.user.prenom, s.signaleur?.user.nom].filter(Boolean).join(" ") || "Un membre";
/** Le backend ne renvoie l’identifiant de la publication d’un commentaire que dans `href` (/dashboard?publication=…). */
function publicationDuHref(href: string | null) {
  if (!href) return null;
  try { return new URL(href, "http://local").searchParams.get("publication"); } catch { return null; }
}
const estStatut404 = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 404;

type Action = "EN_COURS" | "TRAITE" | "REJETE" | "NOTE";

function CarteSignalement({ signalement, peutRetirer, onMisAJour }: {
  signalement: SignalementAdmin;
  peutRetirer: boolean;
  onMisAJour: (message: string) => void;
}) {
  const [note, setNote] = useState(signalement.noteInterne || "");
  const [retirer, setRetirer] = useState(false);
  const [enCours, setEnCours] = useState<Action | null>(null);
  const [erreur, setErreur] = useState("");
  const verrou = useRef(false);
  const noteId = useId();
  const retirerId = useId();
  const { cible } = signalement;
  const contenuRetirable = (cible.type === "PUBLICATION" || cible.type === "COMMENTAIRE") && cible.existe && !cible.supprime;
  const clos = signalement.statut === "TRAITE" || signalement.statut === "REJETE";
  const noteModifiee = note.trim() !== (signalement.noteInterne || "").trim();

  useEffect(() => { setNote(signalement.noteInterne || ""); }, [signalement.noteInterne]);

  const agir = async (action: Action) => {
    if (verrou.current) return;
    verrou.current = true; setEnCours(action); setErreur("");
    try {
      if (action === "TRAITE" && retirer && contenuRetirable && peutRetirer) {
        try {
          if (cible.type === "PUBLICATION") await api.delete(`/publications/${encodeURIComponent(cible.id)}`);
          else {
            const publicationId = publicationDuHref(cible.href);
            if (!publicationId) throw new Error("Publication d’origine introuvable : retirez le commentaire depuis le fil.");
            await api.delete(`/publications/${encodeURIComponent(publicationId)}/commentaires/${encodeURIComponent(cible.id)}`);
          }
        } catch (error) {
          // Déjà retiré entre-temps : le résultat voulu est acquis.
          if (!estStatut404(error)) throw error;
        }
      }
      const statut = action === "NOTE" ? signalement.statut : action;
      await api.put(`/admin/signalements/${encodeURIComponent(signalement.id)}`, { statut, noteInterne: note.trim() });
      onMisAJour(action === "NOTE" ? "Note interne enregistrée."
        : action === "EN_COURS" ? "Signalement pris en charge."
          : action === "TRAITE" ? (retirer && contenuRetirable ? "Contenu retiré et signalement traité ; le signaleur a été notifié." : "Signalement traité ; le signaleur a été notifié.")
            : "Signalement rejeté ; le signaleur a été notifié.");
      setRetirer(false);
    } catch (error) {
      setErreur(messageErreur(error, "Cette action n’a pas pu aboutir. Actualisez puis réessayez."));
    } finally {
      verrou.current = false; setEnCours(null);
    }
  };

  const icone = (action: Action) => enCours === action ? <LoaderCircle aria-hidden="true" size={15} className="animate-spin" /> : null;

  return (
    <li className="min-w-0 rounded-[18px] border border-[#e4d2b3] bg-[#fffbf5] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[7px] bg-[#efe4d2] px-3 py-1 text-xs font-bold uppercase text-[#664e39]">{LIBELLES_TYPE_CIBLE[signalement.cibleType] || signalement.cibleType}</span>
        <span className={`rounded-[7px] px-3 py-1 text-xs font-bold ${CLASSE_STATUT[signalement.statut]}`}>{LIBELLES_STATUT_SIGNALEMENT[signalement.statut] || signalement.statut}</span>
        {cible.supprime && <span className="rounded-[7px] bg-[#fbeae4] px-3 py-1 text-xs font-bold text-[#a3321f]">{cible.existe ? "Contenu retiré" : "Contenu introuvable"}</span>}
      </div>
      <h2 className="mt-3 titre-element">{libelleMotif(signalement.motif)}</h2>
      {signalement.details && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#40372f]">« {signalement.details} »</p>}

      <div className="mt-4 rounded-xl border border-[#eadfce] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#806f5e]">Contenu signalé</p>
        {cible.existe ? (
          <>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#2e261f]">{cible.apercu || <span className="italic text-[#806f5e]">(sans texte)</span>}</p>
            {cible.auteur && (
              <p className="mt-1 text-xs text-[#735133]">
                Auteur : {cible.auteurId ? <Link href={`/membres/${encodeURIComponent(cible.auteurId)}`} className="font-semibold text-[#0d6738] hover:underline">{cible.auteur}</Link> : cible.auteur}
              </p>
            )}
            {cible.href && (
              <Link href={cible.href} target="_blank" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#0d6738] hover:underline focus:outline-none focus:ring-2 focus:ring-[#0d6738]">
                Ouvrir <ExternalLink aria-hidden="true" size={13} /><span className="sr-only">(nouvel onglet)</span>
              </Link>
            )}
          </>
        ) : <p className="mt-1 text-sm italic text-[#806f5e]">Le contenu n’existe plus.</p>}
        <p className="mt-2 break-all text-[11px] text-[#a39583]">Référence : {signalement.cibleId}</p>
      </div>

      <p className="mt-3 text-xs text-[#735133]">
        Signalé par {signalement.signaleur ? <Link href={`/membres/${encodeURIComponent(signalement.signaleur.id)}`} className="font-semibold text-[#0d6738] hover:underline">{nomSignaleur(signalement)}</Link> : "un membre"} · {dateFr(signalement.createdAt)}
        {signalement.traiteLe && <> · clos le {dateFr(signalement.traiteLe)}</>}
      </p>

      <label htmlFor={noteId} className="mt-4 block text-sm font-semibold text-[#2e261f]">Note interne <span className="font-normal text-[#806f5e]">(visible uniquement par l’équipe)</span></label>
      <textarea
        id={noteId}
        value={note}
        maxLength={2000}
        rows={2}
        disabled={Boolean(enCours)}
        onChange={(event) => setNote(event.target.value)}
        className="mt-1 w-full resize-y rounded-xl border border-[#dfc9a8] bg-white px-3 py-2 text-sm text-[#2e261f] outline-none focus:ring-2 focus:ring-[#0d6738] disabled:opacity-60"
      />

      {!clos && contenuRetirable && (
        peutRetirer ? (
          <div className="mt-3 flex items-start gap-2">
            <input id={retirerId} type="checkbox" checked={retirer} disabled={Boolean(enCours)} onChange={(event) => setRetirer(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#a3321f]" />
            <label htmlFor={retirerId} className="text-sm text-[#40372f]">
              Retirer aussi {cible.type === "PUBLICATION" ? "la publication" : "le commentaire"} en traitant <span className="text-[#806f5e]">(l’auteur ne pourra pas le restaurer)</span>
            </label>
          </div>
        ) : <p className="mt-3 text-xs text-[#806f5e]">Le retrait du contenu nécessite la délégation « Gestion des publications ».</p>
      )}

      {erreur && <p role="alert" className="mt-3 rounded-lg bg-[#fde8e7] px-3 py-2 text-sm text-[#a22922]">{erreur}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {signalement.statut === "EN_ATTENTE" && (
          <button type="button" disabled={Boolean(enCours)} onClick={() => void agir("EN_COURS")} className={bouton}>
            {icone("EN_COURS") || <Hand aria-hidden="true" size={15} />}Prendre en charge
          </button>
        )}
        {!clos && (
          <>
            <button type="button" disabled={Boolean(enCours)} onClick={() => void agir("TRAITE")} className={retirer && contenuRetirable ? danger : primaire}>
              {icone("TRAITE") || <Check aria-hidden="true" size={15} />}{retirer && contenuRetirable ? "Retirer et traiter" : "Traiter"}
            </button>
            <button type="button" disabled={Boolean(enCours)} onClick={() => void agir("REJETE")} className={bouton}>
              {icone("REJETE") || <X aria-hidden="true" size={15} />}Rejeter
            </button>
          </>
        )}
        {noteModifiee && (
          <button type="button" disabled={Boolean(enCours)} onClick={() => void agir("NOTE")} className={bouton}>
            {icone("NOTE")}Enregistrer la note
          </button>
        )}
      </div>
    </li>
  );
}

export default function AdministrationSignalementsPage() {
  const [compte, setCompte] = useState<AutorisationsUtilisateur | null>(null);
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [erreurAcces, setErreurAcces] = useState("");
  const [statut, setStatut] = useState<StatutSignalement | "">("EN_ATTENTE");
  const [type, setType] = useState<TypeCibleSignalement | "">("");
  const [signalements, setSignalements] = useState<SignalementAdmin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [annonce, setAnnonce] = useState("");
  const requete = useRef(0);

  const verifierAcces = useCallback(async () => {
    setAutorise(null); setErreurAcces("");
    try {
      const { data } = await api.get<AutorisationsUtilisateur>("/users/me");
      setCompte(data);
      setAutorise(aPermission(data, "SIGNALEMENTS_CONSULTER"));
    } catch (error) { setErreurAcces(messageErreur(error, "Impossible de vérifier votre accès.")); }
  }, []);
  useEffect(() => { void verifierAcces(); }, [verifierAcces]);

  const charger = useCallback(async (silencieux = false) => {
    const numero = ++requete.current;
    if (!silencieux) setChargement(true);
    setErreur("");
    try {
      const { data } = await api.get<{ signalements: SignalementAdmin[] }>("/admin/signalements", {
        params: { ...(statut ? { statut } : {}), ...(type ? { type } : {}) },
      });
      if (numero === requete.current) setSignalements(data.signalements);
    } catch (error) {
      if (numero === requete.current) setErreur(messageErreur(error, "Impossible de charger les signalements."));
    } finally {
      if (numero === requete.current) setChargement(false);
    }
  }, [statut, type]);
  useEffect(() => { if (autorise) void charger(); }, [autorise, charger]);

  if (!autorise) {
    return <main className="min-h-screen bg-[var(--color-page)] px-4 py-10 font-sans"><section className="mx-auto max-w-xl rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-6"><h1 className="titre-section">Signalements</h1>{erreurAcces ? <><p role="alert" className="mt-4 text-[#a22922]">{erreurAcces}</p><button type="button" onClick={() => void verifierAcces()} className={bouton + " mt-4"}>Réessayer</button></> : <p className="mt-4" role={autorise === null ? "status" : undefined}>{autorise === null ? "Vérification de votre accès…" : "Cet espace est réservé à l’équipe de modération."}</p>}<Link href="/admin" className="mt-5 block font-semibold text-[#0d6738]">Retour à l’administration</Link></section></main>;
  }

  return (
    <main className="min-h-screen bg-[var(--color-page)] px-4 py-8 font-sans sm:px-6 lg:px-10">
      <div className="mx-auto min-w-0 max-w-[980px] space-y-6 [overflow-wrap:anywhere]">
        <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#0d6738] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d6738]">
          <ArrowLeft aria-hidden="true" size={17} />Retour à l’administration
        </Link>
        <header>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-[#c65327]">Modération</p>
          <h1 className="titre-section">Signalements</h1>
          <p className="mt-2 text-sm text-[#56493e] sm:text-base">Examinez les contenus signalés par les membres. Le signaleur est notifié quand le signalement est traité ou rejeté ; son identité n’est jamais communiquée à la personne signalée.</p>
        </header>

        <section aria-label="Filtres" className="grid gap-3 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-semibold text-[#2e261f]">Statut
            <select value={statut} onChange={(event) => setStatut(event.target.value as StatutSignalement | "")} className={selectClasse}>
              <option value="">Tous les statuts</option>
              {STATUTS_SIGNALEMENT.map((valeur) => <option key={valeur} value={valeur}>{LIBELLES_STATUT_SIGNALEMENT[valeur]}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#2e261f]">Type de contenu
            <select value={type} onChange={(event) => setType(event.target.value as TypeCibleSignalement | "")} className={selectClasse}>
              <option value="">Tous les types</option>
              {TYPES_CIBLE_SIGNALEMENT.map((valeur) => <option key={valeur} value={valeur}>{LIBELLES_TYPE_CIBLE[valeur]}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void charger()} disabled={chargement} className={bouton}>
            <RefreshCw aria-hidden="true" size={15} className={chargement ? "animate-spin" : ""} />Actualiser
          </button>
        </section>

        <p role="status" aria-live="polite" className={annonce ? "rounded-xl border border-[#c8dccd] bg-[#edf4ee] p-3 text-sm text-[#0d6738]" : "sr-only"}>{annonce}</p>
        {erreur && <div role="alert" className="rounded-xl bg-[#fde8e7] px-4 py-3 text-sm text-[#a22922]">{erreur}<button type="button" onClick={() => void charger()} className="ml-3 font-semibold underline">Réessayer</button></div>}

        {chargement && !signalements.length ? (
          <p role="status" className="flex items-center gap-2 py-6 text-[#735133]"><LoaderCircle aria-hidden="true" size={18} className="animate-spin" />Chargement des signalements…</p>
        ) : !signalements.length ? (
          <div className="rounded-[16px] border border-dashed border-[#d7b98d] px-5 py-10 text-center text-[#56493e]">Aucun signalement pour ces filtres.</div>
        ) : (
          <>
            <p className="text-sm text-[#56493e]">{signalements.length} signalement{signalements.length > 1 ? "s" : ""}{signalements.length >= 200 ? " (les 200 plus récents)" : ""}</p>
            <ul className="space-y-4">
              {signalements.map((signalement) => (
                <CarteSignalement
                  key={signalement.id}
                  signalement={signalement}
                  peutRetirer={aPermission(compte, "PUBLICATIONS_MODERER")}
                  onMisAJour={(message) => { setAnnonce(message); void charger(true); }}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

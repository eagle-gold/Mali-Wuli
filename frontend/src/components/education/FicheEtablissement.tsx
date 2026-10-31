"use client";

import axios from "axios";
import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { urlMediaBackend } from "@/lib/media";
import { BoutonSignaler } from "@/components/community/SignalerContenu";
import NoteEtoiles from "./NoteEtoiles";
import { detailLieu } from "@/lib/education/localisation-etablissement";
import type { EtablissementDetail, ReponseEtablissementDetail, TonEtablissement } from "./types-etablissements";
import ImageAvecRepli from "@/components/ui/ImageAvecRepli";

const TONS: Record<TonEtablissement, string> = {
  vert: "bg-[#e3f1eb] text-brand", orange: "bg-[#f8e4d8] text-[#bd592d]",
  sable: "bg-[#f1e8d7] text-[#765131]", olive: "bg-[#ebefdf] text-[#637d38]",
};
function nombreFrancais(nombre: number) { return nombre.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function sigle(etablissement: EtablissementDetail) { return etablissement.sigle?.trim().slice(0, 8) || etablissement.nom.split(/\s+/).filter((mot) => mot.length > 2).slice(0, 4).map((mot) => mot[0]).join("").toUpperCase() || "ÉT"; }
function dateRelative(date: string) {
  const jours = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
  if (Math.abs(jours) < 1) return "aujourd’hui";
  return new Intl.RelativeTimeFormat("fr", { numeric: "auto" }).format(jours, "day");
}
function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return <section className="rounded-[18px] border border-line-soft bg-surface-raised p-5 sm:p-7"><h2 className="titre-section">{titre}</h2>{children}</section>;
}

export default function FicheEtablissement({ etablissementId }: { etablissementId: string }) {
  const [reponse, setReponse] = useState<ReponseEtablissementDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [revision, setRevision] = useState(0);
  const [afficherTous, setAfficherTous] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "auto" });
  }, [etablissementId]);
  useEffect(() => {
    const controleur = new AbortController(); setChargement(true); setErreur("");
    api.get<ReponseEtablissementDetail>(`/education/etablissements/${encodeURIComponent(etablissementId)}`, { signal: controleur.signal })
      .then(({ data }) => setReponse(data)).catch((cause) => {
        if (!controleur.signal.aborted) setErreur(axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message || "Impossible de charger cette fiche." : "Impossible de charger cette fiche.");
      }).finally(() => { if (!controleur.signal.aborted) setChargement(false); });
    return () => controleur.abort();
  }, [etablissementId, revision]);

  if (chargement && !reponse) return <EtatFiche titre="Chargement de la fiche…" />;
  if (erreur || !reponse) return <EtatFiche titre={erreur || "Établissement introuvable."}><button type="button" onClick={() => setRevision((valeur) => valeur + 1)} className="mt-5 rounded-xl bg-brand px-5 py-3 font-bold text-white">Réessayer</button></EtatFiche>;

  const { etablissement, moi } = reponse;
  const estScolaire = etablissement.type === "FONDAMENTALE" || etablissement.type === "LYCEE";
  const estSuperieur = etablissement.type === "UNIVERSITE" || etablissement.type === "ECOLE_SUPERIEURE";
  const avisAffiches = afficherTous ? etablissement.avisApercu : etablissement.avisApercu.slice(0, 2);
  const lieu = detailLieu(etablissement);

  return <section className="min-h-[calc(100dvh-var(--mw-header-h))] min-w-0 [overflow-wrap:anywhere] bg-[var(--color-page)] px-4 py-6 text-ink sm:px-6 sm:py-8 lg:px-10">
    <div className="mx-auto w-full max-w-[1510px]">
      <div className="flex flex-wrap items-center justify-between gap-2"><Link href="/education" className="inline-flex min-h-11 items-center rounded-lg pr-3 text-sm font-medium text-[#55483b] hover:text-brand hover:underline">‹ Tous les établissements</Link><BoutonSignaler cibleType="ETABLISSEMENT" cibleId={etablissement.id} libelleCible={`la fiche « ${etablissement.nom} »`} /></div>
      <div className="mt-2 grid gap-6 min-[960px]:grid-cols-[minmax(0,2fr)_minmax(300px,.78fr)] min-[960px]:items-start">
        <div className="min-w-0 space-y-5">
          <article className="overflow-hidden rounded-[18px] border border-line-soft bg-surface-raised">
            <div className="relative h-24 border-b-2 border-[#a47a32] bg-[#f2ede1] sm:h-28"><span className={`absolute -bottom-12 left-6 flex h-20 min-w-20 items-center justify-center rounded-2xl border border-[#eee3d2] bg-surface-raised px-3 text-center text-lg font-bold shadow-md sm:left-8 sm:h-24 sm:min-w-24 ${TONS[etablissement.ton].split(" ").at(-1)}`}>{sigle(etablissement)}</span></div>
            <div className="px-6 pb-7 pt-16 sm:px-8 sm:pb-8 sm:pt-[68px]">
              <h1 className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">{etablissement.nom}</h1>
              <p className="mt-1 text-sm text-ink-muted sm:text-base">{[etablissement.niveau, [etablissement.ville, etablissement.pays].filter(Boolean).join(", "), etablissement.statut].filter(Boolean).join(" · ")}</p>
              {lieu && <p className="mt-1 text-sm text-[#55483b]"><span className="sr-only">Localisation : </span>{lieu}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">{etablissement.note === null ? <span className="text-sm text-ink-muted">Aucun avis publié</span> : <><NoteEtoiles note={etablissement.note} /><strong>{nombreFrancais(etablissement.note)}</strong><span className="text-sm text-ink-muted">sur 5 · {etablissement.nombreAvis} avis d’anciens</span></>}</div>
              {etablissement.description && <p className="mt-6 text-base leading-relaxed text-[#40372f] sm:text-lg">{etablissement.description}</p>}
              {!!etablissement.parcours.length && <div className="mt-5 flex flex-wrap gap-2">{etablissement.parcours.map((parcours) => <span key={parcours} className="rounded-full bg-[#f0e5d0] px-4 py-2 text-sm font-semibold text-[#55483b]">{parcours}</span>)}</div>}
              {etablissement.siteWeb && <a href={etablissement.siteWeb} target="_blank" rel="noreferrer" className="mt-5 inline-flex font-bold text-brand hover:underline">Site de l’établissement ↗</a>}
            </div>
          </article>

          <section className="rounded-[18px] border border-line-soft bg-surface-raised p-5 sm:p-7">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee3d2] pb-4"><div><h2 className="titre-section">Membres affiliés</h2><p className="mt-1 text-sm text-ink-muted">D’après les formations déclarées à l’inscription.</p></div><span className="rounded-full bg-[#e3f1eb] px-4 py-2 text-sm font-bold text-brand">{etablissement.membres} membres</span></header>
            {etablissement.membresApercu.length ? etablissement.membresApercu.map((membre) => <div key={membre.id} className="flex min-h-[78px] items-center gap-4 border-b border-[#f0e7da] py-4 last:border-0"><ImageAvecRepli src={urlMediaBackend(membre.photo)} className="h-12 w-12 rounded-full object-cover" repli={<span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold ${TONS[membre.ton]}`}>{membre.initiales}</span>} /><span className="min-w-0 flex-1"><strong className="block sm:text-lg">{membre.nom}</strong>{(membre.fonction || membre.ville) && <span className="block text-sm text-[#55483b]">{[membre.fonction, membre.ville].filter(Boolean).join(" · ")}</span>}</span>{membre.promotion && <span className="shrink-0 rounded-full bg-[#f4ecdc] px-3 py-2 text-xs font-semibold text-ink-muted">promo {membre.promotion}</span>}</div>) : <p className="py-8 text-center text-ink-muted">Aucun membre validé n’est encore affilié à cet établissement.</p>}
          </section>

          <section className="rounded-[18px] border border-line-soft bg-surface-raised p-5 sm:p-7">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eee3d2] pb-5"><div><h2 className="titre-section">Avis des anciens</h2><p className="mt-1 text-sm text-ink-muted">{estScolaire ? "Avis réservés aux anciens diplômés depuis au moins 1 an." : "Seuls les membres rattachés à l’établissement peuvent noter."}</p></div>{etablissement.note !== null && <div className="text-right"><p className="text-3xl font-bold">{nombreFrancais(etablissement.note)}<span className="text-lg"> / 5</span></p><NoteEtoiles note={etablissement.note} compacte /><p className="mt-1 text-xs text-ink-muted">{etablissement.nombreAvis} avis</p></div>}</header>
            {avisAffiches.length ? avisAffiches.map((avis) => <article key={avis.id} className="flex gap-4 border-b border-[#f0e7da] py-5 last:border-0"><ImageAvecRepli src={urlMediaBackend(avis.photo)} className="h-12 w-12 rounded-full object-cover" repli={<span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold ${TONS[avis.ton]}`}>{avis.initiales}</span>} /><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-3"><h3 className="titre-element">{avis.nom}</h3><span className="text-xs text-ink-muted">{avis.promotion ? `promo ${avis.promotion} · ` : ""}{dateRelative(avis.createdAt)}</span></div><div className="mt-1 flex items-center gap-2"><NoteEtoiles note={avis.note} compacte /><strong className="text-sm">{nombreFrancais(avis.note)}</strong></div>{avis.commentaire && <p className="mt-2 text-sm leading-relaxed text-[#40372f] sm:text-base">{avis.commentaire}</p>}</div></article>) : <p className="py-8 text-center text-ink-muted">Aucun avis n’a encore été publié.</p>}
            {etablissement.avisApercu.length > 2 && <button type="button" onClick={() => setAfficherTous((valeur) => !valeur)} className="mt-5 min-h-11 rounded-xl border border-line-soft px-5 py-3 font-bold">{afficherTous ? "Réduire les avis" : "Tous les avis"}</button>}
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <Carte titre="En chiffres"><dl className="mt-5 space-y-4 text-sm sm:text-base"><Ligne libelle="Promotions représentées" valeur={etablissement.promotions} /><Ligne libelle="Membres dans la diaspora" valeur={etablissement.diaspora} /><Ligne libelle="Volontaires au mentorat" valeur={etablissement.volontaires} />{estSuperieur && <Ligne libelle="Insertion à 12 mois" valeur={etablissement.insertion === null ? "Pas assez de réponses" : `${etablissement.insertion} % (${etablissement.repondantsInsertion})`} />}</dl></Carte>
          <Carte titre="Où travaillent les anciens">{etablissement.employeurs.length ? <div className="mt-4">{etablissement.employeurs.map((employeur) => <div key={employeur.nom} className="flex items-start gap-3 border-b border-[#eee3d2] py-3 last:border-0"><div className="min-w-0 flex-1"><h3 className="titre-element">{employeur.nom}</h3>{(employeur.secteur || employeur.ville) && <p className="mt-1 text-xs text-ink-muted">{[employeur.secteur, employeur.ville].filter(Boolean).join(" · ")}</p>}</div><span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#e3f1eb] px-2 text-sm font-bold text-brand">{employeur.membres}</span></div>)}</div> : <p className="mt-4 text-sm text-ink-muted">Aucun employeur actuel renseigné.</p>}</Carte>
          <Carte titre="Où vivent les anciens">{etablissement.villesAnciens.length ? <div className="mt-5 space-y-4">{etablissement.villesAnciens.map((entree) => { const maximum = Math.max(...etablissement.villesAnciens.map(({ membres }) => membres)); return <div key={entree.ville}><div className="flex justify-between text-sm"><strong>{entree.ville}</strong><span className="text-ink-muted">{entree.membres}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-[#bd592d]" style={{ width: `${(entree.membres / maximum) * 100}%` }} /></div></div>; })}</div> : <p className="mt-4 text-sm text-ink-muted">Aucune ville de résidence renseignée.</p>}</Carte>
          <section className="rounded-[18px] bg-brand p-5 text-white sm:p-7"><h2 className="titre-section text-white">{moi.affilie ? "Votre parcours est rattaché" : "Vous êtes passé par ici ?"}</h2><p className="mt-2 text-sm leading-relaxed text-[#e0eee6]">{moi.affilie ? (moi.peutDonnerAvis ? "Vous pouvez compléter ou modifier votre avis depuis vos formations." : estScolaire ? "Un avis sera possible après obtention du diplôme et un délai d’un an." : "Mettez à jour cette formation depuis votre parcours.") : "Ajoutez cet établissement à vos formations pour apparaître parmi ses anciens."}</p><Link href="/onboarding?etape=formations" className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-surface-raised px-5 py-3 text-center font-bold text-brand">{moi.affilie ? "Modifier mon parcours" : "Ajouter à mon parcours"}</Link></section>
        </aside>
      </div>
    </div>
  </section>;
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: number | string }) { return <div className="flex items-center justify-between gap-4"><dt className="text-ink-muted">{libelle}</dt><dd className="text-right font-bold">{valeur}</dd></div>; }
function EtatFiche({ titre, children }: { titre: string; children?: React.ReactNode }) { return <section className="min-h-[calc(100dvh-var(--mw-header-h))] min-w-0 [overflow-wrap:anywhere] bg-[var(--color-page)] px-4 py-20 text-center text-ink"><h1 className="font-display text-2xl font-bold text-ink">{titre}</h1>{children}<div><Link href="/education" className="mt-5 inline-flex text-brand hover:underline">Retour aux établissements</Link></div></section>; }

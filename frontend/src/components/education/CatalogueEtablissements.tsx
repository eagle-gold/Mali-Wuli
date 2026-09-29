"use client";

import axios from "axios";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import api from "@/lib/api";
import NoteEtoiles from "./NoteEtoiles";
import { nomAvecLocalite } from "@/lib/education/localisation-etablissement";
import type { EtablissementListe, ReponseListeEtablissements, TonEtablissement } from "./types-etablissements";

const TONS: Record<TonEtablissement, string> = {
  vert: "bg-[#e3f1eb] text-[#0d6738]", orange: "bg-[#f8e4d8] text-[#bd592d]",
  sable: "bg-[#f1e8d7] text-[#7b5b2d]", olive: "bg-[#ebefdf] text-[#637d38]",
};
const NIVEAUX = [
  ["FONDAMENTALE", "École fondamentale"], ["LYCEE", "Lycée"], ["UNIVERSITE", "Université"],
  ["GRANDE_ECOLE", "Grande école"], ["INSTITUT", "Institut"],
] as const;

function sigle(etablissement: EtablissementListe) {
  return etablissement.sigle?.trim().slice(0, 8) || etablissement.nom.split(/\s+/).filter((mot) => mot.length > 2).slice(0, 4).map((mot) => mot[0]).join("").toUpperCase() || "ÉT";
}
function messageErreur(erreur: unknown) {
  return axios.isAxiosError<{ message?: string }>(erreur)
    ? erreur.response?.data?.message || "Le catalogue n’est pas disponible pour le moment."
    : "Le catalogue n’est pas disponible pour le moment.";
}

export default function CatalogueEtablissements() {
  const [niveau, setNiveau] = useState("");
  const [pays, setPays] = useState("");
  const [ville, setVille] = useState("");
  const [commune, setCommune] = useState("");
  const [recherche, setRecherche] = useState("");
  const [requete, setRequete] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [reponse, setReponse] = useState<ReponseListeEtablissements | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const controleur = new AbortController();
    setChargement(true); setErreur("");
    api.get<ReponseListeEtablissements>("/education/etablissements", {
      params: { ...(niveau && { niveau }), ...(pays && { pays }), ...(ville && { ville }), ...(ville && commune && { commune }), ...(requete && { q: requete }), page, limite: 12 },
      signal: controleur.signal,
    }).then(({ data }) => setReponse(data)).catch((cause) => {
      if (!controleur.signal.aborted) setErreur(messageErreur(cause));
    }).finally(() => { if (!controleur.signal.aborted) setChargement(false); });
    return () => controleur.abort();
  }, [commune, niveau, page, pays, requete, revision, ville]);

  const rechercher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequete(recherche.trim());
    setPage(1);
  };
  const reinitialiser = () => { setNiveau(""); setPays(""); setVille(""); setCommune(""); setRecherche(""); setRequete(""); setPage(1); };
  const etablissements = reponse?.etablissements || [];
  const pagination = reponse?.pagination;

  return (
    <section className="min-h-[calc(100dvh-112px)] min-w-0 [overflow-wrap:anywhere] bg-[var(--color-page)] px-4 py-8 text-[#2d241d] sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1510px]">
        <header>
          <h1 className="font-display text-3xl font-bold leading-tight text-[#292119] sm:text-4xl">Établissements</h1>
          <p className="mt-1 max-w-[900px] text-sm leading-relaxed text-[#55483b] sm:text-base lg:text-lg">Lycées, universités, grandes écoles et instituts. Chaque fiche rassemble les membres qui y sont passés, d’après leur inscription, et le devenir des promotions.</p>
        </header>

        <form onSubmit={rechercher} role="search" className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Rechercher un établissement</span>
            <input value={recherche} onChange={(event) => setRecherche(event.target.value)} maxLength={120} placeholder="Nom, sigle, commune ou localité…" className="h-14 w-full rounded-xl border border-[#eadfce] bg-[#fffdf9] px-4 text-base outline-none focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20" />
          </label>
          <button type="submit" className="min-h-14 rounded-xl bg-[#0d6738] px-6 py-3 font-bold text-white transition hover:bg-[#095a30] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2">Rechercher</button>
        </form>

        <div className="mt-4 flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-end">
          <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2 min-[900px]:max-w-[930px] min-[900px]:grid-cols-3">
            <label className="block min-w-0"><span className="mb-2 block text-xs font-bold uppercase tracking-[.09em] text-[#766957]">Niveau</span>
              <select value={niveau} onChange={(event) => { setNiveau(event.target.value); setVille(""); setCommune(""); setPage(1); }} className="h-14 w-full rounded-xl border border-[#eadfce] bg-[#fffdf9] px-4 font-semibold outline-none focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"><option value="">Tous les niveaux</option>{NIVEAUX.map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}</select>
            </label>
            <label className="block min-w-0"><span className="mb-2 block text-xs font-bold uppercase tracking-[.09em] text-[#766957]">Pays</span>
              <select value={pays} onChange={(event) => { setPays(event.target.value); setVille(""); setCommune(""); setPage(1); }} className="h-14 w-full rounded-xl border border-[#eadfce] bg-[#fffdf9] px-4 font-semibold outline-none focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"><option value="">Tous les pays</option>{(reponse?.filtres.pays || []).map((option) => <option key={option.code} value={option.code}>{option.nom}</option>)}</select>
            </label>
            <label className="block min-w-0 sm:col-span-2 min-[900px]:col-span-1"><span className="mb-2 block text-xs font-bold uppercase tracking-[.09em] text-[#766957]">Ville</span>
              <select value={ville} disabled={!pays} onChange={(event) => { setVille(event.target.value); setCommune(""); setPage(1); }} className="h-14 w-full rounded-xl border border-[#eadfce] bg-[#fffdf9] px-4 font-semibold outline-none focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20 disabled:cursor-not-allowed disabled:opacity-60"><option value="">{pays ? "Toutes les villes" : "Choisissez d’abord un pays"}</option>{(reponse?.filtres.villes || []).map((option) => <option key={option}>{option}</option>)}</select>
            </label>
            {ville && (commune || !!reponse?.filtres.communes?.length) && <label className="block min-w-0"><span className="mb-2 block text-xs font-bold uppercase tracking-[.09em] text-[#766957]">Commune</span>
              <select value={commune} onChange={(event) => { setCommune(event.target.value); setPage(1); }} className="h-14 w-full rounded-xl border border-[#eadfce] bg-[#fffdf9] px-4 font-semibold outline-none focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"><option value="">Toutes les communes</option>{(reponse?.filtres.communes || []).map((option) => <option key={option}>{option}</option>)}</select>
            </label>}
          </div>
          <p className="pb-4 text-sm text-[#887764] min-[900px]:ml-auto" aria-live="polite">{chargement && !reponse ? "Chargement…" : `${pagination?.total || 0} établissement${(pagination?.total || 0) > 1 ? "s" : ""}`}</p>
        </div>

        {erreur ? <EtatMessage titre="Impossible de charger les établissements." texte={erreur}><button type="button" onClick={() => setRevision((valeur) => valeur + 1)} className="mt-5 min-h-11 rounded-xl bg-[#0d6738] px-5 py-3 font-bold text-white">Réessayer</button></EtatMessage>
          : chargement && !reponse ? <div className="mt-6 grid gap-5 min-[900px]:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[272px] animate-pulse rounded-[18px] border border-[#eadfce] bg-[#fffdf9]/70" />)}</div>
          : etablissements.length ? <>
            <div className={`mt-6 grid gap-5 min-[900px]:grid-cols-2 ${chargement ? "opacity-60" : ""}`} aria-busy={chargement}>
              {etablissements.map((etablissement) => <CarteEtablissement key={etablissement.id} etablissement={etablissement} />)}
            </div>
            {pagination && pagination.totalPages > 1 && <nav aria-label="Pagination des établissements" className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button type="button" disabled={page <= 1 || chargement} onClick={() => setPage((valeur) => Math.max(1, valeur - 1))} className="min-h-11 rounded-xl border border-[#d8c5a6] bg-[#fffdf9] px-5 py-3 font-bold disabled:opacity-50">Précédent</button>
              <span className="text-sm font-semibold text-[#766957]">Page {pagination.page} sur {pagination.totalPages}</span>
              <button type="button" disabled={page >= pagination.totalPages || chargement} onClick={() => setPage((valeur) => valeur + 1)} className="min-h-11 rounded-xl border border-[#d8c5a6] bg-[#fffdf9] px-5 py-3 font-bold disabled:opacity-50">Suivant</button>
            </nav>}
          </> : <EtatMessage titre="Aucun établissement ne correspond à ces filtres." texte="Essayez une autre ville ou affichez de nouveau tout le catalogue."><button type="button" onClick={reinitialiser} className="mt-5 min-h-11 rounded-xl bg-[#0d6738] px-5 py-3 font-bold text-white">Réinitialiser les filtres</button></EtatMessage>}
      </div>
    </section>
  );
}

function EtatMessage({ titre, texte, children }: { titre: string; texte: string; children?: React.ReactNode }) {
  return <div className="mt-6 rounded-[18px] border border-[#eadfce] bg-[#fffdf9] px-6 py-14 text-center"><h2 className="titre-section">{titre}</h2><p className="mt-2 text-[#887764]">{texte}</p>{children}</div>;
}

function CarteEtablissement({ etablissement }: { etablissement: EtablissementListe }) {
  const estSuperieur = etablissement.type === "UNIVERSITE" || etablissement.type === "ECOLE_SUPERIEURE";
  return <Link href={`/education/etablissements/${encodeURIComponent(etablissement.id)}`} className="group flex min-h-[272px] flex-col rounded-[18px] border border-[#eadfce] bg-[#fffdf9] p-5 transition hover:-translate-y-0.5 hover:border-[#d5bd98] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0d6738] sm:p-7">
    <div className="flex min-w-0 items-start gap-4"><span className={`flex h-14 min-w-14 shrink-0 items-center justify-center rounded-xl px-2 text-center text-sm font-bold sm:h-16 sm:min-w-16 ${TONS[etablissement.ton]}`}>{sigle(etablissement)}</span><span className="min-w-0 flex-1"><strong className="titre-element block group-hover:text-[#0d6738]">{nomAvecLocalite(etablissement.nom, etablissement)}</strong><span className="mt-1 block text-sm text-[#887764]">{[etablissement.niveau, [etablissement.ville, etablissement.pays].filter(Boolean).join(", "), etablissement.statut].filter(Boolean).join(" · ")}</span><span className="mt-2 flex flex-wrap items-center gap-2">{etablissement.note === null ? <span className="text-sm text-[#887764]">Pas encore d’avis</span> : <><NoteEtoiles note={etablissement.note} compacte /><b className="text-sm">{etablissement.note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b><span className="text-sm text-[#887764]">({etablissement.nombreAvis} avis)</span></>}</span></span></div>
    <p className="my-5 flex-1 text-sm leading-relaxed text-[#40372f] sm:text-base">{etablissement.resume || "Aucune description n’a encore été renseignée pour cet établissement."}</p>
    <dl className={`grid grid-cols-2 gap-4 border-t border-[#eee3d2] pt-4 ${estSuperieur ? "sm:grid-cols-3" : ""}`}><Stat valeur={etablissement.membres} libelle="membres affiliés" couleur="text-[#0d6738]" /><Stat valeur={etablissement.promotions} libelle="promotions représentées" couleur="text-[#765131]" />{estSuperieur && <Stat valeur={etablissement.insertion === null ? "—" : `${etablissement.insertion} %`} libelle={etablissement.insertion === null ? "pas encore de suivi exploitable" : `insertion à 12 mois · ${etablissement.repondantsInsertion} répondant${etablissement.repondantsInsertion > 1 ? "s" : ""}`} couleur={etablissement.insertion === null ? "text-[#a39583]" : "text-[#0d6738]"} />}</dl>
  </Link>;
}

function Stat({ valeur, libelle, couleur }: { valeur: number | string; libelle: string; couleur: string }) {
  return <div className="flex flex-col"><dt className="text-xs text-[#887764] sm:text-sm">{libelle}</dt><dd className={`order-first mb-0.5 text-xl font-bold sm:text-2xl ${couleur}`}>{valeur}</dd></div>;
}

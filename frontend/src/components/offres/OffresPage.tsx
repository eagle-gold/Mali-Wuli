"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { MODES_TRAVAIL, TYPES_OFFRE } from "@/lib/offres";
import { useSocket } from "@/hooks/useSocket";
import { Chargement, ErreurChargement } from "@/components/community/CommunityUi";
import type { OffreApi, OffresResponse } from "@/types/offres";
import CarteOffre from "./CarteOffre";
import DetailOffre from "./DetailOffre";
import { urlOffre } from "./OffresUi";
import styles from "./Offres.module.css";

type Vue = "actives" | "mes-offres" | "enregistrees";
type Selection = { id: string; origine: "lien" | "liste" } | null;
const vueValide = (valeur: string | null): Vue => valeur === "mes-offres" || valeur === "enregistrees" ? valeur : "actives";
function mettreUrl(id: string | null, vue?: Vue) {
  const url = new URL(window.location.href); url.hash = "";
  if (id) url.searchParams.set("offre", id); else url.searchParams.delete("offre");
  if (vue) { if (vue === "actives") url.searchParams.delete("vue"); else url.searchParams.set("vue", vue); }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
function ancienId(): string | null { if (!window.location.hash) return null; try { return decodeURIComponent(window.location.hash.slice(1)) || null; } catch { return null; } }
export default function OffresPage() {
  const params = useSearchParams(); const query = params.toString();
  const [vue, setVue] = useState<Vue>(() => vueValide(params.get("vue")));
  const [recherche, setRecherche] = useState(""); const [q, setQ] = useState("");
  const [filtres, setFiltres] = useState({ pays: "", ville: "", type: "", secteur: "", modeTravail: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OffresResponse | null>(null);
  const [chargement, setChargement] = useState(true); const [erreur, setErreur] = useState("");
  const [selection, setSelection] = useState<Selection>(() => params.get("offre") ? { id: params.get("offre")!, origine: "lien" } : null);
  const [detail, setDetail] = useState<OffreApi | null>(null); const [chargementDetail, setChargementDetail] = useState(false); const [erreurDetail, setErreurDetail] = useState("");
  const [revision, setRevision] = useState(0); const [revisionDetail, setRevisionDetail] = useState(0);
  const [annonce, setAnnonce] = useState("");
  const offresSupprimees = useRef(new Set<string>());
  const [mobileDetail, setMobileDetail] = useState(Boolean(params.get("offre")));
  const detailRef = useRef<HTMLDivElement>(null); const selectionRef = useRef(selection); const vueRef = useRef(vue);
  const focusDetail = useRef(false); const requeteListe = useRef(0); const requeteDetail = useRef(0);
  selectionRef.current = selection; vueRef.current = vue;
  const socket = useSocket();
  const actualiserListe = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    function synchroniser() {
      const url = new URL(window.location.href); const id = url.searchParams.get("offre") || ancienId(); const nouvelleVue = vueValide(url.searchParams.get("vue"));
      if (nouvelleVue !== vueRef.current) { setVue(nouvelleVue); setPage(1); }
      if (id && selectionRef.current?.id !== id) { setSelection({ id, origine: "lien" }); setMobileDetail(true); }
      if (!id && selectionRef.current?.origine === "lien") { setSelection(null); setMobileDetail(false); }
    }
    synchroniser(); window.addEventListener("hashchange", synchroniser); window.addEventListener("popstate", synchroniser);
    return () => { window.removeEventListener("hashchange", synchroniser); window.removeEventListener("popstate", synchroniser); };
  }, [query]);
  useEffect(() => { const timer = window.setTimeout(() => { setQ(recherche.trim()); setPage(1); setRevision((r) => r + 1); }, 300); return () => window.clearTimeout(timer); }, [recherche]);
  useEffect(() => {
    const abort = new AbortController(); const numero = ++requeteListe.current; setChargement(true); setErreur("");
    void api.get<OffresResponse>("/offres", { signal: abort.signal, params: { vue, q: q || undefined, pays: filtres.pays || undefined, ville: filtres.ville || undefined, type: filtres.type || undefined, secteur: filtres.secteur || undefined, modeTravail: filtres.modeTravail || undefined, page, limite: 12 } }).then(({ data: resultat }) => {
      if (abort.signal.aborted || numero !== requeteListe.current) return;
      if (page > 1 && !resultat.offres.length && resultat.meta.totalPages < page) { setPage(Math.max(1, resultat.meta.totalPages)); return; }
      resultat = { ...resultat, offres: resultat.offres.filter((offre) => !offresSupprimees.current.has(offre.id)) };
      setData(resultat);
      setSelection((actuelle) => actuelle?.origine === "lien" ? actuelle : actuelle && resultat.offres.some((o) => o.id === actuelle.id) ? actuelle : resultat.offres[0] ? { id: resultat.offres[0].id, origine: "liste" } : null);
    }).catch((e) => { if (!abort.signal.aborted && numero === requeteListe.current) setErreur(messageErreur(e, "Impossible de charger les offres.")); }).finally(() => { if (!abort.signal.aborted && numero === requeteListe.current) setChargement(false); });
    return () => abort.abort();
  }, [vue, q, filtres, page, revision]);
  const selectionId = selection?.id;
  useEffect(() => {
    const abort = new AbortController(); const numero = ++requeteDetail.current; setDetail((ancienne) => ancienne?.id === selectionId ? ancienne : null); setErreurDetail("");
    if (!selectionId) { setChargementDetail(false); return; }
    setChargementDetail(true);
    void api.get<{ offre: OffreApi }>(urlOffre(selectionId), { signal: abort.signal }).then(({ data: resultat }) => {
      if (!abort.signal.aborted && numero === requeteDetail.current && !offresSupprimees.current.has(resultat.offre.id)) setDetail(resultat.offre);
    }).catch((e) => { if (!abort.signal.aborted && numero === requeteDetail.current) { setDetail(null); setErreurDetail(messageErreur(e, "Cette offre n’est plus disponible.")); } }).finally(() => { if (!abort.signal.aborted && numero === requeteDetail.current) setChargementDetail(false); });
    return () => abort.abort();
  }, [selectionId, revisionDetail]);
  useEffect(() => { if (!socket) return; const recharger = () => { setRevision((r) => r + 1); setRevisionDetail((r) => r + 1); }; socket.on("offre_modifiee", recharger); socket.on("offre_supprimee", recharger); return () => { socket.off("offre_modifiee", recharger); socket.off("offre_supprimee", recharger); }; }, [socket]);
  useEffect(() => { if (mobileDetail && focusDetail.current) { focusDetail.current = false; if (window.matchMedia("(max-width: 760px)").matches) { detailRef.current?.focus({ preventScroll: true }); detailRef.current?.scrollIntoView({ block: "start", behavior: "auto" }); } } }, [mobileDetail, selectionId]);
  function viderSelection() { requeteListe.current++; requeteDetail.current++; setChargement(true); setSelection(null); setDetail(null); setMobileDetail(false); mettreUrl(null); }
  function filtrer(cle: keyof typeof filtres, valeur: string) { viderSelection(); setFiltres((f) => ({ ...f, [cle]: valeur, ...(cle === "pays" ? { ville: "" } : {}) })); setPage(1); }
  function choisirVue(valeur: Vue) { viderSelection(); mettreUrl(null, valeur); setVue(valeur); setPage(1); setRevision((r) => r + 1); }
  function selectionner(id: string) { focusDetail.current = true; setSelection({ id, origine: "liste" }); setMobileDetail(true); mettreUrl(id); }
  function changerPage(valeur: number) { viderSelection(); setPage(valeur); }
  const modifierOffre = useCallback((id: string, modification: Partial<OffreApi>) => {
    setDetail((ancienne) => ancienne?.id === id ? { ...ancienne, ...modification } : ancienne);
    setData((ancienne) => ancienne ? { ...ancienne, offres: ancienne.offres.map((o) => o.id === id ? { ...o, ...modification } : o) } : ancienne);
    if ("estEnregistree" in modification) {
      if (!modification.estEnregistree && vueRef.current === "enregistrees" && selectionRef.current?.id === id) { setSelection(null); setDetail(null); setMobileDetail(false); mettreUrl(null); }
      setRevision((r) => r + 1);
    }
  }, []);
  const retirerOffre = useCallback((id: string) => {
    offresSupprimees.current.add(id);
    requeteListe.current++;
    setData((ancienne) => ancienne ? { ...ancienne, offres: ancienne.offres.filter((offre) => offre.id !== id), meta: { ...ancienne.meta, total: Math.max(0, ancienne.meta.total - (ancienne.offres.some((offre) => offre.id === id) ? 1 : 0)) } } : ancienne);
    if (selectionRef.current?.id === id) {
      requeteDetail.current++;
      setSelection(null); setDetail(null); setMobileDetail(false); setChargementDetail(false); setErreurDetail(""); mettreUrl(null);
    }
    setAnnonce("L’offre a été supprimée."); setRevision((r) => r + 1);
  }, []);
  function options(valeurs: string[] | undefined, choisie: string) { return [...new Set([...(valeurs || []), ...(choisie ? [choisie] : [])])]; }
  const compteurs = data?.compteurs;
  return <div className={styles.page}><header className={styles.header}><div><h1 className={styles.title}>Offres d’emploi</h1><p className={styles.subtitle}>Des opportunités partagées par et pour le réseau.</p></div><div className={styles.buttons}>{data?.peutModerer && <Link href="/admin/offres" className={styles.button}>Espace admin{data.compteurs.enAttente > 0 && <span className={styles.counter}>{data.compteurs.enAttente}</span>}</Link>}<Link href="/offres/deposer" className={`${styles.button} ${styles.primary}`}><Plus size={16} aria-hidden />Déposer une offre</Link></div></header>
    {annonce && <p className={styles.message} role="status">{annonce}</p>}
    <form className={styles.search} onSubmit={(e) => { e.preventDefault(); viderSelection(); setQ(recherche.trim()); setPage(1); actualiserListe(); }}><label className={styles.searchLabel}><span className="sr-only">Rechercher une offre</span><Search size={20} className={styles.searchIcon} aria-hidden /><input type="search" maxLength={100} className={styles.input} value={recherche} placeholder="Métier, entreprise, mot-clé…" onChange={(e) => { viderSelection(); setRecherche(e.target.value); }} /></label><button className={styles.button} type="submit" aria-label="Rechercher"><Search size={18} aria-hidden /></button></form>
    <div className={styles.filters}><label className={styles.filterLabel}><span className="sr-only">Pays</span><select className={styles.input} value={filtres.pays} onChange={(e) => filtrer("pays", e.target.value)}><option value="">Tous les pays</option>{options(data?.facettes.pays, filtres.pays).map((p) => <option key={p} value={p}>{p}</option>)}</select></label><label className={styles.filterLabel}><span className="sr-only">Ville</span><select className={styles.input} value={filtres.ville} onChange={(e) => filtrer("ville", e.target.value)}><option value="">Toutes les villes</option>{options(data?.facettes.villes, filtres.ville).map((v) => <option key={v} value={v}>{v}</option>)}</select></label><label className={styles.filterLabel}><span className="sr-only">Contrat</span><select className={styles.input} value={filtres.type} onChange={(e) => filtrer("type", e.target.value)}><option value="">Tous les contrats</option>{TYPES_OFFRE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label><label className={styles.filterLabel}><span className="sr-only">Secteur</span><select className={styles.input} value={filtres.secteur} onChange={(e) => filtrer("secteur", e.target.value)}><option value="">Tous les secteurs</option>{options(data?.facettes.secteurs, filtres.secteur).map((s) => <option key={s} value={s}>{s}</option>)}</select></label><label className={styles.filterLabel}><span className="sr-only">Mode de travail</span><select className={styles.input} value={filtres.modeTravail} onChange={(e) => filtrer("modeTravail", e.target.value)}><option value="">Sur site, hybride, télétravail</option>{MODES_TRAVAIL.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label></div>
    <div className={styles.toolbar}><div className={styles.tabs} aria-label="Vues des offres">{([['actives', 'Toutes les offres', compteurs?.actives], ['enregistrees', 'Enregistrées', compteurs?.enregistrees], ['mes-offres', 'Mes offres', compteurs?.mesOffres]] as const).map(([valeur, libelle, nombre]) => <button type="button" key={valeur} className={styles.tab} aria-pressed={vue === valeur} onClick={() => choisirVue(valeur)}>{libelle}{nombre !== undefined ? ` · ${nombre}` : ""}</button>)}</div><p className={styles.resultCount} aria-live="polite">{chargement ? "Recherche…" : data ? `${data.meta.total} offre${data.meta.total > 1 ? "s" : ""}` : ""}</p></div>
    <div className={styles.columns} data-mobile-detail={mobileDetail}><div className={styles.listColumn}>{chargement ? <Chargement texte="Chargement des offres…" /> : erreur ? <ErreurChargement message={erreur} reessayer={actualiserListe} /> : !data?.offres.length ? <div className={styles.empty}>{vue === "enregistrees" ? "Aucune offre enregistrée ne correspond à ces critères." : vue === "mes-offres" ? "Vous n’avez pas encore déposé d’offre correspondant à ces critères." : "Aucune offre ne correspond à ces critères."}</div> : <><div className={styles.list}>{data.offres.map((offre) => <CarteOffre key={offre.id} offre={offre} selectionnee={offre.id === selectionId} selectionner={selectionner} actualiser={modifierOffre} />)}</div>{data.meta.totalPages > 1 && <nav className={styles.pagination} aria-label="Pagination des offres"><button type="button" className={`${styles.button} ${styles.small}`} disabled={page <= 1} onClick={() => changerPage(page - 1)}>Précédent</button><span>{page} / {data.meta.totalPages}</span><button type="button" className={`${styles.button} ${styles.small}`} disabled={page >= data.meta.totalPages} onClick={() => changerPage(page + 1)}>Suivant</button></nav>}</>}</div><div id="detail-offre" className={styles.detailColumn} ref={detailRef} tabIndex={-1}><button type="button" className={`${styles.button} ${styles.mobileBack}`} onClick={() => setMobileDetail(false)}><ArrowLeft size={16} aria-hidden />Revenir aux offres</button>{chargementDetail && !detail ? <Chargement texte="Chargement de l’offre…" /> : erreurDetail ? <ErreurChargement message={erreurDetail} reessayer={() => setRevisionDetail((r) => r + 1)} /> : detail ? <DetailOffre key={detail.id} offre={detail} actualiser={modifierOffre} onSupprime={retirerOffre} /> : <div className={styles.empty}>Sélectionnez une offre pour consulter le poste et les modalités de candidature.</div>}</div></div>
  </div>;
}

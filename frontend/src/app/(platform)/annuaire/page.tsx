"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Chargement, ErreurChargement } from "@/components/community/CommunityUi";
import { PaginationAnnuaire } from "@/components/directory/DirectoryUi";
import { CartePersonne, CarteAssociation } from "@/components/directory/CartesAnnuaire";
import ProposerAssociation from "@/components/associations/ProposerAssociation";
import type { AnnuaireResponse } from "@/components/directory/types";
import type { AssociationsResponse } from "@/types/associations";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import styles from "@/components/directory/Directory.module.css";

const situations = [["ETUDIANT", "Étudiant"], ["PROFESSIONNEL", "Professionnel"], ["ENTREPRENEUR", "Entrepreneur"], ["EN_RECHERCHE", "En recherche"]];
const filtresVides = { pays: "", ville: "", etablissementId: "", promotion: "", aide: "", situation: "", volontaire: false, vocation: "" };

function ChoixFiltre({ label, valeur, options, changer }: { label: string; valeur: string; options: Array<string | { value: string; label: string }>; changer: (value: string) => void }) {
  const elements = options.map((o) => typeof o === "string" ? { value: o, label: o } : o);
  return <label className={styles.field}>{label}<select className={styles.input} value={valeur} onChange={(e) => changer(e.target.value)}><option value="">{label === "Pays" ? "Tous les pays" : label === "Ville" ? "Toutes les villes" : label}</option>{valeur && !elements.some((o) => o.value === valeur) && <option value={valeur}>{valeur}</option>}{elements.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

function AnnuaireContenu() {
  const params = useSearchParams();
  const qUrl = (params.get("q") || params.get("recherche") || "").trim();
  const typeUrl = params.get("type") === "associations" ? "associations" : "personnes";
  const [onglet, setOnglet] = useState<"personnes" | "associations">(typeUrl);
  const [recherche, setRecherche] = useState(qUrl);
  const [q, setQ] = useState(qUrl);
  const [filtres, setFiltres] = useState(filtresVides);
  const [page, setPage] = useState(1);
  const [personnes, setPersonnes] = useState<AnnuaireResponse | null>(null);
  const [associations, setAssociations] = useState<AssociationsResponse | null>(null);
  const [compteurs, setCompteurs] = useState<{ personnes?: number; associations?: number }>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [revision, setRevision] = useState(0);
  const actualiser = () => setRevision((r) => r + 1);
  useEffect(() => { setRecherche(qUrl); setQ(qUrl); setPage(1); setOnglet(typeUrl); }, [qUrl, typeUrl]);
  useEffect(() => { const minuteur = window.setTimeout(() => { setQ(recherche.trim()); setPage(1); }, 350); return () => window.clearTimeout(minuteur); }, [recherche]);
  useEffect(() => {
    const abort = new AbortController();
    for (const [type, endpoint] of [["personnes", "/users"], ["associations", "/associations"]] as const) {
      void api.get<{ totalGlobal: number }>(endpoint, { params: { limite: 1 }, signal: abort.signal }).then(({ data }) => { if (!abort.signal.aborted && Number.isFinite(data.totalGlobal)) setCompteurs((c) => ({ ...c, [type]: data.totalGlobal })); }).catch(() => {});
    }
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const abort = new AbortController(); setChargement(true); setErreur("");
    const commun = { q: q || undefined, pays: filtres.pays || undefined, ville: filtres.ville || undefined, page, limite: 12 };
    const parametres = onglet === "personnes" ? { ...commun, etablissementId: filtres.etablissementId || undefined, promotion: filtres.promotion || undefined, aide: filtres.aide || undefined, situation: filtres.situation || undefined, volontaire: filtres.volontaire ? "true" : undefined } : { ...commun, vocation: filtres.vocation || undefined };
    void api.get<AnnuaireResponse | AssociationsResponse>(onglet === "personnes" ? "/users" : "/associations", { params: parametres, signal: abort.signal }).then(({ data }) => {
      if (abort.signal.aborted) return;
      if ("membres" in data) setPersonnes(data); else setAssociations(data);
      setCompteurs((c) => ({ ...c, [onglet]: data.totalGlobal }));
    }).catch((e) => { if (!abort.signal.aborted) setErreur(messageErreur(e, "Impossible de charger l’annuaire.")); }).finally(() => { if (!abort.signal.aborted) setChargement(false); });
    return () => abort.abort();
  }, [q, filtres, page, onglet, revision]);
  function filtrer<K extends keyof typeof filtres>(cle: K, valeur: (typeof filtres)[K]) { setFiltres((f) => ({ ...f, [cle]: valeur, ...(cle === "pays" ? { ville: "" } : {}) })); setPage(1); }
  function rechercher(event: FormEvent) { event.preventDefault(); setPage(1); setQ(recherche.trim()); actualiser(); }
  const estPersonnes = onglet === "personnes";
  const data = estPersonnes ? personnes : associations;
  const facettes = data?.facettes;
  return <div className={styles.page}><div className={styles.intro}><div><h1 className={styles.title}>Annuaire</h1><p className={styles.subtitle}>Trouvez la bonne personne ou la bonne association, où qu’elle soit.</p></div><div className={styles.tabs} role="tablist" aria-label="Catégorie de l’annuaire">{(["personnes", "associations"] as const).map((type) => <button key={type} role="tab" type="button" id={`tab-${type}`} aria-controls="resultats-annuaire" aria-selected={onglet === type} className={styles.tab} onClick={() => { setOnglet(type); setPage(1); }}>{type === "personnes" ? "Personnes" : "Associations"}{typeof compteurs[type] === "number" && <span> · {compteurs[type]}</span>}</button>)}</div></div><form onSubmit={rechercher} className={styles.filters}><div className={styles.filterRow}><label className={`${styles.field} ${styles.searchField}`}>{estPersonnes ? "Qui ?" : "Quelle association ?"}<div className={styles.searchWrap}><Search size={17} aria-hidden /><input className={styles.input} type="search" maxLength={100} value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={estPersonnes ? "Nom, métier, établissement…" : "Nom, domaine, mot-clé…"} /></div></label><ChoixFiltre label="Pays" valeur={filtres.pays} options={facettes?.pays || []} changer={(v) => filtrer("pays", v)} /><ChoixFiltre label="Ville" valeur={filtres.ville} options={facettes?.villes || []} changer={(v) => filtrer("ville", v)} /><button type="submit" className={`${styles.button} ${styles.primary} ${styles.searchButton}`}><Search size={17} aria-hidden />Rechercher</button></div><div className={styles.filterRow}>{estPersonnes ? <><ChoixFiltre label="Établissement" valeur={filtres.etablissementId} options={personnes?.facettes?.etablissements.map((e) => ({ value: e.id, label: e.nom })) || []} changer={(v) => filtrer("etablissementId", v)} /><ChoixFiltre label="Promotion" valeur={filtres.promotion} options={personnes?.facettes?.promotions.map(String) || []} changer={(v) => filtrer("promotion", v)} /><ChoixFiltre label="Peut m’aider pour…" valeur={filtres.aide} options={personnes?.facettes?.aides || []} changer={(v) => filtrer("aide", v)} /><ChoixFiltre label="Tous les profils" valeur={filtres.situation} options={situations.map(([value, label]) => ({ value, label }))} changer={(v) => filtrer("situation", v)} /><label className={styles.checkbox}><input type="checkbox" checked={filtres.volontaire} onChange={(e) => filtrer("volontaire", e.target.checked)} />Volontaires</label></> : <ChoixFiltre label="Domaine" valeur={filtres.vocation} options={associations?.facettes?.vocations || []} changer={(v) => filtrer("vocation", v)} />}{(q || Object.values(filtres).some(Boolean)) && <button type="button" className={styles.link} style={{ minHeight: 44 }} onClick={() => { setFiltres(filtresVides); setRecherche(""); setQ(""); setPage(1); }}>Effacer les filtres</button>}</div></form><section id="resultats-annuaire" role="tabpanel" aria-labelledby={`tab-${onglet}`} aria-busy={chargement}>{chargement ? <Chargement texte={`Chargement des ${estPersonnes ? "personnes" : "associations"}…`} /> : erreur ? <ErreurChargement message={erreur} reessayer={actualiser} /> : <><div className={styles.resultBar} aria-live="polite"><strong>{data?.total ?? 0} {estPersonnes ? "personne" : "association"}{(data?.total ?? 0) > 1 ? "s" : ""}</strong>{data && data.totalPages > 0 && <span>Page {data.page} sur {data.totalPages}</span>}</div>{!data?.total ? <div className={styles.empty}>Aucun résultat ne correspond à ces critères.</div> : <div className={styles.grid}>{estPersonnes ? personnes?.membres.map((m) => <CartePersonne key={m.id} membre={m} />) : associations?.associations.map((a) => <CarteAssociation key={a.id} association={a} actualiser={actualiser} />)}</div>}<PaginationAnnuaire page={page} totalPages={data?.totalPages || 0} changer={setPage} /></>}</section>{!estPersonnes && <ProposerAssociation />}</div>;
}

export default function AnnuairePage() { return <Suspense fallback={<Chargement texte="Chargement de l’annuaire…" />}><AnnuaireContenu /></Suspense>; }

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { cleMoisEvenement, formaterDateEvenement, formaterHeureEvenement, fuseauEvenement } from "@/lib/evenements";
import { useSocket } from "@/hooks/useSocket";
import type { Evenement, EvenementsResponse } from "@/types/evenements";
import { Chargement, ErreurChargement } from "@/components/community/CommunityUi";
import { BadgeFormat, DateEvenement, FORMATS, PaginationEvenements, ParticipationEvenement, StatutEvenement, urlFicheEvenement } from "./EvenementUi";
import styles from "./Events.module.css";

type Onglet = "a_venir" | "passes" | "mes";
function Lieu({ evenement }: { evenement: Evenement }) { return <>{evenement.type === "EN_LIGNE" ? "En ligne" : [evenement.ville, evenement.pays].filter(Boolean).join(", ") || evenement.lieu || "Lieu à préciser"}</>; }
function Horaire({ evenement }: { evenement: Evenement }) { return <>{formaterHeureEvenement(evenement.dateDebut, evenement.fuseauHoraire)}{evenement.dateFin ? ` – ${formaterHeureEvenement(evenement.dateFin, evenement.fuseauHoraire)}` : ""}</>; }
export function LigneEvenement({ evenement, actualiser }: { evenement: Evenement; actualiser: () => void }) {
  return <article className={styles.eventRow}><DateEvenement evenement={evenement} /><div><div className={styles.rowHeading}><h3 className={styles.rowTitle}><Link href={urlFicheEvenement(evenement.id)}>{evenement.titre}</Link></h3><BadgeFormat type={evenement.type} /><StatutEvenement evenement={evenement} /></div><p className={styles.rowMeta}>{formaterDateEvenement(evenement.dateDebut, evenement.fuseauHoraire, { weekday: "long" })} · <Horaire evenement={evenement} /> · <Lieu evenement={evenement} /></p><p className={styles.note}>Heure du lieu · {fuseauEvenement(evenement.fuseauHoraire)}</p><p className={styles.rowMeta}>{evenement.nbParticipants} {evenement.estPasse ? "ont participé" : `participant${evenement.nbParticipants > 1 ? "s" : ""}`}{evenement.organisateur ? ` · organisé par ${evenement.organisateur.nomComplet}` : ""}</p></div><div className={styles.rowActions}><ParticipationEvenement evenement={evenement} actualiser={actualiser} />{!evenement.estPasse && <Link className={styles.link} href={urlFicheEvenement(evenement.id)}>Voir l’événement</Link>}{evenement.peutModifier && <Link className={styles.link} href={`/evenements/proposer?modifier=${encodeURIComponent(evenement.id)}`}>Modifier</Link>}</div></article>;
}
export default function ListeEvenements() {
  const params = useSearchParams();
  const ongletUrl: Onglet = params.get("statut") === "mes" ? "mes" : params.get("periode") === "passes" ? "passes" : "a_venir";
  const [onglet, setOnglet] = useState<Onglet>(ongletUrl);
  const [filtres, setFiltres] = useState({ pays: "", ville: "", type: "", participation: false });
  const [recherche, setRecherche] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EvenementsResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [revision, setRevision] = useState(0);
  const socket = useSocket();
  const actualiser = () => setRevision((r) => r + 1);
  useEffect(() => { setOnglet(ongletUrl); setPage(1); }, [ongletUrl]);
  useEffect(() => { const timer = window.setTimeout(() => { setQ(recherche.trim()); setPage(1); }, 350); return () => window.clearTimeout(timer); }, [recherche]);
  useEffect(() => {
    const abort = new AbortController(); setChargement(true); setErreur("");
    void api.get<EvenementsResponse>("/evenements", { signal: abort.signal, params: { q: q || undefined, pays: filtres.pays || undefined, ville: filtres.ville || undefined, type: filtres.type || undefined, participation: filtres.participation && onglet !== "mes" ? "mes-evenements" : undefined, statut: onglet === "mes" ? "mes" : "publies", periode: onglet === "mes" ? "tous" : onglet, page, limite: 12 } }).then(({ data: resultat }) => {
      if (abort.signal.aborted) return;
      if (page > 1 && !resultat.evenements.length && resultat.meta.totalPages < page) setPage(Math.max(1, resultat.meta.totalPages));
      else setData(resultat);
    }).catch((e) => { if (!abort.signal.aborted) setErreur(messageErreur(e, "Impossible de charger les événements.")); }).finally(() => { if (!abort.signal.aborted) setChargement(false); });
    return () => abort.abort();
  }, [onglet, filtres, q, page, revision]);
  useEffect(() => { if (!socket) return; const recharger = () => setRevision((r) => r + 1); socket.on("evenement_modifie", recharger); return () => { socket.off("evenement_modifie", recharger); }; }, [socket]);
  function filtrer<K extends keyof typeof filtres>(cle: K, value: (typeof filtres)[K]) { setFiltres((f) => ({ ...f, [cle]: value, ...(cle === "pays" ? { ville: "" } : {}) })); setPage(1); }
  const evenements = data?.evenements || [];
  const hero = onglet === "a_venir" && page === 1 ? evenements[0] : undefined;
  const liste = hero ? evenements.slice(1) : evenements;
  const groupes = new Map<string, Evenement[]>();
  for (const evenement of liste) { const cle = cleMoisEvenement(evenement.dateDebut, evenement.fuseauHoraire); groupes.set(cle, [...(groupes.get(cle) || []), evenement]); }
  return <div className={styles.page}><header className={styles.header}><div><h1 className={styles.title}>Événements</h1><p className={styles.subtitle}>Les rencontres du réseau, en présentiel et en ligne.</p></div><div className={styles.buttons}>{data?.peutModerer && <Link className={styles.button} href="/admin/evenements">Espace admin{data.compteurs.aValider > 0 && <span className={styles.counter}>{data.compteurs.aValider}</span>}</Link>}<Link href="/evenements/proposer" className={`${styles.button} ${styles.primary}`}><Plus size={16} aria-hidden />Proposer un événement</Link></div></header><div className={styles.toolbar}><div className={styles.tabs} aria-label="Catégories d’événements">{([['a_venir', 'À venir', data?.compteurs.aVenir], ['passes', 'Passés', data?.compteurs.passes], ['mes', 'Mes propositions', data?.compteurs.mesPropositions]] as const).map(([value, label, count]) => <button type="button" key={value} className={styles.tab} aria-pressed={onglet === value} onClick={() => { setOnglet(value); setPage(1); }}>{label}{count !== undefined ? ` · ${count}` : ""}</button>)}</div><div className={styles.filters}><select aria-label="Pays" className={styles.input} value={filtres.pays} onChange={(e) => filtrer("pays", e.target.value)}><option value="">Tous les pays</option>{data?.facettes.pays.map((p) => <option key={p} value={p}>{p}</option>)}</select><select aria-label="Ville" className={styles.input} value={filtres.ville} onChange={(e) => filtrer("ville", e.target.value)}><option value="">Toutes les villes</option>{data?.facettes.villes.map((v) => <option key={v} value={v}>{v}</option>)}</select><select aria-label="Format" className={styles.input} value={filtres.type} onChange={(e) => filtrer("type", e.target.value)}><option value="">Tous les formats</option>{Object.entries(FORMATS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div></div><form className={styles.search} onSubmit={(e) => { e.preventDefault(); setQ(recherche.trim()); setPage(1); actualiser(); }}><label><span className="sr-only">Rechercher un événement</span><input type="search" className={styles.input} maxLength={100} value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un événement…" /></label><button className={styles.button} type="submit" aria-label="Rechercher"><Search size={18} aria-hidden /></button></form>{onglet !== "mes" && <label className={styles.note} style={{ display: "flex", gap: 8, marginBottom: 22 }}><input type="checkbox" checked={filtres.participation} onChange={(e) => filtrer("participation", e.target.checked)} />Mes participations uniquement</label>}{chargement ? <Chargement texte="Chargement des événements…" /> : erreur ? <ErreurChargement message={erreur} reessayer={actualiser} /> : !evenements.length ? <div className={styles.empty}>{onglet === "mes" ? "Vous n’avez pas encore proposé d’événement correspondant à ces critères." : "Aucun événement ne correspond à ces critères."}</div> : <>{hero && <article className={styles.hero}><DateEvenement evenement={hero} grand /><div><p className={styles.eyebrow}>{new Date(hero.dateDebut).getTime() <= Date.now() ? "Événement en cours" : "Prochain événement"}</p><h2 className={styles.heroTitle}><Link href={urlFicheEvenement(hero.id)}>{hero.titre}</Link></h2><p className={styles.heroDescription}>{hero.description.length > 190 ? hero.description.slice(0, 187) + "…" : hero.description}</p><div className={styles.heroMeta}><span><Horaire evenement={hero} /></span><span><Lieu evenement={hero} /></span><span>{hero.nbParticipants} participant{hero.nbParticipants > 1 ? "s" : ""}</span></div><p className={styles.heroMeta} style={{ marginTop: 7 }}>Heure du lieu · {fuseauEvenement(hero.fuseauHoraire)}</p></div><div className={styles.rowActions}><ParticipationEvenement evenement={hero} actualiser={actualiser} /><Link href={urlFicheEvenement(hero.id)} className={styles.link}>Voir l’événement</Link></div></article>}{[...groupes].map(([cle, items]) => <section key={cle} className={styles.monthSection}><h2 className={styles.monthTitle}>{formaterDateEvenement(items[0].dateDebut, items[0].fuseauHoraire, { month: "long", year: "numeric" })}</h2><div className={styles.eventRows}>{items.map((evenement) => <LigneEvenement key={evenement.id} evenement={evenement} actualiser={actualiser} />)}</div></section>)}<PaginationEvenements page={page} totalPages={data?.meta.totalPages || 0} changer={setPage} /></>}</div>;
}

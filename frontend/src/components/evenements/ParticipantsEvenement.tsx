"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { messageErreur, type PaginationApi } from "@/lib/community";
import type { ProfilEvenement } from "@/types/evenements";
import { AvatarParticipant, PaginationEvenements, urlFicheEvenement } from "./EvenementUi";
import styles from "./Events.module.css";

export default function ParticipantsEvenement({ evenementId, participantsInitiaux, totalInitial }: { evenementId: string; participantsInitiaux: ProfilEvenement[]; totalInitial: number }) {
  const [page, setPage] = useState(1);
  const [participants, setParticipants] = useState(participantsInitiaux);
  const [total, setTotal] = useState(totalInitial);
  const [totalPages, setTotalPages] = useState(Math.ceil(totalInitial / 12));
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (page === 1 && revision === 0) { setParticipants(participantsInitiaux); setTotal(totalInitial); setTotalPages(Math.ceil(totalInitial / 12)); setErreur(""); setChargement(false); return; }
    const abort = new AbortController(); setChargement(true); setErreur("");
    void api.get<{ participants: ProfilEvenement[]; meta: PaginationApi }>(`${urlFicheEvenement(evenementId)}/participants`, { signal: abort.signal, params: { page, limite: 12 } }).then(({ data }) => { if (abort.signal.aborted) return; if (page > 1 && !data.participants.length && data.meta.totalPages < page) setPage(Math.max(1, data.meta.totalPages)); else { setParticipants(data.participants); setTotal(data.meta.total); setTotalPages(data.meta.totalPages); } }).catch((e) => { if (!abort.signal.aborted) setErreur(messageErreur(e, "Impossible de charger les participants.")); }).finally(() => { if (!abort.signal.aborted) setChargement(false); });
    return () => abort.abort();
  }, [evenementId, page, participantsInitiaux, totalInitial, revision]);
  return <section className={styles.panel}><h2 className={styles.sectionTitle}>Participants <span className={styles.note}>· {total}</span></h2>{chargement ? <p role="status" className={styles.note}>Chargement des participants…</p> : erreur ? <div className={`${styles.message} ${styles.error}`} role="alert">{erreur}<button type="button" className={`${styles.button} ${styles.small}`} style={{ marginLeft: 10 }} onClick={() => setRevision((r) => r + 1)}>Réessayer</button></div> : participants.length ? <div className={styles.participants}>{participants.map((profil) => <Link key={profil.id} className={`${styles.person} ${styles.participant}`} href={`/membres/${encodeURIComponent(profil.id)}`}><AvatarParticipant profil={profil} /><div><span className={styles.personName}>{profil.nomComplet}</span>{profil.ville && <p>{profil.ville}</p>}</div></Link>)}</div> : <p className={styles.note}>Aucun participant à afficher pour le moment.</p>}<PaginationEvenements page={page} totalPages={totalPages} changer={setPage} chargement={chargement} libelle="Pagination des participants" /></section>;
}

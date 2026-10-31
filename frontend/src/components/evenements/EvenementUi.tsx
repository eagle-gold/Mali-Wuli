"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import api from "@/lib/api";
import { initiales, messageErreur } from "@/lib/community";
import { urlMediaBackend } from "@/lib/media";
import { formaterDateEvenement } from "@/lib/evenements";
import type { Evenement, FormatEvenement, ProfilEvenement } from "@/types/evenements";
import styles from "./Events.module.css";
import ImageAvecRepli from "@/components/ui/ImageAvecRepli";

export const FORMATS: Record<FormatEvenement, string> = { PRESENTIEL: "Présentiel", EN_LIGNE: "En ligne", HYBRIDE: "Hybride" };
export function urlFicheEvenement(id: string) { return `/evenements/${encodeURIComponent(id)}`; }
export function DateEvenement({ evenement, grand = false }: { evenement: Evenement; grand?: boolean }) {
  return <div className={`${styles.dateTile} ${grand ? styles.largeTile : ""} ${evenement.estPasse ? styles.pastTile : ""}`} aria-label={formaterDateEvenement(evenement.dateDebut, evenement.fuseauHoraire)}>
    <span className={styles.dateMonth}>{formaterDateEvenement(evenement.dateDebut, evenement.fuseauHoraire, { month: "short" }).replace(".", "")}</span>
    <span className={styles.dateDay}>{formaterDateEvenement(evenement.dateDebut, evenement.fuseauHoraire, { day: "numeric" })}</span>
    {grand && <span className={styles.dateWeekday}>{formaterDateEvenement(evenement.dateDebut, evenement.fuseauHoraire, { weekday: "long" })}</span>}
  </div>;
}
export function BadgeFormat({ type }: { type: FormatEvenement }) { return <span className={`${styles.badge} ${type === "EN_LIGNE" ? styles.online : ""}`}>{FORMATS[type]}</span>; }
export function StatutEvenement({ evenement }: { evenement: Evenement }) {
  if (evenement.statut === "VALIDE") return null;
  return <span className={`${styles.badge} ${evenement.statut === "REFUSE" ? styles.refused : styles.pending}`}>{evenement.statut === "REFUSE" ? "Proposition refusée" : "En attente de validation"}</span>;
}
export function AvatarParticipant({ profil }: { profil: ProfilEvenement }) {
  const url = urlMediaBackend(profil.photo);
  return <span className={styles.avatar}><ImageAvecRepli src={url} repli={initiales(profil.prenom, profil.nom)} /></span>;
}
export function PaginationEvenements({ page, totalPages, changer, chargement = false, libelle = "Pagination des événements" }: { page: number; totalPages: number; changer: (page: number) => void; chargement?: boolean; libelle?: string }) {
  if (totalPages <= 1) return null;
  return <nav className={styles.pagination} aria-label={libelle}><button type="button" className={styles.button} disabled={chargement || page <= 1} onClick={() => changer(page - 1)}>Précédent</button><span>Page {page} sur {totalPages}</span><button type="button" className={styles.button} disabled={chargement || page >= totalPages} onClick={() => changer(page + 1)}>Suivant</button></nav>;
}
export function ParticipationEvenement({ evenement, actualiser, lienPasse = true }: { evenement: Evenement; actualiser: () => void; lienPasse?: boolean }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [retour, setRetour] = useState("");
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setMaintenant(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const commence = new Date(evenement.dateDebut).getTime() <= maintenant;
  const passe = evenement.estPasse || new Date(evenement.dateFin || evenement.dateDebut).getTime() <= maintenant;
  const complet = Boolean(evenement.capacite && evenement.nbParticipants >= evenement.capacite && !evenement.estInscrit);
  async function participer() {
    if (enCours || new Date(evenement.dateDebut).getTime() <= Date.now() || evenement.statut !== "VALIDE") return;
    setEnCours(true); setErreur(""); setRetour("");
    try {
      const endpoint = `${urlFicheEvenement(evenement.id)}/participer`;
      if (evenement.estInscrit) await api.delete(endpoint); else await api.post(endpoint);
      setRetour(evenement.estInscrit ? "Votre participation a été annulée." : "Votre participation est confirmée.");
      actualiser();
    } catch (e) { setErreur(messageErreur(e, "Votre participation n’a pas pu être mise à jour.")); }
    finally { setEnCours(false); }
  }
  if (passe) return lienPasse ? <Link href={urlFicheEvenement(evenement.id)} className={styles.button}>Voir le résumé</Link> : <p className={styles.note}>{evenement.estInscrit ? "Vous avez participé à cet événement." : "Cet événement est terminé."}</p>;
  if (evenement.statut !== "VALIDE") return <StatutEvenement evenement={evenement} />;
  if (evenement.estProprietaire) return <p className={styles.note}>Vous organisez cet événement.</p>;
  if (commence) return <p className={styles.note}>{evenement.estInscrit ? "Vous êtes inscrit · Événement en cours" : "Événement en cours · Inscriptions closes"}</p>;
  return <div><button type="button" className={`${styles.button} ${styles.full} ${evenement.estInscrit ? "" : styles.primary}`} disabled={enCours || complet} onClick={() => void participer()}>
    {enCours ? <LoaderCircle size={15} className={styles.spinner} aria-hidden /> : evenement.estInscrit ? <Check size={15} aria-hidden /> : null}{enCours ? "Mise à jour…" : complet ? "Complet" : evenement.estInscrit ? "Annuler ma participation" : "Je participe"}
  </button>{erreur && <p className={`${styles.message} ${styles.error}`} role="alert">{erreur}</p>}{retour && <p className={styles.note} role="status">{retour}</p>}</div>;
}

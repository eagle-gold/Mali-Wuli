"use client";

import { useRef, useState } from "react";
import { Bookmark, Check, LoaderCircle } from "lucide-react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { libelleModeTravail, libelleTypeOffre } from "@/lib/offres";
import type { OffreApi } from "@/types/offres";
import styles from "./Offres.module.css";

export function urlOffre(id: string) { return `/offres/${encodeURIComponent(id)}`; }
export function initialesEntreprise(nom: string) { return nom.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toLocaleUpperCase("fr-FR"); }
export function dateOffre(iso: string) { const date = new Date(iso); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date); }
export function datePublication(iso: string) {
  const date = new Date(iso).getTime(); if (!Number.isFinite(date)) return "";
  const jours = Math.floor(Date.now() / 86400000) - Math.floor(date / 86400000);
  return jours === 0 ? "aujourd’hui" : jours === 1 ? "hier" : jours > 1 && jours < 8 ? `il y a ${jours} jours` : `le ${dateOffre(iso)}`;
}
export function offreExpiree(offre: OffreApi, maintenant = Date.now()) { return offre.estExpiree || Boolean(offre.dateExpiration && new Date(offre.dateExpiration).getTime() <= maintenant); }
export function EtiquettesOffre({ offre }: { offre: OffreApi }) {
  return <div className={styles.tags}><span className={`${styles.tag} ${styles.neutral}`}>{libelleTypeOffre(offre.type)}</span><span className={`${styles.tag} ${styles.neutral}`}>{libelleModeTravail(offre.modeTravail)}</span>{offre.recommandationPossible && <span className={styles.tag}>Recommandation possible</span>}{offre.statutModeration !== "PUBLIEE" && <span className={`${styles.tag} ${offre.statutModeration === "REFUSEE" ? styles.refused : styles.pending}`}>{offre.statutModeration === "REFUSEE" ? "Offre refusée" : "En attente de validation"}</span>}{offreExpiree(offre) && <span className={`${styles.tag} ${styles.muted}`}>Expirée</span>}</div>;
}
export function EnregistrerOffre({ offre, actualiser, compact = false }: { offre: OffreApi; actualiser: (offreId: string, modification: Partial<OffreApi>) => void; compact?: boolean }) {
  const [enCours, setEnCours] = useState(false); const [erreur, setErreur] = useState(""); const actif = useRef(false);
  async function enregistrer() {
    if (actif.current) return; actif.current = true; setEnCours(true); setErreur("");
    try { const { data } = offre.estEnregistree ? await api.delete<{ estEnregistree: boolean }>(`${urlOffre(offre.id)}/enregistrement`) : await api.put<{ estEnregistree: boolean }>(`${urlOffre(offre.id)}/enregistrement`); actualiser(offre.id, { estEnregistree: data.estEnregistree }); }
    catch (e) { setErreur(messageErreur(e, "L’enregistrement de cette offre n’a pas pu être modifié.")); }
    finally { actif.current = false; setEnCours(false); }
  }
  const texte = offre.estEnregistree ? "Offre enregistrée" : "Enregistrer";
  return <><button type="button" className={compact ? styles.saveIcon : styles.button} aria-label={offre.estEnregistree ? `Retirer ${offre.titre} des offres enregistrées` : `Enregistrer ${offre.titre}`} aria-pressed={offre.estEnregistree} title={texte} disabled={enCours} onClick={() => void enregistrer()}>{enCours ? <LoaderCircle size={17} className={styles.spinner} aria-hidden /> : offre.estEnregistree ? <Check size={17} aria-hidden /> : <Bookmark size={17} aria-hidden />}{!compact && texte}</button>{erreur && <p className={`${styles.message} ${styles.error}`} role="alert" style={compact ? { margin: "0 14px 14px" } : undefined}>{erreur}</p>}</>;
}

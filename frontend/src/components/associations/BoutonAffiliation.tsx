"use client";

import { useState } from "react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import type { Association } from "@/types/associations";
import styles from "../directory/Directory.module.css";

export default function BoutonAffiliation({ association, actualiser, compact = false }: { association: Pick<Association, "id" | "monAffiliation">; actualiser: () => void; compact?: boolean }) {
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [retour, setRetour] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const statut = association.monAffiliation?.statut;
  const membre = statut === "VERIFIE";
  const attente = statut === "EN_ATTENTE";
  async function changer(retirer: boolean) {
    if (enCours) return;
    setEnCours(true); setRetour(null);
    try {
      const url = `/associations/${encodeURIComponent(association.id)}/affiliation`;
      if (retirer) await api.delete(url); else await api.post(url, {});
      setRetour({ texte: retirer ? "Votre affiliation a été retirée." : "Votre demande sera examinée par le responsable de l’association." });
      setConfirmation(false); actualiser();
    } catch (erreur) { setRetour({ texte: messageErreur(erreur, "L’affiliation n’a pas pu être mise à jour."), erreur: true }); }
    finally { setEnCours(false); }
  }
  return <div className={styles.actions}>{confirmation ? <><p className={styles.note}>{membre ? "Quitter cette association et retirer l’affiliation de votre profil ?" : "Annuler votre demande d’affiliation ?"}</p><div className={styles.actionRow}><button type="button" className={styles.button} disabled={enCours} onClick={() => void changer(true)}>Confirmer</button><button type="button" className={styles.button} disabled={enCours} onClick={() => setConfirmation(false)}>Conserver</button></div></> : <><button type="button" className={`${styles.button} ${styles.full} ${membre || attente ? "" : styles.primary}`} disabled={enCours} onClick={() => membre || attente ? setConfirmation(true) : void changer(false)}>{enCours ? "Enregistrement…" : membre ? "Membre · Quitter" : attente ? "En attente · Annuler" : "Rejoindre"}</button>{!compact && <p className={styles.note}>{membre ? "Votre affiliation est validée et apparaît sur votre profil." : attente ? "Le responsable doit valider votre affiliation avant qu’elle apparaisse sur votre profil." : statut === "REFUSE" ? "Votre demande précédente n’a pas été acceptée. Vous pouvez proposer une nouvelle affiliation." : "L’affiliation apparaîtra sur votre profil après validation par le responsable."}</p>}</>}{retour && <p role={retour.erreur ? "alert" : "status"} className={`${styles.note} ${retour.erreur ? styles.error : ""}`}>{retour.texte}</p>}</div>;
}

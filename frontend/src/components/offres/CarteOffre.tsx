"use client";

import type { OffreApi } from "@/types/offres";
import { datePublication, EnregistrerOffre, EtiquettesOffre, initialesEntreprise } from "./OffresUi";
import styles from "./Offres.module.css";

export default function CarteOffre({ offre, selectionnee, selectionner, actualiser }: { offre: OffreApi; selectionnee: boolean; selectionner: (id: string) => void; actualiser: (id: string, modification: Partial<OffreApi>) => void }) {
  return <article className={styles.card} data-selected={selectionnee}><button className={styles.cardButton} type="button" aria-pressed={selectionnee} aria-controls="detail-offre" onClick={() => selectionner(offre.id)}><div className={styles.cardHead}><span className={styles.companyMark} aria-hidden>{initialesEntreprise(offre.entreprise)}</span><div><h2 className={styles.cardTitle}>{offre.titre}</h2><p className={styles.company}>{offre.entreprise}{[offre.ville, offre.pays].filter(Boolean).length ? ` · ${[offre.ville, offre.pays].filter(Boolean).join(", ")}` : ""}</p><EtiquettesOffre offre={offre} /><p className={styles.cardBottom}>Publiée {datePublication(offre.createdAt)}{offre.aPostule && <span>Candidature envoyée</span>}</p></div></div></button><EnregistrerOffre offre={offre} actualiser={actualiser} compact /></article>;
}

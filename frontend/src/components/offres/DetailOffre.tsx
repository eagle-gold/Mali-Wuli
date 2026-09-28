"use client";

import Link from "next/link";
import SupprimerContenu from "@/components/community/SupprimerContenu";
import { Pencil } from "lucide-react";
import { urlMediaBackend } from "@/lib/media";
import { libelleModeTravail, libelleTypeOffre } from "@/lib/offres";
import type { OffreApi } from "@/types/offres";
import CandidatureOffre from "./CandidatureOffre";
import { dateOffre, datePublication, EnregistrerOffre, initialesEntreprise, offreExpiree, urlOffre } from "./OffresUi";
import styles from "./Offres.module.css";

export default function DetailOffre({ offre, actualiser, onSupprime }: { offre: OffreApi; actualiser: (id: string, modification: Partial<OffreApi>) => void; onSupprime: (id: string) => void }) {
  const photo = urlMediaBackend(offre.publieur?.photo);
  return <article className={styles.detail} aria-labelledby={`offre-titre-${offre.id}`}><header className={styles.detailHeader}><span className={`${styles.companyMark} ${styles.detailMark}`} aria-hidden>{initialesEntreprise(offre.entreprise)}</span><div><h2 id={`offre-titre-${offre.id}`} className={styles.detailTitle}>{offre.titre}</h2><p className={styles.company}>{offre.entreprise} · {[offre.ville, offre.pays].filter(Boolean).join(", ")}</p></div></header><div className={styles.detailBody}>
    <dl className={styles.facts}><div><dt>Contrat</dt><dd>{libelleTypeOffre(offre.type)}</dd></div><div><dt>Mode</dt><dd>{libelleModeTravail(offre.modeTravail)}</dd></div><div><dt>Secteur</dt><dd>{offre.secteur || "Non précisé"}</dd></div><div><dt>Salaire</dt><dd>{offre.salaire || "Non précisé"}</dd></div></dl>
    {offre.statutModeration !== "PUBLIEE" && <p className={`${styles.message} ${offre.statutModeration === "REFUSEE" ? styles.error : ""}`} role="status">{offre.statutModeration === "REFUSEE" ? "Cette offre a été refusée. Vous pouvez la modifier pour la soumettre de nouveau." : "Cette offre est en attente de validation et n’est pas encore publiée."}</p>}{offreExpiree(offre) && <p className={styles.note}>La période de candidature est terminée.</p>}
    <div className={styles.actions}><CandidatureOffre key={offre.id} offre={offre} actualiser={actualiser} /><EnregistrerOffre offre={offre} actualiser={actualiser} />{offre.peutModifier && <Link className={styles.button} href={`/offres/deposer?id=${encodeURIComponent(offre.id)}`}><Pencil size={15} aria-hidden />Modifier l’offre</Link>}</div>
    {offre.peutSupprimer && <SupprimerContenu autorise={offre.peutSupprimer === true} endpoint={urlOffre(offre.id)} libelle="Supprimer l’offre" titre={`Supprimer « ${offre.titre} » ?`} consequences="L’offre et ses enregistrements seront retirés. Les candidatures déjà transmises à un recruteur ne peuvent pas être annulées par cette action." onSupprime={() => onSupprime(offre.id)} />}
    {offre.recommandationPossible && offre.publieur && <div className={styles.recommendation}><Link href={`/membres/${encodeURIComponent(offre.publieur.id)}`} className={styles.author}><span className={styles.avatar}>{photo ? <img src={photo} alt="" /> : `${offre.publieur.prenom[0] || ""}${offre.publieur.nom[0] || ""}`}</span><span><strong>{offre.publieur.nomComplet}</strong> peut vous recommander.</span></Link></div>}
    <h3 className={styles.sectionTitle}>Le poste</h3><p className={styles.description}>{offre.description}</p>{offre.profilRecherche && <><h3 className={styles.sectionTitle}>Profil recherché</h3><p className={styles.description}>{offre.profilRecherche}</p></>}
    <footer className={styles.detailFooter}>Publiée {offre.publieur ? <>par <Link href={`/membres/${encodeURIComponent(offre.publieur.id)}`} className={styles.link}>{offre.publieur.nomComplet}</Link> · </> : ""}{datePublication(offre.createdAt)}{offre.dateExpiration && ` · candidatures jusqu’au ${dateOffre(offre.dateExpiration)}`}</footer>
  </div></article>;
}

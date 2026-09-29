"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import styles from "./SupprimerContenu.module.css";

/** `corbeille: true` : l’élément est restaurable 30 jours depuis /corbeille (publications et commentaires). */
export type ResultatSuppression = { nbCommentaires?: number; corbeille?: boolean; message?: string };

type Props = {
  autorise: boolean;
  endpoint: string;
  libelle: string;
  titre: string;
  consequences: string;
  onSupprime: (resultat?: ResultatSuppression) => void;
  disabled?: boolean;
  onEnCours?: (valeur: boolean) => void;
};

/** Le droit vient de l’API ; chaque suppression exige une confirmation distincte. */
export default function SupprimerContenu({ autorise, endpoint, libelle, titre, consequences, onSupprime, disabled = false, onEnCours }: Props) {
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [termine, setTermine] = useState(false);
  const verrou = useRef(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const titreId = useId();
  const restaurerFocus = useRef(false);
  useEffect(() => { if (!confirmation && restaurerFocus.current) { restaurerFocus.current = false; bouton.current?.focus(); } }, [confirmation]);
  function annuler() {
    if (verrou.current) return;
    restaurerFocus.current = true; setConfirmation(false); setErreur("");
  }
  async function supprimer() {
    if (!autorise || !confirmation || disabled || verrou.current) return;
    verrou.current = true; setEnCours(true); setErreur(""); onEnCours?.(true);
    let retire = false;
    let resultat: ResultatSuppression | undefined;
    try { const { data } = await api.delete<ResultatSuppression>(endpoint); resultat = data; retire = true; }
    catch (error) {
      // Le résultat voulu est déjà acquis lorsque la fiche a été retirée entre-temps.
      if ((error as { response?: { status?: number } })?.response?.status === 404) retire = true;
      else setErreur(messageErreur(error, "La suppression n’a pas pu être confirmée. Le contenu est conservé à l’écran ; vous pouvez réessayer."));
    } finally { verrou.current = retire; setEnCours(false); onEnCours?.(false); }
    if (retire) { setTermine(true); onSupprime(resultat); }
  }
  if (!autorise) return null;
  if (termine) return <p className={styles.status} role="status">Le contenu a été supprimé.</p>;
  return <div className={styles.root}>
    {!confirmation ? <button ref={bouton} type="button" className={styles.button} disabled={disabled} onClick={() => { setErreur(""); setConfirmation(true); }}><Trash2 size={15} aria-hidden="true" />{libelle}</button> : <section className={styles.confirmation} aria-labelledby={titreId} onKeyDown={(event) => { if (event.key === "Escape" && !enCours) { event.preventDefault(); annuler(); } }}>
      <h3 id={titreId}>{titre}</h3><p>{consequences}</p><p>Cette action est définitive.</p>
      <div className={styles.actions}><button type="button" autoFocus className={`${styles.button} ${styles.cancel}`} disabled={enCours} onClick={annuler}>Annuler</button><button type="button" className={styles.button} disabled={enCours || disabled} onClick={() => void supprimer()}>{enCours && <LoaderCircle size={15} aria-hidden="true" className={styles.spinner} />}{enCours ? "Suppression…" : "Confirmer la suppression"}</button></div>
      {erreur && <p className={styles.error} role="alert">{erreur}</p>}
    </section>}
  </div>;
}

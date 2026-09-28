"use client";

import Link from "next/link";
import { ExternalLink, FileText, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { lienExterneSur } from "@/lib/offres";
import type { CandidatureResponse, OffreApi } from "@/types/offres";
import { offreExpiree, urlOffre } from "./OffresUi";
import styles from "./Offres.module.css";

type Props = { offre: OffreApi; actualiser: (id: string, modification: Partial<OffreApi>) => void };
export default function CandidatureOffre({ offre, actualiser }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [consentement, setConsentement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [retour, setRetour] = useState("");
  const [resultat, setResultat] = useState<CandidatureResponse | null>(null);
  const [incertain, setIncertain] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);
  const [pdfEnCours, setPdfEnCours] = useState(false);
  const [erreurPdf, setErreurPdf] = useState("");
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const dialog = useRef<HTMLDialogElement>(null); const envoiActif = useRef(false); const pdfActif = useRef(false); const pdfUrl = useRef<string | null>(null); const monte = useRef(true); const revisionConsentement = useRef(offre.revision); const revisionAffichee = useRef(offre.revision);
  useEffect(() => { monte.current = true; return () => { monte.current = false; if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); }; }, []);
  useEffect(() => { const timer = window.setInterval(() => setMaintenant(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (ouvert && dialog.current && !dialog.current.open) dialog.current.showModal(); if (!ouvert && dialog.current?.open) dialog.current.close(); }, [ouvert]);
  useEffect(() => {
    if (revisionAffichee.current === offre.revision) return;
    revisionAffichee.current = offre.revision; setConsentement(false);
    if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); pdfUrl.current = null; setPdf(null);
    setErreur("L’offre a été modifiée. Vérifiez ses nouvelles informations et confirmez à nouveau le partage de votre profil.");
  }, [offre.revision]);
  async function rechargerApresConflit() {
    setConsentement(false); setIncertain(true);
    if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); pdfUrl.current = null; setPdf(null);
    try {
      const { data } = await api.get<{ offre: OffreApi }>(urlOffre(offre.id));
      if (!monte.current) return;
      actualiser(offre.id, data.offre); setIncertain(false);
      setErreur("L’offre a changé. Ses informations ont été actualisées : vérifiez-les et confirmez de nouveau votre candidature.");
    } catch (e) { if (monte.current) setErreur(messageErreur(e, "L’offre a changé et n’a pas pu être rechargée. Actualisez son état avant de candidater.")); }
  }
  const statut = resultat?.statutCandidature || offre.statutCandidature;
  const envoyee = resultat?.aPostule || offre.aPostule || statut === "ENVOYEE";
  const conversationId = resultat?.conversationId || offre.conversationId;
  const indisponible = offre.statutModeration !== "PUBLIEE" || offreExpiree(offre, maintenant);
  function fermer() { if (!envoiActif.current) setOuvert(false); }
  function appliquer(result: CandidatureResponse) {
    if (monte.current) { setResultat(result); setRetour(result.message); setIncertain(false); }
    actualiser(offre.id, { aPostule: result.aPostule, statutCandidature: result.statutCandidature, conversationId: result.conversationId });
  }
  async function verifierEtat() {
    if (envoiActif.current) return; envoiActif.current = true; setEnvoi(true); setErreur("");
    try { const { data } = await api.get<{ offre: OffreApi }>(urlOffre(offre.id)); if (monte.current) { setResultat({ modeCandidature: data.offre.modeCandidature, aPostule: data.offre.aPostule, statutCandidature: data.offre.statutCandidature, conversationId: data.offre.conversationId, message: data.offre.statutCandidature === "EN_COURS" ? "Votre candidature est encore en cours d’envoi." : data.offre.aPostule ? "Votre candidature a été envoyée." : data.offre.statutCandidature === "ECHEC" ? "L’envoi a échoué. Vous pouvez réessayer." : "Aucune candidature envoyée pour cette offre." }); setIncertain(false); setConsentement(false); } actualiser(offre.id, data.offre); }
    catch (e) { if (monte.current) setErreur(messageErreur(e, "Impossible de vérifier l’état de votre candidature. Réessayez cette vérification plus tard.")); }
    finally { envoiActif.current = false; if (monte.current) setEnvoi(false); }
  }
  async function candidater() {
    if (envoiActif.current || !consentement || revisionConsentement.current !== offre.revision || envoyee || statut === "EN_COURS" || incertain || indisponible || offre.estProprietaire || offreExpiree(offre)) return;
    envoiActif.current = true; setEnvoi(true); setErreur(""); setRetour("");
    try { const { data } = await api.post<CandidatureResponse>(`${urlOffre(offre.id)}/candidatures`, { revision: offre.revision, ...(message.trim() ? { message: message.trim() } : {}), ...(statut === "ECHEC" ? { reessayer: true } : {}) }); appliquer(data); }
    catch (e) {
      if (!monte.current) return;
      const reponse = (e as { response?: { status?: number; data?: Partial<CandidatureResponse> } }).response;
      if (reponse?.status === 409) { await rechargerApresConflit(); return; }
      if (reponse?.data?.statutCandidature) appliquer({ modeCandidature: offre.modeCandidature, aPostule: Boolean(reponse.data.aPostule), conversationId: reponse.data.conversationId || null, statutCandidature: reponse.data.statutCandidature, message: reponse.data.message || "L’envoi de votre candidature a échoué." });
      else if (!reponse || (reponse.status || 0) >= 500) setIncertain(true);
      setConsentement(false); setErreur(messageErreur(e, "L’envoi n’a pas pu être confirmé. Vérifiez son état avant de réessayer."));
    } finally { envoiActif.current = false; if (monte.current) setEnvoi(false); }
  }
  async function chargerPdf() {
    if (pdfActif.current) return; pdfActif.current = true; setPdfEnCours(true); setErreurPdf("");
    try {
      const { data } = await api.get<Blob>(`${urlOffre(offre.id)}/profil-candidature.pdf`, { responseType: "blob", params: { revision: offre.revision } });
      if (!(data instanceof Blob) || (data.type && !data.type.toLowerCase().includes("application/pdf"))) throw new Error("Format de document inattendu.");
      if (!monte.current) return;
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); pdfUrl.current = URL.createObjectURL(data); setPdf(pdfUrl.current);
    } catch (e) {
      if ((e as { response?: { status?: number } }).response?.status === 409) { await rechargerApresConflit(); return; }
      let texte = messageErreur(e, "Le profil PDF n’a pas pu être préparé."); const contenu = (e as { response?: { data?: unknown } }).response?.data;
      if (contenu instanceof Blob) { try { const json = JSON.parse(await contenu.text()); if (typeof json.message === "string") texte = json.message; } catch { /* Le message de repli reste utilisable si la réponse n’est pas JSON. */ } }
      if (monte.current) setErreurPdf(texte);
    } finally { pdfActif.current = false; if (monte.current) setPdfEnCours(false); }
  }
  if (offre.estProprietaire) return <p className={styles.note}>Vous avez publié cette offre.</p>;
  if (indisponible) return <button type="button" className={styles.button} disabled>{offreExpiree(offre, maintenant) ? "Candidatures closes" : "Offre non publiée"}</button>;
  if (offre.modeCandidature === "LIEN_EXTERNE") {
    const lien = lienExterneSur(offre.lienCandidature);
    return lien ? <a className={`${styles.button} ${styles.primary}`} href={lien} target="_blank" rel="noopener noreferrer">Postuler<ExternalLink size={15} aria-hidden /></a> : <p className={styles.note}>Le lien de candidature n’est pas disponible.</p>;
  }
  return <><button type="button" className={`${styles.button} ${envoyee ? "" : styles.primary}`} onClick={() => { setOuvert(true); setErreur(""); }}>
    {envoyee ? "Candidature envoyée" : statut === "EN_COURS" ? "Envoi en cours" : statut === "ECHEC" ? "Réessayer la candidature" : "Postuler"}
  </button><dialog ref={dialog} className={styles.dialog} aria-labelledby={`candidature-${offre.id}`} onCancel={(e) => { e.preventDefault(); fermer(); }} onClose={() => { if (!envoiActif.current) setOuvert(false); }}>
    <div className={styles.dialogHeader}><h2 id={`candidature-${offre.id}`} className={styles.dialogTitle}>{envoyee ? "Candidature envoyée" : "Votre candidature"}</h2><button className={styles.close} type="button" disabled={envoi} onClick={fermer} aria-label="Fermer la candidature"><X size={18} aria-hidden /></button></div>
    <p className={styles.description}><strong>{offre.titre}</strong><br />{offre.entreprise}</p>
    {envoyee ? <><p className={styles.message} role="status">{retour || "Votre candidature a été envoyée."}</p>{conversationId && <Link href={`/messages?conversation=${encodeURIComponent(conversationId)}`} className={`${styles.button} ${styles.primary}`}>Voir la conversation</Link>}<div className={styles.actions}><button className={styles.button} type="button" onClick={fermer}>Fermer</button></div></> : statut === "EN_COURS" || incertain ? <><p className={styles.message} role="status">{incertain ? "L’envoi n’a pas pu être confirmé. Vérifiez son état avant toute nouvelle tentative." : "Votre candidature est en cours d’envoi. Aucun nouvel envoi n’est nécessaire."}</p>{erreur && <p className={`${styles.message} ${styles.error}`} role="alert">{erreur}</p>}<button type="button" className={styles.button} disabled={envoi} onClick={() => void verifierEtat()}>{envoi ? "Vérification…" : "Actualiser l’état"}</button></> : <form onSubmit={(event) => { event.preventDefault(); void candidater(); }}>
      <div className={styles.recipient}><strong>Destinataire</strong><br />{offre.modeCandidature === "EMAIL" ? offre.emailContact || "Le membre qui a déposé l’offre" : offre.publieur?.nomComplet || "Le membre qui a publié cette offre"}<br /><span>{offre.modeCandidature === "EMAIL" ? "Un e-mail avec votre profil en PDF sera envoyé." : "Votre candidature et le lien vers votre profil seront transmis dans la messagerie Mali Wuli."}</span></div>
      <p className={styles.note}>Le destinataire pourra consulter votre profil professionnel, vos expériences et vos formations. {offre.modeCandidature === "EMAIL" && <>Votre e-mail de compte sera partagé pour vous répondre ; votre téléphone sera inclus dans le PDF uniquement si vous l’avez rendu visible. </>} <Link href="/profil" target="_blank" rel="noopener noreferrer" className={styles.link}>Voir mon profil</Link></p>
      {offre.modeCandidature === "EMAIL" && <div className={styles.pdfActions}><button className={`${styles.button} ${styles.small}`} disabled={pdfEnCours || envoi} type="button" onClick={() => void chargerPdf()}>{pdfEnCours ? <LoaderCircle size={15} className={styles.spinner} aria-hidden /> : <FileText size={15} aria-hidden />}{pdfEnCours ? "Préparation…" : pdf ? "Actualiser le profil PDF" : "Préparer mon profil PDF"}</button>{pdf && <a className={styles.link} href={pdf} target="_blank" rel="noopener noreferrer">Consulter le PDF partagé</a>}</div>}
      {erreurPdf && <p className={`${styles.message} ${styles.error}`} role="alert">{erreurPdf}</p>}
      <label className={styles.dialogField}>Message d’accompagnement <span className={styles.note}>(facultatif)</span><textarea rows={5} maxLength={2000} className={styles.input} value={message} disabled={envoi} onChange={(e) => setMessage(e.target.value)} placeholder="Présentez votre intérêt pour ce poste…" /></label>
      <label className={styles.consent}><input type="checkbox" required checked={consentement} disabled={envoi} onChange={(e) => { revisionConsentement.current = offre.revision; setConsentement(e.target.checked); }} /><span>J’accepte de transmettre mon profil et mon message à {offre.modeCandidature === "EMAIL" ? offre.emailContact || "la personne qui a déposé l’offre" : offre.publieur?.nomComplet || "la personne qui a publié l’offre"} pour cette candidature.</span></label>
      {statut === "ECHEC" && <p className={`${styles.message} ${styles.error}`}>Le précédent envoi a échoué. Ce bouton permet de réessayer.</p>}{erreur && <p className={`${styles.message} ${styles.error}`} role="alert">{erreur}</p>}
      <div className={styles.actions}><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={envoi || !consentement}>{envoi && <LoaderCircle size={16} className={styles.spinner} aria-hidden />}{envoi ? "Envoi en cours…" : statut === "ECHEC" ? "Réessayer l’envoi" : "Envoyer ma candidature"}</button><button type="button" className={styles.button} disabled={envoi} onClick={fermer}>Annuler</button></div>
    </form>}
  </dialog></>;
}

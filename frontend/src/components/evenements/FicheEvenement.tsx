"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Camera, ImageIcon, LoaderCircle, Pencil, Share2 } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import SupprimerContenu from "@/components/community/SupprimerContenu";
import { BoutonSignaler } from "@/components/community/SignalerContenu";
import { messageErreur } from "@/lib/community";
import { urlMediaBackend } from "@/lib/media";
import { creerCalendrierIcs, formaterDateEvenement, formaterHeureEvenement, fuseauEvenement } from "@/lib/evenements";
import { useSocket } from "@/hooks/useSocket";
import type { DetailEvenementResponse, Evenement } from "@/types/evenements";
import { Chargement, ErreurChargement } from "@/components/community/CommunityUi";
import AlbumEvenement from "./AlbumEvenement";
import ParticipantsEvenement from "./ParticipantsEvenement";
import { AvatarParticipant, BadgeFormat, DateEvenement, ParticipationEvenement, StatutEvenement, urlFicheEvenement } from "./EvenementUi";
import { erreurPhoto } from "./photos-upload";
import styles from "./Events.module.css";

function lienHttp(value?: string | null) { if (!value) return null; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } }
export default function FicheEvenement({ evenementId }: { evenementId: string }) {
  const [data, setData] = useState<DetailEvenementResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [revision, setRevision] = useState(0);
  const [supprime, setSupprime] = useState(false);
  const [retour, setRetour] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [couvertureEnCours, setCouvertureEnCours] = useState(false);
  const [contactEnCours, setContactEnCours] = useState(false);
  const [lienCopie, setLienCopie] = useState<string | null>(null);
  const inputCouverture = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const socket = useSocket();
  const actualiser = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => { setSupprime(false); setData(null); setRetour(null); setLienCopie(null); }, [evenementId]);
  useEffect(() => {
    const abort = new AbortController(); setChargement(true); setErreur("");
    void api.get<DetailEvenementResponse>(urlFicheEvenement(evenementId), { signal: abort.signal }).then(({ data: resultat }) => { if (!abort.signal.aborted) setData(resultat); }).catch((e) => { if (!abort.signal.aborted) { if ([401, 403, 404].includes(e?.response?.status)) setData(null); setErreur(messageErreur(e, "Cet événement n’est pas disponible.")); } }).finally(() => { if (!abort.signal.aborted) setChargement(false); });
    return () => abort.abort();
  }, [evenementId, revision]);
  useEffect(() => {
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout>;
    const recharger = () => { clearTimeout(timer); timer = setTimeout(actualiser, 250); };
    socket.on("evenement_modifie", recharger);
    return () => { clearTimeout(timer); socket.off("evenement_modifie", recharger); };
  }, [socket, actualiser]);
  async function couverture(event: ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0]; event.target.value = "";
    if (!fichier || couvertureEnCours) return;
    const erreur = erreurPhoto(fichier);
    if (erreur) { setRetour({ texte: erreur, erreur: true }); return; }
    setCouvertureEnCours(true); setRetour(null);
    const formulaire = new FormData(); formulaire.append("couverture", fichier);
    try { const { data: result } = await api.post<{ evenement: Evenement }>(`${urlFicheEvenement(evenementId)}/couverture`, formulaire, { headers: { "Content-Type": "multipart/form-data" } }); setData((d) => d ? { ...d, evenement: result.evenement } : d); setRetour({ texte: "La couverture de l’événement a été enregistrée." }); }
    catch (e) { setRetour({ texte: messageErreur(e, "La couverture n’a pas pu être enregistrée. Vous pouvez réessayer."), erreur: true }); }
    finally { setCouvertureEnCours(false); }
  }
  function urlPartage() { return new URL(urlFicheEvenement(evenementId), window.location.origin).href; }
  async function partager() {
    setRetour(null); const url = urlPartage();
    try { await navigator.clipboard.writeText(url); setLienCopie(null); setRetour({ texte: "Le lien de l’événement a été copié." }); }
    catch { setLienCopie(url); setRetour({ texte: "Copiez le lien ci-dessous pour partager l’événement." }); }
  }
  function calendrier() {
    if (!data) return;
    try {
      const texte = creerCalendrierIcs(data.evenement, urlPartage());
      const url = URL.createObjectURL(new Blob([texte], { type: "text/calendar;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `mali-wuli-evenement-${data.evenement.id}.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRetour({ texte: "Le fichier calendrier est prêt à être ajouté à votre agenda." });
    } catch (e) { setRetour({ texte: messageErreur(e, "Impossible de préparer le calendrier."), erreur: true }); }
  }
  async function contacter() {
    if (!data?.evenement.organisateur || data.evenement.estProprietaire || contactEnCours) return;
    setContactEnCours(true); setRetour(null);
    try { const { data: result } = await api.post<{ conversationId: string }>("/messages/conversations", { destinataireId: data.evenement.organisateur.id }); router.push(`/messages?conversation=${encodeURIComponent(result.conversationId)}`); }
    catch (e) { setRetour({ texte: messageErreur(e, "Impossible d’ouvrir la conversation."), erreur: true }); }
    finally { setContactEnCours(false); }
  }
  const evenement = data?.evenement;
  const photoCouverture = urlMediaBackend(evenement?.photoCouverture);
  const video = lienHttp(evenement?.lienVideo);
  if (supprime) return <div className={styles.page}><p role="status" className={styles.message}>L’événement a été supprimé.</p><Link href="/evenements" className={styles.back}><ArrowLeft size={16} aria-hidden />Tous les événements</Link></div>;
  return <div className={styles.page}><Link className={styles.back} href="/evenements"><ArrowLeft size={16} aria-hidden />Tous les événements</Link>{!data ? chargement ? <Chargement texte="Chargement de l’événement…" /> : <ErreurChargement message={erreur || "Cet événement n’est pas disponible."} reessayer={actualiser} /> : evenement && <>{erreur && <div className={`${styles.message} ${styles.error}`} role="alert">{erreur}<button type="button" className={`${styles.button} ${styles.small}`} style={{ marginLeft: 10 }} onClick={actualiser}>Actualiser</button></div>}<header><div className={styles.cover}>{photoCouverture ? <img src={photoCouverture} alt="" /> : <div className={styles.coverEmpty}><ImageIcon size={35} aria-hidden /><p>Photo de couverture de l’événement</p></div>}{evenement.peutModifier && <button type="button" disabled={couvertureEnCours} className={`${styles.button} ${styles.coverAction}`} onClick={() => inputCouverture.current?.click()}>{couvertureEnCours ? <LoaderCircle size={16} className={styles.spinner} aria-hidden /> : <Camera size={16} aria-hidden />}{couvertureEnCours ? "Enregistrement…" : photoCouverture ? "Modifier la couverture" : "Ajouter une couverture"}</button>}</div><div className={`${styles.hero} ${styles.detailHero}`}><DateEvenement evenement={evenement} grand /><div><div className={styles.buttons} style={{ marginBottom: 13 }}><BadgeFormat type={evenement.type} /><StatutEvenement evenement={evenement} />{evenement.estPasse && <span className={styles.badge}>Événement passé</span>}{!evenement.estPasse && new Date(evenement.dateDebut).getTime() <= Date.now() && <span className={styles.badge}>En cours</span>}</div><h1 className={styles.heroTitle}>{evenement.titre}</h1><p className={styles.heroMeta}>{formaterHeureEvenement(evenement.dateDebut, evenement.fuseauHoraire)} · {evenement.type === "EN_LIGNE" ? "En ligne" : [evenement.ville, evenement.pays].filter(Boolean).join(", ") || evenement.lieu}</p></div></div>{evenement.peutModifier && <input ref={inputCouverture} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Choisir la couverture de l’événement" disabled={couvertureEnCours} onChange={(e) => void couverture(e)} />}</header>{retour && <p className={`${styles.message} ${retour.erreur ? styles.error : ""}`} role={retour.erreur ? "alert" : "status"}>{retour.texte}</p>}{lienCopie && <label className={styles.note}>Lien à partager<input className={styles.input} readOnly value={lienCopie} onFocus={(e) => e.target.select()} /></label>}<div className={styles.detailGrid}><div className={styles.stack}>{evenement.estPasse && evenement.resume && <section className={styles.panel}><h2 className={styles.sectionTitle}>Retour sur la rencontre</h2><p className={styles.description}>{evenement.resume}</p></section>}<section className={styles.panel}><h2 className={styles.sectionTitle}>À propos</h2><p className={styles.description}>{evenement.description}</p></section>{Boolean(evenement.programme?.length) && <section className={styles.panel}><h2 className={styles.sectionTitle}>Programme</h2><ul className={styles.programme}>{evenement.programme?.map((etape, index) => <li key={`${index}-${etape.heure}`}><time>{etape.heure}</time><span>{etape.libelle}</span></li>)}</ul><p className={styles.note} style={{ marginTop: 12 }}>Horaires dans le fuseau {fuseauEvenement(evenement.fuseauHoraire)}.</p></section>}<AlbumEvenement key={`album-${evenementId}`} evenementId={evenementId} photosInitiales={data.photos} totalInitial={data.totalPhotos} peutAjouterPhotos={evenement.peutAjouterPhotos} actualiser={actualiser} /><ParticipantsEvenement key={`participants-${evenementId}`} evenementId={evenementId} participantsInitiaux={data.participants} totalInitial={data.totalParticipants} /></div><aside className={`${styles.stack} ${styles.detailSidebar}`}><section className={styles.panel}><dl className={styles.summaryList}><div><dt>Date et heure</dt><dd>{formaterDateEvenement(evenement.dateDebut, evenement.fuseauHoraire)}<br />{formaterHeureEvenement(evenement.dateDebut, evenement.fuseauHoraire)}{evenement.dateFin && <> – {formaterDateEvenement(evenement.dateFin, evenement.fuseauHoraire, { day: "numeric", month: "long" })} à {formaterHeureEvenement(evenement.dateFin, evenement.fuseauHoraire)}</>}<p className={styles.note}>Heure du lieu · {fuseauEvenement(evenement.fuseauHoraire)}</p></dd></div><div><dt>{evenement.type === "EN_LIGNE" ? "Connexion" : "Lieu"}</dt><dd>{evenement.type !== "EN_LIGNE" && [evenement.lieu, evenement.ville, evenement.pays].filter(Boolean).join(", ")}{video && <a href={video} target="_blank" rel="noopener noreferrer" className={styles.link} style={{ display: "block" }}>Accéder à l’événement en ligne</a>}{evenement.type === "EN_LIGNE" && !video && "Le lien sera précisé par l’organisateur."}</dd></div><div><dt>Places</dt><dd>{evenement.nbParticipants} inscrit{evenement.nbParticipants > 1 ? "s" : ""}{evenement.capacite ? ` sur ${evenement.capacite}` : ""}</dd></div></dl><ParticipationEvenement evenement={evenement} actualiser={actualiser} lienPasse={false} /><div className={styles.inlineButtons}><button type="button" className={`${styles.button} ${styles.small}`} onClick={calendrier}><CalendarPlus size={15} aria-hidden />Ajouter à l’agenda</button><button type="button" className={`${styles.button} ${styles.small}`} onClick={() => void partager()}><Share2 size={15} aria-hidden />Partager</button>{!evenement.estProprietaire && <BoutonSignaler cibleType="EVENEMENT" cibleId={evenement.id} libelleCible={`l’événement « ${evenement.titre} »`} />}</div>{evenement.peutModifier && <Link className={`${styles.button} ${styles.full}`} style={{ marginTop: 14 }} href={`/evenements/proposer?modifier=${encodeURIComponent(evenement.id)}`}><Pencil size={14} aria-hidden />Modifier l’événement</Link>}{evenement.peutSupprimer && <SupprimerContenu autorise={evenement.peutSupprimer === true} endpoint={urlFicheEvenement(evenement.id)} libelle="Supprimer l’événement" titre={`Supprimer « ${evenement.titre} » ?`} consequences="La fiche, les inscriptions et les photos de cet événement seront retirées." disabled={couvertureEnCours || contactEnCours} onSupprime={() => setSupprime(true)} />}{evenement.statut === "EN_ATTENTE" && <p className={styles.note} style={{ marginTop: 12 }}>Votre proposition sera visible dans l’annuaire des événements après validation.</p>}{evenement.statut === "REFUSE" && <p className={styles.note} style={{ marginTop: 12 }}>Cette proposition n’est pas publiée. Vous pouvez la modifier pour la soumettre de nouveau.</p>}</section>{evenement.organisateur && <section className={styles.panel}><h2 className="titre-section mb-3">Organisé par</h2><Link className={styles.person} href={`/membres/${encodeURIComponent(evenement.organisateur.id)}`}><AvatarParticipant profil={evenement.organisateur} /><span className={styles.personName}>{evenement.organisateur.nomComplet}</span></Link>{!evenement.estProprietaire && <button className={`${styles.button} ${styles.primary} ${styles.full}`} style={{ marginTop: 17 }} type="button" disabled={contactEnCours} onClick={() => void contacter()}>{contactEnCours ? "Ouverture…" : "Contacter"}</button>}</section>}</aside></div></>}</div>;
}

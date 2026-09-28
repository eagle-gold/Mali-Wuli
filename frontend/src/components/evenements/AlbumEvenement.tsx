"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, Trash2, X } from "lucide-react";
import api from "@/lib/api";
import { messageErreur, type PaginationApi } from "@/lib/community";
import { urlMediaBackend } from "@/lib/media";
import type { PhotoEvenement } from "@/types/evenements";
import { PaginationEvenements, urlFicheEvenement } from "./EvenementUi";
import { envoyerPhotosEnSerie, erreurPhoto } from "./photos-upload";
import styles from "./Events.module.css";

type StatutEnvoi = "PRETE" | "ENVOI" | "ENVOYEE" | "ERREUR" | "ANNULEE";
type PhotoEnAttente = { id: number; fichier: File; apercu: string | null; legende: string; statut: StatutEnvoi; erreur?: string; invalide: boolean };
type PhotosResponse = { photos: PhotoEvenement[]; meta: PaginationApi };

export default function AlbumEvenement({ evenementId, photosInitiales, totalInitial, peutAjouterPhotos, actualiser }: { evenementId: string; photosInitiales: PhotoEvenement[]; totalInitial: number; peutAjouterPhotos: boolean; actualiser: () => void }) {
  const [photos, setPhotos] = useState(photosInitiales);
  const [total, setTotal] = useState(totalInitial);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.ceil(totalInitial / 24));
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<PhotoEnAttente[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [arretDemande, setArretDemande] = useState(false);
  const [bilan, setBilan] = useState("");
  const [photoOuverte, setPhotoOuverte] = useState<PhotoEvenement | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const annuler = useRef(false);
  const actif = useRef(true);
  const envoiActif = useRef(false);
  const permission = useRef(peutAjouterPhotos);
  const urls = useRef(new Set<string>());
  const compteur = useRef(0);
  permission.current = peutAjouterPhotos;
  useEffect(() => { actif.current = true; return () => { actif.current = false; annuler.current = true; for (const url of urls.current) URL.revokeObjectURL(url); urls.current.clear(); }; }, []);
  useEffect(() => {
    const controleur = new AbortController(); setErreur("");
    if (page === 1 && revision === 0) { setPhotos(photosInitiales); setTotal(totalInitial); setTotalPages(Math.ceil(totalInitial / 24)); setChargement(false); return; }
    setChargement(true);
    void api.get<PhotosResponse>(`${urlFicheEvenement(evenementId)}/photos`, { signal: controleur.signal, params: { page, limite: 24 } }).then(({ data }) => {
      if (controleur.signal.aborted) return;
      if (page > 1 && !data.photos.length && data.meta.totalPages < page) setPage(Math.max(1, data.meta.totalPages));
      else { setPhotos(data.photos); setTotal(data.meta.total); setTotalPages(data.meta.totalPages); }
    }).catch((e) => { if (!controleur.signal.aborted) setErreur(messageErreur(e, "Impossible de charger l’album.")); }).finally(() => { if (!controleur.signal.aborted) setChargement(false); });
    return () => controleur.abort();
  }, [evenementId, page, photosInitiales, totalInitial, revision]);
  useEffect(() => {
    if (photoOuverte && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!photoOuverte && dialog.current?.open) dialog.current.close();
  }, [photoOuverte]);
  function fermer() { if (suppression) return; setPhotoOuverte(null); setConfirmation(false); setErreurSuppression(""); }
  function choisir(event: ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(event.target.files || []); event.target.value = "";
    if (envoiActif.current || !permission.current) return;
    const nouvelles = fichiers.map((fichier): PhotoEnAttente => {
      const erreur = erreurPhoto(fichier);
      const apercu = erreur ? null : URL.createObjectURL(fichier);
      if (apercu) urls.current.add(apercu);
      return { id: ++compteur.current, fichier, apercu, legende: "", statut: erreur ? "ERREUR" : "PRETE", erreur: erreur || undefined, invalide: Boolean(erreur) };
    });
    setSelection((ancienne) => [...ancienne, ...nouvelles]); setBilan("");
  }
  function retirer(id: number) {
    const ligne = selection.find((p) => p.id === id);
    if (ligne?.apercu) { URL.revokeObjectURL(ligne.apercu); urls.current.delete(ligne.apercu); }
    setSelection((items) => items.filter((p) => p.id !== id));
  }
  async function envoyer() {
    if (envoiActif.current || !permission.current) return;
    const aEnvoyer = selection.filter((p) => !p.invalide && ["PRETE", "ERREUR", "ANNULEE"].includes(p.statut));
    if (!aEnvoyer.length) return;
    envoiActif.current = true; annuler.current = false; setEnvoi(true); setArretDemande(false); setBilan("");
    const terminees = new Set<number>();
    const resultat = await envoyerPhotosEnSerie(aEnvoyer, async (photo) => {
      if (actif.current) setSelection((items) => items.map((p) => p.id === photo.id ? { ...p, statut: "ENVOI", erreur: undefined } : p));
      const formulaire = new FormData(); formulaire.append("photo", photo.fichier); if (photo.legende.trim()) formulaire.append("legende", photo.legende.trim());
      const { data } = await api.post<{ photo: PhotoEvenement }>(`${urlFicheEvenement(evenementId)}/photos`, formulaire, { headers: { "Content-Type": "multipart/form-data" } });
      return data.photo;
    }, { doitArreter: () => annuler.current || !actif.current || !permission.current, resultat: (photo, result) => {
      terminees.add(photo.id);
      if (!actif.current) return;
      setSelection((items) => items.map((p) => p.id === photo.id ? { ...p, statut: result.ok ? "ENVOYEE" : "ERREUR", erreur: result.ok ? undefined : messageErreur(result.erreur, "L’envoi n’a pas pu être confirmé. Vérifiez l’album avant de réessayer.") } : p));
      if (!result.ok) {
        const status = (result.erreur as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) annuler.current = true;
      }
    } });
    envoiActif.current = false;
    if (!actif.current) return;
    setSelection((items) => items.map((p) => aEnvoyer.some((a) => a.id === p.id) && !terminees.has(p.id) ? { ...p, statut: "ANNULEE" } : p));
    setEnvoi(false); setArretDemande(false);
    setBilan(`${resultat.envoyees} photo${resultat.envoyees > 1 ? "s" : ""} ajoutée${resultat.envoyees > 1 ? "s" : ""} · ${resultat.echouees} en échec · ${resultat.nonEnvoyees} non envoyée${resultat.nonEnvoyees > 1 ? "s" : ""}.`);
    setPage(1); setRevision((r) => r + 1); actualiser();
  }
  async function supprimer() {
    if (!photoOuverte?.peutSupprimer || suppression) return;
    setSuppression(true); setErreurSuppression("");
    try {
      await api.delete(`${urlFicheEvenement(evenementId)}/photos/${encodeURIComponent(photoOuverte.id)}`);
      setPhotoOuverte(null); setConfirmation(false); setRevision((r) => r + 1); actualiser(); setBilan("La photo a été supprimée.");
    } catch (e) { setErreurSuppression(messageErreur(e, "Cette photo n’a pas pu être supprimée.")); }
    finally { setSuppression(false); }
  }
  function parcourir(sens: number) {
    if (!photoOuverte || suppression) return;
    const index = photos.findIndex((p) => p.id === photoOuverte.id);
    const suivante = photos[index + sens];
    if (suivante) { setPhotoOuverte(suivante); setConfirmation(false); setErreurSuppression(""); }
  }
  const enAttente = selection.filter((p) => !p.invalide && ["PRETE", "ERREUR", "ANNULEE"].includes(p.statut)).length;
  const terminees = selection.filter((p) => ["ENVOYEE", "ERREUR", "ANNULEE"].includes(p.statut)).length;
  return <section className={styles.panel} aria-labelledby="album-evenement-titre"><div className={styles.sectionHeader}><h2 id="album-evenement-titre" className={styles.sectionTitle}>Photos de l’événement <span className={styles.note}>· {total}</span></h2>{peutAjouterPhotos && <button type="button" className={styles.button} disabled={envoi} onClick={() => input.current?.click()}><ImagePlus size={16} aria-hidden />Ajouter des photos</button>}</div><p className={styles.note}>{peutAjouterPhotos ? "Tous les participants inscrits peuvent contribuer à l’album. JPEG, PNG ou WebP, jusqu’à 10 Mo par photo." : "L’album est partagé par les participants inscrits et l’organisateur."}</p>{peutAjouterPhotos && <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Choisir les photos à ajouter" disabled={envoi} onChange={choisir} />}{selection.length > 0 && <div className={styles.uploadPanel}><p className={styles.note}>Vérifiez vos images avant l’envoi. Les photos ajoutées seront visibles dans l’album.</p><div className={styles.uploadQueue}>{selection.map((photo) => <div className={styles.uploadItem} key={photo.id}>{photo.apercu ? <img src={photo.apercu} alt="Aperçu de la photo sélectionnée" /> : <Camera size={24} aria-hidden />}<div><p className={styles.uploadName}>{photo.fichier.name}</p><label><span className="sr-only">Légende de {photo.fichier.name}</span><input className={styles.input} placeholder="Légende (facultative)" maxLength={300} disabled={envoi || photo.statut === "ENVOYEE" || photo.invalide} value={photo.legende} onChange={(e) => setSelection((items) => items.map((p) => p.id === photo.id ? { ...p, legende: e.target.value } : p))} /></label><p className={styles.uploadState}>{photo.statut === "ENVOYEE" ? "Ajoutée" : photo.statut === "ENVOI" ? "Envoi en cours…" : photo.statut === "ANNULEE" ? "Non envoyée · Vous pouvez reprendre" : photo.statut === "ERREUR" ? photo.erreur : "Prête à envoyer"}</p></div><button type="button" className={`${styles.button} ${styles.small}`} disabled={envoi} onClick={() => retirer(photo.id)} aria-label={`Retirer ${photo.fichier.name} de la sélection`}><X size={14} aria-hidden /></button></div>)}</div>{envoi && <><progress className={styles.uploadProgress} max={Math.max(1, selection.length)} value={terminees} /><p className={styles.note} role="status">{arretDemande ? "La photo en cours se termine. Les suivantes ne seront pas envoyées." : "Envoi des photos une à une…"}</p></>}<div className={styles.buttons}>{envoi ? <button className={styles.button} type="button" disabled={arretDemande} onClick={() => { annuler.current = true; setArretDemande(true); }}>Arrêter après la photo en cours</button> : <button className={`${styles.button} ${styles.primary}`} type="button" disabled={!peutAjouterPhotos || enAttente === 0} onClick={() => void envoyer()}>Envoyer {enAttente} photo{enAttente > 1 ? "s" : ""}</button>}</div>{selection.some((p) => p.statut === "ERREUR" && !p.invalide) && <p className={styles.note} style={{ marginTop: 10 }}>En cas de connexion interrompue, vérifiez d’abord l’album : une photo peut avoir été reçue malgré l’erreur.</p>}</div>}{bilan && <p role="status" className={styles.message}>{bilan}</p>}{erreur ? <div className={`${styles.message} ${styles.error}`} role="alert">{erreur}<button type="button" className={`${styles.button} ${styles.small}`} style={{ marginLeft: 8 }} onClick={() => setRevision((r) => r + 1)}>Réessayer</button></div> : chargement ? <p className={styles.note} role="status">Chargement des photos…</p> : photos.length ? <div className={styles.photos} style={{ marginTop: 18 }}>{photos.map((photo, index) => <button className={styles.photoButton} type="button" key={photo.id} onClick={() => { setPhotoOuverte(photo); setConfirmation(false); setErreurSuppression(""); }} aria-label={`Agrandir ${photo.legende || `la photo ${index + 1}`}`}><img src={urlMediaBackend(photo.url) || undefined} alt={photo.legende || "Photo de l’événement"} loading="lazy" /></button>)}</div> : <div className={styles.empty} style={{ marginTop: 18 }}>Aucune photo pour le moment.{peutAjouterPhotos ? " Partagez les premiers souvenirs de cette rencontre." : ""}</div>}<PaginationEvenements page={page} totalPages={totalPages} changer={setPage} chargement={chargement} libelle="Pagination de l’album" /><dialog ref={dialog} className={styles.lightbox} aria-label="Photo de l’événement" onCancel={(event) => { event.preventDefault(); fermer(); }} onClose={() => { if (!suppression) setPhotoOuverte(null); }} onClick={(e) => { if (e.target === e.currentTarget) fermer(); }} onKeyDown={(e) => { if (e.key === "ArrowLeft") parcourir(-1); if (e.key === "ArrowRight") parcourir(1); }}>{photoOuverte && <><div className={styles.lightboxHeader}><p className={styles.note}>{photoOuverte.auteur ? `Ajoutée par ${photoOuverte.auteur.nomComplet}` : "Photo de l’événement"}</p><button type="button" className={`${styles.button} ${styles.small}`} onClick={fermer} disabled={suppression} aria-label="Fermer la photo"><X size={17} aria-hidden /></button></div><img className={styles.lightboxImage} src={urlMediaBackend(photoOuverte.url) || undefined} alt={photoOuverte.legende || "Photo de l’événement"} />{photoOuverte.legende && <p className={styles.description} style={{ marginTop: 10 }}>{photoOuverte.legende}</p>}<div className={styles.lightboxFooter}><div className={styles.buttons}><button className={`${styles.button} ${styles.small}`} type="button" disabled={suppression || photos.findIndex((p) => p.id === photoOuverte.id) <= 0} onClick={() => parcourir(-1)} aria-label="Photo précédente"><ChevronLeft size={17} aria-hidden /></button><button className={`${styles.button} ${styles.small}`} type="button" disabled={suppression || photos.findIndex((p) => p.id === photoOuverte.id) >= photos.length - 1} onClick={() => parcourir(1)} aria-label="Photo suivante"><ChevronRight size={17} aria-hidden /></button></div>{photoOuverte.peutSupprimer && !confirmation && <button type="button" className={`${styles.button} ${styles.small} ${styles.danger}`} onClick={() => setConfirmation(true)}><Trash2 size={14} aria-hidden />Supprimer cette photo</button>}</div>{confirmation && <div className={styles.message}><p>Supprimer définitivement cette photo de l’album ?</p><div className={styles.buttons} style={{ marginTop: 9 }}><button type="button" className={`${styles.button} ${styles.danger}`} disabled={suppression} onClick={() => void supprimer()}>{suppression ? <LoaderCircle size={15} className={styles.spinner} aria-hidden /> : null}Confirmer la suppression</button><button type="button" className={styles.button} disabled={suppression} onClick={() => setConfirmation(false)}>Conserver la photo</button></div></div>}{erreurSuppression && <p role="alert" className={`${styles.message} ${styles.error}`}>{erreurSuppression}</p>}</>}</dialog></section>;
}

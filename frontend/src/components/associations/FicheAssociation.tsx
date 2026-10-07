"use client";

import { titreMembre } from "@/lib/titre-membre";
import Link from "next/link";
import { ArrowLeft, Camera, Check, Mail, MapPin, UsersRound, X } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import SupprimerContenu from "@/components/community/SupprimerContenu";
import { BoutonSignaler } from "@/components/community/SignalerContenu";
import { messageErreur, nomComplet } from "@/lib/community";
import { urlMediaBackend } from "@/lib/media";
import { Chargement, ErreurChargement } from "@/components/community/CommunityUi";
import { ActionsMembre, AvatarAnnuaire, datePublique, lienWebPublic, PaginationAnnuaire } from "../directory/DirectoryUi";
import type { Association, AssociationDetailResponse, AffiliationsResponse, MembresAssociationResponseApi } from "@/types/associations";
import BoutonAffiliation from "./BoutonAffiliation";
import styles from "../directory/Directory.module.css";

export default function FicheAssociation({ associationId }: { associationId: string }) {
  const [data, setData] = useState<AssociationDetailResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [retour, setRetour] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [membres, setMembres] = useState<MembresAssociationResponseApi | null>(null);
  const [chargementMembres, setChargementMembres] = useState(false);
  const [erreurMembres, setErreurMembres] = useState("");
  const [attentes, setAttentes] = useState<AffiliationsResponse | null>(null);
  const [pageAttentes, setPageAttentes] = useState(1);
  const [erreurAttentes, setErreurAttentes] = useState("");
  const [chargementAttentes, setChargementAttentes] = useState(false);
  const [actionId, setActionId] = useState("");
  const [mediaEnCours, setMediaEnCours] = useState(false);
  const [revision, setRevision] = useState(0);
  const [supprimee, setSupprimee] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const endpoint = `/associations/${encodeURIComponent(associationId)}`;
  const actualiser = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => { setSupprimee(false); setData(null); setMembres(null); setAttentes(null); setPage(1); setPageAttentes(1); setRetour(null); }, [associationId]);
  useEffect(() => {
    const abort = new AbortController(); setChargement(true); setErreur("");
    void api.get<AssociationDetailResponse>(endpoint, { signal: abort.signal }).then(({ data: resultat }) => { if (!abort.signal.aborted) setData(resultat); }).catch((e) => { if (!abort.signal.aborted) setErreur(messageErreur(e, "Cette association n’est pas disponible.")); }).finally(() => { if (!abort.signal.aborted) setChargement(false); });
    return () => abort.abort();
  }, [endpoint, revision]);
  useEffect(() => {
    if (!data) return;
    if (page === 1) { setMembres({ membres: data.membres, total: data.totalMembres, page: 1, totalPages: data.totalPagesMembres }); setErreurMembres(""); setChargementMembres(false); return; }
    const abort = new AbortController(); setChargementMembres(true); setErreurMembres("");
    void api.get<MembresAssociationResponseApi>(`${endpoint}/membres`, { params: { page, limite: 20 }, signal: abort.signal }).then(({ data: resultat }) => { if (!abort.signal.aborted) setMembres(resultat); }).catch((e) => { if (!abort.signal.aborted) setErreurMembres(messageErreur(e, "Impossible de charger les membres.")); }).finally(() => { if (!abort.signal.aborted) setChargementMembres(false); });
    return () => abort.abort();
  }, [data, endpoint, page]);
  useEffect(() => {
    if (!data?.association.peutGerer) return;
    const abort = new AbortController(); setChargementAttentes(true); setErreurAttentes("");
    void api.get<AffiliationsResponse>(`${endpoint}/affiliations`, { params: { page: pageAttentes, limite: 20 }, signal: abort.signal }).then(({ data: resultat }) => { if (!abort.signal.aborted) setAttentes(resultat); }).catch((e) => { if (!abort.signal.aborted) setErreurAttentes(messageErreur(e, "Impossible de charger les demandes.")); }).finally(() => { if (!abort.signal.aborted) setChargementAttentes(false); });
    return () => abort.abort();
  }, [data?.association.peutGerer, endpoint, pageAttentes, revision]);
  async function decider(profilId: string, decision: "VERIFIE" | "REFUSE") {
    if (actionId) return;
    setActionId(profilId); setRetour(null);
    try { await api.patch(`${endpoint}/affiliations/${encodeURIComponent(profilId)}`, { decision }); setRetour({ texte: decision === "VERIFIE" ? "L’affiliation a été validée. Elle est maintenant visible sur le profil du membre." : "La demande a été refusée." }); setPageAttentes(1); actualiser(); }
    catch (e) { setRetour({ texte: messageErreur(e, "La décision n’a pas pu être enregistrée."), erreur: true }); }
    finally { setActionId(""); }
  }
  async function envoyerMedia(event: ChangeEvent<HTMLInputElement>, type: "photo" | "couverture") {
    const fichier = event.target.files?.[0]; event.target.value = "";
    if (!fichier || mediaEnCours) return;
    const max = type === "photo" ? 5 : 10;
    if (!["image/jpeg", "image/png", "image/webp"].includes(fichier.type) || fichier.size > max * 1024 * 1024) { setRetour({ texte: `Choisissez une image JPEG, PNG ou WebP de ${max} Mo maximum.`, erreur: true }); return; }
    const form = new FormData(); form.append(type, fichier); setMediaEnCours(true); setRetour(null);
    try { const { data: resultat } = await api.post<{ association: Association }>(`${endpoint}/${type}`, form, { headers: { "Content-Type": "multipart/form-data" } }); setData((d) => d ? { ...d, association: resultat.association } : d); setRetour({ texte: type === "photo" ? "La photo de l’association a été enregistrée." : "La couverture a été enregistrée." }); }
    catch (e) { setRetour({ texte: messageErreur(e, "L’image n’a pas pu être enregistrée."), erreur: true }); }
    finally { setMediaEnCours(false); }
  }
  const association = data?.association;
  const couverture = urlMediaBackend(association?.photoCouverture);
  const site = lienWebPublic(association?.site);
  if (supprimee) return <div className={styles.page}><p role="status" className={styles.status}>L’association a été supprimée de l’annuaire.</p><Link href="/annuaire?type=associations" className={styles.back}><ArrowLeft size={16} aria-hidden />Retour aux associations</Link></div>;
  return <div className={styles.page}><Link href="/annuaire?type=associations" className={styles.back}><ArrowLeft size={16} aria-hidden />Retour aux associations</Link>{chargement && !data ? <Chargement texte="Chargement de l’association…" /> : erreur ? <ErreurChargement message={erreur} reessayer={actualiser} /> : association ? <><section className={styles.profileHero}><div className={styles.cover}>{couverture && <img src={couverture} alt="" />}{association.peutGerer && <button type="button" className={`${styles.button} ${styles.coverAction}`} disabled={mediaEnCours} onClick={() => coverInput.current?.click()}><Camera size={15} aria-hidden />{mediaEnCours ? "Enregistrement…" : "Modifier la couverture"}</button>}</div><div className={styles.heroBody}><div className={styles.heroAvatar}><AvatarAnnuaire nom={association.nom} photo={association.photo} grand carre />{association.peutGerer && <button className={styles.button} type="button" style={{ position: "absolute", right: -15, bottom: 0, padding: 8 }} disabled={mediaEnCours} onClick={() => photoInput.current?.click()} aria-label="Modifier la photo de l’association"><Camera size={16} aria-hidden /></button>}</div><div className={styles.heroHeading}><div><p className={styles.eyebrow}>Association{association.vocation ? ` · ${association.vocation}` : ""}</p><h1 className={styles.heroName}>{association.nom}</h1><p className={styles.location}><MapPin size={15} aria-hidden />{[association.ville, association.pays].filter(Boolean).join(", ")}</p><div className={styles.heroMeta}><span><UsersRound size={14} aria-hidden style={{ display: "inline", marginRight: 5 }} />{association.nbMembres} membre{association.nbMembres > 1 ? "s" : ""} dans le réseau</span>{association.dateCreation && <span>Fondée en {datePublique(association.dateCreation)}</span>}</div></div><div style={{ width: "min(100%, 280px)" }}><BoutonAffiliation association={association} actualiser={actualiser} />{!association.peutGerer && <div style={{ marginTop: 8, textAlign: "right" }}><BoutonSignaler cibleType="ASSOCIATION" cibleId={association.id} libelleCible={`l’association « ${association.nom} »`} /></div>}{association.peutSupprimer && <SupprimerContenu autorise={association.peutSupprimer === true} endpoint={endpoint} libelle="Supprimer l’association" titre={`Supprimer « ${association.nom} » ?`} consequences="La fiche, ses photos et les affiliations à cette association seront retirées. Les comptes des membres seront conservés." disabled={mediaEnCours || Boolean(actionId)} onSupprime={() => setSupprimee(true)} />}</div></div></div>{association.peutGerer && <><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Photo de l’association" onChange={(e) => void envoyerMedia(e, "photo")} /><input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Couverture de l’association" onChange={(e) => void envoyerMedia(e, "couverture")} /></>}</section>{retour && <p role={retour.erreur ? "alert" : "status"} className={`${styles.status} ${retour.erreur ? styles.error : ""}`}>{retour.texte}</p>}<div className={styles.detailGrid}><div className={styles.stack}><section className={styles.panel}><h2 className={styles.sectionTitle}>À propos</h2><p className={styles.description}>{association.description || "L’association n’a pas encore renseigné sa présentation."}</p></section><section className={styles.panel}><h2 className={styles.sectionTitle}>Les membres <span className={styles.note}>({data?.totalMembres})</span></h2><p className={styles.note}>Membres dont l’affiliation a été validée par le responsable.</p>{chargementMembres ? <Chargement texte="Chargement des membres…" /> : erreurMembres ? <ErreurChargement message={erreurMembres} reessayer={actualiser} /> : !membres?.membres.length ? <p className={styles.description}>Aucun membre validé pour le moment.</p> : membres.membres.map((m) => <Link key={m.id} href={`/membres/${encodeURIComponent(m.id)}`} className={styles.memberRow}><AvatarAnnuaire nom={nomComplet(m.prenom, m.nom)} photo={m.photo} /><div className={styles.memberMain}><p className={styles.memberName}>{nomComplet(m.prenom, m.nom)}</p><p className={styles.memberSubtitle}>{[titreMembre(m.titre), m.ville].filter(Boolean).join(" · ")}</p></div><span className={styles.link}>Voir le profil</span></Link>)}<PaginationAnnuaire page={page} totalPages={membres?.totalPages || 0} changer={setPage} chargement={chargementMembres} libelle="Pagination des membres de l’association" /></section>{association.peutGerer && <section className={styles.panel}><h2 className={styles.sectionTitle}>Demandes d’affiliation</h2><p className={styles.note}>Validez uniquement les personnes dont vous pouvez confirmer l’appartenance à l’association.</p>{chargementAttentes ? <Chargement texte="Chargement des demandes…" /> : erreurAttentes ? <ErreurChargement message={erreurAttentes} reessayer={actualiser} /> : !attentes?.affiliations.length ? <p className={styles.description}>Aucune demande en attente.</p> : attentes.affiliations.map(({ profil }) => <div className={styles.memberRow} key={profil.id}><AvatarAnnuaire nom={nomComplet(profil.prenom, profil.nom)} photo={profil.photo} /><div className={styles.memberMain}><Link className={styles.memberName} href={`/membres/${encodeURIComponent(profil.id)}`}>{nomComplet(profil.prenom, profil.nom)}</Link><p className={styles.memberSubtitle}>{[profil.titre, profil.ville].filter(Boolean).join(" · ")}</p></div><div className={styles.actionRow}><button type="button" className={`${styles.button} ${styles.primary}`} disabled={Boolean(actionId)} onClick={() => void decider(profil.id, "VERIFIE")} aria-label={`Valider ${nomComplet(profil.prenom, profil.nom)}`}><Check size={15} aria-hidden />Valider</button><button type="button" className={styles.button} disabled={Boolean(actionId)} onClick={() => void decider(profil.id, "REFUSE")} aria-label={`Refuser ${nomComplet(profil.prenom, profil.nom)}`}><X size={15} aria-hidden />Refuser</button></div></div>)}<PaginationAnnuaire page={pageAttentes} totalPages={attentes?.totalPages || 0} changer={setPageAttentes} chargement={chargementAttentes} libelle="Pagination des demandes d’affiliation" /></section>}</div><aside className={styles.stack}><section className={styles.panel}><h2 className={styles.sectionTitle}>Informations</h2><dl className={styles.detailsList}><dt>Localisation</dt><dd>{[association.ville, association.pays].filter(Boolean).join(", ")}</dd>{association.vocation && <><dt>Domaine</dt><dd>{association.vocation}</dd></>}{association.dateCreation && <><dt>Création</dt><dd>{datePublique(association.dateCreation)}</dd></>}{site && <><dt>Site internet</dt><dd><a className={styles.link} href={site} target="_blank" rel="noopener noreferrer">Visiter le site</a></dd></>}{association.emailContact && <><dt>Contact</dt><dd><a className={styles.link} href={`mailto:${association.emailContact}`}><Mail size={13} aria-hidden style={{ display: "inline", marginRight: 4 }} />{association.emailContact}</a></dd></>}</dl></section>{association.responsable && <section className={styles.panel}><h2 className={styles.sectionTitle}>Responsable</h2><Link href={`/membres/${encodeURIComponent(association.responsable.id)}`} className={styles.memberRow}><AvatarAnnuaire nom={nomComplet(association.responsable.prenom, association.responsable.nom)} photo={association.responsable.photo} /><span className={styles.memberName}>{nomComplet(association.responsable.prenom, association.responsable.nom)}</span></Link><ActionsMembre profilId={association.responsable.id} moi={association.responsable.estMoi} synergie={false} lienProfil={false} /></section>}</aside></div></> : null}</div>;
}

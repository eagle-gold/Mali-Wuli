"use client";

import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Eye, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import SupprimerContenu from "@/components/community/SupprimerContenu";
import { aPermission, type AutorisationsUtilisateur } from "@/lib/autorisations";
import { formaterDate, messageErreur } from "@/lib/community";
import { libelleModeTravail, libelleTypeOffre, lienExterneSur, MODES_CANDIDATURE } from "@/lib/offres";
import type { OffreApi, OffresResponse } from "@/types/offres";
import styles from "./OffresEdition.module.css";

export default function AdminOffres() {
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [erreurAcces, setErreurAcces] = useState("");
  const [donnees, setDonnees] = useState<OffresResponse | null>(null);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<{ id: string; valide: boolean } | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [erreursActions, setErreursActions] = useState<Record<string, string>>({});
  const [annonce, setAnnonce] = useState("");
  const verrou = useRef(false);
  const supprimes = useRef(new Set<string>());
  const dernierBouton = useRef<HTMLButtonElement | null>(null);
  const boutonsConfirmation = useRef<Record<string, HTMLButtonElement | null>>({});
  const boiteAnnonce = useRef<HTMLParagraphElement>(null);

  const verifierAcces = useCallback(async () => {
    setAutorise(null); setErreurAcces("");
    try {
      const { data } = await api.get<AutorisationsUtilisateur>("/users/me");
      setAutorise(aPermission(data, "OFFRES_MODERER"));
    } catch (e) { setErreurAcces(messageErreur(e, "Impossible de vérifier votre accès.")); }
  }, []);
  useEffect(() => { void verifierAcces(); }, [verifierAcces]);
  useEffect(() => {
    if (!autorise) return;
    const abort = new AbortController();
    setChargement(true); setErreur("");
    const charger = async () => {
      try {
        const { data } = await api.get<OffresResponse>("/offres", { params: { vue: "en-attente", page, limite: 15 }, signal: abort.signal });
        if (abort.signal.aborted) return;
        if (!data.peutModerer) { setAutorise(false); return; }
        if (!data.offres.length && page > 1) setPage(Math.max(1, Math.min(page - 1, data.meta.totalPages)));
        else setDonnees({ ...data, offres: data.offres.filter((item) => !supprimes.current.has(item.id)) });
      } catch (e) { if (!abort.signal.aborted) setErreur(messageErreur(e, "Impossible de charger les offres à valider.")); }
      finally { if (!abort.signal.aborted) setChargement(false); }
    };
    void charger();
    return () => abort.abort();
  }, [autorise, page, revision]);
  useEffect(() => { if (confirmation) boutonsConfirmation.current[confirmation.id]?.focus(); }, [confirmation]);
  useEffect(() => { if (annonce) boiteAnnonce.current?.focus(); }, [annonce]);
  const annuler = () => { setConfirmation(null); dernierBouton.current?.focus(); };
  const decider = async (offre: OffreApi, valide: boolean) => {
    if (verrou.current) return;
    verrou.current = true; setActionId(offre.id); setAnnonce("");
    setErreursActions((e) => ({ ...e, [offre.id]: "" }));
    try {
      await api.patch(`/offres/${encodeURIComponent(offre.id)}/validation`, { valide, revision: offre.revision });
      setDonnees((precedent) => precedent ? {
        ...precedent, offres: precedent.offres.filter((o) => o.id !== offre.id),
        meta: { ...precedent.meta, total: Math.max(0, precedent.meta.total - 1) },
        compteurs: { ...precedent.compteurs, enAttente: Math.max(0, precedent.compteurs.enAttente - 1) },
      } : precedent);
      setConfirmation(null);
      setAnnonce(valide ? `« ${offre.titre} » a été publiée.` : `« ${offre.titre} » a été refusée. Elle reste accessible à la personne qui l’a déposée.`);
      setRevision((r) => r + 1);
    } catch (e) {
      setErreursActions((erreurs) => ({ ...erreurs, [offre.id]: messageErreur(e, "La décision n’a pas pu être enregistrée. Réessayez.") }));
      if ((e as { response?: { status?: number } })?.response?.status === 409) {
        setConfirmation(null);
        setRevision((r) => r + 1);
      }
    } finally { verrou.current = false; setActionId(null); }
  };

  const retirer = (offre: OffreApi) => {
    supprimes.current.add(offre.id);
    setDonnees((ancien) => ancien ? { ...ancien, offres: ancien.offres.filter((item) => item.id !== offre.id), meta: { ...ancien.meta, total: Math.max(0, ancien.meta.total - 1) }, compteurs: { ...ancien.compteurs, enAttente: Math.max(0, ancien.compteurs.enAttente - 1) } } : ancien);
    setConfirmation(null); setAnnonce(`« ${offre.titre} » a été supprimée.`); setRevision((r) => r + 1);
  };

  return <main className={styles.page}>
    <Link href="/offres" className={styles.back}><ArrowLeft size={17} aria-hidden />Offres d’emploi</Link>
    <header className={styles.header}><div><h1>Offres à valider</h1><p>Vérifiez le poste, l’entreprise et les modalités de candidature avant publication.</p></div>{autorise && donnees && <span className={styles.counter}>{donnees.compteurs.enAttente} en attente</span>}</header>
    {autorise !== true ? <section className={styles.panel}>{erreurAcces ? <><p role="alert" className={styles.error}>{erreurAcces}</p><button type="button" className={styles.secondary} onClick={() => void verifierAcces()}>Réessayer</button></> : <p role={autorise === null ? "status" : undefined}>{autorise === null ? "Vérification de votre accès…" : "Cet espace est réservé à l’équipe de modération."}</p>}</section> : <>
      {annonce && <p ref={boiteAnnonce} tabIndex={-1} role="status" className={styles.success}>{annonce}</p>}
      <div className={styles.actions} style={{ marginBottom: 18 }}><button type="button" className={styles.secondary} disabled={chargement || Boolean(actionId)} onClick={() => { setConfirmation(null); setRevision((r) => r + 1); }}><RefreshCw size={15} aria-hidden />Actualiser</button></div>
      {chargement ? <p role="status" className={styles.panel}>Chargement des offres…</p> : erreur ? <section className={styles.panel}><p role="alert" className={styles.error}>{erreur}</p><button type="button" className={styles.secondary} onClick={() => setRevision((r) => r + 1)}>Réessayer</button></section> : !donnees?.offres.length ? <section className={styles.empty}><Check size={28} aria-hidden /><h2>Aucune offre en attente</h2><p>Les offres déposées ou modifiées apparaîtront ici.</p><Link href="/offres" className={styles.secondary}>Voir les offres</Link></section> : <div className={styles.list}>{donnees.offres.map((offre) => {
        const decision = confirmation?.id === offre.id ? confirmation : null;
        const enCours = actionId === offre.id;
        const externe = offre.modeCandidature === "LIEN_EXTERNE" ? lienExterneSur(offre.lienCandidature) : null;
        return <article key={offre.id} className={styles.panel}>
          <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>{offre.titre}</h2><p className={styles.companyName}>{offre.entreprise} · {[offre.ville, offre.pays].filter(Boolean).join(", ")}</p><p className={styles.muted}>Déposée par {offre.publieur?.nomComplet || [offre.publieur?.prenom, offre.publieur?.nom].filter(Boolean).join(" ") || "Un membre"} · {formaterDate(offre.createdAt)}</p></div><div className={styles.actions}><button type="button" className={styles.refuse} disabled={Boolean(actionId)} onClick={(e) => { dernierBouton.current = e.currentTarget; setConfirmation({ id: offre.id, valide: false }); }}><X size={16} aria-hidden />Refuser</button><button type="button" className={styles.primary} disabled={Boolean(actionId)} onClick={(e) => { dernierBouton.current = e.currentTarget; setConfirmation({ id: offre.id, valide: true }); }}><Check size={16} aria-hidden />Valider et publier</button></div></div>
          <dl className={styles.details}><div><dt>Contrat et mode de travail</dt><dd>{libelleTypeOffre(offre.type)} · {libelleModeTravail(offre.modeTravail)}</dd></div><div><dt>Secteur</dt><dd>{offre.secteur}</dd></div><div><dt>Salaire</dt><dd>{offre.salaire || "Non précisé"}</dd></div><div><dt>Date limite</dt><dd>{offre.dateExpiration ? `${formaterDate(offre.dateExpiration, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} à 23 h 59 UTC${offre.estExpiree ? " · Date dépassée" : ""}` : "Non précisée"}</dd></div><div><dt>Candidature</dt><dd>{MODES_CANDIDATURE.find((m) => m.value === offre.modeCandidature)?.label || offre.modeCandidature}</dd></div><div><dt>Recommandation par le déposant</dt><dd>{offre.recommandationPossible ? "Possible" : "Non proposée"}</dd></div>{offre.modeCandidature === "EMAIL" && <div className={styles.full}><dt>Adresse de réception</dt><dd>{offre.emailContact || "Adresse du compte ayant déposé l’offre"}</dd></div>}{offre.modeCandidature === "LIEN_EXTERNE" && <div className={styles.full}><dt>Lien de candidature</dt><dd>{externe ? <a href={externe} target="_blank" rel="noopener noreferrer" className={styles.back} style={{ margin: 0, overflowWrap: "anywhere", display: "inline" }}>{offre.lienCandidature} <ExternalLink size={13} aria-hidden style={{ display: "inline" }} /><span className="sr-only"> (nouvel onglet)</span></a> : offre.lienCandidature || "Lien non renseigné"}</dd></div>}</dl>
          <h3 className={styles.subheading}>Description du poste</h3><p className={styles.description}>{offre.description}</p>
          {offre.profilRecherche && <><h3 className={styles.subheading}>Profil recherché</h3><p className={styles.description}>{offre.profilRecherche}</p></>}
          <Link href={`/offres?offre=${encodeURIComponent(offre.id)}`} className={styles.secondary}><Eye size={15} aria-hidden />Voir la fiche complète</Link>
          {offre.peutSupprimer && <SupprimerContenu autorise={offre.peutSupprimer === true} endpoint={`/offres/${encodeURIComponent(offre.id)}`} libelle="Supprimer l’offre" titre={`Supprimer « ${offre.titre} » ?`} consequences="L’offre et ses enregistrements seront retirés. Les candidatures déjà transmises ne peuvent pas être annulées par cette action." disabled={Boolean(actionId)} onEnCours={(valeur) => { verrou.current = valeur; setActionId(valeur ? offre.id : null); if (valeur) setConfirmation(null); }} onSupprime={() => retirer(offre)} />}
          {erreursActions[offre.id] && <p role="alert" className={styles.error}>{erreursActions[offre.id]}</p>}
          {decision && <section className={styles.confirmation} aria-label={`Confirmer la décision pour ${offre.titre}`} onKeyDown={(e) => { if (e.key === "Escape" && !enCours) annuler(); }}><p>{decision.valide ? "Publier cette offre pour les membres du réseau ?" : "Refuser cette offre ? Elle ne sera pas publiée."}</p><div className={styles.actions}><button ref={(element) => { boutonsConfirmation.current[offre.id] = element; }} type="button" disabled={Boolean(actionId)} className={styles.secondary} onClick={annuler}>Annuler</button><button type="button" disabled={Boolean(actionId)} className={decision.valide ? styles.primary : styles.refuse} onClick={() => void decider(offre, decision.valide)}>{enCours ? "Enregistrement…" : decision.valide ? "Confirmer la publication" : "Confirmer le refus"}</button></div></section>}
        </article>;
      })}</div>}
      {!erreur && donnees && donnees.meta.totalPages > 1 && <nav className={styles.pagination} aria-label="Pages des offres à valider"><button type="button" className={styles.secondary} disabled={page <= 1 || chargement || Boolean(actionId)} onClick={() => { setConfirmation(null); setPage((p) => p - 1); }}>Précédent</button><span>Page {page} sur {donnees.meta.totalPages}</span><button type="button" className={styles.secondary} disabled={page >= donnees.meta.totalPages || chargement || Boolean(actionId)} onClick={() => { setConfirmation(null); setPage((p) => p + 1); }}>Suivant</button></nav>}
    </>}
  </main>;
}

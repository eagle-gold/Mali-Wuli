"use client";

import Link from "next/link";
import { ArrowLeft, Check, Eye, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import SupprimerContenu from "@/components/community/SupprimerContenu";
import { aPermission, type AutorisationsUtilisateur } from "@/lib/autorisations";
import { messageErreur } from "@/lib/community";
import { formaterDateEvenement } from "@/lib/evenements";
import type { Evenement, EvenementsResponse } from "@/types/evenements";
import styles from "./AdministrationEvenements.module.css";

const FORMAT = { PRESENTIEL: "Présentiel", EN_LIGNE: "En ligne", HYBRIDE: "Hybride" };

export default function AdministrationEvenementsPage() {
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [erreurAcces, setErreurAcces] = useState("");
  const [donnees, setDonnees] = useState<EvenementsResponse | null>(null);
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
  const boutonsAction = useRef<Record<string, HTMLButtonElement | null>>({});
  const boutonsConfirmation = useRef<Record<string, HTMLButtonElement | null>>({});
  const boiteAnnonce = useRef<HTMLParagraphElement>(null);

  const verifierAcces = useCallback(async () => {
    setAutorise(null); setErreurAcces("");
    try {
      const { data } = await api.get<AutorisationsUtilisateur>("/users/me");
      setAutorise(aPermission(data, "EVENEMENTS_MODERER"));
    } catch (error) { setErreurAcces(messageErreur(error, "Impossible de vérifier votre accès.")); }
  }, []);
  useEffect(() => { void verifierAcces(); }, [verifierAcces]);
  useEffect(() => {
    if (!autorise) return;
    let actif = true;
    setChargement(true); setErreur("");
    const charger = async () => {
      try {
        const { data } = await api.get<EvenementsResponse>("/evenements", { params: { statut: "en_attente", periode: "tous", page, limite: 20 } });
        if (!actif) return;
        if (!data.peutModerer) { setAutorise(false); return; }
        if (!data.evenements.length && page > 1) setPage((valeur) => valeur - 1);
        else setDonnees({ ...data, evenements: data.evenements.filter((item) => !supprimes.current.has(item.id)) });
      } catch (error) { if (actif) setErreur(messageErreur(error, "Impossible de charger les propositions.")); }
      finally { if (actif) setChargement(false); }
    };
    void charger();
    return () => { actif = false; };
  }, [autorise, page, revision]);
  useEffect(() => {
    if (confirmation) boutonsConfirmation.current[confirmation.id]?.focus();
  }, [confirmation]);

  const annulerConfirmation = (id: string) => { setConfirmation(null); boutonsAction.current[id]?.focus(); };
  const decider = async (evenement: Evenement, valide: boolean) => {
    if (verrou.current) return;
    verrou.current = true; setActionId(evenement.id); setAnnonce("");
    setErreursActions((erreurs) => { const copie = { ...erreurs }; delete copie[evenement.id]; return copie; });
    try {
      await api.patch(`/evenements/${encodeURIComponent(evenement.id)}/validation`, { valide });
      setDonnees((ancien) => ancien ? { ...ancien, evenements: ancien.evenements.filter((item) => item.id !== evenement.id), meta: { ...ancien.meta, total: Math.max(0, ancien.meta.total - 1) }, compteurs: { ...ancien.compteurs, aValider: Math.max(0, ancien.compteurs.aValider - 1) } } : ancien);
      setConfirmation(null);
      setAnnonce(valide ? `« ${evenement.titre} » est publié.` : `« ${evenement.titre} » a été refusé. La proposition reste accessible à son organisateur.`);
      setRevision((valeur) => valeur + 1);
    } catch (error) {
      setErreursActions((erreurs) => ({ ...erreurs, [evenement.id]: messageErreur(error, "Cette décision n’a pas pu être enregistrée. Réessayez.") }));
    } finally { verrou.current = false; setActionId(null); }
  };
  useEffect(() => { if (annonce) boiteAnnonce.current?.focus(); }, [annonce]);

  const retirer = (evenement: Evenement) => {
    supprimes.current.add(evenement.id);
    setDonnees((ancien) => ancien ? { ...ancien, evenements: ancien.evenements.filter((item) => item.id !== evenement.id), meta: { ...ancien.meta, total: Math.max(0, ancien.meta.total - 1) }, compteurs: { ...ancien.compteurs, aValider: Math.max(0, ancien.compteurs.aValider - 1) } } : ancien);
    setConfirmation(null); setAnnonce(`« ${evenement.titre} » a été supprimé.`); setRevision((r) => r + 1);
  };

  return <main className={styles.page}>
    <Link href="/evenements" className={styles.back}><ArrowLeft size={17} aria-hidden />Événements</Link>
    <header className={styles.header}><div><h1>Événements à valider</h1><p>Vérifiez chaque proposition avant publication.</p></div>{autorise && donnees && <span className={styles.counter}>{donnees.compteurs.aValider} en attente</span>}</header>
    {autorise !== true ? <section className={styles.panel}>{erreurAcces ? <><p role="alert" className={styles.error}>{erreurAcces}</p><button type="button" className={styles.secondary} onClick={() => void verifierAcces()}>Réessayer</button></> : <p role={autorise === null ? "status" : undefined}>{autorise === null ? "Vérification de votre accès…" : "Cet espace est réservé à l’équipe de modération."}</p>}</section> : <>
      {annonce && <p ref={boiteAnnonce} tabIndex={-1} role="status" className={styles.success}>{annonce}</p>}
      {chargement ? <p className={styles.panel} role="status">Chargement des propositions…</p> : erreur ? <div className={styles.panel}><p className={styles.error} role="alert">{erreur}</p><button type="button" className={styles.secondary} onClick={() => setRevision((valeur) => valeur + 1)}>Réessayer</button></div> : !donnees?.evenements.length ? <div className={styles.empty}><Check size={28} aria-hidden /><h2>Aucune proposition en attente</h2><p>Les nouveaux événements proposés par les membres apparaîtront ici.</p><Link href="/evenements" className={styles.secondary}>Voir les événements</Link></div> : <div className={styles.list}>{donnees.evenements.map((evenement) => {
        const decision = confirmation?.id === evenement.id ? confirmation : null;
        const enCours = actionId === evenement.id;
        return <article key={evenement.id} className={styles.panel}>
          <div className={styles.cardHeader}><div className={styles.informations}><div className={styles.titleRow}><h2>{evenement.titre}</h2><span className={styles.badge}>{FORMAT[evenement.type]}</span></div><p className={styles.meta}>{formaterDateEvenement(evenement.dateDebut, evenement.fuseauHoraire || "Africa/Bamako", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {evenement.type === "EN_LIGNE" ? "En ligne" : [evenement.ville, evenement.pays].filter(Boolean).join(", ") || evenement.lieu || "Lieu à préciser"}</p><p className={styles.meta}>Proposé par <strong>{evenement.organisateur?.nomComplet || [evenement.organisateur?.prenom, evenement.organisateur?.nom].filter(Boolean).join(" ") || "Un membre"}</strong></p></div>
            <div className={styles.actions}><Link href={`/evenements/${encodeURIComponent(evenement.id)}`} className={styles.secondary}><Eye size={16} aria-hidden />Voir le détail</Link><button ref={(element) => { boutonsAction.current[evenement.id] = element; }} type="button" className={styles.refuse} disabled={Boolean(actionId)} onClick={() => setConfirmation({ id: evenement.id, valide: false })}><X size={16} aria-hidden />Refuser</button><button type="button" className={styles.primary} disabled={Boolean(actionId)} onClick={() => setConfirmation({ id: evenement.id, valide: true })}><Check size={16} aria-hidden />Valider et publier</button></div>
          </div>
          <p className={styles.description}>{evenement.description}</p>
          {evenement.peutSupprimer && <SupprimerContenu autorise={evenement.peutSupprimer === true} endpoint={`/evenements/${encodeURIComponent(evenement.id)}`} libelle="Supprimer l’événement" titre={`Supprimer « ${evenement.titre} » ?`} consequences="La proposition, les inscriptions et les photos de cet événement seront retirées." disabled={Boolean(actionId)} onEnCours={(valeur) => { verrou.current = valeur; setActionId(valeur ? evenement.id : null); if (valeur) setConfirmation(null); }} onSupprime={() => retirer(evenement)} />}
          {erreursActions[evenement.id] && <p className={styles.error} role="alert">{erreursActions[evenement.id]}</p>}
          {decision && <section className={styles.confirmation} aria-label={`Confirmer la décision pour ${evenement.titre}`} onKeyDown={(event) => { if (event.key === "Escape" && !enCours) annulerConfirmation(evenement.id); }}><p>{decision.valide ? "Publier cet événement pour les membres du réseau ?" : "Refuser cette proposition ? Elle ne sera pas publiée, et l’organisateur sera informé."}</p><div className={styles.actions}><button ref={(element) => { boutonsConfirmation.current[evenement.id] = element; }} type="button" disabled={Boolean(actionId)} className={styles.secondary} onClick={() => annulerConfirmation(evenement.id)}>Annuler</button><button type="button" disabled={Boolean(actionId)} className={decision.valide ? styles.primary : styles.refuse} onClick={() => void decider(evenement, decision.valide)}>{enCours ? "Enregistrement…" : decision.valide ? "Confirmer la publication" : "Confirmer le refus"}</button></div></section>}
        </article>;
      })}</div>}
      {!erreur && donnees && donnees.meta.totalPages > 1 && <nav className={styles.pagination} aria-label="Pages des propositions d’événements"><button type="button" className={styles.secondary} disabled={page <= 1 || chargement || Boolean(actionId)} onClick={() => { setConfirmation(null); setPage((valeur) => valeur - 1); }}>Précédent</button><span>Page {page} sur {donnees.meta.totalPages}</span><button type="button" className={styles.secondary} disabled={page >= donnees.meta.totalPages || chargement || Boolean(actionId)} onClick={() => { setConfirmation(null); setPage((valeur) => valeur + 1); }}>Suivant</button></nav>}
    </>}
  </main>;
}

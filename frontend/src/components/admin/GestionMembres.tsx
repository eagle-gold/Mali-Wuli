"use client";

import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import api from "@/lib/api";
import { aPermission, type AutorisationsUtilisateur } from "@/lib/autorisations";
import { messageErreur } from "@/lib/community";
import styles from "./GestionMembres.module.css";

type RoleDisponible = { code: string; libelle: string; description: string; permissions: string[]; attribuable: boolean };
type CatalogueRoles = AutorisationsUtilisateur & { roles: RoleDisponible[]; roleCourant: string; peutGererRoles: boolean };
type Membre = AutorisationsUtilisateur & {
  id: string; profilId: string | null; prenom: string | null; nom: string | null; email: string;
  role: string; rolesDelegues: string[]; permissions: string[]; revisionDroits: string;
  statut: string; emailVerifie: boolean; onboardingFini: boolean; createdAt: string;
  estAdminPrincipal: boolean; estMoi: boolean; peutModifierRole: boolean; raisonProtection: string | null;
  peutDesactiver: boolean; peutRetablir: boolean; raisonProtectionCompte?: string | null;
};
type ListeMembres = { membres: Membre[]; total: number; page: number; limite: number; totalPages: number };
type Filtres = { q: string; roleDelegue: string; statut: string };
const FILTRES_VIDES: Filtres = { q: "", roleDelegue: "", statut: "" };
const STATUTS: Record<string, string> = { VALIDE: "Actif", REFUSE: "Refusé", SUSPENDU: "Suspendu" };
const nomMembre = (membre: Membre) => [membre.prenom, membre.nom].filter(Boolean).join(" ") || membre.email;
const dateInscription = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
const memesRoles = (a: string[], b: string[]) => a.length === b.length && a.every((role) => b.includes(role));

export default function GestionMembres() {
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [erreurAcces, setErreurAcces] = useState("");
  const [peutGererRoles, setPeutGererRoles] = useState(false);
  const [compteAction, setCompteAction] = useState<{ membre: Membre; action: "DESACTIVER" | "RETABLIR" } | null>(null);
  const annulerCompte = useRef<HTMLButtonElement | null>(null);
  const [roles, setRoles] = useState<RoleDisponible[]>([]);
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES);
  const [recherche, setRecherche] = useState<Filtres>(FILTRES_VIDES);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<ListeMembres | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [erreurAction, setErreurAction] = useState("");
  const [revision, setRevision] = useState(0);
  const [edition, setEdition] = useState<Membre | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState("");
  const verrou = useRef(false);
  const premierChoix = useRef<HTMLInputElement | null>(null);
  const boutonAnnuler = useRef<HTMLButtonElement | null>(null);
  const dernierBouton = useRef<HTMLButtonElement | null>(null);
  const messageRetour = useRef<HTMLParagraphElement | null>(null);
  const rolesAttribuables = roles.filter((role) => role.attribuable);
  const libelleRole = (code: string) => roles.find((role) => role.code === code)?.libelle || "Ancien rôle";
  const rolesEffectifsEditables = (membre: Membre) => membre.role === "MODERATEUR"
    ? rolesAttribuables.filter((role) => role.permissions.length > 0 && role.permissions.every((permission) => membre.permissions.includes(permission))).map((role) => role.code)
    : membre.rolesDelegues.filter((code) => rolesAttribuables.some((role) => role.code === code));
  const changement = Boolean(edition && (edition.role !== "MEMBRE" || !memesRoles(selection, edition.rolesDelegues)));

  const verifierAcces = useCallback(async () => {
    setAutorise(null); setErreurAcces("");
    try {
      const { data: compte } = await api.get<AutorisationsUtilisateur>("/users/me");
      if (!aPermission(compte, "ROLES_GERER") && !aPermission(compte, "MEMBRES_GERER")) { setAutorise(false); return; }
      const { data } = await api.get<CatalogueRoles>("/admin/roles");
      setRoles(data.roles);
      setPeutGererRoles(data.peutGererRoles && aPermission(data, "ROLES_GERER"));
      setAutorise(aPermission(data, "ROLES_GERER") || aPermission(data, "MEMBRES_GERER"));
    } catch (e) { setErreurAcces(messageErreur(e, "Impossible de vérifier votre accès.")); }
  }, []);
  useEffect(() => { void verifierAcces(); }, [verifierAcces]);
  useEffect(() => {
    if (!autorise) return;
    const abort = new AbortController();
    setChargement(true); setErreur(""); setConfirmation(false); setEdition(null); setCompteAction(null);
    const charger = async () => {
      try {
        const { data } = await api.get<ListeMembres>("/admin/membres", {
          params: { q: recherche.q || undefined, roleDelegue: recherche.roleDelegue || undefined, statut: recherche.statut || undefined, page, limite: 20 },
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        if (!data.membres.length && page > 1) { setPage(Math.max(1, Math.min(page - 1, data.totalPages))); return; }
        setDonnees(data);
      } catch (e) {
        if (!abort.signal.aborted) {
          setErreur(messageErreur(e, "Impossible de charger les membres."));
          if ((e as { response?: { status?: number } })?.response?.status === 403) setAutorise(false);
        }
      } finally { if (!abort.signal.aborted) setChargement(false); }
    };
    void charger();
    return () => abort.abort();
  }, [autorise, recherche, page, revision]);
  useEffect(() => { if (edition && !confirmation) premierChoix.current?.focus(); }, [edition, confirmation]);
  useEffect(() => { if (compteAction) annulerCompte.current?.focus(); }, [compteAction]);
  useEffect(() => { if (confirmation) boutonAnnuler.current?.focus(); }, [confirmation]);
  useEffect(() => { if (annonce || erreur || erreurAction) messageRetour.current?.focus(); }, [annonce, erreur, erreurAction]);

  const rechercher = (event: FormEvent) => {
    event.preventDefault();
    if (verrou.current) return;
    setEdition(null); setConfirmation(false); setAnnonce(""); setErreurAction(""); setPage(1);
    setRecherche({ ...filtres, q: filtres.q.trim() });
  };
  const annuler = () => { setEdition(null); setConfirmation(false); dernierBouton.current?.focus(); };
  const enregistrer = async () => {
    if (!edition || !confirmation || verrou.current || !autorise || !changement) return;
    if (edition.estAdminPrincipal || !edition.peutModifierRole || !edition.revisionDroits || selection.some((code) => !rolesAttribuables.some((role) => role.code === code))) return;
    verrou.current = true; setActionId(edition.id); setErreurAction(""); setAnnonce("");
    try {
      const { data } = await api.patch<{ membre: Membre; message: string }>(`/admin/membres/${encodeURIComponent(edition.id)}/roles`, {
        rolesDelegues: rolesAttribuables.filter((role) => selection.includes(role.code)).map((role) => role.code), expectedRevision: edition.revisionDroits,
      });
      setEdition(null); setConfirmation(false);
      setAnnonce(`${nomMembre(data.membre)} : ${data.membre.rolesDelegues.length ? `rôles enregistrés — ${data.membre.rolesDelegues.map(libelleRole).join(", ")}.` : "aucun rôle délégué. Les fonctions ordinaires du réseau sont conservées."}`);
      setRevision((value) => value + 1);
    } catch (e) {
      setErreurAction(messageErreur(e, "Les rôles n’ont pas pu être modifiés. Réessayez."));
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409 || status === 403) { setEdition(null); setConfirmation(false); setRevision((value) => value + 1); }
    } finally { verrou.current = false; setActionId(null); }
  };

  const modifierStatut = async () => {
    if (!compteAction || verrou.current) return;
    const { membre, action } = compteAction;
    if (!membre.revisionDroits || (action === "DESACTIVER" ? !membre.peutDesactiver : !membre.peutRetablir)) return;
    verrou.current = true; setActionId(membre.id); setErreurAction(""); setAnnonce("");
    try {
      const { data } = await api.patch<{ membre: Membre; message: string }>(`/admin/membres/${encodeURIComponent(membre.id)}/statut`, { action, expectedRevision: membre.revisionDroits });
      setCompteAction(null); setAnnonce(`${nomMembre(membre)} : ${data.message}`); setRevision((value) => value + 1);
    } catch (e) {
      setErreurAction(messageErreur(e, "Impossible de modifier l’accès de ce membre."));
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409 || status === 403) { setCompteAction(null); setRevision((value) => value + 1); }
    } finally { verrou.current = false; setActionId(null); }
  };

  return <main className={styles.page}><div className={styles.container}>
    <Link href="/admin" className={styles.back}><ArrowLeft size={17} aria-hidden />Administration</Link>
    <header className={styles.header}><h1>Membres et rôles</h1><p>Gérez l’accès au réseau. Les rôles peuvent se combiner ; seul l’administrateur général peut les attribuer.</p></header>
    {autorise !== true ? <section className={styles.panel}>{erreurAcces ? <><p role="alert" className={styles.error}>{erreurAcces}</p><button type="button" className={styles.secondary} onClick={() => void verifierAcces()}>Réessayer</button></> : <p role={autorise === null ? "status" : undefined}>{autorise === null ? "Vérification de votre accès…" : "Cet espace est réservé aux personnes habilitées à gérer les membres ou les rôles."}</p>}</section> : <>
      <details className={styles.roles}><summary>Comprendre les rôles et les accès</summary><dl className={styles.roleList}>{rolesAttribuables.map((role) => <div key={role.code}><dt>{role.libelle}</dt><dd>{role.description}</dd></div>)}</dl><p className={styles.note}>Sans rôle délégué, le membre conserve les fonctions ordinaires du réseau. Le volontariat se choisit dans le profil. Un responsable désigné sur la fiche d’une association conserve la gestion de cette association, sans accès aux autres espaces d’administration.</p></details>
      <form onSubmit={rechercher} className={styles.panel} aria-label="Rechercher des membres"><div className={styles.filters}>
        <label className={styles.field} htmlFor="membres-recherche">Nom, prénom ou e-mail<input id="membres-recherche" type="search" maxLength={100} value={filtres.q} disabled={Boolean(actionId)} onChange={(event) => setFiltres({ ...filtres, q: event.target.value })} placeholder="Rechercher un membre" /></label>
        <label className={styles.field} htmlFor="membres-role">Rôle délégué<select id="membres-role" value={filtres.roleDelegue} disabled={Boolean(actionId)} onChange={(event) => setFiltres({ ...filtres, roleDelegue: event.target.value })}><option value="">Tous les membres</option>{rolesAttribuables.map((role) => <option key={role.code} value={role.code}>{role.libelle}</option>)}</select></label>
        <label className={styles.field} htmlFor="membres-statut">Statut du compte<select id="membres-statut" value={filtres.statut} disabled={Boolean(actionId)} onChange={(event) => setFiltres({ ...filtres, statut: event.target.value })}><option value="">Tous les statuts</option>{Object.entries(STATUTS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      </div><div className={styles.filterActions}><button type="submit" className={styles.primary} disabled={Boolean(actionId)}><Search size={16} aria-hidden />Rechercher</button><button type="button" className={styles.secondary} disabled={Boolean(actionId)} onClick={() => { setFiltres(FILTRES_VIDES); setRecherche(FILTRES_VIDES); setPage(1); setEdition(null); setConfirmation(false); setRevision((value) => value + 1); }}>Réinitialiser</button><p className={styles.muted}>Les rôles et le statut du compte sont indépendants.</p></div></form>
      {annonce && <p ref={messageRetour} tabIndex={-1} role="status" className={styles.success}>{annonce}</p>}
      {(erreurAction || erreur) && <p ref={messageRetour} tabIndex={-1} role="alert" className={styles.error}>{erreurAction || erreur}</p>}
      <div className={styles.resultHeading}><h2>{donnees ? `${donnees.total} membre${donnees.total > 1 ? "s" : ""}` : "Membres"}</h2><button type="button" className={styles.secondary} disabled={chargement || Boolean(actionId)} onClick={() => setRevision((value) => value + 1)}>Actualiser</button></div>
      {chargement ? <p role="status" className={styles.panel}>Chargement des membres…</p> : !donnees ? <section className={styles.panel}><button type="button" className={styles.secondary} onClick={() => setRevision((value) => value + 1)}>Réessayer</button></section> : !donnees.membres.length ? <p className={`${styles.panel} ${styles.empty}`}>Aucun membre ne correspond à cette recherche.</p> : <div className={styles.list}>{donnees.membres.map((membre) => {
        const protege = !peutGererRoles || membre.estAdminPrincipal || !membre.peutModifierRole;
        const enEdition = edition?.id === membre.id;
        const ancienGlobal = membre.role === "MODERATEUR";
        const initiaux = enEdition ? rolesEffectifsEditables(edition) : [];
        const ajoutes = selection.filter((code) => !initiaux.includes(code));
        const retires = initiaux.filter((code) => !selection.includes(code));
        return <article key={membre.id} className={styles.member}>
          <div className={styles.memberHeader}><div className={styles.identity}><h2>{nomMembre(membre)}{membre.estMoi ? " · Vous" : ""}</h2><p className={styles.email}>{membre.email}</p><div className={styles.badges}><span className={styles.badge}>{membre.estAdminPrincipal ? "Administrateur général" : ancienGlobal ? "Ancienne modération globale" : "Membre"}</span><span className={`${styles.badge} ${membre.statut !== "VALIDE" ? styles.pending : ""}`}>{STATUTS[membre.statut] || membre.statut}</span>{membre.rolesDelegues.map((code) => <span className={styles.badge} key={code}>{libelleRole(code)}</span>)}</div></div>{membre.profilId && membre.statut === "VALIDE" && membre.onboardingFini && <Link href={`/membres/${encodeURIComponent(membre.profilId)}`} className={styles.secondary}>Voir le profil</Link>}</div>
          <div className={styles.metadata}><p className={styles.muted}>Inscrit le {dateInscription(membre.createdAt)}</p><p className={styles.muted}>{membre.emailVerifie ? "E-mail confirmé" : "E-mail à confirmer"} · {membre.onboardingFini ? "Profil complété" : "Profil à compléter"}</p></div>
          {peutGererRoles && (protege ? <p className={styles.protected}>{membre.estAdminPrincipal ? "Administrateur général · Ce compte est protégé, ses droits ne peuvent pas être modifiés." : membre.raisonProtection || "Les rôles de ce compte ne peuvent pas être modifiés."}</p> : !enEdition ? <div className={styles.roleForm}><button type="button" className={styles.secondary} disabled={Boolean(actionId)} onClick={(event) => { dernierBouton.current = event.currentTarget; setErreurAction(""); setAnnonce(""); setCompteAction(null); setEdition(membre); setSelection(rolesEffectifsEditables(membre)); setConfirmation(false); }}>Modifier les rôles</button>{!membre.rolesDelegues.length && !ancienGlobal && <p className={styles.muted}>Aucun rôle délégué</p>}</div> : <section className={styles.editor} aria-label={`Rôles de ${nomMembre(membre)}`} onKeyDown={(event) => { if (event.key === "Escape" && !actionId) annuler(); }}>
          {ancienGlobal && <p className={styles.warning}>Ce membre possède l’ancien rôle de modération globale. En enregistrant, vous le remplacerez par les rôles cochés. La lecture des signalements ne sera plus déléguée et les autres droits de l’ancien rôle seront retirés.</p>}
          <fieldset className={styles.roleChoices} disabled={Boolean(actionId) || confirmation}><legend>Rôles délégués</legend>{rolesAttribuables.map((role, index) => <label className={styles.roleChoice} key={role.code}><input ref={index === 0 ? premierChoix : undefined} type="checkbox" value={role.code} checked={selection.includes(role.code)} onChange={(event) => setSelection((values) => event.target.checked ? [...values, role.code] : values.filter((code) => code !== role.code))} /><span><strong>{role.libelle}</strong><span>{role.description}</span></span></label>)}</fieldset>
          {!confirmation ? <div className={styles.actions}><button type="button" className={styles.secondary} onClick={annuler}>Annuler</button><button type="button" className={styles.primary} disabled={!changement || !edition?.revisionDroits || Boolean(actionId)} onClick={() => setConfirmation(true)}>Vérifier les changements</button></div> : <section className={styles.confirmation} aria-label={`Confirmer les rôles de ${nomMembre(membre)}`}><p>Modifier les rôles de <strong>{nomMembre(membre)}</strong> ({membre.email}) ?</p>{ajoutes.length > 0 && <p><strong>Ajouter :</strong> {ajoutes.map(libelleRole).join(", ")}.</p>}{retires.length > 0 && <p><strong>Retirer :</strong> {retires.map(libelleRole).join(", ")}.</p>}<p><strong>Après enregistrement :</strong> {selection.length ? selection.map(libelleRole).join(", ") : "aucun rôle délégué"}.</p><p className={styles.muted}>Le statut du compte restera inchangé. Ses sessions actuelles seront fermées ; cette personne devra se reconnecter.</p><div className={styles.actions}><button ref={boutonAnnuler} type="button" className={styles.secondary} disabled={Boolean(actionId)} onClick={() => setConfirmation(false)}>Revenir aux choix</button><button type="button" className={styles.primary} disabled={Boolean(actionId)} onClick={() => void enregistrer()}>{actionId ? "Enregistrement…" : "Confirmer le changement"}</button></div></section>}
          </section>)}
          {(membre.peutDesactiver || membre.peutRetablir) && <div className={styles.roleForm}>
            <button type="button" className={membre.peutDesactiver ? styles.danger : styles.secondary} disabled={Boolean(actionId)} onClick={() => { setEdition(null); setConfirmation(false); setErreurAction(""); setCompteAction({ membre, action: membre.peutDesactiver ? "DESACTIVER" : "RETABLIR" }); }}>{membre.peutDesactiver ? "Désactiver le compte" : "Rétablir le compte"}</button>
          </div>}
          {membre.raisonProtectionCompte && <p className={styles.muted}>{membre.raisonProtectionCompte}</p>}
          {compteAction?.membre.id === membre.id && <section className={styles.confirmation} aria-label={`Confirmer ${compteAction.action === "DESACTIVER" ? "la désactivation" : "le rétablissement"} de ${nomMembre(membre)}`} onKeyDown={(event) => { if (event.key === "Escape" && !actionId) setCompteAction(null); }}>
            <p><strong>{compteAction.action === "DESACTIVER" ? "Désactiver" : "Rétablir"} le compte de {nomMembre(membre)} ?</strong></p>
            <p>{compteAction.action === "DESACTIVER" ? "Cette personne ne pourra plus se connecter et son profil sera retiré de l’annuaire. Ses données seront conservées ; le compte pourra être rétabli." : "Cette personne retrouvera immédiatement l’accès au réseau et pourra se reconnecter."}</p>
            <div className={styles.actions}><button ref={annulerCompte} type="button" className={styles.secondary} disabled={Boolean(actionId)} onClick={() => setCompteAction(null)}>Annuler</button><button type="button" className={compteAction.action === "DESACTIVER" ? styles.danger : styles.primary} disabled={Boolean(actionId)} onClick={() => void modifierStatut()}>{actionId ? "Traitement…" : compteAction.action === "DESACTIVER" ? "Confirmer la désactivation" : "Confirmer le rétablissement"}</button></div>
          </section>}
        </article>;
      })}</div>}
      {donnees && donnees.totalPages > 1 && <nav className={styles.pagination} aria-label="Pages des membres"><button type="button" className={styles.secondary} disabled={page <= 1 || chargement || Boolean(actionId)} onClick={() => { setEdition(null); setPage((value) => value - 1); }}>Précédent</button><span>Page {page} sur {donnees.totalPages}</span><button type="button" className={styles.secondary} disabled={page >= donnees.totalPages || chargement || Boolean(actionId)} onClick={() => { setEdition(null); setPage((value) => value + 1); }}>Suivant</button></nav>}
    </>}
  </div></main>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { aAccesAdministration, aPermission, type AutorisationsUtilisateur } from "@/lib/autorisations";
import Link from "next/link";

type Signalement = {
  id: string; cibleType: string; cibleId: string; motif: string; createdAt: string;
  signaleur: { id: string; user: { prenom: string | null; nom: string | null } };
};

type NotificationCatalogue = {
  id: string;
  titre: string;
  message: string;
  lue: boolean;
  createdAt: string;
  suggestion: {
    id: string;
    type: string;
    libelleBrut: string;
    paysCode: string;
    ville?: string | null;
    nombreContributeurs: number;
    scoreDeterministe?: number | null;
    decisionIA?: {
      decision?: "MATCH" | "NEW" | "REVIEW";
      confidence?: number;
      raison?: string;
      facteursConcordance?: string[];
      facteursDivergence?: string[];
      modele?: string;
    } | null;
    candidat?: { id: string; libelle: string } | null;
    contributions: Array<{ id: string; libelleBrut: string; createdAt: string }>;
  };
};

type Inscription = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string;
  emailVerifie: boolean;
  createdAt: string;
  profil: {
    pays: string | null;
    ville: string | null;
    titre: string | null;
    onboardingFini: boolean;
    estVolontaire: boolean;
    _count: { formations: number; experiences: number };
  } | null;
};

type StatsAdmin = {
  membres: number;
  enAttente: number;
  publications: number;
  commentaires: number;
  messages: number;
  synergies: number;
  rendezVous: number;
};

const TYPE_LABEL: Record<string, string> = {
  ETABLISSEMENT: "Établissement",
  PROGRAMME: "Formation",
  SPECIALITE: "Spécialité / parcours",
  SERIE: "Série",
  DIPLOME: "Diplôme",
};

export default function AdminPage() {
  const [compte, setCompte] = useState<AutorisationsUtilisateur | null>(null);
  const [erreurAcces, setErreurAcces] = useState("");
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [notifications, setNotifications] = useState<NotificationCatalogue[]>([]);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [stats, setStats] = useState<StatsAdmin | null>(null);
  const [chargement, setChargement] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionInscriptionId, setActionInscriptionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");

  const verifierAcces = useCallback(async () => {
    setCompte(null); setErreurAcces("");
    try {
      const { data } = await api.get<AutorisationsUtilisateur>("/users/me");
      setCompte(data);
    } catch (error: unknown) {
      setErreurAcces((error as { response?: { data?: { message?: string } } }).response?.data?.message || "Impossible de vérifier votre accès.");
    }
  }, []);
  useEffect(() => { void verifierAcces(); }, [verifierAcces]);

  const charger = useCallback(async () => {
    if (!aAccesAdministration(compte)) return;
    setChargement(true); setErreur("");
    try {
      const [notificationsResponse, inscriptionsResponse, statsResponse, signalementsResponse] = await Promise.all([
        aPermission(compte, "CATALOGUE_GERER") ? api.get<{ notifications: NotificationCatalogue[] }>("/admin/notifications") : Promise.resolve({ data: { notifications: [] } }),
        aPermission(compte, "INSCRIPTIONS_GERER") ? api.get<{ inscriptions: Inscription[] }>("/admin/inscriptions?statut=EN_ATTENTE") : Promise.resolve({ data: { inscriptions: [] } }),
        aPermission(compte, "STATS_CONSULTER") ? api.get<StatsAdmin>("/admin/stats") : Promise.resolve(null),
        aPermission(compte, "SIGNALEMENTS_CONSULTER") ? api.get<{ signalements: Signalement[] }>("/admin/signalements", { params: { statut: "EN_ATTENTE" } }) : Promise.resolve({ data: { signalements: [] } }),
      ]);
      setNotifications(notificationsResponse.data.notifications);
      setInscriptions(inscriptionsResponse.data.inscriptions);
      setStats(statsResponse?.data || null);
      setSignalements(signalementsResponse.data.signalements);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setErreur(message || "Impossible de charger les validations en attente.");
    } finally {
      setChargement(false);
    }
  }, [compte]);

  const traiterInscription = async (inscription: Inscription, decision: "valider" | "refuser") => {
    setActionInscriptionId(inscription.id);
    setErreur("");
    try {
      await api.put(`/admin/inscriptions/${inscription.id}/${decision}`, {});
      setInscriptions((actuelles) => actuelles.filter(({ id }) => id !== inscription.id));
      setStats((actuelles) => actuelles && ({
        ...actuelles,
        enAttente: Math.max(0, actuelles.enAttente - 1),
        membres: decision === "valider" ? actuelles.membres + 1 : actuelles.membres,
      }));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setErreur(message || "Cette inscription n’a pas pu être traitée.");
    } finally {
      setActionInscriptionId(null);
    }
  };

  useEffect(() => {
    void charger();
  }, [charger]);

  const traiter = async (
    notification: NotificationCatalogue,
    decision: "accepter" | "refuser",
    fusionnerAvecId?: string,
  ) => {
    setActionId(notification.id);
    setErreur("");
    try {
      await api.put(
        `/admin/catalogue/suggestions/${notification.suggestion.id}/${decision}`,
        fusionnerAvecId ? { fusionnerAvecId } : {},
      );
      setNotifications((precedent) => precedent.filter((item) => item.id !== notification.id));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setErreur(message || "Cette décision n’a pas pu être enregistrée.");
    } finally {
      setActionId(null);
    }
  };

  if (!aAccesAdministration(compte)) return <main className="min-h-screen bg-[var(--color-page)] px-4 py-10"><section className="mx-auto max-w-xl rounded-2xl border border-[#e4d2b3] bg-white p-6"><h1 className="font-display text-2xl text-[#292119]">Administration</h1>{erreurAcces ? <><p role="alert" className="mt-4 text-[#a22922]">{erreurAcces}</p><button type="button" onClick={() => void verifierAcces()} className="mt-4 rounded-xl border border-[#dfc9a8] px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d6738]">Réessayer</button></> : <p className="mt-4" role={compte === null ? "status" : undefined}>{compte === null ? "Vérification de votre accès…" : "Cet espace est réservé à l’équipe de modération."}</p>}<Link href="/dashboard" className="mt-5 block font-semibold text-[#0d6738]">Retour au réseau</Link></section></main>;

  return (
    <main className="min-h-screen bg-[var(--color-page)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto min-w-0 max-w-[1180px] space-y-7 [overflow-wrap:anywhere]">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center font-semibold text-[#0d6738] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d6738]">← Retour au réseau</Link>
        <header>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-[#c65327]">
            Équipe Mali Wuli
          </p>
          <h1 className="font-display text-3xl font-bold text-[#292119] sm:text-4xl">
            Administration
          </h1>
        </header>

        {(aPermission(compte, "ROLES_GERER") || aPermission(compte, "MEMBRES_GERER")) && <Link href="/admin/membres" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 text-[#2e261f] transition hover:border-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">
          <span><strong className="titre-element block">Membres et rôles</strong><span className="mt-1 block text-sm text-[#695c4b]">Rechercher un membre, gérer son accès et les délégations autorisées.</span></span><span className="font-semibold text-[#0d6738]">Gérer les membres →</span>
        </Link>}
        {aPermission(compte, "PUBLICATIONS_MODERER") && <Link href="/dashboard" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 text-[#2e261f] transition hover:border-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">
          <span><strong className="titre-element block">Publications et commentaires</strong><span className="mt-1 block text-sm text-[#695c4b]">Retirer une publication ou un commentaire depuis le fil du réseau.</span></span><span className="font-semibold text-[#0d6738]">Ouvrir le fil →</span>
        </Link>}
        {aPermission(compte, "ASSOCIATIONS_GERER") && <Link href="/admin/associations" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 text-[#2e261f] transition hover:border-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">
          <span><strong className="titre-element block">Associations</strong><span className="mt-1 block text-sm text-[#695c4b]">Créer les fiches, désigner les responsables et traiter les propositions.</span></span><span className="font-semibold text-[#0d6738]">Gérer les associations →</span>
        </Link>}

        {aPermission(compte, "OFFRES_MODERER") && <Link href="/admin/offres" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 text-[#2e261f] transition hover:border-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">
          <div><h2 className="titre-element">Offres d’emploi</h2><p className="mt-1 text-sm">Vérifier les offres proposées avant leur publication.</p></div>
          <span className="font-semibold text-[#0d6738]">Ouvrir la validation →</span>
        </Link>}
        {aPermission(compte, "EVENEMENTS_MODERER") && <Link href="/admin/evenements" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 text-[#2e261f] transition hover:border-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">
          <span><strong className="titre-element block">Événements</strong><span className="mt-1 block text-sm text-[#695c4b]">Vérifier les propositions avant leur publication dans le réseau.</span></span><span className="font-semibold text-[#0d6738]">Valider les événements →</span>
        </Link>}

        {aPermission(compte, "STATS_CONSULTER") && stats && (
          <section aria-label="Statistiques du réseau" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Membres", stats.membres],
              ["En attente", stats.enAttente],
              ["Publications", stats.publications],
              ["Commentaires", stats.commentaires],
              ["Messages", stats.messages],
              ["Synergies", stats.synergies],
              ["Rendez-vous", stats.rendezVous],
            ].map(([label, valeur]) => (
              <article key={label} className="rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] px-4 py-4 shadow-sm">
                <p className="text-2xl font-bold text-[#0d6738]">{valeur}</p>
                <p className="mt-1 text-xs font-semibold text-[#56493e]">{label}</p>
              </article>
            ))}
          </section>
        )}

        {erreur && <div className="rounded-xl bg-[#fde8e7] px-4 py-3 text-sm text-[#a22922]"><p role="alert">{erreur}</p><button type="button" onClick={() => void charger()} disabled={chargement} className="mt-2 rounded-lg border border-current px-3 py-2 font-semibold">Réessayer</button></div>}

        {aPermission(compte, "INSCRIPTIONS_GERER") && <section className="rounded-[22px] border border-[#e4d2b3] bg-[#fffbf5] p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="titre-section">Profils à valider</h2>
              <p className="mt-2 text-sm text-[#56493e] sm:text-base">
                Vérifiez que le profil est complet avant de lui ouvrir l’accès à l’annuaire.
              </p>
            </div>
            <span className="rounded-full bg-[#f8e4d7] px-4 py-2 text-sm font-bold text-[#9a441f]">
              {inscriptions.length} en attente
            </span>
          </div>

          {chargement ? (
            <p className="py-6 text-center text-[#735133]">Chargement des profils…</p>
          ) : inscriptions.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#d7b98d] px-5 py-8 text-center text-[#56493e]">
              Aucun profil ne demande de validation.
            </div>
          ) : (
            <div className="space-y-3">
              {inscriptions.map((inscription) => {
                const enCours = actionInscriptionId === inscription.id;
                const nom = [inscription.prenom, inscription.nom].filter(Boolean).join(" ") || inscription.email;
                return (
                  <article key={inscription.id} className="flex flex-col gap-4 rounded-2xl border border-[#e4d2b3] bg-white p-5 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <h3 className="titre-element">{nom}</h3>
                      <p className="mt-1 break-all text-sm text-[#735133]">{inscription.email}</p>
                      <p className="mt-2 text-sm text-[#56493e]">
                        {[inscription.profil?.titre, inscription.profil?.ville, inscription.profil?.pays].filter(Boolean).join(" · ") || "Informations professionnelles à compléter"}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-[#0d6738]">
                        {inscription.profil?._count.formations || 0} formation(s) · {inscription.profil?._count.experiences || 0} expérience(s)
                        {inscription.profil?.estVolontaire ? " · mentor volontaire" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:shrink-0">
                      <button type="button" disabled={enCours || !inscription.emailVerifie || !inscription.profil?.onboardingFini} onClick={() => void traiterInscription(inscription, "valider")} className="rounded-xl bg-[#0d6738] px-5 py-3 text-sm font-bold text-white hover:bg-[#09572f] disabled:cursor-not-allowed disabled:opacity-50">
                        Valider
                      </button>
                      <button type="button" disabled={enCours} onClick={() => void traiterInscription(inscription, "refuser")} className="rounded-xl border border-[#dfc9a8] px-5 py-3 text-sm font-bold text-[#735133] hover:bg-[#f6efe3] disabled:opacity-50">
                        Refuser
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>}

        {aPermission(compte, "CATALOGUE_GERER") && <section className="rounded-[22px] border border-[#e4d2b3] bg-[#fffbf5] p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="titre-section">
                Données éducatives à valider
              </h2>
              <p className="mt-2 text-sm text-[#56493e] sm:text-base">
                Une alerte apparaît quand au moins deux membres distincts proposent la même donnée.
              </p>
            </div>
            <span className="rounded-full bg-[#0d6738] px-4 py-2 text-sm font-bold text-white">
              {notifications.length} en attente
            </span>
          </div>

          {chargement ? (
            <p className="py-8 text-center text-[#735133]">Chargement des propositions…</p>
          ) : notifications.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#d7b98d] px-5 py-10 text-center text-[#56493e]">
              Aucune proposition ne demande de validation pour le moment.
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => {
                const suggestion = notification.suggestion;
                const variantes = Array.from(new Set(suggestion.contributions.map((item) => item.libelleBrut)));
                const enCours = actionId === notification.id;
                return (
                  <article key={notification.id} className="rounded-[18px] border border-[#e4d2b3] bg-white p-5 sm:p-6">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-[7px] bg-[#f8e4d7] px-3 py-1 text-xs font-bold uppercase text-[#9a441f]">
                            {TYPE_LABEL[suggestion.type] || suggestion.type}
                          </span>
                          <span className="rounded-[7px] bg-[#e1f1e6] px-3 py-1 text-xs font-bold text-[#0d6738]">
                            {suggestion.nombreContributeurs} contributeurs
                          </span>
                        </div>
                        <h3 className="titre-element break-words [overflow-wrap:anywhere]">
                          {suggestion.libelleBrut}
                        </h3>
                        <p className="mt-1 text-sm text-[#56493e]">
                          {suggestion.paysCode}{suggestion.ville ? ` · ${suggestion.ville}` : ""}
                        </p>
                        {variantes.length > 1 && (
                          <p className="mt-3 text-sm text-[#56493e]">
                            Variantes proposées : {variantes.join(" · ")}
                          </p>
                        )}
                        {suggestion.candidat && (
                          <div className="mt-4 rounded-xl border border-[#dfc9a8] bg-[#f6efe3] p-4 text-sm text-[#2e261f]">
                            Correspondance possible : <strong>{suggestion.candidat.libelle}</strong>
                            {typeof suggestion.scoreDeterministe === "number"
                              ? ` · similarité ${Math.round(suggestion.scoreDeterministe * 100)} %`
                              : ""}
                          </div>
                        )}
                        {suggestion.decisionIA && (
                          <div className="mt-4 rounded-xl border border-[#cfe0d2] bg-[#f1f7f2] p-4 text-sm text-[#2e261f]">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong>Analyse IA : {suggestion.decisionIA.decision || "REVIEW"}</strong>
                              {typeof suggestion.decisionIA.confidence === "number" && (
                                <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-[#0d6738]">
                                  {Math.round(suggestion.decisionIA.confidence * 100)} % de confiance
                                </span>
                              )}
                            </div>
                            {suggestion.decisionIA.raison && (
                              <p className="mt-2 text-[#56493e]">{suggestion.decisionIA.raison}</p>
                            )}
                            {Boolean(suggestion.decisionIA.facteursConcordance?.length) && (
                              <p className="mt-2 text-[#0d6738]">
                                Concordances : {suggestion.decisionIA.facteursConcordance?.join(" · ")}
                              </p>
                            )}
                            {Boolean(suggestion.decisionIA.facteursDivergence?.length) && (
                              <p className="mt-2 text-[#9a441f]">
                                Points de vigilance : {suggestion.decisionIA.facteursDivergence?.join(" · ")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex w-full flex-col gap-2 lg:w-[300px] lg:shrink-0">
                        {suggestion.candidat && (
                          <button
                            type="button"
                            disabled={enCours}
                            onClick={() => void traiter(notification, "accepter", suggestion.candidat?.id)}
                            className="rounded-xl border border-[#0d6738] bg-[#e1f1e6] px-4 py-3 text-sm font-bold text-[#0d6738] hover:bg-[#d3e9da] disabled:opacity-60"
                          >
                            Fusionner avec « {suggestion.candidat.libelle} »
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => void traiter(notification, "accepter")}
                          className="rounded-xl bg-[#0d6738] px-4 py-3 text-sm font-bold text-white hover:bg-[#09572f] disabled:opacity-60"
                        >
                          {enCours ? "Traitement…" : "Accepter comme nouvelle donnée"}
                        </button>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => void traiter(notification, "refuser")}
                          className="rounded-xl border border-[#dfc9a8] px-4 py-3 text-sm font-bold text-[#735133] hover:bg-[#f6efe3] disabled:opacity-60"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>}
        {aPermission(compte, "SIGNALEMENTS_CONSULTER") && <Link href="/admin/signalements" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 text-[#2e261f] transition hover:border-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">
          <span><strong className="titre-element block">Signalements</strong><span className="mt-1 block text-sm text-[#695c4b]">{chargement ? "Chargement…" : `${signalements.length} signalement${signalements.length > 1 ? "s" : ""} en attente d’examen.`} Prendre en charge, traiter ou rejeter les contenus signalés.</span></span><span className="font-semibold text-[#0d6738]">Examiner les signalements →</span>
        </Link>}
      </div>
    </main>
  );
}

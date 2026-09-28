"use client";

import { CalendarClock, Check, ExternalLink, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Chargement,
  ErreurChargement,
  EtatVide,
  MessageAction,
} from "@/components/community/CommunityUi";
import { useSocket } from "@/hooks/useSocket";
import api from "@/lib/api";
import { formaterDateEvenement, formaterHeureEvenement } from "@/lib/evenements";
import {
  classeStatut,
  formaterDate,
  messageErreur,
  type PaginationApi,
} from "@/lib/community";

type ProfilResume = {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  nomComplet?: string;
  titre?: string | null;
  ville?: string | null;
  pays?: string | null;
};
type RendezVous = {
  id: string;
  debut: string;
  fin: string;
  motif: string;
  statut: "EN_ATTENTE" | "ACCEPTE" | "REFUSE" | "ANNULE";
  lienAppel?: string | null;
  role: "MENTOR" | "DEMANDEUR";
  peutAnnuler: boolean;
  peutRepondre: boolean;
  volontaire: {
    id: string;
    specialite: string;
    format?: string | null;
    profil: ProfilResume;
  };
  demandeur: ProfilResume;
};
type AgendaResponse = { rendezVous: RendezVous[]; meta: PaginationApi };
type EvenementAgenda = {
  id: string;
  fuseauHoraire?: string | null;
  titre: string;
  type: string;
  lieu?: string | null;
  lienVideo?: string | null;
  dateDebut: string;
  dateFin?: string | null;
  estInscrit: boolean;
  estProprietaire: boolean;
};
type EvenementsAgendaResponse = {
  evenements: EvenementAgenda[];
  meta: PaginationApi;
};
type RoleFiltre = "tous" | "demandeur" | "volontaire";
type Periode = "a_venir" | "passes";

const statuts: Record<RendezVous["statut"], string> = {
  EN_ATTENTE: "En attente",
  ACCEPTE: "Confirmé",
  REFUSE: "Refusé",
  ANNULE: "Annulé",
};

export default function AgendaPage() {
  const [role, setRole] = useState<RoleFiltre>("tous");
  const [periode, setPeriode] = useState<Periode>("a_venir");
  const [donnees, setDonnees] = useState<AgendaResponse | null>(null);
  const [evenements, setEvenements] = useState<EvenementAgenda[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [actionId, setActionId] = useState("");
  const [retour, setRetour] = useState<{
    texte: string;
    erreur?: boolean;
  } | null>(null);
  const socket = useSocket();

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const [rendezVous, rencontres] = await Promise.all([
        api.get<AgendaResponse>("/volontaires/agenda/me", {
          params: { role, periode, page: 1, limite: 50 },
        }),
        api.get<EvenementsAgendaResponse>("/evenements", {
          params: {
            periode,
            participation: "mes-evenements",
            page: 1,
            limite: 50,
          },
        }),
      ]);
      setDonnees(rendezVous.data);
      setEvenements(rencontres.data.evenements || []);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible de charger votre agenda."));
    } finally {
      setChargement(false);
    }
  }, [periode, role]);
  useEffect(() => void charger(), [charger]);
  useEffect(() => {
    if (!socket) return;
    const actualiser = () => void charger();
    socket.on("rendez_vous_modifie", actualiser);
    socket.on("rendez-vous:updated", actualiser);
    socket.on("evenement_modifie", actualiser);
    return () => {
      socket.off("rendez_vous_modifie", actualiser);
      socket.off("rendez-vous:updated", actualiser);
      socket.off("evenement_modifie", actualiser);
    };
  }, [charger, socket]);

  async function repondre(item: RendezVous, statut: "ACCEPTE" | "REFUSE") {
    setActionId(item.id);
    setRetour(null);
    try {
      await api.patch(`/volontaires/agenda/${item.id}/statut`, { statut });
      setRetour({
        texte:
          statut === "ACCEPTE"
            ? "Le rendez-vous est confirmé."
            : "Le rendez-vous a été refusé.",
      });
      await charger();
    } catch (error) {
      setRetour({
        texte: messageErreur(
          error,
          "Le rendez-vous n’a pas pu être mis à jour.",
        ),
        erreur: true,
      });
    } finally {
      setActionId("");
    }
  }

  async function annuler(item: RendezVous) {
    setActionId(item.id);
    setRetour(null);
    try {
      await api.delete(`/volontaires/agenda/${item.id}`);
      setRetour({ texte: "Le rendez-vous a été annulé." });
      await charger();
    } catch (error) {
      setRetour({
        texte: messageErreur(error, "Le rendez-vous n’a pas pu être annulé."),
        erreur: true,
      });
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl [overflow-wrap:anywhere] space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-terre">Mon agenda</h1>
          <p className="mt-1 text-sm text-terre-300">
            Vos rendez-vous de mentorat et événements, au même endroit.
          </p>
        </div>
        <Link href="/volontaires" className="btn-primary text-sm">
          Trouver un volontaire
        </Link>
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex gap-1 rounded-lg bg-sable-50 p-1"
          role="tablist"
          aria-label="Période"
        >
          {(
            [
              ["a_venir", "À venir"],
              ["passes", "Passés"],
            ] as const
          ).map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              role="tab"
              aria-selected={periode === valeur}
              onClick={() => setPeriode(valeur)}
              className={`rounded-md px-4 py-2 text-sm font-medium ${periode === valeur ? "bg-white text-vert shadow-sm" : "text-terre-300"}`}
            >
              {libelle}
            </button>
          ))}
        </div>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as RoleFiltre)}
          aria-label="Filtrer selon mon rôle"
          className="rounded-lg border border-sable-200 px-3 py-2 text-sm"
        >
          <option value="tous">Tous mes rendez-vous</option>
          <option value="demandeur">Mes demandes</option>
          <option value="volontaire">Mes mentorats</option>
        </select>
      </div>
      {retour ? (
        <MessageAction message={retour.texte} erreur={retour.erreur} />
      ) : null}
      {chargement ? (
        <Chargement texte="Chargement de l’agenda…" />
      ) : erreur ? (
        <ErreurChargement message={erreur} reessayer={charger} />
      ) : !donnees?.rendezVous.length && !evenements.length ? (
        <EtatVide>
          {periode === "a_venir"
            ? "Aucun rendez-vous ni événement à venir."
            : "Aucun rendez-vous ni événement passé."}
        </EtatVide>
      ) : (
        <div className="space-y-8">
          {donnees?.rendezVous.length ? (
            <section className="space-y-4">
              <h2 className="font-sans text-lg font-bold text-terre">
                Rendez-vous de mentorat
              </h2>
              {donnees.rendezVous.map((item) => {
                const personne =
                  item.role === "MENTOR"
                    ? item.demandeur
                    : item.volontaire.profil;
                const nom =
                  personne.nomComplet ||
                  `${personne.prenom || ""} ${personne.nom || ""}`.trim() ||
                  "Membre Mali Wuli";
                return (
                  <article key={item.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-vert-50 text-vert">
                          <UserRound className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-terre-300">
                            {item.role === "MENTOR"
                              ? "Vous accompagnez"
                              : "Votre volontaire"}
                          </p>
                          <h2 className="font-sans text-lg font-bold text-terre">
                            {nom}
                          </h2>
                          <p className="text-sm text-terre-300">
                            {item.role === "MENTOR"
                              ? personne.titre || "Membre du réseau"
                              : item.volontaire.specialite}
                          </p>
                        </div>
                      </div>
                      <span className={classeStatut(item.statut)}>
                        {statuts[item.statut]}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 rounded-lg bg-sable-50 p-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                      <p className="flex items-center gap-2 text-sm font-medium text-terre">
                        <CalendarClock
                          className="h-4 w-4 text-vert"
                          aria-hidden="true"
                        />{" "}
                        {formaterDate(item.debut)}
                      </p>
                      <p className="text-sm text-terre">
                        <span className="font-medium">Sujet :</span>{" "}
                        {item.motif}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      {item.lienAppel && item.statut === "ACCEPTE" ? (
                        <a
                          href={item.lienAppel}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary inline-flex items-center gap-2 text-sm"
                        >
                          Rejoindre l’appel{" "}
                          <ExternalLink
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </a>
                      ) : null}
                      {item.peutRepondre ? (
                        <>
                          <button
                            disabled={actionId === item.id}
                            onClick={() => void repondre(item, "REFUSE")}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-sable-200 px-4 py-2 text-sm font-medium text-terre hover:bg-sable-50 disabled:opacity-50"
                          >
                            <X className="h-4 w-4" aria-hidden="true" /> Refuser
                          </button>
                          <button
                            disabled={actionId === item.id}
                            onClick={() => void repondre(item, "ACCEPTE")}
                            type="button"
                            className="btn-primary inline-flex items-center gap-1 text-sm disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />{" "}
                            Accepter
                          </button>
                        </>
                      ) : null}
                      {item.peutAnnuler ? (
                        <button
                          disabled={actionId === item.id}
                          onClick={() => void annuler(item)}
                          type="button"
                          className="rounded-lg border border-sable-200 px-4 py-2 text-sm font-medium text-terre hover:bg-sable-50 disabled:opacity-50"
                        >
                          Annuler le rendez-vous
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}
          {evenements.length ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-sans text-lg font-bold text-terre">
                  Événements du réseau
                </h2>
                <Link
                  href="/evenements"
                  className="text-sm font-medium text-vert hover:underline"
                >
                  Tous les événements
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {evenements.map((evenement) => (
                  <article key={evenement.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <span className="badge-terre">
                        {evenement.type
                          .replaceAll("_", " ")
                          .toLocaleLowerCase("fr-FR")}
                      </span>
                      <span className="badge-vert">
                        {evenement.estProprietaire
                          ? "Vous organisez"
                          : "Inscrit"}
                      </span>
                    </div>
                    <h3 className="mt-3 font-sans text-lg font-bold text-terre">
                      {evenement.titre}
                    </h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-terre-300">
                      <CalendarClock
                        className="h-4 w-4 text-vert"
                        aria-hidden="true"
                      />
                      {formaterDateEvenement(evenement.dateDebut, evenement.fuseauHoraire)} · {formaterHeureEvenement(evenement.dateDebut, evenement.fuseauHoraire)}
                    </p>
                    <Link href={`/evenements/${encodeURIComponent(evenement.id)}`} className="mt-3 inline-flex text-sm font-semibold text-vert hover:underline">Voir l’événement et ses photos →</Link>
                    {evenement.lieu ? (
                      <p className="mt-1 text-sm text-terre-300">
                        {evenement.lieu}
                      </p>
                    ) : null}
                    {evenement.lienVideo && periode === "a_venir" ? (
                      <a
                        href={evenement.lienVideo}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary mt-4 inline-flex items-center gap-2 text-sm"
                      >
                        Rejoindre{" "}
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

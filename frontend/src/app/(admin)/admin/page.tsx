"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

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

const TYPE_LABEL: Record<string, string> = {
  ETABLISSEMENT: "Établissement",
  PROGRAMME: "Formation",
  SPECIALITE: "Spécialité / parcours",
  SERIE: "Série",
  DIPLOME: "Diplôme",
};

export default function AdminPage() {
  const [notifications, setNotifications] = useState<NotificationCatalogue[]>([]);
  const [chargement, setChargement] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setErreur("");
    try {
      const { data } = await api.get<{ notifications: NotificationCatalogue[] }>("/admin/notifications");
      setNotifications(data.notifications);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setErreur(message || "Impossible de charger les validations en attente.");
    } finally {
      setChargement(false);
    }
  }, []);

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

  return (
    <main className="min-h-screen bg-[#f6efe3] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1180px] space-y-7">
        <header>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-[#c65327]">
            Équipe Mali Wuli
          </p>
          <h1 className="font-display text-3xl font-bold text-[#2e261f] sm:text-4xl">
            Administration
          </h1>
        </header>

        <section className="rounded-[22px] border border-[#e4d2b3] bg-[#fffbf5] p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#2e261f]">
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

          {erreur && (
            <p role="alert" className="mb-5 rounded-xl bg-[#fde8e7] px-4 py-3 text-sm font-semibold text-[#a22922]">
              {erreur}
            </p>
          )}

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
                        <h3 className="break-words text-xl font-bold text-[#2e261f] [overflow-wrap:anywhere]">
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
        </section>
      </div>
    </main>
  );
}

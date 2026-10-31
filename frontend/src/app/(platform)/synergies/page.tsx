"use client";

import { TITRE_PAR_DEFAUT } from "@/lib/titre-membre";
import { Check, Clock3, UserPlus, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Chargement,
  ErreurChargement,
  EtatVide,
  MessageAction,
} from "@/components/community/CommunityUi";
import { useSocket } from "@/hooks/useSocket";
import api from "@/lib/api";
import {
  formaterDate,
  initiales,
  messageErreur,
  nomComplet,
} from "@/lib/community";
import { urlMediaBackend } from "@/lib/media";
import ImageAvecRepli from "@/components/ui/ImageAvecRepli";

type ProfilPublic = {
  id: string;
  photo?: string | null;
  titre?: string | null;
  ville?: string | null;
  pays?: string | null;
  bio?: string | null;
  estVolontaire?: boolean;
  user: { prenom?: string | null; nom?: string | null };
  experiences?: Array<{ poste?: string | null; entreprise?: string | null }>;
};

type Synergie = { id: string; createdAt: string; autre: ProfilPublic };
type DemandeEnvoyee = {
  id: string;
  createdAt: string;
  recepteur: ProfilPublic;
};
type DemandeRecue = { id: string; createdAt: string; demandeur: ProfilPublic };
type SynergiesResponse = {
  synergies: Synergie[];
  envoyees: DemandeEnvoyee[];
  recues: DemandeRecue[];
};
type SuggestionsResponse = { suggestions: ProfilPublic[] };
type Onglet = "synergies" | "demandes" | "suggestions";

function CarteProfil({
  profil,
  children,
}: {
  profil: ProfilPublic;
  children?: ReactNode;
}) {
  const photo = urlMediaBackend(profil.photo);
  const experience = profil.experiences?.[0];
  return (
    <article className="card flex h-full flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-vert-50 font-bold text-vert">
          <ImageAvecRepli src={photo} className="h-full w-full object-cover" repli={initiales(profil.user.prenom, profil.user.nom)} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate titre-element">
            {nomComplet(profil.user.prenom, profil.user.nom)}
          </h2>
          <p className="text-sm text-terre-300">
            {profil.titre?.trim() || experience?.poste || TITRE_PAR_DEFAUT}
          </p>
          <p className="text-xs text-terre-300">
            {[profil.ville, profil.pays].filter(Boolean).join(" · ") ||
              "Localisation non renseignée"}
          </p>
        </div>
      </div>
      {profil.bio ? (
        <p className="line-clamp-2 text-sm text-terre-300">{profil.bio}</p>
      ) : null}
      {children ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-2">{children}</div>
      ) : null}
    </article>
  );
}

export default function SynergiesPage() {
  const [onglet, setOnglet] = useState<Onglet>("synergies");
  const [donnees, setDonnees] = useState<SynergiesResponse | null>(null);
  const [suggestions, setSuggestions] = useState<ProfilPublic[]>([]);
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
      const [liste, candidats] = await Promise.all([
        api.get<SynergiesResponse>("/synergies"),
        api.get<SuggestionsResponse>("/synergies/suggestions"),
      ]);
      setDonnees(liste.data);
      setSuggestions(candidats.data.suggestions || []);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible de charger vos synergies."));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => void charger(), [charger]);
  useEffect(() => {
    if (!socket) return;
    const actualiser = () => void charger();
    socket.on("synergie:created", actualiser);
    socket.on("synergie:updated", actualiser);
    socket.on("synergie:deleted", actualiser);
    socket.on("synergie_creee", actualiser);
    socket.on("synergie_mise_a_jour", actualiser);
    socket.on("synergie_supprimee", actualiser);
    return () => {
      socket.off("synergie:created", actualiser);
      socket.off("synergie:updated", actualiser);
      socket.off("synergie:deleted", actualiser);
      socket.off("synergie_creee", actualiser);
      socket.off("synergie_mise_a_jour", actualiser);
      socket.off("synergie_supprimee", actualiser);
    };
  }, [charger, socket]);

  async function agir(id: string, action: "ACCEPTE" | "REFUSE" | "SUPPRIME") {
    setActionId(id);
    setRetour(null);
    try {
      if (action === "SUPPRIME") await api.delete(`/synergies/${id}`);
      else await api.put(`/synergies/${id}`, { decision: action });
      setRetour({
        texte:
          action === "ACCEPTE"
            ? "Synergie acceptée."
            : action === "REFUSE"
              ? "Demande refusée."
              : "Synergie supprimée.",
      });
      await charger();
    } catch (error) {
      setRetour({
        texte: messageErreur(error, "Cette action n’a pas pu être effectuée."),
        erreur: true,
      });
    } finally {
      setActionId("");
    }
  }

  async function proposer(profil: ProfilPublic) {
    setActionId(profil.id);
    setRetour(null);
    try {
      await api.post("/synergies", { recepteurProfilId: profil.id });
      setRetour({
        texte: `Demande envoyée à ${nomComplet(profil.user.prenom, profil.user.nom)}.`,
      });
      await charger();
      setOnglet("demandes");
    } catch (error) {
      setRetour({
        texte: messageErreur(error, "La demande n’a pas pu être envoyée."),
        erreur: true,
      });
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Synergies</h1>
        <p className="mt-1 text-sm text-terre-300">
          Créez des liens utiles et suivez vos demandes de mise en relation.
        </p>
      </div>
      <div
        className="flex gap-2 overflow-x-auto border-b border-sable-200"
        role="tablist"
        aria-label="Rubriques des synergies"
      >
        {(
          [
            ["synergies", "Mes synergies"],
            [
              "demandes",
              `Demandes${donnees?.recues.length ? ` (${donnees.recues.length})` : ""}`,
            ],
            ["suggestions", "Suggestions"],
          ] as const
        ).map(([valeur, libelle]) => (
          <button
            key={valeur}
            type="button"
            role="tab"
            aria-selected={onglet === valeur}
            onClick={() => setOnglet(valeur)}
            className={`whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-medium transition-colors ${onglet === valeur ? "border-vert text-vert" : "border-transparent text-terre-300 hover:text-terre"}`}
          >
            {libelle}
          </button>
        ))}
      </div>
      {retour ? (
        <MessageAction message={retour.texte} erreur={retour.erreur} />
      ) : null}
      {chargement ? (
        <Chargement texte="Chargement des synergies…" />
      ) : erreur ? (
        <ErreurChargement message={erreur} reessayer={charger} />
      ) : onglet === "synergies" ? (
        !donnees?.synergies.length ? (
          <EtatVide>Aucune synergie acceptée pour le moment.</EtatVide>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {donnees.synergies.map((item) => (
              <CarteProfil key={item.id} profil={item.autre}>
                <span className="flex flex-1 items-center text-xs text-terre-300">
                  <UsersRound
                    className="mr-1 h-4 w-4 text-vert"
                    aria-hidden="true"
                  />{" "}
                  Depuis le{" "}
                  {formaterDate(item.createdAt, { dateStyle: "medium" })}
                </span>
                <button
                  disabled={actionId === item.id}
                  onClick={() => void agir(item.id, "SUPPRIME")}
                  type="button"
                  className="rounded-lg border border-sable-200 px-3 py-2 text-xs font-medium text-terre hover:bg-sable-50 disabled:opacity-50"
                >
                  Retirer
                </button>
              </CarteProfil>
            ))}
          </div>
        )
      ) : onglet === "demandes" ? (
        !(donnees?.recues.length || donnees?.envoyees.length) ? (
          <EtatVide>Aucune demande en attente.</EtatVide>
        ) : (
          <div className="space-y-6">
            {donnees?.recues.length ? (
              <section>
                <h2 className="mb-3 titre-section">
                  Demandes reçues
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {donnees.recues.map((item) => (
                    <CarteProfil key={item.id} profil={item.demandeur}>
                      <button
                        disabled={actionId === item.id}
                        onClick={() => void agir(item.id, "ACCEPTE")}
                        type="button"
                        className="btn-primary flex flex-1 items-center justify-center gap-1 text-sm disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />{" "}
                        Accepter
                      </button>
                      <button
                        disabled={actionId === item.id}
                        onClick={() => void agir(item.id, "REFUSE")}
                        type="button"
                        className="rounded-lg border border-sable-200 px-3 py-2 text-sm font-medium text-terre hover:bg-sable-50 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </CarteProfil>
                  ))}
                </div>
              </section>
            ) : null}
            {donnees?.envoyees.length ? (
              <section>
                <h2 className="mb-3 titre-section">
                  Demandes envoyées
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {donnees.envoyees.map((item) => (
                    <CarteProfil key={item.id} profil={item.recepteur}>
                      <span className="flex flex-1 items-center gap-1 text-xs text-terre-300">
                        <Clock3 className="h-4 w-4" aria-hidden="true" /> En
                        attente
                      </span>
                      <button
                        disabled={actionId === item.id}
                        onClick={() => void agir(item.id, "SUPPRIME")}
                        type="button"
                        className="rounded-lg border border-sable-200 px-3 py-2 text-xs font-medium text-terre hover:bg-sable-50 disabled:opacity-50"
                      >
                        Annuler
                      </button>
                    </CarteProfil>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )
      ) : !suggestions.length ? (
        <EtatVide>Aucune nouvelle suggestion pour le moment.</EtatVide>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((profil) => (
            <CarteProfil key={profil.id} profil={profil}>
              <button
                disabled={actionId === profil.id}
                onClick={() => void proposer(profil)}
                type="button"
                className="btn-primary flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />{" "}
                {actionId === profil.id ? "Envoi…" : "Proposer une synergie"}
              </button>
            </CarteProfil>
          ))}
        </div>
      )}
    </div>
  );
}

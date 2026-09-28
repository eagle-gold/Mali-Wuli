"use client";

import { CalendarPlus, Clock3, MapPin, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Chargement,
  ErreurChargement,
  EtatVide,
  MessageAction,
  Modal,
} from "@/components/community/CommunityUi";
import api from "@/lib/api";
import { useCountries } from "@/hooks/useCountries";
import {
  formaterDate,
  initiales,
  messageErreur,
  type PaginationApi,
} from "@/lib/community";
import { urlMediaBackend } from "@/lib/media";

type ProfilVolontaire = {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  nomComplet?: string;
  photo?: string | null;
  titre?: string | null;
  pays?: string | null;
  ville?: string | null;
};
type Volontaire = {
  id: string;
  profilId: string;
  specialite: string;
  sujets?: unknown;
  disponible: boolean;
  fuseau: string;
  dureeCreneau: number;
  format?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  maxRdvMois?: number | null;
  delaiMinResa: number;
  profil: ProfilVolontaire;
};
type VolontairesResponse = { volontaires: Volontaire[]; meta: PaginationApi };
type Creneau = { debut: string; fin: string };
type CreneauxResponse = {
  creneaux: Creneau[];
  fuseau: string;
  dureeCreneau: number;
};

function sujetsDuVolontaire(sujets: unknown) {
  return Array.isArray(sujets)
    ? sujets.filter((item): item is string => typeof item === "string")
    : [];
}

export default function VolontairesPage() {
  const [donnees, setDonnees] = useState<VolontairesResponse | null>(null);
  const [recherche, setRecherche] = useState("");
  const [sujet, setSujet] = useState("");
  const [format, setFormat] = useState("");
  const [pays, setPays] = useState("");
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [selection, setSelection] = useState<Volontaire | null>(null);
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [creneauxChargement, setCreneauxChargement] = useState(false);
  const [creneau, setCreneau] = useState("");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<{
    texte: string;
    erreur?: boolean;
  } | null>(null);
  const paysDisponibles = useCountries();

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const response = await api.get<VolontairesResponse>("/volontaires", {
        params: {
          q: recherche.trim() || undefined,
          sujet: sujet || undefined,
          format: format || undefined,
          pays: pays || undefined,
          page,
          limite: 18,
        },
      });
      setDonnees(response.data);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible de charger les volontaires."));
    } finally {
      setChargement(false);
    }
  }, [format, page, pays, recherche, sujet]);
  useEffect(() => {
    const minuteur = window.setTimeout(() => void charger(), 250);
    return () => window.clearTimeout(minuteur);
  }, [charger]);

  const sujets = useMemo(
    () =>
      [
        ...new Set(
          (donnees?.volontaires || []).flatMap((item) =>
            sujetsDuVolontaire(item.sujets),
          ),
        ),
      ].sort(),
    [donnees],
  );

  async function ouvrirReservation(volontaire: Volontaire) {
    setSelection(volontaire);
    setCreneaux([]);
    setCreneau("");
    setMotif("");
    setRetour(null);
    setCreneauxChargement(true);
    try {
      const response = await api.get<CreneauxResponse>(
        `/volontaires/${volontaire.id}/creneaux`,
        { params: { jours: 30 } },
      );
      setCreneaux(response.data.creneaux || []);
    } catch (error) {
      setRetour({
        texte: messageErreur(error, "Impossible de charger les créneaux."),
        erreur: true,
      });
    } finally {
      setCreneauxChargement(false);
    }
  }

  async function reserver(event: FormEvent) {
    event.preventDefault();
    if (!selection || !creneau) return;
    setEnvoi(true);
    setRetour(null);
    try {
      await api.post(`/volontaires/${selection.id}/reserver`, {
        debut: creneau,
        motif: motif.trim(),
      });
      const nom =
        selection.profil.nomComplet ||
        `${selection.profil.prenom || ""} ${selection.profil.nom || ""}`.trim();
      setSelection(null);
      setRetour({
        texte: `Votre demande de rendez-vous avec ${nom || "ce volontaire"} a été envoyée.`,
      });
    } catch (error) {
      setRetour({
        texte: messageErreur(error, "Le rendez-vous n’a pas pu être réservé."),
        erreur: true,
      });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl [overflow-wrap:anywhere] space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-terre">Volontaires</h1>
          <p className="mt-1 text-sm text-terre-300">
            Trouvez un membre disponible pour vous écouter et vous accompagner.
          </p>
        </div>
        <Link href="/onboarding?etape=mentorat" className="btn-primary text-sm">
          Devenir volontaire
        </Link>
      </div>
      <div className="card flex flex-wrap gap-3">
        <label className="relative min-w-0 basis-full sm:basis-[220px] flex-1">
          <span className="sr-only">Rechercher un volontaire</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-terre-300"
            aria-hidden="true"
          />
          <input
            value={recherche}
            onChange={(event) => {
              setRecherche(event.target.value);
              setPage(1);
            }}
            type="search"
            placeholder="Nom, spécialité, ville…"
            className="w-full rounded-lg border border-sable-200 py-2 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={sujet}
          onChange={(event) => {
            setSujet(event.target.value);
            setPage(1);
          }}
          aria-label="Sujet de mentorat"
          className="w-full min-w-0 max-w-full rounded-lg border border-sable-200 px-3 py-2 text-sm sm:w-auto"
        >
          <option value="">Tous les sujets</option>
          {sujet && !sujets.includes(sujet) ? (
            <option value={sujet}>{sujet}</option>
          ) : null}
          {sujets.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={format}
          onChange={(event) => {
            setFormat(event.target.value);
            setPage(1);
          }}
          aria-label="Format du rendez-vous"
          className="w-full min-w-0 max-w-full rounded-lg border border-sable-200 px-3 py-2 text-sm sm:w-auto"
        >
          <option value="">Tous les formats</option>
          <option value="Visio">Visio</option>
          <option value="Téléphone">Téléphone</option>
          <option value="Sur place">Sur place</option>
        </select>
        <select
          value={pays}
          onChange={(event) => {
            setPays(event.target.value);
            setPage(1);
          }}
          aria-label="Pays"
          className="w-full min-w-0 max-w-full rounded-lg border border-sable-200 px-3 py-2 text-sm sm:w-auto"
        >
          <option value="">Tous les pays</option>
          {pays && !paysDisponibles.some((item) => item.nom === pays) ? (
            <option value={pays}>{pays}</option>
          ) : null}
          {paysDisponibles.map((item) => (
            <option key={item.code} value={item.nom}>
              {item.drapeau ? `${item.drapeau} ` : ""}
              {item.nom}
            </option>
          ))}
        </select>
      </div>
      {retour && !selection ? (
        <MessageAction message={retour.texte} erreur={retour.erreur} />
      ) : null}
      {chargement ? (
        <Chargement texte="Chargement des volontaires…" />
      ) : erreur ? (
        <ErreurChargement message={erreur} reessayer={charger} />
      ) : !donnees?.volontaires.length ? (
        <EtatVide>Aucun volontaire disponible pour ces critères.</EtatVide>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {donnees.volontaires.map((item) => {
              const photo = urlMediaBackend(item.profil.photo);
              const noms =
                item.profil.nomComplet ||
                `${item.profil.prenom || ""} ${item.profil.nom || ""}`.trim();
              const themes = sujetsDuVolontaire(item.sujets);
              return (
                <article key={item.id} className="card flex min-h-64 flex-col">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-vert-50 font-bold text-vert">
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initiales(item.profil.prenom, item.profil.nom)
                      )}
                    </div>
                    <div>
                      <h2 className="font-sans text-base font-bold text-terre">
                        {noms || "Volontaire Mali Wuli"}
                      </h2>
                      <p className="text-sm text-terre-300">
                        {item.profil.titre || item.specialite}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-terre-300">
                        <MapPin className="h-3 w-3" aria-hidden="true" />{" "}
                        {[item.profil.ville, item.profil.pays]
                          .filter(Boolean)
                          .join(" · ") || "À distance"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {themes.slice(0, 4).map((theme) => (
                      <span key={theme} className="badge-terre">
                        {theme}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto space-y-2 pt-4 text-xs text-terre-300">
                    <p className="flex items-center gap-1">
                      <UserRound
                        className="h-4 w-4 text-vert"
                        aria-hidden="true"
                      />{" "}
                      {item.specialite}
                    </p>
                    <p className="flex items-center gap-1">
                      <Clock3
                        className="h-4 w-4 text-vert"
                        aria-hidden="true"
                      />{" "}
                      {item.dureeCreneau} min ·{" "}
                      {(item.format || "Format à confirmer")
                        .replaceAll("_", " ")
                        .toLocaleLowerCase("fr-FR")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void ouvrirReservation(item)}
                    className="btn-primary mt-4 flex w-full items-center justify-center gap-2 text-sm"
                  >
                    <CalendarPlus className="h-4 w-4" aria-hidden="true" />{" "}
                    Prendre rendez-vous
                  </button>
                </article>
              );
            })}
          </div>
          {donnees.meta.totalPages > 1 ? (
            <nav
              aria-label="Pagination des volontaires"
              className="flex justify-center gap-3"
            >
              <button
                disabled={page <= 1}
                onClick={() => setPage((valeur) => Math.max(1, valeur - 1))}
                type="button"
                className="rounded-lg border border-sable-200 bg-white px-4 py-2 text-sm font-medium text-terre disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                disabled={page >= donnees.meta.totalPages}
                onClick={() => setPage((valeur) => valeur + 1)}
                type="button"
                className="rounded-lg border border-sable-200 bg-white px-4 py-2 text-sm font-medium text-terre disabled:opacity-40"
              >
                Suivant
              </button>
            </nav>
          ) : null}
        </>
      )}
      {selection ? (
        <Modal
          titre={`Rendez-vous avec ${selection.profil.nomComplet || selection.profil.prenom || "un volontaire"}`}
          fermer={() => setSelection(null)}
        >
          {creneauxChargement ? (
            <Chargement texte="Recherche des créneaux…" />
          ) : (
            <form
              onSubmit={(event) => void reserver(event)}
              className="space-y-4"
            >
              {retour ? (
                <MessageAction message={retour.texte} erreur={retour.erreur} />
              ) : null}
              {!creneaux.length ? (
                <EtatVide>
                  Aucun créneau libre dans les 30 prochains jours.
                </EtatVide>
              ) : (
                <label className="block text-sm font-medium text-terre">
                  Choisissez un créneau
                  <select
                    required
                    value={creneau}
                    onChange={(event) => setCreneau(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-sable-200 px-3 py-2"
                  >
                    <option value="">Sélectionner une date et une heure</option>
                    {creneaux.map((item) => (
                      <option key={item.debut} value={item.debut}>
                        {formaterDate(item.debut)} — {selection.fuseau}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm font-medium text-terre">
                Quel est le sujet du rendez-vous ?
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  value={motif}
                  onChange={(event) => setMotif(event.target.value)}
                  placeholder="Expliquez brièvement votre besoin…"
                  className="mt-2 w-full resize-none rounded-lg border border-sable-200 px-3 py-2 outline-none focus:border-vert focus:ring-2 focus:ring-vert-100"
                />
              </label>
              <button
                disabled={envoi || !creneaux.length}
                type="submit"
                className="btn-primary w-full disabled:opacity-50"
              >
                {envoi ? "Réservation…" : "Demander ce rendez-vous"}
              </button>
            </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

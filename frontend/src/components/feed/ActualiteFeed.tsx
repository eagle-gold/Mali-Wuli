"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Flag,
  Globe2,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

import ComposerPublication from "@/components/feed/ComposerPublication";
import { titreMembre } from "@/lib/titre-membre";
import { useSocket } from "@/hooks/useSocket";
import api from "@/lib/api";
import type { ResultatSuppression } from "@/components/community/SupprimerContenu";
import SignalerContenu from "@/components/community/SignalerContenu";
import { MESSAGE_CORBEILLE, restaurerDepuisCorbeille } from "@/lib/moderation";
import { urlMediaBackend } from "@/lib/media";
import type {
  CommentairePublicationApi,
  CommentairesPublicationResponseApi,
  PublicationApi,
  PublicationsResponseApi,
  PublicationScope,
  ReactionPublication,
  ReactionsPublicationResponseApi,
  ReactionPublicationResponseApi,
  SupporterPublicationApi,
  SupportersPublicationResponseApi,
} from "@/types/api";

type FiltreFil = PublicationScope;
type TypePublication = "Offre" | "Demande";

type Publication = {
  id: string;
  peutSupprimer: boolean;
  peutModifier: boolean;
  /** Une publication avec photo ou lien peut garder un texte vide (règle serveur). */
  aMedia: boolean;
  auteur: string;
  initiales: string;
  fonction: string;
  lieu: string;
  date: string;
  type: TypePublication;
  thematique?: string;
  texte: string;
  soutiens: number;
  reponses: number;
  maReaction: ReactionPublication | null;
  photo?: string | null;
  /** Image jointe à la publication (distincte de la photo de l’auteur). */
  image?: string | null;
  commentaires?: CommentairePublicationApi[];
  couleurAvatar?: "vert" | "orange" | "sable";
};

type ReponsePublicationApi = PublicationApi | { publication: PublicationApi };
/** Champs renvoyés par l’API mais pas encore déclarés dans les types partagés. */
type PublicationAvecDroits = PublicationApi & { peutModifier?: boolean; lienUrl?: string | null };
type CommentaireAvecDroits = CommentairePublicationApi & { peutModifier?: boolean };
type ReponseCommentaireApi =
  | CommentairePublicationApi
  | { commentaire: CommentairePublicationApi };

type ProfilConnecteFil = {
  id: string;
  photo?: string | null;
  titre?: string | null;
  ville?: string | null;
  pays?: string | null;
  stats?: {
    nbSynergies?: number;
    nbRdvAcceptes?: number;
    nbContributions?: number;
  };
};

type UtilisateurConnecteFil = {
  prenom?: string | null;
  nom?: string | null;
  profil: ProfilConnecteFil;
};

type EvenementFil = {
  id: string;
  fuseauHoraire?: string | null;
  titre: string;
  lieu?: string | null;
  lienVideo?: string | null;
  dateDebut: string;
};

type SuggestionFil = {
  id: string;
  photo?: string | null;
  titre?: string | null;
  ville?: string | null;
  pays?: string | null;
  user: { prenom?: string | null; nom?: string | null };
};

type PanneauxFil = {
  utilisateur: UtilisateurConnecteFil | null;
  evenements: EvenementFil[];
  suggestions: SuggestionFil[];
};

type EvenementsFilResponse = { evenements: EvenementFil[] };
type SuggestionsFilResponse = { suggestions: SuggestionFil[] };

function lireMessageErreur(erreur: unknown, messageParDefaut: string) {
  const erreurApi = erreur as {
    response?: { data?: { message?: string; error?: string } };
    code?: string;
  };
  return (
    erreurApi.response?.data?.message ||
    erreurApi.response?.data?.error ||
    messageParDefaut
  );
}

function estRequeteAnnulee(erreur: unknown) {
  return (erreur as { code?: string }).code === "ERR_CANCELED";
}

function initialesDe(prenom?: string | null, nom?: string | null) {
  const initiales = [prenom, nom]
    .filter(Boolean)
    .map((partie) => partie!.trim().charAt(0).toUpperCase())
    .join("");
  return initiales || "MW";
}

function dateRelative(dateBrute: string) {
  const date = new Date(dateBrute);
  if (Number.isNaN(date.getTime())) return "récemment";

  const secondes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1_000),
  );
  if (secondes < 60) return "à l’instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} ${jours > 1 ? "jours" : "jour"}`;
}

function dateEvenement(dateBrute: string, fuseauHoraire?: string | null) {
  const date = new Date(dateBrute);
  if (Number.isNaN(date.getTime()))
    return { mois: "", jour: "", detail: "Date à préciser" };
  return {
    mois: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: fuseauHoraire || "Africa/Bamako" })
      .format(date)
      .replace(".", "")
      .toUpperCase(),
    jour: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", timeZone: fuseauHoraire || "Africa/Bamako" }).format(date),
    detail: new Intl.DateTimeFormat("fr-FR", {
      timeZone: fuseauHoraire || "Africa/Bamako",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  };
}

function couleurDepuisInitiales(
  initiales: string,
): "vert" | "orange" | "sable" {
  const couleurs = ["vert", "orange", "sable"] as const;
  const somme = [...initiales].reduce(
    (total, lettre) => total + lettre.charCodeAt(0),
    0,
  );
  return couleurs[somme % couleurs.length];
}

function adapterPublication(publication: PublicationApi): Publication {
  const prenom = publication.auteur?.user?.prenom?.trim() || "";
  const nom = publication.auteur?.user?.nom?.trim() || "";
  const auteur = [prenom, nom].filter(Boolean).join(" ") || "Membre Mali Wuli";
  const initiales = initialesDe(prenom, nom);

  return {
    id: publication.id,
    peutSupprimer: publication.peutSupprimer === true,
    peutModifier: (publication as PublicationAvecDroits).peutModifier === true,
    aMedia: Boolean(publication.photoUrl || (publication as PublicationAvecDroits).lienUrl),
    auteur,
    initiales,
    fonction: titreMembre(publication.auteur?.titre),
    lieu:
      publication.auteur?.ville?.trim() ||
      publication.auteur?.pays?.trim() ||
      "Mali Wuli",
    date: dateRelative(publication.createdAt),
    type: publication.intention === "OFFRE" ? "Offre" : "Demande",
    thematique: publication.thematique,
    texte: publication.contenu,
    soutiens:
      publication.decompteReactions?.SOUTIEN ?? publication.nbReactions ?? 0,
    reponses: publication.nbCommentaires ?? 0,
    maReaction: publication.maReaction ?? null,
    photo: urlMediaBackend(publication.auteur?.photo),
    image: urlMediaBackend(publication.photoUrl),
    commentaires: publication.commentaires,
    couleurAvatar: couleurDepuisInitiales(initiales),
  };
}

function extraireListePublications(
  reponse: PublicationsResponseApi | PublicationApi[],
): PublicationApi[] {
  return Array.isArray(reponse) ? reponse : reponse.publications;
}

function extrairePublication(reponse: ReponsePublicationApi) {
  return "publication" in reponse ? reponse.publication : reponse;
}

function extraireCommentaires(
  reponse: CommentairesPublicationResponseApi | CommentairePublicationApi[],
) {
  return Array.isArray(reponse) ? reponse : reponse.commentaires;
}

function extraireCommentaire(reponse: ReponseCommentaireApi) {
  return "commentaire" in reponse ? reponse.commentaire : reponse;
}

function compterCommentaires(commentaires: CommentairePublicationApi[]): number {
  return commentaires.reduce(
    (total, commentaire) =>
      total + 1 + compterCommentaires(commentaire.reponses || []),
    0,
  );
}

function remplacerContenuCommentaire(
  commentaires: CommentairePublicationApi[],
  commentaireId: string,
  contenu: string,
): CommentairePublicationApi[] {
  return commentaires.map((commentaire) => ({
    ...commentaire,
    contenu: commentaire.id === commentaireId ? contenu : commentaire.contenu,
    reponses: commentaire.reponses
      ? remplacerContenuCommentaire(commentaire.reponses, commentaireId, contenu)
      : undefined,
  }));
}

function retirerCommentaires(commentaires: CommentairePublicationApi[], retires: Set<string>): CommentairePublicationApi[] {
  return commentaires.filter((commentaire) => !retires.has(commentaire.id)).map((commentaire) => ({
    ...commentaire, reponses: commentaire.reponses ? retirerCommentaires(commentaire.reponses, retires) : undefined,
  }));
}

function ajouterCommentaireDansFil(
  commentaires: CommentairePublicationApi[],
  commentaire: CommentairePublicationApi,
  parentId?: string | null,
) {
  if (!parentId) {
    return commentaires.some((element) => element.id === commentaire.id)
      ? commentaires
      : [...commentaires, commentaire];
  }

  return commentaires.map((element) => {
    if (element.id !== parentId) return element;
    const reponses = element.reponses || [];
    return {
      ...element,
      reponses: reponses.some((reponse) => reponse.id === commentaire.id)
        ? reponses
        : [...reponses, commentaire],
    };
  });
}

function fusionnerSupporters(
  actuels: SupporterPublicationApi[],
  suivants: SupporterPublicationApi[],
) {
  const parId = new Map(actuels.map((supporter) => [supporter.id, supporter]));
  suivants.forEach((supporter) => parId.set(supporter.id, supporter));
  return Array.from(parId.values());
}

const FILTRES: Array<{ id: FiltreFil; label: string }> = [
  { id: "tout", label: "Tout" },
  { id: "pays", label: "Mon pays" },
  { id: "ville", label: "Ma ville" },
];

const COULEURS_AVATAR = {
  vert: "bg-[#e3f0e9] text-brand",
  orange: "bg-[#f7e5d8] text-[#bd5c2c]",
  sable: "bg-[#efe3d0] text-[#6f5237]",
};

function Avatar({
  initiales,
  couleur = "sable",
  grand = false,
  compact = false,
  photo,
}: {
  initiales: string;
  couleur?: "vert" | "orange" | "sable";
  grand?: boolean;
  compact?: boolean;
  photo?: string | null;
}) {
  const taille = compact
    ? "h-9 w-9 text-xs"
    : grand
      ? "h-16 w-16 text-xl"
      : "h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg";

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${COULEURS_AVATAR[couleur]} ${taille}`}
    >
      {photo ? (
        // Les photos de profil proviennent de l'API Mali Wuli, parfois via une URL relative.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        initiales
      )}
    </span>
  );
}

function BadgeType({ type }: { type: TypePublication }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold sm:text-sm ${
        type === "Offre"
          ? "bg-[#e1f0e7] text-brand"
          : "bg-[#fff1bf] text-[#3c2d1f]"
      }`}
    >
      {type}
    </span>
  );
}

function nomMembre(auteur?: SupporterPublicationApi | null) {
  return (
    [auteur?.user?.prenom, auteur?.user?.nom].filter(Boolean).join(" ") ||
    "Membre Mali Wuli"
  );
}

function ModaleSoutiens({
  ouverte,
  fermer,
  supporters,
  total,
  hasMore,
  chargement,
  erreur,
  reessayer,
  voirPlus,
}: {
  ouverte: boolean;
  fermer: () => void;
  supporters: SupporterPublicationApi[];
  total: number;
  hasMore: boolean;
  chargement: boolean;
  erreur: string;
  reessayer: () => void;
  voirPlus: () => void;
}) {
  useEffect(() => {
    if (!ouverte) return;
    const debordementPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fermerAvecClavier = (event: KeyboardEvent) => {
      if (event.key === "Escape") fermer();
    };
    window.addEventListener("keydown", fermerAvecClavier);
    return () => {
      document.body.style.overflow = debordementPrecedent;
      window.removeEventListener("keydown", fermerAvecClavier);
    };
  }, [fermer, ouverte]);

  if (!ouverte) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) fermer();
      }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#241a12]/55 p-4 backdrop-blur-[2px]"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-soutiens"
        className="flex max-h-[min(680px,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e2d2bc] bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div>
            <h2
              id="titre-soutiens"
              className="titre-section"
            >
              Personnes qui soutiennent
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {total} {total === 1 ? "soutien" : "soutiens"}
            </p>
          </div>
          <button
            type="button"
            onClick={fermer}
            autoFocus
            aria-label="Fermer la liste des soutiens"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5e5044] transition hover:bg-[#f2e7d8] focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="overflow-y-auto p-3 sm:p-4" aria-live="polite">
          {chargement && !supporters.length ? (
            <div className="space-y-2" aria-label="Chargement des soutiens">
              {[1, 2, 3].map((element) => (
                <div
                  key={element}
                  className="h-16 animate-pulse rounded-xl bg-[#f3eadd]"
                />
              ))}
            </div>
          ) : erreur && !supporters.length ? (
            <div className="rounded-xl bg-[#f8e9e2] p-4 text-sm text-[#873d28]">
              <p role="alert">{erreur}</p>
              <button
                type="button"
                onClick={reessayer}
                className="mt-3 font-bold text-brand underline underline-offset-2"
              >
                Réessayer
              </button>
            </div>
          ) : supporters.length ? (
            <div>
              <ul className="divide-y divide-[#eee1cf]">
                {supporters.map((supporter) => {
                  const nom = nomMembre(supporter);
                  const lieu = [supporter.ville, supporter.pays]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={supporter.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <Avatar
                        compact
                        initiales={initialesDe(
                          supporter.user?.prenom,
                          supporter.user?.nom,
                        )}
                        couleur={couleurDepuisInitiales(
                          initialesDe(
                            supporter.user?.prenom,
                            supporter.user?.nom,
                          ),
                        )}
                        photo={urlMediaBackend(supporter.photo)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink">
                          {nom}
                        </p>
                        <p className="truncate text-sm text-[#786958]">
                          {[titreMembre(supporter.titre), lieu].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ThumbsUp
                        aria-label="Soutient cette publication"
                        size={18}
                        className="shrink-0 text-brand"
                        fill="currentColor"
                      />
                    </li>
                  );
                })}
              </ul>
              {chargement && !hasMore ? (
                <p className="mt-2 text-center text-xs text-[#786958]">
                  Actualisation de la liste…
                </p>
              ) : null}
              {erreur ? (
                <div className="mt-3 rounded-xl bg-[#f8e9e2] p-3 text-sm text-[#873d28]">
                  <p role="alert">{erreur}</p>
                  <button
                    type="button"
                    onClick={reessayer}
                    className="mt-2 font-bold text-brand underline underline-offset-2"
                  >
                    Réessayer
                  </button>
                </div>
              ) : null}
              {hasMore ? (
                <button
                  type="button"
                  disabled={chargement}
                  onClick={voirPlus}
                  className="mt-3 min-h-11 w-full rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand transition hover:bg-[#e4efe8] focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-wait disabled:opacity-60"
                >
                  {chargement ? "Chargement…" : "Voir plus"}
                </button>
              ) : null}
            </div>
          ) : (
            <div>
              <p className="rounded-xl bg-surface-sunken px-4 py-6 text-center text-sm text-[#786958]">
                {total
                  ? "Aucun autre soutien sur cette page."
                  : "Personne n’a encore soutenu cette publication."}
              </p>
              {hasMore ? (
                <button
                  type="button"
                  disabled={chargement}
                  onClick={voirPlus}
                  className="mt-3 min-h-11 w-full rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand transition hover:bg-[#e4efe8] focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-wait disabled:opacity-60"
                >
                  {chargement ? "Chargement…" : "Voir plus"}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Menu « ⋯ » des actions sur un contenu. Les droits viennent de l’API :
 * sans droit, le bouton n’est pas rendu du tout.
 */
function MenuActions({
  libelle,
  peutModifier,
  peutSupprimer,
  peutSignaler = false,
  onModifier,
  onSupprimer,
  onSignaler,
  declencheurRef,
  compact = false,
}: {
  libelle: string;
  peutModifier: boolean;
  peutSupprimer: boolean;
  /** Proposé quand on n’est pas l’auteur du contenu. */
  peutSignaler?: boolean;
  onModifier: () => void;
  onSupprimer: () => void;
  onSignaler?: () => void;
  declencheurRef: RefObject<HTMLButtonElement>;
  compact?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const fermer = useCallback((rendreFocus: boolean) => {
    setOuvert(false);
    if (rendreFocus) declencheurRef.current?.focus();
  }, [declencheurRef]);

  useEffect(() => {
    if (!ouvert) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const clicExterieur = (event: PointerEvent) => {
      if (!conteneur.current?.contains(event.target as Node)) fermer(false);
    };
    const echap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        fermer(true);
      }
    };
    document.addEventListener("pointerdown", clicExterieur);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", clicExterieur);
      document.removeEventListener("keydown", echap);
    };
  }, [fermer, ouvert]);

  if (!peutModifier && !peutSupprimer && !(peutSignaler && onSignaler)) return null;

  const naviguer = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const elements = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [],
    );
    if (!elements.length) return;
    const index = elements.indexOf(document.activeElement as HTMLButtonElement);
    let cible: number | null = null;
    if (event.key === "ArrowDown") cible = (index + 1) % elements.length;
    else if (event.key === "ArrowUp") cible = (index - 1 + elements.length) % elements.length;
    else if (event.key === "Home") cible = 0;
    else if (event.key === "End") cible = elements.length - 1;
    else if (event.key === "Tab") fermer(false);
    if (cible !== null) {
      event.preventDefault();
      elements[cible]?.focus();
    }
  };

  const choisir = (action: () => void) => {
    setOuvert(false);
    action();
  };

  return (
    <div ref={conteneur} className="relative shrink-0">
      <button
        ref={declencheurRef}
        type="button"
        aria-label={libelle}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? menuId : undefined}
        onClick={() => setOuvert((valeur) => !valeur)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !ouvert) {
            event.preventDefault();
            setOuvert(true);
          }
        }}
        className={`inline-flex items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-sunken hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand ${
          compact ? "h-8 w-8" : "h-10 w-10"
        } ${ouvert ? "bg-surface-sunken text-brand" : ""}`}
      >
        <MoreHorizontal aria-hidden="true" size={compact ? 18 : 20} />
      </button>
      {ouvert && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={libelle}
          onKeyDown={naviguer}
          className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(79,55,33,0.14)]"
        >
          {peutModifier && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => choisir(onModifier)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-[#342a22] hover:bg-surface-sunken focus:bg-[#e2efe7] focus:text-brand focus:outline-none"
            >
              <Pencil aria-hidden="true" size={15} />
              Modifier
            </button>
          )}
          {peutSupprimer && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => choisir(onSupprimer)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-[#fbeae4] focus:bg-[#fbeae4] focus:outline-none"
            >
              <Trash2 aria-hidden="true" size={15} />
              Supprimer
            </button>
          )}
          {peutSignaler && onSignaler && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-haspopup="dialog"
              onClick={() => choisir(onSignaler)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-[#342a22] hover:bg-surface-sunken focus:bg-[#e2efe7] focus:text-brand focus:outline-none"
            >
              <Flag aria-hidden="true" size={15} />
              Signaler
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Confirmation explicite avant toute suppression (même règles que SupprimerContenu). */
function ConfirmationSuppression({
  endpoint,
  titre,
  consequences,
  avertissement = "Cette action est définitive.",
  onSupprime,
  onAnnuler,
}: {
  endpoint: string;
  titre: string;
  consequences: string;
  /** « ira dans la corbeille pendant 30 jours » pour l’auteur, « définitive » sinon. */
  avertissement?: string;
  onSupprime: (resultat?: ResultatSuppression) => void;
  onAnnuler: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const verrou = useRef(false);
  const titreId = useId();

  const supprimer = async () => {
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    setErreur("");
    let retire = false;
    let resultat: ResultatSuppression | undefined;
    try {
      const { data } = await api.delete<ResultatSuppression>(endpoint);
      resultat = data;
      retire = true;
    } catch (error) {
      // Le résultat voulu est déjà acquis lorsque le contenu a été retiré entre-temps.
      if ((error as { response?: { status?: number } })?.response?.status === 404) retire = true;
      else
        setErreur(
          lireMessageErreur(
            error,
            "La suppression n’a pas pu être confirmée. Le contenu est conservé ; vous pouvez réessayer.",
          ),
        );
    } finally {
      verrou.current = retire;
      setEnCours(false);
    }
    if (retire) onSupprime(resultat);
  };

  return (
    <section
      aria-labelledby={titreId}
      role="alertdialog"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !enCours) {
          event.preventDefault();
          event.stopPropagation();
          onAnnuler();
        }
      }}
      className="mt-3 rounded-xl border border-line bg-surface p-3"
    >
      <h3 id={titreId} className="text-sm font-bold text-ink">{titre}</h3>
      <p className="mt-1 text-sm text-[#4f4339]">{consequences}</p>
      <p className="mt-1 text-sm font-semibold text-danger">{avertissement}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          autoFocus
          disabled={enCours}
          onClick={onAnnuler}
          className="min-h-9 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-[#4f4339] hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={enCours}
          onClick={() => void supprimer()}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-danger px-3 text-sm font-bold text-white hover:bg-[#8a2918] focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        >
          {enCours && <LoaderCircle aria-hidden="true" size={15} className="animate-spin" />}
          {enCours ? "Suppression…" : "Confirmer la suppression"}
        </button>
      </div>
      {erreur && <p className="mt-2 text-sm text-danger" role="alert">{erreur}</p>}
    </section>
  );
}

/** Édition inline d’un texte : Entrée ne soumet pas (textarea), Échap annule. */
function EditionInline({
  valeurInitiale,
  longueurMax,
  autoriserVide = false,
  libelle,
  onEnregistrer,
  onAnnuler,
  compact = false,
}: {
  valeurInitiale: string;
  longueurMax: number;
  autoriserVide?: boolean;
  libelle: string;
  onEnregistrer: (contenu: string) => Promise<void>;
  onAnnuler: () => void;
  compact?: boolean;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const zone = useRef<HTMLTextAreaElement>(null);
  const champId = useId();

  useEffect(() => {
    const element = zone.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const contenu = valeur.trim();
  const invalide = (!contenu && !autoriserVide) || contenu.length > longueurMax;
  const inchange = contenu === valeurInitiale.trim();

  const enregistrer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enCours || invalide) return;
    if (inchange) {
      onAnnuler();
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      await onEnregistrer(contenu);
    } catch (error) {
      setErreur(lireMessageErreur(error, "La modification n’a pas pu être enregistrée."));
      setEnCours(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void enregistrer(event)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !enCours) {
          event.preventDefault();
          event.stopPropagation();
          onAnnuler();
        }
      }}
      className={compact ? "mt-1" : "mt-4"}
    >
      <label htmlFor={champId} className="sr-only">{libelle}</label>
      <textarea
        ref={zone}
        id={champId}
        value={valeur}
        maxLength={longueurMax}
        rows={compact ? 2 : 4}
        disabled={enCours}
        onChange={(event) => setValeur(event.target.value)}
        className={`w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[#342a22] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-70 ${
          compact ? "text-sm leading-6" : "text-[15px] leading-7 sm:text-[17px]"
        }`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-[#8b7b69]" aria-live="polite">
          {valeur.length}/{longueurMax}
        </span>
        <button
          type="button"
          disabled={enCours}
          onClick={onAnnuler}
          className="min-h-9 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-[#4f4339] hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={enCours || invalide}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-bold text-white hover:bg-[#0a552e] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enCours && <LoaderCircle aria-hidden="true" size={15} className="animate-spin" />}
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      {erreur && <p className="mt-2 text-sm text-danger" role="alert">{erreur}</p>}
    </form>
  );
}

function CommentaireFil({
  commentaire,
  publicationId,
  onSupprime,
  onModifie,
  niveau = 0,
  commentaireRacineId,
  repondre,
}: {
  commentaire: CommentairePublicationApi;
  publicationId: string;
  onSupprime: (commentaire: CommentairePublicationApi, resultat?: ResultatSuppression) => void;
  onModifie: (commentaireId: string, contenu: string) => void;
  niveau?: number;
  commentaireRacineId?: string;
  repondre: (parentId: string, auteur: string) => void;
}) {
  const [mode, setMode] = useState<"lecture" | "edition" | "suppression">("lecture");
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const declencheurMenu = useRef<HTMLButtonElement>(null);
  const peutModifier = (commentaire as CommentaireAvecDroits).peutModifier === true;
  const peutSupprimer = commentaire.peutSupprimer === true;
  const endpoint = `/publications/${encodeURIComponent(publicationId)}/commentaires/${encodeURIComponent(commentaire.id)}`;
  const revenirALaLecture = () => {
    setMode("lecture");
    requestAnimationFrame(() => declencheurMenu.current?.focus());
  };
  const enregistrer = async (contenu: string) => {
    const { data } = await api.patch<ReponseCommentaireApi>(endpoint, { contenu });
    onModifie(commentaire.id, extraireCommentaire(data).contenu ?? contenu);
    revenirALaLecture();
  };
  const auteur = nomMembre(commentaire.auteur);
  const racineId = commentaireRacineId || commentaire.id;
  const initiales = initialesDe(
    commentaire.auteur?.user?.prenom,
    commentaire.auteur?.user?.nom,
  );

  return (
    <div className={niveau ? "ml-5 border-l-2 border-[#d8c5aa] pl-3 sm:ml-9" : ""}>
      <div className="flex gap-2 rounded-lg border border-line-soft bg-surface p-3">
        <Avatar
          compact
          initiales={initiales}
          couleur={couleurDepuisInitiales(initiales)}
          photo={urlMediaBackend(commentaire.auteur?.photo)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm font-bold text-ink">
              {auteur}
              <span className="ml-2 font-normal text-[#8b7b69]">
                {dateRelative(commentaire.createdAt)}
              </span>
            </p>
            {mode === "lecture" && (
              <MenuActions
                compact
                libelle={`Actions sur le commentaire de ${auteur}`}
                peutModifier={peutModifier}
                peutSupprimer={peutSupprimer}
                peutSignaler={!peutModifier}
                onModifier={() => setMode("edition")}
                onSupprimer={() => setMode("suppression")}
                onSignaler={() => setSignalementOuvert(true)}
                declencheurRef={declencheurMenu}
              />
            )}
            <SignalerContenu
              ouvert={signalementOuvert}
              onFermer={() => setSignalementOuvert(false)}
              cibleType="COMMENTAIRE"
              cibleId={commentaire.id}
              libelleCible={`le commentaire de ${auteur}`}
              retourFocus={declencheurMenu}
            />
          </div>
          <p className="-mt-0.5 truncate text-xs text-[#6e5b49]">{titreMembre(commentaire.auteur?.titre)}</p>
          {mode === "edition" ? (
            <EditionInline
              compact
              valeurInitiale={commentaire.contenu}
              longueurMax={1000}
              libelle="Modifier le commentaire"
              onEnregistrer={enregistrer}
              onAnnuler={revenirALaLecture}
            />
          ) : (
            <>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#4f4339]">
                {commentaire.contenu}
              </p>
              <button
                type="button"
                onClick={() => repondre(racineId, auteur)}
                className="mt-1 rounded px-1 py-0.5 text-xs font-bold text-brand hover:underline focus:outline-none focus:ring-2 focus:ring-brand"
              >
                Répondre
              </button>
            </>
          )}
          {mode === "suppression" && peutSupprimer && (
            <ConfirmationSuppression
              endpoint={endpoint}
              titre="Supprimer ce commentaire ?"
              consequences={commentaire.reponses?.length ? "Le commentaire et ses réponses seront retirés de la publication." : "Le commentaire sera retiré de la publication."}
              avertissement={peutModifier ? "Ce commentaire ira dans la corbeille pendant 30 jours : vous pourrez le restaurer." : "Cette action est définitive."}
              // L’API commentaire ne renvoie pas `corbeille` : la suppression par l’auteur y place toujours l’élément.
              onSupprime={(resultat) => onSupprime(commentaire, resultat ? { ...resultat, corbeille: resultat.corbeille ?? peutModifier } : undefined)}
              onAnnuler={revenirALaLecture}
            />
          )}
        </div>
      </div>
      {commentaire.reponses?.length ? (
        <div className="mt-2 space-y-2">
          {commentaire.reponses.map((reponse) => (
            <CommentaireFil
              key={reponse.id}
              commentaire={reponse}
              publicationId={publicationId}
              onSupprime={onSupprime}
              onModifie={onModifie}
              niveau={niveau + 1}
              commentaireRacineId={racineId}
              repondre={repondre}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type RestaurationRecue = { id: string; publicationId: string; cle: number };

function CartePublication({ publication, onSupprime, actualiser, commentaireRestaure }: {
  publication: Publication;
  onSupprime: (id: string, corbeille: boolean) => void;
  actualiser: () => void;
  /** Dernier commentaire de cette publication restauré (événement temps réel). */
  commentaireRestaure?: RestaurationRecue | null;
}) {
  const commentairesSupprimes = useRef(new Set<string>());
  /** Identifiants masqués localement par suppression (commentaire + réponses), pour les réafficher après restauration. */
  const masquesParSuppression = useRef(new Map<string, string[]>());
  const [annonceSuppression, setAnnonceSuppression] = useState("");
  const [commentaireEnCorbeille, setCommentaireEnCorbeille] = useState<string | null>(null);
  const [restaurationEnCours, setRestaurationEnCours] = useState(false);
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const [modeCarte, setModeCarte] = useState<"lecture" | "edition" | "suppression">("lecture");
  const [texte, setTexte] = useState(publication.texte);
  const declencheurMenuPublication = useRef<HTMLButtonElement>(null);
  const [maReaction, setMaReaction] = useState<ReactionPublication | null>(
    publication.maReaction,
  );
  const [soutiens, setSoutiens] = useState(publication.soutiens);
  const [reactionEnCours, setReactionEnCours] = useState(false);
  const [modaleSoutiensOuverte, setModaleSoutiensOuverte] = useState(false);
  const [listeSoutiens, setListeSoutiens] = useState<
    SupporterPublicationApi[]
  >([]);
  const [soutiensCharges, setSoutiensCharges] = useState(false);
  const [chargementSoutiens, setChargementSoutiens] = useState(false);
  const [erreurSoutiens, setErreurSoutiens] = useState("");
  const [autresSoutiensDisponibles, setAutresSoutiensDisponibles] =
    useState(false);
  const [prochainCurseurSoutiens, setProchainCurseurSoutiens] = useState<
    string | null
  >(null);
  const [erreurPageSuivanteSoutiens, setErreurPageSuivanteSoutiens] =
    useState(false);
  const [reponseOuverte, setReponseOuverte] = useState(false);
  const [reponse, setReponse] = useState("");
  const [parentReponse, setParentReponse] = useState<{
    id: string;
    auteur: string;
  } | null>(null);
  const [commentaires, setCommentaires] = useState<CommentairePublicationApi[]>(
    publication.commentaires || [],
  );
  const [commentairesCharges, setCommentairesCharges] = useState(
    publication.commentaires !== undefined &&
      compterCommentaires(publication.commentaires) >= publication.reponses,
  );
  const [chargementCommentaires, setChargementCommentaires] = useState(false);
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);
  const [nombreReponses, setNombreReponses] = useState(publication.reponses);
  const [erreurAction, setErreurAction] = useState("");
  const [erreurCommentaires, setErreurCommentaires] = useState("");

  const soutenu = maReaction === "SOUTIEN";

  useEffect(() => {
    setTexte(publication.texte);
  }, [publication.texte]);

  const revenirALaLecturePublication = () => {
    setModeCarte("lecture");
    requestAnimationFrame(() => declencheurMenuPublication.current?.focus());
  };

  const enregistrerPublication = async (contenu: string) => {
    const { data } = await api.patch<ReponsePublicationApi>(
      `/publications/${encodeURIComponent(publication.id)}`,
      { contenu },
    );
    setTexte(extrairePublication(data).contenu ?? contenu);
    setAnnonceSuppression("La publication a été modifiée.");
    revenirALaLecturePublication();
    actualiser();
  };

  const modifierCommentaire = (commentaireId: string, contenu: string) => {
    setCommentaires((actuels) => remplacerContenuCommentaire(actuels, commentaireId, contenu));
    setAnnonceSuppression("Le commentaire a été modifié.");
  };

  useEffect(() => {
    setMaReaction(publication.maReaction);
    setSoutiens(publication.soutiens);
    setNombreReponses(publication.reponses);
  }, [publication.maReaction, publication.reponses, publication.soutiens]);

  useEffect(() => {
    const commentairesRecus = retirerCommentaires(publication.commentaires || [], commentairesSupprimes.current);
    const nombreCommentairesRecus = compterCommentaires(commentairesRecus);
    setCommentaires(commentairesRecus);
    setCommentairesCharges(
      publication.commentaires !== undefined &&
        nombreCommentairesRecus >= publication.reponses,
    );
  }, [publication.commentaires, publication.reponses]);

  const chargerSoutiens = async ({
    reinitialiser = false,
    curseur,
  }: {
    reinitialiser?: boolean;
    curseur?: string | null;
  } = {}) => {
    const estPageSuivante = !reinitialiser && Boolean(curseur);
    if (
      chargementSoutiens ||
      (!reinitialiser && curseur === undefined && soutiensCharges)
    ) {
      return;
    }

    setChargementSoutiens(true);
    setErreurSoutiens("");
    setErreurPageSuivanteSoutiens(false);
    if (reinitialiser) {
      setAutresSoutiensDisponibles(false);
      setProchainCurseurSoutiens(null);
    }
    try {
      let supporters: SupporterPublicationApi[] = [];
      let total = 0;
      let hasMore = false;
      let nextCursor: string | null = null;
      try {
        const { data } = await api.get<SupportersPublicationResponseApi>(
          `/publications/${publication.id}/supporters`,
          {
            params: {
              limite: 25,
              ...(curseur ? { cursor: curseur } : {}),
            },
          },
        );
        supporters = data.supporters || [];
        total = data.total ?? supporters.length;
        nextCursor = data.nextCursor ?? null;
        hasMore = Boolean(data.hasMore && nextCursor);
      } catch (erreurEndpoint) {
        const statut = (erreurEndpoint as { response?: { status?: number } })
          .response?.status;
        if (statut !== 404) throw erreurEndpoint;

        // Compatibilité avec la première API Hostinger : elle expose les
        // auteurs via /reactions, sans route /supporters dédiée.
        const { data } = await api.get<ReactionsPublicationResponseApi>(
          `/publications/${publication.id}/reactions`,
          {
            params: {
              limite: 25,
              ...(curseur ? { cursor: curseur } : {}),
            },
          },
        );
        supporters = (data.reactions || [])
          .filter((reaction) => reaction.type === "SOUTIEN")
          .map((reaction) => reaction.auteur);
        total = data.decompteReactions?.SOUTIEN ?? supporters.length;
        nextCursor = data.nextCursor ?? null;
        hasMore = Boolean(data.hasMore && nextCursor);
      }

      setListeSoutiens((actuels) =>
        estPageSuivante
          ? fusionnerSupporters(actuels, supporters)
          : supporters,
      );
      setSoutiens(total);
      setAutresSoutiensDisponibles(hasMore);
      setProchainCurseurSoutiens(nextCursor);
      setSoutiensCharges(true);
    } catch (erreur) {
      setErreurPageSuivanteSoutiens(estPageSuivante);
      setErreurSoutiens(
        lireMessageErreur(
          erreur,
          "La liste des personnes qui soutiennent n’a pas pu être chargée.",
        ),
      );
    } finally {
      setChargementSoutiens(false);
    }
  };

  const ouvrirSoutiens = () => {
    setModaleSoutiensOuverte(true);
    void chargerSoutiens();
  };

  const fermerSoutiens = useCallback(() => {
    setModaleSoutiensOuverte(false);
  }, []);

  useEffect(() => {
    setSoutiensCharges(false);
    if (modaleSoutiensOuverte) {
      void chargerSoutiens({ reinitialiser: true });
    }
    // Une mise à jour temps réel du compteur invalide la liste mise en cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publication.soutiens]);

  const basculerSoutien = async () => {
    if (reactionEnCours) return;

    const reactionPrecedente = maReaction;
    const soutiensPrecedents = soutiens;
    const prochaineReaction: ReactionPublication | null = soutenu
      ? null
      : "SOUTIEN";
    const soutiensOptimistes = Math.max(0, soutiens + (soutenu ? -1 : 1));

    setErreurAction("");
    setReactionEnCours(true);
    setMaReaction(prochaineReaction);
    setSoutiens(soutiensOptimistes);

    try {
      const { data } = await api.post<ReactionPublicationResponseApi>(
        `/publications/${publication.id}/reactions`,
        { type: "SOUTIEN" },
      );
      setMaReaction(data.maReaction ?? null);
      setSoutiens(
        data.decompteReactions?.SOUTIEN ??
          data.nbReactions ??
          soutiensOptimistes,
      );
      setSoutiensCharges(false);
      if (modaleSoutiensOuverte) {
        void chargerSoutiens({ reinitialiser: true });
      }
    } catch (erreur) {
      setMaReaction(reactionPrecedente);
      setSoutiens(soutiensPrecedents);
      setErreurAction(
        lireMessageErreur(erreur, "Le soutien n’a pas pu être enregistré."),
      );
    } finally {
      setReactionEnCours(false);
    }
  };

  const chargerCommentaires = async (forcer = false) => {
    if ((!forcer && commentairesCharges) || chargementCommentaires) return;
    setChargementCommentaires(true);
    setErreurCommentaires("");
    try {
      const { data } = await api.get<
        CommentairesPublicationResponseApi | CommentairePublicationApi[]
      >(`/publications/${publication.id}/commentaires`);
      const commentairesRecus = retirerCommentaires(extraireCommentaires(data), commentairesSupprimes.current);
      setCommentaires(commentairesRecus);
      setCommentairesCharges(true);
      setNombreReponses((total) =>
        Math.max(total, compterCommentaires(commentairesRecus)),
      );
    } catch (erreur) {
      setErreurCommentaires(
        lireMessageErreur(erreur, "Les réponses n’ont pas pu être chargées."),
      );
    } finally {
      setChargementCommentaires(false);
    }
  };

  const basculerReponses = () => {
    const prochaineValeur = !reponseOuverte;
    setReponseOuverte(prochaineValeur);
    if (prochaineValeur) void chargerCommentaires();
  };

  useEffect(() => {
    if (reponseOuverte && !commentairesCharges) void chargerCommentaires();
    // La prop `commentaires` change après chaque événement temps réel. Si
    // l'aperçu ne contient pas tout, on relit alors la conversation complète.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publication.commentaires, publication.reponses, reponseOuverte]);

  const retirerCommentaire = (commentaire: CommentairePublicationApi, resultat?: ResultatSuppression) => {
    const masques: string[] = [];
    const noter = (element: CommentairePublicationApi) => { commentairesSupprimes.current.add(element.id); masques.push(element.id); element.reponses?.forEach(noter); };
    noter(commentaire);
    masquesParSuppression.current.set(commentaire.id, masques);
    setCommentaires((actuels) => retirerCommentaires(actuels, commentairesSupprimes.current));
    // Une lecture socket peut avoir déjà reçu le nouveau total avant la réponse DELETE.
    // Sur 404 sans total, la relecture ci-dessous rétablit le compteur sans le soustraire deux fois.
    if (typeof resultat?.nbCommentaires === "number" && Number.isInteger(resultat.nbCommentaires) && resultat.nbCommentaires >= 0) setNombreReponses(resultat.nbCommentaires);
    if (parentReponse && commentairesSupprimes.current.has(parentReponse.id)) setParentReponse(null);
    const corbeille = resultat?.corbeille === true;
    setCommentaireEnCorbeille(corbeille ? commentaire.id : null);
    setAnnonceSuppression(corbeille ? `${MESSAGE_CORBEILLE}.` : "Le commentaire a été supprimé.");
    actualiser();
  };

  /** Réaffiche un commentaire restauré (ici ou ailleurs) et relit la conversation. */
  const reafficherCommentaire = useCallback((commentaireId: string) => {
    const masques = masquesParSuppression.current.get(commentaireId) || [commentaireId];
    masques.forEach((id) => commentairesSupprimes.current.delete(id));
    masquesParSuppression.current.delete(commentaireId);
  }, []);

  const annulerSuppressionCommentaire = async () => {
    if (!commentaireEnCorbeille || restaurationEnCours) return;
    setRestaurationEnCours(true);
    try {
      await restaurerDepuisCorbeille("commentaire", commentaireEnCorbeille);
      reafficherCommentaire(commentaireEnCorbeille);
      setCommentaireEnCorbeille(null);
      setAnnonceSuppression("Le commentaire a été restauré.");
      if (commentairesCharges || reponseOuverte) void chargerCommentaires(true);
      actualiser();
    } catch (erreur) {
      setAnnonceSuppression(lireMessageErreur(erreur, "La restauration a échoué. Vous pouvez réessayer depuis la corbeille."));
    } finally {
      setRestaurationEnCours(false);
    }
  };

  useEffect(() => {
    if (!commentaireRestaure) return;
    reafficherCommentaire(commentaireRestaure.id);
    if (commentaireEnCorbeille === commentaireRestaure.id) { setCommentaireEnCorbeille(null); setAnnonceSuppression("Le commentaire a été restauré."); }
    if (commentairesCharges || reponseOuverte) void chargerCommentaires(true);
    // Déclenché uniquement par un nouvel événement de restauration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentaireRestaure?.cle]);

  const preparerReponse = (parentId: string, auteur: string) => {
    setParentReponse({ id: parentId, auteur });
    setReponse("");
    requestAnimationFrame(() => {
      document.getElementById(`reponse-${publication.id}`)?.focus();
    });
  };

  const envoyerReponse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const contenu = reponse.trim();
    if (!contenu || envoiCommentaire) return;

    setEnvoiCommentaire(true);
    setErreurAction("");
    try {
      const { data } = await api.post<ReponseCommentaireApi>(
        `/publications/${publication.id}/commentaires`,
        {
          contenu,
          ...(parentReponse ? { parentId: parentReponse.id } : {}),
        },
      );
      const commentaire = extraireCommentaire(data);
      setCommentaires((actuels) =>
        ajouterCommentaireDansFil(
          actuels,
          commentaire,
          parentReponse?.id || commentaire.parentId,
        ),
      );
      setNombreReponses((total) => total + 1);
      setReponse("");
      setParentReponse(null);
    } catch (erreur) {
      setErreurAction(
        lireMessageErreur(erreur, "Votre commentaire n’a pas pu être publié."),
      );
    } finally {
      setEnvoiCommentaire(false);
    }
  };

  return (
    <article className="rounded-2xl border border-line-soft bg-surface p-4 shadow-[0_1px_2px_rgba(79,55,33,0.04)] sm:p-5">
      <header className="flex items-start gap-3">
        <Avatar
          initiales={publication.initiales}
          couleur={publication.couleurAvatar}
          photo={publication.photo}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate titre-element">
            {publication.auteur}
          </h2>
          <p className="mt-0.5 truncate text-sm text-[#6e5b49]">{publication.fonction}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="truncate">{publication.lieu}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{publication.date}</span>
            <span aria-hidden="true">·</span>
            <Globe2 aria-label="Visible par tous les membres" role="img" size={13} className="shrink-0" />
          </p>
        </div>
        {modeCarte === "lecture" && (
          <MenuActions
            libelle="Actions sur la publication"
            peutModifier={publication.peutModifier}
            peutSupprimer={publication.peutSupprimer}
            peutSignaler={!publication.peutModifier}
            onModifier={() => setModeCarte("edition")}
            onSupprimer={() => setModeCarte("suppression")}
            onSignaler={() => setSignalementOuvert(true)}
            declencheurRef={declencheurMenuPublication}
          />
        )}
        <SignalerContenu
          ouvert={signalementOuvert}
          onFermer={() => setSignalementOuvert(false)}
          cibleType="PUBLICATION"
          cibleId={publication.id}
          libelleCible={`la publication de ${publication.auteur}`}
          retourFocus={declencheurMenuPublication}
        />
      </header>
      {modeCarte === "suppression" && publication.peutSupprimer && (
        <ConfirmationSuppression
          endpoint={`/publications/${encodeURIComponent(publication.id)}`}
          titre="Supprimer cette publication ?"
          consequences="La publication, ses commentaires et ses réactions seront retirés du fil."
          avertissement={publication.peutModifier ? "Cette publication ira dans la corbeille pendant 30 jours : vous pourrez la restaurer." : "Cette action est définitive."}
          onSupprime={(resultat) => onSupprime(publication.id, resultat?.corbeille === true)}
          onAnnuler={revenirALaLecturePublication}
        />
      )}
      {annonceSuppression && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-brand" role="status">
          <span>{annonceSuppression}</span>
          {commentaireEnCorbeille && (
            <button
              type="button"
              disabled={restaurationEnCours}
              onClick={() => void annulerSuppressionCommentaire()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 font-semibold text-brand hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-wait disabled:opacity-60"
            >
              {restaurationEnCours ? <LoaderCircle aria-hidden="true" size={14} className="animate-spin" /> : <RotateCcw aria-hidden="true" size={14} />}
              Annuler
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BadgeType type={publication.type} />
        {publication.thematique && (
          <span className="inline-flex rounded-full bg-[#efe4d2] px-3 py-1 text-xs font-bold text-[#664e39] sm:text-sm">
            {publication.thematique}
          </span>
        )}
      </div>

      {modeCarte === "edition" ? (
        <EditionInline
          valeurInitiale={texte}
          longueurMax={1200}
          autoriserVide={publication.aMedia}
          libelle="Modifier le texte de la publication"
          onEnregistrer={enregistrerPublication}
          onAnnuler={revenirALaLecturePublication}
        />
      ) : texte.trim() ? (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-[#342a22] sm:text-base sm:leading-7">
          {texte}
        </p>
      ) : null}
      {publication.image && (
        <div className="-mx-4 mt-3 bg-[#f0e7da] sm:-mx-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publication.image}
            alt={`Image publiée par ${publication.auteur}`}
            loading="lazy"
            className="max-h-[560px] w-full object-contain"
          />
        </div>
      )}

      {(soutiens > 0 || nombreReponses > 0) && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-ink-muted">
          {soutiens > 0 ? (
            <button
              type="button"
              onClick={ouvrirSoutiens}
              aria-haspopup="dialog"
              aria-label={`Voir ${soutiens === 1 ? "la personne" : `les ${soutiens} personnes`} qui soutiennent cette publication`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 hover:text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                <ThumbsUp size={11} fill="currentColor" />
              </span>
              {soutiens}
            </button>
          ) : <span />}
          {nombreReponses > 0 && (
            <button
              type="button"
              onClick={basculerReponses}
              aria-expanded={reponseOuverte}
              className="min-h-9 rounded-md px-1 hover:text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {nombreReponses} {nombreReponses === 1 ? "commentaire" : "commentaires"}
            </button>
          )}
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-1 border-t border-[#eee1cf] pt-1">
        <button
          type="button"
          aria-pressed={soutenu}
          disabled={reactionEnCours}
          onClick={() => void basculerSoutien()}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-[15px] ${
            soutenu ? "text-brand" : "text-[#6e5b49]"
          } disabled:cursor-wait disabled:opacity-60`}
        >
          <ThumbsUp aria-hidden="true" size={19} fill={soutenu ? "currentColor" : "none"} />
          {soutenu ? "Soutenu" : "Soutenir"}
        </button>
        <button
          type="button"
          aria-expanded={reponseOuverte}
          onClick={basculerReponses}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#6e5b49] transition hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-[15px]"
        >
          <MessageCircle aria-hidden="true" size={19} />
          Commenter
        </button>
      </div>

      {reponseOuverte && (
        <div className="mt-3 rounded-xl bg-surface-sunken p-2 sm:p-3">
          <div className="space-y-2" aria-live="polite">
            {commentaires.length > 0 ? (
              commentaires.map((commentaire) => (
                <CommentaireFil
                  key={commentaire.id}
                  commentaire={commentaire}
                  publicationId={publication.id}
                  onSupprime={retirerCommentaire}
                  onModifie={modifierCommentaire}
                  repondre={preparerReponse}
                />
              ))
            ) : chargementCommentaires ? (
              <p className="px-2 py-3 text-sm text-[#786958]">
                Chargement des commentaires…
              </p>
            ) : commentairesCharges ? (
              <p className="px-2 py-2 text-sm text-[#786958]">
                Aucun commentaire pour le moment. Soyez la première personne à
                commenter.
              </p>
            ) : null}
            {chargementCommentaires && commentaires.length > 0 ? (
              <p className="px-2 py-1 text-xs text-[#786958]">
                Actualisation des commentaires…
              </p>
            ) : null}
            {erreurCommentaires ? (
              <div className="rounded-lg bg-[#f8e9e2] px-3 py-2 text-sm text-[#873d28]">
                <p role="alert">{erreurCommentaires}</p>
                <button
                  type="button"
                  onClick={() => void chargerCommentaires()}
                  className="mt-1 font-bold text-brand underline"
                >
                  Réessayer
                </button>
              </div>
            ) : null}
          </div>

          <form onSubmit={envoyerReponse} className="mt-3">
            {parentReponse ? (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-[#e4efe8] px-3 py-2 text-xs text-brand">
                <span className="truncate">
                  Réponse à <strong>{parentReponse.auteur}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setParentReponse(null)}
                  className="shrink-0 font-bold underline underline-offset-2"
                >
                  Annuler
                </button>
              </div>
            ) : null}
            <div className="flex gap-2">
              <label htmlFor={`reponse-${publication.id}`} className="sr-only">
                {parentReponse
                  ? `Votre réponse à ${parentReponse.auteur}`
                  : `Votre commentaire sur la publication de ${publication.auteur}`}
              </label>
              <input
                id={`reponse-${publication.id}`}
                value={reponse}
                onChange={(event) => setReponse(event.target.value)}
                maxLength={1_000}
                placeholder={
                  parentReponse
                    ? `Répondre à ${parentReponse.auteur}…`
                    : "Écrivez un commentaire…"
                }
                className="min-w-0 flex-1 rounded-lg border border-[#dfcdb4] bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-[#9a8a79] focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="submit"
                disabled={!reponse.trim() || envoiCommentaire}
                aria-label={
                  parentReponse ? "Envoyer la réponse" : "Publier le commentaire"
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send aria-hidden="true" size={17} />
              </button>
            </div>
          </form>
        </div>
      )}

      {erreurAction && (
        <p role="alert" className="mt-2 text-sm font-medium text-[#9b3e24]">
          {erreurAction}
        </p>
      )}
      <ModaleSoutiens
        ouverte={modaleSoutiensOuverte}
        fermer={fermerSoutiens}
        supporters={listeSoutiens}
        total={soutiens}
        hasMore={autresSoutiensDisponibles}
        chargement={chargementSoutiens}
        erreur={erreurSoutiens}
        reessayer={() =>
          void chargerSoutiens(
            erreurPageSuivanteSoutiens && prochainCurseurSoutiens
              ? { curseur: prochainCurseurSoutiens }
              : { reinitialiser: true },
          )
        }
        voirPlus={() =>
          void chargerSoutiens({ curseur: prochainCurseurSoutiens })
        }
      />
    </article>
  );
}

function ColonneProfil({
  utilisateur,
  chargement,
  erreur,
  reessayer,
}: {
  utilisateur: UtilisateurConnecteFil | null;
  chargement: boolean;
  erreur: string;
  reessayer: () => void;
}) {
  if (chargement && !utilisateur) {
    return (
      <aside
        aria-label="Chargement de mon profil"
        className="hidden space-y-5 xl:block"
      >
        <div className="h-72 animate-pulse rounded-2xl border border-line-soft bg-surface" />
      </aside>
    );
  }

  if (!utilisateur) {
    return (
      <aside aria-label="Résumé de mon profil" className="hidden xl:block">
        <section className="rounded-2xl border border-line-soft bg-surface p-5 text-sm text-[#625347]">
          <p>{erreur || "Votre profil n’est pas encore disponible."}</p>
          <button
            type="button"
            onClick={reessayer}
            className="mt-3 font-bold text-brand hover:underline"
          >
            Réessayer
          </button>
        </section>
      </aside>
    );
  }

  const profil = utilisateur.profil;
  const nom =
    [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") ||
    "Membre Mali Wuli";
  const initiales = initialesDe(utilisateur.prenom, utilisateur.nom);
  const lieu = [profil.ville, profil.pays].filter(Boolean).join(" · ");

  return (
    <aside
      aria-label="Résumé de mon profil"
      className="hidden space-y-5 xl:block"
    >
      <section className="overflow-hidden rounded-2xl border border-line-soft bg-surface">
        <div
          className="h-20 bg-brand"
          style={{
            backgroundImage:
              "radial-gradient(circle at 72% 110%, transparent 0 20px, rgba(236,179,21,.18) 21px 27px, transparent 28px 42px, rgba(236,179,21,.15) 43px 49px, transparent 50px), linear-gradient(115deg, #0d6738 0 34%, #175d39 34% 39%, #8b5a34 39% 100%)",
          }}
        />
        <div className="px-5 pb-5">
          <div className="-mt-8 w-fit rounded-full border-4 border-surface">
            <Avatar
              initiales={initiales}
              grand
              photo={urlMediaBackend(profil.photo)}
            />
          </div>
          <h2 className="mt-3 titre-element">
            {nom}
          </h2>
          <p className="mt-1 text-[#4f4339]">{titreMembre(profil.titre)}</p>
          {lieu && <p className="mt-0.5 text-sm text-ink-muted">{lieu}</p>}
          <dl className="mt-5 space-y-3 border-t border-[#eee1cf] pt-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#615247]">Synergies actives</dt>
              <dd className="font-bold text-brand">
                {profil.stats?.nbSynergies ?? 0}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#615247]">Contributions au réseau</dt>
              <dd className="font-bold text-brand">
                {profil.stats?.nbContributions ?? 0}
              </dd>
            </div>
          </dl>
          <Link
            href="/profil"
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline"
          >
            Voir mon profil <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </section>

      {erreur ? (
        <p
          role="status"
          className="rounded-xl border border-line-soft bg-surface p-3 text-xs text-[#756657]"
        >
          Certaines informations n’ont pas pu être actualisées.{" "}
          <button
            type="button"
            onClick={reessayer}
            className="font-bold text-brand underline"
          >
            Réessayer
          </button>
        </p>
      ) : null}
    </aside>
  );
}

function ColonneSuggestions({
  suggestions,
  evenements,
  chargement,
  erreur,
  reessayer,
  actualiser,
}: {
  suggestions: SuggestionFil[];
  evenements: EvenementFil[];
  chargement: boolean;
  erreur: string;
  reessayer: () => void;
  actualiser: () => Promise<void>;
}) {
  const [actionId, setActionId] = useState("");
  const [envoyees, setEnvoyees] = useState<string[]>([]);
  const [erreurAction, setErreurAction] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const proposerSynergie = async (suggestion: SuggestionFil) => {
    setActionId(suggestion.id);
    setErreurAction("");
    setConfirmation("");
    try {
      await api.post("/synergies", { recepteurProfilId: suggestion.id });
      setEnvoyees((actuelles) => [...actuelles, suggestion.id]);
      setConfirmation("Votre demande de synergie a bien été envoyée.");
      await actualiser();
    } catch (erreur) {
      setErreurAction(
        lireMessageErreur(erreur, "La demande n’a pas pu être envoyée."),
      );
    } finally {
      setActionId("");
    }
  };

  if (chargement && !suggestions.length && !evenements.length) {
    return (
      <aside
        aria-label="Chargement des suggestions"
        className="hidden space-y-5 xl:block"
      >
        {[1, 2].map((item) => (
          <div
            key={item}
            className="h-48 animate-pulse rounded-2xl border border-line-soft bg-surface"
          />
        ))}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Suggestions et événements"
      className="hidden space-y-5 xl:block"
    >
      <section className="rounded-2xl border border-line-soft bg-surface p-5">
        <h2 className="titre-carte">
          Synergies suggérées
        </h2>
        {suggestions.length ? (
          <div className="mt-4 space-y-4">
            {suggestions.slice(0, 2).map((suggestion) => {
              const nom =
                [suggestion.user.prenom, suggestion.user.nom]
                  .filter(Boolean)
                  .join(" ") || "Membre Mali Wuli";
              const demandeEnvoyee = envoyees.includes(suggestion.id);
              return (
                <div
                  key={suggestion.id}
                  className="border-b border-[#eee1cf] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      initiales={initialesDe(
                        suggestion.user.prenom,
                        suggestion.user.nom,
                      )}
                      couleur={couleurDepuisInitiales(
                        initialesDe(
                          suggestion.user.prenom,
                          suggestion.user.nom,
                        ),
                      )}
                      photo={urlMediaBackend(suggestion.photo)}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{nom}</p>
                      <p className="truncate text-sm text-[#5f5145]">
                        {[titreMembre(suggestion.titre), suggestion.ville || suggestion.pays].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={actionId === suggestion.id || demandeEnvoyee}
                    onClick={() => void proposerSynergie(suggestion)}
                    className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${demandeEnvoyee ? "bg-[#e1eee7] text-brand" : "bg-brand text-white hover:bg-brand-700"} disabled:opacity-70`}
                  >
                    {demandeEnvoyee ? (
                      <Check aria-hidden="true" size={18} />
                    ) : (
                      <Plus aria-hidden="true" size={18} />
                    )}
                    {actionId === suggestion.id
                      ? "Envoi…"
                      : demandeEnvoyee
                        ? "Demande envoyée"
                        : "Proposer une synergie"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-[#756657]">
              Aucune nouvelle suggestion pour le moment.
            </p>
            <Link
              href="/annuaire"
              className="mt-3 inline-flex items-center gap-1 font-bold text-brand hover:underline"
            >
              Voir l’annuaire <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        )}
        {erreurAction ? (
          <p role="alert" className="mt-3 text-sm font-medium text-[#9b3e24]">
            {erreurAction}
          </p>
        ) : null}
        {confirmation ? (
          <p
            role="status"
            className="mt-3 rounded-lg bg-[#e1eee7] px-3 py-2 text-sm font-medium text-brand"
          >
            {confirmation}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line-soft bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="titre-carte">
            Événements à venir
          </h2>
          <Link
            href="/evenements"
            aria-label="Voir tous les événements"
            className="text-brand"
          >
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
        {evenements.length ? (
          <div className="mt-4 space-y-4">
            {evenements.slice(0, 3).map((evenement) => {
              const date = dateEvenement(evenement.dateDebut, evenement.fuseauHoraire);
              return (
                <div key={evenement.id} className="flex items-center gap-3">
                  <div className="w-12 shrink-0 overflow-hidden rounded-lg border border-[#decbb2] text-center">
                    <p className="bg-brand py-1 text-[10px] font-bold text-white">
                      {date.mois}
                    </p>
                    <p className="py-1 text-lg font-bold text-[#322920]">
                      {date.jour}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <Link href={`/evenements/${encodeURIComponent(evenement.id)}`} className="block truncate font-bold text-ink hover:text-brand hover:underline">
                      {evenement.titre}
                    </Link>
                    <p className="truncate text-sm text-[#625347]">
                      {[evenement.lieu, date.detail]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#756657]">
            Aucun événement annoncé pour le moment.
          </p>
        )}
      </section>

      {erreur ? (
        <section className="rounded-2xl border border-line-soft bg-surface p-4 text-sm text-[#756657]">
          <p>Certaines suggestions n’ont pas pu être chargées.</p>
          <button
            type="button"
            onClick={reessayer}
            className="mt-2 font-bold text-brand underline"
          >
            Réessayer
          </button>
        </section>
      ) : null}
    </aside>
  );
}

export default function ActualiteFeed() {
  const socket = useSocket();
  const [panneaux, setPanneaux] = useState<PanneauxFil>({
    utilisateur: null,
    evenements: [],
    suggestions: [],
  });
  const [chargementPanneaux, setChargementPanneaux] = useState(true);
  const [erreurPanneaux, setErreurPanneaux] = useState("");
  const [filtre, setFiltre] = useState<FiltreFil>("tout");
  const [publications, setPublications] = useState<Publication[]>([]);
  const publicationsSupprimees = useRef(new Set<string>());
  const [annonceSuppression, setAnnonceSuppression] = useState("");
  const [publicationEnCorbeille, setPublicationEnCorbeille] = useState<string | null>(null);
  const [restaurationEnCours, setRestaurationEnCours] = useState(false);
  const [commentaireRestaure, setCommentaireRestaure] = useState<RestaurationRecue | null>(null);
  const [chargementFil, setChargementFil] = useState(true);
  const [erreurFil, setErreurFil] = useState("");

  const chargerPanneaux = useCallback(
    async (silencieux = false, signal?: AbortSignal) => {
      if (!silencieux) setChargementPanneaux(true);
      const resultats = await Promise.allSettled([
        api.get<UtilisateurConnecteFil>("/users/me", { signal }),
        api.get<EvenementsFilResponse>("/evenements", {
          params: { periode: "a_venir", page: 1, limite: 3 },
          signal,
        }),
        api.get<SuggestionsFilResponse>("/synergies/suggestions", { signal }),
      ]);

      if (signal?.aborted) return;
      const [profil, evenements, suggestions] = resultats;
      setPanneaux((actuels) => ({
        utilisateur:
          profil.status === "fulfilled"
            ? profil.value.data
            : actuels.utilisateur,
        evenements:
          evenements.status === "fulfilled"
            ? evenements.value.data.evenements || []
            : actuels.evenements,
        suggestions:
          suggestions.status === "fulfilled"
            ? suggestions.value.data.suggestions || []
            : actuels.suggestions,
      }));
      const nombreErreurs = resultats.filter(
        (resultat) => resultat.status === "rejected",
      ).length;
      setErreurPanneaux(
        nombreErreurs
          ? nombreErreurs === resultats.length
            ? "Les informations du réseau sont momentanément indisponibles."
            : "Une partie des informations n’a pas pu être actualisée."
          : "",
      );
      if (!silencieux) setChargementPanneaux(false);
    },
    [],
  );

  const chargerPublications = useCallback(
    async (silencieux = false, signal?: AbortSignal) => {
      if (!silencieux) setChargementFil(true);
      try {
        const { data } = await api.get<
          PublicationsResponseApi | PublicationApi[]
        >("/publications", {
          // `scope` est le contrat public. `filtre` garde la compatibilité avec
          // la première version du backend déjà déployée chez Hostinger.
          params: { scope: filtre, filtre },
          signal,
        });
        if (signal?.aborted) return;
        setPublications(
          extraireListePublications(data).filter((publication) => !publicationsSupprimees.current.has(publication.id)).map(adapterPublication),
        );
        setErreurFil("");
      } catch (erreur) {
        if (estRequeteAnnulee(erreur)) return;
        if (!silencieux) {
          setErreurFil(
            lireMessageErreur(
              erreur,
              "Le fil d’actualité n’a pas pu être chargé.",
            ),
          );
        }
      } finally {
        if (!silencieux && !signal?.aborted) setChargementFil(false);
      }
    },
    [filtre],
  );

  useEffect(() => {
    const controleur = new AbortController();
    void chargerPublications(false, controleur.signal);
    return () => controleur.abort();
  }, [chargerPublications]);

  useEffect(() => {
    const controleur = new AbortController();
    void chargerPanneaux(false, controleur.signal);
    return () => controleur.abort();
  }, [chargerPanneaux]);

  useEffect(() => {
    if (!socket) return;
    let actualisationProgrammee: ReturnType<typeof setTimeout> | null = null;
    let panneauxAActualiser = false;
    const actualiser = () => {
      if (actualisationProgrammee) clearTimeout(actualisationProgrammee);
      // Le backend émet les noms historiques et normalisés pendant la transition.
      // Ce court délai fusionne ces doublons en une seule lecture du fil.
      actualisationProgrammee = setTimeout(() => {
        actualisationProgrammee = null;
        void chargerPublications(true);
        if (panneauxAActualiser) { panneauxAActualiser = false; void chargerPanneaux(true); }
      }, 100);
    };
    const evenements = [
      "nouvelle_publication",
      "nouveau_commentaire",
      "reaction_mise_a_jour",
      "commentaire_supprime",
      "publication:created",
      "publication:commentCreated",
      "publication:reactionUpdated",
      "publication:updated",
      "publication:commentUpdated",
    ];

    const suppressionRecue = (payload: unknown) => {
      const publicationId = (payload as { publicationId?: unknown } | null)?.publicationId;
      if (typeof publicationId === "string" && publicationId) {
        publicationsSupprimees.current.add(publicationId);
        setPublications((actuelles) => actuelles.filter((publication) => publication.id !== publicationId));
      }
      panneauxAActualiser = true;
      actualiser();
    };
    const suppressions = ["publication_supprimee", "publication:deleted"];
    // Restauration depuis la corbeille (ici, dans un autre onglet ou par un autre membre).
    const publicationRestauree = (payload: unknown) => {
      const id = (payload as { id?: unknown; publicationId?: unknown } | null);
      const publicationId = typeof id?.publicationId === "string" ? id.publicationId : typeof id?.id === "string" ? id.id : "";
      if (publicationId) {
        publicationsSupprimees.current.delete(publicationId);
        setPublicationEnCorbeille((actuelle) => (actuelle === publicationId ? null : actuelle));
      }
      panneauxAActualiser = true;
      actualiser();
    };
    const commentaireRestaureRecu = (payload: unknown) => {
      const donnees = payload as { id?: unknown; publicationId?: unknown } | null;
      if (typeof donnees?.id === "string" && typeof donnees.publicationId === "string") {
        setCommentaireRestaure({ id: donnees.id, publicationId: donnees.publicationId, cle: Date.now() });
      }
      actualiser();
    };
    evenements.forEach((evenement) => socket.on(evenement, actualiser));
    suppressions.forEach((evenement) => socket.on(evenement, suppressionRecue));
    socket.on("publication:restored", publicationRestauree);
    socket.on("publication:commentRestored", commentaireRestaureRecu);
    return () => {
      if (actualisationProgrammee) clearTimeout(actualisationProgrammee);
      evenements.forEach((evenement) => socket.off(evenement, actualiser));
      suppressions.forEach((evenement) => socket.off(evenement, suppressionRecue));
      socket.off("publication:restored", publicationRestauree);
      socket.off("publication:commentRestored", commentaireRestaureRecu);
    };
  }, [chargerPanneaux, chargerPublications, socket]);

  useEffect(() => {
    if (!socket) return;
    const actualiser = () => void chargerPanneaux(true);
    const evenements = [
      "synergie:created",
      "synergie:updated",
      "synergie:deleted",
      "synergie_creee",
      "synergie_mise_a_jour",
      "synergie_supprimee",
      "evenement_modifie",
      "rendez_vous_modifie",
    ];
    evenements.forEach((evenement) => socket.on(evenement, actualiser));
    return () => {
      evenements.forEach((evenement) => socket.off(evenement, actualiser));
    };
  }, [chargerPanneaux, socket]);

  const retirerPublication = (id: string, corbeille: boolean) => {
    publicationsSupprimees.current.add(id);
    setPublications((actuelles) => actuelles.filter((publication) => publication.id !== id));
    setPublicationEnCorbeille(corbeille ? id : null);
    setAnnonceSuppression(corbeille ? `${MESSAGE_CORBEILLE}.` : "La publication a été supprimée.");
    void chargerPanneaux(true);
  };

  const annulerSuppressionPublication = async () => {
    if (!publicationEnCorbeille || restaurationEnCours) return;
    const id = publicationEnCorbeille;
    setRestaurationEnCours(true);
    try {
      await restaurerDepuisCorbeille("publication", id);
      publicationsSupprimees.current.delete(id);
      setPublicationEnCorbeille(null);
      setAnnonceSuppression("La publication a été restaurée.");
      await chargerPublications(true);
      void chargerPanneaux(true);
    } catch (erreur) {
      setAnnonceSuppression(lireMessageErreur(erreur, "La restauration a échoué. Vous pouvez réessayer depuis la corbeille."));
    } finally {
      setRestaurationEnCours(false);
    }
  };

  const publicationRecue = (brute: PublicationApi) => {
    const creee = adapterPublication(brute);
    publicationsSupprimees.current.delete(creee.id);
    setPublications((actuelles) => [creee, ...actuelles.filter((publication) => publication.id !== creee.id)]);
    setFiltre("tout");
  };

  return (
    <div className="min-h-full min-w-0 bg-[var(--color-page)] [overflow-wrap:anywhere] font-sans text-ink">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-start gap-5 p-4 sm:p-6 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        <div className="xl:sticky xl:top-[calc(var(--mw-header-h)+1.5rem)]">
          <ColonneProfil
            utilisateur={panneaux.utilisateur}
            chargement={chargementPanneaux}
            erreur={erreurPanneaux}
            reessayer={() => void chargerPanneaux()}
          />
        </div>

        <main aria-label="Fil d’actualité" className="min-w-0 space-y-4">
          <ComposerPublication
            prenom={panneaux.utilisateur?.prenom}
            nom={panneaux.utilisateur?.nom}
            initiales={initialesDe(panneaux.utilisateur?.prenom, panneaux.utilisateur?.nom)}
            photo={urlMediaBackend(panneaux.utilisateur?.profil.photo)}
            onPublie={publicationRecue}
          />

          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <div aria-hidden="true" className="h-px flex-1 bg-[#e3d6c0]" />
            <label className="inline-flex items-center gap-1.5">
              <span>Afficher :</span>
              <span className="relative inline-flex items-center">
                <select
                  value={filtre}
                  onChange={(event) => setFiltre(event.target.value as FiltreFil)}
                  className="min-h-9 cursor-pointer appearance-none rounded bg-transparent py-1 pl-1 pr-6 font-bold text-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {FILTRES.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-0" />
              </span>
            </label>
          </div>

          <p className="sr-only" aria-live="polite">
            {chargementFil
              ? "Chargement des publications"
              : `${publications.length} publications affichées`}
          </p>

          {annonceSuppression && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#c8dccd] bg-[#edf4ee] p-3 text-sm text-brand" role="status">
              <span className="min-w-0 flex-1">{annonceSuppression}</span>
              {publicationEnCorbeille && (
                <>
                  <Link href="/corbeille" className="font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-brand">Voir la corbeille</Link>
                  <button
                    type="button"
                    disabled={restaurationEnCours}
                    onClick={() => void annulerSuppressionPublication()}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 font-semibold text-brand hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-wait disabled:opacity-60"
                  >
                    {restaurationEnCours ? <LoaderCircle aria-hidden="true" size={14} className="animate-spin" /> : <RotateCcw aria-hidden="true" size={14} />}
                    Annuler
                  </button>
                </>
              )}
            </div>
          )}
          <section aria-label="Publications" className="space-y-4">
            {chargementFil ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className="animate-pulse rounded-2xl border border-line-soft bg-surface p-5"
                >
                  <div className="flex gap-3">
                    <div className="h-14 w-14 rounded-full bg-line-soft" />
                    <div className="flex-1 space-y-3 pt-1">
                      <div className="h-5 w-2/5 rounded bg-line-soft" />
                      <div className="h-4 w-3/5 rounded bg-[#f0e7da]" />
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="h-4 rounded bg-[#f0e7da]" />
                    <div className="h-4 w-5/6 rounded bg-[#f0e7da]" />
                  </div>
                </div>
              ))
            ) : erreurFil ? (
              <div
                role="alert"
                className="rounded-2xl border border-[#e8c8b8] bg-surface p-6 text-center"
              >
                <p className="font-semibold text-[#9b3e24]">{erreurFil}</p>
                <button
                  type="button"
                  onClick={() => void chargerPublications()}
                  className="mt-4 min-h-11 rounded-xl bg-brand px-5 font-bold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                >
                  Réessayer
                </button>
              </div>
            ) : publications.length === 0 ? (
              <div className="rounded-2xl border border-line-soft bg-surface p-8 text-center">
                <p className="text-lg font-bold text-ink">
                  Aucune publication dans ce fil pour le moment
                </p>
                <p className="mt-2 text-[#786958]">
                  Soyez la première personne à partager une demande ou une
                  proposition.
                </p>
              </div>
            ) : (
              publications.map((publication) => (
                <CartePublication
                  key={publication.id}
                  publication={publication}
                  onSupprime={retirerPublication}
                  actualiser={() => { void chargerPublications(true); }}
                  commentaireRestaure={commentaireRestaure?.publicationId === publication.id ? commentaireRestaure : null}
                />
              ))
            )}
          </section>
        </main>

        <div className="xl:sticky xl:top-[calc(var(--mw-header-h)+1.5rem)] xl:max-h-[calc(100dvh-160px)] xl:overflow-y-auto">
          <ColonneSuggestions
            suggestions={panneaux.suggestions}
            evenements={panneaux.evenements}
            chargement={chargementPanneaux}
            erreur={erreurPanneaux}
            reessayer={() => void chargerPanneaux()}
            actualiser={() => chargerPanneaux(true)}
          />
        </div>
      </div>
    </div>
  );
}

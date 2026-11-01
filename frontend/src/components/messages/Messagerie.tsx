"use client";

import { titreMembre } from "@/lib/titre-membre";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, Flag, MessageSquarePlus, Paperclip, Search, X } from "lucide-react";
import SignalerContenu from "@/components/community/SignalerContenu";
import ImageAvecRepli from "@/components/ui/ImageAvecRepli";
import PiecesJointes from "@/components/messages/PiecesJointes";
import ZoneSaisie, { type ZoneSaisieHandle } from "@/components/messages/ZoneSaisie";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import api from "@/lib/api";
import { urlMediaBackend } from "@/lib/media";
import { heureCourte, libellePresence, positionsMessages } from "@/lib/messagerie";
import { useSocket } from "@/hooks/useSocket";
import type {
  ConversationApi,
  ConversationDetailResponseApi,
  ConversationsResponseApi,
  MembreResumeApi,
  MembresRechercheResponseApi,
  MessageApi,
  PieceJointeApi,
  PresenceEvenementApi,
  UtilisateurConnecteResponseApi,
} from "@/types/api";

type TonAvatar = "vert" | "orange" | "sable";

type Interlocuteur = {
  id: string;
  nom: string;
  initiales: string;
  fonction: string;
  ville: string;
  ton: TonAvatar;
  photo: string | null;
  enLigne: boolean;
  derniereActiviteLe: string | null;
  /** Conversation de groupe : pas de profil unique ni de présence. */
  groupe: boolean;
};

type MessageLocal = {
  id: string;
  auteur: "moi" | "autre";
  contenu: string;
  envoyeLe: string;
  lu: boolean;
  pieces: PieceJointeApi[];
};

type ConversationLocale = {
  id: string;
  interlocuteur: Interlocuteur;
  apercu: string;
  apercuDeMoi: boolean;
  derniereActivite: string;
  nonLus: number;
  messages: MessageLocal[];
  detailCharge: boolean;
  hasMore: boolean;
  nextCursor?: string | null;
};

const TONS: Record<TonAvatar, string> = {
  vert: "bg-brand-50 text-brand",
  orange: "bg-clay/10 text-clay-ink",
  sable: "bg-surface-sunken text-ink-soft",
};

const PALETTE: TonAvatar[] = ["vert", "orange", "sable"];

function tonDepuisId(id: string): TonAvatar {
  const indice = Array.from(id).reduce((total, caractere) => total + caractere.charCodeAt(0), 0);
  return PALETTE[indice % PALETTE.length];
}

function initialesDe(prenom?: string | null, nom?: string | null, valeur?: string | null) {
  if (valeur?.trim()) return valeur.trim().slice(0, 3).toLocaleUpperCase("fr");
  const initiales = `${prenom?.trim().charAt(0) || ""}${nom?.trim().charAt(0) || ""}`;
  return initiales.toLocaleUpperCase("fr") || "?";
}

function membreVersInterlocuteur(membre: MembreResumeApi): Interlocuteur {
  const nomComplet = [membre.prenom, membre.nom].filter(Boolean).join(" ").trim();
  return {
    id: membre.id,
    nom: nomComplet || "Membre Mali Wuli",
    initiales: initialesDe(membre.prenom, membre.nom, membre.initiales),
    fonction: titreMembre(membre.titre),
    ville: membre.ville?.trim() || "",
    ton: tonDepuisId(membre.id),
    photo: urlMediaBackend(membre.photo),
    enLigne: Boolean(membre.enLigne),
    derniereActiviteLe: membre.derniereActiviteLe || null,
    groupe: false,
  };
}

function interlocuteurDe(conversation: Pick<ConversationApi, "id" | "titre" | "estGroupe" | "participants">): Interlocuteur {
  const participant = conversation.participants[0];
  if (!conversation.estGroupe && participant) return membreVersInterlocuteur(participant);

  const nom = conversation.titre?.trim()
    || conversation.participants.map(({ prenom, nom: nomFamille }) => [prenom, nomFamille].filter(Boolean).join(" ")).filter(Boolean).join(", ")
    || "Conversation";
  return {
    id: conversation.id,
    nom,
    initiales: initialesDe(undefined, undefined, nom.split(/\s+/).map((mot) => mot[0]).join("")),
    fonction: "Conversation de groupe",
    ville: `${conversation.participants.length + 1} membres`,
    ton: tonDepuisId(conversation.id),
    photo: null,
    enLigne: conversation.participants.some(({ enLigne }) => enLigne),
    derniereActiviteLe: null,
    groupe: true,
  };
}

const TAILLES_AVATAR = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-11 w-11 text-base sm:h-12 sm:w-12",
  xl: "h-20 w-20 text-2xl",
} as const;

function Avatar({ personne, taille = "md", presence = false }: { personne: Interlocuteur; taille?: keyof typeof TAILLES_AVATAR; presence?: boolean }) {
  const initiales = (
    <span className={`flex h-full w-full items-center justify-center rounded-full font-bold ${TONS[personne.ton]}`}>{personne.initiales}</span>
  );
  return (
    <span aria-hidden="true" className={`relative inline-flex shrink-0 ${TAILLES_AVATAR[taille]}`}>
      <ImageAvecRepli src={personne.photo} className="h-full w-full rounded-full object-cover" repli={initiales} />
      {presence && personne.enLigne && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#22a45d] ring-2 ring-surface-raised" />
      )}
    </span>
  );
}

const LONGUEUR_MIN_RECHERCHE = 2;

const normaliser = (valeur: string) =>
  valeur.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr");

/** Heure dans la liste : « 14:32 » aujourd'hui, « Hier », « lun. », puis la date. */
function heureListe(iso: string, maintenant = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((maintenant.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "À l’instant";
  const memeJour = date.toDateString() === maintenant.toDateString();
  if (memeJour) return heureCourte(date);
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (date.toDateString() === hier.toDateString()) return "Hier";
  if (minutes < 7 * 1_440) return new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

function texteErreur(erreur: unknown, secours: string) {
  const reponse = (erreur as { response?: { data?: { message?: unknown; error?: unknown } } })?.response?.data;
  if (typeof reponse?.message === "string") return reponse.message;
  if (typeof reponse?.error === "string") return reponse.error;
  return secours;
}

function messageLocalDe(message: MessageApi, profilId: string, forceMoi = false): MessageLocal {
  return {
    id: message.id,
    auteur: forceMoi || message.estMoi || message.auteur.id === profilId ? "moi" : "autre",
    contenu: message.contenu,
    envoyeLe: message.createdAt,
    lu: Boolean(message.lu),
    pieces: Array.isArray(message.piecesJointes) ? message.piecesJointes : [],
  };
}

function apercuDe(contenu: string, pieces: PieceJointeApi[]) {
  if (contenu.trim()) return contenu;
  if (!pieces.length) return "";
  const images = pieces.filter(({ estImage }) => estImage).length;
  if (images === pieces.length) return images > 1 ? `${images} photos` : "Photo";
  return pieces.length > 1 ? `${pieces.length} pièces jointes` : "Pièce jointe";
}

function conversationLocaleDe(conversation: ConversationApi, profilId: string, precedente?: ConversationLocale): ConversationLocale {
  const date = conversation.dernierMessage?.createdAt || conversation.updatedAt;
  return {
    id: conversation.id,
    interlocuteur: interlocuteurDe(conversation),
    apercu: conversation.dernierMessage?.contenu || "Nouvelle conversation",
    apercuDeMoi: Boolean(profilId) && conversation.dernierMessage?.auteurId === profilId,
    derniereActivite: date,
    nonLus: Math.max(0, Number(conversation.nonLus) || 0),
    messages: precedente?.messages || [],
    detailCharge: precedente?.detailCharge || false,
    hasMore: precedente?.hasMore || false,
    nextCursor: precedente?.nextCursor,
  };
}

const comparerActivite = (a: ConversationLocale, b: ConversationLocale) =>
  new Date(b.derniereActivite).getTime() - new Date(a.derniereActivite).getTime();

/** Liens de profil/offre issus des candidatures, sans HTML ni URL arbitraire. */
function ContenuMessage({ contenu }: { contenu: string }) {
  return <>{contenu.split(/(https?:\/\/[^\s<>]+)/g).map((partie, index) => {
    try {
      const url = new URL(partie);
      if (["mali-wuli.com", "www.mali-wuli.com"].includes(url.hostname) && !url.username && !url.password && (/^\/membres\/[^/]+$/.test(url.pathname) || url.pathname === "/offres")) {
        return <Link key={index} href={`${url.pathname}${url.search}${url.hash}`} className="font-semibold underline underline-offset-2 break-all">{url.pathname.startsWith("/membres/") ? "Voir le profil Mali Wuli" : "Voir l’offre"}</Link>;
      }
    } catch { /* texte ordinaire */ }
    return partie;
  })}</>;
}

function SqueletteListe() {
  return (
    <div aria-hidden="true" className="space-y-1 px-3 py-2">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl px-3 py-3">
          <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-line-soft" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded bg-line-soft" />
            <span className="block h-3 w-4/5 animate-pulse rounded bg-line-soft/70" />
          </span>
        </div>
      ))}
    </div>
  );
}

function SqueletteFil() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      {["w-2/5", "ml-auto w-1/3", "w-1/2", "ml-auto w-2/5", "w-1/4"].map((classe, index) => (
        <span key={index} className={`block h-11 animate-pulse rounded-3xl bg-line-soft/80 ${classe}`} />
      ))}
    </div>
  );
}

export default function Messagerie() {
  const parametres = useSearchParams();
  const conversationDemandee = parametres.get("conversation") || "";
  const socket = useSocket();
  const [conversations, setConversations] = useState<ConversationLocale[]>([]);
  const [conversationActiveId, setConversationActiveId] = useState("");
  const [messageASignaler, setMessageASignaler] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [nouveauMessage, setNouveauMessage] = useState(false);
  const [rechercheContact, setRechercheContact] = useState("");
  const [contacts, setContacts] = useState<Interlocuteur[]>([]);
  const [rechercheContactFaite, setRechercheContactFaite] = useState(false);
  const [conversationMobile, setConversationMobile] = useState(false);
  const [chargementConversations, setChargementConversations] = useState(true);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [chargementAnciens, setChargementAnciens] = useState(false);
  const [chargementContacts, setChargementContacts] = useState(false);
  const [creationConversation, setCreationConversation] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [progression, setProgression] = useState<number | null>(null);
  const [erreurConversations, setErreurConversations] = useState("");
  const [erreurDetail, setErreurDetail] = useState("");
  const [erreurContacts, setErreurContacts] = useState("");
  const [erreurEnvoi, setErreurEnvoi] = useState("");
  const [ecrit, setEcrit] = useState<Record<string, number>>({});
  const [survolFichiers, setSurvolFichiers] = useState(false);
  const [, setHorloge] = useState(0);
  const zoneSaisie = useRef<ZoneSaisieHandle>(null);
  const finMessages = useRef<HTMLDivElement>(null);
  const zoneDefilement = useRef<HTMLDivElement>(null);
  const contenuFil = useRef<HTMLDivElement>(null);
  const colleEnBas = useRef(true);
  const boutonNouvelleConversation = useRef<HTMLButtonElement>(null);
  const boutonConversationActive = useRef<HTMLButtonElement>(null);
  const profilId = useRef("");
  const activeId = useRef("");
  const conversationIds = useRef(new Set<string>());
  const messagesConnus = useRef(new Set<string>());
  const sequenceRecherche = useRef(0);
  const dernierSignalEcriture = useRef(0);
  const profondeurSurvol = useRef(0);

  useEffect(() => { activeId.current = conversationActiveId; }, [conversationActiveId]);
  useEffect(() => { conversationIds.current = new Set(conversations.map(({ id }) => id)); }, [conversations]);

  // Rafraîchit chaque minute les libellés relatifs (« Actif il y a 5 min »).
  useEffect(() => {
    const minuteur = window.setInterval(() => setHorloge((valeur) => valeur + 1), 60_000);
    return () => window.clearInterval(minuteur);
  }, []);

  const chargerProfil = useCallback(async () => {
    try {
      const { data } = await api.get<UtilisateurConnecteResponseApi>("/users/me");
      const utilisateur = data.user || data;
      const profil = data.profil || utilisateur.profil;
      profilId.current = profil?.id || "";
    } catch {
      profilId.current = "";
    }
  }, []);

  const chargerConversations = useCallback(async (selectionPreferee?: string) => {
    setErreurConversations("");
    try {
      const { data } = await api.get<ConversationsResponseApi>("/messages/conversations");
      const liste = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations((precedentes) => {
        const parId = new Map(precedentes.map((conversation) => [conversation.id, conversation]));
        return liste.map((conversation) => conversationLocaleDe(conversation, profilId.current, parId.get(conversation.id))).sort(comparerActivite);
      });
      setConversationActiveId((actuelle) => {
        const souhaitee = selectionPreferee || actuelle;
        if (souhaitee && liste.some(({ id }) => id === souhaitee)) return souhaitee;
        return liste[0]?.id || "";
      });
    } catch (erreur) {
      setErreurConversations(texteErreur(erreur, "Impossible de charger vos conversations."));
    } finally {
      setChargementConversations(false);
    }
  }, []);

  const chargerDetail = useCallback(async (conversationId: string, cursor?: string) => {
    if (!conversationId) return;
    if (cursor) setChargementAnciens(true);
    else {
      setChargementDetail(true);
      setErreurDetail("");
    }

    try {
      const { data } = await api.get<ConversationDetailResponseApi>(`/messages/conversations/${conversationId}`, {
        params: { limite: 40, ...(cursor ? { cursor } : {}) },
      });
      const messages = (Array.isArray(data.messages) ? data.messages : []).map((message) => {
        messagesConnus.current.add(message.id);
        return messageLocalDe(message, profilId.current);
      });
      setConversations((precedentes) => precedentes.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const existants = cursor ? conversation.messages : [];
        const ids = new Set(existants.map(({ id }) => id));
        const sansDoublon = messages.filter(({ id }) => !ids.has(id));
        return {
          ...conversation,
          interlocuteur: interlocuteurDe(data.conversation),
          messages: cursor ? [...sansDoublon, ...existants] : messages,
          detailCharge: true,
          nonLus: 0,
          hasMore: Boolean(data.hasMore),
          nextCursor: data.nextCursor || null,
        };
      }));
      window.dispatchEvent(new Event("mali-wuli:messages-lus"));
    } catch (erreur) {
      setErreurDetail(texteErreur(erreur, "Impossible de charger cette conversation."));
    } finally {
      setChargementDetail(false);
      setChargementAnciens(false);
    }
  }, []);

  useEffect(() => {
    void chargerProfil().then(() => chargerConversations(conversationDemandee));
    if (conversationDemandee) setConversationMobile(true);
  }, [chargerConversations, chargerProfil, conversationDemandee]);

  useEffect(() => {
    if (conversationActiveId) void chargerDetail(conversationActiveId);
  }, [chargerDetail, conversationActiveId]);

  const termeContact = rechercheContact.trim();
  const rechercheContactActive = termeContact.length >= LONGUEUR_MIN_RECHERCHE;

  useEffect(() => {
    if (!nouveauMessage) return;
    const numero = ++sequenceRecherche.current;
    if (!rechercheContactActive) {
      setContacts([]);
      setErreurContacts("");
      setChargementContacts(false);
      setRechercheContactFaite(false);
      return;
    }
    const mots = normaliser(termeContact).split(/\s+/).filter(Boolean);
    // Le backend cherche un seul terme dans le prénom OU le nom : on envoie le mot le plus long
    // puis on vérifie côté client que tous les mots saisis correspondent au prénom/nom.
    const motPrincipal = termeContact.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length)[0] || termeContact;
    setChargementContacts(true);
    setErreurContacts("");
    const temporisateur = window.setTimeout(async () => {
      try {
        const { data } = await api.get<MembresRechercheResponseApi>("/messages/membres/recherche", { params: { q: motPrincipal } });
        if (numero !== sequenceRecherche.current) return;
        const membres = (Array.isArray(data.membres) ? data.membres : []).filter((membre) => {
          const nomComplet = normaliser([membre.prenom, membre.nom].filter(Boolean).join(" "));
          return mots.every((mot) => nomComplet.includes(mot));
        });
        setContacts(membres.map(membreVersInterlocuteur));
      } catch (erreur) {
        if (numero !== sequenceRecherche.current) return;
        setContacts([]);
        setErreurContacts(texteErreur(erreur, "Impossible de rechercher les membres."));
      } finally {
        if (numero === sequenceRecherche.current) {
          setChargementContacts(false);
          setRechercheContactFaite(true);
        }
      }
    }, 250);
    return () => window.clearTimeout(temporisateur);
  }, [nouveauMessage, rechercheContactActive, termeContact]);

  // Suggestions sans saisie : les membres avec qui une conversation individuelle existe déjà.
  const contactsSuggeres = useMemo(() => {
    const vus = new Set<string>();
    return conversations
      .filter(({ interlocuteur }) => !interlocuteur.groupe)
      .map(({ interlocuteur }) => interlocuteur)
      .filter(({ id }) => (vus.has(id) ? false : (vus.add(id), true)))
      .slice(0, 6);
  }, [conversations]);

  const contactsAffiches = rechercheContactActive ? contacts : contactsSuggeres;
  const conversationActive = conversations.find(({ id }) => id === conversationActiveId);

  const conversationsFiltrees = useMemo(() => {
    const terme = normaliser(recherche.trim());
    if (!terme) return conversations;
    return conversations.filter(({ interlocuteur, apercu }) =>
      normaliser([interlocuteur.nom, interlocuteur.fonction, interlocuteur.ville, apercu].join(" ")).includes(terme),
    );
  }, [conversations, recherche]);

  useEffect(() => {
    colleEnBas.current = true;
    finMessages.current?.scrollIntoView({ block: "end" });
  }, [conversationActiveId, conversationActive?.messages.length]);

  // Les images se chargent après le texte : on reste collé en bas tant que le
  // membre n'est pas remonté lire des messages plus anciens.
  useEffect(() => {
    const zone = zoneDefilement.current;
    const contenu = contenuFil.current;
    if (!zone || !contenu || typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(() => {
      if (colleEnBas.current) zone.scrollTop = zone.scrollHeight;
    });
    observateur.observe(contenu);
    return () => observateur.disconnect();
  }, [conversationActiveId, conversationActive?.detailCharge]);

  const ouvrirConversation = (id: string) => {
    setConversationActiveId(id);
    setConversationMobile(true);
    setNouveauMessage(false);
    setErreurEnvoi("");
    setConversations((precedentes) =>
      precedentes.map((conversation) => conversation.id === id ? { ...conversation, nonLus: 0 } : conversation),
    );
    window.setTimeout(() => zoneSaisie.current?.focus(), 0);
  };

  const choisirContact = async (contact: Interlocuteur) => {
    if (creationConversation) return;
    setCreationConversation(true);
    setErreurContacts("");
    try {
      const { data } = await api.post<{ conversationId: string }>("/messages/conversations", { destinataireId: contact.id });
      setRechercheContact("");
      setNouveauMessage(false);
      setConversationActiveId(data.conversationId);
      setConversationMobile(true);
      await chargerConversations(data.conversationId);
      window.setTimeout(() => zoneSaisie.current?.focus(), 0);
    } catch (erreur) {
      setErreurContacts(texteErreur(erreur, "Impossible de démarrer cette conversation."));
    } finally {
      setCreationConversation(false);
    }
  };

  const ajouterMessage = useCallback((message: MessageApi, forceMoi = false) => {
    if (!message?.id || !message.conversationId || messagesConnus.current.has(message.id)) return false;
    messagesConnus.current.add(message.id);
    const local = messageLocalDe(message, profilId.current, forceMoi);
    const conversationTrouvee = conversationIds.current.has(message.conversationId);
    setConversations((precedentes) => {
      const miseAJour = precedentes.map((conversation) => {
        if (conversation.id !== message.conversationId) return conversation;
        const estActive = activeId.current === conversation.id;
        return {
          ...conversation,
          apercu: apercuDe(local.contenu, local.pieces),
          apercuDeMoi: local.auteur === "moi",
          derniereActivite: message.createdAt,
          nonLus: local.auteur === "autre" && !estActive ? conversation.nonLus + 1 : 0,
          messages: conversation.detailCharge ? [...conversation.messages, local] : conversation.messages,
        };
      });
      return miseAJour.sort(comparerActivite);
    });
    if (local.auteur === "autre") setEcrit((precedent) => ({ ...precedent, [message.conversationId]: 0 }));
    if (!conversationTrouvee) void chargerConversations(message.conversationId);
    return true;
  }, [chargerConversations]);

  useEffect(() => {
    if (!socket) return;

    const recevoirMessage = (message: MessageApi) => {
      const ajoute = ajouterMessage(message);
      if (!ajoute) return;
      if (activeId.current === message.conversationId && message.auteur.id !== profilId.current) {
        void api.get(`/messages/conversations/${message.conversationId}`, { params: { limite: 1 } })
          .then(() => window.dispatchEvent(new Event("mali-wuli:messages-lus")))
          .catch(() => undefined);
      }
    };
    const resynchroniser = () => {
      void chargerConversations(activeId.current || undefined);
      if (activeId.current) void chargerDetail(activeId.current);
    };
    // L'interlocuteur arrive ou part : « En ligne » ou dernière activité.
    const majPresence = (evenement: PresenceEvenementApi) => {
      setConversations((precedentes) => precedentes.map((conversation) =>
        !conversation.interlocuteur.groupe && conversation.interlocuteur.id === evenement.profilId
          ? { ...conversation, interlocuteur: { ...conversation.interlocuteur, enLigne: evenement.enLigne, derniereActiviteLe: evenement.derniereActiviteLe || conversation.interlocuteur.derniereActiviteLe } }
          : conversation));
    };
    // L'interlocuteur a lu : « Vu » sous mes messages.
    const messagesLus = (evenement: { conversationId: string; profilId: string }) => {
      if (evenement.profilId === profilId.current) return;
      setConversations((precedentes) => precedentes.map((conversation) =>
        conversation.id === evenement.conversationId
          ? { ...conversation, messages: conversation.messages.map((message) => message.auteur === "moi" ? { ...message, lu: true } : message) }
          : conversation));
    };
    const interlocuteurEcrit = (evenement: { conversationId: string; profilId: string }) => {
      if (evenement.profilId === profilId.current) return;
      setEcrit((precedent) => ({ ...precedent, [evenement.conversationId]: Date.now() }));
    };

    socket.on("nouveau_message", recevoirMessage);
    socket.on("message:created", recevoirMessage);
    socket.on("connect", resynchroniser);
    socket.on("presence", majPresence);
    socket.on("messages_lus", messagesLus);
    socket.on("interlocuteur_ecrit", interlocuteurEcrit);
    return () => {
      socket.off("nouveau_message", recevoirMessage);
      socket.off("message:created", recevoirMessage);
      socket.off("connect", resynchroniser);
      socket.off("presence", majPresence);
      socket.off("messages_lus", messagesLus);
      socket.off("interlocuteur_ecrit", interlocuteurEcrit);
    };
  }, [ajouterMessage, chargerConversations, chargerDetail, socket]);

  useEffect(() => {
    if (!socket || !conversationActiveId) return;
    socket.emit("rejoindre_conversation", conversationActiveId);
    return () => { socket.emit("quitter_conversation", conversationActiveId); };
  }, [conversationActiveId, socket]);

  // « écrit… » disparaît après 4 secondes sans nouveau signal.
  const ecritDepuis = conversationActive ? ecrit[conversationActive.id] || 0 : 0;
  useEffect(() => {
    if (!ecritDepuis) return;
    const minuteur = window.setTimeout(() => setEcrit((precedent) => ({ ...precedent })), 4_100);
    return () => window.clearTimeout(minuteur);
  }, [ecritDepuis]);
  const interlocuteurEcrit = ecritDepuis > 0 && Date.now() - ecritDepuis < 4_000;

  const signalerEcriture = () => {
    setErreurEnvoi("");
    if (!socket || !conversationActive) return;
    const maintenant = Date.now();
    if (maintenant - dernierSignalEcriture.current < 2_500) return;
    dernierSignalEcriture.current = maintenant;
    socket.emit("en_train_decrire", { conversationId: conversationActive.id });
  };

  const envoyer = async (contenu: string, fichiers: File[]) => {
    if ((!contenu && !fichiers.length) || !conversationActive || envoiEnCours) return false;
    setEnvoiEnCours(true);
    setErreurEnvoi("");
    try {
      let reponse;
      if (fichiers.length) {
        const formulaire = new FormData();
        if (contenu) formulaire.append("contenu", contenu);
        fichiers.forEach((fichier) => formulaire.append("fichiers", fichier, fichier.name));
        setProgression(0);
        reponse = await api.post<{ message: MessageApi }>(`/messages/conversations/${conversationActive.id}/messages`, formulaire, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (evenement) => {
            if (evenement.total) setProgression(Math.min(99, Math.round((evenement.loaded / evenement.total) * 100)));
          },
        });
      } else {
        reponse = await api.post<{ message: MessageApi }>(`/messages/conversations/${conversationActive.id}/messages`, { contenu });
      }
      ajouterMessage(reponse.data.message, true);
      return true;
    } catch (erreur) {
      setErreurEnvoi(texteErreur(erreur, "Votre message n’a pas pu être envoyé. Vérifiez votre connexion puis réessayez."));
      return false;
    } finally {
      setEnvoiEnCours(false);
      setProgression(null);
    }
  };

  // Glisser-déposer de fichiers sur la conversation.
  const contientFichiers = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");
  const entreeSurvol = (event: DragEvent) => {
    if (!contientFichiers(event)) return;
    event.preventDefault();
    profondeurSurvol.current += 1;
    setSurvolFichiers(true);
  };
  const sortieSurvol = (event: DragEvent) => {
    if (!contientFichiers(event)) return;
    profondeurSurvol.current = Math.max(0, profondeurSurvol.current - 1);
    if (profondeurSurvol.current === 0) setSurvolFichiers(false);
  };
  const deposer = (event: DragEvent) => {
    if (!contientFichiers(event)) return;
    event.preventDefault();
    profondeurSurvol.current = 0;
    setSurvolFichiers(false);
    zoneSaisie.current?.ajouterFichiers(Array.from(event.dataTransfer.files));
  };

  const positions = useMemo(() => positionsMessages(conversationActive?.messages || []), [conversationActive?.messages]);
  const dernierMessageLuDeMoi = useMemo(() => {
    const messages = conversationActive?.messages || [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].auteur === "moi") return messages[index].lu ? messages[index].id : null;
    }
    return null;
  }, [conversationActive?.messages]);

  const presence = conversationActive
    ? conversationActive.interlocuteur.groupe
      ? conversationActive.interlocuteur.ville
      : libellePresence(conversationActive.interlocuteur.enLigne, conversationActive.interlocuteur.derniereActiviteLe)
    : null;

  return (
    <section
      aria-label="Messagerie"
      className="flex h-[calc(100dvh-var(--mw-header-h)-64px)] min-h-[320px] overflow-hidden border-t border-line-soft bg-page lg:h-[calc(100dvh-var(--mw-header-h))]"
    >
      <aside
        aria-label="Conversations"
        className={`${conversationMobile ? "hidden md:flex" : "flex"} min-w-0 w-full shrink-0 flex-col border-r border-line-soft bg-surface md:w-[340px] xl:w-[380px]`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-5 sm:px-5">
          <h1 className="font-display text-2xl font-bold leading-none text-ink sm:text-[1.75rem]">Messages</h1>
          <button
            ref={boutonNouvelleConversation}
            type="button"
            onClick={() => { setNouveauMessage(true); setRechercheContact(""); }}
            aria-label="Nouveau message"
            title="Nouveau message"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white shadow-card transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <MessageSquarePlus size={19} aria-hidden="true" />
          </button>
        </div>

        {nouveauMessage ? (
          <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-4">
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
              <h2 className="text-sm font-semibold text-ink">Nouveau message</h2>
              <button
                type="button"
                onClick={() => { setNouveauMessage(false); window.setTimeout(() => boutonNouvelleConversation.current?.focus(), 0); }}
                aria-label="Annuler le nouveau message"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-sunken hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <label className="relative block">
              <span className="sr-only">Rechercher un destinataire</span>
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                name="destinataire"
                autoFocus
                value={rechercheContact}
                onChange={(event) => setRechercheContact(event.target.value)}
                placeholder="Nom ou prénom d’un membre"
                className="h-11 w-full rounded-full border border-line bg-surface-sunken pl-10 pr-4 text-[15px] text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/15"
              />
            </label>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-live="polite">
              {chargementContacts ? (
                <SqueletteListe />
              ) : erreurContacts ? (
                <p className="px-3 py-8 text-center text-sm font-medium text-danger" role="alert">{erreurContacts}</p>
              ) : contactsAffiches.length ? (
                <>
                  {!rechercheContactActive && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Contacts récents</p>}
                  {contactsAffiches.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      disabled={creationConversation}
                      onClick={() => void choisirContact(contact)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand disabled:opacity-60"
                    >
                      <Avatar personne={contact} taille="sm" />
                      <span className="min-w-0">
                        <strong className="block truncate text-[15px] font-semibold text-ink">{contact.nom}</strong>
                        <span className="block truncate text-[13px] text-ink-muted">{[contact.fonction, contact.ville].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  ))}
                </>
              ) : rechercheContactActive && rechercheContactFaite ? (
                <p className="px-3 py-8 text-center text-sm text-ink-muted">Aucun membre trouvé.</p>
              ) : (
                <p className="px-3 py-8 text-center text-sm text-ink-muted">Tapez au moins 2 lettres du nom.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <label className="relative mx-3 mb-2 block sm:mx-4">
              <span className="sr-only">Rechercher une conversation</span>
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                name="recherche-conversations"
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="Rechercher"
                className="h-11 w-full rounded-full border border-line bg-surface-sunken pl-10 pr-4 text-[15px] text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/15"
              />
            </label>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3" aria-label="Liste des conversations" aria-busy={chargementConversations}>
              {chargementConversations ? (
                <SqueletteListe />
              ) : erreurConversations ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-medium text-danger" role="alert">{erreurConversations}</p>
                  <button type="button" onClick={() => void chargerConversations()} className="mt-3 min-h-10 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">Réessayer</button>
                </div>
              ) : conversationsFiltrees.length ? (
                <ul className="space-y-0.5">
                  {conversationsFiltrees.map((conversation) => {
                    const active = conversation.id === conversationActiveId;
                    const nonLu = conversation.nonLus > 0;
                    return (
                      <li key={conversation.id}>
                        <button
                          ref={active ? boutonConversationActive : undefined}
                          type="button"
                          aria-current={active ? "true" : undefined}
                          onClick={() => ouvrirConversation(conversation.id)}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${active ? "bg-brand-50" : "hover:bg-surface-sunken"}`}
                        >
                          <Avatar personne={conversation.interlocuteur} presence />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <strong className={`min-w-0 flex-1 truncate text-[15px] ${nonLu ? "font-bold text-ink" : "font-semibold text-ink"}`}>{conversation.interlocuteur.nom}</strong>
                              <span className={`shrink-0 text-xs ${nonLu ? "font-semibold text-brand" : "text-ink-muted"}`}>{heureListe(conversation.derniereActivite)}</span>
                            </span>
                            <span className="mt-0.5 flex items-center gap-2">
                              <span className={`min-w-0 flex-1 truncate text-[13px] ${nonLu ? "font-semibold text-ink-soft" : "text-ink-muted"}`}>
                                {ecrit[conversation.id] && Date.now() - ecrit[conversation.id] < 4_000
                                  ? <span className="italic text-brand">écrit…</span>
                                  : <>{conversation.apercuDeMoi && <span className="text-ink-muted">Vous : </span>}{conversation.apercu}</>}
                              </span>
                              {nonLu && <span className="sr-only">, {conversation.nonLus} non lu{conversation.nonLus > 1 ? "s" : ""}</span>}
                              {nonLu && (
                                <span aria-hidden="true" className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                                  {conversation.nonLus > 99 ? "99+" : conversation.nonLus}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-ink-muted">
                    {conversations.length ? "Aucune conversation ne correspond à votre recherche." : "Vous n’avez pas encore de conversation."}
                  </p>
                  {!conversations.length && (
                    <button type="button" onClick={() => { setNouveauMessage(true); setRechercheContact(""); }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
                      <MessageSquarePlus size={16} aria-hidden="true" />Écrire à un membre
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {conversationActive ? (
        <article
          aria-label={`Conversation avec ${conversationActive.interlocuteur.nom}`}
          onDragEnter={entreeSurvol}
          onDragOver={(event) => { if (contientFichiers(event)) event.preventDefault(); }}
          onDragLeave={sortieSurvol}
          onDrop={deposer}
          className={`${conversationMobile ? "flex" : "hidden md:flex"} relative min-w-0 flex-1 flex-col bg-page`}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line-soft bg-surface-raised/95 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3">
            <button
              type="button"
              aria-label="Revenir aux conversations"
              onClick={() => { setConversationMobile(false); window.setTimeout(() => boutonConversationActive.current?.focus(), 0); }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:hidden"
            >
              <ArrowLeft aria-hidden="true" size={21} />
            </button>
            <Avatar personne={conversationActive.interlocuteur} taille="lg" presence />
            <div className="min-w-0 flex-1">
              {conversationActive.interlocuteur.groupe ? (
                <h2 className="truncate text-base font-semibold text-ink sm:text-[17px]">{conversationActive.interlocuteur.nom}</h2>
              ) : (
                <h2 className="truncate text-base font-semibold text-ink sm:text-[17px]">
                  <Link href={`/membres/${encodeURIComponent(conversationActive.interlocuteur.id)}`} className="rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                    {conversationActive.interlocuteur.nom}
                  </Link>
                </h2>
              )}
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-muted" aria-live="polite">
                {interlocuteurEcrit ? (
                  <span className="font-medium text-brand">écrit…</span>
                ) : presence ? (
                  <>
                    {conversationActive.interlocuteur.enLigne && !conversationActive.interlocuteur.groupe && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#22a45d]" />}
                    <span className={`truncate ${conversationActive.interlocuteur.enLigne ? "font-medium text-[#1b7d47]" : ""}`}>{presence}</span>
                    {!conversationActive.interlocuteur.groupe && conversationActive.interlocuteur.fonction && (
                      <span className="hidden truncate sm:inline">· {conversationActive.interlocuteur.fonction}</span>
                    )}
                  </>
                ) : (
                  <span className="truncate">{[conversationActive.interlocuteur.fonction, conversationActive.interlocuteur.ville].filter(Boolean).join(" · ")}</span>
                )}
              </p>
            </div>
          </header>

          <div
            ref={zoneDefilement}
            onScroll={(event) => {
              const zone = event.currentTarget;
              colleEnBas.current = zone.scrollHeight - zone.scrollTop - zone.clientHeight < 80;
            }}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {chargementDetail && !conversationActive.detailCharge ? (
              <SqueletteFil />
            ) : erreurDetail && !conversationActive.detailCharge ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-medium text-danger" role="alert">{erreurDetail}</p>
                <button type="button" onClick={() => void chargerDetail(conversationActive.id)} className="mt-3 min-h-10 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">Réessayer</button>
              </div>
            ) : conversationActive.messages.length ? (
              <div ref={contenuFil} className="mx-auto w-full max-w-3xl px-3 py-5 sm:px-6 sm:py-6" role="log" aria-live="polite" aria-relevant="additions">
                {conversationActive.hasMore && conversationActive.nextCursor && (
                  <div className="mb-4 text-center">
                    <button
                      type="button"
                      disabled={chargementAnciens}
                      onClick={() => void chargerDetail(conversationActive.id, conversationActive.nextCursor || undefined)}
                      className="min-h-9 rounded-full border border-line bg-surface-raised px-4 text-[13px] font-semibold text-ink-soft transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                    >
                      {chargementAnciens ? "Chargement…" : "Messages précédents"}
                    </button>
                  </div>
                )}
                {conversationActive.messages.map((message, index) => {
                  const position = positions[index];
                  const deMoi = message.auteur === "moi";
                  const angles = deMoi
                    ? `rounded-[20px] ${position.debutGroupe ? "" : "rounded-tr-md"} ${position.finGroupe ? "" : "rounded-br-md"}`
                    : `rounded-[20px] ${position.debutGroupe ? "" : "rounded-tl-md"} ${position.finGroupe ? "" : "rounded-bl-md"}`;
                  return (
                    <div key={message.id}>
                      {position.separateurJour && (
                        <div className="my-5 flex items-center gap-3" role="separator" aria-label={position.separateurJour}>
                          <span className="h-px flex-1 bg-line-soft" />
                          <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold text-ink-muted ring-1 ring-line-soft">{position.separateurJour}</span>
                          <span className="h-px flex-1 bg-line-soft" />
                        </div>
                      )}
                      <div className={`group flex items-end gap-2 ${deMoi ? "justify-end" : "justify-start"} ${position.debutGroupe ? "mt-3" : "mt-0.5"}`}>
                        {!deMoi && (
                          <span className="w-8 shrink-0">
                            {position.finGroupe && <Avatar personne={conversationActive.interlocuteur} taille="sm" />}
                          </span>
                        )}
                        <div className={`flex min-w-0 max-w-[82%] flex-col gap-1.5 sm:max-w-[70%] ${deMoi ? "items-end" : "items-start"}`}>
                          {message.pieces.length > 0 && <PiecesJointes pieces={message.pieces} deMoi={deMoi} />}
                          {message.contenu && (
                            <p className={`min-w-0 whitespace-pre-wrap px-4 py-2.5 text-[15px] leading-relaxed [overflow-wrap:anywhere] ${angles} ${
                              deMoi ? "bg-brand text-white shadow-card" : "bg-surface-raised text-ink shadow-card ring-1 ring-line-soft"
                            }`}>
                              <ContenuMessage contenu={message.contenu} />
                            </p>
                          )}
                          {position.finGroupe && (
                            <span className="flex items-center gap-1.5 px-1 text-[11px] text-ink-muted">
                              <time dateTime={message.envoyeLe}>{heureCourte(new Date(message.envoyeLe))}</time>
                              {deMoi && (message.id === dernierMessageLuDeMoi
                                ? <span className="inline-flex items-center gap-0.5 font-medium text-brand"><CheckCheck size={13} aria-hidden="true" />Vu</span>
                                : <Check size={13} aria-label="Envoyé" />)}
                            </span>
                          )}
                        </div>
                        {!deMoi && (
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-label={`Signaler ce message de ${conversationActive.interlocuteur.nom}`}
                            title="Signaler ce message"
                            onClick={() => setMessageASignaler(message.id)}
                            className="mb-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted opacity-0 transition hover:bg-surface-sunken hover:text-danger focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand group-hover:opacity-100 [@media(hover:none)]:opacity-60"
                          >
                            <Flag aria-hidden="true" size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {interlocuteurEcrit && (
                  <div className="mt-3 flex items-end gap-2" aria-hidden="true">
                    <span className="w-8 shrink-0"><Avatar personne={conversationActive.interlocuteur} taille="sm" /></span>
                    <span className="flex gap-1 rounded-[20px] bg-surface-raised px-4 py-3.5 shadow-card ring-1 ring-line-soft">
                      {[0, 150, 300].map((delai) => <span key={delai} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted/70" style={{ animationDelay: `${delai}ms` }} />)}
                    </span>
                  </div>
                )}
                <div ref={finMessages} />
              </div>
            ) : (
              <div className="flex h-full min-h-48 items-center justify-center px-6 text-center">
                <div className="max-w-sm">
                  <span className="inline-flex"><Avatar personne={conversationActive.interlocuteur} taille="xl" /></span>
                  <p className="mt-4 font-display text-xl font-bold text-ink">{conversationActive.interlocuteur.nom}</p>
                  {conversationActive.interlocuteur.fonction && <p className="mt-1 text-sm text-ink-muted">{conversationActive.interlocuteur.fonction}</p>}
                  <p className="mt-5 text-[15px] text-ink-soft">Présentez-vous en quelques mots : un bon premier message dit qui vous êtes et ce que vous cherchez.</p>
                </div>
              </div>
            )}
          </div>

          <ZoneSaisie
            ref={zoneSaisie}
            nomInterlocuteur={conversationActive.interlocuteur.nom}
            envoiEnCours={envoiEnCours}
            progression={progression}
            erreur={erreurEnvoi}
            onEnvoyer={envoyer}
            onSaisie={signalerEcriture}
          />

          {survolFichiers && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand bg-surface/90 text-brand backdrop-blur-sm">
              <Paperclip size={28} />
              <p className="font-semibold">Déposez vos fichiers pour les joindre</p>
              <p className="text-sm text-ink-muted">Images, PDF, documents · 10 Mo maximum</p>
            </div>
          )}
        </article>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-3 px-6 text-center md:flex">
          {chargementConversations ? (
            <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
          ) : (
            <>
              <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><MessageSquarePlus size={26} /></span>
              <p className="font-display text-xl font-bold text-ink">Vos messages</p>
              <p className="max-w-xs text-sm text-ink-muted">Choisissez une conversation ou écrivez à un membre du réseau.</p>
            </>
          )}
        </div>
      )}
      <SignalerContenu
        ouvert={Boolean(messageASignaler)}
        onFermer={() => setMessageASignaler(null)}
        cibleType="MESSAGE"
        cibleId={messageASignaler || ""}
        libelleCible="ce message"
      />
    </section>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ArrowLeft, Flag, Send } from "lucide-react";
import SignalerContenu from "@/components/community/SignalerContenu";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import type {
  ConversationApi,
  ConversationDetailResponseApi,
  ConversationsResponseApi,
  MembreResumeApi,
  MembresRechercheResponseApi,
  MessageApi,
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
};

type MessageLocal = {
  id: string;
  auteur: "moi" | "autre";
  contenu: string;
  horodatage: string;
  envoyeLe: string;
};

type ConversationLocale = {
  id: string;
  interlocuteur: Interlocuteur;
  apercu: string;
  heure: string;
  derniereActivite: string;
  nonLus: number;
  messages: MessageLocal[];
  detailCharge: boolean;
  hasMore: boolean;
  nextCursor?: string | null;
};

const TONS: Record<TonAvatar, string> = {
  vert: "bg-[#e4f1ea] text-[#0d6738]",
  orange: "bg-[#f7e5d8] text-[#bd592d]",
  sable: "bg-[#efe4d1] text-[#705136]",
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
    fonction: membre.titre?.trim() || "Membre du réseau",
    ville: membre.ville?.trim() || "Ville non renseignée",
    ton: tonDepuisId(membre.id),
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
  };
}

function Avatar({ personne, grand = false }: { personne: Interlocuteur; grand?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${TONS[personne.ton]} ${grand ? "h-14 w-14 text-lg sm:h-16 sm:w-16 sm:text-xl" : "h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg"}`}
    >
      {personne.initiales}
    </span>
  );
}

const LONGUEUR_MIN_RECHERCHE = 2;

const normaliser = (valeur: string) =>
  valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const heureDe = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" })
    .format(date)
    .replace(":", " h ");

const horodatageDe = (iso: string, maintenant = new Date()) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (memeJour(date, maintenant)) return `aujourd’hui, ${heureDe(date)}`;
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (memeJour(date, hier)) return `hier, ${heureDe(date)}`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
};

const heureConversationDe = (iso: string, maintenant = new Date()) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const ecartMinutes = Math.max(0, Math.floor((maintenant.getTime() - date.getTime()) / 60_000));
  if (ecartMinutes < 2) return "maintenant";
  if (memeJour(date, maintenant)) return heureDe(date);
  const ecartJours = Math.max(1, Math.floor(ecartMinutes / 1_440));
  return `${ecartJours} j`;
};

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
    horodatage: horodatageDe(message.createdAt),
    envoyeLe: message.createdAt,
  };
}

function conversationLocaleDe(conversation: ConversationApi, precedente?: ConversationLocale): ConversationLocale {
  const date = conversation.dernierMessage?.createdAt || conversation.updatedAt;
  return {
    id: conversation.id,
    interlocuteur: interlocuteurDe(conversation),
    apercu: conversation.dernierMessage?.contenu || "Nouvelle conversation",
    heure: heureConversationDe(date),
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
  return <>{contenu.split(/(https?:\/\/[^\s<>]+)/g).map((partie,index)=>{
    try { const url=new URL(partie); if(["mali-wuli.com","www.mali-wuli.com"].includes(url.hostname) && !url.username && !url.password && ( /^\/membres\/[^/]+$/.test(url.pathname) || url.pathname === "/offres")) {
      return <Link key={index} href={`${url.pathname}${url.search}${url.hash}`} className="underline underline-offset-2 break-all">{url.pathname.startsWith('/membres/')?'Voir le profil Mali Wuli':'Voir l’offre'}</Link>;
    }}catch{}
    return partie;
  })}</>;
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
  const [contenu, setContenu] = useState("");
  const [conversationMobile, setConversationMobile] = useState(false);
  const [chargementConversations, setChargementConversations] = useState(true);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [chargementAnciens, setChargementAnciens] = useState(false);
  const [chargementContacts, setChargementContacts] = useState(false);
  const [creationConversation, setCreationConversation] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurConversations, setErreurConversations] = useState("");
  const [erreurDetail, setErreurDetail] = useState("");
  const [erreurContacts, setErreurContacts] = useState("");
  const [erreurEnvoi, setErreurEnvoi] = useState("");
  const champMessage = useRef<HTMLTextAreaElement>(null);
  const finMessages = useRef<HTMLDivElement>(null);
  const boutonNouvelleConversation = useRef<HTMLButtonElement>(null);
  const boutonConversationActive = useRef<HTMLButtonElement>(null);
  const profilId = useRef("");
  const activeId = useRef("");
  const conversationIds = useRef(new Set<string>());
  const messagesConnus = useRef(new Set<string>());
  const sequenceRecherche = useRef(0);

  useEffect(() => {
    activeId.current = conversationActiveId;
  }, [conversationActiveId]);

  useEffect(() => {
    conversationIds.current = new Set(conversations.map(({ id }) => id));
  }, [conversations]);

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
        return liste.map((conversation) => conversationLocaleDe(conversation, parId.get(conversation.id))).sort(comparerActivite);
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
    void Promise.all([chargerProfil(), chargerConversations(conversationDemandee)]);
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
        const { data } = await api.get<MembresRechercheResponseApi>("/messages/membres/recherche", {
          params: { q: motPrincipal },
        });
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
      .filter(({ id, interlocuteur }) => interlocuteur.id !== id)
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
    finMessages.current?.scrollIntoView({ block: "end" });
  }, [conversationActiveId, conversationActive?.messages.length]);

  const ouvrirConversation = (id: string) => {
    setConversationActiveId(id);
    setConversationMobile(true);
    setNouveauMessage(false);
    setConversations((precedentes) =>
      precedentes.map((conversation) => conversation.id === id ? { ...conversation, nonLus: 0 } : conversation),
    );
    window.setTimeout(() => champMessage.current?.focus(), 0);
  };

  const choisirContact = async (contact: Interlocuteur) => {
    if (creationConversation) return;
    setCreationConversation(true);
    setErreurContacts("");
    try {
      const { data } = await api.post<{ conversationId: string }>("/messages/conversations", {
        destinataireId: contact.id,
      });
      setRechercheContact("");
      setNouveauMessage(false);
      setConversationActiveId(data.conversationId);
      setConversationMobile(true);
      await chargerConversations(data.conversationId);
      window.setTimeout(() => champMessage.current?.focus(), 0);
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
          apercu: message.contenu,
          heure: "maintenant",
          derniereActivite: message.createdAt,
          nonLus: local.auteur === "autre" && !estActive ? conversation.nonLus + 1 : 0,
          messages: conversation.detailCharge ? [...conversation.messages, local] : conversation.messages,
        };
      });
      return miseAJour.sort(comparerActivite);
    });
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

    socket.on("nouveau_message", recevoirMessage);
    socket.on("message:created", recevoirMessage);
    socket.on("connect", resynchroniser);
    return () => {
      socket.off("nouveau_message", recevoirMessage);
      socket.off("message:created", recevoirMessage);
      socket.off("connect", resynchroniser);
    };
  }, [ajouterMessage, chargerConversations, chargerDetail, socket]);

  useEffect(() => {
    if (!socket || !conversationActiveId) return;
    socket.emit("rejoindre_conversation", conversationActiveId);
    return () => {
      socket.emit("quitter_conversation", conversationActiveId);
    };
  }, [conversationActiveId, socket]);

  const envoyer = async (event?: FormEvent) => {
    event?.preventDefault();
    const texte = contenu.trim();
    if (!texte || !conversationActive || envoiEnCours) return;

    setEnvoiEnCours(true);
    setErreurEnvoi("");
    try {
      const { data } = await api.post<{ message: MessageApi }>(`/messages/conversations/${conversationActive.id}/messages`, {
        contenu: texte,
      });
      ajouterMessage(data.message, true);
      setContenu("");
      if (champMessage.current) champMessage.current.style.height = "56px";
      window.setTimeout(() => champMessage.current?.focus(), 0);
    } catch (erreur) {
      setErreurEnvoi(texteErreur(erreur, "Votre message n’a pas pu être envoyé."));
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const gererClavier = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void envoyer();
    }
  };

  return (
    <section
      aria-label="Messagerie"
      className="flex h-[calc(100dvh-156px)] min-h-[320px] overflow-hidden border-t border-[#eadfce] bg-[var(--color-page)] sm:h-[calc(100dvh-176px)] md:h-[calc(100dvh-96px)] lg:h-[calc(100dvh-112px)]"
    >
      <aside
        aria-label="Conversations"
        className={`${conversationMobile ? "hidden md:flex" : "flex"} min-w-0 w-full shrink-0 flex-col border-r border-[#eadfce] bg-[#fffaf3] md:w-[350px] xl:w-[480px]`}
      >
        <div className="flex min-h-[86px] items-center justify-between gap-2 px-3 py-4 min-[360px]:gap-3 min-[360px]:px-4 sm:px-6">
          <h1 className="font-display text-2xl font-bold leading-none text-[#292119] min-[360px]:text-3xl sm:text-4xl">Messages</h1>
          <button
            ref={boutonNouvelleConversation}
            type="button"
            onClick={() => {
              setNouveauMessage(true);
              setRechercheContact("");
            }}
            className="min-h-12 shrink-0 rounded-xl bg-[#0d6738] px-3 py-3 text-xs font-bold text-white transition hover:bg-[#09572f] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 min-[360px]:px-4 min-[360px]:text-sm sm:px-5 sm:text-base"
          >
            Nouveau message
          </button>
        </div>

        {nouveauMessage ? (
          <div className="min-h-0 flex-1 px-4 pb-4 sm:px-6">
            <section className="flex max-h-full min-h-0 flex-col rounded-2xl border border-[#eadfce] bg-[#fffdf9] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="titre-element">À qui écrivez-vous ?</h2>
                <button
                  type="button"
                  onClick={() => {
                    setNouveauMessage(false);
                    window.setTimeout(() => boutonNouvelleConversation.current?.focus(), 0);
                  }}
                  className="min-h-11 rounded-lg px-2 font-semibold text-[#978775] hover:text-[#2d241d] focus:outline-none focus:ring-2 focus:ring-[#0d6738]"
                >
                  Annuler
                </button>
              </div>
              <label className="relative mt-3 block">
                <span className="sr-only">Rechercher un destinataire</span>
                <input
                  type="search"
                  autoFocus
                  value={rechercheContact}
                  onChange={(event) => setRechercheContact(event.target.value)}
                  placeholder="Nom ou prénom d’un membre"
                  className="h-14 w-full rounded-full border border-[#eee3d0] bg-[#f4ecdc] px-5 text-base text-[#2d241d] outline-none placeholder:text-[#8f8b86] focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20 sm:text-lg"
                />
              </label>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-live="polite">
                {chargementContacts ? (
                  <p className="px-3 py-8 text-center text-sm text-[#887764]">Recherche des membres…</p>
                ) : erreurContacts ? (
                  <p className="px-3 py-8 text-center text-sm font-medium text-[#bd592d]" role="alert">{erreurContacts}</p>
                ) : contactsAffiches.length ? (
                  <>
                    {!rechercheContactActive ? (
                      <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[#978775] sm:px-3">Vos contacts récents</p>
                    ) : null}
                    {contactsAffiches.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      disabled={creationConversation}
                      onClick={() => void choisirContact(contact)}
                      className="flex min-h-[76px] w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition hover:bg-[#f4ecdc] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0d6738] disabled:opacity-60 sm:px-3"
                    >
                      <Avatar personne={contact} />
                      <span className="min-w-0">
                        <strong className="block truncate text-base text-[#2d241d] sm:text-lg">{contact.nom}</strong>
                        <span className="block truncate text-sm text-[#887764] sm:text-base">{contact.fonction} · {contact.ville}</span>
                      </span>
                    </button>
                    ))}
                  </>
                ) : rechercheContactActive && rechercheContactFaite ? (
                  <p className="px-3 py-8 text-center text-sm text-[#887764]">Aucun membre trouvé.</p>
                ) : (
                  <p className="px-3 py-8 text-center text-sm text-[#887764]">Tapez au moins 2 lettres du nom.</p>
                )}
              </div>
            </section>
          </div>
        ) : (
          <>
            <label className="relative mx-4 mb-3 block sm:mx-6">
              <span className="sr-only">Rechercher une conversation</span>
              <input
                type="search"
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="Rechercher une conversation"
                className="h-14 w-full rounded-full border border-[#eee3d0] bg-[#f4ecdc] px-5 text-base text-[#2d241d] outline-none placeholder:text-[#8f8b86] focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
              />
            </label>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3" aria-label="Liste des conversations" aria-live="polite">
              {chargementConversations ? (
                <p className="px-6 py-10 text-center text-sm text-[#887764]">Chargement de vos conversations…</p>
              ) : erreurConversations ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-medium text-[#bd592d]" role="alert">{erreurConversations}</p>
                  <button type="button" onClick={() => void chargerConversations()} className="mt-3 min-h-10 rounded-lg border border-[#0d6738] px-4 text-sm font-bold text-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">Réessayer</button>
                </div>
              ) : conversationsFiltrees.length ? (
                conversationsFiltrees.map((conversation) => {
                  const active = conversation.id === conversationActiveId;
                  return (
                    <button
                      ref={active ? boutonConversationActive : undefined}
                      key={conversation.id}
                      type="button"
                      aria-label={`Ouvrir la conversation avec ${conversation.interlocuteur.nom}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => ouvrirConversation(conversation.id)}
                      className={`relative flex min-h-[88px] w-full items-center gap-4 border-l-4 px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0d6738] sm:px-5 ${active ? "border-[#0d6738] bg-[#edf5f0]" : "border-transparent hover:bg-[#f8f1e6]"}`}
                    >
                      <Avatar personne={conversation.interlocuteur} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <strong className="min-w-0 flex-1 truncate text-base text-[#2d241d] sm:text-lg">{conversation.interlocuteur.nom}</strong>
                          <span className="shrink-0 text-xs text-[#a39583] sm:text-sm">{heureConversationDe(conversation.derniereActivite)}</span>
                        </span>
                        <span className={`mt-1 block truncate text-sm sm:text-base ${conversation.nonLus ? "font-semibold text-[#55483b]" : "text-[#887764]"}`}>{conversation.apercu}</span>
                      </span>
                      {conversation.nonLus > 0 && <span className="sr-only">{conversation.nonLus} message non lu</span>}
                    </button>
                  );
                })
              ) : (
                <p className="px-6 py-10 text-center text-sm text-[#887764]">
                  {conversations.length ? "Aucune conversation ne correspond à votre recherche." : "Vous n’avez pas encore de conversation."}
                </p>
              )}
            </div>
          </>
        )}
      </aside>

      {conversationActive ? (
        <article
          aria-label={`Conversation avec ${conversationActive.interlocuteur.nom}`}
          className={`${conversationMobile ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[#fcf9f3]`}
        >
          <header className="flex min-h-[92px] shrink-0 items-center gap-3 border-b border-[#eadfce] bg-[#fffdf9] px-4 py-3 sm:gap-4 sm:px-7 lg:min-h-[108px]">
            <button
              type="button"
              aria-label="Revenir aux conversations"
              onClick={() => {
                setConversationMobile(false);
                window.setTimeout(() => boutonConversationActive.current?.focus(), 0);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#2d241d] hover:bg-[#f4ecdc] focus:outline-none focus:ring-2 focus:ring-[#0d6738] md:hidden"
            >
              <ArrowLeft aria-hidden="true" size={23} />
            </button>
            <Avatar personne={conversationActive.interlocuteur} grand />
            <div className="min-w-0">
              <h2 className="truncate titre-element">{conversationActive.interlocuteur.nom}</h2>
              <p className="truncate text-sm text-[#887764] sm:text-lg">{conversationActive.interlocuteur.fonction} · {conversationActive.interlocuteur.ville}</p>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-7 sm:py-7">
            {chargementDetail && !conversationActive.detailCharge ? (
              <div className="flex h-full min-h-48 items-center justify-center text-sm text-[#887764]">Chargement des messages…</div>
            ) : erreurDetail && !conversationActive.detailCharge ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-[#bd592d]" role="alert">{erreurDetail}</p>
                <button type="button" onClick={() => void chargerDetail(conversationActive.id)} className="mt-3 min-h-10 rounded-lg border border-[#0d6738] px-4 text-sm font-bold text-[#0d6738] focus:outline-none focus:ring-2 focus:ring-[#0d6738]">Réessayer</button>
              </div>
            ) : conversationActive.messages.length ? (
              <div className="space-y-5" role="log" aria-live="polite" aria-relevant="additions">
                {conversationActive.hasMore && conversationActive.nextCursor && (
                  <div className="text-center">
                    <button
                      type="button"
                      disabled={chargementAnciens}
                      onClick={() => void chargerDetail(conversationActive.id, conversationActive.nextCursor || undefined)}
                      className="min-h-10 rounded-full border border-[#d9c7ad] bg-[#fffdf9] px-4 text-sm font-semibold text-[#765131] focus:outline-none focus:ring-2 focus:ring-[#0d6738] disabled:opacity-60"
                    >
                      {chargementAnciens ? "Chargement…" : "Afficher les messages précédents"}
                    </button>
                  </div>
                )}
                {conversationActive.messages.map((message) => (
                  <div key={message.id} className={`flex flex-col ${message.auteur === "moi" ? "items-end" : "items-start"}`}>
                    <p className={`min-w-0 max-w-[90%] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-[18px] px-5 py-4 text-base leading-relaxed sm:max-w-[76%] sm:px-6 sm:py-5 sm:text-lg lg:text-[22px] ${message.auteur === "moi" ? "bg-[#765131] text-white" : "bg-[#f0e5d0] text-[#2d241d]"}`}>
                      <ContenuMessage contenu={message.contenu} />
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <time dateTime={message.envoyeLe} className="text-xs text-[#a39583] sm:text-sm">{horodatageDe(message.envoyeLe)}</time>
                      {message.auteur === "autre" && (
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-label={`Signaler ce message de ${conversationActive.interlocuteur.nom}`}
                          onClick={() => setMessageASignaler(message.id)}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-[#a39583] transition hover:bg-[#f5ecdf] hover:text-[#a3321f] focus:outline-none focus:ring-2 focus:ring-[#0d6738]"
                        >
                          <Flag aria-hidden="true" size={13} />
                          Signaler
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {erreurEnvoi && <p className="text-right text-sm font-medium text-[#bd592d]" role="alert">{erreurEnvoi}</p>}
                <div ref={finMessages} />
              </div>
            ) : (
              <div className="flex h-full min-h-48 items-center justify-center text-center">
                <div>
                  <Avatar personne={conversationActive.interlocuteur} grand />
                  <p className="mt-4 font-semibold text-[#2d241d]">Commencez la conversation avec {conversationActive.interlocuteur.nom}.</p>
                  {erreurEnvoi && <p className="mt-2 text-sm font-medium text-[#bd592d]" role="alert">{erreurEnvoi}</p>}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={(event) => void envoyer(event)} className="flex shrink-0 items-end gap-3 border-t border-[#eadfce] bg-[#fffdf9] p-4 sm:px-7 sm:py-5">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Écrire un message</span>
              <textarea
                ref={champMessage}
                rows={1}
                value={contenu}
                disabled={envoiEnCours}
                onChange={(event) => {
                  setContenu(event.target.value);
                  setErreurEnvoi("");
                  event.currentTarget.style.height = "56px";
                  event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 128)}px`;
                }}
                onKeyDown={gererClavier}
                placeholder="Écrire un message"
                className="block max-h-32 min-h-14 w-full resize-none rounded-[28px] border border-[#eee3d0] bg-[#f4ecdc] px-5 py-4 text-base leading-6 text-[#2d241d] outline-none placeholder:text-[#8f8b86] focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20 disabled:opacity-70 sm:px-6 sm:text-lg"
              />
            </label>
            <button
              type="submit"
              disabled={!contenu.trim() || envoiEnCours}
              className="flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0d6738] px-5 font-bold text-white transition hover:bg-[#09572f] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[150px] sm:px-7 sm:text-lg"
            >
              <Send aria-hidden="true" size={19} className="sm:hidden" />
              <span className="hidden sm:inline">{envoiEnCours ? "Envoi…" : "Envoyer"}</span>
              <span className="sr-only sm:hidden">{envoiEnCours ? "Envoi en cours" : "Envoyer"}</span>
            </button>
          </form>
        </article>
      ) : (
        <div className="hidden flex-1 items-center justify-center text-[#887764] md:flex">
          {chargementConversations ? "Chargement…" : "Sélectionnez une conversation."}
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

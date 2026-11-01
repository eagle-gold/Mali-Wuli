export type PublicationScope = "tout" | "pays" | "ville";

export type PublicationIntention = "OFFRE" | "DEMANDE";

export type ReactionPublication =
  | "LIKE"
  | "BRAVO"
  | "SOUTIEN"
  | "INSTRUCTIF"
  | "INSPIRANT";

export type AuteurPublicationApi = {
  id: string;
  photo?: string | null;
  titre?: string | null;
  ville?: string | null;
  pays?: string | null;
  user: {
    prenom?: string | null;
    nom?: string | null;
  };
};

export type CommentairePublicationApi = {
  peutSupprimer?: boolean;
  id: string;
  contenu: string;
  createdAt: string;
  parentId?: string | null;
  auteur: AuteurPublicationApi;
  reponses?: CommentairePublicationApi[];
};

export type PublicationApi = {
  peutSupprimer?: boolean;
  id: string;
  intention: PublicationIntention;
  thematique: string;
  contenu: string;
  createdAt: string;
  auteur: AuteurPublicationApi;
  photoUrl?: string | null;
  nbReactions: number;
  decompteReactions: Record<string, number>;
  maReaction: ReactionPublication | null;
  nbCommentaires: number;
  commentaires?: CommentairePublicationApi[];
};

export type PublicationsResponseApi = {
  publications: PublicationApi[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

export type ReactionPublicationResponseApi = {
  maReaction: ReactionPublication | null;
  nbReactions?: number;
  decompteReactions?: Record<string, number>;
};

export type CommentairesPublicationResponseApi = {
  commentaires: CommentairePublicationApi[];
};

export type SupporterPublicationApi = AuteurPublicationApi;

export type SupportersPublicationResponseApi = {
  supporters: SupporterPublicationApi[];
  total: number;
  hasMore: boolean;
  nextCursor?: string | null;
};

export type ReactionsPublicationResponseApi = {
  reactions: Array<{
    type: ReactionPublication;
    auteur: AuteurPublicationApi;
  }>;
  decompteReactions?: Record<string, number>;
  nbReactions?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
};

export type PublicationCreeeSocket = {
  publication?: PublicationApi;
  publicationId?: string;
  auteur?: AuteurPublicationApi;
};

export type CommentaireCreeSocket = {
  publicationId: string;
  commentaire: CommentairePublicationApi;
  nbCommentaires?: number;
};

export type ReactionMiseAJourSocket = {
  publicationId: string;
  nbReactions: number;
  decompteReactions: Record<string, number>;
};

export type MembreResumeApi = {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  initiales?: string | null;
  titre?: string | null;
  ville?: string | null;
  photo?: string | null;
  /** Présence (messagerie) : connecté en ce moment. */
  enLigne?: boolean;
  /** Présence (messagerie) : dernière activité connue. */
  derniereActiviteLe?: string | null;
};

export type PieceJointeApi = {
  id: string;
  nom: string;
  mime: string;
  taille: number;
  estImage: boolean;
};

export type PresenceEvenementApi = {
  profilId: string;
  enLigne: boolean;
  derniereActiviteLe: string | null;
};

export type MessageApi = {
  id: string;
  conversationId: string;
  contenu: string;
  lu?: boolean;
  createdAt: string;
  estMoi?: boolean;
  auteur: {
    id: string;
    initiales?: string | null;
    photo?: string | null;
  };
  piecesJointes?: PieceJointeApi[];
};

export type ConversationApi = {
  id: string;
  titre?: string | null;
  estGroupe: boolean;
  participants: MembreResumeApi[];
  dernierMessage?: {
    id: string;
    conversationId?: string;
    auteurId?: string;
    contenu: string;
    createdAt: string;
    lu?: boolean;
  } | null;
  nonLus: number;
  updatedAt: string;
};

export type ConversationsResponseApi = {
  conversations: ConversationApi[];
};

export type ConversationDetailResponseApi = {
  conversation: Pick<ConversationApi, "id" | "titre" | "estGroupe" | "participants">;
  messages: MessageApi[];
  hasMore: boolean;
  nextCursor?: string | null;
};

export type MembresRechercheResponseApi = {
  membres: MembreResumeApi[];
};

export type NotificationApi = {
  id: string;
  type: string;
  titre: string;
  detail?: string | null;
  href?: string | null;
  payload?: unknown;
  lue: boolean;
  createdAt: string;
  acteur?: {
    id: string;
    photo?: string | null;
    user?: {
      prenom?: string | null;
      nom?: string | null;
    } | null;
  } | null;
};

export type NotificationsResponseApi = {
  notifications: NotificationApi[];
  nonLues: number;
  hasMore: boolean;
  nextCursor?: string | null;
};

export type ProfilConnecteApi = {
  id: string;
  photo?: string | null;
  titre?: string | null;
  ville?: string | null;
  pays?: string | null;
};

export type UtilisateurConnecteResponseApi = {
  id?: string;
  role?: string | null;
  rolesDelegues?: string[];
  permissions?: string[];
  revisionDroits?: string;
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
  profil?: ProfilConnecteApi | null;
  user?: {
    id?: string;
    role?: string | null;
    rolesDelegues?: string[];
    permissions?: string[];
    revisionDroits?: string;
    prenom?: string | null;
    nom?: string | null;
    email?: string | null;
    profil?: ProfilConnecteApi | null;
  } | null;
};

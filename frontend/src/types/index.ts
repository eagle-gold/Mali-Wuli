// =============================================
// TYPES GLOBAUX — Mali Wuli
// =============================================

export type Role =
  | "VISITEUR"
  | "MEMBRE"
  | "VOLONTAIRE"
  | "PRESIDENT_CERCLE"
  | "RESPONSABLE_ASSO"
  | "MODERATEUR"
  | "ADMIN";

export type StatutInscription = "EN_ATTENTE" | "VALIDE" | "REFUSE" | "SUSPENDU";

export type SituationActuelle =
  | "ETUDIANT"
  | "PROFESSIONNEL"
  | "ENTREPRENEUR"
  | "EN_RECHERCHE";

export interface User {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  dateNaissance: string;
  role: Role;
  statut: StatutInscription;
  createdAt: string;
}

export interface Profil {
  id: string;
  userId: string;
  telephone?: string;
  pays: string;
  ville: string;
  situation: SituationActuelle;
  titre?: string;
  bio?: string;
  photo?: string;
  linkedin?: string;
  emailVisible: boolean;
  telephoneVisible: boolean;
  estVolontaire: boolean;
  user: User;
}

export interface Formation {
  id: string;
  profilId: string;
  type: "FONDAMENTALE" | "LYCEE" | "SUPERIEUR";
  etablissementId: string;
  etablissement?: Etablissement;
  anneeDebut?: number;
  anneeFin?: number;
  diplome?: string;
  filiere?: string;
  enCours: boolean;
}

export interface Experience {
  id: string;
  profilId: string;
  poste: string;
  entreprise: string;
  ville?: string;
  pays?: string;
  secteur?: string;
  dateDebut: string;
  dateFin?: string;
  estActuel: boolean;
  description?: string;
}

export interface Etablissement {
  id: string;
  nom: string;
  sigle?: string;
  type: "FONDAMENTALE" | "LYCEE" | "UNIVERSITE" | "ECOLE_SUPERIEURE";
  pays: string;
  ville: string;
  statut: "PUBLIC" | "PRIVE";
  habilite?: boolean;
  description?: string;
}

export interface Synergie {
  id: string;
  demandeurId: string;
  recepteurId: string;
  statut: "EN_ATTENTE" | "ACCEPTE" | "REFUSE";
  raison?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  auteurId: string;
  contenu: string;
  lu: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  titre?: string;
  estGroupe: boolean;
  participants: Profil[];
  dernierMessage?: Message;
  messagesNonLus: number;
}

export interface Cercle {
  id: string;
  nom: string;
  theme: string;
  description?: string;
  presidentId: string;
  president?: Profil;
  nbMembres: number;
  actif: boolean;
}

export interface Evenement {
  id: string;
  titre: string;
  description: string;
  type: "EN_LIGNE" | "PRESENTIEL";
  lieu?: string;
  lienVideo?: string;
  dateDebut: string;
  dateFin?: string;
  capacite?: number;
  nbInscrits: number;
  organisateurId: string;
  valide: boolean;
}

export interface Offre {
  id: string;
  titre: string;
  entreprise: string;
  type: "CDI" | "CDD" | "STAGE" | "ALTERNANCE" | "FREELANCE";
  secteur: string;
  pays: string;
  ville?: string;
  teletravail: boolean;
  description: string;
  lienCandidature?: string;
  emailContact?: string;
  dateExpiration?: string;
  publieurId: string;
  valide: boolean;
  createdAt: string;
}

export interface Volontaire {
  id: string;
  profilId: string;
  profil?: Profil;
  specialite: string;
  disponible: boolean;
  fuseau: string;
  dureeCreneau: 15 | 30 | 45 | 60;
}

export interface RendezVous {
  id: string;
  volontaireId: string;
  demandeurId: string;
  debut: string;
  fin: string;
  motif: string;
  statut: "EN_ATTENTE" | "ACCEPTE" | "REFUSE" | "ANNULE";
  lienAppel?: string;
}

export interface Association {
  id: string;
  nom: string;
  description?: string;
  pays: string;
  responsableId?: string;
  site?: string;
}

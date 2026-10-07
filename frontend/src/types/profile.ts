export type StatutInscriptionProfilApi =
  | "VALIDE"
  | "REFUSE"
  | "SUSPENDU";

export type AvisFormationProfilApi = {
  id?: string;
  noteEnseignement?: number | null;
  noteContenu?: number | null;
  noteInfrastructures?: number | null;
  noteInsertion?: number | null;
  noteAmbiance?: number | null;
  commentaire?: string | null;
  anneePromo?: number | null;
};

export type ReferenceFormationProfilApi = {
  id?: string;
  nom?: string | null;
  libelle?: string | null;
  sigle?: string | null;
  type?: string | null;
  niveau?: string | null;
};

export type EtablissementFormationProfilApi = {
  id?: string;
  nom?: string | null;
  sigle?: string | null;
  type?: string | null;
  ville?: string | null;
  paysCode?: string | null;
  pays?: {
    nom?: string | null;
    drapeau?: string | null;
  } | null;
};

export type DiplomeScolaireProfilApi = {
  type: "BREVET" | "BAC" | "AUTRE";
  libelle: string;
  anneeObtention: string;
  mention: string;
  serie: string;
  statut?: "OBTENU" | "EN_COURS";
};

export type FormationProfilApi = {
  id: string;
  type?: string | null;
  autreEtablissement?: string | null;
  moisDebut?: number | null;
  anneeDebut?: number | null;
  moisFin?: number | null;
  anneeFin?: number | null;
  diplome?: string | null;
  mention?: string | null;
  filiere?: string | null;
  specialite?: string | null;
  serie?: string | null;
  systemeEducatifCode?: string | null;
  diplomesScolaires?: DiplomeScolaireProfilApi[] | null;
  statutDiplome?: "OBTENU" | "EN_COURS" | "NON_OBTENU" | "NON_DIPLOMANTE";
  enCours?: boolean;
  demarcheApresFormation?: string | null;
  delaiPremierEmploi?: string | null;
  emploiDansLes12Mois?: boolean | null;
  lienEmploiFormation?: string | null;
  etablissement?: EtablissementFormationProfilApi | null;
  programmeReference?: ReferenceFormationProfilApi | null;
  parcoursReference?: ReferenceFormationProfilApi | null;
  diplomeReference?: ReferenceFormationProfilApi | null;
  avis?: AvisFormationProfilApi | null;
};

export type ExperienceProfilApi = {
  id: string;
  poste: string;
  entreprise: string;
  ville?: string | null;
  pays?: string | null;
  secteur?: string | null;
  typeContrat?: string | null;
  dateDebut: string;
  dateFin?: string | null;
  estActuel: boolean;
  description?: string | null;
};

export type VolontaireProfilApi = {
  id: string;
  specialite?: string | null;
  sujets?: unknown;
  precisionsSujets?: unknown;
  disponible?: boolean;
  fuseau?: string | null;
  dureeCreneau?: number | null;
  format?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  disponibilites?: unknown;
  maxRdvMois?: number | null;
  delaiMinResa?: number | null;
};

export type StatistiquesProfilApi = {
  nbSynergies?: number;
  nbRdvAcceptes?: number;
  nbPublications?: number;
  nbCommentaires?: number;
  nbAvis?: number;
  nbContributions?: number;
};

export type ProfilConnecteApi = {
  id: string;
  telephone?: string | null;
  pays?: string | null;
  ville?: string | null;
  situation?: string | null;
  titre?: string | null;
  /** Vrai si le membre a écrit son titre ; faux : il suit son parcours (« Poste - Entreprise »). */
  titrePersonnalise?: boolean;
  bio?: string | null;
  photo?: string | null;
  photoCouverture?: string | null;
  linkedin?: string | null; facebook?: string | null; instagram?: string | null; tiktok?: string | null;
  emailVisible?: boolean;
  telephoneVisible?: boolean;
  estVolontaire?: boolean;
  onboardingEtape?: number;
  onboardingFini?: boolean;
  formations?: FormationProfilApi[];
  experiences?: ExperienceProfilApi[];
  volontaire?: VolontaireProfilApi | null;
  stats?: StatistiquesProfilApi;
};

export type UtilisateurProfilApi = {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  email: string;
  role?: string;
  rolesDelegues?: string[];
  permissions?: string[];
  revisionDroits?: string;
  statut: StatutInscriptionProfilApi;
  createdAt?: string;
  profil: ProfilConnecteApi;
};

export type SuggestionSynergieApi = {
  id: string;
  photo?: string | null;
  titre?: string | null;
  ville?: string | null;
  pays?: string | null;
  bio?: string | null;
  estVolontaire?: boolean;
  user: {
    prenom?: string | null;
    nom?: string | null;
  };
  experiences?: Array<{
    poste?: string | null;
    entreprise?: string | null;
  }>;
};

export type SuggestionsSynergieResponseApi = {
  suggestions: SuggestionSynergieApi[];
};

export type CreationSynergieResponseApi = {
  message?: string;
  synergie: {
    id: string;
  };
};

export type PhotoProfilResponseApi = {
  message?: string;
  url: string;
};

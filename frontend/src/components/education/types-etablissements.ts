export type NiveauEtablissement = "École fondamentale" | "Lycée" | "Université" | "Grande école" | "Institut";
export type TypeEtablissementApi = "FONDAMENTALE" | "LYCEE" | "UNIVERSITE" | "ECOLE_SUPERIEURE";
export type TonEtablissement = "vert" | "orange" | "sable" | "olive";

export type EtablissementListe = {
  id: string; sigle: string | null; nom: string; niveau: NiveauEtablissement; type: TypeEtablissementApi;
  paysCode: string; pays: string; ville: string | null; statut: "public" | "privé" | null;
  // Mali : ville = chef-lieu de région ; détail administratif ci-dessous.
  localite?: string | null; commune?: string | null; cercle?: string | null; region?: string | null;
  ton: TonEtablissement; resume: string | null; note: number | null; nombreAvis: number;
  membres: number; promotions: number; insertion: number | null; repondantsInsertion: number;
};

export type ReponseListeEtablissements = {
  etablissements: EtablissementListe[];
  pagination: { page: number; limite: number; total: number; totalPages: number };
  filtres: { pays: Array<{ code: string; nom: string }>; villes: string[]; communes?: string[] };
};

export type EtablissementDetail = EtablissementListe & {
  description: string | null; siteWeb: string | null; parcours: string[]; diaspora: number; volontaires: number;
  membresApercu: Array<{ id: string; initiales: string; nom: string; fonction: string | null; ville: string | null; photo: string | null; promotion: number | null; ton: TonEtablissement }>;
  avisApercu: Array<{ id: string; initiales: string; nom: string; photo: string | null; promotion: number | null; createdAt: string; note: number; commentaire: string | null; ton: TonEtablissement }>;
  employeurs: Array<{ nom: string; secteur: string | null; ville: string | null; membres: number }>;
  villesAnciens: Array<{ ville: string; membres: number }>;
};

export type ReponseEtablissementDetail = {
  etablissement: EtablissementDetail;
  moi: { affilie: boolean; formationId: string | null; avisId: string | null; peutDonnerAvis: boolean };
};

import type { FormationProfilApi, ExperienceProfilApi, VolontaireProfilApi, StatistiquesProfilApi } from "@/types/profile";

export type MembreAnnuaire = {
  id: string; userId: string; titre?: string | null; ville?: string | null; pays?: string | null;
  situation?: string | null; photo?: string | null; estVolontaire: boolean;
  user: { prenom?: string | null; nom?: string | null };
  experiences?: Array<{ poste?: string | null; entreprise?: string | null }>;
  formations?: Array<{ id: string; anneeFin?: number | null; anneePromo?: number | null; diplome?: string | null; etablissement?: { id: string; nom: string; sigle?: string | null } | null; autreEtablissement?: string | null }>;
  aides?: string[];
};
export type AnnuaireResponse = {
  membres: MembreAnnuaire[]; total: number; totalGlobal: number; page: number; limite: number; totalPages: number;
  facettes: { pays: string[]; villes: string[]; etablissements: Array<{ id: string; nom: string }>; promotions: number[]; aides: string[] };
};
export type AssociationProfilPublic = { id: string; nom: string; description?: string | null; pays: string; ville?: string | null; vocation?: string | null; photo?: string | null; photoCouverture?: string | null; site?: string | null; dateCreation?: string | null };
export type MembrePublic = {
  estMoi?: boolean;
  id: string; userId: string; prenom?: string | null; nom?: string | null; titre?: string | null; bio?: string | null;
  pays?: string | null; ville?: string | null; situation?: string | null; photo?: string | null; photoCouverture?: string | null;
  telephone?: string | null; email?: string | null; linkedin?: string | null; facebook?: string | null; instagram?: string | null; tiktok?: string | null; membreDepuis?: string; estVolontaire?: boolean;
  formations?: FormationProfilApi[]; experiences?: ExperienceProfilApi[]; volontaire?: VolontaireProfilApi | null; stats?: StatistiquesProfilApi;
  synergie?: { id: string; statut: string; demandeurId: string; recepteurId: string } | null;
  associations?: AssociationProfilPublic[];
};

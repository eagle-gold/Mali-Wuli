export type StatutAffiliationAssociation = "EN_ATTENTE" | "VERIFIE" | "REFUSE" | "DECLARE";
export type ResponsableAssociationApi = {
  estMoi?: boolean;
  id: string; userId: string; prenom: string | null; nom: string | null;
  photo: string | null; titre?: string | null; ville?: string | null; pays?: string | null;
};
export type AffiliationAssociationApi = { statut: StatutAffiliationAssociation; rejointLe: string | null };
export type AssociationApi = {
  peutSupprimer?: boolean;
  id: string; nom: string; description: string | null; pays: string; ville: string | null;
  vocation: string | null; site: string | null; emailContact: string | null;
  photo: string | null; photoCouverture: string | null; dateCreation: string | null; createdAt: string;
  responsable: ResponsableAssociationApi | null; nbMembres: number;
  monAffiliation: AffiliationAssociationApi | null; peutGerer: boolean;
  valide?: boolean;
};
export type AssociationsListeResponseApi = {
  associations: AssociationApi[]; total: number; totalGlobal: number; page: number; totalPages: number;
  facettes: { pays: string[]; villes: string[]; vocations: string[] };
};
export type AssociationsPersonnellesResponseApi = { associations: AssociationApi[] };
export type MembreAssociationApi = ResponsableAssociationApi & { rejointLe: string | null };
export type AssociationDetailResponseApi = {
  association: AssociationApi; membres: MembreAssociationApi[]; totalMembres: number; page: number; totalPagesMembres: number;
};
export type MembresAssociationResponseApi = { membres: MembreAssociationApi[]; total: number; page: number; totalPages: number };
export type AffiliationsAssociationResponseApi = {
  affiliations: { profil: ResponsableAssociationApi; statut: StatutAffiliationAssociation; rejointLe: string | null }[];
  total: number; page: number; totalPages: number;
};
export type SuggestionAssociationApi = {
  id: string; nom: string; pays: string; ville: string | null; vocation: string | null; message: string | null;
  statut: "EN_ATTENTE" | "TRAITEE" | "REFUSEE"; createdAt: string;
  proposeur?: { id: string; userId: string; prenom: string | null; nom: string | null };
};
export type SuggestionsAssociationsResponseApi = { suggestions: SuggestionAssociationApi[]; total: number; page: number; totalPages: number };
export type Association = AssociationApi;
export type AssociationsResponse = AssociationsListeResponseApi;
export type AssociationDetailResponse = AssociationDetailResponseApi;
export type AssociationMembre = MembreAssociationApi;
export type AffiliationsResponse = AffiliationsAssociationResponseApi;

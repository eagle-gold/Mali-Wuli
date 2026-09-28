import type { PaginationApi } from "@/lib/community";
export type TypeOffre = "CDI" | "CDD" | "STAGE" | "ALTERNANCE" | "FREELANCE";
export type ModeTravail = "SUR_SITE" | "HYBRIDE" | "TELETRAVAIL";
export type ModeCandidature = "MALI_WULI" | "EMAIL" | "LIEN_EXTERNE";
export type StatutCandidature = "EN_COURS" | "ENVOYEE" | "ECHEC";
export type ProfilOffre = { id:string; prenom:string; nom:string; nomComplet:string; photo?:string|null; titre?:string|null; ville?:string|null; pays?:string|null };
export type OffreApi = {
  peutSupprimer?: boolean;
  revision: string;
  peutModifier: boolean; peutModerer: boolean;
 id:string; titre:string; entreprise:string; type:TypeOffre; secteur:string; pays:string; ville:string|null;
 teletravail:boolean; modeTravail:ModeTravail; description:string; profilRecherche:string|null; salaire:string|null;
 modeCandidature:ModeCandidature; lienCandidature:string|null; emailContact:string|null; recommandationPossible:boolean;
 dateExpiration:string|null; publieurId:string; publieur:ProfilOffre|null; valide:boolean; statutModeration:"EN_ATTENTE"|"PUBLIEE"|"REFUSEE";
 createdAt:string; estProprietaire:boolean; estExpiree:boolean; estEnregistree:boolean; aPostule:boolean;
 statutCandidature:StatutCandidature|null; conversationId:string|null;
};
export type OffresResponse = { offres:OffreApi[]; meta:PaginationApi; facettes:{pays:string[];villes:string[];secteurs:string[];types:string[];modesTravail:string[]}; compteurs:{actives:number;enregistrees:number;mesOffres:number;enAttente:number}; peutModerer:boolean };
export type CandidatureResponse = {modeCandidature:ModeCandidature;statutCandidature:StatutCandidature|null;aPostule:boolean;conversationId:string|null;lienExterne?:string;message:string};

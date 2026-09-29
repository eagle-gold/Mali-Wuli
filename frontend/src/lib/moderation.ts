import api from "@/lib/api";

/** Contrat POST /api/signalements (backend/src/services/signalement.service.ts). */
export const TYPES_CIBLE_SIGNALEMENT = ["PUBLICATION", "COMMENTAIRE", "PROFIL", "ASSOCIATION", "ETABLISSEMENT", "EVENEMENT", "OFFRE", "MESSAGE"] as const;
export type TypeCibleSignalement = typeof TYPES_CIBLE_SIGNALEMENT[number];

export const MOTIFS_SIGNALEMENT = [
  { code: "SPAM", libelle: "Spam", aide: "Publicité non sollicitée, contenu répétitif ou trompeur." },
  { code: "HARCELEMENT", libelle: "Harcèlement", aide: "Insultes, menaces, intimidation d’un membre." },
  { code: "CONTENU_INAPPROPRIE", libelle: "Contenu inapproprié", aide: "Contenu choquant, haineux ou contraire aux règles de la communauté." },
  { code: "FAUSSE_INFORMATION", libelle: "Fausse information", aide: "Information manifestement fausse ou trompeuse." },
  { code: "USURPATION", libelle: "Usurpation d’identité", aide: "Se fait passer pour une autre personne ou organisation." },
  { code: "AUTRE", libelle: "Autre", aide: "Précisez le problème dans les détails." },
] as const;
export type MotifSignalement = typeof MOTIFS_SIGNALEMENT[number]["code"];

export const STATUTS_SIGNALEMENT = ["EN_ATTENTE", "EN_COURS", "TRAITE", "REJETE"] as const;
export type StatutSignalement = typeof STATUTS_SIGNALEMENT[number];

export const LIBELLES_STATUT_SIGNALEMENT: Record<StatutSignalement, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TRAITE: "Traité",
  REJETE: "Rejeté",
};

export const LIBELLES_TYPE_CIBLE: Record<TypeCibleSignalement, string> = {
  PUBLICATION: "Publication",
  COMMENTAIRE: "Commentaire",
  PROFIL: "Profil",
  ASSOCIATION: "Association",
  ETABLISSEMENT: "Établissement",
  EVENEMENT: "Événement",
  OFFRE: "Offre",
  MESSAGE: "Message privé",
};

export const libelleMotif = (code: string) => MOTIFS_SIGNALEMENT.find((motif) => motif.code === code)?.libelle || code;

/** Contrat GET /api/admin/signalements. */
export type SignalementAdmin = {
  id: string;
  cibleType: TypeCibleSignalement;
  cibleId: string;
  motif: MotifSignalement;
  details: string | null;
  statut: StatutSignalement;
  traite: boolean;
  noteInterne: string | null;
  traiteParId: string | null;
  traiteLe: string | null;
  createdAt: string;
  signaleur: { id: string; user: { prenom: string | null; nom: string | null } } | null;
  cible: {
    type: TypeCibleSignalement;
    id: string;
    existe: boolean;
    apercu: string | null;
    auteur: string | null;
    auteurId: string | null;
    supprime: boolean;
    href: string | null;
  };
};

/** Contrat GET /api/corbeille (backend/src/services/corbeille.service.ts). */
export type TypeCorbeille = "publication" | "commentaire";
export type ElementCorbeille = {
  type: TypeCorbeille;
  id: string;
  apercu: string;
  thematique?: string | null;
  publicationId?: string;
  estAuteur: boolean;
  supprimeLe: string;
  effacementDefinitifLe: string;
  supprimeParModeration: boolean;
  peutRestaurer: boolean;
  peutEffacer: boolean;
  raisonBlocage: string | null;
};
export type ReponseCorbeille = { elements: ElementCorbeille[]; dureeConservationJours: number };

export const MESSAGE_CORBEILLE = "Déplacé dans la corbeille — restaurable 30 jours";

export function restaurerDepuisCorbeille(type: TypeCorbeille, id: string) {
  return api.post<{ message: string; type: TypeCorbeille; id: string; publicationId: string }>(
    `/corbeille/${type}/${encodeURIComponent(id)}/restaurer`,
  );
}

export function effacerDeLaCorbeille(type: TypeCorbeille, id: string) {
  return api.delete<{ message: string }>(`/corbeille/${type}/${encodeURIComponent(id)}`);
}

import type { PaginationApi } from "@/lib/community";

export type FormatEvenement = "PRESENTIEL" | "EN_LIGNE" | "HYBRIDE";
export type ProfilEvenement = { id: string; prenom: string; nom: string; nomComplet: string; photo?: string | null; titre?: string | null; pays?: string | null; ville?: string | null };
export type EtapeProgramme = { heure: string; libelle: string };
export type Evenement = {
  peutSupprimer?: boolean;
  id: string; titre: string; description: string; type: FormatEvenement;
  lieu?: string | null; pays?: string | null; ville?: string | null; lienVideo?: string | null;
  fuseauHoraire?: string | null; dateDebut: string; dateFin?: string | null;
  capacite?: number | null; photoCouverture?: string | null; programme?: EtapeProgramme[] | null;
  resume?: string | null; valide: boolean; statut: "VALIDE" | "EN_ATTENTE" | "REFUSE";
  nbParticipants: number; estInscrit: boolean; estProprietaire: boolean; estPasse: boolean;
  peutModifier: boolean; peutAjouterPhotos: boolean; peutModerer: boolean;
  organisateur?: ProfilEvenement | null; createdAt?: string;
};
export type PhotoEvenement = { id: string; url: string; legende?: string | null; createdAt: string; auteur: ProfilEvenement | null; peutSupprimer: boolean };
export type EvenementsResponse = {
  evenements: Evenement[]; meta: PaginationApi;
  compteurs: { aVenir: number; passes: number; aValider: number; mesPropositions: number };
  facettes: { pays: string[]; villes: string[] }; peutModerer: boolean;
};
export type DetailEvenementResponse = { evenement: Evenement; participants: ProfilEvenement[]; totalParticipants: number; photos: PhotoEvenement[]; totalPhotos: number };

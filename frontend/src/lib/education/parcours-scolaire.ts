import { anneeEstValide } from "../periode";

export type DiplomeScolaire = {
  type: "BREVET" | "BAC" | "AUTRE";
  libelle: string;
  anneeObtention: string;
  mention: string;
  serie: string;
  statut?: "OBTENU" | "EN_COURS";
};

type AncienParcours = {
  type: string;
  diplomesScolaires?: DiplomeScolaire[];
  diplome?: string;
  anneePromo?: string;
  mention?: string;
  specialite?: string;
  statutDiplome?: string;
  diplomeObtenu?: boolean;
};

export const typeDiplomeScolaire = (libelle: string): DiplomeScolaire["type"] => {
  if (/baccalaur|\bbac\b/i.test(libelle)) return "BAC";
  if (/\bBT(?:S)?\b|brevet\s+(?:(?:de\s+)?technicien|professionnel|des\s+m[eé]tiers|technique)/i.test(libelle)) return "AUTRE";
  if (/brevet|\bDNB\b|\bDEF\b|\bBEPC\b|fondamentales/i.test(libelle)) return "BREVET";
  return "AUTRE";
};

/** Les anciennes fiches sont converties à l’édition sans perdre leur diplôme. */
export const diplomesDuParcoursScolaire = (formation: AncienParcours): DiplomeScolaire[] => {
  if (formation.type === "universite") return [];
  if (Array.isArray(formation.diplomesScolaires)) return formation.diplomesScolaires.map((diplome) => ({ ...diplome }));
  if (!formation.diplome?.trim()) return [];
  const statut = formation.statutDiplome || (formation.diplomeObtenu === false ? "EN_COURS" : "OBTENU");
  if (statut !== "OBTENU" && statut !== "EN_COURS") return [];
  return [{
    type: typeDiplomeScolaire(formation.diplome), libelle: formation.diplome,
    anneeObtention: formation.anneePromo || "", mention: formation.mention || "",
    serie: formation.specialite || "", statut,
  }];
};

export const diplomeScolairePrincipal = (diplomes: readonly DiplomeScolaire[]) =>
  [...diplomes].sort((a, b) => Number(b.anneeObtention) - Number(a.anneeObtention))[0];

export const erreurDiplomeScolaire = (
  diplome: DiplomeScolaire,
  anneeDebut: string,
  anneeFin: string,
  maintenant = new Date(),
): string => {
  if (!diplome.libelle.trim()) return "Indiquez le diplôme.";
  if (!anneeEstValide(diplome.anneeObtention)) return "L’année doit contenir exactement 4 chiffres.";
  const annee = Number(diplome.anneeObtention);
  if (diplome.statut !== "EN_COURS" && annee > maintenant.getFullYear()) return "Un diplôme obtenu ne peut pas avoir une année future.";
  if ((anneeEstValide(anneeDebut) && annee < Number(anneeDebut))
    || (anneeEstValide(anneeFin) && annee > Number(anneeFin))) {
    return "L’année du diplôme doit se situer dans votre période de scolarité.";
  }
  return "";
};

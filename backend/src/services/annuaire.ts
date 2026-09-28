import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const annuaireSchema = z.object({
  q: z.string().trim().max(100).default(""),
  pays: z.string().trim().max(100).optional(),
  ville: z.string().trim().max(100).optional(),
  situation: z.enum(["ETUDIANT", "PROFESSIONNEL", "ENTREPRENEUR", "EN_RECHERCHE"]).optional(),
  volontaire: z.enum(["true", "false"]).optional(),
  etablissementId: z.string().trim().max(191).optional(),
  promotion: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 10).optional(),
  aide: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

export function perimetreAnnuaire(profilId?: string): Prisma.ProfilWhereInput {
  return { ...(profilId ? { id: { not: profilId } } : {}), onboardingFini: true, user: { statut: "VALIDE" } };
}

export function filtreFormationAnnuaire(etablissementId?: string, promotion?: number): Prisma.FormationWhereInput | undefined {
  if (!etablissementId && !promotion) return undefined;
  return {
    ...(etablissementId ? { etablissementId } : {}),
    ...(promotion ? { OR: [
      { anneeFin: promotion }, { avis: { is: { anneePromo: promotion } } },
      { diplomesScolaires: { array_contains: [{ anneeObtention: String(promotion) }] } },
    ] } : {}),
  };
}

export function construireFiltresAnnuaire(query: z.infer<typeof annuaireSchema>, profilId?: string): Prisma.ProfilWhereInput {
  const { q, pays, ville, situation, volontaire, etablissementId, promotion, aide } = query;
  const clauses: Prisma.ProfilWhereInput[] = [];
  // Each word can match another field: a first name plus a surname remains searchable.
  for (const mot of q.split(/\s+/).filter(Boolean)) {
    clauses.push({ OR: [
      { user: { prenom: { contains: mot } } }, { user: { nom: { contains: mot } } },
      { titre: { contains: mot } }, { bio: { contains: mot } }, { ville: { contains: mot } }, { pays: { contains: mot } },
      { experiences: { some: { OR: [{ poste: { contains: mot } }, { entreprise: { contains: mot } }, { secteur: { contains: mot } }] } } },
      { formations: { some: { OR: [{ etablissement: { nom: { contains: mot } } }, { autreEtablissement: { contains: mot } }, { filiere: { contains: mot } }, { specialite: { contains: mot } }] } } },
      { volontaire: { is: { specialite: { contains: mot } } } },
    ] });
  }
  const formation = filtreFormationAnnuaire(etablissementId, promotion);
  if (formation) clauses.push({ formations: { some: formation } });
  if (aide) clauses.push({ estVolontaire: true, volontaire: { is: { sujets: { array_contains: aide } } } });
  return {
    ...perimetreAnnuaire(profilId),
    ...(pays ? { pays } : {}), ...(ville ? { ville } : {}), ...(situation ? { situation } : {}),
    ...(volontaire ? { estVolontaire: volontaire === "true" } : {}),
    ...(clauses.length ? { AND: clauses } : {}),
  };
}

export function sujetsAide(sujets: unknown): string[] {
  return Array.isArray(sujets) ? [...new Set(sujets.filter((s): s is string => typeof s === "string" && Boolean(s.trim())).map(s => s.trim()))] : [];
}

type FormationPromotion = { anneeFin: number | null; avis?: { anneePromo: number | null } | null; diplomesScolaires?: unknown };
export function promotionsFormation(formation: FormationPromotion): number[] {
  const diplomes = Array.isArray(formation.diplomesScolaires) ? formation.diplomesScolaires : [];
  const annees = [formation.avis?.anneePromo, formation.anneeFin, ...diplomes.map(d => d && typeof d === "object" && "anneeObtention" in d ? Number(d.anneeObtention) : null)];
  return [...new Set(annees.filter((a): a is number => typeof a === "number" && Number.isInteger(a) && a >= 1900 && a <= new Date().getFullYear() + 10))].sort((a,b) => b-a);
}

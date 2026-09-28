import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";

export const PROFIL_PUBLIC_SELECT = {
  id: true,
  userId: true,
  photo: true,
  titre: true,
  pays: true,
  ville: true,
  situation: true,
  user: {
    select: {
      prenom: true,
      nom: true,
      statut: true,
    },
  },
} as const;

export type ProfilPublic = Prisma.ProfilGetPayload<{
  select: typeof PROFIL_PUBLIC_SELECT;
}>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

export function paginationMeta(page: number, limite: number, total: number) {
  return {
    page,
    limite,
    total,
    totalPages: Math.ceil(total / limite),
  };
}

export function formaterProfil(profil: ProfilPublic | null | undefined) {
  if (!profil) return null;
  return {
    id: profil.id,
    prenom: profil.user.prenom,
    nom: profil.user.nom,
    nomComplet:
      [profil.user.prenom, profil.user.nom].filter(Boolean).join(" ") ||
      "Membre Mali Wuli",
    photo: profil.photo,
    titre: profil.titre,
    pays: profil.pays,
    ville: profil.ville,
    situation: profil.situation,
  };
}

export async function profilCourant(userId?: string) {
  if (!userId) return null;
  return prisma.profil.findUnique({
    where: { userId },
    select: PROFIL_PUBLIC_SELECT,
  });
}

export async function profilsParIds(ids: string[]) {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return new Map<string, ProfilPublic>();
  const profils = await prisma.profil.findMany({
    where: { id: { in: uniques } },
    select: PROFIL_PUBLIC_SELECT,
  });
  return new Map(profils.map((profil) => [profil.id, profil]));
}

export function normaliserRecherche(valeur: string | undefined) {
  return valeur?.trim().slice(0, 100) || undefined;
}

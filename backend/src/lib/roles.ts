import { Role } from "@prisma/client";
import { createHash } from "node:crypto";
export const EMAIL_ADMIN_PRINCIPAL = "ik736764@gmail.com";
export const emailAdminPrincipal = (email?: string | null) => (email || "").trim().toLowerCase() === EMAIL_ADMIN_PRINCIPAL;
export const ROLES_DELEGUES = ["PUBLICATIONS", "OFFRES", "EVENEMENTS", "CATALOGUE", "ASSOCIATIONS", "MEMBRES"] as const;
export type RoleDelegue = typeof ROLES_DELEGUES[number];
export const CATALOGUE_ROLES = [
  { code: "PUBLICATIONS", libelle: "Gestion des publications", description: "Supprimer les publications et commentaires du réseau.", permissions: ["PUBLICATIONS_MODERER"], attribuable: true },
  { code: "OFFRES", libelle: "Gestion des offres", description: "Modérer les offres, consulter les propositions, modifier ou retirer une offre.", permissions: ["OFFRES_MODERER"], attribuable: true },
  { code: "EVENEMENTS", libelle: "Gestion des événements", description: "Modérer les événements et gérer leurs informations, couvertures et photos, ou supprimer un événement.", permissions: ["EVENEMENTS_MODERER"], attribuable: true },
  { code: "CATALOGUE", libelle: "Gestion du catalogue", description: "Traiter les propositions et les notifications du catalogue éducatif.", permissions: ["CATALOGUE_GERER"], attribuable: true },
  { code: "ASSOCIATIONS", libelle: "Gestion des associations", description: "Créer, modifier ou supprimer les fiches ; gérer les responsables, suggestions et affiliations des associations. Sa propre affiliation doit être vérifiée par une autre personne habilitée.", permissions: ["ASSOCIATIONS_GERER"], attribuable: true },
  { code: "MEMBRES", libelle: "Gestion des membres", description: "Désactiver et rétablir les comptes ordinaires. Les comptes de l’équipe et l’administrateur général sont protégés.", permissions: ["MEMBRES_GERER"], attribuable: true },
] as const;
export type Permission = "MEMBRES_GERER" | "PUBLICATIONS_MODERER" | "OFFRES_MODERER" | "EVENEMENTS_MODERER" | "CATALOGUE_GERER" | "ASSOCIATIONS_GERER" | "SIGNALEMENTS_CONSULTER" | "CERCLES_GERER" | "ROLES_GERER" | "STATS_CONSULTER";
type UtilisateurDroits = { role: string; email?: string | null; tokenVersion?: number; statut?: string; rolesDelegues?: ReadonlyArray<{ code: string } | string> };
export function roleEffectif(user: { role: string; email?: string | null }): Role {
  if (user.role === Role.ADMIN && !emailAdminPrincipal(user.email)) return Role.MEMBRE;
  return Object.values(Role).includes(user.role as Role) ? user.role as Role : Role.MEMBRE;
}
export const estAdminPrincipal = (user: { role: string; email?: string | null }) => user.role === Role.ADMIN && emailAdminPrincipal(user.email);
export function rolePourInscription(email: string, roleExistant?: Role): Role {
  return emailAdminPrincipal(email) ? Role.ADMIN : roleEffectif({ role: roleExistant || Role.MEMBRE, email });
}
export function rolesDeleguesUtilisateur(user: UtilisateurDroits): RoleDelegue[] {
  return [...new Set((user.rolesDelegues || []).map(r => typeof r === "string" ? r : r.code).filter((r): r is RoleDelegue => (ROLES_DELEGUES as readonly string[]).includes(r)))].sort();
}
export function permissionsUtilisateur(user: UtilisateurDroits): Permission[] {
  const permissions = new Set<Permission>();
  for (const code of rolesDeleguesUtilisateur(user)) for (const permission of CATALOGUE_ROLES.find(r => r.code === code)!.permissions) permissions.add(permission);
  if (roleEffectif(user) === "MODERATEUR") for (const p of ["OFFRES_MODERER", "EVENEMENTS_MODERER", "CATALOGUE_GERER", "SIGNALEMENTS_CONSULTER", "CERCLES_GERER"] as const) permissions.add(p);
  if (estAdminPrincipal(user)) {
    for (const r of CATALOGUE_ROLES) for (const p of r.permissions) permissions.add(p);
    for (const p of ["SIGNALEMENTS_CONSULTER", "CERCLES_GERER", "ROLES_GERER", "STATS_CONSULTER"] as const) permissions.add(p);
  }
  return [...permissions].sort();
}
export const droitsUtilisateur = (user: UtilisateurDroits) => ({ rolesDelegues: rolesDeleguesUtilisateur(user), permissions: permissionsUtilisateur(user) });
export function revisionDroits(user: UtilisateurDroits) {
  // Inclure aussi les grants inconnus pour que toute modification concurrente soit visible.
  const codes = [...new Set((user.rolesDelegues || []).map(r => typeof r === "string" ? r : r.code))].sort();
  return createHash("sha256").update(JSON.stringify([user.role, codes, user.tokenVersion || 0, user.statut || null])).digest("hex");
}

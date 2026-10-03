import { Prisma, Role, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { CATALOGUE_ROLES, EMAIL_ADMIN_PRINCIPAL, ROLES_DELEGUES, emailAdminPrincipal, estAdminPrincipal, roleEffectif, droitsUtilisateur, permissionsUtilisateur, revisionDroits } from "../lib/roles";

export class ErreurGestionMembres extends Error { constructor(public statut: number, message: string) { super(message); } }
export const filtresMembres = z.object({ q: z.string().trim().max(100).optional(), role: z.nativeEnum(Role).optional(), roleDelegue: z.enum(ROLES_DELEGUES).optional(), statut: z.enum(["VALIDE", "REFUSE", "SUSPENDU"]).optional(), page: z.coerce.number().int().min(1).max(10000).default(1), limite: z.coerce.number().int().min(1).max(100).default(30) });
export const changementRolesSchema = z.object({ rolesDelegues: z.array(z.enum(ROLES_DELEGUES)).max(ROLES_DELEGUES.length).refine(v => new Set(v).size === v.length, "Un rôle ne peut apparaître qu’une fois."), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const changementStatutSchema = z.object({ action: z.enum(["DESACTIVER", "RETABLIR"]), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const selectionMembre = { id: true, prenom: true, nom: true, email: true, role: true, rolesDelegues: { select: { code: true } }, statut: true, emailVerifie: true, tokenVersion: true, createdAt: true, updatedAt: true, profil: { select: { id: true, onboardingFini: true } } } as const;
type Membre = Prisma.UserGetPayload<{ select: typeof selectionMembre }>;
const selectionActeur = { id: true, role: true, rolesDelegues: { select: { code: true } }, email: true, statut: true, emailVerifie: true } as const;
type Acteur = Prisma.UserGetPayload<{ select: typeof selectionActeur }>;
type DB = PrismaClient | Prisma.TransactionClient;
export type EffetsGestionMembres = { revoquerSockets: (id: string) => void };
function raisonProtection(u: Membre, acteurId: string) {
  if (u.id === acteurId) return "Vous ne pouvez pas modifier votre propre rôle.";
  if (emailAdminPrincipal(u.email) || u.role === "ADMIN") return "Le compte administrateur est protégé.";
  if (u.statut !== "VALIDE" || !u.emailVerifie) return "Le compte doit être actif et son adresse e-mail confirmée avant d’attribuer un rôle.";
  return null;
}
function raisonProtectionCompte(u: Membre, responsable: Acteur) {
  if (u.id === responsable.id) return "Vous ne pouvez pas désactiver ou rétablir votre propre compte.";
  if (emailAdminPrincipal(u.email) || u.role === "ADMIN") return "Le compte administrateur est protégé.";
  if (!estAdminPrincipal(responsable) && (u.role === "MODERATEUR" || u.rolesDelegues.length > 0)) return "Seul l’administrateur principal peut gérer un compte disposant de droits délégués.";
  return null;
}
function formater(u: Membre, responsable: Acteur) {
  const { profil, tokenVersion: _tokenVersion, ...membre } = u;
  const raison = estAdminPrincipal(responsable) ? raisonProtection(u, responsable.id) : "Seul l’administrateur principal peut modifier les rôles.";
  const protectionCompte = raisonProtectionCompte(u, responsable);
  return { ...membre, role: roleEffectif(u), ...droitsUtilisateur(u), revisionDroits: revisionDroits(u), profilId: profil?.id || null, onboardingFini: profil?.onboardingFini || false, estAdminPrincipal: estAdminPrincipal(u), estMoi: u.id === responsable.id, peutModifierRole: !raison, raisonProtection: raison,
    peutDesactiver: !protectionCompte && u.statut !== "SUSPENDU", peutRetablir: !protectionCompte && u.statut === "SUSPENDU", raisonProtectionCompte: protectionCompte };
}
export function creerServiceGestionMembres(db: PrismaClient, effets: EffetsGestionMembres) {
  async function acteur(userId: string, base: DB = db, perimetre: "roles" | "membres" = "roles") {
    const user = await base.user.findUnique({ where: { id: userId }, select: selectionActeur });
    if (!user || !user.emailVerifie || user.statut !== "VALIDE") throw new ErreurGestionMembres(403, "Compte validé requis.");
    const permissions = permissionsUtilisateur(user);
    const autorise = perimetre === "roles" ? estAdminPrincipal(user) : permissions.includes("MEMBRES_GERER") || permissions.includes("ROLES_GERER");
    if (!autorise) throw new ErreurGestionMembres(403, "Accès réservé à l’administration autorisée.");
    return user;
  }
  async function roles(userId: string) { const user = await acteur(userId, db, "membres"); return { roles: CATALOGUE_ROLES, roleCourant: roleEffectif(user), ...droitsUtilisateur(user), peutGererRoles: estAdminPrincipal(user) }; }
  async function liste(userId: string, f: z.infer<typeof filtresMembres>) {
    const responsable = await acteur(userId, db, "membres");
    const where: Prisma.UserWhereInput = { AND: [
      ...(f.statut ? [{ statut: f.statut }] : []),
      ...(f.roleDelegue ? [{ rolesDelegues: { some: { code: f.roleDelegue } } }] : []),
      ...(f.role === "ADMIN" ? [{ role: "ADMIN" as const, email: EMAIL_ADMIN_PRINCIPAL }] : f.role === "MEMBRE" ? [{ OR: [{ role: "MEMBRE" as const }, { role: "ADMIN" as const, email: { not: EMAIL_ADMIN_PRINCIPAL } }] }] : f.role ? [{ role: f.role }] : []),
      ...(f.q ? f.q.split(/\s+/).map(mot => ({ OR: ["prenom", "nom", "email"].map(champ => ({ [champ]: { contains: mot } })) })) : []),
    ] };
    const [membres, total] = await Promise.all([db.user.findMany({ where, select: selectionMembre, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (f.page - 1) * f.limite, take: f.limite }), db.user.count({ where })]);
    return { membres: membres.map(u => formater(u, responsable)), total, page: f.page, limite: f.limite, totalPages: Math.ceil(total / f.limite) };
  }
  async function modifierRoles(userId: string, cibleId: string, d: z.infer<typeof changementRolesSchema>) {
    const codes = [...d.rolesDelegues].sort();
    const result = await db.$transaction(async tx => {
      const responsable = await acteur(userId, tx);
      const cible = await tx.user.findUnique({ where: { id: cibleId }, select: selectionMembre });
      if (!cible) throw new ErreurGestionMembres(404, "Membre introuvable.");
      const raison = raisonProtection(cible, userId); if (raison) throw new ErreurGestionMembres(403, raison);
      if (revisionDroits(cible) !== d.expectedRevision) throw new ErreurGestionMembres(409, "Les droits de ce membre ont changé. Actualisez la liste.");
      const anciens = cible.rolesDelegues.map(r => r.code).sort();
      if (cible.role === "MEMBRE" && JSON.stringify(anciens) === JSON.stringify(codes)) return { membre: cible, responsable, modifie: false };
      const modifie = await tx.user.updateMany({ where: { id: cible.id, role: cible.role, tokenVersion: cible.tokenVersion, statut: "VALIDE", emailVerifie: true }, data: { role: "MEMBRE", tokenVersion: { increment: 1 } } });
      if (modifie.count !== 1) throw new ErreurGestionMembres(409, "Le compte a changé. Actualisez la liste.");
      await tx.userRoleGrant.deleteMany({ where: { userId: cible.id } });
      if (codes.length) await tx.userRoleGrant.createMany({ data: codes.map(code => ({ userId: cible.id, code })) });
      await tx.loginOtpCode.deleteMany({ where: { email: cible.email } });
      return { membre: await tx.user.findUniqueOrThrow({ where: { id: cible.id }, select: selectionMembre }), responsable, modifie: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.modifie) effets.revoquerSockets(cibleId);
    return { membre: formater(result.membre, result.responsable), message: result.modifie ? "Droits mis à jour. Les anciennes sessions ont été déconnectées." : "Ce membre possède déjà ces droits." };
  }
  async function modifierStatut(userId: string, cibleId: string, d: z.infer<typeof changementStatutSchema>) {
    const result = await db.$transaction(async tx => {
      const responsable = await acteur(userId, tx, "membres");
      const cible = await tx.user.findUnique({ where: { id: cibleId }, select: selectionMembre });
      if (!cible) throw new ErreurGestionMembres(404, "Membre introuvable.");
      const protection = raisonProtectionCompte(cible, responsable);
      if (protection) throw new ErreurGestionMembres(403, protection);
      if (revisionDroits(cible) !== d.expectedRevision) throw new ErreurGestionMembres(409, "Le compte ou ses droits ont changé. Actualisez la liste.");
      if (d.action === "DESACTIVER" && cible.statut === "SUSPENDU") return { membre: cible, responsable, modifie: false };
      if (d.action === "RETABLIR" && cible.statut !== "SUSPENDU") throw new ErreurGestionMembres(409, "Seul un compte désactivé peut être rétabli. Actualisez la liste.");
      const statut = d.action === "DESACTIVER" ? "SUSPENDU" as const : "VALIDE" as const;
      const miseAJour = await tx.user.updateMany({ where: { id: cible.id, role: cible.role, statut: cible.statut, emailVerifie: cible.emailVerifie, tokenVersion: cible.tokenVersion }, data: { statut, tokenVersion: { increment: 1 } } });
      if (miseAJour.count !== 1) throw new ErreurGestionMembres(409, "Le compte a changé. Actualisez la liste.");
      await tx.loginOtpCode.deleteMany({ where: { email: cible.email } });
      return { membre: await tx.user.findUniqueOrThrow({ where: { id: cible.id }, select: selectionMembre }), responsable, modifie: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.modifie) effets.revoquerSockets(cibleId);
    return { membre: formater(result.membre, result.responsable), message: !result.modifie ? "Ce compte est déjà désactivé." : d.action === "DESACTIVER" ? "Compte désactivé. Ses données sont conservées et ses sessions déconnectées." : "Compte rétabli. Cette personne peut de nouveau se connecter et accéder au réseau." };
  }
  return { roles, liste, modifierRoles, modifierStatut };
}
export type ServiceGestionMembres = ReturnType<typeof creerServiceGestionMembres>;

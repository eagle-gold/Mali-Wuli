import { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { roleEffectif, permissionsUtilisateur, type Permission } from "../lib/roles";
import { verifierTokenAcces } from "../lib/auth-token";

type AuthenticatedUser = {
  id: string;
  role: string;
  email?: string;
  statut: string;
  emailVerifie: boolean;
  tokenVersion: number;
};

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  permissions?: Permission[];
  contributorKey?: string;
  authenticatedUser?: AuthenticatedUser;
  /** Session courante (absente pour les jetons émis avant l'identifiant de session). */
  session?: { jti: string; expireLe: Date };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return res.status(401).json({ message: "Token manquant." });

  try {
    const decoded = verifierTokenAcces(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        rolesDelegues: { select: { code: true } },
        email: true,
        statut: true,
        emailVerifie: true,
        tokenVersion: true,
        // Révocation de cette session précise, lue dans la même requête.
        jetonsRevoques: decoded.jti ? { where: { jti: decoded.jti }, select: { jti: true }, take: 1 } : false,
      },
    });
    const revoque = Boolean(user?.jetonsRevoques?.length);

    if (!user || revoque || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: "Session révoquée ou invalide." });
    }
    if (!user.emailVerifie) {
      return res.status(403).json({ message: "Confirmez votre adresse e-mail avant de continuer." });
    }
    if (user.statut === "REFUSE" || user.statut === "SUSPENDU") {
      return res.status(403).json({
        message: user.statut === "SUSPENDU" ? "Votre compte est suspendu." : "Votre compte a été refusé.",
      });
    }
    const role = roleEffectif(user);

    req.userId = user.id;
    // Ce rôle vient volontairement de la base, jamais du JWT.
    req.userRole = role;
    req.permissions = permissionsUtilisateur(user);
    const { jetonsRevoques: _revocation, ...utilisateur } = user;
    req.authenticatedUser = { ...utilisateur, role };
    if (decoded.jti && decoded.exp) req.session = { jti: decoded.jti, expireLe: new Date(decoded.exp * 1000) };
    req.contributorKey = createHash("sha256").update(`user:${user.id}`).digest("hex");
    next();
  } catch {
    return res.status(401).json({ message: "Token invalide ou expiré." });
  }
};

/** Les propositions au catalogue exigent désormais une vraie session membre. */
export const authenticateContributor = authenticate;

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authenticatedUser || !roles.includes(req.authenticatedUser.role)) {
      return res.status(403).json({ message: "Accès refusé." });
    }
    next();
  };
};

export const requirePermission = (permission: Permission) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.permissions?.includes(permission)) return res.status(403).json({ message: "Cette action ne fait pas partie de vos autorisations." });
  next();
};

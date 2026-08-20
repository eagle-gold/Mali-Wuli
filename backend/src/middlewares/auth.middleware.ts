import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  contributorKey?: string;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token manquant." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: "Token invalide ou expiré." });
  }
};

/** Accepte soit un membre connecté, soit l'e-mail vérifié du parcours d'inscription. */
export const authenticateContributor = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return res.status(401).json({ message: "Identification requise." });

  try {
    const decoded = jwt.verify(token, secret) as {
      userId?: string;
      role?: string;
      email?: string;
      purpose?: string;
    };
    if (decoded.userId) {
      req.userId = decoded.userId;
      req.userRole = decoded.role;
      req.contributorKey = createHash("sha256").update(`user:${decoded.userId}`).digest("hex");
      next();
      return;
    }
    if (decoded.purpose === "registration" && decoded.email) {
      req.contributorKey = createHash("sha256")
        .update(`registration:${decoded.email.trim().toLowerCase()}`)
        .digest("hex");
      next();
      return;
    }
    return res.status(401).json({ message: "Identification invalide." });
  } catch {
    return res.status(401).json({ message: "Identification invalide ou expirée." });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.userRole || "")) {
      return res.status(403).json({ message: "Accès refusé." });
    }
    next();
  };
};

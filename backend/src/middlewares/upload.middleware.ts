import fs from "fs";
import path from "path";
import type { NextFunction, Request, Response } from "express";
import multer, { FileFilterCallback, StorageEngine } from "multer";

export const uploadRoot = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),
);

const dossiers = {
  avatars: path.join(uploadRoot, "avatars"),
  couvertures: path.join(uploadRoot, "couvertures"),
  publications: path.join(uploadRoot, "publications"),
  evenements: path.join(uploadRoot, "evenements"),
};

Object.values(dossiers).forEach((dossier) => fs.mkdirSync(dossier, { recursive: true }));

const extensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function filtreImage(_req: Request, fichier: Express.Multer.File, callback: FileFilterCallback) {
  if (extensions[fichier.mimetype]) return callback(null, true);
  return callback(new Error("Format non supporté. Utilisez JPEG, PNG ou WebP."));
}

function stockage(dossier: keyof typeof dossiers, prefixe: string): StorageEngine {
  return multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, dossiers[dossier]),
    filename: (req: Request & { userId?: string }, fichier, callback) => {
      const extension = extensions[fichier.mimetype] || ".bin";
      const identifiant = req.userId || "membre";
      const aleatoire = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
      callback(null, `${prefixe}-${identifiant}-${aleatoire}${extension}`);
    },
  });
}

export const uploadAvatar = multer({
  storage: stockage("avatars", "avatar"),
  fileFilter: filtreImage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadCouverture = multer({
  storage: stockage("couvertures", "couverture"),
  fileFilter: filtreImage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadPublication = multer({
  storage: stockage("publications", "publication"),
  fileFilter: filtreImage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Les routes contrôlent les droits avant ce middleware, puis avant l’enregistrement.
export const uploadEvenement = multer({
  storage: stockage("evenements", "evenement"),
  fileFilter: filtreImage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

function mimeReelImage(fichier: string) {
  const descripteur = fs.openSync(fichier, "r");
  try {
    const entete = Buffer.alloc(12);
    fs.readSync(descripteur, entete, 0, entete.length, 0);
    if (entete.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return "image/png";
    }
    if (entete[0] === 0xff && entete[1] === 0xd8 && entete[2] === 0xff) return "image/jpeg";
    if (entete.subarray(0, 4).toString("ascii") === "RIFF"
      && entete.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    return null;
  } finally {
    fs.closeSync(descripteur);
  }
}

/**
 * Multer valide l'en-tête HTTP, puis ce middleware valide la signature réelle
 * du fichier. Un script renommé en .png n'est ainsi jamais conservé ni servi.
 */
export function verifierImageChargee(req: Request, _res: Response, next: NextFunction) {
  const fichier = req.file;
  if (!fichier) return next();
  try {
    const mimeReel = mimeReelImage(fichier.path);
    if (!mimeReel || mimeReel !== fichier.mimetype) {
      fs.unlinkSync(fichier.path);
      req.file = undefined;
      return next(new Error("Format non supporté ou contenu du fichier invalide."));
    }
    return next();
  } catch (erreur) {
    if (fs.existsSync(fichier.path)) fs.unlinkSync(fichier.path);
    req.file = undefined;
    return next(erreur);
  }
}

export function cheminUploadDepuisUrl(url?: string | null) {
  if (!url?.startsWith("/uploads/")) return null;
  const relatif = url.slice("/uploads/".length);
  const absolu = path.resolve(uploadRoot, relatif);
  return absolu.startsWith(uploadRoot + path.sep) ? absolu : null;
}

export function supprimerUpload(url?: string | null) {
  const fichier = cheminUploadDepuisUrl(url);
  if (fichier && fs.existsSync(fichier)) fs.unlinkSync(fichier);
}

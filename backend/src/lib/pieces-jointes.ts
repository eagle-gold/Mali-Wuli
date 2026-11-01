import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

/**
 * Pièces jointes de la messagerie : règles pures (formats, signatures, noms)
 * et emplacement du stockage privé. Le type retenu vient toujours du contenu
 * réel du fichier, jamais de l'en-tête envoyé par le navigateur.
 */

export const TAILLE_MAX_PIECE = 10 * 1024 * 1024;
export const NOMBRE_MAX_PIECES = 5;

type Format = { mime: string; extensions: string[]; image?: boolean };

/** Formats acceptés, classés par famille de signature. */
const IMAGES: Record<string, Format> = {
  jpeg: { mime: "image/jpeg", extensions: [".jpg", ".jpeg"], image: true },
  png: { mime: "image/png", extensions: [".png"], image: true },
  webp: { mime: "image/webp", extensions: [".webp"], image: true },
  gif: { mime: "image/gif", extensions: [".gif"], image: true },
};
const BUREAUTIQUE_ZIP: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
};
const BUREAUTIQUE_OLE: Record<string, string> = {
  ".doc": "application/msword",
  ".xls": "application/vnd.ms-excel",
  ".ppt": "application/vnd.ms-powerpoint",
};
const TEXTE: Record<string, string> = { ".txt": "text/plain; charset=utf-8", ".csv": "text/csv; charset=utf-8" };

/** Extensions proposées dans le sélecteur de fichiers. */
export const EXTENSIONS_ACCEPTEES = [
  ...Object.values(IMAGES).flatMap((format) => format.extensions),
  ".pdf",
  ...Object.keys(BUREAUTIQUE_ZIP),
  ...Object.keys(BUREAUTIQUE_OLE),
  ...Object.keys(TEXTE),
];

const commencePar = (entete: Buffer, octets: number[], decalage = 0) =>
  octets.every((octet, index) => entete[decalage + index] === octet);

/**
 * Détermine le type d'un fichier d'après ses premiers octets et son extension.
 * Renvoie null si le contenu ne correspond à aucun format autorisé.
 */
export function detecterType(entete: Buffer, nomFichier: string): { mime: string; image: boolean } | null {
  const extension = path.extname(nomFichier).toLowerCase();
  if (commencePar(entete, [0xff, 0xd8, 0xff])) return { mime: IMAGES.jpeg.mime, image: true };
  if (commencePar(entete, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: IMAGES.png.mime, image: true };
  if (entete.subarray(0, 4).toString("latin1") === "RIFF" && entete.subarray(8, 12).toString("latin1") === "WEBP") {
    return { mime: IMAGES.webp.mime, image: true };
  }
  if (/^GIF8[79]a$/.test(entete.subarray(0, 6).toString("latin1"))) return { mime: IMAGES.gif.mime, image: true };
  if (entete.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", image: false };
  if (commencePar(entete, [0x50, 0x4b, 0x03, 0x04]) && BUREAUTIQUE_ZIP[extension]) {
    return { mime: BUREAUTIQUE_ZIP[extension], image: false };
  }
  if (commencePar(entete, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && BUREAUTIQUE_OLE[extension]) {
    return { mime: BUREAUTIQUE_OLE[extension], image: false };
  }
  // Texte brut : extension explicite et aucun octet nul (pas de binaire déguisé).
  if (TEXTE[extension] && entete.length > 0 && !entete.includes(0)) return { mime: TEXTE[extension], image: false };
  return null;
}

/** Nom affichable et sûr : sans chemin, sans caractères de contrôle, longueur bornée. */
export function nettoyerNomFichier(nom: string) {
  const base = path.basename(String(nom || "").replace(/\\/g, "/"))
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!base || base === "." || base === "..") return "fichier";
  if (base.length <= 120) return base;
  const extension = path.extname(base).slice(0, 12);
  return `${base.slice(0, 120 - extension.length)}${extension}`;
}

/** En-tête Content-Disposition compatible avec les noms accentués (RFC 6266). */
export function contentDisposition(nom: string, enLigne: boolean) {
  const ascii = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${enLigne ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`;
}

/** Dossier privé : jamais sous le dossier public /uploads. */
export const dossierPiecesJointes = path.resolve(
  process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private-uploads"),
  "messages",
);
fs.mkdirSync(dossierPiecesJointes, { recursive: true });

export function nomFichierStockage(nomOrigine: string) {
  const extension = path.extname(nomOrigine).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  return `${randomUUID()}${extension}`;
}

/** Chemin absolu d'un fichier stocké, protégé contre la traversée de répertoires. */
export function cheminPieceJointe(fichier: string) {
  const absolu = path.resolve(dossierPiecesJointes, fichier);
  return absolu.startsWith(dossierPiecesJointes + path.sep) ? absolu : null;
}

export function supprimerPieceJointe(fichier: string) {
  const chemin = cheminPieceJointe(fichier);
  try { if (chemin && fs.existsSync(chemin)) fs.unlinkSync(chemin); } catch (erreur) { console.error("Pièce jointe non supprimée", erreur); }
}

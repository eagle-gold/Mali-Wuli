/** Règles d'affichage de la messagerie (fonctions pures, testées). */

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const veille = (date: Date) => {
  const resultat = new Date(date);
  resultat.setDate(resultat.getDate() - 1);
  return resultat;
};

export const heureCourte = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);

/**
 * Statut d'activité affiché sous le nom de l'interlocuteur.
 * null quand rien n'est connu : l'interface affiche alors le titre du membre.
 */
export function libellePresence(enLigne: boolean | undefined, derniereActivite: string | null | undefined, maintenant = new Date()) {
  if (enLigne) return "En ligne";
  if (!derniereActivite) return null;
  const date = new Date(derniereActivite);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = Math.floor((maintenant.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Actif à l’instant";
  if (minutes < 60) return `Actif il y a ${minutes} min`;
  if (memeJour(date, maintenant)) return `Actif aujourd’hui à ${heureCourte(date)}`;
  if (memeJour(date, veille(maintenant))) return `Actif hier à ${heureCourte(date)}`;
  const jours = Math.floor(minutes / 1_440);
  if (jours < 7) return `Actif ${new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(date)}`;
  const memeAnnee = date.getFullYear() === maintenant.getFullYear();
  return `Actif le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", ...(memeAnnee ? {} : { year: "numeric" }) }).format(date)}`;
}

/** Libellé d'un séparateur de jour dans le fil. */
export function libelleJour(iso: string, maintenant = new Date()) {
  const date = new Date(iso);
  if (memeJour(date, maintenant)) return "Aujourd’hui";
  if (memeJour(date, veille(maintenant))) return "Hier";
  const memeAnnee = date.getFullYear() === maintenant.getFullYear();
  const texte = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", ...(memeAnnee ? {} : { year: "numeric" }) }).format(date);
  return texte.charAt(0).toLocaleUpperCase("fr") + texte.slice(1);
}

type MessagePositionnable = { id: string; auteur: string; envoyeLe: string };
export type PositionMessage = { separateurJour: string | null; debutGroupe: boolean; finGroupe: boolean };

/** Deux messages du même auteur à moins de 5 minutes forment un groupe visuel. */
const ECART_GROUPE_MS = 5 * 60_000;

export function positionsMessages<T extends MessagePositionnable>(messages: T[], maintenant = new Date()): PositionMessage[] {
  return messages.map((message, index) => {
    const precedent = messages[index - 1];
    const suivant = messages[index + 1];
    const date = new Date(message.envoyeLe);
    const nouveauJour = !precedent || !memeJour(new Date(precedent.envoyeLe), date);
    const lieAuPrecedent = Boolean(precedent) && !nouveauJour && precedent.auteur === message.auteur
      && date.getTime() - new Date(precedent.envoyeLe).getTime() < ECART_GROUPE_MS;
    const lieAuSuivant = Boolean(suivant) && memeJour(new Date(suivant.envoyeLe), date) && suivant.auteur === message.auteur
      && new Date(suivant.envoyeLe).getTime() - date.getTime() < ECART_GROUPE_MS;
    return {
      separateurJour: nouveauJour ? libelleJour(message.envoyeLe, maintenant) : null,
      debutGroupe: !lieAuPrecedent,
      finGroupe: !lieAuSuivant,
    };
  });
}

// ─── Pièces jointes (contrôles côté navigateur ; le serveur revérifie tout) ───

export const TAILLE_MAX_PIECE = 10 * 1024 * 1024;
export const NOMBRE_MAX_PIECES = 5;
export const EXTENSIONS_ACCEPTEES = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp", ".doc", ".xls", ".ppt", ".txt", ".csv"];
export const ACCEPT_FICHIERS = EXTENSIONS_ACCEPTEES.join(",");

export function formaterTaille(octets: number) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

export function extensionDe(nom: string) {
  const position = nom.lastIndexOf(".");
  return position > 0 ? nom.slice(position).toLowerCase() : "";
}

/** Sélection de fichiers : retient les fichiers valides et explique les refus. */
export function trierFichiers(existants: number, fichiers: { name: string; size: number }[]) {
  const acceptes: number[] = [];
  const refus: string[] = [];
  fichiers.forEach((fichier, index) => {
    if (!EXTENSIONS_ACCEPTEES.includes(extensionDe(fichier.name))) refus.push(`« ${fichier.name} » : format non accepté.`);
    else if (fichier.size > TAILLE_MAX_PIECE) refus.push(`« ${fichier.name} » dépasse 10 Mo.`);
    else if (fichier.size === 0) refus.push(`« ${fichier.name} » est vide.`);
    else if (existants + acceptes.length >= NOMBRE_MAX_PIECES) refus.push(`${NOMBRE_MAX_PIECES} fichiers au maximum par message.`);
    else acceptes.push(index);
  });
  return { acceptes, refus: [...new Set(refus)] };
}

/** Famille d'un fichier, pour choisir son icône et sa couleur. */
export function familleFichier(nom: string): "pdf" | "texte" | "tableur" | "presentation" | "image" | "autre" {
  const extension = extensionDe(nom);
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) return "image";
  if (extension === ".pdf") return "pdf";
  if ([".doc", ".docx", ".odt", ".txt"].includes(extension)) return "texte";
  if ([".xls", ".xlsx", ".ods", ".csv"].includes(extension)) return "tableur";
  if ([".ppt", ".pptx", ".odp"].includes(extension)) return "presentation";
  return "autre";
}

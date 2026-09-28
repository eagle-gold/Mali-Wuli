import type { Evenement } from "../types/evenements";

export const FUSEAUX_HORAIRES = [
  { value: "Africa/Bamako", label: "Bamako (Mali)" },
  { value: "Africa/Abidjan", label: "Abidjan (Côte d’Ivoire)" },
  { value: "Africa/Dakar", label: "Dakar (Sénégal)" },
  { value: "Africa/Casablanca", label: "Casablanca (Maroc)" },
  { value: "Africa/Tunis", label: "Tunis (Tunisie)" },
  { value: "Europe/Paris", label: "Paris (France)" },
  { value: "Europe/Brussels", label: "Bruxelles (Belgique)" },
  { value: "Europe/London", label: "Londres (Royaume-Uni)" },
  { value: "Europe/Berlin", label: "Berlin (Allemagne)" },
  { value: "America/Toronto", label: "Montréal / Toronto (Canada)" },
  { value: "America/New_York", label: "New York (États-Unis)" },
  { value: "America/Los_Angeles", label: "Los Angeles (États-Unis)" },
  { value: "Asia/Dubai", label: "Dubaï (Émirats arabes unis)" },
];

export function fuseauEvenement(fuseau?: string | null) {
  const zone = fuseau || "Africa/Bamako";
  try { new Intl.DateTimeFormat("fr-FR", { timeZone: zone }).format(); }
  catch { throw new Error("Choisissez un fuseau horaire valide."); }
  return zone;
}

function partiesDate(date: Date, fuseau: string) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseauEvenement(fuseau), year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(p => [p.type, p.value]));
}

export function champsDateEvenement(iso: string, fuseau?: string | null) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("La date de l’événement est invalide.");
  const p = partiesDate(date, fuseauEvenement(fuseau));
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}

/** Convertit une heure du lieu, indépendamment du fuseau du navigateur. */
export function dateLocaleVersIso(jour: string, heure: string, fuseau: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !/^\d{2}:\d{2}$/.test(heure)) {
    throw new Error("Renseignez une date et une heure valides.");
  }
  const base = new Date(`${jour}T${heure}:00.000Z`);
  if (Number.isNaN(base.getTime()) || base.toISOString().slice(0, 16) !== `${jour}T${heure}`) {
    throw new Error("Renseignez une date et une heure valides.");
  }
  const zone = fuseauEvenement(fuseau);
  const offsets = new Set<number>();
  // Observer les deux côtés du changement d’heure pour détecter heure absente ou répétée.
  for (const decalage of [-36, -12, 0, 12, 36]) {
    const instant = new Date(base.getTime() + decalage * 3600000);
    const p = partiesDate(instant, zone);
    const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    offsets.add(local - instant.getTime());
  }
  const candidats = [...offsets].map(offset => new Date(base.getTime() - offset))
    .filter(date => { const p = champsDateEvenement(date.toISOString(), zone); return p.jour === jour && p.heure === heure; });
  if (!candidats.length) throw new Error("Cette heure n’existe pas dans ce fuseau à cause du changement d’heure. Choisissez une autre heure.");
  if (candidats.length > 1) throw new Error("Cette heure se produit deux fois lors du changement d’heure. Choisissez une heure sans ambiguïté.");
  return candidats[0].toISOString();
}

export function formaterDateEvenement(iso: string, fuseau?: string | null, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: fuseauEvenement(fuseau) }).format(new Date(iso));
}
export function formaterHeureEvenement(iso: string, fuseau?: string | null) {
  return formaterDateEvenement(iso, fuseau, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}
export function cleMoisEvenement(iso: string, fuseau?: string | null) {
  return champsDateEvenement(iso, fuseau).jour.slice(0, 7);
}

function echapperCalendrier(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
function plierLigne(value: string) {
  const encoder = new TextEncoder();
  let result = "", longueur = 0;
  for (const char of value) {
    const octets = encoder.encode(char).length;
    if (longueur + octets > 75) { result += "\r\n "; longueur = 1; }
    result += char; longueur += octets;
  }
  return result;
}

export function creerCalendrierIcs(evenement: Pick<Evenement, "id" | "titre" | "description" | "dateDebut" | "dateFin" | "lieu" | "ville" | "pays" | "type" | "lienVideo">, url: string, maintenant = new Date()) {
  const date = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lieu = evenement.type === "EN_LIGNE" ? evenement.lienVideo || "En ligne" : [evenement.lieu, evenement.ville, evenement.pays].filter(Boolean).join(", ");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mali Wuli//Evenements//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${encodeURIComponent(evenement.id)}@mali-wuli.com`, `DTSTAMP:${date(maintenant.toISOString())}`,
    `DTSTART:${date(evenement.dateDebut)}`, ...(evenement.dateFin ? [`DTEND:${date(evenement.dateFin)}`] : []),
    `SUMMARY:${echapperCalendrier(evenement.titre)}`, `DESCRIPTION:${echapperCalendrier(evenement.description)}`,
    `LOCATION:${echapperCalendrier(lieu)}`, `URL:${echapperCalendrier(url)}`, "END:VEVENT", "END:VCALENDAR",
  ].map(plierLigne).join("\r\n") + "\r\n";
}

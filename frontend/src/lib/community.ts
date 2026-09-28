import axios from "axios";

export type PaginationApi = {
  page: number;
  limite: number;
  total: number;
  totalPages: number;
};

export function messageErreur(
  error: unknown,
  repli = "Une erreur est survenue.",
) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || repli;
  }
  return error instanceof Error ? error.message : repli;
}

export function initiales(prenom?: string | null, nom?: string | null) {
  const valeur = `${prenom?.[0] || ""}${nom?.[0] || ""}`.trim();
  return valeur.toUpperCase() || "MW";
}

export function nomComplet(prenom?: string | null, nom?: string | null) {
  return [prenom, nom].filter(Boolean).join(" ") || "Membre Mali Wuli";
}

export function formaterDate(
  date?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!date) return "Date à préciser";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date à préciser";
  return new Intl.DateTimeFormat(
    "fr-FR",
    options || {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(parsed);
}

export function datePourChamp(date: Date) {
  const decalage = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 16);
}

export function classeStatut(statut?: string | null) {
  if (["ACCEPTE", "INSCRIT", "VALIDE"].includes(statut || ""))
    return "badge-vert";
  return "badge-terre";
}

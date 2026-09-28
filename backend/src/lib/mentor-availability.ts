import { z } from "zod";

const disponibilitesSchema = z.array(
  z.object({
    jour: z.string().trim().min(2).max(20),
    ouvert: z.boolean(),
    plages: z.array(
      z.object({
        debut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    ).max(12),
  }),
).max(7);

export type PlanningVolontaire = {
  fuseau: string;
  dureeCreneau: number;
  dateDebut: Date | null;
  dateFin: Date | null;
  disponibilites: unknown;
  delaiMinResa: number;
};

type DateLocale = {
  annee: number;
  mois: number;
  jour: number;
  heure: number;
  minute: number;
  seconde: number;
};

export type CreneauCalcule = { debut: Date; fin: Date };

function normaliser(valeur: string) {
  return valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function minutes(heure: string) {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

export function fuseauValide(fuseau: string) {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau }).format(new Date());
    return fuseau;
  } catch {
    return "Africa/Bamako";
  }
}

function partiesDansFuseau(date: Date, fuseauBrut: string): DateLocale {
  const fuseau = fuseauValide(fuseauBrut);
  const parties = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const lire = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parties.find((partie) => partie.type === type)?.value || "0");
  return {
    annee: lire("year"),
    mois: lire("month"),
    jour: lire("day"),
    heure: lire("hour"),
    minute: lire("minute"),
    seconde: lire("second"),
  };
}

function dateLocaleVersUtc(locale: DateLocale, fuseauBrut: string) {
  const fuseau = fuseauValide(fuseauBrut);
  const cible = Date.UTC(
    locale.annee,
    locale.mois - 1,
    locale.jour,
    locale.heure,
    locale.minute,
    locale.seconde,
  );
  let resultat = cible;
  for (let tentative = 0; tentative < 4; tentative += 1) {
    const representee = partiesDansFuseau(new Date(resultat), fuseau);
    const representeeUtc = Date.UTC(
      representee.annee,
      representee.mois - 1,
      representee.jour,
      representee.heure,
      representee.minute,
      representee.seconde,
    );
    const correction = cible - representeeUtc;
    resultat += correction;
    if (Math.abs(correction) < 1000) break;
  }
  return new Date(resultat);
}

function ajouterJours(date: Pick<DateLocale, "annee" | "mois" | "jour">, nombre: number) {
  const resultat = new Date(Date.UTC(date.annee, date.mois - 1, date.jour + nombre, 12));
  return {
    annee: resultat.getUTCFullYear(),
    mois: resultat.getUTCMonth() + 1,
    jour: resultat.getUTCDate(),
  };
}

function jourSemaine(date: Date, fuseau: string) {
  return normaliser(new Intl.DateTimeFormat("fr-FR", {
    timeZone: fuseauValide(fuseau),
    weekday: "long",
  }).format(date));
}

function memeDateLocale(date: Date, locale: DateLocale, fuseau: string) {
  const retour = partiesDansFuseau(date, fuseau);
  return retour.annee === locale.annee
    && retour.mois === locale.mois
    && retour.jour === locale.jour
    && retour.heure === locale.heure
    && retour.minute === locale.minute;
}

function disponibilitesDe(planning: PlanningVolontaire) {
  const analyse = disponibilitesSchema.safeParse(planning.disponibilites);
  return analyse.success ? analyse.data : [];
}

export function genererCreneaux(
  planning: PlanningVolontaire,
  nombreJours: number,
  maintenant = new Date(),
) {
  const fuseau = fuseauValide(planning.fuseau);
  const disponibilites = disponibilitesDe(planning);
  if (!disponibilites.length || planning.dureeCreneau < 10 || planning.dureeCreneau > 240) return [];

  const aujourdHui = partiesDansFuseau(maintenant, fuseau);
  const auPlusTot = new Date(maintenant.getTime() + Math.max(0, planning.delaiMinResa) * 3_600_000);
  const resultat: CreneauCalcule[] = [];

  for (let index = 0; index < nombreJours; index += 1) {
    const date = ajouterJours(aujourdHui, index);
    const midiUtc = dateLocaleVersUtc({ ...date, heure: 12, minute: 0, seconde: 0 }, fuseau);
    const disponibilite = disponibilites.find(
      (item) => item.ouvert && normaliser(item.jour) === jourSemaine(midiUtc, fuseau),
    );
    if (!disponibilite) continue;

    for (const plage of disponibilite.plages) {
      const debutPlage = minutes(plage.debut);
      const finPlage = minutes(plage.fin);
      if (finPlage <= debutPlage) continue;
      for (
        let minuteDebut = debutPlage;
        minuteDebut + planning.dureeCreneau <= finPlage;
        minuteDebut += planning.dureeCreneau
      ) {
        const locale: DateLocale = {
          ...date,
          heure: Math.floor(minuteDebut / 60),
          minute: minuteDebut % 60,
          seconde: 0,
        };
        const debut = dateLocaleVersUtc(locale, fuseau);
        if (!memeDateLocale(debut, locale, fuseau)) continue;
        const fin = new Date(debut.getTime() + planning.dureeCreneau * 60_000);
        if (debut < auPlusTot) continue;
        if (planning.dateDebut && debut < planning.dateDebut) continue;
        if (planning.dateFin && debut > planning.dateFin) continue;
        resultat.push({ debut, fin });
      }
    }
  }
  return resultat;
}

export function verifierCreneau(
  planning: PlanningVolontaire,
  debut: Date,
  maintenant = new Date(),
) {
  const horizon = new Date(maintenant.getTime() + 90 * 86_400_000);
  if (debut > horizon) return null;
  const candidats = genererCreneaux(planning, 91, maintenant);
  return candidats.find((creneau) => creneau.debut.getTime() === debut.getTime()) ?? null;
}

export function cleMois(date: Date, fuseau: string) {
  const locale = partiesDansFuseau(date, fuseau);
  return `${locale.annee}-${String(locale.mois).padStart(2, "0")}`;
}

export function bornesMois(date: Date, fuseau: string) {
  const locale = partiesDansFuseau(date, fuseau);
  const debut = dateLocaleVersUtc(
    { annee: locale.annee, mois: locale.mois, jour: 1, heure: 0, minute: 0, seconde: 0 },
    fuseau,
  );
  const moisSuivant = locale.mois === 12
    ? { annee: locale.annee + 1, mois: 1 }
    : { annee: locale.annee, mois: locale.mois + 1 };
  const fin = dateLocaleVersUtc(
    { ...moisSuivant, jour: 1, heure: 0, minute: 0, seconde: 0 },
    fuseau,
  );
  return { debut, fin };
}

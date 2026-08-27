export const MOIS = [
  { value: "01", label: "Janvier" },
  { value: "02", label: "Février" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Août" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
] as const;

export const normaliserAnnee = (valeur: string) => valeur.replace(/\D/g, "").slice(0, 4);

export const anneeEstValide = (valeur: string) => /^\d{4}$/.test(valeur);

export const periodeEstValide = (
  moisDebut: string,
  anneeDebut: string,
  moisFin: string,
  anneeFin: string,
) => {
  if (!MOIS.some(({ value }) => value === moisDebut)
    || !MOIS.some(({ value }) => value === moisFin)
    || !anneeEstValide(anneeDebut)
    || !anneeEstValide(anneeFin)) {
    return false;
  }
  const debut = Number(anneeDebut) * 12 + Number(moisDebut);
  const fin = Number(anneeFin) * 12 + Number(moisFin);
  return debut <= fin;
};

export const formaterMoisAnnee = (mois: string | undefined, annee: string) => {
  const libelleMois = MOIS.find(({ value }) => value === mois)?.label;
  return [libelleMois?.toLocaleLowerCase("fr"), annee].filter(Boolean).join(" ");
};

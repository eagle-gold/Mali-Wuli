"use client";

import { useState } from "react";

type PlageMentorat = {
  debut: string;
  fin: string;
};

export type DisponibiliteMentorat = {
  jour: string;
  ouvert: boolean;
  plages: PlageMentorat[];
};

export interface MentoratData {
  estVolontaire: boolean;
  sujets: string[];
  precisionsSujets: Record<string, string>;
  duree: number;
  format: string;
  fuseauHoraire: string;
  dateDebut: string;
  dateFin: string | null;
  disponibilites: DisponibiliteMentorat[];
  maxRdvMois: number | null;
}

interface StepMentoratProps {
  onNext: (data: MentoratData) => void;
  onBack: () => void;
}

const SUJETS = [
  { nom: "Orientation post-bac", exemple: "Ex. : filières scientifiques, séries du bac malien" },
  { nom: "Choix d’études à l’étranger", exemple: "Ex. : France, Canada, Maroc" },
  { nom: "Bourses & dossiers", exemple: "Ex. : Campus France, lettres de motivation, bourses Erasmus" },
  { nom: "Préparation aux concours", exemple: "Ex. : ENA, médecine, écoles d’ingénieurs" },
  { nom: "Préparation d’entretien", exemple: "Ex. : simulation RH, entretien technique, prise de parole" },
  { nom: "Relecture de CV / portfolio", exemple: "Ex. : CV junior, profil LinkedIn, portfolio design" },
  { nom: "Premier emploi", exemple: "Ex. : candidatures, recherche d’offres, premiers mois en poste" },
  { nom: "Reconversion", exemple: "Ex. : passer de la finance au numérique" },
  { nom: "Création d’entreprise", exemple: "Ex. : idée, business plan, financement au Mali" },
  { nom: "Mentorat métier", exemple: "Ex. : sage-femme, développeur, chef de projet" },
  { nom: "Autre expertise", exemple: "Ex. : droit minier, agriculture, marchés publics" },
] as const;

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DUREES = [20, 30, 45];
const FORMATS = ["Visio", "Téléphone", "Sur place"];
const MAX_RDV = [1, 2, 4, null] as const;
const FUSEAUX = [
  { value: "Africa/Bamako", label: "Bamako / Abidjan / Dakar (GMT)" },
  { value: "Europe/Paris", label: "Paris / Bruxelles (GMT+1 / GMT+2)" },
  { value: "Africa/Casablanca", label: "Casablanca (GMT+1)" },
  { value: "Africa/Algiers", label: "Alger (GMT+1)" },
  { value: "Europe/London", label: "Londres (GMT / GMT+1)" },
  { value: "America/Toronto", label: "Montréal / Toronto (GMT-5 / GMT-4)" },
  { value: "America/New_York", label: "New York / Washington (GMT-5 / GMT-4)" },
];

const HEURES = Array.from({ length: 36 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const heures = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { value, label: `${heures} h ${String(minutes).padStart(2, "0")}` };
});

const minutesDepuisMinuit = (heure: string) => {
  const [heures, minutes] = heure.split(":").map(Number);
  return heures * 60 + minutes;
};

const heureDepuisMinutes = (total: number) => {
  const borne = Math.min(Math.max(total, 6 * 60), 23 * 60 + 30);
  return `${String(Math.floor(borne / 60)).padStart(2, "0")}:${String(borne % 60).padStart(2, "0")}`;
};

const disponibilitesInitiales = (): DisponibiliteMentorat[] =>
  JOURS.map((jour, index) => ({
    jour,
    ouvert: index === 0,
    plages: index === 0 ? [{ debut: "09:00", fin: "12:00" }] : [],
  }));

const nombreCreneaux = (plages: PlageMentorat[], duree: number) =>
  plages.reduce((total, plage) => {
    const amplitude = minutesDepuisMinuit(plage.fin) - minutesDepuisMinuit(plage.debut);
    return total + Math.max(0, Math.floor(amplitude / duree));
  }, 0);

const BOUTON_CHOIX =
  "rounded-[16px] border px-5 py-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2";
const PETIT_BOUTON =
  "rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm font-semibold text-[#74685c] transition hover:border-[#0d6738] hover:text-[#0d6738]";

export default function StepMentorat({ onNext, onBack }: StepMentoratProps) {
  const [estVolontaire, setEstVolontaire] = useState<boolean | null>(null);
  const [sujets, setSujets] = useState<string[]>([]);
  const [precisionsSujets, setPrecisionsSujets] = useState<Record<string, string>>({});
  const [messageSujet, setMessageSujet] = useState("");
  const [duree, setDuree] = useState(30);
  const [format, setFormat] = useState("Visio");
  const [fuseauHoraire, setFuseauHoraire] = useState("Africa/Bamako");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [sansDateFin, setSansDateFin] = useState(true);
  const [disponibilites, setDisponibilites] = useState<DisponibiliteMentorat[]>(disponibilitesInitiales);
  const [maxRdvMois, setMaxRdvMois] = useState<number | null>(2);

  const fuseauLibelle = FUSEAUX.find(({ value }) => value === fuseauHoraire)?.label || fuseauHoraire;
  const joursOuverts = disponibilites.filter(({ ouvert, plages }) => ouvert && plages.length > 0);
  const totalCreneaux = joursOuverts.reduce(
    (total, jour) => total + nombreCreneaux(jour.plages, duree),
    0,
  );
  const toutesLesPlagesSontValides = joursOuverts.every((jour) =>
    jour.plages.every((plage) => nombreCreneaux([plage], duree) > 0),
  );
  const precisionsCompletes = sujets.every((sujet) => precisionsSujets[sujet]?.trim());
  const canContinue = estVolontaire === false || (
    estVolontaire === true && sujets.length > 0 && precisionsCompletes && totalCreneaux > 0 &&
    toutesLesPlagesSontValides
  );

  const toggleSujet = (sujet: string) => {
    setMessageSujet("");
    setSujets((precedents) => {
      if (precedents.includes(sujet)) {
        setPrecisionsSujets((precisions) => {
          const prochaines = { ...precisions };
          delete prochaines[sujet];
          return prochaines;
        });
        return precedents.filter((item) => item !== sujet);
      }
      if (precedents.length >= 3) {
        setMessageSujet("Choisissez au maximum trois sujets pour que votre profil reste clair.");
        return precedents;
      }
      return [...precedents, sujet];
    });
  };

  const toggleJour = (jour: string) => {
    setDisponibilites((precedentes) => precedentes.map((item) => {
      if (item.jour !== jour) return item;
      const ouvert = !item.ouvert;
      return {
        ...item,
        ouvert,
        plages: ouvert && item.plages.length === 0 ? [{ debut: "09:00", fin: "10:00" }] : item.plages,
      };
    }));
  };

  const mettreAJourPlage = (jour: string, index: number, champ: keyof PlageMentorat, valeur: string) => {
    setDisponibilites((precedentes) => precedentes.map((item) => item.jour === jour
      ? { ...item, plages: item.plages.map((plage, plageIndex) => plageIndex === index ? { ...plage, [champ]: valeur } : plage) }
      : item));
  };

  const retirerPlage = (jour: string, index: number) => {
    setDisponibilites((precedentes) => precedentes.map((item) => {
      if (item.jour !== jour) return item;
      const plages = item.plages.filter((_, plageIndex) => plageIndex !== index);
      return { ...item, plages, ouvert: plages.length > 0 };
    }));
  };

  const ajouterPlage = (jour: string) => {
    setDisponibilites((precedentes) => precedentes.map((item) => {
      if (item.jour !== jour || item.plages.length >= 3) return item;
      const derniereFin = item.plages.at(-1)?.fin || "14:00";
      const debutMinutes = Math.min(minutesDepuisMinuit(derniereFin), 22 * 60);
      const nouvellePlage = {
        debut: heureDepuisMinutes(debutMinutes),
        fin: heureDepuisMinutes(debutMinutes + 60),
      };
      return { ...item, plages: [...item.plages, nouvellePlage] };
    }));
  };

  const appliquerATousLesJoursOuverts = (jourSource: string) => {
    const plagesSource = disponibilites.find(({ jour }) => jour === jourSource)?.plages || [];
    setDisponibilites((precedentes) => precedentes.map((item) => item.ouvert
      ? { ...item, plages: plagesSource.map((plage) => ({ ...plage })) }
      : item));
  };

  const recap = `Rendez-vous de ${duree} min en ${format.toLowerCase()}, ${joursOuverts.length} jour(s) ouvert(s) et ${totalCreneaux} créneau(x) par semaine, ${maxRdvMois === null ? "sans plafond mensuel" : `maximum ${maxRdvMois} par mois`}, heures de ${fuseauLibelle}${dateDebut ? `, à partir du ${new Date(`${dateDebut}T12:00:00`).toLocaleDateString("fr-FR")}` : ", disponible dès maintenant"}${sansDateFin || !dateFin ? ", sans date de fin" : `, jusqu’au ${new Date(`${dateFin}T12:00:00`).toLocaleDateString("fr-FR")}`}. Modifiable à tout moment depuis votre profil.`;

  const terminer = () => {
    if (!canContinue || estVolontaire === null) return;
    const precisionsRetenues = Object.fromEntries(
      sujets.map((sujet) => [sujet, precisionsSujets[sujet]?.trim() || ""]),
    );
    onNext({
      estVolontaire,
      sujets: estVolontaire ? sujets : [],
      precisionsSujets: estVolontaire ? precisionsRetenues : {},
      duree,
      format,
      fuseauHoraire,
      dateDebut: estVolontaire ? dateDebut : "",
      dateFin: estVolontaire && !sansDateFin && dateFin ? dateFin : null,
      disponibilites: estVolontaire ? disponibilites : [],
      maxRdvMois,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] bg-[#735133] px-6 py-8 text-[#fffaf4] sm:px-10 sm:py-10">
        <h1 className="mb-4 max-w-[900px] font-display text-3xl font-bold leading-tight sm:text-4xl">
          Souhaitez-vous être volontaire pour le mentorat ?
        </h1>
        <p className="max-w-[930px] text-base leading-[1.7] sm:text-lg">
          Un lycéen de Sikasso qui hésite entre deux concours, une sage-femme de Kayes qui cherche une formation,
          un jeune diplômé qui prépare un entretien : ils ouvrent votre profil et réservent un créneau, comme on
          prend rendez-vous. Vous restez maître de votre agenda et pouvez tout fermer en un clic.
        </p>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            ["Vous choisissez la durée", "20, 30 ou 45 minutes. Jamais plus si vous ne le voulez pas."],
            ["Aucune obligation", "Vous fixez un plafond mensuel, le calendrier s’arrête tout seul."],
            ["Gratuit, toujours", "Le mentorat ne se monnaie pas sur Mali Wuli. C’est la charte."],
          ].map(([titre, texte]) => (
            <article key={titre} className="rounded-[16px] bg-white/10 px-5 py-5">
              <h2 className="mb-2 font-sans text-base font-bold">{titre}</h2>
              <p className="text-sm leading-relaxed text-[#fffaf4]">{texte}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#ead8bd] bg-[#fffbf5] p-5 shadow-sm sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={estVolontaire === true}
            onClick={() => setEstVolontaire(true)}
            className={`${BOUTON_CHOIX} ${estVolontaire === true ? "border-[#0d6738] bg-[#eaf1e9]" : "border-[#ead8bd] bg-[#fffbf5] hover:border-[#0d6738]"}`}
          >
            <span className={`mb-1 block text-base font-bold ${estVolontaire === true ? "text-[#0d6738]" : "text-[#2e261f]"}`}>
              Oui, je veux mentorer
            </span>
            <span className="block text-sm text-[#806f5f]">J’ouvre des créneaux et je réponds aux demandes.</span>
          </button>
          <button
            type="button"
            aria-pressed={estVolontaire === false}
            onClick={() => setEstVolontaire(false)}
            className={`${BOUTON_CHOIX} ${estVolontaire === false ? "border-[#d9bf99] bg-[#f1e4d1]" : "border-[#ead8bd] bg-[#fffbf5] hover:border-[#735133]"}`}
          >
            <span className="mb-1 block text-base font-bold text-[#2e261f]">Pas pour l’instant</span>
            <span className="block text-sm text-[#806f5f]">Je rejoins le réseau sans ouvrir de créneaux.</span>
          </button>
        </div>

        {estVolontaire === false && (
          <p className="mt-5 rounded-[14px] bg-[#f6efe3] px-5 py-4 text-sm leading-relaxed text-[#2e261f]">
            Aucun souci, vous pourrez ouvrir des créneaux à tout moment depuis votre profil. En attendant, vous
            pouvez répondre au forum, rejoindre un cercle ou recommander une offre d’emploi.
          </p>
        )}

        {estVolontaire === true && (
          <div className="mt-7 space-y-8 border-t border-[#ead8bd] pt-7">
            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-sans text-lg font-bold text-[#2e261f]">Sur quoi pouvez-vous aider ?</h2>
                  <p className="text-sm text-[#2e261f]">Deux ou trois suffisent : ce sont les sujets affichés sur votre profil.</p>
                </div>
                <span className="rounded-full bg-[#f6efe3] px-3 py-1 text-xs font-semibold text-[#735133]">{sujets.length}/3 sujet(s)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUJETS.map(({ nom }) => {
                  const selectionne = sujets.includes(nom);
                  return (
                    <button
                      key={nom}
                      type="button"
                      aria-pressed={selectionne}
                      onClick={() => toggleSujet(nom)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${selectionne ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#ead8bd] bg-[#fffbf5] text-[#806f5f] hover:border-[#0d6738] hover:text-[#0d6738]"}`}
                    >
                      {nom}
                    </button>
                  );
                })}
              </div>
              {messageSujet && <p role="alert" className="mt-3 text-sm font-medium text-[#a44824]">{messageSujet}</p>}
            </div>

            {sujets.length > 0 && (
              <div className="rounded-[16px] border border-[#ead8bd] bg-[#fffdf9] p-4 sm:p-5">
                <h3 className="mb-1 font-sans text-base font-bold text-[#2e261f]">Précisez pour chaque sujet</h3>
                <p className="mb-4 text-sm text-[#806f5f]">Soyez concret : la personne comprend immédiatement ce qu’elle peut vous demander.</p>
                <div className="space-y-4">
                  {sujets.map((sujet) => {
                    const configuration = SUJETS.find(({ nom }) => nom === sujet);
                    return (
                      <div key={sujet} className="grid min-w-0 gap-2 sm:grid-cols-[250px_minmax(0,1fr)] sm:items-center sm:gap-4">
                        <label htmlFor={`precision-${sujet}`} className="text-sm font-semibold text-[#2e261f]">{sujet} <span className="text-[#c65327]">*</span></label>
                        <input
                          id={`precision-${sujet}`}
                          value={precisionsSujets[sujet] || ""}
                          maxLength={180}
                          onChange={(event) => setPrecisionsSujets((precedentes) => ({ ...precedentes, [sujet]: event.target.value }))}
                          placeholder={configuration?.exemple}
                          className="min-w-0 rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 font-sans text-lg font-bold text-[#2e261f]">Durée d’un rendez-vous</h3>
                <div className="grid grid-cols-3 gap-2">
                  {DUREES.map((valeur) => (
                    <button
                      key={valeur}
                      type="button"
                      aria-pressed={duree === valeur}
                      onClick={() => setDuree(valeur)}
                      className={`${PETIT_BOUTON} ${duree === valeur ? "!border-[#2e261f] !bg-[#2e261f] !text-white" : ""}`}
                    >
                      {valeur} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-sans text-lg font-bold text-[#2e261f]">Format</h3>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((valeur) => (
                    <button
                      key={valeur}
                      type="button"
                      aria-pressed={format === valeur}
                      onClick={() => setFormat(valeur)}
                      className={`${PETIT_BOUTON} ${format === valeur ? "!border-[#cfe1d7] !bg-[#e3f0e9] !text-[#0d6738]" : ""}`}
                    >
                      {valeur}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-sans text-lg font-bold text-[#2e261f]">Vos disponibilités</h3>
                  <p className="text-sm text-[#2e261f]">Ouvrez les jours qui vous vont et réglez les heures précisément.</p>
                </div>
                <span className="rounded-full bg-[#e3f0e9] px-4 py-2 text-sm font-semibold text-[#0d6738]">{joursOuverts.length} jour(s), {totalCreneaux} créneau(x)</span>
              </div>

              <div className="mb-5 grid gap-4 md:grid-cols-3">
                <div className="min-w-0">
                  <label htmlFor="fuseau-mentorat" className="mb-2 block text-sm font-semibold text-[#2e261f]">Votre fuseau horaire</label>
                  <select id="fuseau-mentorat" value={fuseauHoraire} onChange={(event) => setFuseauHoraire(event.target.value)} className="w-full rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none focus:border-[#0d6738]">
                    {FUSEAUX.map((fuseau) => <option key={fuseau.value} value={fuseau.value}>{fuseau.label}</option>)}
                  </select>
                  <p className="mt-2 text-xs text-[#806f5f]">Les créneaux suivront ce fuseau, même en voyage.</p>
                </div>
                <div>
                  <label htmlFor="debut-mentorat" className="mb-2 block text-sm font-semibold text-[#2e261f]">Disponible à partir du</label>
                  <input id="debut-mentorat" type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className="w-full rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none focus:border-[#0d6738]" />
                  <p className="mt-2 text-xs text-[#806f5f]">Laissez vide pour être disponible dès maintenant.</p>
                </div>
                <div>
                  <label htmlFor="fin-mentorat" className="mb-2 block text-sm font-semibold text-[#2e261f]">Jusqu’au <span className="font-normal">(optionnel)</span></label>
                  <input id="fin-mentorat" type="date" min={dateDebut || undefined} value={dateFin} disabled={sansDateFin} onChange={(event) => setDateFin(event.target.value)} className="w-full rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-4 py-3 text-sm text-[#2e261f] outline-none disabled:bg-[#f1e4d1] disabled:text-[#a89784] focus:border-[#0d6738]" />
                  <label className="mt-2 flex items-center gap-2 text-xs text-[#2e261f]">
                    <input type="checkbox" checked={sansDateFin} onChange={(event) => setSansDateFin(event.target.checked)} className="h-4 w-4 accent-[#0d6738]" />
                    Sans date de fin
                  </label>
                </div>
              </div>

              <div className="overflow-hidden rounded-[16px] border border-[#ead8bd] bg-[#fffdf9]">
                {disponibilites.map((disponibilite) => (
                  <div key={disponibilite.jour} className="grid min-w-0 border-b border-[#ead8bd] last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)]">
                    <label className="flex cursor-pointer items-center gap-3 border-b border-[#ead8bd] px-4 py-4 md:border-b-0 md:border-r">
                      <input type="checkbox" checked={disponibilite.ouvert} onChange={() => toggleJour(disponibilite.jour)} className="h-5 w-5 accent-[#0d6738]" />
                      <span className="font-semibold text-[#2e261f]">{disponibilite.jour}</span>
                    </label>
                    <div className="min-w-0 px-4 py-4">
                      {!disponibilite.ouvert ? (
                        <button type="button" onClick={() => toggleJour(disponibilite.jour)} className="text-left text-sm text-[#74685c] hover:text-[#0d6738]">
                          Indisponible — cliquez pour ouvrir ce jour
                        </button>
                      ) : (
                        <div className="space-y-3">
                          {disponibilite.plages.map((plage, index) => {
                            const plageValide = minutesDepuisMinuit(plage.fin) > minutesDepuisMinuit(plage.debut);
                            return (
                              <div key={`${disponibilite.jour}-${index}`} className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-[#2e261f]">
                                <span>de</span>
                                <select aria-label={`Heure de début ${disponibilite.jour}, plage ${index + 1}`} value={plage.debut} onChange={(event) => mettreAJourPlage(disponibilite.jour, index, "debut", event.target.value)} className="rounded-[10px] border border-[#dfc9a8] bg-[#fffbf5] px-3 py-2 outline-none focus:border-[#0d6738]">
                                  {HEURES.map((heure) => <option key={heure.value} value={heure.value}>{heure.label}</option>)}
                                </select>
                                <span>à</span>
                                <select aria-label={`Heure de fin ${disponibilite.jour}, plage ${index + 1}`} value={plage.fin} onChange={(event) => mettreAJourPlage(disponibilite.jour, index, "fin", event.target.value)} className="rounded-[10px] border border-[#dfc9a8] bg-[#fffbf5] px-3 py-2 outline-none focus:border-[#0d6738]">
                                  {HEURES.map((heure) => <option key={heure.value} value={heure.value}>{heure.label}</option>)}
                                </select>
                                <span className={`font-semibold ${plageValide ? "text-[#0d6738]" : "text-[#a44824]"}`}>
                                  {plageValide ? `${nombreCreneaux([plage], duree)} créneau(x) de ${duree} min` : "L’heure de fin doit être plus tard"}
                                </span>
                                <button type="button" onClick={() => retirerPlage(disponibilite.jour, index)} className="ml-auto font-semibold text-[#2e261f] hover:text-[#a44824]">Retirer</button>
                              </div>
                            );
                          })}
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-[#0d6738]">
                            <button type="button" disabled={disponibilite.plages.length >= 3} onClick={() => ajouterPlage(disponibilite.jour)} className="disabled:cursor-not-allowed disabled:opacity-40">+ Ajouter une plage</button>
                            <button type="button" disabled={disponibilite.plages.length === 0} onClick={() => appliquerATousLesJoursOuverts(disponibilite.jour)} className="disabled:cursor-not-allowed disabled:opacity-40">Appliquer à tous les jours ouverts</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[#f6efe3] px-5 py-4">
              <span className="text-sm font-semibold text-[#2e261f]">Pas plus de</span>
              {MAX_RDV.map((valeur) => (
                <button key={valeur ?? "illimite"} type="button" aria-pressed={maxRdvMois === valeur} onClick={() => setMaxRdvMois(valeur)} className={`${PETIT_BOUTON} !px-4 !py-2 ${maxRdvMois === valeur ? "!border-[#2e261f] !bg-[#2e261f] !text-white" : ""}`}>
                  {valeur === null ? "Sans limite" : valeur}
                </button>
              ))}
              <span className="text-sm font-semibold text-[#2e261f]">rendez-vous par mois.</span>
            </div>

            {totalCreneaux > 0 && (
              <p className="rounded-[14px] border border-[#efcdbb] bg-[#f8e4d7] px-5 py-4 text-sm leading-relaxed text-[#9b4827]">
                <strong>Récapitulatif :</strong> {recap}
              </p>
            )}
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 border-t border-[#ead8bd] pt-6 sm:flex-row">
          <button type="button" onClick={onBack} className="rounded-[12px] border border-[#dfc9a8] bg-[#fffbf5] px-6 py-3 font-semibold text-[#2e261f] hover:bg-[#f6efe3]">Retour</button>
          <button type="button" disabled={!canContinue} onClick={terminer} className={`flex-1 rounded-full px-6 py-4 text-base font-semibold transition ${canContinue ? "bg-[#0d6738] text-white hover:bg-[#09572f]" : "cursor-not-allowed bg-[#eee2d0] text-[#ad9e8b]"}`}>
            {estVolontaire === null ? "Choisissez une réponse" : "Terminer mon inscription"}
          </button>
        </div>
        {estVolontaire === true && !canContinue && (
          <p className="mt-3 text-center text-xs text-[#806f5f]">Choisissez au moins un sujet, précisez-le et ouvrez un créneau valide.</p>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import AssociationsProfil from "@/components/profile/AssociationsProfil";
import LiensSociauxProfil from "@/components/profile/LiensSociauxProfil";
import { useSessionMembre } from "@/components/auth/SessionMembreContext";
import type { ReseauxSociaux } from "@/lib/reseaux-sociaux";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  HeartHandshake,
  LoaderCircle,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { aPermission } from "@/lib/autorisations";
import { formaterMoisAnnee, trierParDateDebut } from "@/lib/periode";
import { libelleProgramme, libelleSystemeEducatif } from "@/lib/education/reference";
import { avisEtablissementScolaireEstDisponible } from "@/lib/education/suivi";
import { urlMediaBackend } from "@/lib/media";
import type {
  CreationSynergieResponseApi,
  DiplomeScolaireProfilApi,
  ExperienceProfilApi,
  FormationProfilApi,
  PhotoProfilResponseApi,
  StatutInscriptionProfilApi,
  SuggestionSynergieApi,
  SuggestionsSynergieResponseApi,
  UtilisateurProfilApi,
} from "@/types/profile";

type InformationsProfil = ReseauxSociaux & {
  prenom?: string;
  nom?: string;
  telephone?: string;
  indicatif?: string;
  pays?: string;
  paysCode?: string;
  ville?: string;
};

type FormationProfil = {
  id?: string;
  type?: "ecole" | "lycee" | "universite";
  pays?: string;
  ville?: string;
  etablissement?: string;
  programme?: string;
  specialite?: string;
  moisDebut?: string;
  anneeDebut?: string;
  moisFin?: string;
  anneeFin?: string;
  statutDiplome?: "OBTENU" | "EN_COURS" | "NON_OBTENU" | "NON_DIPLOMANTE";
  diplome?: string;
  mention?: string;
  serie?: string;
  systemeEducatifCode?: string;
  diplomesScolaires?: DiplomeScolaireProfilApi[];
  anneePromo?: string;
  noteEnseignants?: number | null;
  noteContenu?: number | null;
  noteCadre?: number | null;
};

type ExperienceProfil = {
  id?: string;
  poste?: string;
  structure?: string;
  typeContrat?: string;
  pays?: string;
  ville?: string;
  lieu?: string;
  moisDebut?: string;
  anneeDebut?: string;
  moisFin?: string;
  anneeFin?: string;
  posteActuel?: boolean;
  description?: string;
};

type PlageMentorat = {
  debut?: string;
  fin?: string;
};

type DisponibiliteMentorat = {
  jour?: string;
  ouvert?: boolean;
  plages?: PlageMentorat[];
};

type MentoratProfil = {
  estVolontaire?: boolean;
  sujets?: string[];
  precisionsSujets?: Record<string, string>;
  duree?: number | null;
  format?: string | null;
  fuseauHoraire?: string;
  dateDebut?: string;
  dateFin?: string | null;
  disponibilites?: DisponibiliteMentorat[];
  maxRdvMois?: number | null;
};

type DonneesProfil = {
  informations?: InformationsProfil;
  formations?: FormationProfil[];
  experiences?: ExperienceProfil[];
  mentorat?: MentoratProfil;
};

type SuggestionMembre = {
  id: string;
  nom: string;
  initiales: string;
  fonction: string;
  ville: string;
  ton: "vert" | "orange" | "sable";
  photo?: string | null;
};

const CLASSE_CARTE =
  "rounded-[18px] border border-[#eae3d4] bg-[#fdfaf4] shadow-[0_1px_2px_rgba(73,50,30,0.03)]";
const CLASSE_BOUTON_PRIMAIRE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2a5b37] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#214a2c] focus:outline-none focus:ring-2 focus:ring-[#2a5b37] focus:ring-offset-2 sm:text-base";
const CLASSE_BOUTON_SECONDAIRE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dfd1bd] bg-[#fdfaf4] px-4 py-3 text-sm font-bold text-[#292119] transition hover:border-[#2a5b37] hover:text-[#2a5b37] focus:outline-none focus:ring-2 focus:ring-[#2a5b37] focus:ring-offset-2 sm:text-base";

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);

const initialesDe = (prenom?: string, nom?: string) =>
  [prenom, nom]
    .filter((partie): partie is string => typeof partie === "string" && partie.trim().length > 0)
    .map((partie) => partie.trim()[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("fr") || "MW";

const lieuDe = (ville?: string, pays?: string, lieu?: string) =>
  [ville, pays].filter(Boolean).join(", ") || lieu || "Lieu non renseigné";

const periodeDe = (
  moisDebut?: string,
  anneeDebut?: string,
  moisFin?: string,
  anneeFin?: string,
  actuelle = false,
) => {
  const debut = anneeDebut ? formaterMoisAnnee(moisDebut, anneeDebut) : "";
  const fin = actuelle
    ? "aujourd’hui"
    : anneeFin
      ? formaterMoisAnnee(moisFin, anneeFin)
      : "";
  if (debut && fin) return debut + " → " + fin;
  return debut || fin || "Période non renseignée";
};

const moisApi = (mois?: number | null) =>
  typeof mois === "number" && mois >= 1 && mois <= 12 ? String(mois).padStart(2, "0") : "";

const anneeApi = (annee?: number | null) =>
  typeof annee === "number" && Number.isFinite(annee) ? String(annee) : "";

function dateApi(date?: string | null) {
  if (!date) return { mois: "", annee: "" };
  const valeur = new Date(date);
  if (Number.isNaN(valeur.getTime())) return { mois: "", annee: "" };
  return {
    mois: String(valeur.getUTCMonth() + 1).padStart(2, "0"),
    annee: String(valeur.getUTCFullYear()),
  };
}

function typeFormationApi(formation: FormationProfilApi): FormationProfil["type"] {
  const type = (formation.etablissement?.type || formation.type || "").toLocaleUpperCase("fr");
  if (type.includes("LYCEE") || type.includes("LYCÉE")) return "lycee";
  if (type.includes("FONDAMENT") || type === "ECOLE" || type === "ÉCOLE") return "ecole";
  return "universite";
}

const nomReference = (
  reference?: { nom?: string | null; libelle?: string | null; sigle?: string | null } | null,
) => reference?.nom?.trim() || reference?.libelle?.trim() || reference?.sigle?.trim() || "";

function adapterFormation(formation: FormationProfilApi): FormationProfil {
  const avis = formation.avis;
  return {
    id: formation.id,
    type: typeFormationApi(formation),
    pays: formation.etablissement?.pays?.nom || formation.etablissement?.paysCode || undefined,
    ville: formation.etablissement?.ville || undefined,
    etablissement:
      formation.etablissement?.nom
      || formation.autreEtablissement
      || formation.etablissement?.sigle
      || undefined,
    programme:
      nomReference(formation.programmeReference)
      || formation.filiere
      || formation.serie
      || undefined,
    specialite:
      formation.specialite
      || nomReference(formation.parcoursReference)
      || formation.filiere
      || formation.serie
      || undefined,
    moisDebut: moisApi(formation.moisDebut),
    anneeDebut: anneeApi(formation.anneeDebut),
    moisFin: moisApi(formation.moisFin),
    anneeFin: anneeApi(formation.anneeFin),
    statutDiplome: formation.statutDiplome || (formation.enCours ? "EN_COURS" : "OBTENU"),
    diplome: formation.diplome || nomReference(formation.diplomeReference) || undefined,
    mention: formation.mention || undefined,
    serie: formation.serie || undefined,
    systemeEducatifCode: formation.systemeEducatifCode || undefined,
    diplomesScolaires: Array.isArray(formation.diplomesScolaires) ? formation.diplomesScolaires : [],
    anneePromo: anneeApi(avis?.anneePromo || formation.anneeFin),
    noteEnseignants: avis?.noteEnseignement,
    noteContenu: avis?.noteContenu,
    noteCadre: avis?.noteInfrastructures,
  };
}

function adapterExperience(experience: ExperienceProfilApi): ExperienceProfil {
  const debut = dateApi(experience.dateDebut);
  const fin = dateApi(experience.dateFin);
  return {
    id: experience.id,
    poste: experience.poste,
    structure: experience.entreprise,
    typeContrat: experience.typeContrat || undefined,
    pays: experience.pays || undefined,
    ville: experience.ville || undefined,
    moisDebut: debut.mois,
    anneeDebut: debut.annee,
    moisFin: fin.mois,
    anneeFin: fin.annee,
    posteActuel: experience.estActuel,
    description: experience.description || undefined,
  };
}

function sujetsMentorat(valeur: unknown, repli?: string | null) {
  if (Array.isArray(valeur)) {
    return valeur.filter((sujet): sujet is string => typeof sujet === "string" && sujet.trim().length > 0);
  }
  return (repli || "")
    .split(",")
    .map((sujet) => sujet.trim())
    .filter((sujet) => sujet && sujet.toLocaleLowerCase("fr") !== "non renseigné");
}

function precisionsMentorat(valeur: unknown) {
  if (!estObjet(valeur)) return {};
  return Object.fromEntries(
    Object.entries(valeur).filter(
      (entree): entree is [string, string] => typeof entree[1] === "string" && entree[1].trim().length > 0,
    ),
  );
}

function disponibilitesMentorat(valeur: unknown): DisponibiliteMentorat[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.flatMap((item) => {
    if (!estObjet(item)) return [];
    const plages = Array.isArray(item.plages)
      ? item.plages.flatMap((plage) => {
          if (!estObjet(plage)) return [];
          const debut = typeof plage.debut === "string" ? plage.debut : undefined;
          const fin = typeof plage.fin === "string" ? plage.fin : undefined;
          return debut || fin ? [{ debut, fin }] : [];
        })
      : [];
    return [{
      jour: typeof item.jour === "string" ? item.jour : undefined,
      ouvert: item.ouvert === true,
      plages,
    }];
  });
}

function adapterProfil(utilisateur: UtilisateurProfilApi): DonneesProfil {
  const profil = utilisateur.profil;
  const volontaire = profil.volontaire;
  const sujets = sujetsMentorat(volontaire?.sujets, volontaire?.specialite);

  return {
    informations: {
      prenom: utilisateur.prenom || undefined,
      nom: utilisateur.nom || undefined,
      telephone: profil.telephone || undefined,
      pays: profil.pays || undefined,
      ville: profil.ville || undefined,
      linkedin: profil.linkedin,
      facebook: profil.facebook,
      instagram: profil.instagram,
      tiktok: profil.tiktok,
    },
    formations: trierParDateDebut((profil.formations || []).map(adapterFormation)),
    experiences: trierParDateDebut((profil.experiences || []).map(adapterExperience)),
    mentorat: {
      estVolontaire: profil.estVolontaire === true && volontaire?.disponible !== false,
      sujets,
      precisionsSujets: precisionsMentorat(volontaire?.precisionsSujets),
      duree: volontaire?.dureeCreneau,
      format: volontaire?.format || undefined,
      fuseauHoraire: volontaire?.fuseau || undefined,
      dateDebut: volontaire?.dateDebut || undefined,
      dateFin: volontaire?.dateFin,
      disponibilites: disponibilitesMentorat(volontaire?.disponibilites),
      maxRdvMois: volontaire?.maxRdvMois,
    },
  };
}

function adapterSuggestion(suggestion: SuggestionSynergieApi, index: number): SuggestionMembre {
  const prenom = suggestion.user.prenom?.trim() || "Membre";
  const nom = suggestion.user.nom?.trim() || "Mali Wuli";
  const experience = suggestion.experiences?.[0];
  const tons: SuggestionMembre["ton"][] = ["vert", "sable", "orange"];
  return {
    id: suggestion.id,
    nom: `${prenom} ${nom}`.trim(),
    initiales: initialesDe(prenom, nom),
    fonction: suggestion.titre?.trim() || experience?.poste?.trim() || "Membre du réseau",
    ville: suggestion.ville?.trim() || suggestion.pays?.trim() || "Localisation non renseignée",
    ton: tons[index % tons.length] || "vert",
    photo: urlMediaBackend(suggestion.photo),
  };
}

function messageErreurApi(erreur: unknown, repli: string) {
  if (!estObjet(erreur)) return repli;
  const response = estObjet(erreur.response) ? erreur.response : null;
  const data = response && estObjet(response.data) ? response.data : null;
  return typeof data?.message === "string" && data.message.trim() ? data.message : repli;
}

const STATUT_PROFIL: Record<
  StatutInscriptionProfilApi,
  { libelle: string; detail: string; classe: string }
> = {
  EN_ATTENTE: {
    libelle: "En attente de validation",
    detail: "Votre profil est relu par l’équipe, réponse sous 48 h.",
    classe: "bg-[#f3e4d8] text-[#ac6139]",
  },
  VALIDE: {
    libelle: "Profil validé",
    detail: "Votre profil est visible par les membres du réseau.",
    classe: "bg-[#e5efe8] text-[#2a5b37]",
  },
  REFUSE: {
    libelle: "Profil à compléter",
    detail: "Certaines informations doivent être corrigées avant la validation.",
    classe: "bg-[#f3e4d8] text-[#ac6139]",
  },
  SUSPENDU: {
    libelle: "Profil suspendu",
    detail: "Contactez l’équipe Mali Wuli pour réactiver votre profil.",
    classe: "bg-[#eee8df] text-[#664c33]",
  },
};

const tonAvatar = {
  vert: "bg-[#e5efe8] text-[#2a5b37]",
  orange: "bg-[#f3e4d8] text-[#ac6139]",
  sable: "bg-[#eae3d4] text-[#664c33]",
};

function AvatarInitiales({
  initiales,
  ton,
  grand = false,
}: {
  initiales: string;
  ton: keyof typeof tonAvatar;
  grand?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={
        "flex shrink-0 items-center justify-center rounded-full font-bold "
        + tonAvatar[ton]
        + (grand ? " h-24 w-24 text-2xl sm:h-32 sm:w-32 sm:text-3xl" : " h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg")
      }
    >
      {initiales}
    </span>
  );
}

function TitreCarte({
  titre,
  href,
  action = "Modifier",
}: {
  titre: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h2 className="font-display text-2xl font-bold leading-tight text-[#292119] sm:text-3xl">
        {titre}
      </h2>
      {href && (
        <Link
          href={href}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cee0d4] bg-[#f2f7f3] px-4 py-2 text-sm font-bold text-[#2a5b37] transition hover:bg-[#e5efe8] focus:outline-none focus:ring-2 focus:ring-[#2a5b37]"
        >
          <Pencil aria-hidden="true" size={15} />
          {action}
        </Link>
      )}
    </div>
  );
}

function Experiences({ experiences }: { experiences: ExperienceProfil[] }) {
  return (
    <section className={CLASSE_CARTE + " p-5 sm:p-8"}>
      <TitreCarte titre="Expériences" href="/onboarding?etape=experiences" />
      {experiences.length ? (
        <ol className="relative ml-2 border-l-2 border-[#eadbc6] pl-7">
          {experiences.map((experience, index) => (
            <li key={experience.id || String(index)} className="relative pb-7 last:pb-0">
              <span className="absolute -left-[35px] top-1.5 h-3.5 w-3.5 rounded-full bg-[#ac6139] ring-4 ring-[#fdfaf4]" />
              <h3 className="break-words font-display text-lg font-bold leading-snug text-[#292119] sm:text-xl">
                {experience.poste || "Poste non renseigné"}
                {experience.structure ? ", " + experience.structure : ""}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[#695c4b] sm:text-base">
                {lieuDe(experience.ville, experience.pays, experience.lieu)}
                {" · "}
                {periodeDe(
                  experience.moisDebut,
                  experience.anneeDebut,
                  experience.moisFin,
                  experience.anneeFin,
                  Boolean(experience.posteActuel),
                )}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl bg-[var(--color-page)] p-4 text-[#695c4b]">
          Aucune expérience renseignée pour le moment.
        </p>
      )}
    </section>
  );
}

function Formations({ formations }: { formations: FormationProfil[] }) {
  return (
    <section className={CLASSE_CARTE + " p-5 sm:p-8"}>
      <TitreCarte titre="Formations" href="/onboarding?etape=formations" />
      {formations.length ? (
        <ol className="relative ml-2 border-l-2 border-[#d8e5dc] pl-7">
          {formations.map((formation, index) => {
            const estScolaire = formation.type === "ecole" || formation.type === "lycee";
            const diplomes = [...(formation.diplomesScolaires || [])].sort((a, b) => (
              (Number(a.anneeObtention) || Number.MAX_SAFE_INTEGER)
              - (Number(b.anneeObtention) || Number.MAX_SAFE_INTEGER)
            ));
            const titreParcours = libelleProgramme(
              formation.diplome || formation.programme || (estScolaire ? "Parcours scolaire" : "Formation"),
            );
            const periode = periodeDe(
              formation.moisDebut,
              formation.anneeDebut,
              formation.moisFin,
              formation.anneeFin,
              formation.statutDiplome === "EN_COURS",
            );
            return (
              <li key={formation.id || String(index)} className="relative pb-7 last:pb-0">
                <span className="absolute -left-[35px] top-1.5 h-3.5 w-3.5 rounded-full bg-[#2a5b37] ring-4 ring-[#fdfaf4]" />
                <h3 className="break-words font-display text-lg font-bold leading-snug text-[#292119] sm:text-xl">
                  {formation.etablissement || "Établissement non renseigné"}
                </h3>
                {estScolaire && formation.systemeEducatifCode && (
                  <p className="mt-1 text-sm text-[#2a5b37]">
                    {libelleSystemeEducatif(formation.systemeEducatifCode)}
                  </p>
                )}
                {diplomes.length === 0 && (
                  <p className="mt-1 text-sm leading-relaxed text-[#695c4b] sm:text-base">
                    {titreParcours}
                    {formation.specialite ? " · " + libelleProgramme(formation.specialite) : ""}
                    {formation.mention ? " · Mention " + formation.mention : ""}
                  </p>
                )}
                <p className="mt-1 text-sm leading-relaxed text-[#695c4b] sm:text-base">
                  {lieuDe(formation.ville, formation.pays)}
                  {" · "}
                  {periode === "Période non renseignée" && formation.anneePromo
                    ? formation.anneePromo
                    : periode}
                </p>
                {diplomes.length > 0 && (
                  <ul aria-label="Diplômes du parcours" className="mt-3 space-y-3">
                    {diplomes.map((diplome, diplomeIndex) => (
                      <li key={`${diplome.type}-${diplome.anneeObtention}-${diplomeIndex}`} className="text-sm leading-relaxed text-[#695c4b]">
                        <p className="font-medium text-[#292119]">
                          {diplome.libelle || (diplome.type === "BAC" ? "Baccalauréat" : diplome.type === "BREVET" ? "Brevet" : "Diplôme")}
                        </p>
                        <p>
                          {diplome.statut === "EN_COURS" ? "En préparation" : "Obtenu"}
                          {diplome.anneeObtention ? `${diplome.statut === "EN_COURS" ? " · prévu en" : " en"} ${diplome.anneeObtention}` : ""}
                          {diplome.serie ? " · Série " + diplome.serie : ""}
                          {diplome.mention ? " · Mention " + diplome.mention : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-[var(--color-page)] p-4 text-[#695c4b]">
          Aucune formation renseignée pour le moment.
        </p>
      )}
    </section>
  );
}

function Mentorat({ mentorat }: { mentorat?: MentoratProfil }) {
  const creneaux = (mentorat?.disponibilites || []).filter(
    (jour) => Boolean(jour.ouvert) && Array.isArray(jour.plages) && jour.plages.length > 0,
  );
  const sujets = Array.isArray(mentorat?.sujets)
    ? mentorat.sujets.filter((sujet): sujet is string => typeof sujet === "string")
    : [];
  const actif = mentorat?.estVolontaire === true;

  return (
    <section className={CLASSE_CARTE + " p-5 sm:p-7"}>
      <TitreCarte titre="Mon mentorat" href="/onboarding?etape=mentorat" />
      <div className="mb-4 flex flex-wrap gap-2">
        {actif && sujets.length ? (
          sujets.map((sujet) => (
            <span key={sujet} className="rounded-full bg-[#e5efe8] px-3 py-1.5 text-xs font-bold text-[#2a5b37]">
              {sujet}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[#e5efe8] px-3 py-1.5 text-xs font-bold text-[#2a5b37]">
            {actif ? "Aucun sujet renseigné" : "Mentorat non activé"}
          </span>
        )}
      </div>
      <p className="mb-5 leading-relaxed text-[#7b654e]">
        {actif
          ? ([
              mentorat?.duree ? String(mentorat.duree) + " min" : "",
              mentorat?.format || "",
              mentorat?.maxRdvMois === null
                ? "sans limite mensuelle"
                : typeof mentorat?.maxRdvMois === "number"
                  ? String(mentorat.maxRdvMois) + " rendez-vous par mois"
                  : "",
            ].filter(Boolean).join(" · ") || "Paramètres de mentorat à compléter")
          : "Ouvrez des créneaux quand vous le souhaitez depuis votre profil."}
      </p>
      {actif && creneaux.length > 0 && (
        <div className="space-y-2">
          {creneaux.map((jour, index) => (
            <div
              key={(jour.jour || "jour") + String(index)}
              className="flex flex-col gap-2 rounded-xl border border-[#eae3d4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-bold text-[#292119]">{jour.jour || "Jour"}</span>
              <span className="text-sm font-bold text-[#2a5b37]">
                {(jour.plages || [])
                  .map((plage) => (plage.debut || "—") + " – " + (plage.fin || "—"))
                  .join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}
      <Link href="/onboarding?etape=mentorat" className={CLASSE_BOUTON_PRIMAIRE + " mt-5 w-full"}>
        Modifier mes créneaux
      </Link>
    </section>
  );
}

export default function ProfilMembre() {
  const sessionMembre = useSessionMembre();
  const [utilisateur, setUtilisateur] = useState<UtilisateurProfilApi | null>(null);
  const [suggestionsApi, setSuggestionsApi] = useState<SuggestionSynergieApi[]>([]);
  const [chargementProfil, setChargementProfil] = useState(true);
  const [chargementSuggestions, setChargementSuggestions] = useState(true);
  const [erreurProfil, setErreurProfil] = useState("");
  const [erreurSuggestions, setErreurSuggestions] = useState("");
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [couvertureEnCours, setCouvertureEnCours] = useState(false);
  const [erreurCouverture, setErreurCouverture] = useState("");
  const [synergies, setSynergies] = useState<Map<string, string>>(() => new Map());
  const [synergieEnCours, setSynergieEnCours] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState("");
  const fichierPhoto = useRef<HTMLInputElement>(null);
  const fichierCouverture = useRef<HTMLInputElement>(null);
  const numeroRequete = useRef(0);

  const chargerDonnees = useCallback(async () => {
    const requete = ++numeroRequete.current;
    setChargementProfil(true);
    setChargementSuggestions(true);
    setErreurProfil("");
    setErreurSuggestions("");

    // Les suggestions ne doivent pas retarder l'affichage du profil.
    await Promise.allSettled([
      api.get<UtilisateurProfilApi>("/users/me").then(({ data }) => {
        if (requete === numeroRequete.current) setUtilisateur(data);
      }).catch((erreur) => {
        if (requete === numeroRequete.current) setErreurProfil(messageErreurApi(
          erreur,
          "Impossible de charger votre profil pour le moment.",
        ));
      }).finally(() => {
        if (requete === numeroRequete.current) setChargementProfil(false);
      }),
      api.get<SuggestionsSynergieResponseApi>("/synergies/suggestions").then(({ data }) => {
        if (requete === numeroRequete.current) {
          setSuggestionsApi(Array.isArray(data.suggestions) ? data.suggestions : []);
        }
      }).catch((erreur) => {
        if (requete === numeroRequete.current) setErreurSuggestions(messageErreurApi(
          erreur,
          "Les suggestions de membres sont temporairement indisponibles.",
        ));
      }).finally(() => {
        if (requete === numeroRequete.current) setChargementSuggestions(false);
      }),
    ]);
  }, []);

  useEffect(() => {
    void chargerDonnees();
    return () => {
      numeroRequete.current += 1;
    };
  }, [chargerDonnees]);

  useEffect(() => {
    if (!annonce) return;
    const temporisateur = window.setTimeout(() => setAnnonce(""), 4_000);
    return () => window.clearTimeout(temporisateur);
  }, [annonce]);

  const profil = useMemo<DonneesProfil>(
    () => utilisateur ? adapterProfil(utilisateur) : {},
    [utilisateur],
  );
  const membresSuggeres = useMemo(
    () => suggestionsApi.map(adapterSuggestion),
    [suggestionsApi],
  );
  const informations = profil.informations || {};
  const formations = Array.isArray(profil.formations) ? profil.formations : [];
  const experiences = Array.isArray(profil.experiences) ? profil.experiences : [];
  // Les expériences sont déjà triées du plus récent au plus ancien.
  const experienceActuelle = experiences.find((experience) => experience.posteActuel)
    || experiences.find((experience) => experience.anneeDebut)
    || experiences[0];
  const prenom = informations.prenom?.trim() || "";
  const nomFamille = informations.nom?.trim() || "";
  const nomComplet = [prenom, nomFamille].filter(Boolean).join(" ") || "Membre Mali Wuli";
  const initiales = initialesDe(prenom, nomFamille);
  const localisationProfil = lieuDe(
    informations.ville || experienceActuelle?.ville,
    informations.pays || experienceActuelle?.pays,
  );
  const photo = urlMediaBackend(utilisateur?.profil.photo);
  const photoCouverture = urlMediaBackend(utilisateur?.profil.photoCouverture);
  const stats = utilisateur?.profil.stats || {};
  const statut = STATUT_PROFIL[utilisateur?.statut || "EN_ATTENTE"];
  const avisCalcules = useMemo(
    () =>
      formations.filter((formation) => {
        const estEtablissementScolaire = formation.type === "ecole" || formation.type === "lycee";
        if (estEtablissementScolaire && !avisEtablissementScolaireEstDisponible(
          formation.statutDiplome || "",
          formation.moisFin,
          formation.anneeFin,
          formation.anneePromo,
        )) return false;

        return [
          formation.noteEnseignants,
          formation.noteContenu,
          formation.noteCadre,
        ].some((note) => typeof note === "number" && note > 0);
      }).length,
    [formations],
  );
  const avisPublies = stats.nbAvis ?? avisCalcules;

  const choisirPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const fichier = event.target.files?.[0];
    event.target.value = "";
    if (!fichier) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(fichier.type)) {
      setAnnonce("Choisissez une image JPEG, PNG ou WebP.");
      return;
    }
    if (fichier.size > 5 * 1024 * 1024) {
      setAnnonce("Cette image dépasse la taille maximale de 5 Mo.");
      return;
    }

    const formulaire = new FormData();
    formulaire.append("photo", fichier);
    setPhotoEnCours(true);
    try {
      const { data } = await api.post<PhotoProfilResponseApi>("/users/me/photo", formulaire, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUtilisateur((precedent) => precedent ? {
        ...precedent,
        profil: { ...precedent.profil, photo: data.url },
      } : precedent);
      sessionMembre?.actualiser();
      setAnnonce("Votre photo de profil a bien été enregistrée.");
    } catch (erreur) {
      setAnnonce(messageErreurApi(erreur, "La photo n’a pas pu être enregistrée."));
    } finally {
      setPhotoEnCours(false);
    }
  };

  const choisirCouverture = async (event: ChangeEvent<HTMLInputElement>) => {
    const fichier = event.target.files?.[0];
    event.target.value = "";
    if (!fichier || couvertureEnCours) return;
    setErreurCouverture("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(fichier.type)) {
      setErreurCouverture("Choisissez une image JPEG, PNG ou WebP pour votre couverture.");
      return;
    }
    if (!fichier.size || fichier.size > 10 * 1024 * 1024) {
      setErreurCouverture(fichier.size
        ? "Cette image dépasse la taille maximale de 10 Mo."
        : "Cette image est vide. Choisissez un autre fichier.");
      return;
    }

    const formulaire = new FormData();
    formulaire.append("couverture", fichier);
    setCouvertureEnCours(true);
    try {
      const { data } = await api.post<PhotoProfilResponseApi>("/users/me/couverture", formulaire, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUtilisateur((precedent) => precedent ? {
        ...precedent,
        profil: { ...precedent.profil, photoCouverture: data.url },
      } : precedent);
      setAnnonce("Votre photo de couverture a bien été enregistrée.");
    } catch (erreur) {
      setErreurCouverture(messageErreurApi(erreur, "La couverture n’a pas pu être enregistrée. Réessayez."));
    } finally {
      setCouvertureEnCours(false);
    }
  };

  const basculerSynergie = async (membre: SuggestionMembre) => {
    if (synergieEnCours) return;
    const synergieId = synergies.get(membre.id);
    setSynergieEnCours(membre.id);
    try {
      if (synergieId) {
        await api.delete(`/synergies/${encodeURIComponent(synergieId)}`);
        setSynergies((precedentes) => {
          const suivantes = new Map(precedentes);
          suivantes.delete(membre.id);
          return suivantes;
        });
        setAnnonce("La demande de synergie avec " + membre.nom + " a été annulée.");
      } else {
        const { data } = await api.post<CreationSynergieResponseApi>("/synergies", {
          recepteurProfilId: membre.id,
        });
        setSynergies((precedentes) => new Map(precedentes).set(membre.id, data.synergie.id));
        setAnnonce(data.message || "Votre demande de synergie avec " + membre.nom + " a été envoyée.");
      }
    } catch (erreur) {
      setAnnonce(messageErreurApi(erreur, "La demande de synergie n’a pas pu être enregistrée."));
    } finally {
      setSynergieEnCours(null);
    }
  };

  if (chargementProfil) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[var(--color-page)] px-4 text-[#292119]">
        <div className={CLASSE_CARTE + " flex items-center gap-3 px-6 py-5 font-semibold text-[#695c4b]"} role="status">
          <LoaderCircle aria-hidden="true" className="animate-spin text-[#2a5b37]" size={24} />
          Chargement de votre profil…
        </div>
      </div>
    );
  }

  if (!utilisateur) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[var(--color-page)] px-4 text-[#292119]">
        <section className={CLASSE_CARTE + " max-w-lg p-7 text-center"} role="alert">
          <h1 className="font-display text-2xl font-bold">Votre profil n’est pas disponible</h1>
          <p className="mt-3 text-[#695c4b]">{erreurProfil || "Une erreur inattendue est survenue."}</p>
          <button type="button" onClick={() => void chargerDonnees()} className={CLASSE_BOUTON_PRIMAIRE + " mt-5"}>
            <RefreshCw aria-hidden="true" size={17} />
            Réessayer
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-full min-w-0 [overflow-wrap:anywhere] bg-[var(--color-page)] px-4 py-6 text-[#292119] sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <Link
          href="/dashboard"
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#695c4b] transition hover:text-[#2a5b37] focus:outline-none focus:ring-2 focus:ring-[#2a5b37] sm:text-base"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Retour à l’accueil
        </Link>

        <section className={CLASSE_CARTE + " overflow-hidden"}>
          <div
            className="relative h-32 border-b-2 border-[#ac6139] bg-cover bg-center"
            style={{
              backgroundColor: "#176b3b",
              backgroundImage: photoCouverture
                ? `linear-gradient(rgba(13, 103, 56, .25), rgba(102, 76, 51, .2)), url("${photoCouverture.replace(/["\\\n\r]/g, "")}")`
                : "radial-gradient(circle at 72% 112%, transparent 0 15%, rgba(224,179,63,.22) 15.5% 20%, transparent 20.5% 28%, rgba(255,255,255,.12) 28.5% 34%, transparent 34.5% 43%, rgba(102,76,51,.24) 43.5% 51%, transparent 51.5%), linear-gradient(115deg, #0d6738 0%, #1f7b4b 48%, #664c33 100%)",
            }}
          >
            <button
              type="button"
              onClick={() => fichierCouverture.current?.click()}
              disabled={couvertureEnCours}
              aria-describedby={erreurCouverture ? "erreur-photo-couverture" : "aide-photo-couverture"}
              className="absolute right-3 top-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#fffbf5]/95 px-3 py-2 text-sm font-medium text-[#292119] shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#e0b33f] disabled:cursor-wait disabled:opacity-75 sm:right-5 sm:top-4 sm:px-4"
            >
              {couvertureEnCours
                ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
                : <Camera aria-hidden="true" size={17} />}
              {couvertureEnCours ? "Enregistrement…" : photoCouverture ? "Changer la couverture" : "Ajouter une couverture"}
            </button>
            <input
              ref={fichierCouverture}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={couvertureEnCours}
              onChange={choisirCouverture}
              aria-label="Sélectionner une photo de couverture"
              className="hidden"
            />
            <span id="aide-photo-couverture" className="sr-only">Image JPEG, PNG ou WebP, jusqu’à 10 Mo.</span>
          </div>
          <div className="relative px-5 pb-7 pt-16 sm:px-8 sm:pb-8 sm:pt-5 sm:pl-[190px]">
            <div className="absolute -top-14 left-5 sm:-top-14 sm:left-10">
              <div className="relative rounded-full border-4 border-[#fdfaf4] bg-[#e5efe8] shadow-sm">
                {photo ? (
                  <img
                    src={photo}
                    alt={"Photo de " + nomComplet}
                    className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
                  />
                ) : (
                  <AvatarInitiales initiales={initiales} ton="vert" grand />
                )}
                <button
                  type="button"
                  onClick={() => fichierPhoto.current?.click()}
                  disabled={photoEnCours}
                  aria-label="Ajouter ou modifier ma photo"
                  className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#fdfaf4] bg-[#2a5b37] text-white transition hover:bg-[#214a2c] focus:outline-none focus:ring-2 focus:ring-[#e0b33f] disabled:cursor-wait disabled:opacity-70"
                >
                  {photoEnCours
                    ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
                    : <Camera aria-hidden="true" size={18} />}
                </button>
              </div>
              <input
                ref={fichierPhoto}
                type="file"
                accept="image/*"
                onChange={choisirPhoto}
                className="sr-only"
              />
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className="break-words font-display text-2xl font-semibold leading-tight sm:text-3xl">{nomComplet}</h1>
                <p className="mt-1 text-base text-[#695c4b] sm:text-lg">
                  {utilisateur.profil.titre || experienceActuelle?.poste || "Membre du réseau"}
                  {experienceActuelle?.structure ? " · " + experienceActuelle.structure : ""}
                  {" · "}
                  {localisationProfil}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:text-base">
                  <Link href="/synergies" className="font-bold text-[#2a5b37] hover:underline">
                    {stats.nbSynergies || 0} synergie{stats.nbSynergies === 1 ? "" : "s"}
                  </Link>
                  <span aria-hidden="true" className="text-[#a6927d]">·</span>
                  <span className="text-[#7b654e]">
                    {stats.nbContributions || 0} contribution{stats.nbContributions === 1 ? "" : "s"} au réseau
                  </span>
                  <span aria-hidden="true" className="text-[#a6927d]">·</span>
                  <button
                    type="button"
                    onClick={() => fichierPhoto.current?.click()}
                    disabled={photoEnCours}
                    className="font-bold text-[#2a5b37] hover:underline focus:outline-none focus:ring-2 focus:ring-[#2a5b37]"
                  >
                    {photoEnCours ? "Enregistrement…" : photo ? "Changer votre photo" : "Ajoutez votre photo"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setAnnonce(statut.detail)}
                  className={`mt-4 rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.04em] focus:outline-none focus:ring-2 focus:ring-[#ac6139] ${statut.classe}`}
                >
                  {statut.libelle}
                </button>
              </div>
              <Link href="/onboarding?etape=informations" className={CLASSE_BOUTON_SECONDAIRE + " shrink-0"}>
                <Pencil aria-hidden="true" size={17} />
                Modifier mes infos
              </Link>
            </div>
            {erreurCouverture && (
              <p id="erreur-photo-couverture" role="alert" className="mt-4 rounded-xl border border-[#e4b6a5] bg-[#fff1eb] px-4 py-3 text-sm text-[#8a3423]">
                {erreurCouverture}
              </p>
            )}
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,.85fr)]">
          <div className="space-y-6">
            <Experiences experiences={experiences} />
            <Formations formations={formations} />
            <AssociationsProfil statutCompte={utilisateur?.statut} peutAdministrerAssociations={aPermission(utilisateur, "ASSOCIATIONS_GERER")} />
            <section className={CLASSE_CARTE + " p-5 sm:p-8"}>
              <h2 className="font-display text-2xl font-bold leading-tight text-[#292119] sm:text-3xl">
                En ce moment sur le réseau
              </h2>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className={`w-fit rounded-lg px-3 py-2 text-xs font-extrabold uppercase ${statut.classe}`}>
                  {statut.libelle}
                </span>
                <p className="text-[#695c4b]">
                  {statut.detail}
                </p>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <LiensSociauxProfil liens={informations} />
            <section className={CLASSE_CARTE + " p-5 sm:p-7"}>
              <h2 className="mb-5 font-display text-2xl font-bold leading-tight text-[#292119] sm:text-3xl">
                Dans le réseau
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/volontaires"
                  className="rounded-xl border border-[#eae3d4] p-4 transition hover:border-[#2a5b37] focus:outline-none focus:ring-2 focus:ring-[#2a5b37]"
                >
                  <strong className="block text-2xl text-[#2a5b37]">{stats.nbRdvAcceptes || 0}</strong>
                  <span className="mt-1 block text-sm leading-snug text-[#7b654e]">rendez-vous de mentorat</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-xl border border-[#eae3d4] p-4 transition hover:border-[#ac6139] focus:outline-none focus:ring-2 focus:ring-[#ac6139]"
                >
                  <strong className="block text-2xl text-[#ac6139]">{stats.nbContributions || 0}</strong>
                  <span className="mt-1 block text-sm leading-snug text-[#7b654e]">contributions au réseau</span>
                </Link>
              </div>

              <h3 className="mb-3 mt-7 font-display text-lg font-bold leading-snug text-[#292119] sm:text-xl">Mes contributions</h3>
              <ul className="space-y-2 text-sm leading-relaxed text-[#695c4b] sm:text-base">
                <li>{avisPublies} avis de formation publié{avisPublies === 1 ? "" : "s"}</li>
                <li>{stats.nbPublications || 0} publication{stats.nbPublications === 1 ? "" : "s"} dans le fil</li>
                <li>{stats.nbCommentaires || 0} commentaire{stats.nbCommentaires === 1 ? "" : "s"} publié{stats.nbCommentaires === 1 ? "" : "s"}</li>
                <li>{stats.nbRdvAcceptes || 0} rendez-vous de mentorat accepté{stats.nbRdvAcceptes === 1 ? "" : "s"}</li>
                <li>{stats.nbSynergies || 0} mise{stats.nbSynergies === 1 ? "" : "s"} en relation acceptée{stats.nbSynergies === 1 ? "" : "s"}</li>
              </ul>
            </section>
            <Mentorat mentorat={profil.mentorat} />
          </aside>
        </div>

        <section className={CLASSE_CARTE + " mt-6 p-5 sm:p-8"}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Synergies possibles pour vous</h2>
              <p className="mt-1 text-sm text-[#7b654e] sm:text-base">
                Des membres dont le parcours croise le vôtre : même filière, même ville ou besoin complémentaire.
              </p>
            </div>
            <Link href="/annuaire" className="inline-flex min-h-11 items-center gap-1 font-bold text-[#2a5b37] hover:underline">
              Voir tout l’annuaire
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          </div>
          {chargementSuggestions ? (
            <div className="flex min-h-32 items-center justify-center rounded-2xl border border-[#eae3d4] bg-[#fffefb] text-[#695c4b]" role="status">
              <LoaderCircle aria-hidden="true" className="mr-3 animate-spin text-[#2a5b37]" size={22} />
              Recherche de membres compatibles…
            </div>
          ) : erreurSuggestions ? (
            <div className="rounded-2xl border border-[#eae3d4] bg-[#fffefb] p-6 text-center">
              <p className="text-[#695c4b]">{erreurSuggestions}</p>
              <button type="button" onClick={() => void chargerDonnees()} className={CLASSE_BOUTON_SECONDAIRE + " mt-4"}>
                <RefreshCw aria-hidden="true" size={17} />
                Réessayer
              </button>
            </div>
          ) : membresSuggeres.length === 0 ? (
            <div className="rounded-2xl border border-[#eae3d4] bg-[#fffefb] p-6 text-center text-[#695c4b]">
              Aucune nouvelle suggestion pour le moment. Consultez l’annuaire pour découvrir d’autres membres.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {membresSuggeres.map((membre) => {
              const demandee = synergies.has(membre.id);
              const enCours = synergieEnCours === membre.id;
              return (
                <article key={membre.id} className="min-w-0 rounded-2xl border border-[#eae3d4] bg-[#fffefb] p-5">
                  <div className="flex items-center gap-3">
                    {membre.photo ? (
                      <img src={membre.photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover sm:h-14 sm:w-14" />
                    ) : (
                      <AvatarInitiales initiales={membre.initiales} ton={membre.ton} />
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold sm:text-lg">{membre.nom}</h3>
                      <p className="truncate text-sm text-[#7b654e] sm:text-base">{membre.fonction} · {membre.ville}</p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <button
                      type="button"
                      aria-pressed={demandee}
                      disabled={Boolean(synergieEnCours)}
                      onClick={() => void basculerSynergie(membre)}
                      className={CLASSE_BOUTON_PRIMAIRE + (demandee ? " bg-[#446b4e]" : "") + " disabled:cursor-wait disabled:opacity-65"}
                    >
                      {enCours
                        ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
                        : demandee
                          ? <Check aria-hidden="true" size={17} />
                          : <HeartHandshake aria-hidden="true" size={17} />}
                      <span>{enCours ? "Enregistrement…" : demandee ? "Demande envoyée" : "Proposer une synergie"}</span>
                    </button>
                    <Link
                      href={"/annuaire?recherche=" + encodeURIComponent(membre.nom)}
                      className={CLASSE_BOUTON_SECONDAIRE}
                    >
                      Profil
                    </Link>
                  </div>
                </article>
              );
            })}
            </div>
          )}
        </section>

        <p className="sr-only" role="status" aria-live="polite">{annonce}</p>
        {annonce && (
          <div
            role="status"
            className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl bg-[#292119] px-5 py-4 text-center text-sm font-semibold text-white shadow-xl md:bottom-6"
          >
            {annonce}
          </div>
        )}
      </div>
    </div>
  );
}

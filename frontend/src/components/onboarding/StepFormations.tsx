"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SearchCombobox, { type SearchOption } from "./SearchCombobox";
import StarRating from "./StarRating";
import { cleReferencesFormation, referencesFormationDisponibles, getSystemeEducatifCode, libelleSystemeEducatif, libelleProgramme, type FormationType, type ProgrammeReference } from "@/lib/education/reference";
import { diplomesDuParcoursScolaire, diplomeScolairePrincipal, erreurDiplomeScolaire, typeDiplomeScolaire, type DiplomeScolaire } from "@/lib/education/parcours-scolaire";
import api from "@/lib/api";
import {
  MOIS,
  anneeEstValide,
  formaterMoisAnnee,
  normaliserAnnee,
  periodeEstValide,
  trierParDateDebut,
} from "@/lib/periode";
import {
  ancienneteDepuisFinEnMois,
  avisEtablissementScolaireEstDisponible,
  calculerEmploiDansLes12Mois,
  dateOuvertureAvisEtablissementScolaire,
  emploiTrouve,
  reponseInsertionEstComplete,
  type DelaiPremierEmploi,
  type DemarcheApresFormation,
  type LienEmploiFormation,
} from "@/lib/education/suivi";

type TypeSuggestionCatalogue = "ETABLISSEMENT" | "PROGRAMME" | "SPECIALITE" | "SERIE" | "DIPLOME";

type ResultatSuggestionCatalogue = {
  clientKey: string;
  statut: "EXISTANT" | "EN_ATTENTE" | "A_VALIDER";
  suggestionId?: string;
  canoniqueId?: string;
  libelle?: string;
};

type PropositionCatalogue = {
  clientKey: string;
  type: TypeSuggestionCatalogue;
  statut: Exclude<ResultatSuggestionCatalogue["statut"], "EXISTANT">;
  suggestionId?: string;
};

export type StatutDiplome = "OBTENU" | "EN_COURS" | "NON_OBTENU" | "NON_DIPLOMANTE";

const STATUTS_DIPLOME: Array<{ valeur: StatutDiplome; libelle: string; explication: string }> = [
  {
    valeur: "OBTENU",
    libelle: "Oui, diplôme obtenu",
    explication: "Vous avez terminé la formation et obtenu le diplôme. Le diplôme et son année d’obtention seront demandés.",
  },
  {
    valeur: "EN_COURS",
    libelle: "En cours",
    explication: "Vous suivez encore cette formation. Indiquez le diplôme préparé et l’année prévue d’obtention.",
  },
  {
    valeur: "NON_OBTENU",
    libelle: "Non obtenu",
    explication: "Vous avez suivi la formation sans obtenir le diplôme. Aucun diplôme ni aucune mention ne sera demandé.",
  },
  {
    valeur: "NON_DIPLOMANTE",
    libelle: "Formation non diplômante",
    explication: "Cette formation ne prépare pas à un diplôme. Aucun diplôme ni aucune mention ne sera demandé.",
  },
];

export interface Formation {
  id: string;
  type: FormationType;
  pays: string;
  paysCode: string;
  ville: string;
  etablissement: string;
  etablissementId: string;
  etablissementSource?: string;
  systemeEducatifCode?: string;
  diplomesScolaires?: DiplomeScolaire[];
  programme: string;
  programmeId: string;
  specialite: string;
  specialiteId?: string;
  specialiteEstAutre?: boolean;
  moisDebut: string;
  anneeDebut: string;
  moisFin: string;
  anneeFin: string;
  statutDiplome: StatutDiplome;
  diplomeObtenu: boolean;
  diplome: string;
  diplomeId?: string;
  diplomeEstAutre?: boolean;
  mention: string;
  mentionEstAutre?: boolean;
  anneePromo: string;
  noteEnseignants: number | null;
  noteContenu: number | null;
  noteCadre: number | null;
  demarcheApresFormation: DemarcheApresFormation | null;
  delaiPremierEmploi: DelaiPremierEmploi | null;
  emploiDansLes12Mois: boolean | null;
  lienEmploiFormation: LienEmploiFormation | null;
  commentaire: string;
  propositionsCatalogue?: PropositionCatalogue[];
  synchronisationCatalogue?: "EN_COURS" | "TERMINEE" | "ERREUR";
}
interface StepFormationsProps {
  onNext: (data: Formation[]) => void;
  onBack: () => void;
  initialData?: Formation[];
}

type PaysOption = {
  code: string;
  nom: string;
  drapeau: string;
};

type VilleOption = {
  id: number;
  nom: string;
  region: string;
};

type InstitutionOption = {
  id: string;
  nom: string;
  paysCode: string;
  ville?: string;
  // Mali : ville = chef-lieu de région ; la localité et la commune situent l’école.
  localite?: string;
  commune?: string;
  type: FormationType;
  statut?: "Public" | "Privé";
  systemeEducatifCode?: string;
  source: string;
};

type ReferenceResponse = {
  series?: string[];
  diplomes?: string[];
  programmes?: ProgrammeReference[];
};

const PAYS_DE_SECOURS: PaysOption[] = [
  { code: "ML", nom: "Mali", drapeau: "🇲🇱" },
  { code: "CI", nom: "Côte d’Ivoire", drapeau: "🇨🇮" },
  { code: "NG", nom: "Nigéria", drapeau: "🇳🇬" },
  { code: "NE", nom: "Niger", drapeau: "🇳🇪" },
  { code: "MR", nom: "Mauritanie", drapeau: "🇲🇷" },
  { code: "FR", nom: "France", drapeau: "🇫🇷" },
];

const TYPE_LABELS: Record<FormationType, string> = {
  ecole: "ÉCOLE / LYCÉE",
  lycee: "ÉCOLE / LYCÉE",
  universite: "SUPÉRIEUR",
};

const TYPE_TITRES: Record<FormationType, string> = {
  ecole: "École / lycée fréquenté",
  lycee: "École / lycée fréquenté",
  universite: "Université / école privée",
};

const FIELD_CLASS =
  "w-full rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-5 py-4 text-base text-[#2e261f] outline-none transition focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20 sm:text-lg";

const LABEL_CLASS = "mb-2 block text-base font-semibold text-[#2e261f]";

const DEMARCHES_APRES_FORMATION: Array<{
  valeur: DemarcheApresFormation;
  libelle: string;
  precision: string;
}> = [
  {
    valeur: "RECHERCHE_EMPLOI",
    libelle: "Je cherchais à travailler",
    precision: "Emploi, activité indépendante ou création d’entreprise",
  },
  {
    valeur: "POURSUITE_ETUDES",
    libelle: "J’ai poursuivi mes études",
    precision: "Une autre formation était mon projet principal",
  },
  {
    valeur: "AUTRE_PROJET",
    libelle: "J’avais un autre projet",
    precision: "Projet personnel, familial ou autre situation",
  },
];

const DELAIS_PREMIER_EMPLOI: Array<{ valeur: DelaiPremierEmploi; libelle: string }> = [
  { valeur: "MOINS_3_MOIS", libelle: "Oui, en moins de 3 mois" },
  { valeur: "DE_3_A_6_MOIS", libelle: "Oui, entre 3 et 6 mois" },
  { valeur: "DE_7_A_12_MOIS", libelle: "Oui, entre 7 et 12 mois" },
  { valeur: "PLUS_12_MOIS", libelle: "Non, après plus de 12 mois" },
  { valeur: "MOINS_DE_12_MOIS_DEPUIS_FIN", libelle: "Je ne peux pas encore répondre : moins de 12 mois se sont écoulés" },
  { valeur: "PAS_ENCORE", libelle: "Non, pas encore trouvé après 12 mois" },
];

const DELAIS_AVANT_DOUZE_MOIS = new Set<DelaiPremierEmploi>([
  "MOINS_3_MOIS",
  "DE_3_A_6_MOIS",
  "DE_7_A_12_MOIS",
  "MOINS_DE_12_MOIS_DEPUIS_FIN",
]);

const LIENS_EMPLOI_FORMATION: Array<{ valeur: LienEmploiFormation; libelle: string }> = [
  { valeur: "DIRECT", libelle: "Oui, directement" },
  { valeur: "PARTIEL", libelle: "Oui, en partie" },
  { valeur: "AUCUN", libelle: "Non" },
];

const CLASSE_CHOIX =
  "min-h-14 rounded-[13px] border px-4 py-3 text-left text-sm font-semibold leading-snug transition focus:outline-none focus:ring-2 focus:ring-[#0d6738]/25 sm:text-base";

const avecPrepositionDe = (mois: string, annee: number) => {
  const nom = mois.toLocaleLowerCase("fr");
  const preposition = /^[aeiouyàâäéèêëîïôöùûü]/i.test(nom) ? "d’" : "de ";
  return `${preposition}${nom} ${annee}`;
};

interface ZoneGuideeProps {
  bloquee: boolean;
  indication: string;
  onBlockedClick: () => void;
  children: ReactNode;
  className?: string;
}

type BlocageFormulaire = {
  titre: string;
  message: string;
  cibleId: string;
  action: string;
};

function ZoneGuidee({ bloquee, indication, onBlockedClick, children, className = "" }: ZoneGuideeProps) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <fieldset
        disabled={bloquee}
        aria-disabled={bloquee}
        className={`m-0 min-w-0 border-0 p-0 transition ${bloquee ? "pointer-events-none select-none opacity-45" : ""}`}
      >
        {children}
      </fieldset>
      {bloquee && (
        <button
          type="button"
          onClick={onBlockedClick}
          aria-label={`${indication}. Cliquez pour savoir quoi compléter.`}
          className="absolute inset-0 z-10 flex cursor-help items-start justify-end rounded-[14px] p-2 text-left focus:outline-none focus:ring-2 focus:ring-[#0d6738]/30"
        >
          <span className="rounded-full border border-[#d8c5a7] bg-[#fffaf4] px-3 py-1 text-xs font-semibold text-[#56493e] shadow-sm">
            🔒 {indication}
          </span>
        </button>
      )}
    </div>
  );
}

const normaliserLibelle = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

type SuggestionCataloguePayload = {
  clientKey: string;
  type: TypeSuggestionCatalogue;
  libelle: string;
  paysCode: string;
  ville?: string;
  contexteCle: string;
  contexte: Record<string, string | number | boolean | null>;
};

const construireSuggestions = (formation: Formation): SuggestionCataloguePayload[] => {
  const items: SuggestionCataloguePayload[] = [];
  const contexteBase = { formationType: formation.type, systemeEducatifCode: formation.systemeEducatifCode || formation.paysCode };
  const etablissementCanonique = formation.etablissementId
    && !formation.etablissementId.startsWith("autre:")
    ? formation.etablissementId
    : "";
  const programmeCanonique = formation.programmeId
    && !formation.programmeId.startsWith("autre:")
    ? formation.programmeId
    : "";
  const cleEtablissement = etablissementCanonique
    || normaliserLibelle(formation.etablissement).slice(0, 100);

  if (formation.etablissementId.startsWith("autre:") && formation.etablissement.trim()) {
    items.push({
      clientKey: `${formation.id}:etablissement`,
      type: "ETABLISSEMENT",
      libelle: formation.etablissement,
      paysCode: formation.paysCode,
      ville: formation.ville,
      contexteCle: formation.type,
      contexte: contexteBase,
    });
  }
  if (formation.programmeId.startsWith("autre:") && formation.programme.trim()) {
    items.push({
      clientKey: `${formation.id}:programme`,
      type: "PROGRAMME",
      libelle: formation.programme,
      paysCode: formation.paysCode,
      contexteCle: `${formation.type}|${cleEtablissement}`,
      contexte: {
        ...contexteBase,
        ...(etablissementCanonique ? { etablissementId: etablissementCanonique } : {}),
      },
    });
  }
  if (formation.specialiteEstAutre && formation.specialite.trim()) {
    items.push({
      clientKey: `${formation.id}:specialite`,
      type: formation.type !== "universite" ? "SERIE" : "SPECIALITE",
      libelle: formation.specialite,
      paysCode: formation.paysCode,
      contexteCle: `${formation.type}|${cleEtablissement}|${programmeCanonique || normaliserLibelle(formation.programme).slice(0, 80)}`,
      contexte: {
        ...contexteBase,
        ...(etablissementCanonique ? { etablissementId: etablissementCanonique } : {}),
        ...(programmeCanonique ? { programmeId: programmeCanonique } : {}),
      },
    });
  }
  if (
    (formation.statutDiplome === "OBTENU" || formation.statutDiplome === "EN_COURS")
    && formation.diplomeEstAutre
    && formation.diplome.trim()
  ) {
    items.push({
      clientKey: `${formation.id}:diplome`,
      type: "DIPLOME",
      libelle: formation.diplome,
      paysCode: formation.paysCode,
      contexteCle: formation.type,
      contexte: contexteBase,
    });
  }
  return items;
};

const creerFormationVide = (type: FormationType): Omit<Formation, "id"> => ({
  type,
  pays: "Mali",
  paysCode: "ML",
  ville: "",
  etablissement: "",
  etablissementId: "",
  etablissementSource: "",
  systemeEducatifCode: type === "universite" ? undefined : "ML",
  diplomesScolaires: type === "universite" ? undefined : [],
  programme: "",
  programmeId: "",
  specialite: "",
  specialiteId: "",
  specialiteEstAutre: false,
  moisDebut: "",
  anneeDebut: "",
  moisFin: "",
  anneeFin: "",
  statutDiplome: "OBTENU",
  diplomeObtenu: true,
  diplome: "",
  diplomeId: "",
  diplomeEstAutre: false,
  mention: "",
  mentionEstAutre: false,
  anneePromo: "",
  noteEnseignants: null,
  noteContenu: null,
  noteCadre: null,
  demarcheApresFormation: null,
  delaiPremierEmploi: null,
  emploiDansLes12Mois: null,
  lienEmploiFormation: null,
  commentaire: "",
});

const avisFormationEstDisponible = (formation: Formation) => {
  const statutDiplome = formation.statutDiplome
    || (formation.diplomeObtenu ? "OBTENU" : "EN_COURS");
  return formation.type === "universite"
    || avisEtablissementScolaireEstDisponible(
      statutDiplome,
      formation.moisFin,
      formation.anneeFin,
      formation.anneePromo,
    );
};

const calculerMoyenne = (formation: Formation) => {
  if (!avisFormationEstDisponible(formation)) return null;
  const notes = [formation.noteEnseignants, formation.noteContenu, formation.noteCadre];
  const valeurs = notes.filter((note): note is number => note !== null);
  return valeurs.length ? valeurs.reduce((total, note) => total + note, 0) / valeurs.length : null;
};

const nettoyerAvisNonEligible = (formation: Formation): Formation =>
  avisFormationEstDisponible(formation)
    ? formation
    : {
      ...formation,
      noteEnseignants: null,
      noteContenu: null,
      noteCadre: null,
      commentaire: "",
    };

const resumerInsertion = (formation: Formation) => {
  if (formation.type !== "universite" || formation.statutDiplome === "EN_COURS") return "";
  if (formation.demarcheApresFormation === "POURSUITE_ETUDES") return "poursuite d’études après la formation";
  if (formation.demarcheApresFormation === "AUTRE_PROJET") return "autre projet après la formation";
  if (formation.demarcheApresFormation !== "RECHERCHE_EMPLOI" || !formation.delaiPremierEmploi) return "";
  if (formation.delaiPremierEmploi === "MOINS_DE_12_MOIS_DEPUIS_FIN") return "suivi d’insertion à venir";
  if (formation.delaiPremierEmploi === "PAS_ENCORE") return "sans emploi après 12 mois";
  const delai = DELAIS_PREMIER_EMPLOI.find(({ valeur }) => valeur === formation.delaiPremierEmploi)?.libelle;
  return delai ? `première activité : ${delai.replace(/^Oui, |^Non, /, "").toLocaleLowerCase("fr")}` : "";
};

function FormationCard({
  formation,
  onModifier,
  onRetirer,
}: {
  formation: Formation;
  onModifier: () => void;
  onRetirer: () => void;
}) {
  const initiales = formation.type === "ecole" ? "ÉC" : formation.type === "lycee" ? "LY" : "UN";
  const moyenne = calculerMoyenne(formation);
  const statutDiplome = formation.statutDiplome
    || (formation.diplomeObtenu ? "OBTENU" : "EN_COURS");
  const libelleDiplome: Record<StatutDiplome, string> = {
    OBTENU: formation.diplome,
    EN_COURS: formation.diplome ? `${formation.diplome} en cours` : "Formation en cours",
    NON_OBTENU: "",
    NON_DIPLOMANTE: "",
  };
  const diplomesScolaires = diplomesDuParcoursScolaire(formation);
  const informations = [
    diplomesScolaires.length ? diplomesScolaires.map((diplome) => [
      diplome.libelle, diplome.statut === "EN_COURS" ? "en préparation" : "",
      diplome.anneeObtention, diplome.mention ? `mention ${diplome.mention}` : "", diplome.serie,
    ].filter(Boolean).join(" · ")).join(" ; ") : libelleDiplome[statutDiplome],
    !diplomesScolaires.length && statutDiplome === "OBTENU" && formation.mention ? `mention ${formation.mention}` : "",
    libelleProgramme(formation.programme),
    !diplomesScolaires.length ? formation.specialite : "",
    formation.type !== "universite" ? libelleSystemeEducatif(formation.systemeEducatifCode) : "",
    `${formation.ville}, ${formation.pays}`,
    `${formaterMoisAnnee(formation.moisDebut, formation.anneeDebut)} – ${formaterMoisAnnee(formation.moisFin, formation.anneeFin)}`,
    !diplomesScolaires.length && formation.anneePromo
      ? statutDiplome === "EN_COURS"
        ? `diplôme prévu en ${formation.anneePromo}`
        : `promo ${formation.anneePromo}`
      : "",
    resumerInsertion(formation),
  ].filter(Boolean);

  return (
    <article className="mb-5 flex min-w-0 flex-col gap-4 overflow-hidden rounded-[18px] border border-[#e4d2b3] bg-[#fffbf5] p-4 sm:flex-row sm:p-7">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[13px] bg-[#eee2d0] text-lg font-bold text-[#2e261f]">
        {initiales}
      </div>
      <div className="w-full min-w-0 flex-1">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="titre-element min-w-0 break-words [overflow-wrap:anywhere]">{formation.etablissement}</h3>
              <span className="max-w-full break-words rounded-[7px] bg-[#eee2d0] px-3 py-1 text-xs font-bold text-[#2e261f] [overflow-wrap:anywhere] sm:text-sm">
                {TYPE_LABELS[formation.type]}
              </span>
              {formation.synchronisationCatalogue === "EN_COURS" && (
                <span className="max-w-full rounded-[7px] bg-[#eee2d0] px-3 py-1 text-xs font-bold text-[#735133] sm:text-sm">
                  ENREGISTREMENT…
                </span>
              )}
              {formation.synchronisationCatalogue === "ERREUR" && (
                <span className="max-w-full rounded-[7px] bg-[#fde8e7] px-3 py-1 text-xs font-bold text-[#a22922] sm:text-sm">
                  SYNCHRONISATION À REFAIRE
                </span>
              )}
            </div>
            <p className="break-words text-sm leading-relaxed text-[#2e261f] [overflow-wrap:anywhere] sm:text-base">
              {informations.join(" · ")}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2 sm:shrink-0 sm:flex-col sm:items-end sm:gap-2">
            <button type="button" onClick={onModifier} className="font-semibold text-[#0d6738] hover:underline">
              Modifier
            </button>
            <button type="button" onClick={onRetirer} className="font-semibold text-[#2e261f] hover:text-[#b84f25]">
              Retirer
            </button>
          </div>
        </div>

        {moyenne !== null && (
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span aria-label={`${moyenne.toFixed(1)} sur 5`} className="whitespace-nowrap text-lg tracking-[0.04em] text-[#c45b2a] sm:text-xl sm:tracking-[0.08em]">
              {[1, 2, 3, 4, 5].map((note) => (note <= Math.round(moyenne) ? "★" : "☆")).join("")}
            </span>
            <strong className="shrink-0 text-sm text-[#2e261f] sm:text-base">{moyenne.toFixed(1)}/5</strong>
          </div>
        )}
        {formation.commentaire && (
          <p className="mt-3 break-words text-sm italic text-[#56493e] [overflow-wrap:anywhere] sm:text-base">« {formation.commentaire} »</p>
        )}
      </div>
    </article>
  );
}

function SelectAvecAutre({
  id,
  label,
  value,
  options,
  autre,
  onSelect,
  onOtherChange,
  placeholder,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  autre: boolean;
  onSelect: (value: string, autre: boolean) => void;
  onOtherChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  const optionsAvecAutre = options.includes("Autre") ? options : [...options, "Autre"];
  if (autre) {
    return (
      <div>
        <div className="mb-2 flex flex-col items-start gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3">
          <label htmlFor={`${id}-autre`} className="text-base font-semibold text-[#2e261f]">
            {label} {required && <span className="text-[#c65327]">*</span>}
          </label>
          <button type="button" onClick={() => onSelect("", false)} className="text-sm font-semibold text-[#0d6738] hover:underline">
            Revenir à la liste
          </button>
        </div>
        <input
          id={`${id}-autre`}
          value={value}
          onChange={(event) => onOtherChange(event.target.value)}
          placeholder={`Précisez : ${label.toLocaleLowerCase("fr")}`}
          className={FIELD_CLASS}
        />
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label} {required && <span className="text-[#c65327]">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const selection = event.target.value;
          onSelect(selection === "Autre" ? "" : selection, selection === "Autre");
        }}
        className={FIELD_CLASS}
      >
        <option value="">{placeholder}</option>
        {optionsAvecAutre.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

/** Conserve le texte personnalisé lors des allers-retours entre la liste et « Autre ». */
function SelectScolaireAvecAutre({
  id, label, value, options, onChange, placeholder, required = true,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  const optionConnue = options.find((option) => option !== "Autre" && normaliserLibelle(option) === normaliserLibelle(value));
  const [modeAutre, setModeAutre] = useState(false);
  const textePersonnalise = useRef(value && !optionConnue ? value : "");
  const autre = modeAutre || Boolean(value && !optionConnue);
  return (
    <SelectAvecAutre
      id={id}
      label={label}
      value={autre ? value : optionConnue || value}
      options={options}
      autre={autre}
      required={required}
      placeholder={placeholder}
      onSelect={(selection, choixAutre) => {
        if (autre) textePersonnalise.current = value;
        setModeAutre(choixAutre);
        onChange(choixAutre ? textePersonnalise.current : selection);
      }}
      onOtherChange={(texte) => {
        textePersonnalise.current = texte;
        onChange(texte);
      }}
    />
  );
}

function FormationForm({
  type,
  initialData,
  onSave,
  onCancel,
}: {
  type: FormationType;
  initialData?: Formation;
  onSave: (formation: Formation) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Formation, "id">>(() => {
    const statutInitial = initialData?.statutDiplome
      || (initialData?.diplomeObtenu === false ? "EN_COURS" : "OBTENU");
    return {
      ...creerFormationVide(type),
      ...(initialData || {}),
      programme: libelleProgramme(initialData?.programme),
      type,
      statutDiplome: statutInitial,
      diplomeObtenu: statutInitial === "OBTENU",
      systemeEducatifCode: initialData?.systemeEducatifCode || getSystemeEducatifCode(initialData?.paysCode || "ML", initialData?.etablissementId),
      diplomesScolaires: type === "universite" ? undefined : diplomesDuParcoursScolaire(initialData || { type }),
    };
  });
  // Clés internes uniquement : elles ne sont jamais enregistrées dans le parcours.
  const clesDiplomesScolaires = useRef((form.diplomesScolaires || []).map((_, index) => `initial-${index}`));
  const prochaineCleDiplome = useRef(0);
  const programmeScolaireChoisi = useRef(Boolean(initialData?.systemeEducatifCode));
  const [pays, setPays] = useState<PaysOption[]>(PAYS_DE_SECOURS);
  const [villes, setVilles] = useState<VilleOption[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeReference[]>([]);
  const [referencesChargees, setReferencesChargees] = useState<{ cle: string; series: string[]; diplomes: string[] } | null>(null);
  const contexteReferences = { type, paysCode: form.paysCode, systemeEducatifCode: form.systemeEducatifCode, institutionId: form.etablissementId };
  const cleReferences = cleReferencesFormation(contexteReferences);
  const { series, diplomes } = referencesFormationDisponibles(contexteReferences, referencesChargees);
  const [rechercheVille, setRechercheVille] = useState(false);
  const [rechercheInstitution, setRechercheInstitution] = useState(false);
  const [catalogueInstitutionPartiel, setCatalogueInstitutionPartiel] = useState(false);
  const [rechercheProgramme, setRechercheProgramme] = useState(false);
  const [revisionCatalogue, setRevisionCatalogue] = useState(0);
  const [etablissementAutre, setEtablissementAutre] = useState(
    Boolean(initialData?.etablissementId?.startsWith("autre:")),
  );
  const [programmeAutre, setProgrammeAutre] = useState(
    Boolean(initialData?.programmeId?.startsWith("autre:")),
  );
  const [specialiteAutre, setSpecialiteAutre] = useState(
    type === "universite" || Boolean(initialData?.specialiteEstAutre),
  );
  const [diplomeAutre, setDiplomeAutre] = useState(Boolean(initialData?.diplomeEstAutre));
  const [mentionAutre, setMentionAutre] = useState(Boolean(initialData?.mentionEstAutre));
  const [statutInfoOuvert, setStatutInfoOuvert] = useState<StatutDiplome | null>(null);
  const [blocageFormulaire, setBlocageFormulaire] = useState<BlocageFormulaire | null>(null);

  const set = <K extends keyof Omit<Formation, "id">>(field: K, value: Omit<Formation, "id">[K]) =>
    setForm((precedent) => ({ ...precedent, [field]: value }));

  useEffect(() => {
    const actualiser = () => setRevisionCatalogue((revision) => revision + 1);
    const actualiserSiVisible = () => {
      if (document.visibilityState === "visible") actualiser();
    };
    window.addEventListener("focus", actualiser);
    document.addEventListener("visibilitychange", actualiserSiVisible);
    return () => {
      window.removeEventListener("focus", actualiser);
      document.removeEventListener("visibilitychange", actualiserSiVisible);
    };
  }, []);

  useEffect(() => {
    if (!statutInfoOuvert && !blocageFormulaire) return;
    const fermerAvecEchap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStatutInfoOuvert(null);
        setBlocageFormulaire(null);
      }
    };
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.body.style.overflow = overflowPrecedent;
      window.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [blocageFormulaire, statutInfoOuvert]);

  useEffect(() => {
    let actif = true;
    fetch("/api/locations/countries")
      .then((reponse) => reponse.ok ? reponse.json() : Promise.reject(new Error("Pays indisponibles")))
      .then((donnees: { pays?: PaysOption[] }) => {
        if (actif && donnees.pays?.length) setPays(donnees.pays);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    let actif = true;
    const parametres = new URLSearchParams({ country: form.paysCode, type });
    if (form.etablissementId) parametres.set("institutionId", form.etablissementId);
    if (form.systemeEducatifCode && type !== "universite") parametres.set("systemeEducatifCode", form.systemeEducatifCode);
    fetch(`/api/education/reference?${parametres}`)
      .then((reponse) => reponse.ok ? reponse.json() : Promise.reject(new Error("Référentiel indisponible")))
      .then((donnees: ReferenceResponse) => {
        if (!actif) return;
        const prochainesSeries = donnees.series || [];
        const prochainsDiplomes = donnees.diplomes || [];
        setReferencesChargees({ cle: cleReferences, series: prochainesSeries, diplomes: prochainsDiplomes });
        if (type === "lycee" && form.specialite) {
          const serieConnue = prochainesSeries.find((serie) =>
            normaliserLibelle(serie) === normaliserLibelle(form.specialite),
          );
          setSpecialiteAutre(!serieConnue);
          if (serieConnue && serieConnue !== form.specialite) set("specialite", serieConnue);
        }
        if (form.diplome) {
          const diplomeConnu = prochainsDiplomes.find((diplome) =>
            normaliserLibelle(diplome) === normaliserLibelle(form.diplome),
          );
          setDiplomeAutre(!diplomeConnu);
          if (diplomeConnu && diplomeConnu !== form.diplome) set("diplome", diplomeConnu);
        }
        if (type === "universite" && !form.etablissementId) {
          setProgrammes(donnees.programmes || []);
        }
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [form.paysCode, form.etablissementId, form.systemeEducatifCode, type, cleReferences]);

  useEffect(() => {
    const recherche = form.ville.trim();
    if (recherche.length < 2) {
      setVilles([]);
      setRechercheVille(false);
      return;
    }
    let actif = true;
    const temporisateur = window.setTimeout(() => {
      setRechercheVille(true);
      const parametres = new URLSearchParams({ country: form.paysCode, q: recherche, limit: "60" });
      fetch(`/api/locations/cities?${parametres}`)
        .then((reponse) => reponse.ok ? reponse.json() : Promise.reject(new Error("Villes indisponibles")))
        .then((donnees: { villes?: VilleOption[] }) => {
          if (actif) setVilles(donnees.villes || []);
        })
        .catch(() => {
          if (actif) setVilles([]);
        })
        .finally(() => {
          if (actif) setRechercheVille(false);
        });
    }, 250);
    return () => {
      actif = false;
      window.clearTimeout(temporisateur);
    };
  }, [form.paysCode, form.ville]);

  useEffect(() => {
    if (!form.ville.trim()) {
      setInstitutions([]);
      setRechercheInstitution(false);
      setCatalogueInstitutionPartiel(false);
      return;
    }
    if (!etablissementAutre && form.etablissement.trim().length < 2) {
      setInstitutions([]);
      setRechercheInstitution(false);
      setCatalogueInstitutionPartiel(false);
      return;
    }
    // Ne jamais laisser les résultats de la requête précédente visibles pendant
    // le délai de saisie ou lorsqu'un onglet reprend le focus.
    setInstitutions([]);
    setRechercheInstitution(true);
    setCatalogueInstitutionPartiel(false);
    let actif = true;
    const temporisateur = window.setTimeout(() => {
      const parametres = new URLSearchParams({
        country: form.paysCode,
        city: form.ville,
        type,
        q: etablissementAutre ? "" : form.etablissement,
      });
      fetch(`/api/education/institutions?${parametres}`, { cache: "no-store" })
        .then((reponse) => reponse.ok ? reponse.json() : Promise.reject(new Error("Établissements indisponibles")))
        .then((donnees: { institutions?: InstitutionOption[]; cataloguePartiel?: boolean }) => {
          if (actif) {
            setInstitutions(donnees.institutions || []);
            const selection = donnees.institutions?.find((institution) => institution.id === form.etablissementId);
            if (type !== "universite" && !programmeScolaireChoisi.current && selection?.systemeEducatifCode) {
              setForm((precedent) => ({ ...precedent, systemeEducatifCode: selection.systemeEducatifCode }));
            }
            setCatalogueInstitutionPartiel(Boolean(donnees.cataloguePartiel));
          }
        })
        .catch(() => {
          if (actif) {
            setInstitutions([]);
            setCatalogueInstitutionPartiel(true);
          }
        })
        .finally(() => {
          if (actif) setRechercheInstitution(false);
        });
    }, 300);
    return () => {
      actif = false;
      window.clearTimeout(temporisateur);
    };
  }, [etablissementAutre, form.etablissement, form.paysCode, form.ville, revisionCatalogue, type]);

  useEffect(() => {
    if (type !== "universite" || programmeAutre) return;
    let actif = true;
    const temporisateur = window.setTimeout(() => {
      setRechercheProgramme(true);
      const parametres = new URLSearchParams({
        country: form.paysCode,
        institutionId: form.etablissementId,
        q: form.programme,
      });
      fetch(`/api/education/programmes?${parametres}`)
        .then((reponse) => reponse.ok ? reponse.json() : Promise.reject(new Error("Formations indisponibles")))
        .then((donnees: { programmes?: ProgrammeReference[] }) => {
          if (!actif) return;
          const prochainsProgrammes = donnees.programmes || [];
          setProgrammes(prochainsProgrammes);
        })
        .catch(() => undefined)
        .finally(() => {
          if (actif) setRechercheProgramme(false);
        });
    }, 300);
    return () => {
      actif = false;
      window.clearTimeout(temporisateur);
    };
  }, [form.etablissementId, form.paysCode, form.programme, programmeAutre, type]);

  const villeOptions = useMemo<SearchOption[]>(() => villes.map((ville) => ({
    id: String(ville.id),
    label: ville.nom,
    secondary: ville.region,
  })), [villes]);

  const institutionOptions = useMemo<SearchOption[]>(() => institutions.map((institution) => ({
    id: institution.id,
    label: institution.nom,
    secondary: [
      [institution.localite, institution.commune].filter((valeur, index, liste) => valeur && liste.indexOf(valeur) === index).join(", "),
      institution.ville,
      institution.statut,
    ].filter(Boolean).join(" · "),
  })), [institutions]);

  const programmeOptions = useMemo<SearchOption[]>(() => programmes.map((programme) => ({
    id: programme.id,
    label: libelleProgramme(programme.label),
    secondary: programme.diplomeSuggere || programme.diplomes?.join(" · "),
  })), [programmes]);

  const diplomeOptions = useMemo(() => {
    if (type !== "universite" || programmeAutre || !form.programmeId) return diplomes;
    const programmeSelectionne = programmes.find((programme) => programme.id === form.programmeId);
    return programmeSelectionne?.diplomes?.length ? programmeSelectionne.diplomes : diplomes;
  }, [diplomes, form.programmeId, programmes, programmeAutre, type]);

  const estEtablissementScolaire = type === "ecole" || type === "lycee";
  const anneeObtention = Number(form.anneePromo);
  const anneeObtentionEstValide = anneeEstValide(form.anneePromo);
  const anneeObtentionEstFuture = anneeObtentionEstValide
    && anneeObtention > new Date().getFullYear();
  const anneeObtentionEstCoherente = anneeObtentionEstValide && !anneeObtentionEstFuture;
  const diplomesScolaires = form.diplomesScolaires || [];
  const erreursDiplomesScolaires = diplomesScolaires.map((diplome) => erreurDiplomeScolaire(diplome, form.anneeDebut, form.anneeFin));
  const avisEtablissementScolaireDisponible = !estEtablissementScolaire || (
    (diplomesScolaires.some((diplome) => diplome.statut !== "EN_COURS") || anneeObtentionEstCoherente)
    && avisEtablissementScolaireEstDisponible(
      form.statutDiplome,
      form.moisFin,
      form.anneeFin,
      form.anneePromo,
    )
  );
  const avisDisponible = !estEtablissementScolaire || avisEtablissementScolaireDisponible;
  const notesCompletes = !avisDisponible || (
    form.noteEnseignants !== null
    && form.noteContenu !== null
    && form.noteCadre !== null
  );
  const commentaireComplet = !avisDisponible || Boolean(form.commentaire.trim());
  const insertionDemandee = type === "universite" && form.statutDiplome !== "EN_COURS";
  const ancienneteFormationEnMois = ancienneteDepuisFinEnMois(form.moisFin, form.anneeFin);
  const dateFinEstFuture = ancienneteFormationEnMois !== null && ancienneteFormationEnMois < 0;
  const douzeMoisEcoules = ancienneteFormationEnMois !== null && ancienneteFormationEnMois >= 12;
  const delaiCompatibleAvecDate = form.demarcheApresFormation !== "RECHERCHE_EMPLOI"
    || !form.delaiPremierEmploi
    || ancienneteFormationEnMois === null
    || (douzeMoisEcoules
      ? form.delaiPremierEmploi !== "MOINS_DE_12_MOIS_DEPUIS_FIN"
      : DELAIS_AVANT_DOUZE_MOIS.has(form.delaiPremierEmploi));
  const insertionComplete = !insertionDemandee
    || (reponseInsertionEstComplete(form) && delaiCompatibleAvecDate);
  const delaisPremierEmploiDisponibles = DELAIS_PREMIER_EMPLOI.filter(({ valeur }) => {
    if (ancienneteFormationEnMois === null) return true;
    return douzeMoisEcoules
      ? valeur !== "MOINS_DE_12_MOIS_DEPUIS_FIN"
      : DELAIS_AVANT_DOUZE_MOIS.has(valeur);
  });
  const ouvertureAvisEtablissementScolaire = estEtablissementScolaire
    ? dateOuvertureAvisEtablissementScolaire(form.moisFin, form.anneeFin, form.anneePromo)
    : null;
  const libelleOuvertureAvisEtablissementScolaire = ouvertureAvisEtablissementScolaire
    ? `à partir ${avecPrepositionDe(MOIS[ouvertureAvisEtablissementScolaire.getMonth()]?.label || "", ouvertureAvisEtablissementScolaire.getFullYear())}`
    : "un an après l’obtention de votre diplôme";
  const detailsTypeComplets = estEtablissementScolaire ? Boolean(form.systemeEducatifCode) : Boolean(form.programme.trim());
  const diplomeAttendu = form.statutDiplome === "OBTENU" || form.statutDiplome === "EN_COURS";
  const statutInfoAffiche = STATUTS_DIPLOME.find(({ valeur }) => valeur === statutInfoOuvert);
  const diplomeComplet = !diplomeAttendu || (estEtablissementScolaire
    ? diplomesScolaires.length > 0 && erreursDiplomesScolaires.every((erreur) => !erreur)
      && (form.statutDiplome !== "OBTENU" || diplomesScolaires.every((diplome) => diplome.statut !== "EN_COURS"))
    : Boolean(form.diplome.trim() && anneeObtentionEstValide));
  const anneesCompletes = anneeEstValide(form.anneeDebut) && anneeEstValide(form.anneeFin);
  const periodeCompleteEtValide = periodeEstValide(form.moisDebut, form.anneeDebut, form.moisFin, form.anneeFin)
    && (form.statutDiplome === "EN_COURS" || !dateFinEstFuture);
  const villeComplete = form.ville.trim().length >= 2;
  const etablissementComplet = villeComplete && form.etablissement.trim().length >= 2;
  const parcoursComplet = etablissementComplet && (estEtablissementScolaire || Boolean(form.programme.trim()));
  const cibleEtablissement = etablissementAutre ? "etablissement-autre" : "formation-etablissement";
  const cibleParcours = type === "lycee"
    ? "formation-serie"
    : programmeAutre
      ? "programme-autre"
      : "formation-programme";
  const canSave = Boolean(
    form.paysCode
    && form.ville.trim()
    && form.etablissement.trim()
    && anneesCompletes
    && periodeCompleteEtValide
    && detailsTypeComplets
    && diplomeComplet
    && insertionComplete
    && notesCompletes
    && commentaireComplet,
  );

  const demanderVille = () => setBlocageFormulaire({
    titre: "Commencez par la ville",
    message: "Indiquez d’abord la ville de l’établissement. Nous pourrons ensuite vous proposer les bonnes écoles et formations.",
    cibleId: "formation-ville",
    action: "Choisir la ville",
  });

  const demanderEtablissement = () => setBlocageFormulaire({
    titre: "Choisissez d’abord l’établissement",
    message: "Une fois l’établissement choisi, nous afficherons les formations ou séries qui lui correspondent.",
    cibleId: cibleEtablissement,
    action: "Choisir l’établissement",
  });

  const demanderParcours = () => setBlocageFormulaire({
    titre: type === "lycee" ? "Choisissez d’abord la série" : "Choisissez d’abord la formation",
    message: type === "lycee"
      ? "Sélectionnez votre série ou spécialité avant de renseigner la période, le diplôme et votre avis."
      : "Sélectionnez la formation suivie avant de renseigner la période, le diplôme et votre avis.",
    cibleId: cibleParcours,
    action: type === "lycee" ? "Choisir la série" : "Choisir la formation",
  });

  const revenirAuChampManquant = () => {
    if (!blocageFormulaire) return;
    const cibleId = blocageFormulaire.cibleId;
    setBlocageFormulaire(null);
    window.setTimeout(() => {
      const cible = document.getElementById(cibleId);
      cible?.scrollIntoView({ behavior: "smooth", block: "center" });
      cible?.focus();
    }, 80);
  };

  const handlePaysChange = (code: string) => {
    const selection = pays.find((item) => item.code === code);
    if (!selection) return;
    programmeScolaireChoisi.current = false;
    setForm((precedent) => ({
      ...precedent,
      paysCode: selection.code,
      systemeEducatifCode: selection.code,
      pays: selection.nom,
      ville: "",
      etablissement: "",
      etablissementId: "",
      programme: "",
      programmeId: "",
      specialite: "",
      diplome: "",
      mention: "",
    }));
    setEtablissementAutre(false);
    setProgrammeAutre(false);
    setSpecialiteAutre(type === "universite");
    setDiplomeAutre(false);
    setMentionAutre(false);
  };

  const handleInstitutionSelect = (option: SearchOption) => {
    const institution = institutions.find((item) => item.id === option.id);
    if (!institution) return;
    programmeScolaireChoisi.current = false;
    setForm((precedent) => ({
      ...precedent,
      etablissement: institution.nom,
      etablissementId: institution.id,
      etablissementSource: institution.source,
      systemeEducatifCode: institution.systemeEducatifCode || getSystemeEducatifCode(institution.paysCode, institution.id),
      programme: "",
      programmeId: "",
      specialite: "",
      diplome: "",
    }));
    setProgrammeAutre(false);
    setSpecialiteAutre(type === "universite");
    setDiplomeAutre(false);
  };

  const handleProgrammeSelect = (option: SearchOption) => {
    const programme = programmes.find((item) => item.id === option.id);
    if (!programme) return;
    const diplomesAssocies = programme.diplomes || [];
    const diplomeSuggere = programme.diplomeSuggere
      || (diplomesAssocies.length === 1 ? diplomesAssocies[0] : "");
    setForm((precedent) => ({
      ...precedent,
      programme: libelleProgramme(programme.label),
      programmeId: programme.id,
      specialite: "",
      diplome: diplomeSuggere || (
        !diplomesAssocies.length || diplomesAssocies.includes(precedent.diplome)
          ? precedent.diplome
          : ""
      ),
    }));
    setSpecialiteAutre(true);
    setDiplomeAutre(false);
  };

  const nombreNotes = 3;

  const choisirStatutDiplome = (statutDiplome: StatutDiplome) => {
    const conserverDiplome = statutDiplome === "OBTENU" || statutDiplome === "EN_COURS";
    const conserverInsertion = type === "universite" && statutDiplome !== "EN_COURS";
    const conserverAvis = type === "universite" || statutDiplome === "OBTENU";
    setForm((precedent) => ({
      ...precedent,
      statutDiplome,
      diplomesScolaires: statutDiplome === "OBTENU" ? precedent.diplomesScolaires?.map((item) => ({ ...item, statut: "OBTENU" as const })) : precedent.diplomesScolaires,
      diplomeObtenu: statutDiplome === "OBTENU",
      diplome: conserverDiplome ? precedent.diplome : "",
      diplomeId: conserverDiplome ? precedent.diplomeId : "",
      diplomeEstAutre: conserverDiplome ? precedent.diplomeEstAutre : false,
      mention: statutDiplome === "OBTENU" ? precedent.mention : "",
      mentionEstAutre: statutDiplome === "OBTENU" ? precedent.mentionEstAutre : false,
      anneePromo: conserverDiplome ? precedent.anneePromo : "",
      demarcheApresFormation: conserverInsertion ? precedent.demarcheApresFormation : null,
      delaiPremierEmploi: conserverInsertion ? precedent.delaiPremierEmploi : null,
      emploiDansLes12Mois: conserverInsertion ? precedent.emploiDansLes12Mois : null,
      lienEmploiFormation: conserverInsertion ? precedent.lienEmploiFormation : null,
      noteEnseignants: conserverAvis ? precedent.noteEnseignants : null,
      noteContenu: conserverAvis ? precedent.noteContenu : null,
      noteCadre: conserverAvis ? precedent.noteCadre : null,
      commentaire: conserverAvis ? precedent.commentaire : "",
    }));
    if (!conserverDiplome) setDiplomeAutre(false);
    if (statutDiplome !== "OBTENU") setMentionAutre(false);
  };

  const modifierDiplomesScolaires = (diplomes: DiplomeScolaire[]) => {
    const principal = diplomeScolairePrincipal(diplomes);
    setForm((precedent) => ({
      ...precedent,
      diplomesScolaires: diplomes,
      diplomeId: "", specialiteId: "", programmeId: "",
      diplome: principal?.libelle || "",
      anneePromo: principal?.anneeObtention || "",
      mention: principal?.mention || "",
      specialite: principal?.serie || "",
    }));
  };
  const modifierDiplomeScolaire = (index: number, valeurs: Partial<DiplomeScolaire>) =>
    modifierDiplomesScolaires(diplomesScolaires.map((diplome, position) => position === index ? { ...diplome, ...valeurs } : diplome));

  const retirerDiplomeScolaire = (index: number) => {
    clesDiplomesScolaires.current = clesDiplomesScolaires.current.filter((_, position) => position !== index);
    modifierDiplomesScolaires(diplomesScolaires.filter((_, position) => position !== index));
  };

  const ajouterDiplomeScolaire = (typeDiplome: DiplomeScolaire["type"]) => {
    const libelle = typeDiplome === "AUTRE" ? "" : diplomes.find((item) => typeDiplomeScolaire(item) === typeDiplome) || (typeDiplome === "BAC" ? "Baccalauréat" : "Brevet / diplôme de fin d’études fondamentales");
    clesDiplomesScolaires.current.push(`ajout-${prochaineCleDiplome.current++}`);
    modifierDiplomesScolaires([...diplomesScolaires, {
      type: typeDiplome, libelle, anneeObtention: "", mention: "", serie: "", statut: "OBTENU",
    }]);
  };

  const choisirDemarcheApresFormation = (demarche: DemarcheApresFormation) => {
    setForm((precedent) => ({
      ...precedent,
      demarcheApresFormation: demarche,
      delaiPremierEmploi: demarche === "RECHERCHE_EMPLOI" ? precedent.delaiPremierEmploi : null,
      emploiDansLes12Mois: demarche === "RECHERCHE_EMPLOI" ? precedent.emploiDansLes12Mois : null,
      lienEmploiFormation: demarche === "RECHERCHE_EMPLOI" ? precedent.lienEmploiFormation : null,
    }));
  };

  const choisirDelaiPremierEmploi = (delai: DelaiPremierEmploi) => {
    setForm((precedent) => ({
      ...precedent,
      delaiPremierEmploi: delai,
      emploiDansLes12Mois: calculerEmploiDansLes12Mois(delai),
      lienEmploiFormation: emploiTrouve(delai) ? precedent.lienEmploiFormation : null,
    }));
  };

  return (
    <section className="mb-8 rounded-[18px] border border-[#cfe0d2] bg-[#f8f1e6] p-5 sm:p-8">
      <h2 className="mb-1 titre-section">{TYPE_TITRES[type]}</h2>
      <p className="mb-7 text-sm text-[#56493e] sm:text-base">
        Commencez par le lieu : les établissements proposés respectent le pays et le niveau choisis.
      </p>

      <div className="mb-6 grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="formation-pays" className={LABEL_CLASS}>Pays <span className="text-[#c65327]">*</span></label>
          <select id="formation-pays" value={form.paysCode} onChange={(event) => handlePaysChange(event.target.value)} className={FIELD_CLASS}>
            {pays.map((item) => <option key={item.code} value={item.code}>{item.drapeau} {item.nom}</option>)}
          </select>
        </div>
        <SearchCombobox
          id="formation-ville"
          label="Ville"
          value={form.ville}
          placeholder="Recherchez la ville"
          options={villeOptions}
          loading={rechercheVille}
          minChars={2}
          required
          helperText={form.paysCode === "ML"
            ? "Tapez au moins 2 lettres : chef-lieu de région, commune ou village."
            : "Tapez au moins 2 lettres, puis sélectionnez la ville."}
          onChange={(value) => {
            setForm((precedent) => ({
              ...precedent,
              ville: value,
              etablissement: "",
              etablissementId: "",
              programme: "",
              programmeId: "",
              specialite: "",
              diplome: "",
              mention: "",
            }));
            setEtablissementAutre(false);
            setProgrammeAutre(false);
            setSpecialiteAutre(type === "universite");
            setDiplomeAutre(false);
            setMentionAutre(false);
          }}
          onSelect={(option) => {
            setForm((precedent) => ({
              ...precedent,
              ville: option.label,
              etablissement: "",
              etablissementId: "",
              programme: "",
              programmeId: "",
              specialite: "",
              diplome: "",
              mention: "",
            }));
            setEtablissementAutre(false);
            setProgrammeAutre(false);
            setSpecialiteAutre(type === "universite");
            setDiplomeAutre(false);
            setMentionAutre(false);
          }}
        />
      </div>

      <ZoneGuidee
        bloquee={!villeComplete}
        indication="Disponible après la ville"
        onBlockedClick={demanderVille}
        className="mb-6"
      >
      <div>
        {etablissementAutre ? (
          <div>
            <div className="mb-2 flex flex-col items-start gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3">
              <label htmlFor="etablissement-autre" className="text-base font-semibold text-[#2e261f]">
                Nom de l’établissement <span className="text-[#c65327]">*</span>
              </label>
              <button type="button" onClick={() => {
                setEtablissementAutre(false);
                setForm((precedent) => ({
                  ...precedent,
                  etablissement: "",
                  etablissementId: "",
                  programme: "",
                  programmeId: "",
                  specialite: "",
                  diplome: "",
                }));
              }} className="text-sm font-semibold text-[#0d6738] hover:underline">
                Revenir à la liste
              </button>
            </div>
            <input
              id="etablissement-autre"
              value={form.etablissement}
              onChange={(event) => {
                const valeur = event.target.value;
                setForm((precedent) => ({
                  ...precedent,
                  etablissement: valeur,
                  etablissementId: `autre:${valeur}`,
                  programme: "",
                  programmeId: "",
                  specialite: "",
                  diplome: "",
                }));
              }}
              placeholder="Saisissez le nom exact de l’établissement"
              className={FIELD_CLASS}
            />
          </div>
        ) : (
          <SearchCombobox
            id="formation-etablissement"
            label="Nom de l’établissement"
            value={form.etablissement}
            placeholder={form.ville ? "Recherchez l’établissement" : "Choisissez d’abord la ville"}
            options={institutionOptions}
            loading={rechercheInstitution}
            disabled={!form.ville}
            minChars={2}
            required
            helperText={catalogueInstitutionPartiel
              ? "Le catalogue complet est momentanément indisponible. Les références vérifiées restent proposées."
              : "Saisissez au moins 2 lettres : les résultats s’affichent automatiquement."}
            emptyMessage={catalogueInstitutionPartiel
              ? "La recherche complète est momentanément indisponible. Ajoutez votre établissement manuellement."
              : "Aucun établissement correspondant. Vérifiez l’orthographe ou ajoutez-le à la liste."}
            otherLabel="Mon établissement n’est pas dans la liste"
            onOther={() => {
              setEtablissementAutre(true);
              setForm((precedent) => ({
                ...precedent,
                etablissement: "",
                etablissementId: "autre:",
                programme: "",
                programmeId: "",
                specialite: "",
                diplome: "",
              }));
            }}
            onChange={(value) => setForm((precedent) => ({
              ...precedent,
              etablissement: value,
              etablissementId: "",
              programme: "",
              programmeId: "",
              specialite: "",
              diplome: "",
            }))}
            onSelect={handleInstitutionSelect}
          />
        )}
      </div>
      </ZoneGuidee>

      {estEtablissementScolaire && (
        <div className="mb-6">
          <label htmlFor="formation-systeme" className={LABEL_CLASS}>Programme scolaire <span className="text-[#c65327]">*</span></label>
          <select id="formation-systeme" value={form.systemeEducatifCode || form.paysCode} onChange={(event) => {
            programmeScolaireChoisi.current = true;
            const systemeEducatifCode = event.target.value;
            setForm((precedent) => ({ ...precedent, systemeEducatifCode, diplomeId: "", specialiteId: "", programmeId: "" }));
          }} className={FIELD_CLASS}>
            {pays.map((item) => <option key={item.code} value={item.code}>{libelleSystemeEducatif(item.code)}</option>)}
            <option value="AUTRE">Autre programme / programme international</option>
          </select>
          <p className="mt-2 text-sm text-[#56493e]">Choisissez le programme suivi, indépendamment du pays où se trouve l’établissement. Par exemple, Liberté à Bamako suit le programme français.</p>
        </div>
      )}

      {type === "universite" && (
        <div className="mb-6 space-y-5">
          <ZoneGuidee
            bloquee={!etablissementComplet}
            indication="Disponible après l’établissement"
            onBlockedClick={demanderEtablissement}
          >
          {programmeAutre ? (
            <div>
              <div className="mb-2 flex flex-col items-start gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3">
                <label htmlFor="programme-autre" className="text-base font-semibold text-[#2e261f]">
                  Formation <span className="text-[#c65327]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setProgrammeAutre(false);
                    setForm((precedent) => ({ ...precedent, programme: "", programmeId: "", diplome: "" }));
                    setDiplomeAutre(false);
                  }}
                  className="text-sm font-semibold text-[#0d6738] hover:underline"
                >
                  Revenir à la liste
                </button>
              </div>
              <input
                id="programme-autre"
                value={form.programme}
                onChange={(event) => {
                  set("programme", event.target.value);
                  set("programmeId", `autre:${event.target.value}`);
                }}
                placeholder="Ex. Master MECI, Licence informatique…"
                className={FIELD_CLASS}
              />
            </div>
          ) : (
            <SearchCombobox
              id="formation-programme"
              label="Formation"
              value={form.programme}
              placeholder={form.etablissement ? "Recherchez la formation" : "Choisissez d’abord l’établissement"}
              options={programmeOptions}
              loading={rechercheProgramme}
              disabled={!form.etablissement}
              minChars={0}
              required
              otherLabel="Ma formation n’est pas dans la liste"
              onOther={() => {
                setProgrammeAutre(true);
                setForm((precedent) => ({
                  ...precedent,
                  programme: "",
                  programmeId: "autre:",
                  specialite: "",
                  diplome: "",
                }));
                setDiplomeAutre(false);
              }}
              onChange={(value) => {
                setForm((precedent) => ({
                  ...precedent,
                  programme: value,
                  programmeId: "",
                  specialite: "",
                  diplome: "",
                }));
                setDiplomeAutre(false);
              }}
              onSelect={handleProgrammeSelect}
            />
          )}
          </ZoneGuidee>

          <ZoneGuidee
            bloquee={!parcoursComplet}
            indication="Disponible après la formation"
            onBlockedClick={demanderParcours}
          >
          <div>
            <label htmlFor="formation-specialite" className={LABEL_CLASS}>
              Spécialité / parcours <span className="font-normal text-[#74685c]">· facultatif</span>
            </label>
            <input
              id="formation-specialite"
              value={form.specialite}
              onChange={(event) => {
                setSpecialiteAutre(true);
                set("specialite", event.target.value);
              }}
              placeholder="Ex. Sciences biomédicales, finance, droit des affaires…"
              className={FIELD_CLASS}
            />
            <p className="mt-2 text-xs text-[#74685c]">
              Saisissez l’intitulé tel qu’il apparaît dans votre parcours.
            </p>
          </div>
          </ZoneGuidee>
        </div>
      )}

      <ZoneGuidee
        bloquee={!parcoursComplet}
        indication={!villeComplete
          ? "Disponible après la ville"
          : !etablissementComplet
            ? "Disponible après l’établissement"
            : type === "lycee"
              ? "Disponible après la série"
              : "Disponible après la formation"}
        onBlockedClick={!villeComplete
          ? demanderVille
          : !etablissementComplet
            ? demanderEtablissement
            : demanderParcours}
      >
      <div className="mb-6">
        <label className={LABEL_CLASS}>Période <span className="text-[#c65327]">*</span></label>
        <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <select aria-label="Mois de début" value={form.moisDebut} onChange={(event) => set("moisDebut", event.target.value)} className={FIELD_CLASS}>
              <option value="">Mois de début</option>
              {MOIS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input aria-label="Année de début" type="text" inputMode="numeric" maxLength={4} value={form.anneeDebut} onChange={(event) => set("anneeDebut", normaliserAnnee(event.target.value))} placeholder="Année de début" className={FIELD_CLASS} />
          </div>
          <span aria-hidden="true" className="hidden text-xl text-[#2e261f] sm:block">→</span>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <select aria-label="Mois de fin" value={form.moisFin} onChange={(event) => set("moisFin", event.target.value)} className={FIELD_CLASS}>
              <option value="">Mois de fin</option>
              {MOIS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input aria-label="Année de fin" type="text" inputMode="numeric" maxLength={4} value={form.anneeFin} onChange={(event) => set("anneeFin", normaliserAnnee(event.target.value))} placeholder="Année de fin" className={FIELD_CLASS} />
          </div>
        </div>
        {(form.anneeDebut && !anneeEstValide(form.anneeDebut)) || (form.anneeFin && !anneeEstValide(form.anneeFin)) ? (
          <p className="mt-2 text-sm font-medium text-[#a44824]">Une année doit contenir exactement 4 chiffres.</p>
        ) : null}
        {anneesCompletes && form.moisDebut && form.moisFin && !periodeCompleteEtValide ? (
          <p className="mt-2 text-sm font-medium text-[#a44824]">
            {dateFinEstFuture && form.statutDiplome !== "EN_COURS"
              ? "La date de fin d’une formation terminée ne peut pas être dans le futur."
              : "La date de début doit être antérieure ou égale à la date de fin."}
          </p>
        ) : null}
      </div>

      <div className="mb-6">
        <p className={LABEL_CLASS}>Statut de la formation</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STATUTS_DIPLOME.map(({ valeur, libelle }) => {
            const selectionne = form.statutDiplome === valeur;
            return (
              <div key={valeur} className="relative min-w-0">
                <button
                  type="button"
                  aria-pressed={selectionne}
                  onClick={() => choisirStatutDiplome(valeur)}
                  className={`h-[74px] w-full rounded-[13px] border px-10 py-3 text-base font-semibold leading-tight transition-colors ${selectionne ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#dfc9a8] bg-[#fffbf5] text-[#776b5e] hover:border-[#0d6738] hover:text-[#0d6738]"}`}
                >
                  {estEtablissementScolaire && valeur === "OBTENU" ? "Diplôme(s) obtenu(s)" : libelle}
                </button>
                <button
                  type="button"
                  aria-label={`En savoir plus : ${libelle}`}
                  aria-expanded={statutInfoOuvert === valeur}
                  onClick={() => setStatutInfoOuvert((ouvert) => ouvert === valeur ? null : valeur)}
                  className={`absolute right-3 top-3 flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[10px] font-bold leading-none transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#0d6738]/30 ${selectionne ? "border-white/70 text-white" : "border-[#8e806f] text-[#2e261f]"}`}
                >
                  i
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {statutInfoAffiche && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2e261f]/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setStatutInfoOuvert(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-modal-statut-formation"
            className="w-full max-w-md rounded-[22px] border border-[#ead8bd] bg-[#fffbf5] p-6 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4f0e8] text-sm font-bold text-[#0d6738]">i</span>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0d6738]">Statut de la formation</p>
              </div>
              <button
                type="button"
                aria-label="Fermer la fenêtre d’information"
                onClick={() => setStatutInfoOuvert(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-[#2e261f] transition hover:bg-[#f1e4d1]"
              >
                ×
              </button>
            </div>
            <h3 id="titre-modal-statut-formation" className="mb-3 titre-section">
              {statutInfoAffiche.libelle}
            </h3>
            <p className="text-base leading-relaxed text-[#2e261f]">{statutInfoAffiche.explication}</p>
            <button
              type="button"
              onClick={() => setStatutInfoOuvert(null)}
              className="mt-6 w-full rounded-full bg-[#0d6738] px-5 py-3 font-semibold text-white transition hover:bg-[#09572f]"
            >
              J’ai compris
            </button>
          </div>
        </div>
      )}

      {estEtablissementScolaire && diplomeAttendu && (
        <section className="mb-8 space-y-4" aria-labelledby="diplomes-scolaires-titre">
          <h3 id="diplomes-scolaires-titre" className="titre-element">Diplômes dans cet établissement</h3>
          <p className="text-sm text-[#56493e]">Vous pouvez ajouter le brevet ou DEF et le bac à des années différentes pendant la même scolarité, ainsi que tout autre diplôme.</p>
          {diplomesScolaires.map((diplome, index) => (
            <fieldset key={clesDiplomesScolaires.current[index]} className="rounded-[14px] border border-[#dfc9a8] p-4 sm:p-5">
              <legend className="px-2 font-semibold text-[#2e261f]">{diplome.type === "BAC" ? "Baccalauréat" : diplome.type === "BREVET" ? "Brevet / DEF" : "Autre diplôme"}</legend>
              <div className="mb-4 flex justify-end">
                <button type="button" onClick={() => retirerDiplomeScolaire(index)} className="text-sm font-semibold text-[#0d6738] hover:underline">Retirer ce diplôme</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectScolaireAvecAutre
                  id={`diplome-scolaire-${index}`}
                  label="Diplôme"
                  value={diplome.libelle}
                  options={diplomes.filter((item) => item !== "Autre" && (diplome.type === "AUTRE" || typeDiplomeScolaire(item) === diplome.type))}
                  onChange={(libelle) => modifierDiplomeScolaire(index, { libelle })}
                  placeholder="Choisissez le diplôme"
                />
                {form.statutDiplome === "EN_COURS" && (
                  <div>
                    <label htmlFor={`statut-scolaire-${index}`} className={LABEL_CLASS}>Statut du diplôme</label>
                    <select id={`statut-scolaire-${index}`} value={diplome.statut || "OBTENU"} onChange={(event) => modifierDiplomeScolaire(index, { statut: event.target.value as "OBTENU" | "EN_COURS" })} className={FIELD_CLASS}>
                      <option value="OBTENU">Obtenu</option>
                      <option value="EN_COURS">En préparation</option>
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor={`annee-scolaire-${index}`} className={LABEL_CLASS}>{diplome.statut === "EN_COURS" ? "Année prévue" : "Année d’obtention"} <span className="text-[#c65327]">*</span></label>
                  <input id={`annee-scolaire-${index}`} inputMode="numeric" maxLength={4} value={diplome.anneeObtention} onChange={(event) => modifierDiplomeScolaire(index, { anneeObtention: normaliserAnnee(event.target.value) })} placeholder="Ex. 2014" className={FIELD_CLASS} aria-describedby={erreursDiplomesScolaires[index] && diplome.anneeObtention ? `erreur-scolaire-${index}` : undefined} />
                </div>
                {diplome.statut !== "EN_COURS" && (
                  <SelectScolaireAvecAutre
                    id={`mention-scolaire-${index}`}
                    label="Mention obtenue"
                    value={diplome.mention}
                    options={["Passable", "Assez bien", "Bien", "Très bien", "Très honorable", "Félicitations du jury"]}
                    onChange={(mention) => modifierDiplomeScolaire(index, { mention })}
                    placeholder="Choisissez la mention (facultatif)"
                    required={false}
                  />
                )}
                {diplome.type !== "BREVET" && (
                  <div className="md:col-span-2">
                    <SelectScolaireAvecAutre
                      id={`serie-scolaire-${index}`}
                      label="Série / spécialité"
                      value={diplome.serie}
                      options={series}
                      onChange={(serie) => modifierDiplomeScolaire(index, { serie })}
                      placeholder="Choisissez la série ou spécialité (facultatif)"
                      required={false}
                    />
                  </div>
                )}
              </div>
              {erreursDiplomesScolaires[index] && diplome.anneeObtention && <p id={`erreur-scolaire-${index}`} className="mt-3 text-sm font-medium text-[#a44824]">{erreursDiplomesScolaires[index]}</p>}
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            {(["BREVET", "BAC", "AUTRE"] as const).filter((typeDiplome) => typeDiplome === "AUTRE" || !diplomesScolaires.some((item) => item.type === typeDiplome)).map((typeDiplome) => (
              <button key={typeDiplome} type="button" onClick={() => ajouterDiplomeScolaire(typeDiplome)} className="rounded-[12px] border border-dashed border-[#d7b98d] px-4 py-3 font-semibold text-[#0d6738] hover:bg-[#eee2d0]">+ {typeDiplome === "BREVET" ? "Ajouter le brevet / DEF" : typeDiplome === "BAC" ? "Ajouter le bac" : "Autre diplôme obtenu"}</button>
            ))}
          </div>
        </section>
      )}

      {diplomeAttendu && !estEtablissementScolaire && (
        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <SelectAvecAutre
              id="formation-diplome"
              label={form.statutDiplome === "OBTENU" ? "Diplôme obtenu" : "Diplôme préparé"}
              value={form.diplome}
              options={diplomeOptions}
              autre={diplomeAutre}
              placeholder={form.statutDiplome === "OBTENU" ? "Choisissez le diplôme obtenu" : "Choisissez le diplôme préparé"}
              onSelect={(value, autre) => { setDiplomeAutre(autre); set("diplome", value); }}
              onOtherChange={(value) => set("diplome", value)}
            />
            <p className="mt-2 text-xs text-[#74685c]">
              La liste dépend du niveau, du pays et, lorsqu’elle est connue, de la formation choisie.
            </p>
          </div>
          <div>
            <label htmlFor="formation-promotion" className={LABEL_CLASS}>
              {form.statutDiplome === "OBTENU" ? "Année d’obtention du diplôme" : "Année de diplôme prévue"} <span className="text-[#c65327]">*</span>
            </label>
            <input id="formation-promotion" type="text" inputMode="numeric" maxLength={4} value={form.anneePromo} onChange={(event) => set("anneePromo", normaliserAnnee(event.target.value))} placeholder={form.statutDiplome === "OBTENU" ? "Ex. 2023" : "Ex. 2027"} className={FIELD_CLASS} />
            {form.anneePromo && !anneeEstValide(form.anneePromo) && (
              <p className="mt-2 text-sm font-medium text-[#a44824]">L’année doit contenir exactement 4 chiffres.</p>
            )}
          </div>
          {form.statutDiplome === "OBTENU" && (
            <SelectAvecAutre
              id="formation-mention"
              label="Mention obtenue"
              value={form.mention}
              options={["Passable", "Assez bien", "Bien", "Très bien", "Très honorable", "Félicitations du jury", "Autre"]}
              autre={mentionAutre}
              placeholder="Choisissez la mention (facultatif)"
              required={false}
              onSelect={(value, autre) => { setMentionAutre(autre); set("mention", value); }}
              onOtherChange={(value) => set("mention", value)}
            />
          )}
        </div>
      )}

      {insertionDemandee && (
        <section className="mb-8 border-t border-[#e4d2b3] pt-7" aria-labelledby="titre-suivi-insertion">
          <h3 id="titre-suivi-insertion" className="mb-1 titre-element">
            Après la formation
          </h3>
          <p className="mb-5 max-w-4xl text-sm leading-relaxed text-[#56493e] sm:text-base">
            Quelques réponses simples nous permettent de calculer le taux d’insertion à 12 mois de l’établissement.
            Seuls des résultats regroupés seront affichés.
          </p>
          {ancienneteFormationEnMois !== null && !douzeMoisEcoules && !dateFinEstFuture && (
            <p className="mb-5 rounded-[13px] border border-[#d4e4d7] bg-[#edf5ef] px-4 py-3 text-sm leading-relaxed text-[#2e261f] sm:text-base" role="note">
              Votre formation s’est terminée il y a moins de 12 mois. Votre réponse est enregistrée, mais elle ne sera intégrée au taux qu’une fois les 12 mois écoulés.
            </p>
          )}

          <fieldset className="mb-6">
            <legend className={LABEL_CLASS}>
              Après cette formation, quel était votre projet principal ? <span className="text-[#c65327]">*</span>
            </legend>
            <div className="grid gap-3 md:grid-cols-3">
              {DEMARCHES_APRES_FORMATION.map(({ valeur, libelle, precision }) => {
                const selectionne = form.demarcheApresFormation === valeur;
                return (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={selectionne}
                    onClick={() => choisirDemarcheApresFormation(valeur)}
                    className={`${CLASSE_CHOIX} ${selectionne ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#dfc9a8] bg-[#fffbf5] text-[#2e261f] hover:border-[#0d6738]"}`}
                  >
                    <span className="block">{libelle}</span>
                    <span className={`mt-1 block text-xs font-normal ${selectionne ? "text-white/85" : "text-[#56493e]"}`}>
                      {precision}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {form.demarcheApresFormation === "RECHERCHE_EMPLOI" && (
            <fieldset className="mb-6">
              <legend className={LABEL_CLASS}>
                Avez-vous obtenu un emploi ou commencé une activité dans les 12 mois après cette formation ? <span className="text-[#c65327]">*</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {delaisPremierEmploiDisponibles.map(({ valeur, libelle }) => {
                  const selectionne = form.delaiPremierEmploi === valeur;
                  return (
                    <button
                      key={valeur}
                      type="button"
                      aria-pressed={selectionne}
                      onClick={() => choisirDelaiPremierEmploi(valeur)}
                      className={`${CLASSE_CHOIX} text-center ${selectionne ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#dfc9a8] bg-[#fffbf5] text-[#2e261f] hover:border-[#0d6738]"}`}
                    >
                      {libelle}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {form.demarcheApresFormation === "RECHERCHE_EMPLOI" && emploiTrouve(form.delaiPremierEmploi) && (
            <fieldset>
              <legend className={LABEL_CLASS}>
                Cette première activité était-elle liée à votre formation ? <span className="text-[#c65327]">*</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {LIENS_EMPLOI_FORMATION.map(({ valeur, libelle }) => {
                  const selectionne = form.lienEmploiFormation === valeur;
                  return (
                    <button
                      key={valeur}
                      type="button"
                      aria-pressed={selectionne}
                      onClick={() => set("lienEmploiFormation", valeur)}
                      className={`${CLASSE_CHOIX} text-center ${selectionne ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#dfc9a8] bg-[#fffbf5] text-[#2e261f] hover:border-[#0d6738]"}`}
                    >
                      {libelle}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </section>
      )}

      {avisDisponible ? (
        <>
          <div className="border-t border-[#e4d2b3] pt-7">
            <h3 className="mb-1 titre-element">Votre avis sur cette formation</h3>
            <p className="mb-4 text-sm text-[#56493e] sm:text-base">
              {nombreNotes} notes sur 5, puis un mot sur votre expérience. Ces avis aideront les membres du réseau à s’orienter.
            </p>
            <div className="divide-y divide-[#e4d2b3]">
              <StarRating label="Qualité des enseignants" description="Compétence, disponibilité, suivi" value={form.noteEnseignants} onChange={(value) => set("noteEnseignants", value)} />
              <StarRating label="Contenu de la formation" description="Programme, niveau, utilité réelle" value={form.noteContenu} onChange={(value) => set("noteContenu", value)} />
              <StarRating label="Cadre & équipements" description="Locaux, bibliothèque, labos, vie étudiante" value={form.noteCadre} onChange={(value) => set("noteCadre", value)} />
            </div>
          </div>

          <div className="mb-6 mt-6">
            <label htmlFor="formation-commentaire" className={LABEL_CLASS}>Commentaire global sur votre expérience <span className="text-[#c65327]">*</span></label>
            <textarea
              id="formation-commentaire"
              value={form.commentaire}
              onChange={(event) => set("commentaire", event.target.value)}
              placeholder="Ce que vous diriez à quelqu’un qui hésite à s’y inscrire…"
              rows={4}
              className={`${FIELD_CLASS} resize-y`}
            />
          </div>
        </>
      ) : (
        <div className="mb-6 border-t border-[#e4d2b3] pt-7" role="note">
          <div className="rounded-[14px] border border-[#d4e4d7] bg-[#edf5ef] px-5 py-4 text-[#2e261f]">
            <p className="font-semibold">Votre avis sera demandé plus tard</p>
            <p className="mt-1 text-sm leading-relaxed sm:text-base">
              {form.statutDiplome !== "OBTENU"
                ? "Pour une école ou un lycée, l’avis est ouvert uniquement après l’obtention du diplôme et un an de recul. Vous pouvez enregistrer votre parcours sans le noter."
                : !anneeObtentionEstValide
                  ? "Indiquez une année d’obtention valide pour connaître la date à laquelle vous pourrez laisser un avis."
                  : anneeObtentionEstFuture
                    ? "L’année d’obtention du diplôme ne peut pas être dans le futur."
                    : `Vous pourrez noter cet établissement ${libelleOuvertureAvisEtablissementScolaire}. Vous pouvez enregistrer votre parcours dès maintenant.`}
            </p>
          </div>
        </div>
      )}
      </ZoneGuidee>

      {blocageFormulaire && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#2e261f]/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setBlocageFormulaire(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-modal-etape-manquante"
            className="w-full max-w-md rounded-[22px] border border-[#ead8bd] bg-[#fffbf5] p-6 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4f0e8] text-base font-bold text-[#0d6738]">→</span>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0d6738]">Parcours guidé</p>
              </div>
              <button
                type="button"
                aria-label="Fermer la fenêtre"
                onClick={() => setBlocageFormulaire(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-[#2e261f] transition hover:bg-[#f1e4d1]"
              >
                ×
              </button>
            </div>
            <h3 id="titre-modal-etape-manquante" className="mb-3 titre-section">
              {blocageFormulaire.titre}
            </h3>
            <p className="text-base leading-relaxed text-[#2e261f]">{blocageFormulaire.message}</p>
            <p className="mt-4 rounded-[12px] bg-[#f6efe3] px-4 py-3 text-sm leading-relaxed text-[#2e261f]">
              Pas d’inquiétude : le formulaire s’ouvrira progressivement à mesure que vous avancez.
            </p>
            <button
              type="button"
              onClick={revenirAuChampManquant}
              className="mt-6 w-full rounded-full bg-[#0d6738] px-5 py-3 font-semibold text-white transition hover:bg-[#09572f]"
            >
              {blocageFormulaire.action}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} className="rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-8 py-4 text-base font-semibold text-[#2e261f] hover:bg-[#f6efe3]">
          Annuler
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return;
            const principal = estEtablissementScolaire && diplomeAttendu ? diplomeScolairePrincipal(diplomesScolaires) : undefined;
            onSave({
              ...form,
              ...(estEtablissementScolaire ? {
                type: "ecole" as const,
                diplomeId: "", specialiteId: "", programmeId: "",
                diplomesScolaires: diplomeAttendu ? diplomesScolaires : [],
                diplome: principal?.libelle || "",
                anneePromo: principal?.anneeObtention || "",
                mention: principal?.mention || "",
                specialite: principal?.serie || "",
                demarcheApresFormation: null,
                delaiPremierEmploi: null,
                lienEmploiFormation: null,
              } : {}),
              id: initialData?.id || crypto.randomUUID(),
              emploiDansLes12Mois: !estEtablissementScolaire && form.demarcheApresFormation === "RECHERCHE_EMPLOI"
                ? calculerEmploiDansLes12Mois(form.delaiPremierEmploi)
                : null,
              noteEnseignants: avisDisponible ? form.noteEnseignants : null,
              noteContenu: avisDisponible ? form.noteContenu : null,
              noteCadre: avisDisponible ? form.noteCadre : null,
              commentaire: avisDisponible ? form.commentaire.trim() : "",
              specialiteEstAutre: specialiteAutre,
              diplomeEstAutre: diplomeAutre,
              mentionEstAutre: mentionAutre,
            });
          }}
          className={`flex-1 rounded-[14px] px-8 py-4 text-base font-semibold transition-colors ${canSave ? "bg-[#0d6738] text-white hover:bg-[#09572f]" : "cursor-not-allowed bg-[#eee2d0] text-[#ad9d89]"}`}
        >
          {initialData ? "Enregistrer les modifications" : "Enregistrer cette formation"}
        </button>
      </div>
      <p className="mt-3 text-sm text-[#56493e]">
        {canSave
          ? avisDisponible
            ? "Tout est bon, vous pourrez modifier cet avis plus tard."
            : "Tout est bon. Votre parcours peut être enregistré sans avis pour le moment."
          : insertionDemandee && !insertionComplete
            ? !delaiCompatibleAvecDate
              ? "Choisissez une réponse compatible avec la date de fin de votre formation."
              : "Complétez les questions sur votre situation après la formation."
            : avisDisponible
              ? `Complétez les champs obligatoires, les ${nombreNotes} notes et votre commentaire.`
              : "Complétez les champs obligatoires de votre parcours."}
      </p>
    </section>
  );
}

/** Fusionne uniquement deux périodes du même établissement canonique sans avis contradictoires. */
const fusionnerParcoursScolairesCompatibles = (formations: Formation[]): Formation[] => {
  const resultat: Formation[] = [];
  // Le rapprochement des périodes nécessite un ordre ancien → récent.
  for (const formation of trierParDateDebut(formations, "croissant")) {
    if (formation.type === "universite" || !formation.etablissementId || formation.etablissementId.startsWith("autre:")) {
      resultat.push(formation);
      continue;
    }
    const memeValeur = (a: unknown, b: unknown) => a == null || a === "" || b == null || b === "" || a === b;
    const index = resultat.findIndex((autre) => autre.type !== "universite"
      && autre.etablissementId === formation.etablissementId
      && autre.paysCode === formation.paysCode && normaliserLibelle(autre.ville) === normaliserLibelle(formation.ville)
      && (autre.systemeEducatifCode || autre.paysCode) === (formation.systemeEducatifCode || formation.paysCode)
      && autre.statutDiplome === formation.statutDiplome
      && diplomesDuParcoursScolaire(autre).length > 0 && diplomesDuParcoursScolaire(formation).length > 0
      && !autre.propositionsCatalogue?.length && !formation.propositionsCatalogue?.length
      && !["EN_COURS", "ERREUR"].includes(autre.synchronisationCatalogue || "")
      && !["EN_COURS", "ERREUR"].includes(formation.synchronisationCatalogue || "")
      && ["commentaire", "noteEnseignants", "noteContenu", "noteCadre", "programme"].every((cle) => memeValeur(autre[cle as keyof Formation], formation[cle as keyof Formation]))
      && periodeEstValide(autre.moisDebut, autre.anneeDebut, autre.moisFin, autre.anneeFin)
      && periodeEstValide(formation.moisDebut, formation.anneeDebut, formation.moisFin, formation.anneeFin)
      && Number(formation.anneeDebut) * 12 + Number(formation.moisDebut) <= Number(autre.anneeFin) * 12 + Number(autre.moisFin) + 12);
    if (index === -1) {
      resultat.push(formation);
      continue;
    }
    const autre = resultat[index];
    const diplomes = [...new Map([...diplomesDuParcoursScolaire(autre), ...diplomesDuParcoursScolaire(formation)]
      .map((diplome) => [JSON.stringify(diplome), diplome])).values()];
    const principal = diplomeScolairePrincipal(diplomes);
    const derniere = Number(formation.anneeFin) * 12 + Number(formation.moisFin) > Number(autre.anneeFin) * 12 + Number(autre.moisFin) ? formation : autre;
    resultat[index] = {
      ...autre, type: "ecole", diplomesScolaires: diplomes,
      programme: autre.programme || formation.programme,
      programmeId: "", diplomeId: "", specialiteId: "",
      anneeFin: derniere.anneeFin, moisFin: derniere.moisFin,
      diplome: principal?.libelle || autre.diplome, anneePromo: principal?.anneeObtention || autre.anneePromo,
      mention: principal?.mention || "", specialite: principal?.serie || "",
      commentaire: autre.commentaire || formation.commentaire,
      noteEnseignants: autre.noteEnseignants ?? formation.noteEnseignants,
      noteContenu: autre.noteContenu ?? formation.noteContenu,
      noteCadre: autre.noteCadre ?? formation.noteCadre,
    };
  }
  return resultat;
};

export default function StepFormations({ onNext, onBack, initialData }: StepFormationsProps) {
  const [formations, setFormations] = useState<Formation[]>(() => fusionnerParcoursScolairesCompatibles(initialData || []));
  const [formOuvert, setFormOuvert] = useState<FormationType | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const formationEnEdition = editionId ? formations.find((formation) => formation.id === editionId) : undefined;

  const enregistrerLocalement = (formation: Formation) => {
    setFormations((precedent) => {
      const existe = precedent.some((item) => item.id === formation.id);
      return existe
        ? precedent.map((item) => item.id === formation.id ? formation : item)
        : [...precedent, formation];
    });
  };

  const handleSave = (formation: Formation) => {
    const items = construireSuggestions(formation);
    enregistrerLocalement({
      ...formation,
      synchronisationCatalogue: items.length ? "EN_COURS" : undefined,
    });
    setFormOuvert(null);
    setEditionId(null);

    if (!items.length) return;
    void api.post<{ resultats: ResultatSuggestionCatalogue[] }>(
      "/education/catalogue/suggestions",
      { items },
    ).then(({ data: reponse }) => {
      const resultatParCle = new Map(reponse.resultats.map((resultat) => [resultat.clientKey, resultat]));
      const propositionsCatalogue = items.reduce<PropositionCatalogue[]>((resultats, item) => {
        const resultat = resultatParCle.get(item.clientKey);
        if (resultat && resultat.statut !== "EXISTANT") {
          resultats.push({
            clientKey: item.clientKey,
            type: item.type,
            statut: resultat.statut,
            suggestionId: resultat.suggestionId,
          });
        }
        return resultats;
      }, []);

      setFormations((precedent) => precedent.map((item) => {
        if (item.id !== formation.id) return item;
        const etablissement = resultatParCle.get(`${formation.id}:etablissement`);
        const programme = resultatParCle.get(`${formation.id}:programme`);
        const specialite = resultatParCle.get(`${formation.id}:specialite`);
        const diplome = resultatParCle.get(`${formation.id}:diplome`);
        return {
          ...item,
          etablissementId: etablissement?.canoniqueId || item.etablissementId,
          etablissement: etablissement?.libelle || item.etablissement,
          programmeId: programme?.canoniqueId || item.programmeId,
          programme: programme?.libelle || item.programme,
          specialiteId: specialite?.canoniqueId || item.specialiteId,
          specialite: specialite?.libelle || item.specialite,
          diplomeId: diplome?.canoniqueId || item.diplomeId,
          diplome: diplome?.libelle || item.diplome,
          specialiteEstAutre: specialite?.statut === "EXISTANT" ? false : item.specialiteEstAutre,
          diplomeEstAutre: diplome?.statut === "EXISTANT" ? false : item.diplomeEstAutre,
          propositionsCatalogue,
          synchronisationCatalogue: "TERMINEE",
        };
      }));
    }).catch(() => {
      setFormations((precedent) => precedent.map((item) => item.id === formation.id
        ? { ...item, synchronisationCatalogue: "ERREUR" }
        : item));
    });
  };

  const handleModifier = (formation: Formation) => {
    setEditionId(formation.id);
    setFormOuvert(formation.type === "universite" ? "universite" : "ecole");
  };

  const fermerFormulaire = () => {
    setFormOuvert(null);
    setEditionId(null);
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-[22px] border border-[#e4d2b3] bg-[#fffbf5] p-4 shadow-sm sm:p-9 lg:p-12">
      <h1 className="mb-3 font-display text-3xl font-bold text-[#292119] sm:text-[36px]">Votre parcours de formation</h1>
      <p className="mb-8 max-w-[1160px] text-base leading-relaxed text-[#2e261f] sm:text-lg">
        Ajoutez vos établissements : ils seront classés automatiquement du plus récent au plus ancien. Regroupez le brevet ou DEF, le bac et vos autres diplômes sur une seule fiche par école ou lycée. Les questions sur l’insertion concernent uniquement le supérieur.
      </p>

      {trierParDateDebut(formations).map((formation) => (
        <FormationCard
          key={formation.id}
          formation={formation}
          onModifier={() => handleModifier(formation)}
          onRetirer={() => setFormations((precedent) => precedent.filter((item) => item.id !== formation.id))}
        />
      ))}

      {formOuvert && (
        <FormationForm
          key={formationEnEdition?.id || formOuvert}
          type={formOuvert}
          initialData={formationEnEdition}
          onSave={handleSave}
          onCancel={fermerFormulaire}
        />
      )}

      {!formOuvert && (
        <>
          <div className="mb-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            {(["ecole", "universite"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setFormOuvert(type); setEditionId(null); }}
                className="rounded-[14px] border border-dashed border-[#d7b98d] bg-[#fffbf5] px-6 py-4 text-left text-base font-semibold text-[#0d6738] transition-colors hover:border-[#0d6738] hover:bg-[#f6efe3] focus:outline-none focus:ring-2 focus:ring-[#0d6738]/25 sm:text-lg"
              >
                + Ajouter {type === "ecole" ? "une école / un lycée" : "un établissement supérieur"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button type="button" onClick={onBack} className="rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-8 py-4 text-base font-semibold text-[#2e261f] hover:bg-[#f6efe3] sm:w-[140px] sm:text-lg">
              Retour
            </button>
            <button
              type="button"
              onClick={() => onNext(trierParDateDebut(formations).map(nettoyerAvisNonEligible))}
              className={`flex-1 rounded-full px-8 py-4 text-base font-semibold text-white transition-colors sm:text-lg ${formations.length ? "bg-[#0d6738] hover:bg-[#09572f]" : "bg-[#aa997f] hover:bg-[#96866e]"}`}
            >
              {formations.length ? "Continuer vers les expériences" : "Passer cette étape"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

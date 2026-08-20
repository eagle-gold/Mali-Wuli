"use client";

import { useEffect, useMemo, useState } from "react";
import SearchCombobox, { type SearchOption } from "./SearchCombobox";
import StarRating from "./StarRating";
import type { FormationType, ProgrammeReference } from "@/lib/education/reference";
import api from "@/lib/api";

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

const STATUTS_DIPLOME: Array<{ valeur: StatutDiplome; libelle: string }> = [
  { valeur: "OBTENU", libelle: "Oui, diplôme obtenu" },
  { valeur: "EN_COURS", libelle: "En cours" },
  { valeur: "NON_OBTENU", libelle: "Non obtenu" },
  { valeur: "NON_DIPLOMANTE", libelle: "Formation non diplômante" },
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
  programme: string;
  programmeId: string;
  specialite: string;
  specialiteId?: string;
  specialiteEstAutre?: boolean;
  anneeDebut: string;
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
  noteInsertion: number | null;
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
  ecole: "ÉCOLE",
  lycee: "LYCÉE",
  universite: "SUPÉRIEUR",
};

const TYPE_TITRES: Record<FormationType, string> = {
  ecole: "École fréquentée",
  lycee: "Lycée fréquenté",
  universite: "Université / école privée",
};

const FIELD_CLASS =
  "w-full rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-5 py-4 text-base text-[#2e261f] outline-none transition focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20 sm:text-lg";

const LABEL_CLASS = "mb-2 block text-base font-semibold text-[#2e261f]";

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
  const contexteBase = { formationType: formation.type };
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
      type: formation.type === "lycee" ? "SERIE" : "SPECIALITE",
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
  programme: "",
  programmeId: "",
  specialite: "",
  specialiteId: "",
  specialiteEstAutre: false,
  anneeDebut: "",
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
  noteInsertion: null,
  commentaire: "",
});

const calculerMoyenne = (formation: Formation) => {
  const notes = [formation.noteEnseignants, formation.noteContenu, formation.noteCadre];
  if (formation.type !== "ecole") notes.push(formation.noteInsertion);
  const valeurs = notes.filter((note): note is number => note !== null);
  return valeurs.length ? valeurs.reduce((total, note) => total + note, 0) / valeurs.length : null;
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
  const libelleStatutDiplome: Record<StatutDiplome, string> = {
    OBTENU: formation.diplome,
    EN_COURS: formation.diplome ? `${formation.diplome} en cours` : "Formation en cours",
    NON_OBTENU: "Diplôme non obtenu",
    NON_DIPLOMANTE: "Formation non diplômante",
  };
  const informations = [
    libelleStatutDiplome[statutDiplome],
    statutDiplome === "OBTENU" && formation.mention ? `mention ${formation.mention}` : "",
    formation.programme,
    formation.specialite,
    `${formation.ville}, ${formation.pays}`,
    `${formation.anneeDebut} – ${formation.anneeFin}`,
    formation.anneePromo
      ? statutDiplome === "EN_COURS"
        ? `diplôme prévu en ${formation.anneePromo}`
        : `promo ${formation.anneePromo}`
      : "",
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
              <h3 className="min-w-0 break-words text-lg font-bold text-[#2e261f] [overflow-wrap:anywhere] sm:text-xl">{formation.etablissement}</h3>
              <span className="max-w-full break-words rounded-[7px] bg-[#eee2d0] px-3 py-1 text-xs font-bold text-[#2e261f] [overflow-wrap:anywhere] sm:text-sm">
                {TYPE_LABELS[formation.type]}
              </span>
              <span className={`max-w-full break-words rounded-[7px] px-3 py-1 text-xs font-bold [overflow-wrap:anywhere] sm:text-sm ${statutDiplome === "OBTENU" ? "bg-[#e1f1e6] text-[#0d6738]" : "bg-[#f1e4d1] text-[#735133]"}`}>
                {{
                  OBTENU: "DIPLÔME OBTENU",
                  EN_COURS: "EN COURS",
                  NON_OBTENU: "DIPLÔME NON OBTENU",
                  NON_DIPLOMANTE: "NON DIPLÔMANTE",
                }[statutDiplome]}
              </span>
              {formation.synchronisationCatalogue === "EN_COURS" && (
                <span className="max-w-full rounded-[7px] bg-[#eee2d0] px-3 py-1 text-xs font-bold text-[#735133] sm:text-sm">
                  ENREGISTREMENT…
                </span>
              )}
              {formation.synchronisationCatalogue === "TERMINEE" && Boolean(formation.propositionsCatalogue?.length) && (
                <span className="max-w-full rounded-[7px] bg-[#f8e4d7] px-3 py-1 text-xs font-bold text-[#9a441f] sm:text-sm">
                  PROPOSITION EN VALIDATION
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
      type,
      statutDiplome: statutInitial,
      diplomeObtenu: statutInitial === "OBTENU",
    };
  });
  const [pays, setPays] = useState<PaysOption[]>(PAYS_DE_SECOURS);
  const [villes, setVilles] = useState<VilleOption[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeReference[]>([]);
  const [series, setSeries] = useState<string[]>([]);
  const [diplomes, setDiplomes] = useState<string[]>([]);
  const [rechercheVille, setRechercheVille] = useState(false);
  const [rechercheInstitution, setRechercheInstitution] = useState(false);
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
    fetch(`/api/education/reference?${parametres}`)
      .then((reponse) => reponse.ok ? reponse.json() : Promise.reject(new Error("Référentiel indisponible")))
      .then((donnees: ReferenceResponse) => {
        if (!actif) return;
        const prochainesSeries = donnees.series || [];
        const prochainsDiplomes = donnees.diplomes || [];
        setSeries(prochainesSeries);
        setDiplomes(prochainsDiplomes);
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
  }, [form.paysCode, form.etablissementId, type]);

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
      return;
    }
    if (!etablissementAutre && form.etablissement.trim().length < 2) {
      setInstitutions([]);
      setRechercheInstitution(false);
      return;
    }
    // Ne jamais laisser les résultats de la requête précédente visibles pendant
    // le délai de saisie ou lorsqu'un onglet reprend le focus.
    setInstitutions([]);
    setRechercheInstitution(true);
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
        .then((donnees: { institutions?: InstitutionOption[] }) => {
          if (actif) setInstitutions(donnees.institutions || []);
        })
        .catch(() => {
          if (actif) setInstitutions([]);
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
    secondary: [institution.ville, institution.statut].filter(Boolean).join(" · "),
  })), [institutions]);

  const programmeOptions = useMemo<SearchOption[]>(() => programmes.map((programme) => ({
    id: programme.id,
    label: programme.label,
    secondary: programme.diplomeSuggere || programme.diplomes?.join(" · "),
  })), [programmes]);

  const diplomeOptions = useMemo(() => {
    if (type !== "universite" || programmeAutre || !form.programmeId) return diplomes;
    const programmeSelectionne = programmes.find((programme) => programme.id === form.programmeId);
    return programmeSelectionne?.diplomes?.length ? programmeSelectionne.diplomes : diplomes;
  }, [diplomes, form.programmeId, programmes, programmeAutre, type]);

  const notesCompletes = form.noteEnseignants !== null
    && form.noteContenu !== null
    && form.noteCadre !== null
    && (type === "ecole" || form.noteInsertion !== null);
  const detailsTypeComplets = type === "ecole"
    || (type === "lycee" ? Boolean(form.specialite.trim()) : Boolean(form.programme.trim() && form.specialite.trim()));
  const diplomeAttendu = form.statutDiplome === "OBTENU" || form.statutDiplome === "EN_COURS";
  const diplomeComplet = !diplomeAttendu || Boolean(form.diplome.trim() && form.anneePromo.trim());
  const canSave = Boolean(
    form.paysCode
    && form.ville.trim()
    && form.etablissement.trim()
    && form.anneeDebut.trim()
    && form.anneeFin.trim()
    && detailsTypeComplets
    && diplomeComplet
    && notesCompletes
    && form.commentaire.trim(),
  );

  const handlePaysChange = (code: string) => {
    const selection = pays.find((item) => item.code === code);
    if (!selection) return;
    setForm((precedent) => ({
      ...precedent,
      paysCode: selection.code,
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
    setForm((precedent) => ({
      ...precedent,
      etablissement: institution.nom,
      etablissementId: institution.id,
      etablissementSource: institution.source,
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
      programme: programme.label,
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

  const nombreNotes = type === "ecole" ? 3 : 4;

  const choisirStatutDiplome = (statutDiplome: StatutDiplome) => {
    const conserverDiplome = statutDiplome === "OBTENU" || statutDiplome === "EN_COURS";
    setForm((precedent) => ({
      ...precedent,
      statutDiplome,
      diplomeObtenu: statutDiplome === "OBTENU",
      diplome: conserverDiplome ? precedent.diplome : "",
      diplomeId: conserverDiplome ? precedent.diplomeId : "",
      diplomeEstAutre: conserverDiplome ? precedent.diplomeEstAutre : false,
      mention: statutDiplome === "OBTENU" ? precedent.mention : "",
      mentionEstAutre: statutDiplome === "OBTENU" ? precedent.mentionEstAutre : false,
      anneePromo: conserverDiplome ? precedent.anneePromo : "",
    }));
    if (!conserverDiplome) setDiplomeAutre(false);
    if (statutDiplome !== "OBTENU") setMentionAutre(false);
  };

  return (
    <section className="mb-8 rounded-[18px] border border-[#cfe0d2] bg-[#f8f1e6] p-5 sm:p-8">
      <h2 className="mb-1 text-xl font-bold text-[#2e261f] sm:text-2xl">{TYPE_TITRES[type]}</h2>
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
          helperText="Tapez au moins 2 lettres, puis sélectionnez la ville."
          onChange={(value) => {
            setForm((precedent) => ({ ...precedent, ville: value, etablissement: "", etablissementId: "" }));
            setEtablissementAutre(false);
          }}
          onSelect={(option) => setForm((precedent) => ({ ...precedent, ville: option.label, etablissement: "", etablissementId: "" }))}
        />
      </div>

      <div className="mb-6">
        {etablissementAutre ? (
          <div>
            <div className="mb-2 flex flex-col items-start gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3">
              <label htmlFor="etablissement-autre" className="text-base font-semibold text-[#2e261f]">
                Nom de l’établissement <span className="text-[#c65327]">*</span>
              </label>
              <button type="button" onClick={() => { setEtablissementAutre(false); set("etablissement", ""); }} className="text-sm font-semibold text-[#0d6738] hover:underline">
                Revenir à la liste
              </button>
            </div>
            <input
              id="etablissement-autre"
              value={form.etablissement}
              onChange={(event) => {
                set("etablissement", event.target.value);
                set("etablissementId", `autre:${event.target.value}`);
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
            helperText="Saisissez au moins 2 lettres : les résultats s’affichent automatiquement."
            emptyMessage="Aucun établissement correspondant. Vérifiez l’orthographe ou ajoutez-le à la liste."
            otherLabel="Mon établissement n’est pas dans la liste"
            onOther={() => {
              setEtablissementAutre(true);
              setForm((precedent) => ({ ...precedent, etablissement: "", etablissementId: "autre:" }));
            }}
            onChange={(value) => setForm((precedent) => ({ ...precedent, etablissement: value, etablissementId: "" }))}
            onSelect={handleInstitutionSelect}
          />
        )}
      </div>

      {type === "lycee" && (
        <div className="mb-6">
          <SelectAvecAutre
            id="formation-serie"
            label="Série / spécialité"
            value={form.specialite}
            options={series}
            autre={specialiteAutre}
            placeholder="Choisissez la série ou spécialité"
            onSelect={(value, autre) => { setSpecialiteAutre(autre); set("specialite", value); }}
            onOtherChange={(value) => set("specialite", value)}
          />
        </div>
      )}

      {type === "universite" && (
        <div className="mb-6 space-y-5">
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

          <div>
            <label htmlFor="formation-specialite" className={LABEL_CLASS}>
              Spécialité / parcours <span className="text-[#c65327]">*</span>
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
        </div>
      )}

      <div className="mb-6">
        <label className={LABEL_CLASS}>Années <span className="text-[#c65327]">*</span></label>
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <input aria-label="Année de début" type="number" min="1940" max="2100" value={form.anneeDebut} onChange={(event) => set("anneeDebut", event.target.value)} placeholder="Année de début" className={FIELD_CLASS} />
          <span aria-hidden="true" className="hidden text-xl text-[#2e261f] sm:block">→</span>
          <input aria-label="Année de fin" type="number" min="1940" max="2100" value={form.anneeFin} onChange={(event) => set("anneeFin", event.target.value)} placeholder="Année de fin" className={FIELD_CLASS} />
        </div>
      </div>

      <div className="mb-6">
        <p className={LABEL_CLASS}>Statut de la formation</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STATUTS_DIPLOME.map(({ valeur, libelle }) => {
            const selectionne = form.statutDiplome === valeur;
            return (
              <button
                key={valeur}
                type="button"
                aria-pressed={selectionne}
                onClick={() => choisirStatutDiplome(valeur)}
                className={`min-h-[54px] rounded-[13px] border px-5 py-3 text-base font-semibold transition-colors ${selectionne ? "border-[#0d6738] bg-[#0d6738] text-white" : "border-[#dfc9a8] bg-[#fffbf5] text-[#776b5e] hover:border-[#0d6738] hover:text-[#0d6738]"}`}
              >
                {libelle}
              </button>
            );
          })}
        </div>
      </div>

      {diplomeAttendu && (
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
              {form.statutDiplome === "OBTENU" ? "Année de votre promotion" : "Année de diplôme prévue"} <span className="text-[#c65327]">*</span>
            </label>
            <input id="formation-promotion" type="number" min="1940" max="2100" value={form.anneePromo} onChange={(event) => set("anneePromo", event.target.value)} placeholder={form.statutDiplome === "OBTENU" ? "Ex. 2023" : "Ex. 2027"} className={FIELD_CLASS} />
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

      {form.statutDiplome === "NON_OBTENU" && (
        <p className="mb-8 rounded-[14px] border border-[#ead8bd] bg-[#fff8ee] px-5 py-4 text-sm leading-relaxed text-[#56493e]">
          Vous avez suivi cette formation, mais vous n’avez pas obtenu le diplôme. Aucun diplôme ni aucune mention ne sera affiché sur votre profil.
        </p>
      )}

      {form.statutDiplome === "NON_DIPLOMANTE" && (
        <p className="mb-8 rounded-[14px] border border-[#cfe0d2] bg-[#edf5ef] px-5 py-4 text-sm leading-relaxed text-[#315f43]">
          Cette formation ne délivre pas de diplôme. Elle apparaîtra sur votre profil comme « formation non diplômante ».
        </p>
      )}

      <div className="border-t border-[#e4d2b3] pt-7">
        <h3 className="mb-1 text-xl font-bold text-[#2e261f]">Votre avis sur cette formation</h3>
        <p className="mb-4 text-sm text-[#56493e] sm:text-base">
          {nombreNotes} notes sur 5, puis un mot sur votre expérience. Ces avis aideront les membres du réseau à s’orienter.
        </p>
        <div className="divide-y divide-[#e4d2b3]">
          <StarRating label="Qualité des enseignants" description="Compétence, disponibilité, suivi" value={form.noteEnseignants} onChange={(value) => set("noteEnseignants", value)} />
          <StarRating label="Contenu de la formation" description="Programme, niveau, utilité réelle" value={form.noteContenu} onChange={(value) => set("noteContenu", value)} />
          <StarRating label="Cadre & équipements" description="Locaux, bibliothèque, labos, vie étudiante" value={form.noteCadre} onChange={(value) => set("noteCadre", value)} />
          {type !== "ecole" && (
            <StarRating label="Taux d’insertion professionnelle" description="Trouve-t-on du travail à la sortie ?" value={form.noteInsertion} onChange={(value) => set("noteInsertion", value)} />
          )}
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} className="rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-8 py-4 text-base font-semibold text-[#2e261f] hover:bg-[#f6efe3]">
          Annuler
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return;
            onSave({
              ...form,
              id: initialData?.id || crypto.randomUUID(),
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
        {canSave ? "Tout est bon, vous pourrez modifier cet avis plus tard." : `Complétez les champs obligatoires, les ${nombreNotes} notes et votre commentaire.`}
      </p>
    </section>
  );
}

export default function StepFormations({ onNext, onBack, initialData }: StepFormationsProps) {
  const [formations, setFormations] = useState<Formation[]>(initialData || []);
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
    setFormOuvert(formation.type);
  };

  const fermerFormulaire = () => {
    setFormOuvert(null);
    setEditionId(null);
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-[22px] border border-[#e4d2b3] bg-[#fffbf5] p-4 shadow-sm sm:p-9 lg:p-12">
      <h1 className="mb-3 font-display text-3xl font-bold text-[#2e261f] sm:text-[36px]">Votre parcours de formation</h1>
      <p className="mb-8 max-w-[1160px] text-base leading-relaxed text-[#2e261f] sm:text-lg">
        Ajoutez vos établissements, école, lycée, université ou école privée. Pour chacun, quelques notes et un commentaire. Ensemble construisons le guide d&apos;orientation pour nos futurs talents.
      </p>

      {formations.map((formation) => (
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
            {(["ecole", "lycee", "universite"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setFormOuvert(type); setEditionId(null); }}
                className="rounded-[14px] border border-dashed border-[#d7b98d] bg-[#fffbf5] px-6 py-4 text-left text-base font-semibold text-[#0d6738] transition-colors hover:border-[#0d6738] hover:bg-[#f6efe3] focus:outline-none focus:ring-2 focus:ring-[#0d6738]/25 sm:text-lg"
              >
                + Ajouter {type === "ecole" ? "une école" : type === "lycee" ? "un lycée" : "une université ou école privée"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button type="button" onClick={onBack} className="rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-8 py-4 text-base font-semibold text-[#2e261f] hover:bg-[#f6efe3] sm:w-[140px] sm:text-lg">
              Retour
            </button>
            <button
              type="button"
              onClick={() => onNext(formations)}
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

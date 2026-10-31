"use client";

import { useEffect, useState } from "react";
import { erreurLienSocial, LONGUEUR_MAX_LIEN_SOCIAL, normaliserReseauxSociaux, RESEAUX_SOCIAUX, type ReseauSocial, type ReseauxSociaux } from "@/lib/reseaux-sociaux";

interface StepInformationsProps {
  onNext: (data: InfoData) => void;
  onBack: () => void;
  initialData?: InfoData;
}

export interface InfoData extends ReseauxSociaux {
  prenom: string;
  nom: string;
  /** Titre écrit par le membre (160 caractères maximum) ; vide = titre par défaut qui suit son parcours. */
  titre?: string;
  telephone: string;
  indicatif: string;
  pays: string;
  paysCode: string;
  ville: string;
}

type PaysOption = {
  code: string;
  nom: string;
  indicatif: string;
  drapeau: string;
};

type VilleOption = {
  id: number;
  nom: string;
  region: string;
};

// Mali, puis les cinq principales destinations de la diaspora malienne
// selon l'International Migrant Stock 2024 de l'ONU (UN DESA).
const PAYS_DE_SECOURS: PaysOption[] = [
  { code: "ML", nom: "Mali", indicatif: "223", drapeau: "🇲🇱" },
  { code: "CI", nom: "Côte d’Ivoire", indicatif: "225", drapeau: "🇨🇮" },
  { code: "NG", nom: "Nigéria", indicatif: "234", drapeau: "🇳🇬" },
  { code: "NE", nom: "Niger", indicatif: "227", drapeau: "🇳🇪" },
  { code: "MR", nom: "Mauritanie", indicatif: "222", drapeau: "🇲🇷" },
  { code: "FR", nom: "France", indicatif: "33", drapeau: "🇫🇷" },
];

const CHAMP_CLASS =
  "w-full rounded-[14px] border border-line-strong bg-surface px-5 py-4 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-lg";

export default function StepInformations({ onNext, onBack, initialData }: StepInformationsProps) {
  const [form, setForm] = useState<InfoData>(() => ({
    prenom: initialData?.prenom || "",
    nom: initialData?.nom || "",
    titre: initialData?.titre || "",
    telephone: initialData?.telephone || "",
    indicatif: initialData?.indicatif || "+223",
    pays: initialData?.pays || "Mali",
    paysCode: initialData?.paysCode || "ML",
    ville: initialData?.ville || "",
    linkedin: initialData?.linkedin || "",
    facebook: initialData?.facebook || "",
    instagram: initialData?.instagram || "",
    tiktok: initialData?.tiktok || "",
  }));
  const [erreursLiens, setErreursLiens] = useState<Partial<Record<ReseauSocial, string>>>({});
  const [paysDisponibles, setPaysDisponibles] = useState<PaysOption[]>(PAYS_DE_SECOURS);
  const [paysTelephone, setPaysTelephone] = useState(initialData?.paysCode || "ML");
  const [villesDisponibles, setVillesDisponibles] = useState<VilleOption[]>([]);
  const [rechercheVilleOuverte, setRechercheVilleOuverte] = useState(false);
  const [rechercheVilleEnCours, setRechercheVilleEnCours] = useState(false);
  const [erreurRechercheVille, setErreurRechercheVille] = useState(false);
  const [villeActive, setVilleActive] = useState(-1);

  useEffect(() => {
    let actif = true;

    const chargerPays = async () => {
      try {
        const reponse = await fetch("/api/locations/countries");
        if (!reponse.ok) throw new Error("Impossible de charger les pays.");

        const donnees = (await reponse.json()) as { pays?: PaysOption[] };
        if (actif && donnees.pays?.length) setPaysDisponibles(donnees.pays);
      } catch {
        // La liste prioritaire reste utilisable. Une indisponibilité technique
        // ne doit pas interrompre l'inscription ni être exposée à l'utilisateur.
      }
    };

    void chargerPays();
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    const recherche = form.ville.trim();
    if (recherche.length < 2) {
      setVillesDisponibles([]);
      setRechercheVilleEnCours(false);
      setErreurRechercheVille(false);
      setVilleActive(-1);
      return;
    }

    let actif = true;
    const temporisateur = window.setTimeout(async () => {
      setRechercheVilleEnCours(true);
      setErreurRechercheVille(false);
      try {
        const parametres = new URLSearchParams({
          country: form.paysCode,
          q: recherche,
          limit: "60",
        });
        const reponse = await fetch(`/api/locations/cities?${parametres.toString()}`);
        if (!reponse.ok) throw new Error("Impossible de charger les villes.");

        const donnees = (await reponse.json()) as { villes?: VilleOption[] };
        if (!actif) return;
        setVillesDisponibles(donnees.villes || []);
        setVilleActive(-1);
      } catch {
        if (actif) {
          setVillesDisponibles([]);
          setErreurRechercheVille(true);
        }
      } finally {
        if (actif) setRechercheVilleEnCours(false);
      }
    }, 250);

    return () => {
      actif = false;
      window.clearTimeout(temporisateur);
    };
  }, [form.paysCode, form.ville]);

  const handleChange = (field: keyof InfoData, value: string) => {
    setForm((precedent) => ({ ...precedent, [field]: value }));
    if (field in erreursLiens) setErreursLiens((precedent) => ({ ...precedent, [field]: undefined }));
  };

  const handlePaysChange = (codePays: string) => {
    const pays = paysDisponibles.find((option) => option.code === codePays);
    if (!pays) return;

    setForm((precedent) => ({
      ...precedent,
      pays: pays.nom,
      paysCode: pays.code,
      ville: "",
    }));
    setVillesDisponibles([]);
    setRechercheVilleOuverte(false);
    setErreurRechercheVille(false);
    setVilleActive(-1);
  };

  const handleIndicatifChange = (codePays: string) => {
    const pays = paysDisponibles.find((option) => option.code === codePays);
    if (!pays) return;

    setPaysTelephone(codePays);
    handleChange("indicatif", `+${pays.indicatif}`);
  };

  const handleVilleChange = (ville: string) => {
    handleChange("ville", ville);
    setRechercheVilleOuverte(true);
    setVilleActive(-1);
  };

  const choisirVille = (ville: VilleOption) => {
    handleChange("ville", ville.nom);
    setRechercheVilleOuverte(false);
    setVilleActive(-1);
  };

  const handleVilleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setRechercheVilleOuverte(false);
      return;
    }

    if (!rechercheVilleOuverte || villesDisponibles.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setVilleActive((index) => Math.min(index + 1, villesDisponibles.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setVilleActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && villeActive >= 0) {
      event.preventDefault();
      choisirVille(villesDisponibles[villeActive]);
    }
  };

  const canContinue = Boolean(
    form.prenom.trim() && form.nom.trim() && form.paysCode && form.ville.trim(),
  );
  const nomAnnuaire = [form.prenom.trim(), form.nom.trim()].filter(Boolean).join(" ") || "Votre nom";
  const villeAnnuaire = form.ville.trim() || "Ville";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const erreurs: Partial<Record<ReseauSocial, string>> = {};
    for (const { cle, nom } of RESEAUX_SOCIAUX) {
      const message = erreurLienSocial(form[cle], nom);
      if (message) erreurs[cle] = message;
    }
    setErreursLiens(erreurs);
    const premiereErreur = RESEAUX_SOCIAUX.find(({ cle }) => erreurs[cle]);
    if (premiereErreur) { document.getElementById(`reseau-${premiereErreur.cle}`)?.focus(); return; }
    if (canContinue) onNext({ ...form, titre: (form.titre || "").trim(), ville: form.ville.trim(), ...normaliserReseauxSociaux(form) });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[22px] border border-line bg-surface p-6 shadow-sm sm:p-9 lg:p-12"
    >
      <h1 className="mb-3 font-display text-3xl font-bold text-ink sm:text-[36px]">
        Vos informations personnelles
      </h1>
      <p className="mb-9 max-w-[1120px] text-base leading-relaxed text-ink sm:text-lg">
        Ce qui vous identifie dans l&apos;annuaire et permet aux autres membres de vous retrouver.
        Les champs marqués d&apos;un astérisque sont obligatoires.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
        <div>
          <label htmlFor="prenom" className="mb-2 block text-base font-semibold text-ink">
            Prénom <span className="text-clay">*</span>
          </label>
          <input
            id="prenom"
            type="text"
            autoComplete="given-name"
            value={form.prenom}
            onChange={(event) => handleChange("prenom", event.target.value)}
            placeholder="Aïssata"
            className={CHAMP_CLASS}
          />
        </div>

        <div>
          <label htmlFor="nom" className="mb-2 block text-base font-semibold text-ink">
            Nom <span className="text-clay">*</span>
          </label>
          <input
            id="nom"
            type="text"
            autoComplete="family-name"
            value={form.nom}
            onChange={(event) => handleChange("nom", event.target.value)}
            placeholder="Maïga"
            className={CHAMP_CLASS}
          />
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="titre" className="mb-2 block text-base font-semibold text-ink">
          Titre personnalisé <span className="font-normal">· optionnel</span>
        </label>
        <input
          id="titre"
          type="text"
          maxLength={160}
          autoComplete="organization-title"
          value={form.titre || ""}
          onChange={(event) => handleChange("titre", event.target.value)}
          placeholder="Ex. Ingénieur logiciel | Passionné par l’innovation"
          aria-describedby="titre-aide"
          className={CHAMP_CLASS}
        />
        <p id="titre-aide" className="mt-2 text-sm text-ink sm:text-base">
          Affiché sous votre nom dans tout le réseau. Laissez ce champ vide : il suit automatiquement votre parcours,
          « Poste - Entreprise » ou « Étudiant(e) - Université » si vous étudiez, sinon « Membre du réseau ».
        </p>
      </div>

      <div className="mb-6">
        <label htmlFor="indicatif" className="mb-2 block text-base font-semibold text-ink">
          Numéro de téléphone <span className="font-normal">· optionnel</span>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[320px_1fr]">
          <select
            id="indicatif"
            value={paysTelephone}
            onChange={(event) => handleIndicatifChange(event.target.value)}
            className={CHAMP_CLASS}
          >
            {paysDisponibles.map((pays) => (
              <option key={pays.code} value={pays.code}>
                {pays.drapeau} {pays.nom} (+{pays.indicatif})
              </option>
            ))}
          </select>
          <input
            id="telephone"
            type="tel"
            autoComplete="tel-national"
            value={form.telephone}
            onChange={(event) => handleChange("telephone", event.target.value)}
            placeholder="70 00 00 00"
            aria-label="Numéro de téléphone"
            className={CHAMP_CLASS}
          />
        </div>
        <p className="mt-2 text-sm text-ink sm:text-base">
          Jamais affiché publiquement.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
        <div>
          <label htmlFor="pays" className="mb-2 block text-base font-semibold text-ink">
            Pays de résidence <span className="text-clay">*</span>
          </label>
          <select
            id="pays"
            value={form.paysCode}
            onChange={(event) => handlePaysChange(event.target.value)}
            className={CHAMP_CLASS}
          >
            {paysDisponibles.map((pays) => (
              <option key={pays.code} value={pays.code}>
                {pays.drapeau} {pays.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="ville" className="mb-2 block text-base font-semibold text-ink">
            Ville <span className="text-clay">*</span>
          </label>
          <input
            id="ville"
            type="text"
            autoComplete="off"
            value={form.ville}
            onChange={(event) => handleVilleChange(event.target.value)}
            onFocus={() => setRechercheVilleOuverte(true)}
            onBlur={() => window.setTimeout(() => setRechercheVilleOuverte(false), 150)}
            onKeyDown={handleVilleKeyDown}
            placeholder="Saisissez le nom de votre ville"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="resultats-villes"
            aria-expanded={rechercheVilleOuverte && form.ville.trim().length >= 2}
            className={CHAMP_CLASS}
          />

          {rechercheVilleOuverte
            && form.ville.trim().length >= 2
            && !rechercheVilleEnCours && (
              <div
                id="resultats-villes"
                role="listbox"
                aria-label={`Villes de ${form.pays}`}
                className="mt-2 max-h-60 overflow-y-auto rounded-[14px] border border-line-strong bg-white p-2 shadow-lg"
              >
                {erreurRechercheVille ? (
                  <p className="px-4 py-3 text-sm text-ink-muted" role="status">
                    La recherche est momentanément indisponible. Saisissez le nom complet de votre
                    ville pour continuer.
                  </p>
                ) : villesDisponibles.length > 0 ? (
                  villesDisponibles.map((ville, index) => (
                    <button
                      key={ville.id}
                      type="button"
                      role="option"
                      aria-selected={index === villeActive}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choisirVille(ville)}
                      onMouseEnter={() => setVilleActive(index)}
                      className={`flex w-full items-center justify-between gap-4 rounded-[10px] px-4 py-3 text-left text-sm transition-colors sm:text-base ${
                        index === villeActive
                          ? "bg-[#eaf1e9] text-brand"
                          : "text-ink hover:bg-surface-sunken"
                      }`}
                    >
                      <span className="font-semibold">{ville.nom}</span>
                      {ville.region && (
                        <span className="truncate text-xs text-ink-muted sm:text-sm">
                          {ville.region}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-ink-muted">
                    Aucune ville trouvée. Vérifiez l&apos;orthographe ou essayez un autre nom.
                  </p>
                )}
              </div>
            )}

          <p className="mt-2 text-xs text-ink-muted">
            Tapez au moins 2 lettres. Si votre ville n&apos;apparaît pas, saisissez son nom complet.
          </p>
        </div>
      </div>

      <fieldset className="mb-8 min-w-0 border-t border-line pt-6" aria-describedby="reseaux-sociaux-description">
        <legend className="px-1 text-lg font-semibold text-ink">Réseaux sociaux (facultatif)</legend>
        <p id="reseaux-sociaux-description" className="mb-5 text-sm leading-relaxed text-ink-muted">Ces liens seront visibles sur votre profil. Vous pouvez les modifier ou les retirer à tout moment.</p>
        <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2">
          {RESEAUX_SOCIAUX.map(({ cle, nom, exemple }) => <div key={cle} className="min-w-0">
            <label htmlFor={`reseau-${cle}`} className="mb-2 block text-base font-semibold text-ink">{nom}</label>
            <input id={`reseau-${cle}`} name={cle} type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={LONGUEUR_MAX_LIEN_SOCIAL} value={form[cle] || ""} onChange={(event) => handleChange(cle, event.target.value)} onBlur={() => { const message = erreurLienSocial(form[cle], nom); setErreursLiens((precedent) => ({ ...precedent, [cle]: message || undefined })); }} placeholder={exemple} aria-invalid={Boolean(erreursLiens[cle])} aria-describedby={erreursLiens[cle] ? `erreur-reseau-${cle}` : "reseaux-sociaux-description"} className={CHAMP_CLASS + " min-w-0"} />
            {erreursLiens[cle] && <p id={`erreur-reseau-${cle}`} className="mt-2 text-sm text-[#8a3e27]" role="alert">{erreursLiens[cle]}</p>}
          </div>)}
        </div>
      </fieldset>

      <div className="mb-9 rounded-[14px] bg-surface-sunken px-5 py-4 text-base text-ink sm:text-lg">
        Vous apparaîtrez comme{" "}
        <strong>{nomAnnuaire}{form.titre?.trim() ? ` · ${form.titre.trim()}` : ""} · {villeAnnuaire}, {form.pays}</strong>{" "}
        dans l&apos;annuaire.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[14px] border border-line-strong bg-surface px-8 py-4 text-base font-semibold text-ink transition-colors hover:bg-surface-sunken sm:w-[140px] sm:text-lg"
        >
          Retour
        </button>
        <button
          type="submit"
          disabled={!canContinue}
          className={`flex-1 rounded-full px-8 py-4 text-base font-semibold transition-colors sm:text-lg ${
            canContinue
              ? "bg-brand text-white hover:bg-brand-700"
              : "cursor-not-allowed bg-[#eee2d0] text-[#ad9d89]"
          }`}
        >
          Continuer
        </button>
      </div>

    </form>
  );
}

"use client";

import { useEffect, useState } from "react";

interface StepInformationsProps {
  onNext: (data: InfoData) => void;
  onBack: () => void;
  initialData?: InfoData;
}

export interface InfoData {
  prenom: string;
  nom: string;
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
  "w-full rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-5 py-4 text-base text-[#2e261f] outline-none transition focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20 sm:text-lg";

export default function StepInformations({ onNext, onBack, initialData }: StepInformationsProps) {
  const [form, setForm] = useState<InfoData>(() => ({
    prenom: initialData?.prenom || "",
    nom: initialData?.nom || "",
    telephone: initialData?.telephone || "",
    indicatif: initialData?.indicatif || "+223",
    pays: initialData?.pays || "Mali",
    paysCode: initialData?.paysCode || "ML",
    ville: initialData?.ville || "",
  }));
  const [paysDisponibles, setPaysDisponibles] = useState<PaysOption[]>(PAYS_DE_SECOURS);
  const [paysTelephone, setPaysTelephone] = useState(initialData?.paysCode || "ML");
  const [villesDisponibles, setVillesDisponibles] = useState<VilleOption[]>([]);
  const [rechercheVilleOuverte, setRechercheVilleOuverte] = useState(false);
  const [rechercheVilleEnCours, setRechercheVilleEnCours] = useState(false);
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
      setVilleActive(-1);
      return;
    }

    let actif = true;
    const temporisateur = window.setTimeout(async () => {
      setRechercheVilleEnCours(true);
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
    if (canContinue) onNext({ ...form, ville: form.ville.trim() });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[22px] border border-[#e4d2b3] bg-[#fffbf5] p-6 shadow-sm sm:p-9 lg:p-12"
    >
      <h1 className="mb-3 font-display text-3xl font-bold text-[#2e261f] sm:text-[36px]">
        Vos informations personnelles
      </h1>
      <p className="mb-9 max-w-[1120px] text-base leading-relaxed text-[#2e261f] sm:text-lg">
        Ce qui vous identifie dans l&apos;annuaire et permet aux autres membres de vous retrouver.
        Les champs marqués d&apos;un astérisque sont obligatoires.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
        <div>
          <label htmlFor="prenom" className="mb-2 block text-base font-semibold text-[#2e261f]">
            Prénom <span className="text-[#c65327]">*</span>
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
          <label htmlFor="nom" className="mb-2 block text-base font-semibold text-[#2e261f]">
            Nom <span className="text-[#c65327]">*</span>
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
        <label htmlFor="indicatif" className="mb-2 block text-base font-semibold text-[#2e261f]">
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
        <p className="mt-2 text-sm text-[#2e261f] sm:text-base">
          Jamais affiché publiquement.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
        <div>
          <label htmlFor="pays" className="mb-2 block text-base font-semibold text-[#2e261f]">
            Pays de résidence <span className="text-[#c65327]">*</span>
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
          <label htmlFor="ville" className="mb-2 block text-base font-semibold text-[#2e261f]">
            Ville <span className="text-[#c65327]">*</span>
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
                className="mt-2 max-h-60 overflow-y-auto rounded-[14px] border border-[#dfc9a8] bg-white p-2 shadow-lg"
              >
                {villesDisponibles.length > 0 ? (
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
                          ? "bg-[#eaf1e9] text-[#0d6738]"
                          : "text-[#2e261f] hover:bg-[#f6efe3]"
                      }`}
                    >
                      <span className="font-semibold">{ville.nom}</span>
                      {ville.region && (
                        <span className="truncate text-xs text-[#74685c] sm:text-sm">
                          {ville.region}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-[#74685c]">
                    Aucune ville trouvée. Vérifiez l&apos;orthographe ou essayez un autre nom.
                  </p>
                )}
              </div>
            )}

          <p className="mt-2 text-xs text-[#74685c]">
            Tapez au moins 2 lettres. Si votre ville n&apos;apparaît pas, saisissez son nom complet.
          </p>
        </div>
      </div>

      <div className="mb-9 rounded-[14px] bg-[#f6efe3] px-5 py-4 text-base text-[#2e261f] sm:text-lg">
        Vous apparaîtrez comme{" "}
        <strong>{nomAnnuaire} · {villeAnnuaire}, {form.pays}</strong>{" "}
        dans l&apos;annuaire.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[14px] border border-[#dfc9a8] bg-[#fffbf5] px-8 py-4 text-base font-semibold text-[#2e261f] transition-colors hover:bg-[#f6efe3] sm:w-[140px] sm:text-lg"
        >
          Retour
        </button>
        <button
          type="submit"
          disabled={!canContinue}
          className={`flex-1 rounded-full px-8 py-4 text-base font-semibold transition-colors sm:text-lg ${
            canContinue
              ? "bg-[#0d6738] text-white hover:bg-[#09572f]"
              : "cursor-not-allowed bg-[#eee2d0] text-[#ad9d89]"
          }`}
        >
          Continuer
        </button>
      </div>

    </form>
  );
}

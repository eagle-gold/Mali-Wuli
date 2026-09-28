"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import SearchCombobox, { type SearchOption } from "@/components/onboarding/SearchCombobox";
import { useCountries, type PaysOption } from "@/hooks/useCountries";

/**
 * Pays (liste déroulante) puis ville (recherche dans le catalogue du pays).
 * Les valeurs échangées restent les noms en clair attendus par le backend :
 * `pays` = nom français du pays (ex. « Mali »), `ville` = nom de la ville.
 * Une valeur existante absente des listes reste affichée et conservée.
 */

const PAYS_FREQUENTS = ["ML", "FR", "SN", "CI", "BF", "GN", "NE", "MR", "MA", "CM", "BE", "CA", "US"];

type Ville = { id: number; nom: string; region: string };

export type ClassesChampsPaysVille = {
  /** Classe du conteneur de chaque champ (label du pays, bloc de la ville). */
  champ?: string;
  /** Classe du libellé de la ville (le libellé du pays est le conteneur). */
  libelle?: string;
  /** Classe appliquée au select du pays et à la saisie de la ville. */
  controle?: string;
};

type Props = {
  idPrefixe: string;
  pays: string;
  ville: string;
  onChange: (valeur: { pays: string; ville: string }) => void;
  paysRequis?: boolean;
  villeRequise?: boolean;
  libellePays?: ReactNode;
  libelleVille?: string;
  classes?: ClassesChampsPaysVille;
  erreurPays?: ReactNode;
  erreurVille?: ReactNode;
  paysInvalide?: boolean;
  villeInvalide?: boolean;
  disabled?: boolean;
};

const normaliser = (valeur: string) =>
  valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").toLocaleLowerCase("fr").trim();

const nettoyer = (valeur: string) => valeur.replace(/\s+/g, " ").trim();

export function trouverPays(liste: PaysOption[], nom: string) {
  const cible = normaliser(nom);
  return cible ? liste.find((p) => normaliser(p.nom) === cible) : undefined;
}

export default function ChampsPaysVille({
  idPrefixe, pays, ville, onChange, paysRequis = false, villeRequise = false,
  libellePays = "Pays", libelleVille = "Ville", classes = {}, erreurPays, erreurVille,
  paysInvalide, villeInvalide, disabled = false,
}: Props) {
  const listePays = useCountries();
  const [saisie, setSaisie] = useState(ville);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState(false);

  const paysChoisi = trouverPays(listePays, pays);
  const codePays = paysChoisi?.code;

  const { frequents, tous } = useMemo(() => {
    const collator = new Intl.Collator("fr", { sensitivity: "base" });
    return {
      frequents: PAYS_FREQUENTS.flatMap((code) => listePays.filter((p) => p.code === code)),
      tous: [...listePays].sort((a, b) => collator.compare(a.nom, b.nom)),
    };
  }, [listePays]);
  // Une ancienne valeur absente de la liste (orthographe différente, pays
  // saisi librement) reste affichée et sélectionnée pour ne pas être perdue.
  const paysHorsListe = pays && !listePays.some((p) => p.nom === pays);

  // Synchronise la saisie avec une valeur fixée de l'extérieur (chargement
  // d'une fiche, réinitialisation du formulaire).
  useEffect(() => { if (ville) setSaisie(ville); }, [ville]);
  useEffect(() => { if (!ville) setSaisie(""); }, [pays]);

  useEffect(() => {
    if (!codePays || disabled) { setVilles([]); return; }
    const controleur = new AbortController();
    const minuterie = window.setTimeout(async () => {
      setChargement(true); setErreurRecherche(false);
      try {
        const parametres = new URLSearchParams({ country: codePays, limit: "100" });
        const recherche = saisie.trim();
        if (recherche) parametres.set("q", recherche); else parametres.set("all", "1");
        const reponse = await fetch(`/api/locations/cities?${parametres}`, { signal: controleur.signal });
        if (!reponse.ok) throw new Error("Villes indisponibles");
        const donnees = (await reponse.json()) as { villes?: Ville[] };
        setVilles(donnees.villes || []);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) { setVilles([]); setErreurRecherche(true); }
      } finally {
        if (!controleur.signal.aborted) setChargement(false);
      }
    }, 250);
    return () => { controleur.abort(); window.clearTimeout(minuterie); };
  }, [codePays, saisie, disabled]);

  const options: SearchOption[] = villes.map((v) => ({ id: String(v.id), label: v.nom, secondary: v.region }));
  const saisieNette = nettoyer(saisie);
  const correspondanceExacte = villes.some((v) => normaliser(v.nom) === normaliser(saisieNette));
  const proposerAutre = Boolean(codePays) && saisieNette.length >= 2 && saisieNette !== ville && !correspondanceExacte && !chargement;
  const villeNonValidee = Boolean(saisieNette) && saisieNette !== ville;

  const choisirPays = (nom: string) => {
    setSaisie(""); setVilles([]);
    onChange({ pays: nom, ville: "" });
  };

  const aideVille = !pays
    ? "Choisissez d’abord un pays."
    : !codePays
      ? "Choisissez un pays de la liste pour rechercher une ville."
      : erreurRecherche
        ? "La recherche des villes est momentanément indisponible."
        : villeNonValidee
          ? "Sélectionnez une ville dans la liste proposée."
          : undefined;

  return <>
    <label className={classes.champ} htmlFor={`${idPrefixe}-pays`}>
      {libellePays}
      <select
        id={`${idPrefixe}-pays`}
        className={classes.controle}
        value={pays}
        required={paysRequis}
        disabled={disabled}
        aria-invalid={paysInvalide || undefined}
        aria-describedby={paysInvalide ? `erreur-${idPrefixe}-pays` : undefined}
        onChange={(e) => choisirPays(e.target.value)}
      >
        <option value="">{listePays.length ? "Sélectionner un pays" : "Chargement des pays…"}</option>
        {paysHorsListe && <option value={pays}>{pays}</option>}
        {frequents.length > 0 && <optgroup label="Pays fréquents">{frequents.map((p) => <option key={`f-${p.code}`} value={p.nom}>{p.nom}</option>)}</optgroup>}
        {tous.length > 0 && <optgroup label="Tous les pays">{tous.map((p) => <option key={p.code} value={p.nom}>{p.nom}</option>)}</optgroup>}
      </select>
      {erreurPays}
    </label>
    <SearchCombobox
      id={`${idPrefixe}-ville`}
      label={libelleVille}
      value={saisie}
      placeholder={pays ? "Rechercher une ville" : "Choisissez d’abord un pays"}
      options={options}
      loading={chargement}
      disabled={disabled || !codePays}
      required={villeRequise}
      helperText={aideVille}
      emptyMessage="Aucune ville trouvée pour cette recherche."
      onChange={(texte) => {
        setSaisie(texte);
        // Seule une ville choisie (ou confirmée) est transmise au formulaire.
        if (ville) onChange({ pays, ville: "" });
      }}
      onSelect={(option) => { setSaisie(option.label); onChange({ pays, ville: option.label }); }}
      otherLabel={proposerAutre ? `Utiliser « ${saisieNette} » (ville absente de la liste)` : undefined}
      onOther={proposerAutre ? () => { setSaisie(saisieNette); onChange({ pays, ville: saisieNette }); } : undefined}
      className={classes.champ ?? "min-w-0"}
      labelClassName={classes.libelle ?? ""}
      inputClassName={classes.controle ?? ""}
      showIcon={false}
      invalid={villeInvalide}
      describedBy={villeInvalide ? `erreur-${idPrefixe}-ville` : undefined}
    >
      {erreurVille}
    </SearchCombobox>
  </>;
}

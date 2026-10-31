"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import ProposerAssociation from "@/components/associations/ProposerAssociation";
import type { AssociationApi, AssociationsListeResponseApi, AssociationsPersonnellesResponseApi } from "@/types/associations";

const BASE = "/onboarding/associations";
const bouton = "rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-[#735133] hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50";
const messageErreur = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Cette action n’a pas pu aboutir. Réessayez.";

export default function StepAssociations({ onBack, onNext, enregistrementEnCours = false, edition = false }: {
  onBack: () => void;
  onNext: () => void;
  enregistrementEnCours?: boolean;
  edition?: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [resultats, setResultats] = useState<AssociationsListeResponseApi | null>(null);
  const [affiliations, setAffiliations] = useState<AssociationApi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [chargementAffiliations, setChargementAffiliations] = useState(true);
  const [erreurRecherche, setErreurRecherche] = useState("");
  const [erreurAffiliations, setErreurAffiliations] = useState("");
  const [erreurAction, setErreurAction] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [propositionEnCours, setPropositionEnCours] = useState(false);
  const [annonce, setAnnonce] = useState("");
  const [essai, setEssai] = useState(0);

  const chargerAffiliations = useCallback(async () => {
    setChargementAffiliations(true);
    setErreurAffiliations("");
    try {
      const { data } = await api.get<AssociationsPersonnellesResponseApi>(`${BASE}/mes`);
      setAffiliations(data.associations);
    } catch (error) { setErreurAffiliations(messageErreur(error)); }
    finally { setChargementAffiliations(false); }
  }, []);

  useEffect(() => { void chargerAffiliations(); }, [chargerAffiliations]);
  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreurRecherche("");
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.get<AssociationsListeResponseApi>(BASE, { params: { q: recherche.trim(), page, limite: 12 } });
        if (actif) setResultats(data);
      } catch (error) { if (actif) setErreurRecherche(messageErreur(error)); }
      finally { if (actif) setChargement(false); }
    }, 250);
    return () => { actif = false; window.clearTimeout(timer); };
  }, [recherche, page, essai]);

  const parId = useMemo(() => new Map(affiliations.map((association) => [association.id, association])), [affiliations]);
  const enregistrer = async (association: AssociationApi, retirer = false) => {
    if (actionId) return;
    setActionId(association.id);
    setErreurAction("");
    setAnnonce("");
    try {
      const endpoint = `${BASE}/${encodeURIComponent(association.id)}/affiliation`;
      if (retirer) {
        await api.delete(endpoint);
        setAffiliations((liste) => liste.filter(({ id }) => id !== association.id));
        setAnnonce("Votre affiliation a été retirée.");
      } else {
        const { data } = await api.post<{ monAffiliation: AssociationApi["monAffiliation"] }>(endpoint, {});
        setAffiliations((liste) => [...liste.filter(({ id }) => id !== association.id), { ...association, monAffiliation: data.monAffiliation }]);
        setAnnonce("Votre demande est enregistrée. Elle apparaîtra sur votre profil après validation par le responsable.");
      }
    } catch (error) { setErreurAction(messageErreur(error)); }
    finally { setActionId(null); }
  };

  const actions = (association: AssociationApi) => {
    const statut = parId.get(association.id)?.monAffiliation?.statut;
    const active = statut === "EN_ATTENTE" || statut === "VERIFIE";
    return <div className="mt-4 flex flex-wrap items-center gap-3">
      {active ? <>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statut === "VERIFIE" ? "bg-[#e1f1e6] text-brand" : "bg-[#f8e4d7] text-[#9a441f]"}`}>
          {statut === "VERIFIE" ? "Affiliation validée" : "En attente du responsable"}
        </span>
        <button type="button" className={bouton} disabled={Boolean(actionId) || propositionEnCours || enregistrementEnCours} onClick={() => void enregistrer(association, true)}>
          {actionId === association.id ? "Enregistrement…" : statut === "VERIFIE" ? "Retirer mon affiliation" : "Annuler la demande"}
        </button>
      </> : <>
        {statut === "REFUSE" && <span className="text-sm text-[#9a441f]">Demande précédente refusée</span>}
        <button type="button" className={bouton + " border-brand text-brand"} disabled={Boolean(actionId) || propositionEnCours || chargementAffiliations || Boolean(erreurAffiliations) || enregistrementEnCours} onClick={() => void enregistrer(association)}>
          {actionId === association.id ? "Enregistrement…" : statut === "REFUSE" ? "Renouveler ma demande" : "Je suis membre de cette association"}
        </button>
      </>}
    </div>;
  };

  return <section className="mx-auto max-w-[1040px] space-y-6 text-ink">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-clay">Étape facultative</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">Vos associations</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-ink-muted">Retrouvez les associations dont vous êtes membre. Le responsable validera votre affiliation avant qu’elle soit visible sur votre profil. Vous pouvez continuer sans en ajouter.</p>
    </header>

    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7" aria-labelledby="mes-associations-inscription">
      <h2 id="mes-associations-inscription" className="titre-section">Mes affiliations et demandes</h2>
      {chargementAffiliations ? <p className="mt-4" role="status">Chargement de vos affiliations…</p> : erreurAffiliations ? <div className="mt-4"><p role="alert">{erreurAffiliations}</p><button type="button" className={bouton + " mt-3"} onClick={() => void chargerAffiliations()}>Réessayer</button></div> : affiliations.length ? <ul className="mt-4 divide-y divide-line-soft">
        {affiliations.map((association) => <li key={association.id} className="py-4 first:pt-0"><h3 className="titre-element break-words">{association.nom}</h3><p className="mt-1 text-sm text-ink-muted">{[association.ville, association.pays].filter(Boolean).join(" · ")}</p>{actions(association)}</li>)}
      </ul> : <p className="mt-4 text-ink-muted">Vous n’avez pas encore ajouté d’association.</p>}
    </section>

    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7" aria-labelledby="recherche-associations-inscription">
      <h2 id="recherche-associations-inscription" className="titre-section">Rechercher une association</h2>
      <label className="mt-4 block text-sm font-medium" htmlFor="association-inscription-q">Nom, ville ou vocation</label>
      <input id="association-inscription-q" type="search" maxLength={100} value={recherche} onChange={(event) => { setRecherche(event.target.value); setPage(1); }} placeholder="Ex. étudiants, culture, Bamako…" className="mt-2 w-full rounded-xl border border-line-strong bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand" />
      {chargement ? <p className="mt-5" role="status">Recherche en cours…</p> : erreurRecherche ? <div className="mt-5"><p role="alert">{erreurRecherche}</p><button type="button" className={bouton + " mt-3"} onClick={() => setEssai((value) => value + 1)}>Réessayer</button></div> : resultats?.associations.length ? <>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">{resultats.associations.map((association) => <li key={association.id} className="min-w-0 rounded-xl border border-line-soft bg-white p-4"><h3 className="titre-element break-words">{association.nom}</h3><p className="mt-1 text-sm text-ink-muted">{[association.ville, association.pays].filter(Boolean).join(" · ")}</p>{association.vocation && <p className="mt-2 break-words text-sm">{association.vocation}</p>}{actions(association)}</li>)}</ul>
        {resultats.totalPages > 1 && <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Pages des associations"><button type="button" className={bouton} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button><span className="text-sm">Page {page} sur {resultats.totalPages}</span><button type="button" className={bouton} disabled={page >= resultats.totalPages} onClick={() => setPage((value) => value + 1)}>Suivant</button></nav>}
      </> : <p className="mt-5 text-ink-muted">Aucune association ne correspond à votre recherche.</p>}
      <div className="mt-6"><ProposerAssociation apiBase={BASE} onBusyChange={setPropositionEnCours} /></div>
    </section>
    {erreurAction && <p role="alert" className="rounded-xl bg-[#fff1e9] p-4 text-[#8f3518]">{erreurAction}</p>}
    {annonce && <p role="status" className="rounded-xl bg-[#e7f3ec] p-4 text-brand">{annonce}</p>}
    <div className="flex flex-col gap-3 sm:flex-row">{!edition && <button type="button" className={bouton + " sm:w-1/3"} disabled={Boolean(actionId) || propositionEnCours || enregistrementEnCours} onClick={onBack}>‹ Revenir au mentorat</button>}<button type="button" onClick={onNext} disabled={Boolean(actionId) || propositionEnCours || enregistrementEnCours} className="flex-1 rounded-full bg-brand px-6 py-4 font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50">{enregistrementEnCours ? "Enregistrement…" : edition ? "Revenir à mon profil" : "Terminer mon inscription"}</button></div>
  </section>;
}

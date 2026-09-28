"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import api from "@/lib/api";
import { aPermission, type AutorisationsUtilisateur } from "@/lib/autorisations";
import type { AssociationApi, AssociationsPersonnellesResponseApi, ResponsableAssociationApi, SuggestionAssociationApi, SuggestionsAssociationsResponseApi } from "@/types/associations";

const input = "mt-2 min-w-0 w-full rounded-xl border border-[#dfc9a8] bg-white px-4 py-3 text-[#2e261f] outline-none focus:ring-2 focus:ring-[#0d6738]";
const bouton = "rounded-xl border border-[#dfc9a8] px-4 py-2.5 text-sm font-semibold text-[#735133] hover:bg-[#f6efe3] focus:outline-none focus:ring-2 focus:ring-[#0d6738] disabled:opacity-50";
const primaire = "rounded-xl bg-[#0d6738] px-5 py-3 font-semibold text-white hover:bg-[#09572f] focus:outline-none focus:ring-2 focus:ring-[#0d6738] focus:ring-offset-2 disabled:opacity-50";
const erreurDe = (error: unknown, repli = "Cette action n’a pas pu aboutir. Réessayez.") => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || repli;
const nomResponsable = (responsable: ResponsableAssociationApi) => [responsable.prenom, responsable.nom].filter(Boolean).join(" ") || "Membre";
const formulaireVide = { nom: "", description: "", pays: "", ville: "", vocation: "", dateCreation: "", site: "", emailContact: "" };

export default function AdminAssociationsPage() {
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [erreurAcces, setErreurAcces] = useState("");
  const [associations, setAssociations] = useState<AssociationApi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurListe, setErreurListe] = useState("");
  const [rechercheListe, setRechercheListe] = useState("");
  const [editionId, setEditionId] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState(formulaireVide);
  const [responsable, setResponsable] = useState<ResponsableAssociationApi | null>(null);
  const [rechercheResponsable, setRechercheResponsable] = useState("");
  const [responsables, setResponsables] = useState<ResponsableAssociationApi[]>([]);
  const [chargementResponsables, setChargementResponsables] = useState(false);
  const [erreurResponsables, setErreurResponsables] = useState("");
  const [essaiResponsables, setEssaiResponsables] = useState(0);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState("");
  const [annonce, setAnnonce] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionsAssociationsResponseApi | null>(null);
  const [pageSuggestions, setPageSuggestions] = useState(1);
  const [chargementSuggestions, setChargementSuggestions] = useState(true);
  const [erreurSuggestions, setErreurSuggestions] = useState("");
  const [actionSuggestion, setActionSuggestion] = useState<string | null>(null);
  const sectionFormulaire = useRef<HTMLElement>(null);

  const verifierAcces = useCallback(async () => {
    setAutorise(null);
    setErreurAcces("");
    try {
      const { data } = await api.get<AutorisationsUtilisateur>("/users/me");
      setAutorise(aPermission(data, "ASSOCIATIONS_GERER"));
    } catch (error) { setErreurAcces(erreurDe(error, "Impossible de vérifier votre accès.")); }
  }, []);
  useEffect(() => { void verifierAcces(); }, [verifierAcces]);

  const chargerAssociations = useCallback(async () => {
    setChargement(true);
    setErreurListe("");
    try {
      const { data } = await api.get<AssociationsPersonnellesResponseApi>("/associations/mes");
      setAssociations(data.associations);
    } catch (error) { setErreurListe(erreurDe(error)); }
    finally { setChargement(false); }
  }, []);
  useEffect(() => { if (autorise) void chargerAssociations(); }, [autorise, chargerAssociations]);

  const chargerSuggestions = useCallback(async () => {
    setChargementSuggestions(true);
    setErreurSuggestions("");
    try {
      const { data } = await api.get<SuggestionsAssociationsResponseApi>("/associations/suggestions", { params: { statut: "EN_ATTENTE", page: pageSuggestions, limite: 20 } });
      if (pageSuggestions > 1 && !data.suggestions.length) setPageSuggestions((page) => page - 1);
      else setSuggestions(data);
    } catch (error) { setErreurSuggestions(erreurDe(error)); }
    finally { setChargementSuggestions(false); }
  }, [pageSuggestions]);
  useEffect(() => { if (autorise) void chargerSuggestions(); }, [autorise, chargerSuggestions]);

  useEffect(() => {
    if (!autorise) return;
    let actif = true;
    setChargementResponsables(true);
    setErreurResponsables("");
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.get<{ responsables: ResponsableAssociationApi[] }>("/associations/responsables", { params: { q: rechercheResponsable.trim() } });
        if (actif) setResponsables(data.responsables);
      } catch (error) { if (actif) setErreurResponsables(erreurDe(error)); }
      finally { if (actif) setChargementResponsables(false); }
    }, 250);
    return () => { actif = false; window.clearTimeout(timer); };
  }, [autorise, rechercheResponsable, essaiResponsables]);

  const nouvellesDonnees = () => {
    setEditionId(null); setFormulaire(formulaireVide); setResponsable(null);
    setRechercheResponsable(""); setErreurFormulaire("");
  };
  const modifier = (association: AssociationApi) => {
    setEditionId(association.id);
    setFormulaire({ nom: association.nom, description: association.description || "", pays: association.pays, ville: association.ville || "", vocation: association.vocation || "", dateCreation: association.dateCreation?.slice(0, 10) || "", site: association.site || "", emailContact: association.emailContact || "" });
    setResponsable(association.responsable); setRechercheResponsable(""); setErreurFormulaire(""); setAnnonce("");
    sectionFormulaire.current?.scrollIntoView({ block: "start" });
  };
  const enregistrer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enregistrement) return;
    if (!responsable) { setErreurFormulaire("Choisissez le membre responsable de cette association."); return; }
    if (!formulaire.nom.trim() || !formulaire.pays.trim()) { setErreurFormulaire("Indiquez le nom et le pays de l’association."); return; }
    if (!editionId && (!formulaire.description.trim() || !formulaire.ville.trim() || !formulaire.vocation.trim())) {
      setErreurFormulaire("Indiquez la description, la ville et la vocation de l’association."); return;
    }
    setEnregistrement(true); setErreurFormulaire(""); setAnnonce("");
    const champs = Object.fromEntries(Object.entries(formulaire).map(([cle, valeur]) => [cle, valeur.trim()]));
    const payload = { ...champs, dateCreation: formulaire.dateCreation || null, responsableId: responsable.id };
    try {
      const { data } = editionId
        ? await api.patch<{ association: AssociationApi }>(`/associations/${encodeURIComponent(editionId)}`, payload)
        : await api.post<{ association: AssociationApi }>("/associations", payload);
      setAssociations((liste) => [data.association, ...liste.filter(({ id }) => id !== data.association.id)]);
      setEditionId(data.association.id); setResponsable(data.association.responsable);
      setAnnonce("La fiche est enregistrée. Vous pouvez ajouter ses photos depuis la fiche de l’association.");
    } catch (error) { setErreurFormulaire(erreurDe(error)); }
    finally { setEnregistrement(false); }
  };
  const preparerSuggestion = (suggestion: SuggestionAssociationApi) => {
    nouvellesDonnees();
    setFormulaire({ ...formulaireVide, nom: suggestion.nom, pays: suggestion.pays, ville: suggestion.ville || "", vocation: suggestion.vocation || "" });
    setAnnonce("Proposition reprise dans le formulaire. Complétez la fiche et choisissez son responsable avant d’enregistrer.");
    sectionFormulaire.current?.scrollIntoView({ block: "start" });
  };
  const traiterSuggestion = async (id: string, statut: "TRAITEE" | "REFUSEE") => {
    if (actionSuggestion) return;
    setActionSuggestion(id); setErreurSuggestions("");
    try {
      await api.patch(`/associations/suggestions/${encodeURIComponent(id)}`, { statut });
      await chargerSuggestions();
      setAnnonce(statut === "TRAITEE" ? "La proposition est marquée comme traitée." : "La proposition a été refusée.");
    } catch (error) { setErreurSuggestions(erreurDe(error)); }
    finally { setActionSuggestion(null); }
  };
  const listeFiltree = useMemo(() => {
    const q = rechercheListe.trim().toLocaleLowerCase("fr");
    return associations.filter((association) => [association.nom, association.pays, association.ville, association.vocation].filter(Boolean).join(" ").toLocaleLowerCase("fr").includes(q));
  }, [associations, rechercheListe]);

  if (autorise !== true) return <main className="min-h-screen bg-[var(--color-page)] px-4 py-10"><div className="mx-auto max-w-xl rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-7"><h1 className="font-display text-2xl">Administration des associations</h1>{erreurAcces ? <><p className="mt-4" role="alert">{erreurAcces}</p><button type="button" className={bouton + " mt-4"} onClick={() => void verifierAcces()}>Réessayer</button></> : <p className="mt-4" role={autorise === null ? "status" : undefined}>{autorise === null ? "Vérification de votre accès…" : "Cet espace est réservé aux personnes chargées des associations."}</p>}<Link href="/dashboard" className="mt-5 block font-semibold text-[#0d6738]">Retour au réseau</Link></div></main>;

  return <main className="min-h-screen bg-[var(--color-page)] px-4 py-8 text-[#2e261f] sm:px-6 lg:px-10"><div className="mx-auto min-w-0 max-w-[1180px] space-y-7 [overflow-wrap:anywhere]">
    <header><Link href="/admin" className="text-sm font-semibold text-[#735133] hover:underline">‹ Administration</Link><h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Associations</h1><p className="mt-3 text-[#695c4b]">Créez les fiches et désignez le membre chargé de valider les affiliations.</p></header>
    {annonce && <p role="status" className="rounded-xl border border-[#bad7c6] bg-[#e7f3ec] p-4 text-[#0d6738]">{annonce}</p>}

    <section ref={sectionFormulaire} className="scroll-mt-6 rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 sm:p-7" aria-labelledby="formulaire-association-titre">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="formulaire-association-titre" className="text-xl font-semibold">{editionId ? "Modifier l’association" : "Créer une association"}</h2>{editionId && <button type="button" disabled={enregistrement} className={bouton} onClick={nouvellesDonnees}>Nouvelle association</button>}</div>
      <form onSubmit={(event) => void enregistrer(event)}>
        <fieldset disabled={enregistrement} className="space-y-5 disabled:opacity-70">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">Nom de l’association <span aria-hidden="true">*</span><input required minLength={2} maxLength={191} className={input} value={formulaire.nom} onChange={(e) => setFormulaire((f) => ({ ...f, nom: e.target.value }))} /></label>
            <label className="block text-sm font-medium">Vocation <span aria-hidden="true">*</span><input required={!editionId} maxLength={191} className={input} placeholder="Culture, entraide, éducation…" value={formulaire.vocation} onChange={(e) => setFormulaire((f) => ({ ...f, vocation: e.target.value }))} /></label>
            <label className="block text-sm font-medium">Pays <span aria-hidden="true">*</span><input required minLength={2} maxLength={191} className={input} value={formulaire.pays} onChange={(e) => setFormulaire((f) => ({ ...f, pays: e.target.value }))} /></label>
            <label className="block text-sm font-medium">Ville <span aria-hidden="true">*</span><input required={!editionId} maxLength={191} className={input} value={formulaire.ville} onChange={(e) => setFormulaire((f) => ({ ...f, ville: e.target.value }))} /></label>
            <label className="block text-sm font-medium">Date de création de l’association<input type="date" className={input} value={formulaire.dateCreation} onChange={(e) => setFormulaire((f) => ({ ...f, dateCreation: e.target.value }))} /></label>
            <label className="block text-sm font-medium">Site internet <span className="font-normal text-[#695c4b]">(facultatif)</span><input type="url" maxLength={2000} placeholder="https://…" className={input} value={formulaire.site} onChange={(e) => setFormulaire((f) => ({ ...f, site: e.target.value }))} /></label>
            <label className="block text-sm font-medium sm:col-span-2">E-mail de contact public <span className="font-normal text-[#695c4b]">(facultatif)</span><input type="email" maxLength={191} className={input} value={formulaire.emailContact} onChange={(e) => setFormulaire((f) => ({ ...f, emailContact: e.target.value }))} /></label>
          </div>
          <label className="block text-sm font-medium">Description <span aria-hidden="true">*</span><textarea required={!editionId} rows={4} maxLength={10000} className={input + " resize-y"} value={formulaire.description} onChange={(e) => setFormulaire((f) => ({ ...f, description: e.target.value }))} /></label>
          <div className="rounded-xl border border-[#e4d2b3] bg-[#f6efe3] p-4"><h3 className="font-semibold">Responsable de l’association <span aria-hidden="true">*</span></h3><p className="mt-1 text-sm text-[#695c4b]">Choisissez un membre validé. Il pourra gérer les photos et les demandes d’affiliation.</p>
            {responsable && <p className="mt-3 rounded-lg bg-[#e7f3ec] p-3 text-sm text-[#0d6738]">Responsable choisi : <strong>{nomResponsable(responsable)}</strong></p>}
            <label htmlFor="responsable-association-q" className="mt-4 block text-sm font-medium">Rechercher un membre</label><input id="responsable-association-q" type="search" maxLength={100} className={input} value={rechercheResponsable} onChange={(e) => setRechercheResponsable(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Nom, prénom…" />
            {chargementResponsables ? <p className="mt-3 text-sm" role="status">Recherche des membres…</p> : erreurResponsables ? <div className="mt-3"><p role="alert" className="text-sm text-[#9a441f]">{erreurResponsables}</p><button type="button" className={bouton + " mt-2"} onClick={() => setEssaiResponsables((value) => value + 1)}>Réessayer</button></div> : responsables.length ? <ul className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{responsables.map((membre) => <li key={membre.id}><button type="button" aria-pressed={responsable?.id === membre.id} onClick={() => setResponsable(membre)} className={`w-full rounded-lg border p-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6738] ${responsable?.id === membre.id ? "border-[#0d6738] bg-[#e7f3ec]" : "border-[#dfc9a8] bg-white hover:border-[#0d6738]"}`}><strong className="block break-words">{nomResponsable(membre)}</strong><span className="mt-1 block text-[#695c4b]">{[membre.titre, membre.ville, membre.pays].filter(Boolean).join(" · ")}</span></button></li>)}</ul> : <p className="mt-3 text-sm text-[#695c4b]">Aucun membre validé ne correspond à cette recherche.</p>}
          </div>
          {erreurFormulaire && <p role="alert" className="rounded-xl bg-[#fff1e9] p-4 text-[#8f3518]">{erreurFormulaire}</p>}
          <div className="flex flex-wrap items-center gap-3"><button type="submit" className={primaire}>{enregistrement ? "Enregistrement…" : editionId ? "Enregistrer les modifications" : "Créer l’association"}</button>{editionId && <Link href={`/associations/${encodeURIComponent(editionId)}`} className={bouton}>Ouvrir la fiche et gérer les photos</Link>}</div>
        </fieldset>
      </form>
    </section>

    <section className="rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 sm:p-7" aria-labelledby="associations-admin-liste"><h2 id="associations-admin-liste" className="text-xl font-semibold">Associations enregistrées</h2><label className="mt-4 block text-sm font-medium" htmlFor="associations-admin-q">Rechercher dans les fiches</label><input id="associations-admin-q" type="search" className={input} value={rechercheListe} onChange={(e) => setRechercheListe(e.target.value)} />
      {chargement ? <p className="mt-5" role="status">Chargement des associations…</p> : erreurListe ? <div className="mt-5"><p role="alert">{erreurListe}</p><button type="button" className={bouton + " mt-3"} onClick={() => void chargerAssociations()}>Réessayer</button></div> : listeFiltree.length ? <ul className="mt-5 grid gap-4 sm:grid-cols-2">{listeFiltree.map((association) => <li key={association.id} className="min-w-0 rounded-xl border border-[#ead8bd] bg-white p-4"><h3 className="break-words font-semibold">{association.nom}</h3><p className="mt-1 text-sm text-[#695c4b]">{[association.ville, association.pays].filter(Boolean).join(" · ")}</p><p className="mt-2 text-sm">Responsable : {association.responsable ? nomResponsable(association.responsable) : "À désigner"}</p>{association.valide === false && <p className="mt-1 text-sm text-[#9a441f]">Fiche non publiée</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={enregistrement} className={bouton} onClick={() => modifier(association)}>Modifier</button><Link className={bouton} href={`/associations/${encodeURIComponent(association.id)}`}>Voir la fiche</Link></div></li>)}</ul> : <p className="mt-5 text-[#695c4b]">Aucune association à afficher.</p>}
    </section>

    <section className="rounded-2xl border border-[#e4d2b3] bg-[#fffbf5] p-5 sm:p-7" aria-labelledby="associations-admin-suggestions"><h2 id="associations-admin-suggestions" className="text-xl font-semibold">Propositions d’ajout en attente</h2><p className="mt-2 text-sm text-[#695c4b]">Une proposition ne crée pas de fiche automatiquement. Préparez la fiche, puis marquez la proposition comme traitée.</p>
      {erreurSuggestions && <p role="alert" className="mt-4 rounded-xl bg-[#fff1e9] p-4 text-[#8f3518]">{erreurSuggestions}</p>}
      {chargementSuggestions ? <p className="mt-5" role="status">Chargement des propositions…</p> : erreurSuggestions && !suggestions ? <button type="button" className={bouton + " mt-4"} onClick={() => void chargerSuggestions()}>Réessayer</button> : suggestions?.suggestions.length ? <ul className="mt-5 space-y-4">{suggestions.suggestions.map((suggestion) => <li key={suggestion.id} className="rounded-xl border border-[#ead8bd] bg-white p-4"><h3 className="break-words font-semibold">{suggestion.nom}</h3><p className="mt-1 text-sm text-[#695c4b]">{[suggestion.ville, suggestion.pays, suggestion.vocation].filter(Boolean).join(" · ")}</p>{suggestion.message && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{suggestion.message}</p>}{suggestion.proposeur && <p className="mt-2 text-xs text-[#695c4b]">Proposé par {[suggestion.proposeur.prenom, suggestion.proposeur.nom].filter(Boolean).join(" ")}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" className={bouton} disabled={enregistrement} onClick={() => preparerSuggestion(suggestion)}>Préparer la fiche</button><button type="button" className={bouton + " text-[#0d6738]"} disabled={Boolean(actionSuggestion)} onClick={() => void traiterSuggestion(suggestion.id, "TRAITEE")}>Marquer comme traitée</button><button type="button" className={bouton} disabled={Boolean(actionSuggestion)} onClick={() => void traiterSuggestion(suggestion.id, "REFUSEE")}>Refuser</button></div></li>)}</ul> : <p className="mt-5 text-[#695c4b]">Aucune proposition en attente.</p>}
      {suggestions && suggestions.totalPages > 1 && <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Pages des propositions"><button type="button" className={bouton} disabled={pageSuggestions <= 1 || chargementSuggestions || Boolean(actionSuggestion)} onClick={() => setPageSuggestions((p) => p - 1)}>Précédent</button><span className="text-sm">Page {pageSuggestions} sur {suggestions.totalPages}</span><button type="button" className={bouton} disabled={pageSuggestions >= suggestions.totalPages || chargementSuggestions || Boolean(actionSuggestion)} onClick={() => setPageSuggestions((p) => p + 1)}>Suivant</button></nav>}
    </section>
  </div></main>;
}

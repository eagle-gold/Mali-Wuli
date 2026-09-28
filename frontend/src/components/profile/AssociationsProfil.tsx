"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { urlMediaBackend } from "@/lib/media";
import type { AssociationApi, AssociationsPersonnellesResponseApi } from "@/types/associations";
import type { StatutInscriptionProfilApi } from "@/types/profile";

export default function AssociationsProfil({ statutCompte, peutAdministrerAssociations = false }: {
  statutCompte?: StatutInscriptionProfilApi;
  peutAdministrerAssociations?: boolean;
}) {
  const [associations, setAssociations] = useState<AssociationApi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const { data } = await api.get<AssociationsPersonnellesResponseApi>("/onboarding/associations/mes");
      setAssociations(data.associations);
    } catch { setErreur("Vos affiliations ne sont pas disponibles pour le moment."); }
    finally { setChargement(false); }
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  const [associationsGerees, setAssociationsGerees] = useState<AssociationApi[]>([]);
  const [chargementGestion, setChargementGestion] = useState(statutCompte === "VALIDE");
  const [erreurGestion, setErreurGestion] = useState("");
  const [essaiGestion, setEssaiGestion] = useState(0);
  useEffect(() => {
    if (statutCompte !== "VALIDE") {
      setAssociationsGerees([]);
      setErreurGestion("");
      setChargementGestion(false);
      return;
    }
    let actif = true;
    setChargementGestion(true);
    setErreurGestion("");
    const chargerGestion = async () => {
      try {
        const { data } = await api.get<AssociationsPersonnellesResponseApi>("/associations/mes");
        if (actif) setAssociationsGerees(data.associations);
      } catch {
        if (actif) setErreurGestion("Les associations que vous gérez ne sont pas disponibles pour le moment.");
      } finally {
        if (actif) setChargementGestion(false);
      }
    };
    void chargerGestion();
    return () => { actif = false; };
  }, [statutCompte, essaiGestion]);

  const validees = associations.filter((association) => association.monAffiliation?.statut === "VERIFIE" && association.valide !== false);
  const enAttente = associations.filter((association) => association.monAffiliation?.statut === "EN_ATTENTE" && association.valide !== false);
  const autres = associations.filter((association) => association.valide !== false && ["REFUSE", "DECLARE"].includes(association.monAffiliation?.statut || ""));
  const nonPubliees = associations.filter((association) => association.valide === false);
  const ligne = (association: AssociationApi, lien: boolean) => <li key={association.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-[#eae3d4] p-4">
    {association.photo && <img src={urlMediaBackend(association.photo) || undefined} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />}
    <div className="min-w-0"><h3 className="break-words font-semibold">{lien ? <Link href={`/associations/${encodeURIComponent(association.id)}`} className="text-[#2a5b37] hover:underline focus:outline-none focus:ring-2 focus:ring-[#2a5b37]">{association.nom}</Link> : association.nom}</h3><p className="mt-1 text-sm text-[#695c4b]">{[association.ville, association.pays].filter(Boolean).join(" · ")}</p>{association.monAffiliation?.statut === "REFUSE" && <p className="mt-2 text-sm text-[#9a441f]">Demande refusée</p>}{association.monAffiliation?.statut === "DECLARE" && <p className="mt-2 text-sm text-[#695c4b]">Affiliation à confirmer auprès du responsable</p>}</div>
  </li>;

  return <section className="rounded-[18px] border border-[#eae3d4] bg-[#fdfaf4] p-5 shadow-sm sm:p-8" aria-labelledby="associations-profil-titre">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h2 id="associations-profil-titre" className="titre-section">Mes associations</h2>
      <div className="flex flex-wrap gap-2">
        {peutAdministrerAssociations && <Link href="/admin/associations" className="rounded-xl border border-[#cee0d4] bg-[#f2f7f3] px-4 py-2 text-sm font-semibold text-[#2a5b37] hover:bg-[#e5efe8] focus:outline-none focus:ring-2 focus:ring-[#2a5b37]">Administration</Link>}
        <Link href="/onboarding?etape=associations" className="rounded-xl border border-[#cee0d4] bg-[#f2f7f3] px-4 py-2 text-sm font-semibold text-[#2a5b37] hover:bg-[#e5efe8] focus:outline-none focus:ring-2 focus:ring-[#2a5b37]">Gérer mes affiliations</Link>
      </div>
    </div>
    {statutCompte === "VALIDE" && !chargementGestion && (erreurGestion || associationsGerees.length > 0) && <section className="mb-7 border-b border-[#eae3d4] pb-7" aria-labelledby="associations-gerees-titre">
      <h3 id="associations-gerees-titre" className="titre-element">Associations que je gère</h3>
      {erreurGestion ? <div className="mt-3"><p role="alert" className="text-sm text-[#9a441f]">{erreurGestion}</p><button type="button" onClick={() => setEssaiGestion((value) => value + 1)} className="mt-3 rounded-lg border border-[#dfd1bd] px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-[#2a5b37]">Réessayer</button></div> : <ul className="mt-4 grid gap-3 sm:grid-cols-2">{associationsGerees.map((association) => <li key={association.id} className="min-w-0 rounded-xl border border-[#eae3d4] p-4">
        <h4 className="break-words font-semibold">{association.nom}</h4><p className="mt-1 text-sm text-[#695c4b]">{[association.ville, association.pays].filter(Boolean).join(" · ")}</p>
        {typeof association.nbMembres === "number" && <p className="mt-2 text-sm text-[#695c4b]">{association.nbMembres} membre{association.nbMembres !== 1 ? "s" : ""}</p>}
        {association.valide === false && <p className="mt-2 text-sm text-[#9a441f]">Fiche non publiée</p>}
        {(association.valide !== false || peutAdministrerAssociations) && <Link href={`/associations/${encodeURIComponent(association.id)}`} className="mt-3 inline-block rounded-lg border border-[#cee0d4] px-3 py-2 text-sm font-semibold text-[#2a5b37] hover:bg-[#e5efe8] focus:outline-none focus:ring-2 focus:ring-[#2a5b37]">Gérer les demandes et les photos</Link>}
      </li>)}</ul>}
    </section>}
    {chargement ? <p role="status" className="text-[#695c4b]">Chargement des associations…</p> : erreur ? <div><p role="alert" className="text-[#9a441f]">{erreur}</p><button type="button" onClick={() => void charger()} className="mt-3 rounded-lg border border-[#dfd1bd] px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-[#2a5b37]">Réessayer</button></div> : <>
      {validees.length ? <><h3 className="mb-3 titre-element">Affiliations validées</h3><ul className="grid gap-3 sm:grid-cols-2">{validees.map((association) => ligne(association, true))}</ul></> : <p className="rounded-xl bg-[#f4eee1] p-4 text-sm text-[#695c4b]">Aucune affiliation validée pour le moment.</p>}
      {enAttente.length > 0 && <div className="mt-6"><h3 className="titre-element">En attente du responsable</h3><p className="mb-3 mt-1 text-sm text-[#695c4b]">Ces demandes sont visibles uniquement par vous. Elles apparaîtront sur votre profil public après validation.</p><ul className="grid gap-3 sm:grid-cols-2">{enAttente.map((association) => ligne(association, false))}</ul></div>}
      {autres.length > 0 && <div className="mt-6"><h3 className="mb-3 titre-element">Autres demandes — visibles uniquement par vous</h3><ul className="grid gap-3 sm:grid-cols-2">{autres.map((association) => ligne(association, false))}</ul></div>}
      {nonPubliees.length > 0 && <div className="mt-6"><h3 className="titre-element">Associations non publiées</h3><p className="mb-3 mt-1 text-sm text-[#695c4b]">Ces affiliations restent visibles uniquement par vous. Elles ne sont pas affichées sur votre profil public tant que la fiche n’est pas publiée.</p><ul className="grid gap-3 sm:grid-cols-2">{nonPubliees.map((association) => ligne(association, false))}</ul></div>}
    </>}
  </section>;
}

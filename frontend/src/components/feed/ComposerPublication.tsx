"use client";

import { Globe2, ImageIcon, LoaderCircle, Plus, Search, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import api from "@/lib/api";
import { erreurImagePublication } from "@/lib/publication-image";
import type { PublicationApi, PublicationIntention } from "@/types/api";

export const THEMATIQUES = [
  "Santé & Télémédecine",
  "Éducation & Orientation",
  "Emploi & Carrière",
  "Bourses & Études",
  "Numérique & IA",
  "Énergie & Solaire",
  "Entrepreneuriat",
  "Agriculture & Agro",
  "Diaspora & Retour",
] as const;

const AUTRE = "__autre__";
const LONGUEUR_MAX = 1200;

type Props = {
  prenom?: string | null;
  nom?: string | null;
  initiales: string;
  photo?: string | null;
  /** Appelé avec la publication créée par le serveur. */
  onPublie: (publication: PublicationApi) => void;
};

type ReponseCreation = PublicationApi | { publication: PublicationApi };

const DELAI_ENVOI_MS = 45_000;

function messageErreur(erreur: unknown) {
  if ((erreur as { code?: string })?.code === "ECONNABORTED") {
    return "Le serveur met trop de temps à répondre. Vérifiez votre connexion puis réessayez : votre texte est conservé.";
  }
  const donnees = (erreur as { response?: { data?: { message?: unknown } } })?.response?.data;
  return typeof donnees?.message === "string" && donnees.message
    ? donnees.message
    : "La publication n’a pas pu être envoyée. Réessayez.";
}

function PastilleAvatar({ initiales, photo, taille }: { initiales: string; photo?: string | null; taille: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: taille, height: taille }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#efe3d0] font-bold text-[#6f5237]"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : initiales}
    </span>
  );
}

/** Carte « Commencer un post » façon LinkedIn, avec fenêtre de rédaction. */
export default function ComposerPublication({ prenom, nom, initiales, photo, onPublie }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [intention, setIntention] = useState<PublicationIntention | null>(null);
  const [choixThematique, setChoixThematique] = useState("");
  const [thematiqueLibre, setThematiqueLibre] = useState("");
  const [texte, setTexte] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [selecteurAuto, setSelecteurAuto] = useState(false);

  const idBase = useId();
  const idConsigne = `${idBase}-consigne`;
  const idCompteur = `${idBase}-compteur`;
  const dialogue = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLElement | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);
  const boutonPhoto = useRef<HTMLButtonElement>(null);
  const fermerRef = useRef<() => void>(() => {});

  const thematique = choixThematique === AUTRE ? thematiqueLibre.trim() : choixThematique;
  const nomComplet = [prenom, nom].filter(Boolean).join(" ") || "Membre Mali Wuli";
  const peutPublier = Boolean(intention && thematique.length >= 2 && (texte.trim() || fichier)) && !envoi;
  const consigne = !intention
    ? "Choisissez « Je cherche » ou « Je propose »."
    : thematique.length < 2
      ? "Choisissez une thématique."
      : !(texte.trim() || fichier)
        ? "Écrivez un texte ou ajoutez une photo."
        : "";

  // Aperçu local de la photo, libéré dès qu’elle change ou que le composant disparaît.
  useEffect(() => {
    if (!fichier) { setApercu(null); return; }
    const url = URL.createObjectURL(fichier);
    setApercu(url);
    return () => URL.revokeObjectURL(url);
  }, [fichier]);

  const reinitialiser = useCallback(() => {
    setIntention(null);
    setChoixThematique("");
    setThematiqueLibre("");
    setTexte("");
    setFichier(null);
    setErreur("");
  }, []);

  const ouvrir = (cible: HTMLElement, options: { intention?: PublicationIntention; photo?: boolean } = {}) => {
    declencheur.current = cible;
    if (options.intention) setIntention(options.intention);
    setErreur("");
    setSelecteurAuto(Boolean(options.photo));
    setOuvert(true);
  };

  // Le brouillon est conservé à la fermeture : on le retrouve à la réouverture.
  const fermer = useCallback(() => {
    if (envoi) return;
    setOuvert(false);
    window.setTimeout(() => declencheur.current?.focus(), 0);
  }, [envoi]);
  fermerRef.current = fermer;

  useEffect(() => {
    if (!ouvert) return;
    const defilementPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = defilementPrecedent; };
  }, [ouvert]);

  useEffect(() => {
    if (ouvert && selecteurAuto) {
      setSelecteurAuto(false);
      champFichier.current?.click();
    }
  }, [ouvert, selecteurAuto]);

  useEffect(() => {
    if (!ouvert) return;
    const surClavier = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        fermerRef.current();
        return;
      }
      const fenetre = dialogue.current;
      if (event.key !== "Tab" || !fenetre) return;
      const focalisables = Array.from(
        fenetre.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]):not([type="file"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focalisables.length) { event.preventDefault(); fenetre.focus(); return; }
      const premier = focalisables[0];
      const dernier = focalisables[focalisables.length - 1];
      const actif = document.activeElement;
      if (!fenetre.contains(actif) || actif === fenetre) {
        event.preventDefault();
        (event.shiftKey ? dernier : premier).focus();
      } else if (event.shiftKey && actif === premier) { event.preventDefault(); dernier.focus(); }
      else if (!event.shiftKey && actif === dernier) { event.preventDefault(); premier.focus(); }
    };
    document.addEventListener("keydown", surClavier);
    return () => document.removeEventListener("keydown", surClavier);
  }, [ouvert]);

  const retirerPhoto = () => {
    setFichier(null);
    window.setTimeout(() => boutonPhoto.current?.focus(), 0);
  };

  const choisirFichier = (event: ChangeEvent<HTMLInputElement>) => {
    const choisi = event.target.files?.[0];
    event.target.value = "";
    if (!choisi) return;
    const probleme = erreurImagePublication(choisi);
    if (probleme) { setErreur(probleme); return; }
    setErreur("");
    setFichier(choisi);
  };

  const publier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!peutPublier || !intention) return;
    setEnvoi(true);
    setErreur("");
    try {
      const contenu = texte.trim();
      let reponse: { data: ReponseCreation };
      if (fichier) {
        const formulaire = new FormData();
        formulaire.append("intention", intention);
        formulaire.append("thematique", thematique);
        formulaire.append("contenu", contenu);
        formulaire.append("photo", fichier);
        reponse = await api.post<ReponseCreation>("/publications", formulaire, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: DELAI_ENVOI_MS,
        });
      } else {
        reponse = await api.post<ReponseCreation>("/publications", { contenu, intention, thematique }, { timeout: DELAI_ENVOI_MS });
      }
      const publication = "publication" in reponse.data ? reponse.data.publication : reponse.data;
      onPublie(publication);
      reinitialiser();
      setOuvert(false);
      window.setTimeout(() => declencheur.current?.focus(), 0);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };

  const actionClasse =
    "flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-1 text-[13px] font-bold text-[#56493e] transition hover:bg-[#f5ecdf] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d6738] sm:gap-2 sm:px-2 sm:text-[15px]";

  return (
    <>
      <section aria-label="Créer une publication" className="rounded-2xl border border-[#eadcc7] bg-[#fffaf4] px-3 pb-1.5 pt-3 sm:px-4 sm:pt-4">
        <div className="flex items-center gap-3">
          <PastilleAvatar initiales={initiales} photo={photo} taille={48} />
          <button
            type="button"
            onClick={(event) => ouvrir(event.currentTarget)}
            className="flex min-h-12 min-w-0 flex-1 items-center rounded-full border border-[#cdb99f] bg-[#fffdf9] px-5 text-left text-[15px] font-semibold text-[#6e5b49] transition hover:bg-[#f5ecdf] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d6738] sm:text-base"
          >
            <span className="truncate">Commencer un post</span>
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-1">
          <button type="button" className={actionClasse} onClick={(event) => ouvrir(event.currentTarget, { intention: "DEMANDE" })}>
            <Search aria-hidden="true" size={22} className="text-[#d49a00]" />
            Je cherche
          </button>
          <button type="button" className={actionClasse} onClick={(event) => ouvrir(event.currentTarget, { photo: true })}>
            <ImageIcon aria-hidden="true" size={22} className="text-[#2f7ec2]" />
            Photo
          </button>
          <button type="button" className={actionClasse} onClick={(event) => ouvrir(event.currentTarget, { intention: "OFFRE" })}>
            <Plus aria-hidden="true" size={22} className="text-[#0d6738]" />
            Je propose
          </button>
        </div>
      </section>

      {ouvert && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) fermer(); }}
        >
          <div
            ref={dialogue}
            role="dialog"
            aria-modal="true"
            aria-label="Créer une publication"
            tabIndex={-1}
            className="flex max-h-[92dvh] outline-none w-full max-w-[600px] flex-col overflow-hidden rounded-t-2xl bg-[#fffdf9] shadow-2xl sm:rounded-2xl"
          >
            <form onSubmit={publier} className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-start gap-3 px-5 pb-2 pt-4">
                <PastilleAvatar initiales={initiales} photo={photo} taille={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold leading-tight text-[#292119]">{nomComplet}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[#806f5e]">
                    <Globe2 aria-hidden="true" size={14} />
                    Visible par tous les membres
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fermer}
                  disabled={envoi}
                  aria-label="Fermer"
                  className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6e5b49] hover:bg-[#f5ecdf] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d6738] disabled:opacity-40"
                >
                  <X aria-hidden="true" size={22} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
                <fieldset disabled={envoi} className="m-0 min-w-0 border-0 p-0">
                <legend className="sr-only">Contenu de la publication</legend>
                <div role="group" aria-label="Type de publication" className="grid grid-cols-2 gap-2">
                  {([
                    { valeur: "DEMANDE", libelle: "Je cherche", Icone: Search, actif: "border-[#d49a00] bg-[#fff1bf] text-[#3c2d1f]" },
                    { valeur: "OFFRE", libelle: "Je propose", Icone: Plus, actif: "border-[#0d6738] bg-[#e1f0e7] text-[#0d6738]" },
                  ] as const).map(({ valeur, libelle, Icone, actif }) => (
                    <button
                      key={valeur}
                      type="button"
                      aria-pressed={intention === valeur}
                      onClick={() => setIntention(valeur)}
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d6738] ${
                        intention === valeur ? actif : "border-[#e5d4bc] bg-white text-[#56493e] hover:bg-[#f8f1e6]"
                      }`}
                    >
                      <Icone aria-hidden="true" size={18} />
                      {libelle}
                    </button>
                  ))}
                </div>

                <label htmlFor="composer-thematique" className="sr-only">Thématique</label>
                <select
                  id="composer-thematique"
                  value={choixThematique}
                  onChange={(event) => setChoixThematique(event.target.value)}
                  className="mt-3 min-h-11 w-full rounded-xl border border-[#dfcdb4] bg-white px-3 text-sm font-semibold text-[#2f261e] outline-none focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
                >
                  <option value="" disabled>Choisir une thématique…</option>
                  {THEMATIQUES.map((option) => <option key={option} value={option}>{option}</option>)}
                  <option value={AUTRE}>Autre thématique…</option>
                </select>
                {choixThematique === AUTRE && (
                  <>
                    <label htmlFor="composer-thematique-libre" className="sr-only">Votre thématique</label>
                    <input
                      id="composer-thematique-libre"
                      value={thematiqueLibre}
                      onChange={(event) => setThematiqueLibre(event.target.value)}
                      maxLength={80}
                      placeholder="Votre thématique"
                      className="mt-2 min-h-11 w-full rounded-xl border border-[#dfcdb4] bg-white px-3 text-sm text-[#2f261e] outline-none placeholder:text-[#75695d] focus:border-[#0d6738] focus:ring-2 focus:ring-[#0d6738]/20"
                    />
                  </>
                )}

                <label htmlFor="composer-texte" className="sr-only">Contenu de la publication</label>
                <textarea
                  id="composer-texte"
                  value={texte}
                  onChange={(event) => setTexte(event.target.value)}
                  maxLength={LONGUEUR_MAX}
                  rows={5}
                  aria-describedby={idCompteur}
                  autoFocus
                  placeholder={
                    intention === "DEMANDE"
                      ? "Que cherchez-vous ? Précisez le besoin, pour qui et d’ici quand."
                      : intention === "OFFRE"
                        ? "Que proposez-vous ? Précisez pour qui, sous quelle forme et vos disponibilités."
                        : "De quoi voulez-vous parler ?"
                  }
                  className="mt-3 block min-h-28 w-full resize-none bg-transparent text-base leading-7 text-[#2f261e] outline-none placeholder:text-[#75695d]"
                />
                <p id={idCompteur} className="text-right text-xs text-[#6e5b49]">{texte.length}/{LONGUEUR_MAX} caractères</p>

                {apercu && (
                  <div className="relative mt-2 overflow-hidden rounded-xl border border-[#eadcc7] bg-[#f0e7da]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={apercu} alt="Aperçu de la photo à publier" className="max-h-72 w-full object-contain" />
                    <button
                      type="button"
                      onClick={retirerPhoto}
                      aria-label="Retirer la photo"
                      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <X aria-hidden="true" size={18} />
                    </button>
                  </div>
                )}

                </fieldset>

                {erreur && <p role="alert" className="mt-3 text-sm font-medium text-[#9b3e24]">{erreur}</p>}
                {envoi && <p role="status" className="sr-only">Publication en cours…</p>}
              </div>

              {consigne && !envoi && <p id={idConsigne} className="px-5 pb-2 text-xs text-[#6e5b49]">{consigne}</p>}
              <div className="flex items-center justify-between gap-3 border-t border-[#eadcc7] px-5 py-3">
                <input
                  ref={champFichier}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={choisirFichier}
                />
                <button
                  ref={boutonPhoto}
                  type="button"
                  onClick={() => champFichier.current?.click()}
                  disabled={envoi}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-[#56493e] hover:bg-[#f5ecdf] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d6738] disabled:opacity-50"
                >
                  <ImageIcon aria-hidden="true" size={22} className="text-[#2f7ec2]" />
                  {fichier ? "Changer la photo" : "Ajouter une photo"}
                </button>
                <button
                  type="submit"
                  disabled={!peutPublier}
                  aria-describedby={consigne && !envoi ? idConsigne : undefined}
                  className="inline-flex min-h-11 min-w-28 items-center justify-center gap-2 rounded-full bg-[#0d6738] px-6 text-sm font-bold text-white transition hover:bg-[#09572f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d6738] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#ded2bc] disabled:text-[#a59784]"
                >
                  {envoi ? <><LoaderCircle aria-hidden="true" size={16} className="animate-spin" />Publication…</> : "Publier"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

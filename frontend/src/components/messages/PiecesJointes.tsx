"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, File as FichierIcone, ImageOff, Presentation, X } from "lucide-react";
import api from "@/lib/api";
import { extensionDe, familleFichier, formaterTaille } from "@/lib/messagerie";
import type { PieceJointeApi } from "@/types/api";

/*
 * Les pièces jointes sont privées : elles se chargent avec la session du
 * membre (en-tête Authorization), puis s'affichent via une URL locale (blob).
 * Une petite mémoire évite de recharger une image déjà vue.
 */
const urlsChargees = new Map<string, Promise<string>>();

function chargerPiece(id: string) {
  let promesse = urlsChargees.get(id);
  if (!promesse) {
    promesse = api.get<Blob>(`/messages/pieces-jointes/${id}`, { responseType: "blob" })
      .then(({ data }) => URL.createObjectURL(data));
    promesse.catch(() => urlsChargees.delete(id));
    urlsChargees.set(id, promesse);
  }
  return promesse;
}

async function telecharger(piece: PieceJointeApi) {
  const url = await chargerPiece(piece.id);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = piece.nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
}

function useUrlPiece(id: string) {
  const [etat, setEtat] = useState<{ url?: string; erreur?: boolean }>({});
  useEffect(() => {
    let actif = true;
    chargerPiece(id).then((url) => { if (actif) setEtat({ url }); }).catch(() => { if (actif) setEtat({ erreur: true }); });
    return () => { actif = false; };
  }, [id]);
  return etat;
}

function ImagePiece({ piece, seule, deMoi }: { piece: PieceJointeApi; seule: boolean; deMoi: boolean }) {
  const { url, erreur } = useUrlPiece(piece.id);
  const visionneuse = useRef<HTMLDialogElement>(null);
  // Image seule : largeur stable (même une petite image reste lisible) ; plusieurs : vignettes carrées.
  const dimensions = seule ? "h-auto max-h-[320px] w-[min(260px,70vw)]" : "h-36 w-36 sm:h-40 sm:w-40";
  if (erreur) {
    return (
      <span className={`flex ${seule ? "h-40 w-64" : "h-36 w-36"} flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong bg-surface-sunken text-center text-xs text-ink-muted`}>
        <ImageOff size={20} aria-hidden="true" />Image indisponible
      </span>
    );
  }
  if (!url) return <span aria-label={`Chargement de l’image ${piece.nom}`} role="img" className={`block animate-pulse rounded-2xl bg-line-soft ${seule ? "h-48 w-64" : "h-36 w-36 sm:h-40 sm:w-40"}`} />;
  return (
    <>
      <button
        type="button"
        onClick={() => visionneuse.current?.showModal()}
        aria-label={`Agrandir l’image ${piece.nom}`}
        className={`group relative block overflow-hidden rounded-2xl bg-surface-sunken shadow-card ring-1 ring-line-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${deMoi ? "ml-auto" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={piece.nom} className={`${dimensions} object-cover transition duration-300 group-hover:scale-[1.02]`} />
      </button>
      <dialog
        ref={visionneuse}
        aria-label={piece.nom}
        onClick={(event) => { if (event.target === event.currentTarget) visionneuse.current?.close(); }}
        className="m-auto w-[min(94vw,960px)] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-bark-900/85 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-3 pb-3 text-white">
          <p className="min-w-0 truncate text-sm font-medium">{piece.nom}</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => void telecharger(piece)} aria-label="Télécharger l’image" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              <Download size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => visionneuse.current?.close()} aria-label="Fermer" autoFocus className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={piece.nom} className="mx-auto max-h-[80dvh] w-auto min-w-[min(100%,360px)] max-w-full rounded-xl bg-black/20 object-contain shadow-overlay [image-rendering:auto]" />
      </dialog>
    </>
  );
}

const ICONES = {
  pdf: { Icone: FileText, classes: "bg-danger/10 text-danger" },
  texte: { Icone: FileText, classes: "bg-[#2f6fb3]/10 text-[#2f6fb3]" },
  tableur: { Icone: FileSpreadsheet, classes: "bg-brand-50 text-brand" },
  presentation: { Icone: Presentation, classes: "bg-clay/10 text-clay" },
  image: { Icone: FichierIcone, classes: "bg-surface-sunken text-ink-soft" },
  autre: { Icone: FichierIcone, classes: "bg-surface-sunken text-ink-soft" },
} as const;

function FichierPiece({ piece, deMoi }: { piece: PieceJointeApi; deMoi: boolean }) {
  const [etat, setEtat] = useState<"repos" | "chargement" | "erreur">("repos");
  const { Icone, classes } = ICONES[familleFichier(piece.nom)];
  const lancer = async () => {
    setEtat("chargement");
    try { await telecharger(piece); setEtat("repos"); } catch { setEtat("erreur"); }
  };
  return (
    <button
      type="button"
      onClick={() => void lancer()}
      aria-label={`Télécharger ${piece.nom}, ${formaterTaille(piece.taille)}`}
      className={`group flex w-[min(300px,72vw)] items-center gap-3 rounded-2xl border bg-surface-raised p-3 text-left shadow-card transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
        deMoi ? "border-brand/25 hover:border-brand/50" : "border-line-soft hover:border-line"
      }`}
    >
      <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${classes}`}>
        <Icone size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{piece.nom}</span>
        <span className={`block text-xs ${etat === "erreur" ? "text-danger" : "text-ink-muted"}`}>
          {etat === "erreur" ? "Téléchargement impossible, réessayez" : `${extensionDe(piece.nom).slice(1).toUpperCase() || "Fichier"} · ${formaterTaille(piece.taille)}`}
        </span>
      </span>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition group-hover:bg-surface-sunken group-hover:text-brand">
        {etat === "chargement" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Download size={18} />}
      </span>
    </button>
  );
}

/** Pièces jointes d'un message : images en grille, puis fichiers en cartes. */
export default function PiecesJointes({ pieces, deMoi }: { pieces: PieceJointeApi[]; deMoi: boolean }) {
  const images = pieces.filter((piece) => piece.estImage);
  const fichiers = pieces.filter((piece) => !piece.estImage);
  return (
    <div className={`flex flex-col gap-2 ${deMoi ? "items-end" : "items-start"}`}>
      {images.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${deMoi ? "justify-end" : "justify-start"}`}>
          {images.map((piece) => <ImagePiece key={piece.id} piece={piece} seule={images.length === 1} deMoi={deMoi} />)}
        </div>
      )}
      {fichiers.map((piece) => <FichierPiece key={piece.id} piece={piece} deMoi={deMoi} />)}
    </div>
  );
}

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ArrowUp, FileText, Paperclip, X } from "lucide-react";
import { ACCEPT_FICHIERS, formaterTaille, trierFichiers } from "@/lib/messagerie";

export type FichierEnAttente = { id: string; fichier: File; apercu?: string };
export type ZoneSaisieHandle = { focus: () => void; ajouterFichiers: (fichiers: File[]) => void };

type Props = {
  nomInterlocuteur: string;
  envoiEnCours: boolean;
  progression: number | null;
  erreur: string;
  onEnvoyer: (contenu: string, fichiers: File[]) => Promise<boolean>;
  onSaisie: () => void;
};

const HAUTEUR_MIN = 24;
const HAUTEUR_MAX = 160;

/**
 * Zone de saisie : texte extensible, pièces jointes (bouton, glisser-déposer,
 * collage d'image) avec aperçus retirables, envoi par Entrée.
 */
const ZoneSaisie = forwardRef<ZoneSaisieHandle, Props>(function ZoneSaisie(
  { nomInterlocuteur, envoiEnCours, progression, erreur, onEnvoyer, onSaisie },
  ref,
) {
  const [contenu, setContenu] = useState("");
  const [fichiers, setFichiers] = useState<FichierEnAttente[]>([]);
  const [refus, setRefus] = useState<string[]>([]);
  const champ = useRef<HTMLTextAreaElement>(null);
  const selecteur = useRef<HTMLInputElement>(null);
  const fichiersRef = useRef(fichiers);
  fichiersRef.current = fichiers;

  // Libère les aperçus d'images à la fermeture du composant.
  useEffect(() => () => fichiersRef.current.forEach(({ apercu }) => apercu && URL.revokeObjectURL(apercu)), []);

  const ajusterHauteur = () => {
    const element = champ.current;
    if (!element) return;
    element.style.height = `${HAUTEUR_MIN}px`;
    element.style.height = `${Math.min(element.scrollHeight, HAUTEUR_MAX)}px`;
  };

  const ajouterFichiers = (liste: File[]) => {
    if (!liste.length) return;
    const { acceptes, refus: nouveauxRefus } = trierFichiers(fichiersRef.current.length, liste);
    setRefus(nouveauxRefus);
    const ajouts = acceptes.map((index) => {
      const fichier = liste[index];
      return {
        id: `${Date.now()}-${index}-${fichier.name}`,
        fichier,
        apercu: fichier.type.startsWith("image/") ? URL.createObjectURL(fichier) : undefined,
      };
    });
    if (ajouts.length) setFichiers((precedents) => [...precedents, ...ajouts]);
  };

  useImperativeHandle(ref, () => ({ focus: () => champ.current?.focus(), ajouterFichiers }));

  const retirer = (id: string) => {
    setFichiers((precedents) => {
      const retire = precedents.find((fichier) => fichier.id === id);
      if (retire?.apercu) URL.revokeObjectURL(retire.apercu);
      return precedents.filter((fichier) => fichier.id !== id);
    });
    setRefus([]);
    champ.current?.focus();
  };

  const peutEnvoyer = (contenu.trim().length > 0 || fichiers.length > 0) && !envoiEnCours;

  const envoyer = async () => {
    if (!peutEnvoyer) return;
    const reussi = await onEnvoyer(contenu.trim(), fichiers.map(({ fichier }) => fichier));
    if (!reussi) return;
    fichiers.forEach(({ apercu }) => apercu && URL.revokeObjectURL(apercu));
    setFichiers([]);
    setRefus([]);
    setContenu("");
    window.requestAnimationFrame(() => { ajusterHauteur(); champ.current?.focus(); });
  };

  const clavier = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void envoyer();
    }
  };

  const coller = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.files).filter((fichier) => fichier.type.startsWith("image/"));
    if (!images.length) return;
    event.preventDefault();
    ajouterFichiers(images.map((image, index) => new File([image], image.name && image.name !== "image.png" ? image.name : `capture-${Date.now()}-${index + 1}.png`, { type: image.type })));
  };

  const messages = [...refus, ...(erreur ? [erreur] : [])];

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); void envoyer(); }}
      className="shrink-0 border-t border-line-soft bg-surface-raised/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6 sm:pb-5 sm:pt-4"
    >
      {messages.length > 0 && (
        <div role="alert" className="mx-auto mb-2 max-w-3xl rounded-xl bg-danger/[0.07] px-3.5 py-2 text-sm font-medium text-danger">
          {messages.map((texte) => <p key={texte}>{texte}</p>)}
        </div>
      )}
      <div className="mx-auto max-w-3xl rounded-[26px] border border-line-strong bg-surface shadow-[inset_0_1px_2px_rgb(var(--mw-ink)/0.04)] transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
        {fichiers.length > 0 && (
          <ul aria-label="Pièces jointes à envoyer" className="flex gap-2 overflow-x-auto px-3 pt-3">
            {fichiers.map(({ id, fichier, apercu }) => (
              <li key={id} className="relative shrink-0">
                {apercu ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apercu} alt={fichier.name} className="h-16 w-16 rounded-xl object-cover ring-1 ring-line-soft" />
                ) : (
                  <span className="flex h-16 w-44 items-center gap-2.5 rounded-xl bg-surface-sunken px-3 ring-1 ring-line-soft">
                    <FileText size={20} aria-hidden="true" className="shrink-0 text-brand" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-ink">{fichier.name}</span>
                      <span className="block text-[11px] text-ink-muted">{formaterTaille(fichier.size)}</span>
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => retirer(id)}
                  disabled={envoiEnCours}
                  aria-label={`Retirer ${fichier.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow-card ring-2 ring-surface transition hover:bg-danger focus:outline-none focus-visible:ring-brand disabled:opacity-50"
                >
                  <X size={13} strokeWidth={3} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-1.5 p-1.5 sm:gap-2 sm:p-2">
          <input
            ref={selecteur}
            type="file"
            name="fichiers"
            multiple
            accept={ACCEPT_FICHIERS}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => { ajouterFichiers(Array.from(event.target.files || [])); event.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => selecteur.current?.click()}
            disabled={envoiEnCours}
            aria-label="Joindre des images ou des fichiers"
            title="Joindre des images ou des fichiers"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-sunken hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
          >
            <Paperclip size={20} aria-hidden="true" />
          </button>
          <label className="min-w-0 flex-1 self-center py-2">
            <span className="sr-only">Écrire un message à {nomInterlocuteur}</span>
            <textarea
              ref={champ}
              name="message"
              rows={1}
              value={contenu}
              maxLength={4000}
              onChange={(event) => { setContenu(event.target.value); onSaisie(); ajusterHauteur(); }}
              onKeyDown={clavier}
              onPaste={coller}
              placeholder="Écrire un message…"
              style={{ height: HAUTEUR_MIN }}
              className="block w-full resize-none bg-transparent text-[15px] leading-6 text-ink outline-none placeholder:text-ink-muted/70 sm:text-base"
            />
          </label>
          <button
            type="submit"
            disabled={!peutEnvoyer}
            aria-label={envoiEnCours ? "Envoi en cours" : "Envoyer"}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              peutEnvoyer ? "bg-brand text-white shadow-card hover:bg-brand-700 active:scale-95" : envoiEnCours ? "bg-brand/80 text-white" : "bg-surface-sunken text-ink-muted/60"
            }`}
          >
            {envoiEnCours ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowUp size={19} strokeWidth={2.5} aria-hidden="true" />}
          </button>
        </div>
        {progression !== null && (
          <div className="px-4 pb-2.5" aria-live="polite">
            <div className="h-1 overflow-hidden rounded-full bg-line-soft">
              <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${progression}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">Envoi des fichiers… {progression} %</p>
          </div>
        )}
      </div>
      <p className="mx-auto mt-1.5 hidden max-w-3xl px-4 text-[11px] text-ink-muted sm:block">
        <kbd className="font-sans font-semibold">Entrée</kbd> pour envoyer · <kbd className="font-sans font-semibold">Maj + Entrée</kbd> pour aller à la ligne · images et fichiers jusqu’à 10 Mo
      </p>
    </form>
  );
});

export default ZoneSaisie;

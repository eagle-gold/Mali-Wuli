"use client";

import { AlertCircle, LoaderCircle, RefreshCw, X } from "lucide-react";
import type { ReactNode } from "react";

export function Chargement({ texte = "Chargement…" }: { texte?: string }) {
  return (
    <div
      className="card flex items-center justify-center gap-2 py-10 text-sm text-terre-300"
      role="status"
    >
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      {texte}
    </div>
  );
}

export function ErreurChargement({
  message,
  reessayer,
}: {
  message: string;
  reessayer: () => void;
}) {
  return (
    <div
      className="card flex flex-col items-center gap-3 py-8 text-center"
      role="alert"
    >
      <AlertCircle className="h-7 w-7 text-laterite" aria-hidden="true" />
      <p className="text-sm text-terre">{message}</p>
      <button
        type="button"
        onClick={reessayer}
        className="btn-primary inline-flex items-center gap-2 text-sm"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Réessayer
      </button>
    </div>
  );
}

export function EtatVide({ children }: { children: ReactNode }) {
  return (
    <div className="card py-8 text-center text-sm italic text-terre-300">
      {children}
    </div>
  );
}

export function Modal({
  titre,
  fermer,
  children,
}: {
  titre: string;
  fermer: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && fermer()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-modal-communaute"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-sable-100 bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2
            id="titre-modal-communaute"
            className="text-xl font-bold text-terre"
          >
            {titre}
          </h2>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            className="rounded-full p-2 text-terre-300 hover:bg-sable-50 hover:text-terre"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function MessageAction({
  message,
  erreur = false,
}: {
  message: string;
  erreur?: boolean;
}) {
  return (
    <p
      role={erreur ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${erreur ? "bg-red-50 text-red-800" : "bg-vert-50 text-vert"}`}
    >
      {message}
    </p>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { AlertTriangle, ChevronRight, LogOut, Pencil, ShieldCheck, Trash2, X } from "lucide-react";
import { Alerte, ChampTexte } from "@/components/auth/Champs";
import { useSessionMembre } from "@/components/auth/SessionMembreContext";
import { classesBouton } from "@/components/ui/classes";
import { fermerSocket } from "@/hooks/useSocket";
import api from "@/lib/api";
import { terminerSession } from "@/lib/session";

const DONNEES_SUPPRIMEES = [
  "Votre profil, vos formations, expériences et créneaux de mentorat",
  "Vos publications, commentaires et réactions",
  "Vos conversations privées et vos messages",
  "Vos offres, candidatures, événements organisés et photos",
  "Vos affiliations aux associations et vos mises en relation",
];

function Section({ titre, description, children, danger = false }: { titre: string; description?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section aria-labelledby={`section-${titre}`} className={`rounded-3xl border bg-surface p-6 shadow-card sm:p-8 ${danger ? "border-danger/25" : "border-line-soft"}`}>
      <h2 id={`section-${titre}`} className={`font-display text-xl font-bold ${danger ? "text-danger" : "text-ink"}`}>{titre}</h2>
      {description && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function ParametresPage() {
  const router = useRouter();
  const session = useSessionMembre();
  const email = (session?.compte.email || session?.compte.user?.email || "").trim();

  const [confirmerTous, setConfirmerTous] = useState(false);
  const [deconnexionTous, setDeconnexionTous] = useState(false);
  const [erreurTous, setErreurTous] = useState("");

  const dialogue = useRef<HTMLDialogElement>(null);
  const [saisie, setSaisie] = useState("");
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState("");
  const confirmationOk = Boolean(email) && saisie.trim().toLowerCase() === email.toLowerCase();

  useEffect(() => {
    const element = dialogue.current;
    if (!element) return;
    const fermer = () => { setSaisie(""); setErreurSuppression(""); };
    element.addEventListener("close", fermer);
    return () => element.removeEventListener("close", fermer);
  }, []);

  const quitterLocalement = () => {
    fermerSocket();
    terminerSession();
    localStorage.removeItem("mali_wuli_registration_token");
  };

  const deconnecterTous = async () => {
    setDeconnexionTous(true);
    setErreurTous("");
    try {
      await api.post("/auth/logout-all");
      quitterLocalement();
      router.replace("/login");
    } catch {
      setErreurTous("La déconnexion n’a pas pu aboutir. Vérifiez votre connexion puis réessayez.");
      setDeconnexionTous(false);
    }
  };

  const supprimer = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmationOk || suppression) return;
    setSuppression(true);
    setErreurSuppression("");
    try {
      await api.delete("/users/me", { data: { confirmation: saisie.trim() } });
      quitterLocalement();
      router.replace("/compte-supprime");
    } catch (err) {
      const message = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setErreurSuppression(message || "La suppression n’a pas pu aboutir. Aucune donnée n’a été supprimée ; réessayez plus tard.");
      setSuppression(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Paramètres et confidentialité</h1>
      <p className="mt-2 text-[15px] text-ink-muted">Gérez votre compte, vos sessions et vos données personnelles.</p>

      <div className="mt-8 space-y-6">
        <Section titre="Votre compte">
          <dl className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-raised px-4 py-3.5">
              <dt className="text-sm font-semibold text-ink">Adresse e-mail</dt>
              <dd className="min-w-0 truncate text-sm text-ink-muted">{email || "—"}</dd>
            </div>
          </dl>
          <Link href="/onboarding?etape=informations" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-surface-raised px-4 py-3.5 text-sm font-semibold text-ink transition hover:border-line hover:bg-surface-sunken focus-anneau">
            <span className="flex items-center gap-3"><Pencil size={17} aria-hidden="true" className="text-brand" />Modifier mes informations</span>
            <ChevronRight size={18} aria-hidden="true" className="text-ink-muted" />
          </Link>
        </Section>

        <Section titre="Sécurité" description="Vous avez perdu un téléphone ou utilisé un ordinateur partagé ? Fermez toutes vos sessions ouvertes, y compris celle-ci.">
          {erreurTous && <Alerte>{erreurTous}</Alerte>}
          {confirmerTous ? (
            <div role="group" aria-label="Confirmer la déconnexion de tous les appareils" className="rounded-2xl bg-surface-sunken p-4">
              <p className="text-sm font-medium text-ink">Vous devrez vous reconnecter sur chacun de vos appareils.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => void deconnecterTous()} disabled={deconnexionTous} aria-busy={deconnexionTous} className={classesBouton()}>
                  <LogOut size={16} aria-hidden="true" />{deconnexionTous ? "Déconnexion…" : "Tout déconnecter"}
                </button>
                <button type="button" onClick={() => setConfirmerTous(false)} disabled={deconnexionTous} className={classesBouton({ variante: "secondaire" })}>Annuler</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmerTous(true)} className={classesBouton({ variante: "secondaire" })}>
              <ShieldCheck size={16} aria-hidden="true" />Se déconnecter de tous les appareils
            </button>
          )}
        </Section>

        <Section titre="Supprimer mon compte" danger description="La suppression est définitive et immédiate. Elle ne peut pas être annulée.">
          <ul className="space-y-2 text-sm text-ink-soft">
            {DONNEES_SUPPRIMEES.map((ligne) => (
              <li key={ligne} className="flex items-start gap-2.5">
                <Trash2 size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-danger/70" />{ligne}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => dialogue.current?.showModal()} className={classesBouton({ variante: "danger", className: "mt-6" })}>
            Supprimer mon compte…
          </button>
        </Section>
      </div>

      <dialog
        ref={dialogue}
        aria-labelledby="titre-suppression"
        aria-describedby="description-suppression"
        className="w-[min(100vw-2rem,30rem)] rounded-3xl border border-line-soft bg-surface-raised p-0 text-ink shadow-overlay backdrop:bg-bark-900/60 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={supprimer} className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <AlertTriangle size={24} />
            </span>
            <button type="button" onClick={() => dialogue.current?.close()} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-sunken hover:text-ink focus-anneau">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <h2 id="titre-suppression" className="mt-5 font-display text-2xl font-bold text-ink">Supprimer définitivement votre compte&nbsp;?</h2>
          <p id="description-suppression" className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            Toutes vos données seront effacées immédiatement, sans retour possible. Pour confirmer, saisissez l’adresse e-mail de votre compte.
          </p>
          {erreurSuppression && <div className="mt-5"><Alerte>{erreurSuppression}</Alerte></div>}
          <div className="mt-6">
            <ChampTexte
              label="Adresse e-mail du compte"
              autoFocus
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={email}
              value={saisie}
              onChange={(event) => { setSaisie(event.target.value); setErreurSuppression(""); }}
            />
          </div>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogue.current?.close()} disabled={suppression} className={classesBouton({ variante: "secondaire" })}>Annuler</button>
            <button type="submit" disabled={!confirmationOk || suppression} aria-busy={suppression} className={classesBouton({ variante: "danger" })}>
              {suppression ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

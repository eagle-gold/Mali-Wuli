"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MessageCircle, UsersRound } from "lucide-react";
import { useState } from "react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { urlMediaBackend } from "@/lib/media";
import styles from "./Directory.module.css";

export function AvatarAnnuaire({ nom, photo, grand = false, carre = false }: { nom: string; photo?: string | null; grand?: boolean; carre?: boolean }) {
  const url = urlMediaBackend(photo);
  const lettres = nom.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((partie) => partie[0]).join("").toUpperCase();
  return <span className={`${styles.avatar} ${grand ? styles.avatarLarge : ""}`} style={carre ? { borderRadius: 18 } : undefined}>{url ? <img src={url} alt="" /> : lettres || "MW"}</span>;
}

export function PaginationAnnuaire({ page, totalPages, changer, libelle = "Pagination de l’annuaire", chargement = false }: { page: number; totalPages: number; changer: (page: number) => void; libelle?: string; chargement?: boolean }) {
  if (totalPages <= 1) return null;
  return <nav className={styles.pagination} aria-label={libelle}><button type="button" className={styles.button} disabled={page <= 1 || chargement} onClick={() => changer(page - 1)}>Précédent</button><span>Page {page} sur {totalPages}</span><button type="button" className={styles.button} disabled={page >= totalPages || chargement} onClick={() => changer(page + 1)}>Suivant</button></nav>;
}

export function ActionsMembre({ profilId, lienProfil = true, synergie = true, moi = false }: { profilId: string; lienProfil?: boolean; synergie?: boolean; moi?: boolean }) {
  const router = useRouter();
  const [action, setAction] = useState<"contact" | "synergie" | null>(null);
  const [envoyee, setEnvoyee] = useState(false);
  const [retour, setRetour] = useState<{ texte: string; erreur?: boolean } | null>(null);
  async function agir(type: "contact" | "synergie") {
    if (action || moi) return;
    setAction(type); setRetour(null);
    try {
      if (type === "contact") {
        const { data } = await api.post<{ conversationId: string }>("/messages/conversations", { destinataireId: profilId });
        router.push(`/messages?conversation=${encodeURIComponent(data.conversationId)}`);
      } else {
        await api.post("/synergies", { recepteurProfilId: profilId });
        setEnvoyee(true); setRetour({ texte: "Votre demande de synergie a été envoyée." });
      }
    } catch (erreur) { setRetour({ texte: messageErreur(erreur, type === "contact" ? "Impossible d’ouvrir la conversation." : "La demande n’a pas pu être envoyée."), erreur: true }); }
    finally { setAction(null); }
  }
  if (moi) return <Link className={`${styles.button} ${styles.full}`} href="/profil">Votre profil</Link>;
  return <div className={styles.actions}><div className={styles.actionRow}>{lienProfil && <Link className={styles.button} href={`/membres/${encodeURIComponent(profilId)}`}>Voir le profil</Link>}<button type="button" className={`${styles.button} ${styles.primary}`} disabled={Boolean(action)} onClick={() => void agir("contact")}>{action === "contact" ? <LoaderCircle size={14} aria-hidden className={styles.spinner} /> : <MessageCircle size={14} aria-hidden />}Contacter</button></div>{synergie && <button type="button" className={styles.link} style={{ minHeight: 32 }} disabled={Boolean(action) || envoyee} onClick={() => void agir("synergie")}><UsersRound size={13} aria-hidden style={{ display: "inline", marginRight: 5 }} />{envoyee ? "Demande envoyée" : action === "synergie" ? "Envoi…" : "Proposer une synergie"}</button>}{retour && <p role={retour.erreur ? "alert" : "status"} className={`${styles.note} ${retour.erreur ? styles.error : ""}`}>{retour.texte}</p>}</div>;
}

export function lienWebPublic(value?: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export function datePublique(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

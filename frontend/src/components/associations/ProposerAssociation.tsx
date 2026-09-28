"use client";

import { FormEvent, useId, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import ChampsPaysVille from "@/components/localisation/ChampsPaysVille";
import styles from "../directory/Directory.module.css";

export default function ProposerAssociation({ apiBase = "/associations", onSuccess, onBusyChange }: { apiBase?: string; onSuccess?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [form, setForm] = useState({ nom: "", pays: "", ville: "", vocation: "", message: "" });
  const id = useId();
  async function envoyer(event: FormEvent) {
    event.preventDefault(); if (envoi) return;
    setEnvoi(true); onBusyChange?.(true); setRetour(null);
    try {
      await api.post(`${apiBase}/suggestions`, Object.fromEntries(Object.entries(form).map(([cle, valeur]) => [cle, valeur.trim()])));
      setRetour({ texte: "Votre proposition a été transmise à l’équipe. Elle sera examinée avant l’ajout de l’association." });
      setForm({ nom: "", pays: "", ville: "", vocation: "", message: "" }); onSuccess?.();
    } catch (erreur) { setRetour({ texte: messageErreur(erreur, "Votre proposition n’a pas pu être envoyée."), erreur: true }); }
    finally { setEnvoi(false); onBusyChange?.(false); }
  }
  return <section className={styles.panel} style={{ marginTop: 24 }}><button type="button" aria-expanded={ouvert} aria-controls={id} onClick={() => setOuvert(!ouvert)} className={styles.link} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36, textDecoration: "none", fontSize: 14 }}><Plus size={18} aria-hidden />Mon association n’est pas dans la liste<ChevronDown size={16} aria-hidden /></button>{ouvert && <div id={id}><p className={styles.note} style={{ margin: "10px 0 18px" }}>Présentez votre association à l’équipe Mali Wuli pour demander son ajout à l’annuaire.</p><form onSubmit={(event) => void envoyer(event)} className={styles.formGrid}><label className={`${styles.field} ${styles.wide}`}>Nom de l’association *<input className={styles.input} required maxLength={200} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></label><ChampsPaysVille idPrefixe={`${id}-association`} pays={form.pays} ville={form.ville} paysRequis libellePays="Pays *" libelleVille="Ville (facultatif)" classes={{ champ: styles.field, libelle: "", controle: styles.input }} onChange={({ pays, ville }) => setForm((f) => ({ ...f, pays, ville }))} /><label className={`${styles.field} ${styles.wide}`}>Vocation ou domaine<input className={styles.input} maxLength={160} placeholder="Éducation, entraide, santé…" value={form.vocation} onChange={(e) => setForm({ ...form, vocation: e.target.value })} /></label><label className={`${styles.field} ${styles.wide}`}>Votre message<textarea className={styles.input} rows={4} maxLength={3000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Présentez les activités de l’association et précisez comment la contacter." /></label><div className={`${styles.actionRow} ${styles.wide}`}><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={envoi}>{envoi ? "Envoi…" : "Envoyer ma proposition"}</button><button type="button" className={styles.button} disabled={envoi} onClick={() => setOuvert(false)}>Fermer</button></div></form>{retour && <p role={retour.erreur ? "alert" : "status"} className={`${styles.status} ${retour.erreur ? styles.error : ""}`}>{retour.texte}</p>}</div>}</section>;
}

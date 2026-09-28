"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, ImagePlus, MapPin, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { champsDateEvenement, dateLocaleVersIso, FUSEAUX_HORAIRES } from "@/lib/evenements";
import { urlMediaBackend } from "@/lib/media";
import ChampsPaysVille from "@/components/localisation/ChampsPaysVille";
import type { DetailEvenementResponse, EtapeProgramme, Evenement, FormatEvenement } from "@/types/evenements";
import styles from "./FormulaireEvenement.module.css";

const FORMATS: { value: FormatEvenement; label: string }[] = [
  { value: "PRESENTIEL", label: "Présentiel" }, { value: "EN_LIGNE", label: "En ligne" }, { value: "HYBRIDE", label: "Hybride" },
];
const formulaireVide = {
  titre: "", description: "", type: "PRESENTIEL" as FormatEvenement, jour: "", heureDebut: "", jourFin: "", heureFin: "",
  fuseauHoraire: "Africa/Bamako", pays: "Mali", ville: "", lieu: "", lienVideo: "", capacite: "", resume: "",
};
const MAX_COUVERTURE = 10 * 1024 * 1024;

export default function FormulaireEvenement({ evenementId }: { evenementId?: string }) {
  const [formulaire, setFormulaire] = useState(formulaireVide);
  const [programme, setProgramme] = useState<EtapeProgramme[]>([]);
  const [initial, setInitial] = useState<Evenement | null>(null);
  const [chargement, setChargement] = useState(Boolean(evenementId));
  const [erreurChargement, setErreurChargement] = useState("");
  const [revision, setRevision] = useState(0);
  const [couverture, setCouverture] = useState<File | null>(null);
  const [apercuCouverture, setApercuCouverture] = useState("");
  const [erreurCouverture, setErreurCouverture] = useState("");
  const [erreur, setErreur] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoiCouverture, setEnvoiCouverture] = useState(false);
  const [enregistre, setEnregistre] = useState<Evenement | null>(null);
  const [avertissementImage, setAvertissementImage] = useState("");
  const operationEnCours = useRef(false);
  const idSauvegarde = useRef<string | null>(null);
  const champCouverture = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!evenementId) return;
    let actif = true;
    setChargement(true); setErreurChargement("");
    const charger = async () => {
      try {
        const { data } = await api.get<DetailEvenementResponse>(`/evenements/${encodeURIComponent(evenementId)}`);
        if (!actif) return;
        if (!data.evenement.peutModifier) throw new Error("Vous ne pouvez pas modifier cet événement.");
        const e = data.evenement;
        const fuseauHoraire = e.fuseauHoraire || "Africa/Bamako";
        const debut = champsDateEvenement(e.dateDebut, fuseauHoraire);
        const fin = e.dateFin ? champsDateEvenement(e.dateFin, fuseauHoraire) : null;
        setInitial(e);
        setFormulaire({ titre: e.titre, description: e.description, type: e.type, jour: debut.jour, heureDebut: debut.heure, jourFin: fin?.jour || "", heureFin: fin?.heure || "", fuseauHoraire, pays: e.pays || "", ville: e.ville || "", lieu: e.lieu || "", lienVideo: e.lienVideo || "", capacite: e.capacite ? String(e.capacite) : "", resume: e.resume || "" });
        setProgramme(e.programme || []);
      } catch (error) { if (actif) setErreurChargement(messageErreur(error, "Cet événement ne peut pas être chargé.")); }
      finally { if (actif) setChargement(false); }
    };
    void charger();
    return () => { actif = false; };
  }, [evenementId, revision]);

  useEffect(() => {
    if (!couverture) { setApercuCouverture(""); return; }
    const url = URL.createObjectURL(couverture);
    setApercuCouverture(url);
    return () => URL.revokeObjectURL(url);
  }, [couverture]);

  const champ = <Cle extends keyof typeof formulaire>(cle: Cle, valeur: (typeof formulaire)[Cle]) => setFormulaire((precedent) => ({ ...precedent, [cle]: valeur }));
  const choisirCouverture = (fichier?: File) => {
    if (!fichier || operationEnCours.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(fichier.type)) { setErreurCouverture("Choisissez une image JPEG, PNG ou WebP."); return; }
    if (fichier.size > MAX_COUVERTURE) { setErreurCouverture("L’image ne doit pas dépasser 10 Mio."); return; }
    if (!fichier.size) { setErreurCouverture("Ce fichier est vide. Choisissez une autre image."); return; }
    setCouverture(fichier); setErreurCouverture("");
  };
  const annulerSelection = () => { setCouverture(null); setErreurCouverture(""); if (champCouverture.current) champCouverture.current.value = ""; };

  const hybrideHistoriqueSansLien = initial?.type === "HYBRIDE" && formulaire.type === "HYBRIDE" && !initial.lienVideo && !formulaire.lienVideo.trim();

  const enregistrer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operationEnCours.current || idSauvegarde.current || enregistre || erreurCouverture) return;
    setErreur(""); setAvertissementImage("");
    let payload: Record<string, unknown>;
    try {
      if (formulaire.titre.trim().length < 3 || formulaire.description.trim().length < 10) throw new Error("Précisez un titre et une description suffisamment détaillée.");
      const ancienFuseau = initial?.fuseauHoraire || "Africa/Bamako";
      const ancienDebut = initial ? champsDateEvenement(initial.dateDebut, ancienFuseau) : null;
      const ancienneFin = initial?.dateFin ? champsDateEvenement(initial.dateFin, ancienFuseau) : null;
      const debutModifie = !initial || ancienFuseau !== formulaire.fuseauHoraire || ancienDebut?.jour !== formulaire.jour || ancienDebut?.heure !== formulaire.heureDebut;
      const dateDebut = debutModifie ? dateLocaleVersIso(formulaire.jour, formulaire.heureDebut, formulaire.fuseauHoraire) : initial!.dateDebut;
      if (debutModifie && Date.parse(dateDebut) <= Date.now()) throw new Error("Choisissez une date de début à venir.");
      if (formulaire.jourFin && !formulaire.heureFin) throw new Error("Indiquez l’heure de fin ou effacez la date de fin.");
      const jourFin = formulaire.jourFin || formulaire.jour;
      const finModifiee = !initial || ancienFuseau !== formulaire.fuseauHoraire || (ancienneFin?.jour || "") !== (formulaire.heureFin ? jourFin : "") || (ancienneFin?.heure || "") !== formulaire.heureFin;
      const dateFin = formulaire.heureFin ? (finModifiee ? dateLocaleVersIso(jourFin, formulaire.heureFin, formulaire.fuseauHoraire) : initial?.dateFin) : null;
      if (dateFin && Date.parse(dateFin) <= Date.parse(dateDebut)) throw new Error("La fin doit être postérieure au début. Pour un événement sur plusieurs jours, précisez la date de fin.");
      const capacite = formulaire.capacite ? Number(formulaire.capacite) : null;
      if (capacite !== null && (!Number.isInteger(capacite) || capacite < 2 || capacite > 50000)) throw new Error("Le nombre de places doit être compris entre 2 et 50 000.");
      if (formulaire.type !== "EN_LIGNE" && (!initial || initial.type === "EN_LIGNE" || Boolean(initial.pays && initial.ville)) && (!formulaire.pays.trim() || !formulaire.ville.trim())) throw new Error("Indiquez le pays et la ville de l’événement.");
      if (formulaire.type !== "PRESENTIEL" && !hybrideHistoriqueSansLien) {
        let lien: URL;
        try { lien = new URL(formulaire.lienVideo.trim()); } catch { throw new Error("Indiquez un lien de visioconférence valide."); }
        if (!["https:", "http:"].includes(lien.protocol)) throw new Error("Le lien de visioconférence doit commencer par https:// ou http://.");
      }
      const etapes = programme.filter((etape) => etape.heure || etape.libelle.trim()).map((etape) => ({ heure: etape.heure, libelle: etape.libelle.trim() }));
      if (etapes.some((etape) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(etape.heure) || !etape.libelle || etape.libelle.length > 200)) throw new Error("Chaque ligne du programme doit avoir une heure et un intitulé de 200 caractères maximum.");
      payload = {
        titre: formulaire.titre.trim(), description: formulaire.description.trim(), type: formulaire.type,
        ...(debutModifie ? { dateDebut } : {}), ...(finModifiee ? { dateFin } : {}),
        fuseauHoraire: formulaire.fuseauHoraire, capacite, programme: etapes,
        ...(formulaire.pays.trim() || !initial ? { pays: formulaire.pays.trim() || null } : {}),
        ...(formulaire.ville.trim() || !initial ? { ville: formulaire.ville.trim() || null } : {}),
        lieu: formulaire.lieu.trim() || null, lienVideo: formulaire.type === "PRESENTIEL" ? null : formulaire.lienVideo.trim(),
        ...(initial ? { resume: formulaire.resume.trim() || null } : {}),
      };
      if (initial) {
        // Les champs inchangés restent absents du PATCH, notamment lors d’un résumé après la rencontre.
        const textes = ["titre", "description", "type", "pays", "ville", "lieu", "lienVideo", "resume"] as const;
        for (const cle of textes) {
          if (formulaire[cle] === (initial[cle] || "") && !(cle === "lienVideo" && formulaire.type !== initial.type)) delete payload[cle];
        }
        if (formulaire.fuseauHoraire === ancienFuseau) delete payload.fuseauHoraire;
        if (formulaire.capacite === (initial.capacite ? String(initial.capacite) : "")) delete payload.capacite;
        if (JSON.stringify(programme) === JSON.stringify(initial.programme || [])) delete payload.programme;
        if (!Object.keys(payload).length && !couverture) throw new Error("Aucune modification à enregistrer.");
      }
    } catch (error) { setErreur(messageErreur(error, "Vérifiez les informations saisies.")); return; }
    operationEnCours.current = true; setEnregistrement(true);
    try {
      const { data } = evenementId && initial && !Object.keys(payload).length
        ? { data: { evenement: initial } }
        : evenementId
          ? await api.patch<{ evenement: Evenement }>(`/evenements/${encodeURIComponent(evenementId)}`, payload)
          : await api.post<{ evenement: Evenement }>("/evenements", payload);
      idSauvegarde.current = data.evenement.id;
      setEnregistre(data.evenement);
      if (couverture) {
        setEnvoiCouverture(true);
        const body = new FormData(); body.append("couverture", couverture);
        try {
          const reponse = await api.post<{ evenement: Evenement }>(`/evenements/${encodeURIComponent(data.evenement.id)}/couverture`, body, { headers: { "Content-Type": "multipart/form-data" } });
          setEnregistre(reponse.data.evenement);
        } catch (error) {
          setAvertissementImage(messageErreur(error, "La couverture n’a pas pu être envoyée.") + " Votre événement est enregistré. Vous pouvez réessayer l’envoi depuis sa fiche.");
        } finally { setEnvoiCouverture(false); }
      }
    } catch (error) { setErreur(messageErreur(error, "L’événement n’a pas pu être enregistré. Réessayez.")); }
    finally { operationEnCours.current = false; setEnregistrement(false); }
  };

  const presentiel = formulaire.type !== "EN_LIGNE";
  const localisationRequise = presentiel && (!initial || initial.type === "EN_LIGNE" || Boolean(initial.pays && initial.ville));
  const photo = apercuCouverture || urlMediaBackend(initial?.photoCouverture);
  const dateApercu = /^\d{4}-\d{2}-\d{2}$/.test(formulaire.jour) ? new Date(`${formulaire.jour}T12:00:00Z`) : null;
  const dateLisible = dateApercu && !Number.isNaN(dateApercu.getTime()) ? dateApercu : null;
  const fuseaux = FUSEAUX_HORAIRES.some((f) => f.value === formulaire.fuseauHoraire) ? FUSEAUX_HORAIRES : [...FUSEAUX_HORAIRES, { value: formulaire.fuseauHoraire, label: formulaire.fuseauHoraire }];

  return <div className={styles.page}>
    {!enregistrement && <Link href={evenementId ? `/evenements/${encodeURIComponent(evenementId)}` : "/evenements"} className={styles.back}><ArrowLeft size={17} aria-hidden /> {enregistre ? "Événements" : "Annuler"}</Link>}
    <h1 className={styles.title}>{evenementId ? "Modifier l’événement" : "Proposer un événement"}</h1>
    {chargement ? <p className={styles.notice} role="status">Chargement de l’événement…</p> : erreurChargement ? <div className={styles.error} role="alert"><p>{erreurChargement}</p><button className={styles.secondary} type="button" onClick={() => setRevision((v) => v + 1)}>Réessayer</button></div> : enregistre ? <section className={styles.success} aria-labelledby="evenement-enregistre">
      <h2 id="evenement-enregistre">{envoiCouverture ? "Événement enregistré, envoi de la couverture…" : evenementId ? "Vos modifications sont enregistrées" : "Votre événement est proposé"}</h2>
      <p>{enregistre.statut === "VALIDE" ? "La fiche est publiée dans les événements du réseau." : enregistre.statut === "REFUSE" ? "Cette proposition reste refusée. Pour la soumettre de nouveau, modifiez ses informations principales, comme le titre, la description, la date ou le lieu." : "Vous retrouverez cette proposition dans « Mes propositions ». Elle sera publiée après validation par l’équipe."}</p>
      {envoiCouverture && <p role="status">Envoi de la couverture en cours…</p>}
      {avertissementImage && <p className={styles.error} role="alert">{avertissementImage}</p>}
      {!enregistrement && <div className={styles.actions}><Link className={styles.primary} href={`/evenements/${encodeURIComponent(enregistre.id)}`}>{avertissementImage ? "Ouvrir la fiche et réessayer la couverture" : "Voir la fiche de l’événement"}</Link><Link className={styles.secondary} href="/evenements?statut=mes">Mes propositions</Link></div>}
    </section> : <>
      <p className={styles.notice}>{initial?.peutModerer ? "Modifiez les informations de l’événement et vérifiez leur aperçu avant d’enregistrer." : "Tout membre peut proposer un événement. Il sera publié après validation par l’équipe."}</p>
      <div className={styles.layout}>
        <form className={styles.form} onSubmit={(event) => void enregistrer(event)}>
          <fieldset disabled={enregistrement} className={styles.fields}>
            <label className={styles.label}>Titre <span aria-hidden>*</span><input required minLength={3} maxLength={150} value={formulaire.titre} onChange={(e) => champ("titre", e.target.value)} placeholder="Ex. Rencontre des talents maliens à Bamako" /></label>
            <div><label className={styles.label} htmlFor="couverture-evenement">Photo de couverture <span className={styles.optional}>(facultatif)</span></label>
              <div className={styles.upload} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choisirCouverture(e.dataTransfer.files[0]); }}>
                {photo ? <img src={photo} alt="Aperçu de la couverture" className={styles.uploadImage} /> : <ImagePlus size={34} aria-hidden />}
                <label htmlFor="couverture-evenement" className={styles.uploadLabel}>{photo ? "Changer la couverture" : "Choisir une photo ou la glisser ici"}<input ref={champCouverture} id="couverture-evenement" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { choisirCouverture(e.target.files?.[0]); e.target.value = ""; }} /></label>
              </div>
              <p className={styles.hint}>JPEG, PNG ou WebP · 10 Mio maximum. Format paysage conseillé.</p>
              {couverture && <p className={styles.hint}>{couverture.name}</p>}{erreurCouverture && <p className={styles.error} role="alert">{erreurCouverture}</p>}
              {(couverture || erreurCouverture) && <button type="button" className={styles.textButton} onClick={annulerSelection}>Annuler cette sélection</button>}
            </div>
            <fieldset className={styles.formatGroup}><legend className={styles.label}>Format <span aria-hidden>*</span></legend><div className={styles.formats}>{FORMATS.map((format) => <label key={format.value} className={formulaire.type === format.value ? styles.formatSelected : styles.format}><input type="radio" name="format-evenement" value={format.value} checked={formulaire.type === format.value} onChange={() => champ("type", format.value)} /><span>{format.label}</span></label>)}</div></fieldset>
            <div className={styles.dateGrid}><label className={styles.label}>Date <span aria-hidden>*</span><input required type="date" value={formulaire.jour} onChange={(e) => champ("jour", e.target.value)} /></label><label className={styles.label}>Début <span aria-hidden>*</span><input required type="time" value={formulaire.heureDebut} onChange={(e) => champ("heureDebut", e.target.value)} /></label><label className={styles.label}>Fin <span className={styles.optional}>(facultatif)</span><input type="time" value={formulaire.heureFin} onChange={(e) => setFormulaire((valeur) => ({ ...valeur, heureFin: e.target.value, ...(e.target.value ? {} : { jourFin: "" }) }))} /></label></div>
            <div className={styles.grid}><label className={styles.label}>Fuseau horaire <span aria-hidden>*</span><select value={formulaire.fuseauHoraire} onChange={(e) => champ("fuseauHoraire", e.target.value)}>{fuseaux.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label><label className={styles.label}>Date de fin <span className={styles.optional}>(si autre jour)</span><input type="date" value={formulaire.jourFin} onChange={(e) => champ("jourFin", e.target.value)} /></label></div>
            <p className={styles.hint}>Les horaires sont ceux du fuseau choisi, même si vous vous trouvez dans un autre pays.</p>
            {presentiel && <><div className={styles.grid}><ChampsPaysVille idPrefixe="evenement" pays={formulaire.pays} ville={formulaire.ville} paysRequis={localisationRequise} villeRequise={localisationRequise} libellePays={<>Pays {localisationRequise && <span aria-hidden>*</span>}</>} libelleVille="Ville" classes={{ champ: styles.label, libelle: styles.comboLabel, controle: styles.control }} onChange={({ pays, ville }) => setFormulaire((precedent) => ({ ...precedent, pays, ville }))} /></div><label className={styles.label}>Adresse <span className={styles.optional}>(facultatif)</span><input maxLength={190} value={formulaire.lieu} onChange={(e) => champ("lieu", e.target.value)} placeholder="Lieu, rue, quartier" /></label></>}
            {formulaire.type !== "PRESENTIEL" && <label className={styles.label}>Lien de visioconférence {hybrideHistoriqueSansLien ? <span className={styles.optional}>(facultatif)</span> : <span aria-hidden>*</span>}<input required={!hybrideHistoriqueSansLien} type="url" maxLength={2048} value={formulaire.lienVideo} onChange={(e) => champ("lienVideo", e.target.value)} placeholder="https://…" /></label>}
            <label className={styles.label}>Description <span aria-hidden>*</span><textarea required minLength={10} maxLength={5000} rows={6} value={formulaire.description} onChange={(e) => champ("description", e.target.value)} placeholder="À qui s’adresse l’événement, ce qu’on y fera, ce qu’il faut apporter…" /></label>
            <section aria-labelledby="programme-formulaire"><div className={styles.sectionHeading}><h2 id="programme-formulaire" className={styles.label}>Programme <span className={styles.optional}>(facultatif)</span></h2><span className={styles.hint}>{programme.length}/50</span></div><div className={styles.programme}>{programme.map((etape, index) => <div key={index} className={styles.programmeRow}><label className={styles.label}><span className={styles.srOnly}>Heure de l’étape {index + 1}</span><input type="time" value={etape.heure} onChange={(e) => setProgramme((liste) => liste.map((ligne, i) => i === index ? { ...ligne, heure: e.target.value } : ligne))} /></label><label className={styles.label}><span className={styles.srOnly}>Intitulé de l’étape {index + 1}</span><input maxLength={200} value={etape.libelle} placeholder="Ex. Accueil des participants" onChange={(e) => setProgramme((liste) => liste.map((ligne, i) => i === index ? { ...ligne, libelle: e.target.value } : ligne))} /></label><button className={styles.iconButton} type="button" aria-label={`Retirer l’étape ${index + 1}`} onClick={() => setProgramme((liste) => liste.filter((_, i) => i !== index))}><Trash2 size={17} aria-hidden /></button></div>)}</div><button className={styles.textButton} type="button" disabled={programme.length >= 50} onClick={() => setProgramme((liste) => [...liste, { heure: "", libelle: "" }])}><Plus size={16} aria-hidden /> Ajouter une étape</button></section>
            <label className={styles.label + " " + styles.capacity}>Nombre de places <span className={styles.optional}>(facultatif)</span><input type="number" min={2} max={50000} step={1} value={formulaire.capacite} onChange={(e) => champ("capacite", e.target.value)} placeholder="Illimité" /></label>
            {initial && <label className={styles.label}>Résumé de l’événement <span className={styles.optional}>(facultatif)</span><textarea rows={5} maxLength={10000} value={formulaire.resume} onChange={(e) => champ("resume", e.target.value)} placeholder="Après la rencontre, partagez les temps forts et ce qui en est ressorti." /></label>}
            {erreur && <p className={styles.error} role="alert">{erreur}</p>}
            <div className={styles.footer}>{!enregistrement && <Link href={evenementId ? `/evenements/${encodeURIComponent(evenementId)}` : "/evenements"} className={styles.secondary}>Annuler</Link>}<button type="submit" className={styles.primary} disabled={enregistrement || Boolean(erreurCouverture)}>{enregistrement ? "Enregistrement…" : evenementId ? "Enregistrer les modifications" : "Envoyer pour validation"}</button></div>
          </fieldset>
        </form>
        <aside className={styles.preview} aria-labelledby="apercu-evenement"><h2 id="apercu-evenement" className={styles.previewHeading}>Aperçu</h2><article className={styles.previewCard}>{photo && <img src={photo} alt="" className={styles.previewImage} />}<div className={styles.previewBody}><div className={styles.dateBadge}><span>{dateLisible ? new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(dateLisible) : "Mois"}</span><strong>{dateLisible ? dateLisible.getUTCDate() : "—"}</strong></div><div className={styles.previewText}><h3>{formulaire.titre.trim() || "Titre de votre événement"}</h3><p><MapPin size={15} aria-hidden />{formulaire.type === "EN_LIGNE" ? "En ligne" : [formulaire.ville, formulaire.pays].filter(Boolean).join(", ") || "Lieu à préciser"}</p><p><CalendarDays size={15} aria-hidden />{formulaire.heureDebut || "Heure à préciser"}{formulaire.heureFin ? ` – ${formulaire.heureFin}` : ""}</p><span className={styles.badge}>{FORMATS.find((f) => f.value === formulaire.type)?.label}</span></div></div></article><p className={styles.previewHint}>Horaires affichés dans le fuseau {formulaire.fuseauHoraire}.</p></aside>
      </div>
    </>}
  </div>;
}

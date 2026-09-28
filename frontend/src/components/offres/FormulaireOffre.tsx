"use client";

import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Check, MapPin, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import api from "@/lib/api";
import { messageErreur } from "@/lib/community";
import { dateLimiteOffre, lienExterneSur, MODES_CANDIDATURE, MODES_TRAVAIL, SECTEURS_OFFRES, TYPES_OFFRE } from "@/lib/offres";
import ChampsPaysVille from "@/components/localisation/ChampsPaysVille";
import { analyserSalaire, composerSalaire, DEVISES_SALAIRE, PERIODES_SALAIRE, SALAIRE_VIDE, type Periode, type SalaireStructure } from "@/lib/salaire-offre";
import type { ModeCandidature, ModeTravail, OffreApi, TypeOffre } from "@/types/offres";
import styles from "./OffresEdition.module.css";

type Formulaire = {
  titre: string; entreprise: string; secteur: string; type: TypeOffre; modeTravail: ModeTravail;
  salaire: string; pays: string; ville: string; description: string; profilRecherche: string;
  modeCandidature: ModeCandidature; emailContact: string; lienCandidature: string;
  dateExpiration: string; recommandationPossible: boolean;
};
type ErreursChamps = Partial<Record<keyof Formulaire, string>>;
const vide: Formulaire = { titre: "", entreprise: "", secteur: "", type: "CDI", modeTravail: "SUR_SITE", salaire: "", pays: "Mali", ville: "", description: "", profilRecherche: "", modeCandidature: "MALI_WULI", emailContact: "", lienCandidature: "", dateExpiration: "", recommandationPossible: false };

export function preparerOffre(formulaire: Formulaire, initial: OffreApi | null, maintenant = Date.now()) {
  const erreurs: ErreursChamps = {};
  const texte = (cle: keyof Formulaire) => String(formulaire[cle]).trim();
  for (const [cle, minimum, maximum, nom] of [
    ["titre", 3, 150, "Le titre"], ["entreprise", 2, 150, "Le nom de l’entreprise"],
    ["secteur", 2, 100, "Le secteur"], ["pays", 2, 100, "Le pays"],
    ["ville", 0, 100, "La ville"], ["description", 20, 10000, "La description"],
    ["profilRecherche", 0, 10000, "Le profil recherché"], ["salaire", 0, 190, "Le salaire"],
  ] as const) {
    if (texte(cle).length < minimum || texte(cle).length > maximum) erreurs[cle] = `${nom} doit contenir ${minimum ? `entre ${minimum} et` : "au maximum"} ${maximum} caractères.`;
  }
  if (formulaire.modeCandidature === "EMAIL" && texte("emailContact") && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texte("emailContact")) || texte("emailContact").length > 190)) erreurs.emailContact = "Indiquez une adresse e-mail valide.";
  if (formulaire.modeCandidature === "LIEN_EXTERNE" && (!lienExterneSur(texte("lienCandidature")) || texte("lienCandidature").length > 2048)) erreurs.lienCandidature = "Indiquez un lien complet commençant par https:// ou http://.";
  const ancienneDate = initial?.dateExpiration?.slice(0, 10) || "";
  const dateModifiee = !initial || ancienneDate !== formulaire.dateExpiration;
  let dateExpiration: string | null = null;
  if (dateModifiee && formulaire.dateExpiration) {
    try {
      dateExpiration = dateLimiteOffre(formulaire.dateExpiration);
      if (Date.parse(dateExpiration) <= maintenant) erreurs.dateExpiration = "Choisissez une date limite à venir.";
    } catch { erreurs.dateExpiration = "Choisissez une date limite valide."; }
  }
  const donnees = {
    titre: texte("titre"), entreprise: texte("entreprise"), secteur: texte("secteur"), type: formulaire.type,
    modeTravail: formulaire.modeTravail, salaire: texte("salaire") || null,
    pays: texte("pays"), ville: texte("ville") || null, description: texte("description"), profilRecherche: texte("profilRecherche") || null,
    modeCandidature: formulaire.modeCandidature,
    emailContact: formulaire.modeCandidature === "EMAIL" ? texte("emailContact") || null : null,
    lienCandidature: formulaire.modeCandidature === "LIEN_EXTERNE" ? texte("lienCandidature") : null,
    recommandationPossible: formulaire.recommandationPossible,
    ...(dateModifiee ? { dateExpiration } : {}),
  };
  return { erreurs, donnees };
}

export default function FormulaireOffre({ offreId }: { offreId?: string }) {
  const [formulaire, setFormulaire] = useState<Formulaire>(vide);
  const [initial, setInitial] = useState<OffreApi | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState("");
  const [revision, setRevision] = useState(0);
  const [erreurs, setErreurs] = useState<ErreursChamps>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [enregistree, setEnregistree] = useState<OffreApi | null>(null);
  const [emailCompte, setEmailCompte] = useState("");
  const verrou = useRef(false);
  const termine = useRef(false);
  const retour = useRef<HTMLDivElement>(null);
  const [salaire, setSalaire] = useState<SalaireStructure>(SALAIRE_VIDE);

  useEffect(() => {
    let actif = true;
    setChargement(true); setErreurChargement("");
    const charger = async () => {
      try {
        const [{ data: compte }, detail] = await Promise.all([
          api.get<{ email?: string }>("/users/me"),
          offreId ? api.get<{ offre: OffreApi }>(`/offres/${encodeURIComponent(offreId)}`) : Promise.resolve(null),
        ]);
        if (!actif) return;
        setEmailCompte(compte.email || "");
        if (detail) {
          const o = detail.data.offre;
          if (!o.peutModifier) throw new Error("Vous ne pouvez pas modifier cette offre.");
          setInitial(o);
          setSalaire(analyserSalaire(o.salaire));
          setFormulaire({ titre: o.titre, entreprise: o.entreprise, secteur: o.secteur, type: o.type, modeTravail: o.modeTravail || (o.teletravail ? "TELETRAVAIL" : "SUR_SITE"), salaire: o.salaire || "", pays: o.pays, ville: o.ville || "", description: o.description, profilRecherche: o.profilRecherche || "", modeCandidature: o.modeCandidature || (o.lienCandidature ? "LIEN_EXTERNE" : "EMAIL"), emailContact: o.emailContact || "", lienCandidature: o.lienCandidature || "", dateExpiration: o.dateExpiration?.slice(0, 10) || "", recommandationPossible: o.recommandationPossible || false });
        } else setFormulaire((f) => ({ ...f, emailContact: compte.email || "" }));
      } catch (e) { if (actif) setErreurChargement(messageErreur(e, "Impossible de charger le formulaire.")); }
      finally { if (actif) setChargement(false); }
    };
    void charger();
    return () => { actif = false; };
  }, [offreId, revision]);
  useEffect(() => { if (erreur || enregistree) retour.current?.focus(); }, [erreur, enregistree]);
  const changer = <Cle extends keyof Formulaire>(cle: Cle, valeur: Formulaire[Cle]) => {
    setFormulaire((f) => ({ ...f, [cle]: valeur }));
    setErreurs((e) => ({ ...e, [cle]: undefined }));
  };
  const changerSalaire = (modification: Partial<SalaireStructure>) => {
    const suivant = { ...salaire, ...modification };
    setSalaire(suivant);
    changer("salaire", composerSalaire(suivant).valeur || "");
  };
  const envoyer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (verrou.current || termine.current) return;
    const { erreurs: nouvellesErreurs, donnees } = preparerOffre(formulaire, initial);
    const salaireCompose = composerSalaire(salaire);
    if (salaireCompose.erreur) nouvellesErreurs.salaire = salaireCompose.erreur;
    if (!formulaire.pays.trim()) nouvellesErreurs.pays = "Choisissez le pays du poste.";
    setErreurs(nouvellesErreurs); setErreur("");
    if (Object.keys(nouvellesErreurs).length) { setErreur("Vérifiez les champs indiqués avant d’envoyer votre offre."); return; }
    verrou.current = true; setEnvoi(true);
    try {
      const { data } = offreId
        ? await api.patch<{ offre: OffreApi }>(`/offres/${encodeURIComponent(offreId)}`, donnees)
        : await api.post<{ offre: OffreApi }>("/offres", donnees);
      termine.current = true; setEnregistree(data.offre);
    } catch (e) { setErreur(messageErreur(e, "L’offre n’a pas pu être enregistrée. Réessayez.")); }
    finally { verrou.current = false; setEnvoi(false); }
  };
  const attributs = (cle: keyof Formulaire) => ({ id: `offre-${cle}`, "aria-invalid": Boolean(erreurs[cle]), "aria-describedby": erreurs[cle] ? `erreur-${cle}` : undefined });
  const erreurChamp = (cle: keyof Formulaire) => erreurs[cle] ? <span id={`erreur-${cle}`} className={styles.fieldError}>{erreurs[cle]}</span> : null;
  const optionSecteur = formulaire.secteur && !SECTEURS_OFFRES.includes(formulaire.secteur);

  return <main className={styles.page}>
    <Link href="/offres" className={styles.back}><ArrowLeft size={17} aria-hidden />Offres d’emploi</Link>
    <header className={styles.header}><div><h1>{offreId ? "Modifier votre offre" : "Déposer une offre"}</h1><p>Partagez une opportunité avec les membres du réseau Mali Wuli. Chaque offre est examinée avant publication.</p></div></header>
    {chargement ? <p role="status" className={styles.panel}>Chargement du formulaire…</p> : erreurChargement ? <section className={styles.panel}><p role="alert" className={styles.error}>{erreurChargement}</p><button type="button" className={styles.secondary} onClick={() => setRevision((r) => r + 1)}>Réessayer</button></section> : enregistree ? <div ref={retour} tabIndex={-1} role="status" className={styles.success}><Check size={28} aria-hidden /><h2>Votre offre a été envoyée pour validation.</h2><p>{offreId ? "Vos modifications sont enregistrées. L’offre sera à nouveau visible après validation." : "Vous pouvez retrouver votre offre et suivre son statut dans vos offres déposées."}</p><div className={styles.actions}><Link className={styles.primary} href={`/offres?vue=mes-offres&offre=${encodeURIComponent(enregistree.id)}`}>Voir mon offre</Link><Link className={styles.secondary} href="/offres?vue=mes-offres">Mes offres déposées</Link></div></div> : <div className={styles.layout}>
      <form onSubmit={envoyer} noValidate className={`${styles.panel} ${styles.form}`} aria-busy={envoi}>
        <p className={styles.note}>Les champs marqués d’un * sont obligatoires.</p>
        {erreur && <div ref={retour} tabIndex={-1} role="alert" className={styles.error}>{erreur}</div>}
        <fieldset disabled={envoi} className={styles.section}><legend className={styles.legend}>Le poste</legend><div className={styles.grid}>
          <label className={`${styles.field} ${styles.full}`} htmlFor="offre-titre">Titre du poste *<input {...attributs("titre")} value={formulaire.titre} onChange={(e) => changer("titre", e.target.value)} required minLength={3} maxLength={150} placeholder="Ex. Chargé de communication" />{erreurChamp("titre")}</label>
          <label className={styles.field} htmlFor="offre-entreprise">Entreprise ou organisation *<input {...attributs("entreprise")} value={formulaire.entreprise} onChange={(e) => changer("entreprise", e.target.value)} required minLength={2} maxLength={150} autoComplete="organization" />{erreurChamp("entreprise")}</label>
          <label className={styles.field} htmlFor="offre-secteur">Secteur d’activité *<select {...attributs("secteur")} value={formulaire.secteur} onChange={(e) => changer("secteur", e.target.value)} required><option value="">Choisir un secteur</option>{optionSecteur && <option value={formulaire.secteur}>{formulaire.secteur}</option>}{SECTEURS_OFFRES.map((s) => <option key={s} value={s}>{s}</option>)}</select>{erreurChamp("secteur")}</label>
          <label className={styles.field} htmlFor="offre-type">Type de contrat *<select id="offre-type" value={formulaire.type} onChange={(e) => changer("type", e.target.value as TypeOffre)}>{TYPES_OFFRE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className={styles.field} htmlFor="offre-modeTravail">Mode de travail *<select id="offre-modeTravail" value={formulaire.modeTravail} onChange={(e) => changer("modeTravail", e.target.value as ModeTravail)}>{MODES_TRAVAIL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <div className={`${styles.field} ${styles.full}`} role="group" aria-labelledby="offre-salaire-titre" aria-describedby={erreurs.salaire ? "erreur-salaire" : undefined}>
            <span id="offre-salaire-titre">Salaire proposé <span className={styles.optionalInline}>(facultatif)</span></span>
            <div className={styles.salaryRow}>
              <input id="offre-salaire" aria-label="Montant minimum" aria-invalid={Boolean(erreurs.salaire)} type="number" inputMode="decimal" min={0} step="any" value={salaire.minimum} onChange={(e) => changerSalaire({ minimum: e.target.value })} placeholder="Minimum" />
              <input aria-label="Montant maximum (facultatif)" aria-invalid={Boolean(erreurs.salaire)} type="number" inputMode="decimal" min={0} step="any" value={salaire.maximum} onChange={(e) => changerSalaire({ maximum: e.target.value })} placeholder="Maximum (facultatif)" />
              <select aria-label="Devise" value={salaire.devise} onChange={(e) => changerSalaire({ devise: e.target.value })}>{DEVISES_SALAIRE.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
              <select aria-label="Période" value={salaire.periode} onChange={(e) => changerSalaire({ periode: e.target.value as Periode })}>{PERIODES_SALAIRE.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
            </div>
            {salaire.repli && <label className={styles.salaryFallback} htmlFor="offre-salaire-repli"><span className={styles.note}>Valeur actuelle, conservée si vous ne saisissez pas de montant :</span><input id="offre-salaire-repli" value={salaire.repli} onChange={(e) => changerSalaire({ repli: e.target.value })} maxLength={190} /></label>}
            {formulaire.salaire && !erreurs.salaire && <span className={styles.note}>Affiché : {formulaire.salaire}</span>}
            {erreurChamp("salaire")}
          </div>
        </div></fieldset>
        <fieldset disabled={envoi} className={styles.section}><legend className={styles.legend}>Localisation</legend><div className={styles.grid}>
          <ChampsPaysVille
            idPrefixe="offre" pays={formulaire.pays} ville={formulaire.ville} paysRequis
            libellePays="Pays *" libelleVille="Ville (facultatif)"
            classes={{ champ: styles.field }}
            onChange={({ pays, ville }) => { changer("pays", pays); changer("ville", ville); }}
            paysInvalide={Boolean(erreurs.pays)} villeInvalide={Boolean(erreurs.ville)}
            erreurPays={erreurs.pays ? <span id="erreur-offre-pays" className={styles.fieldError}>{erreurs.pays}</span> : null}
            erreurVille={erreurs.ville ? <span id="erreur-offre-ville" className={styles.fieldError}>{erreurs.ville}</span> : null}
          />
        </div></fieldset>
        <fieldset disabled={envoi} className={styles.section}><legend className={styles.legend}>L’offre en détail</legend><div className={styles.grid}>
          <label className={`${styles.field} ${styles.full}`} htmlFor="offre-description">Description du poste *<textarea {...attributs("description")} value={formulaire.description} onChange={(e) => changer("description", e.target.value)} required minLength={20} maxLength={10000} rows={7} placeholder="Présentez les missions, l’équipe et les conditions du poste." />{erreurChamp("description")}</label>
          <label className={`${styles.field} ${styles.full}`} htmlFor="offre-profilRecherche">Profil recherché <span className={styles.note}>Facultatif</span><textarea {...attributs("profilRecherche")} value={formulaire.profilRecherche} onChange={(e) => changer("profilRecherche", e.target.value)} maxLength={10000} rows={5} placeholder="Compétences, expérience et qualifications attendues." />{erreurChamp("profilRecherche")}</label>
        </div></fieldset>
        <fieldset disabled={envoi} className={styles.section}><legend className={styles.legend}>Comment candidater ?</legend><div className={styles.radioGrid}>{MODES_CANDIDATURE.map((o) => <label key={o.value} className={styles.radio}><input type="radio" name="modeCandidature" value={o.value} checked={formulaire.modeCandidature === o.value} onChange={() => changer("modeCandidature", o.value)} /><span><strong>{o.label}</strong><span className={styles.note}>{o.value === "MALI_WULI" ? "Recevez les candidatures dans la messagerie Mali Wuli." : o.value === "EMAIL" ? "Recevez les candidatures par e-mail." : "Dirigez les candidats vers votre page de recrutement."}</span></span></label>)}</div>
          {formulaire.modeCandidature === "EMAIL" && <label className={styles.field} style={{ marginTop: 16 }} htmlFor="offre-emailContact">Adresse e-mail de réception<input {...attributs("emailContact")} type="email" value={formulaire.emailContact} onChange={(e) => changer("emailContact", e.target.value)} maxLength={190} autoComplete="email" placeholder={emailCompte || "contact@entreprise.com"} /><span className={styles.note}>Si vous laissez ce champ vide, les candidatures seront envoyées à l’adresse du compte qui a déposé l’offre.</span>{erreurChamp("emailContact")}</label>}
          {formulaire.modeCandidature === "LIEN_EXTERNE" && <label className={styles.field} style={{ marginTop: 16 }} htmlFor="offre-lienCandidature">Lien de candidature *<input {...attributs("lienCandidature")} type="url" value={formulaire.lienCandidature} onChange={(e) => changer("lienCandidature", e.target.value)} maxLength={2048} required placeholder="https://entreprise.com/recrutement" />{erreurChamp("lienCandidature")}</label>}
        </fieldset>
        <fieldset disabled={envoi} className={styles.section}><div className={styles.grid}><label className={`${styles.field} ${styles.full}`} htmlFor="offre-dateExpiration">Date limite de candidature <span className={styles.note}>Facultatif · clôture à 23 h 59 UTC à cette date.</span><input {...attributs("dateExpiration")} type="date" value={formulaire.dateExpiration} onChange={(e) => changer("dateExpiration", e.target.value)} />{erreurChamp("dateExpiration")}</label><label className={`${styles.checkbox} ${styles.full}`}><input type="checkbox" checked={formulaire.recommandationPossible} onChange={(e) => changer("recommandationPossible", e.target.checked)} /><span>Je peux recommander un membre pour ce poste.</span></label></div></fieldset>
        <p className={styles.note}>{offreId ? "Toute modification soumet à nouveau l’offre à validation avant sa publication." : "Votre offre sera publiée après validation par l’équipe Mali Wuli."}</p>
        <div className={styles.actions}><button type="submit" className={styles.primary} disabled={envoi}><Send size={16} aria-hidden />{envoi ? "Envoi en cours…" : offreId ? "Enregistrer et soumettre à nouveau" : "Envoyer pour validation"}</button><Link href="/offres" className={styles.secondary} aria-disabled={envoi} onClick={(e) => { if (envoi) e.preventDefault(); }}>Annuler</Link></div>
      </form>
      <aside className={styles.preview} aria-label="Aperçu de votre offre"><h2 className={styles.previewTitle}>Aperçu de votre offre</h2><div className={styles.panel}><div className={styles.company}><span className={styles.companyIcon}><BriefcaseBusiness size={23} aria-hidden /></span><div><p className={styles.companyName}>{formulaire.entreprise.trim() || "Votre entreprise"}</p><p className={styles.muted}>{formulaire.secteur || "Secteur d’activité"}</p></div></div><h2>{formulaire.titre.trim() || "Titre du poste"}</h2><div className={styles.tags}><span className={`${styles.tag} ${styles.tagGreen}`}>{TYPES_OFFRE.find((o) => o.value === formulaire.type)?.label}</span><span className={styles.tag}>{MODES_TRAVAIL.find((o) => o.value === formulaire.modeTravail)?.label}</span>{formulaire.recommandationPossible && <span className={styles.tag}>Recommandation possible</span>}</div><p className={styles.muted}><MapPin size={13} aria-hidden style={{ display: "inline", marginRight: 4 }} />{[formulaire.ville, formulaire.pays].filter(Boolean).join(", ") || "Localisation"}</p><p className={`${styles.description} ${styles.previewText}`}>{formulaire.description.trim() || "La présentation du poste apparaîtra ici au fil de votre saisie."}</p><div className={styles.previewFooter}>{formulaire.salaire && <p className={styles.note}>{formulaire.salaire}</p>}<p className={styles.note}>Candidature {MODES_CANDIDATURE.find((o) => o.value === formulaire.modeCandidature)?.label.toLocaleLowerCase("fr")}</p><p className={styles.note}>Cette offre sera visible après validation.</p></div></div></aside>
    </div>}
  </main>;
}

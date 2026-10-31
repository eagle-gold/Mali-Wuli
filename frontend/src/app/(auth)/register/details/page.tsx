"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { BadgeCheck } from "lucide-react";
import CoqueAuth from "@/components/auth/CoqueAuth";
import { Alerte, ChampMotDePasse, ChampTexte } from "@/components/auth/Champs";
import { classesBouton } from "@/components/ui/classes";
import api from "@/lib/api";
import { motDePasseValide } from "@/lib/mot-de-passe";
import { enregistrerSession } from "@/lib/session";

type Erreurs = Partial<Record<"prenom" | "nom" | "motDePasse", string>>;

function validerIdentite(valeur: string, libelle: string) {
  const texte = valeur.trim();
  if (!texte) return `Indiquez votre ${libelle}.`;
  if (texte.length < 2) return `Votre ${libelle} doit contenir au moins 2 caractères.`;
  return undefined;
}

export default function RegisterDetailsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurServeur, setErreurServeur] = useState("");

  useEffect(() => {
    const adresse = localStorage.getItem("mali_wuli_pending_email")?.trim() || "";
    if (!localStorage.getItem("mali_wuli_registration_token") || !adresse) {
      router.replace("/register");
      return;
    }
    setEmail(adresse.toLowerCase());
  }, [router]);

  const valider = (valeurs = { prenom, nom, motDePasse }): Erreurs => ({
    prenom: validerIdentite(valeurs.prenom, "prénom"),
    nom: validerIdentite(valeurs.nom, "nom"),
    motDePasse: motDePasseValide(valeurs.motDePasse) ? undefined : "Le mot de passe ne respecte pas encore toutes les règles.",
  });

  // Après une première tentative, les erreurs se mettent à jour pendant la saisie.
  const maj = (champ: keyof Erreurs, valeur: string) => {
    const valeurs = { prenom, nom, motDePasse, [champ]: valeur };
    if (champ === "prenom") setPrenom(valeur);
    if (champ === "nom") setNom(valeur);
    if (champ === "motDePasse") setMotDePasse(valeur);
    setErreurServeur("");
    if (soumis) setErreurs(valider(valeurs));
  };

  const creerCompte = async (event: FormEvent) => {
    event.preventDefault();
    if (envoi) return;
    setSoumis(true);
    const resultat = valider();
    setErreurs(resultat);
    const premiere = (["prenom", "nom", "motDePasse"] as const).find((champ) => resultat[champ]);
    if (premiere) {
      document.querySelector<HTMLInputElement>(`[data-champ="${premiere}"] input`)?.focus();
      return;
    }
    const registrationToken = localStorage.getItem("mali_wuli_registration_token");
    if (!registrationToken) { router.replace("/register"); return; }

    setEnvoi(true);
    setErreurServeur("");
    try {
      const { data } = await api.post<{ token: string; user: { id: string } }>("/auth/register", {
        prenom: prenom.trim(),
        nom: nom.trim(),
        email,
        motDePasse,
        parrainCode: localStorage.getItem("mali_wuli_parrain_code")?.trim() || undefined,
        registrationToken,
      });
      enregistrerSession(data.token, data.user.id);
      for (const cle of ["mali_wuli_pending_email", "mali_wuli_pending_verificationId", "mali_wuli_registration_token", "mali_wuli_parrain_code", "mali_wuli_code_envoye_le"]) {
        localStorage.removeItem(cle);
      }
      router.replace("/onboarding");
    } catch (err) {
      const reponse = axios.isAxiosError<{ message?: string }>(err) ? err.response : undefined;
      if (reponse?.status === 401 || reponse?.status === 403) {
        setErreurServeur("Votre vérification a expiré. Recommencez l’inscription pour recevoir un nouveau code.");
      } else {
        setErreurServeur(reponse?.data?.message || (reponse ? "Impossible de créer votre compte. Réessayez." : "Connexion impossible. Vérifiez votre réseau puis réessayez."));
      }
      setEnvoi(false);
    }
  };

  return (
    <CoqueAuth
      titre="Finalisez votre compte"
      sousTitre="Votre nom apparaîtra sur votre profil et dans l’annuaire des membres."
      etape={{ courante: 3, total: 3, libelle: "Identité" }}
    >
      {email && (
        <p className="-mt-2 mb-6 flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
          <BadgeCheck size={17} aria-hidden="true" className="shrink-0 text-brand" />
          <span className="min-w-0 truncate"><span className="sr-only">Adresse vérifiée : </span>{email}</span>
        </p>
      )}
      {erreurServeur && <Alerte>{erreurServeur}</Alerte>}
      <form onSubmit={creerCompte} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div data-champ="prenom">
            <ChampTexte label="Prénom" autoComplete="given-name" autoCapitalize="words" maxLength={100} autoFocus value={prenom} onChange={(event) => maj("prenom", event.target.value)} erreur={erreurs.prenom} />
          </div>
          <div data-champ="nom">
            <ChampTexte label="Nom" autoComplete="family-name" autoCapitalize="words" maxLength={100} value={nom} onChange={(event) => maj("nom", event.target.value)} erreur={erreurs.nom} />
          </div>
        </div>
        <div data-champ="motDePasse">
          <ChampMotDePasse label="Mot de passe" valeur={motDePasse} onChange={(valeur) => maj("motDePasse", valeur)} erreur={erreurs.motDePasse} />
        </div>
        <button type="submit" disabled={envoi} aria-busy={envoi} className={classesBouton({ taille: "lg", pleineLargeur: true, className: "!mt-8" })}>
          {envoi ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Création du compte…</> : "Créer mon compte"}
        </button>
      </form>
    </CoqueAuth>
  );
}

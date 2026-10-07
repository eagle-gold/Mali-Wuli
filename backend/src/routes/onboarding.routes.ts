import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { champsLiensSociaux, liensSociauxProfil, modificationsLiensSociaux, selectionLiensSociaux } from "../lib/liens-sociaux";
import { LONGUEUR_MAX_TITRE, resoudreTitre, titreParDefaut } from "../lib/titre-profil";
import { authenticate, AuthRequest } from "../middlewares/auth.middleware";
import {
  ErreurCatalogueOnboarding,
  estIdCanonique,
  verifierFormationsEducation,
} from "../services/onboarding-education-validation";

import {
  conserverDiplomesExistants,
  lireDiplomesScolaires,
  normaliserDiplomesScolaires,
  schemaDiplomesScolaires,
  trierParDate,
} from "../services/onboarding-school-records";

const router = Router();

const annee = z.string().regex(/^\d{4}$/).refine((valeur) => {
  const nombre = Number(valeur);
  return nombre >= 1900 && nombre <= 2200;
}, "Année invalide");
const mois = z.string().regex(/^(0[1-9]|1[0-2])$/);
const texteCourt = z.string().trim().max(191);
const note = z.number().int().min(1).max(5).nullable();

export const schemaFormation = z.object({
  id: z.string().max(191).optional(),
  type: z.enum(["ecole", "lycee", "universite"]),
  pays: texteCourt,
  paysCode: z.string().trim().length(2).transform((valeur) => valeur.toUpperCase()),
  systemeEducatifCode: z.string().trim().toUpperCase().regex(/^(?:[A-Z]{2}|AUTRE)$/).optional(),
  diplomesScolaires: schemaDiplomesScolaires.optional(),
  ville: texteCourt,
  etablissement: z.string().trim().min(1).max(300),
  etablissementId: z.string().trim().max(191).default(""),
  etablissementSource: z.string().trim().max(300).optional().default(""),
  programme: z.string().trim().max(300).default(""),
  programmeId: z.string().trim().max(191).default(""),
  specialite: z.string().trim().max(300).default(""),
  specialiteId: z.string().trim().max(191).optional().default(""),
  specialiteEstAutre: z.boolean().optional().default(false),
  moisDebut: mois,
  anneeDebut: annee,
  moisFin: mois,
  anneeFin: annee,
  statutDiplome: z.enum(["OBTENU", "EN_COURS", "NON_OBTENU", "NON_DIPLOMANTE"]),
  diplomeObtenu: z.boolean().optional(),
  diplome: z.string().trim().max(300).default(""),
  diplomeId: z.string().trim().max(191).optional().default(""),
  diplomeEstAutre: z.boolean().optional().default(false),
  mention: z.string().trim().max(191).default(""),
  mentionEstAutre: z.boolean().optional().default(false),
  anneePromo: z.union([annee, z.literal("")]).default(""),
  noteEnseignants: note,
  noteContenu: note,
  noteCadre: note,
  demarcheApresFormation: z.enum(["RECHERCHE_EMPLOI", "POURSUITE_ETUDES", "AUTRE_PROJET"]).nullable(),
  delaiPremierEmploi: z.enum([
    "MOINS_3_MOIS",
    "DE_3_A_6_MOIS",
    "DE_7_A_12_MOIS",
    "PLUS_12_MOIS",
    "MOINS_DE_12_MOIS_DEPUIS_FIN",
    "PAS_ENCORE",
  ]).nullable(),
  emploiDansLes12Mois: z.boolean().nullable(),
  lienEmploiFormation: z.enum(["DIRECT", "PARTIEL", "AUCUN"]).nullable(),
  commentaire: z.string().trim().max(4_000).default(""),
}).superRefine((formation, contexte) => {
  const debut = Number(formation.anneeDebut) * 12 + Number(formation.moisDebut);
  const fin = Number(formation.anneeFin) * 12 + Number(formation.moisFin);
  if (fin < debut) contexte.addIssue({ code: z.ZodIssueCode.custom, message: "La fin de formation précède le début." });
  const estScolaire = formation.type === "ecole" || formation.type === "lycee";
  if (!estScolaire && formation.diplomesScolaires?.length) {
    contexte.addIssue({ code: z.ZodIssueCode.custom, path: ["diplomesScolaires"], message: "Les diplômes scolaires concernent uniquement une école ou un lycée." });
  }
  const verifierAnnee = (valeur: string, obtenu: boolean, chemin: (string | number)[]) => {
    if (!valeur) {
      if (obtenu) contexte.addIssue({ code: z.ZodIssueCode.custom, path: chemin, message: "L’année d’obtention du diplôme est requise." });
      return;
    }
    const nombre = Number(valeur);
    if (nombre < Number(formation.anneeDebut) || nombre > Number(formation.anneeFin)) {
      contexte.addIssue({ code: z.ZodIssueCode.custom, path: chemin, message: "L’année du diplôme doit être comprise dans la période de scolarité." });
    }
    if (obtenu && nombre > new Date().getUTCFullYear()) {
      contexte.addIssue({ code: z.ZodIssueCode.custom, path: chemin, message: "Un diplôme obtenu ne peut pas avoir une année d’obtention future." });
    }
  };
  if (estScolaire && formation.diplomesScolaires?.length) {
    formation.diplomesScolaires.forEach((diplome, index) => {
      verifierAnnee(diplome.anneeObtention, diplome.statut === "OBTENU", ["diplomesScolaires", index, "anneeObtention"]);
    });
  } else if (estScolaire && formation.statutDiplome === "OBTENU") {
    verifierAnnee(formation.anneePromo, true, ["anneePromo"]);
  }
});

const schemaExperience = z.object({
  id: z.string().max(191).optional(),
  poste: z.string().trim().min(1).max(191),
  structure: z.string().trim().min(1).max(191),
  typeContrat: texteCourt,
  pays: texteCourt,
  paysCode: z.string().trim().length(2),
  ville: texteCourt,
  moisDebut: mois,
  anneeDebut: annee,
  moisFin: z.union([mois, z.literal("")]),
  anneeFin: z.union([annee, z.literal("")]),
  posteActuel: z.boolean(),
  description: z.string().trim().max(4_000),
}).superRefine((experience, contexte) => {
  if (experience.posteActuel) return;
  if (!experience.moisFin || !experience.anneeFin) {
    contexte.addIssue({ code: z.ZodIssueCode.custom, message: "La date de fin de l'expérience est requise." });
    return;
  }
  const debut = Number(experience.anneeDebut) * 12 + Number(experience.moisDebut);
  const fin = Number(experience.anneeFin) * 12 + Number(experience.moisFin);
  if (fin < debut) contexte.addIssue({ code: z.ZodIssueCode.custom, message: "La fin de l'expérience précède le début." });
});

const schemaMentorat = z.object({
  estVolontaire: z.boolean(),
  sujets: z.array(z.string().trim().min(1).max(191)).max(20),
  precisionsSujets: z.record(z.string().trim().max(1_000)),
  duree: z.union([z.literal(20), z.literal(30), z.literal(45), z.null()]),
  format: z.enum(["Visio", "Téléphone", "Sur place"]).nullable(),
  fuseauHoraire: z.string().trim().min(1).max(100),
  dateDebut: z.string().trim().max(20),
  dateFin: z.string().trim().max(20).nullable(),
  disponibilites: z.array(z.object({
    jour: z.enum(["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]),
    ouvert: z.boolean(),
    plages: z.array(z.object({
      debut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    })).max(12),
  })).max(7),
  maxRdvMois: z.number().int().min(1).max(100).nullable(),
}).superRefine((mentorat, contexte) => {
  if (!mentorat.estVolontaire) return;
  if (!mentorat.sujets.length) contexte.addIssue({ code: z.ZodIssueCode.custom, message: "Choisissez au moins un sujet de mentorat." });
  if (!mentorat.duree || !mentorat.format) contexte.addIssue({ code: z.ZodIssueCode.custom, message: "La durée et le format du mentorat sont requis." });
  if (!mentorat.disponibilites.some((jour) => jour.ouvert && jour.plages.length)) {
    contexte.addIssue({ code: z.ZodIssueCode.custom, message: "Ajoutez au moins un créneau de mentorat." });
  }
});

const schemaOnboarding = z.object({
  informations: z.object({
    ...champsLiensSociaux,
    prenom: z.string().trim().min(1).max(100),
    nom: z.string().trim().min(1).max(100),
    titre: z.string().trim().max(LONGUEUR_MAX_TITRE).optional(),
    telephone: z.string().trim().max(40),
    indicatif: z.string().trim().max(10),
    pays: z.string().trim().min(1).max(100),
    paysCode: z.string().trim().length(2),
    ville: z.string().trim().min(1).max(191),
  }),
  formations: z.array(schemaFormation).max(30),
  experiences: z.array(schemaExperience).max(30),
  mentorat: schemaMentorat,
});

type DonneesOnboarding = z.infer<typeof schemaOnboarding>;

/** Le champ du questionnaire ne contient que le titre écrit par le membre : vide = titre dynamique. */
const titrePourFormulaire = (profil: { titre: string | null; titrePersonnalise: boolean }) =>
  profil.titrePersonnalise ? profil.titre ?? "" : "";

const deuxChiffres = (valeur: number) => String(valeur).padStart(2, "0");
const anneeDate = (date: Date) => String(date.getUTCFullYear());
const moisDate = (date: Date) => deuxChiffres(date.getUTCMonth() + 1);
const jourDate = (date: Date | null | undefined) => date?.toISOString().slice(0, 10) || "";
const normaliserNom = (valeur: string | null | undefined) => (valeur || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("fr");

function donneesCompletes(donnees: DonneesOnboarding, profilId: string): DonneesOnboarding {
  return {
    ...donnees,
    formations: trierParDate(donnees.formations).map((formation, index) => ({
      ...normaliserDiplomesScolaires(formation),
      id: formation.id || `${profilId}:formation:${index}`,
      diplomeObtenu: formation.statutDiplome === "OBTENU",
    })),
    experiences: trierParDate(donnees.experiences).map((experience, index) => ({
      ...experience,
      id: experience.id || `${profilId}:experience:${index}`,
    })),
  };
}

function valeurJsonTableau(valeur: Prisma.JsonValue | null | undefined) {
  return Array.isArray(valeur) ? valeur : [];
}

function valeurJsonObjet(valeur: Prisma.JsonValue | null | undefined) {
  return valeur && typeof valeur === "object" && !Array.isArray(valeur) ? valeur : {};
}

router.get("/", authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ message: "Session invalide." });
  res.set("Cache-Control", "private, no-store");

  try {
    const compte = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        prenom: true,
        nom: true,
        profil: {
          select: {
            id: true,
            telephone: true,
            titre: true,
            titrePersonnalise: true,
            ...selectionLiensSociaux,
            pays: true,
            ville: true,
            estVolontaire: true,
            onboardingDonnees: true,
            formations: {
              orderBy: [{ anneeDebut: "asc" }, { moisDebut: "asc" }, { id: "asc" }],
              select: {
                id: true,
                type: true,
                autreEtablissement: true,
                moisDebut: true,
                anneeDebut: true,
                moisFin: true,
                anneeFin: true,
                diplome: true,
                systemeEducatifCode: true,
                diplomesScolaires: true,
                mention: true,
                filiere: true,
                specialite: true,
                serie: true,
                statutDiplome: true,
                demarcheApresFormation: true,
                delaiPremierEmploi: true,
                emploiDansLes12Mois: true,
                lienEmploiFormation: true,
                etablissement: {
                  select: {
                    id: true,
                    nom: true,
                    type: true,
                    ville: true,
                    paysCode: true,
                    systemeEducatifCode: true,
                    pays: { select: { nom: true } },
                  },
                },
                programmeReference: { select: { id: true, nom: true } },
                parcoursReference: { select: { id: true, nom: true } },
                diplomeReference: { select: { id: true, nom: true } },
                avis: {
                  select: {
                    noteEnseignement: true,
                    noteContenu: true,
                    noteInfrastructures: true,
                    commentaire: true,
                    anneePromo: true,
                  },
                },
              },
            },
            experiences: {
              orderBy: [{ dateDebut: "asc" }, { id: "asc" }],
              select: {
                id: true,
                poste: true,
                entreprise: true,
                ville: true,
                pays: true,
                typeContrat: true,
                dateDebut: true,
                dateFin: true,
                estActuel: true,
                description: true,
              },
            },
            volontaire: {
              select: {
                sujets: true,
                precisionsSujets: true,
                fuseau: true,
                dureeCreneau: true,
                format: true,
                dateDebut: true,
                dateFin: true,
                disponibilites: true,
                maxRdvMois: true,
              },
            },
          },
        },
      },
    });
    if (!compte?.profil) return res.status(404).json({ message: "Profil introuvable." });

    // Le snapshot préserve les choix éditoriaux du questionnaire. Les liens
    // sociaux relationnels restent prioritaires après une modification du profil.
    const snapshot = schemaOnboarding.safeParse(compte.profil.onboardingDonnees);
    if (snapshot.success) return res.json(donneesCompletes({
      ...snapshot.data,
      informations: { ...snapshot.data.informations, ...liensSociauxProfil(compte.profil), titre: titrePourFormulaire(compte.profil) },
    }, compte.profil.id));

    // Compatibilité avec les profils enregistrés avant l'ajout du snapshot :
    // on reconstruit au mieux le formulaire depuis les tables normalisées.
    const paysDisponibles = await prisma.paysEducation.findMany({
      select: { code: true, nom: true, indicatif: true },
    });
    const trouverPays = (nom: string | null | undefined) => {
      const recherche = normaliserNom(nom);
      return paysDisponibles.find((pays) => normaliserNom(pays.nom) === recherche);
    };
    const paysProfil = trouverPays(compte.profil.pays);
    const paysParDefaut = paysProfil || paysDisponibles.find(({ code }) => code === "ML");
    const indicatif = paysParDefaut?.indicatif
      ? `+${paysParDefaut.indicatif.replace(/^\+/, "")}`
      : "+223";
    const telephoneComplet = compte.profil.telephone || "";
    const telephone = telephoneComplet.replace(/\s+/g, "").startsWith(indicatif.replace(/\s+/g, ""))
      ? telephoneComplet.replace(/\s+/g, "").slice(indicatif.replace(/\s+/g, "").length)
      : telephoneComplet;

    const formations: DonneesOnboarding["formations"] = compte.profil.formations.map((formation) => {
      const type = formation.type === "ecole" || formation.type === "lycee" || formation.type === "universite"
        ? formation.type
        : formation.etablissement?.type === "LYCEE"
          ? "lycee"
          : formation.etablissement?.type === "FONDAMENTALE"
            ? "ecole"
            : "universite";
      const pays = formation.etablissement?.pays.nom || compte.profil!.pays || paysParDefaut?.nom || "Mali";
      const paysCode = formation.etablissement?.paysCode || trouverPays(pays)?.code || paysParDefaut?.code || "ML";
      const programme = formation.programmeReference?.nom || formation.filiere || "";
      const specialite = formation.parcoursReference?.nom
        || (type !== "universite" ? formation.serie || formation.specialite : formation.specialite)
        || "";
      const diplome = formation.diplomeReference?.nom || formation.diplome || "";
      return {
        id: formation.id,
        type,
        pays,
        paysCode,
        systemeEducatifCode: formation.systemeEducatifCode || formation.etablissement?.systemeEducatifCode || paysCode,
        diplomesScolaires: lireDiplomesScolaires(formation.diplomesScolaires),
        ville: formation.etablissement?.ville || compte.profil!.ville || "",
        etablissement: formation.etablissement?.nom || formation.autreEtablissement || "",
        etablissementId: formation.etablissement?.id || `autre:${formation.id}:etablissement`,
        etablissementSource: "",
        programme,
        programmeId: formation.programmeReference?.id || (programme ? `autre:${formation.id}:programme` : ""),
        specialite,
        specialiteId: formation.parcoursReference?.id || (specialite ? `autre:${formation.id}:specialite` : ""),
        specialiteEstAutre: !formation.parcoursReference && Boolean(specialite),
        moisDebut: deuxChiffres(formation.moisDebut || 1),
        anneeDebut: String(formation.anneeDebut || new Date().getUTCFullYear()),
        moisFin: deuxChiffres(formation.moisFin || formation.moisDebut || 1),
        anneeFin: String(formation.anneeFin || formation.anneeDebut || new Date().getUTCFullYear()),
        statutDiplome: formation.statutDiplome,
        diplomeObtenu: formation.statutDiplome === "OBTENU",
        diplome,
        diplomeId: formation.diplomeReference?.id || (diplome ? `autre:${formation.id}:diplome` : ""),
        diplomeEstAutre: !formation.diplomeReference && Boolean(diplome),
        mention: formation.mention || "",
        mentionEstAutre: false,
        anneePromo: formation.avis?.anneePromo ? String(formation.avis.anneePromo)
          : type !== "universite" && formation.statutDiplome === "OBTENU" && formation.anneeFin
            ? String(formation.anneeFin) : "",
        noteEnseignants: formation.avis?.noteEnseignement ?? null,
        noteContenu: formation.avis?.noteContenu ?? null,
        noteCadre: formation.avis?.noteInfrastructures ?? null,
        demarcheApresFormation: formation.demarcheApresFormation,
        delaiPremierEmploi: formation.delaiPremierEmploi,
        emploiDansLes12Mois: formation.emploiDansLes12Mois,
        lienEmploiFormation: formation.lienEmploiFormation,
        commentaire: formation.avis?.commentaire || "",
      };
    });

    const experiences: DonneesOnboarding["experiences"] = compte.profil.experiences.map((experience) => {
      const pays = experience.pays || compte.profil!.pays || paysParDefaut?.nom || "Mali";
      return {
        id: experience.id,
        poste: experience.poste,
        structure: experience.entreprise,
        typeContrat: experience.typeContrat || "Autre",
        pays,
        paysCode: trouverPays(pays)?.code || paysParDefaut?.code || "ML",
        ville: experience.ville || "",
        moisDebut: moisDate(experience.dateDebut),
        anneeDebut: anneeDate(experience.dateDebut),
        moisFin: experience.dateFin ? moisDate(experience.dateFin) : "",
        anneeFin: experience.dateFin ? anneeDate(experience.dateFin) : "",
        posteActuel: experience.estActuel,
        description: experience.description || "",
      };
    });

    const volontaire = compte.profil.volontaire;
    const mentoratPropose = {
      estVolontaire: compte.profil.estVolontaire && Boolean(volontaire),
      sujets: valeurJsonTableau(volontaire?.sujets),
      precisionsSujets: valeurJsonObjet(volontaire?.precisionsSujets),
      duree: volontaire?.dureeCreneau ?? null,
      format: volontaire?.format ?? null,
      fuseauHoraire: volontaire?.fuseau || "Africa/Bamako",
      dateDebut: jourDate(volontaire?.dateDebut),
      dateFin: volontaire?.dateFin ? jourDate(volontaire.dateFin) : null,
      disponibilites: valeurJsonTableau(volontaire?.disponibilites),
      maxRdvMois: volontaire?.maxRdvMois ?? null,
    };
    const mentorat = schemaMentorat.safeParse(mentoratPropose);
    const donnees: DonneesOnboarding = {
      informations: {
        ...liensSociauxProfil(compte.profil),
        titre: titrePourFormulaire(compte.profil),
        prenom: compte.prenom || "",
        nom: compte.nom || "",
        telephone,
        indicatif,
        pays: compte.profil.pays || paysParDefaut?.nom || "Mali",
        paysCode: paysParDefaut?.code || "ML",
        ville: compte.profil.ville || "",
      },
      formations,
      experiences,
      mentorat: mentorat.success ? mentorat.data : {
        estVolontaire: false,
        sujets: [],
        precisionsSujets: {},
        duree: null,
        format: null,
        fuseauHoraire: "Africa/Bamako",
        dateDebut: "",
        dateFin: null,
        disponibilites: [],
        maxRdvMois: null,
      },
    };
    return res.json(donneesCompletes(donnees, compte.profil.id));
  } catch (erreur) {
    console.error("Échec du chargement de l'onboarding", erreur);
    return res.status(500).json({ message: "Votre profil n'a pas pu être chargé. Réessayez dans un instant." });
  }
});

const dateMois = (anneeValeur: string, moisValeur: string) =>
  new Date(Date.UTC(Number(anneeValeur), Number(moisValeur) - 1, 1));
const valeurOuNull = (valeur: string | undefined) => valeur?.trim() || null;

function avisAutorise(formation: z.infer<typeof schemaFormation>) {
  const aUneNote = [formation.noteEnseignants, formation.noteContenu, formation.noteCadre]
    .some((valeur) => typeof valeur === "number");
  if (!aUneNote) return false;
  if (formation.type === "universite") return true;
  if (formation.statutDiplome !== "OBTENU") return false;
  // Pour les écoles et lycées, la date canonique est celle de fin du parcours
  // enregistrée dans la formation. Le client ne peut donc pas avancer
  // artificiellement l'année de promotion pour débloquer un avis.
  const ouverture = Date.UTC(Number(formation.anneeFin) + 1, Number(formation.moisFin) - 1, 1);
  return ouverture <= Date.now();
}

function calculerEmploiDansLes12Mois(formation: z.infer<typeof schemaFormation>) {
  if (formation.demarcheApresFormation !== "RECHERCHE_EMPLOI") return null;
  if (["MOINS_3_MOIS", "DE_3_A_6_MOIS", "DE_7_A_12_MOIS"].includes(
    formation.delaiPremierEmploi || "",
  )) return true;
  if (["PLUS_12_MOIS", "PAS_ENCORE"].includes(formation.delaiPremierEmploi || "")) return false;
  return null;
}

router.post("/", authenticate, async (req: AuthRequest, res) => {
  const analyse = schemaOnboarding.safeParse(req.body);
  if (!analyse.success) {
    return res.status(400).json({
      message: "Certaines informations du profil sont incomplètes ou invalides.",
      erreurs: analyse.error.flatten(),
    });
  }
  if (!req.userId) return res.status(401).json({ message: "Session invalide." });

  const {
    informations,
    formations: formationsSoumises,
    experiences,
    mentorat,
  } = analyse.data;

  try {
    const compte = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, emailVerifie: true, profil: { select: {
        id: true,
        titre: true,
        titrePersonnalise: true,
        ...selectionLiensSociaux,
        onboardingDonnees: true,
        formations: { select: {
          id: true, type: true, etablissementId: true, autreEtablissement: true,
          anneeDebut: true, anneeFin: true, systemeEducatifCode: true, diplomesScolaires: true,
        } },
      } } },
    });
    if (!compte?.profil) return res.status(404).json({ message: "Profil introuvable." });
    if (!compte.emailVerifie) return res.status(403).json({ message: "Confirmez d'abord votre adresse e-mail." });

    // Les règles d'avis et d'insertion s'appuient uniquement sur le type et
    // les rattachements canoniques de la base. Le navigateur ne peut donc pas
    // déclarer un lycée comme université pour contourner le délai d'avis.
    const ancienSnapshot = schemaOnboarding.safeParse(compte.profil.onboardingDonnees);
    const existantes = [...(ancienSnapshot.success ? ancienSnapshot.data.formations : []), ...compte.profil.formations];
    const formationsCompletees = z.array(schemaFormation).safeParse(formationsSoumises.map((formation) =>
      conserverDiplomesExistants(formation, existantes)));
    if (!formationsCompletees.success) {
      return res.status(400).json({ message: "Vérifiez les dates des diplômes conservés dans votre scolarité.", erreurs: formationsCompletees.error.flatten() });
    }
    const formations = trierParDate(await verifierFormationsEducation(formationsCompletees.data))
      .map((formation) => ({
        ...normaliserDiplomesScolaires(formation),
        // Le snapshot ne conserve pas non plus de réponses d’insertion scolaires.
        ...(formation.type !== "universite" ? {
          demarcheApresFormation: null,
          delaiPremierEmploi: null,
          emploiDansLes12Mois: null,
          lienEmploiFormation: null,
        } : {}),
      }));
    const avisScolaireTropTot = formations.some((formation) => {
      const estScolaire = formation.type === "ecole" || formation.type === "lycee";
      const aUnAvis = [formation.noteEnseignants, formation.noteContenu, formation.noteCadre]
        .some((valeur) => typeof valeur === "number") || Boolean(formation.commentaire.trim());
      return estScolaire && aUnAvis && !avisAutorise(formation);
    });
    if (avisScolaireTropTot) {
      return res.status(400).json({
        message: "Vous pourrez donner votre avis sur une école ou un lycée un an après la fin de votre scolarité.",
      });
    }

    // Titre affiché sous le nom : celui que le membre a écrit, sinon le titre par défaut
    // qui suit son parcours (« Poste - Entreprise », « Étudiant(e) - Université »).
    const titreResolu = resoudreTitre({
      saisi: informations.titre,
      actuel: { titre: compte.profil.titre, personnalise: compte.profil.titrePersonnalise },
      defaut: titreParDefaut(experiences, formations),
    });

    const donneesASauvegarder = donneesCompletes(
      { informations: { ...informations, titre: titreResolu.personnalise ? titreResolu.titre : "", ...liensSociauxProfil({ ...compte.profil, ...modificationsLiensSociaux(informations) }) }, formations, experiences, mentorat },
      compte.profil.id,
    );

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: compte.id },
        data: { prenom: informations.prenom, nom: informations.nom },
      });

      const telephone = informations.telephone
        ? `${informations.telephone.startsWith("+") ? "" : informations.indicatif}${informations.telephone}`.replace(/\s+/g, " ").trim()
        : null;
      await transaction.profil.update({
        where: { id: compte.profil!.id },
        data: {
          telephone,
          titre: titreResolu.titre,
          titrePersonnalise: titreResolu.personnalise,
          // Une omission (ancien client) ne doit jamais effacer un lien récent.
          ...modificationsLiensSociaux(informations),
          pays: informations.pays,
          ville: informations.ville,
          estVolontaire: mentorat.estVolontaire,
          onboardingEtape: 4,
          onboardingFini: true,
          onboardingDonnees: donneesASauvegarder as unknown as Prisma.InputJsonValue,
        },
      });

      await transaction.formation.deleteMany({ where: { profilId: compte.profil!.id } });
      for (const formation of donneesASauvegarder.formations) {
        const etablissementId = estIdCanonique(formation.etablissementId)
          ? formation.etablissementId
          : null;
        const programmeReferenceId = estIdCanonique(formation.programmeId)
          ? formation.programmeId
          : null;
        const parcoursReferenceId = estIdCanonique(formation.specialiteId)
          ? formation.specialiteId
          : null;
        const diplomeReferenceId = estIdCanonique(formation.diplomeId)
          ? formation.diplomeId
          : null;
        const suiviInsertion = formation.type === "universite" && formation.statutDiplome !== "EN_COURS";

        const formationCreee = await transaction.formation.create({
          data: {
            profilId: compte.profil!.id,
            type: formation.type,
            etablissementId,
            programmeReferenceId,
            parcoursReferenceId,
            diplomeReferenceId,
            autreEtablissement: etablissementId ? null : formation.etablissement,
            moisDebut: Number(formation.moisDebut),
            anneeDebut: Number(formation.anneeDebut),
            moisFin: Number(formation.moisFin),
            anneeFin: Number(formation.anneeFin),
            diplome: valeurOuNull(formation.diplome),
            systemeEducatifCode: valeurOuNull(formation.systemeEducatifCode),
            diplomesScolaires: formation.diplomesScolaires === undefined
              ? Prisma.DbNull : formation.diplomesScolaires as Prisma.InputJsonValue,
            mention: valeurOuNull(formation.mention),
            filiere: valeurOuNull(formation.programme),
            specialite: formation.type !== "universite" ? null : valeurOuNull(formation.specialite),
            serie: formation.type !== "universite" ? valeurOuNull(formation.specialite) : null,
            statutDiplome: formation.statutDiplome,
            demarcheApresFormation: suiviInsertion ? formation.demarcheApresFormation : null,
            delaiPremierEmploi: suiviInsertion ? formation.delaiPremierEmploi : null,
            // Valeur calculée côté serveur à partir des réponses détaillées :
            // un client ne peut pas gonfler artificiellement le taux d'insertion.
            emploiDansLes12Mois: suiviInsertion ? calculerEmploiDansLes12Mois(formation) : null,
            lienEmploiFormation: suiviInsertion ? formation.lienEmploiFormation : null,
            enCours: formation.statutDiplome === "EN_COURS",
          },
          select: { id: true },
        });

        if (etablissementId && avisAutorise(formation)) {
          await transaction.avisEtablissement.create({
            data: {
              formationId: formationCreee.id,
              etablissementId,
              noteEnseignement: formation.noteEnseignants,
              noteContenu: formation.noteContenu,
              noteInfrastructures: formation.noteCadre,
              commentaire: valeurOuNull(formation.commentaire),
              anneePromo: formation.type === "universite"
                ? (formation.anneePromo ? Number(formation.anneePromo) : null)
                : Number(formation.anneeFin),
            },
          });
        }
      }

      await transaction.experience.deleteMany({ where: { profilId: compte.profil!.id } });
      for (const experience of donneesASauvegarder.experiences) {
        await transaction.experience.create({
          data: {
            profilId: compte.profil!.id,
            poste: experience.poste,
            entreprise: experience.structure,
            ville: valeurOuNull(experience.ville),
            pays: valeurOuNull(experience.pays),
            typeContrat: valeurOuNull(experience.typeContrat),
            dateDebut: dateMois(experience.anneeDebut, experience.moisDebut),
            dateFin: experience.posteActuel ? null : dateMois(experience.anneeFin, experience.moisFin),
            estActuel: experience.posteActuel,
            description: valeurOuNull(experience.description),
          },
        });
      }

      if (!mentorat.estVolontaire) {
        await transaction.volontaire.deleteMany({ where: { profilId: compte.profil!.id } });
      } else {
        await transaction.volontaire.upsert({
          where: { profilId: compte.profil!.id },
          create: {
            profilId: compte.profil!.id,
            specialite: mentorat.sujets.join(", "),
            sujets: mentorat.sujets,
            precisionsSujets: mentorat.precisionsSujets,
            disponible: true,
            fuseau: mentorat.fuseauHoraire,
            dureeCreneau: mentorat.duree || 30,
            format: mentorat.format,
            dateDebut: mentorat.dateDebut ? new Date(`${mentorat.dateDebut}T00:00:00.000Z`) : null,
            dateFin: mentorat.dateFin ? new Date(`${mentorat.dateFin}T23:59:59.999Z`) : null,
            disponibilites: mentorat.disponibilites,
            maxRdvMois: mentorat.maxRdvMois,
          },
          update: {
            specialite: mentorat.sujets.join(", "),
            sujets: mentorat.sujets,
            precisionsSujets: mentorat.precisionsSujets,
            disponible: true,
            fuseau: mentorat.fuseauHoraire,
            dureeCreneau: mentorat.duree || 30,
            format: mentorat.format,
            dateDebut: mentorat.dateDebut ? new Date(`${mentorat.dateDebut}T00:00:00.000Z`) : null,
            dateFin: mentorat.dateFin ? new Date(`${mentorat.dateFin}T23:59:59.999Z`) : null,
            disponibilites: mentorat.disponibilites,
            maxRdvMois: mentorat.maxRdvMois,
          },
        });
      }
    }, { timeout: 20_000 });

    return res.status(201).json({
      message: "Votre profil a bien été enregistré.",
      onboardingFini: true,
      statut: req.authenticatedUser?.statut ?? "VALIDE",
    });
  } catch (erreur) {
    if (erreur instanceof ErreurCatalogueOnboarding) {
      return res.status(400).json({
        message: erreur.message,
        erreurs: { formations: erreur.erreurs },
      });
    }
    console.error("Échec de l'enregistrement de l'onboarding", erreur);
    return res.status(500).json({ message: "Votre profil n'a pas pu être enregistré. Réessayez dans un instant." });
  }
});

export default router;

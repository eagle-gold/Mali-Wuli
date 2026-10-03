import { filtreNiveauEtablissements as filtreNiveau, lireFacettesEtablissements } from "../services/education-facettes.service";
import { listerPageEtablissementsParMembres, PROFIL_MEMBRE_ELIGIBLE } from "../services/priorite-membres.service";
import {
  Prisma,
  StatutEtablissement,
  TypeEtablissement,
  TypeProgrammeEducation,
  TypeSuggestionCatalogue,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  authenticate,
  authenticateContributor,
  type AuthRequest,
} from "../middlewares/auth.middleware";
import {
  chercherEtablissements,
  chercherProgrammes,
  chercherReferences,
  filtreVilleEtablissements,
  normaliserEducation,
  prismaEducation,
  type TypeRechercheEtablissement,
} from "../education/catalog-service";
import { soumettreSuggestion } from "../education/catalog-suggestion-service";

const router = Router();
const TYPES = new Set<TypeRechercheEtablissement>(["ecole", "lycee", "universite"]);
const suggestionSchema = z.object({
  clientKey: z.string().trim().min(1).max(80),
  type: z.nativeEnum(TypeSuggestionCatalogue),
  libelle: z.string().trim().min(2).max(180),
  paysCode: z.string().trim().regex(/^[A-Za-z]{2}$/),
  ville: z.string().trim().max(120).optional(),
  contexteCle: z.string().trim().max(200).optional(),
  contexte: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

const listeEtablissementsSchema = z.object({
  niveau: z.enum([
    "FONDAMENTALE",
    "LYCEE",
    "UNIVERSITE",
    "ECOLE_SUPERIEURE",
    "INSTITUT",
    "GRANDE_ECOLE",
  ]).optional(),
  pays: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((code) => code.toUpperCase()).optional(),
  ville: z.string().trim().max(120).optional(),
  // Filtre secondaire, proposé quand une ville (chef-lieu au Mali) est choisie.
  commune: z.string().trim().max(120).optional(),
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(12),
});

const idEtablissementSchema = z.string().trim().min(1).max(191);

const TYPES_SUPERIEUR = new Set<TypeEtablissement>([
  TypeEtablissement.UNIVERSITE,
  TypeEtablissement.ECOLE_SUPERIEURE,
]);

const tonalites = ["vert", "orange", "sable", "olive"] as const;

function tonaliteDepuisId(id: string) {
  const valeur = [...id].reduce((total, caractere) => total + caractere.charCodeAt(0), 0);
  return tonalites[valeur % tonalites.length];
}

function moyenneAvis(avis: {
  noteEnseignement: number | null;
  noteContenu: number | null;
  noteInfrastructures: number | null;
  noteInsertion: number | null;
  noteAmbiance: number | null;
}) {
  const notes = [
    avis.noteEnseignement,
    avis.noteContenu,
    avis.noteInfrastructures,
    avis.noteInsertion,
    avis.noteAmbiance,
  ].filter((note): note is number => typeof note === "number" && note >= 1 && note <= 5);
  return notes.length ? notes.reduce((total, note) => total + note, 0) / notes.length : null;
}

function libelleNiveau(type: TypeEtablissement, nom: string) {
  if (type === TypeEtablissement.FONDAMENTALE) return "École fondamentale";
  if (type === TypeEtablissement.LYCEE) return "Lycée";
  if (type === TypeEtablissement.UNIVERSITE) return "Université";
  return /\binstitut\b/i.test(nom) ? "Institut" : "Grande école";
}

function libelleStatut(statut: StatutEtablissement) {
  if (statut === StatutEtablissement.PUBLIC) return "public";
  if (statut === StatutEtablissement.PRIVE) return "privé";
  return null;
}

function initiales(prenom?: string | null, nom?: string | null) {
  const lettres = [prenom, nom]
    .filter((valeur): valeur is string => Boolean(valeur?.trim()))
    .map((valeur) => valeur.trim()[0]?.toLocaleUpperCase("fr"))
    .join("");
  return lettres || "MW";
}

function nomComplet(prenom?: string | null, nom?: string | null) {
  return [prenom, nom].filter((valeur) => valeur?.trim()).join(" ") || "Membre Mali Wuli";
}

function estAncienDeDouzeMois(moisFin: number | null, anneeFin: number | null, maintenant = new Date()) {
  if (!moisFin || !anneeFin || moisFin < 1 || moisFin > 12) return false;
  return (maintenant.getFullYear() - anneeFin) * 12 + (maintenant.getMonth() + 1 - moisFin) >= 12;
}

type FormationPourStatistiques = {
  etablissementId: string | null;
  profilId: string;
  moisFin: number | null;
  anneeFin: number | null;
  demarcheApresFormation: string | null;
  emploiDansLes12Mois: boolean | null;
};

function statistiquesFormations(
  formations: FormationPourStatistiques[],
  estSuperieur: boolean,
) {
  const profils = new Set(formations.map(({ profilId }) => profilId));
  const promotions = new Set(
    formations
      .map(({ anneeFin }) => anneeFin)
      .filter((annee): annee is number => typeof annee === "number" && annee >= 1900),
  );
  const reponsesInsertion = estSuperieur
    ? formations.filter((formation) =>
      formation.demarcheApresFormation === "RECHERCHE_EMPLOI"
      && typeof formation.emploiDansLes12Mois === "boolean"
      && estAncienDeDouzeMois(formation.moisFin, formation.anneeFin))
    : [];
  const inseres = reponsesInsertion.filter(({ emploiDansLes12Mois }) => emploiDansLes12Mois).length;
  return {
    membres: profils.size,
    promotions: promotions.size,
    insertion: estSuperieur && reponsesInsertion.length
      ? Math.round((inseres / reponsesInsertion.length) * 100)
      : null,
    repondantsInsertion: reponsesInsertion.length,
  };
}

// Catalogue public utilisé pendant l'inscription.
router.get("/catalogue/etablissements", async (req, res) => {
  try {
    const paysCode = String(req.query.country || "").toUpperCase();
    const type = String(req.query.type || "") as TypeRechercheEtablissement;
    const ville = String(req.query.city || "").trim().slice(0, 100);
    const recherche = String(req.query.q || "").trim().slice(0, 100);
    if (!/^[A-Z]{2}$/.test(paysCode) || !TYPES.has(type)) {
      res.status(400).json({ message: "Pays ou type d’établissement invalide." });
      return;
    }

    // La recherche utilisateur lit uniquement PostgreSQL. Les sources externes
    // sont importées en amont par les scripts dédiés, jamais pendant la saisie.
    const institutions = await chercherEtablissements({ paysCode, type, ville, recherche });
    res.json({ institutions, stockage: "postgresql" });
  } catch (error) {
    console.error("Catalogue établissements :", error);
    res.status(500).json({ message: "Impossible de consulter le catalogue d’établissements." });
  }
});

router.get("/catalogue/programmes", async (req, res) => {
  try {
    const paysCode = String(req.query.country || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(paysCode)) {
      res.status(400).json({ message: "Code pays invalide." });
      return;
    }
    const etablissementId = String(req.query.institutionId || "").trim() || undefined;
    const programmes = await chercherProgrammes({
      paysCode,
      etablissementId,
      parentId: String(req.query.parentId || "").trim() || undefined,
      recherche: String(req.query.q || "").trim().slice(0, 100),
    });
    const couvertureEtablissement = etablissementId
      ? (await prismaEducation.etablissementProgramme.count({
          where: {
            etablissementId,
            actif: true,
            programme: {
              actif: true,
              type: { not: TypeProgrammeEducation.SERIE },
            },
          },
        })) > 0
      : false;
    res.json({ programmes, couvertureEtablissement, stockage: "postgresql" });
  } catch (error) {
    console.error("Catalogue programmes :", error);
    res.status(500).json({ message: "Impossible de consulter les formations et filières." });
  }
});

router.get("/catalogue/references", async (req, res) => {
  try {
    const paysCode = String(req.query.country || "").toUpperCase();
    const type = String(req.query.type || "") as TypeRechercheEtablissement;
    if (!/^[A-Z]{2}$/.test(paysCode) || !TYPES.has(type)) {
      res.status(400).json({ message: "Pays ou type de formation invalide." });
      return;
    }
    const etablissementId = String(req.query.institutionId || "").trim() || undefined;
    const systemeEducatifCode = String(req.query.systemeEducatifCode || "").trim().toUpperCase() || undefined;
    if (systemeEducatifCode && systemeEducatifCode !== "AUTRE"
      && (!/^[A-Z]{2}$/.test(systemeEducatifCode)
        || !await prismaEducation.paysEducation.findUnique({ where: { code: systemeEducatifCode }, select: { code: true } }))) {
      res.status(400).json({ message: "Programme scolaire invalide." });
      return;
    }
    res.json({ ...(await chercherReferences(paysCode, type, etablissementId, systemeEducatifCode)), stockage: "postgresql" });
  } catch (error) {
    console.error("Catalogue références :", error);
    res.status(500).json({ message: "Impossible de consulter les séries et diplômes." });
  }
});

router.get("/catalogue/stats", async (_req, res) => {
  try {
    const [pays, etablissements, programmes, diplomes, offres, sources] = await Promise.all([
      prismaEducation.paysEducation.count(),
      prismaEducation.etablissement.count(),
      prismaEducation.programmeEducation.count(),
      prismaEducation.diplomeEducation.count(),
      prismaEducation.etablissementProgramme.count(),
      prismaEducation.sourceEducative.count(),
    ]);
    res.json({ pays, etablissements, programmes, diplomes, offres, sources });
  } catch (error) {
    console.error("Statistiques catalogue :", error);
    res.status(500).json({ message: "Impossible de lire les statistiques du catalogue." });
  }
});

// Les valeurs saisies via « Autre » restent privées jusqu'à validation admin.
router.post(
  "/catalogue/suggestions",
  authenticateContributor,
  async (req: AuthRequest, res) => {
    const validation = z.object({ items: z.array(suggestionSchema).min(1).max(5) }).safeParse(req.body);
    if (!validation.success || !req.contributorKey) {
      res.status(400).json({
        message: "Les propositions envoyées sont invalides.",
        erreurs: validation.success ? undefined : validation.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const resultats = [];
      for (const item of validation.data.items) {
        resultats.push(await soumettreSuggestion(
          { ...item, paysCode: item.paysCode.toUpperCase() },
          req.contributorKey,
        ));
      }
      res.status(201).json({
        message: "Proposition enregistrée. Elle sera publiée après validation.",
        resultats,
      });
    } catch (error) {
      console.error("Proposition catalogue :", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Impossible d'enregistrer cette proposition." });
    }
  },
);

// Forum
router.get("/forum", authenticate, (_req, res) => {
  res.status(501).json({
    code: "FONCTIONNALITE_INDISPONIBLE",
    message: "Le forum Éducation n'est pas encore disponible.",
  });
});

router.post("/forum", authenticate, (_req, res) => {
  res.status(501).json({
    code: "FONCTIONNALITE_INDISPONIBLE",
    message: "La publication dans le forum Éducation n'est pas encore disponible.",
  });
});

// Établissements. Les chiffres exposés ci-dessous proviennent exclusivement
// des parcours et avis validés en base ; aucune statistique de démonstration
// n'est injectée quand les réponses sont absentes.
router.get("/etablissements", authenticate, async (req, res) => {
  const validation = listeEtablissementsSchema.safeParse(req.query);
  if (!validation.success) {
    res.status(400).json({ message: "Filtres invalides.", erreurs: validation.error.flatten().fieldErrors });
    return;
  }

  try {
    const { niveau, pays, ville, commune, q, page, limite } = validation.data;
    const termes = normaliserEducation(q).split(" ").filter(Boolean);
    const villeNormalisee = normaliserEducation(ville || "");
    // Mali : ville = chef-lieu de région ; une commune ou une localité saisie
    // comme « ville » reste trouvée (filtreVilleEtablissements).
    const filtreVille = pays === "ML"
      ? filtreVilleEtablissements("ML", ville)
      : villeNormalisee ? { villeNormalisee: { contains: villeNormalisee } } : null;
    const baseWhere: Prisma.EtablissementWhereInput = {
      valide: true,
      ...filtreNiveau(niveau),
      ...(pays ? { paysCode: pays } : {}),
      AND: [
        ...(filtreVille ? [filtreVille] : []),
        ...(commune ? [{ commune }] : []),
        ...termes.map((terme) => ({
          OR: [
            { nomNormalise: { contains: terme } },
            { sigle: { contains: terme } },
            { alias: { some: { nomNormalise: { contains: terme } } } },
            { commune: { contains: terme } },
            { localite: { contains: terme } },
          ],
        })),
      ],
    };
    const [etablissements, total, filtres] = await Promise.all([
      listerPageEtablissementsParMembres(prisma, baseWhere, { page, limite }),
      prisma.etablissement.count({ where: baseWhere }),
      lireFacettesEtablissements(prisma, { niveau, pays, ville }),
    ]);

    const ids = etablissements.map(({ id }) => id);
    const [formations, avis] = ids.length
      ? await Promise.all([
          prisma.formation.findMany({
            where: {
              etablissementId: { in: ids },
              profil: PROFIL_MEMBRE_ELIGIBLE,
            },
            select: {
              etablissementId: true,
              profilId: true,
              moisFin: true,
              anneeFin: true,
              demarcheApresFormation: true,
              emploiDansLes12Mois: true,
            },
          }),
          prisma.avisEtablissement.findMany({
            where: {
              etablissementId: { in: ids },
              formation: { profil: PROFIL_MEMBRE_ELIGIBLE },
            },
            select: {
              etablissementId: true,
              noteEnseignement: true,
              noteContenu: true,
              noteInfrastructures: true,
              noteInsertion: true,
              noteAmbiance: true,
            },
          }),
        ])
      : [[], []];

    const resultat = etablissements.map((etablissement) => {
      const formationsEtablissement = formations.filter(({ etablissementId }) => etablissementId === etablissement.id);
      const notes = avis
        .filter(({ etablissementId }) => etablissementId === etablissement.id)
        .map(moyenneAvis)
        .filter((note): note is number => note !== null);
      const estSuperieur = TYPES_SUPERIEUR.has(etablissement.type)
        || etablissement.niveaux.some(({ niveau: niveauEducation }) => niveauEducation === "SUPERIEUR");
      const statistiques = statistiquesFormations(formationsEtablissement, estSuperieur);
      return {
        id: etablissement.id,
        sigle: etablissement.sigle,
        nom: etablissement.nom,
        niveau: libelleNiveau(etablissement.type, etablissement.nom),
        type: etablissement.type,
        paysCode: etablissement.paysCode,
        pays: etablissement.pays.nom,
        ville: etablissement.ville,
        localite: etablissement.localite,
        commune: etablissement.commune,
        cercle: etablissement.cercle,
        region: etablissement.region,
        statut: libelleStatut(etablissement.statut),
        ton: tonaliteDepuisId(etablissement.id),
        resume: etablissement.description,
        note: notes.length ? notes.reduce((somme, note) => somme + note, 0) / notes.length : null,
        nombreAvis: notes.length,
        ...statistiques,
      };
    });

    res.json({
      etablissements: resultat,
      pagination: { page, limite, total, totalPages: Math.ceil(total / limite) },
      filtres,
    });
  } catch (error) {
    console.error("[GET /education/etablissements]", error);
    res.status(500).json({ message: "Impossible de charger les établissements." });
  }
});

router.get("/etablissements/:id", authenticate, async (req: AuthRequest, res) => {
  const id = idEtablissementSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ message: "Identifiant d’établissement invalide." });
    return;
  }

  try {
    const etablissement = await prisma.etablissement.findFirst({
      where: { id: id.data, valide: true },
      select: {
        id: true,
        nom: true,
        sigle: true,
        type: true,
        ville: true,
        localite: true,
        commune: true,
        cercle: true,
        region: true,
        statut: true,
        description: true,
        siteWeb: true,
        paysCode: true,
        pays: { select: { nom: true } },
        niveaux: { select: { niveau: true } },
        programmes: {
          where: { actif: true },
          select: { programme: { select: { nom: true } } },
          orderBy: { programme: { nom: "asc" } },
        },
      },
    });
    if (!etablissement) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    const filtreMembres = {
      etablissementId: etablissement.id,
      profil: { onboardingFini: true, user: { statut: "VALIDE" as const } },
    };
    const [formations, avis, monProfil] = await Promise.all([
      prisma.formation.findMany({
        where: filtreMembres,
        select: {
          profilId: true,
          moisFin: true,
          anneeFin: true,
          demarcheApresFormation: true,
          emploiDansLes12Mois: true,
          statutDiplome: true,
          profil: {
            select: {
              titre: true,
              photo: true,
              pays: true,
              ville: true,
              estVolontaire: true,
              user: { select: { prenom: true, nom: true } },
              experiences: {
                where: { estActuel: true },
                select: { poste: true, entreprise: true, secteur: true, ville: true },
                orderBy: { dateDebut: "desc" },
              },
            },
          },
        },
        orderBy: [{ anneeFin: "desc" }, { id: "desc" }],
      }),
      prisma.avisEtablissement.findMany({
        where: { etablissementId: etablissement.id, formation: { profil: filtreMembres.profil } },
        select: {
          id: true,
          noteEnseignement: true,
          noteContenu: true,
          noteInfrastructures: true,
          noteInsertion: true,
          noteAmbiance: true,
          commentaire: true,
          anneePromo: true,
          createdAt: true,
          formation: {
            select: {
              anneeFin: true,
              profil: {
                select: {
                  photo: true,
                  user: { select: { prenom: true, nom: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      req.userId
        ? prisma.profil.findUnique({
            where: { userId: req.userId },
            select: {
              formations: {
                where: { etablissementId: etablissement.id },
                select: {
                  id: true,
                  moisFin: true,
                  anneeFin: true,
                  statutDiplome: true,
                  avis: { select: { id: true } },
                },
                orderBy: { anneeFin: "desc" },
              },
            },
          })
        : null,
    ]);

    const estSuperieur = TYPES_SUPERIEUR.has(etablissement.type)
      || etablissement.niveaux.some(({ niveau }) => niveau === "SUPERIEUR");
    const statistiques = statistiquesFormations(
      formations.map((formation) => ({ ...formation, etablissementId: etablissement.id })),
      estSuperieur,
    );

    const membresUniques = new Map<string, typeof formations[number]>();
    for (const formation of formations) {
      if (!membresUniques.has(formation.profilId)) membresUniques.set(formation.profilId, formation);
    }
    const membres = [...membresUniques.entries()].map(([profilId, formation]) => ({
      id: profilId,
      initiales: initiales(formation.profil.user.prenom, formation.profil.user.nom),
      nom: nomComplet(formation.profil.user.prenom, formation.profil.user.nom),
      fonction: formation.profil.titre?.trim() || formation.profil.experiences[0]?.poste || null,
      ville: formation.profil.ville,
      photo: formation.profil.photo,
      promotion: formation.anneeFin,
      ton: tonaliteDepuisId(profilId),
    }));

    const employeursGroupes = new Map<string, {
      nom: string;
      secteur: string | null;
      ville: string | null;
      profils: Set<string>;
    }>();
    for (const [profilId, formation] of membresUniques) {
      for (const experience of formation.profil.experiences) {
        const nomNormalise = normaliserEducation(experience.entreprise);
        if (!nomNormalise) continue;
        const groupe = employeursGroupes.get(nomNormalise) || {
          nom: experience.entreprise,
          secteur: experience.secteur,
          ville: experience.ville,
          profils: new Set<string>(),
        };
        groupe.profils.add(profilId);
        employeursGroupes.set(nomNormalise, groupe);
      }
    }

    const villesGroupes = new Map<string, { ville: string; profils: Set<string> }>();
    for (const [profilId, formation] of membresUniques) {
      const villeMembre = formation.profil.ville?.trim();
      if (!villeMembre) continue;
      const cle = normaliserEducation(villeMembre);
      const groupe = villesGroupes.get(cle) || { ville: villeMembre, profils: new Set<string>() };
      groupe.profils.add(profilId);
      villesGroupes.set(cle, groupe);
    }

    const notesEtAvis = avis.flatMap((avisEtablissement) => {
      const note = moyenneAvis(avisEtablissement);
      return note === null ? [] : [{ avis: avisEtablissement, note }];
    });
    const noteMoyenne = notesEtAvis.length
      ? notesEtAvis.reduce((somme, { note }) => somme + note, 0) / notesEtAvis.length
      : null;
    const paysEtablissement = normaliserEducation(etablissement.pays.nom);
    const diaspora = [...membresUniques.values()].filter(({ profil }) => {
      const paysMembre = normaliserEducation(profil.pays || "");
      return Boolean(paysMembre && paysMembre !== paysEtablissement && paysMembre !== etablissement.paysCode.toLocaleLowerCase("fr"));
    }).length;
    const volontaires = [...membresUniques.values()].filter(({ profil }) => profil.estVolontaire).length;
    const maFormation = monProfil?.formations[0];
    const estScolaire = etablissement.type === TypeEtablissement.FONDAMENTALE
      || etablissement.type === TypeEtablissement.LYCEE;
    const peutDonnerAvis = Boolean(
      maFormation
      && (!estScolaire || (
        maFormation.statutDiplome === "OBTENU"
        && estAncienDeDouzeMois(maFormation.moisFin, maFormation.anneeFin)
      )),
    );

    res.json({
      etablissement: {
        id: etablissement.id,
        sigle: etablissement.sigle,
        nom: etablissement.nom,
        niveau: libelleNiveau(etablissement.type, etablissement.nom),
        type: etablissement.type,
        paysCode: etablissement.paysCode,
        pays: etablissement.pays.nom,
        ville: etablissement.ville,
        localite: etablissement.localite,
        commune: etablissement.commune,
        cercle: etablissement.cercle,
        region: etablissement.region,
        statut: libelleStatut(etablissement.statut),
        description: etablissement.description,
        siteWeb: etablissement.siteWeb,
        ton: tonaliteDepuisId(etablissement.id),
        parcours: [...new Set(etablissement.programmes.map(({ programme }) => programme.nom))],
        note: noteMoyenne,
        nombreAvis: notesEtAvis.length,
        ...statistiques,
        diaspora,
        volontaires,
        membresApercu: membres.slice(0, 12),
        avisApercu: notesEtAvis.map(({ avis: avisEtablissement, note }) => ({
          id: avisEtablissement.id,
          initiales: initiales(
            avisEtablissement.formation.profil.user.prenom,
            avisEtablissement.formation.profil.user.nom,
          ),
          nom: nomComplet(
            avisEtablissement.formation.profil.user.prenom,
            avisEtablissement.formation.profil.user.nom,
          ),
          photo: avisEtablissement.formation.profil.photo,
          promotion: avisEtablissement.anneePromo || avisEtablissement.formation.anneeFin,
          createdAt: avisEtablissement.createdAt,
          note,
          commentaire: avisEtablissement.commentaire,
          ton: tonaliteDepuisId(avisEtablissement.id),
        })),
        employeurs: [...employeursGroupes.values()]
          .map((groupe) => ({
            nom: groupe.nom,
            secteur: groupe.secteur,
            ville: groupe.ville,
            membres: groupe.profils.size,
          }))
          .sort((a, b) => b.membres - a.membres || a.nom.localeCompare(b.nom, "fr"))
          .slice(0, 8),
        villesAnciens: [...villesGroupes.values()]
          .map((groupe) => ({ ville: groupe.ville, membres: groupe.profils.size }))
          .sort((a, b) => b.membres - a.membres || a.ville.localeCompare(b.ville, "fr"))
          .slice(0, 8),
      },
      moi: {
        affilie: Boolean(maFormation),
        formationId: maFormation?.id || null,
        avisId: maFormation?.avis?.id || null,
        peutDonnerAvis,
      },
    });
  } catch (error) {
    console.error("[GET /education/etablissements/:id]", error);
    res.status(500).json({ message: "Impossible de charger cet établissement." });
  }
});

// Associations
router.get("/associations", authenticate, (_req, res) => {
  res.status(501).json({
    code: "FONCTIONNALITE_INDISPONIBLE",
    message: "L'annuaire des associations n'est pas encore disponible.",
  });
});

router.post("/associations/:id/affilier", authenticate, (_req, res) => {
  res.status(501).json({
    code: "FONCTIONNALITE_INDISPONIBLE",
    message: "Les demandes d'affiliation à une association ne sont pas encore disponibles.",
  });
});

export default router;

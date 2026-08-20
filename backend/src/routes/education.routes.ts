import { TypeSuggestionCatalogue } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  authenticateContributor,
  type AuthRequest,
} from "../middlewares/auth.middleware";
import {
  chercherEtablissements,
  chercherProgrammes,
  chercherReferences,
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
      ? (await prismaEducation.etablissementProgramme.count({ where: { etablissementId, actif: true } })) > 0
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
    res.json({ ...(await chercherReferences(paysCode, type, etablissementId)), stockage: "postgresql" });
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
router.get("/forum", authenticate, async (_req, res) => {
  res.json({ message: "Questions du forum — à implémenter" });
});

router.post("/forum", authenticate, async (_req, res) => {
  res.json({ message: "Poser une question — à implémenter" });
});

// Établissements
router.get("/etablissements", authenticate, async (_req, res) => {
  res.json({ message: "Liste établissements — à implémenter" });
});

router.get("/etablissements/:id", authenticate, async (_req, res) => {
  res.json({ message: "Fiche établissement — à implémenter" });
});

// Associations
router.get("/associations", authenticate, async (_req, res) => {
  res.json({ message: "Liste associations — à implémenter" });
});

router.post("/associations/:id/affilier", authenticate, async (_req, res) => {
  res.json({ message: "Demande affiliation — à implémenter" });
});

export default router;

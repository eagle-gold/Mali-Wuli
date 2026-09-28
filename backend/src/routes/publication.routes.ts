import { Prisma, type PrismaClient } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { urlHttpSchema } from "../lib/validation";
import { authenticate, AuthRequest } from "../middlewares/auth.middleware";
import {
  supprimerUpload,
  uploadPublication,
  verifierImageChargee,
} from "../middlewares/upload.middleware";
import { obtenirSocket } from "../realtime/socket";
import { creerNotification, creerNotifications } from "../services/notification.service";

import { creerServiceSuppressionsPublications, ErreurSuppressionPublication, peutSupprimerPublication, peutSupprimerCommentaire, type ActeurPublication } from "../services/publication-suppression.service";

/** Injection limitée aux effets et à Prisma pour des tests sans base/fichiers/socket. */
export function creerRouteurPublications(options: {
  db?: PrismaClient;
  retirerMedia?: typeof supprimerUpload;
  obtenirSocket?: typeof obtenirSocket;
} = {}) {
const db = options.db || prisma;
const retirerMedia = options.retirerMedia || supprimerUpload;
const socket = options.obtenirSocket || obtenirSocket;
const router = Router();
const suppressions = creerServiceSuppressionsPublications(db);

const AUTEUR_SELECT = {
  id: true,
  photo: true,
  titre: true,
  ville: true,
  pays: true,
  user: { select: { prenom: true, nom: true } },
} as const;

const COMMENTAIRE_SELECT = {
  id: true,
  contenu: true,
  parentId: true,
  createdAt: true,
  auteur: { select: AUTEUR_SELECT },
  reponses: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      contenu: true,
      parentId: true,
      createdAt: true,
      auteur: { select: AUTEUR_SELECT },
    },
  },
} as const;

const COMMENTAIRE_PLAT_SELECT = {
  id: true,
  contenu: true,
  parentId: true,
  createdAt: true,
  auteur: { select: AUTEUR_SELECT },
} as const;

const PUBLICATION_SELECT = {
  id: true,
  intention: true,
  thematique: true,
  type: true,
  contenu: true,
  photoUrl: true,
  lienUrl: true,
  lienTitre: true,
  lienImage: true,
  epingle: true,
  createdAt: true,
  updatedAt: true,
  auteur: { select: AUTEUR_SELECT },
  reactions: { select: { auteurId: true, type: true } },
  commentaires: {
    where: { parentId: null },
    orderBy: { createdAt: "asc" as const },
    take: 3,
    select: COMMENTAIRE_SELECT,
  },
  _count: { select: { commentaires: true } },
} as const;

type PublicationComplete = Prisma.PublicationGetPayload<{ select: typeof PUBLICATION_SELECT }>;
type CommentairePlat = Prisma.CommentairePublicationGetPayload<{
  select: typeof COMMENTAIRE_PLAT_SELECT;
}>;
type CommentaireAvecReponses = CommentairePlat & { reponses: CommentaireAvecReponses[] };

const listeSchema = z.object({
  cursor: z.string().trim().min(1).max(191).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(15),
  filtre: z.enum(["tout", "cercles", "pays", "ville"]).optional(),
  scope: z.enum(["tout", "cercles", "pays", "ville"]).optional(),
});

const creerSchema = z.object({
  intention: z.enum(["OFFRE", "DEMANDE"]),
  thematique: z.string().trim().min(2).max(80),
  contenu: z.string().trim().max(1200).default(""),
  lienUrl: z.union([urlHttpSchema(), z.literal("")]).optional(),
  lienTitre: z.string().trim().max(191).optional(),
});

const modificationPublicationSchema = z.object({
  contenu: z.string().trim().max(1200),
});

const modificationCommentaireSchema = z.object({
  contenu: z.string().trim().min(1).max(1000),
});

const reactionSchema = z.object({
  type: z.enum(["LIKE", "BRAVO", "SOUTIEN", "INSTRUCTIF", "INSPIRANT"]).default("SOUTIEN"),
});

const listeReactionsSchema = z.object({
  cursor: z.string().trim().min(1).max(191).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(25),
});

const commentaireSchema = z.object({
  contenu: z.string().trim().min(1).max(1000),
  parentId: z.string().trim().min(1).max(191).optional(),
});

function nomAuteur(auteur: { user: { prenom: string | null; nom: string | null } }) {
  return [auteur.user.prenom, auteur.user.nom].filter(Boolean).join(" ") || "Un membre";
}

function construireArbreCommentaires(commentaires: CommentairePlat[]): CommentaireAvecReponses[] {
  const parId = new Map<string, CommentaireAvecReponses>();
  for (const commentaire of commentaires) {
    parId.set(commentaire.id, { ...commentaire, reponses: [] });
  }

  const racines: CommentaireAvecReponses[] = [];
  for (const commentaire of commentaires) {
    const noeud = parId.get(commentaire.id)!;
    const parent = commentaire.parentId ? parId.get(commentaire.parentId) : null;
    if (parent && parent.id !== noeud.id) parent.reponses.push(noeud);
    else racines.push(noeud);
  }
  return racines;
}

type CommentairePourAffichage = CommentairePlat & { reponses?: CommentairePourAffichage[] };
type CommentaireAvecDroits = CommentairePlat & { peutSupprimer: boolean; peutModifier: boolean; reponses: CommentaireAvecDroits[] };
function formaterCommentaires(commentaires: CommentairePourAffichage[], auteurPublicationId: string, acteur: ActeurPublication): CommentaireAvecDroits[] {
  return commentaires.map((commentaire) => ({
    ...commentaire, peutSupprimer: peutSupprimerCommentaire(commentaire.auteur.id, auteurPublicationId, acteur),
    // La modification reste réservée à l'auteur : un modérateur retire, il ne réécrit pas.
    peutModifier: Boolean(acteur.profilId) && commentaire.auteur.id === acteur.profilId,
    reponses: formaterCommentaires(commentaire.reponses || [], auteurPublicationId, acteur),
  }));
}

function formaterPublication(publication: PublicationComplete, monProfilId: string, permissions: readonly string[] = []) {
  const decompteReactions: Record<string, number> = {};
  for (const reaction of publication.reactions) {
    decompteReactions[reaction.type] = (decompteReactions[reaction.type] || 0) + 1;
  }
  const maReaction = publication.reactions.find((reaction) => reaction.auteurId === monProfilId)?.type ?? null;
  const { reactions, _count, ...reste } = publication;
  return {
    ...reste,
    peutSupprimer: peutSupprimerPublication(publication.auteur.id, { profilId: monProfilId, permissions }),
    peutModifier: Boolean(monProfilId) && publication.auteur.id === monProfilId,
    commentaires: formaterCommentaires(publication.commentaires, publication.auteur.id, { profilId: monProfilId, permissions }),
    nbReactions: reactions.length,
    decompteReactions,
    maReaction,
    nbCommentaires: _count.commentaires,
  };
}

async function profilDe(userId?: string) {
  if (!userId) return null;
  return db.profil.findUnique({
    where: { userId },
    select: {
      id: true,
      pays: true,
      ville: true,
      user: { select: { prenom: true, nom: true } },
      cerclesMembres: {
        where: { statut: "ACCEPTE" },
        select: { cercleId: true },
      },
    },
  });
}

async function decompteReactions(publicationId: string) {
  const reactions = await db.reactionPublication.findMany({
    where: { publicationId },
    select: { type: true },
  });
  const decompte: Record<string, number> = {};
  for (const reaction of reactions) decompte[reaction.type] = (decompte[reaction.type] || 0) + 1;
  return { nbReactions: reactions.length, decompteReactions: decompte };
}

function lancerNotification(tache: Promise<unknown>, contexte: string) {
  void tache.catch((error) => {
    console.error(`[notifications publications] ${contexte}`, error);
  });
}

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const query = listeSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Filtres invalides." });

  try {
    const profil = await profilDe(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });

    const filtre: Prisma.PublicationWhereInput = {
      visible: true,
      OR: [{ auteurId: profil.id }, { auteur: { user: { statut: "VALIDE" } } }],
    };

    const scope = query.data.filtre ?? query.data.scope ?? "tout";
    if (scope === "pays") {
      if (!profil.pays) return res.json({ publications: [], nextCursor: null, hasMore: false });
      filtre.auteur = { pays: profil.pays };
    } else if (scope === "ville") {
      if (!profil.ville) return res.json({ publications: [], nextCursor: null, hasMore: false });
      filtre.auteur = { ville: profil.ville };
    } else if (scope === "cercles") {
      const cercleIds = profil.cerclesMembres.map(({ cercleId }) => cercleId);
      if (cercleIds.length === 0) return res.json({ publications: [], nextCursor: null, hasMore: false });
      filtre.auteur = {
        cerclesMembres: { some: { cercleId: { in: cercleIds }, statut: "ACCEPTE" } },
      };
    }

    const publications = await db.publication.findMany({
      where: filtre,
      orderBy: [{ epingle: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: query.data.limite + 1,
      ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
      select: PUBLICATION_SELECT,
    });

    const hasMore = publications.length > query.data.limite;
    const donnees = hasMore ? publications.slice(0, query.data.limite) : publications;
    return res.json({
      publications: donnees.map((publication) => formaterPublication(publication, profil.id, req.permissions)),
      hasMore,
      nextCursor: hasMore ? donnees[donnees.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("[GET /publications]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post(
  "/",
  authenticate,
  uploadPublication.single("photo"),
  verifierImageChargee,
  async (req: AuthRequest, res: Response) => {
    const donnees = creerSchema.safeParse(req.body);
    if (!donnees.success || (!donnees.data?.contenu && !req.file && !donnees.data?.lienUrl)) {
      if (req.file) retirerMedia(`/uploads/publications/${req.file.filename}`);
      return res.status(400).json({ message: "Intention, thématique et contenu valides requis." });
    }

    try {
      const profil = await profilDe(req.userId);
      if (!profil) {
        if (req.file) retirerMedia(`/uploads/publications/${req.file.filename}`);
        return res.status(404).json({ message: "Profil introuvable." });
      }
      const photoUrl = req.file ? `/uploads/publications/${req.file.filename}` : null;
      const type = photoUrl ? "PHOTO" : donnees.data.lienUrl ? "LIEN" : "TEXTE";

      const publication = await db.publication.create({
        data: {
          auteurId: profil.id,
          intention: donnees.data.intention,
          thematique: donnees.data.thematique,
          type,
          contenu: donnees.data.contenu,
          photoUrl,
          lienUrl: donnees.data.lienUrl || null,
          lienTitre: donnees.data.lienTitre || null,
        },
        select: PUBLICATION_SELECT,
      });
      const reponse = formaterPublication(publication, profil.id, req.permissions);

      const synergies = await db.synergie.findMany({
        where: {
          statut: "ACCEPTE",
          OR: [{ demandeurId: profil.id }, { recepteurId: profil.id }],
        },
        select: { demandeurId: true, recepteurId: true },
      });
      const destinataires = [...new Set(synergies.map((synergie) =>
        synergie.demandeurId === profil.id ? synergie.recepteurId : synergie.demandeurId,
      ))];
      const auteur = nomAuteur(profil);
      lancerNotification(creerNotifications(destinataires.map((destinataireId) => ({
        destinataireId,
        acteurId: profil.id,
        type: "NOUVELLE_PUBLICATION",
        titre: `${auteur} a publié dans le réseau`,
        detail: `${donnees.data.intention === "OFFRE" ? "Proposition" : "Recherche"} · ${donnees.data.thematique}`,
        href: `/dashboard?publication=${publication.id}`,
        payload: { publicationId: publication.id },
      }))), "création d'une publication");
      // Le broadcast n'est pas personnalisé : le fil recharge ensuite son API.
      const publicationPublique = formaterPublication(publication, "");
      socket()?.emit("nouvelle_publication", { publication: publicationPublique });
      socket()?.emit("publication:created", { publication: publicationPublique });

      return res.status(201).json(reponse);
    } catch (error) {
      if (req.file) retirerMedia(`/uploads/publications/${req.file.filename}`);
      console.error("[POST /publications]", error);
      return res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

router.get("/profil/:profilId", authenticate, async (req: AuthRequest, res: Response) => {
  const profilId = z.string().trim().min(1).max(191).safeParse(req.params.profilId);
  if (!profilId.success) return res.status(400).json({ message: "Identifiant invalide." });
  try {
    const moi = await profilDe(req.userId);
    if (!moi) return res.status(404).json({ message: "Profil introuvable." });
    const publications = await db.publication.findMany({
      where: { auteurId: profilId.data, visible: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: PUBLICATION_SELECT,
    });
    return res.json({ publications: publications.map((publication) => formaterPublication(publication, moi.id, req.permissions)) });
  } catch (error) {
    console.error("[GET /publications/profil/:profilId]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Identifiant invalide." });
  try {
    const profil = await profilDe(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const photo = await suppressions.supprimer(id.data, { profilId: profil.id, permissions: req.permissions || [] });
    try { retirerMedia(photo); } catch { console.error("[publications] Nettoyage média après suppression différé."); }
    try {
      socket()?.emit("publication_supprimee", { publicationId: id.data });
      socket()?.emit("publication:deleted", { publicationId: id.data });
    } catch { console.error("[publications] Diffusion de la suppression différée."); }
    return res.json({ message: "Publication supprimée." });
  } catch (error) {
    if (error instanceof ErreurSuppressionPublication) return res.status(error.statut).json({ message: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ message: "Publication introuvable." });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return res.status(409).json({ message: "La publication a changé. Actualisez avant de réessayer." });
    console.error("[DELETE /publications/:id]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.patch("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  const donnees = modificationPublicationSchema.safeParse(req.body);
  if (!id.success || !donnees.success) return res.status(400).json({ message: "Contenu invalide." });
  try {
    const profil = await profilDe(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const publication = await db.publication.findFirst({
      where: { id: id.data, visible: true },
      select: { id: true, auteurId: true, photoUrl: true, lienUrl: true },
    });
    if (!publication) return res.status(404).json({ message: "Publication introuvable." });
    if (publication.auteurId !== profil.id) return res.status(403).json({ message: "Vous ne pouvez pas modifier cette publication." });
    // Même règle qu'à la création : une publication sans photo ni lien doit garder un texte.
    if (!donnees.data.contenu && !publication.photoUrl && !publication.lienUrl) {
      return res.status(400).json({ message: "Le texte de la publication ne peut pas être vide." });
    }
    const miseAJour = await db.publication.update({
      where: { id: publication.id },
      data: { contenu: donnees.data.contenu },
      select: PUBLICATION_SELECT,
    });
    try {
      socket()?.emit("publication:updated", { publicationId: publication.id });
    } catch { console.error("[publications] Diffusion de la modification différée."); }
    return res.json(formaterPublication(miseAJour, profil.id, req.permissions));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ message: "Publication introuvable." });
    console.error("[PATCH /publications/:id]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/:id/reactions", authenticate, async (req: AuthRequest, res: Response) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  const donnees = reactionSchema.safeParse(req.body);
  if (!id.success || !donnees.success) return res.status(400).json({ message: "Réaction invalide." });

  try {
    const profil = await profilDe(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const publication = await db.publication.findFirst({
      where: { id: id.data, visible: true },
      select: { id: true, auteurId: true, thematique: true },
    });
    if (!publication) return res.status(404).json({ message: "Publication introuvable." });

    const existante = await db.reactionPublication.findUnique({
      where: { publicationId_auteurId: { publicationId: id.data, auteurId: profil.id } },
    });
    let maReaction: string | null;
    let nouvelle = false;
    if (existante?.type === donnees.data.type) {
      await db.reactionPublication.delete({ where: { id: existante.id } });
      maReaction = null;
    } else if (existante) {
      const reaction = await db.reactionPublication.update({
        where: { id: existante.id },
        data: { type: donnees.data.type },
      });
      maReaction = reaction.type;
    } else {
      const reaction = await db.reactionPublication.create({
        data: { publicationId: id.data, auteurId: profil.id, type: donnees.data.type },
      });
      maReaction = reaction.type;
      nouvelle = true;
    }

    const compteurs = await decompteReactions(id.data);
    const reponse = { publicationId: id.data, maReaction, ...compteurs };
    // `maReaction` dépend du membre connecté : ne jamais la diffuser sur le
    // canal global où elle serait interprétée comme la réaction de chacun.
    const payloadTempsReel = { publicationId: id.data, ...compteurs };
    socket()?.emit("reaction_mise_a_jour", payloadTempsReel);
    socket()?.emit("publication:reactionUpdated", payloadTempsReel);
    if (nouvelle && publication.auteurId !== profil.id) {
      lancerNotification(creerNotification({
        destinataireId: publication.auteurId,
        acteurId: profil.id,
        type: "NOUVELLE_REACTION",
        titre: donnees.data.type === "SOUTIEN"
          ? `${nomAuteur(profil)} soutient votre publication`
          : `${nomAuteur(profil)} a réagi à votre publication`,
        detail: publication.thematique,
        href: `/dashboard?publication=${publication.id}`,
        payload: { publicationId: publication.id },
      }), "réaction à une publication");
    }
    return res.json(reponse);
  } catch (error) {
    console.error("[POST /publications/:id/reactions]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id/supporters", authenticate, async (req: AuthRequest, res: Response) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  const query = listeReactionsSchema.safeParse(req.query);
  if (!id.success || !query.success) return res.status(400).json({ message: "Paramètres invalides." });

  try {
    const publication = await db.publication.findFirst({
      where: { id: id.data, visible: true },
      select: { id: true },
    });
    if (!publication) return res.status(404).json({ message: "Publication introuvable." });

    const filtre: Prisma.ReactionPublicationWhereInput = {
      publicationId: publication.id,
      type: "SOUTIEN",
    };
    const [reactions, total] = await Promise.all([
      db.reactionPublication.findMany({
        where: filtre,
        select: {
          id: true,
          auteur: { select: AUTEUR_SELECT },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.data.limite + 1,
        ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
      }),
      db.reactionPublication.count({ where: filtre }),
    ]);
    const hasMore = reactions.length > query.data.limite;
    const donnees = hasMore ? reactions.slice(0, query.data.limite) : reactions;
    return res.json({
      supporters: donnees.map(({ auteur }) => auteur),
      total,
      hasMore,
      nextCursor: hasMore ? donnees[donnees.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("[GET /publications/:id/supporters]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id/reactions", authenticate, async (req: AuthRequest, res: Response) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  const query = listeReactionsSchema.safeParse(req.query);
  if (!id.success || !query.success) return res.status(400).json({ message: "Paramètres invalides." });
  try {
    const publication = await db.publication.findFirst({
      where: { id: id.data, visible: true },
      select: { id: true },
    });
    if (!publication) return res.status(404).json({ message: "Publication introuvable." });

    const filtre: Prisma.ReactionPublicationWhereInput = { publicationId: publication.id };
    const reactions = await db.reactionPublication.findMany({
      where: filtre,
      select: {
        id: true,
        type: true,
        createdAt: true,
        auteur: { select: AUTEUR_SELECT },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.data.limite + 1,
      ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
    });
    const groupes = await db.reactionPublication.groupBy({
      by: ["type"],
      where: filtre,
      _count: { _all: true },
    });
    const decompteReactions = Object.fromEntries(
      groupes.map((groupe) => [groupe.type, groupe._count._all]),
    );
    const nbReactions = groupes.reduce((total, groupe) => total + groupe._count._all, 0);
    const hasMore = reactions.length > query.data.limite;
    const donnees = hasMore ? reactions.slice(0, query.data.limite) : reactions;
    return res.json({
      reactions: donnees,
      decompteReactions,
      nbReactions,
      hasMore,
      nextCursor: hasMore ? donnees[donnees.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("[GET /publications/:id/reactions]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id/commentaires", authenticate, async (req: AuthRequest, res: Response) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Identifiant invalide." });
  try {
    const profil = await profilDe(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const publication = await db.publication.findFirst({ where: { id: id.data, visible: true }, select: { id: true, auteurId: true } });
    if (!publication) return res.status(404).json({ message: "Publication introuvable." });
    const commentaires = await db.commentairePublication.findMany({
      where: { publicationId: id.data },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: COMMENTAIRE_PLAT_SELECT,
    });
    return res.json({
      commentaires: formaterCommentaires(construireArbreCommentaires(commentaires), publication.auteurId, { profilId: profil.id, permissions: req.permissions || [] }),
      total: commentaires.length,
    });
  } catch (error) {
    console.error("[GET /publications/:id/commentaires]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/:id/commentaires", authenticate, async (req: AuthRequest, res: Response) => {
  const id = z.string().trim().min(1).max(191).safeParse(req.params.id);
  const donnees = commentaireSchema.safeParse(req.body);
  if (!id.success || !donnees.success) return res.status(400).json({ message: "Commentaire invalide." });
  try {
    const profil = await profilDe(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const publication = await db.publication.findFirst({
      where: { id: id.data, visible: true },
      select: { id: true, auteurId: true, thematique: true },
    });
    if (!publication) return res.status(404).json({ message: "Publication introuvable." });

    let parent: { id: string; auteurId: string } | null = null;
    if (donnees.data.parentId) {
      parent = await db.commentairePublication.findFirst({
        // Une réponse ne peut viser qu'un commentaire racine. Cela maintient
        // un fil lisible et borne l'arbre à deux niveaux.
        where: { id: donnees.data.parentId, publicationId: id.data, parentId: null },
        select: { id: true, auteurId: true },
      });
      if (!parent) return res.status(400).json({ message: "Commentaire parent invalide." });
    }

    const commentaire = await db.commentairePublication.create({
      data: {
        publicationId: id.data,
        auteurId: profil.id,
        contenu: donnees.data.contenu,
        parentId: parent?.id || null,
      },
      select: COMMENTAIRE_SELECT,
    });
    const nbCommentaires = await db.commentairePublication.count({
      where: { publicationId: id.data },
    });
    const payload = { publicationId: id.data, commentaire, nbCommentaires };
    socket()?.emit("nouveau_commentaire", payload);
    socket()?.emit("publication:commentCreated", payload);

    const destinataireId = parent?.auteurId || publication.auteurId;
    if (destinataireId !== profil.id) {
      lancerNotification(creerNotification({
        destinataireId,
        acteurId: profil.id,
        type: parent ? "NOUVELLE_REPONSE" : "NOUVEAU_COMMENTAIRE",
        titre: parent
          ? `${nomAuteur(profil)} a répondu à votre commentaire`
          : `${nomAuteur(profil)} a commenté votre publication`,
        detail: donnees.data.contenu.slice(0, 240),
        href: `/dashboard?publication=${publication.id}`,
        payload: { publicationId: publication.id, commentaireId: commentaire.id },
      }), parent ? "réponse à un commentaire" : "commentaire d'une publication");
    }
    return res.status(201).json(formaterCommentaires([commentaire], publication.auteurId, { profilId: profil.id, permissions: req.permissions || [] })[0]);
  } catch (error) {
    console.error("[POST /publications/:id/commentaires]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.patch("/:id/commentaires/:commentaireId", authenticate, async (req: AuthRequest, res: Response) => {
  const params = z.object({
    id: z.string().trim().min(1).max(191),
    commentaireId: z.string().trim().min(1).max(191),
  }).safeParse(req.params);
  const donnees = modificationCommentaireSchema.safeParse(req.body);
  if (!params.success || !donnees.success) return res.status(400).json({ message: "Commentaire invalide." });
  try {
    const profil = await profilDe(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const commentaire = await db.commentairePublication.findFirst({
      where: { id: params.data.commentaireId, publicationId: params.data.id },
      select: { id: true, auteurId: true, publication: { select: { auteurId: true } } },
    });
    if (!commentaire) return res.status(404).json({ message: "Commentaire introuvable." });
    if (commentaire.auteurId !== profil.id) return res.status(403).json({ message: "Vous ne pouvez pas modifier ce commentaire." });
    const miseAJour = await db.commentairePublication.update({
      where: { id: commentaire.id },
      data: { contenu: donnees.data.contenu },
      select: COMMENTAIRE_SELECT,
    });
    try {
      socket()?.emit("publication:commentUpdated", { publicationId: params.data.id, commentaireId: commentaire.id });
    } catch { console.error("[publications] Diffusion de la modification du commentaire différée."); }
    return res.json(formaterCommentaires([miseAJour], commentaire.publication.auteurId, { profilId: profil.id, permissions: req.permissions || [] })[0]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ message: "Commentaire introuvable." });
    console.error("[PATCH /publications/:id/commentaires/:commentaireId]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.delete("/:id/commentaires/:commentaireId", authenticate, async (req: AuthRequest, res: Response) => {
  const params = z.object({
    id: z.string().trim().min(1).max(191),
    commentaireId: z.string().trim().min(1).max(191),
  }).safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: "Identifiant invalide." });
  try {
    const profil = await profilDe(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const nbCommentaires = await suppressions.supprimerCommentaire(params.data.id, params.data.commentaireId, { profilId: profil.id, permissions: req.permissions || [] });
    try {
    socket()?.emit("commentaire_supprime", {
      publicationId: params.data.id,
      commentaireId: params.data.commentaireId,
      nbCommentaires,
    });
    socket()?.emit("publication:commentDeleted", {
      publicationId: params.data.id,
      commentaireId: params.data.commentaireId,
      nbCommentaires,
    });
    } catch { console.error("[publications] Diffusion de la suppression du commentaire différée."); }
    return res.json({ message: "Commentaire supprimé.", nbCommentaires });
  } catch (error) {
    if (error instanceof ErreurSuppressionPublication) return res.status(error.statut).json({ message: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return res.status(409).json({ message: "Le commentaire a changé. Actualisez avant de réessayer." });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ message: "Commentaire introuvable." });
    }
    console.error("[DELETE /publications/:id/commentaires/:commentaireId]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

return router;
}

export default creerRouteurPublications();

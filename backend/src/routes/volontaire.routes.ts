import { Prisma } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import {
  formaterProfil,
  paginationMeta,
  paginationSchema,
  profilCourant,
} from "../lib/community";
import {
  bornesMois,
  cleMois,
  fuseauValide,
  genererCreneaux,
  verifierCreneau,
} from "../lib/mentor-availability";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middlewares/auth.middleware";
import { emettreUtilisateur } from "../realtime/socket";
import { creerNotification } from "../services/notification.service";

const router = Router();
const STATUTS_ACTIFS = ["EN_ATTENTE", "ACCEPTE"] as const;

const PROFIL_SELECT = {
  id: true,
  userId: true,
  photo: true,
  titre: true,
  pays: true,
  ville: true,
  situation: true,
  user: { select: { prenom: true, nom: true, statut: true } },
} as const;

const VOLONTAIRE_INCLUDE = {
  profil: { select: PROFIL_SELECT },
} as const;

const RDV_INCLUDE = {
  volontaire: {
    include: { profil: { select: PROFIL_SELECT } },
  },
  demandeur: { select: PROFIL_SELECT },
} as const;

type VolontaireComplet = Prisma.VolontaireGetPayload<{ include: typeof VOLONTAIRE_INCLUDE }>;
type RendezVousComplet = Prisma.RendezVousGetPayload<{ include: typeof RDV_INCLUDE }>;

const listeSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  sujet: z.string().trim().max(100).optional(),
  format: z.string().trim().max(50).optional(),
  pays: z.string().trim().max(100).optional(),
  ville: z.string().trim().max(100).optional(),
});

const creneauxSchema = z.object({
  jours: z.coerce.number().int().min(1).max(60).default(30),
});

const reservationSchema = z.object({
  debut: z.string().datetime({ offset: true }).transform((valeur) => new Date(valeur)),
  motif: z.string().trim().min(10).max(2000),
});

const agendaSchema = paginationSchema.extend({
  role: z.enum(["tous", "demandeur", "volontaire"]).default("tous"),
  periode: z.enum(["a_venir", "passes", "tous"]).default("a_venir"),
});

const reponseSchema = z.object({
  statut: z.enum(["ACCEPTE", "REFUSE"]),
});

function formaterVolontaire(volontaire: VolontaireComplet, monProfilId?: string) {
  const { profil, disponibilites: _disponibilites, ...reste } = volontaire;
  return {
    ...reste,
    fuseau: fuseauValide(volontaire.fuseau),
    profil: formaterProfil(profil),
    ...(monProfilId ? { estMoi: volontaire.profilId === monProfilId } : {}),
  };
}

function formaterRendezVous(rendezVous: RendezVousComplet, monProfilId: string) {
  const estMentor = rendezVous.volontaire.profilId === monProfilId;
  const actif = STATUTS_ACTIFS.includes(rendezVous.statut as (typeof STATUTS_ACTIFS)[number]);
  const aVenir = rendezVous.debut > new Date();
  return {
    id: rendezVous.id,
    debut: rendezVous.debut,
    fin: rendezVous.fin,
    motif: rendezVous.motif,
    statut: rendezVous.statut,
    lienAppel: rendezVous.lienAppel,
    createdAt: rendezVous.createdAt,
    role: estMentor ? "MENTOR" : "DEMANDEUR",
    peutAnnuler: actif && aVenir,
    peutRepondre: estMentor && rendezVous.statut === "EN_ATTENTE" && aVenir,
    volontaire: {
      id: rendezVous.volontaire.id,
      specialite: rendezVous.volontaire.specialite,
      format: rendezVous.volontaire.format,
      profil: formaterProfil(rendezVous.volontaire.profil),
    },
    demandeur: formaterProfil(rendezVous.demandeur),
  };
}

function planningDe(volontaire: {
  fuseau: string;
  dureeCreneau: number;
  dateDebut: Date | null;
  dateFin: Date | null;
  disponibilites: Prisma.JsonValue | null;
  delaiMinResa: number;
}) {
  return {
    fuseau: volontaire.fuseau,
    dureeCreneau: volontaire.dureeCreneau,
    dateDebut: volontaire.dateDebut,
    dateFin: volontaire.dateFin,
    disponibilites: volontaire.disponibilites,
    delaiMinResa: volontaire.delaiMinResa,
  };
}

router.get("/agenda/me", authenticate, async (req: AuthRequest, res: Response) => {
  const query = agendaSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Filtres d'agenda invalides." });

  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const { page, limite, role, periode } = query.data;
    const roleWhere: Prisma.RendezVousWhereInput = role === "demandeur"
      ? { demandeurId: profil.id }
      : role === "volontaire"
        ? { volontaire: { profilId: profil.id } }
        : { OR: [{ demandeurId: profil.id }, { volontaire: { profilId: profil.id } }] };
    const where: Prisma.RendezVousWhereInput = {
      AND: [
        roleWhere,
        ...(periode === "a_venir"
          ? [{ debut: { gte: new Date() } }]
          : periode === "passes"
            ? [{ debut: { lt: new Date() } }]
            : []),
      ],
    };
    const ordre = periode === "passes" ? "desc" : "asc";
    const [total, rendezVous] = await prisma.$transaction([
      prisma.rendezVous.count({ where }),
      prisma.rendezVous.findMany({
        where,
        orderBy: [{ debut: ordre }, { id: ordre }],
        skip: (page - 1) * limite,
        take: limite,
        include: RDV_INCLUDE,
      }),
    ]);
    return res.json({
      rendezVous: rendezVous.map((rdv) => formaterRendezVous(rdv, profil.id)),
      meta: paginationMeta(page, limite, total),
    });
  } catch (error) {
    console.error("[GET /volontaires/agenda/me]", error);
    return res.status(500).json({ message: "Impossible de charger votre agenda." });
  }
});

router.delete("/agenda/:rendezVousId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const id = String(req.params.rendezVousId);
    const rendezVous = await prisma.rendezVous.findUnique({
      where: { id },
      include: RDV_INCLUDE,
    });
    if (!rendezVous) return res.status(404).json({ message: "Rendez-vous introuvable." });
    const estMentor = rendezVous.volontaire.profilId === profil.id;
    if (!estMentor && rendezVous.demandeurId !== profil.id) {
      return res.status(403).json({ message: "Vous ne pouvez pas annuler ce rendez-vous." });
    }
    if (!STATUTS_ACTIFS.includes(rendezVous.statut as (typeof STATUTS_ACTIFS)[number])) {
      return res.status(409).json({ message: "Ce rendez-vous est déjà terminé ou annulé." });
    }

    const changement = await prisma.rendezVous.updateMany({
      where: { id, statut: { in: [...STATUTS_ACTIFS] } },
      data: { statut: "ANNULE", cleReservation: null },
    });
    if (!changement.count) return res.status(409).json({ message: "Le rendez-vous a déjà changé." });

    const destinataire = estMentor ? rendezVous.demandeur : rendezVous.volontaire.profil;
    await creerNotification({
      destinataireId: destinataire.id,
      acteurId: profil.id,
      type: "RENDEZ_VOUS",
      titre: "Un rendez-vous de mentorat a été annulé",
      detail: `Créneau du ${rendezVous.debut.toLocaleString("fr-FR", { timeZone: "UTC" })} UTC.`,
      href: "/agenda",
      payload: { rendezVousId: id, statut: "ANNULE" },
    });
    emettreUtilisateur(rendezVous.demandeur.userId, "rendez_vous_modifie", { rendezVousId: id });
    emettreUtilisateur(rendezVous.volontaire.profil.userId, "rendez_vous_modifie", { rendezVousId: id });
    return res.json({ message: "Rendez-vous annulé.", statut: "ANNULE" });
  } catch (error) {
    console.error("[DELETE /volontaires/agenda/:id]", error);
    return res.status(500).json({ message: "Impossible d'annuler ce rendez-vous." });
  }
});

router.patch("/agenda/:rendezVousId/statut", authenticate, async (req: AuthRequest, res: Response) => {
  const body = reponseSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Réponse invalide." });

  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const id = String(req.params.rendezVousId);
    const rendezVous = await prisma.rendezVous.findUnique({
      where: { id },
      include: RDV_INCLUDE,
    });
    if (!rendezVous) return res.status(404).json({ message: "Rendez-vous introuvable." });
    if (rendezVous.volontaire.profilId !== profil.id) {
      return res.status(403).json({ message: "Seul le mentor peut répondre à cette demande." });
    }
    if (rendezVous.statut !== "EN_ATTENTE") {
      return res.status(409).json({ message: "Cette demande a déjà reçu une réponse." });
    }
    if (rendezVous.debut <= new Date()) {
      return res.status(409).json({ message: "Ce créneau est déjà passé." });
    }

    const resultat = await prisma.rendezVous.updateMany({
      where: { id, statut: "EN_ATTENTE" },
      data: {
        statut: body.data.statut,
        ...(body.data.statut === "REFUSE" ? { cleReservation: null } : {}),
      },
    });
    if (!resultat.count) return res.status(409).json({ message: "Cette demande a déjà changé." });

    await creerNotification({
      destinataireId: rendezVous.demandeurId,
      acteurId: profil.id,
      type: "RENDEZ_VOUS",
      titre: body.data.statut === "ACCEPTE"
        ? "Votre rendez-vous de mentorat est confirmé"
        : "Votre demande de rendez-vous n'est pas disponible",
      detail: `Créneau du ${rendezVous.debut.toLocaleString("fr-FR", { timeZone: "UTC" })} UTC.`,
      href: "/agenda",
      payload: { rendezVousId: id, statut: body.data.statut },
    });
    emettreUtilisateur(rendezVous.demandeur.userId, "rendez_vous_modifie", { rendezVousId: id });
    emettreUtilisateur(rendezVous.volontaire.profil.userId, "rendez_vous_modifie", { rendezVousId: id });
    return res.json({ message: "Réponse enregistrée.", statut: body.data.statut });
  } catch (error) {
    console.error("[PATCH /volontaires/agenda/:id/statut]", error);
    return res.status(500).json({ message: "Impossible de répondre à cette demande." });
  }
});

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const query = listeSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Filtres de volontaires invalides." });

  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const { page, limite, q, sujet, format, pays, ville } = query.data;
    const maintenant = new Date();
    const where: Prisma.VolontaireWhereInput = {
      disponible: true,
      profilId: { not: profil.id },
      AND: [
        { OR: [{ dateDebut: null }, { dateDebut: { lte: maintenant } }] },
        { OR: [{ dateFin: null }, { dateFin: { gte: maintenant } }] },
        { OR: [{ profil: { user: { statut: "VALIDE" } } }, { profilId: profil.id }] },
      ],
      ...(sujet ? { specialite: { contains: sujet } } : {}),
      ...(format ? { format } : {}),
      ...(pays ? { profil: { pays } } : {}),
      ...(ville ? { profil: { ville } } : {}),
      ...(q
        ? {
            OR: [
              { specialite: { contains: q } },
              { profil: { titre: { contains: q } } },
              { profil: { user: { prenom: { contains: q } } } },
              { profil: { user: { nom: { contains: q } } } },
            ],
          }
        : {}),
    };
    const [total, volontaires] = await prisma.$transaction([
      prisma.volontaire.count({ where }),
      prisma.volontaire.findMany({
        where,
        orderBy: [{ specialite: "asc" }, { id: "asc" }],
        skip: (page - 1) * limite,
        take: limite,
        include: VOLONTAIRE_INCLUDE,
      }),
    ]);
    return res.json({
      volontaires: volontaires.map((volontaire) => formaterVolontaire(volontaire, profil.id)),
      meta: paginationMeta(page, limite, total),
    });
  } catch (error) {
    console.error("[GET /volontaires]", error);
    return res.status(500).json({ message: "Impossible de charger les volontaires." });
  }
});

router.get("/:id/creneaux", authenticate, async (req: AuthRequest, res: Response) => {
  const query = creneauxSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Période invalide." });

  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const volontaire = await prisma.volontaire.findFirst({
      where: {
        id: String(req.params.id),
        disponible: true,
        OR: [{ profil: { user: { statut: "VALIDE" } } }, { profilId: profil.id }],
      },
    });
    if (!volontaire) return res.status(404).json({ message: "Volontaire introuvable." });

    const generes = genererCreneaux(planningDe(volontaire), query.data.jours);
    if (!generes.length) {
      return res.json({
        creneaux: [],
        fuseau: fuseauValide(volontaire.fuseau),
        dureeCreneau: volontaire.dureeCreneau,
      });
    }
    const debutGlobal = generes[0].debut;
    const finGlobal = generes[generes.length - 1].fin;
    const premiereBorne = bornesMois(debutGlobal, volontaire.fuseau).debut;
    const derniereBorne = bornesMois(finGlobal, volontaire.fuseau).fin;
    const rendezVous = await prisma.rendezVous.findMany({
      where: {
        volontaireId: volontaire.id,
        statut: { in: [...STATUTS_ACTIFS] },
        debut: { gte: premiereBorne, lt: derniereBorne },
      },
      select: { debut: true, fin: true },
    });
    const compteParMois = new Map<string, number>();
    for (const rendezVousExistant of rendezVous) {
      const mois = cleMois(rendezVousExistant.debut, volontaire.fuseau);
      compteParMois.set(mois, (compteParMois.get(mois) || 0) + 1);
    }
    const creneaux = generes.filter((creneau) => {
      const conflit = rendezVous.some(
        (rdv) => rdv.debut < creneau.fin && rdv.fin > creneau.debut,
      );
      if (conflit) return false;
      if (volontaire.maxRdvMois === null) return true;
      return (compteParMois.get(cleMois(creneau.debut, volontaire.fuseau)) || 0) < volontaire.maxRdvMois;
    });
    return res.json({
      creneaux,
      fuseau: fuseauValide(volontaire.fuseau),
      dureeCreneau: volontaire.dureeCreneau,
    });
  } catch (error) {
    console.error("[GET /volontaires/:id/creneaux]", error);
    return res.status(500).json({ message: "Impossible de calculer les créneaux." });
  }
});

router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const volontaire = await prisma.volontaire.findFirst({
      where: {
        id: String(req.params.id),
        OR: [
          { disponible: true, profil: { user: { statut: "VALIDE" } } },
          { profilId: profil.id },
        ],
      },
      include: VOLONTAIRE_INCLUDE,
    });
    if (!volontaire) return res.status(404).json({ message: "Volontaire introuvable." });
    return res.json({ volontaire: formaterVolontaire(volontaire, profil.id) });
  } catch (error) {
    console.error("[GET /volontaires/:id]", error);
    return res.status(500).json({ message: "Impossible de charger ce volontaire." });
  }
});

router.post("/:id/reserver", authenticate, async (req: AuthRequest, res: Response) => {
  const body = reservationSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      message: "Créneau ou motif invalide.",
      erreurs: body.error.flatten().fieldErrors,
    });
  }

  try {
    const profil = await profilCourant(req.userId);
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });
    const volontaireId = String(req.params.id);
    const reserver = async (tentative = 0): Promise<string> => {
      try {
        return await prisma.$transaction(async (transaction) => {
          const volontaire = await transaction.volontaire.findFirst({
            where: {
              id: volontaireId,
              disponible: true,
              profil: { user: { statut: "VALIDE" } },
            },
          });
          if (!volontaire) throw new Error("VOLONTAIRE_INTROUVABLE");
          if (volontaire.profilId === profil.id) throw new Error("AUTO_RESERVATION");
          const creneau = verifierCreneau(planningDe(volontaire), body.data.debut);
          if (!creneau) throw new Error("CRENEAU_INVALIDE");

          const conflit = await transaction.rendezVous.count({
            where: {
              volontaireId,
              statut: { in: [...STATUTS_ACTIFS] },
              debut: { lt: creneau.fin },
              fin: { gt: creneau.debut },
            },
          });
          if (conflit) throw new Error("CRENEAU_PRIS");
          if (volontaire.maxRdvMois !== null) {
            const bornes = bornesMois(creneau.debut, volontaire.fuseau);
            const totalMois = await transaction.rendezVous.count({
              where: {
                volontaireId,
                statut: { in: [...STATUTS_ACTIFS] },
                debut: { gte: bornes.debut, lt: bornes.fin },
              },
            });
            if (totalMois >= volontaire.maxRdvMois) throw new Error("QUOTA_ATTEINT");
          }

          const rendezVous = await transaction.rendezVous.create({
            data: {
              cleReservation: `${volontaire.id}:${creneau.debut.toISOString()}`,
              volontaireId: volontaire.id,
              demandeurId: profil.id,
              debut: creneau.debut,
              fin: creneau.fin,
              motif: body.data.motif,
              statut: "EN_ATTENTE",
            },
            select: { id: true },
          });
          return rendezVous.id;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === "P2034"
          && tentative < 1
        ) {
          return reserver(tentative + 1);
        }
        throw error;
      }
    };

    const rendezVousId = await reserver();
    const rendezVous = await prisma.rendezVous.findUnique({
      where: { id: rendezVousId },
      include: RDV_INCLUDE,
    });
    if (!rendezVous) throw new Error("RENDEZ_VOUS_INTROUVABLE");

    await creerNotification({
      destinataireId: rendezVous.volontaire.profilId,
      acteurId: profil.id,
      type: "RENDEZ_VOUS",
      titre: "Nouvelle demande de rendez-vous de mentorat",
      detail: `${formaterProfil(profil)?.nomComplet} vous propose un créneau.`,
      href: "/agenda",
      payload: { rendezVousId: rendezVous.id, statut: rendezVous.statut },
    });
    emettreUtilisateur(rendezVous.demandeur.userId, "rendez_vous_modifie", { rendezVousId });
    emettreUtilisateur(rendezVous.volontaire.profil.userId, "rendez_vous_modifie", { rendezVousId });
    return res.status(201).json({
      message: "Demande de rendez-vous envoyée au mentor.",
      rendezVous: formaterRendezVous(rendezVous, profil.id),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Ce créneau vient d'être réservé." });
    }
    if (error instanceof Error) {
      if (error.message === "VOLONTAIRE_INTROUVABLE") return res.status(404).json({ message: "Volontaire introuvable." });
      if (error.message === "AUTO_RESERVATION") return res.status(409).json({ message: "Vous ne pouvez pas réserver avec vous-même." });
      if (error.message === "CRENEAU_INVALIDE") return res.status(409).json({ message: "Ce créneau n'est plus disponible." });
      if (error.message === "CRENEAU_PRIS") return res.status(409).json({ message: "Ce créneau vient d'être réservé." });
      if (error.message === "QUOTA_ATTEINT") return res.status(409).json({ message: "Le mentor a atteint sa limite de rendez-vous ce mois-ci." });
    }
    console.error("[POST /volontaires/:id/reserver]", error);
    return res.status(500).json({ message: "Impossible de réserver ce créneau." });
  }
});

export default router;

import { Prisma, type PrismaClient, type StatutSignalement } from "@prisma/client";
import { z } from "zod";
import { creerNotification, type NouvelleNotification } from "./notification.service";
import { COMMENTAIRE_ACTIF, PUBLICATION_ACTIVE } from "./corbeille.service";

export const TYPES_CIBLE_SIGNALEMENT = ["PUBLICATION", "COMMENTAIRE", "PROFIL", "ASSOCIATION", "ETABLISSEMENT", "EVENEMENT", "OFFRE", "MESSAGE"] as const;
export const MOTIFS_SIGNALEMENT = ["SPAM", "HARCELEMENT", "CONTENU_INAPPROPRIE", "FAUSSE_INFORMATION", "USURPATION", "AUTRE"] as const;
export const STATUTS_SIGNALEMENT = ["EN_ATTENTE", "EN_COURS", "TRAITE", "REJETE"] as const satisfies readonly StatutSignalement[];
export type TypeCibleSignalement = typeof TYPES_CIBLE_SIGNALEMENT[number];

/** Anti-abus : nombre maximal de signalements par membre sur 24 h glissantes. */
export const LIMITE_SIGNALEMENTS_24H = 20;
const FENETRE_LIMITE_MS = 24 * 60 * 60 * 1000;
const STATUTS_OUVERTS: StatutSignalement[] = ["EN_ATTENTE", "EN_COURS"];
const STATUTS_CLOS: StatutSignalement[] = ["TRAITE", "REJETE"];

export const creationSignalementSchema = z.object({
  cibleType: z.enum(TYPES_CIBLE_SIGNALEMENT),
  cibleId: z.string().trim().min(1).max(191),
  motif: z.enum(MOTIFS_SIGNALEMENT),
  details: z.string().trim().max(1000).optional().transform((v) => v || null),
}).strict();

export const filtresSignalementsSchema = z.object({
  statut: z.enum(STATUTS_SIGNALEMENT).optional(),
  type: z.enum(TYPES_CIBLE_SIGNALEMENT).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(200),
});

export const traitementSignalementSchema = z.object({
  statut: z.enum(STATUTS_SIGNALEMENT),
  noteInterne: z.string().trim().max(2000).optional(),
}).strict();

export class ErreurSignalement extends Error {
  constructor(public readonly statut: number, message: string) { super(message); }
}

const nomProfil = (profil?: { user: { prenom: string | null; nom: string | null } } | null) =>
  profil ? [profil.user.prenom, profil.user.nom].filter(Boolean).join(" ") || "Un membre" : null;
const court = (texte?: string | null, max = 160) => {
  const propre = (texte || "").replace(/\s+/g, " ").trim();
  return propre.length > max ? `${propre.slice(0, max - 1)}…` : propre;
};

export type ApercuCible = { existe: boolean; apercu: string | null; auteur: string | null; auteurId: string | null; supprime: boolean; href: string | null };

export function creerServiceSignalements(db: PrismaClient, options: {
  notifier?: (notification: NouvelleNotification) => Promise<unknown>;
  maintenant?: () => Date;
} = {}) {
  const notifier = options.notifier || creerNotification;
  const maintenant = options.maintenant || (() => new Date());

  /** Vérifie que la cible existe et est visible par le signaleur. */
  async function verifierCible(type: TypeCibleSignalement, id: string, profilId: string) {
    switch (type) {
      case "PUBLICATION":
        return Boolean(await db.publication.findFirst({ where: { id, visible: true, ...PUBLICATION_ACTIVE }, select: { id: true } }));
      case "COMMENTAIRE":
        return Boolean(await db.commentairePublication.findFirst({ where: { id, ...COMMENTAIRE_ACTIF, publication: { visible: true, ...PUBLICATION_ACTIVE } }, select: { id: true } }));
      case "PROFIL":
        if (id === profilId) throw new ErreurSignalement(400, "Vous ne pouvez pas signaler votre propre profil.");
        return Boolean(await db.profil.findUnique({ where: { id }, select: { id: true } }));
      case "ASSOCIATION":
        return Boolean(await db.association.findUnique({ where: { id }, select: { id: true } }));
      case "ETABLISSEMENT":
        return Boolean(await db.etablissement.findUnique({ where: { id }, select: { id: true } }));
      case "EVENEMENT":
        return Boolean(await db.evenement.findUnique({ where: { id }, select: { id: true } }));
      case "OFFRE":
        return Boolean(await db.offre.findUnique({ where: { id }, select: { id: true } }));
      case "MESSAGE":
        // Un message privé ne peut être signalé que par un participant de la conversation.
        return Boolean(await db.message.findFirst({ where: { id, conversation: { participants: { some: { profilId } } } }, select: { id: true } }));
    }
  }

  async function signaler(userId: string, entree: z.infer<typeof creationSignalementSchema>) {
    const profil = await db.profil.findUnique({ where: { userId }, select: { id: true } });
    if (!profil) throw new ErreurSignalement(404, "Profil introuvable.");
    if (!(await verifierCible(entree.cibleType, entree.cibleId, profil.id))) throw new ErreurSignalement(404, "Contenu à signaler introuvable.");
    return db.$transaction(async (tx) => {
      const depuis = new Date(maintenant().getTime() - FENETRE_LIMITE_MS);
      const recents = await tx.signalement.count({ where: { signaleurId: profil.id, createdAt: { gte: depuis } } });
      if (recents >= LIMITE_SIGNALEMENTS_24H) throw new ErreurSignalement(429, "Vous avez atteint la limite de signalements pour aujourd'hui. Réessayez plus tard.");
      const doublon = await tx.signalement.findFirst({
        where: { signaleurId: profil.id, cibleType: entree.cibleType, cibleId: entree.cibleId, statut: { in: STATUTS_OUVERTS } },
        select: { id: true },
      });
      if (doublon) throw new ErreurSignalement(409, "Vous avez déjà signalé ce contenu ; votre signalement est en cours d'examen.");
      return tx.signalement.create({
        data: { signaleurId: profil.id, cibleType: entree.cibleType, cibleId: entree.cibleId, motif: entree.motif, details: entree.details, statut: "EN_ATTENTE", traite: false },
        select: { id: true, cibleType: true, cibleId: true, motif: true, details: true, statut: true, createdAt: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Aperçus groupés par type (une requête par type présent). */
  async function apercusCibles(signalements: Array<{ cibleType: string; cibleId: string }>) {
    const idsPar = (type: string) => [...new Set(signalements.filter((s) => s.cibleType === type).map((s) => s.cibleId))];
    const auteurSelect = { id: true, user: { select: { prenom: true, nom: true } } } as const;
    const resultat = new Map<string, ApercuCible>();
    const poser = (type: string, id: string, apercu: Omit<ApercuCible, "existe">) => resultat.set(`${type}:${id}`, { existe: true, ...apercu });
    const charger = async <T>(type: string, requete: (ids: string[]) => Promise<T[]>, traiter: (ligne: T) => void) => {
      const ids = idsPar(type);
      if (ids.length) (await requete(ids)).forEach(traiter);
    };
    await Promise.all([
      charger("PUBLICATION", (ids) => db.publication.findMany({ where: { id: { in: ids } }, select: { id: true, contenu: true, thematique: true, deletedAt: true, auteur: { select: auteurSelect } } }),
        (p) => poser("PUBLICATION", p.id, { apercu: court(p.contenu) || p.thematique, auteur: nomProfil(p.auteur), auteurId: p.auteur.id, supprime: Boolean(p.deletedAt), href: `/dashboard?publication=${p.id}` })),
      charger("COMMENTAIRE", (ids) => db.commentairePublication.findMany({ where: { id: { in: ids } }, select: { id: true, contenu: true, publicationId: true, deletedAt: true, auteur: { select: auteurSelect }, publication: { select: { deletedAt: true } } } }),
        (c) => poser("COMMENTAIRE", c.id, { apercu: court(c.contenu), auteur: nomProfil(c.auteur), auteurId: c.auteur.id, supprime: Boolean(c.deletedAt || c.publication.deletedAt), href: `/dashboard?publication=${c.publicationId}` })),
      charger("PROFIL", (ids) => db.profil.findMany({ where: { id: { in: ids } }, select: { ...auteurSelect, titre: true } }),
        (p) => poser("PROFIL", p.id, { apercu: court([nomProfil(p), p.titre].filter(Boolean).join(" · ")), auteur: nomProfil(p), auteurId: p.id, supprime: false, href: `/membres/${p.id}` })),
      charger("ASSOCIATION", (ids) => db.association.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true, ville: true, pays: true } }),
        (a) => poser("ASSOCIATION", a.id, { apercu: court([a.nom, a.ville, a.pays].filter(Boolean).join(" · ")), auteur: null, auteurId: null, supprime: false, href: `/associations/${a.id}` })),
      charger("ETABLISSEMENT", (ids) => db.etablissement.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true, ville: true } }),
        (e) => poser("ETABLISSEMENT", e.id, { apercu: court([e.nom, e.ville].filter(Boolean).join(" · ")), auteur: null, auteurId: null, supprime: false, href: null })),
      charger("EVENEMENT", (ids) => db.evenement.findMany({ where: { id: { in: ids } }, select: { id: true, titre: true, dateDebut: true, organisateurId: true } }),
        (e) => poser("EVENEMENT", e.id, { apercu: court(e.titre), auteur: null, auteurId: e.organisateurId, supprime: false, href: `/evenements/${e.id}` })),
      charger("OFFRE", (ids) => db.offre.findMany({ where: { id: { in: ids } }, select: { id: true, titre: true, entreprise: true, publieur: { select: auteurSelect } } }),
        (o) => poser("OFFRE", o.id, { apercu: court(`${o.titre} · ${o.entreprise}`), auteur: nomProfil(o.publieur), auteurId: o.publieur.id, supprime: false, href: `/offres?offre=${encodeURIComponent(o.id)}` })),
      charger("MESSAGE", (ids) => db.message.findMany({ where: { id: { in: ids } }, select: { id: true, contenu: true, auteur: { select: auteurSelect } } }),
        (m) => poser("MESSAGE", m.id, { apercu: court(m.contenu), auteur: nomProfil(m.auteur), auteurId: m.auteur.id, supprime: false, href: null })),
    ]);
    return resultat;
  }

  async function lister(filtres: z.infer<typeof filtresSignalementsSchema>) {
    const signalements = await db.signalement.findMany({
      where: { ...(filtres.statut ? { statut: filtres.statut } : {}), ...(filtres.type ? { cibleType: filtres.type } : {}) },
      orderBy: { createdAt: "desc" },
      take: filtres.limite,
      select: {
        id: true, cibleType: true, cibleId: true, motif: true, details: true, statut: true, traite: true,
        noteInterne: true, traiteParId: true, traiteLe: true, createdAt: true,
        signaleur: { select: { id: true, user: { select: { prenom: true, nom: true } } } },
      },
    });
    const apercus = signalements.length ? await apercusCibles(signalements) : new Map<string, ApercuCible>();
    const absente: ApercuCible = { existe: false, apercu: null, auteur: null, auteurId: null, supprime: true, href: null };
    return {
      signalements: signalements.map((s) => ({
        ...s,
        // Compatibilité : les lignes antérieures à la migration n'ont que `traite`.
        statut: s.statut ?? (s.traite ? "TRAITE" : "EN_ATTENTE"),
        cible: { type: s.cibleType, id: s.cibleId, ...(apercus.get(`${s.cibleType}:${s.cibleId}`) || absente) },
      })),
    };
  }

  async function traiter(id: string, moderateurUserId: string, entree: z.infer<typeof traitementSignalementSchema>) {
    const actuel = await db.signalement.findUnique({ where: { id }, select: { id: true, statut: true, signaleurId: true, cibleType: true, cibleId: true, motif: true } });
    if (!actuel) throw new ErreurSignalement(404, "Signalement introuvable.");
    const clos = STATUTS_CLOS.includes(entree.statut);
    const { count } = await db.signalement.updateMany({
      // Comparaison sur l'ancien statut : deux modérateurs simultanés ne se recouvrent pas silencieusement.
      where: { id, statut: actuel.statut },
      data: {
        statut: entree.statut,
        traite: clos,
        traiteParId: entree.statut === "EN_ATTENTE" ? null : moderateurUserId,
        traiteLe: clos ? maintenant() : null,
        ...(entree.noteInterne !== undefined ? { noteInterne: entree.noteInterne || null } : {}),
      },
    });
    if (!count) throw new ErreurSignalement(409, "Ce signalement a changé. Actualisez puis réessayez.");
    const notifie = clos && actuel.statut !== entree.statut;
    if (notifie) {
      const retenu = entree.statut === "TRAITE";
      await notifier({
        destinataireId: actuel.signaleurId,
        acteurId: null,
        type: "SIGNALEMENT",
        titre: retenu ? "Votre signalement a été traité" : "Votre signalement n'a pas été retenu",
        detail: retenu
          ? "Merci : l'équipe de modération a examiné le contenu signalé et pris les mesures nécessaires."
          : "L'équipe de modération a examiné le contenu signalé et n'a pas constaté d'infraction aux règles de la communauté.",
        href: null,
        payload: { signalementId: actuel.id, cibleType: actuel.cibleType, cibleId: actuel.cibleId, statut: entree.statut },
      }).catch((error) => console.error("[signalements] Notification du signaleur impossible :", error instanceof Error ? error.message : error));
    }
    const signalement = await db.signalement.findUnique({
      where: { id },
      select: { id: true, cibleType: true, cibleId: true, motif: true, details: true, statut: true, traite: true, noteInterne: true, traiteParId: true, traiteLe: true, createdAt: true },
    });
    return { signalement, signaleurNotifie: notifie };
  }

  return { signaler, lister, traiter, verifierCible };
}
export type ServiceSignalements = ReturnType<typeof creerServiceSignalements>;

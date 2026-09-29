import { Prisma, type PrismaClient } from "@prisma/client";

/** Durée de conservation dans la corbeille avant effacement définitif. */
export const DUREE_CORBEILLE_JOURS = 30;
export const DUREE_CORBEILLE_MS = DUREE_CORBEILLE_JOURS * 24 * 60 * 60 * 1000;
export const INTERVALLE_PURGE_MS = 24 * 60 * 60 * 1000;

/** Publication lisible : jamais un élément de la corbeille. */
export const PUBLICATION_ACTIVE = { deletedAt: null } satisfies Prisma.PublicationWhereInput;

/**
 * Commentaire lisible : non supprimé et, pour une réponse, parent non supprimé.
 * Une réponse dont le commentaire racine est à la corbeille disparaît avec lui
 * (elle réapparaît si la racine est restaurée).
 */
export const COMMENTAIRE_ACTIF = {
  deletedAt: null,
  OR: [{ parentId: null }, { parent: { is: { deletedAt: null } } }],
} satisfies Prisma.CommentairePublicationWhereInput;

export type TypeCorbeille = "publication" | "commentaire";
export const TYPES_CORBEILLE: Record<string, TypeCorbeille> = {
  publication: "publication", publications: "publication",
  commentaire: "commentaire", commentaires: "commentaire",
};

export class ErreurCorbeille extends Error {
  constructor(public readonly statut: number, message: string) { super(message); }
}

export const limiteCorbeille = (maintenant: Date) => new Date(maintenant.getTime() - DUREE_CORBEILLE_MS);
export const effacementPrevuLe = (deletedAt: Date) => new Date(deletedAt.getTime() + DUREE_CORBEILLE_MS);
/** L'auteur ne restaure que ce qu'il a lui-même supprimé (pas la modération, ni l'auteur du post). */
const supprimeParAuteur = (element: { auteurId: string; deletedById: string | null }) =>
  !element.deletedById || element.deletedById === element.auteurId;
const MESSAGE_MODERATION = "Cet élément a été retiré par la modération : vous ne pouvez pas le restaurer ni l'effacer vous-même.";

export function creerServiceCorbeille(db: PrismaClient, options: { maintenant?: () => Date } = {}) {
  const maintenant = options.maintenant || (() => new Date());

  async function lister(profilId: string) {
    const depuis = limiteCorbeille(maintenant());
    const concerne = { deletedAt: { gte: depuis }, OR: [{ auteurId: profilId }, { deletedById: profilId }] };
    const [publications, commentaires] = await Promise.all([
      db.publication.findMany({
        where: concerne,
        orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
        take: 100,
        select: { id: true, auteurId: true, contenu: true, thematique: true, intention: true, type: true, photoUrl: true, createdAt: true, deletedAt: true, deletedById: true },
      }),
      db.commentairePublication.findMany({
        where: concerne,
        orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
        take: 100,
        select: {
          id: true, auteurId: true, contenu: true, publicationId: true, parentId: true, createdAt: true, deletedAt: true, deletedById: true,
          publication: { select: { thematique: true, deletedAt: true } },
          parent: { select: { deletedAt: true } },
        },
      }),
    ]);
    const elements = [
      ...publications.map(({ deletedAt, deletedById, auteurId, contenu, type: typePublication, ...reste }) => {
        const estAuteur = auteurId === profilId;
        const parAuteur = supprimeParAuteur({ auteurId, deletedById });
        return {
          type: "publication" as const, ...reste, typePublication, apercu: contenu.slice(0, 200), estAuteur,
          supprimeLe: deletedAt!, effacementDefinitifLe: effacementPrevuLe(deletedAt!),
          supprimeParModeration: !parAuteur,
          peutRestaurer: estAuteur && parAuteur, peutEffacer: estAuteur && parAuteur,
          raisonBlocage: !estAuteur ? "Seul l'auteur peut restaurer cet élément." : !parAuteur ? MESSAGE_MODERATION : null,
        };
      }),
      ...commentaires.map(({ deletedAt, deletedById, auteurId, contenu, publication, parent, ...reste }) => {
        const estAuteur = auteurId === profilId;
        const parAuteur = supprimeParAuteur({ auteurId, deletedById });
        const conteneurSupprime = Boolean(publication.deletedAt || parent?.deletedAt);
        return {
          type: "commentaire" as const, ...reste, apercu: contenu.slice(0, 200), thematique: publication.thematique, estAuteur,
          supprimeLe: deletedAt!, effacementDefinitifLe: effacementPrevuLe(deletedAt!),
          supprimeParModeration: !parAuteur,
          peutRestaurer: estAuteur && parAuteur && !conteneurSupprime, peutEffacer: estAuteur && parAuteur,
          raisonBlocage: !estAuteur ? "Seul l'auteur peut restaurer cet élément."
            : !parAuteur ? MESSAGE_MODERATION
              : conteneurSupprime ? "La publication ou le commentaire d'origine est lui-même supprimé." : null,
        };
      }),
    ].sort((a, b) => b.supprimeLe.getTime() - a.supprimeLe.getTime());
    return { elements, dureeConservationJours: DUREE_CORBEILLE_JOURS };
  }

  async function elementDeLAuteur(type: TypeCorbeille, id: string, profilId: string) {
    const depuis = limiteCorbeille(maintenant());
    const element = type === "publication"
      ? await db.publication.findFirst({ where: { id, deletedAt: { gte: depuis } }, select: { id: true, auteurId: true, deletedById: true, photoUrl: true } })
      : await db.commentairePublication.findFirst({
          where: { id, deletedAt: { gte: depuis } },
          select: { id: true, auteurId: true, deletedById: true, publicationId: true, publication: { select: { deletedAt: true } }, parent: { select: { deletedAt: true } } },
        });
    if (!element) throw new ErreurCorbeille(404, "Élément introuvable dans la corbeille (déjà restauré ou effacé).");
    if (element.auteurId !== profilId) throw new ErreurCorbeille(403, "Seul l'auteur peut agir sur cet élément de la corbeille.");
    if (!supprimeParAuteur(element)) throw new ErreurCorbeille(403, MESSAGE_MODERATION);
    return element;
  }

  async function restaurer(type: TypeCorbeille, id: string, profilId: string) {
    const element = await elementDeLAuteur(type, id, profilId);
    if (type === "publication") {
      const { count } = await db.publication.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null, deletedById: null } });
      if (!count) throw new ErreurCorbeille(409, "L'élément a changé. Actualisez avant de réessayer.");
      return { type, id, publicationId: id };
    }
    const commentaire = element as { publicationId: string; publication: { deletedAt: Date | null }; parent: { deletedAt: Date | null } | null };
    if (commentaire.publication.deletedAt) throw new ErreurCorbeille(409, "La publication de ce commentaire est supprimée : restaurez-la d'abord.");
    if (commentaire.parent?.deletedAt) throw new ErreurCorbeille(409, "Le commentaire auquel vous répondiez est supprimé : il faut d'abord le restaurer.");
    const { count } = await db.commentairePublication.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null, deletedById: null } });
    if (!count) throw new ErreurCorbeille(409, "L'élément a changé. Actualisez avant de réessayer.");
    return { type, id, publicationId: commentaire.publicationId };
  }

  /** Effacement immédiat par l'auteur. Retourne le média à retirer après commit. */
  async function effacer(type: TypeCorbeille, id: string, profilId: string) {
    const element = await elementDeLAuteur(type, id, profilId);
    if (type === "publication") {
      const { count } = await db.publication.deleteMany({ where: { id, deletedAt: { not: null } } });
      if (!count) throw new ErreurCorbeille(409, "L'élément a changé. Actualisez avant de réessayer.");
      return { photoUrl: (element as { photoUrl: string | null }).photoUrl };
    }
    const { count } = await db.commentairePublication.deleteMany({ where: { id, deletedAt: { not: null } } });
    if (!count) throw new ErreurCorbeille(409, "L'élément a changé. Actualisez avant de réessayer.");
    return { photoUrl: null };
  }

  return { lister, restaurer, effacer };
}

/**
 * Efface physiquement ce qui est dans la corbeille depuis plus de 30 jours.
 * Les réactions, commentaires et réponses suivent par ON DELETE CASCADE.
 */
export async function purgerCorbeille(db: PrismaClient, options: { maintenant?: Date; retirerMedia?: (url?: string | null) => void; lot?: number } = {}) {
  const limite = limiteCorbeille(options.maintenant || new Date());
  const lot = options.lot || 500;
  let publications = 0;
  let commentaires = 0;
  for (;;) {
    const aPurger = await db.publication.findMany({ where: { deletedAt: { lt: limite } }, select: { id: true, photoUrl: true }, take: lot });
    if (!aPurger.length) break;
    const { count } = await db.publication.deleteMany({ where: { id: { in: aPurger.map(({ id }) => id) }, deletedAt: { lt: limite } } });
    publications += count;
    for (const { photoUrl } of aPurger) {
      if (!photoUrl) continue;
      try { options.retirerMedia?.(photoUrl); } catch { console.error("[corbeille] Nettoyage d'un média différé."); }
    }
    if (aPurger.length < lot) break;
  }
  for (;;) {
    const aPurger = await db.commentairePublication.findMany({ where: { deletedAt: { lt: limite } }, select: { id: true }, take: lot });
    if (!aPurger.length) break;
    const { count } = await db.commentairePublication.deleteMany({ where: { id: { in: aPurger.map(({ id }) => id) }, deletedAt: { lt: limite } } });
    commentaires += count;
    if (aPurger.length < lot) break;
  }
  return { publications, commentaires, limite };
}

/** Planifie la purge : au démarrage puis toutes les 24 h, sans bloquer ni arrêter le processus. */
export function planifierPurgeCorbeille(db: PrismaClient, retirerMedia?: (url?: string | null) => void) {
  if (process.env.CORBEILLE_PURGE_DISABLED === "true") return null;
  const executer = () => {
    purgerCorbeille(db, { retirerMedia })
      .then(({ publications, commentaires }) => {
        if (publications || commentaires) console.log(`[corbeille] Purge : ${publications} publication(s), ${commentaires} commentaire(s) effacés.`);
      })
      .catch((error) => console.error("[corbeille] Purge impossible :", error instanceof Error ? error.message : error));
  };
  const demarrage = setTimeout(executer, 0);
  demarrage.unref?.();
  const intervalle = setInterval(executer, INTERVALLE_PURGE_MS);
  intervalle.unref?.();
  return () => { clearTimeout(demarrage); clearInterval(intervalle); };
}

/** Marque comme lues les notifications qui pointent vers un contenu mis à la corbeille. */
export async function marquerNotificationsContenuSupprime(db: PrismaClient, cle: "publicationId" | "commentaireId", id: string) {
  return db.notification.updateMany({ where: { lue: false, payload: { path: `$.${cle}`, equals: id } }, data: { lue: true } });
}

type NotificationAvecPayload = { payload: Prisma.JsonValue | null };
const idDansPayload = (payload: Prisma.JsonValue | null, cle: string) =>
  payload && typeof payload === "object" && !Array.isArray(payload) && typeof payload[cle] === "string" ? payload[cle] as string : null;

/** Retire des listes les notifications dont la publication ou le commentaire n'est plus lisible. */
export async function filtrerNotificationsContenuSupprime<T extends NotificationAvecPayload>(db: PrismaClient, notifications: T[]) {
  const publicationIds = [...new Set(notifications.map((n) => idDansPayload(n.payload, "publicationId")).filter((id): id is string => Boolean(id)))];
  const commentaireIds = [...new Set(notifications.map((n) => idDansPayload(n.payload, "commentaireId")).filter((id): id is string => Boolean(id)))];
  if (!publicationIds.length && !commentaireIds.length) return notifications;
  const [publications, commentaires] = await Promise.all([
    publicationIds.length ? db.publication.findMany({ where: { id: { in: publicationIds }, ...PUBLICATION_ACTIVE }, select: { id: true } }) : [],
    commentaireIds.length ? db.commentairePublication.findMany({ where: { id: { in: commentaireIds }, ...COMMENTAIRE_ACTIF, publication: PUBLICATION_ACTIVE }, select: { id: true } }) : [],
  ]);
  const publicationsActives = new Set(publications.map(({ id }) => id));
  const commentairesActifs = new Set(commentaires.map(({ id }) => id));
  return notifications.filter((notification) => {
    const publicationId = idDansPayload(notification.payload, "publicationId");
    const commentaireId = idDansPayload(notification.payload, "commentaireId");
    return (!publicationId || publicationsActives.has(publicationId)) && (!commentaireId || commentairesActifs.has(commentaireId));
  });
}

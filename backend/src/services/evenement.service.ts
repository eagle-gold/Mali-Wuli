import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { urlHttpSchema } from "../lib/validation";
import type { NouvelleNotification } from "./notification.service";

export class ErreurEvenement extends Error {
  constructor(public readonly statut: number, message: string, public readonly erreurs?: unknown) { super(message); }
}
export type ActeurEvenement = { profilId: string; userId: string; moderateur: boolean };
const pagination = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limite: z.coerce.number().int().min(1).max(50).default(20) });
export const paginationEvenementSchema = pagination;
export const listeEvenementSchema = pagination.extend({
  q: z.string().trim().max(100).optional(), type: z.enum(["EN_LIGNE", "PRESENTIEL", "HYBRIDE"]).optional(),
  periode: z.enum(["a_venir", "passes", "tous"]).default("a_venir"),
  participation: z.enum(["mes-evenements"]).optional(), pays: z.string().trim().max(100).optional(),
  ville: z.string().trim().max(100).optional(), statut: z.enum(["publies", "en_attente", "refuses", "mes"]).optional(),
});
const texteOptionnel = (max: number) => z.string().trim().max(max).nullable().optional();
const fuseauSchema = z.string().trim().max(100).refine((value) => {
  try { new Intl.DateTimeFormat("fr", { timeZone: value }); return true; } catch { return false; }
}, "Fuseau horaire IANA invalide.").nullable().optional();
export const champsEvenementSchema = z.object({
  titre: z.string().trim().min(3).max(150), description: z.string().trim().min(10).max(5000),
  type: z.enum(["EN_LIGNE", "PRESENTIEL", "HYBRIDE"]), lieu: texteOptionnel(190),
  pays: texteOptionnel(100), ville: texteOptionnel(100), fuseauHoraire: fuseauSchema,
  lienVideo: z.union([urlHttpSchema(2048), z.literal(""), z.null()]).optional(),
  dateDebut: z.coerce.date(), dateFin: z.coerce.date().nullable().optional(),
  capacite: z.coerce.number().int().min(2).max(50000).nullable().optional(),
  programme: z.array(z.object({ heure: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Heure attendue : HH:mm."), libelle: z.string().trim().min(1).max(200) })).max(50).nullable().optional(),
  resume: texteOptionnel(10000),
}).strict();
export const modifierEvenementSchema = champsEvenementSchema.partial().refine((v) => Object.keys(v).length > 0, "Au moins un champ doit être modifié.");
export type DonneesEvenement = z.infer<typeof champsEvenementSchema>;
export type FiltresEvenements = z.infer<typeof listeEvenementSchema>;
function coherent(v: DonneesEvenement, ctx: z.RefinementCtx, creation: boolean, hybrideLegacy = false) {
  if (v.dateFin && v.dateFin <= v.dateDebut) ctx.addIssue({ code: "custom", path: ["dateFin"], message: "La fin doit être postérieure au début." });
  if (v.type !== "EN_LIGNE") {
    if (creation && !v.pays) ctx.addIssue({ code: "custom", path: ["pays"], message: "Le pays est requis." });
    if (creation && !v.ville) ctx.addIssue({ code: "custom", path: ["ville"], message: "La ville est requise." });
    if (!v.ville && !v.lieu) ctx.addIssue({ code: "custom", path: ["lieu"], message: "Indiquez la ville ou le lieu." });
  }
  if (v.type !== "PRESENTIEL" && !v.lienVideo && !(v.type === "HYBRIDE" && hybrideLegacy)) ctx.addIssue({ code: "custom", path: ["lienVideo"], message: "Le lien vidéo est requis pour ce format." });
}
export const creationEvenementSchema = champsEvenementSchema.superRefine((v, ctx) => coherent(v, ctx, true));
const PROFIL_PUBLIC = {
  id: true, photo: true, titre: true, pays: true, ville: true, situation: true,
  user: { select: { prenom: true, nom: true } },
} as const;
const PROFIL_VISIBLE = { onboardingFini: true, user: { statut: "VALIDE" as const } };
type ProfilPublic = Prisma.ProfilGetPayload<{ select: typeof PROFIL_PUBLIC }>;
function profilPublic(p?: ProfilPublic | null) {
  return p ? { id: p.id, prenom: p.user.prenom, nom: p.user.nom, nomComplet: [p.user.prenom, p.user.nom].filter(Boolean).join(" ") || "Membre Mali Wuli", photo: p.photo, titre: p.titre, pays: p.pays, ville: p.ville, situation: p.situation } : null;
}
function selectionEvenement(profilId: string) {
  return {
    id: true, titre: true, description: true, type: true, lieu: true, lienVideo: true, pays: true, ville: true,
    fuseauHoraire: true, dateDebut: true, dateFin: true, capacite: true, photoCouverture: true, programme: true,
    resume: true, valide: true, refuse: true, organisateurId: true, createdAt: true,
    participants: { where: { profilId }, select: { inscritLe: true }, take: 1 },
    _count: { select: { participants: true } },
  } as const;
}
type EvenementSelectionne = Prisma.EvenementGetPayload<{ select: ReturnType<typeof selectionEvenement> }>;
const selectionPhoto = { id: true, evenementId: true, auteurId: true, url: true, legende: true, createdAt: true, auteur: { select: PROFIL_PUBLIC } } as const;
type PhotoSelectionnee = Prisma.EvenementPhotoGetPayload<{ select: typeof selectionPhoto }>;
type DB = PrismaClient | Prisma.TransactionClient;
const meta = (page: number, limite: number, total: number) => ({ page, limite, total, totalPages: Math.ceil(total / limite) });
const publie = { valide: true, refuse: false } as const;
export function filtrePeriodeEvenement(passe: boolean, now: Date): Prisma.EvenementWhereInput {
  return { OR: [
    { dateFin: passe ? { lte: now } : { gt: now } },
    { dateFin: null, dateDebut: passe ? { lte: now } : { gt: now } },
  ] };
}
const etat = (e: { valide: boolean; refuse: boolean }) => e.valide && !e.refuse ? "VALIDE" : e.refuse ? "REFUSE" : "EN_ATTENTE";
const estPasse = (e: { dateDebut: Date; dateFin: Date | null }, now: Date) => (e.dateFin || e.dateDebut) <= now;
function donneesPrisma(d: DonneesEvenement) {
  return {
    ...d, lieu: d.lieu || null, pays: d.pays || null, ville: d.ville || null, lienVideo: d.lienVideo || null,
    fuseauHoraire: d.fuseauHoraire || null, dateFin: d.dateFin || null, capacite: d.capacite ?? null,
    resume: d.resume || null, programme: d.programme == null ? Prisma.DbNull : d.programme,
  };
}
export type EffetsEvenements = {
  notifier: (n: NouvelleNotification) => Promise<unknown>;
  notifierPlusieurs: (n: NouvelleNotification[]) => Promise<unknown>;
  emettre: (userId: string, evenementId: string, supprime?: boolean) => void;
};
const sansEffets: EffetsEvenements = { notifier: async () => {}, notifierPlusieurs: async () => {}, emettre: () => {} };

/** Service injecté : tests avec delegates en mémoire, jamais de base implicite. */
export function creerServiceEvenements(db: PrismaClient, effets: EffetsEvenements = sansEffets, horloge = () => new Date()) {
  async function acteur(userId?: string, role?: string, permissions: readonly string[] = []): Promise<ActeurEvenement> {
    const p = userId && await db.profil.findUnique({ where: { userId }, select: { id: true } });
    if (!p || !userId) throw new ErreurEvenement(404, "Profil introuvable.");
    return { profilId: p.id, userId, moderateur: permissions.includes("EVENEMENTS_MODERER") };
  }
  function visible(a: ActeurEvenement): Prisma.EvenementWhereInput {
    return a.moderateur ? {} : { OR: [publie, { organisateurId: a.profilId }] };
  }
  async function accessible(id: string, a: ActeurEvenement, base: DB = db) {
    const e = await base.evenement.findFirst({ where: { id, ...visible(a) }, select: selectionEvenement(a.profilId) });
    if (!e) throw new ErreurEvenement(404, "Événement introuvable.");
    return e;
  }
  async function autoriserMedia(id: string, a: ActeurEvenement, couverture = false, base: DB = db) {
    const e = await accessible(id, a, base);
    if (e.organisateurId === a.profilId || a.moderateur) return e;
    if (!couverture && e.valide && !e.refuse && e.participants.length > 0) return e;
    throw new ErreurEvenement(403, couverture ? "Vous ne pouvez pas modifier cette couverture." : "Inscrivez-vous à cet événement pour ajouter des photos.");
  }
  function exigerGestion(e: { organisateurId: string }, a: ActeurEvenement) {
    if (!a.moderateur && e.organisateurId !== a.profilId) throw new ErreurEvenement(403, "Vous ne pouvez pas modifier cet événement.");
  }
  async function formater(evenements: EvenementSelectionne[], a: ActeurEvenement) {
    const ids = [...new Set(evenements.map((e) => e.organisateurId))];
    const profils = ids.length ? await db.profil.findMany({ where: { id: { in: ids } }, select: PROFIL_PUBLIC }) : [];
    const parId = new Map(profils.map((p) => [p.id, p]));
    return evenements.map(({ participants, _count, ...e }) => ({
      ...e, organisateur: profilPublic(parId.get(e.organisateurId)), nbParticipants: _count.participants,
      estInscrit: participants.length > 0, estProprietaire: e.organisateurId === a.profilId,
      statut: etat(e), estPasse: estPasse(e, horloge()), peutModifier: a.moderateur || e.organisateurId === a.profilId,
      peutSupprimer: a.moderateur || e.organisateurId === a.profilId,
      peutAjouterPhotos: a.moderateur || e.organisateurId === a.profilId || (e.valide && !e.refuse && participants.length > 0),
      peutModerer: a.moderateur,
    }));
  }
  async function fiche(id: string, a: ActeurEvenement) { return (await formater([await accessible(id, a)], a))[0]; }
  async function liste(f: FiltresEvenements, a: ActeurEvenement) {
    if ((f.statut === "en_attente" || f.statut === "refuses") && !a.moderateur) throw new ErreurEvenement(403, "Cette liste est réservée à la modération.");
    const filtre: Prisma.EvenementWhereInput = {
      ...(f.type ? { type: f.type } : {}), ...(f.pays ? { pays: f.pays } : {}), ...(f.ville ? { ville: f.ville } : {}),
      ...(f.q ? { OR: ["titre", "description", "lieu", "ville"].map((champ) => ({ [champ]: { contains: f.q } })) } : {}),
    };
    const scope: Prisma.EvenementWhereInput = f.statut === "publies" ? publie
      : f.statut === "en_attente" ? { valide: false, refuse: false }
      : f.statut === "refuses" ? { refuse: true }
      : f.statut === "mes" ? { organisateurId: a.profilId } : visible(a);
    const where: Prisma.EvenementWhereInput = { AND: [scope, filtre,
      ...(f.periode === "tous" ? [] : [filtrePeriodeEvenement(f.periode === "passes", horloge())]),
      ...(f.participation ? [{ OR: [{ organisateurId: a.profilId }, { participants: { some: { profilId: a.profilId } } }] }] : []),
    ] };
    const [total, evenements, aVenir, passes, aValider, mesPropositions, pays, villes] = await Promise.all([
      db.evenement.count({ where }),
      db.evenement.findMany({ where, select: selectionEvenement(a.profilId), orderBy: [{ dateDebut: f.periode === "passes" ? "desc" : "asc" }, { id: "asc" }], skip: (f.page - 1) * f.limite, take: f.limite }),
      db.evenement.count({ where: { AND: [publie, filtre, filtrePeriodeEvenement(false, horloge())] } }),
      db.evenement.count({ where: { AND: [publie, filtre, filtrePeriodeEvenement(true, horloge())] } }),
      a.moderateur ? db.evenement.count({ where: { valide: false, refuse: false } }) : Promise.resolve(0),
      db.evenement.count({ where: { organisateurId: a.profilId } }),
      db.evenement.findMany({ where: { AND: [scope, { pays: { not: null } }] }, select: { pays: true }, distinct: ["pays"], orderBy: { pays: "asc" } }),
      db.evenement.findMany({ where: { AND: [scope, { ville: { not: null }, ...(f.pays ? { pays: f.pays } : {}) }] }, select: { ville: true }, distinct: ["ville"], orderBy: { ville: "asc" } }),
    ]);
    return { evenements: await formater(evenements, a), meta: meta(f.page, f.limite, total),
      compteurs: { aVenir, passes, aValider, mesPropositions }, facettes: { pays: pays.flatMap((p) => p.pays ? [p.pays] : []), villes: villes.flatMap((v) => v.ville ? [v.ville] : []) }, peutModerer: a.moderateur };
  }
  async function participants(id: string, a: ActeurEvenement, p: { page: number; limite: number }) {
    await accessible(id, a);
    const where = { evenementId: id, profil: PROFIL_VISIBLE };
    const [total, inscrits] = await Promise.all([
      db.evenementParticipant.count({ where }),
      db.evenementParticipant.findMany({ where, select: { profil: { select: PROFIL_PUBLIC } }, orderBy: [{ inscritLe: "asc" }, { profilId: "asc" }], skip: (p.page - 1) * p.limite, take: p.limite }),
    ]);
    return { participants: inscrits.map(({ profil }) => profilPublic(profil)), meta: meta(p.page, p.limite, total) };
  }
  function photoPublique(p: PhotoSelectionnee, e: { organisateurId: string }, a: ActeurEvenement) {
    return { id: p.id, url: p.url, legende: p.legende, createdAt: p.createdAt, auteur: profilPublic(p.auteur), peutSupprimer: a.moderateur || p.auteurId === a.profilId || e.organisateurId === a.profilId };
  }
  async function photos(id: string, a: ActeurEvenement, p: { page: number; limite: number }) {
    const e = await accessible(id, a);
    const [total, images] = await Promise.all([
      db.evenementPhoto.count({ where: { evenementId: id } }),
      db.evenementPhoto.findMany({ where: { evenementId: id }, select: selectionPhoto, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (p.page - 1) * p.limite, take: p.limite }),
    ]);
    return { photos: images.map((p) => photoPublique(p, e, a)), meta: meta(p.page, p.limite, total) };
  }
  async function detail(id: string, a: ActeurEvenement) {
    const evenement = await fiche(id, a);
    const [inscrits, album] = await Promise.all([participants(id, a, { page: 1, limite: 12 }), photos(id, a, { page: 1, limite: 24 })]);
    return { evenement, participants: inscrits.participants, totalParticipants: inscrits.meta.total, photos: album.photos, totalPhotos: album.meta.total };
  }
  async function effetsSansEchec(action: () => Promise<unknown> | void) {
    try { await action(); } catch { console.error("[evenements] Une notification n’a pas pu être transmise."); }
  }
  async function emettre(id: string, a: ActeurEvenement, organisateurId?: string, supprime = false) {
    await effetsSansEchec(async () => {
      effets.emettre(a.userId, id, supprime);
      if (organisateurId && organisateurId !== a.profilId) {
        const p = await db.profil.findUnique({ where: { id: organisateurId }, select: { userId: true } });
        if (p) effets.emettre(p.userId, id, supprime);
      }
    });
  }
  async function creer(d: DonneesEvenement, a: ActeurEvenement) {
    if (d.dateDebut <= horloge()) throw new ErreurEvenement(400, "La date de début doit être à venir.");
    const e = await db.evenement.create({ data: { ...donneesPrisma(d), organisateurId: a.profilId, valide: a.moderateur, refuse: false } });
    await emettre(e.id, a);
    return fiche(e.id, a);
  }
  async function modifier(id: string, patch: Partial<DonneesEvenement>, a: ActeurEvenement) {
    const e = await db.$transaction(async (tx) => {
      const existant = await accessible(id, a, tx); exigerGestion(existant, a);
      const base = Object.fromEntries(Object.keys(champsEvenementSchema.shape).map((key) => [key, existant[key as keyof typeof existant]]));
      // Les événements hybrides hérités pouvaient ne pas avoir de lien vidéo.
      // Leur résumé reste modifiable tant que format et lien sont inchangés.
      const hybrideLegacy = existant.type === "HYBRIDE" && !existant.lienVideo
        && (!patch.type || patch.type === existant.type)
        && (patch.lienVideo === undefined || !patch.lienVideo);
      const schema = champsEvenementSchema.superRefine((v, ctx) => coherent(v, ctx, false, hybrideLegacy));
      const d = schema.safeParse({ ...base, ...patch });
      if (!d.success) throw new ErreurEvenement(400, "Les informations de l’événement sont incohérentes.", d.error.flatten().fieldErrors);
      if (patch.dateDebut && patch.dateDebut.getTime() !== existant.dateDebut.getTime() && patch.dateDebut <= horloge()) throw new ErreurEvenement(400, "La nouvelle date de début doit être à venir.");
      if (d.data.capacite && d.data.capacite < existant._count.participants) throw new ErreurEvenement(409, "La capacité ne peut pas être inférieure au nombre d’inscrits.");
      const comparer = (val: unknown) => JSON.stringify(val === "" || val === undefined ? null : val);
      const principaleChange = Object.entries(patch).some(([key, val]) => key !== "resume" && comparer(val) !== comparer(base[key]));
      return tx.evenement.update({ where: { id }, data: { ...donneesPrisma(d.data), ...(!a.moderateur && principaleChange ? { valide: false, refuse: false } : {}) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const inscrits = await db.evenementParticipant.findMany({ where: { evenementId: id }, select: { profil: { select: { id: true, userId: true } } } });
    await effetsSansEchec(async () => {
      await effets.notifierPlusieurs(inscrits.map(({ profil }) => ({ destinataireId: profil.id, acteurId: a.profilId, type: "EVENEMENT", titre: `L’événement « ${e.titre} » a été modifié`, detail: "Consultez les nouvelles informations de cet événement.", href: `/evenements/${encodeURIComponent(id)}`, payload: { evenementId: id } })));
      inscrits.forEach(({ profil }) => effets.emettre(profil.userId, id));
    });
    await emettre(id, a, e.organisateurId);
    return fiche(id, a);
  }
  async function valider(id: string, valide: boolean, a: ActeurEvenement) {
    if (!a.moderateur) throw new ErreurEvenement(403, "Cette décision est réservée à la modération.");
    await accessible(id, a);
    const e = await db.evenement.update({ where: { id }, data: { valide, refuse: !valide } });
    await effetsSansEchec(() => effets.notifier({ destinataireId: e.organisateurId, type: "EVENEMENT", titre: valide ? "Votre événement a été validé" : "Votre événement a été refusé", detail: e.titre, href: `/evenements/${encodeURIComponent(id)}`, payload: { evenementId: id, valide } }));
    await emettre(id, a, e.organisateurId);
    return fiche(id, a);
  }
  async function supprimer(id: string, a: ActeurEvenement) {
    const result = await db.$transaction(async (tx) => {
      const e = await accessible(id, a, tx); exigerGestion(e, a);
      const [inscrits, images] = await Promise.all([
        tx.evenementParticipant.findMany({ where: { evenementId: id }, select: { profil: { select: { id: true, userId: true } } } }),
        tx.evenementPhoto.findMany({ where: { evenementId: id }, select: { url: true } }),
      ]);
      await tx.evenementPhoto.deleteMany({ where: { evenementId: id } });
      await tx.evenementParticipant.deleteMany({ where: { evenementId: id } });
      await tx.evenement.delete({ where: { id } });
      return { e, inscrits, urls: [...images.map((p) => p.url), e.photoCouverture].filter((url): url is string => !!url) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await effetsSansEchec(async () => {
      await effets.notifierPlusieurs(result.inscrits.map(({ profil }) => ({ destinataireId: profil.id, acteurId: a.profilId, type: "EVENEMENT", titre: `L’événement « ${result.e.titre} » est annulé`, detail: "L’organisateur a annulé cet événement.", href: "/evenements", payload: { evenementId: id, annule: true } })));
      result.inscrits.forEach(({ profil }) => effets.emettre(profil.userId, id, true));
    });
    return result.urls;
  }
  async function participer(id: string, a: ActeurEvenement) {
    const r = await db.$transaction(async (tx) => {
      const e = await tx.evenement.findFirst({ where: { id, ...publie }, select: selectionEvenement(a.profilId) });
      if (!e) throw new ErreurEvenement(404, "Événement introuvable.");
      if (e.participants.length) return { e, dejaInscrit: true };
      if (e.dateDebut <= horloge()) throw new ErreurEvenement(409, "Les inscriptions sont closes depuis le début de cet événement.");
      if (e._count.participants >= (e.capacite ?? Number.MAX_SAFE_INTEGER)) throw new ErreurEvenement(409, "Cet événement est complet.");
      const participation = await tx.evenementParticipant.create({ data: { evenementId: id, profilId: a.profilId } });
      return { e, dejaInscrit: false, participation };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!r.dejaInscrit) {
      const p = await db.profil.findUnique({ where: { id: a.profilId }, select: PROFIL_PUBLIC });
      await effetsSansEchec(() => effets.notifier({ destinataireId: r.e.organisateurId, acteurId: a.profilId, type: "EVENEMENT", titre: "Nouvelle inscription à votre événement", detail: `${profilPublic(p)?.nomComplet || "Un membre"} participera à « ${r.e.titre} ».`, href: `/evenements/${encodeURIComponent(id)}`, payload: { evenementId: id } }));
      await emettre(id, a, r.e.organisateurId);
    }
    return { estInscrit: true, message: r.dejaInscrit ? "Vous participez déjà à cet événement." : "Votre participation est confirmée.", participation: r.participation, dejaInscrit: r.dejaInscrit };
  }
  async function quitter(id: string, a: ActeurEvenement) {
    const e = await db.$transaction(async (tx) => {
      const e = await tx.evenement.findUnique({ where: { id }, select: { id: true, dateDebut: true, organisateurId: true } });
      if (!e) throw new ErreurEvenement(404, "Événement introuvable.");
      if (e.dateDebut <= horloge()) throw new ErreurEvenement(409, "La désinscription n’est plus possible après le début de l’événement.");
      await tx.evenementParticipant.deleteMany({ where: { evenementId: id, profilId: a.profilId } });
      return e;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await emettre(id, a, e.organisateurId);
    return { estInscrit: false, message: "Votre participation est annulée." };
  }
  async function modifierCouverture(id: string, url: string | null, a: ActeurEvenement) {
    const resultat = await db.$transaction(async (tx) => {
      const e = await autoriserMedia(id, a, true, tx);
      await tx.evenement.update({ where: { id }, data: { photoCouverture: url } });
      return { ancienMedia: e.photoCouverture };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await emettre(id, a);
    return resultat;
  }
  async function ajouterPhoto(id: string, url: string, legende: string | null, a: ActeurEvenement) {
    const photo = await db.$transaction(async (tx) => {
      const e = await autoriserMedia(id, a, false, tx);
      const p = await tx.evenementPhoto.create({ data: { evenementId: id, auteurId: a.profilId, url, legende }, select: selectionPhoto });
      return photoPublique(p, e, a);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await emettre(id, a);
    return photo;
  }
  async function supprimerPhoto(id: string, photoId: string, a: ActeurEvenement) {
    const url = await db.$transaction(async (tx) => {
      // L’auteur conserve le droit de retirer sa photo si l’événement a été dépublié.
      const p = await tx.evenementPhoto.findFirst({ where: { id: photoId, evenementId: id }, select: { id: true, url: true, auteurId: true, evenement: { select: { organisateurId: true } } } });
      if (!p) throw new ErreurEvenement(404, "Photo introuvable.");
      if (!a.moderateur && p.auteurId !== a.profilId && p.evenement.organisateurId !== a.profilId) throw new ErreurEvenement(403, "Vous ne pouvez pas retirer cette photo.");
      await tx.evenementPhoto.delete({ where: { id: p.id } });
      return p.url;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await emettre(id, a);
    return url;
  }
  return { acteur, liste, fiche, detail, participants, photos, creer, modifier, valider, supprimer, participer, quitter, autoriserMedia, modifierCouverture, ajouterPhoto, supprimerPhoto };
}
export type ServiceEvenements = ReturnType<typeof creerServiceEvenements>;

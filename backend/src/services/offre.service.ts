import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { urlHttpSchema } from "../lib/validation";
import type { NouvelleNotification } from "./notification.service";

export class ErreurOffre extends Error {
  constructor(public statut: number, message: string, public erreurs?: unknown) { super(message); }
}
export type ActeurOffre = { profilId: string; userId: string; moderateur: boolean };
export const TYPES_OFFRE = ["CDI", "CDD", "STAGE", "ALTERNANCE", "FREELANCE"] as const;
export const MODES_TRAVAIL = ["SUR_SITE", "HYBRIDE", "TELETRAVAIL"] as const;
export const MODES_CANDIDATURE = ["MALI_WULI", "EMAIL", "LIEN_EXTERNE"] as const;
export const listeOffresSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1), limite: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(100).optional(), type: z.enum(TYPES_OFFRE).optional(), secteur: z.string().trim().max(100).optional(),
  pays: z.string().trim().max(100).optional(), ville: z.string().trim().max(100).optional(), modeTravail: z.enum(MODES_TRAVAIL).optional(),
  teletravail: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  vue: z.enum(["actives", "toutes", "mes-offres", "enregistrees", "en-attente"]).default("actives"),
});
export const champsOffreSchema = z.object({
  titre: z.string().trim().min(3).max(150), entreprise: z.string().trim().min(2).max(150), type: z.enum(TYPES_OFFRE),
  secteur: z.string().trim().min(2).max(100), pays: z.string().trim().min(2).max(100), ville: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().min(20).max(10000), teletravail: z.boolean().optional(), modeTravail: z.enum(MODES_TRAVAIL).optional(),
  modeCandidature: z.enum(MODES_CANDIDATURE).optional(),
  lienCandidature: z.union([urlHttpSchema(2048), z.literal(""), z.null()]).optional(),
  emailContact: z.union([z.string().trim().email().max(190), z.literal(""), z.null()]).optional(),
  dateExpiration: z.coerce.date().nullable().optional(), salaire: z.string().trim().max(190).nullable().optional(),
  profilRecherche: z.string().trim().max(10000).nullable().optional(), recommandationPossible: z.boolean().optional(),
}).strict();
export const modifierOffreSchema = champsOffreSchema.partial().refine((v) => Object.keys(v).length > 0, "Au moins un champ doit être modifié.");
export const revisionOffreSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const candidatureSchema = z.object({ revision: revisionOffreSchema, message: z.string().trim().max(2000).optional(), reessayer: z.boolean().optional() }).strict();
export type DonneesOffre = z.infer<typeof champsOffreSchema>;
export type FiltresOffres = z.infer<typeof listeOffresSchema>;
export type DBOffre = PrismaClient | Prisma.TransactionClient;
export const PROFIL_OFFRE_SELECT = {
  id: true, userId: true, photo: true, titre: true, bio: true, pays: true, ville: true, situation: true, onboardingFini: true,
  user: { select: { prenom: true, nom: true, statut: true, email: true, emailVerifie: true } },
} as const;
export type ProfilCandidat = Prisma.ProfilGetPayload<{ select: typeof PROFIL_OFFRE_SELECT }>;
export function resumeProfilOffre(p: ProfilCandidat) {
  return { id: p.id, prenom: p.user.prenom, nom: p.user.nom, nomComplet: [p.user.prenom, p.user.nom].filter(Boolean).join(" ") || "Membre Mali Wuli", photo: p.photo, titre: p.titre, pays: p.pays, ville: p.ville, situation: p.situation };
}
export const OFFRE_PUBLIEE = { valide: true, statutModeration: "PUBLIEE" as const };
export const offreNonExpiree = (now: Date): Prisma.OffreWhereInput => ({ OR: [{ dateExpiration: null }, { dateExpiration: { gt: now } }] });
export function selectionOffre(profilId: string) {
  return {
    id: true, titre: true, entreprise: true, type: true, secteur: true, pays: true, ville: true, teletravail: true,
    description: true, lienCandidature: true, emailContact: true, dateExpiration: true, publieurId: true, valide: true, createdAt: true,
    statutModeration: true, modeTravail: true, modeCandidature: true, salaire: true, profilRecherche: true, recommandationPossible: true,
    publieur: { select: PROFIL_OFFRE_SELECT },
    enregistrements: { where: { profilId }, select: { createdAt: true }, take: 1 },
    candidatures: { where: { profilId }, select: { statut: true, conversationId: true }, take: 1 },
  } as const;
}
type OffreSelectionnee = Prisma.OffreGetPayload<{ select: ReturnType<typeof selectionOffre> }>;
export function revisionOffre(offre: Record<string, unknown>) {
  const champs = ["id", "titre", "entreprise", "type", "secteur", "pays", "ville", "description", "modeTravail", "teletravail", "modeCandidature", "lienCandidature", "emailContact", "dateExpiration", "salaire", "profilRecherche", "recommandationPossible", "statutModeration", "valide", "publieurId"];
  return createHash("sha256").update(JSON.stringify(champs.map(k => offre[k] ?? null))).digest("hex");
}
export function formaterOffre(offre: OffreSelectionnee, acteur: ActeurOffre, now: Date) {
  const { publieur, enregistrements, candidatures, ...o } = offre;
  const candidature = candidatures[0];
  return { ...o, revision: revisionOffre(o), publieur: resumeProfilOffre(publieur), estProprietaire: o.publieurId === acteur.profilId,
    peutModifier: acteur.moderateur || o.publieurId === acteur.profilId,
    peutSupprimer: acteur.moderateur || o.publieurId === acteur.profilId, peutModerer: acteur.moderateur,
    estExpiree: !!o.dateExpiration && o.dateExpiration <= now, estEnregistree: enregistrements.length > 0,
    aPostule: candidature?.statut === "ENVOYEE", statutCandidature: candidature?.statut || null, conversationId: candidature?.conversationId || null };
}
function normaliser(d: DonneesOffre) {
  const modeTravail = d.modeTravail || (d.teletravail ? "TELETRAVAIL" : "SUR_SITE");
  const modeCandidature = d.modeCandidature || (d.lienCandidature ? "LIEN_EXTERNE" : d.emailContact ? "EMAIL" : "MALI_WULI");
  if (modeCandidature === "LIEN_EXTERNE" && !d.lienCandidature) throw new ErreurOffre(400, "Ajoutez un lien de candidature pour ce mode.", { lienCandidature: ["Le lien est requis."] });
  return { ...d, ville: d.ville || null, lienCandidature: modeCandidature === "LIEN_EXTERNE" ? d.lienCandidature || null : null, emailContact: modeCandidature === "EMAIL" ? d.emailContact || null : null,
    dateExpiration: d.dateExpiration || null, salaire: d.salaire || null, profilRecherche: d.profilRecherche || null,
    recommandationPossible: d.recommandationPossible ?? false, modeTravail, modeCandidature, teletravail: modeTravail !== "SUR_SITE" };
}
export type EffetsOffres = { notifier: (n: NouvelleNotification) => Promise<unknown>; emettre: (userId: string, nom: string, payload: Record<string, unknown>) => void };
const sansEffets: EffetsOffres = { notifier: async () => {}, emettre: () => {} };
export function creerServiceOffres(db: PrismaClient, effets: EffetsOffres = sansEffets, horloge = () => new Date()) {
  async function acteur(userId?: string, role?: string, permissions: readonly string[] = []): Promise<ActeurOffre> {
    const p = userId && await db.profil.findUnique({ where: { userId }, select: { id: true } });
    if (!p || !userId) throw new ErreurOffre(404, "Profil introuvable.");
    return { profilId: p.id, userId, moderateur: permissions.includes("OFFRES_MODERER") };
  }
  function visible(a: ActeurOffre): Prisma.OffreWhereInput { return a.moderateur ? {} : { OR: [OFFRE_PUBLIEE, { publieurId: a.profilId }] }; }
  async function accessible(id: string, a: ActeurOffre, base: DBOffre = db) {
    const offre = await base.offre.findFirst({ where: { id, ...visible(a) }, select: selectionOffre(a.profilId) });
    if (!offre) throw new ErreurOffre(404, "Offre introuvable.");
    return offre;
  }
  function gestion(o: { publieurId: string }, a: ActeurOffre) { if (!a.moderateur && o.publieurId !== a.profilId) throw new ErreurOffre(403, "Vous ne pouvez pas modifier cette offre."); }
  async function fiche(id: string, a: ActeurOffre) { return formaterOffre(await accessible(id, a), a, horloge()); }
  async function liste(f: FiltresOffres, a: ActeurOffre) {
    if (f.vue === "en-attente" && !a.moderateur) throw new ErreurOffre(403, "La modération est réservée à l’équipe.");
    const scope: Prisma.OffreWhereInput = f.vue === "mes-offres" ? { publieurId: a.profilId }
      : f.vue === "en-attente" ? { statutModeration: "EN_ATTENTE", valide: false }
      : f.vue === "toutes" ? visible(a) : OFFRE_PUBLIEE;
    const where: Prisma.OffreWhereInput = { AND: [scope,
      ...(f.vue === "actives" ? [offreNonExpiree(horloge())] : []),
      ...(f.vue === "enregistrees" ? [{ enregistrements: { some: { profilId: a.profilId } } }] : []),
      ...(f.q ? [{ OR: ["titre", "entreprise", "description", "secteur"].map((champ) => ({ [champ]: { contains: f.q } })) }] : []),
    ], ...(f.type ? { type: f.type } : {}), ...(f.secteur ? { secteur: f.secteur } : {}), ...(f.pays ? { pays: f.pays } : {}), ...(f.ville ? { ville: f.ville } : {}),
      ...(f.modeTravail ? { modeTravail: f.modeTravail } : f.teletravail === undefined ? {} : { teletravail: f.teletravail }) };
    const facettesScope = { AND: [scope, ...(f.vue === "actives" ? [offreNonExpiree(horloge())] : [])] };
    const [offres, total, actives, enregistrees, mesOffres, enAttente, pays, villes, secteurs, types, modesTravail] = await Promise.all([
      db.offre.findMany({ where, select: selectionOffre(a.profilId), orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (f.page - 1) * f.limite, take: f.limite }),
      db.offre.count({ where }), db.offre.count({ where: { AND: [OFFRE_PUBLIEE, offreNonExpiree(horloge())] } }),
      db.offre.count({ where: { ...OFFRE_PUBLIEE, enregistrements: { some: { profilId: a.profilId } } } }),
      db.offre.count({ where: { publieurId: a.profilId } }), a.moderateur ? db.offre.count({ where: { valide: false, statutModeration: "EN_ATTENTE" } }) : Promise.resolve(0),
      db.offre.findMany({ where: facettesScope, select: { pays: true }, distinct: ["pays"], orderBy: { pays: "asc" } }),
      db.offre.findMany({ where: { ...facettesScope, ville: { not: null }, ...(f.pays ? { pays: f.pays } : {}) }, select: { ville: true }, distinct: ["ville"], orderBy: { ville: "asc" } }),
      db.offre.findMany({ where: facettesScope, select: { secteur: true }, distinct: ["secteur"], orderBy: { secteur: "asc" } }),
      db.offre.findMany({ where: facettesScope, select: { type: true }, distinct: ["type"], orderBy: { type: "asc" } }),
      db.offre.findMany({ where: facettesScope, select: { modeTravail: true }, distinct: ["modeTravail"], orderBy: { modeTravail: "asc" } }),
    ]);
    return { offres: offres.map((o) => formaterOffre(o, a, horloge())), meta: { page: f.page, limite: f.limite, total, totalPages: Math.ceil(total / f.limite) },
      compteurs: { actives, enregistrees, mesOffres, enAttente }, facettes: { pays: pays.map((p) => p.pays), villes: villes.flatMap((v) => v.ville ? [v.ville] : []), secteurs: secteurs.map((s) => s.secteur), types: types.map((t) => t.type), modesTravail: modesTravail.map((m) => m.modeTravail) }, peutModerer: a.moderateur };
  }
  async function diffuser(o: { id: string; publieur: { userId: string } }, nom = "offre_modifiee") { try { effets.emettre(o.publieur.userId, nom, { offreId: o.id }); } catch { console.error("[offres] Diffusion différée."); } }
  async function creer(d: DonneesOffre, a: ActeurOffre) {
    if (d.dateExpiration && d.dateExpiration <= horloge()) throw new ErreurOffre(400, "La date d’expiration doit être à venir.");
    const o = await db.offre.create({ data: { ...normaliser(d), publieurId: a.profilId, valide: false, statutModeration: "EN_ATTENTE" }, select: selectionOffre(a.profilId) });
    await diffuser(o); return formaterOffre(o, a, horloge());
  }
  async function modifier(id: string, patch: Partial<DonneesOffre>, a: ActeurOffre) {
    const o = await db.$transaction(async (tx) => {
      const avant = await accessible(id, a, tx); gestion(avant, a);
      const donnees = Object.fromEntries(Object.keys(champsOffreSchema.shape).map((k) => [k, avant[k as keyof typeof avant]]));
      if (patch.teletravail !== undefined && patch.modeTravail === undefined) patch = { ...patch, modeTravail: patch.teletravail ? "TELETRAVAIL" : "SUR_SITE" };
      const validees = champsOffreSchema.parse({ ...donnees, ...patch });
      if (patch.dateExpiration && +patch.dateExpiration !== +(avant.dateExpiration || 0) && patch.dateExpiration <= horloge()) throw new ErreurOffre(400, "La nouvelle date d’expiration doit être à venir.");
      return tx.offre.update({ where: { id }, data: { ...normaliser(validees), valide: false, statutModeration: "EN_ATTENTE" }, select: selectionOffre(a.profilId) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await diffuser(o); return formaterOffre(o, a, horloge());
  }
  async function valider(id: string, valide: boolean, revision: string, a: ActeurOffre) {
    if (!a.moderateur) throw new ErreurOffre(403, "Cette décision est réservée à la modération.");
    const o = await db.$transaction(async tx => {
      const avant = await accessible(id, a, tx);
      if (revisionOffre(avant) !== revision) throw new ErreurOffre(409, "Cette offre a changé depuis votre lecture. Actualisez-la avant de la valider.");
      return tx.offre.update({ where: { id }, data: { valide, statutModeration: valide ? "PUBLIEE" : "REFUSEE" }, select: selectionOffre(a.profilId) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await diffuser(o);
    try { await effets.notifier({ destinataireId: o.publieurId, type: "OFFRE", titre: valide ? "Votre offre a été validée" : "Votre offre a été refusée", detail: `${o.titre} · ${o.entreprise}`, href: `/offres?offre=${encodeURIComponent(id)}`, payload: { offreId: id, valide } }); } catch { console.error("[offres] Notification non transmise."); }
    return formaterOffre(o, a, horloge());
  }
  async function supprimer(id: string, a: ActeurOffre) {
    const o = await db.$transaction(async (tx) => {
      const o = await accessible(id, a, tx); gestion(o, a);
      const pending = await tx.candidatureOffre.count({ where: { offreId: id, statut: "EN_COURS" } });
      if (pending) throw new ErreurOffre(409, "Une candidature est en cours de transmission. Réessayez plus tard.");
      await tx.offre.delete({ where: { id } }); return o;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await diffuser(o, "offre_supprimee");
  }
  async function enregistrer(id: string, a: ActeurOffre, conserver: boolean) {
    if (conserver) {
      await accessible(id, a);
      await db.offreEnregistrement.upsert({ where: { offreId_profilId: { offreId: id, profilId: a.profilId } }, create: { offreId: id, profilId: a.profilId }, update: {} });
    } else await db.offreEnregistrement.deleteMany({ where: { offreId: id, profilId: a.profilId } });
    return { estEnregistree: conserver };
  }
  return { acteur, liste, fiche, creer, modifier, valider, supprimer, enregistrer };
}
export type ServiceOffres = ReturnType<typeof creerServiceOffres>;

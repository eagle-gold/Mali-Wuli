/** Vrais handlers et service, données en mémoire exclusivement ; aucune DB ni requête réseau. */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { Request, RequestHandler, Response, Router } from "express";
import { creerRouteurEvenements } from "./evenement.routes";
import { creerServiceEvenements, filtrePeriodeEvenement } from "../services/evenement.service";
import { verifierImageChargee, uploadEvenement } from "../middlewares/upload.middleware";
import { prisma } from "../lib/prisma";
import jwt from "jsonwebtoken";
import { Readable } from "node:stream";

const avantSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "fixture-evenements-locale-sans-db-ni-reseau";
const originalUtilisateur = prisma.user.findUnique;
const comptes = new Map(["member", "owner", "other", "admin", "moderator", "pending", "evenements-specialiste", "autre-specialiste"].map((id) => [`user-${id}`, {
  id: `user-${id}`, email: id === "admin" ? "ik736764@gmail.com" : `user-${id}@example.invalid`, role: id === "admin" ? "ADMIN" : id === "moderator" ? "MODERATEUR" : "MEMBRE",
  rolesDelegues: id === "evenements-specialiste" ? [{code:"EVENEMENTS"}] : id === "autre-specialiste" ? [{code:"OFFRES"}] : [],
  statut: id === "pending" ? "SUSPENDU" : "VALIDE", emailVerifie: true, tokenVersion: 0,
}]));
prisma.user.findUnique = (async ({ where }: { where: { id: string } }) => comptes.get(where.id) || null) as unknown as typeof prisma.user.findUnique;
after(() => { prisma.user.findUnique = originalUtilisateur; if (avantSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = avantSecret; });
const now = new Date("2026-09-28T12:00:00.000Z");
const future = new Date("2026-10-01T12:00:00Z");
const past = new Date("2026-09-01T12:00:00Z");
type Row = Record<string, any>;
function correspond(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every((condition) => correspond(row, condition));
    if (key === "OR") return value.some((condition: Row) => correspond(row, condition));
    const actuel = row[key];
    if (value === null || typeof value !== "object" || value instanceof Date) return actuel === value || (actuel instanceof Date && value instanceof Date && +actuel === +value);
    if ("some" in value) return actuel.some((child: Row) => correspond(child, value.some));
    if ("not" in value) return actuel !== value.not;
    if ("in" in value) return value.in.includes(actuel);
    if ("contains" in value) return String(actuel || "").toLowerCase().includes(value.contains.toLowerCase());
    if ("lte" in value) return actuel !== null && actuel <= value.lte;
    if ("gt" in value) return actuel !== null && actuel > value.gt;
    return correspond(actuel, value);
  });
}
function fixture() {
  const profils = [...comptes].map(([userId, user]) => ({
    id: userId.replace("user-", ""), userId, photo: null, titre: "Membre", pays: "Mali", ville: "Bamako", situation: "ACTIF",
    onboardingFini: user.statut === "VALIDE", email: "DO_NOT_LEAK", telephone: "DO_NOT_LEAK", user: { prenom: "Test", nom: userId, statut: user.statut, email: "DO_NOT_LEAK" },
  }));
  const base = { titre: "Événement test", description: "Description de notre événement", type: "PRESENTIEL", lieu: "Adresse", pays: "Mali", ville: "Bamako", fuseauHoraire: "Africa/Bamako", lienVideo: null, dateDebut: future, dateFin: null, capacite: null, photoCouverture: null, programme: null, resume: null, valide: true, refuse: false, organisateurId: "owner", createdAt: now };
  const evenements = new Map<string, Row>([
    ["future", { id: "future", ...base }],
    ["past", { id: "past", ...base, dateDebut: past }],
    ["ongoing", { id: "ongoing", ...base, dateDebut: past, dateFin: future, pays: "France", ville: "Paris" }],
    ["pending", { id: "pending", ...base, valide: false }],
    ["refused", { id: "refused", ...base, valide: false, refuse: true }],
  ]);
  const inscriptions: Row[] = [];
  const images = new Map<string, Row>();
  const appels: Array<{ methode: string; args: Row }> = [];
  const nettoyes: Array<string | null | undefined> = [];
  const notifications: Row[] = [];
  let uploads = 0;
  let echecPhotoCreate = false;
  let echecPhotoDelete = false;
  let avantUpload: (() => void) | undefined;
  const pe = (id: string) => profils.find((p) => p.id === id)!;
  function enrichir(e: Row, args: Row = {}): Row {
    const membres = inscriptions.filter((i) => i.evenementId === e.id);
    return { ...e, participants: membres.filter((i) => !args.select?.participants?.where || correspond(i, args.select.participants.where)), _count: { participants: membres.length } };
  }
  function tous(where: Row = {}) { return [...evenements.values()].map((e) => enrichir(e)).filter((e) => correspond(e, where)); }
  function photo(p: Row) { return { ...p, auteur: pe(p.auteurId), evenement: evenements.get(p.evenementId) }; }
  const db = {
    profil: {
      findUnique: async ({ where }: Row) => profils.find((p) => correspond(p, where)) || null,
      findMany: async ({ where }: Row) => profils.filter((p) => correspond(p, where)),
    },
    evenement: {
      count: async ({ where }: Row) => tous(where).length,
      findFirst: async (args: Row) => { appels.push({ methode: "evenement.findFirst", args }); const e = tous(args.where)[0]; return e ? enrichir(e, args) : null; },
      findUnique: async (args: Row) => { const e = evenements.get(args.where.id); return e ? enrichir(e, args) : null; },
      findMany: async (args: Row) => {
        appels.push({ methode: "evenement.findMany", args });
        let rows = tous(args.where);
        if (args.distinct) { const key = args.distinct[0]; return [...new Set(rows.map((r) => r[key]))].map((val) => ({ [key]: val })); }
        const direction = args.orderBy[0].dateDebut === "desc" ? -1 : 1;
        rows = rows.sort((a, b) => direction * (+a.dateDebut - +b.dateDebut) || a.id.localeCompare(b.id));
        return rows.slice(args.skip || 0, (args.skip || 0) + (args.take || 100)).map((e) => enrichir(e, args));
      },
      create: async (args: Row) => { appels.push({ methode: "evenement.create", args }); const e = { id: "created", ...args.data, createdAt: now }; if (e.programme?.constructor?.name === "DbNull") e.programme = null; evenements.set(e.id, e); return e; },
      update: async (args: Row) => { appels.push({ methode: "evenement.update", args }); const e = { ...evenements.get(args.where.id)!, ...args.data }; if (e.programme?.constructor?.name === "DbNull") e.programme = null; evenements.set(e.id, e); return e; },
      delete: async (args: Row) => { appels.push({ methode: "evenement.delete", args }); evenements.delete(args.where.id); return {}; },
    },
    evenementParticipant: {
      findMany: async (args: Row) => {
        appels.push({ methode: "participants.findMany", args });
        return inscriptions.map((i) => ({ ...i, profil: pe(i.profilId) })).filter((i) => correspond(i, args.where)).slice(args.skip || 0, (args.skip || 0) + (args.take || 100));
      },
      count: async (args: Row) => inscriptions.map((i) => ({ ...i, profil: pe(i.profilId) })).filter((i) => correspond(i, args.where)).length,
      create: async (args: Row) => { appels.push({ methode: "participants.create", args }); const p = { ...args.data, inscritLe: now }; inscriptions.push(p); return p; },
      deleteMany: async (args: Row) => { appels.push({ methode: "participants.deleteMany", args }); let count = 0; for (let i = inscriptions.length - 1; i >= 0; i--) if (correspond(inscriptions[i], args.where)) { inscriptions.splice(i, 1); count++; } return { count }; },
    },
    evenementPhoto: {
      count: async (args: Row) => [...images.values()].filter((p) => correspond(p, args.where)).length,
      findMany: async (args: Row) => [...images.values()].filter((p) => correspond(p, args.where)).slice(args.skip || 0, (args.skip || 0) + (args.take || 100)).map(photo),
      findFirst: async (args: Row) => { const p = [...images.values()].find((p) => correspond(p, args.where)); return p ? photo(p) : null; },
      create: async (args: Row) => { if (echecPhotoCreate) throw Error("Fixture: échec DB photo"); const p = { id: `photo-${images.size + 1}`, ...args.data, createdAt: now }; images.set(p.id, p); return photo(p); },
      delete: async (args: Row) => { if (echecPhotoDelete) throw Error("Fixture: échec DB suppression"); appels.push({ methode: "photos.delete", args }); images.delete(args.where.id); return {}; },
      deleteMany: async (args: Row) => { appels.push({ methode: "photos.deleteMany", args }); for (const [id, p] of images) if (correspond(p, args.where)) images.delete(id); return { count: 1 }; },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>, options: Row) => { appels.push({ methode: "transaction", args: options }); return fn(db); },
  };
  const service = creerServiceEvenements(db as unknown as PrismaClient, {
    notifier: async (n) => { notifications.push(n); }, notifierPlusieurs: async (ns) => { notifications.push(...ns); }, emettre: () => {},
  }, () => now);
  const upload: RequestHandler = (req, _res, next) => { uploads++; avantUpload?.(); req.file = { filename: "fixture.png" } as Express.Multer.File; next(); };
  const router = creerRouteurEvenements(service, { photo: upload, couverture: upload, verifier: (_req, _res, next) => next(), retirer: (url) => { nettoyes.push(url); } });
  return { router, service, evenements, inscriptions, images, appels, nettoyes, notifications,
    get uploads() { return uploads; }, set echecPhotoCreate(v: boolean) { echecPhotoCreate = v; }, set echecPhotoDelete(v: boolean) { echecPhotoDelete = v; }, set avantUpload(fn: () => void) { avantUpload = fn; } };
}
function requete(router: Router, method: string, url: string, identity = "member", body: Row = {}, sansToken = false) {
  const [pathname, search = ""] = url.split("?");
  const token = jwt.sign({ purpose: "access", userId: `user-${identity}`, role: "ADMIN", tokenVersion: 0 }, process.env.JWT_SECRET!);
  const req = { method, url, originalUrl: `/api/evenements${url}`, path: pathname, baseUrl: "/api/evenements", headers: sansToken ? {} : { authorization: `Bearer ${token}` }, body, query: Object.fromEntries(new URLSearchParams(search)), params: {} } as unknown as Request;
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json(data: unknown) { resolve({ status, body: data }); return this; } } as unknown as Response;
    (router as unknown as { handle(req: Request, res: Response, next: (err?: unknown) => void): void }).handle(req, res, (err) => err ? reject(err) : resolve({ status: 404, body: {} }));
  });
}
const bodyCreation = { titre: "Réunion réseau", description: "Une rencontre ouverte au réseau.", type: "PRESENTIEL", pays: "Mali", ville: "Bamako", dateDebut: future.toISOString(), fuseauHoraire: "Africa/Bamako" };

test("auth réelle : anonyme et compte en attente refusés, rôle du JWT ignoré", async () => {
  const f = fixture();
  assert.equal((await requete(f.router, "GET", "/", "member", {}, true)).status, 401);
  assert.equal((await requete(f.router, "GET", "/", "pending")).status, 403);
  assert.equal((await requete(f.router, "PATCH", "/pending/validation", "member", { valide: true })).status, 403);
});

test("listes et compteurs : événement en cours à venir, scopes privés et dates cohérents", async () => {
  const f = fixture();
  const r = await requete(f.router, "GET", "/?statut=publies");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.evenements.map((e: Row) => e.id), ["ongoing", "future"]);
  assert.deepEqual(r.body.compteurs, { aVenir: 2, passes: 1, aValider: 0, mesPropositions: 0 });
  assert.equal(r.body.evenements[0].estPasse, false);
  assert.deepEqual((await requete(f.router, "GET", "/?periode=passes&statut=publies")).body.evenements.map((e: Row) => e.id), ["past"]);
  assert.equal((await requete(f.router, "GET", "/?statut=en_attente")).status, 403);
  assert.equal((await requete(f.router, "GET", "/?statut=refuses")).status, 403);
  const owner = await requete(f.router, "GET", "/?statut=mes&periode=tous", "owner");
  assert.equal(owner.body.evenements.length, 5);
  const admin = await requete(f.router, "GET", "/?statut=en_attente&periode=tous", "admin");
  assert.deepEqual(admin.body.evenements.map((e: Row) => e.id), ["pending"]);
  assert.equal(admin.body.compteurs.aValider, 1);
  assert.equal((await requete(f.router, "GET", "/?limite=1000")).status, 400);
  const filtered = await requete(f.router, "GET", "/?pays=France&statut=publies");
  assert.equal(filtered.body.compteurs.aVenir, 1); assert.deepEqual(filtered.body.facettes.villes, ["Paris"]);
  assert.deepEqual(filtrePeriodeEvenement(true, now), { OR: [{ dateFin: { lte: now } }, { dateFin: null, dateDebut: { lte: now } }] });
});

test("détail privé interdit et roster filtré sans e-mail/identifiants compte", async () => {
  const f = fixture();
  f.inscriptions.push({ evenementId: "future", profilId: "member" }, { evenementId: "future", profilId: "pending" });
  assert.equal((await requete(f.router, "GET", "/pending")).status, 404);
  assert.equal((await requete(f.router, "GET", "/pending/participants")).status, 404);
  const r = await requete(f.router, "GET", "/future");
  assert.equal(r.status, 200); assert.equal(r.body.totalParticipants, 1); assert.equal(r.body.evenement.nbParticipants, 2);
  assert.deepEqual(r.body.participants.map((p: Row) => p.id), ["member"]);
  assert.equal(JSON.stringify(r.body).includes("DO_NOT_LEAK"), false);
  assert.equal(JSON.stringify(r.body).includes('"userId"'), false);
  const query = f.appels.find((a) => a.methode === "participants.findMany")!.args;
  assert.equal(query.take, 12); assert.deepEqual(query.where.profil, { onboardingFini: true, user: { statut: "VALIDE" } });
});

test("création valide format, IANA, programme et localisation sans exposer la validation", async () => {
  const f = fixture();
  for (const patch of [{ pays: null }, { ville: "" }, { fuseauHoraire: "Not/A_Zone" }, { type: "HYBRIDE" }, { programme: [{ heure: "25:10", libelle: "Discours" }] }, { valide: true }, { photoCouverture: "evil" }]) {
    assert.equal((await requete(f.router, "POST", "/", "owner", { ...bodyCreation, ...patch })).status, 400);
  }
  const created = await requete(f.router, "POST", "/", "owner", { ...bodyCreation, programme: [{ heure: "14:30", libelle: "Accueil" }] });
  assert.equal(created.status, 201); assert.equal(created.body.evenement.statut, "EN_ATTENTE");
  assert.equal(created.body.evenement.peutAjouterPhotos, true); assert.equal(created.body.evenement.fuseauHoraire, "Africa/Bamako");
  const admin = await requete(f.router, "POST", "/", "admin", bodyCreation);
  assert.equal(admin.body.evenement.statut, "VALIDE");
});

test("résumé passé et date passée inchangée gardent la publication ; nouvelle date passée refusée", async () => {
  const f = fixture();
  const resume = await requete(f.router, "PATCH", "/past", "owner", { resume: "Compte rendu de la rencontre", dateDebut: past.toISOString() });
  assert.equal(resume.status, 200); assert.equal(resume.body.evenement.valide, true);
  assert.equal(resume.body.evenement.resume, "Compte rendu de la rencontre");
  assert.equal((await requete(f.router, "PATCH", "/past", "owner", { dateDebut: "2026-09-02T12:00:00Z" })).status, 400);
  assert.equal((await requete(f.router, "PATCH", "/future", "member", { titre: "Nouveau titre" })).status, 403);
  f.evenements.get("future")!.programme = [{ heure: "10:00", libelle: "Accueil" }];
  const edited = await requete(f.router, "PATCH", "/future", "owner", { titre: "Nouveau titre" });
  assert.equal(edited.body.evenement.statut, "EN_ATTENTE");
  assert.deepEqual(edited.body.evenement.programme, [{ heure: "10:00", libelle: "Accueil" }]);
  f.evenements.get("future")!.pays = null; f.evenements.get("future")!.ville = null;
  assert.equal((await requete(f.router, "PATCH", "/future", "owner", { resume: "Résumé legacy" })).status, 200);
});

test("modération distingue refus et attente, notification pointe sur la nouvelle fiche", async () => {
  const f = fixture();
  const refused = await requete(f.router, "PATCH", "/pending/validation", "moderator", { valide: false });
  assert.equal(refused.body.evenement.statut, "REFUSE"); assert.equal(f.evenements.get("pending")!.refuse, true);
  assert.equal(f.notifications[0].href, "/evenements/pending");
  const edited = await requete(f.router, "PATCH", "/pending", "owner", { titre: "Proposition corrigée" });
  assert.equal(edited.body.evenement.statut, "EN_ATTENTE");
  assert.equal((await requete(f.router, "PATCH", "/pending/validation", "admin", { valide: true })).body.evenement.statut, "VALIDE");
});

test("participation idempotente, capacité sous transaction serializable et historique conservé", async () => {
  const f = fixture(); f.evenements.get("future")!.capacite = 2;
  f.inscriptions.push({ evenementId: "future", profilId: "owner" });
  assert.equal((await requete(f.router, "POST", "/future/participer")).status, 201);
  assert.equal((await requete(f.router, "POST", "/future/participer")).status, 200);
  assert.equal(f.inscriptions.filter((p) => p.profilId === "member").length, 1);
  assert.equal(f.notifications.length, 1);
  assert.equal((await requete(f.router, "POST", "/future/participer", "other")).status, 409);
  assert.equal((await requete(f.router, "POST", "/past/participer")).status, 409);
  assert.equal((await requete(f.router, "POST", "/pending/participer")).status, 404);
  assert.equal(f.appels.find((c) => c.methode === "transaction")!.args.isolationLevel, "Serializable");
  assert.equal((await requete(f.router, "DELETE", "/future/participer")).status, 200);
  f.inscriptions.push({ evenementId: "past", profilId: "member" });
  assert.equal((await requete(f.router, "DELETE", "/past/participer")).status, 409);
  assert.equal(f.inscriptions.some((p) => p.evenementId === "past" && p.profilId === "member"), true);
});

test("droits avant Multer, participant publié et propriétaire de proposition admis", async () => {
  const f = fixture();
  assert.equal((await requete(f.router, "POST", "/future/photos")).status, 403);
  assert.equal((await requete(f.router, "POST", "/future/couverture")).status, 403);
  assert.equal((await requete(f.router, "POST", "/pending/photos")).status, 404);
  assert.equal(f.uploads, 0);
  f.inscriptions.push({ evenementId: "past", profilId: "member" });
  const p = await requete(f.router, "POST", "/past/photos", "member", { legende: "Souvenir" });
  assert.equal(p.status, 201); assert.equal(p.body.photo.legende, "Souvenir"); assert.equal(p.body.photo.peutSupprimer, true);
  assert.equal((await requete(f.router, "POST", "/pending/couverture", "owner")).status, 200);
  assert.equal((await requete(f.router, "POST", "/pending/photos", "admin")).status, 201);
  assert.equal((await requete(f.router, "POST", "/future/photos", "moderator")).status, 201);
});

test("droit revérifié après Multer : désinscription concurrente nettoie le nouveau fichier", async () => {
  const f = fixture(); f.inscriptions.push({ evenementId: "future", profilId: "member" });
  f.avantUpload = () => { f.inscriptions.splice(0); };
  assert.equal((await requete(f.router, "POST", "/future/photos")).status, 403);
  assert.equal(f.images.size, 0); assert.deepEqual(f.nettoyes, ["/uploads/evenements/fixture.png"]);
});

test("photo ou légende non persistée : nettoyage ; échec suppression DB : fichier conservé", async () => {
  const f = fixture();
  assert.equal((await requete(f.router, "POST", "/future/photos", "owner", { legende: "x".repeat(301) })).status, 400);
  assert.equal(f.nettoyes.length, 1);
  f.echecPhotoCreate = true;
  assert.equal((await requete(f.router, "POST", "/future/photos", "owner")).status, 500);
  assert.equal(f.nettoyes.length, 2);
  f.echecPhotoCreate = false;
  const p = await requete(f.router, "POST", "/future/photos", "owner");
  f.echecPhotoDelete = true;
  assert.equal((await requete(f.router, "DELETE", `/future/photos/${p.body.photo.id}`, "owner")).status, 500);
  assert.equal(f.nettoyes.length, 2); assert.equal(f.images.size, 1);
});

test("suppression vérifie couple événement/photo et auteur ; auteur garde droit après dépublication", async () => {
  const f = fixture(); f.inscriptions.push({ evenementId: "future", profilId: "member" });
  const p = (await requete(f.router, "POST", "/future/photos")).body.photo;
  assert.equal((await requete(f.router, "DELETE", `/past/photos/${p.id}`, "admin")).status, 404);
  assert.equal((await requete(f.router, "DELETE", `/future/photos/${p.id}`, "other")).status, 403);
  assert.equal(f.nettoyes.length, 0);
  f.evenements.get("future")!.valide = false; f.inscriptions.splice(0);
  assert.equal((await requete(f.router, "DELETE", `/future/photos/${p.id}`)).status, 200);
  assert.equal(f.images.size, 0); assert.equal(f.nettoyes.length, 1);
});

test("couverture et album ne dépublient pas ; suppression événement nettoie après toutes suppressions DB", async () => {
  const f = fixture(); f.evenements.get("future")!.photoCouverture = "/uploads/evenements/old.png";
  assert.equal((await requete(f.router, "POST", "/future/couverture", "owner")).body.evenement.valide, true);
  assert.deepEqual(f.nettoyes, ["/uploads/evenements/old.png"]);
  await requete(f.router, "POST", "/future/photos", "owner");
  assert.equal((await requete(f.router, "DELETE", "/future", "owner")).status, 200);
  assert.equal(f.evenements.has("future"), false); assert.equal(f.images.size, 0);
  const deletes = f.appels.filter((a) => a.methode.endsWith("deleteMany") || a.methode === "evenement.delete").map((a) => a.methode);
  assert.deepEqual(deletes, ["photos.deleteMany", "participants.deleteMany", "evenement.delete"]);
  assert.equal(f.nettoyes.length, 3);
});

test("signature binaire réelle : faux PNG retiré, JPEG/PNG/WebP valides conservés", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "mali-evenement-magic-"));
  try {
    for (const [mime, bytes] of [
      ["image/png", Buffer.from("not an image")],
      ["image/png", Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0])],
      ["image/jpeg", Buffer.from([0xff,0xd8,0xff,0,0,0,0,0,0,0,0,0])],
      ["image/webp", Buffer.from("RIFF1234WEBP")],
    ] as const) {
      const file = path.join(directory, "fixture"); writeFileSync(file, bytes);
      const req = { file: { path: file, mimetype: mime } } as Request;
      let err: unknown; verifierImageChargee(req, {} as Response, (e) => { err = e; });
      const valide = bytes.toString() !== "not an image";
      assert.equal(!err, valide); assert.equal(existsSync(file), valide);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test("édition legacy HYBRIDE sans lien préservée, nouveau changement hybride sans lien refusé", async () => {
  const f = fixture(); f.evenements.get("past")!.type = "HYBRIDE";
  const r = await requete(f.router, "PATCH", "/past", "owner", { resume: "Compte rendu de la rencontre" });
  assert.equal(r.status, 200); assert.equal(r.body.evenement.valide, true);
  assert.equal((await requete(f.router, "PATCH", "/future", "owner", { type: "HYBRIDE" })).status, 400);
  f.inscriptions.push(...["member", "owner", "other"].map((profilId) => ({ evenementId: "future", profilId })));
  assert.equal((await requete(f.router, "PATCH", "/future", "owner", { capacite: 2 })).status, 409);
  assert.equal(f.appels.filter((c) => c.methode === "transaction").length, 3);
});

test("couverture enregistrée reste sur disque si la lecture de réponse échoue après commit", async () => {
  const f = fixture(); f.evenements.get("future")!.photoCouverture = "/uploads/evenements/old.png";
  f.service.fiche = async () => { throw Error("Fixture: lecture après commit indisponible"); };
  assert.equal((await requete(f.router, "POST", "/future/couverture", "owner")).status, 500);
  assert.equal(f.evenements.get("future")!.photoCouverture, "/uploads/evenements/fixture.png");
  assert.deepEqual(f.nettoyes, ["/uploads/evenements/old.png"]);
});

test("Multer réel : limite 10 Mio, champ unique photo et MIME image exigés", async () => {
  async function charger(field: string, mime: string, taille: number) {
    const boundary = "qa-evenement-limite";
    const raw = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="image.jpg"\r\nContent-Type: ${mime}\r\n\r\n`),
      Buffer.alloc(taille, 0xff), Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const req = Readable.from(raw) as unknown as Request;
    req.headers = { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(raw.length) };
    return new Promise<any>((resolve) => uploadEvenement.single("photo")(req, {} as Response, resolve));
  }
  assert.equal((await charger("photo", "image/jpeg", 10 * 1024 * 1024 + 1)).code, "LIMIT_FILE_SIZE");
  assert.equal((await charger("autre", "image/jpeg", 12)).code, "LIMIT_UNEXPECTED_FILE");
  assert.match((await charger("photo", "image/svg+xml", 12)).message, /Format non supporté/);
});

test("spécialiste EVENEMENTS : validation, listes et photos sans privilèges des autres domaines",async()=>{const f=fixture();assert.equal((await requete(f.router,"PATCH","/pending/validation","autre-specialiste",{valide:true})).status,403);assert.equal((await requete(f.router,"GET","/?statut=en_attente","autre-specialiste")).status,403);assert.equal((await requete(f.router,"POST","/future/photos","autre-specialiste")).status,403);assert.equal(f.uploads,0);assert.equal((await requete(f.router,"PATCH","/pending/validation","evenements-specialiste",{valide:true})).status,200);assert.equal((await requete(f.router,"POST","/future/photos","evenements-specialiste")).status,201);assert.equal((await requete(f.router,"PATCH","/future","evenements-specialiste",{resume:"Texte du gestionnaire"})).status,200);});


test("suppression événement : flag serveur aligné organisateur ou permission EVENEMENTS, autres refusés", async () => {
  for (const acteur of ["owner", "admin", "evenements-specialiste", "member", "autre-specialiste"]) {
    const f = fixture(); const autorise = ["owner", "admin", "evenements-specialiste"].includes(acteur);
    const detail = await requete(f.router, "GET", "/future", acteur);
    assert.equal(detail.body.evenement.peutSupprimer, autorise);
    assert.equal((await requete(f.router, "DELETE", "/future", acteur)).status, autorise ? 200 : 403);
    assert.equal(f.evenements.has("future"), !autorise);
  }
});

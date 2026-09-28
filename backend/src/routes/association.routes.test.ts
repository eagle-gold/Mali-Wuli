/** Tests sans DB/réseau : les vrais handlers et authenticate reçoivent des delegates Prisma simulés. */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { creerRouteursAssociations } from "./association.routes";
import { creerServiceAssociations } from "../services/association.service";
import { prisma } from "../lib/prisma";
import { signerTokenAcces } from "../lib/auth-token";

const avantSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "fixture-locale-associations-sans-reseau-ni-base";
const trouverUtilisateurOriginal = prisma.user.findUnique;
const comptes = new Map([
  ["user-member", { id: "user-member", role: "MEMBRE", statut: "VALIDE", emailVerifie: true, tokenVersion: 0 }],
  ["user-manager", { id: "user-manager", role: "RESPONSABLE_ASSO", statut: "VALIDE", emailVerifie: true, tokenVersion: 0 }],
  ["user-admin", { id: "user-admin", email: "ik736764@gmail.com", role: "ADMIN", statut: "VALIDE", emailVerifie: true, tokenVersion: 0 }],
  ["user-associations-specialiste", {id:"user-associations-specialiste",role:"MEMBRE",statut:"VALIDE",emailVerifie:true,tokenVersion:0,rolesDelegues:[{code:"ASSOCIATIONS"}]}],
  ["user-autre-specialiste", {id:"user-autre-specialiste",role:"MEMBRE",statut:"VALIDE",emailVerifie:true,tokenVersion:0,rolesDelegues:[{code:"OFFRES"}]}],
  ["user-pending", { id: "user-pending", role: "MEMBRE", statut: "EN_ATTENTE", emailVerifie: true, tokenVersion: 0 }],
]);
// Seul le lookup d'identité utilisé par authenticate est remplacé ; aucune requête réelle possible.
prisma.user.findUnique = (async ({ where }: { where: { id: string } }) => comptes.get(where.id) || null) as unknown as typeof prisma.user.findUnique;
after(() => {
  prisma.user.findUnique = trouverUtilisateurOriginal;
  if (avantSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = avantSecret;
});

type Affiliation = { associationId: string; profilId: string; statut: string; rejointLe: Date | null };
const now = new Date("2026-01-01T00:00:00Z");
function fixture() {
  const associations = new Map([
    ["asso-a", { id: "asso-a", nom: "Association A", pays: "Mali", ville: "Bamako", vocation: "Éducation", description: "Description A", site: null, emailContact: null, dateCreation: null, createdAt: now, photo: null, photoCouverture: null, valide: true, responsableId: "manager" }],
    ["asso-b", { id: "asso-b", nom: "Association B", pays: "France", ville: "Paris", vocation: "Culture", description: "Description B", site: null, emailContact: null, dateCreation: null, createdAt: now, photo: null, photoCouverture: null, valide: true, responsableId: "other-manager" }],
  ]);
  const profils = ["member", "manager", "admin", "pending", "other-manager", "associations-specialiste", "autre-specialiste"].map((id) => ({
    id, userId: `user-${id}`, photo: null, titre: "Membre", ville: "Bamako", pays: "Mali",
    onboardingFini: id !== "pending", user: { prenom: "Prénom", nom: id, statut: id === "pending" ? "EN_ATTENTE" : "VALIDE" },
  }));
  const affiliations = new Map<string, Affiliation>();
  const propositions: Array<Record<string, unknown>> = [];
  const mediasRetires: Array<string | null | undefined> = [];
  let echecSuppression = false;
  let echecMedia = false;
  const appels: Array<{ methode: string; args: any }> = [];
  const key = (a: string, p: string) => `${a}:${p}`;
  const visible = (p: (typeof profils)[number]) => p.onboardingFini && p.user.statut === "VALIDE";
  const resolveProfil = (where: any) => profils.find((p) => (!where.id || p.id === where.id) && (!where.userId || p.userId === where.userId) && (!where.onboardingFini || visible(p)));
  const selection = (a: (typeof associations extends Map<string, infer V> ? V : never), select: any) => ({
    ...a,
    membres: [...affiliations.values()].filter((m) => m.associationId === a.id && m.profilId === select?.membres?.where?.profilId).map(({ statut, rejointLe }) => ({ statut, rejointLe })),
    _count: { membres: [...affiliations.values()].filter((m) => m.associationId === a.id && m.statut === "VERIFIE" && profils.some((p) => p.id === m.profilId && visible(p))).length },
  });
  const correspondAsso = (a: (typeof associations extends Map<string, infer V> ? V : never), where: any = {}): boolean => (
    (!where.AND || where.AND.every((condition: any) => correspondAsso(a, condition)))
    && (!where.id || (typeof where.id === "string" ? a.id === where.id
      : (!where.id.in || where.id.in.includes(a.id)) && (!where.id.notIn || !where.id.notIn.includes(a.id))))
    && (where.valide === undefined || a.valide === where.valide) && (!where.pays || a.pays === where.pays)
    && (!where.ville || (typeof where.ville === "string" ? a.ville === where.ville : a.ville !== null))
    && (!where.vocation || (typeof where.vocation === "string" ? a.vocation === where.vocation : a.vocation !== null))
    && (!where.responsableId || a.responsableId === where.responsableId)
    && (!where.membres || affiliations.has(key(a.id, where.membres.some.profilId)))
    && (!where.OR || where.OR.some((condition: Record<string, { contains: string }>) => Object.entries(condition).every(([champ, filtre]) => String((a as any)[champ] || "").includes(filtre.contains))))
  );
  const filtreAsso = (where: any = {}) => [...associations.values()].filter((a) => correspondAsso(a, where));
  const filtreAffiliation = (where: any) => [...affiliations.values()].filter((a) =>
    (!where.associationId || a.associationId === where.associationId) && (!where.profilId || a.profilId === where.profilId)
    && (!where.association || filtreAsso(where.association).some((asso) => asso.id === a.associationId))
    && (!where.statut || (typeof where.statut === "string" ? a.statut === where.statut : where.statut.in.includes(a.statut)))
    && (!where.profil || profils.some((p) => p.id === a.profilId && visible(p))));
  const db = {
    profil: {
      findUnique: async ({ where }: any) => resolveProfil(where) || null,
      findFirst: async ({ where }: any) => resolveProfil(where) || null,
      findMany: async ({ where }: any) => profils.filter((p) => (!where.id?.in || where.id.in.includes(p.id)) && (!where.onboardingFini || visible(p))),
    },
    association: {
      findUnique: async (args: any) => { appels.push({ methode: "association.findUnique", args }); const a = associations.get(args.where.id); return a ? selection(a, args.select) : null; },
      findMany: async (args: any) => {
        appels.push({ methode: "association.findMany", args });
        if (args.distinct) {
          const champ = args.distinct[0] as "pays" | "ville" | "vocation";
          return [...new Set(filtreAsso(args.where).map((a) => a[champ]))].map((v) => ({ [champ]: v }));
        }
        return filtreAsso(args.where).sort((a, b) => a.nom.localeCompare(b.nom) || a.id.localeCompare(b.id)).slice(args.skip || 0, args.take === undefined ? undefined : (args.skip || 0) + args.take).map((a) => selection(a, args.select));
      },
      count: async ({ where }: any) => filtreAsso(where).length,
      delete: async ({ where }: any) => {
        if (echecSuppression) throw new Error("FIXTURE_DELETE_FAILURE");
        const avant = associations.get(where.id); associations.delete(where.id); return avant;
      },
      create: async (args: any) => { appels.push({ methode: "association.create", args }); const a = { id: "asso-created", createdAt: now, photo: null, photoCouverture: null, ...args.data }; associations.set(a.id, a); return a; },
      update: async (args: any) => { appels.push({ methode: "association.update", args }); const a = { ...associations.get(args.where.id)!, ...args.data }; associations.set(a.id, a); return a; },
    },
    associationMembre: {
      groupBy: async (args: any) => {
        appels.push({ methode: "associationMembre.groupBy", args });
        const nombres = new Map<string, number>();
        for (const membre of filtreAffiliation(args.where)) nombres.set(membre.associationId, (nombres.get(membre.associationId) || 0) + 1);
        return [...nombres].map(([associationId, profilId]) => ({ associationId, _count: { profilId } }));
      },
      upsert: async ({ where, create }: any) => { const k = key(where.associationId_profilId.associationId, where.associationId_profilId.profilId); if (!affiliations.has(k)) affiliations.set(k, { rejointLe: null, ...create }); return affiliations.get(k); },
      findUnique: async ({ where }: any) => affiliations.get(key(where.associationId_profilId.associationId, where.associationId_profilId.profilId)) || null,
      findUniqueOrThrow: async ({ where }: any) => { const a = affiliations.get(key(where.associationId_profilId.associationId, where.associationId_profilId.profilId)); if (!a) throw Error("absent"); return { statut: a.statut, rejointLe: a.rejointLe }; },
      updateMany: async ({ where, data }: any) => { const trouvees = filtreAffiliation(where); trouvees.forEach((a) => affiliations.set(key(a.associationId, a.profilId), { ...a, ...data })); return { count: trouvees.length }; },
      deleteMany: async ({ where }: any) => {
        const lignes = filtreAffiliation(where);
        lignes.forEach((a) => affiliations.delete(key(a.associationId, a.profilId)));
        return { count: lignes.length };
      },
      count: async ({ where }: any) => filtreAffiliation(where).length,
      findMany: async (args: any) => {
        appels.push({ methode: "associationMembre.findMany", args });
        return filtreAffiliation(args.where).slice(args.skip, args.skip + args.take).map((a) => ({ ...a, profil: profils.find((p) => p.id === a.profilId)! }));
      },
    },
    associationSuggestion: {
      findFirst: async ({ where }: any) => propositions.find((p) => Object.entries(where).every(([k, v]) => (p[k] ?? null) === v)) || null,
      create: async ({ data }: any) => { const p = { id: `suggestion-${propositions.length}`, statut: "EN_ATTENTE", createdAt: now, ...data }; propositions.push(p); return p; },
      findUnique: async ({ where }: any) => propositions.find((p) => p.id === where.id) || null,
      update: async ({ where, data }: any) => { const p = propositions.find((p) => p.id === where.id)!; Object.assign(p, data); return p; },
      count: async () => propositions.length,
      findMany: async () => propositions.map((p) => ({ ...p, proposeur: profils.find((v) => v.id === p.proposeurId) })),
    },
  };
  Object.assign(db, { $transaction: async (fn: (tx: typeof db) => Promise<unknown>, options: any) => {
    assert.equal(options.isolationLevel, "Serializable");
    const copie = structuredClone({ associations, affiliations });
    try { return await fn(db); }
    catch (erreur) {
      associations.clear(); affiliations.clear();
      copie.associations.forEach((v, k) => associations.set(k, v));
      copie.affiliations.forEach((v, k) => affiliations.set(k, v));
      throw erreur;
    }
  } });
  const service = creerServiceAssociations(db as unknown as PrismaClient);
  return { ...creerRouteursAssociations({ service, retirerMedia: (url) => { if (echecMedia) throw Error("FIXTURE_MEDIA_FAILURE"); mediasRetires.push(url); } }), affiliations, associations, appels, propositions, profils, mediasRetires,
    echecSuppression: (v: boolean) => { echecSuppression = v; }, echecMedia: () => { echecMedia = true; } };
}

function requete(router: Router, method: string, path: string, utilisateur = "member", body: unknown = {}, options: { onboarding?: boolean; sansToken?: boolean } = {}) {
  const [pathname, search = ""] = path.split("?");
  const token = signerTokenAcces({ id: `user-${utilisateur}`, tokenVersion: 0 });
  const req = {
    method, url: pathname + (search ? `?${search}` : ""), originalUrl: `${options.onboarding ? "/api/onboarding/associations" : "/api/associations"}${path}`,
    headers: options.sansToken ? {} : { authorization: `Bearer ${token}` },
    body, query: Object.fromEntries(new URLSearchParams(search)), params: {},
  } as unknown as Request;
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json(data: unknown) { resolve({ status, body: data }); return this; } } as unknown as Response;
    (router as unknown as { handle(req: Request, res: Response, next: (err?: unknown) => void): void }).handle(req, res, (err?: unknown) => err ? reject(err) : resolve({ status: 404, body: {} }));
  });
}

test("auth réelle : anonyme refusé, compte en attente limité au routeur onboarding", async () => {
  const f = fixture();
  assert.equal((await requete(f.router, "GET", "/", "member", {}, { sansToken: true })).status, 401);
  assert.equal((await requete(f.router, "GET", "/", "pending")).status, 403);
  assert.equal((await requete(f.router, "PATCH", "/asso-a/affiliations/member", "pending", { decision: "VERIFIE" })).status, 403);
  assert.equal((await requete(f.onboarding, "GET", "/", "pending", {}, { onboarding: true })).status, 200);
  assert.equal((await requete(f.onboarding, "GET", "/asso-a/membres", "pending", {}, { onboarding: true })).status, 404);
  assert.equal((await requete(f.onboarding, "PATCH", "/asso-a/affiliations/member", "pending", { decision: "VERIFIE" }, { onboarding: true })).status, 404);
  assert.equal((await requete(f.onboarding, "POST", "/", "pending", {}, { onboarding: true })).status, 404);
});

test("demande personnelle idempotente pendant onboarding, aucun statut injectable", async () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) {
    const resultat = await requete(f.onboarding, "POST", "/asso-a/affiliation", "pending", {}, { onboarding: true });
    assert.equal(resultat.status, 200); assert.equal(resultat.body.monAffiliation.statut, "EN_ATTENTE");
  }
  assert.equal(f.affiliations.size, 1);
  assert.equal((await requete(f.router, "POST", "/asso-a/affiliation", "member", { statut: "VERIFIE", profilId: "admin" })).status, 400);
  assert.equal(f.affiliations.size, 1);
});

test("demander à nouveau conserve VERIFIE ; REFUSE/DECLARE redeviennent EN_ATTENTE", async () => {
  const f = fixture();
  for (const statut of ["VERIFIE", "REFUSE", "DECLARE"]) {
    f.affiliations.set("asso-a:member", { associationId: "asso-a", profilId: "member", statut, rejointLe: now });
    const resultat = await requete(f.router, "POST", "/asso-a/affiliation");
    assert.equal(resultat.body.monAffiliation.statut, statut === "VERIFIE" ? "VERIFIE" : "EN_ATTENTE");
    assert.equal(resultat.body.monAffiliation.rejointLe, statut === "VERIFIE" ? now : null);
  }
});

test("seul le responsable de cette association ou admin décide, jamais auto-approbation", async () => {
  const f = fixture();
  f.affiliations.set("asso-a:member", { associationId: "asso-a", profilId: "member", statut: "EN_ATTENTE", rejointLe: null });
  f.affiliations.set("asso-a:manager", { associationId: "asso-a", profilId: "manager", statut: "EN_ATTENTE", rejointLe: null });
  assert.equal((await requete(f.router, "PATCH", "/asso-a/affiliations/member", "member", { decision: "VERIFIE" })).status, 403);
  assert.equal((await requete(f.router, "PATCH", "/asso-b/affiliations/member", "manager", { decision: "VERIFIE" })).status, 403);
  assert.equal((await requete(f.router, "PATCH", "/asso-a/affiliations/manager", "manager", { decision: "VERIFIE" })).status, 403);
  assert.equal((await requete(f.router, "PATCH", "/asso-a/affiliations/member", "manager", { decision: "VERIFIE" })).status, 200);
  const affiliation = f.affiliations.get("asso-a:member")!;
  assert.equal(affiliation.statut, "VERIFIE"); assert.ok(affiliation.rejointLe instanceof Date);
  assert.equal((await requete(f.router, "PATCH", "/asso-a/affiliations/member", "manager", { decision: "REFUSE" })).status, 409);
  assert.equal((await requete(f.router, "PATCH", "/asso-a/affiliations/manager", "admin", { decision: "VERIFIE" })).status, 200);
});

test("profil non validé/incomplet ne peut pas devenir membre vérifié", async () => {
  const f = fixture();
  f.affiliations.set("asso-a:pending", { associationId: "asso-a", profilId: "pending", statut: "EN_ATTENTE", rejointLe: null });
  const r = await requete(f.router, "PATCH", "/asso-a/affiliations/pending", "admin", { decision: "VERIFIE" });
  assert.equal(r.status, 409); assert.equal(f.affiliations.get("asso-a:pending")!.statut, "EN_ATTENTE");
});

test("roster vérifié seul, membres privés et en attente exclus, pas d'e-mail de compte sélectionné", async () => {
  const f = fixture();
  for (const [profilId, statut] of [["member", "VERIFIE"], ["manager", "EN_ATTENTE"], ["pending", "VERIFIE"]]) {
    f.affiliations.set(`asso-a:${profilId}`, { associationId: "asso-a", profilId, statut, rejointLe: now });
  }
  const r = await requete(f.router, "GET", "/asso-a");
  assert.equal(r.status, 200); assert.equal(r.body.association.nbMembres, 1);
  assert.deepEqual(r.body.membres.map((p: any) => p.id), ["member"]);
  assert.equal(r.body.association.responsable.id, "manager");
  const select = f.appels.find((a) => a.methode === "associationMembre.findMany")!.args.select;
  assert.equal(select.profil.select.user.select.email, undefined);
  assert.equal((await requete(f.router, "GET", "/asso-a/affiliations", "member")).status, 403);
  const gestion = await requete(f.router, "GET", "/asso-a/affiliations", "manager");
  assert.deepEqual(gestion.body.affiliations.map((a: any) => a.profil.id), ["manager"]);
});

test("filtrage annuaire, compte global et facettes gardent leurs sémantiques", async () => {
  const f = fixture();
  const r = await requete(f.router, "GET", "/?pays=Mali&ville=Bamako&vocation=%C3%89ducation&limite=1");
  assert.equal(r.status, 200); assert.equal(r.body.total, 1); assert.equal(r.body.totalGlobal, 2);
  assert.equal(r.body.totalPages, 1); assert.deepEqual(r.body.facettes.pays, ["Mali", "France"]);
  assert.equal(r.body.associations[0].id, "asso-a");
  assert.equal(f.appels.find((a) => a.methode === "association.findMany" && a.args.distinct?.[0] === "ville")!.args.where.pays, "Mali");
  assert.equal((await requete(f.router, "GET", "/?limite=5000")).status, 400);
});

test("création admin exige descriptif complet et responsable valide ; URL dangereuse refusée", async () => {
  const f = fixture();
  const body = { nom: "Nouvelle association", description: "Mission", pays: "Mali", ville: "Bamako", vocation: "Sport", responsableId: "manager", dateCreation: "2000-02-29" };
  assert.equal((await requete(f.router, "POST", "/", "manager", body)).status, 403);
  assert.equal((await requete(f.router, "POST", "/", "admin", { nom: "Nom", pays: "Mali" })).status, 400);
  assert.equal((await requete(f.router, "POST", "/", "admin", { ...body, responsableId: "pending" })).status, 400);
  assert.equal((await requete(f.router, "POST", "/", "admin", { ...body, site: "javascript:alert(1)" })).status, 400);
  assert.equal((await requete(f.router, "POST", "/", "admin", { ...body, dateCreation: "2001-02-29" })).status, 400);
  assert.equal((await requete(f.router, "POST", "/", "admin", { ...body, dateCreation: "2020-01-01Tnonsense" })).status, 400);
  assert.equal((await requete(f.router, "POST", "/", "admin", body)).status, 201);
  const creation = f.appels.find((a) => a.methode === "association.create")!.args.data;
  assert.equal(creation.dateCreation.toISOString(), "2000-02-29T00:00:00.000Z");
  assert.equal(creation.responsableId, "manager");
});

test("PATCH administratif partiel permet d'effacer un responsable legacy sans exposer médias", async () => {
  const f = fixture();
  assert.equal((await requete(f.router, "PATCH", "/asso-a", "admin", {})).status, 400);
  assert.equal((await requete(f.router, "PATCH", "/asso-a", "manager", { description: "Texte" })).status, 403);
  assert.equal((await requete(f.router, "PATCH", "/asso-a", "admin", { photo: "/uploads/quelquun.png" })).status, 400);
  assert.equal((await requete(f.router, "PATCH", "/asso-a", "admin", { responsableId: null, site: "" })).status, 200);
  const data = f.appels.find((a) => a.methode === "association.update")!.args.data;
  assert.deepEqual(data, { responsableId: null, site: null });
});

test("suggestion onboarding reste interne ; seul admin la traite, sans créer d'association", async () => {
  const f = fixture();
  const body = { nom: "Asso proposée", pays: "Mali", ville: "Bamako", vocation: "Santé", message: "Demande" };
  const r = await requete(f.onboarding, "POST", "/suggestions", "pending", body, { onboarding: true });
  assert.equal(r.status, 201); assert.equal(r.body.suggestion.statut, "EN_ATTENTE");
  assert.equal(f.propositions[0].proposeurId, "pending");
  assert.equal((await requete(f.router, "GET", "/suggestions", "member")).status, 403);
  assert.equal((await requete(f.router, "PATCH", `/suggestions/${r.body.suggestion.id}`, "member", { statut: "TRAITEE" })).status, 403);
  assert.equal((await requete(f.router, "PATCH", `/suggestions/${r.body.suggestion.id}`, "admin", { statut: "TRAITEE" })).status, 200);
  assert.equal(f.associations.size, 2);
});

test("quitter est personnel, idempotent et possible même après désactivation", async () => {
  const f = fixture();
  for (const profilId of ["member", "manager"]) f.affiliations.set(`asso-a:${profilId}`, { associationId: "asso-a", profilId, statut: "VERIFIE", rejointLe: now });
  f.associations.get("asso-a")!.valide = false;
  for (let i = 0; i < 2; i++) assert.equal((await requete(f.router, "DELETE", "/asso-a/affiliation", "member")).status, 200);
  assert.equal(f.affiliations.has("asso-a:member"), false); assert.equal(f.affiliations.has("asso-a:manager"), true);
});

test("gestion ne révèle pas les associations d'un autre responsable et préautorise les uploads", async () => {
  const f = fixture();
  const r = await requete(f.router, "GET", "/mes", "manager");
  assert.deepEqual(r.body.associations.map((a: any) => a.id), ["asso-a"]);
  assert.equal((await requete(f.router, "POST", "/asso-b/photo", "manager")).status, 403);
  assert.equal((await requete(f.router, "POST", "/asso-a/couverture", "member")).status, 403);
  assert.equal((await requete(f.router, "DELETE", "/asso-b/couverture", "manager")).status, 403);
  assert.equal(f.appels.some((a) => a.methode === "association.update"), false);
});

test("spécialiste ASSOCIATIONS : gestion sans ADMIN et sans auto-approbation",async()=>{const f=fixture();assert.equal((await requete(f.router,"GET","/suggestions","autre-specialiste")).status,403);assert.equal((await requete(f.router,"GET","/suggestions","associations-specialiste")).status,200);assert.equal((await requete(f.router,"GET","/mes","associations-specialiste")).body.associations.length,2);const body={nom:"Association déléguée",description:"Mission",pays:"Mali",ville:"Bamako",vocation:"Sport",responsableId:"manager"};assert.equal((await requete(f.router,"POST","/","associations-specialiste",body)).status,201);assert.equal((await requete(f.router,"PATCH","/asso-a","autre-specialiste",{description:"Non autorisé"})).status,403);assert.equal((await requete(f.router,"PATCH","/asso-a","associations-specialiste",{description:"Autorisé"})).status,200);f.affiliations.set("asso-a:associations-specialiste",{associationId:"asso-a",profilId:"associations-specialiste",statut:"EN_ATTENTE",rejointLe:null});assert.equal((await requete(f.router,"PATCH","/asso-a/affiliations/associations-specialiste","associations-specialiste",{decision:"VERIFIE"})).status,403);f.affiliations.set("asso-a:member",{associationId:"asso-a",profilId:"member",statut:"EN_ATTENTE",rejointLe:null});assert.equal((await requete(f.router,"PATCH","/asso-a/affiliations/member","associations-specialiste",{decision:"VERIFIE"})).status,200);});


test("classement associations avant pagination : membres vérifiés décroissants puis nom/id, sans doublons entre pages", async () => {
  const f = fixture();
  f.associations.set("asso-c", { ...f.associations.get("asso-b")!, id: "asso-c", nom: "Association Z" });
  for (const [associationId, profilId] of [["asso-c", "member"], ["asso-c", "admin"], ["asso-b", "manager"]]) {
    f.affiliations.set(`${associationId}:${profilId}`, { associationId, profilId, statut: "VERIFIE", rejointLe: now });
  }
  const pages = await Promise.all([1, 2, 3, 4].map((page) => requete(f.router, "GET", `/?page=${page}&limite=1`)));
  assert.deepEqual(pages.map((p) => p.body.associations.map((a: any) => a.id)), [["asso-c"], ["asso-b"], ["asso-a"], []]);
  assert.deepEqual(pages.slice(0, 3).map((p) => p.body.associations[0].nbMembres), [2, 1, 0]);
  assert.equal(pages[0].body.total, 3); assert.equal(pages[0].body.totalPages, 3);
});

test("priorité associations : affiliations non vérifiées et profils en attente, refusés ou incomplets exclus", async () => {
  const f = fixture();
  f.profils.find((p) => p.id === "other-manager")!.user.statut = "REFUSE";
  f.profils.find((p) => p.id === "autre-specialiste")!.onboardingFini = false;
  for (const [profilId, statut] of [["member", "EN_ATTENTE"], ["admin", "REFUSE"], ["manager", "DECLARE"], ["pending", "VERIFIE"], ["other-manager", "VERIFIE"], ["autre-specialiste", "VERIFIE"]]) {
    f.affiliations.set(`asso-a:${profilId}`, { associationId: "asso-a", profilId, statut, rejointLe: now });
  }
  f.affiliations.set("asso-b:member", { associationId: "asso-b", profilId: "member", statut: "VERIFIE", rejointLe: now });
  const resultat = await requete(f.router, "GET", "/?limite=1");
  assert.equal(resultat.status, 200); assert.equal(resultat.body.associations[0].id, "asso-b");
  assert.equal(resultat.body.associations[0].nbMembres, 1);
  const groupes = f.appels.find((a) => a.methode === "associationMembre.groupBy")!;
  assert.deepEqual(groupes.args.where.profil, { onboardingFini: true, user: { statut: "VALIDE" } });
  assert.equal(groupes.args.where.statut, "VERIFIE");
});

test("priorité associations préserve recherche, facettes et filtres, y compris sans aucun membre", async () => {
  const f = fixture();
  f.associations.set("asso-c", { ...f.associations.get("asso-a")!, id: "asso-c", nom: "Association Z" });
  f.affiliations.set("asso-b:member", { associationId: "asso-b", profilId: "member", statut: "VERIFIE", rejointLe: now });
  f.affiliations.set("asso-c:member", { associationId: "asso-c", profilId: "member", statut: "VERIFIE", rejointLe: now });
  const filtre = await requete(f.router, "GET", "/?pays=Mali&ville=Bamako&vocation=%C3%89ducation&q=Association&limite=2");
  assert.equal(filtre.status, 200);
  assert.deepEqual(filtre.body.associations.map((a: any) => a.id), ["asso-c", "asso-a"]);
  assert.equal(filtre.body.total, 2); assert.equal(filtre.body.totalGlobal, 3);
  assert.deepEqual(filtre.body.facettes.villes, ["Bamako"]);
  f.affiliations.clear();
  const alphabetique = await requete(f.router, "GET", "/?page=2&limite=2");
  assert.deepEqual(alphabetique.body.associations.map((a: any) => a.id), ["asso-c"]);
});

test("égalité de membres associations : ordre nom puis identifiant déterministe", async () => {
  const f = fixture();
  f.associations.set("asso-c", { ...f.associations.get("asso-b")!, id: "asso-c" });
  for (const associationId of ["asso-c", "asso-b", "asso-a"]) {
    f.affiliations.set(`${associationId}:member`, { associationId, profilId: "member", statut: "VERIFIE", rejointLe: now });
  }
  const resultat = await requete(f.router, "GET", "/?limite=3");
  assert.deepEqual(resultat.body.associations.map((a: any) => a.id), ["asso-a", "asso-b", "asso-c"]);
});


test("suppression association : responsable, admin et spécialiste autorisés ; autre membre/domaine refusés", async () => {
  for (const acteur of ["manager", "admin", "associations-specialiste", "member", "autre-specialiste"]) {
    const f = fixture();
    const autorise = ["manager", "admin", "associations-specialiste"].includes(acteur);
    const fiche = await requete(f.router, "GET", "/asso-a", acteur);
    assert.equal(fiche.body.association.peutSupprimer, autorise);
    const resultat = await requete(f.router, "DELETE", "/asso-a", acteur);
    assert.equal(resultat.status, autorise ? 200 : 403);
    assert.equal(f.associations.has("asso-a"), !autorise);
    assert.ok(f.associations.has("asso-b"));
  }
  const f = fixture();
  assert.equal((await requete(f.router, "DELETE", "/asso-a", "member", {}, { sansToken: true })).status, 401);
  assert.equal((await requete(f.router, "DELETE", "/asso-a", "pending")).status, 403);
  assert.equal((await requete(f.router, "DELETE", "/absente", "admin")).status, 404);
});

test("suppression association atomique : toutes affiliations retirées, suggestions conservées, médias après commit uniquement", async () => {
  const f = fixture();
  Object.assign(f.associations.get("asso-a")!, { photo: "/uploads/avatars/fixture.jpg", photoCouverture: "/uploads/couvertures/fixture.webp" });
  f.propositions.push({ id: "suggestion-traitee", nom: "Association A", statut: "TRAITEE" });
  for (const [profilId, statut] of [["member", "VERIFIE"], ["pending", "EN_ATTENTE"], ["admin", "REFUSE"]]) {
    f.affiliations.set(`asso-a:${profilId}`, { associationId: "asso-a", profilId, statut, rejointLe: null });
  }
  f.affiliations.set("asso-b:member", { associationId: "asso-b", profilId: "member", statut: "VERIFIE", rejointLe: now });
  f.echecSuppression(true);
  await assert.rejects(requete(f.router, "DELETE", "/asso-a", "manager"), /FIXTURE_DELETE_FAILURE/);
  assert.ok(f.associations.has("asso-a")); assert.equal(f.affiliations.size, 4); assert.equal(f.mediasRetires.length, 0);
  f.echecSuppression(false);
  assert.equal((await requete(f.router, "DELETE", "/asso-a", "manager")).status, 200);
  assert.deepEqual([...f.affiliations.keys()], ["asso-b:member"]);
  assert.equal(f.propositions.length, 1);
  assert.deepEqual(f.mediasRetires, ["/uploads/avatars/fixture.jpg", "/uploads/couvertures/fixture.webp"]);
  assert.equal((await requete(f.router, "DELETE", "/asso-a", "manager")).status, 404);
});


test("association supprimée : échec média après commit ne remet pas la fiche dans l’interface", async () => {
  const f = fixture(); f.echecMedia();
  Object.assign(f.associations.get("asso-a")!, { photo: "/uploads/avatars/fixture.jpg" });
  assert.equal((await requete(f.router, "DELETE", "/asso-a", "manager")).status, 200);
  assert.equal(f.associations.has("asso-a"), false);
});

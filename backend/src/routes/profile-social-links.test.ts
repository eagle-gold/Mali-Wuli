import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import userRouter from "./user.routes";
import onboardingRouter from "./onboarding.routes";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth.middleware";
import { CHAMPS_LIENS_SOCIAUX, schemaLienSocial, liensSociauxProfil } from "../lib/liens-sociaux";

type Row = Record<string, any>;
const ancienQuestionnaire = () => ({
  informations: { prenom: "Awa", nom: "Test", telephone: "", indicatif: "+223", pays: "Mali", paysCode: "ML", ville: "Bamako" },
  formations: [], experiences: [],
  mentorat: { estVolontaire: false, sujets: [], precisionsSujets: {}, duree: null, format: null, fuseauHoraire: "Africa/Bamako", dateDebut: "", dateFin: null, disponibilites: [], maxRdvMois: null },
});
function mock(t: TestContext, cible: any, methode: string, implementation: (...args: any[]) => any) {
  const avant = cible[methode]; cible[methode] = implementation; t.after(() => { cible[methode] = avant; });
}
function projeter(row: any, select?: Row): any {
  if (row == null || !select) return row;
  if (Array.isArray(row)) return row.map(value => projeter(value, select));
  return Object.fromEntries(Object.entries(select).map(([k, v]) => [k, v === true ? row[k] : projeter(row[k], (v as Row).select)]));
}
function fixture(t: TestContext) {
  const identite: Row = { id: "session-user", prenom: "Awa", nom: "Test", email: "qa@example.invalid", role: "MEMBRE", rolesDelegues: [], statut: "VALIDE", emailVerifie: true, createdAt: new Date("2025-01-01") };
  const profil: Row = { id: "session-profile", userId: identite.id, pays: "Mali", ville: "Bamako", telephone: null, estVolontaire: false, onboardingFini: true, onboardingEtape: 4,
    linkedin: "https://www.linkedin.com/in/ancien", facebook: "https://www.facebook.com/ancien", instagram: null, tiktok: null,
    onboardingDonnees: ancienQuestionnaire(), formations: [], experiences: [], volontaire: null, cerclesMembres: [], associations: [], emailVisible: false, telephoneVisible: false, _count: { publications: 0, commentairesPub: 0 } };
  const ecritures: Row[] = [];
  mock(t, prisma.user, "findUnique", async ({ where, select }) => {
    assert.equal(where.id, identite.id);
    if (select.profil?.select) for (const champ of CHAMPS_LIENS_SOCIAUX) assert.equal(select.profil.select[champ], true, "Sélection relationnelle requise : " + champ);
    return projeter({ ...identite, profil }, select);
  });
  mock(t, prisma.user, "update", async ({ where, data }) => {
    assert.equal(where.id, identite.id); ecritures.push(data);
    if (data.prenom !== undefined) identite.prenom = data.prenom;
    if (data.nom !== undefined) identite.nom = data.nom;
    if (data.profil) Object.assign(profil, data.profil.upsert.update);
    return { ...identite, profil };
  });
  mock(t, prisma.profil, "findUnique", async () => ({ id: profil.id }));
  mock(t, prisma.profil, "findFirst", async ({ where, select }) => {
    assert.equal(where.onboardingFini, true); assert.deepEqual(where.user, { statut: "VALIDE" });
    for (const champ of CHAMPS_LIENS_SOCIAUX) assert.equal(select[champ], true);
    return projeter({ ...profil, user: identite }, select);
  });
  for (const delegate of [prisma.synergie, prisma.rendezVous, prisma.publication, prisma.commentairePublication]) mock(t, delegate, "count", async () => 0);
  mock(t, prisma.synergie, "findUnique", async () => null);
  mock(t, prisma.paysEducation, "findMany", async () => [{ code: "ML", nom: "Mali", indicatif: "223" }]);
  for (const delegate of [prisma.etablissement, prisma.programmeEducation, prisma.diplomeEducation]) mock(t, delegate, "findMany", async () => []);
  mock(t, prisma, "$transaction", async (callback: any) => callback({
    user: { update: async ({ where, data }: Row) => { assert.equal(where.id, identite.id); Object.assign(identite, data); return identite; } },
    profil: { update: async ({ where, data }: Row) => { assert.equal(where.id, profil.id); ecritures.push(data); Object.assign(profil, data); return profil; } },
    formation: { deleteMany: async () => ({ count: 0 }) },
    experience: { deleteMany: async () => ({ count: 0 }) },
    volontaire: { deleteMany: async () => ({ count: 0 }) },
  }));
  return { profil, identite, ecritures };
}
async function appeler(router: any, method: string, routePath: string, body?: unknown, params: Row = {}) {
  const route = router.stack.find((layer: Row) => layer.route?.path === routePath && layer.route.methods[method]).route;
  const couches = route.stack.filter((layer: Row) => !layer.method || layer.method === method);
  assert.equal(couches[0].handle, authenticate, "Authentification conservée pour " + method + " " + routePath);
  let status = 200, data: any; const headers: Row = {};
  const response = { status(n: number) { status = n; return this; }, json(value: unknown) { data = value; return this; }, set(k: string, v: string) { headers[k] = v; return this; } };
  await couches.at(-1).handle({ userId: "session-user", body, params, query: {} }, response);
  return { status, body: data, headers };
}

test("liens sociaux : facultatifs, normalisés et limite appliquée à la valeur persistée", () => {
  for (const valeur of ["", "  \n ", null]) assert.equal(schemaLienSocial.parse(valeur), null);
  assert.equal(schemaLienSocial.parse(undefined), undefined);
  assert.equal(schemaLienSocial.parse("  HTTPS://WWW.INSTAGRAM.COM/awa  "), "https://www.instagram.com/awa");
  assert.equal(schemaLienSocial.parse("http://example.test/p"), "http://example.test/p");
  const exact = "https://example.test/" + "a".repeat(479);
  assert.equal(exact.length, 500); assert.equal(schemaLienSocial.parse(exact), exact);
  assert.equal(schemaLienSocial.safeParse(exact + "a").success, false);
  const unicode = "https://example.test/" + "é".repeat(100);
  assert(unicode.length < 500 && new URL(unicode).toString().length > 500);
  assert.equal(schemaLienSocial.safeParse(unicode).success, false);
});

test("liens sociaux : protocoles actifs, URL relatives et identifiants refusés sans aucun fetch", () => {
  for (const valeur of ["javascript:alert(1)", "data:text/html,bonjour", "ftp://example.test", "/profil", "example.test", "https://user:pass@example.test/", "https://user@example.test/", 42, {}, []]) {
    assert.equal(schemaLienSocial.safeParse(valeur).success, false, String(valeur));
  }
  assert.deepEqual(liensSociauxProfil({ linkedin: "javascript:alert(1)" }), { linkedin: null, facebook: null, instagram: null, tiktok: null });
});

test("PUT puis PATCH profil : quatre liens sélectionnés, normalisés et exposés, sans élargir les coordonnées privées", async (t) => {
  const f = fixture(t);
  const r = await appeler(userRouter, "put", "/me", { linkedin: " https://linkedin.com/in/awa ", facebook: "https://facebook.com/awa", instagram: "https://instagram.com/awa", tiktok: "https://tiktok.com/@awa" });
  assert.equal(r.status, 200); assert.equal(r.body.user.profil.linkedin, "https://linkedin.com/in/awa");
  for (const champ of CHAMPS_LIENS_SOCIAUX) assert.equal(r.body.user.profil[champ], f.profil[champ]);
  const patch = await appeler(userRouter, "patch", "/me", { instagram: "https://instagram.com/modifie" });
  assert.equal(patch.status, 200); assert.equal(f.profil.instagram, "https://instagram.com/modifie");
  assert.equal(f.profil.facebook, "https://facebook.com/awa");
  const publicProfil = await appeler(userRouter, "get", "/:id", undefined, { id: f.profil.id });
  assert.equal(publicProfil.status, 200); assert.equal(publicProfil.body.tiktok, "https://tiktok.com/@awa");
  assert.equal(publicProfil.body.email, null); assert.equal(publicProfil.body.telephone, null);
});

test("profil : omission conserve et vide explicite efface chaque réseau", async (t) => {
  const f = fixture(t);
  assert.equal((await appeler(userRouter, "patch", "/me", { bio: "Bio modifiée" })).status, 200);
  assert.equal(f.profil.linkedin, "https://www.linkedin.com/in/ancien");
  for (const valeur of ["", null, "   "]) {
    for (const champ of CHAMPS_LIENS_SOCIAUX) f.profil[champ] = "https://example.test/profil";
    assert.equal((await appeler(userRouter, "patch", "/me", Object.fromEntries(CHAMPS_LIENS_SOCIAUX.map(champ => [champ, valeur])))).status, 200);
    for (const champ of CHAMPS_LIENS_SOCIAUX) assert.equal(f.profil[champ], null);
  }
});

test("profil : URL invalide ou champ utilisateur injecté est rejeté avant toute écriture", async (t) => {
  const f = fixture(t);
  for (const body of [{ linkedin: "javascript:alert(1)" }, { facebook: "https://user:pass@example.test" }, { tiktok: "/relatif" }, { instagram: "https://example.test/" + "é".repeat(100) }, { facebook: "https://example.test/", userId: "autre" }]) {
    assert.equal((await appeler(userRouter, "patch", "/me", body)).status, 400);
  }
  assert.equal(f.ecritures.length, 0);
});

test("onboarding GET : les quatre liens relationnels remplacent les anciens liens du snapshot", async (t) => {
  const f = fixture(t);
  Object.assign(f.profil.onboardingDonnees.informations, { linkedin: "https://example.test/vieux", facebook: "https://example.test/vieux", instagram: "https://example.test/vieux", tiktok: "https://example.test/vieux" });
  f.profil.linkedin = "https://example.test/recent"; f.profil.facebook = null;
  const r = await appeler(onboardingRouter, "get", "/");
  assert.equal(r.status, 200); assert.equal(r.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(CHAMPS_LIENS_SOCIAUX.map(k => r.body.informations[k]), ["https://example.test/recent", null, null, null]);
});

test("onboarding GET sans snapshot reconstruit les liens relationnels", async (t) => {
  const f = fixture(t); f.profil.onboardingDonnees = null;
  const r = await appeler(onboardingRouter, "get", "/");
  assert.equal(r.status, 200); assert.equal(r.body.informations.linkedin, f.profil.linkedin);
  for (const champ of CHAMPS_LIENS_SOCIAUX) assert(champ in r.body.informations);
});

test("onboarding POST ancien client conserve les liens modifiés via PATCH malgré son ancien snapshot", async (t) => {
  const f = fixture(t), ancien = ancienQuestionnaire();
  assert.equal((await appeler(userRouter, "patch", "/me", { linkedin: "https://example.test/nouveau", facebook: null })).status, 200);
  assert.equal((await appeler(onboardingRouter, "post", "/", ancien)).status, 201);
  assert.equal(f.profil.linkedin, "https://example.test/nouveau"); assert.equal(f.profil.facebook, null);
  assert.equal(f.profil.onboardingDonnees.informations.linkedin, "https://example.test/nouveau");
  assert.equal(f.profil.onboardingDonnees.informations.facebook, null);
  const donnees = await appeler(onboardingRouter, "get", "/");
  assert.equal(donnees.body.informations.linkedin, "https://example.test/nouveau");
});

test("onboarding POST nouveau client persiste les quatre réseaux et permet l’effacement explicite", async (t) => {
  const f = fixture(t), body: Row = ancienQuestionnaire();
  Object.assign(body.informations, { linkedin: null, facebook: "  ", instagram: " https://instagram.com/awa ", tiktok: "https://tiktok.com/@awa" });
  assert.equal((await appeler(onboardingRouter, "post", "/", body)).status, 201);
  assert.equal(f.profil.linkedin, null); assert.equal(f.profil.facebook, null);
  assert.equal(f.profil.instagram, "https://instagram.com/awa"); assert.equal(f.profil.tiktok, "https://tiktok.com/@awa");
  for (const champ of CHAMPS_LIENS_SOCIAUX) assert.equal(f.profil.onboardingDonnees.informations[champ], f.profil[champ]);
});

test("onboarding ancien client : modification de lien concurrente conservée même après lecture initiale", async (t) => {
  const f = fixture(t);
  const transactionSimulee = (prisma as any).$transaction;
  mock(t, prisma, "$transaction", async (callback: any) => {
    // Une édition depuis le profil intervient entre la lecture initiale et la sauvegarde.
    f.profil.linkedin = "https://example.test/plus-recent";
    return transactionSimulee(callback);
  });
  assert.equal((await appeler(onboardingRouter, "post", "/", ancienQuestionnaire())).status, 201);
  assert.equal(f.profil.linkedin, "https://example.test/plus-recent");
  assert.equal("linkedin" in f.ecritures.at(-1)!, false, "Le POST ancien n’écrit pas le champ omis");
  assert.equal((await appeler(onboardingRouter, "get", "/")).body.informations.linkedin, "https://example.test/plus-recent");
});

test("onboarding POST refuse URL invalide avant toute transaction", async (t) => {
  const f = fixture(t), body: Row = ancienQuestionnaire(); body.informations.instagram = "data:text/html,non";
  assert.equal((await appeler(onboardingRouter, "post", "/", body)).status, 400);
  assert.equal(f.ecritures.length, 0);
});

test("ancien LinkedIn invalide conservé par omission mais jamais exposé comme lien", async (t) => {
  const f = fixture(t); f.profil.linkedin = "javascript:alert(1)";
  assert.equal((await appeler(userRouter, "patch", "/me", { bio: "inchangé" })).body.user.profil.linkedin, null);
  assert.equal(f.profil.linkedin, "javascript:alert(1)");
  assert.equal((await appeler(onboardingRouter, "post", "/", ancienQuestionnaire())).status, 201);
  assert.equal(f.profil.linkedin, "javascript:alert(1)");
  assert.equal((await appeler(onboardingRouter, "get", "/")).body.informations.linkedin, null);
  assert.equal((await appeler(userRouter, "get", "/:id", undefined, { id: f.profil.id })).body.linkedin, null);
});

test("nouvelle route PATCH conserve le refus des appels sans session", async () => {
  const route = (userRouter as any).stack.find((layer: Row) => layer.route?.path === "/me" && layer.route.methods.patch).route;
  const middleware = route.stack.find((layer: Row) => layer.method === "patch").handle;
  let status = 0, next = false;
  await middleware({ headers: {} }, { status(n: number) { status = n; return this; }, json() { return this; } }, () => { next = true; });
  assert.equal(status, 401); assert.equal(next, false);
});

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import router from "./user.routes";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth.middleware";

function mock(t: TestContext, cible: any, methode: string, implementation: (...args: any[]) => any) {
  const avant = cible[methode]; cible[methode] = implementation;
  t.after(() => { cible[methode] = avant; });
}
async function appeler(path: string, options: { params?: object; query?: object } = {}) {
  const route = (router as any).stack.find((c: any) => c.route?.path === path && c.route?.methods.get).route;
  assert.equal(route.stack[0].handle, authenticate, "La route reste protégée par authenticate");
  let status = 200; let body: any;
  const res = { status(n: number) { status = n; return this; }, json(v: any) { body = v; return this; } };
  await route.stack.at(-1).handle({ userId: "lecteur-user", params: {}, query: {}, ...options }, res);
  return { status, body };
}

test("profil public : seules les affiliations validées et actives sont sélectionnées ; coordonnées privées masquées", async (t) => {
  mock(t, prisma.profil, "findUnique", async () => ({ id: "lecteur" }));
  mock(t, prisma.profil, "findFirst", async (args) => {
    assert.deepEqual(args.where.user, { statut: "VALIDE" });
    assert.equal(args.where.onboardingFini, true);
    assert.deepEqual(args.select.associations.where, { statut: "VERIFIE", association: { valide: true } });
    return {
      id: "membre", userId: "membre-user", telephone: "coordonnée privée", emailVisible: false, telephoneVisible: false,
      user: { prenom: "Awa", nom: "Diarra", email: "private@example.test", createdAt: new Date("2024-01-01") },
      associations: [{ association: { id: "association", nom: "Association validée" } }],
      cerclesMembres: [], _count: { publications: 2, commentairesPub: 3 },
    };
  });
  mock(t, prisma.synergie, "findUnique", async () => ({ id: "synergie", statut: "ACCEPTE" }));
  mock(t, prisma.synergie, "count", async () => 4);
  const { status, body } = await appeler("/:id", { params: { id: "membre" } });
  assert.equal(status, 200);
  assert.equal(body.email, null); assert.equal(body.telephone, null); assert.equal(body.estMoi, false);
  assert.deepEqual(body.associations, [{ id: "association", nom: "Association validée" }]);
  assert.equal(body.synergie.statut, "ACCEPTE"); assert.equal(body.stats.nbSynergies, 4);
  assert.equal("emailVisible" in body, false); assert.equal("user" in body, false);
});

test("profil public : compte non visible reste introuvable", async (t) => {
  mock(t, prisma.profil, "findUnique", async () => ({ id: "lecteur" }));
  mock(t, prisma.profil, "findFirst", async () => null);
  assert.equal((await appeler("/:id", { params: { id: "invisible" } })).status, 404);
});

test("annuaire : compteurs et facettes suivent les mêmes règles de visibilité que les membres", async (t) => {
  mock(t, prisma.profil, "findUnique", async () => ({ id: "lecteur" }));
  const scope = (where: any) => { assert.deepEqual(where.user, { statut: "VALIDE" }); assert.equal(where.onboardingFini, true); assert.deepEqual(where.id, { not: "lecteur" }); };
  mock(t, prisma.profil, "findMany", async ({ where, select }) => {
    scope(where);
    if (select.user) return [{ id: "membre", userId: "membre-user", estVolontaire: false, volontaire: { sujets: ["Ne pas afficher"] }, formations: [], cerclesMembres: [] }];
    if (select.pays) return [{ pays: "Mali" }];
    return [{ ville: "Bamako" }];
  });
  mock(t, prisma.profil, "count", async ({ where }) => { scope(where); return 1; });
  mock(t, prisma.formation, "findMany", async ({ where }) => { scope(where.profil); return [{ anneeFin: 2019, diplomesScolaires: [], avis: null, etablissement: { id: "ecole", nom: "Liberté" } }]; });
  mock(t, prisma.volontaire, "findMany", async ({ where }) => { scope(where.profil); assert.equal(where.profil.estVolontaire, true); return [{ sujets: ["Mentorat"] }]; });
  const { status, body } = await appeler("/");
  assert.equal(status, 200); assert.equal(body.totalGlobal, 1);
  assert.deepEqual(body.membres[0].aides, []);
  assert.deepEqual(body.facettes, { pays: ["Mali"], villes: ["Bamako"], etablissements: [{ id: "ecole", nom: "Liberté" }], promotions: [2019], aides: ["Mentorat"] });
});

test("annuaire : mauvaise pagination arrêtée avant Prisma", async (t) => {
  mock(t, prisma.profil, "findUnique", async () => { throw new Error("Ne doit pas accéder à la base"); });
  assert.equal((await appeler("/", { query: { limite: "1000" } })).status, 400);
});

import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test, type TestContext } from "node:test";
import express from "express";
import { prisma } from "../lib/prisma";
import { signerTokenAcces } from "../lib/auth-token";
import { chercherReferences } from "../education/catalog-service";
import onboardingRouter, { schemaFormation } from "../routes/onboarding.routes";
import { ErreurCatalogueOnboarding, verifierFormationsEducation } from "./onboarding-education-validation";
import { normaliserDiplomesScolaires, trierParDate } from "./onboarding-school-records";

function remplacerMethode(t: TestContext, objet: any, methode: string, implementation: (...args: any[]) => any) {
  const ancienne = objet[methode];
  objet[methode] = implementation;
  t.after(() => { objet[methode] = ancienne; });
}

const brevet = { type: "BREVET" as const, libelle: "Brevet", anneeObtention: "2014", mention: "Bien", serie: "", statut: "OBTENU" as const };
const bac = { type: "BAC" as const, libelle: "Baccalauréat français", anneeObtention: "2019", mention: "Bien", serie: "ES", statut: "OBTENU" as const };
const base = {
  type: "ecole" as const, pays: "Mali", paysCode: "ML", ville: "Bamako",
  etablissement: "Liberté", etablissementId: "liberte", systemeEducatifCode: "FR",
  programme: "", programmeId: "", specialite: "ES", specialiteId: "",
  moisDebut: "01", anneeDebut: "2012", moisFin: "06", anneeFin: "2019",
  statutDiplome: "OBTENU" as const, diplome: "Baccalauréat français", diplomeId: "", mention: "Bien", anneePromo: "2019",
  noteEnseignants: null, noteContenu: null, noteCadre: null,
  demarcheApresFormation: null, delaiPremierEmploi: null, emploiDansLes12Mois: null, lienEmploiFormation: null,
  commentaire: "", diplomesScolaires: [bac, brevet],
};
const pays = [{ code: "ML", nom: "Mali", indicatif: "223" }, { code: "FR", nom: "France", indicatif: "33" }];
const etablissement = { id: "liberte", nom: "Lycée Français Liberté", type: "LYCEE", paysCode: "ML", systemeEducatifCode: "ML", ville: "Bamako", valide: true, pays: { nom: "Mali" }, programmes: [] };

test("un parcours 2012–2019 accepte brevet 2014 et bac 2019, et les trie", () => {
  const formation = schemaFormation.parse({ ...base, anneePromo: "2014" });
  const normalisee = normaliserDiplomesScolaires(formation);
  assert.deepEqual(normalisee.diplomesScolaires?.map((diplome) => diplome.anneeObtention), ["2014", "2019"]);
  assert.equal(normalisee.anneePromo, "2019");
  assert.equal(normalisee.diplome, bac.libelle);
});

test("dates des diplômes : hors scolarité et futur refusés, brevet acquis pendant une scolarité en cours accepté", () => {
  for (const anneeObtention of ["2011", "2020", ""]) {
    assert.equal(schemaFormation.safeParse({ ...base, diplomesScolaires: [{ ...brevet, anneeObtention }] }).success, false);
  }
  const future = String(new Date().getUTCFullYear() + 1);
  assert.equal(schemaFormation.safeParse({ ...base, anneeFin: future, diplomesScolaires: [{ ...bac, anneeObtention: future }] }).success, false);
  assert.equal(schemaFormation.safeParse({ ...base, statutDiplome: "EN_COURS", anneeFin: future,
    diplomesScolaires: [brevet, { ...bac, anneeObtention: future, statut: "EN_COURS" }] }).success, true);
  assert.equal(schemaFormation.safeParse({ ...base, type: "universite" }).success, false);
});

test("ancien diplôme unique conservé et ordre de saisie ignoré", () => {
  const formation = schemaFormation.parse({ ...base, diplomesScolaires: undefined, diplome: "Brevet", anneePromo: "2014" });
  assert.equal(normaliserDiplomesScolaires(formation).diplomesScolaires?.[0].anneeObtention, "2014");
  assert.deepEqual(trierParDate([
    { anneeDebut: "2012", moisDebut: "09", id: "recent" },
    { anneeDebut: "2005", moisDebut: "01", id: "ancien" },
    { anneeDebut: "2012", moisDebut: "01", id: "janvier" },
  ]).map(({ id }) => id), ["ancien", "janvier", "recent"]);
});

test("les brevets professionnels restent des autres diplômes lors de la reprise des anciennes fiches", () => {
  const typeReconstitue = (diplome: string) => normaliserDiplomesScolaires(schemaFormation.parse({
    ...base, diplomesScolaires: undefined, diplome,
  })).diplomesScolaires?.[0].type;
  for (const diplome of ["BT — Brevet de technicien", "BTS", "BT", "Brevet de technicien supérieur", "Brevet professionnel", "Brevet de technicien", "Brevet technicien", "Brevet des métiers d’art", "Brevet technique"]) {
    assert.equal(typeReconstitue(diplome), "AUTRE", diplome);
  }
  for (const diplome of ["Brevet", "Diplôme national du brevet", "DNB", "DEF", "BEPC", "Diplôme d'études fondamentales"]) {
    assert.equal(typeReconstitue(diplome), "BREVET", diplome);
  }
  assert.equal(typeReconstitue("Baccalauréat professionnel"), "BAC");
});

test("curriculum français au Mali, type canonique et références contrôlés", async (t) => {
  remplacerMethode(t, prisma.paysEducation, "findMany", async () => pays);
  remplacerMethode(t, prisma.etablissement, "findMany", async () => [etablissement]);
  remplacerMethode(t, prisma.programmeEducation, "findMany", async () => [
    { id: "serie-fr", nom: "ES", paysCode: "FR", parentId: null, actif: true },
    { id: "serie-ml", nom: "TSE", paysCode: "ML", parentId: null, actif: true },
  ]);
  remplacerMethode(t, prisma.diplomeEducation, "findMany", async () => [{ id: "bac-fr", nom: bac.libelle, paysCode: "FR", actif: true }]);
  const [formation] = await verifierFormationsEducation([{ ...base, diplomeId: "bac-fr", specialiteId: "serie-fr" }]);
  assert.equal(formation.paysCode, "ML");
  assert.equal(formation.systemeEducatifCode, "FR");
  assert.equal(formation.type, "lycee");
  await assert.rejects(() => verifierFormationsEducation([{ ...base, type: "universite" }]), ErreurCatalogueOnboarding);
  await assert.rejects(() => verifierFormationsEducation([{ ...base, systemeEducatifCode: "ZZ" }]), ErreurCatalogueOnboarding);
  await assert.rejects(() => verifierFormationsEducation([{ ...base, specialiteId: "serie-ml" }]), ErreurCatalogueOnboarding);
});

test("les références scolaires réunissent brevet, bac et séries du programme français au Mali", async (t) => {
  remplacerMethode(t, prisma.etablissement, "findUnique", async () => etablissement);
  remplacerMethode(t, prisma.etablissementProgramme, "findMany", async () => [
    { programme: { paysCode: "ML", nom: "TSE", sigle: null } },
  ]);
  remplacerMethode(t, prisma.programmeEducation, "findMany", async ({ where }: any) => {
    assert.equal(where.paysCode, "FR");
    return [{ nom: "Économique et social", sigle: "ES" }];
  });
  remplacerMethode(t, prisma.diplomeEducation, "findMany", async ({ where }: any) => {
    assert.equal(where.paysCode, "FR");
    assert.ok(where.niveau.in.includes("FONDAMENTAL"));
    assert.ok(where.niveau.in.includes("SECONDAIRE"));
    return [{ nom: "Brevet", sigle: null }, { nom: "Baccalauréat", sigle: null }];
  });
  const references = await chercherReferences("ML", "ecole", "liberte", "FR");
  assert.deepEqual(references.diplomes, ["Brevet", "Baccalauréat"]);
  assert.ok(references.series[0].includes("ES"));
  assert.equal(references.series.includes("TSE"), false);
  assert.deepEqual(await chercherReferences("ML", "ecole", "liberte", "AUTRE"), { series: [], diplomes: [], programmes: [] });
});

test("POST persiste les deux diplômes et GET les restitue avec et sans snapshot; insertion scolaire exclue", async (t) => {
  // Toute opération Prisma est doublée : aucune base ni compte réel n’est utilisé.
  const ancienSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "onboarding-unit-test-secret";
  t.after(() => { if (ancienSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = ancienSecret; });
  let snapshot: unknown = null;
  const formations: any[] = [];
  remplacerMethode(t, prisma.user, "findUnique", async ({ select }: any) => {
    if (select.tokenVersion) return { id: "test-user", role: "MEMBRE", statut: "VALIDE", emailVerifie: true, tokenVersion: 0 };
    return { id: "test-user", prenom: "Test", nom: "Membre", emailVerifie: true, profil: {
      id: "test-profile", pays: "Mali", ville: "Bamako", telephone: "", estVolontaire: false,
      onboardingDonnees: snapshot, formations: formations.map((item) => ({ ...item, etablissement,
        programmeReference: null, parcoursReference: null, diplomeReference: null, avis: null })), experiences: [], volontaire: null,
    } };
  });
  remplacerMethode(t, prisma.paysEducation, "findMany", async () => pays);
  remplacerMethode(t, prisma.etablissement, "findMany", async () => [etablissement]);
  remplacerMethode(t, prisma.programmeEducation, "findMany", async () => []);
  remplacerMethode(t, prisma.diplomeEducation, "findMany", async () => []);
  remplacerMethode(t, prisma, "$transaction", async (callback: any) => callback({
    user: { update: async () => ({}) },
    profil: { update: async ({ data }: any) => { snapshot = data.onboardingDonnees; } },
    formation: {
      deleteMany: async () => { formations.length = 0; },
      create: async ({ data }: any) => { const result = { ...data, id: `formation-${formations.length}` }; formations.push(result); return result; },
    },
    experience: { deleteMany: async () => ({}), create: async () => ({}) },
    volontaire: { deleteMany: async () => ({}) },
  }));
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", onboardingRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/onboarding`;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${signerTokenAcces({ id: "test-user", tokenVersion: 0 })}` };
  const body = {
    informations: { prenom: "Test", nom: "Membre", telephone: "", indicatif: "+223", pays: "Mali", paysCode: "ML", ville: "Bamako" },
    formations: [{ ...base, demarcheApresFormation: "RECHERCHE_EMPLOI", delaiPremierEmploi: "MOINS_3_MOIS", emploiDansLes12Mois: true, lienEmploiFormation: "DIRECT" },
      { ...base, anneeDebut: "2005", anneeFin: "2006", diplomesScolaires: [], diplome: "", anneePromo: "", statutDiplome: "NON_DIPLOMANTE" }],
    experiences: [], mentorat: { estVolontaire: false, sujets: [], precisionsSujets: {}, duree: null, format: null, fuseauHoraire: "Africa/Bamako", dateDebut: "", dateFin: null, disponibilites: [], maxRdvMois: null },
  };
  const post = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal(post.status, 201, JSON.stringify(await post.json()));
  assert.deepEqual(formations.map(({ anneeDebut }) => anneeDebut), [2005, 2012]);
  assert.equal(formations[1].systemeEducatifCode, "FR");
  assert.deepEqual(formations[1].diplomesScolaires, [brevet, bac]);
  assert.equal(formations[1].demarcheApresFormation, null);
  assert.equal(formations[1].emploiDansLes12Mois, null);
  const donneesSauvees = snapshot as any;
  const anciennesFormations = donneesSauvees.formations.map(({ diplomesScolaires: _diplomes, systemeEducatifCode: _systeme, ...formation }: any) => formation);
  const ancienClient = await fetch(url, { method: "POST", headers, body: JSON.stringify({ ...donneesSauvees, formations: anciennesFormations }) });
  assert.equal(ancienClient.status, 201, JSON.stringify(await ancienClient.json()));
  assert.deepEqual(formations[1].diplomesScolaires, [brevet, bac], "un ancien client ne doit pas effacer le brevet omis du payload");
  assert.equal(formations[1].systemeEducatifCode, "FR");
  for (const garderSnapshot of [true, false]) {
    if (!garderSnapshot) snapshot = null;
    const get = await fetch(url, { headers });
    assert.equal(get.status, 200);
    const donnees = await get.json() as any;
    assert.deepEqual(donnees.formations.map((f: any) => f.anneeDebut), ["2005", "2012"]);
    assert.deepEqual(donnees.formations[1].diplomesScolaires, [brevet, bac]);
    assert.equal(donnees.formations[1].systemeEducatifCode, "FR");
  }
  const recent = { ...body, formations: [{ ...base, anneeFin: String(new Date().getUTCFullYear()), moisFin: "12", noteEnseignants: 5 }] };
  const avisTropTot = await fetch(url, { method: "POST", headers, body: JSON.stringify(recent) });
  assert.equal(avisTropTot.status, 400, "un ancien brevet ne doit pas autoriser un avis avant un an après le départ");
});

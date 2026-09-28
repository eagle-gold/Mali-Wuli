#!/usr/bin/env node
"use strict";

// Run against an explicitly selected local QA database after migrations/seed.
// This script never calls registration, OTP, e-mail or catalogue-write routes.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");

async function main() {
  const scoped = process.env.QA_SCOPED_ACCOUNT_ONLY === "1";
  const databaseUrl = process.env.QA_DATABASE_URL || (scoped ? process.env.DATABASE_URL : undefined);
  assert(databaseUrl, "Set QA_DATABASE_URL to a dedicated local QA database.");
  const database = new URL(databaseUrl);
  const databaseName = decodeURIComponent(database.pathname.slice(1));
  assert.equal(database.protocol, "mysql:", "This smoke expects the MySQL schema.");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(database.hostname), "Remote databases are intentionally refused.");
  assert(scoped || /(?:^|[_-])(?:qa|test)(?:[_-]|$)/i.test(databaseName), "Use a database whose name contains a separate qa or test segment.");

  const backendRoot = path.resolve(process.env.BACKEND_ROOT || path.join(process.cwd(), "backend"));
  assert(fs.existsSync(path.join(backendRoot, "dist/routes/onboarding.routes.js")), "Build the backend before running this smoke.");
  const backendRequire = createRequire(path.join(backendRoot, "package.json"));
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), "mali-wuli-profile-qa-"));
  process.env.NODE_ENV = "test";
  process.env.MAIL_DISABLED = "true";
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = randomUUID() + randomUUID();
  process.env.UPLOAD_DIR = uploads;

  const express = backendRequire("express");
  const multer = backendRequire("multer");
  const { Prisma } = backendRequire("@prisma/client");
  const { prisma } = backendRequire(path.join(backendRoot, "dist/lib/prisma.js"));
  const { signerTokenAcces } = backendRequire(path.join(backendRoot, "dist/lib/auth-token.js"));
  const onboarding = backendRequire(path.join(backendRoot, "dist/routes/onboarding.routes.js")).default;
  const users = backendRequire(path.join(backendRoot, "dist/routes/user.routes.js")).default;
  const suffix = randomUUID();
  const qaUserId = `qa-school-${suffix}`;
  const qaEmail = `qa-school-${suffix}@example.invalid`;
  let server;
  let created = false;
  let checks = 0;

  const brevet = { type: "BREVET", libelle: "Diplôme national du brevet", anneeObtention: "2014", mention: "Bien", serie: "", statut: "OBTENU" };
  const bac = { type: "BAC", libelle: "Baccalauréat français", anneeObtention: "2019", mention: "Très bien", serie: "ES", statut: "OBTENU" };
  const school = {
    id: "fixture-school", type: "ecole", pays: "Mali", paysCode: "ML", ville: "Bamako",
    etablissement: "Lycée Français Liberté", etablissementId: process.env.QA_INSTITUTION_ID || "ml-lycee-liberte",
    systemeEducatifCode: "FR", programme: "", programmeId: "", specialite: "ES", specialiteId: "",
    moisDebut: "09", anneeDebut: "2012", moisFin: "06", anneeFin: "2019",
    statutDiplome: "OBTENU", diplome: bac.libelle, diplomeId: "", mention: bac.mention, anneePromo: "2019",
    noteEnseignants: null, noteContenu: null, noteCadre: null,
    demarcheApresFormation: null, delaiPremierEmploi: null, emploiDansLes12Mois: null, lienEmploiFormation: null,
    commentaire: "", diplomesScolaires: [bac, brevet],
  };
  const body = {
    informations: { prenom: "Camille", nom: "Test intégration", telephone: "", indicatif: "+223", pays: "Mali", paysCode: "ML", ville: "Bamako" },
    formations: [school, {
      ...school, id: "fixture-earlier", etablissement: "École de test", etablissementId: "autre:qa-school",
      anneeDebut: "2005", anneeFin: "2011", statutDiplome: "NON_DIPLOMANTE", diplomesScolaires: [],
      diplome: "", specialite: "", mention: "", anneePromo: "",
    }],
    experiences: [
      { id: "job-new", poste: "Ingénieure", structure: "Entreprise QA", typeContrat: "CDI", pays: "Mali", paysCode: "ML", ville: "Bamako", moisDebut: "03", anneeDebut: "2022", moisFin: "", anneeFin: "", posteActuel: true, description: "" },
      { id: "job-old", poste: "Stage", structure: "Entreprise QA", typeContrat: "Stage", pays: "Mali", paysCode: "ML", ville: "Bamako", moisDebut: "06", anneeDebut: "2020", moisFin: "08", anneeFin: "2020", posteActuel: false, description: "" },
    ],
    mentorat: { estVolontaire: false, sujets: [], precisionsSujets: {}, duree: null, format: null, fuseauHoraire: "Africa/Bamako", dateDebut: "", dateFin: null, disponibilites: [], maxRdvMois: null },
  };

  try {
    const institution = await prisma.etablissement.findUnique({ where: { id: school.etablissementId }, select: { id: true, paysCode: true, valide: true } });
    assert(institution?.valide && institution.paysCode === "ML", "Seed a valid Mali Liberté institution, or set QA_INSTITUTION_ID to its existing ID.");
    assert.equal(await prisma.paysEducation.count({ where: { code: { in: ["ML", "FR"] } } }), 2, "Seed the ML and FR countries first.");
    const user = await prisma.user.create({ data: {
      id: qaUserId, email: qaEmail, prenom: "Camille", nom: "Test intégration", emailVerifie: true, statut: "EN_ATTENTE",
      profil: { create: { pays: "Mali", ville: "Bamako", onboardingFini: false } },
    }, include: { profil: { select: { id: true } } } });
    created = true;
    const app = express();
    app.use(express.json());
    app.use("/api/onboarding", onboarding);
    app.use("/api/users", users);
    // Match the production app's upload-error mapping; the routers themselves
    // use the real Multer storage, MIME filter and file-signature middleware.
    app.use((error, _request, response, _next) => {
      const invalidUpload = error instanceof multer.MulterError
        || (error instanceof Error && error.message.startsWith("Format non supporté"));
      response.status(invalidUpload ? 400 : 500).json({
        message: invalidUpload ? error.message : "Erreur du serveur de test.",
      });
    });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${signerTokenAcces(user)}` };
    async function request(route, method = "GET", value) {
      const response = await fetch(baseUrl + route, { method, headers, body: value === undefined ? undefined : JSON.stringify(value), signal: AbortSignal.timeout(20000) });
      const json = await response.json();
      return { status: response.status, body: json };
    }

    // Existing full questionnaire snapshots predate the multi-diploma fields.
    const legacySchool = { ...school, diplome: brevet.libelle, mention: brevet.mention, anneePromo: "2014", specialite: "" };
    delete legacySchool.diplomesScolaires;
    delete legacySchool.systemeEducatifCode;
    await prisma.profil.update({ where: { id: user.profil.id }, data: { onboardingDonnees: { ...body, formations: [legacySchool] } } });
    const legacy = await request("/onboarding");
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.formations[0].diplomesScolaires[0].anneeObtention, "2014");
    checks++;

    const saved = await request("/onboarding", "POST", body);
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    const records = await prisma.formation.findMany({ where: { profilId: user.profil.id }, orderBy: { anneeDebut: "asc" } });
    assert.deepEqual(records.map(record => record.anneeDebut), [2005, 2012]);
    assert.equal(records[1].systemeEducatifCode, "FR");
    assert.deepEqual(records[1].diplomesScolaires, [brevet, bac]);
    assert.equal(records[1].emploiDansLes12Mois, null);
    checks++;

    for (const withSnapshot of [true, false]) {
      if (!withSnapshot) await prisma.profil.update({ where: { id: user.profil.id }, data: { onboardingDonnees: Prisma.DbNull } });
      const loaded = await request("/onboarding");
      assert.equal(loaded.status, 200);
      assert.deepEqual(loaded.body.formations.map(formation => formation.anneeDebut), ["2005", "2012"]);
      assert.deepEqual(loaded.body.experiences.map(experience => experience.anneeDebut), ["2020", "2022"]);
      assert.equal(loaded.body.formations[1].systemeEducatifCode, "FR");
      assert.deepEqual(loaded.body.formations[1].diplomesScolaires, [brevet, bac]);
      checks++;
    }

    const profile = await request("/users/me");
    assert.equal(profile.status, 200);
    assert.equal(profile.body.prenom, "Camille");
    assert.equal(profile.body.nom, "Test intégration");
    const profileSchool = profile.body.profil.formations.find(formation => formation.etablissement?.id === school.etablissementId);
    assert.equal(profileSchool.systemeEducatifCode, "FR");
    assert.deepEqual(profileSchool.diplomesScolaires, [brevet, bac]);
    checks++;

    // A complete 1×1 RGBA PNG with valid chunk CRCs. All files go into the
    // temporary UPLOAD_DIR created above, never the application's real uploads.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNQaHD4DwADhAHgG0PjMwAAAABJRU5ErkJggg==", "base64");
    async function uploadCover(content, mime, filename) {
      const form = new FormData();
      form.append("couverture", new Blob([content], { type: mime }), filename);
      const response = await fetch(baseUrl + "/users/me/couverture", {
        method: "POST", headers: { Authorization: headers.Authorization }, body: form,
        signal: AbortSignal.timeout(20000),
      });
      return { status: response.status, body: await response.json() };
    }
    const cover = await uploadCover(png, "image/png", "qa-cover.png");
    assert.equal(cover.status, 200, JSON.stringify(cover.body));
    assert.match(cover.body.url, /^\/uploads\/couvertures\/couverture-qa-school-[a-zA-Z0-9-]+\.png$/);
    const uploadedFile = path.join(uploads, cover.body.url.slice("/uploads/".length));
    assert.deepEqual(fs.readFileSync(uploadedFile), png, "The uploaded PNG must be stored in the temporary directory.");
    const withCover = await request("/users/me");
    assert.equal(withCover.status, 200);
    assert.equal(withCover.body.profil.photoCouverture, cover.body.url);

    const invalidCover = await uploadCover("not an image", "text/plain", "qa-cover.txt");
    assert.equal(invalidCover.status, 400, JSON.stringify(invalidCover.body));
    const afterRejectedCover = await request("/users/me");
    assert.equal(afterRejectedCover.status, 200);
    assert.equal(afterRejectedCover.body.profil.photoCouverture, cover.body.url, "An invalid MIME must preserve the saved cover URL.");
    assert.deepEqual(fs.readFileSync(uploadedFile), png, "An invalid upload must preserve the saved image.");
    assert.equal(fs.readdirSync(path.join(uploads, "couvertures")).length, 1, "The rejected upload must not leave a file behind.");
    checks++;

    const rejected = await request("/onboarding", "POST", { ...body, formations: [{ ...school, diplomesScolaires: [{ ...brevet, anneeObtention: "2009" }] }] });
    assert.equal(rejected.status, 400);
    const preserved = await prisma.formation.findMany({ where: { profilId: user.profil.id }, orderBy: { anneeDebut: "asc" } });
    assert.deepEqual(preserved.map(record => record.id), records.map(record => record.id));
    assert.deepEqual(preserved[1].diplomesScolaires, [brevet, bac]);
    checks++;
    console.log(`PASS: ${checks} HTTP/Prisma scenarios, curriculum FR, brevet 2014, bac 2019, legacy snapshot, cover multipart upload and failed-save preservation.`);
  } finally {
    try {
      if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } finally {
      try {
        if (created) {
          await prisma.user.deleteMany({ where: { id: qaUserId, email: qaEmail } });
          assert.equal(await prisma.user.count({ where: { id: qaUserId } }), 0, "QA user cleanup failed.");
          console.log("Cleanup: temporary QA user and cascading profile records removed.");
        }
      } finally {
        try {
          await prisma.$disconnect();
        } finally {
          fs.rmSync(uploads, { recursive: true, force: true });
        }
      }
    }
  }
}

main().catch(error => {
  console.error(error instanceof assert.AssertionError ? error.message : `Smoke failed (${error.code || error.name || "unknown"}).`);
  process.exitCode = 1;
});

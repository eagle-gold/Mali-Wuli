#!/usr/bin/env node
"use strict";
/**
 * À exécuter explicitement après autorisation ; ce fichier ne lance rien à l'import.
 * Schéma/migration et services événements : SELECT uniquement, jamais de fixture.
 * Aucun HTTP, JWT, mail, notification, upload ni chargement du serveur/routes.
 * Les services reçoivent un Proxy qui refuse toute opération Prisma non lisante.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const MIGRATION = "20260928190000_event_photos";
const EXPECTED_MIGRATION_SHA256 = "1e7e87ed7f408597b3769c0630b08dd54591131e19cb2f75ad88a68414f42c0e";
const READ_OPERATIONS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const MODELS = {
  User: "user", Profil: "profil", Formation: "formation", Experience: "experience",
  Association: "association", AssociationMembre: "associationMembre", AssociationSuggestion: "associationSuggestion",
  Etablissement: "etablissement", Publication: "publication", Notification: "notification", Message: "message",
  Evenement: "evenement", EvenementParticipant: "evenementParticipant",
};
const TABLES = [...Object.keys(MODELS), "EvenementPhoto"];
function readonlyClient(client) {
  const delegates = new Map();
  return new Proxy(client, {
    get(target, model) {
      if (typeof model !== "string" || model.startsWith("$") || model.startsWith("_")) throw new Error("READ_ONLY_GUARD");
      if (!delegates.has(model)) {
        const delegate = target[model];
        if (!delegate || typeof delegate !== "object") throw new Error("READ_ONLY_GUARD");
        delegates.set(model, new Proxy(delegate, {
          get(object, operation) {
            if (!READ_OPERATIONS.has(operation) || typeof object[operation] !== "function") throw new Error("READ_ONLY_GUARD");
            return object[operation].bind(object);
          },
          set() { throw new Error("READ_ONLY_GUARD"); },
        }));
      }
      return delegates.get(model);
    },
    set() { throw new Error("READ_ONLY_GUARD"); },
  });
}

function args(argv) {
  const result = { mode: "post", strictCounts: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help") result.help = true;
    else if (arg === "--strict-counts") result.strictCounts = true;
    else if (["--backend", "--env-file", "--before", "--mode"].includes(arg)) {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error("INVALID_ARGUMENTS");
      result[{ "--backend": "backend", "--env-file": "envFile", "--before": "before", "--mode": "mode" }[arg]] = value;
    } else throw new Error("INVALID_ARGUMENTS");
  }
  if (result.help) return result;
  if (!result.backend || !path.isAbsolute(result.backend) || !["baseline", "post"].includes(result.mode)) throw new Error("INVALID_ARGUMENTS");
  if ([result.envFile, result.before].some((p) => p && !path.isAbsolute(p))) throw new Error("INVALID_ARGUMENTS");
  return result;
}

async function main(options) {
  const checkedAt = new Date();
  const report = { kind: "event-photos-readonly", mode: options.mode, migration: MIGRATION, checkedAt: checkedAt.toISOString(), status: "RUNNING", counts: {}, checks: [], warnings: [] };
  let client;
  const check = (name, ok, details) => {
    report.checks.push({ name, ok: Boolean(ok), ...(details === undefined ? {} : { details }) });
    if (!ok) { const error = new Error("CHECK_FAILED"); error.safeCheck = name; throw error; }
  };
  const compareCounts = (baseline, current, prefix, target) => {
    if (!baseline || typeof baseline !== "object" || !TABLES.some((table) => table in baseline)) throw new Error("BASELINE_INVALID");
    report[target] = [];
    for (const table of TABLES) {
      if (!(table in baseline)) { report.warnings.push(`BASELINE_MISSING_${table}`); continue; }
      const before = baseline[table], after = current[table];
      if (before !== null && (!Number.isSafeInteger(before) || before < 0)) throw new Error("BASELINE_INVALID");
      const delta = after === null ? null : after - (before ?? 0);
      report[target].push({ table, before, after, delta });
      check(`${prefix}-present-${table}`, after !== null || before === null);
      if (delta !== null) {
        check(`${prefix}-not-decreased-${table}`, delta >= 0);
        if (options.strictCounts) check(`${prefix}-unchanged-${table}`, delta === 0);
        else if (delta > 0) report.warnings.push(`${prefix.toUpperCase()}_COUNT_INCREASED_${table}`);
      }
    }
  };
  try {
    const backend = fs.realpathSync(options.backend);
    if (!fs.statSync(backend).isDirectory() || !fs.existsSync(path.join(backend, "package.json"))) throw new Error("BACKEND_PATH_INVALID");
    const fromBackend = createRequire(path.join(backend, "package.json"));
    let databaseUrl = process.env.DATABASE_URL;
    if (options.envFile) {
      let parsed;
      try { parsed = fromBackend("dotenv").parse(fs.readFileSync(options.envFile)); }
      catch { throw new Error("ENV_FILE_UNREADABLE"); }
      databaseUrl = parsed.DATABASE_URL;
    }
    if (!databaseUrl) throw new Error("DATABASE_ENV_MISSING");
    report.databaseConfigurationSource = options.envFile ? "EXPLICIT_ENV_FILE" : "PROCESS_ENV";
    const imported = fromBackend("@prisma/client");
    client = new imported.PrismaClient({ log: [], datasources: { db: { url: databaseUrl } } });
    const [{ databaseName }] = await client.$queryRaw`SELECT DATABASE() AS databaseName`;
    check("database-target", databaseName === "u668963025_maliwuli");
    report.database = databaseName;
    const db = readonlyClient(client);
    report.prismaVersion = imported.Prisma.prismaVersion.client;
    report.schemaSha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(backend, "prisma/schema.prisma"))).digest("hex");

    // Toutes les requêtes brutes sont fixes et exclusivement SELECT.
    const tables = await client.$queryRaw`SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
    const present = new Set(tables.map((t) => t.tableName));
    check("existing-tables-present", Object.keys(MODELS).every((table) => present.has(table)));
    const countTables = async () => {
      const counts = {};
      for (const [table, model] of Object.entries(MODELS)) counts[table] = await db[model].count();
      counts.EvenementPhoto = present.has("EvenementPhoto")
        ? Number((await client.$queryRaw`SELECT COUNT(*) AS n FROM EvenementPhoto`)[0].n) : null;
      return counts;
    };
    report.counts = await countTables();
    if (options.before) {
      const supplied = JSON.parse(fs.readFileSync(options.before, "utf8"));
      compareCounts(supplied.counts || supplied, report.counts, "baseline", "countComparisons");
    }
    if (options.mode === "baseline") { report.status = report.warnings.length ? "WARN" : "PASS"; return report; }
    check("photo-table-present", present.has("EvenementPhoto"));
    check("migration-table-present", present.has("_prisma_migrations"));

    const columns = await client.$queryRaw`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault, CHARACTER_MAXIMUM_LENGTH AS maxLength FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Evenement', 'EvenementPhoto')`;
    const column = (table, name) => columns.find((c) => c.tableName === table && c.columnName === name);
    for (const [name, type] of Object.entries({ pays: "varchar", ville: "varchar", fuseauHoraire: "varchar", photoCouverture: "text", programme: "json", resume: "text" })) {
      const c = column("Evenement", name);
      check(`event-column-${name}`, c && c.dataType.toLowerCase() === type && c.isNullable === "YES");
    }
    const refused = column("Evenement", "refuse");
    check("refusal-default-false", refused && refused.dataType.toLowerCase() === "tinyint" && refused.isNullable === "NO" && String(refused.columnDefault) === "0");
    check("legacy-event-fields-preserved", ["id", "titre", "description", "type", "lieu", "lienVideo", "dateDebut", "dateFin", "capacite", "organisateurId", "valide", "createdAt"].every((field) => column("Evenement", field)));
    for (const [name, type] of Object.entries({ id: "varchar", evenementId: "varchar", auteurId: "varchar", url: "text", createdAt: "datetime" })) {
      const c = column("EvenementPhoto", name);
      check(`photo-column-${name}`, c && c.dataType.toLowerCase() === type && c.isNullable === "NO");
    }
    const caption = column("EvenementPhoto", "legende");
    check("photo-caption-optional-300", caption && caption.dataType.toLowerCase() === "varchar" && caption.isNullable === "YES" && Number(caption.maxLength) === 300);
    const indexes = await client.$queryRaw`SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Evenement', 'EvenementPhoto')`;
    check("event-photo-indexes", ["Evenement_valide_dateDebut_idx", "Evenement_organisateurId_idx", "Evenement_valide_refuse_dateDebut_idx", "Evenement_pays_ville_idx", "EvenementPhoto_evenementId_createdAt_idx", "EvenementPhoto_auteurId_idx"].every((name) => indexes.some((i) => i.indexName === name)));
    const foreignKeys = await client.$queryRaw`SELECT CONSTRAINT_NAME AS constraintName, REFERENCED_TABLE_NAME AS referencedTable, DELETE_RULE AS deleteRule FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'EvenementPhoto'`;
    check("photo-event-cascade", foreignKeys.some((f) => f.constraintName === "EvenementPhoto_evenementId_fkey" && f.referencedTable === "Evenement" && f.deleteRule === "CASCADE"));
    check("photo-author-profile-reference", foreignKeys.some((f) => f.constraintName === "EvenementPhoto_auteurId_fkey" && f.referencedTable === "Profil" && f.deleteRule === "RESTRICT"));

    const migrationRows = await client.$queryRaw`SELECT checksum, finished_at AS finishedAt, rolled_back_at AS rolledBackAt FROM _prisma_migrations WHERE migration_name = '20260928190000_event_photos'`;
    const applied = migrationRows.filter((r) => r.finishedAt && !r.rolledBackAt);
    check("migration-applied", applied.length === 1);
    const sql = fs.readFileSync(path.join(backend, "prisma/migrations", MIGRATION, "migration.sql"));
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    report.migrationSqlSha256 = checksum;
    check("migration-reviewed-checksum", checksum === EXPECTED_MIGRATION_SHA256);
    check("migration-database-checksum", applied[0].checksum === checksum);
    const failed = await client.$queryRaw`SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
    check("no-unresolved-migration", Number(failed[0].n) === 0);

    // SELECT de jointures même si aucun événement/photo n'existe encore.
    await db.evenement.findMany({ take: 1, select: { pays: true, ville: true, fuseauHoraire: true, photoCouverture: true, programme: true, resume: true, refuse: true, photos: { take: 1, select: { id: true } }, _count: { select: { participants: true } } } });
    await db.evenementPhoto.findMany({ take: 1, select: { id: true, url: true, legende: true, auteur: { select: { id: true } }, evenement: { select: { id: true, valide: true, refuse: true } } } });
    check("generated-client-and-empty-safe-joins", true);

    // Le service compilé importe seulement Prisma, Zod et validation. Aucun serveur,
    // route, middleware d'upload ou notification n'est chargé ; effets omis = no-op.
    const { creerServiceEvenements } = fromBackend(path.join(backend, "dist/services/evenement.service.js"));
    const service = creerServiceEvenements(db, undefined, () => checkedAt);
    const valid = { onboardingFini: true, user: { statut: "VALIDE", emailVerifie: true } };
    const selectIdentity = { id: true, userId: true, user: { select: { role: true } } };
    const moderator = await db.profil.findFirst({ where: { ...valid, user: { ...valid.user, role: { in: ["ADMIN", "MODERATEUR"] } } }, select: selectIdentity });
    const viewer = moderator || await db.profil.findFirst({ where: valid, select: selectIdentity });
    if (!viewer) report.warnings.push("SERVICES_SKIPPED_NO_EXISTING_VALID_PROFILE");
    else {
      report.viewerKind = moderator ? "EXISTING_MODERATOR" : "EXISTING_VALID_MEMBER";
      const identity = await service.acteur(viewer.userId, viewer.user.role);
      const filters = { page: 1, limite: 3, periode: "tous", statut: "publies" };
      const list = await service.liste(filters, identity);
      check("published-list-service", Array.isArray(list.evenements) && Number.isInteger(list.meta.total) && list.evenements.every((e) => e.valide && e.statut === "VALIDE"), { returned: list.evenements.length, total: list.meta.total });
      check("list-counts-and-facets", Number.isInteger(list.compteurs.aVenir) && Number.isInteger(list.compteurs.passes) && list.compteurs.aVenir + list.compteurs.passes === list.meta.total && Array.isArray(list.facettes.pays) && Array.isArray(list.facettes.villes));
      const mine = await service.liste({ ...filters, statut: "mes" }, identity);
      check("own-proposals-service", mine.evenements.every((e) => e.estProprietaire), { returned: mine.evenements.length, total: mine.meta.total });
      for (const periode of ["a_venir", "passes"]) {
        const page = await service.liste({ ...filters, periode }, identity);
        check(`period-${periode}-service`, page.evenements.every((e) => e.estPasse === (periode === "passes")), { returned: page.evenements.length });
      }
      if (identity.moderateur) {
        for (const statut of ["en_attente", "refuses"]) {
          const page = await service.liste({ ...filters, statut }, identity);
          check(`moderation-${statut}-service`, page.evenements.every((e) => e.statut === (statut === "en_attente" ? "EN_ATTENTE" : "REFUSE")), { returned: page.evenements.length, total: page.meta.total });
        }
      } else report.warnings.push("MODERATION_READS_SKIPPED_NO_EXISTING_MODERATOR");
      // Réduire les droits d'une identité réelle ne crée/modifie aucun compte.
      let moderationDenied = false;
      try { await service.liste({ ...filters, statut: "en_attente" }, { ...identity, moderateur: false }); }
      catch (error) { moderationDenied = error.statut === 403; }
      check("non-moderator-list-forbidden", moderationDenied);

      const sample = list.evenements[0] || mine.evenements[0];
      if (!sample) report.warnings.push("DETAIL_SKIPPED_NO_ACCESSIBLE_EVENT");
      else {
        const detail = await service.detail(sample.id, identity);
        const roster = await service.participants(sample.id, identity, { page: 1, limite: 3 });
        const album = await service.photos(sample.id, identity, { page: 1, limite: 3 });
        const publicFields = new Set(["id", "prenom", "nom", "nomComplet", "photo", "titre", "pays", "ville", "situation"]);
        const safeProfile = (p) => p === null || Object.keys(p).every((key) => publicFields.has(key));
        check("detail-roster-album-service", detail.evenement.id === sample.id && detail.participants.length <= 12 && detail.photos.length <= 24 && roster.participants.length <= 3 && album.photos.length <= 3 && Number.isInteger(detail.totalParticipants) && Number.isInteger(detail.totalPhotos), { participantsReturned: detail.participants.length, photosReturned: detail.photos.length, visibleParticipants: detail.totalParticipants, totalPhotos: detail.totalPhotos });
        check("public-profile-fields-only", detail.participants.every(safeProfile) && detail.photos.every((p) => safeProfile(p.auteur)) && safeProfile(detail.evenement.organisateur));
        // AutoriserMedia ne fait que lire les droits, et ne déclenche jamais Multer.
        const reduced = { ...identity, moderateur: false };
        let outcome;
        try { await service.autoriserMedia(sample.id, reduced, false); outcome = "ALLOWED"; }
        catch (error) { if (![403, 404].includes(error.statut)) throw error; outcome = "DENIED"; }
        const expected = sample.estProprietaire || (sample.valide && !sample.refuse && sample.estInscrit);
        check("album-permission-readonly", outcome === (expected ? "ALLOWED" : "DENIED"));
        let cover;
        try { await service.autoriserMedia(sample.id, reduced, true); cover = "ALLOWED"; }
        catch (error) { if (![403, 404].includes(error.statut)) throw error; cover = "DENIED"; }
        check("cover-permission-readonly", cover === (sample.estProprietaire ? "ALLOWED" : "DENIED"));
        if (sample.pays) {
          const filtered = await service.liste({ ...filters, pays: sample.pays, ...(sample.ville ? { ville: sample.ville } : {}) }, identity);
          check("location-filter-service", filtered.evenements.every((e) => e.pays === sample.pays && (!sample.ville || e.ville === sample.ville)));
        }
      }
    }
    report.countsAfterReads = await countTables();
    compareCounts(report.counts, report.countsAfterReads, "verification", "readCountComparisons");
    report.status = report.warnings.length ? "WARN" : "PASS";
  } catch (error) {
    report.status = "FAIL";
    // Aucun message/stack Prisma brut : ils peuvent contenir connexion ou données.
    const safeCodes = new Set(["INVALID_ARGUMENTS", "BACKEND_PATH_INVALID", "ENV_FILE_UNREADABLE", "DATABASE_ENV_MISSING", "BASELINE_INVALID", "READ_ONLY_GUARD", "CHECK_FAILED"]);
    report.error = { code: safeCodes.has(error.message) ? error.message : /^P\d{4}$/.test(error.code || "") ? error.code : "READ_ONLY_VERIFICATION_FAILED", ...(error.safeCheck ? { check: error.safeCheck } : {}) };
  } finally {
    if (client) { try { await client.$disconnect(); } catch { report.warnings.push("DISCONNECT_ERROR"); } }
  }
  return report;
}
module.exports = { readonlyClient, args, main };
if (require.main === module) {
  let options;
  try { options = args(process.argv.slice(2)); }
  catch { console.error("Usage invalide. Utilisez --help ; aucun accès DB effectué."); process.exitCode = 2; }
  if (options?.help) {
    console.log("Lecture seule : node verify-events-readonly.cjs --backend /chemin/absolu/nodejs [--env-file /chemin/absolu/.env] [--mode baseline|post] [--before /chemin/absolu/baseline.json] [--strict-counts]\nChoisir explicitement candidate/current via --backend. Sans --env-file, DATABASE_URL doit déjà être fournie au processus. Baseline = compteurs uniquement, utilisable avant migration. Post = schema/migration/services et compteurs avant/après lectures. --strict-counts exige delta 0 ; sans ce flag une hausse produit WARN (activité réelle possible), toute baisse produit FAIL. Sortie JSON sans nom, e-mail, ID profil/événement, token ni URL de connexion. Code sortie1 si FAIL,0 si PASS/WARN : toujours lire warnings. Aucun HTTP/auth/upload n'est exécuté ; leurs permissions sont couvertes par tests locaux simulés.");
  } else if (options) {
    void main(options).then((report) => { process.stdout.write(JSON.stringify(report, null, 2) + "\n"); if (report.status === "FAIL") process.exitCode = 1; }).catch(() => { console.error("Échec non détaillé pour préserver la confidentialité."); process.exitCode = 1; });
  }
}

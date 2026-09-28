#!/usr/bin/env node
"use strict";
/**
 * Contrôle production strictement en lecture seule, à exécuter explicitement.
 * Aucune création de fixture, aucun token, aucune requête HTTP, aucune mutation.
 * Ne charge jamais dist/index.js, les routes, les uploads ou un script de smoke.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const MIGRATION = "20260928180000_association_directory";
const READ_OPERATIONS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const TABLES = ["User", "Profil", "Formation", "Experience", "Association", "AssociationMembre", "AssociationSuggestion", "Etablissement", "Publication", "Notification", "Message"];

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
  const report = { kind: "association-directory-readonly", mode: options.mode, migration: MIGRATION, checkedAt: new Date().toISOString(), status: "RUNNING", counts: {}, checks: [], warnings: [] };
  let client;
  const check = (name, ok, details) => {
    report.checks.push({ name, ok: Boolean(ok), ...(details === undefined ? {} : { details }) });
    if (!ok) { const error = new Error("CHECK_FAILED"); error.safeCheck = name; throw error; }
  };
  try {
    const backend = fs.realpathSync(options.backend);
    if (!fs.statSync(backend).isDirectory() || !fs.existsSync(path.join(backend, "package.json"))) throw new Error("BACKEND_PATH_INVALID");
    const fromBackend = createRequire(path.join(backend, "package.json"));
    // Ne lire que DATABASE_URL du fichier explicite, sans modifier l'environnement du processus.
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
    const { PrismaClient } = imported;
    client = new PrismaClient({ log: [], datasources: { db: { url: databaseUrl } } });
    const db = readonlyClient(client);
    report.prismaVersion = imported.Prisma.prismaVersion.client;
    const schemaPath = path.join(backend, "prisma/schema.prisma");
    report.schemaSha256 = crypto.createHash("sha256").update(fs.readFileSync(schemaPath)).digest("hex");

    // Les SQL ci-dessous sont fixes, exclusivement SELECT, sans entrée utilisateur.
    const tables = await client.$queryRaw`SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
    const present = new Set(tables.map((t) => t.tableName));
    check("required-existing-tables", TABLES.filter((t) => t !== "AssociationSuggestion").every((t) => present.has(t)));
    const models = { User: "user", Profil: "profil", Formation: "formation", Experience: "experience", Association: "association", AssociationMembre: "associationMembre", Etablissement: "etablissement", Publication: "publication", Notification: "notification", Message: "message" };
    for (const table of TABLES) {
      if (table === "AssociationSuggestion") {
        report.counts[table] = present.has(table)
          ? Number((await client.$queryRaw`SELECT COUNT(*) AS n FROM AssociationSuggestion`)[0].n) : null;
      } else report.counts[table] = await db[models[table]].count();
    }
    if (options.before) {
      const supplied = JSON.parse(fs.readFileSync(options.before, "utf8"));
      const baseline = supplied.counts || supplied;
      if (!baseline || typeof baseline !== "object" || !TABLES.some((table) => table in baseline)) throw new Error("BASELINE_INVALID");
      report.countComparisons = [];
      for (const table of TABLES) {
        if (!(table in baseline)) { report.warnings.push(`BASELINE_MISSING_${table}`); continue; }
        const before = baseline[table]; const after = report.counts[table];
        if (before !== null && (!Number.isSafeInteger(before) || before < 0)) throw new Error("BASELINE_INVALID");
        const delta = after === null ? null : after - (before ?? 0);
        report.countComparisons.push({ table, before, after, delta });
        check(`count-preserved-${table}`, after !== null || before === null);
        if (delta !== null) {
          check(`count-not-decreased-${table}`, delta >= 0);
          if (options.strictCounts) check(`count-unchanged-${table}`, delta === 0);
          else if (delta > 0) report.warnings.push(`COUNT_INCREASED_${table}`);
        }
      }
    }
    if (options.mode === "baseline") {
      report.status = report.warnings.length ? "WARN" : "PASS";
      return report;
    }

    check("suggestion-table-present", present.has("AssociationSuggestion"));
    const columns = await client.$queryRaw`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Association', 'AssociationMembre', 'AssociationSuggestion')`;
    const column = (table, name) => columns.find((c) => c.tableName === table && c.columnName === name);
    for (const [name, type] of Object.entries({ ville: "varchar", vocation: "varchar", emailContact: "varchar", photo: "text", photoCouverture: "text", dateCreation: "date", description: "text", site: "text" })) {
      const c = column("Association", name);
      check(`column-Association-${name}`, c && c.dataType.toLowerCase() === type && c.isNullable === "YES");
    }
    check("affiliation-refuse-enum", String(column("AssociationMembre", "statut")?.columnType).includes("'REFUSE'"));
    check("suggestion-status-enum", ["EN_ATTENTE", "TRAITEE", "REFUSEE"].every((v) => String(column("AssociationSuggestion", "statut")?.columnType).includes(`'${v}'`)));
    check("suggestion-fields", ["id", "nom", "pays", "ville", "vocation", "message", "proposeurId", "statut", "createdAt", "updatedAt"].every((name) => column("AssociationSuggestion", name)));
    const indexes = await client.$queryRaw`SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Association', 'AssociationMembre', 'AssociationSuggestion')`;
    check("additive-indexes", ["Association_valide_pays_ville_idx", "Association_responsableId_idx", "AssociationMembre_profilId_statut_idx", "AssociationMembre_associationId_statut_idx", "AssociationSuggestion_statut_createdAt_idx", "AssociationSuggestion_proposeurId_createdAt_idx"].every((name) => indexes.some((i) => i.indexName === name)));
    const foreignKeys = await client.$queryRaw`SELECT CONSTRAINT_NAME AS constraintName, REFERENCED_TABLE_NAME AS referencedTable, DELETE_RULE AS deleteRule FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'AssociationSuggestion'`;
    check("suggestion-foreign-key", foreignKeys.some((f) => f.constraintName === "AssociationSuggestion_proposeurId_fkey" && f.referencedTable === "Profil" && f.deleteRule === "CASCADE"));

    const migrationRows = await client.$queryRaw`SELECT migration_name AS migrationName, checksum, finished_at AS finishedAt, rolled_back_at AS rolledBackAt FROM _prisma_migrations WHERE migration_name = '20260928180000_association_directory'`;
    const applied = migrationRows.filter((r) => r.finishedAt && !r.rolledBackAt);
    check("migration-applied", applied.length === 1);
    const migrationSql = fs.readFileSync(path.join(backend, "prisma/migrations", MIGRATION, "migration.sql"));
    const checksum = crypto.createHash("sha256").update(migrationSql).digest("hex");
    report.migrationSqlSha256 = checksum;
    check("migration-checksum", applied[0].checksum === checksum);
    const failedMigrations = await client.$queryRaw`SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
    check("no-unresolved-migration", Number(failedMigrations[0].n) === 0);

    // Ne charger que des services purs compilés, jamais le serveur Express.
    const { creerServiceAssociations } = fromBackend(path.join(backend, "dist/services/association.service.js"));
    const { annuaireSchema, construireFiltresAnnuaire, filtreFormationAnnuaire, sujetsAide, promotionsFormation } = fromBackend(path.join(backend, "dist/services/annuaire.js"));
    const service = creerServiceAssociations(db);
    const profilVisible = { onboardingFini: true, user: { statut: "VALIDE", emailVerifie: true } };
    const selectIdentity = { id: true, userId: true, user: { select: { role: true } } };
    const admin = await db.profil.findFirst({ where: { ...profilVisible, user: { ...profilVisible.user, role: "ADMIN" } }, select: selectIdentity });
    const viewer = admin || await db.profil.findFirst({ where: profilVisible, select: selectIdentity });
    check("existing-valid-viewer-available", Boolean(viewer));
    report.viewerKind = admin ? "EXISTING_ADMIN" : "EXISTING_VALID_MEMBER";
    const identity = await service.acteur(viewer.userId, viewer.user.role);
    const liste = await service.liste({ page: 1, limite: 3 }, identity);
    check("association-directory-service", Array.isArray(liste.associations) && Number.isInteger(liste.total) && liste.totalGlobal >= liste.total && Array.isArray(liste.facettes.pays) && Array.isArray(liste.facettes.villes) && Array.isArray(liste.facettes.vocations), { returned: liste.associations.length, total: liste.total, totalGlobal: liste.totalGlobal });
    const own = await service.mesAssociations(identity, false);
    const managed = await service.mesAssociations(identity, true);
    check("personal-and-managed-associations", Array.isArray(own.associations) && Array.isArray(managed.associations), { own: own.associations.length, managed: managed.associations.length });
    if (liste.associations.length) {
      const first = liste.associations[0];
      const detail = await service.fiche(first.id, identity);
      const roster = await service.membres(first.id, identity, { page: 1, limite: 3 });
      check("association-detail-and-roster", detail.id === first.id && Array.isArray(roster.membres) && roster.total === detail.nbMembres, { membersReturned: roster.membres.length, verifiedTotal: roster.total });
      const filtered = await service.liste({ page: 1, limite: 3, pays: first.pays, ...(first.ville ? { ville: first.ville } : {}), ...(first.vocation ? { vocation: first.vocation } : {}) }, identity);
      check("association-filtered-directory", filtered.total >= 1 && filtered.associations.every((a) => a.pays === first.pays));
    } else report.warnings.push("DETAIL_SKIPPED_NO_ACTIVE_ASSOCIATION");
    if (admin) {
      const suggestions = await service.suggestions({ page: 1, limite: 3, statut: "EN_ATTENTE" }, identity);
      const responsables = await service.responsables("", identity);
      check("admin-suggestion-and-responsible-queries", Array.isArray(suggestions.suggestions) && Array.isArray(responsables.responsables), { suggestionsReturned: suggestions.suggestions.length, candidatesReturned: responsables.responsables.length });
      if (managed.associations.length) {
        const pending = await service.membres(managed.associations[0].id, identity, { page: 1, limite: 3 }, true);
        check("pending-affiliations-query", Array.isArray(pending.affiliations), { returned: pending.affiliations.length });
      }
    } else report.warnings.push("ADMIN_READS_SKIPPED_NO_EXISTING_ADMIN");

    // Ces SELECT exécutent les jointures même si les tables associations sont vides.
    await db.associationMembre.findMany({
      where: { statut: "VERIFIE", profil: profilVisible }, take: 1,
      orderBy: [{ profil: { user: { nom: "asc" } } }, { profilId: "asc" }],
      select: { rejointLe: true, profil: { select: { id: true } }, association: { select: { ville: true, vocation: true, photo: true, photoCouverture: true, dateCreation: true } } },
    });
    await db.associationSuggestion.findMany({ take: 1, select: { statut: true, proposeur: { select: { id: true } } } });
    check("association-empty-safe-joins", true);

    const probeCases = [ {}, { q: "controle lecture" }, { promotion: 2019 }, { aide: "Mentorat" }, { etablissementId: "__readonly_probe_no_match__", promotion: 2019 }, { volontaire: "true", pays: "Mali", ville: "Bamako" } ];
    const probeCounts = [];
    for (const candidate of probeCases) {
      const query = annuaireSchema.parse(candidate);
      probeCounts.push(await db.profil.count({ where: construireFiltresAnnuaire(query, viewer.id) }));
    }
    const people = await db.profil.findMany({
      where: construireFiltresAnnuaire(annuaireSchema.parse({}), viewer.id), take: 3,
      orderBy: [{ user: { prenom: "asc" } }, { user: { nom: "asc" } }, { id: "asc" }],
      select: {
        id: true, user: { select: { prenom: true, nom: true } },
        formations: { take: 3, orderBy: [{ anneeFin: "desc" }, { anneeDebut: "desc" }, { id: "asc" }], select: { anneeFin: true, diplomesScolaires: true, avis: { select: { anneePromo: true } }, etablissement: { select: { id: true, nom: true } } } },
        volontaire: { select: { sujets: true } },
        associations: { where: { statut: "VERIFIE", association: { valide: true } }, select: { association: { select: { nom: true, pays: true, ville: true, vocation: true, photo: true, photoCouverture: true, dateCreation: true } } } },
      },
    });
    for (const person of people) { sujetsAide(person.volontaire?.sujets); person.formations.flatMap(promotionsFormation); }
    await db.formation.findMany({ where: { ...filtreFormationAnnuaire(undefined, 2019), profil: profilVisible }, take: 1, select: { anneeFin: true, diplomesScolaires: true } });
    const json = await client.$queryRaw`SELECT JSON_CONTAINS('[{"type":"BAC","anneeObtention":"2019"}]', '[{"anneeObtention":"2019"}]') AS promotionOk, JSON_CONTAINS('["Mentorat","Orientation"]', '"Mentorat"') AS aideOk`;
    check("mysql-json-filter-semantics", Number(json[0].promotionOk) === 1 && Number(json[0].aideOk) === 1);
    check("person-directory-filter-and-profile-queries", probeCounts.every(Number.isInteger), { cases: probeCounts.length, returnedProfiles: people.length });
    report.status = report.warnings.length ? "WARN" : "PASS";
  } catch (error) {
    report.status = "FAIL";
    // Ne jamais imprimer error.message/stack/metadata : Prisma peut y inclure des données de connexion.
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
    console.log("Lecture seule : node verify-associations-readonly.cjs --backend /chemin/absolu/nodejs [--env-file /chemin/absolu/.env] [--mode baseline|post] [--before /chemin/absolu/baseline.json] [--strict-counts]\nAucun environnement chargé sans option explicite. DATABASE_URL peut aussi être déjà fourni au processus. Aucun token ni donnée identifiante n'est imprimé. stdout=rapport JSON ; code sortie 1 si FAIL, 0 si PASS/WARN (lire les warnings). Pas de serveur HTTP lancé.");
  } else if (options) {
    void main(options).then((report) => { process.stdout.write(JSON.stringify(report, null, 2) + "\n"); if (report.status === "FAIL") process.exitCode = 1; }).catch(() => { console.error("Erreur de vérification non détaillée pour préserver la confidentialité."); process.exitCode = 1; });
  }
}

#!/usr/bin/env node
'use strict';
// SELECT et lectures de fichiers seulement. Aucun déploiement ni migration.
// Les dépendances et .env sont lus dans la candidate explicitement indiquée.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const DATABASE = 'u668963025_maliwuli';
const MIGRATION = '20260928200000_job_applications';
const HISTORICAL = {
  "20260919000000_production_baseline": "cce2ac6952f274f7b635723ea5f12b5906c35ce8967ed8d7a4cd61ce9614e963",
  "20260920000000_social_realtime_mysql": "80631dea47bcb51046a1fc3b23e40c29412eeac437b855167ec3371026a3b61c",
  "20260920010000_onboarding_mentorat": "f110deabb5f61e1fe3ad2c611445c929137bb819db2e006d813663f769e315a7",
  "20260920020000_community_features_mysql": "567066e767bf218e35129fc037f375943095bf47f927a5fda34944f4f6e7f099",
  "20260920030000_password_reset_codes": "4305efa25267845f1f32d0f5e1e44df73d5a978c9971064c7c098b67a90c946d",
  "20260920040000_onboarding_snapshot": "6d6a7a460933a120c8c3baa635646b8ee76dab7038175f29fbddc9e8b43a25b5",
  "20260920050000_community_long_urls": "0cac845f1ac5053d5902669e3e75d13e548fc4c61313c2f8f49bb1a1b7a85861",
  "20260920060000_auth_session_version": "d4b0915b5d5cec58a122a9809ff599aa2daeb231b10bebae1176745b4fb457fa",
  "20260920070000_login_otp_codes": "78b378b0cd3621d9f5acb8d61af58eed67daad1821df85ec8b496de30b21cfd2",
  "20260921000000_school_curriculum_diplomas": "aea82cd2800da468e412d1b2c4e8d0880bbcb4985bcc8d1e9ea573d4473c33d1",
  "20260928180000_association_directory": "3beb325e757b66e63d36a934b15ab8c22a453fbbe71e2f05f6671a848c5435ac",
  "20260928190000_event_photos": "1e7e87ed7f408597b3769c0630b08dd54591131e19cb2f75ad88a68414f42c0e"
};
const MIGRATION_SHA256 = '4678ab0e7711924097e75dc0198b78bb026ce5145dce1d046585d5acff2195fd';
const FRONT = '/home/u668963025/domains/mali-wuli.com/hbuilds';
const BACK = '/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function options(argv, needsBefore = false) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help') out.help = true;
    else if (['--backend', '--env-file', '--before'].includes(key)) {
      const value = argv[++i];
      assert(value && path.isAbsolute(value), 'INVALID_ARGUMENTS');
      out[{ '--backend': 'backend', '--env-file': 'envFile', '--before': 'before' }[key]] = value;
    } else throw Error('INVALID_ARGUMENTS');
  }
  if (!out.help) { assert(out.backend, 'BACKEND_REQUIRED'); if (needsBefore) assert(out.before, 'BACKUP_JSON_REQUIRED'); }
  return out;
}
async function connect(opts) {
  const backend = fs.realpathSync(opts.backend);
  const fromBackend = createRequire(path.join(backend, 'package.json'));
  const parsed = fromBackend('dotenv').parse(fs.readFileSync(opts.envFile || path.join(backend, '.env')));
  assert(parsed.DATABASE_URL, 'DATABASE_CONFIG_MISSING');
  assert.equal(decodeURIComponent(new URL(parsed.DATABASE_URL).pathname.slice(1)), DATABASE, 'DATABASE_TARGET');
  const { PrismaClient } = fromBackend('@prisma/client');
  const client = new PrismaClient({ log: [], datasources: { db: { url: parsed.DATABASE_URL } } });
  return { client, backend, fromBackend };
}
async function auditMigrations(client, backend, after) {
  const [{ db }] = await client.$queryRaw`SELECT DATABASE() AS db`;
  assert.equal(db, DATABASE, 'DATABASE_TARGET');
  const rows = await client.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;
  assert.equal(Object.keys(HISTORICAL).length, 12, 'HISTORICAL_MANIFEST_SIZE');
  assert.equal(rows.length, after ? 13 : 12, 'APPLIED_MIGRATION_COUNT');
  assert(rows.every(row => row.finished_at && !row.rolled_back_at), 'UNFINISHED_OR_ROLLED_BACK_MIGRATION');
  assert.equal(new Set(rows.map(row => row.migration_name)).size, rows.length, 'DUPLICATE_MIGRATION_RECORD');
  const expected = { ...HISTORICAL, [MIGRATION]: MIGRATION_SHA256 };
  const directory = path.join(backend, 'prisma/migrations');
  const names = fs.readdirSync(directory).filter(name => fs.statSync(path.join(directory, name)).isDirectory()).sort();
  assert.deepEqual(names, Object.keys(expected).sort(), 'SOURCE_MIGRATION_SET');
  for (const name of names) assert.equal(digest(fs.readFileSync(path.join(directory, name, 'migration.sql'))), expected[name], `SOURCE_CHECKSUM_${name}`);
  for (const row of rows) assert.equal(row.checksum, expected[row.migration_name], `DATABASE_CHECKSUM_${row.migration_name}`);
  const pending = names.filter(name => !rows.some(row => row.migration_name === name));
  assert.deepEqual(pending, after ? [] : [MIGRATION], 'PENDING_MIGRATION_SET');
  return { database: db, appliedCount: rows.length, pending, historicalChecksumsVerified: 12, migrationSha256: MIGRATION_SHA256 };
}
async function main(opts) {
  let client;
  try {
    const connection = await connect(opts); client = connection.client;
    const audit = await auditMigrations(client, connection.backend, false);
    assert.equal(fs.readlinkSync(path.join(FRONT, 'current')), 'versions/20260928-parcours-recents', 'FRONT_CURRENT_CHANGED');
    assert.equal(fs.readlinkSync(path.join(BACK, 'current')), 'versions/20260928-evenements-photos', 'BACK_CURRENT_CHANGED');
    const tables = await client.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('OffreEnregistrement', 'CandidatureOffre')`;
    const columns = await client.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Offre' AND COLUMN_NAME IN ('modeCandidature','modeTravail','profilRecherche','recommandationPossible','salaire','statutModeration')`;
    assert.equal(Number(tables[0].n), 0, 'NEW_TABLE_ALREADY_PRESENT');
    assert.equal(Number(columns[0].n), 0, 'NEW_COLUMN_ALREADY_PRESENT');
    return { status: 'PASS', at: new Date().toISOString(), ...audit, currentTargetsUnchanged: true, newSchemaAbsent: true, databaseWrites: 0 };
  } finally { if (client) await client.$disconnect(); }
}
function safeFailure(error) {
  const candidate = error.safeCheck || (typeof error.message === 'string' ? error.message.split('\n')[0] : '');
  return /^[A-Z][A-Z0-9_]+$/.test(candidate) ? candidate : /^P\d{4}$/.test(error.code || '') ? error.code : 'READ_ONLY_CHECK_FAILED';
}
module.exports = { DATABASE, MIGRATION, HISTORICAL, MIGRATION_SHA256, options, connect, auditMigrations, safeFailure };
if (require.main === module) {
  let opts;
  try { opts = options(process.argv.slice(2)); } catch { console.error('Arguments invalides. Utilisez --help. Aucun accès DB effectué.'); process.exitCode = 2; }
  if (opts?.help) console.log('Lecture seule : node guard-migration.cjs --backend /ABS/versions/20260928-offres-emploi/nodejs [--env-file /ABS/.env]\nVérifie la base, les 12 migrations historiques, la seule migration attendue, son empreinte et les deux cibles current avant publication. Ne lance jamais la migration.');
  else if (opts) main(opts).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(JSON.stringify({ status: 'FAIL', check: safeFailure(error), databaseWrites: 0 })); process.exitCode = 1; });
}

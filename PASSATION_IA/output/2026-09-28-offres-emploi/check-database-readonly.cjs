#!/usr/bin/env node
'use strict';
// Post-migration, AVANT activation : SELECT uniquement, aucun fixture, PDF,
// HTTP, JWT, e-mail ou chargement du serveur. Aucun script ne démarre à l'import.
const fs = require('node:fs');
const path = require('node:path');
const { DATABASE, MIGRATION, options, connect, auditMigrations, safeFailure } = require('./guard-migration.cjs');
const TABLES = ['User','Profil','Formation','Association','AssociationMembre','Evenement','EvenementParticipant','Offre','Message','Conversation'];
const NEW_TABLES = ['OffreEnregistrement','CandidatureOffre'];
const READS = new Set(['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy']);
function readonlyClient(client) {
  const delegates = new Map();
  return new Proxy(client, {
    get(target, name) {
      if (typeof name !== 'string' || name.startsWith('$') || name.startsWith('_')) throw Error('READ_ONLY_GUARD');
      if (!delegates.has(name)) {
        const delegate = target[name];
        if (!delegate || typeof delegate !== 'object') throw Error('READ_ONLY_GUARD');
        delegates.set(name, new Proxy(delegate, {
          get(object, operation) { if (!READS.has(operation) || typeof object[operation] !== 'function') throw Error('READ_ONLY_GUARD'); return object[operation].bind(object); },
          set() { throw Error('READ_ONLY_GUARD'); },
        }));
      }
      return delegates.get(name);
    },
    set() { throw Error('READ_ONLY_GUARD'); },
  });
}
async function main(opts) {
  const at = new Date();
  const report = { status: 'RUNNING', at: at.toISOString(), kind: 'job-applications-post-migration-readonly', migration: MIGRATION, checks: [], warnings: [], databaseWrites: 0 };
  let client;
  const check = (name, ok, details) => {
    report.checks.push({ name, ok: Boolean(ok), ...(details === undefined ? {} : { details }) });
    if (!ok) { const error = new Error('CHECK_FAILED'); error.safeCheck = name; throw error; }
  };
  try {
    const baseline = JSON.parse(fs.readFileSync(opts.before, 'utf8'));
    check('BACKUP_DATABASE_TARGET', baseline.database === DATABASE);
    check('BACKUP_METADATA_VALID', Number.isSafeInteger(baseline.bytes) && baseline.bytes >= 1000 && /^[a-f0-9]{64}$/.test(baseline.sha256 || '') && baseline.counts && TABLES.every(t => Number.isSafeInteger(baseline.counts[t]) && baseline.counts[t] >= 0));
    report.backupSha256 = baseline.sha256;
    const connection = await connect(opts); client = connection.client;
    report.migrations = await auditMigrations(client, connection.backend, true);
    const db = readonlyClient(client);
    const tables = await client.$queryRaw`SELECT TABLE_NAME AS tableName, ENGINE AS engine, TABLE_COLLATION AS collationName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
    check('TABLES_PRESENT', [...TABLES,...NEW_TABLES].every(name => tables.some(t => t.tableName === name)));
    check('NEW_TABLES_ENGINE_AND_COLLATION', NEW_TABLES.every(name => tables.some(t => t.tableName === name && t.engine === 'InnoDB' && t.collationName === 'utf8mb4_unicode_ci')));
    const count = async () => {
      const result = {};
      // Identifiants exclusivement issus de cette constante fermée, jamais d'arguments.
      for (const table of [...TABLES,...NEW_TABLES]) result[table] = Number((await client.$queryRawUnsafe('SELECT COUNT(*) AS n FROM `' + table + '`'))[0].n);
      return result;
    };
    report.counts = await count();
    for (const table of TABLES) check(`COUNT_UNCHANGED_${table.toUpperCase()}`, report.counts[table] === baseline.counts[table], { before: baseline.counts[table], after: report.counts[table] });
    for (const table of NEW_TABLES) check(`NEW_TABLE_EMPTY_${table.toUpperCase()}`, report.counts[table] === 0);

    const columns = await client.$queryRaw`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault, CHARACTER_MAXIMUM_LENGTH AS maxLength FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Offre','OffreEnregistrement','CandidatureOffre')`;
    const column = (table, name) => columns.find(c => c.tableName === table && c.columnName === name);
    const defaultValue = c => String(c?.columnDefault ?? '').replace(/^'(.*)'$/, '$1');
    const enumValues = c => [...String(c?.columnType || '').matchAll(/'([^']+)'/g)].map(m => m[1]);
    const checkColumn = (table, name, type, nullable, length) => { const c = column(table,name); check(`COLUMN_${table.toUpperCase()}_${name.toUpperCase()}`, c && c.dataType.toLowerCase() === type && c.isNullable === (nullable ? 'YES' : 'NO') && (length === undefined || Number(c.maxLength) === length)); };
    const enums = { modeCandidature: ['MALI_WULI','EMAIL','LIEN_EXTERNE'], modeTravail: ['SUR_SITE','HYBRIDE','TELETRAVAIL'], statutModeration: ['EN_ATTENTE','PUBLIEE','REFUSEE'] };
    for (const [name, values] of Object.entries(enums)) {
      checkColumn('Offre',name,'enum',false);
      check(`ENUM_OFFRE_${name.toUpperCase()}`, JSON.stringify(enumValues(column('Offre',name))) === JSON.stringify(values) && defaultValue(column('Offre',name)) === values[0]);
    }
    checkColumn('Offre','profilRecherche','text',true); checkColumn('Offre','salaire','varchar',true,191); checkColumn('Offre','recommandationPossible','tinyint',false);
    check('RECOMMENDATION_DEFAULT_FALSE', defaultValue(column('Offre','recommandationPossible')) === '0');
    check('LEGACY_OFFER_COLUMNS_PRESENT', ['id','titre','entreprise','type','secteur','pays','ville','teletravail','description','lienCandidature','emailContact','dateExpiration','publieurId','valide','createdAt'].every(name => column('Offre',name)));
    for (const name of ['offreId','profilId']) checkColumn('OffreEnregistrement',name,'varchar',false,191);
    checkColumn('OffreEnregistrement','createdAt','datetime',false);
    for (const name of ['id','offreId','profilId','tentativeId']) checkColumn('CandidatureOffre',name,'varchar',false,191);
    for (const name of ['conversationId','messageId','erreurCode']) checkColumn('CandidatureOffre',name,'varchar',true,191);
    checkColumn('CandidatureOffre','message','text',true);
    for (const name of ['createdAt','updatedAt']) checkColumn('CandidatureOffre',name,'datetime',false);
    checkColumn('CandidatureOffre','envoyeeAt','datetime',true); checkColumn('CandidatureOffre','tentatives','int',false);
    check('ATTEMPTS_DEFAULT_ONE', defaultValue(column('CandidatureOffre','tentatives')) === '1');
    for (const [name, values] of Object.entries({ modeCandidature: enums.modeCandidature, statut: ['EN_COURS','ENVOYEE','ECHEC'] })) {
      checkColumn('CandidatureOffre',name,'enum',false);
      check(`ENUM_APPLICATION_${name.toUpperCase()}`, JSON.stringify(enumValues(column('CandidatureOffre',name))) === JSON.stringify(values));
    }
    check('APPLICATION_STATUS_DEFAULT', defaultValue(column('CandidatureOffre','statut')) === 'EN_COURS');

    const indexes = await client.$queryRaw`SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS sequenceNumber, COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Offre','OffreEnregistrement','CandidatureOffre')`;
    const expectedIndexes = [
      ['Offre','Offre_statutModeration_dateExpiration_createdAt_idx',false,['statutModeration','dateExpiration','createdAt']],
      ['Offre','Offre_modeTravail_pays_ville_idx',false,['modeTravail','pays','ville']],
      ['OffreEnregistrement','PRIMARY',true,['offreId','profilId']],
      ['OffreEnregistrement','OffreEnregistrement_profilId_createdAt_idx',false,['profilId','createdAt']],
      ['CandidatureOffre','PRIMARY',true,['id']],
      ['CandidatureOffre','CandidatureOffre_tentativeId_key',true,['tentativeId']],
      ['CandidatureOffre','CandidatureOffre_offreId_profilId_key',true,['offreId','profilId']],
      ['CandidatureOffre','CandidatureOffre_profilId_createdAt_idx',false,['profilId','createdAt']],
      ['CandidatureOffre','CandidatureOffre_offreId_statut_idx',false,['offreId','statut']],
    ];
    for (const [table,name,unique,fields] of expectedIndexes) {
      const rows = indexes.filter(i => i.tableName === table && i.indexName === name).sort((a,b) => Number(a.sequenceNumber)-Number(b.sequenceNumber));
      check(`INDEX_${table.toUpperCase()}_${name.toUpperCase()}`, JSON.stringify(rows.map(r => r.columnName)) === JSON.stringify(fields) && rows.every(r => Number(r.nonUnique) === (unique ? 0 : 1)));
    }
    const keys = await client.$queryRaw`SELECT k.TABLE_NAME AS tableName, k.CONSTRAINT_NAME AS constraintName, k.COLUMN_NAME AS columnName, k.REFERENCED_TABLE_NAME AS referencedTable, k.REFERENCED_COLUMN_NAME AS referencedColumn, r.DELETE_RULE AS deleteRule, r.UPDATE_RULE AS updateRule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.TABLE_NAME = k.TABLE_NAME AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME IN ('OffreEnregistrement','CandidatureOffre') AND k.REFERENCED_TABLE_NAME IS NOT NULL`;
    for (const table of NEW_TABLES) for (const [field,reference] of [['offreId','Offre'],['profilId','Profil']]) check(`FK_${table.toUpperCase()}_${field.toUpperCase()}`, keys.some(k => k.tableName === table && k.constraintName === `${table}_${field}_fkey` && k.columnName === field && k.referencedTable === reference && k.referencedColumn === 'id' && k.deleteRule === 'CASCADE' && k.updateRule === 'CASCADE'));

    const backfill = await client.$queryRaw`SELECT COUNT(*) AS n FROM Offre WHERE statutModeration <> CASE WHEN valide = true THEN 'PUBLIEE' ELSE 'EN_ATTENTE' END OR modeTravail <> CASE WHEN teletravail = true THEN 'TELETRAVAIL' ELSE 'SUR_SITE' END OR modeCandidature <> CASE WHEN lienCandidature IS NOT NULL AND TRIM(lienCandidature) <> '' THEN 'LIEN_EXTERNE' WHEN emailContact IS NOT NULL AND TRIM(emailContact) <> '' THEN 'EMAIL' ELSE 'MALI_WULI' END OR profilRecherche IS NOT NULL OR salaire IS NOT NULL OR recommandationPossible <> false`;
    check('LEGACY_BACKFILL_EXACT_AND_NEW_DEFAULTS', Number(backfill[0].n) === 0, { mismatches: Number(backfill[0].n), legacyOffers: report.counts.Offre });
    // Ces jointures vérifient le client généré, même si les tables sont vides.
    await db.offre.findMany({ take: 1, select: { modeTravail: true, modeCandidature: true, statutModeration: true, salaire: true, profilRecherche: true, recommandationPossible: true, enregistrements: { take: 1, select: { profilId: true } }, candidatures: { take: 1, select: { statut: true } } } });
    await db.offreEnregistrement.findMany({ take: 1, select: { offre: { select: { id: true } }, profil: { select: { id: true } } } });
    await db.candidatureOffre.findMany({ take: 1, select: { tentativeId: true, statut: true, offre: { select: { id: true } }, profil: { select: { id: true } } } });
    check('GENERATED_CLIENT_JOINS', true);

    // Le service offres n'est importé qu'après sa compilation ; aucun routeur/serveur.
    const { creerServiceOffres } = connection.fromBackend(path.join(connection.backend,'dist/services/offre.service.js'));
    const denyEffect = () => { throw Error('READ_ONLY_GUARD'); };
    const service = creerServiceOffres(db, { notifier: denyEffect, emettre: denyEffect }, () => at);
    const valid = { onboardingFini: true, user: { statut: 'VALIDE', emailVerifie: true } };
    const select = { id: true, userId: true, user: { select: { role: true } } };
    const moderator = await db.profil.findFirst({ where: { ...valid, user: { ...valid.user, role: { in: ['ADMIN','MODERATEUR'] } } }, select });
    const viewer = moderator || await db.profil.findFirst({ where: valid, select });
    if (!viewer) report.warnings.push('SERVICES_SKIPPED_NO_EXISTING_VALID_PROFILE');
    else {
      const actor = await service.acteur(viewer.userId, viewer.user.role);
      const filter = { page: 1, limite: 3, vue: 'actives' };
      const active = await service.liste(filter, actor);
      check('SERVICE_ACTIVE_LIST', active.offres.every(o => o.valide && o.statutModeration === 'PUBLIEE' && !o.estExpiree) && Number.isInteger(active.meta.total) && active.meta.total === active.compteurs.actives);
      check('SERVICE_FACETS_AND_REVISIONS', Array.isArray(active.facettes.pays) && Array.isArray(active.facettes.modesTravail) && active.offres.every(o => /^[a-f0-9]{64}$/.test(o.revision)));
      const own = await service.liste({ ...filter, vue: 'mes-offres' }, actor);
      check('SERVICE_OWN_LIST', own.offres.every(o => o.estProprietaire) && own.meta.total === own.compteurs.mesOffres);
      const saved = await service.liste({ ...filter, vue: 'enregistrees' }, actor);
      check('SERVICE_SAVED_LIST', saved.offres.every(o => o.estEnregistree && o.valide) && saved.meta.total === 0);
      if (actor.moderateur) {
        const pending = await service.liste({ ...filter, vue: 'en-attente' }, actor);
        check('SERVICE_PENDING_LIST', pending.offres.every(o => !o.valide && o.statutModeration === 'EN_ATTENTE') && pending.meta.total === pending.compteurs.enAttente);
      } else report.warnings.push('MODERATION_READ_SKIPPED_NO_EXISTING_MODERATOR');
      let denied = false; try { await service.liste({ ...filter, vue: 'en-attente' }, { ...actor, moderateur: false }); } catch (e) { denied = e.statut === 403; }
      check('SERVICE_NON_MODERATOR_DENIED', denied);
      const sample = active.offres[0] || own.offres[0];
      if (!sample) report.warnings.push('DETAIL_SKIPPED_NO_ACCESSIBLE_OFFER');
      else {
        const detail = await service.fiche(sample.id, actor);
        check('SERVICE_DETAIL', detail.id === sample.id && typeof detail.revision === 'string');
        check('SERVICE_NO_APPLICATION_SIDE_EFFECT', detail.aPostule === false && detail.statutCandidature === null && detail.conversationId === null);
      }
    }
    report.countsAfterReads = await count();
    for (const table of [...TABLES,...NEW_TABLES]) check(`READ_COUNT_UNCHANGED_${table.toUpperCase()}`, report.countsAfterReads[table] === report.counts[table]);
    report.limitations = ['Strict checks intended before activation; concurrent live writes may fail a count comparison and require review.', 'Backup JSON counts prove row totals, not identity or byte equality of historical records.', 'No real application, email, PDF generation, notification or HTTP authentication was exercised.'];
    report.status = report.warnings.length ? 'WARN' : 'PASS';
  } catch (error) { report.status = 'FAIL'; report.error = { code: safeFailure(error) }; }
  finally { if (client) { try { await client.$disconnect(); } catch { report.warnings.push('DISCONNECT_ERROR'); } } }
  return report;
}
module.exports = { readonlyClient, main };
if (require.main === module) {
  let opts;
  try { opts = options(process.argv.slice(2), true); } catch { console.error('Arguments invalides. Utilisez --help. Aucun accès DB effectué.'); process.exitCode = 2; }
  if (opts?.help) console.log('Lecture seule, après migration AVANT activation : node check-database-readonly.cjs --backend /ABS/versions/20260928-offres-emploi/nodejs --before /ABS/private-backups/20260928-offres-emploi/verification.json [--env-file /ABS/.env]\nLes totaux existants doivent être strictement identiques au backup JSON. Les nouvelles tables doivent être vides et les nouvelles colonnes exactement dérivées des champs historiques. Les services sont appelés uniquement en lecture via garde Prisma. Sortie JSON sans profil, nom, e-mail, token ou connexion. PASS/WARN=0 (lire warnings), FAIL=1.');
  else if (opts) main(opts).then(report => { console.log(JSON.stringify(report,null,2)); if (report.status === 'FAIL') process.exitCode = 1; }).catch(() => { console.error('READ_ONLY_CHECK_FAILED'); process.exitCode = 1; });
}

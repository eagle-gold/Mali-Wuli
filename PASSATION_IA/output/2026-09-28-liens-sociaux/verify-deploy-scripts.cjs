'use strict';
// Local mocks only: no SSH, app, database, archive, backup, build or activation runs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const g=require('./guard-migration.cjs'),{verifyReports}=require('./verify-activation-evidence.cjs');
const checks=[];const test=async(name,run)=>{await run();checks.push(name);};
const migrated=()=>Object.entries({...g.contract.historical,[g.contract.migration]:g.contract.migrationSha256}).map(([migration_name,checksum])=>({migration_name,checksum,finished_at:new Date(),rolled_back_at:null}));
(async()=>{
 await test('exact reviewed additive SQL, schema and 14 historical checksums',()=>{
  g.assertContract();assert.equal(g.digest(fs.readFileSync(path.join(__dirname,'staging/backend/prisma/schema.prisma'))),g.contract.schemaSha256);
  const sql=fs.readFileSync(path.join(__dirname,'staging/backend/prisma/migrations',g.contract.migration,'migration.sql'),'utf8');assert.equal(g.digest(sql),g.contract.migrationSha256);
  assert.equal(sql.replace(/^--.*$/gm,'').replace(/\s+/g,' ').trim(),'ALTER TABLE `Profil` MODIFY COLUMN `linkedin` VARCHAR(500) NULL, ADD COLUMN `facebook` VARCHAR(500) NULL, ADD COLUMN `instagram` VARCHAR(500) NULL, ADD COLUMN `tiktok` VARCHAR(500) NULL;');
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline-source-manifest.json')));assert.equal(Object.keys(manifest).length,230);assert.equal(g.digest(fs.readFileSync(path.join(__dirname,'baseline-source-manifest.json'))),g.contract.baselineManifestSha256);
 });
 await test('migration guard rejects missing, duplicate, altered, failed or rolled-back migration records',()=>{
  const rows=migrated();assert.equal(g.verifyMigrationRows(rows.slice(0,14),false).appliedCount,14);assert.equal(g.verifyMigrationRows(rows,true).appliedCount,15);
  assert.throws(()=>g.verifyMigrationRows(rows,false));assert.throws(()=>g.verifyMigrationRows(rows.slice(1),true));
  for(const patch of [{checksum:'0'.repeat(64)},{finished_at:null},{rolled_back_at:new Date()},{migration_name:'unknown'}]){const bad=rows.map(r=>({...r}));Object.assign(bad[0],patch);assert.throws(()=>g.verifyMigrationRows(bad,true));}
 });
 await test('real MariaDB NULL spelling accepted, other schema changes refused',()=>{
  const before=JSON.parse(fs.readFileSync(path.join(__dirname,'production-baseline-readonly.json'))).profileColumns;
  const normalized=before.map(r=>({name:r.COLUMN_NAME,type:r.COLUMN_TYPE,nullable:r.IS_NULLABLE,default:r.COLUMN_DEFAULT==='NULL'?null:r.COLUMN_DEFAULT,collation:r.COLLATION_NAME,extra:r.EXTRA}));
  g.verifyColumns(normalized,false);const linked=normalized.find(r=>r.name==='linkedin');
  const after=[...normalized.map(r=>r.name==='linkedin'?{...r,type:'varchar(500)'}:r),...['facebook','instagram','tiktok'].map(name=>({...linked,name,type:'varchar(500)'}))];g.verifyColumns(after,true,normalized);
  for(const patch of [{default:"'NULL'"},{type:'varchar(191)'},{nullable:'NO'},{collation:'latin1_swedish_ci'}]){const bad=after.map(r=>({...r}));Object.assign(bad.find(r=>r.name==='facebook'),patch);assert.throws(()=>g.verifyColumns(bad,true,normalized));}
  assert.throws(()=>g.verifyColumns([...after,{...linked,name:'unexpected'}],true,normalized));const bad=after.map(r=>({...r}));bad.find(r=>r.name==='linkedin').extra='GENERATED';assert.throws(()=>g.verifyColumns(bad,true,normalized));
 });
 await test('18 counts, account roles/sessions, role grants and legacy LinkedIn fingerprints preserved',async()=>{
  const queries=[];const db={$queryRawUnsafe:async sql=>{queries.push(sql);assert(/^SELECT COUNT\(\*\) AS n FROM `[A-Za-z]+`$/.test(sql));return [{n:2n}];},$queryRaw:async strings=>{const sql=strings.join('');queries.push(sql);assert(sql.startsWith('SELECT '));if(sql.includes('FROM UserRoleGrant'))return[{userId:'u',code:'MEMBRES',createdAt:new Date('2026-01-01Z')}];if(sql.includes('FROM User ORDER'))return[{id:'u',role:'MEMBRE',tokenVersion:3,statut:'VALIDE',emailVerifie:true}];if(sql.includes('SELECT id,linkedin'))return[{id:'p',linkedin:'https://www.linkedin.com/in/example'}];if(sql.includes('facebook IS NOT NULL'))return[{n:0n}];throw Error('UNEXPECTED_QUERY');}};
  const before=await g.snapshot(db),after=await g.snapshot(db,true);g.comparePreserved(before,after);assert.equal(Object.keys(before.counts).length,18);assert(!JSON.stringify(before).includes('linkedin.com'));
  for(const key of ['usersRoleFingerprint','roleGrantsFingerprint','profileLinksFingerprint'])assert.throws(()=>g.comparePreserved(before,{...after,[key]:'0'.repeat(64)}));
  assert.throws(()=>g.comparePreserved(before,{...after,counts:{...after.counts,User:3}}));assert.throws(()=>g.comparePreserved(before,{...after,newSocialValues:1}));assert(queries.every(q=>q.startsWith('SELECT ')));
 });
 await test('candidate migration sources reject history drift and additional migrations',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mw-social-scripts-'));try{const prisma=path.join(temp,'prisma');fs.mkdirSync(path.join(prisma,'migrations'),{recursive:true});fs.copyFileSync(path.join(__dirname,'staging/backend/prisma/schema.prisma'),path.join(prisma,'schema.prisma'));
  const original=fs.readFileSync;const known=new Map();for(const [name,hash]of Object.entries({...g.contract.historical,[g.contract.migration]:g.contract.migrationSha256})){const dir=path.join(prisma,'migrations',name);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'migration.sql'),name);known.set(path.join(dir,'migration.sql'),hash);}
  // Audit with real frozen SQL files; no hand-constructed digest acceptance.
  const active='/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/prisma/migrations';
  for(const name of Object.keys(g.contract.historical))fs.copyFileSync(path.join(active,name,'migration.sql'),path.join(prisma,'migrations',name,'migration.sql'));
  fs.copyFileSync(path.join(__dirname,'staging/backend/prisma/migrations',g.contract.migration,'migration.sql'),path.join(prisma,'migrations',g.contract.migration,'migration.sql'));
  g.auditSources(temp,true);fs.mkdirSync(path.join(prisma,'migrations','unreviewed'));assert.throws(()=>g.auditSources(temp,true));fs.rmdirSync(path.join(prisma,'migrations','unreviewed'));fs.appendFileSync(path.join(prisma,'migrations',g.contract.migration,'migration.sql'),'\n-- drift');assert.throws(()=>g.auditSources(temp,true));
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 });
 await test('activation requires preserved DB, matching built sources and complete current candidate QA',()=>{
  const buildId='new-test-build',manifestSha256='a'.repeat(64);const reports={packageContract:{release:g.contract.release,manifestSha256},database:{status:'PASS',release:g.contract.release,phase:'candidate',appliedCount:15,preserved:true,databaseWrites:0,migrationSha256:g.contract.migrationSha256},source:{status:'PASS',phase:'candidate-built',release:g.contract.release,manifestSha256,buildId},candidate:{status:'passed',release:g.contract.release,backendRelease:g.contract.release,mode:'candidate',baselineOnly:false,buildId,checks:['optional-four-network-fields-and-safe-own-public-profile-links-present-in-bundles','registration-and-home-full-semantic-content-match-pre-release-baseline']}};verifyReports(reports,buildId);
  for(const [part,patch]of [['database',{appliedCount:14}],['database',{preserved:false}],['source',{manifestSha256:'b'.repeat(64)}],['candidate',{baselineOnly:true}],['candidate',{buildId:'old'}],['candidate',{checks:[]}]] ){assert.throws(()=>verifyReports({...reports,[part]:{...reports[part],...patch}},buildId));}
 });
 await test('all scripts parse; mutation commands isolated from read-only gates',()=>{
  for(const file of fs.readdirSync(__dirname)){const full=path.join(__dirname,file);if(file.endsWith('.cjs'))assert.equal(cp.spawnSync(process.execPath,['--check',full],{encoding:'utf8'}).status,0,file);if(file.endsWith('.sh'))assert.equal(cp.spawnSync('sh',['-n',full],{encoding:'utf8'}).status,0,file);if(file.endsWith('.py'))assert.equal(cp.spawnSync('python3',['-c','import pathlib,sys; compile(pathlib.Path(sys.argv[1]).read_text(),sys.argv[1],"exec")',full],{encoding:'utf8'}).status,0,file);}
  for(const file of ['guard-migration.cjs','check-database-readonly.cjs','verify-sources-readonly.cjs','verify-activation-evidence.cjs'])assert(!/migrate deploy|mysqldump|spawn\(|\.exec\(|UPDATE |DELETE FROM|INSERT INTO|ALTER TABLE/.test(fs.readFileSync(path.join(__dirname,file),'utf8')),file);
  const apply=fs.readFileSync(path.join(__dirname,'apply-migration.sh'),'utf8');assert(apply.indexOf('guard-migration.cjs')<apply.indexOf('migrate deploy'));assert(apply.includes('umask 077'));assert(apply.includes('check-database-readonly.cjs'));
 });
 const report={status:'PASS',groups:checks.length,checks,networkRequests:0,databaseRequests:0,remoteWrites:0,applicationWrites:0};fs.writeFileSync(path.join(__dirname,'tests-deploy-scripts.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

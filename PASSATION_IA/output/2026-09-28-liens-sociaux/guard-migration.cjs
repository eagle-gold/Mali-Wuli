#!/usr/bin/env node
'use strict';
// Read-only shared guards. No raw records/URLs or environment values are emitted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{createRequire}=require('node:module');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'migration-contract.json'),'utf8'));
const FRONT='/home/u668963025/domains/mali-wuli.com/hbuilds',BACK='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const TABLES=['User','UserRoleGrant','Profil','Formation','Etablissement','Association','AssociationMembre','Evenement','EvenementParticipant','Offre','OffreEnregistrement','CandidatureOffre','Message','Conversation','Publication','CommentairePublication','ReactionPublication','EvenementPhoto'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function options(argv,needsBefore=false){const opts={phase:'before'};for(let i=0;i<argv.length;i++){
 const key=argv[i];if(key==='--help')opts.help=true;
 else if(key==='--phase'){opts.phase=argv[++i];assert(['before','candidate','after'].includes(opts.phase),'PHASE_INVALID');}
 else if(['--backend','--before'].includes(key)){const value=argv[++i];assert(value&&path.isAbsolute(value),'ABSOLUTE_PATH_REQUIRED');opts[key.slice(2)]=value;}
 else throw Error('INVALID_ARGUMENTS');
 }if(!opts.help){assert(opts.backend,'BACKEND_REQUIRED');if(needsBefore)assert(opts.before,'BACKUP_METADATA_REQUIRED');}return opts;}
function assertContract(){assert.equal(contract.status,'READY','MIGRATION_CONTRACT_NOT_READY');assert(sha(contract.migrationSha256)&&sha(contract.schemaSha256),'CONTRACT_SHA_MISSING');assert.equal(Object.keys(contract.historical).length,14,'HISTORICAL_MANIFEST_SIZE');assert.equal(contract.release,'20260928-liens-sociaux','WRONG_RELEASE');assert.equal(contract.migration,'20260928220000_profile_social_links','WRONG_MIGRATION');}
function assertTargets(phase='before'){
 const targets={frontend:fs.readlinkSync(FRONT+'/current'),backend:fs.readlinkSync(BACK+'/current')};
 assert.equal(targets.frontend,'versions/'+(phase==='after'?contract.release:contract.previousFrontend),'FRONTEND_CURRENT_CHANGED');
 assert.equal(targets.backend,'versions/'+(phase==='after'?contract.release:contract.previousBackend),'BACKEND_CURRENT_CHANGED');
 if(phase!=='after')assert.equal(fs.readFileSync(FRONT+'/current/nodejs/.next/BUILD_ID','utf8').trim(),contract.baselineBuildId,'BASELINE_BUILD_CHANGED');
 return targets;
}
function auditSources(backend,isCandidate=true){assertContract();const expected={...contract.historical,...(isCandidate?{[contract.migration]:contract.migrationSha256}:{})};
 const directory=path.join(backend,'prisma/migrations'),actual=fs.readdirSync(directory).filter(name=>fs.statSync(path.join(directory,name)).isDirectory()).sort();
 assert.deepEqual(actual,Object.keys(expected).sort(),'SOURCE_MIGRATION_SET');for(const name of actual)assert.equal(digest(fs.readFileSync(path.join(directory,name,'migration.sql'))),expected[name],'SOURCE_MIGRATION_CHECKSUM');
 assert.equal(digest(fs.readFileSync(path.join(backend,'prisma/schema.prisma'))),isCandidate?contract.schemaSha256:contract.schemaBeforeSha256,'SOURCE_SCHEMA_CHECKSUM');return expected;
}
async function connect(opts){assertContract();const backend=fs.realpathSync(opts.backend);const candidate=`${BACK}/versions/${contract.release}/nodejs`,previous=`${BACK}/versions/${contract.previousBackend}/nodejs`;
 assert([candidate,previous].includes(backend),'BACKEND_PATH_MISMATCH');const isCandidate=backend===candidate;auditSources(backend,isCandidate);
 const from=createRequire(path.join(backend,'package.json'));const parsed=from('dotenv').parse(fs.readFileSync(path.join(backend,'.env')));const url=new URL(parsed.DATABASE_URL||'');
 assert.equal(url.protocol,'mysql:','DATABASE_PROTOCOL');assert.equal(decodeURIComponent(url.pathname.slice(1)),contract.database,'DATABASE_TARGET');assert(['localhost','127.0.0.1'].includes(url.hostname),'DATABASE_HOST');
 return {backend,isCandidate,from,client:new(from('@prisma/client').PrismaClient)({datasources:{db:{url:parsed.DATABASE_URL}},log:[]})};
}
function verifyMigrationRows(rows,after){const expected={...contract.historical,...(after?{[contract.migration]:contract.migrationSha256}:{})};
 assert.equal(rows.length,after?15:14,'APPLIED_MIGRATION_COUNT');assert(rows.every(row=>row.finished_at&&!row.rolled_back_at),'UNFINISHED_OR_ROLLED_BACK_MIGRATION');
 assert.deepEqual(rows.map(r=>r.migration_name).sort(),Object.keys(expected).sort(),'APPLIED_MIGRATION_SET');
 for(const row of rows)assert.equal(row.checksum,expected[row.migration_name],'DATABASE_MIGRATION_CHECKSUM');
 return {appliedCount:rows.length,pending:after?[]:[contract.migration],historicalChecksumsVerified:14,migrationSha256:contract.migrationSha256};
}
async function auditMigrations(client,after){const [{name}]=await client.$queryRaw`SELECT DATABASE() AS name`;assert.equal(name,contract.database,'DATABASE_TARGET');
 const rows=await client.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;return {database:name,...verifyMigrationRows(rows,after)};
}
function normalizeColumns(rows){return rows.map(row=>({name:row.COLUMN_NAME,type:String(row.COLUMN_TYPE).toLowerCase(),nullable:row.IS_NULLABLE,default:row.COLUMN_DEFAULT==='NULL'?null:row.COLUMN_DEFAULT,collation:row.COLLATION_NAME,extra:row.EXTRA}));}
async function columns(client){return normalizeColumns(await client.$queryRaw`SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLLATION_NAME,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Profil' ORDER BY ORDINAL_POSITION`);}
function verifyColumns(rows,after,beforeColumns){const linked=rows.find(r=>r.name==='linkedin');assert(linked,'LINKEDIN_COLUMN_MISSING');assert.equal(linked.type,after?'varchar(500)':'varchar(191)','LINKEDIN_COLUMN_TYPE');assert.equal(linked.nullable,'YES','LINKEDIN_NULLABILITY');assert.equal(linked.default,null,'LINKEDIN_DEFAULT');
 for(const name of ['facebook','instagram','tiktok']){const row=rows.find(r=>r.name===name);if(!after)assert(!row,'NEW_SOCIAL_COLUMN_ALREADY_PRESENT');else{assert(row,'SOCIAL_COLUMN_MISSING');assert.equal(row.type,'varchar(500)','SOCIAL_COLUMN_TYPE');assert.equal(row.nullable,'YES','SOCIAL_COLUMN_NULLABILITY');assert.equal(row.default,null,'SOCIAL_COLUMN_DEFAULT');assert.equal(row.collation,linked.collation,'SOCIAL_COLUMN_COLLATION');assert.equal(row.extra,'','SOCIAL_COLUMN_EXTRA');}}
 if(after&&beforeColumns){const expected=beforeColumns.map(r=>r.name==='linkedin'?{...r,type:'varchar(500)'}:r);const historical=rows.filter(r=>!['facebook','instagram','tiktok'].includes(r.name));assert.deepEqual(historical,expected,'OTHER_PROFILE_COLUMNS_CHANGED');assert.equal(rows.length,beforeColumns.length+3,'PROFILE_COLUMN_COUNT');}
}
async function snapshot(client,after=false){const counts={};for(const table of TABLES)counts[table]=Number((await client.$queryRawUnsafe('SELECT COUNT(*) AS n FROM `'+table+'`'))[0].n);
 const users=await client.$queryRaw`SELECT id,role,tokenVersion,statut,emailVerifie FROM User ORDER BY id`;
 const grants=await client.$queryRaw`SELECT userId,code,createdAt FROM UserRoleGrant ORDER BY userId,code`;
 const links=await client.$queryRaw`SELECT id,linkedin FROM Profil ORDER BY id`;
 const report={counts,usersRoleFingerprint:digest(JSON.stringify(users.map(r=>[r.id,r.role,Number(r.tokenVersion),r.statut,Boolean(r.emailVerifie)]))),roleGrantsFingerprint:digest(JSON.stringify(grants.map(r=>[r.userId,r.code,new Date(r.createdAt).toISOString()]))),profileLinksFingerprint:digest(JSON.stringify(links.map(r=>[r.id,r.linkedin]))),profilesWithLinkedin:links.filter(r=>r.linkedin!==null).length};
 if(after){const newLinks=await client.$queryRaw`SELECT COUNT(*) AS n FROM Profil WHERE facebook IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL`;report.newSocialValues=Number(newLinks[0].n);}
 return report;
}
function comparePreserved(before,after){assert.deepEqual(after.counts,before.counts,'TABLE_COUNTS_CHANGED');for(const key of ['usersRoleFingerprint','roleGrantsFingerprint','profileLinksFingerprint'])assert.equal(after[key],before[key],key.toUpperCase()+'_CHANGED');if('newSocialValues'in after)assert.equal(after.newSocialValues,0,'NEW_SOCIAL_VALUES_REQUIRE_REVIEW');}
function readBackup(filename){const before=JSON.parse(fs.readFileSync(filename,'utf8'));assert.equal(before.release,contract.release,'BACKUP_RELEASE');assert.equal(before.database,contract.database,'BACKUP_DATABASE_TARGET');assert.equal(before.gzipIntegrity,true,'BACKUP_GZIP_NOT_VERIFIED');assert.equal(before.migrations.appliedCount,14,'BACKUP_MIGRATION_COUNT');for(const key of ['sha256','usersRoleFingerprint','roleGrantsFingerprint','profileLinksFingerprint'])assert(sha(before[key]),'BACKUP_PROOF_INVALID');assert.deepEqual(Object.keys(before.counts).sort(),[...TABLES].sort(),'BACKUP_COUNTS_MISSING');verifyColumns(before.profileColumns,false);
 const expected=`/home/u668963025/private-backups/${contract.release}/before.sql.gz`;assert.equal(before.backup,expected,'BACKUP_PATH');assert(Number.isSafeInteger(before.bytes)&&before.bytes>=1000,'BACKUP_SIZE');const stat=fs.lstatSync(expected);assert(stat.isFile()&&!stat.isSymbolicLink(),'BACKUP_FILE_TYPE');assert.equal(stat.mode&0o077,0,'BACKUP_NOT_PRIVATE');assert.equal(stat.size,before.bytes,'BACKUP_SIZE_CHANGED');assert.equal(digest(fs.readFileSync(expected)),before.sha256,'BACKUP_BYTES_CHANGED');return before;
}
function safeFailure(error){const label=error.safeCheck||error.message?.split('\n')[0];return /^[A-Z][A-Z0-9_]+$/.test(label||'')?label:/^P\d{4}$/.test(error.code||'')?error.code:'READ_ONLY_CHECK_FAILED';}
async function main(opts){let client;try{assertContract();const targets=assertTargets();const connection=await connect(opts);assert(connection.isCandidate,'CANDIDATE_REQUIRED');client=connection.client;const migrations=await auditMigrations(client,false),profileColumns=await columns(client);verifyColumns(profileColumns,false);const state=await snapshot(client);if(opts.before){const before=readBackup(opts.before);comparePreserved(before,state);assert.deepEqual(profileColumns,before.profileColumns,'SCHEMA_CHANGED_SINCE_BACKUP');}return {status:'PASS',kind:'social-links-pre-migration-readonly',at:new Date().toISOString(),release:contract.release,...migrations,targets,profileColumns,...state,backupVerified:!!opts.before,databaseWrites:0};}finally{await client?.$disconnect();}}
module.exports={contract,FRONT,BACK,TABLES,digest,sha,options,assertContract,assertTargets,auditSources,connect,verifyMigrationRows,auditMigrations,columns,verifyColumns,snapshot,comparePreserved,readBackup,safeFailure};
if(require.main===module){let opts;try{opts=options(process.argv.slice(2));}catch{console.error('INVALID_ARGUMENTS');process.exitCode=2;}if(opts?.help)console.log('Read-only: node guard-migration.cjs --backend /ABS/versions/20260928-liens-sociaux/nodejs [--before /ABS/database-before.json]');else if(opts)main(opts).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(JSON.stringify({status:'FAIL',check:safeFailure(e),databaseWrites:0}));process.exitCode=1;});}

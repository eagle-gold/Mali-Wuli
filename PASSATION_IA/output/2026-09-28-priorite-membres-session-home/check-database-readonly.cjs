#!/usr/bin/env node
'use strict';
// SELECT/delegate reads only. No migration, backup, HTTP session, JWT, server or mutation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),{createHash}=require('node:crypto');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'database-contract.json'),'utf8'));
const FRONT='/home/u668963025/domains/mali-wuli.com/hbuilds',BACK='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const TABLES=['User','UserRoleGrant','Profil','Formation','Etablissement','Association','AssociationMembre','Evenement','EvenementParticipant','Offre','OffreEnregistrement','CandidatureOffre','Message','Conversation'];
const READS=new Set(['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy']);
const digest=value=>createHash('sha256').update(value).digest('hex');
function options(args){const out={};for(let i=0;i<args.length;i++){
 const key=args[i];if(key==='--help')out.help=true;
 else if(['--backend','--env-file','--before','--phase'].includes(key)){const value=args[++i];assert(value&&!value.startsWith('--'),'ARGUMENT_VALUE');out[{'--backend':'backend','--env-file':'envFile','--before':'before','--phase':'phase'}[key]]=value;}
 else throw Error('INVALID_ARGUMENTS');
 }if(!out.help){assert(out.backend&&path.isAbsolute(out.backend),'BACKEND_ABSOLUTE_PATH');assert(['before','candidate','after'].includes(out.phase),'PHASE_REQUIRED');if(out.phase!=='before')assert(out.before&&path.isAbsolute(out.before),'BEFORE_ABSOLUTE_PATH');if(out.envFile)assert(path.isAbsolute(out.envFile),'ENV_ABSOLUTE_PATH');}return out;}
function auditSources(backend){
 assert.equal(contract.release,'20260928-priorite-membres-home','RELEASE_CONTRACT');assert.equal(contract.migrationAllowed,false,'MIGRATION_FORBIDDEN');assert.equal(Object.keys(contract.migrations).length,14,'MIGRATION_MANIFEST_SIZE');assert.deepEqual(contract.pending,[],'NO_MIGRATION_ALLOWED');
 assert.equal(digest(fs.readFileSync(path.join(backend,'prisma/schema.prisma'))),contract.schemaSha256,'SCHEMA_CHANGED_WITHOUT_MIGRATION');
 const dir=path.join(backend,'prisma/migrations'),names=fs.readdirSync(dir).filter(name=>fs.statSync(path.join(dir,name)).isDirectory()).sort();
 assert.deepEqual(names,Object.keys(contract.migrations).sort(),'SOURCE_MIGRATION_SET');for(const name of names)assert.equal(digest(fs.readFileSync(path.join(dir,name,'migration.sql'))),contract.migrations[name],`SOURCE_CHECKSUM_${name}`);
 return names;
}
function readonlyClient(client){const delegates=new Map();return new Proxy(client,{get(target,name){if(typeof name!=='string'||name.startsWith('$')||name.startsWith('_'))throw Error('READ_ONLY_GUARD');if(!delegates.has(name)){const delegate=target[name];if(!delegate||typeof delegate!=='object')throw Error('READ_ONLY_GUARD');delegates.set(name,new Proxy(delegate,{get(object,operation){if(!READS.has(operation)||typeof object[operation]!=='function')throw Error('READ_ONLY_GUARD');return object[operation].bind(object);},set(){throw Error('READ_ONLY_GUARD');}}));}return delegates.get(name);},set(){throw Error('READ_ONLY_GUARD');}});}
function assertTargets(phase){const expected=`versions/${phase==='after'?contract.release:contract.previousRelease}`;for(const root of [FRONT,BACK])assert.equal(fs.readlinkSync(path.join(root,'current')),expected,'CURRENT_CHANGED');if(phase!=='after')assert.equal(fs.readFileSync(path.join(FRONT,'current/nodejs/.next/BUILD_ID'),'utf8').trim(),contract.previousFrontendBuildId,'BASELINE_BUILD_CHANGED');return expected;}
async function connect(opts){const backend=fs.realpathSync(opts.backend);assert.equal(backend,`${BACK}/versions/${contract.release}/nodejs`,'CANDIDATE_PATH_MISMATCH');auditSources(backend);const from=createRequire(path.join(backend,'package.json'));const env=from('dotenv').parse(fs.readFileSync(opts.envFile||path.join(backend,'.env'))),url=new URL(env.DATABASE_URL||'');assert.equal(url.protocol,'mysql:','DATABASE_PROTOCOL');assert.equal(decodeURIComponent(url.pathname.slice(1)),contract.database,'DATABASE_TARGET');assert(['localhost','127.0.0.1'].includes(url.hostname),'DATABASE_HOST');return{backend,from,client:new(from('@prisma/client').PrismaClient)({datasources:{db:{url:env.DATABASE_URL}},log:[]})};}
async function auditDatabase(client){const [{name}]=await client.$queryRaw`SELECT DATABASE() AS name`;assert.equal(name,contract.database,'DATABASE_TARGET');const migrations=await client.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;assert.equal(migrations.length,14,'APPLIED_MIGRATION_COUNT');assert(migrations.every(row=>row.finished_at&&!row.rolled_back_at),'UNFINISHED_OR_ROLLED_BACK_MIGRATION');assert.equal(new Set(migrations.map(row=>row.migration_name)).size,14,'DUPLICATE_MIGRATION');assert.deepEqual(migrations.map(row=>row.migration_name).sort(),Object.keys(contract.migrations).sort(),'DATABASE_MIGRATION_SET');for(const row of migrations)assert.equal(row.checksum,contract.migrations[row.migration_name],`DATABASE_CHECKSUM_${row.migration_name}`);return{database:name,appliedCount:14,pending:[],sourceAndDatabaseChecksumsVerified:14};}
async function snapshot(client){
 const counts={};for(const table of TABLES)counts[table]=Number((await client.$queryRawUnsafe('SELECT COUNT(*) AS n FROM `'+table+'`'))[0].n);
 const users=await client.$queryRaw`SELECT id,role,tokenVersion,statut,emailVerifie FROM User ORDER BY id`;
 const grants=await client.$queryRaw`SELECT userId,code,createdAt FROM UserRoleGrant ORDER BY userId,code`;
 return{counts,usersRoleFingerprint:digest(JSON.stringify(users.map(row=>[row.id,row.role,Number(row.tokenVersion),row.statut,Boolean(row.emailVerifie)]))),grantsFingerprint:digest(JSON.stringify(grants.map(row=>[row.userId,row.code,new Date(row.createdAt).toISOString()]))) };
}
function comparePreserved(before,after){assert.deepEqual(after.counts,before.counts,'EXISTING_COUNTS_CHANGED');assert.equal(after.usersRoleFingerprint,before.usersRoleFingerprint,'USER_ROLES_STATUS_OR_SESSIONS_CHANGED');assert.equal(after.grantsFingerprint,before.grantsFingerprint,'DELEGATED_GRANTS_CHANGED');}
async function verifyPriority(connection){
 // Uses only the final compiled listing exports through the read-only proxy.
 const file=path.join(__dirname,'verify-priority-service-readonly.cjs');assert(fs.existsSync(file),'PRIORITY_READONLY_CHECK_REQUIRED');const {verifyPriorityService}=require(file);return verifyPriorityService({...connection,db:readonlyClient(connection.client)});
}
function safeFailure(error){const value=error.safeCheck||error.message?.split('\n')[0];return /^[A-Z][A-Z0-9_]+$/.test(value||'')?value:/^P\d{4}$/.test(error.code||'')?error.code:'READ_ONLY_CHECK_FAILED';}
async function main(opts){let client;try{
 const target=assertTargets(opts.phase);const connection=await connect(opts);client=connection.client;const migrationState=await auditDatabase(client),initial=await snapshot(client);
 let baseline;if(opts.phase!=='before'){baseline=JSON.parse(fs.readFileSync(opts.before,'utf8'));assert.equal(baseline.status,'PASS','BEFORE_NOT_VERIFIED');assert.equal(baseline.phase,'before','BEFORE_PHASE_REQUIRED');assert.equal(baseline.release,contract.release,'BEFORE_RELEASE');assert.equal(baseline.database,contract.database,'BEFORE_DATABASE');comparePreserved(baseline.snapshot,initial);}
 const priority=await verifyPriority(connection);const final=await snapshot(client);comparePreserved(initial,final);if(baseline)comparePreserved(baseline.snapshot,final);
 return{status:'PASS',kind:'no-migration-release-readonly',at:new Date().toISOString(),release:contract.release,phase:opts.phase,currentTarget:target,...migrationState,snapshot:final,priority,preservationComparedToBefore:!!baseline,databaseWrites:0,realRoleChanges:0,realSessionsCreated:0,limitations:['Snapshots are separate reads; legitimate concurrent activity can fail preservation checks and needs review.','No real account/session is created or modified; authenticated home behavior is tested on RAM fixtures.','Counts and role/grant hashes cover the specified fields, not every content byte in the database.']};
}finally{await client?.$disconnect();}}
module.exports={contract,TABLES,options,auditSources,readonlyClient,auditDatabase,snapshot,comparePreserved,safeFailure};
if(require.main===module){let opts;try{opts=options(process.argv.slice(2));}catch{console.error('INVALID_ARGUMENTS');process.exitCode=2;}
 if(opts?.help)console.log('Read-only: node check-database-readonly.cjs --backend /ABS/versions/20260928-priorite-membres-home/nodejs --phase before|candidate|after [--before /ABS/database-before.json]. before/candidate expect old current; after expects new current. No migration command exists in this release.');
 else if(opts)main(opts).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(JSON.stringify({status:'FAIL',check:safeFailure(error),databaseWrites:0}));process.exitCode=1;});}

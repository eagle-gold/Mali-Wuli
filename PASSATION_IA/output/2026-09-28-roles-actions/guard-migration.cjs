#!/usr/bin/env node
'use strict';
// SELECT/file reads ONLY. Fails closed until the exact reviewed SQL is bound in the contract.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{createRequire}=require('node:module');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'migration-contract.json'),'utf8'));
const FRONT='/home/u668963025/domains/mali-wuli.com/hbuilds',BACK='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function options(argv,needsBefore=false){
 const opts={};for(let i=0;i<argv.length;i++){
  if(argv[i]==='--help')opts.help=true;
  else if(['--backend','--env-file','--before'].includes(argv[i])){const key=argv[i],value=argv[++i];assert(value&&path.isAbsolute(value),'ABSOLUTE_PATH_REQUIRED');opts[{'--backend':'backend','--env-file':'envFile','--before':'before'}[key]]=value;}
  else throw Error('INVALID_ARGUMENTS');
 }
 if(!opts.help){assert(opts.backend,'BACKEND_REQUIRED');if(needsBefore)assert(opts.before,'BACKUP_METADATA_REQUIRED');}return opts;
}
function assertContract(){
 assert.equal(contract.status,'READY','MIGRATION_CONTRACT_NOT_READY');assert(sha(contract.migrationSha256),'MIGRATION_SHA_MISSING');assert.equal(Object.keys(contract.historical).length,13,'HISTORICAL_MANIFEST_SIZE');
 assert.equal(contract.release,'20260928-roles-actions','WRONG_RELEASE');assert.equal(contract.migration,'20260928210000_delegated_roles','WRONG_MIGRATION');
}
function assertPreviousTargets(){for(const directory of [FRONT,BACK])assert.equal(fs.readlinkSync(path.join(directory,'current')),`versions/${contract.previousRelease}`,'CURRENT_CHANGED');}
function auditSources(backend){
 assertContract();const expected={...contract.historical,[contract.migration]:contract.migrationSha256};
 const directory=path.join(backend,'prisma/migrations');const actual=fs.readdirSync(directory).filter(name=>fs.statSync(path.join(directory,name)).isDirectory()).sort();
 assert.deepEqual(actual,Object.keys(expected).sort(),'SOURCE_MIGRATION_SET');
 for(const name of actual)assert.equal(digest(fs.readFileSync(path.join(directory,name,'migration.sql'))),expected[name],`SOURCE_CHECKSUM_${name}`);
 return expected;
}
async function connect(opts){
 assertContract();const backend=fs.realpathSync(opts.backend);assert.equal(backend,`${BACK}/versions/${contract.release}/nodejs`,'CANDIDATE_PATH_MISMATCH');auditSources(backend);
 const from=createRequire(path.join(backend,'package.json'));const parsed=from('dotenv').parse(fs.readFileSync(opts.envFile||path.join(backend,'.env')));const url=new URL(parsed.DATABASE_URL||'');
 assert.equal(url.protocol,'mysql:','DATABASE_PROTOCOL');assert.equal(decodeURIComponent(url.pathname.slice(1)),contract.database,'DATABASE_TARGET');assert(['localhost','127.0.0.1'].includes(url.hostname),'DATABASE_HOST');
 return {backend,from,client:new(from('@prisma/client').PrismaClient)({datasources:{db:{url:parsed.DATABASE_URL}},log:[]})};
}
async function auditMigrations(client,backend,after){
 const expected=auditSources(backend);const [{name}]=await client.$queryRaw`SELECT DATABASE() AS name`;assert.equal(name,contract.database,'DATABASE_TARGET');
 const rows=await client.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;
 assert.equal(rows.length,after?14:13,'APPLIED_MIGRATION_COUNT');assert(rows.every(row=>row.finished_at&&!row.rolled_back_at),'UNFINISHED_OR_ROLLED_BACK_MIGRATION');assert.equal(new Set(rows.map(row=>row.migration_name)).size,rows.length,'DUPLICATE_MIGRATION_RECORD');
 for(const row of rows)assert.equal(row.checksum,expected[row.migration_name],`DATABASE_CHECKSUM_${row.migration_name}`);
 const pending=Object.keys(expected).filter(name=>!rows.some(row=>row.migration_name===name));assert.deepEqual(pending,after?[]:[contract.migration],'PENDING_MIGRATION_SET');
 return {database:name,appliedCount:rows.length,pending,historicalChecksumsVerified:13,migrationSha256:contract.migrationSha256};
}
function readBackup(filename){
 const before=JSON.parse(fs.readFileSync(filename,'utf8'));assert.equal(before.database,contract.database,'BACKUP_DATABASE_TARGET');assert.equal(before.gzipIntegrity,true,'BACKUP_GZIP_NOT_VERIFIED');assert(sha(before.sha256)&&sha(before.usersRoleFingerprint),'BACKUP_PROOF_INVALID');
 const expected=`/home/u668963025/private-backups/${contract.release}/before.sql.gz`;assert.equal(before.backup,expected,'BACKUP_PATH');assert(Number.isSafeInteger(before.bytes)&&before.bytes>=1000,'BACKUP_SIZE');assert.equal(fs.statSync(expected).size,before.bytes,'BACKUP_SIZE_CHANGED');assert.equal(digest(fs.readFileSync(expected)),before.sha256,'BACKUP_BYTES_CHANGED');return before;
}
function safeFailure(error){const label=error.safeCheck||error.message?.split('\n')[0];return /^[A-Z][A-Z0-9_]+$/.test(label||'')?label:/^P\d{4}$/.test(error.code||'')?error.code:'READ_ONLY_CHECK_FAILED';}
async function main(opts){let client;try{
 assertContract();assertPreviousTargets();if(opts.before)readBackup(opts.before);
 const connection=await connect(opts);client=connection.client;const migrations=await auditMigrations(client,connection.backend,false);
 const tables=await client.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='UserRoleGrant'`;assert.equal(Number(tables[0].n),0,'NEW_TABLE_ALREADY_PRESENT');
 return {status:'PASS',kind:'delegated-roles-pre-migration-readonly',at:new Date().toISOString(),...migrations,currentTargetsUnchanged:true,newSchemaAbsent:true,backupVerified:!!opts.before,databaseWrites:0};
}finally{await client?.$disconnect();}}
module.exports={contract,digest,sha,options,connect,auditSources,auditMigrations,assertPreviousTargets,readBackup,safeFailure};
if(require.main===module){let opts;try{opts=options(process.argv.slice(2));}catch{console.error('INVALID_ARGUMENTS');process.exitCode=2;}
 if(opts?.help)console.log('SELECT/file reads only: node guard-migration.cjs --backend /ABS/versions/20260928-roles-actions/nodejs [--before /ABS/database-before.json] [--env-file /ABS/.env]. Requires migration-contract.json READY; never runs a migration.');
 else if(opts)main(opts).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(JSON.stringify({status:'FAIL',check:safeFailure(error),databaseWrites:0}));process.exitCode=1;});}

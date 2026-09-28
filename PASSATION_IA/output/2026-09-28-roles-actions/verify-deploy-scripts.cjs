'use strict';
// Local scripts-only verification. Never invokes build, backup, migration, SSH or HTTP.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const dir=__dirname,{contract,digest,auditSources,options}=require('./guard-migration.cjs');
const {readonlyClient}=require('./verify-roles-service-readonly.cjs');
const checks=[];
for(const entry of fs.readdirSync(dir).filter(name=>name.endsWith('.cjs'))){const result=spawnSync(process.execPath,['--check',path.join(dir,entry)],{encoding:'utf8'});assert.equal(result.status,0,entry+': '+result.stderr);}
for(const entry of fs.readdirSync(dir).filter(name=>name.endsWith('.sh'))){const result=spawnSync('/bin/sh',['-n',path.join(dir,entry)],{encoding:'utf8'});assert.equal(result.status,0,entry+': '+result.stderr);}
const python=spawnSync('python3',['-c','import ast,pathlib; ast.parse(pathlib.Path(__import__("sys").argv[1]).read_text())',path.join(dir,'package-sources.py')],{encoding:'utf8'});assert.equal(python.status,0,python.stderr);
checks.push('CJS/shell/Python scripts parse; operational scripts not executed');
assert.equal(contract.status,'READY');assert.equal(Object.keys(contract.historical).length,13);
const stagedSql=path.join(dir,'staging/backend/prisma/migrations',contract.migration,'migration.sql');assert.equal(digest(fs.readFileSync(stagedSql)),contract.migrationSha256);
const sql=fs.readFileSync(stagedSql,'utf8');assert(!/\b(?:INSERT|UPDATE\s+`?User|DELETE\s+FROM|DROP|TRUNCATE|MODIFY\s+COLUMN)\b/i.test(sql));assert(/CREATE TABLE `UserRoleGrant`/.test(sql));
checks.push('SQL exact SHA bound; only additive grant table and foreign key');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mali-wuli-roles-script-'));
try{
 const migrationDir=path.join(tmp,'prisma/migrations');fs.mkdirSync(migrationDir,{recursive:true});
 for(const name of Object.keys(contract.historical)){const target=path.join(migrationDir,name);fs.mkdirSync(target);fs.copyFileSync(path.join(dir,'before/backend/prisma/migrations',name,'migration.sql'),path.join(target,'migration.sql'));}
 const target=path.join(migrationDir,contract.migration);fs.mkdirSync(target);fs.copyFileSync(stagedSql,path.join(target,'migration.sql'));
 assert.equal(Object.keys(auditSources(tmp)).length,14);
 fs.appendFileSync(path.join(target,'migration.sql'),'\n-- unexpected alteration\n');assert.throws(()=>auditSources(tmp),/SOURCE_CHECKSUM/);fs.copyFileSync(stagedSql,path.join(target,'migration.sql'));
 fs.mkdirSync(path.join(migrationDir,'unexpected'));assert.throws(()=>auditSources(tmp),/SOURCE_MIGRATION_SET/);fs.rmdirSync(path.join(migrationDir,'unexpected'));
 fs.unlinkSync(path.join(target,'migration.sql'));fs.rmdirSync(target);assert.throws(()=>auditSources(tmp),/SOURCE_MIGRATION_SET/);
 checks.push('Migration guard accepts exact 14 sources and rejects changed SQL, extra or missing migration');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
let read=0;const proxy=readonlyClient({user:{findMany(){read++;return[]},update(){throw Error('must not reach operation')}}});proxy.user.findMany();assert.equal(read,1);
for(const operation of [()=>proxy.user.update,()=>proxy.user.deleteMany,()=>proxy.$transaction,()=>proxy.$executeRaw,()=>{proxy.user={}}])assert.throws(operation,/READ_ONLY_GUARD/);
assert.throws(()=>options(['--backend','relative/path']),/ABSOLUTE_PATH_REQUIRED/);assert.throws(()=>options(['--backend','/candidate'],true),/BACKUP_METADATA_REQUIRED/);
checks.push('Read-only service proxy rejects writes, transactions and raw statements; argument paths checked');
const result={status:'PASS',checks,migrationSha256:contract.migrationSha256,historicalMigrations:13,nextTotal:14,sshCalls:0,databaseQueries:0,archivesCreated:0,operationalScriptsExecuted:0};
fs.writeFileSync(path.join(dir,'tests-deploy-scripts.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));

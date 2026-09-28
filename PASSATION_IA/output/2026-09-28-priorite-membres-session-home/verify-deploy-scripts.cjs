'use strict';
// Local, disposable fixtures only. Never invokes an operational script or network.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {contract,options,auditSources,readonlyClient,comparePreserved,auditDatabase}=require('./check-database-readonly.cjs');
const {comparePage,verifyDirectory}=require('./verify-priority-service-readonly.cjs');
const dir=__dirname,checks=[];
const active='/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend';

async function main(){
 for(const name of fs.readdirSync(dir).filter(name=>name.endsWith('.cjs'))){const r=spawnSync(process.execPath,['--check',path.join(dir,name)],{encoding:'utf8'});assert.equal(r.status,0,name+': '+r.stderr);}
 for(const name of fs.readdirSync(dir).filter(name=>name.endsWith('.sh'))){const r=spawnSync('/bin/sh',['-n',path.join(dir,name)],{encoding:'utf8'});assert.equal(r.status,0,name+': '+r.stderr);}
 const r=spawnSync('python3',['-c','import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())',path.join(dir,'package-sources.py')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 checks.push('CJS/shell/Python syntax, without executing operational scripts');
 assert.equal(contract.migrationAllowed,false);assert.equal(contract.expectedApplied,14);assert.deepEqual(contract.pending,[]);
 assert.equal(contract.previousRelease,'20260928-roles-actions');assert.equal(contract.previousFrontendBuildId,'FuGDWQkQpcBCevVL404El');
 const old=JSON.parse(fs.readFileSync(path.join(dir,'../2026-09-28-roles-actions/source-manifest.json'),'utf8'));
 assert.equal(Object.keys(old).length,222);assert.equal(contract.schemaSha256,old['backend/prisma/schema.prisma']);
 for(const [name,sha]of Object.entries(contract.migrations))assert.equal(old[`backend/prisma/migrations/${name}/migration.sql`],sha);
 for(const name of ['apply-migration.cjs','guard-migration.cjs','backup-before.cjs'])assert(!fs.existsSync(path.join(dir,name)),'Migration operation must not be inherited');
 checks.push('Contract bound to previous 222-source release, 14 exact migrations and unchanged schema');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mali-wuli-no-migration-'));
 try{
  const migrations=path.join(tmp,'prisma/migrations');fs.mkdirSync(migrations,{recursive:true});
  const schema=path.join(tmp,'prisma/schema.prisma');fs.copyFileSync(path.join(active,'prisma/schema.prisma'),schema);
  for(const name of Object.keys(contract.migrations)){fs.mkdirSync(path.join(migrations,name));fs.copyFileSync(path.join(active,'prisma/migrations',name,'migration.sql'),path.join(migrations,name,'migration.sql'));}
  assert.equal(auditSources(tmp).length,14);
  fs.appendFileSync(schema,'\n// unexpected\n');assert.throws(()=>auditSources(tmp),/SCHEMA_CHANGED/);fs.copyFileSync(path.join(active,'prisma/schema.prisma'),schema);
  const name=Object.keys(contract.migrations).at(-1),sql=path.join(migrations,name,'migration.sql');
  fs.appendFileSync(sql,'\n-- unexpected\n');assert.throws(()=>auditSources(tmp),/SOURCE_CHECKSUM/);fs.copyFileSync(path.join(active,'prisma/migrations',name,'migration.sql'),sql);
  fs.mkdirSync(path.join(migrations,'unexpected'));assert.throws(()=>auditSources(tmp),/SOURCE_MIGRATION_SET/);fs.rmdirSync(path.join(migrations,'unexpected'));
  fs.unlinkSync(sql);fs.rmdirSync(path.dirname(sql));assert.throws(()=>auditSources(tmp),/SOURCE_MIGRATION_SET/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 checks.push('Source guard rejects modified schema/SQL, extra migration and missing migration');
 let reads=0;const proxy=readonlyClient({formation:{groupBy(){reads++;return[];}},user:{findMany(){reads++;return[];},update(){throw Error('must not reach write');}}});
 proxy.user.findMany();proxy.formation.groupBy();assert.equal(reads,2);
 for(const operation of [()=>proxy.user.update,()=>proxy.user.deleteMany,()=>proxy.$transaction,()=>proxy.$queryRaw,()=>proxy.$executeRaw,()=>{proxy.user={};},()=>{proxy.user.findMany=()=>[];}])assert.throws(operation,/READ_ONLY_GUARD/);
 assert.equal(options(['--backend','/candidate','--phase','before']).phase,'before');
 assert.throws(()=>options(['--backend','relative','--phase','before']),/BACKEND_ABSOLUTE_PATH/);
 assert.throws(()=>options(['--backend','/candidate','--phase','candidate']),/BEFORE_ABSOLUTE_PATH/);
 assert.throws(()=>options(['--backend','/candidate','--phase','after','--before','relative']),/BEFORE_ABSOLUTE_PATH/);
 assert.throws(()=>options(['--backend','/candidate','--phase','migration']),/PHASE_REQUIRED/);
 checks.push('Read proxy rejects writes/raw/transactions; candidate/after require absolute before evidence');
 const snapshot={counts:{User:5},usersRoleFingerprint:'a',grantsFingerprint:'b'};comparePreserved(snapshot,structuredClone(snapshot));
 assert.throws(()=>comparePreserved(snapshot,{...snapshot,counts:{User:6}}),/EXISTING_COUNTS_CHANGED/);
 assert.throws(()=>comparePreserved(snapshot,{...snapshot,usersRoleFingerprint:'c'}),/USER_ROLES_STATUS_OR_SESSIONS_CHANGED/);
 assert.throws(()=>comparePreserved(snapshot,{...snapshot,grantsFingerprint:'c'}),/DELEGATED_GRANTS_CHANGED/);
 const rows=Object.entries(contract.migrations).map(([migration_name,checksum])=>({migration_name,checksum,finished_at:new Date(),rolled_back_at:null}));
 const mockDb=entries=>({$queryRaw:async(strings)=>strings[0].includes('DATABASE()')?[{name:contract.database}]:entries});
 assert.equal((await auditDatabase(mockDb(rows))).appliedCount,14);
 await assert.rejects(auditDatabase(mockDb(rows.slice(1))),/APPLIED_MIGRATION_COUNT/);
 await assert.rejects(auditDatabase(mockDb(rows.map((row,i)=>i===0?{...row,finished_at:null}:row))),/UNFINISHED_OR_ROLLED_BACK/);
 await assert.rejects(auditDatabase(mockDb(rows.map((row,i)=>i===0?{...row,checksum:'bad'}:row))),/DATABASE_CHECKSUM/);
 checks.push('Snapshots detect role/grant/count changes; simulated database refuses pending or wrong checksums');
 const counters=new Map([['a',2],['b',1]]);
 assert.deepEqual(comparePage([{id:'a',nbMembres:2},{id:'b',nbMembres:1}],[{id:'a'},{id:'b'}],counters,{withCounts:true}).counts,[2,1]);
 assert.throws(()=>comparePage([{id:'b'},{id:'a'}],[{id:'a'},{id:'b'}],counters),/PRIORITY_PAGE_ORDER/);
 assert.throws(()=>comparePage([{id:'a',nbMembres:3}],[{id:'a'}],counters,{withCounts:true}),/PRIORITY_DISPLAY_COUNT/);
 const model={count:async()=>3,findMany:async args=>{
  const ids=args.where.AND.find(part=>part.id)?.id;
  return ids?.in?[{id:'a'},{id:'b'}]:(args.skip?[]:[{id:'c'}]).slice(0,args.take);
 }};
 const report=await verifyDirectory({db:{association:model},model:'association',where:{valide:true},counters,withCounts:true,load:async({page})=>({rows:page===1?[{id:'a',nbMembres:2},{id:'b',nbMembres:1},{id:'c',nbMembres:0}]:[],total:3,page})});
 assert.equal(report.pages.length,2);assert.equal(report.exercisedDistinctCounts,true);
 checks.push('Priority checker detects wrong order/count and checks empty continuation in RAM');
 const result={status:'PASS',checks,baselineSources:222,expectedAppliedMigrations:14,migrationsAllowed:false,sshCalls:0,databaseQueries:0,httpRequests:0,archivesCreated:0,operationalScriptsExecuted:0};
 fs.writeFileSync(path.join(dir,'tests-deploy-scripts.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

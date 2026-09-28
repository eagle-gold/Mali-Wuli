#!/usr/bin/env node
'use strict';
// Post-migration, before activation: database SELECTs and read-only service checks.
const assert=require('node:assert/strict');
const {contract,options,connect,auditMigrations,assertPreviousTargets,readBackup,safeFailure}=require('./guard-migration.cjs');
const {userRoleFingerprint,verifyService}=require('./verify-roles-service-readonly.cjs');
const TABLES=['User','Profil','Formation','Association','AssociationMembre','Evenement','EvenementParticipant','Offre','OffreEnregistrement','CandidatureOffre','Message','Conversation'];
async function main(opts){let client;try{
 assertPreviousTargets();const before=readBackup(opts.before);assert(TABLES.every(table=>Number.isSafeInteger(before.counts?.[table])&&before.counts[table]>=0),'BACKUP_COUNTS_MISSING');
 const connection=await connect(opts);client=connection.client;const migrations=await auditMigrations(client,connection.backend,true);
 const tables=await client.$queryRaw`SELECT TABLE_NAME AS name,ENGINE AS engine,TABLE_COLLATION AS collationName FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='UserRoleGrant'`;
 assert.equal(tables.length,1,'GRANT_TABLE_MISSING');assert.equal(tables[0].engine,'InnoDB','GRANT_TABLE_ENGINE');assert.equal(tables[0].collationName,'utf8mb4_unicode_ci','GRANT_TABLE_COLLATION');
 const counts={};for(const table of TABLES){counts[table]=Number((await client.$queryRawUnsafe('SELECT COUNT(*) AS n FROM `'+table+'`'))[0].n);assert.equal(counts[table],before.counts[table],`COUNT_UNCHANGED_${table.toUpperCase()}`);}
 assert.equal(await userRoleFingerprint(client),before.usersRoleFingerprint,'USER_ROLE_VALUES_CHANGED');
 assert.equal(await client.userRoleGrant.count(),0,'NEW_GRANTS_EXPECTED_EMPTY');
 const columns=await client.$queryRaw`SELECT COLUMN_NAME AS name,DATA_TYPE AS dataType,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue,CHARACTER_MAXIMUM_LENGTH AS maxLength,DATETIME_PRECISION AS precisionValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='UserRoleGrant'`;
 assert.deepEqual(columns.map(c=>c.name).sort(),[...contract.expectedColumns].sort(),'GRANT_COLUMNS');
 for(const name of ['userId','code']){const c=columns.find(c=>c.name===name);assert(c.dataType==='varchar'&&Number(c.maxLength)===191&&c.nullable==='NO','GRANT_STRING_COLUMN');}
 const date=columns.find(c=>c.name==='createdAt');assert(date.dataType==='datetime'&&Number(date.precisionValue)===3&&date.nullable==='NO','GRANT_CREATED_AT_COLUMN');assert(/^current_timestamp\(3\)$/i.test(String(date.defaultValue).replace(/^'(.*)'$/,'$1')),'GRANT_CREATED_AT_DEFAULT');
 const indexes=await client.$queryRaw`SELECT INDEX_NAME AS name,NON_UNIQUE AS nonUnique,SEQ_IN_INDEX AS sequenceValue,COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='UserRoleGrant'`;
 const fields=name=>indexes.filter(i=>i.name===name).sort((a,b)=>Number(a.sequenceValue)-Number(b.sequenceValue));
 assert.deepEqual(fields('PRIMARY').map(i=>i.columnName),contract.expectedPrimaryKey,'GRANT_PRIMARY_KEY');assert(fields('PRIMARY').every(i=>Number(i.nonUnique)===0),'GRANT_PRIMARY_UNIQUE');
 assert.deepEqual(fields(contract.expectedCodeIndex).map(i=>i.columnName),['code'],'GRANT_CODE_INDEX');assert(fields(contract.expectedCodeIndex).every(i=>Number(i.nonUnique)===1),'GRANT_CODE_INDEX_NONUNIQUE');
 const keys=await client.$queryRaw`SELECT k.CONSTRAINT_NAME AS name,k.COLUMN_NAME AS columnName,k.REFERENCED_TABLE_NAME AS referenceTable,k.REFERENCED_COLUMN_NAME AS referenceColumn,r.DELETE_RULE AS deleteRule,r.UPDATE_RULE AS updateRule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME='UserRoleGrant' AND k.REFERENCED_TABLE_NAME IS NOT NULL`;
 assert.equal(keys.length,1,'GRANT_FOREIGN_KEY_COUNT');const fk=keys[0];assert(fk.name===contract.expectedUserForeignKey&&fk.columnName==='userId'&&fk.referenceTable==='User'&&fk.referenceColumn==='id'&&fk.deleteRule==='CASCADE'&&fk.updateRule==='CASCADE','GRANT_USER_FOREIGN_KEY');
 // Select-only relation checks exercise the generated client, including an empty table.
 await client.user.findMany({take:1,select:{id:true,rolesDelegues:{select:{code:true,createdAt:true}}}});
 await client.userRoleGrant.findMany({take:1,select:{code:true,user:{select:{id:true}}}});
 const service=await verifyService(connection);
 return {status:'PASS',kind:'delegated-roles-post-migration-readonly',at:new Date().toISOString(),...migrations,backupSha256:before.sha256,counts,grants:0,userRolesAndTokenVersionsUnchanged:true,tableColumnsIndexesAndForeignKeyVerified:true,generatedClientRelationsVerified:true,service,databaseWrites:0,realRoleChanges:0,limitations:['Count comparisons may fail on legitimate concurrent activity; investigate rather than weaken assertions.','DDL application is a separate authorized step; these checks never mutate the database.']};
}finally{await client?.$disconnect();}}
let opts;try{opts=options(process.argv.slice(2),true);}catch{console.error('INVALID_ARGUMENTS');process.exitCode=2;}
if(opts?.help)console.log('SELECT-only after migration and before activation: node check-database-readonly.cjs --backend /ABS/versions/20260928-roles-actions/nodejs --before /ABS/database-before.json');
else if(opts)main(opts).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(JSON.stringify({status:'FAIL',check:safeFailure(error),databaseWrites:0}));process.exitCode=1;});

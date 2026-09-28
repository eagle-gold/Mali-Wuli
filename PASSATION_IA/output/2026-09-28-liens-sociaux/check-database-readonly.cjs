#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),g=require('./guard-migration.cjs');
async function main(opts){let client;try{
 const targets=g.assertTargets(opts.phase);const connection=await g.connect(opts);client=connection.client;const after=opts.phase!=='before';if(after)assert(connection.isCandidate,'CANDIDATE_REQUIRED');
 const migrations=await g.auditMigrations(client,after);const profileColumns=await g.columns(client);const before=opts.before?g.readBackup(opts.before):null;g.verifyColumns(profileColumns,after,before?.profileColumns);const state=await g.snapshot(client,after);if(before)g.comparePreserved(before,state);
 if(after)assert(before,'BACKUP_METADATA_REQUIRED');
 return {status:'PASS',kind:'social-links-preservation-readonly',phase:opts.phase,at:new Date().toISOString(),release:g.contract.release,...migrations,targets,profileColumns,...state,preserved:!!before,databaseWrites:0,limitations:['Concurrent legitimate member edits cause a strict failure requiring review; do not overwrite the baseline to hide a difference.']};
 }finally{await client?.$disconnect();}}
if(require.main===module){let opts;try{opts=g.options(process.argv.slice(2));}catch{console.error('INVALID_ARGUMENTS');process.exitCode=2;}if(opts?.help)console.log('SELECT only: --backend /ABS/nodejs --phase before|candidate|after [--before /ABS/database-before.json]; candidate/after require the verified private backup.');else if(opts)main(opts).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(JSON.stringify({status:'FAIL',check:g.safeFailure(e),databaseWrites:0}));process.exitCode=1;});}
module.exports={main};

#!/usr/bin/env node
'use strict';
// Filesystem only. No application imports, environment reads, ORM or requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const c=JSON.parse(fs.readFileSync(path.join(__dirname,'release-contract.json'),'utf8'));
const FRONT='/home/u668963025/domains/mali-wuli.com/hbuilds',BACK='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function run(phase){assert(['before','candidate','candidate-built','after'].includes(phase),'PHASE_REQUIRED');assert.equal(c.release,'20260928-performance');
 assert.equal(sha(path.join(__dirname,'baseline-source-manifest.json')),c.baselineManifestSha256,'BASELINE_MANIFEST_CHANGED');
 const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline-source-manifest.json'),'utf8'));assert.equal(Object.keys(baseline).length,235,'BASELINE_FILES');
 let manifest=baseline,packageContract;if(phase!=='before'){packageContract=JSON.parse(fs.readFileSync(path.join(__dirname,'package-contract.json'),'utf8'));assert.equal(packageContract.release,c.release,'PACKAGE_RELEASE');assert.equal(sha(path.join(__dirname,'source-manifest.json')),packageContract.manifestSha256,'MANIFEST_CHANGED');manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'source-manifest.json'),'utf8'));}
 const targets={frontend:fs.readlinkSync(FRONT+'/current'),backend:fs.readlinkSync(BACK+'/current')};
 assert.equal(targets.frontend,'versions/'+(phase==='after'?c.release:c.previousFrontend),'FRONTEND_CURRENT_DRIFT');assert.equal(targets.backend,'versions/'+(phase==='after'?c.release:c.previousBackend),'BACKEND_CURRENT_DRIFT');
 if(phase!=='after')assert.equal(fs.readFileSync(FRONT+'/current/nodejs/.next/BUILD_ID','utf8').trim(),c.baselineBuildId,'BASELINE_BUILD_DRIFT');
 const roots={frontend:FRONT+'/sources/'+(phase==='before'?c.previousFrontend:c.release),backend:BACK+'/versions/'+(phase==='before'?c.previousBackend:c.release)+'/nodejs'};
 for(const [name,hash]of Object.entries(manifest)){const [part,...rest]=name.split('/');assert(['frontend','backend'].includes(part)&&rest.length&&rest.every(x=>x&&x!=='.'&&x!=='..'),'MANIFEST_PATH');assert.equal(sha(path.join(roots[part],...rest)),hash,'SOURCE_HASH_'+name);}
 let buildId;if(['candidate-built','after'].includes(phase)){const version=FRONT+'/versions/'+c.release+'/nodejs';assert(fs.statSync(version+'/server.js').isFile(),'FRONTEND_SERVER');assert(fs.statSync(roots.backend+'/dist/index.js').isFile(),'BACKEND_SERVER');buildId=fs.readFileSync(version+'/.next/BUILD_ID','utf8').trim();assert(buildId&&buildId!==c.baselineBuildId,'BUILD_ID_INVALID');if(phase==='after')assert.equal(fs.readFileSync(FRONT+'/current/nodejs/.next/BUILD_ID','utf8').trim(),buildId,'CURRENT_BUILD_MISMATCH');}
 return {status:'PASS',kind:'performance-sources-and-targets',at:new Date().toISOString(),phase,release:c.release,targets,buildId,files:Object.keys(manifest).length,manifestSha256:phase==='before'?c.baselineManifestSha256:packageContract.manifestSha256,databaseRequests:0,databaseWrites:0,remoteWrites:0};}
module.exports={run};if(require.main===module){try{console.log(JSON.stringify(run(process.argv[2]),null,2));}catch{console.error(JSON.stringify({status:'FAIL',check:'SOURCE_OR_TARGET_DRIFT',remoteWrites:0}));process.exitCode=1;}}

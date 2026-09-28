'use strict';
// RAM-only tests of the real filesystem guard. No application import or network.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, 'verify-sources-readonly.cjs'), 'utf8');
const root='/home/u668963025/domains/mali-wuli.com/hbuilds';
const back='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const old='20260928-suppressions-droits', next='20260928-home-session-r2', dir='/qa';
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(phase){
 const files=new Map(), links=new Map([[root+'/current','versions/'+(phase==='after'?next:old)],[back+'/current','versions/'+old]]);
 const baseline={}, candidate={};
 for(const [part,count]of[['frontend',127],['backend',103]])for(let i=0;i<count;i++){
  const name=part+'/src/f'+i+'.ts', data='baseline '+name;
  baseline[name]=digest(data); candidate[name]=digest(data);
  if(part==='frontend')for(const release of[old,next])files.set(root+'/sources/'+release+'/src/f'+i+'.ts',data);
  else files.set(back+'/versions/'+old+'/nodejs/src/f'+i+'.ts',data);
 }
 const changed='changed homepage';candidate['frontend/src/f0.ts']=digest(changed);files.set(root+'/sources/'+next+'/src/f0.ts',changed);
 files.set(root+'/current/nodejs/.next/BUILD_ID',phase==='after'?'new-build':'cNI0N04igTlrU9KwyDz4k');
 files.set(root+'/versions/'+next+'/nodejs/.next/BUILD_ID','new-build');files.set(root+'/versions/'+next+'/nodejs/server.js','candidate');
 return {files,links,baseline,candidate,phase};
}
function run(f){
 const b=JSON.stringify(f.baseline), c=JSON.stringify(f.candidate);
 f.files.set(dir+'/baseline-source-manifest.json',b);f.files.set(dir+'/source-manifest.json',c);
 f.files.set(dir+'/release-contract.json',JSON.stringify({release:next,previousFrontend:old,backendRelease:old,frontendOnly:true,migrationAllowed:false,databaseAccess:false,frontendFiles:127,backendFiles:103,baselineBuildId:'cNI0N04igTlrU9KwyDz4k',baselineManifestSha256:digest(b),sourceManifestSha256:digest(c)}));
 const mockFs={readFileSync(p,enc){assert(f.files.has(p),'missing fixture '+p);return enc?f.files.get(p):Buffer.from(f.files.get(p));},readlinkSync(p){assert(f.links.has(p),'missing symlink '+p);return f.links.get(p);},statSync(p){assert(f.files.has(p),'missing stat '+p);return{isFile:()=>true};}};
 let output;
 vm.runInNewContext(source,{require(name){if(name==='node:fs')return mockFs;if(name==='node:path')return path;if(name==='node:crypto')return crypto;if(name==='node:assert/strict')return assert;throw new Error('FORBIDDEN_DEPENDENCY '+name);},process:{argv:['node','guard',f.phase]},__dirname:dir,console:{log(s){output=JSON.parse(s);}},Buffer});
 return output;
}
for(const phase of['before','candidate','candidate-built','after'])test('real guard accepts correct '+phase+' without DB/write APIs',()=>{const r=run(fixture(phase));assert.equal(r.status,'PASS');assert.equal(r.backendFiles,103);assert.equal(r.files,230);assert.equal(r.databaseRequests,0);assert.equal(r.remoteWrites,0);});
test('backend target drift blocks candidate and publication verification',()=>{for(const phase of['candidate-built','after']){const f=fixture(phase);f.links.set(back+'/current','versions/unexpected');assert.throws(()=>run(f),/BACKEND_CURRENT_CHANGED/);}});
test('backend source modification is detected',()=>{const f=fixture('candidate');f.files.set(back+'/versions/'+old+'/nodejs/src/f0.ts','unexpected');assert.throws(()=>run(f),/backend\/src\/f0.ts/);});
test('changing backend manifest cannot bypass backend preservation',()=>{const f=fixture('candidate');f.candidate['backend/src/f0.ts']=digest('unexpected');assert.throws(()=>run(f),/BACKEND_MANIFEST_CHANGED/);});
test('unexpected frontend activation or build ID blocks stale candidate',()=>{const f=fixture('candidate');f.links.set(root+'/current','versions/newer-release');assert.throws(()=>run(f),/FRONTEND_CURRENT_DRIFT/);const g=fixture('before');g.files.set(root+'/current/nodejs/.next/BUILD_ID','wrong');assert.throws(()=>run(g),/BASELINE_BUILD_DRIFT/);});
test('candidate source drift is rejected',()=>{const f=fixture('candidate-built');f.files.set(root+'/sources/'+next+'/src/f0.ts','wrong');assert.throws(()=>run(f),/frontend\/src\/f0.ts/);});
test('after verifies active build matches the verified candidate',()=>{const f=fixture('after');f.files.set(root+'/current/nodejs/.next/BUILD_ID','wrong');assert.throws(()=>run(f),/CURRENT_BUILD_MISMATCH/);});

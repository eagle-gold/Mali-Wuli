'use strict';
// Intentional release activation only. No database writes or migration.
// Keep each old release. Terminate only the process whose exact old cwd matches.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const mode=process.argv[2];assert(['backend','frontend'].includes(mode));
const c=require('./release-contract.json');assert.equal(c.release,'20260928-performance');assert.equal(c.migrationAllowed,false);
const FRONT='/home/u668963025/domains/mali-wuli.com/hbuilds',BACK='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name)));
const source=read('source-candidate.json'),db=read('database-candidate.json'),smoke=read('candidate-smoke.json');
assert.equal(source.status,'PASS');assert.equal(source.release,c.release);assert.equal(db.status,'PASS');assert.equal(db.phase,'candidate');assert.equal(db.release,c.release);assert.equal(db.database,c.database);assert.equal(db.appliedCount,15);assert.equal(db.databaseWrites,0);
assert.equal(smoke.status,'passed');assert.equal(smoke.release,c.release);assert.equal(smoke.buildId,source.buildId);
const root=mode==='backend'?BACK:FRONT,old=`versions/${c.previousRelease}`,next=`versions/${c.release}`;
assert.equal(fs.readlinkSync(root+'/current'),old);
assert.equal(fs.readlinkSync((mode==='backend'?FRONT:BACK)+'/current'),mode==='backend'?old:next);
assert.equal(fs.readFileSync(FRONT+'/versions/'+c.release+'/nodejs/.next/BUILD_ID','utf8').trim(),smoke.buildId);
if(mode==='frontend'){const health=read('backend-health.json');assert.equal(health.status,200);assert.equal(health.sessionAnonymousStatus,401);assert(health.newProcessVerified);}
const oldCwd=fs.realpathSync(root+'/'+old+'/nodejs');
const pids=[];
for(const pid of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))){try {if(fs.readlinkSync('/proc/'+pid+'/cwd')===oldCwd){const cmd=fs.readFileSync('/proc/'+pid+'/cmdline','utf8');if((mode==='backend'&&cmd.includes('dist/index.js'))||(mode==='frontend'&&(cmd.includes('server.js')||cmd.includes('next-server'))))pids.push(Number(pid));}}catch{}}
assert(pids.length<=2,'UNEXPECTED_APP_PROCESS_COUNT');
const temp=root+'/current-performance-next';assert(!fs.existsSync(temp));fs.symlinkSync(next,temp);fs.renameSync(temp,root+'/current');
fs.mkdirSync(root+'/current/nodejs/tmp',{recursive:true});fs.writeFileSync(root+'/current/nodejs/tmp/restart.txt',new Date().toISOString());
const result={status:'ACTIVATED',mode,at:new Date().toISOString(),previous:old,current:next,previousBuildId:c.baselineBuildId,newBuildId:smoke.buildId,terminatedPids:[],databaseWrites:0};
const record=()=>fs.writeFileSync(path.join(__dirname,'activation-'+mode+'.json'),JSON.stringify(result,null,2));record();
for(const pid of pids){assert.equal(fs.readlinkSync('/proc/'+pid+'/cwd'),oldCwd);process.kill(pid,'SIGTERM');result.terminatedPids.push(pid);record();}
console.log(JSON.stringify(result,null,2));

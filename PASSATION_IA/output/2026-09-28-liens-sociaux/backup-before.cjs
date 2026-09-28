#!/usr/bin/env node
'use strict';
// Explicit release step: private file writes, DB reads only. Does not alter application data.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),zlib=require('node:zlib');
const assert=require('node:assert/strict'),{pipeline}=require('node:stream/promises'),{Writable}=require('node:stream'),g=require('./guard-migration.cjs');
let db;
(async()=>{
 g.assertContract();const targets=g.assertTargets();const {client,from,backend}=await g.connect({backend:g.BACK+'/current/nodejs'});db=client;
 const migrations=await g.auditMigrations(db,false);const profileColumns=await g.columns(db);g.verifyColumns(profileColumns,false);const state=await g.snapshot(db);
 const config=from('dotenv').parse(fs.readFileSync(path.join(backend,'.env'))),url=new URL(config.DATABASE_URL),database=decodeURIComponent(url.pathname.slice(1));
 const dir='/home/u668963025/private-backups/'+g.contract.release;fs.mkdirSync(dir,{recursive:true,mode:0o700});assert(!fs.lstatSync(dir).isSymbolicLink(),'PRIVATE_DIRECTORY_SYMLINK');fs.chmodSync(dir,0o700);
 const file=path.join(dir,'before.sql.gz');assert(!fs.existsSync(file),'BACKUP_ALREADY_EXISTS');const output=fs.createWriteStream(file,{flags:'wx',mode:0o600});
 const proc=cp.spawn('mysqldump',['--single-transaction','--quick','--skip-lock-tables','--no-tablespaces','--hex-blob','--default-character-set=utf8mb4','-h',url.hostname,'-P',url.port||'3306','-u',decodeURIComponent(url.username),database],{env:{...process.env,MYSQL_PWD:decodeURIComponent(url.password)},stdio:['ignore','pipe','pipe']});
 let hasWarning=false;proc.stderr.on('data',()=>{hasWarning=true;});const exited=new Promise((resolve,reject)=>{proc.on('error',()=>reject(Error('DUMP_PROCESS_ERROR')));proc.on('close',code=>code===0?resolve():reject(Error('DUMP_FAILED')));});
 await Promise.all([pipeline(proc.stdout,zlib.createGzip(),output),exited]);const bytes=fs.statSync(file).size;assert(bytes>=1000,'BACKUP_TOO_SMALL');
 let uncompressedBytes=0;await pipeline(fs.createReadStream(file),zlib.createGunzip(),new Writable({write(chunk,_encoding,callback){uncompressedBytes+=chunk.length;callback();}}));
 const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);
 const endState=await g.snapshot(db);g.comparePreserved(state,endState);g.assertTargets();
 const record={status:'PASS',release:g.contract.release,at:new Date().toISOString(),database,targets,migrations,profileColumns,...state,backup:file,bytes,uncompressedBytes,gzipIntegrity:true,sha256:hash.digest('hex'),warning:hasWarning?'mysqldump emitted warnings; details suppressed to protect configuration':null,databaseWrites:0,limitations:['Before/after fingerprints reject observed concurrent writes but do not prove the exact dump transaction snapshot.','Gzip integrity is verified; this is not a restoration rehearsal.']};
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(record,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify(record,null,2));
})().catch(e=>{console.error(JSON.stringify({status:'FAIL',check:g.safeFailure(e),databaseWrites:0}));process.exitCode=1;}).finally(()=>db?.$disconnect());

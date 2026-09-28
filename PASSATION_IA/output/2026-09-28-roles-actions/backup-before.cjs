'use strict';
// Reads production DB and writes a private compressed dump; no application/DB mutation.
// Execute only as an explicit release step. Never prints credentials or user rows.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {createRequire}=require('node:module'),{pipeline}=require('node:stream/promises'),{Writable}=require('node:stream');
const FRONT='/home/u668963025/domains/mali-wuli.com/hbuilds';
const BACK='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const EXPECTED='versions/20260928-fond-mobile-roles';
const root=path.join(BACK,'current/nodejs'),from=createRequire(path.join(root,'package.json'));
const TABLES=['User','Profil','Formation','Association','AssociationMembre','Evenement','EvenementParticipant','Offre','OffreEnregistrement','CandidatureOffre','Message','Conversation'];
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let db;
(async()=>{
 for(const directory of [FRONT,BACK])if(fs.readlinkSync(path.join(directory,'current'))!==EXPECTED)throw Error('CURRENT_CHANGED');
 const config=from('dotenv').parse(fs.readFileSync(path.join(root,'.env')));const url=new URL(config.DATABASE_URL||'');
 const database=decodeURIComponent(url.pathname.slice(1));
 if(url.protocol!=='mysql:'||database!=='u668963025_maliwuli'||!['localhost','127.0.0.1'].includes(url.hostname))throw Error('WRONG_DATABASE');
 db=new(from('@prisma/client').PrismaClient)({datasources:{db:{url:config.DATABASE_URL}},log:[]});
 const [{name}]=await db.$queryRaw`SELECT DATABASE() AS name`;if(name!==database)throw Error('WRONG_DATABASE');
 const newTable=await db.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='UserRoleGrant'`;if(Number(newTable[0].n)!==0)throw Error('NEW_TABLE_ALREADY_PRESENT');
 const counts={};for(const table of TABLES)counts[table]=Number((await db.$queryRawUnsafe('SELECT COUNT(*) AS n FROM `'+table+'`'))[0].n);
 const users=await db.$queryRaw`SELECT id,role,tokenVersion,statut,emailVerifie FROM User ORDER BY id`;
 const usersRoleFingerprint=digest(JSON.stringify(users.map(row=>[row.id,row.role,Number(row.tokenVersion),row.statut,Boolean(row.emailVerifie)])));
 const dir='/home/u668963025/private-backups/20260928-roles-actions';fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.chmodSync(dir,0o700);
 const file=path.join(dir,'before.sql.gz');if(fs.existsSync(file))throw Error('BACKUP_ALREADY_EXISTS');
 const output=fs.createWriteStream(file,{flags:'wx',mode:0o600});
 const proc=cp.spawn('mysqldump',['--single-transaction','--quick','--skip-lock-tables','--no-tablespaces','--hex-blob','--default-character-set=utf8mb4','-h',url.hostname,'-P',url.port||'3306','-u',decodeURIComponent(url.username),database],{env:{...process.env,MYSQL_PWD:decodeURIComponent(url.password)},stdio:['ignore','pipe','pipe']});
 let hasWarning=false;proc.stderr.on('data',()=>{hasWarning=true;});
 const exited=new Promise((resolve,reject)=>{proc.on('error',()=>reject(Error('DUMP_PROCESS_ERROR')));proc.on('close',code=>code===0?resolve():reject(Error('DUMP_FAILED')));});
 await Promise.all([pipeline(proc.stdout,zlib.createGzip(),output),exited]);
 const bytes=fs.statSync(file).size;if(bytes<1000)throw Error('BACKUP_TOO_SMALL');
 let uncompressedBytes=0;await pipeline(fs.createReadStream(file),zlib.createGunzip(),new Writable({write(chunk,_encoding,callback){uncompressedBytes+=chunk.length;callback();}}));
 const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);
 const record={at:new Date().toISOString(),database,backup:file,bytes,uncompressedBytes,gzipIntegrity:true,sha256:hash.digest('hex'),counts,usersRoleFingerprint,warning:hasWarning?'mysqldump returned warnings; details suppressed to protect configuration':null,databaseWrites:0,limitations:['Counts/fingerprint and dump are separate read snapshots; concurrent live writes require review.','Gzip integrity is checked; this is not a restoration rehearsal.']};
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(record,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(record,null,2));
})().catch(error=>{const check=/^[A-Z][A-Z0-9_]+$/.test(error.message||'')?error.message:'BACKUP_FAILED';console.error(JSON.stringify({status:'FAIL',check,databaseWrites:0}));process.exitCode=1;}).finally(()=>db?.$disconnect());

'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {pipeline}=require('node:stream/promises');
const root='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/current/nodejs';
require(path.join(root,'node_modules/dotenv')).config({path:path.join(root,'.env')});
const {PrismaClient}=require(path.join(root,'node_modules/@prisma/client'));const db=new PrismaClient();
(async()=>{
 const url=new URL(process.env.DATABASE_URL); const name=decodeURIComponent(url.pathname.slice(1));
 if(name!=='u668963025_maliwuli')throw new Error('WRONG_DATABASE');
 const dir='/home/u668963025/private-backups/20260928-evenements-photos';fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.chmodSync(dir,0o700);
 const file=path.join(dir,'before.sql.gz');if(fs.existsSync(file))throw new Error('BACKUP_ALREADY_EXISTS');
 const counts={};for(const table of ['User','Profil','Formation','Association','AssociationMembre','Evenement','EvenementParticipant']){const row=await db.$queryRawUnsafe('SELECT COUNT(*) AS n FROM `'+table+'`');counts[table]=Number(row[0].n)}
 const output=fs.createWriteStream(file,{flags:'wx',mode:0o600});
 const proc=cp.spawn('mysqldump',['--single-transaction','--quick','--skip-lock-tables','--no-tablespaces','--hex-blob','--default-character-set=utf8mb4','-h',url.hostname,'-P',url.port||'3306','-u',decodeURIComponent(url.username),name],{env:{...process.env,MYSQL_PWD:decodeURIComponent(url.password)},stdio:['ignore','pipe','pipe']});
 let stderr='';proc.stderr.on('data',d=>{stderr+=d.toString()});
 const exited=new Promise((resolve,reject)=>{proc.on('error',()=>reject(new Error('DUMP_PROCESS_ERROR')));proc.on('close',code=>code===0?resolve():reject(new Error('DUMP_FAILED_'+code)))});
 await Promise.all([pipeline(proc.stdout,zlib.createGzip(),output),exited]);
 const data=fs.readFileSync(file);if(data.length<1000)throw new Error('BACKUP_TOO_SMALL');
 const record={at:new Date().toISOString(),database:name,backup:file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),counts,warning:stderr?'mysqldump returned warnings (not logged to avoid secret exposure)':null};
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(record,null,2),{mode:0o600});console.log(JSON.stringify(record,null,2));
})().catch(e=>{console.error(JSON.stringify({error:e.message?.startsWith('BACKUP_')||e.message?.startsWith('DUMP_')||e.message==='WRONG_DATABASE'?e.message:'BACKUP_FAILED',code:e.code||null}));process.exitCode=1}).finally(()=>db.$disconnect());

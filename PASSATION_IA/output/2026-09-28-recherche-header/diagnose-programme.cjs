const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/versions/20260928-evenements-photos/nodejs';
const config=require(path.join(root,'node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'.env')));
const {PrismaClient}=require(path.join(root,'node_modules/@prisma/client'));const p=new PrismaClient({datasources:{db:{url:config.DATABASE_URL}}});
(async()=>{const [db]=await p.$queryRaw`SELECT DATABASE() AS db, VERSION() AS version`;assert.equal(db.db,'u668963025_maliwuli');const columns=await p.$queryRaw`SELECT COLUMN_NAME,DATA_TYPE,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Evenement'`;const create=await p.$queryRawUnsafe('SHOW CREATE TABLE `Evenement`'); console.log(JSON.stringify({db,columns,create},null,2));})().catch(e=>{console.error(e.code||e.name);process.exitCode=1}).finally(()=>p.$disconnect());

'use strict';
// SELECT uniquement. Aucune donnée personnelle ni secret dans le rapport.
const path = require('node:path');
const {createRequire}=require('node:module');
async function main(){
 const base='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/current/nodejs';
 const from=createRequire(path.join(base,'package.json'));
 from('dotenv').config({path:path.join(base,'.env')});
 const u=new URL(process.env.DATABASE_URL);if(u.protocol!=='mysql:'||u.pathname!=='/u668963025_maliwuli'||!['localhost','127.0.0.1'].includes(u.hostname))throw Error('TARGET');
 const db=new (from('@prisma/client').PrismaClient)();
 try {
 const principal=await db.user.findUnique({where:{email:'ik736764@gmail.com'},select:{role:true,statut:true,emailVerifie:true}});
 const groups=await db.user.groupBy({by:['role'],_count:{_all:true}});
 const admins=await db.user.count({where:{role:'ADMIN'}});
 const [actual]=await db.$queryRaw`SELECT DATABASE() AS name`;
 if(actual.name!=='u668963025_maliwuli')throw Error('TARGET');
 console.log(JSON.stringify({at:new Date().toISOString(),database:actual.name,databaseWrites:0,principalFound:!!principal,principal:principal||null,roles:groups.map(g=>({role:g.role,count:g._count._all})),otherAdmins:admins-(principal?.role==='ADMIN'?1:0)},null,2));
 } finally {await db.$disconnect();}
}
main().catch(()=>{console.error('ROLE_AUDIT_FAILED');process.exitCode=1;});

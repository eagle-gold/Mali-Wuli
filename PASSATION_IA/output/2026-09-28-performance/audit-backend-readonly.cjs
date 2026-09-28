'use strict';
// READ ONLY. Run from the current backend, via stdin. Only aggregate metrics are printed.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
require(path.join(process.cwd(),'node_modules/dotenv')).config({path:path.join(process.cwd(),'.env')});
const {PrismaClient}=require(path.join(process.cwd(),'node_modules/@prisma/client'));
const url=new URL(process.env.DATABASE_URL);assert.equal(url.pathname,'/u668963025_maliwuli');
const db=new PrismaClient({log:[{emit:'event',level:'query'}]});
db.$use(async(p,next)=>{assert(['findUnique','findFirst','findMany','count','aggregate','groupBy'].includes(p.action),'NON_READ_OPERATION:'+p.action);return next(p);});
global.prismaMaliWuli=db;
let queries=[];
db.$on('query',e=>queries.push({durationMs:e.duration,sqlDistinct:/\bDISTINCT\b/i.test(e.query),sqlGroupBy:/\bGROUP BY\b/i.test(e.query),sqlLimit:/\bLIMIT\b/i.test(e.query)}));
const results=[];
async function measure(label,run){queries=[];const before=performance.now();const value=await run();results.push({label,wallMs:Math.round((performance.now()-before)*10)/10,rows:Array.isArray(value)?value.length:undefined,responseBytes:Buffer.byteLength(JSON.stringify(value)),queries:[...queries]});return value;}
(async()=>{
 const backend='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
 const current=fs.readlinkSync(backend+'/current');assert.equal(current,'versions/20260928-liens-sociaux');
 const valid=await measure('catalogue.valid.count',()=>db.etablissement.count({where:{valide:true}}));
 for(const pays of [undefined,'ML']){
  const where={valide:true,...(pays?{paysCode:pays}:{})};const scope=pays||'global';
  if(!pays){
   await measure('countries.distinct.existing',()=>db.etablissement.findMany({where,distinct:['paysCode'],select:{paysCode:true,pays:{select:{nom:true}}},orderBy:{paysCode:'asc'}}));
   await measure('countries.groupby.proposed',()=>db.etablissement.groupBy({by:['paysCode'],where,orderBy:{paysCode:'asc'}}));
  }
  await measure('cities.'+scope+'.distinct.existing',()=>db.etablissement.findMany({where:{...where,ville:{not:null}},distinct:['villeNormalisee'],select:{ville:true},orderBy:{ville:'asc'}}));
  await measure('cities.'+scope+'.groupby.proposed',()=>db.etablissement.groupBy({by:['villeNormalisee'],where:{...where,ville:{not:null}},_min:{ville:true},orderBy:{_min:{ville:'asc'}}}));
 }
 const actor=await db.user.findFirst({where:{statut:'VALIDE',emailVerifie:true},select:{id:true}});
 if(actor){
  await measure('auth.fresh-db-check',()=>db.user.findUnique({where:{id:actor.id},select:{id:true,role:true,rolesDelegues:{select:{code:true}},email:true,statut:true,emailVerifie:true,tokenVersion:true}}));
  // Load the actual profile reader, preventing the upload module's mkdir side effect.
  const filename=path.join(process.cwd(),'dist/routes/user.routes.js');const originalLoad=Module._load;
  Module._load=function(request,parent,isMain){if(request==='../middlewares/upload.middleware')return{uploadAvatar:{single:()=>()=>{}},uploadCouverture:{single:()=>()=>{}},verifierImageChargee:()=>{},supprimerUpload:()=>{throw Error('WRITE_FORBIDDEN')}};return originalLoad.call(this,request,parent,isMain);};
  let compiled;
  try{compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=Module._nodeModulePaths(path.dirname(filename));compiled._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.perfLireProfilComplet=lireProfilComplet;\n',filename);}finally{Module._load=originalLoad;}
  await measure('users.me.actual-complete-reader',()=>compiled.exports.perfLireProfilComplet(actor.id));
  await measure('users.me.session.proposed-query',()=>db.user.findUnique({where:{id:actor.id},select:{id:true,prenom:true,nom:true,email:true,role:true,rolesDelegues:{select:{code:true}},tokenVersion:true,statut:true,profil:{select:{id:true,photo:true,onboardingEtape:true,onboardingFini:true,pays:true,ville:true,titre:true}}}}));
 }
 console.log(JSON.stringify({status:'PASS',at:new Date().toISOString(),current,validEstablishments:valid,connectionLimit:url.searchParams.get('connection_limit')||'default',results,databaseWrites:0,realSessionsCreated:0,privateValuesPrinted:false,limitations:['One read per query shape; warm cache and concurrent load affect absolute times.','Metrics contain no profile identity or URLs; response sizes are measured in memory.','Proposed groupBy payload includes grouping keys, unlike final API serialization.']},null,2));
})().catch(e=>{console.error(e.code||e.name,e.message?.replace(/mysql:\/\/[^\s]+/g,'[REDACTED]'));process.exitCode=1;}).finally(()=>db.$disconnect());

'use strict';
// Called only with a delegate-only read proxy; no HTTP, sessions or writes.
const path=require('node:path'),assert=require('node:assert/strict');
const ELIGIBLE={onboardingFini:true,user:{statut:'VALIDE'}};
const ORDER=[{nom:'asc'},{id:'asc'}];
const LIMIT=12;

function comparePage(actual,expected,counters,{withCounts=false}={}){
 assert.deepEqual(actual.map(row=>row.id),expected.map(row=>row.id),'PRIORITY_PAGE_ORDER');
 assert.equal(new Set(actual.map(row=>row.id)).size,actual.length,'PRIORITY_PAGE_DUPLICATES');
 const counts=actual.map(row=>counters.get(row.id)||0);
 assert(counts.every((count,index)=>index===0||counts[index-1]>=count),'PRIORITY_COUNTS_NOT_DESCENDING');
 if(withCounts)actual.forEach((row,index)=>assert.equal(row.nbMembres,counts[index],'PRIORITY_DISPLAY_COUNT'));
 return {rows:actual.length,counts};
}
async function verifyDirectory({db,model,where,counters,load,withCounts=false}){
 const total=await db[model].count({where});
 // Only populated structures are read in full. Empty structures stay paginated.
 const ids=[...counters.keys()];
 const alpha=ids.length?await db[model].findMany({where:{AND:[where,{id:{in:ids}}]},select:{id:true},orderBy:ORDER}):[];
 const ranks=new Map(alpha.map((row,index)=>[row.id,index]));
 const ranked=[...alpha].sort((a,b)=>(counters.get(b.id)-counters.get(a.id))||(ranks.get(a.id)-ranks.get(b.id)));
 const pages=[...new Set([1,2,Math.floor(ranked.length/LIMIT)+1])].sort((a,b)=>a-b);
 const reports=[];
 for(const page of pages){
  const skip=(page-1)*LIMIT;
  const populated=ranked.slice(skip,skip+LIMIT);
  const zeros=populated.length<LIMIT?await db[model].findMany({
   where:{AND:[where,...(ids.length?[{id:{notIn:ids}}]:[])]},select:{id:true},orderBy:ORDER,
   skip:Math.max(0,skip-ranked.length),take:LIMIT-populated.length,
  }):[];
  const actual=await load({page,limite:LIMIT});
  assert.equal(actual.total,total,'PRIORITY_TOTAL');
  assert.equal(actual.page,page,'PRIORITY_PAGE');
  const checked=comparePage(actual.rows,[...populated,...zeros],counters,{withCounts});
  reports.push({page,...checked});
 }
 return {total,populatedStructures:ranked.length,emptyStructures:total-ranked.length,pages:reports,
  exercisedNonEmptyOrder:ranked.length>1,exercisedDistinctCounts:new Set(counters.values()).size>1};
}
async function verifyPriorityService({backend,db}){
 const {listerPageEtablissementsParMembres}=require(path.join(backend,'dist/services/priorite-membres.service.js'));
 const {creerServiceAssociations}=require(path.join(backend,'dist/services/association.service.js'));
 assert.equal(typeof listerPageEtablissementsParMembres,'function','PRIORITY_HELPER_EXPORT');
 assert.equal(typeof creerServiceAssociations,'function','ASSOCIATION_SERVICE_EXPORT');
 const where={valide:true};
 const groups=await db.formation.groupBy({by:['etablissementId','profilId'],where:{etablissement:where,profil:ELIGIBLE}});
 const schools=new Map();for(const row of groups)if(row.etablissementId)schools.set(row.etablissementId,(schools.get(row.etablissementId)||0)+1);
 const etablissements=await verifyDirectory({db,model:'etablissement',where,counters:schools,load:async pagination=>({
  rows:await listerPageEtablissementsParMembres(db,where,pagination),total:await db.etablissement.count({where}),page:pagination.page,
 })});
 // Existing identity is used in process only to format its public list. No JWT,
 // login, role change or HTTP request is created; its id is never printed.
 const profile=await db.profil.findFirst({where:ELIGIBLE,select:{id:true},orderBy:{id:'asc'}});
 let associations;
 if(profile){
  const affiliations=await db.associationMembre.groupBy({by:['associationId'],where:{association:where,statut:'VERIFIE',profil:ELIGIBLE},_count:{profilId:true}});
  const counters=new Map(affiliations.map(row=>[row.associationId,row._count.profilId]));
  const service=creerServiceAssociations(db),actor={profilId:profile.id,gestionnaireGlobal:false,administrateurPrincipal:false};
  associations=await verifyDirectory({db,model:'association',where,counters,withCounts:true,load:async pagination=>{
   const result=await service.liste(pagination,actor);return {rows:result.associations,total:result.total,page:result.page};
  }});
 }else associations={skipped:'NO_EXISTING_ELIGIBLE_PROFILE',exercisedNonEmptyOrder:false};
 return {status:'PASS',eligibility:{onboardingFini:true,userStatut:'VALIDE',associationAffiliation:'VERIFIE'},etablissements,associations,
  databaseWrites:0,realSessionsCreated:0,limitations:['Unfiltered public listings only; country/search/filter combinations have separate RAM tests.','Counts are separate reads: concurrent profile or affiliation changes can fail this check.','Empty or tied data cannot prove every ranking case; exercised flags report actual coverage.']};
}
module.exports={comparePage,verifyDirectory,verifyPriorityService};

require('dotenv').config();
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
const q=(s)=>p.$queryRawUnsafe(s);
const conv=(v)=>JSON.parse(JSON.stringify(v,(k,x)=>typeof x==='bigint'?Number(x):x));
const fiches=conv(await q(`SELECT e.id,e.nom,e.nomNormalise,e.sigle,e.type,e.statut,e.systemeEducatifCode,e.ville,e.villeNormalisee,CAST(e.latitude AS CHAR) lat,CAST(e.longitude AS CHAR) lng,e.siteWeb,e.description IS NOT NULL hasDesc,e.createdAt,e.updatedAt
 FROM Etablissement e JOIN (SELECT nomNormalise n, villeNormalisee v FROM Etablissement WHERE paysCode='ML' AND valide=1 GROUP BY nomNormalise, villeNormalisee HAVING COUNT(*)>1) g ON g.n=e.nomNormalise AND g.v=e.villeNormalisee
 WHERE e.paysCode='ML' AND e.valide=1`));
const ids=fiches.map(f=>f.id);const inList="('"+ids.map(i=>i.replace(/'/g,"''")).join("','")+"')";
const src=conv(await q(`SELECT es.etablissementId id, s.code, s.priorite, es.identifiantExterne ext, es.confiance FROM EtablissementSource es JOIN SourceEducative s ON s.id=es.sourceId WHERE es.etablissementId IN ${inList}`));
const niv=conv(await q(`SELECT etablissementId id, niveau FROM EtablissementNiveau WHERE etablissementId IN ${inList}`));
const ali=conv(await q(`SELECT etablissementId id, nom FROM EtablissementAlias WHERE etablissementId IN ${inList}`));
const cnt=async(t)=>conv(await q(`SELECT etablissementId id, COUNT(*) n FROM ${t} WHERE etablissementId IN ${inList} GROUP BY etablissementId`));
const form=await cnt('Formation'),avis=await cnt('AvisEtablissement'),prog=await cnt('EtablissementProgramme');
const forum=conv(await q(`SELECT id, etablissementId FROM ForumQuestion WHERE etablissementId IN ${inList}`));
const sugg=conv(await q(`SELECT id,type,statut,candidatId,canoniqueId,contexteCle,CAST(contexte AS CHAR) contexte FROM SuggestionCatalogue`));
const set=new Set(ids);
const suggRefs=[];for(const s of sugg){for(const id of ids){const where=[];if(s.candidatId===id)where.push('candidatId');if(s.canoniqueId===id)where.push('canoniqueId');if((s.contexte||'').includes(id))where.push('contexte');if((s.contexteCle||'').includes(id))where.push('contexteCle');if(where.length)suggRefs.push({suggestionId:s.id,etablissementId:id,champs:where});}}
const profs=conv(await q(`SELECT id, CAST(onboardingDonnees AS CHAR) d FROM Profil WHERE onboardingDonnees IS NOT NULL`));
const profRefs=[];for(const pr of profs){for(const id of ids){if(pr.d.includes(id)){const paths=[];const walk=(o,path)=>{if(o===id)paths.push(path);else if(o&&typeof o==='object')for(const k of Object.keys(o))walk(o[k],path+'.'+k)};walk(JSON.parse(pr.d),'$');profRefs.push({profilId:pr.id,etablissementId:id,chemins:paths});}}}
const allSuggIds=sugg.map(s=>({id:s.id,type:s.type,statut:s.statut,candidatId:s.candidatId,canoniqueId:s.canoniqueId}));
console.log(JSON.stringify({extraitLe:new Date().toISOString(),fiches,src,niv,ali,form,avis,prog,forum,suggRefs,profRefs,allSuggIds}));
await p.$disconnect();})().catch(e=>{console.error(e.message);process.exit(1)});

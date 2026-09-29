// Extraction en LECTURE SEULE (SELECT uniquement) pour le plan « cycles ».
// Périmètre : toutes les fiches Etablissement paysCode='ML' AND valide=1.
// Exécution : ssh … 'cd <backend> && node -' < extract-cycles.js > extract-cycles.json
require('dotenv').config();
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
const q=(s,...a)=>p.$queryRawUnsafe(s,...a);
const conv=(v)=>JSON.parse(JSON.stringify(v,(k,x)=>typeof x==='bigint'?Number(x):x));
const extraitLe=new Date().toISOString();
const fiches=conv(await q(`SELECT e.id,e.nom,e.nomNormalise,e.sigle,e.type,e.statut,e.systemeEducatifCode,e.ville,e.villeNormalisee,CAST(e.latitude AS CHAR) lat,CAST(e.longitude AS CHAR) lng,e.siteWeb,e.createdAt,e.updatedAt
 FROM Etablissement e WHERE e.paysCode='ML' AND e.valide=1`));
const srcBrutes=await q(`SELECT es.etablissementId id, s.code, s.priorite, es.identifiantExterne ext, CAST(es.donneesBrutes AS CHAR) d
 FROM EtablissementSource es JOIN SourceEducative s ON s.id=es.sourceId JOIN Etablissement e ON e.id=es.etablissementId
 WHERE e.paysCode='ML' AND e.valide=1`);
const src=srcBrutes.map(x=>{let d={};try{d=JSON.parse(x.d||'{}')||{}}catch{};const a=d.administration||{};return {
  id:x.id,code:x.code,priorite:Number(x.priorite),ext:x.ext,
  codes:d.codesOfficiels||(d.codeCps?[d.codeCps]:d.codeEtablissement?[d.codeEtablissement]:[]),
  clusters:d.codesCluster||(d.codeCluster?[d.codeCluster]:[]),
  cycle:d.cycle||null,
  communePcode:d.codeCommune||d.communePcode||null,cerclePcode:d.codeCercle||d.cerclePcode||null,
  region:d.region||a.region||null,cercle:d.cercle||a.cercle||null,commune:d.commune||a.commune||null,localite:d.localite||a.localite||null,
  enseignement:d.typeEnseignement||null,amenity:d.amenity||null,statut:d.statut||d.operatorType||null}});
const niv=conv(await q(`SELECT n.etablissementId id, n.niveau FROM EtablissementNiveau n JOIN Etablissement e ON e.id=n.etablissementId WHERE e.paysCode='ML' AND e.valide=1`));
const ali=conv(await q(`SELECT a.etablissementId id, a.nom FROM EtablissementAlias a JOIN Etablissement e ON e.id=a.etablissementId WHERE e.paysCode='ML' AND e.valide=1`));
const cnt=async(t)=>conv(await q(`SELECT x.etablissementId id, COUNT(*) n FROM ${t} x JOIN Etablissement e ON e.id=x.etablissementId WHERE e.paysCode='ML' AND e.valide=1 GROUP BY x.etablissementId`));
const form=await cnt('Formation'),avis=await cnt('AvisEtablissement'),prog=await cnt('EtablissementProgramme');
const forum=conv(await q(`SELECT f.id, f.etablissementId FROM ForumQuestion f JOIN Etablissement e ON e.id=f.etablissementId WHERE e.paysCode='ML' AND e.valide=1`));
const ids=new Set(fiches.map(f=>f.id));
const sugg=conv(await q(`SELECT id,type,statut,candidatId,canoniqueId,contexteCle,CAST(contexte AS CHAR) contexte FROM SuggestionCatalogue`));
const suggRefs=[];for(const s of sugg){const texte=`${s.candidatId||''} ${s.canoniqueId||''} ${s.contexteCle||''} ${s.contexte||''}`;for(const m of new Set(texte.match(/[A-Za-z0-9_-]{6,}/g)||[])){if(!ids.has(m))continue;const where=[];if(s.candidatId===m)where.push('candidatId');if(s.canoniqueId===m)where.push('canoniqueId');if((s.contexte||'').includes(m))where.push('contexte');if((s.contexteCle||'').includes(m))where.push('contexteCle');suggRefs.push({suggestionId:s.id,etablissementId:m,champs:where});}}
const profs=conv(await q(`SELECT id, CAST(onboardingDonnees AS CHAR) d FROM Profil WHERE onboardingDonnees IS NOT NULL`));
const profRefs=[];for(const pr of profs){let o;try{o=JSON.parse(pr.d)}catch{continue}const trouves={};const walk=(v,path)=>{if(typeof v==='string'){if(ids.has(v))(trouves[v]=trouves[v]||[]).push(path)}else if(v&&typeof v==='object')for(const k of Object.keys(v))walk(v[k],path+'.'+k)};walk(o,'$');
  for(const m of new Set(pr.d.match(/[A-Za-z0-9_-]{6,}/g)||[]))if(ids.has(m)&&!trouves[m])trouves[m]=[];
  for(const [id,chemins] of Object.entries(trouves))profRefs.push({profilId:pr.id,etablissementId:id,chemins});}
console.log(JSON.stringify({extraitLe,fiches,src,niv,ali,form,avis,prog,forum,suggRefs,profRefs,totalSuggestions:sugg.length,totalProfilsSnapshot:profs.length}));
await p.$disconnect();})().catch(e=>{console.error(e.message);process.exit(1)});

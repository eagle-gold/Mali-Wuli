// Extraction en LECTURE SEULE (SELECT uniquement) pour le plan « villes Mali ».
// Périmètre : Etablissement paysCode='ML' AND valide=1, + sources, alias, nb formations.
// Exécution : ssh … 'cd <backend> && node -' < extract-villes.js > extract-villes.json
require('dotenv').config();
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
const q=(s)=>p.$queryRawUnsafe(s);
const conv=(v)=>JSON.parse(JSON.stringify(v,(k,x)=>typeof x==='bigint'?Number(x):x));
const extraitLe=new Date().toISOString();
const fiches=conv(await q(`SELECT e.id,e.nom,e.type,e.statut,e.ville,e.villeNormalisee,CAST(e.latitude AS CHAR) lat,CAST(e.longitude AS CHAR) lng FROM Etablissement e WHERE e.paysCode='ML' AND e.valide=1`));
const brutes=await q(`SELECT es.etablissementId id, s.code, es.identifiantExterne ext, CAST(es.donneesBrutes AS CHAR) d FROM EtablissementSource es JOIN SourceEducative s ON s.id=es.sourceId JOIN Etablissement e ON e.id=es.etablissementId WHERE e.paysCode='ML' AND e.valide=1`);
const src=brutes.map(x=>{let d={};try{d=JSON.parse(x.d||'{}')||{}}catch{};const a=d.administration||{};const ad=(d.adresse&&typeof d.adresse==='object')?d.adresse:{};return {
 id:x.id,code:x.code,ext:x.ext,
 region:d.region||a.region||null,regionPcode:d.regionPcode||d.codeRegion||null,
 cercle:d.cercle||a.cercle||null,cerclePcode:d.cerclePcode||d.codeCercle||null,
 commune:d.commune||a.commune||null,communePcode:d.communePcode||d.codeCommune||null,
 localite:d.localite||a.localite||null,cap:d.cap||null,ae:d.ae||null,villeSource:d.villeSource||null,
 locality:ad.locality||null,adresse:typeof d.adresse==='string'?d.adresse:(ad.freeform||d.address||null),
 lat:d.latitude??d.centroide?.latitude??null,lng:d.longitude??d.centroide?.longitude??null}});
const form=conv(await q(`SELECT x.etablissementId id, COUNT(*) n FROM Formation x JOIN Etablissement e ON e.id=x.etablissementId WHERE e.paysCode='ML' AND e.valide=1 GROUP BY x.etablissementId`));
const totalInvalides=conv(await q(`SELECT COUNT(*) n FROM Etablissement WHERE paysCode='ML' AND valide=0`));
console.log(JSON.stringify({extraitLe,fiches,src,form,totalInvalides}));
await p.$disconnect();})().catch(e=>{console.error(e.message);process.exit(1)});

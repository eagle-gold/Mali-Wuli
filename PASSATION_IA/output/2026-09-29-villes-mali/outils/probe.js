// LECTURE SEULE : inventaire des clés de donneesBrutes par source (fiches ML valides)
require('dotenv').config();
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
const r=await p.$queryRawUnsafe(`SELECT s.code, CAST(es.donneesBrutes AS CHAR) d FROM EtablissementSource es JOIN SourceEducative s ON s.id=es.sourceId JOIN Etablissement e ON e.id=es.etablissementId WHERE e.paysCode='ML' AND e.valide=1`);
const by={};
const walk=(o,pre,acc)=>{if(o&&typeof o==='object'&&!Array.isArray(o))for(const k of Object.keys(o)){const v=o[k];if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,pre+k+'.',acc);else acc[pre+k]=(acc[pre+k]||0)+1;}};
const ex={};
for(const x of r){const b=by[x.code]=by[x.code]||{n:0,keys:{}};b.n++;let d;try{d=JSON.parse(x.d||'{}')}catch{d={}};walk(d,'',b.keys);if(!ex[x.code])ex[x.code]=[];if(ex[x.code].length<2)ex[x.code].push(d);}
console.log(JSON.stringify({by,ex},null,1));
await p.$disconnect();})().catch(e=>{console.error(e.message);process.exit(1)});

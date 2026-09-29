// LECTURE SEULE : copies de la ville d'établissement dans Profil.onboardingDonnees.formations[].ville
require('dotenv').config();
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
const ids=new Set((await p.$queryRawUnsafe(`SELECT id FROM Etablissement WHERE paysCode='ML' AND valide=1`)).map(x=>x.id));
const profs=await p.$queryRawUnsafe(`SELECT id, CAST(onboardingDonnees AS CHAR) d FROM Profil WHERE onboardingDonnees IS NOT NULL`);
const out=[];let formationsTot=0;
for(const pr of profs){let o;try{o=JSON.parse(pr.d)}catch{continue}
 for(const f of (o&&Array.isArray(o.formations)?o.formations:[])){formationsTot++;const eid=f.etablissementId||f.etablissement?.id;if(eid&&ids.has(eid))out.push({etablissementId:eid,ville:f.ville??null});}}
const form=await p.$queryRawUnsafe(`SELECT f.etablissementId id, COUNT(*) n FROM Formation f JOIN Etablissement e ON e.id=f.etablissementId WHERE e.paysCode='ML' GROUP BY f.etablissementId`);
console.log(JSON.stringify({profils:profs.length,formationsSnapshot:formationsTot,refsML:out,formationsML:form.map(x=>({id:x.id,n:Number(x.n)}))}));
await p.$disconnect();})().catch(e=>{console.error(e.message);process.exit(1)});

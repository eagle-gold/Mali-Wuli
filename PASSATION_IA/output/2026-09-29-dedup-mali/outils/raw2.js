require('dotenv').config();
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
const r=await p.$queryRawUnsafe(`SELECT es.etablissementId id, s.code, es.identifiantExterne ext, CAST(es.donneesBrutes AS CHAR) d FROM EtablissementSource es JOIN SourceEducative s ON s.id=es.sourceId JOIN Etablissement e ON e.id=es.etablissementId JOIN (SELECT nomNormalise n, villeNormalisee v FROM Etablissement WHERE paysCode='ML' AND valide=1 GROUP BY nomNormalise, villeNormalisee HAVING COUNT(*)>1) g ON g.n=e.nomNormalise AND g.v=e.villeNormalisee WHERE e.paysCode='ML' AND e.valide=1`);
const out=r.map(x=>{let d={};try{d=JSON.parse(x.d||'{}')||{}}catch{};return {id:x.id,code:x.code,ext:x.ext,codes:d.codesOfficiels||(d.codeCps?[d.codeCps]:d.codeEtablissement?[d.codeEtablissement]:[]),cluster:d.codeCluster||null,cycle:d.cycle||null,commune:d.codeCommune||d.communePcode||null,communeNom:d.commune||null,type:d.typeEnseignement||d.amenity||null,statut:d.statut||d.operatorType||null,fonct:d.fonctionnalite||null,keys:Object.keys(d).length}});
console.log(JSON.stringify(out));
await p.$disconnect();})();

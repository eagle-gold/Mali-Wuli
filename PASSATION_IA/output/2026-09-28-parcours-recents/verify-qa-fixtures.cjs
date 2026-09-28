// Contrôle des fixtures en mémoire : aucun serveur, réseau ou accès à la base.
const assert=require('node:assert/strict');
const api=require('./qa-fixtures.cjs');
async function request(method,path,body={},token){return api.dispatch(method,path,new URLSearchParams(),body,{headers:{authorization:token?`Bearer ${token}`:''}});}
async function main(){
 api.reset(); const sessions={}; const results=[];
 for(const compte of ['membre','manager']){
  const login=await request('POST','/api/auth/login',{email:`${compte}@example.test`,motDePasse:'qa-test'});sessions[compte]=login.token;
  const me=await request('GET','/api/users/me',{},login.token);
  const snapshot=await request('GET','/api/onboarding',{},login.token);
  assert.equal(me.profil.experiences.length,3);assert.equal(me.profil.formations.length,3);
  assert.deepEqual(me.profil.experiences.map(e=>e.dateDebut.slice(0,4)),['2020','2024','2023']);
  assert.deepEqual(me.profil.formations.map(f=>f.anneeDebut),[2014,2022,2019]);
  assert.deepEqual(snapshot.experiences.map(e=>e.id),me.profil.experiences.map(e=>e.id));
  assert.deepEqual(snapshot.formations.map(f=>f.id),me.profil.formations.map(f=>f.id));
  assert.equal(snapshot.experiences.filter(e=>e.posteActuel).length,1);
  assert.equal(snapshot.experiences[1].anneeFin,'');assert.equal(snapshot.experiences[1].moisFin,'');
  assert.equal(me.profil.experiences[1].poste,me.profil.titre);
  assert.deepEqual(snapshot.formations[0].diplomesScolaires.map(d=>d.anneeObtention),['2016','2019']);
  results.push({compte:`${compte}@example.test`,profilId:me.profil.id,
   experienceApi:me.profil.experiences.map(e=>e.poste),experienceAttendue:[...me.profil.experiences].sort((a,b)=>b.dateDebut.localeCompare(a.dateDebut)).map(e=>e.poste),
   formationApi:me.profil.formations.map(f=>f.diplome),formationAttendue:['Master','Licence','Baccalauréat']});
 }
 const publicManager=await request('GET','/api/users/qa-manager',{},sessions.membre);
 assert.equal(publicManager.estMoi,false);assert.equal(publicManager.experiences.length,3);assert.equal(publicManager.formations.length,3);
 const publicMembre=await request('GET','/api/users/qa-membre',{},sessions.manager);
 assert.equal(publicMembre.estMoi,false);assert.equal(publicMembre.experiences.length,3);assert.equal(publicMembre.formations.length,3);
 console.log(JSON.stringify({status:'passed',serverStarted:false,networkCalls:0,databaseWrites:0,profils:results},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

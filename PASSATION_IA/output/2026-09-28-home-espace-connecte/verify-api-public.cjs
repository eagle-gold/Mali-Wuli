'use strict';
// Public GET only; no credentials, login, candidate data, email or mutations.
const assert=require('node:assert/strict');
(async()=>{
 const root='https://floralwhite-ram-987223.hostingersite.com/api';
 const checks=[];
 for(const [route,status] of [
  ['/health',200],['/users/me',401],['/associations',401],['/education/etablissements',401],
  ['/admin/roles',401],['/admin/membres',401],['/admin/inscriptions',401],
  ['/admin/notifications',401],['/admin/signalements',401],['/offres',401],
  ['/offres/verification-readonly',401],['/offres/verification-readonly/profil-candidature.pdf',401],
 ]){
  const response=await fetch(root+route,{method:'GET',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(25000)});
  assert.equal(response.status,status,route);
  if(route==='/health'){const data=await response.json();assert.equal(data.database,'OK');}
  checks.push({route,status:response.status});
 }
 console.log(JSON.stringify({status:'PASS',checks,databaseWrites:0,authenticatedRequests:0,realApplications:0,realEmails:0},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});

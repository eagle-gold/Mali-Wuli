'use strict';
// Fixture RAM exclusivement. Aucun module DB, mail ou connexion externe.
const CODES=['INSCRIPTIONS','OFFRES','EVENEMENTS','CATALOGUE','ASSOCIATIONS'];
const PERMS=['INSCRIPTIONS_GERER','OFFRES_MODERER','EVENEMENTS_MODERER','CATALOGUE_GERER','ASSOCIATIONS_GERER'];
const ROLES=CODES.map((code,i)=>({code,libelle:['Validation des inscriptions','Gestion des offres','Gestion des événements','Gestion du catalogue scolaire','Gestion des associations'][i],description:['Valide ou refuse les inscriptions en attente.','Valide, modifie et gère les offres d’emploi.','Valide, modifie et gère les événements et leurs photos.','Traite les propositions du catalogue scolaire.','Crée et gère les associations, leurs responsables et les affiliations.'][i],permissions:[PERMS[i]],attribuable:true}));
function rights(p){const rolesDelegues=p.rolesDelegues||[];return{rolesDelegues,revisionDroits:p.revisionDroits||'fixture-revision-0',permissions:p.role==='ADMIN'?[...PERMS,'ROLES_GERER','STATS_CONSULTER','SIGNALEMENTS_CONSULTER','CERCLES_GERER']:p.role==='MODERATEUR'?[...new Set([...PERMS.slice(0,4),'SIGNALEMENTS_CONSULTER','CERCLES_GERER',...rolesDelegues.map(x=>PERMS[CODES.indexOf(x)])])]:rolesDelegues.map(x=>PERMS[CODES.indexOf(x)]).filter(Boolean)}}
function has(p,permission){return rights(p).permissions.includes(permission)}
function dispatchAdmin(method,path,params,body,{p,state,fail,person}){
 const requirePermission=permission=>{if(!has(p,permission))fail(403,'Ce rôle ne permet pas cette action.');};
 const format=x=>({id:x.userId,profilId:x.id,prenom:x.prenom,nom:x.nom,email:x.email,role:x.role,...rights(x),statut:x.statut,emailVerifie:true,onboardingFini:x.onboardingFini,createdAt:x.createdAt,updatedAt:x.createdAt,estAdminPrincipal:x.id==='qa-admin',estMoi:x.id===p.id,peutModifierRole:x.id!=='qa-admin'&&x.id!==p.id&&x.statut==='VALIDE',raisonProtection:x.id==='qa-admin'?'Le compte administrateur est protégé.':x.statut!=='VALIDE'?'Validez le compte avant d’attribuer un rôle.':null});
 if(method==='GET'&&path==='/api/admin/roles'){requirePermission('ROLES_GERER');return{...rights(p),roles:ROLES,roleCourant:'ADMIN',peutGererRoles:true};}
 if(method==='GET'&&path==='/api/admin/membres'){
  requirePermission('ROLES_GERER');const q=(params.get('q')||'').toLowerCase();const r=params.get('roleDelegue');
  const values=state.people.filter(x=>`${x.prenom} ${x.nom} ${x.email}`.toLowerCase().includes(q)&&(!r||x.role===r||(x.rolesDelegues||[]).includes(r))&&(!params.get('statut')||x.statut===params.get('statut')));const page=Number(params.get('page')||1),limite=Number(params.get('limite')||20);
  return{membres:values.slice((page-1)*limite,page*limite).map(format),total:values.length,page,limite,totalPages:Math.ceil(values.length/limite)};
 }
 const match=/^\/api\/admin\/membres\/([^/]+)\/roles$/.exec(path);
 if(method==='PATCH'&&match){requirePermission('ROLES_GERER');const target=person(match[1]);if(!target)fail(404,'Introuvable.');if(!format(target).peutModifierRole)fail(403,'Compte protégé.');if(!Array.isArray(body.rolesDelegues)||body.rolesDelegues.some(x=>!CODES.includes(x)))fail(400,'Rôle invalide.');if(body.expectedRevision!==rights(target).revisionDroits)fail(409,'Les droits ont changé.');target.role='MEMBRE';target.rolesDelegues=[...new Set(body.rolesDelegues)].sort();target.revisionDroits=`fixture-revision-${++state.sequence}`;for(const[key,value]of state.sessions)if(value===target.id)state.sessions.delete(key);return{membre:format(target),message:'Droits mis à jour. Les anciennes sessions ont été déconnectées.'};}
 if(method==='GET'&&path==='/api/admin/notifications'){requirePermission('CATALOGUE_GERER');return{notifications:[]};}
 if(method==='GET'&&path==='/api/admin/catalogue/suggestions'){requirePermission('CATALOGUE_GERER');return{suggestions:[]};}
 if(method==='GET'&&path==='/api/admin/signalements'){requirePermission('SIGNALEMENTS_CONSULTER');return{signalements:[]};}
 if(method==='GET'&&path==='/api/admin/stats'){requirePermission('STATS_CONSULTER');return{membres:9,enAttente:1,publications:0,commentaires:0,messages:0,synergies:0,rendezVous:0};}
 if(method==='GET'&&path==='/api/admin/inscriptions'){requirePermission('INSCRIPTIONS_GERER');const values=state.people.filter(x=>x.statut==='EN_ATTENTE');return{inscriptions:values.map(x=>({...format(x),profil:{id:x.id,pays:x.pays,ville:x.ville,titre:x.titre,onboardingFini:x.onboardingFini,estVolontaire:x.estVolontaire,_count:{formations:x.formations.length,experiences:x.experiences.length}}})),total:values.length,page:1,limite:30,totalPages:1};}
 const decision=/^\/api\/admin\/inscriptions\/([^/]+)\/(valider|refuser)$/.exec(path);
 if(method==='PUT'&&decision){requirePermission('INSCRIPTIONS_GERER');const target=person(decision[1]);if(!target||target.statut!=='EN_ATTENTE')fail(409,'Inscription indisponible.');target.statut=decision[2]==='valider'?'VALIDE':'REFUSE';return{message:'Décision fictive enregistrée.',statut:target.statut};}
 fail(404,'Route admin QA inconnue.');
}
module.exports={dispatchAdmin,rights,has};

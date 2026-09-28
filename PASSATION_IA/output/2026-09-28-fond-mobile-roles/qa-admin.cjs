'use strict';
// UI QA fictive : aucune DB, aucun envoi, mutations uniquement dans l’état RAM fourni.
const ROLES=[{code:'MEMBRE',libelle:'Membre',description:'Accès aux fonctionnalités du réseau.',attribuable:true},{code:'MODERATEUR',libelle:'Modérateur',description:'Valide les inscriptions, les offres, les événements et le catalogue ; consulte les signalements.',attribuable:true},{code:'RESPONSABLE_ASSO',libelle:'Responsable d’association',description:'La gestion dépend de la désignation sur une association.',attribuable:false},{code:'VOLONTAIRE',libelle:'Volontaire (ancien rôle)',description:'Fonction désormais liée au profil.',attribuable:false},{code:'ADMIN',libelle:'Administrateur principal',description:'Compte propriétaire unique.',attribuable:false}];
function dispatchAdmin(method,path,params,body,{p,state,fail,person}){
 const admin=p.role==='ADMIN';const mod=admin||p.role==='MODERATEUR';
 if(!mod)fail(403,'Accès réservé à la modération.');
 const format=x=>({id:x.userId,profilId:x.id,prenom:x.prenom,nom:x.nom,email:x.email,role:x.role,statut:x.statut,emailVerifie:true,onboardingFini:x.onboardingFini,createdAt:x.createdAt,updatedAt:x.createdAt,estAdminPrincipal:x.id==='qa-admin',estMoi:x.id===p.id,peutModifierRole:x.id!=='qa-admin'&&x.id!==p.id&&x.statut==='VALIDE',raisonProtection:x.id==='qa-admin'?'Le compte administrateur est protégé.':x.statut!=='VALIDE'?'Validez le compte avant d’attribuer un rôle.':null});
 if(method==='GET'&&path==='/api/admin/roles'){if(!admin)fail(403,'Réservé au propriétaire.');return {roles:ROLES,roleCourant:'ADMIN',peutGererRoles:true};}
 if(method==='GET'&&path==='/api/admin/membres'){
  if(!admin)fail(403,'Réservé au propriétaire.');
  const q=(params.get('q')||'').toLowerCase();const values=state.people.filter(x=>`${x.prenom} ${x.nom} ${x.email}`.toLowerCase().includes(q)&&(!params.get('role')||x.role===params.get('role'))&&(!params.get('statut')||x.statut===params.get('statut')));const page=Number(params.get('page')||1),limite=Number(params.get('limite')||20);
  return {membres:values.slice((page-1)*limite,page*limite).map(format),total:values.length,page,limite,totalPages:Math.ceil(values.length/limite)};
 }
 const match=/^\/api\/admin\/membres\/([^/]+)\/role$/.exec(path);
 if(method==='PATCH'&&match){if(!admin)fail(403,'Réservé au propriétaire.');const target=person(match[1]);if(!target)fail(404,'Introuvable.');if(!format(target).peutModifierRole)fail(403,'Compte protégé.');if(!['MEMBRE','MODERATEUR'].includes(body.role))fail(400,'Rôle invalide.');if(body.expectedRole!==target.role)fail(409,'Le rôle a changé.');target.role=body.role;for(const [key,value]of state.sessions)if(value===target.id)state.sessions.delete(key);return {membre:format(target),message:'Rôle mis à jour. Les anciennes sessions ont été déconnectées.'};}
 if(method==='GET'&&path==='/api/admin/notifications')return {notifications:[]};
 if(method==='GET'&&path==='/api/admin/catalogue/suggestions')return {suggestions:[]};
 if(method==='GET'&&path==='/api/admin/signalements')return {signalements:[{id:'qa-report',cibleType:'PROFIL',cibleId:'qa-samba',motif:'Profil fictif signalé pour contrôle de la mise en page.',createdAt:'2026-09-28T10:00:00Z',signaleur:{id:'qa-membre',user:{prenom:'Awa',nom:'Diarra'}}}]};
 if(method==='GET'&&path==='/api/admin/stats'){if(!admin)fail(403,'Réservé au propriétaire.');return {membres:state.people.filter(x=>x.statut==='VALIDE').length,enAttente:state.people.filter(x=>x.statut==='EN_ATTENTE').length,publications:0,commentaires:0,messages:0,synergies:0,rendezVous:0};}
 if(method==='GET'&&path==='/api/admin/inscriptions'){const values=state.people.filter(x=>x.statut==='EN_ATTENTE');return {inscriptions:values.map(x=>({...format(x),profil:{id:x.id,pays:x.pays,ville:x.ville,titre:x.titre,onboardingFini:x.onboardingFini,estVolontaire:x.estVolontaire,_count:{formations:x.formations.length,experiences:x.experiences.length}}})),total:values.length,page:1,limite:30,totalPages:1};}
 const decision=/^\/api\/admin\/inscriptions\/([^/]+)\/(valider|refuser)$/.exec(path);
 if(method==='PUT'&&decision){const target=person(decision[1]);if(!target||target.statut!=='EN_ATTENTE')fail(409,'Inscription indisponible.');target.statut=decision[2]==='valider'?'VALIDE':'REFUSE';return {message:'Décision fictive enregistrée.',statut:target.statut};}
 fail(404,'Route admin QA inconnue.');
}
module.exports={dispatchAdmin};

"use strict";
// Publication/commentaire simulés en RAM ; pas d’accès réseau, DB, e-mail ou disque.
function initialPublications() {
 return [
  {id:'qa-post-membre',auteurId:'qa-membre',contenu:'Je propose un atelier pour préparer vos candidatures. Cette publication fictive appartient à Awa et permet de vérifier sa suppression.',intention:'OFFRE',thematique:'Emploi & Carrière',createdAt:'2026-09-28T11:00:00Z',reactions:[],commentaires:[
   {id:'qa-comment-other',auteurId:'qa-samba',parentId:null,contenu:'Je suis intéressé par cette rencontre fictive.',createdAt:'2026-09-28T11:01:00Z'},
   {id:'qa-reply-own',auteurId:'qa-membre',parentId:'qa-comment-other',contenu:'Merci, nous en reparlons bientôt.',createdAt:'2026-09-28T11:02:00Z'}]},
  {id:'qa-post-other',auteurId:'qa-samba',contenu:'Nous cherchons des conseils pour un projet agricole. Publication fictive d’un autre membre : Awa peut seulement supprimer son propre commentaire.',intention:'DEMANDE',thematique:'Agriculture & Agro',createdAt:'2026-09-28T10:00:00Z',reactions:[],commentaires:[
   {id:'qa-comment-own',auteurId:'qa-membre',parentId:null,contenu:'Je peux partager quelques ressources.',createdAt:'2026-09-28T10:01:00Z'},
   {id:'qa-comment-stranger',auteurId:'qa-manager',parentId:null,contenu:'Bonne initiative collective.',createdAt:'2026-09-28T10:02:00Z'}]},
  {id:'qa-post-echec',auteurId:'qa-membre',contenu:'Publication fictive conservée en cas d’échec : ce scénario simule des droits révoqués après le chargement et renvoie 403 à la suppression.',intention:'OFFRE',thematique:'Numérique & IA',createdAt:'2026-09-28T09:00:00Z',reactions:[],commentaires:[]},
 ];
}
function dispatchPublications(method,path,params,body,{state,p,fail,person,publicPerson}) {
 const mod=require('./qa-admin.cjs').has(p,'PUBLICATIONS_MODERER');
 const auteur=id=>{const v=person(id);return v?{...publicPerson(v),user:{prenom:v.prenom,nom:v.nom}}:null};
 const peutSupprimer=o=>mod||o.auteurId===p.id;
 const commentView=(c,o)=>({...c,auteur:auteur(c.auteurId),peutSupprimer:peutSupprimer(o)||c.auteurId===p.id,reponses:o.commentaires.filter(r=>r.parentId===c.id).map(r=>commentView(r,o))});
 const comments=o=>o.commentaires.filter(c=>!c.parentId).map(c=>commentView(c,o));
 const reaction=o=>({maReaction:o.reactions.some(r=>r.auteurId===p.id)?'SOUTIEN':null,nbReactions:o.reactions.length,decompteReactions:{SOUTIEN:o.reactions.length}});
 const view=o=>({...o,commentaires:comments(o),reactions:undefined,auteur:auteur(o.auteurId),peutSupprimer:peutSupprimer(o),nbCommentaires:o.commentaires.length,...reaction(o)});
 const profil=/^\/api\/publications\/profil\/([^/]+)$/.exec(path);
 if(method==='GET'&&(path==='/api/publications'||profil)){
  const scope=params.get('scope')||'tout';
  const publications=state.publications.filter(o=>(!profil||o.auteurId===profil[1])&&(scope==='tout'||(scope==='pays'?person(o.auteurId)?.pays===p.pays:person(o.auteurId)?.ville===p.ville))).map(view);
  return{publications,hasMore:false,nextCursor:null};
 }
 if(method==='POST'&&path==='/api/publications'){
  if(!String(body.contenu||'').trim())fail(400,'Texte requis.');
  const o={id:`qa-post-created-${++state.sequence}`,auteurId:p.id,intention:body.intention||'OFFRE',thematique:body.thematique||'Entraide',contenu:body.contenu,createdAt:new Date().toISOString(),commentaires:[],reactions:[]};state.publications.unshift(o);return{publication:view(o)};
 }
 const match=/^\/api\/publications\/([^/]+)(?:\/(commentaires|reactions|supporters)(?:\/([^/]+))?)?$/.exec(path);
 if(!match)fail(404,'Route publication inconnue.');
 const [,id,action,commentId]=match,o=state.publications.find(o=>o.id===decodeURIComponent(id));if(!o)fail(404,'Publication introuvable.');
 if(!action&&method==='GET')return{publication:view(o)};
 if(!action&&method==='DELETE'){
  if(!peutSupprimer(o)||o.id==='qa-post-echec')fail(403,'Vous n’êtes plus autorisé à supprimer cette publication (simulation locale).');
  state.publications=state.publications.filter(v=>v.id!==o.id);return{message:'Publication fictive supprimée.'};
 }
 if(action==='commentaires'){
  if(method==='GET')return{commentaires:comments(o)};
  if(method==='POST'){
   if(!String(body.contenu||'').trim())fail(400,'Commentaire vide.');
   if(body.parentId&&!o.commentaires.some(c=>c.id===body.parentId))fail(404,'Commentaire parent introuvable.');
   const c={id:`qa-comment-created-${++state.sequence}`,auteurId:p.id,parentId:body.parentId||null,contenu:body.contenu,createdAt:new Date().toISOString()};o.commentaires.push(c);return{commentaire:commentView(c,o)};
  }
  if(method==='DELETE'){
   const c=o.commentaires.find(c=>c.id===decodeURIComponent(commentId||''));if(!c)fail(404,'Commentaire introuvable.');if(!peutSupprimer(o)&&c.auteurId!==p.id)fail(403,'Suppression non autorisée.');
   const ids=new Set([c.id]);let previous;do{previous=ids.size;for(const item of o.commentaires)if(ids.has(item.parentId))ids.add(item.id)}while(ids.size>previous);
   o.commentaires=o.commentaires.filter(c=>!ids.has(c.id));return{message:'Commentaire fictif supprimé.',nbCommentaires:o.commentaires.length};
  }
 }
 if(action==='reactions'&&method==='POST'){if(o.reactions.some(r=>r.auteurId===p.id))o.reactions=o.reactions.filter(r=>r.auteurId!==p.id);else o.reactions.push({auteurId:p.id,type:'SOUTIEN'});return reaction(o);}
 if(['reactions','supporters'].includes(action)&&method==='GET')return{supporters:o.reactions.map(r=>auteur(r.auteurId)),reactions:o.reactions.map(r=>({...r,auteur:auteur(r.auteurId)})),total:o.reactions.length,hasMore:false,nextCursor:null,...reaction(o)};
 fail(404,'Action publication non prévue.');
}
module.exports={initialPublications,dispatchPublications};

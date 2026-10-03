/** Vrais handlers/auth/services ; delegates Prisma et e-mails entièrement simulés. */
import assert from "node:assert/strict";
import { after, test, type TestContext } from "node:test";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { EMAIL_ADMIN_PRINCIPAL, roleEffectif, rolePourInscription, droitsUtilisateur, revisionDroits, ROLES_DELEGUES } from "../lib/roles";
import { creerRouteurAdmin } from "./admin.routes";
import { creerServiceGestionMembres } from "../services/admin-membres.service";
import userRouter from "./user.routes";
const oldSecret=process.env.JWT_SECRET;process.env.JWT_SECRET="fixture-role-local-no-network";
after(()=>{if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;});
type Row=Record<string,any>;
function match(row:Row,where:Row={}):boolean{return Object.entries(where).every(([k,v])=>{if(v===undefined)return true;if(k==="AND")return v.every((c:Row)=>match(row,c));if(k==="OR")return v.some((c:Row)=>match(row,c));const x=row[k];if(v===null||typeof v!=="object")return x===v;if("not"in v)return x!==v.not;if("notIn"in v)return !v.notIn.includes(x);if("none"in v)return !x.some((r:Row)=>match(r,v.none));if("some"in v)return x.some((r:Row)=>match(r,v.some));if("contains"in v)return String(x||"").toLowerCase().includes(v.contains.toLowerCase());return match(x,v);});}
function remplacer(t:TestContext,cible:any,champ:string,fn:any){const old=cible[champ];cible[champ]=fn;t.after(()=>{cible[champ]=old;});}
function fixture(t:TestContext){
 const make=(id:string,role="MEMBRE",statut="VALIDE",email=id+"@example.invalid")=>({id,role,statut,email,rolesDelegues:[] as Row[],emailVerifie:true,tokenVersion:0,prenom:"Test",nom:id,motDePasse:"HASH_NEVER_EXPOSE",createdAt:new Date("2026-01-01"),updatedAt:new Date("2026-01-01"),profil:{id:"profil-"+id,onboardingFini:true,formations:[],cerclesMembres:[]}});
 let users=new Map<string,Row>([["owner",make("owner","ADMIN","VALIDE",EMAIL_ADMIN_PRINCIPAL)],["member",make("member")],["mod",make("mod","MODERATEUR")],["legacy-admin",make("legacy-admin","ADMIN")],["waiting",make("waiting","MEMBRE","SUSPENDU")],["unverified",{...make("unverified"),emailVerifie:false}]]);
 for(const code of ROLES_DELEGUES) { const u=make(code.toLowerCase());u.rolesDelegues=[{code}];users.set(u.id,u); }
 let otps=new Set([...users.values()].map(u=>u.email));const revoked:string[]=[],mails:Row[]=[],calls:Row[]=[];let failCas=false,failOtp=false;
 const select=(u:Row|undefined,s:Row|undefined):any=>Array.isArray(u)?u.map(item=>select(item,s)):!u?null:s?Object.fromEntries(Object.entries(s).filter(([,v])=>!!v).map(([k,v])=>[k,typeof v==="object"?select(u[k],v.select):u[k]])):{...u};
 const all=(where:Row={})=>[...users.values()].filter(u=>match(u,where));
 const db:any={user:{
 findUnique:async(a:Row)=>{calls.push({op:"user.findUnique",...a});return select(all(a.where)[0],a.select);},
 findUniqueOrThrow:async(a:Row)=>{const u=all(a.where)[0];assert.ok(u);return select(u,a.select);},
 findMany:async(a:Row)=>{calls.push({op:"user.findMany",...a});return all(a.where).slice(a.skip||0,(a.skip||0)+(a.take||100)).map(u=>select(u,a.select));},
 count:async(a:Row)=>all(a.where).length,
 updateMany:async(a:Row)=>{calls.push({op:"user.updateMany",...a});if(failCas)return{count:0};const rows=all(a.where);for(const u of rows){for(const[k,v]of Object.entries(a.data))u[k]=v&&typeof v==="object"&&"increment"in v?u[k]+v.increment:v;}return{count:rows.length};},
 update:async(a:Row)=>{calls.push({op:"user.update",...a});const u=users.get(a.where.id)!;for(const[k,v]of Object.entries(a.data))u[k]=v&&typeof v==="object"&&"increment"in v?u[k]+v.increment:v;return select(u,a.select);},
 },userRoleGrant:{deleteMany:async({where}:Row)=>{const u=users.get(where.userId)!;const count=u.rolesDelegues.length;u.rolesDelegues=[];return{count};},createMany:async({data}:Row)=>{for(const grant of data)users.get(grant.userId)!.rolesDelegues.push({code:grant.code});return{count:data.length};}},loginOtpCode:{deleteMany:async(a:Row)=>{if(failOtp)throw Error("fixture OTP failure");calls.push({op:"otp.delete",...a});return{count:Number(otps.delete(a.where.email))};}}};
 let queue=Promise.resolve();db.$transaction=async(fn:any,opts:Row)=>{assert.equal(opts.isolationLevel,"Serializable");let release!:()=>void;const old=queue;queue=new Promise<void>(r=>{release=r;});await old;const before=structuredClone({users,otps});try{return await fn(db);}catch(e){({users,otps}=before);throw e;}finally{release();}};
 for(const method of ["findUnique","findMany","count"])remplacer(t,prisma.user,method,db.user[method]);
 remplacer(t,prisma.notificationAdmin,"findMany",async()=>[]);remplacer(t,prisma.notificationAdmin,"update",async(a:Row)=>{calls.push({op:"notification.update",...a});return{};});remplacer(t,prisma.notificationAdmin,"updateMany",async()=>({count:1}));
 remplacer(t,prisma.suggestionCatalogue,"findMany",async()=>[]);remplacer(t,prisma.suggestionCatalogue,"updateMany",async(a:Row)=>{calls.push({op:"suggestion.update",...a});return{count:1};});
 remplacer(t,prisma.signalement,"findMany",async()=>[]);
 for(const delegate of [prisma.publication,prisma.commentairePublication,prisma.message,prisma.synergie,prisma.rendezVous])remplacer(t,delegate,"count",async()=>0);
 const service=creerServiceGestionMembres(db as PrismaClient,{revoquerSockets:id=>{assert.ok(users.get(id)!.tokenVersion>0);revoked.push(id);}});
 return{router:creerRouteurAdmin(service),service,get users(){return users;},get otps(){return otps;},revoked,mails,calls,casFailure:(v:boolean)=>{failCas=v;},otpFailure:(v:boolean)=>{failOtp=v;}};
}
function requete(router:Router,method:string,url:string,id="owner",body:Row={},options:{version?:number;sansToken?:boolean;base?:string}={}){
 const[path,search=""]=url.split("?");const token=jwt.sign({purpose:"access",userId:id,role:"ADMIN",tokenVersion:options.version||0},process.env.JWT_SECRET!);
 const req={method,url,originalUrl:`${options.base||"/api/admin"}${url}`,path,baseUrl:options.base||"/api/admin",headers:options.sansToken?{}:{authorization:`Bearer ${token}`},body,query:Object.fromEntries(new URLSearchParams(search)),params:{}}as unknown as Request;
 return new Promise<{status:number;body:any}>((resolve,reject)=>{let status=200;const res={status(n:number){status=n;return this;},json(body:any){resolve({status,body});return this;}}as unknown as Response;(router as any).handle(req,res,(e:unknown)=>e?reject(e):resolve({status:404,body:{}}));});
}
const body=(f:ReturnType<typeof fixture>,id:string,rolesDelegues:string[])=>({rolesDelegues,expectedRevision:revisionDroits(f.users.get(id)! as any)});
test("ADMIN unique et registre : seuls les codes connus créent des permissions",()=>{const old=process.env.ADMIN_EMAILS;process.env.ADMIN_EMAILS="other@example.invalid";try{assert.equal(roleEffectif({role:"ADMIN",email:"other@example.invalid"}),"MEMBRE");assert.equal(roleEffectif({role:"ADMIN"}),"MEMBRE");assert.equal(roleEffectif({role:"MEMBRE",email:EMAIL_ADMIN_PRINCIPAL}),"MEMBRE");assert.equal(rolePourInscription("other@example.invalid","ADMIN"),"MEMBRE");assert.equal(rolePourInscription(EMAIL_ADMIN_PRINCIPAL),"ADMIN");assert.deepEqual(droitsUtilisateur({role:"MEMBRE",rolesDelegues:[{code:"ADMIN"},{code:"ROLES_GERER"},{code:"FUTUR"}]}),{rolesDelegues:[],permissions:[]});assert.deepEqual(droitsUtilisateur({role:"MEMBRE",rolesDelegues:[{code:"OFFRES"},{code:"CATALOGUE"}]}).permissions,["CATALOGUE_GERER","OFFRES_MODERER"]);}finally{if(old===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=old;}});
test("seul propriétaire gère droits, JWT ADMIN forgé et ancien ADMIN sans email principal refusés",async(t)=>{const f=fixture(t);for(const id of["member","mod","legacy-admin",...ROLES_DELEGUES.map(x=>x.toLowerCase())]){assert.equal((await requete(f.router,"GET","/roles",id)).status,id==="membres"?200:403);assert.equal((await requete(f.router,"GET","/membres",id)).status,id==="membres"?200:403);assert.equal((await requete(f.router,"PATCH","/membres/member/roles",id,body(f,"member",["OFFRES"]))).status,403);}assert.equal((await requete(f.router,"GET","/roles","owner",{},{sansToken:true})).status,401);const r=await requete(f.router,"GET","/roles");assert.equal(r.status,200);assert.deepEqual(r.body.roles.map((r:Row)=>r.code),[...ROLES_DELEGUES]);assert.ok(r.body.roles.every((r:Row)=>r.attribuable));assert.ok(!r.body.roles.some((r:Row)=>["MODERATEUR","ADMIN","PRESIDENT_CERCLE"].includes(r.code)));});
test("catalogue et signalements ont des gardes distinctes",async(t)=>{const f=fixture(t);for(const code of ROLES_DELEGUES){const id=code.toLowerCase();for(const url of["/notifications","/catalogue/suggestions"])assert.equal((await requete(f.router,"GET",url,id)).status,code==="CATALOGUE"?200:403);assert.equal((await requete(f.router,"GET","/signalements",id)).status,403);assert.equal((await requete(f.router,"GET","/stats",id)).status,403);}assert.equal((await requete(f.router,"PUT","/catalogue/suggestions/test/accepter","catalogue",{fusionnerAvecId:123})).status,400);assert.equal((await requete(f.router,"PUT","/catalogue/suggestions/test/refuser","catalogue")).status,200);assert.equal((await requete(f.router,"PUT","/notifications/test/lire","catalogue")).status,200);});
test("ancien global conserve ses droits historiques sans recevoir les associations",async(t)=>{const f=fixture(t);const d=droitsUtilisateur(f.users.get("mod")! as any);assert.deepEqual(d.rolesDelegues,[]);assert.deepEqual(d.permissions,["CATALOGUE_GERER","CERCLES_GERER","EVENEMENTS_MODERER","OFFRES_MODERER","SIGNALEMENTS_CONSULTER"]);for(const url of["/notifications","/catalogue/suggestions","/signalements"])assert.equal((await requete(f.router,"GET",url,"mod")).status,200);assert.equal((await requete(f.router,"PATCH","/membres/member/role","owner",{role:"MODERATEUR",expectedRole:"MEMBRE"})).status,409);});
test("liste filtre le rôle délégué et masque les secrets avec protection propriétaire",async(t)=>{const f=fixture(t);const r=await requete(f.router,"GET","/membres?roleDelegue=OFFRES&statut=VALIDE&limite=1");assert.equal(r.status,200);assert.equal(r.body.total,1);assert.equal(r.body.membres[0].id,"offres");assert.deepEqual(r.body.membres[0].rolesDelegues,["OFFRES"]);assert.match(r.body.membres[0].revisionDroits,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(r.body).includes("HASH_NEVER_EXPOSE"),false);assert.equal(JSON.stringify(r.body).includes("tokenVersion"),false);const all=await requete(f.router,"GET","/membres");assert.equal(all.body.membres.find((m:Row)=>m.id==="owner").peutModifierRole,false);assert.equal((await requete(f.router,"GET","/membres?roleDelegue=ADMIN")).status,400);});
test("payload strict : pas ADMIN, permission brute, doublon ni auto-attribution",async(t)=>{const f=fixture(t);for(const roles of[["ADMIN"],["MODERATEUR"],["ROLES_GERER"],["FUTUR"],["OFFRES","OFFRES"]])assert.equal((await requete(f.router,"PATCH","/membres/member/roles","owner",body(f,"member",roles))).status,400);assert.equal((await requete(f.router,"PATCH","/membres/member/roles","owner",{...body(f,"member",[]),role:"ADMIN"})).status,400);for(const id of["owner","legacy-admin","waiting","unverified"])assert.equal((await requete(f.router,"PATCH",`/membres/${id}/roles`,"owner",body(f,id,["OFFRES"]))).status,403);assert.equal(f.revoked.length,0);});
test("cumul/remplacement/retrait atomiques conservent MEMBRE et révoquent JWT/OTP/socket",async(t)=>{const f=fixture(t);const old=body(f,"member",["OFFRES","CATALOGUE"]);const r=await requete(f.router,"PATCH","/membres/member/roles","owner",old);assert.equal(r.status,200);assert.equal(r.body.membre.role,"MEMBRE");assert.deepEqual(r.body.membre.rolesDelegues,["CATALOGUE","OFFRES"]);assert.equal(f.users.get("member")!.tokenVersion,1);assert.equal(f.otps.has("member@example.invalid"),false);assert.deepEqual(f.revoked,["member"]);assert.equal((await requete(f.router,"GET","/notifications","member")).status,401);assert.equal((await requete(f.router,"GET","/notifications","member",{},{version:1})).status,200);assert.equal((await requete(f.router,"PATCH","/membres/member/roles","owner",body(f,"member",["CATALOGUE","OFFRES"]))).status,200);assert.equal(f.users.get("member")!.tokenVersion,1);assert.equal((await requete(f.router,"PATCH","/membres/member/roles","owner",body(f,"member",[]))).status,200);assert.equal(f.users.get("member")!.tokenVersion,2);assert.deepEqual(f.users.get("member")!.rolesDelegues,[]);assert.equal(f.mails.length,0);});
test("édition ancien global remplace explicitement ses anciens pouvoirs",async(t)=>{const f=fixture(t);const r=await requete(f.router,"PATCH","/membres/mod/roles","owner",body(f,"mod",["ASSOCIATIONS"]));assert.equal(r.status,200);assert.equal(r.body.membre.role,"MEMBRE");assert.deepEqual(r.body.membre.permissions,["ASSOCIATIONS_GERER"]);assert.equal((await requete(f.router,"GET","/signalements","mod",{},{version:1})).status,403);});
test("CAS et rollback : révision périmée, conflit, OTP failure sans grants ni effets",async(t)=>{const f=fixture(t);const b=body(f,"member",["OFFRES"]);assert.equal((await requete(f.router,"PATCH","/membres/member/roles","owner",{...b,expectedRevision:"0".repeat(64)})).status,409);f.casFailure(true);assert.equal((await requete(f.router,"PATCH","/membres/member/roles","owner",b)).status,409);f.casFailure(false);f.otpFailure(true);assert.equal((await requete(f.router,"PATCH","/membres/member/roles","owner",b)).status,500);assert.equal(f.users.get("member")!.tokenVersion,0);assert.deepEqual(f.users.get("member")!.rolesDelegues,[]);assert.equal(f.revoked.length,0);assert.equal(f.otps.has("member@example.invalid"),true);});
test("CAS concurrent : une combinaison gagne, aucune perte silencieuse",async(t)=>{const f=fixture(t);const a=body(f,"member",["OFFRES"]),b=body(f,"member",["CATALOGUE"]);const rs=await Promise.all([requete(f.router,"PATCH","/membres/member/roles","owner",a),requete(f.router,"PATCH","/membres/member/roles","owner",b)]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal(f.users.get("member")!.tokenVersion,1);assert.equal(f.revoked.length,1);});
test("/users/me expose droits effectifs depuis la base, sans transformer un spécialiste en modérateur",async(t)=>{const f=fixture(t);const r=await requete(userRouter,"GET","/me","offres",{},{base:"/api/users"});assert.equal(r.status,200);assert.equal(r.body.role,"MEMBRE");assert.deepEqual(r.body.rolesDelegues,["OFFRES"]);assert.deepEqual(r.body.permissions,["OFFRES_MODERER"]);const old=await requete(userRouter,"GET","/me","legacy-admin",{},{base:"/api/users"});assert.equal(old.body.role,"MEMBRE");assert.deepEqual(old.body.permissions,[]);});

const statutBody=(f:ReturnType<typeof fixture>,id:string,action="DESACTIVER")=>({action,expectedRevision:revisionDroits(f.users.get(id)! as any)});
test("MEMBRES lit la liste/catalogue sans gérer les rôles et reçoit des flags protégés",async(t)=>{
 const f=fixture(t);f.users.set("unknown",{...f.users.get("member")!,id:"unknown",email:"unknown@example.invalid",rolesDelegues:[{code:"FUTUR"}]});
 const roles=await requete(f.router,"GET","/roles","membres");assert.equal(roles.status,200);assert.equal(roles.body.peutGererRoles,false);
 const liste=await requete(f.router,"GET","/membres","membres");assert.equal(liste.status,200);assert(liste.body.membres.every((m:Row)=>m.peutModifierRole===false));
 for(const id of["owner","legacy-admin","mod","offres","unknown","membres"]){const m=liste.body.membres.find((m:Row)=>m.id===id);assert.equal(m.peutDesactiver,false,id);assert.equal(m.peutRetablir,false,id);assert(m.raisonProtectionCompte);}
 assert.equal(liste.body.membres.find((m:Row)=>m.id==="member").peutDesactiver,true);
 assert.equal((await requete(f.router,"PATCH","/membres/member/roles","membres",body(f,"member",["OFFRES"]))).status,403);
});
test("désactivation conserve les données, bloque JWT/accès et révoque OTP/socket sans mail",async(t)=>{
 const f=fixture(t),before=structuredClone(f.users.get("member")!);
 const result=await requete(f.router,"PATCH","/membres/member/statut","membres",statutBody(f,"member"));assert.equal(result.status,200);
 assert.equal(result.body.membre.statut,"SUSPENDU");assert.equal(result.body.membre.peutRetablir,true);assert.equal(result.body.membre.peutDesactiver,false);
 assert.deepEqual(f.users.get("member"),{...before,statut:"SUSPENDU",tokenVersion:1});assert.equal(f.otps.has(before.email),false);assert.deepEqual(f.revoked,["member"]);assert.equal(f.mails.length,0);
 assert.equal((await requete(userRouter,"GET","/me","member",{},{base:"/api/users"})).status,401);
 assert.equal((await requete(userRouter,"GET","/me","member",{},{version:1,base:"/api/users"})).status,403);
 assert.equal((await requete(f.router,"PATCH","/membres/member/statut","membres",statutBody(f,"member"))).status,200);assert.equal(f.users.get("member")!.tokenVersion,1);assert.equal(f.revoked.length,1);
});
test("rétablissement redonne immédiatement l’accès (VALIDE)",async(t)=>{
 const f=fixture(t);assert.equal((await requete(f.router,"PATCH","/membres/member/statut","owner",statutBody(f,"member","RETABLIR"))).status,409);
 assert.equal((await requete(f.router,"PATCH","/membres/member/statut","membres",statutBody(f,"member"))).status,200);
 const result=await requete(f.router,"PATCH","/membres/member/statut","membres",statutBody(f,"member","RETABLIR"));assert.equal(result.status,200);assert.equal(result.body.membre.statut,"VALIDE");assert.equal(f.users.get("member")!.tokenVersion,2);
 assert.equal((await requete(userRouter,"GET","/me","member",{},{version:2,base:"/api/users"})).status,200);
 assert.equal((await requete(f.router,"GET","/roles","member",{},{version:2})).status,403);
 assert.equal(f.mails.length,0);assert.deepEqual(f.revoked,["member","member"]);
});
test("suspension : auteur/self/propriétaire et tous grants protégés contre un délégué",async(t)=>{
 const f=fixture(t);f.users.set("unknown",{...f.users.get("member")!,id:"unknown",email:"unknown@example.invalid",rolesDelegues:[{code:"FUTUR"}]});
 for(const id of["owner","legacy-admin","mod","offres","unknown","membres"])assert.equal((await requete(f.router,"PATCH",`/membres/${id}/statut`,"membres",statutBody(f,id))).status,403,id);
 for(const id of["owner","legacy-admin"])assert.equal((await requete(f.router,"PATCH",`/membres/${id}/statut`,"owner",statutBody(f,id))).status,403,id);
 for(const actor of["member","mod","offres","publications"])assert.equal((await requete(f.router,"PATCH","/membres/member/statut",actor,statutBody(f,"member"))).status,403,actor);
 assert.equal(f.revoked.length,0);
 assert.equal((await requete(f.router,"PATCH","/membres/offres/statut","owner",statutBody(f,"offres"))).status,200);assert.deepEqual(f.users.get("offres")!.rolesDelegues,[{code:"OFFRES"}]);
 assert.equal((await requete(f.router,"PATCH","/membres/offres/statut","owner",statutBody(f,"offres","RETABLIR"))).status,200);assert.equal(f.users.get("offres")!.statut,"VALIDE");assert.deepEqual(f.users.get("offres")!.rolesDelegues,[{code:"OFFRES"}]);
});
test("statut : payload strict, cible absente, révision périmée et rollback sans effet",async(t)=>{
 const f=fixture(t),d=statutBody(f,"member");
 for(const bad of[{...d,action:"DELETE"},{...d,statut:"VALIDE"},{action:"DESACTIVER"},{...d,expectedRevision:"bad"}])assert.equal((await requete(f.router,"PATCH","/membres/member/statut","membres",bad)).status,400);
 assert.equal((await requete(f.router,"PATCH","/membres/absent/statut","membres",d)).status,404);
 f.users.get("member")!.statut="REFUSE";assert.equal((await requete(f.router,"PATCH","/membres/member/statut","membres",d)).status,409);f.users.get("member")!.statut="VALIDE";
 f.casFailure(true);assert.equal((await requete(f.router,"PATCH","/membres/member/statut","membres",d)).status,409);f.casFailure(false);
 f.otpFailure(true);assert.equal((await requete(f.router,"PATCH","/membres/member/statut","membres",d)).status,500);assert.equal(f.users.get("member")!.statut,"VALIDE");assert.equal(f.users.get("member")!.tokenVersion,0);assert.equal(f.otps.has("member@example.invalid"),true);assert.equal(f.revoked.length,0);assert.equal(f.mails.length,0);
});
test("suspension concurrente : une seule transition, droits acteur relus dans le service",async(t)=>{
 const f=fixture(t),d=statutBody(f,"member");const results=await Promise.all([requete(f.router,"PATCH","/membres/member/statut","membres",d),requete(f.router,"PATCH","/membres/member/statut","owner",d)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.revoked.length,1);assert.equal(f.users.get("member")!.tokenVersion,1);
 f.users.get("membres")!.rolesDelegues=[];await assert.rejects(f.service.modifierStatut("membres","member",statutBody(f,"member","RETABLIR") as any),(e:Row)=>e.statut===403);assert.equal(f.users.get("member")!.statut,"SUSPENDU");
});

/** Vrais handlers + authentification + services ; Prisma, PDF et SMTP simulés en mémoire.
 * Aucun réseau, aucune connexion à une base, aucun fichier de profil réel. */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { creerRouteurOffres } from "./offre.routes";
import { creerServiceOffres } from "../services/offre.service";
import { creerServiceCandidatures, envoiSmtpIncertain } from "../services/candidature.service";

type Row = Record<string, any>;
const secretAvant = process.env.JWT_SECRET;
process.env.JWT_SECRET = "fixture-offres-local-aucun-reseau-aucune-db";
const userFindAvant = prisma.user.findUnique;
const comptes = new Map(["member", "other", "owner", "admin", "moderator", "pending", "pendingadmin", "offres-specialiste", "autre-specialiste"].map(id => [`user-${id}`, {
 id: `user-${id}`, email: id === "admin" ? "ik736764@gmail.com" : `user-${id}@example.invalid`, role: id.includes("admin") ? "ADMIN" : id === "moderator" ? "MODERATEUR" : "MEMBRE",
 rolesDelegues: id === "offres-specialiste" ? [{code:"OFFRES"}] : id === "autre-specialiste" ? [{code:"EVENEMENTS"}] : [],
 statut: id.startsWith("pending") ? "SUSPENDU" : "VALIDE", emailVerifie: true, tokenVersion: 0,
}]));
prisma.user.findUnique = (async ({ where }: Row) => comptes.get(where.id) || null) as unknown as typeof prisma.user.findUnique;
after(() => { prisma.user.findUnique = userFindAvant; if(secretAvant === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretAvant; });
const now = new Date("2026-09-28T12:00:00Z"), future = new Date("2027-01-01T00:00:00Z"), past = new Date("2026-01-01T00:00:00Z");
function correspond(row: Row, where: Row = {}): boolean {
 return Object.entries(where).every(([k,v]) => {
  if(v === undefined) return true;
  if(k === "AND") return (Array.isArray(v)?v:[v]).every(c=>correspond(row,c));
  if(k === "OR") return v.some((c:Row)=>correspond(row,c));
  const x=row?.[k];
  if(v===null || typeof v!=="object" || v instanceof Date) return x===v || x instanceof Date && v instanceof Date && +x===+v;
  if("some" in v) return x.some((c:Row)=>correspond(c,v.some));
  if("not" in v) return x!==v.not;
  if("gt" in v) return x!==null && x>v.gt;
  if("contains" in v) return String(x||"").toLowerCase().includes(v.contains.toLowerCase());
  return correspond(x,v);
 });
}
function fixture() {
 const profils=[...comptes].map(([userId,u])=>({id:userId.slice(5),userId,photo:null,titre:"Ingénieur",bio:"Profil de test",pays:"Mali",ville:"Bamako",situation:"ACTIF",onboardingFini:u.statut==="VALIDE",user:{...u,prenom:"Test",nom:userId,email:userId+"@example.invalid"}}));
 const base={titre:"Ingénieur logiciel",entreprise:"Entreprise test",type:"CDI",secteur:"Informatique",pays:"Mali",ville:"Bamako",description:"Une description complète pour cette offre test.",dateExpiration:future,publieurId:"owner",valide:true,statutModeration:"PUBLIEE",modeTravail:"SUR_SITE",teletravail:false,modeCandidature:"MALI_WULI",salaire:null,profilRecherche:null,recommandationPossible:false,lienCandidature:null,emailContact:null,createdAt:now};
 let offres=new Map<string,Row>([["mw",{id:"mw",...base}],["email",{id:"email",...base,modeCandidature:"EMAIL",pays:"France",ville:"Paris"}],["link",{id:"link",...base,modeCandidature:"LIEN_EXTERNE",lienCandidature:"https://example.test/jobs"}],["expired",{id:"expired",...base,dateExpiration:past}],["pending",{id:"pending",...base,valide:false,statutModeration:"EN_ATTENTE"}],["refused",{id:"refused",...base,valide:false,statutModeration:"REFUSEE"}]]);
 let favoris:Row[]=[], candidats:Row[]=[], messages:Row[]=[], conversations:Row[]=[];
 const mails:Row[]=[], notifications:Row[]=[], sockets:Row[]=[], pdfs:string[]=[], calls:Row[]=[];
 let seq=0, failMessage=false, failSentUpdate=false, failPDF=false;
 let mailImpl: (p:Row)=>Promise<void> = async()=>{};
 const pe=(id:string)=>profils.find(p=>p.id===id)!;
 const enrich=(o:Row,args:Row={}):Row=>({...o,publieur:pe(o.publieurId),enregistrements:favoris.filter(f=>f.offreId===o.id && correspond(f,args.select?.enregistrements?.where)),candidatures:candidats.filter(c=>c.offreId===o.id && correspond(c,args.select?.candidatures?.where))});
 const all=(where:Row={})=>[...offres.values()].map(o=>enrich(o)).filter(o=>correspond(o,where));
 const candidateFind=(where:Row)=>candidats.find(c=>correspond(c,where.offreId_profilId||where));
 const update=(row:Row,data:Row)=>{for(const[k,v]of Object.entries(data))row[k]=v&&typeof v==="object"&&"increment"in v?row[k]+v.increment:v;return row;};
 const db:any={
  profil:{findUnique:async({where}:Row)=>profils.find(p=>correspond(p,where))||null,findFirst:async({where}:Row)=>profils.find(p=>correspond(p,where))||null},
  offre:{
   findFirst:async(args:Row)=>{calls.push({method:"offre.findFirst",...args});const o=all(args.where)[0];return o?enrich(o,args):null;},
   findMany:async(args:Row)=>{calls.push({method:"offre.findMany",...args});let list=all(args.where);const order=Array.isArray(args.orderBy)?args.orderBy:[args.orderBy];list.sort((a,b)=>{for(const o of order){if(!o)continue;const[k,dir]=Object.entries(o)[0];const cmp=a[k]>b[k]?1:a[k]<b[k]?-1:0;if(cmp)return cmp*(dir==="desc"?-1:1);}return 0;});if(args.distinct){const key=args.distinct[0];list=list.filter((r,i)=>list.findIndex(x=>x[key]===r[key])===i);}return list.slice(args.skip||0,args.take===undefined?undefined:(args.skip||0)+args.take).map(o=>enrich(o,args));},
   count:async({where}:Row)=>all(where).length,
   create:async(args:Row)=>{const o={id:`offre-${++seq}`,createdAt:now,...args.data};offres.set(o.id,o);return enrich(o,args);},
   update:async(args:Row)=>{const o=offres.get(args.where.id);assert.ok(o);update(o,args.data);return enrich(o,args);},
   delete:async({where}:Row)=>{offres.delete(where.id);favoris=favoris.filter(f=>f.offreId!==where.id);candidats=candidats.filter(c=>c.offreId!==where.id);},
  },
  offreEnregistrement:{upsert:async({where,create}:Row)=>{const old=favoris.find(f=>correspond(f,where.offreId_profilId));if(!old)favoris.push({...create,createdAt:now});return old||create;},deleteMany:async({where}:Row)=>{const before=favoris.length;favoris=favoris.filter(f=>!correspond(f,where));return{count:before-favoris.length};}},
  candidatureOffre:{
   findUnique:async({where}:Row)=>candidateFind(where)||null,findUniqueOrThrow:async({where}:Row)=>{const c=candidateFind(where);assert.ok(c);return c;},
   create:async({data}:Row)=>{assert.equal(candidateFind({offreId_profilId:{offreId:data.offreId,profilId:data.profilId}}),undefined);const c={id:`c-${++seq}`,conversationId:null,messageId:null,erreurCode:null,tentatives:1,createdAt:now,...data};candidats.push(c);return{...c};},
   update:async({where,data}:Row)=>{const c=candidateFind(where);assert.ok(c);return{...update(c,data)};},
   updateMany:async({where,data}:Row)=>{if(data.statut==="ENVOYEE"&&failSentUpdate)throw Error("SIMULATED_DB_FAILURE");const list=candidats.filter(c=>correspond(c,where));list.forEach(c=>update(c,data));return{count:list.length};},
   count:async({where}:Row)=>candidats.filter(c=>correspond(c,where)).length,
  },
  conversation:{upsert:async({where,create}:Row)=>{let c=conversations.find(c=>correspond(c,where));if(!c){c={id:`conv-${++seq}`,...create};conversations.push(c!);}return c;},update:async({where,data}:Row)=>{const c=conversations.find(c=>correspond(c,where));assert.ok(c);return update(c,data);}},
  message:{create:async({data}:Row)=>{if(failMessage)throw Error("SIMULATED_MESSAGE_FAILURE");const m={id:`m-${++seq}`,createdAt:now,lu:false,...data};messages.push(m);return m;}},
 };
 let queue=Promise.resolve();
 db.$transaction=async(fn:(tx:any)=>Promise<any>,options:Row)=>{assert.equal(options.isolationLevel,"Serializable");let release!:()=>void;const prior=queue;queue=new Promise<void>(r=>{release=r;});await prior;const snapshot=structuredClone({offres,favoris,candidats,messages,conversations});try{return await fn(db);}catch(e){({offres,favoris,candidats,messages,conversations}=snapshot);throw e;}finally{release();}};
 const notifier=async(n:Row)=>{notifications.push(n);};
 const s=creerServiceOffres(db as PrismaClient,{notifier,emettre:(u,n,p)=>sockets.push({u,n,p})},()=>now);
 const c=creerServiceCandidatures(db as PrismaClient,{notifier,genererPdf:async(id)=>{pdfs.push(id);if(failPDF)throw Error("PDF_FAILURE");return Buffer.from("%PDF-FIXTURE");},envoyerEmail:async p=>{mails.push(p);await mailImpl(p);},nouveauMessage:(m,d,a)=>sockets.push({m,d,a})},()=>now);
 return{router:creerRouteurOffres(s,c),service:s,candidatureService:c,profils,mails,notifications,sockets,pdfs,calls,get offres(){return offres;},get candidats(){return candidats;},get favoris(){return favoris;},get messages(){return messages;},get conversations(){return conversations;},mail:(fn:typeof mailImpl)=>{mailImpl=fn;},failMessage:(v:boolean)=>{failMessage=v;},failSent:(v:boolean)=>{failSentUpdate=v;},failPDF:(v:boolean)=>{failPDF=v;}};
}
async function requete(router:Router,method:string,url:string,identite="member",body:any={},sansToken=false){
 if(method === "POST" && /\/candidatures$/.test(url) && !Object.prototype.hasOwnProperty.call(body,"revision")) {
  const detail=await requete(router,"GET",url.replace(/\/candidatures$/,""),identite,{},sansToken);
  body={...body,revision:detail.body.offre?.revision || "0".repeat(64)};
 }
 if(method === "GET" && /\/profil-candidature\.pdf(?:\?|$)/.test(url) && !new URLSearchParams(url.split("?")[1]).has("revision")) {
  const detail=await requete(router,"GET",url.split("/profil-candidature.pdf")[0],identite,{},sansToken);
  url+=`${url.includes("?")?"&":"?"}revision=${detail.body.offre?.revision || "0".repeat(64)}`;
 }
 const[pathname,search]=url.split("?");const token=jwt.sign({purpose:"access",userId:`user-${identite}`,role:"ADMIN",tokenVersion:0},process.env.JWT_SECRET!,{expiresIn:"1h"});
 const req={method,url,originalUrl:`/api/offres${url}`,path:pathname,baseUrl:"/api/offres",headers:sansToken?{}:{authorization:`Bearer ${token}`},body,query:Object.fromEntries(new URLSearchParams(search)),params:{}}as unknown as Request;
 return new Promise<{status:number;body:any;headers:Row}>((resolve,reject)=>{let status=200;const headers:Row={};const res={status(n:number){status=n;return this;},set(h:Row){Object.assign(headers,h);return this;},json(body:any){resolve({status,body,headers});return this;},send(body:any){resolve({status,body,headers});return this;}}as unknown as Response;(router as any).handle(req,res,(e:unknown)=>e?reject(e):resolve({status:404,body:{},headers}));});
}
const creation={titre:"Développeur web",entreprise:"Test entreprise",type:"CDI",secteur:"Informatique",pays:"Mali",ville:"Bamako",description:"Une offre pour participer au développement du produit.",dateExpiration:future.toISOString()};

test("auth réelle : anonyme/en attente refusés et rôle JWT non utilisé",async()=>{const f=fixture();assert.equal((await requete(f.router,"GET","/","member",{},true)).status,401);assert.equal((await requete(f.router,"GET","/","pending")).status,403);assert.equal((await requete(f.router,"PATCH","/pending/validation","member",{valide:true})).status,403);assert.equal((await requete(f.router,"GET","/?vue=en-attente")).status,403);});
test("liste paginée/facettes globales et détail sans email privé",async()=>{const f=fixture();const r=await requete(f.router,"GET","/?limite=1&pays=France");assert.equal(r.status,200);assert.equal(r.body.offres.length,1);assert.equal(r.body.meta.total,1);assert.deepEqual(r.body.facettes.pays,["France","Mali"]);assert.deepEqual(r.body.facettes.villes,["Paris"]);assert.equal(r.body.compteurs.actives,3);assert.equal(JSON.stringify(r.body).includes("@example.invalid"),false);assert.equal((await requete(f.router,"GET","/pending")).status,404);assert.equal((await requete(f.router,"GET","/pending","owner")).status,200);assert.equal((await requete(f.router,"GET","/?limite=51")).status,400);assert.equal((await requete(f.router,"GET","/?vue=mes-offres","owner")).body.meta.total,6);});
test("même un admin crée et modifie en attente ; validation seule publie",async()=>{const f=fixture();const r=await requete(f.router,"POST","/","admin",creation);assert.equal(r.status,201);assert.equal(r.body.offre.valide,false);assert.equal(r.body.offre.statutModeration,"EN_ATTENTE");const id=r.body.offre.id;assert.equal((await requete(f.router,"PATCH",`/${id}/validation`,"admin",{valide:true,revision:r.body.offre.revision})).body.offre.statutModeration,"PUBLIEE");assert.equal((await requete(f.router,"PATCH",`/${id}`,"admin",{salaire:"45 000 €"})).body.offre.statutModeration,"EN_ATTENTE");assert.equal((await requete(f.router,"PATCH",`/${id}/validation`,"moderator",{valide:false,revision:(await requete(f.router,"GET",`/${id}`,"moderator")).body.offre.revision})).body.offre.statutModeration,"REFUSEE");assert.equal(f.notifications[0].href,`/offres?offre=${id}`);});
test("validation champs stricts, modes et compatibilité date/teletravail",async()=>{const f=fixture();for(const patch of[{statutModeration:"PUBLIEE"},{valide:true},{modeCandidature:"LIEN_EXTERNE"},{lienCandidature:"javascript:alert(1)"},{dateExpiration:past.toISOString()}])assert.equal((await requete(f.router,"POST","/","owner",{...creation,...patch})).status,400);const r=await requete(f.router,"POST","/","owner",{...creation,teletravail:true,emailContact:"public@example.test"});assert.equal(r.body.offre.modeTravail,"TELETRAVAIL");assert.equal(r.body.offre.modeCandidature,"EMAIL");const id=r.body.offre.id;const edit=await requete(f.router,"PATCH",`/${id}`,"owner",{modeCandidature:"MALI_WULI"});assert.equal(edit.body.offre.emailContact,null);assert.equal((await requete(f.router,"PATCH","/expired","owner",{salaire:"À discuter",dateExpiration:past.toISOString()})).status,200);assert.equal((await requete(f.router,"PATCH","/mw","member",{salaire:"secret"})).status,403);});
test("favoris idempotents et privés, suppression idempotente",async()=>{const f=fixture();for(let i=0;i<2;i++)assert.equal((await requete(f.router,"PUT","/mw/enregistrement")).status,200);assert.equal(f.favoris.length,1);assert.equal((await requete(f.router,"GET","/mw")).body.offre.estEnregistree,true);assert.equal((await requete(f.router,"GET","/mw","other")).body.offre.estEnregistree,false);assert.equal((await requete(f.router,"GET","/?vue=enregistrees")).body.meta.total,1);for(let i=0;i<2;i++)assert.equal((await requete(f.router,"DELETE","/mw/enregistrement")).body.estEnregistree,false);assert.equal((await requete(f.router,"PUT","/pending/enregistrement")).status,404);});
test("candidatures refusées : propre offre, expiration, attente, profil non validé",async()=>{const f=fixture();for(const[id,user,status]of[["mw","owner",403],["expired","member",409],["pending","member",404],["mw","pendingadmin",403]]as const){assert.equal((await requete(f.router,"POST",`/${id}/candidatures`,user)).status,status);assert.equal((await requete(f.router,"GET",`/${id}/profil-candidature.pdf`,user)).status,status);}assert.equal(f.candidats.length,0);assert.equal(f.mails.length,0);assert.equal(f.pdfs.length,0);assert.equal((await requete(f.router,"POST","/mw/candidatures","member",{profilId:"owner"})).status,400);assert.equal((await requete(f.router,"POST","/mw/candidatures","member",{message:"x".repeat(2001)})).status,400);});
test("lien externe : zéro enregistrement, message, PDF, mail",async()=>{const f=fixture();const r=await requete(f.router,"POST","/link/candidatures");assert.equal(r.status,200);assert.equal(r.body.lienExterne,"https://example.test/jobs");assert.equal(r.body.aPostule,false);assert.equal(r.body.statutCandidature,null);assert.equal(f.candidats.length+f.mails.length+f.messages.length+f.pdfs.length,0);});
test("PDF propre profil seulement, privé/no-store et sans réservation",async()=>{const f=fixture();const r=await requete(f.router,"GET","/email/profil-candidature.pdf?profilId=owner");assert.equal(r.status,200);assert.ok(Buffer.isBuffer(r.body));assert.equal(r.headers["Cache-Control"],"private, no-store");assert.deepEqual(f.pdfs,["member"]);assert.equal(f.candidats.length,0);});
test("Mali Wuli : double clic crée un seul message atomique et effets après commit",async()=>{const f=fixture();const results=await Promise.all([requete(f.router,"POST","/mw/candidatures","member",{message:"Bonjour"}),requete(f.router,"POST","/mw/candidatures")]);assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(f.candidats.length,1);assert.equal(f.messages.length,1);assert.equal(f.conversations.length,1);assert.equal(f.notifications.length,1);assert.match(f.messages[0].contenu,/https:\/\/mali-wuli.com\/membres\/member/);assert.match(f.messages[0].contenu,/Bonjour/);assert.equal(f.mails.length,0);const detail=await requete(f.router,"GET","/mw");assert.equal(detail.body.offre.aPostule,true);assert.equal(detail.body.offre.conversationId,f.conversations[0].id);const o={...f.offres.get("mw"),id:"mw2"};f.offres.set("mw2",o);await requete(f.router,"POST","/mw2/candidatures");assert.equal(f.conversations.length,1);assert.equal(f.messages.length,2);});
test("Mali Wuli : échec message annule réservation/conversation et effets",async()=>{const f=fixture();f.failMessage(true);assert.equal((await requete(f.router,"POST","/mw/candidatures")).status,500);assert.equal(f.candidats.length+f.messages.length+f.conversations.length+f.notifications.length,0);f.failMessage(false);assert.equal((await requete(f.router,"POST","/mw/candidatures")).status,201);});
test("EMAIL : concurrence, EN_COURS et répétition sans envoi double",async()=>{const f=fixture();let release!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});const gate=new Promise<void>(r=>{release=r;});f.mail(async()=>{entered();await gate;});const first=requete(f.router,"POST","/email/candidatures","member",{message:"Ma candidature"});await started;const second=await requete(f.router,"POST","/email/candidatures");assert.equal(second.status,202);assert.equal(second.body.aPostule,false);assert.equal(f.mails.length,1);assert.equal((await requete(f.router,"DELETE","/email","owner")).status,409);release();assert.equal((await first).status,201);assert.equal((await requete(f.router,"POST","/email/candidatures","member",{reessayer:true})).status,200);assert.equal(f.mails.length,1);assert.equal(f.mails[0].destinataire,"user-owner@example.invalid");assert.equal(f.mails[0].replyTo,"user-member@example.invalid");assert.equal(f.messages.length,0);});
test("EMAIL : refus SMTP explicite ECHEC et reprise réservée une seule fois",async()=>{const f=fixture();f.offres.get("email")!.emailContact="jobs@example.test";f.mail(async()=>{throw Object.assign(new Error("Refus fixture"),{responseCode:550,command:"DATA"});});assert.equal((await requete(f.router,"POST","/email/candidatures")).status,502);assert.equal(f.candidats[0].statut,"ECHEC");assert.equal((await requete(f.router,"POST","/email/candidatures")).status,502);assert.equal(f.mails.length,1);f.mail(async()=>{});const r=await Promise.all([requete(f.router,"POST","/email/candidatures","member",{reessayer:true}),requete(f.router,"POST","/email/candidatures","member",{reessayer:true})]);assert.ok(r.every(x=>[200,201,202].includes(x.status)));assert.equal(f.mails.length,2);assert.equal(f.candidats.length,1);assert.equal(f.candidats[0].tentatives,2);assert.equal(f.candidats[0].statut,"ENVOYEE");assert.equal(f.mails[1].destinataire,"jobs@example.test");});
test("EMAIL : échec PDF avant SMTP permet reprise sans aucun mail initial",async()=>{const f=fixture();f.failPDF(true);assert.equal((await requete(f.router,"POST","/email/candidatures")).status,502);assert.equal(f.candidats[0].erreurCode,"PDF_GENERATION_FAILED");assert.equal(f.mails.length,0);f.failPDF(false);assert.equal((await requete(f.router,"POST","/email/candidatures","member",{reessayer:true})).status,201);assert.equal(f.mails.length,1);});
test("EMAIL : acceptation SMTP puis erreur DB reste EN_COURS, aucune reprise",async()=>{const f=fixture();f.failSent(true);assert.equal((await requete(f.router,"POST","/email/candidatures")).status,202);assert.equal(f.candidats[0].statut,"EN_COURS");f.failSent(false);assert.equal((await requete(f.router,"POST","/email/candidatures","member",{reessayer:true})).status,202);assert.equal(f.mails.length,1);});
test("EMAIL : timeout après DATA ambigu bloque le renvoi",async()=>{const f=fixture();f.mail(async()=>{throw Object.assign(new Error("Transport interrompu"),{code:"ETIMEDOUT",command:"DATA"});});assert.equal((await requete(f.router,"POST","/email/candidatures")).status,202);assert.equal(f.candidats[0].statut,"EN_COURS");assert.equal((await requete(f.router,"POST","/email/candidatures","member",{reessayer:true})).status,202);assert.equal(f.mails.length,1);for(const error of[{command:"DATA",code:"ETIMEDOUT"},{code:"ESOCKET"},Error("inconnu")])assert.equal(envoiSmtpIncertain(error),true);for(const error of[{command:"DATA",responseCode:451},{command:"CONN",code:"ETIMEDOUT"},{code:"EAUTH"},{command:"RCPT TO",code:"ESOCKET"}])assert.equal(envoiSmtpIncertain(error),false);});

test("modération : révision absente refusée, contenu modifié depuis lecture rejeté",async()=>{const f=fixture();const avant=(await requete(f.router,"GET","/mw","admin")).body.offre;assert.equal((await requete(f.router,"PATCH","/mw/validation","admin",{valide:true})).status,400);await requete(f.router,"PATCH","/mw","owner",{titre:"Nouveau titre après lecture"});assert.equal((await requete(f.router,"PATCH","/mw/validation","admin",{valide:true,revision:avant.revision})).status,409);assert.equal(f.offres.get("mw")!.statutModeration,"EN_ATTENTE");const apres=(await requete(f.router,"GET","/mw","admin")).body.offre;assert.equal((await requete(f.router,"PATCH","/mw/validation","admin",{valide:true,revision:apres.revision})).status,200);});

test("consentement figé : destinataire ou mode modifié bloque candidature/PDF sans effet",async()=>{const f=fixture();const revision=(await requete(f.router,"GET","/email")).body.offre.revision;f.offres.get("email")!.emailContact="nouveau@example.test";assert.equal((await requete(f.router,"POST","/email/candidatures","member",{revision})).status,409);assert.equal((await requete(f.router,"GET",`/email/profil-candidature.pdf?revision=${revision}`)).status,409);const mwRevision=(await requete(f.router,"GET","/mw")).body.offre.revision;f.offres.get("mw")!.modeCandidature="EMAIL";assert.equal((await requete(f.router,"POST","/mw/candidatures","member",{revision:mwRevision})).status,409);assert.equal(f.mails.length+f.candidats.length+f.pdfs.length+f.messages.length,0);assert.equal((await requete(f.router,"POST","/email/candidatures","member",{revision:undefined})).status,400);});

test("spécialiste OFFRES : modère sans ADMIN, autre domaine refusé dans routes et service",async()=>{const f=fixture();const revision=(await requete(f.router,"GET","/pending","owner")).body.offre.revision;assert.equal((await requete(f.router,"PATCH","/pending/validation","autre-specialiste",{valide:true,revision})).status,403);assert.equal((await requete(f.router,"GET","/?vue=en-attente","autre-specialiste")).status,403);assert.equal((await requete(f.router,"GET","/?vue=en-attente","offres-specialiste")).status,200);assert.equal((await requete(f.router,"PATCH","/pending/validation","offres-specialiste",{valide:true,revision})).status,200);assert.equal((await requete(f.router,"PATCH","/mw","autre-specialiste",{salaire:"Non autorisé"})).status,403);assert.equal((await requete(f.router,"PATCH","/mw","offres-specialiste",{salaire:"Autorisé"})).status,200);});


test("suppression offre : flag serveur aligné propriétaire ou permission OFFRES, autres refusés", async () => {
 for (const acteur of ["owner", "admin", "offres-specialiste", "member", "autre-specialiste"]) {
  const f=fixture(), autorise=["owner", "admin", "offres-specialiste"].includes(acteur);
  assert.equal((await requete(f.router,"GET","/mw",acteur)).body.offre.peutSupprimer,autorise);
  assert.equal((await requete(f.router,"DELETE","/mw",acteur)).status,autorise?200:403);
  assert.equal(f.offres.has("mw"),!autorise);
  assert.equal(f.mails.length,0); assert.equal(f.notifications.length,0);
 }
});

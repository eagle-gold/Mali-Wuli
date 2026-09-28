/* Reproducible fixture checks. No HTTP, real session, database or application-source writes. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root='/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend';
const staged=path.join(__dirname,'staging/frontend/src');
const ts=require(path.join(root,'node_modules/typescript')),React=require(path.join(root,'node_modules/react'));
const {renderToStaticMarkup}=require(path.join(root,'node_modules/react-dom/server'));
const jsx=require(path.join(root,'node_modules/react/jsx-runtime'));
const {File}=require('node:buffer');
const checks=[],calls=[],navigations=[];
const now=Date.parse('2026-09-28T12:00:00Z');
class FixtureDate extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
const style=new Proxy({},{get:(_o,k)=>String(k)});
let apiResult=async()=>({});
const api={};for(const method of ['get','post','delete','patch','put'])api[method]=async(url,body,config)=>{const call={method:method.toUpperCase(),url,...(method==='get'?{config:body}:{body,config})};calls.push(call);return{data:await apiResult(call)}};
const defaults={react:React,'react/jsx-runtime':jsx,'lucide-react':require(path.join(root,'node_modules/lucide-react')),
 'next/link':({children,...props})=>React.createElement('a',props,children),
 'next/navigation':{useRouter:()=>({push:url=>navigations.push(url)}),useSearchParams:()=>new URLSearchParams()},
 '@/lib/api':api,'@/lib/media':{urlMediaBackend:v=>v||null},
 '@/lib/community':{initiales:(a,b)=>(a?.[0]||'')+(b?.[0]||''),messageErreur:(e,f)=>e?.response?.data?.message||f},
 '@/hooks/useSocket':{useSocket:()=>null},
 '@/components/community/CommunityUi':{Chargement:({texte})=>jsx.jsx('p',{children:texte}),ErreurChargement:({message})=>jsx.jsx('p',{children:message})},
};
class FixtureURL extends URL { static createObjectURL(){return 'blob:fixture';} static revokeObjectURL(){} }
function load(file,overrides={}){
 const filename=path.join(staged,file),module={exports:{}},imports={...defaults,...overrides};
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require(id){
   if(id.endsWith('.module.css'))return{__esModule:true,default:style};
   if(id in imports)return imports[id];
   const local=id.startsWith('@/')?id.slice(2):id.startsWith('.')?path.relative(staged,path.resolve(path.dirname(filename),id)):null;
   if(local)for(const ext of ['.tsx','.ts'])if(fs.existsSync(path.join(staged,local+ext)))return load(local+ext,overrides);
   throw new Error(`Unmocked ${id}`);
 },console,Date:FixtureDate,Intl,URL:FixtureURL,URLSearchParams,AbortController,FormData,File,Blob,setTimeout,clearTimeout,window:{setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},location:{origin:'https://fixture.invalid',href:'https://fixture.invalid/offres',hash:''},history:{state:null,replaceState(){}},addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false})}});
 return module.exports;
}
function harness(seed={}){let index=0,refIndex=0,effects=[];const state=[],refs=[];return{
 react:{...React,useState(initial){const i=index++;if(!(i in state))state[i]=i in seed?seed[i]:typeof initial==='function'?initial():initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useRef(value){const i=refIndex++;return refs[i]||(refs[i]={current:value});},useEffect:fn=>effects.push(fn),useMemo:fn=>fn(),useCallback:fn=>fn,useId:()=>':fixture:'},
 render(fn,props){index=0;refIndex=0;effects=[];return fn(props);},effects:()=>effects,state,refs,
};}
function nodes(e){if(e==null||typeof e==='boolean')return[];if(Array.isArray(e))return e.flatMap(nodes);if(typeof e!=='object')return[e];return[e,...nodes(e.props?.children)];}
const label=e=>nodes(e).filter(n=>typeof n==='string'||typeof n==='number').join('');
const button=(t,s)=>nodes(t).find(n=>n?.type==='button'&&label(n).includes(s));
const settle=()=>new Promise(r=>setTimeout(r,0));
const clean=v=>JSON.parse(JSON.stringify(v));
const offre={revision:'a'.repeat(64),id:'offre-fixture',titre:'Data analyst',entreprise:'Entreprise QA',type:'CDI',secteur:'Tech & digital',pays:'Mali',ville:'Bamako',teletravail:false,modeTravail:'SUR_SITE',description:'Analyse des données du produit.',profilRecherche:'SQL et expérience en analyse.',salaire:'Selon profil',modeCandidature:'MALI_WULI',lienCandidature:null,emailContact:null,recommandationPossible:true,dateExpiration:'2026-11-15T23:59:59.999Z',publieurId:'profil-auteur',publieur:{id:'profil-auteur',prenom:'Awa',nom:'Diarra',nomComplet:'Awa Diarra',photo:null},valide:true,statutModeration:'PUBLIEE',createdAt:'2026-09-28T09:00:00Z',estProprietaire:false,estExpiree:false,estEnregistree:false,aPostule:false,statutCandidature:null,conversationId:null};
const liste={offres:[offre],meta:{page:1,limite:12,total:1,totalPages:1},facettes:{pays:['Mali'],villes:['Bamako'],secteurs:['Tech & digital'],types:['CDI'],modesTravail:['SUR_SITE']},compteurs:{actives:1,enregistrees:0,mesOffres:0,enAttente:0},peutModerer:false};
const sent={modeCandidature:'MALI_WULI',statutCandidature:'ENVOYEE',aPostule:true,conversationId:'conversation-fixture',message:'Votre candidature a été envoyée.'};
const submit=t=>nodes(t).find(n=>n?.type==='form').props.onSubmit({preventDefault(){}});
async function main(){
 const safe=load('lib/offres.ts');for(const value of ['javascript:alert(1)','data:text/html,test','https://name:secret@example.test/a','file:///tmp/private'])assert.equal(safe.lienExterneSur(value),null);assert.equal(safe.lienExterneSur('https://example.test/jobs'),'https://example.test/jobs');
 const ext=harness();const candExt=load('components/offres/CandidatureOffre.tsx',{react:ext.react});let tree=ext.render(candExt.default,{offre:{...offre,modeCandidature:'LIEN_EXTERNE',lienCandidature:'https://example.test/jobs'},actualiser(){}});assert.equal(tree.type,'a');assert.equal(tree.props.href,'https://example.test/jobs');assert.equal(calls.length,0);
 for(const changed of [{statutModeration:'EN_ATTENTE'},{estExpiree:true},{dateExpiration:'2026-09-28T10:00:00Z'}]){tree=ext.render(candExt.default,{offre:{...offre,...changed},actualiser(){}});assert.equal(tree.type,'button');assert(tree.props.disabled)}
 tree=ext.render(candExt.default,{offre:{...offre,estProprietaire:true},actualiser(){}});assert(!button(tree,'Postuler'));
 checks.push('external-link-no-mutation-safe-protocol-and-private-owner-expired-states');

 const saved=[];const fh=harness();const fav=load('components/offres/OffresUi.tsx',{react:fh.react});const fp={offre,actualiser:(...args)=>saved.push(args)};apiResult=async()=>({estEnregistree:true});tree=fh.render(fav.EnregistrerOffre,fp);button(tree,'Enregistrer').props.onClick();await settle();assert.equal(calls.at(-1).method,'PUT');assert.equal(calls.at(-1).url,'/offres/offre-fixture/enregistrement');assert.deepEqual(clean(saved.at(-1)),[offre.id,{estEnregistree:true}]);
 apiResult=async()=>({estEnregistree:false});tree=fh.render(fav.EnregistrerOffre,{...fp,offre:{...offre,estEnregistree:true}});button(tree,'Offre enregistrée').props.onClick();await settle();assert.equal(calls.at(-1).method,'DELETE');
 checks.push('bookmark-idempotent-PUT-and-DELETE-use-server-state');

 const ch=harness({0:true,1:'Bonjour, voici ma candidature.'});const c=load('components/offres/CandidatureOffre.tsx',{react:ch.react});const updates=[];const cp={offre,actualiser:(...args)=>updates.push(args)};
 tree=ch.render(c.default,cp);assert(!label(tree).includes('Votre e-mail de compte sera partagé'));assert(button(tree,'Envoyer ma candidature').props.disabled);let before=calls.length;submit(tree);assert.equal(calls.length,before);
 nodes(tree).find(n=>n?.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});tree=ch.render(c.default,cp);apiResult=async()=>sent;submit(tree);await settle();assert.equal(calls.length,before+1);assert.equal(calls.at(-1).url,'/offres/offre-fixture/candidatures');assert.deepEqual(clean(calls.at(-1).body),{revision:offre.revision,message:'Bonjour, voici ma candidature.'});assert.equal(updates.at(-1)[1].aPostule,true);
 tree=ch.render(c.default,cp);assert(label(tree).includes('Voir la conversation'));assert.equal(nodes(tree).find(n=>n?.props?.href?.startsWith('/messages?')).props.href,'/messages?conversation=conversation-fixture');assert(!button(tree,'Envoyer ma candidature'));
 checks.push('internal-application-requires-explicit-consent-and-links-returned-conversation');

 const eh=harness({0:true,2:true});const ec=load('components/offres/CandidatureOffre.tsx',{react:eh.react});const ep={offre:{...offre,modeCandidature:'EMAIL',emailContact:'recrutement@example.test'},actualiser(){}};tree=eh.render(ec.default,ep);assert(label(tree).includes('recrutement@example.test'));assert(label(tree).includes('Votre e-mail de compte sera partagé'));assert(label(tree).includes('uniquement si vous l’avez rendu visible'));assert(!nodes(tree).some(n=>n?.props?.href?.startsWith('mailto:')));
 apiResult=async()=>new Blob(['%PDF-1.7 fixture'],{type:'application/pdf'});button(tree,'Préparer mon profil PDF').props.onClick();await settle();assert.equal(calls.at(-1).method,'GET');assert.equal(calls.at(-1).url,'/offres/offre-fixture/profil-candidature.pdf');assert.equal(calls.at(-1).config.responseType,'blob');assert.equal(calls.at(-1).config.params.revision,offre.revision);tree=eh.render(ec.default,ep);assert(nodes(tree).some(n=>n?.type==='a'&&n.props.href==='blob:fixture'));
 const fallback=harness({0:true,2:true});const fallbackComponent=load('components/offres/CandidatureOffre.tsx',{react:fallback.react});tree=fallback.render(fallbackComponent.default,{...ep,offre:{...ep.offre,emailContact:null}});assert(label(tree).includes('Le membre qui a déposé l’offre'));assert(!button(tree,'Envoyer ma candidature').props.disabled);
 checks.push('email-recipient-fallback-profile-disclosure-and-authenticated-PDF-blob-preview');

 const pending=harness({0:true});const pc=load('components/offres/CandidatureOffre.tsx',{react:pending.react});const pp={offre:{...offre,modeCandidature:'EMAIL',statutCandidature:'EN_COURS'},actualiser(){}};tree=pending.render(pc.default,pp);assert(!button(tree,'Envoyer ma candidature'));apiResult=async()=>({offre:{...pp.offre,statutCandidature:'ENVOYEE',aPostule:true}});button(tree,'Actualiser l’état').props.onClick();await settle();assert.equal(calls.at(-1).method,'GET');assert.equal(calls.at(-1).url,'/offres/offre-fixture');
 const failed=harness({0:true,2:true});const fc=load('components/offres/CandidatureOffre.tsx',{react:failed.react});tree=failed.render(fc.default,{...ep,offre:{...ep.offre,statutCandidature:'ECHEC'}});apiResult=async()=>({...sent,modeCandidature:'EMAIL',conversationId:null});submit(tree);await settle();assert.deepEqual(clean(calls.at(-1).body),{revision:offre.revision,reessayer:true});
 const uncertain=harness({0:true,2:true});const uc=load('components/offres/CandidatureOffre.tsx',{react:uncertain.react});tree=uncertain.render(uc.default,ep);apiResult=async()=>{throw Error('network fixture')};submit(tree);await settle();tree=uncertain.render(uc.default,ep);assert(!button(tree,'Envoyer ma candidature'));assert(button(tree,'Actualiser l’état'));assert.equal(uncertain.state[7],true);
 checks.push('email-pending-GET-only-failed-explicit-retry-and-network-ambiguity-blocks-resend');
 const conflict=harness({0:true,2:true});const cc=load('components/offres/CandidatureOffre.tsx',{react:conflict.react});const newer={...ep.offre,revision:'b'.repeat(64),emailContact:'nouveau@example.test'};let changed=null;
 tree=conflict.render(cc.default,{...ep,actualiser:(_id,v)=>changed=v});const beforeConflict=calls.length;
 apiResult=async call=>{if(call.method==='POST')throw {response:{status:409,data:{message:'Offre modifiée'}}};return {offre:newer};};submit(tree);await settle();
 assert.deepEqual(calls.slice(beforeConflict).map(x=>x.method),['POST','GET']);assert.equal(changed.revision,newer.revision);assert.equal(conflict.state[2],false);
 tree=conflict.render(cc.default,{offre:newer,actualiser(){}});assert(button(tree,'Envoyer ma candidature').props.disabled);assert(label(tree).includes('nouveau@example.test'));
 // La case déjà cochée pour A ne doit pas autoriser un nouvel envoi vers B avant même l’effet React.
 const live=harness({0:true,2:true});const lc=load('components/offres/CandidatureOffre.tsx',{react:live.react});live.render(lc.default,ep);tree=live.render(lc.default,{offre:newer,actualiser(){}});const beforeStale=calls.length;submit(tree);assert.equal(calls.length,beforeStale);live.effects()[3]();assert.equal(live.state[2],false);
 checks.push('revision-bound-consent-POST-PDF-and-409-refresh-without-automatic-resend');


 const lh=harness({0:'enregistrees',1:'analyst',2:'analyst',3:{pays:'Mali',ville:'Bamako',type:'CDI',secteur:'Tech & digital',modeTravail:'SUR_SITE'},4:2});const page=load('components/offres/OffresPage.tsx',{react:lh.react});apiResult=async()=>({...liste,meta:{...liste.meta,page:2,total:14,totalPages:2}});lh.render(page.default);lh.effects()[2]();await settle();assert.deepEqual(clean(calls.at(-1).config.params),{vue:'enregistrees',q:'analyst',pays:'Mali',ville:'Bamako',type:'CDI',secteur:'Tech & digital',modeTravail:'SUR_SITE',page:2,limite:12});tree=lh.render(page.default);assert.equal(nodes(tree).find(n=>n?.type==='input'&&n.props.type==='search').props.maxLength,100);assert.equal(nodes(tree).filter(n=>n?.type==='select').length,5);assert(!nodes(tree).some(n=>n?.props?.href==='/admin/offres'));
 button(tree,'Mes offres').props.onClick();lh.render(page.default);lh.effects()[2]();await settle();assert.equal(calls.at(-1).config.params.vue,'mes-offres');assert.equal(calls.at(-1).config.params.page,1);
 checks.push('five-filters-saved-own-views-pagination-and-admin-visibility');

 const sh=harness();const sp=load('components/offres/OffresPage.tsx',{react:sh.react});let resolveOld,resolveNew;apiResult=()=>new Promise(resolve=>{resolveOld=resolve});tree=sh.render(sp.default);sh.effects()[2]();tree=sh.render(sp.default);nodes(tree).find(n=>n?.type==='select').props.onChange({target:{value:'France'}});apiResult=()=>new Promise(resolve=>{resolveNew=resolve});sh.render(sp.default);sh.effects()[2]();resolveNew({...liste,offres:[{...offre,id:'new-filter',pays:'France'}]});await settle();resolveOld({...liste,offres:[{...offre,id:'stale-filter'}]});await settle();assert.equal(sh.state[5].offres[0].id,'new-filter');assert.equal(sh.state[8].id,'new-filter');
 const dh=harness({8:{id:'old-detail',origine:'liste'}});const dp=load('components/offres/OffresPage.tsx',{react:dh.react});apiResult=()=>new Promise(resolve=>{resolveOld=resolve});dh.render(dp.default);dh.effects()[3]();dh.state[8]={id:'new-detail',origine:'liste'};apiResult=()=>new Promise(resolve=>{resolveNew=resolve});dh.render(dp.default);dh.effects()[3]();resolveNew({offre:{...offre,id:'new-detail'}});await settle();resolveOld({offre:{...offre,id:'old-detail'}});await settle();assert.equal(dh.state[9].id,'new-detail');
 checks.push('stale-list-and-detail-responses-never-replace-new-selection-or-filter');

 const deep=harness({8:{id:'linked-offer',origine:'lien'}});const deepPage=load('components/offres/OffresPage.tsx',{react:deep.react});apiResult=async()=>liste;deep.render(deepPage.default);deep.effects()[2]();await settle();assert.equal(deep.state[8].id,'linked-offer');
 const lost=harness({8:{id:'removed-offer',origine:'liste'}});const lostPage=load('components/offres/OffresPage.tsx',{react:lost.react});lost.render(lostPage.default);lost.effects()[2]();await settle();assert.equal(lost.state[8].id,offre.id);
 const refresh=harness({8:{id:offre.id,origine:'liste'},9:offre});const refreshPage=load('components/offres/OffresPage.tsx',{react:refresh.react});apiResult=async()=>{throw {response:{status:404}}};refresh.render(refreshPage.default);refresh.effects()[3]();assert.equal(refresh.state[9].id,offre.id);await settle();assert.equal(refresh.state[9],null);
 checks.push('deep-link-preserved-list-disappearance-reconciled-refresh-keeps-dialog-until-revocation');
 console.log(JSON.stringify({status:'passed',checks,simulatedActions:calls.length,networkCalls:0,databaseWrites:0,limitations:['React hooks and API are fixtures; native dialog behavior, responsive geometry and browser navigation checked separately','No actual e-mail, PDF service, external navigation or database operation']},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

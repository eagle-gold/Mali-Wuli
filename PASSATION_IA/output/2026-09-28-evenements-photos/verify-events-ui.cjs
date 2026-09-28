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
const api={};for(const method of ['get','post','delete','patch'])api[method]=async(url,body,config)=>{const call={method:method.toUpperCase(),url,...(method==='get'?{config:body}:{body,config})};calls.push(call);return{data:await apiResult(call)}};
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
 },console,Date:FixtureDate,Intl,URL:FixtureURL,URLSearchParams,AbortController,FormData,File,Blob,setTimeout,clearTimeout,window:{setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},location:{origin:'https://fixture.invalid'}}});
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
const evenement={id:'event-fixture',titre:'Rencontre du réseau',description:'Une rencontre proposée par un membre.',type:'PRESENTIEL',lieu:'Salle publique',ville:'Bamako',pays:'Mali',fuseauHoraire:'Africa/Bamako',dateDebut:'2026-10-01T18:00:00Z',dateFin:'2026-10-01T21:00:00Z',capacite:10,photoCouverture:null,programme:[{heure:'18:00',libelle:'Accueil'}],resume:null,valide:true,statut:'VALIDE',nbParticipants:4,estInscrit:false,estProprietaire:false,estPasse:false,peutModifier:false,peutAjouterPhotos:false,peutModerer:false,organisateur:{id:'profil-organisateur',prenom:'Awa',nom:'Diarra',nomComplet:'Awa Diarra'}};
const photo={id:'photo-fixture',url:'/uploads/photo-fixture.jpg',legende:'Une rencontre',createdAt:'2026-09-01T12:00:00Z',auteur:evenement.organisateur,peutSupprimer:false};
const detail={evenement,participants:[evenement.organisateur],totalParticipants:4,photos:[photo],totalPhotos:1};
async function main(){
 const upload=load('components/evenements/photos-upload.ts');
 assert.equal(upload.erreurPhoto({type:'image/jpeg',size:10*1024*1024}),null);
 for(const file of [{type:'image/png',size:10*1024*1024+1},{type:'image/gif',size:123},{type:'image/webp',size:0}])assert(upload.erreurPhoto(file));
 let active=0,maxActive=0;const outcomes=[];
 const result=await upload.envoyerPhotosEnSerie([1,2,3],async n=>{active++;maxActive=Math.max(maxActive,active);await settle();active--;if(n===2)throw Error('fixture failure');return n;},{doitArreter:()=>false,resultat:(p,r)=>outcomes.push([p,r.ok])});
 assert.equal(maxActive,1);assert.deepEqual(clean(result),{envoyees:2,echouees:1,nonEnvoyees:0});assert.deepEqual(outcomes,[[1,true],[2,false],[3,true]]);
 let stop=false;const sent=[];
 const cancelled=await upload.envoyerPhotosEnSerie([1,2,3],async n=>{sent.push(n);stop=true;return n;},{doitArreter:()=>stop,resultat(){}});
 assert.deepEqual(sent,[1]);assert.deepEqual(clean(cancelled),{envoyees:1,echouees:0,nonEnvoyees:2});
 checks.push('photo-validation-10MiB-JPEG-PNG-WebP-and-sequential-partial-failure-cancellation');

 const ui=load('components/evenements/EvenementUi.tsx');
 const dateHtml=renderToStaticMarkup(React.createElement(ui.DateEvenement,{evenement:{...evenement,dateDebut:'2026-10-01T00:30:00Z',fuseauHoraire:'America/New_York'},grand:true}));
 assert(dateHtml.includes('30'));assert(dateHtml.includes('sept'));assert(!dateHtml.includes('oct'));
 checks.push('date-tile-uses-event-timezone-at-month-boundary');

 const ph=harness();const participation=load('components/evenements/EvenementUi.tsx',{react:ph.react});let refresh=0;
 const props={evenement,actualiser(){refresh++;}};apiResult=async()=>({estInscrit:true});
 let tree=ph.render(participation.ParticipationEvenement,props);button(tree,'Je participe').props.onClick();await settle();
 assert.equal(calls.at(-1).url,'/evenements/event-fixture/participer');assert.equal(calls.at(-1).method,'POST');assert.equal(refresh,1);
 tree=ph.render(participation.ParticipationEvenement,{...props,evenement:{...evenement,estInscrit:true,nbParticipants:10}});assert(!button(tree,'Annuler').props.disabled);button(tree,'Annuler').props.onClick();await settle();assert.equal(calls.at(-1).method,'DELETE');
 tree=ph.render(participation.ParticipationEvenement,{...props,evenement:{...evenement,nbParticipants:10}});assert(button(tree,'Complet').props.disabled);
 for(const changed of [{statut:'EN_ATTENTE'},{estProprietaire:true},{dateDebut:'2026-09-28T11:00:00Z',dateFin:'2026-09-28T13:00:00Z'}]){tree=ph.render(participation.ParticipationEvenement,{...props,evenement:{...evenement,...changed}});assert(!button(tree,'Je participe'));assert(!button(tree,'Annuler'));}
 tree=ph.render(participation.ParticipationEvenement,{...props,evenement:{...evenement,dateDebut:'2026-09-28T11:00:00Z',dateFin:null,estPasse:false}});assert(label(tree).includes('Voir le résumé'));assert(!label(tree).includes('en cours'));
 tree=ph.render(participation.ParticipationEvenement,{...props,lienPasse:false,evenement:{...evenement,dateDebut:'2026-09-28T09:00:00Z',dateFin:'2026-09-28T10:00:00Z',estPasse:false}});assert(label(tree).includes('terminé'));
 checks.push('participation-POST-DELETE-capacity-owner-pending-start-and-local-end-boundaries');

 const lh=harness({0:'passes',1:{pays:'Mali',ville:'Bamako',type:'PRESENTIEL',participation:true},3:'rencontre',4:2});
 const list=load('components/evenements/ListeEvenements.tsx',{react:lh.react});
 apiResult=async()=>({evenements:[],meta:{page:2,limite:12,total:14,totalPages:2},compteurs:{aVenir:6,passes:8,aValider:2,mesPropositions:3},facettes:{pays:['Mali'],villes:['Bamako']},peutModerer:false});
 lh.render(list.default);lh.effects()[2]();await settle();
 assert.deepEqual(clean(calls.at(-1).config.params),{q:'rencontre',pays:'Mali',ville:'Bamako',type:'PRESENTIEL',participation:'mes-evenements',statut:'publies',periode:'passes',page:2,limite:12});
 tree=lh.render(list.default);assert(label(tree).includes('Passés · 8'));assert(!label(tree).includes('Espace admin'));assert.equal(nodes(tree).find(n=>n?.type==='input'&&n.props.type==='search').props.maxLength,100);
 button(tree,'Mes propositions').props.onClick();lh.render(list.default);lh.effects()[2]();await settle();assert.equal(calls.at(-1).config.params.statut,'mes');assert.equal(calls.at(-1).config.params.periode,'tous');assert.equal(calls.at(-1).config.params.participation,undefined);assert.equal(calls.at(-1).config.params.page,1);
 checks.push('list-real-counts-filters-pagination-and-own-proposals-all-dates');

 const ah=harness();const album=load('components/evenements/AlbumEvenement.tsx',{react:ah.react});
 const ap={evenementId:evenement.id,photosInitiales:[photo],totalInitial:1,peutAjouterPhotos:false,actualiser(){}};
 tree=ah.render(album.default,ap);assert(!button(tree,'Ajouter des photos'));assert(!nodes(tree).some(n=>n?.type==='input'&&n.props.type==='file'));
 nodes(tree).find(n=>n?.type==='button'&&n.props['aria-label']?.startsWith('Agrandir')).props.onClick();tree=ah.render(album.default,ap);assert(!button(tree,'Supprimer cette photo'));
 const dh=harness({11:{...photo,peutSupprimer:true}});const deleteAlbum=load('components/evenements/AlbumEvenement.tsx',{react:dh.react});
 tree=dh.render(deleteAlbum.default,ap);const beforeDelete=calls.length;button(tree,'Supprimer cette photo').props.onClick();assert.equal(calls.length,beforeDelete);tree=dh.render(deleteAlbum.default,ap);assert(button(tree,'Conserver la photo'));apiResult=async()=>({});button(tree,'Confirmer la suppression').props.onClick();await settle();assert.equal(calls.at(-1).method,'DELETE');assert.equal(calls.at(-1).url,'/evenements/event-fixture/photos/photo-fixture');assert.equal(dh.state[11],null);
 checks.push('album-upload-and-delete-rights-and-local-deletion-confirmation');

 const uh=harness();const uploadAlbum=load('components/evenements/AlbumEvenement.tsx',{react:uh.react});const up={...ap,peutAjouterPhotos:true};
 tree=uh.render(uploadAlbum.default,up);nodes(tree).find(n=>n?.type==='input'&&n.props.type==='file').props.onChange({target:{files:[new File(['imageA'],'a.jpg',{type:'image/jpeg'}),new File(['imageB'],'b.png',{type:'image/png'})],value:'files'}});
 tree=uh.render(uploadAlbum.default,up);assert(button(tree,'Envoyer 2 photos'));let resolveUpload;const beforeUpload=calls.length;apiResult=()=>new Promise(resolve=>{resolveUpload=resolve;});button(tree,'Envoyer 2 photos').props.onClick();await settle();assert.equal(calls.length,beforeUpload+1);assert.equal(calls.at(-1).url,'/evenements/event-fixture/photos');assert.equal(calls.at(-1).body.get('photo').name,'a.jpg');
 tree=uh.render(uploadAlbum.default,up);button(tree,'Arrêter après').props.onClick();resolveUpload({photo});await settle();assert.equal(calls.length,beforeUpload+1);assert.equal(uh.state[7][0].statut,'ENVOYEE');assert.equal(uh.state[7][1].statut,'ANNULEE');
 apiResult=async()=>({photo:{...photo,id:'photo-second'}});tree=uh.render(uploadAlbum.default,up);button(tree,'Envoyer 1 photo').props.onClick();await settle();assert.equal(calls.length,beforeUpload+2);assert.equal(calls.at(-1).body.get('photo').name,'b.png');assert.equal(uh.state[7][0].statut,'ENVOYEE');assert.equal(uh.state[7][1].statut,'ENVOYEE');
 checks.push('album-cancels-remaining-files-after-active-save-and-resume-skips-successes');

 const gh=harness({2:2});const gallery=load('components/evenements/AlbumEvenement.tsx',{react:gh.react});apiResult=async()=>({photos:[],meta:{page:2,limite:24,total:1,totalPages:1}});gh.render(gallery.default,ap);gh.effects()[1]();await settle();assert.equal(calls.at(-1).url,'/evenements/event-fixture/photos');assert.deepEqual(clean(calls.at(-1).config.params),{page:2,limite:24});assert.equal(gh.state[2],1);
 const rh=harness({0:2});const roster=load('components/evenements/ParticipantsEvenement.tsx',{react:rh.react});apiResult=async()=>({participants:[],meta:{page:2,limite:12,total:1,totalPages:1}});rh.render(roster.default,{evenementId:evenement.id,participantsInitiaux:[evenement.organisateur],totalInitial:13});rh.effects()[0]();await settle();assert.equal(calls.at(-1).url,'/evenements/event-fixture/participants');assert.deepEqual(clean(calls.at(-1).config.params),{page:2,limite:12});
 checks.push('album-and-participants-pagination-use-independent-endpoints-and-limits');

 for(const status of [401,403,404,500]){
   const fh=harness({0:{...detail,evenement:{...evenement,peutModifier:true,peutAjouterPhotos:true}},1:false});const fiche=load('components/evenements/FicheEvenement.tsx',{react:fh.react});
   tree=fh.render(fiche.default,{evenementId:evenement.id});apiResult=async()=>{throw{response:{status}}};fh.effects()[1]();await settle();
   if(status===500){assert(fh.state[0]);tree=fh.render(fiche.default,{evenementId:evenement.id});assert(label(tree).includes(evenement.titre));}
   else {assert.equal(fh.state[0],null);tree=fh.render(fiche.default,{evenementId:evenement.id});assert(!label(tree).includes(evenement.titre));assert(!button(tree,'Ajouter une couverture'));}
 }
 checks.push('detail-revoked-access-removes-data-and-controls-transient-errors-keep-album-mounted');

 const ch=harness({0:detail,1:false});const contact=load('components/evenements/FicheEvenement.tsx',{react:ch.react});apiResult=async()=>({conversationId:'conversation-fixture'});const beforeContact=calls.length;tree=ch.render(contact.default,{evenementId:evenement.id});assert.equal(calls.length,beforeContact);button(tree,'Contacter').props.onClick();await settle();assert.deepEqual(clean(calls.at(-1).body),{destinataireId:'profil-organisateur'});assert.equal(calls.at(-1).url,'/messages/conversations');assert.equal(navigations.at(-1),'/messages?conversation=conversation-fixture');
 const owner=harness({0:{...detail,evenement:{...evenement,estProprietaire:true}},1:false});const ownerDetail=load('components/evenements/FicheEvenement.tsx',{react:owner.react});tree=owner.render(ownerDetail.default,{evenementId:evenement.id});assert(!button(tree,'Contacter'));
 checks.push('organizer-contact-created-only-on-click-by-profile-id-no-self-contact');
 console.log(JSON.stringify({status:'passed',checks,simulatedActions:calls.length,networkCalls:0,databaseWrites:0,limitations:['In-memory React hooks, API, router and fixed date; browser geometry and native dialog checked separately','Backend enforces access and upload content validation independently']},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

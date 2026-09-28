/* React/transport in memory only. Does not open a port or touch an application account. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const active='/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend',staging=path.join(__dirname,'staging/frontend/src');
const ts=require(path.join(active,'node_modules/typescript')),React=require(path.join(active,'node_modules/react')),jsx=require(path.join(active,'node_modules/react/jsx-runtime')),{renderToStaticMarkup}=require(path.join(active,'node_modules/react-dom/server'));
const compilerOptions={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true};
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
const text=t=>t==null||typeof t==='boolean'?'':Array.isArray(t)?t.map(text).join(''):typeof t==='object'?text(t.props?.children):String(t);
const button=(t,label)=>nodes(t).find(n=>n.type==='button'&&text(n)===label);
const tick=()=>new Promise(r=>setImmediate(r));
function DeleteMock(p){return p.autorise?React.createElement('button',{'data-delete':p.endpoint},p.libelle):null}
function DetailMock(){return null}
function load(relative,initial={},transport={},options={}){
 const state={...initial},refs={},effects=[],calls=[],urls=[],timers=new Map();
 let timerId=0;
 const api=Object.fromEntries(['get','post','patch','put','delete'].map(method=>[method,async(...args)=>{calls.push({method,args});if(transport[method])return transport[method](...args);return{data:{}}}]));
 const css=new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}),module={exports:{}};
 const navigation={useSearchParams:()=>new URLSearchParams(''),usePathname:()=>'/offres',useRouter:()=>({push(){},replace(){}})};
 const mocks={react:{...React,useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useId:()=>':qa:'},'react/jsx-runtime':jsx,'next/link':({children,...props})=>React.createElement('a',props,children),'next/navigation':navigation,'lucide-react':new Proxy({},{get:(_,n)=>()=>React.createElement('svg',{'data-icon':String(n)})}),
 '@/lib/api':api,'@/lib/community':{messageErreur:(e,f)=>e?.response?.data?.message||f,nomComplet:(p,n)=>`${p||''} ${n||''}`,formaterDate:()=> '28 septembre'},'@/lib/media':{urlMediaBackend:u=>u||null},'@/hooks/useSocket':{useSocket:()=>options.socket||null},
 '@/components/community/SupprimerContenu':DeleteMock,'@/components/community/CommunityUi':{Chargement:()=>null,ErreurChargement:()=>null},'@/lib/autorisations':{aPermission:(u,p)=>u.permissions?.includes(p)},
 '@/lib/offres':{libelleModeTravail:x=>x,libelleTypeOffre:x=>x,lienExterneSur:x=>x,MODES_TRAVAIL:[],TYPES_OFFRE:[],MODES_CANDIDATURE:[]},
 '@/lib/evenements':{formaterDateEvenement:()=> '28 septembre',formaterHeureEvenement:()=> '12h',fuseauEvenement:()=> 'Africa/Bamako',creerCalendrierIcs:()=>''},
 './OffresUi':{dateOffre:()=>'',datePublication:()=>'',EnregistrerOffre:()=>null,initialesEntreprise:()=> 'QA',offreExpiree:()=>false,urlOffre:id=>'/offres/'+encodeURIComponent(id)},'./CandidatureOffre':()=>null,'./DetailOffre':DetailMock,'./CarteOffre':()=>null,
 './AlbumEvenement':()=>null,'./ParticipantsEvenement':()=>null,'./EvenementUi':{AvatarParticipant:()=>null,BadgeFormat:()=>null,DateEvenement:()=>null,ParticipationEvenement:()=>null,StatutEvenement:()=>null,urlFicheEvenement:id=>'/evenements/'+encodeURIComponent(id)},'./photos-upload':{erreurPhoto:()=>null},
 '../directory/DirectoryUi':{AvatarAnnuaire:()=>null,ActionsMembre:()=>null,datePublique:()=>'',lienWebPublic:()=>null,PaginationAnnuaire:()=>null},'./BoutonAffiliation':()=>null};
 const transformer=context=>{const visit=node=>{if(ts.isVariableDeclaration(node)&&node.initializer&&ts.isCallExpression(node.initializer)&&ts.isIdentifier(node.initializer.expression)){
  const call=node.initializer.expression.text;
  if((call==='useState'&&ts.isArrayBindingPattern(node.name))||(call==='useRef'&&ts.isIdentifier(node.name))){const name=call==='useState'?node.name.elements[0].name.text:node.name.text;return ts.factory.updateVariableDeclaration(node,node.name,node.exclamationToken,node.type,ts.factory.createCallExpression(ts.factory.createIdentifier(call==='useState'?'__state':'__ref'),undefined,[ts.factory.createStringLiteral(name),ts.factory.createArrowFunction(undefined,undefined,[],undefined,ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),node.initializer.arguments[0])]))}}
 return ts.visitEachChild(node,visit,context)};return node=>ts.visitNode(node,visit)};
 const file=path.join(staging,relative);let source=fs.readFileSync(file,'utf8');if(relative.endsWith('ActualiteFeed.tsx'))source+='\nexport { CartePublication, CommentaireFil, adapterPublication, retirerCommentaires };';
 const output=ts.transpileModule(source,{compilerOptions,transformers:{before:[transformer]}}).outputText;
 vm.runInNewContext(output,{module,exports:module.exports,URL,AbortController,Intl,Date,Set,Map,console,encodeURIComponent,
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),
  window:{location:{href:'http://localhost:3006/offres?offre=qa'},history:{state:{},replaceState:(_a,_b,url)=>urls.push(url)},matchMedia:()=>({matches:false})},
  __state:(name,init)=>{if(!(name in state))state[name]=init();return[state[name],v=>{state[name]=typeof v==='function'?v(state[name]):v}]},__ref:(name,init)=>refs[name]||(refs[name]={current:init()}),
  require:id=>{if(id.endsWith('.module.css'))return css;assert.ok(id in mocks,'Mock '+id);return mocks[id]}
 },{filename:relative});
 return{state,refs,effects,calls,urls,timers,exports:module.exports,render:(p={})=>module.exports.default(p)};
}
let groups=0;const pass=t=>{groups++;console.log('PASS '+t)};
const base={autorise:true,endpoint:'/publications/qa',libelle:'Supprimer la publication',titre:'Supprimer cette publication ?',consequences:'La publication et ses commentaires seront retirés.'};
const offre={id:'qa',titre:'Offre QA',entreprise:'Équipe QA',pays:'Mali',ville:'Bamako',statutModeration:'EN_ATTENTE',revision:'abc',description:'Une offre fictive',createdAt:'2026-09-28',modeCandidature:'MALI_WULI',peutSupprimer:true,peutModifier:true};
const meta={total:1,page:1,limite:15,totalPages:1};
(async()=>{
 const denied=load('components/community/SupprimerContenu.tsx');assert.equal(denied.render({...base,autorise:false,onSupprime(){}}),null);assert.equal(denied.calls.length,0);
 let resolveDelete,removed=0,resultatRecu;const control=load('components/community/SupprimerContenu.tsx',{}, {delete:()=>new Promise(r=>resolveDelete=r)});let t=control.render({...base,onSupprime:r=>{removed++;resultatRecu=r}});button(t,base.libelle).props.onClick();assert.equal(control.calls.length,0);t=control.render({...base,onSupprime:r=>{removed++;resultatRecu=r}});assert.match(renderToStaticMarkup(t),/Cette action est définitive/);button(t,'Annuler').props.onClick();assert.equal(control.state.confirmation,false);assert.equal(control.calls.length,0);
 button(control.render({...base,onSupprime:r=>{removed++;resultatRecu=r}}),base.libelle).props.onClick();t=control.render({...base,onSupprime:r=>{removed++;resultatRecu=r}});button(t,'Confirmer la suppression').props.onClick();button(t,'Confirmer la suppression').props.onClick();assert.equal(control.calls.length,1);assert.equal(removed,0);assert.equal(control.state.enCours,true);assert.equal(button(control.render({...base,onSupprime:r=>{removed++;resultatRecu=r}}),'Annuler').props.disabled,true);resolveDelete({data:{message:'OK',nbCommentaires:3}});await tick();assert.equal(removed,1);assert.equal(resultatRecu.nbCommentaires,3);assert.equal(control.state.termine,true);pass('explicit confirmation, cancellation without request, pending lock and removal only after success');
 for(const status of [403,409,500]){let deleted=0;const failed=load('components/community/SupprimerContenu.tsx',{confirmation:true},{delete:()=>Promise.reject({response:{status,data:{message:'Conservé QA'}}})});button(failed.render({...base,onSupprime:()=>deleted++}),'Confirmer la suppression').props.onClick();await tick();assert.equal(deleted,0);assert.equal(failed.state.termine,false);assert.match(renderToStaticMarkup(failed.render({...base,onSupprime:()=>deleted++})),/role="alert"/);assert.equal(failed.state.enCours,false)}
 let gone=0;const absent=load('components/community/SupprimerContenu.tsx',{confirmation:true},{delete:()=>Promise.reject({response:{status:404}})});button(absent.render({...base,onSupprime:()=>gone++}),'Confirmer la suppression').props.onClick();await tick();assert.equal(gone,1);pass('403,409 and failure preserve card and permit retry; already-absent 404 removes stale record');
 const feed=load('components/feed/ActualiteFeed.tsx');const raw={id:'post/a',auteur:{user:{prenom:'Awa',nom:'QA'}},contenu:'Test',createdAt:'2026-09-28',intention:'OFFRE'};
 assert.equal(feed.exports.adapterPublication(raw).peutSupprimer,false);const pub=feed.exports.adapterPublication({...raw,peutSupprimer:true});assert.equal(pub.peutSupprimer,true);
 let postRemoved;let card=feed.exports.CartePublication({publication:pub,onSupprime:id=>postRemoved=id,actualiser(){}});const deletion=nodes(card).find(n=>n.type===DeleteMock);assert.equal(deletion.props.endpoint,'/publications/post%2Fa');deletion.props.onSupprime();assert.equal(postRemoved,'post/a');card=feed.exports.CartePublication({publication:{...pub,peutSupprimer:false},onSupprime(){},actualiser(){}});assert.equal(nodes(card).some(n=>n.type===DeleteMock),false);
 const comment={id:'c/a',contenu:'Own comment',createdAt:'2026-09-28',auteur:{user:{prenom:'Awa'}},peutSupprimer:true,reponses:[{id:'reply',contenu:'Reply',createdAt:'2026-09-28',auteur:{user:{prenom:'Samba'}},peutSupprimer:false}]};
 const ct=feed.exports.CommentaireFil({commentaire:comment,publicationId:'post/a',onSupprime(){},repondre(){}});assert.equal(nodes(ct).find(n=>n.type===DeleteMock).props.endpoint,'/publications/post%2Fa/commentaires/c%2Fa');assert.equal(feed.exports.retirerCommentaires([comment],new Set(['c/a'])).length,0);assert.equal(feed.exports.retirerCommentaires([comment],new Set(['reply']))[0].reponses.length,0);pass('feed uses viewer-specific flag, encoded URLs and recursive deletion of comment children');

 const commentRace=load('components/feed/ActualiteFeed.tsx',{reponseOuverte:true});let refreshed=0;
 const pubRace={...pub,reponses:4,commentaires:[comment]};
 const raceCard=commentRace.exports.CartePublication({publication:pubRace,onSupprime(){},actualiser(){refreshed++}});
 const commentNode=nodes(raceCard).find(n=>n.type===commentRace.exports.CommentaireFil);
 // A socket-triggered fetch completed first and has already installed the authoritative count.
 commentRace.state.nombreReponses=3;
 commentNode.props.onSupprime(comment,{nbCommentaires:3});assert.equal(commentRace.state.nombreReponses,3);assert.equal(commentRace.state.commentaires.length,0);assert.equal(refreshed,1);
 commentNode.props.onSupprime(comment,undefined);assert.equal(commentRace.state.nombreReponses,3);assert.equal(refreshed,2);
 commentNode.props.onSupprime(comment,{nbCommentaires:-1});assert.equal(commentRace.state.nombreReponses,3);
 pass('socket count received before HTTP is never decremented twice; 404 or invalid count triggers reread without subtraction');
 const handlers=new Map(),socket={on:(event,fn)=>handlers.set(event,fn),off:(event,fn)=>{if(handlers.get(event)===fn)handlers.delete(event)}};
 let oldRead;
 const liveFeed=load('components/feed/ActualiteFeed.tsx',{publications:[pub]}, {get:url=>url==='/publications'?new Promise(resolve=>{oldRead=resolve}):Promise.resolve({data:{}})}, {socket});
 liveFeed.render();const stopRead=liveFeed.effects[0](),stopSocket=liveFeed.effects[2]();
 handlers.get('publication_supprimee')({publicationId:pub.id});assert.equal(liveFeed.state.publications.length,0);assert.ok(liveFeed.refs.publicationsSupprimees.current.has(pub.id));
 handlers.get('publication:deleted')({publicationId:pub.id});assert.equal(liveFeed.timers.size,1);
 oldRead({data:{publications:[{...raw,peutSupprimer:true},{...raw,id:'remaining'}]}});await tick();assert.deepEqual(Array.from(liveFeed.state.publications,p=>p.id),['remaining']);
 [...liveFeed.timers.values()][0]();await tick();assert.ok(liveFeed.calls.some(c=>c.args[0]==='/users/me'));stopRead();stopSocket();assert.equal(handlers.has('publication_supprimee'),false);assert.equal(handlers.has('publication:deleted'),false);
 pass('both remote deletion socket aliases mark tombstones before stale GET, coalesce rereads and refresh panels');

 const listing=load('components/offres/OffresPage.tsx',{selection:{id:'qa',origine:'lien'},detail:offre,mobileDetail:true,chargement:false,data:{offres:[offre],meta,compteurs:{actives:0,enAttente:1,mesOffres:1,enregistrees:0},facettes:{pays:[],villes:[],secteurs:[]}}});const pageTree=listing.render();nodes(pageTree).find(n=>n.type===DetailMock).props.onSupprime('qa');assert.equal(listing.state.detail,null);assert.equal(listing.state.selection,null);assert.equal(listing.state.mobileDetail,false);assert.equal(listing.state.data.offres.length,0);assert.equal(listing.state.data.meta.total,0);assert.equal(listing.state.revision,1);assert.ok(listing.urls.at(-1)==='/offres');assert.ok(listing.refs.offresSupprimees.current.has('qa'));pass('offer deletion removes list/detail/mobile selection, clears deep link and reloads authoritative counters');
 const event={...offre,type:'PRESENTIEL',statut:'EN_ATTENTE',dateDebut:'2026-10-18T10:00:00Z',nbParticipants:0,peutSupprimer:true};
 for(const [file,initial,props,stateName] of [
  ['components/associations/FicheAssociation.tsx',{data:{association:{id:'asso',nom:'Association QA',pays:'Mali',nbMembres:0,peutSupprimer:true},membres:[],totalMembres:0,totalPagesMembres:0},chargement:false},{associationId:'asso'},'supprimee'],
  ['components/evenements/FicheEvenement.tsx',{data:{evenement:event,photos:[],participants:[],totalPhotos:0,totalParticipants:0},chargement:false},{evenementId:'qa'},'supprime'],
 ]){const h=load(file,initial);const d=nodes(h.render(props)).find(n=>n.type===DeleteMock);assert.ok(d);d.props.onSupprime();assert.equal(h.state[stateName],true);const html=renderToStaticMarkup(h.render(props));assert.match(html,/role="status"/);assert.doesNotMatch(html,/data-delete=/)}
 pass('association and event deletion replace the full fiche with a success message and return link');
 for(const [file,plural,item,counter] of [['components/offres/AdminOffres.tsx','offres',offre,'enAttente'],['app/(admin)/admin/evenements/page.tsx','evenements',event,'aValider']]){
  const h=load(file,{autorise:true,chargement:false,donnees:{[plural]:[item],meta,compteurs:{[counter]:1}}});const d=nodes(h.render()).find(n=>n.type===DeleteMock);assert.ok(d);d.props.onEnCours(true);assert.equal(h.refs.verrou.current,true);assert.equal(h.state.actionId,item.id);d.props.onEnCours(false);d.props.onSupprime();assert.equal(h.state.donnees[plural].length,0);assert.equal(h.state.donnees.compteurs[counter],0);assert.equal(h.state.revision,1);assert.ok(h.refs.supprimes.current.has(item.id));
 }
 pass('pending moderation views expose delete only from flag, lock concurrent validation, remove card and refresh counts');
 console.log(JSON.stringify({groups,network:false,database:false}));
})().catch(e=>{console.error(e);process.exitCode=1});

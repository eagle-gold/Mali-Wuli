/* Source checks with in-memory browser, Axios transport and React hooks. No network or account. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const active='/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend';
const staging=path.join(__dirname,'staging/frontend/src');
const ts=require(path.join(active,'node_modules/typescript')),React=require(path.join(active,'node_modules/react')),jsx=require(path.join(active,'node_modules/react/jsx-runtime'));
const {renderToStaticMarkup}=require(path.join(active,'node_modules/react-dom/server'));
const compilerOptions={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true};
const tick=()=>new Promise(r=>setImmediate(r));
let groups=0;const pass=t=>{groups++;console.log('PASS '+t)};
function harness(token=''){
 const documentListeners=new Map();
 const storage=new Map(token?[['mali_wuli_token',token],['mali_wuli_user_id','qa']]:[]),listeners=new Map(),redirects=[],calls=[];
 const window={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{href:'/'},addEventListener:(k,fn)=>{if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(fn)},removeEventListener:(k,fn)=>listeners.get(k)?.delete(fn),dispatchEvent:e=>{for(const fn of [...listeners.get(e.type)||[]])fn(e);return true}};
 const document={visibilityState:'visible',addEventListener:(k,fn)=>{if(!documentListeners.has(k))documentListeners.set(k,new Set());documentListeners.get(k).add(fn)},removeEventListener:(k,fn)=>documentListeners.get(k)?.delete(fn),dispatchEvent:e=>{for(const fn of [...documentListeners.get(e.type)||[]])fn(e);return true}};
 let requestInterceptor,responseError;
 const api={interceptors:{request:{use:fn=>requestInterceptor=fn},response:{use:(_ok,fn)=>responseError=fn}},get:(url,options={})=>{const config=requestInterceptor({url,headers:{},...options});return new Promise((resolve,reject)=>calls.push({config,resolve,reject})).catch(e=>responseError({...e,config}));}};
 const router={replace:to=>redirects.push(to),push:to=>redirects.push(to)};
 const common={axios:{create:()=>api},'next/navigation':{usePathname:()=>currentPath,useRouter:()=>router},'next/link':({children,...props})=>React.createElement('a',props,children),'react/jsx-runtime':jsx,'lucide-react':new Proxy({},{get:(_,key)=>()=>React.createElement('svg',{'data-icon':String(key)})})};
 Object.assign(common,{'@/components/LogoMaliWuliImage':{__esModule:true,default:()=>null,LogoArbreImage:()=>null},'next/image':({priority,unoptimized,...props})=>React.createElement('img',props),'@/components/notifications/NotificationsPopover':()=>null,'@/hooks/useSocket':{useSocket:()=>null,fermerSocket(){}},'@/lib/autorisations':{aAccesAdministration:()=>false},'@/lib/media':{urlMediaBackend:url=>url}});
 let currentPath='/dashboard';
 const cache={};
 function load(relative,extra={}){
  const state={},refs={},effects=[];
  const transformer=context=>{const visit=node=>{
   if(ts.isVariableDeclaration(node)&&node.initializer&&ts.isCallExpression(node.initializer)&&ts.isIdentifier(node.initializer.expression)){
    const call=node.initializer.expression.text;
    if((call==='useState'&&ts.isArrayBindingPattern(node.name))||(call==='useRef'&&ts.isIdentifier(node.name))){
     const name=call==='useState'?node.name.elements[0].name.text:node.name.text;
     return ts.factory.updateVariableDeclaration(node,node.name,node.exclamationToken,node.type,ts.factory.createCallExpression(ts.factory.createIdentifier(call==='useState'?'__state':'__ref'),undefined,[ts.factory.createStringLiteral(name),ts.factory.createArrowFunction(undefined,undefined,[],undefined,ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),node.initializer.arguments[0])]));
    }
   }
   return ts.visitEachChild(node,visit,context);
  };return node=>ts.visitNode(node,visit)};
  const module={exports:{}},mocks={...common,react:{...React,useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useMemo:fn=>fn(),useId:()=>':test:'},'@/lib/api':api,...extra};
  const file=fs.existsSync(path.join(staging,relative))?path.join(staging,relative):path.join(active,'src',relative);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions,transformers:{before:[transformer]}}).outputText;
  vm.runInNewContext(output,{module,exports:module.exports,window,document,Event,AbortController,URL,Intl,Date,console,process:{env:{}},
   __state:(name,init)=>{if(!(name in state)){const value=init();state[name]=typeof value==='function'?value():value;}return[state[name],v=>state[name]=typeof v==='function'?v(state[name]):v]},
   __ref:(name,init)=>refs[name]||(refs[name]={current:init()}),
   require:id=>{if(id in mocks)return mocks[id];if(id.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});if(id==='@/lib/session')return cache.session;if(id==='./SessionMembreContext')return cache.context;if(id==='@/components/auth/SessionMembreContext')return {useSessionMembre:()=>null};if(id==='./landing-data'||id==='./tree-geometry')return load('components/landing/'+id.slice(2)+'.ts').exports;throw Error('Unmocked '+id);}
  },{filename:relative});
  return{exports:module.exports,state,refs,effects,render:props=>module.exports.default(props),hook:()=>module.exports.useSessionAccueil()};
 }
 cache.session=load('lib/session.ts').exports;cache.context=load('components/auth/SessionMembreContext.tsx').exports;load('lib/api.ts');
 return{setPath:path=>{currentPath=path},window,document,documentListeners,listeners,storage,calls,redirects,load,api,session:cache.session,reject401:call=>call.reject({response:{status:401}}),emit:type=>window.dispatchEvent(new Event(type))};
}
const valid={id:'qa',statut:'VALIDE',profil:{onboardingFini:true}};
async function performanceTests(){
 const h=harness('same'),guard=h.load('components/auth/PlatformAuthGuard.tsx');
 guard.render({children:'PRIVATE'});let cleanup=guard.effects.at(-1)();
 assert.equal(h.calls[0].config.url,'/users/me/session');
 h.calls[0].resolve({data:{...valid,permissions:['OFFRES_MODERER']}});await tick();
 assert.match(renderToStaticMarkup(guard.render({children:'PRIVATE'})),/PRIVATE/);
 cleanup();h.setPath('/offres');
 const before=guard.render({children:'NEW_PAGE'});assert.match(renderToStaticMarkup(before),/NEW_PAGE/);
 assert.equal(h.calls.length,1);cleanup=guard.effects.at(-1)();
 assert.equal(h.calls.length,2);assert.match(renderToStaticMarkup(guard.render({children:'NEW_PAGE'})),/NEW_PAGE/);
 h.emit('focus');h.emit('pageshow');h.document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(h.calls.length,2,'overlapping same-token lifecycle events join pending check');
 h.calls[1].resolve({data:{...valid,permissions:[]}});await tick();
 assert.equal(guard.state.sessionVerifiee.compte.permissions.length,0);
 assert.match(renderToStaticMarkup(guard.render({children:'NEW_PAGE'})),/NEW_PAGE/);
 h.emit('focus');h.calls[2].reject({message:'network unavailable'});await tick();
 assert.match(renderToStaticMarkup(guard.render({children:'NEW_PAGE'})),/NEW_PAGE/);assert.equal(h.storage.get('mali_wuli_token'),'same');
 h.emit('focus');h.calls[3].reject({response:{status:403,data:{message:'Votre compte est suspendu.'}}});await tick();
 const denied=renderToStaticMarkup(guard.render({children:'NEW_PAGE'}));assert.doesNotMatch(denied,/NEW_PAGE/);assert.match(denied,/Votre compte est suspendu/);assert.equal(guard.state.sessionVerifiee,null);cleanup();
 pass('same-token navigation keeps layout and page mounted while lightweight check runs; coalesced lifecycle, fresh permissions and403 suspension');

 for(const status of [401,403]){
  const h=harness('old'),g=h.load('components/auth/PlatformAuthGuard.tsx');g.render({children:'OLD_ACCOUNT'});const clean=g.effects.at(-1)();h.calls[0].resolve({data:valid});await tick();g.render({children:'OLD_ACCOUNT'});
  h.emit('focus');h.storage.set('mali_wuli_token','new');assert.doesNotMatch(renderToStaticMarkup(g.render({children:'OLD_ACCOUNT'})),/OLD_ACCOUNT/);
  h.emit(h.session.EVENEMENT_SESSION);assert.equal(h.calls[1].config.signal.aborted,true);assert.equal(h.calls.length,3);
  h.calls[1].reject({response:{status}});await tick();assert.equal(h.storage.get('mali_wuli_token'),'new');assert.equal(h.redirects.length,0);
  h.calls[2].resolve({data:{...valid,id:'new-user'}});await tick();assert.equal(g.state.sessionVerifiee.compte.id,'new-user');assert.match(renderToStaticMarkup(g.render({children:'NEW_ACCOUNT'})),/NEW_ACCOUNT/);clean();
 }
 const expires=harness('active'),expiredGuard=expires.load('components/auth/PlatformAuthGuard.tsx');expiredGuard.render({children:'PRIVATE'});const clean=expiredGuard.effects.at(-1)();expires.calls[0].resolve({data:valid});await tick();expires.emit('focus');expires.reject401(expires.calls[1]);await tick();assert.doesNotMatch(renderToStaticMarkup(expiredGuard.render({children:'PRIVATE'})),/PRIVATE/);assert.equal(expires.storage.has('mali_wuli_token'),false);clean();
 pass('changed token hides old account immediately; old403/401 cannot erase new identity; actual401 removes the validated layout');

 const redirects=harness('token'),g=redirects.load('components/auth/PlatformAuthGuard.tsx');g.render({children:'PRIVATE'});let cleanRoute=g.effects.at(-1)();redirects.calls[0].resolve({data:valid});await tick();cleanRoute();redirects.setPath('/evenements');g.render({children:'EVENTS'});cleanRoute=g.effects.at(-1)();redirects.calls[1].resolve({data:{...valid,statut:'EN_ATTENTE'}});await tick();assert.deepEqual(redirects.redirects,['/profil']);assert.doesNotMatch(renderToStaticMarkup(g.render({children:'EVENTS'})),/EVENTS/);cleanRoute();
 const incomplete=harness('token'),inc=incomplete.load('components/auth/PlatformAuthGuard.tsx');inc.render({children:'PRIVATE'});const stop=inc.effects.at(-1)();incomplete.calls[0].resolve({data:{...valid,profil:null}});await tick();assert.deepEqual(incomplete.redirects,['/onboarding']);assert.doesNotMatch(renderToStaticMarkup(inc.render({children:'PRIVATE'})),/PRIVATE/);stop();
 pass('background status change still redirects pending accounts and missing onboarding never admits private content');

 let refresh=0;const header=harness('token'),socketListeners=new Map(),socket={on:(event,fn)=>socketListeners.set(event,fn),off:event=>socketListeners.delete(event)};
 const hc=header.load('components/MaliWuliHeader.tsx',{'@/components/auth/SessionMembreContext':{useSessionMembre:()=>({compte:{...valid,prenom:'Awa',nom:'Diarra',permissions:['OFFRES_MODERER'],profil:{onboardingFini:true,photo:'/avatar-new.jpg'}},actualiser:()=>refresh++})},'@/hooks/useSocket':{useSocket:()=>socket,fermerSocket(){}}});
 hc.exports.MemberHeader();const headerCleanup=hc.effects.map(effect=>effect());
 assert.equal(header.calls.length,1);assert.equal(header.calls[0].config.url,'/messages/conversations');assert.equal(hc.state.nomProfil,'Awa Diarra');assert.equal(hc.state.photoProfil,'/avatar-new.jpg');assert.deepEqual(hc.state.autorisations.permissions,['OFFRES_MODERER']);
 socketListeners.get('connect')();assert.equal(refresh,1);assert.ok(header.calls.every(call=>call.config.url==='/messages/conversations'));
 headerCleanup.forEach(fn=>fn?.());
 const standalone=harness('token'),sh=standalone.load('components/MaliWuliHeader.tsx');sh.exports.MemberHeader();const standaloneCleanup=sh.effects.map(effect=>effect());assert.ok(standalone.calls.some(call=>call.config.url==='/users/me/session'));assert.ok(!standalone.calls.some(call=>call.config.url==='/users/me'));standaloneCleanup.forEach(fn=>fn?.());
 pass('member header consumes shared identity/photo/permissions without duplicate profile GET; reconnect delegates refresh; onboarding uses light endpoint');

 const layoutSource=fs.readFileSync(path.join(staging,'app/(platform)/layout.tsx'),'utf8');assert.doesNotMatch(layoutSource,/<a\s/);assert.match(layoutSource,/<Link/);assert.match(fs.readFileSync(path.join(staging,'app/(platform)/loading.tsx'),'utf8'),/role="status"/);
 pass('bottom navigation stays client-side and route loading boundary preserves the validated shell');

 const source=fs.readFileSync(path.join(staging,'components/profile/ProfilMembre.tsx'),'utf8');const parsed=ts.createSourceFile('ProfilMembre.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let declaration;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(parsed)==='chargerDonnees')declaration=n;ts.forEachChild(n,visit)}visit(parsed);assert.ok(declaration);
 const state={},pending=[],counter={current:0},set=name=>value=>{state[name]=value};
 const mod={exports:{}};const compiled=ts.transpileModule('export const chargerDonnees = '+declaration.initializer.getText(parsed),{compilerOptions}).outputText;
 vm.runInNewContext(compiled,{module:mod,exports:mod.exports,useCallback:fn=>fn,numeroRequete:counter,api:{get:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject}))},messageErreurApi:(_e,msg)=>msg,setChargementProfil:set('loadingProfile'),setChargementSuggestions:set('loadingSuggestions'),setErreurProfil:set('profileError'),setErreurSuggestions:set('suggestionError'),setUtilisateur:set('user'),setSuggestionsApi:set('suggestions')});
 const work=mod.exports.chargerDonnees();assert.equal(pending.length,2);pending.find(p=>p.url==='/users/me').resolve({data:{id:'qa',profil:{linkedin:'https://linkedin.com/in/qa'}}});await tick();assert.equal(state.loadingProfile,false);assert.equal(state.loadingSuggestions,true);assert.equal(state.user.id,'qa');
 pending.find(p=>p.url==='/synergies/suggestions').reject(new Error('slow failure'));await work;assert.equal(state.loadingProfile,false);assert.equal(state.loadingSuggestions,false);assert.equal(state.user.id,'qa');assert.match(state.suggestionError,/temporairement/);
 const late=mod.exports.chargerDonnees();counter.current++;pending[2].resolve({data:{id:'stale'}});pending[3].resolve({data:{suggestions:[]}});await late;assert.equal(state.user.id,'qa');
 pass('profile displays before delayed suggestions settle; suggestion failure and stale unmounted response cannot replace profile');
}
(async()=>{
 const routes=harness().session;
 for(const profil of [undefined,null,{}, {onboardingFini:false}])assert.equal(routes.destinationSession({statut:'VALIDE',profil},'/offres'),'/onboarding');
 assert.equal(routes.destinationSession({...valid,statut:'EN_ATTENTE'},'/offres'),'/profil');
 assert.equal(routes.destinationSession(valid,'/evenements'),'/evenements');
 assert.equal(routes.destinationSession({user:valid},'/profil'),'/profil');
 pass('destinations preserve mandatory onboarding, validation and requested member page');

 for(const passive of [false,true]){
  const h=harness('current');const p=h.api.get('/users/me',{sessionPassive:passive}).catch(()=>{});h.reject401(h.calls[0]);await p;
  assert.equal(h.storage.has('mali_wuli_token'),false);assert.equal(h.storage.has('mali_wuli_user_id'),false);assert.equal(h.window.location.href,passive?'/':'/login');
 }
 const old=harness('old');const p=old.api.get('/users/me').catch(()=>{});old.storage.set('mali_wuli_token','new');old.reject401(old.calls[0]);await p;assert.equal(old.storage.get('mali_wuli_token'),'new');assert.equal(old.window.location.href,'/');
 const anon=harness();const anonP=anon.api.get('/users/me').catch(()=>{});anon.storage.set('mali_wuli_token','new');anon.reject401(anon.calls[0]);await anonP;assert.equal(anon.storage.get('mali_wuli_token'),'new');assert.equal(anon.window.location.href,'/');
 const login=harness('current');const lp=login.api.get('/auth/login').catch(()=>{});login.reject401(login.calls[0]);await lp;assert.equal(login.storage.get('mali_wuli_token'),'current');
 pass('current 401 expires token, passive stays home, stale and auth-route 401 cannot erase newer session');

 const visitor=harness(),vh=visitor.load('hooks/useSessionAccueil.ts');assert.equal(vh.hook().etat,'loading');assert.equal(visitor.calls.length,0);const vc=vh.effects[0]();assert.equal(vh.state.session.etat,'visitor');assert.equal(visitor.calls.length,0);vc();
 const h=harness('verified'),hook=h.load('hooks/useSessionAccueil.ts');hook.hook();const cleanup=hook.effects[0]();assert.equal(hook.state.session.etat,'loading');assert.equal(h.calls[0].config.sessionPassive,true);h.calls[0].resolve({data:valid});await tick();assert.equal(hook.state.session.etat,'authenticated');
 h.emit('focus');h.calls[1].reject({message:'offline'});await tick();assert.equal(hook.state.session.etat,'authenticated');assert.equal(h.storage.get('mali_wuli_token'),'verified');
 h.emit('focus');h.reject401(h.calls[2]);await tick();assert.equal(hook.state.session.etat,'visitor');assert.equal(h.window.location.href,'/');cleanup();
 pass('home SSR is undetermined; valid session verified once; transient refresh failure retains confirmed session; expiration stays home');

 const network=harness('token'),nh=network.load('hooks/useSessionAccueil.ts');nh.hook();const nc=nh.effects[0]();network.calls[0].reject({response:{status:503}});await tick();assert.equal(nh.state.session.etat,'unavailable');assert.equal(network.storage.get('mali_wuli_token'),'token');assert.equal(network.window.location.href,'/');
 network.emit('online');network.calls[1].resolve({data:valid});await tick();assert.equal(nh.state.session.etat,'authenticated');nc();
 pass('initial network failure preserves token and offers retry; online recovery verifies the account');

 for(const message of ['Votre compte est suspendu.','Confirmez votre adresse e-mail avant de continuer.','Internal SQL secret']){
  const denied=harness('suspended'),dh=denied.load('hooks/useSessionAccueil.ts');dh.hook();const dc=dh.effects[0]();denied.calls[0].reject({response:{status:403,data:{message}}});await tick();assert.equal(dh.state.session.etat,'unavailable');assert.equal(denied.storage.get('mali_wuli_token'),'suspended');assert.equal(denied.window.location.href,'/');assert.equal(dh.state.session.refusAcces,message==='Internal SQL secret'?'Ce compte ne peut pas accéder au réseau pour le moment.':message);
  const home=denied.load('components/landing/LandingArbre.tsx',{'@/hooks/useSessionAccueil':{useSessionAccueil:()=>({...dh.state.session,actualiser(){}})},'./LandingTree':()=>null});const html=renderToStaticMarkup(home.render());assert.match(html,/Se connecter avec un autre compte/);assert.match(html,/href="\/login"/);assert.match(html,/role="alert"/);assert.doesNotMatch(html,/Internal SQL secret|Créer mon profil|href="\/register"/);dc();
 }
 pass('403 retains token, exposes only known account reason and provides explicit other-account login');


 for(const stale401 of [false,true]){
  const race=harness('old'),rh=race.load('hooks/useSessionAccueil.ts');rh.hook();const rc=rh.effects[0]();race.storage.set('mali_wuli_token','new');if(stale401)race.reject401(race.calls[0]);else race.calls[0].resolve({data:{...valid,id:'old'}});await tick();assert.equal(race.calls.length,2);assert.equal(rh.state.session.etat,'loading');race.calls[1].resolve({data:{...valid,id:'new'}});await tick();assert.equal(rh.state.session.compte.id,'new');assert.equal(race.storage.get('mali_wuli_token'),'new');assert.equal(race.window.location.href,'/');rc();
 }
 const unmounted=harness('token'),uh=unmounted.load('hooks/useSessionAccueil.ts');uh.hook();const uc=uh.effects[0]();uc();unmounted.calls[0].resolve({data:valid});await tick();assert.equal(uh.state.session.etat,'loading');
 pass('late success and late 401 reread newer token; unmounted requests cannot publish stale account');

 const gh=harness('private'),guard=gh.load('components/auth/PlatformAuthGuard.tsx');guard.render({children:'PRIVATE'});const gc=guard.effects[0]();gh.calls[0].reject({message:'offline'});await tick();assert.equal(gh.redirects.length,0);assert.equal(gh.storage.get('mali_wuli_token'),'private');const offline=renderToStaticMarkup(guard.render({children:'PRIVATE'}));assert.match(offline,/Réessayer/);assert.doesNotMatch(offline,/PRIVATE/);gh.emit('online');gh.calls[1].resolve({data:valid});await tick();assert.match(renderToStaticMarkup(guard.render({children:'PRIVATE'})),/PRIVATE/);gc();
 const gr=harness('old'),rg=gr.load('components/auth/PlatformAuthGuard.tsx');rg.render({children:'PRIVATE'});const grc=rg.effects[0]();gr.storage.set('mali_wuli_token','new');gr.reject401(gr.calls[0]);await tick();assert.equal(gr.redirects.length,0);assert.equal(gr.window.location.href,'/');gr.calls[1].resolve({data:valid});await tick();assert.match(renderToStaticMarkup(rg.render({children:'PRIVATE'})),/PRIVATE/);grc();
 const incomplete=harness('token'),ig=incomplete.load('components/auth/PlatformAuthGuard.tsx');ig.render({children:'PRIVATE'});const ic=ig.effects[0]();incomplete.calls[0].resolve({data:{statut:'VALIDE',profil:null}});await tick();assert.deepEqual(incomplete.redirects,['/onboarding']);assert.doesNotMatch(renderToStaticMarkup(ig.render({children:'PRIVATE'})),/PRIVATE/);ic();
 pass('private guard fails closed with retry for network, ignores old-token 401 and requires completed onboarding');

 for(const session of [{etat:'loading',compte:null},{etat:'visitor',compte:null},{etat:'unavailable',compte:null},{etat:'authenticated',compte:valid},{etat:'authenticated',compte:{...valid,statut:'EN_ATTENTE'}},{etat:'authenticated',compte:{...valid,profil:null}}]){
  const lh=harness(),landing=lh.load('components/landing/LandingArbre.tsx',{'@/hooks/useSessionAccueil':{useSessionAccueil:()=>({...session,actualiser(){}})},'./LandingTree':()=>null});
  const html=renderToStaticMarkup(landing.render());assert.match(html,new RegExp('data-session-state="'+session.etat+'"'));
  const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]).filter(h=>h.startsWith('/'));
  if(session.etat==='visitor'){assert.ok(hrefs.includes('/login'));assert.ok(hrefs.includes('/register'));assert.ok(hrefs.every(h=>h==='/login'||h==='/register'));}
  else if(session.etat==='authenticated'){
   assert.ok(!hrefs.includes('/login')&&!hrefs.includes('/register'));assert.match(html,/Mon espace/);
   if(!session.compte.profil)assert.ok(hrefs.every(h=>h==='/onboarding'));
   else if(session.compte.statut!=='VALIDE')assert.ok(hrefs.every(h=>h==='/profil'));
   else for(const href of ['/profil','/dashboard','/annuaire','/evenements','/offres'])assert.ok(hrefs.includes(href),href);
  }else{assert.equal(hrefs.length,0);assert.match(html,session.etat==='loading'?/Vérification de la session/:/Vérifier ma session/);assert.match(html,/aria-disabled="true"/);}
 }
 pass('home visitor links preserved; authenticated CTA route by context; SSR and network-indeterminate states cannot send to registration');

 const sameTab=harness(),st=sameTab.load('hooks/useSessionAccueil.ts');st.hook();const stopSameTab=st.effects[0]();let notifications=0;sameTab.window.addEventListener(sameTab.session.EVENEMENT_SESSION,()=>notifications++);
 assert.equal(sameTab.session.enregistrerSession('new-session','new-user'),true);assert.equal(notifications,1);assert.equal(st.state.session.etat,'loading');assert.equal(sameTab.calls.length,1);assert.equal(sameTab.storage.get('mali_wuli_user_id'),'new-user');
 assert.equal(sameTab.session.enregistrerSession('new-session','new-user'),false);assert.equal(notifications,1);assert.equal(sameTab.calls.length,1);
 sameTab.calls[0].resolve({data:valid});await tick();assert.equal(st.state.session.etat,'authenticated');
 assert.equal(sameTab.session.invaliderSessionCourante('old-session'),false);assert.equal(notifications,1);assert.equal(sameTab.storage.get('mali_wuli_token'),'new-session');
 assert.equal(sameTab.session.terminerSession(),true);assert.equal(notifications,2);assert.equal(st.state.session.etat,'visitor');assert.equal(sameTab.session.terminerSession(),false);assert.equal(notifications,2);stopSameTab();
 pass('same-document creation and logout notify immediately once per actual change, with old-token401 protection preserved');

 const restored=harness(),rh=restored.load('hooks/useSessionAccueil.ts');rh.hook();const stopRestore=rh.effects[0]();assert.equal(rh.state.session.etat,'visitor');
 // Reproduce a restored document whose memory predates the authenticated page.
 restored.storage.set('mali_wuli_token','bfcache-new');restored.emit('pageshow');assert.equal(restored.calls.length,1);assert.equal(rh.state.session.etat,'loading');restored.calls[0].resolve({data:valid});await tick();assert.equal(rh.state.session.etat,'authenticated');
 restored.storage.delete('mali_wuli_token');restored.emit('pageshow');assert.equal(rh.state.session.etat,'visitor');stopRestore();assert.equal(restored.listeners.get('pageshow').size,0);
 pass('pageshow refreshes a visitor document restored after login and removes authenticated state restored after logout');

 const tab=harness(),th=tab.load('hooks/useSessionAccueil.ts');th.hook();const stopTab=th.effects[0]();tab.storage.set('mali_wuli_token','tab-a');tab.document.visibilityState='hidden';tab.document.dispatchEvent(new Event('visibilitychange'));assert.equal(tab.calls.length,0);
 tab.document.visibilityState='visible';tab.document.dispatchEvent(new Event('visibilitychange'));assert.equal(tab.calls.length,1);
 tab.storage.set('mali_wuli_token','tab-b');tab.emit('pageshow');assert.equal(tab.calls.length,2);assert.equal(tab.calls[0].config.signal.aborted,true);tab.reject401(tab.calls[0]);await tick();assert.equal(tab.storage.get('mali_wuli_token'),'tab-b');assert.equal(tab.window.location.href,'/');
 tab.calls[1].resolve({data:{...valid,id:'tab-b'}});await tick();assert.equal(th.state.session.compte.id,'tab-b');
 tab.document.dispatchEvent(new Event('visibilitychange'));tab.calls[2].reject({message:'offline'});await tick();assert.equal(th.state.session.etat,'authenticated');assert.equal(tab.storage.get('mali_wuli_token'),'tab-b');
 stopTab();assert.equal(tab.documentListeners.get('visibilitychange').size,0);tab.emit('pageshow');tab.document.dispatchEvent(new Event('visibilitychange'));assert.equal(tab.calls.length,3);
 pass('visible-tab recovery verifies only when visible; overlapping lifecycle requests ignore stale401; network failure and listener cleanup remain safe');

 const publicHeader=harness(),ph=publicHeader.load('components/MaliWuliHeader.tsx');ph.exports.PublicHeader();assert.equal(ph.state.sessionLocalePresente,null);const stopHeader=ph.effects[0]();assert.equal(ph.state.sessionLocalePresente,false);
 publicHeader.session.enregistrerSession('header-session','header-user');assert.equal(ph.state.sessionLocalePresente,true);publicHeader.session.terminerSession();assert.equal(ph.state.sessionLocalePresente,false);
 publicHeader.storage.set('mali_wuli_token','restored-header');publicHeader.emit('pageshow');assert.equal(ph.state.sessionLocalePresente,true);publicHeader.storage.delete('mali_wuli_token');publicHeader.document.dispatchEvent(new Event('visibilitychange'));assert.equal(ph.state.sessionLocalePresente,false);stopHeader();assert.equal(publicHeader.listeners.get(publicHeader.session.EVENEMENT_SESSION).size,0);assert.equal(publicHeader.documentListeners.get('visibilitychange').size,0);
 pass('shared PublicHeader also follows same-document session changes, restored pages and visible-tab changes');

 const writers=[['app/(auth)/login/page.tsx','enregistrerSession'],['app/(auth)/register/details/page.tsx','enregistrerSession'],['app/(auth)/verify-email/page.tsx','terminerSession'],['components/MaliWuliHeader.tsx','terminerSession']];
 for(const [relative,helper] of writers){const source=fs.readFileSync(fs.existsSync(path.join(staging,relative))?path.join(staging,relative):path.join(active,'src',relative),'utf8');assert.match(source,new RegExp(helper+'\\('));assert.doesNotMatch(source,/localStorage\.(?:setItem|removeItem)\("mali_wuli_(?:token|user_id)"/);}
 pass('password and OTP login, account creation, verification transition and explicit logout use the notifying session helpers');

 await performanceTests();
 console.log(JSON.stringify({groups,network:false,database:false,sourceOnly:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

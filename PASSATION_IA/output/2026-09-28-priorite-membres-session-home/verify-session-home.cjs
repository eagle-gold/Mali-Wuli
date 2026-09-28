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
 const storage=new Map(token?[['mali_wuli_token',token],['mali_wuli_user_id','qa']]:[]),listeners=new Map(),redirects=[],calls=[];
 const window={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{href:'/'},addEventListener:(k,fn)=>{if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(fn)},removeEventListener:(k,fn)=>listeners.get(k)?.delete(fn),dispatchEvent:e=>{for(const fn of [...listeners.get(e.type)||[]])fn(e);return true}};
 let requestInterceptor,responseError;
 const api={interceptors:{request:{use:fn=>requestInterceptor=fn},response:{use:(_ok,fn)=>responseError=fn}},get:(url,options={})=>{const config=requestInterceptor({url,headers:{},...options});return new Promise((resolve,reject)=>calls.push({config,resolve,reject})).catch(e=>responseError({...e,config}));}};
 const router={replace:to=>redirects.push(to),push:to=>redirects.push(to)};
 const common={axios:{create:()=>api},'next/navigation':{usePathname:()=>'/dashboard',useRouter:()=>router},'next/link':({children,...props})=>React.createElement('a',props,children),'react/jsx-runtime':jsx,'lucide-react':new Proxy({},{get:(_,key)=>()=>React.createElement('svg',{'data-icon':String(key)})})};
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
  const module={exports:{}},mocks={...common,react:{...React,useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useId:()=>':test:'},'@/lib/api':api,...extra};
  const file=fs.existsSync(path.join(staging,relative))?path.join(staging,relative):path.join(active,'src',relative);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions,transformers:{before:[transformer]}}).outputText;
  vm.runInNewContext(output,{module,exports:module.exports,window,Event,AbortController,URL,Intl,Date,console,process:{env:{}},
   __state:(name,init)=>{if(!(name in state))state[name]=init();return[state[name],v=>state[name]=typeof v==='function'?v(state[name]):v]},
   __ref:(name,init)=>refs[name]||(refs[name]={current:init()}),
   require:id=>{if(id in mocks)return mocks[id];if(id.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});if(id==='@/lib/session')return cache.session;if(id==='./landing-data'||id==='./tree-geometry')return load('components/landing/'+id.slice(2)+'.ts').exports;throw Error('Unmocked '+id);}
  },{filename:relative});
  return{exports:module.exports,state,refs,effects,render:props=>module.exports.default(props),hook:()=>module.exports.useSessionAccueil()};
 }
 cache.session=load('lib/session.ts').exports;load('lib/api.ts');
 return{window,storage,calls,redirects,load,api,session:cache.session,reject401:call=>call.reject({response:{status:401}}),emit:type=>window.dispatchEvent(new Event(type))};
}
const valid={id:'qa',statut:'VALIDE',profil:{onboardingFini:true}};
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
 console.log(JSON.stringify({groups,network:false,database:false,sourceOnly:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

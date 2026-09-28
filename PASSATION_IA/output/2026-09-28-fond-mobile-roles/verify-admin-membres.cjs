/* Source UI contract checks with API/hooks mocked; no network, DB or real account. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const active = '/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend';
const sourceRoot = path.join(__dirname, 'staging/frontend/src');
const ts = require(path.join(active, 'node_modules/typescript'));
const React = require(path.join(active, 'node_modules/react'));
const jsx = require(path.join(active, 'node_modules/react/jsx-runtime'));
const { renderToStaticMarkup } = require(path.join(active, 'node_modules/react-dom/server'));
const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true };
function load(relative, initial = {}, apiMock = {}) {
  const state = { ...initial }, refs = {}, effects = [], calls = [];
  const api = Object.fromEntries(['get', 'post', 'patch', 'put', 'delete'].map((method) => [method, async (...args) => {
    calls.push({ method, args });
    if (apiMock[method]) return apiMock[method](...args);
    throw Error(`Unexpected mocked ${method} ${args[0]}`);
  }]));
  const react = { ...React, useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect: (fn) => effects.push(fn) };
  const css = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) });
  const mocks = { react, 'react/jsx-runtime': jsx,
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    'lucide-react': new Proxy({}, { get: (_, name) => () => React.createElement('svg', { 'data-icon': String(name) }) }),
    '@/lib/api': api, '@/lib/media': { urlMediaBackend: (url) => url || null }, '@/hooks/useCountries': { useCountries: () => [{ code: 'ML', nom: 'Mali' }, { code: 'FR', nom: 'France' }] },
    '@/lib/community': { formaterDate: (value) => value || 'Non précisée', messageErreur: (error, fallback) => error?.response?.data?.message || error?.message || fallback },
  };
  const transformer = (context) => {
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression)) {
        const call = node.initializer.expression.text;
        if ((call === 'useState' && ts.isArrayBindingPattern(node.name)) || (call === 'useRef' && ts.isIdentifier(node.name))) {
          const name = call === 'useState' ? node.name.elements[0].name.text : node.name.text;
          return ts.factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type, ts.factory.createCallExpression(ts.factory.createIdentifier(call === 'useState' ? '__state' : '__ref'), undefined, [ts.factory.createStringLiteral(name), ts.factory.createArrowFunction(undefined, undefined, [], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), node.initializer.arguments[0])]));
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit);
  };
  class MockFormData { constructor() { this.entries = []; } append(...args) { this.entries.push(args); } }
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions, transformers: { before: [transformer] } });
  vm.runInNewContext(outputText, { module, exports: module.exports, require: (id) => { if (id.endsWith('.module.css')) return css; assert.ok(id in mocks, `Missing mock ${id}`); return mocks[id]; },
    __state: (name, init) => { if (!(name in state)) state[name] = init(); return [state[name], (value) => { state[name] = typeof value === 'function' ? value(state[name]) : value; }]; },
    __ref: (name, init) => refs[name] || (refs[name] = { current: init() }),
    FormData: MockFormData, URL, Intl, Date, AbortController, console, encodeURIComponent,
  }, { filename: relative });
  return { render: (props = {}) => module.exports.default(props), state, refs, effects, calls, exports: module.exports };
}

const component='components/admin/GestionMembres.tsx';
const overview='app/(admin)/admin/page.tsx';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const text=tree=>!tree?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&text(n)===label);
const event=()=>({preventDefault(){},currentTarget:{focus(){}}});
const roles=[{code:'MEMBRE',libelle:'Membre',description:'Accès au réseau',attribuable:true},{code:'MODERATEUR',libelle:'Modérateur',description:'Valide inscriptions, offres, événements et catalogue ; consulte signalements.',attribuable:true},{code:'ADMIN',libelle:'Administrateur principal',description:'Propriétaire unique',attribuable:false},{code:'VOLONTAIRE',libelle:'Volontaire (ancien rôle)',description:'Profil',attribuable:false}];
const membre={id:'membre/id',profilId:'profil/id',prenom:'Fatou',nom:'QA',email:'qa@example.invalid',role:'MEMBRE',statut:'VALIDE',emailVerifie:true,onboardingFini:true,createdAt:'2026-09-01T10:00:00Z',updatedAt:'2026-09-01T10:00:00Z',estAdminPrincipal:false,estMoi:false,peutModifierRole:true,raisonProtection:null};
const owner={...membre,id:'owner',email:'owner@example.invalid',role:'ADMIN',estAdminPrincipal:true,estMoi:true,peutModifierRole:true};
const liste={membres:[membre],total:1,page:1,limite:20,totalPages:1};
const base={autorise:true,roles,chargement:false,donnees:liste};
let groups=0;const check=title=>{groups++;console.log('PASS '+title)};
(async()=>{
  for(const role of ['ADMIN','MODERATEUR','MEMBRE']){
    const access=load(component,{}, {get:async url=>({data:url==='/users/me'?{role}:{roles,roleCourant:role,peutGererRoles:role==='ADMIN'}})});
    access.render();await access.effects[0]();await tick();
    assert.equal(access.state.autorise,role==='ADMIN');
    assert.deepEqual(access.calls.map(c=>c.args[0]),role==='ADMIN'?['/users/me','/admin/roles']:['/users/me']);
    access.effects.length=0;access.render();access.effects[1]();await tick();
    if(role!=='ADMIN')assert.equal(access.calls.length,1);
  }
  const denied=load(component,{autorise:false});assert.equal(button(denied.render(),'Modifier le rôle'),undefined);assert.match(renderToStaticMarkup(denied.render()),/réservée à l’administrateur principal/);
  check('ADMIN only; moderators and members never request member list or role catalogue');

  const ui=load(component,{...base,donnees:{...liste,membres:[owner,membre],total:2}});
  const tree=ui.render(),html=renderToStaticMarkup(tree);
  assert.match(html,/Ce compte est protégé/);assert.match(html,/responsable désigné/);assert.equal(nodes(tree).filter(n=>n.type==='button'&&text(n)==='Modifier le rôle').length,1);
  for(const input of nodes(tree).filter(n=>['input','select'].includes(n.type))){assert.ok(nodes(tree).some(n=>n.type==='label'&&n.props.htmlFor===input.props.id),'Every field has a visible label')}
  const selector=nodes(tree).find(n=>n.type==='select'&&n.props.id==='role-membre/id');
  assert.deepEqual(nodes(selector).filter(n=>n.type==='option').map(n=>n.props.value),['MEMBRE','MODERATEUR']);
  assert.equal(nodes(tree).find(n=>n.props?.id==='membres-recherche').props.maxLength,100);
  assert.match(html,/href="\/membres\/profil%2Fid"/);
  check('protected owner has no editing controls; delegation choices, labels and profile links are correct');

  const filtering=load(component,{...base,filtres:{q:'  Fatou QA  ',role:'MEMBRE',statut:'VALIDE'},page:3});
  nodes(filtering.render()).find(n=>n.type==='form').props.onSubmit(event());
  assert.equal(filtering.state.recherche.q,'Fatou QA');assert.equal(filtering.state.recherche.role,'MEMBRE');assert.equal(filtering.state.page,1);assert.equal(filtering.calls.length,0);
  const listing=load(component,{...base,recherche:filtering.state.recherche},{get:async()=>({data:liste})});listing.render();listing.effects[1]();await tick();
  assert.equal(listing.calls[0].args[0],'/admin/membres');assert.equal(listing.calls[0].args[1].params.q,'Fatou QA');assert.equal(listing.calls[0].args[1].params.statut,'VALIDE');
  const empty=load(component,{...base,page:5},{get:async()=>({data:{...liste,membres:[],totalPages:2}})});empty.render();empty.effects[1]();await tick();assert.equal(empty.state.page,2);
  check('filters retain submitted term and reset pagination; empty final page returns to an existing page');

  let finish;const result=new Promise(resolve=>{finish=resolve});
  const change=load(component,{...base,choixRoles:{[membre.id]:'MODERATEUR'}},{patch:async()=>result});
  button(change.render(),'Modifier le rôle').props.onClick(event());assert.equal(change.calls.length,0);
  const conf=button(change.render(),'Confirmer le changement');assert.ok(conf);
  assert.match(renderToStaticMarkup(change.render()),/sessions actuelles seront fermées/);
  conf.props.onClick();conf.props.onClick();assert.equal(change.calls.length,1);
  assert.equal(change.calls[0].args[0],'/admin/membres/membre%2Fid/role');
  assert.equal(change.calls[0].args[1].role,'MODERATEUR');assert.equal(change.calls[0].args[1].expectedRole,'MEMBRE');
  finish({data:{membre:{...membre,role:'MODERATEUR'},message:'Rôle mis à jour'}});await tick();
  assert.equal(change.state.confirmation,null);assert.equal(change.state.revision,1);assert.match(change.state.annonce,/Modérateur/);
  check('role mutation requires explicit confirmation, sends expectedRole and prevents double submission');

  const protectedAction=load(component,{...base,confirmation:{membre:owner,role:'MEMBRE'},donnees:{...liste,membres:[owner]}});
  button(protectedAction.render(),'Confirmer le changement').props.onClick();await tick();assert.equal(protectedAction.calls.length,0);
  const pending=load(component,{...base,donnees:{...liste,membres:[{...membre,peutModifierRole:false,raisonProtection:'Validez le compte',statut:'EN_ATTENTE'}]}});assert.equal(button(pending.render(),'Modifier le rôle'),undefined);assert.match(renderToStaticMarkup(pending.render()),/Validez le compte/);
  const legacy=load(component,{...base,donnees:{...liste,membres:[{...membre,role:'PRESIDENT_CERCLE'}]}});assert.doesNotMatch(text(legacy.render()),/PRESIDENT_CERCLE/); // Stored value may remain in disabled option; label stays neutral.
  check('owner and ineligible accounts cannot be changed even when a stale confirmation exists');

  const conflict=load(component,{...base,confirmation:{membre,role:'MODERATEUR'}},{patch:async()=>{throw{response:{status:409,data:{message:'Le rôle a changé. Actualisez.'}}}},get:async()=>({data:{...liste,membres:[{...membre,role:'MODERATEUR'}]}})});
  button(conflict.render(),'Confirmer le changement').props.onClick();await tick();
  assert.equal(conflict.state.confirmation,null);assert.equal(conflict.state.revision,1);assert.match(conflict.state.erreurAction,/changé/);assert.equal(conflict.state.annonce,'');
  conflict.effects.length=0;conflict.render();conflict.effects[1]();await tick();assert.match(conflict.state.erreurAction,/changé/);
  const failure=load(component,{...base,confirmation:{membre,role:'MODERATEUR'}},{patch:async()=>{throw Error('Échec simulé')}});button(failure.render(),'Confirmer le changement').props.onClick();await tick();assert.equal(failure.state.actionId,null);assert.ok(failure.state.confirmation);assert.equal(failure.state.donnees.membres[0].role,'MEMBRE');
  check('409 reloads the member while keeping explanatory error; other failures remain retryable without fake success');

  for(const role of ['ADMIN','MODERATEUR','MEMBRE',null]){
    const admin=load(overview,{role,chargement:false},{get:async url=>({data:url==='/admin/notifications'?{notifications:[]}:url.startsWith('/admin/inscriptions')?{inscriptions:[]}:url==='/admin/signalements'?{signalements:[]}:{membres:1,enAttente:0,publications:0,commentaires:0,messages:0,synergies:0,rendezVous:0}})});
    const html=renderToStaticMarkup(admin.render());admin.effects[1]();await tick();
    if(role==='MEMBRE'||role===null){assert.equal(admin.calls.length,0);assert.doesNotMatch(html,/href="\/admin\/membres"/)}
    else {assert.ok(admin.calls.some(c=>c.args[0]==='/admin/signalements'));assert.equal(admin.calls.some(c=>c.args[0]==='/admin/stats'),role==='ADMIN');assert.equal(html.includes('href="/admin/membres"'),role==='ADMIN');assert.equal(html.includes('href="/admin/associations"'),role==='ADMIN');assert.match(html,/href="\/admin\/offres"/);assert.match(html,/href="\/admin\/evenements"/)}
  }
  const reports=load(overview,{role:'MODERATEUR',chargement:false,signalements:[{id:'s',cibleType:'PUBLICATION',cibleId:'p',motif:'Motif QA',createdAt:'2026-09-28T12:00:00Z',signaleur:{id:'s1',user:{prenom:'Awa',nom:'QA'}}}]});
  assert.match(renderToStaticMarkup(reports.render()),/Motif QA/);assert.equal(nodes(reports.render()).filter(n=>n.type==='button').length,0);
  check('overview allows moderation endpoints only after guard, keeps stats/roles/associations ADMIN-only and displays reports read-only');
  console.log(JSON.stringify({status:'passed',groups,networkRequests:0,databaseWrites:0,limitations:['Mock API and SSR; mobile geometry checked separately in browser']}));
})().catch(error=>{console.error(error);process.exitCode=1});

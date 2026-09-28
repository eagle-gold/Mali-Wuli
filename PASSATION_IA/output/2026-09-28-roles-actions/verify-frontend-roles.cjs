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
function loadPlain(relative) {
  const module={exports:{}};
  const file=fs.existsSync(path.join(sourceRoot,relative))?path.join(sourceRoot,relative):path.join(active,'src',relative);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions}).outputText,{module,exports:module.exports,Intl,Date,URL,TextEncoder});
  return module.exports;
}
const permissions=loadPlain('lib/autorisations.ts');
const offers=loadPlain('lib/offres.ts');
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
    'next/link': ({ children, ...props }) => React.createElement('a', props, children), 'next/image': ({unoptimized,priority,...props})=>React.createElement('img',props), 'next/navigation': {usePathname:()=>'/dashboard',useRouter:()=>({push(){},replace(){}})}, '@/hooks/useSocket': {useSocket:()=>null,fermerSocket(){}}, '@/components/notifications/NotificationsPopover': ()=>null,
    'lucide-react': new Proxy({}, { get: (_, name) => () => React.createElement('svg', { 'data-icon': String(name) }) }),
    '@/lib/api': api, '@/lib/autorisations': permissions, '@/lib/offres': offers, '@/lib/media': { urlMediaBackend: (url) => url || null }, '@/hooks/useCountries': { useCountries: () => [{ code: 'ML', nom: 'Mali' }, { code: 'FR', nom: 'France' }] },
    '@/lib/evenements': {formaterDateEvenement:v=>v}, '@/lib/community': { formaterDate: (value) => value || 'Non précisée', messageErreur: (error, fallback) => error?.response?.data?.message || error?.message || fallback },
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
const codes=['INSCRIPTIONS','OFFRES','EVENEMENTS','CATALOGUE','ASSOCIATIONS'];
const permissionCodes=['INSCRIPTIONS_GERER','OFFRES_MODERER','EVENEMENTS_MODERER','CATALOGUE_GERER','ASSOCIATIONS_GERER'];
const roles=codes.map((code,i)=>({code,libelle:['Inscriptions','Offres','Événements','Catalogue','Associations'][i],description:'Description QA '+code,attribuable:true,permissions:[permissionCodes[i]]}));
const all=[...permissionCodes,'ROLES_GERER','STATS_CONSULTER','SIGNALEMENTS_CONSULTER'];
const membre={id:'membre/id',profilId:'profil/id',prenom:'Fatou',nom:'QA',email:'qa@example.invalid',role:'MEMBRE',rolesDelegues:[],permissions:[],revisionDroits:'a'.repeat(64),statut:'VALIDE',emailVerifie:true,onboardingFini:true,createdAt:'2026-09-01T10:00:00Z',estAdminPrincipal:false,estMoi:false,peutModifierRole:true,raisonProtection:null};
const owner={...membre,id:'owner',role:'ADMIN',permissions:all,estAdminPrincipal:true,estMoi:true,peutModifierRole:true};
const legacy={...membre,role:'MODERATEUR',permissions:[...permissionCodes.slice(0,4),'SIGNALEMENTS_CONSULTER','CERCLES_GERER']};
const liste={membres:[membre],total:1,page:1,limite:20,totalPages:1};
const base={autorise:true,roles,chargement:false,donnees:liste};
let groups=0;const check=title=>{groups++;console.log('PASS '+title)};
(async()=>{
  assert.equal(permissions.aAccesAdministration({role:'ADMIN'}),false);
  assert.equal(permissions.aAccesAdministration({permissions:['unknown','CERCLES_GERER']}),false);
  for(const p of all)assert.equal(permissions.aAccesAdministration({permissions:[p]}),true);
  assert.equal(permissions.aPermission({permissions:['OFFRES_MODERER']},'ASSOCIATIONS_GERER'),false);
  check('permission helper denies missing/unknown grants and does not infer access from legacy role names');

  for(const compte of [owner,membre,legacy,{...membre,permissions:['OFFRES_MODERER']}]){
    const access=load(component,{}, {get:async url=>({data:url==='/users/me'?compte:{roles,roleCourant:compte.role,permissions:compte.permissions,peutGererRoles:compte===owner}})});
    access.render();access.effects[0]();await tick();
    assert.equal(access.state.autorise,compte===owner);
    assert.deepEqual(access.calls.map(c=>c.args[0]),compte===owner?['/users/me','/admin/roles']:['/users/me']);
  }
  const protectedUI=load(component,{...base,donnees:{...liste,membres:[owner]}});
  assert.match(renderToStaticMarkup(protectedUI.render()),/Administrateur général/);assert.equal(button(protectedUI.render(),'Modifier les rôles'),undefined);
  check('only owner role-management permission loads registry; protected owner is read-only');

  const edit=load(component,base);button(edit.render(),'Modifier les rôles').props.onClick(event());
  let tree=edit.render();const choices=nodes(tree).filter(n=>n.type==='input'&&n.props.type==='checkbox');
  assert.deepEqual(choices.map(n=>n.props.value),codes);assert.equal(choices.length,5);
  for(const input of choices)assert.ok(nodes(tree).some(n=>n.type==='label'&&nodes(n).includes(input)));
  choices[0].props.onChange({target:{checked:true}});choices[1].props.onChange({target:{checked:true}});
  assert.deepEqual(Array.from(edit.state.selection),['INSCRIPTIONS','OFFRES']);
  assert.equal(edit.calls.length,0);button(edit.render(),'Vérifier les changements').props.onClick();
  assert.match(renderToStaticMarkup(edit.render()),/Ajouter/);assert.match(renderToStaticMarkup(edit.render()),/Inscriptions, Offres/);
  check('five labelled checkboxes combine domains; changes are reviewed before any mutation');

  let finish;const pending=new Promise(resolve=>{finish=resolve});
  const save=load(component,{...base,edition:membre,selection:['EVENEMENTS','OFFRES'],confirmation:true},{patch:async()=>pending});
  const confirm=button(save.render(),'Confirmer le changement');confirm.props.onClick();confirm.props.onClick();
  assert.equal(save.calls.length,1);assert.equal(save.calls[0].args[0],'/admin/membres/membre%2Fid/roles');
  assert.deepEqual(Array.from(save.calls[0].args[1].rolesDelegues),['OFFRES','EVENEMENTS']);assert.equal(save.calls[0].args[1].expectedRevision,membre.revisionDroits);
  assert.equal(save.calls[0].args[1].role,undefined);assert.equal(save.calls[0].args[1].expectedRole,undefined);
  finish({data:{membre:{...membre,rolesDelegues:['OFFRES','EVENEMENTS']}}});await tick();assert.equal(save.state.edition,null);assert.equal(save.state.revision,1);assert.match(save.state.annonce,/Offres, Événements/);
  const clear=load(component,{...base,edition:{...membre,rolesDelegues:['OFFRES']},selection:[],confirmation:true},{patch:async()=>({data:{membre}})});button(clear.render(),'Confirmer le changement').props.onClick();await tick();assert.equal(clear.calls[0].args[1].rolesDelegues.length,0);assert.match(clear.state.annonce,/aucun rôle délégué/);
  check('atomic replacement uses expectedRevision, canonical selection, duplicate guard and explicit removal of all grants');

  const old=load(component,{...base,donnees:{...liste,membres:[legacy]}});button(old.render(),'Modifier les rôles').props.onClick(event());
  assert.deepEqual(Array.from(old.state.selection),codes.slice(0,4));
  assert.match(renderToStaticMarkup(old.render()),/lecture des signalements ne sera plus déléguée/);
  assert.equal(button(old.render(),'Vérifier les changements').props.disabled,false);
  assert.equal(nodes(old.render()).filter(n=>n.type==='input'&&n.props.type==='checkbox').some(n=>['ADMIN','MODERATEUR'].includes(n.props.value)),false);
  const retained=load(component,{...base,donnees:{...liste,membres:[legacy]}});assert.match(renderToStaticMarkup(retained.render()),/Ancienne modération globale/);assert.equal(retained.calls.length,0);
  check('legacy moderator remains unchanged until explicit save; four domains are preselected and loss of report access disclosed');

  const conflict=load(component,{...base,edition:membre,selection:['OFFRES'],confirmation:true},{patch:async()=>{throw{response:{status:409,data:{message:'Les droits ont changé. Actualisez.'}}}},get:async()=>({data:liste})});button(conflict.render(),'Confirmer le changement').props.onClick();await tick();
  assert.equal(conflict.state.edition,null);assert.equal(conflict.state.revision,1);assert.match(conflict.state.erreurAction,/changé/);assert.equal(conflict.state.annonce,'');
  conflict.effects.length=0;conflict.render();conflict.effects[1]();await tick();assert.match(conflict.state.erreurAction,/changé/);
  const failed=load(component,{...base,edition:membre,selection:['OFFRES'],confirmation:true},{patch:async()=>{throw Error('Échec QA')}});button(failed.render(),'Confirmer le changement').props.onClick();await tick();assert.ok(failed.state.edition);assert.equal(failed.state.actionId,null);
  check('409 refreshes grants without losing conflict explanation; ordinary failure keeps the selection retryable');

  const filter=load(component,{...base,filtres:{q:'  Fatou QA  ',roleDelegue:'OFFRES',statut:'VALIDE'},page:3});nodes(filter.render()).find(n=>n.type==='form').props.onSubmit(event());assert.equal(filter.state.recherche.q,'Fatou QA');assert.equal(filter.state.page,1);
  const search=load(component,{...base,recherche:filter.state.recherche},{get:async()=>({data:liste})});search.render();search.effects[1]();await tick();assert.equal(search.calls[0].args[1].params.roleDelegue,'OFFRES');assert.equal(search.calls[0].args[1].params.role,undefined);
  check('search filters a delegated role with roleDelegue while preserving term and independent account status');

  const routes={CATALOGUE_GERER:'/admin/notifications',INSCRIPTIONS_GERER:'/admin/inscriptions?statut=EN_ATTENTE',SIGNALEMENTS_CONSULTER:'/admin/signalements',STATS_CONSULTER:'/admin/stats'};
  const links={ROLES_GERER:'/admin/membres',ASSOCIATIONS_GERER:'/admin/associations',OFFRES_MODERER:'/admin/offres',EVENEMENTS_MODERER:'/admin/evenements'};
  for(const allowed of [[],...all.map(p=>[p]),['OFFRES_MODERER','INSCRIPTIONS_GERER'],all]){
    const view=load(overview,{compte:{role:'MEMBRE',permissions:allowed},chargement:false},{get:async url=>({data:url==='/admin/notifications'?{notifications:[]}:url.startsWith('/admin/inscriptions')?{inscriptions:[]}:url==='/admin/signalements'?{signalements:[]}:{}})});
    const html=renderToStaticMarkup(view.render());view.effects[1]();await tick();
    assert.deepEqual(view.calls.map(c=>c.args[0]).sort(),Object.entries(routes).filter(([p])=>allowed.includes(p)).map(([,r])=>r).sort());
    for(const [p,url]of Object.entries(links))assert.equal(html.includes('href="'+url+'"'),allowed.includes(p));
    assert.equal(html.includes('id="signalements-titre"'),allowed.includes('SIGNALEMENTS_CONSULTER'));
    assert.equal(html.includes('Profils à valider'),allowed.includes('INSCRIPTIONS_GERER'));
    assert.equal(html.includes('Données éducatives à valider'),allowed.includes('CATALOGUE_GERER'));
  }
  check('overview requests and renders only authorized domains for each specialist, combinations and owner');

  for(const [page,permission]of [['components/offres/AdminOffres.tsx','OFFRES_MODERER'],['app/(admin)/admin/evenements/page.tsx','EVENEMENTS_MODERER'],['app/(admin)/admin/associations/page.tsx','ASSOCIATIONS_GERER']]){
    for(const granted of [[],[permission],['INSCRIPTIONS_GERER']]){
      const view=load(page,{}, {get:async()=>({data:{role:'MEMBRE',permissions:granted}})});view.render();view.effects[0]();await tick();assert.equal(view.state.autorise,granted.includes(permission));
    }
  }
  check('direct admin routes admit only the corresponding delegated permission, regardless of role=MEMBRE');

  for(const canEdit of [true,false]){
    const offer={id:'o',titre:'Offre QA',entreprise:'Entreprise',secteur:'Services',type:'CDI',pays:'Mali',ville:'Bamako',description:'Description suffisamment longue pour test.',estProprietaire:false,peutModifier:canEdit,dateExpiration:null};
    const form=load('components/offres/FormulaireOffre.tsx',{}, {get:async url=>({data:url==='/users/me'?{email:'qa@example.invalid',role:'MEMBRE',permissions:['OFFRES_MODERER']}:{offre:offer}})});form.render({offreId:'o'});form.effects[0]();await tick();assert.equal(Boolean(form.state.initial),canEdit);if(!canEdit)assert.match(form.state.erreurChargement,/ne pouvez pas/);
  }
  check('offer editing uses server resource capability, not a role-name exception');

  const header=load('components/MaliWuliHeader.tsx');
  for(const allowed of [[],['OFFRES_MODERER'],['ASSOCIATIONS_GERER'],['ROLES_GERER']]){
    header.state.autorisations={role:'MEMBRE',permissions:allowed};const tree=header.exports.MemberHeader();const html=renderToStaticMarkup(tree);assert.equal(html.includes('href="/admin"'),allowed.length>0);
  }
  check('member navigation adds Administration for delegated roles and hides it without permissions');
  console.log(JSON.stringify({status:'passed',groups,networkRequests:0,databaseWrites:0,limitations:['Mock API and SSR; mobile visual checks remain separate']}));
})().catch(error=>{console.error(error);process.exitCode=1});

/* Real TS/TSX sources, React SSR and in-memory state/transport. No HTTP, DB or mail. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const active = '/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend';
const staging = path.join(__dirname, 'staging/frontend/src');
const ts = require(path.join(active, 'node_modules/typescript'));
const React = require(path.join(active, 'node_modules/react'));
const jsx = require(path.join(active, 'node_modules/react/jsx-runtime'));
const { renderToStaticMarkup } = require(path.join(active, 'node_modules/react-dom/server'));
const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true };
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const node = (tree, predicate) => { const result = nodes(tree).find(predicate); assert.ok(result, 'expected rendered node'); return result; };
let groups = 0;
const pass = label => { groups++; console.log('PASS ' + label); };
const cacheKey = 'mali_wuli_onboarding_profile';
function createHarness(initialCache) {
  const stateStorage = new Map(initialCache ? [[cacheKey, JSON.stringify(initialCache)]] : []);
  const storage = { getItem: key => stateStorage.get(key) || null, setItem: (key, value) => stateStorage.set(key, value) };
  const calls = [], focused = [], modules = {};
  const api = { get: (url, options) => new Promise((resolve, reject) => calls.push({ method: 'GET', url, options, resolve, reject })), post: async (url, data) => { calls.push({ method: 'POST', url, data: clone(data) }); return { data: {} }; } };
  const steps = Object.fromEntries(['StepInformations', 'StepFormations', 'StepExperiences', 'StepMentorat', 'StepAssociations', 'StepIndicator'].map(name => [name, Object.assign(() => null, { displayName: name })]));
  const common = {
    'react/jsx-runtime': jsx,
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    'next/navigation': { useRouter: () => ({ push() {}, replace() {} }) },
    'lucide-react': new Proxy({}, { get: (_, key) => props => React.createElement('svg', { 'aria-hidden': props?.['aria-hidden'], 'data-icon': String(key) }) }),
    axios: { isAxiosError: () => false },
    '@/lib/api': api,
    '@/lib/education/suivi': { avisEtablissementScolaireEstDisponible: () => true },
    '@/lib/education/reference': { libelleProgramme: text => text, libelleSystemeEducatif: text => text },
    '@/lib/periode': { trierParDateDebut: values => [...values], formaterMoisAnnee: (month, year) => [month, year].filter(Boolean).join('/') },
    '@/lib/autorisations': { aPermission: () => false },
    '@/lib/media': { urlMediaBackend: value => value || null },
    '@/lib/community': { nomComplet: (first, last) => [first, last].filter(Boolean).join(' '), messageErreur: (_e, fallback) => fallback },
    '@/components/profile/AssociationsProfil': () => null,
    '@/components/community/CommunityUi': { Chargement: () => null, ErreurChargement: () => null },
    './DirectoryUi': { AvatarAnnuaire: () => null, ActionsMembre: () => null, datePublique: value => value || '' },
    ...Object.fromEntries(Object.entries(steps).map(([name, component]) => ['@/components/onboarding/' + name, component])),
  };
  function load(relative, extra = {}, exportSuffix = '') {
    const state = {}, refs = {}, effects = [];
    const transformer = context => {
      const visit = n => {
        if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression)) {
          const call = n.initializer.expression.text;
          if ((call === 'useState' && ts.isArrayBindingPattern(n.name)) || (call === 'useRef' && ts.isIdentifier(n.name))) {
            const name = call === 'useState' ? n.name.elements[0].name.text : n.name.text;
            return ts.factory.updateVariableDeclaration(n, n.name, n.exclamationToken, n.type, ts.factory.createCallExpression(ts.factory.createIdentifier(call === 'useState' ? '__state' : '__ref'), undefined, [ts.factory.createStringLiteral(name), ts.factory.createArrowFunction(undefined, undefined, [], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), n.initializer.arguments[0] || ts.factory.createIdentifier('undefined'))]));
          }
        }
        return ts.visitEachChild(n, visit, context);
      };
      return n => ts.visitNode(n, visit);
    };
    const file = fs.existsSync(path.join(staging, relative)) ? path.join(staging, relative) : path.join(active, 'src', relative);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8') + exportSuffix, { compilerOptions, transformers: { before: [transformer] } }).outputText;
    const module = { exports: {} };
    const mocks = { ...common, react: { ...React, useEffect: fn => effects.push(fn), useCallback: fn => fn, useMemo: fn => fn() }, ...extra };
    vm.runInNewContext(output, {
      module, exports: module.exports, URL, URLSearchParams, AbortController, console, Map, Set,
      window: { location: { search: '?etape=informations' }, localStorage: storage }, localStorage: storage,
      document: { getElementById: id => ({ focus: () => focused.push(id) }) },
      fetch: () => { throw new Error('unexpected real transport'); },
      __state: (name, init) => { if (!(name in state)) { const value = init(); state[name] = typeof value === 'function' ? value() : value; } return [state[name], value => state[name] = typeof value === 'function' ? value(state[name]) : value]; },
      __ref: (name, init) => refs[name] || (refs[name] = { current: init() }),
      require: id => { if (id in mocks) return mocks[id]; if (id in modules) return modules[id]; if (id.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }); throw new Error('Unmocked module ' + id); },
    }, { filename: relative });
    return { exports: module.exports, state, effects, render: props => module.exports.default(props) };
  }
  modules['@/lib/reseaux-sociaux'] = load('lib/reseaux-sociaux.ts').exports;
  modules['@/components/profile/LiensSociauxProfil'] = load('components/profile/LiensSociauxProfil.tsx').exports;
  return { load, modules, api, calls, focused, steps, stateStorage, storage, social: modules['@/lib/reseaux-sociaux'] };
}
const information = { prenom: 'Awa', nom: 'Diarra', telephone: '', indicatif: '+223', pays: 'Mali', paysCode: 'ML', ville: 'Bamako' };
const socials = { linkedin: 'https://www.linkedin.com/in/awa', facebook: 'https://www.facebook.com/awa', instagram: 'https://www.instagram.com/awa', tiktok: 'https://www.tiktok.com/@awa' };
const complete = { informations: { ...information, ...socials }, formations: [], experiences: [], mentorat: { estVolontaire: false } };
(async () => {
  const h = createHarness(), social = h.social;
  for (const value of [null, undefined, '', '  ']) assert.equal(social.erreurLienSocial(value, 'TikTok'), null);
  assert.equal(social.lienSocialSur('  HTTPS://EXAMPLE.TEST/été  '), 'https://example.test/%C3%A9t%C3%A9');
  assert.equal(social.lienSocialSur('http://example.test'), 'http://example.test/');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'ftp://example.test/', '//example.test', 'www.example.test', 'https://', 'https://u:password@example.test/', 12, {}]) {
    assert.equal(social.lienSocialSur(value), null, String(value));
    assert.ok(social.erreurLienSocial(value, 'LinkedIn'));
  }
  const exact = 'https://example.test/' + 'a'.repeat(500 - 'https://example.test/'.length);
  assert.equal(social.lienSocialSur(exact), exact);
  assert.equal(social.lienSocialSur(exact + 'a'), null);
  const encodedTooLong = 'https://example.test/' + 'é'.repeat(100);
  assert.ok(encodedTooLong.length < 500); assert.ok(new URL(encodedTooLong).toString().length > 500);
  assert.equal(social.lienSocialSur(encodedTooLong), null);
  assert.ok(social.erreurLienSocial(encodedTooLong, 'Instagram'));
  pass('optional values, URL protocols, credentials, trim and Unicode-normalized500 limit align with backend');

  const submitted = [], form = h.load('components/onboarding/StepInformations.tsx');
  const props = { initialData: complete.informations, onNext: value => submitted.push(clone(value)), onBack() {} };
  let tree = form.render(props);
  for (const key of Object.keys(socials)) { const input = node(tree, n => n.type === 'input' && n.props.name === key); assert.equal(input.props.value, socials[key]); assert.equal(input.props.maxLength, 500); assert.equal(input.props.type, 'url'); assert.equal(input.props.required, undefined); }
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Réseaux sociaux \(facultatif\)/); assert.match(html, /Ces liens seront visibles sur votre profil/);
  assert.match(html, /grid-cols-1[^\"]*md:grid-cols-2/);
  for (const field of ['prenom', 'nom', 'paysCode', 'ville']) {
    const previous = form.state.form[field]; form.state.form[field] = field === 'paysCode' ? '' : '  ';
    tree = form.render(props); tree.props.onSubmit({ preventDefault() {} }); assert.equal(submitted.length, 0, 'required ' + field + ' remains enforced');
    form.state.form[field] = previous;
  }
  tree = form.render(props); node(tree, n => n.type === 'input' && n.props.name === 'instagram').props.onChange({ target: { value: 'javascript:alert(1)' } });
  tree = form.render(props); tree.props.onSubmit({ preventDefault() {} }); assert.equal(submitted.length, 0); assert.deepEqual(h.focused, ['reseau-instagram']);
  tree = form.render(props); const invalid = node(tree, n => n.type === 'input' && n.props.name === 'instagram'); assert.equal(invalid.props['aria-invalid'], true); assert.ok(node(tree, n => n.props?.id === invalid.props['aria-describedby'] && n.props?.role === 'alert'));
  assert.match(renderToStaticMarkup(tree), /role="alert"/);
  invalid.props.onChange({ target: { value: '  https://instagram.com/awa  ' } });
  tree = form.render(props); tree.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.length, 1); assert.equal(submitted[0].instagram, 'https://instagram.com/awa'); assert.equal(submitted[0].prenom, 'Awa');
  pass('form prefills all links, keeps required-name/location guards and blocks/focuses invalid social input in French');

  for (const key of Object.keys(socials)) { tree = form.render(props); node(tree, n => n.type === 'input' && n.props.name === key).props.onChange({ target: { value: '  ' } }); }
  form.render(props).props.onSubmit({ preventDefault() {} });
  assert.deepEqual(Object.fromEntries(Object.keys(socials).map(key => [key, submitted[1][key]])), { linkedin: '', facebook: '', instagram: '', tiktok: '' });
  const older = createHarness().load('components/onboarding/StepInformations.tsx'); const olderValues = [];
  older.render({ initialData: information, onBack() {}, onNext: value => olderValues.push(clone(value)) }).props.onSubmit({ preventDefault() {} });
  assert.equal(olderValues.length, 1); for (const key of Object.keys(socials)) assert.equal(olderValues[0][key], '');
  pass('empty and whitespace explicitly clear all four fields; older onboarding records remain usable');

  const ph = createHarness({ ...complete, informations: { ...information, linkedin: 'https://obsolete.example.test/', facebook: 'https://obsolete.example.test/' } });
  const onboarding = ph.load('app/(auth)/onboarding/page.tsx'); onboarding.render(); const cleanup = onboarding.effects[0]();
  assert.equal(ph.calls[0].url, '/onboarding'); const relational = { ...complete, informations: { ...information, ...socials, facebook: null } }; ph.calls[0].resolve({ data: relational }); await tick();
  assert.equal(onboarding.state.step, 1); assert.equal(onboarding.state.chargementInitial, false); assert.equal(onboarding.state.data.informations.facebook, null);
  assert.equal(JSON.parse(ph.stateStorage.get(cacheKey)).informations.facebook, null);
  let stage = node(onboarding.render(), n => n.type === ph.steps.StepInformations); assert.equal(stage.props.initialData.linkedin, socials.linkedin); assert.equal(stage.props.initialData.facebook, null);
  const finalInfo = { ...submitted[0], facebook: '', tiktok: 'https://www.tiktok.com/@nouveau' };
  stage.props.onNext(finalInfo);
  for (const [component, value] of [['StepFormations', [{ id: 'formation-test' }]], ['StepExperiences', [{ id: 'experience-test' }]], ['StepMentorat', { estVolontaire: false }]]) {
    stage = node(onboarding.render(), n => n.type === ph.steps[component]); stage.props.onNext(value); assert.deepEqual(clone(onboarding.state.data.informations), finalInfo);
  }
  assert.deepEqual(JSON.parse(ph.stateStorage.get(cacheKey)).informations, finalInfo);
  node(onboarding.render(), n => n.type === ph.steps.StepAssociations).props.onNext(); await tick();
  const post = ph.calls.find(c => c.method === 'POST'); assert.equal(post.url, '/onboarding'); assert.deepEqual(post.data.informations, finalInfo); assert.equal(onboarding.state.step, 6); cleanup();
  pass('onboarding GET replaces stale cache; four fields and clears survive every step, local draft and final POST');

  const stored = createHarness({ ...complete, informations: finalInfo }), restored = stored.load('app/(auth)/onboarding/page.tsx'); restored.render(); const cleanRestore = restored.effects[0](); stored.calls[0].reject(new Error('offline simulation')); await tick();
  stage = node(restored.render(), n => n.type === stored.steps.StepInformations); assert.deepEqual(clone(stage.props.initialData), finalInfo); cleanRestore();
  const blocked = createHarness(); blocked.storage.setItem = () => { throw new Error('storage denied'); }; const noStorage = blocked.load('app/(auth)/onboarding/page.tsx'); noStorage.render(); const cleanBlocked = noStorage.effects[0](); blocked.calls[0].resolve({ data: complete }); await tick();
  node(noStorage.render(), n => n.type === blocked.steps.StepInformations).props.onNext(finalInfo); assert.equal(noStorage.state.step, 2); assert.deepEqual(clone(noStorage.state.data.informations), finalInfo); cleanBlocked();
  pass('existing offline draft keeps all links and disabled localStorage does not block the information step');

  const display = h.modules['@/components/profile/LiensSociauxProfil'].default;
  const markup = renderToStaticMarkup(React.createElement(display, { liens: socials }));
  assert.equal((markup.match(/target="_blank"/g) || []).length, 4); assert.equal((markup.match(/rel="noopener noreferrer"/g) || []).length, 4);
  for (const name of ['LinkedIn', 'Facebook', 'Instagram', 'TikTok']) assert.match(markup, new RegExp('<span>' + name + '</span>'));
  assert.doesNotMatch(markup, />https?:\/\//);
  assert.match(markup, /flex-wrap/); assert.match(markup, /focus-visible:outline/);
  assert.equal(renderToStaticMarkup(React.createElement(display, { liens: { linkedin: 'javascript:alert(1)', facebook: 'ftp://x.test/', instagram: encodedTooLong, tiktok: 'https://u:p@x.test/' } })), '');
  assert.equal(renderToStaticMarkup(React.createElement(display, { liens: {} })), '');
  pass('shared profile links have labels, external-tab safety and wrapping; invalid legacy or absent URLs render no card');

  const own = h.load('components/profile/ProfilMembre.tsx', {}, '\nexport { adapterProfil };\n');
  const user = { id: 'user-qa', prenom: 'Awa', nom: 'Diarra', statut: 'VALIDE', profil: { id: 'profile-qa', ...socials, facebook: null, formations: [], experiences: [], onboardingDonnees: { informations: { facebook: 'https://obsolete.example.test/' } } } };
  const adapted = own.exports.adapterProfil(user).informations;
  for (const key of Object.keys(socials)) assert.equal(adapted[key], user.profil[key]);
  own.render(); own.state.utilisateur = user; own.state.chargementProfil = false; own.state.chargementSuggestions = false;
  const ownTree = own.render(); const ownLinks = node(ownTree, n => n.type === display); assert.equal(ownLinks.props.liens.facebook, null); assert.equal(ownLinks.props.liens.tiktok, socials.tiktok);
  const ownHtml = renderToStaticMarkup(ownTree); assert.match(ownHtml, /Modifier mes infos/); assert.match(ownHtml, /href="\/onboarding\?etape=informations"/); assert.match(ownHtml, />TikTok</); assert.doesNotMatch(ownHtml, /obsolete\.example/);
  const publicProfile = h.load('components/directory/ProfilPublic.tsx'); publicProfile.render({ profilId: 'profile-qa' }); publicProfile.state.membre = { id: 'profile-qa', prenom: 'Awa', nom: 'Diarra', ...socials, email: null, telephone: null, formations: [], experiences: [] }; publicProfile.state.chargement = false;
  const publicHtml = renderToStaticMarkup(publicProfile.render({ profilId: 'profile-qa' }));
  for (const name of ['LinkedIn', 'Facebook', 'Instagram', 'TikTok']) assert.match(publicHtml, new RegExp('>' + name + '<'));
  assert.equal((publicHtml.match(/href="https:\/\/www.linkedin.com/g) || []).length, 1); assert.doesNotMatch(publicHtml, /Coordonnées/);
  pass('own profile uses relational values including cleared nulls; public socials remain visible without private contacts and no duplicated LinkedIn');
  console.log(JSON.stringify({ groups, network: false, database: false, sourceOnly: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });

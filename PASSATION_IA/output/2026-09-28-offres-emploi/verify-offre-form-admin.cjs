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
const offersModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(sourceRoot, 'lib/offres.ts'), 'utf8'), { compilerOptions }).outputText, { module: offersModule, exports: offersModule.exports, Intl, Date, URL, TextEncoder });
const offers = offersModule.exports;
function load(relative, initial = {}, apiMock = {}) {
  const state = { ...initial }, refs = {}, effects = [], calls = [];
  const api = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((method) => [method, async (...args) => {
    calls.push({ method, args });
    if (apiMock[method]) return apiMock[method](...args);
    throw Error(`Unexpected mocked ${method} ${args[0]}`);
  }]));
  const react = { ...React, useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect: (fn) => effects.push(fn) };
  const css = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) });
  const mocks = { react, 'react/jsx-runtime': jsx,
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    'lucide-react': new Proxy({}, { get: (_, name) => () => React.createElement('svg', { 'data-icon': String(name) }) }),
    '@/lib/api': api, '@/lib/media': { urlMediaBackend: (url) => url || null }, '@/lib/offres': offers, '@/hooks/useCountries': { useCountries: () => [{ code: 'ML', nom: 'Mali' }, { code: 'FR', nom: 'France' }] },
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
const formPath = 'components/offres/FormulaireOffre.tsx';
const adminPath = 'components/offres/AdminOffres.tsx';
const tick = () => new Promise(resolve => setImmediate(resolve));
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => !tree ? '' : Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && text(node) === label);
const form = tree => nodes(tree).find(node => node.type === 'form');
const event = () => ({ preventDefault() {}, currentTarget: { focus() {} } });
const valid = { titre: 'Chargé de communication', entreprise: 'Entreprise QA', secteur: 'Communication & médias', type: 'CDI', modeTravail: 'HYBRIDE', salaire: '400 000 FCFA par mois', pays: 'Mali', ville: 'Bamako', description: 'Des missions de communication au service de notre équipe.', profilRecherche: 'Expérience en communication.', modeCandidature: 'MALI_WULI', emailContact: 'candidature@example.invalid', lienCandidature: 'https://example.invalid/carrieres', dateExpiration: '2099-01-31', recommandationPossible: true };
const offre = { ...valid, id: 'offre/id', revision: 'a'.repeat(64), dateExpiration: '2099-01-31T23:59:59.999Z', createdAt: '2026-09-28T12:00:00.000Z', publieur: { nomComplet: 'QA Recrutement' }, statutModeration: 'EN_ATTENTE', valide: false, estProprietaire: true, estExpiree: false };
const pending = { offres: [offre], meta: { page: 1, limite: 15, total: 1, totalPages: 1 }, compteurs: { enAttente: 1, actives: 0, mesOffres: 0, enregistrees: 0 }, peutModerer: true };
let groups = 0;
const check = title => { groups++; console.log(`PASS ${title}`); };
(async () => {
  const initial = load(formPath, { chargement: false });
  const tree = initial.render();
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /Déposer une offre/); assert.match(markup, /Aperçu de votre offre/); assert.doesNotMatch(markup, /48\s*h/);
  assert.equal(nodes(tree).filter(n => n.type === 'input' && n.props.type === 'radio').length, 3);
  for (const input of nodes(tree).filter(n => ['input', 'select', 'textarea'].includes(n.type) && n.props.id)) {
    assert.ok(nodes(tree).some(n => n.type === 'label' && n.props.htmlFor === input.props.id), `Missing visible label for ${input.props.id}`);
  }
  check('form SSR exposes preview, labelled fields and three application modes without invented review deadline');

  const account = load(formPath, {}, { get: async () => ({ data: { email: 'qa@example.invalid', role: 'MEMBRE' } }) });
  account.render(); account.effects[0](); await tick();
  assert.equal(account.state.formulaire.emailContact, 'qa@example.invalid'); assert.equal(account.state.chargement, false);
  assert.equal(account.calls[0].args[0], '/users/me');
  check('account email prefill is read-only and never submits the offer automatically');

  for (const mode of ['MALI_WULI', 'EMAIL', 'LIEN_EXTERNE']) {
    const create = load(formPath, { chargement: false, formulaire: { ...valid, modeCandidature: mode } }, { post: async () => ({ data: { offre } }) });
    const originalForm = form(create.render());
    await originalForm.props.onSubmit(event());
    assert.equal(create.calls.length, 1); assert.equal(create.calls[0].method, 'post'); assert.equal(create.calls[0].args[0], '/offres');
    const body = create.calls[0].args[1];
    assert.equal(body.modeCandidature, mode); assert.equal(body.dateExpiration, '2099-01-31T23:59:59.999Z');
    assert.equal(body.emailContact, mode === 'EMAIL' ? valid.emailContact : null);
    assert.equal(body.lienCandidature, mode === 'LIEN_EXTERNE' ? valid.lienCandidature : null);
    assert.equal(body.valide, undefined); assert.equal(body.statutModeration, undefined);
    await originalForm.props.onSubmit(event()); assert.equal(create.calls.length, 1);
    assert.match(renderToStaticMarkup(create.render()), /envoyée pour validation/);
  }
  check('each application mode posts the correct exclusive contact fields; success prevents duplicate submission and stays pending');

  for (const changed of [ { titre: 'A' }, { description: 'Court' }, { modeCandidature: 'EMAIL', emailContact: 'incorrect' }, { modeCandidature: 'LIEN_EXTERNE', lienCandidature: 'javascript:alert(1)' }, { modeCandidature: 'LIEN_EXTERNE', lienCandidature: '' }, { dateExpiration: '2001-01-01' }, { dateExpiration: '2099-02-30' }, { salaire: 'x'.repeat(191) } ]) {
    const invalid = load(formPath, { chargement: false, formulaire: { ...valid, ...changed } });
    await form(invalid.render()).props.onSubmit(event());
    assert.equal(invalid.calls.length, 0); assert.ok(Object.keys(invalid.state.erreurs).length);
    assert.match(renderToStaticMarkup(invalid.render()), /role="alert"/);
    assert.match(renderToStaticMarkup(invalid.render()), /aria-invalid="true"/);
  }
  const fallback = load(formPath, { chargement: false, formulaire: { ...valid, modeCandidature: 'EMAIL', emailContact: '' } }, { post: async () => ({ data: { offre } }) });
  await form(fallback.render()).props.onSubmit(event()); assert.equal(fallback.calls[0].args[1].emailContact, null);
  check('invalid descriptions, contacts, deadlines and bounds block requests; blank email explicitly uses backend publisher fallback');

  const past = { ...offre, dateExpiration: '2000-01-01T23:59:59.999Z' };
  const edit = load(formPath, { chargement: false, initial: past, formulaire: { ...valid, dateExpiration: '2000-01-01' } }, { patch: async () => ({ data: { offre } }) });
  await form(edit.render({ offreId: offre.id })).props.onSubmit(event());
  assert.equal(edit.calls[0].method, 'patch'); assert.equal(edit.calls[0].args[0], '/offres/offre%2Fid');
  assert.equal(Object.hasOwn(edit.calls[0].args[1], 'dateExpiration'), false);
  assert.match(renderToStaticMarkup(edit.render({ offreId: offre.id })), /à nouveau visible après validation/);
  const cleared = load(formPath).exports.preparerOffre({ ...valid, dateExpiration: '' }, past);
  assert.equal(cleared.donnees.dateExpiration, null);
  check('editing preserves an unchanged historical deadline, permits explicit removal and reports revalidation');

  const failure = load(formPath, { chargement: false, formulaire: valid }, { post: async () => { throw { response: { data: { message: 'Refus QA simulé' } } }; } });
  await form(failure.render()).props.onSubmit(event());
  assert.equal(failure.state.erreur, 'Refus QA simulé'); assert.equal(failure.state.envoi, false); assert.equal(failure.state.formulaire.description, valid.description);
  const denied = load(formPath, {}, { get: async url => ({ data: url === '/users/me' ? { role: 'MEMBRE' } : { offre: { ...offre, estProprietaire: false } } }) });
  denied.render({ offreId: offre.id }); denied.effects[0](); await tick();
  assert.match(denied.state.erreurChargement, /ne pouvez pas modifier/); assert.equal(form(denied.render({ offreId: offre.id })), undefined);
  check('server errors preserve entered data and release controls; unauthorized editing hides the form');

  const forbidden = load(adminPath, { autorise: false });
  assert.match(renderToStaticMarkup(forbidden.render()), /réservé à l’équipe/); assert.equal(button(forbidden.render(), 'Valider et publier'), undefined);
  for (const role of ['ADMIN', 'MODERATEUR', 'MEMBRE']) {
    const access = load(adminPath, {}, { get: async () => ({ data: { role } }) });
    access.render(); access.effects[0](); await tick(); assert.equal(access.state.autorise, role !== 'MEMBRE');
  }
  check('admin page allows administrators and moderators only');

  const listing = load(adminPath, { autorise: true }, { get: async () => ({ data: pending }) });
  listing.render(); listing.effects[1](); await tick();
  assert.equal(listing.calls[0].args[1].params.vue, 'en-attente'); assert.equal(listing.state.donnees.compteurs.enAttente, 1);
  for (const mode of ['MALI_WULI', 'EMAIL', 'LIEN_EXTERNE']) {
    const show = load(adminPath, { autorise: true, chargement: false, donnees: { ...pending, offres: [{ ...offre, modeCandidature: mode }] } });
    const html = renderToStaticMarkup(show.render());
    assert.ok(html.includes(valid.description)); assert.ok(html.includes(valid.profilRecherche)); assert.ok(html.includes(valid.salaire));
    if (mode === 'EMAIL') assert.ok(html.includes(valid.emailContact));
    if (mode === 'LIEN_EXTERNE') assert.ok(html.includes(valid.lienCandidature));
  }
  check('moderation fetches only pending offers and displays full description, requirements and conditional contact details');

  for (const decision of [true, false]) {
    const admin = load(adminPath, { autorise: true, chargement: false, donnees: pending }, { patch: async () => ({ data: {} }) });
    button(admin.render(), decision ? 'Valider et publier' : 'Refuser').props.onClick(event()); assert.equal(admin.calls.length, 0);
    const confirmation = button(admin.render(), decision ? 'Confirmer la publication' : 'Confirmer le refus');
    confirmation.props.onClick(); await tick();
    assert.equal(admin.calls[0].args[0], '/offres/offre%2Fid/validation'); assert.equal(admin.calls[0].args[1].valide, decision);
    assert.equal(admin.calls[0].args[1].revision, offre.revision);
    assert.equal(admin.state.donnees.offres.length, 0); assert.equal(admin.state.donnees.compteurs.enAttente, 0); assert.equal(admin.state.revision, 1);
  }
  const lastPage = load(adminPath, { autorise: true, page: 3 }, { get: async () => ({ data: { ...pending, offres: [], meta: { ...pending.meta, total: 1, totalPages: 1 } } }) });
  lastPage.render(); lastPage.effects[1](); await tick(); assert.equal(lastPage.state.page, 1);
  const rejected = load(adminPath, { autorise: true, chargement: false, donnees: pending, confirmation: { id: offre.id, valide: true } }, { patch: async () => { throw Error('Échec QA'); } });
  button(rejected.render(), 'Confirmer la publication').props.onClick(); await tick();
  assert.equal(rejected.state.donnees.offres.length, 1); assert.equal(rejected.state.actionId, null); assert.equal(rejected.state.erreursActions[offre.id], 'Échec QA');
  check('decisions require confirmation, update counts, reload data, correct empty pagination and keep failed decisions retryable');

  const stale = load(adminPath, { autorise: true, chargement: false, donnees: pending, confirmation: { id: offre.id, valide: true } }, { patch: async () => { throw { response: { status: 409, data: { message: 'Cette offre a changé. Relisez-la.' } } }; } });
  button(stale.render(), 'Confirmer la publication').props.onClick(); await tick();
  assert.equal(stale.calls[0].args[1].revision, offre.revision);
  assert.equal(stale.state.donnees.compteurs.enAttente, 1); assert.equal(stale.state.donnees.offres.length, 1);
  assert.equal(stale.state.confirmation, null); assert.equal(stale.state.revision, 1);
  assert.equal(stale.state.annonce, ''); assert.match(stale.state.erreursActions[offre.id], /changé/);
  check('stale moderation decision sends reviewed revision and refreshes the offer after 409 without declaring success');

  console.log(JSON.stringify({ status: 'passed', groups, networkRequests: 0, databaseWrites: 0, limitations: ['Mock API and SSR tests; visual widths at 320px are verified separately in the browser'] }));
})().catch(error => { console.error(error); process.exitCode = 1; });

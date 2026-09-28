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
const datesModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(sourceRoot, 'lib/evenements.ts'), 'utf8'), { compilerOptions }).outputText, { module: datesModule, exports: datesModule.exports, Intl, Date, TextEncoder });
const dates = datesModule.exports;
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
    '@/lib/api': api, '@/lib/media': { urlMediaBackend: (url) => url || null }, '@/lib/evenements': dates,
    '@/lib/community': { messageErreur: (error, fallback) => error?.response?.data?.message || error?.message || fallback },
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
    FormData: MockFormData, URL, Intl, Date, console, encodeURIComponent,
  }, { filename: relative });
  return { render: (props = {}) => module.exports.default(props), state, refs, effects, calls };
}
const formPath = 'components/evenements/FormulaireEvenement.tsx';
const adminPath = 'app/(admin)/admin/evenements/page.tsx';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const nodes = (tree) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = (tree) => !tree ? '' : Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
const button = (tree, label) => nodes(tree).find((node) => node.type === 'button' && text(node) === label);
const form = (tree) => nodes(tree).find((node) => node.type === 'form');
const event = () => ({ preventDefault() {} });
const validForm = { titre: 'Rencontre du réseau', description: 'Une rencontre pour partager nos expériences.', type: 'PRESENTIEL', jour: '2099-01-15', heureDebut: '18:00', jourFin: '', heureFin: '20:00', fuseauHoraire: 'Europe/Paris', pays: 'France', ville: 'Paris', lieu: 'Une salle', lienVideo: '', capacite: '20', resume: '' };
const evenement = { id: 'evt/id', ...validForm, dateDebut: '2099-01-15T17:00:00.000Z', dateFin: '2099-01-15T19:00:00.000Z', capacite: 20, programme: [], valide: false, statut: 'EN_ATTENTE', nbParticipants: 0, estInscrit: false, estProprietaire: true, estPasse: false, peutModifier: true, peutAjouterPhotos: true, peutModerer: false };
const pending = { evenements: [evenement], meta: { page: 1, limite: 20, total: 1, totalPages: 1 }, compteurs: { aVenir: 0, passes: 0, aValider: 1, mesPropositions: 0 }, facettes: { pays: [], villes: [] }, peutModerer: true };
let groups = 0;
const check = (title) => { groups++; console.log(`PASS ${title}`); };
(async () => {
  const initial = load(formPath);
  const markup = renderToStaticMarkup(initial.render());
  assert.match(markup, /Proposer un événement/); assert.match(markup, /Aperçu/); assert.match(markup, /Hybride/); assert.match(markup, /10 Mio/); assert.doesNotMatch(markup, /48\s*h/);
  assert.equal(nodes(initial.render()).filter((node) => node.type === 'input' && node.props.type === 'radio').length, 3);
  check('form renders full preview, three formats, image limits and no invented deadline');

  const create = load(formPath, { formulaire: validForm }, { post: async () => ({ data: { evenement } }) });
  const submitted = form(create.render()); await submitted.props.onSubmit(event()); await tick();
  assert.equal(create.calls.length, 1); assert.equal(create.calls[0].args[0], '/evenements');
  const body = create.calls[0].args[1]; assert.equal(body.dateDebut, '2099-01-15T17:00:00.000Z'); assert.equal(body.dateFin, '2099-01-15T19:00:00.000Z'); assert.equal(body.capacite, 20);
  assert.equal(create.state.enregistre.id, evenement.id);
  submitted.props.onSubmit(event()); await tick(); assert.equal(create.calls.length, 1);
  check('creation converts selected local time to UTC and repeated submit cannot create a duplicate');

  const uploadFailure = load(formPath, { formulaire: validForm, couverture: { type: 'image/png', size: 40, name: 'cover.png' } }, { post: async (url) => { if (url.endsWith('/couverture')) throw { response: { data: { message: 'Échec image simulé' } } }; return { data: { evenement } }; } });
  const oldForm = form(uploadFailure.render()); oldForm.props.onSubmit(event()); await tick();
  assert.equal(uploadFailure.calls.length, 2); assert.equal(uploadFailure.calls[1].args[0], '/evenements/evt%2Fid/couverture');
  assert.equal(uploadFailure.calls[1].args[1].entries[0][0], 'couverture'); assert.equal(uploadFailure.state.enregistre.id, evenement.id);
  assert.match(uploadFailure.state.avertissementImage, /enregistré/); assert.match(renderToStaticMarkup(uploadFailure.render()), /réessayer la couverture/);
  oldForm.props.onSubmit(event()); await tick(); assert.equal(uploadFailure.calls.length, 2);
  check('failed image upload retains created event and offers detail retry without a second JSON POST');

  const image = load(formPath);
  const input = nodes(image.render()).find((node) => node.type === 'input' && node.props.type === 'file');
  input.props.onChange({ target: { files: [{ type: 'image/svg+xml', size: 50 }], value: '' } }); assert.match(image.state.erreurCouverture, /JPEG/);
  input.props.onChange({ target: { files: [{ type: 'image/png', size: 10 * 1024 * 1024 + 1 }], value: '' } }); assert.match(image.state.erreurCouverture, /10 Mio/);
  button(image.render(), 'Annuler cette sélection').props.onClick(); assert.equal(image.state.erreurCouverture, ''); assert.equal(image.calls.length, 0);
  check('invalid MIME and oversize cover rejected locally, with a clearable selection');

  for (const changed of [ { type: 'HYBRIDE', lienVideo: 'javascript:alert(1)' }, { ville: '' }, { heureFin: '17:00' }, { jour: '2099-03-29', heureDebut: '02:30', heureFin: '' } ]) {
    const invalid = load(formPath, { formulaire: { ...validForm, ...changed } });
    form(invalid.render()).props.onSubmit(event()); await tick(); assert.equal(invalid.calls.length, 0); assert.ok(invalid.state.erreur);
  }
  check('hybrid link, required city, chronological dates and DST gaps block invalid requests');

  const past = { ...evenement, dateDebut: '2020-01-15T17:00:13.000Z', dateFin: '2020-01-15T19:00:17.000Z', valide: true, statut: 'VALIDE', estPasse: true, resume: null };
  const pastForm = { ...validForm, jour: '2020-01-15', jourFin: '2020-01-15', resume: 'Une belle rencontre et des échanges utiles.' };
  const edit = load(formPath, { formulaire: pastForm, initial: past, chargement: false }, { patch: async () => ({ data: { evenement: { ...past, resume: pastForm.resume } } }) });
  form(edit.render({ evenementId: past.id })).props.onSubmit(event()); await tick();
  assert.equal(edit.calls.length, 1); assert.equal(edit.calls[0].method, 'patch');
  assert.deepEqual(Object.keys(edit.calls[0].args[1]), ['resume']);
  check('past event summary patch omits unchanged dates, seconds, content and format');

  const pastHybrid = { ...past, type: 'HYBRIDE', lienVideo: null, pays: null, ville: null };
  const legacy = load(formPath, { formulaire: { ...pastForm, type: 'HYBRIDE', lienVideo: '', pays: '', ville: '' }, initial: pastHybrid, chargement: false }, { patch: async () => ({ data: { evenement: pastHybrid } }) });
  const legacyScreen = legacy.render({ evenementId: pastHybrid.id });
  const videoInput = nodes(legacyScreen).find((node) => node.type === 'input' && node.props.type === 'url');
  assert.equal(videoInput.props.required, false);
  form(legacyScreen).props.onSubmit(event()); await tick();
  assert.equal(legacy.calls.length, 1); assert.deepEqual(Object.keys(legacy.calls[0].args[1]), ['resume']);
  check('legacy hybrid without video or city still permits summary-only editing');


  const coverOnly = load(formPath, { formulaire: { ...validForm, jourFin: '2099-01-15' }, initial: evenement, chargement: false, couverture: { type: 'image/jpeg', size: 50, name: 'cover.jpg' } }, { post: async () => ({ data: { evenement } }) });
  form(coverOnly.render({ evenementId: evenement.id })).props.onSubmit(event()); await tick();
  assert.equal(coverOnly.calls.length, 1); assert.equal(coverOnly.calls[0].args[0], '/evenements/evt%2Fid/couverture');
  check('cover-only edit uploads directly without empty PATCH or proposal re-creation');

  const refusedEdit = load(formPath, { formulaire: pastForm, initial: { ...past, statut: 'REFUSE', valide: false }, chargement: false }, { patch: async () => ({ data: { evenement: { ...past, statut: 'REFUSE', valide: false, resume: pastForm.resume } } }) });
  form(refusedEdit.render({ evenementId: past.id })).props.onSubmit(event()); await tick();
  const refusedMessage = renderToStaticMarkup(refusedEdit.render({ evenementId: past.id }));
  assert.match(refusedMessage, /proposition reste refusée/); assert.match(refusedMessage, /informations principales/); assert.doesNotMatch(refusedMessage, /Elle sera publiée après validation/);
  check('summary-only edit of refused proposal reports unchanged refusal without promising review');


  const denied = load(formPath, {}, { get: async () => ({ data: { evenement: { ...evenement, peutModifier: false } } }) });
  denied.render({ evenementId: evenement.id }); denied.effects[0](); await tick();
  assert.match(denied.state.erreurChargement, /ne pouvez pas modifier/); assert.ok(!form(denied.render({ evenementId: evenement.id })));
  check('editing permission denial hides the form and exposes retry feedback');

  const forbidden = load(adminPath, { autorise: false }); assert.match(renderToStaticMarkup(forbidden.render()), /réservé à l’équipe/);
  assert.ok(!button(forbidden.render(), 'Valider et publier'));
  const moderator = load(adminPath, {}, { get: async () => ({ data: { role: 'MODERATEUR' } }) });
  moderator.render(); moderator.effects[0](); await tick(); assert.equal(moderator.state.autorise, true);
  check('admin UI blocks members and recognizes moderators');

  const allPending = load(adminPath, { autorise: true }, { get: async () => ({ data: { ...pending, evenements: [past] } }) });
  allPending.render(); allPending.effects[1](); await tick();
  assert.equal(allPending.calls.length, 1); assert.equal(allPending.calls[0].args[1].params.statut, 'en_attente');
  assert.equal(allPending.calls[0].args[1].params.periode, 'tous'); assert.equal(allPending.state.donnees.evenements[0].dateDebut, past.dateDebut);
  check('moderation explicitly fetches all periods so older pending proposals remain visible');


  const admin = load(adminPath, { autorise: true, chargement: false, donnees: pending }, { patch: async () => ({ data: {} }) });
  button(admin.render(), 'Valider et publier').props.onClick(); assert.equal(admin.calls.length, 0);
  assert.ok(button(admin.render(), 'Confirmer la publication'));
  button(admin.render(), 'Confirmer la publication').props.onClick(); await tick();
  assert.equal(admin.calls[0].args[0], '/evenements/evt%2Fid/validation'); assert.equal(admin.calls[0].args[1].valide, true);
  assert.equal(admin.state.donnees.evenements.length, 0); assert.equal(admin.state.donnees.compteurs.aValider, 0); assert.equal(admin.state.revision, 1);
  check('moderation requires confirmation then publishes and refreshes pending list/count');

  const refusal = load(adminPath, { autorise: true, chargement: false, donnees: pending }, { patch: async () => { throw Error('Décision indisponible'); } });
  button(refusal.render(), 'Refuser').props.onClick(); button(refusal.render(), 'Confirmer le refus').props.onClick(); await tick();
  assert.equal(refusal.calls[0].args[1].valide, false); assert.equal(refusal.state.donnees.evenements.length, 1); assert.match(refusal.state.erreursActions[evenement.id], /indisponible/); assert.equal(refusal.state.actionId, null);
  check('refusal failure stays on its proposal, retains data and permits retry');
  console.log(`${groups} groups passed; API and browser effects are mocked, no DB/network writes.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });

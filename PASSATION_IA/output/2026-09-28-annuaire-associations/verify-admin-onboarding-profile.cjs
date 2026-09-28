/* Local UI contract checks. No network, DB, storage outside in-memory mocks or app writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const active = '/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend';
const stage = path.join(__dirname, 'staging/frontend/src');
const ts = require(path.join(active, 'node_modules/typescript'));
const React = require(path.join(active, 'node_modules/react'));
const jsx = require(path.join(active, 'node_modules/react/jsx-runtime'));
const { renderToStaticMarkup } = require(path.join(active, 'node_modules/react-dom/server'));
const componentNames = ['StepIndicator', 'StepAssociations', 'StepInformations', 'StepFormations', 'StepExperiences', 'StepMentorat'];
const stubs = Object.fromEntries(componentNames.map((name) => [name, Object.assign(() => null, { displayName: name })]));
const association = (id, statut) => ({ id, nom: `Association ${id}`, description: 'Entraide', pays: 'Mali', ville: 'Bamako', vocation: 'Éducation', site: null, emailContact: null, photo: null, photoCouverture: null, dateCreation: null, createdAt: '2026-09-28', responsable: null, nbMembres: 0, monAffiliation: statut ? { statut, rejointLe: null } : null, peutGerer: false });
const tick = () => new Promise((resolve) => setImmediate(resolve));
function load(relative, initial = {}, apiMock = {}) {
  const state = { ...initial }, effects = [], calls = [], routes = [], local = new Map();
  const api = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((method) => [method, async (...args) => {
    calls.push({ method, args });
    if (apiMock[method]) return apiMock[method](...args);
    throw Error(`Unexpected mocked API ${method} ${args[0]}`);
  }]));
  const react = { ...React, useCallback: (fn) => fn, useMemo: (fn) => fn(), useRef: (value) => ({ current: value }), useEffect: (fn) => effects.push(fn) };
  const mocks = {
    react, 'react/jsx-runtime': jsx,
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    'next/navigation': { useRouter: () => ({ push: (url) => routes.push(url), replace: (url) => routes.push(url) }) },
    axios: { isAxiosError: () => false }, '@/lib/api': api,
    '@/lib/media': { urlMediaBackend: (value) => value },
    '@/lib/education/suivi': { avisEtablissementScolaireEstDisponible: () => true },
    '@/components/associations/ProposerAssociation': () => null,
    ...Object.fromEntries(componentNames.map((name) => [`@/components/onboarding/${name}`, stubs[name]])),
  };
  const source = fs.readFileSync(path.join(stage, relative), 'utf8');
  // Name state slots through an AST-only test transformation; production files are untouched.
  const transformer = (context) => {
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === 'useState') {
        return ts.factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type,
          ts.factory.createCallExpression(ts.factory.createIdentifier('__state'), undefined, [ts.factory.createStringLiteral(node.name.elements[0].name.text), ts.factory.createArrowFunction(undefined, undefined, [], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), node.initializer.arguments[0])]));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit);
  };
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, transformers: { before: [transformer] } });
  const module = { exports: {} };
  const window = { location: { search: '', origin: 'https://test.invalid' }, setTimeout: () => 1, clearTimeout: () => {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require: (id) => { assert.ok(id in mocks, `Missing mock ${id}`); return mocks[id]; },
    __state: (name, init) => { if (!(name in state)) state[name] = init(); return [state[name], (value) => { state[name] = typeof value === 'function' ? value(state[name]) : value; }]; },
    localStorage: { getItem: (key) => local.get(key) || null, setItem: (key, value) => local.set(key, value) },
    window, URLSearchParams, console, Map, Date, encodeURIComponent,
  }, { filename: relative });
  return { render: (props = {}) => module.exports.default(props), state, effects, calls, routes, local, window };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const text = (tree) => !tree ? '' : Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
const button = (tree, label) => nodes(tree).find((node) => node.type === 'button' && text(node) === label);
const check = (title) => console.log(`PASS ${title}`);
(async () => {
  const visible = association('validée', 'VERIFIE'), pending = association('attente', 'EN_ATTENTE'), declined = association('refusée', 'REFUSE');
  const own = load('components/profile/AssociationsProfil.tsx', { associations: [visible, pending, declined], chargement: false });
  const ownMarkup = renderToStaticMarkup(own.render());
  assert.match(ownMarkup, /Affiliations validées/); assert.match(ownMarkup, /En attente du responsable/); assert.match(ownMarkup, /visibles uniquement par vous/);
  const links = nodes(own.render()).filter((node) => node.props?.href).map((node) => node.props.href);
  assert.ok(links.includes('/associations/valid%C3%A9e')); assert.ok(!links.includes('/associations/attente')); assert.ok(!links.includes('/associations/refus%C3%A9e'));
  check('own profile separates verified, pending and refused affiliations');

  const unpublished = load('components/profile/AssociationsProfil.tsx', { associations: [{ ...visible, valide: false }, { ...pending, valide: false }], chargement: false });
  const unpublishedMarkup = renderToStaticMarkup(unpublished.render());
  assert.match(unpublishedMarkup, /Associations non publiées/); assert.match(unpublishedMarkup, /Elles ne sont pas affichées sur votre profil public/);
  assert.doesNotMatch(unpublishedMarkup, /href="\/associations\//); assert.doesNotMatch(unpublishedMarkup, /<h3[^>]*>Affiliations validées/);
  check('unpublished associations remain private and have no broken public detail links');

  for (const statutCompte of [undefined, 'EN_ATTENTE', 'REFUSE', 'SUSPENDU']) {
    const noManagement = load('components/profile/AssociationsProfil.tsx', {}, { get: async (url) => { assert.equal(url, '/onboarding/associations/mes'); return { data: { associations: [] } }; } });
    const screen = noManagement.render({ statutCompte });
    for (const effect of noManagement.effects) effect();
    await tick();
    assert.equal(noManagement.calls.length, 1);
    assert.doesNotMatch(renderToStaticMarkup(screen), /Associations que je gère/);
  }
  check('pending, suspended and uninitialized accounts never request management API');

  const managed = { ...association('managed/id', null), nbMembres: 3, peutGerer: true };
  const manager = load('components/profile/AssociationsProfil.tsx', {}, { get: async (url) => ({ data: { associations: url === '/associations/mes' ? [managed] : [] } }) });
  manager.render({ statutCompte: 'VALIDE' });
  for (const effect of manager.effects) effect();
  await tick();
  const managerScreen = manager.render({ statutCompte: 'VALIDE' });
  assert.deepEqual(manager.calls.map((call) => call.args[0]).sort(), ['/associations/mes', '/onboarding/associations/mes']);
  assert.match(renderToStaticMarkup(managerScreen), /Associations que je gère/);
  assert.match(renderToStaticMarkup(managerScreen), /3 membres/);
  assert.match(renderToStaticMarkup(managerScreen), /Aucune affiliation validée/);
  assert.ok(nodes(managerScreen).some((node) => node.props?.href === '/associations/managed%2Fid' && text(node) === 'Gérer les demandes et les photos'));
  assert.ok(!nodes(managerScreen).some((node) => node.props?.href === '/admin/associations'));
  const adminManagerScreen = manager.render({ statutCompte: 'VALIDE', estAdministrateur: true });
  assert.ok(nodes(adminManagerScreen).some((node) => node.props?.href === '/admin/associations'));
  check('validated responsible finds photo and approval management without self affiliation; admin gets dedicated link');

  let managementAttempts = 0;
  const retryManagement = load('components/profile/AssociationsProfil.tsx', {}, { get: async (url) => {
    if (url === '/associations/mes' && ++managementAttempts === 1) throw Error('Simulated outage');
    return { data: { associations: url === '/associations/mes' ? [managed] : [] } };
  } });
  retryManagement.render({ statutCompte: 'VALIDE' });
  for (const effect of retryManagement.effects) effect();
  await tick();
  const failedManagementScreen = retryManagement.render({ statutCompte: 'VALIDE' });
  assert.match(renderToStaticMarkup(failedManagementScreen), /ne sont pas disponibles/);
  button(failedManagementScreen, 'Réessayer le chargement des espaces').props.onClick();
  assert.equal(retryManagement.state.essaiGestion, 1);
  retryManagement.render({ statutCompte: 'VALIDE' });
  retryManagement.effects.at(-1)(); await tick();
  assert.equal(managementAttempts, 2); assert.equal(retryManagement.state.erreurGestion, ''); assert.equal(retryManagement.state.associationsGerees[0].id, managed.id);
  check('management API failure has an independent retry and recovers without changing affiliations');


  const emptyStep = load('components/onboarding/StepAssociations.tsx', { chargement: false, chargementAffiliations: false });
  assert.equal(button(emptyStep.render(), 'Terminer mon inscription').props.disabled, false);
  for (const busy of [{ actionId: 'pending' }, { propositionEnCours: true }]) {
    const form = load('components/onboarding/StepAssociations.tsx', busy);
    assert.equal(button(form.render(), 'Terminer mon inscription').props.disabled, true);
    assert.equal(button(form.render(), '‹ Revenir au mentorat').props.disabled, true);
  }
  assert.equal(button(emptyStep.render({ enregistrementEnCours: true }), 'Enregistrement…').props.disabled, true);
  check('optional step allows skip but prevents leaving while affiliation/proposal/final save is pending');

  const fresh = association('new/id', null);
  const step = load('components/onboarding/StepAssociations.tsx', { chargement: false, chargementAffiliations: false, resultats: { associations: [fresh], totalPages: 1 } }, {
    post: async () => ({ data: { monAffiliation: { statut: 'EN_ATTENTE', rejointLe: null } } }), delete: async () => ({ data: {} }),
  });
  button(step.render(), 'Je suis membre de cette association').props.onClick(); await tick();
  assert.equal(step.calls[0].args[0], '/onboarding/associations/new%2Fid/affiliation');
  assert.equal(step.state.affiliations[0].monAffiliation.statut, 'EN_ATTENTE');
  assert.ok(button(step.render(), 'Annuler la demande'));
  button(step.render(), 'Annuler la demande').props.onClick(); await tick();
  assert.equal(step.calls[1].method, 'delete'); assert.equal(step.state.affiliations.length, 0);
  check('affiliation request and cancellation use direct scoped API and refresh visible state');

  const failed = load('components/onboarding/StepAssociations.tsx', { chargement: false, chargementAffiliations: false, resultats: { associations: [fresh], totalPages: 1 } }, { post: async () => { throw { response: { data: { message: 'Refus simulé' } } }; } });
  button(failed.render(), 'Je suis membre de cette association').props.onClick(); await tick();
  assert.equal(failed.state.erreurAction, 'Refus simulé'); assert.equal(failed.state.actionId, null); assert.equal(failed.state.affiliations.length, 0);
  check('affiliation failure preserves previous state and releases busy controls');

  const data = { informations: { prenom: 'QA' }, formations: [], experiences: [], mentorat: { estVolontaire: false } };
  const onboarding = load('app/(auth)/onboarding/page.tsx', { chargementInitial: false, step: 4, data }, { post: async () => ({ data: {} }) });
  const mentorat = nodes(onboarding.render()).find((node) => node.type === stubs.StepMentorat);
  mentorat.props.onNext({ estVolontaire: true }); assert.equal(onboarding.state.step, 5); assert.equal(onboarding.calls.length, 0);
  const finalStep = nodes(onboarding.render()).find((node) => node.type === stubs.StepAssociations);
  finalStep.props.onNext(); await tick();
  assert.equal(onboarding.calls[0].args[0], '/onboarding');
  assert.deepEqual(Object.keys(onboarding.calls[0].args[1]).sort(), ['experiences', 'formations', 'informations', 'mentorat']);
  assert.equal(onboarding.state.step, 6);
  check('steps 4 → 5 → confirmation retain legacy snapshot without association fields');

  const edition = load('app/(auth)/onboarding/page.tsx', { chargementInitial: false, step: 5, editionAssociations: true, data: {} });
  nodes(edition.render()).find((node) => node.type === stubs.StepAssociations).props.onNext();
  assert.deepEqual(edition.routes, ['/profil']); assert.equal(edition.calls.length, 0);
  for (const [query, expected] of Object.entries({ informations: 1, formations: 2, experiences: 3, mentorat: 4, associations: 5 })) {
    const screen = load('app/(auth)/onboarding/page.tsx', {}, { get: async () => ({ data }) });
    screen.window.location.search = `?etape=${query}`; screen.render(); screen.effects[0](); await tick();
    assert.equal(screen.state.step, expected); assert.equal(screen.state.editionAssociations, query === 'associations');
  }
  check('all legacy editing URLs remain stable; association edit returns without resaving onboarding');

  const indicator = load('components/onboarding/StepIndicator.tsx');
  const indicatorMarkup = renderToStaticMarkup(indicator.render({ currentStep: 5, steps: ['Informations', 'Formations', 'Expériences', 'Mentorat', 'Associations'].map((label, i) => ({ number: i + 1, label })) }));
  assert.match(indicatorMarkup, /repeat\(5, minmax\(0, 1fr\)\)/); assert.match(indicatorMarkup, /aria-current="step"/); assert.doesNotMatch(indicatorMarkup, /truncate|hidden sm:block/);
  check('five-step indicator retains visible wrapping labels and current step semantics');

  const denied = load('app/(admin)/admin/associations/page.tsx', { autorise: false });
  const deniedMarkup = renderToStaticMarkup(denied.render()); assert.match(deniedMarkup, /réservé aux administrateurs/); assert.doesNotMatch(deniedMarkup, /<form/);
  const form = { nom: 'Association QA', description: 'Entraide', pays: 'Mali', ville: 'Bamako', vocation: 'Éducation', dateCreation: '', site: '', emailContact: '' };
  const admin = load('app/(admin)/admin/associations/page.tsx', { autorise: true, formulaire: form, chargement: false, chargementSuggestions: false });
  nodes(admin.render()).find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(admin.calls.length, 0); assert.match(admin.state.erreurFormulaire, /responsable/);
  check('admin access guard and required validated responsible selection');

  const responsible = { id: 'profile-id', userId: 'user-id', prenom: 'QA', nom: 'Responsable', photo: null };
  const create = load('app/(admin)/admin/associations/page.tsx', { autorise: true, formulaire: form, responsable: responsible }, { post: async () => ({ data: { association: { ...fresh, responsable: responsible } } }) });
  nodes(create.render()).find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(create.calls[0].args[0], '/associations'); assert.equal(create.calls[0].args[1].responsableId, 'profile-id'); assert.equal(create.state.editionId, fresh.id);
  assert.ok(nodes(create.render()).some((node) => node.props?.href === '/associations/new%2Fid' && text(node) === 'Ouvrir la fiche et gérer les photos'));
  check('admin creation sends profile ID and exposes saved association photo-management link');

  const suggestion = { id: 'proposal/id', nom: 'Proposition QA', pays: 'Mali', ville: 'Bamako', vocation: 'Culture', message: 'Bonjour', statut: 'EN_ATTENTE', createdAt: '2026-09-28' };
  const review = load('app/(admin)/admin/associations/page.tsx', { autorise: true, chargementSuggestions: false, suggestions: { suggestions: [suggestion], totalPages: 1 } }, { patch: async () => ({ data: {} }), get: async () => ({ data: { suggestions: [], totalPages: 1 } }) });
  button(review.render(), 'Préparer la fiche').props.onClick(); assert.equal(review.calls.length, 0); assert.equal(review.state.formulaire.nom, suggestion.nom); assert.equal(review.state.responsable, null);
  button(review.render(), 'Marquer comme traitée').props.onClick(); await tick();
  assert.equal(review.calls[0].args[0], '/associations/suggestions/proposal%2Fid'); assert.equal(review.calls[0].args[1].statut, 'TRAITEE');
  assert.equal(review.calls[1].args[0], '/associations/suggestions');
  check('suggestion preparation creates nothing; review status mutation refreshes pending list');

  console.log('14 groups passed; all API, router and storage interactions mocked. No production or DB access.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

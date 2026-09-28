#!/usr/bin/env node
/* Local, read-only checks against the actual TS/TSX sources. No server, network,
 * API, database or application write. Optional argument: frontend source root.
 * Only the VM copy receives a test export of the existing fusion function.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const active = '/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend';
const sourceRoot = path.resolve(process.argv[2] || active);
const ts = require(path.join(active, 'node_modules/typescript'));
const React = require(path.join(active, 'node_modules/react'));
const jsx = require(path.join(active, 'node_modules/react/jsx-runtime'));
const { renderToStaticMarkup } = require(path.join(active, 'node_modules/react-dom/server'));
const cache = new Map();
const hashes = {};
const checks = [];
const plain = value => JSON.parse(JSON.stringify(value));
const forbidden = () => { throw Error('Network/API is forbidden in this read-only fixture'); };
const mocks = {
  react: React,
  'react/jsx-runtime': jsx,
  './SearchCombobox': () => null,
  './StarRating': () => null,
  '@/lib/api': { get: forbidden, post: forbidden, patch: forbidden, delete: forbidden },
};
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const filename = path.join(sourceRoot, 'src', relative);
  const original = fs.readFileSync(filename, 'utf8');
  hashes[relative] = createHash('sha256').update(original).digest('hex');
  const source = original + (relative === 'components/onboarding/StepFormations.tsx'
    ? '\nexport { fusionnerParcoursScolairesCompatibles as __fusionPourVerification };\n' : '');
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const module = { exports: {} };
  cache.set(relative, module.exports);
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, console, Date, Map, Set, URL, URLSearchParams,
    fetch: forbidden,
    require: id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      let dependency;
      if (id.startsWith('@/lib/')) dependency = id.slice(2);
      else if (id.startsWith('.') && relative.startsWith('lib/')) dependency = path.posix.join(path.posix.dirname(relative), id);
      else throw Error(`Unexpected module dependency: ${relative} → ${id}`);
      assert(dependency.startsWith('lib/'), 'Only local pure helpers may be imported');
      return load(`${dependency}.ts`);
    },
  }, { filename, timeout: 5000 });
  cache.set(relative, module.exports);
  return module.exports;
}
function record(label, action) { action(); checks.push(label); }
function ordered(html, labels) {
  let previous = -1;
  for (const label of labels) {
    const index = html.indexOf(label);
    assert(index > previous, `Missing or out-of-order SSR label: ${label}`);
    previous = index;
  }
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}

try {
  const { trierParDateDebut } = load('lib/periode.ts');
  const StepFormations = load('components/onboarding/StepFormations.tsx');
  const StepExperiences = load('components/onboarding/StepExperiences.tsx').default;
  const fusionner = StepFormations.__fusionPourVerification;
  const periods = freeze([
    { id: 'old', anneeDebut: '2005', moisDebut: '06' },
    { id: 'unknown' },
    { id: 'recent-a', anneeDebut: '2024', moisDebut: '09' },
    { id: 'recent-b', anneeDebut: 2024, moisDebut: 9 },
    { id: 'early-month', anneeDebut: '2024', moisDebut: '01' },
    { id: 'invalid', anneeDebut: 'non renseignée' },
  ]);
  const before = JSON.stringify(periods);
  record('default descending by year/month; stable ties and undated entries last; input untouched', () => {
    assert.deepEqual(plain(trierParDateDebut(periods).map(v => v.id)), ['recent-a', 'recent-b', 'early-month', 'old', 'unknown', 'invalid']);
    assert.equal(JSON.stringify(periods), before);
  });
  record('explicit ascending internal order preserves stable ties and keeps undated entries last', () => {
    assert.deepEqual(plain(trierParDateDebut(periods, 'croissant').map(v => v.id)), ['old', 'early-month', 'recent-a', 'recent-b', 'unknown', 'invalid']);
    assert.equal(JSON.stringify(periods), before);
  });
  const school = (id, debut, fin, extra = {}) => ({
    id, type: 'ecole', pays: 'Mali', paysCode: 'ML', ville: 'Bamako',
    etablissement: 'École QA fusion', etablissementId: 'qa-school', systemeEducatifCode: 'FR',
    moisDebut: '09', anneeDebut: String(debut), moisFin: '06', anneeFin: String(fin),
    statutDiplome: 'OBTENU', diplomeObtenu: true, programme: '',
    diplome: 'Baccalauréat', anneePromo: String(fin), mention: '', specialite: '', commentaire: '',
    noteEnseignants: null, noteContenu: null, noteCadre: null,
    diplomesScolaires: [{ type: 'AUTRE', libelle: `Diplôme QA ${fin}`, anneeObtention: String(fin), mention: '', serie: '', statut: 'OBTENU' }],
    ...extra,
  });
  const adjacent = freeze([school('recent', 2005, 2008), school('old', 2000, 2005)]);
  const snapshot = JSON.stringify(adjacent);
  record('legacy adjacent school records merge while preserving earliest start, latest end and both diplomas', () => {
    const merged = fusionner(adjacent);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, 'old');
    assert.equal(merged[0].anneeDebut, '2000');
    assert.equal(merged[0].anneeFin, '2008');
    assert.deepEqual(plain(merged[0].diplomesScolaires.map(d => d.anneeObtention)).sort(), ['2005', '2008']);
    assert.equal(JSON.stringify(adjacent), snapshot);
    assert.deepEqual(plain(fusionner(merged)), plain(merged));
  });
  record('distant periods of the same school remain separate regardless of snapshot input order', () => {
    const values = freeze([school('recent', 2000, 2005), school('distant', 1990, 1992)]);
    assert.equal(fusionner(values).length, 2);
    assert.equal(fusionner([...values].reverse()).length, 2);
  });
  record('contradictory reviews and distinct schools remain separate', () => {
    assert.equal(fusionner([school('a', 2000, 2005, { noteEnseignants: 1 }), school('b', 2005, 2008, { noteEnseignants: 5 })]).length, 2);
    assert.equal(fusionner([school('a', 2000, 2005), school('b', 2005, 2008, { etablissementId: 'other-school' })]).length, 2);
  });
  const noAction = () => {};
  record('formation onboarding SSR presents most recent school first without mutating its input snapshot', () => {
    const values = freeze([
      school('old', 2000, 2005, { etablissementId: 'old-school', etablissement: 'École QA ancienne' }),
      school('new', 2020, 2024, { etablissementId: 'new-school', etablissement: 'École QA récente' }),
    ]);
    const initial = JSON.stringify(values);
    const html = renderToStaticMarkup(React.createElement(StepFormations.default, { initialData: values, onNext: noAction, onBack: noAction }));
    ordered(html, ['École QA récente', 'École QA ancienne']);
    assert(!html.includes('du plus ancien au plus récent'), 'Formation instructions still promise oldest-first display');
    assert.equal(JSON.stringify(values), initial);
  });
  record('experience onboarding SSR presents most recent start first without mutating its input snapshot', () => {
    const values = freeze([
      { id: 'old', poste: 'Poste QA ancien', structure: 'Structure ancienne', typeContrat: 'CDI', pays: 'Mali', paysCode: 'ML', ville: 'Bamako', moisDebut: '01', anneeDebut: '2005', moisFin: '01', anneeFin: '2006', posteActuel: false, description: '' },
      { id: 'new', poste: 'Poste QA récent', structure: 'Structure récente', typeContrat: 'CDI', pays: 'Mali', paysCode: 'ML', ville: 'Bamako', moisDebut: '01', anneeDebut: '2024', moisFin: '', anneeFin: '', posteActuel: true, description: '' },
    ]);
    const initial = JSON.stringify(values);
    const html = renderToStaticMarkup(React.createElement(StepExperiences, { initialData: values, onNext: noAction, onBack: noAction }));
    ordered(html, ['Poste QA récent', 'Poste QA ancien']);
    assert(!html.includes('du plus ancien au plus récent'), 'Experience instructions still promise oldest-first display');
    assert.equal(JSON.stringify(values), initial);
  });
  console.log(JSON.stringify({ status: 'passed', sourceRoot, checks, sourceSha256: hashes, applicationWrites: 0, networkRequests: 0, databaseWrites: 0,
    limitations: ['SSR and pure local fixtures; no browser hydration or production account', 'Profile public/member rendering and current-job selection verified separately by the main session'] }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', checksPassed: checks, message: error.message, stack: error.stack }, null, 2));
  process.exitCode = 1;
}

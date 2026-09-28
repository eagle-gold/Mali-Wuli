#!/usr/bin/env node
/*
 * Read-only release smoke: no session, no browser JS, no API mutation, no DB writes.
 * Candidate:
 *   MW_QA_SOCKET=/tmp/mali-wuli-home-qa-associations-$$.sock \
 *   NODE_OPTIONS=--require=/ABS/hbuilds/qa-unix-transport.cjs \
 *   node verify-associations-release.cjs /ABS/release/nodejs > candidate.json
 * Public (do not preload the candidate transport):
 *   node verify-associations-release.cjs https://mali-wuli.com --reference candidate.json
 * Optional --baseline-only checks just home/login/register and records their semantic
 * signatures before release. Its JSON can be passed with --baseline previous.json
 * to assert home and registration markup have not changed, independently of hashes.
 * Reference mode compares every candidate asset to the actual public response.
 * --image-equivalence verified-images.json permits only the two documented PNG
 * recompressions, bound to both current binary hashes and exact RGBA pixel hashes.
 * All other files remain byte-for-byte comparisons; raw hashes stay in the report.
 * This script never executes downloaded JavaScript or sends an Authorization header.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const args = process.argv.slice(2);
const target = args.shift();
assert(target, 'Usage: verify-associations-release.cjs <release/nodejs|https://site> [--reference candidate.json] [--baseline previous.json] [--baseline-only] [--image-equivalence verified-images.json]');
const options = {};
while (args.length) {
  const key = args.shift();
  if (key === '--baseline-only') options.baselineOnly = true;
  else if (key === '--reference' || key === '--baseline' || key === '--image-equivalence') {
    assert(args[0] && !args[0].startsWith('--'), `Missing value for ${key}`);
    options[key.slice(2)] = args.shift();
  } else throw new Error(`Unknown option ${key}`);
}
const live = target.startsWith('https://');
if (options['image-equivalence']) assert(live && options.reference && !options.baselineOnly, '--image-equivalence requires public release mode and --reference');
if (!live) {
  assert(path.isAbsolute(target), 'Candidate directory must be an absolute path');
  for (const name of ['server.js', '.next/BUILD_ID']) assert(fs.existsSync(path.join(target, name)), `Candidate file missing: ${name}`);
}
const base = live ? new URL(target).origin : 'http://127.0.0.1:31544';
const child = live ? null : spawn(process.execPath, ['server.js'], {
  cwd: target,
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: '31544' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
const keepLog = data => { logs = (logs + data.toString()).slice(-4000); };
child?.stdout.on('data', keepLog);
child?.stderr.on('data', keepLog);
let spawnError;
child?.on('error', error => { spawnError = error; });
const cache = new Map();
const checks = [];
const routesChecked = [];
const pageAssets = new Map();
const assets = new Set();
const digest = value => createHash('sha256').update(value).digest('hex');
const decodeJs = value => value
  .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const forbiddenCircleUi = [
  'Mes cercles', 'Les cercles', 'Cercles qui peuvent vous intéresser', 'Découvrir les cercles',
  'Gérer mes cercles', 'Tous les cercles', 'rejoindre un cercle', 'cercles de réflexion',
  'cercle_modifie', 'mes-cercles',
];

async function read(route, { manual = false, fresh = false, timeout = 25000 } = {}) {
  assert(typeof route === 'string' && route.startsWith('/') && !route.startsWith('//'), `Same-origin path required: ${route}`);
  const url = new URL(route, base);
  assert.equal(url.origin, base, 'Cross-origin assets are not fetched');
  const key = url.pathname + url.search;
  if (!fresh && !manual && cache.has(key)) return cache.get(key);
  const pending = (async () => {
    const response = await fetch(url.href, { method: 'GET', redirect: manual ? 'manual' : 'error', credentials: 'omit', signal: AbortSignal.timeout(timeout) });
    if (!manual) assert.equal(response.status, 200, `${key}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    return { path: key, status: response.status, headers: response.headers, bytes, text: bytes.toString('utf8'), sha256: digest(bytes) };
  })();
  if (!fresh && !manual) cache.set(key, pending);
  try { return await pending; }
  catch (error) { cache.delete(key); throw error; }
}

function assetPaths(html) {
  return [...new Set([...html.matchAll(/(?:src|href)="([^"\s]+)"/g)]
    .map(match => match[1].replace(/&amp;/g, '&'))
    .filter(value => value.startsWith('/_next/') || value.startsWith('/images/')))];
}
function containsAll(value, labels, context) {
  for (const label of labels) assert(value.includes(label), `${context}: missing ${label}`);
}
function assertNoCircles(value, context) {
  for (const label of forbiddenCircleUi) assert(!value.includes(label), `${context}: removed circle feature ${label}`);
}
function verifyImageEquivalence(proof, referenceHashes, publicHashes) {
  const permittedPaths = new Set(['/images/landing/mali-wuli-arbre.png', '/images/logo-mali-wuli.png']);
  const sha = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  assert(Array.isArray(proof.images) && proof.images.length > 0 && proof.images.length <= permittedPaths.size, 'Image equivalence proof must list the documented PNGs');
  const seen = new Set();
  const images = proof.images.map(image => {
    const asset = image.path;
    assert(permittedPaths.has(asset), `Image equivalence is not permitted for ${asset}`);
    assert(!seen.has(asset), `Duplicate image equivalence path ${asset}`);
    seen.add(asset);
    assert.equal(image.status, 200, `${asset}: evidence was not HTTP 200`);
    assert.equal(image.samePixels, true, `${asset}: exact pixel equality was not established`);
    const source = image.source;
    const published = image.public;
    assert(source && published, `${asset}: source/public evidence missing`);
    assert.equal(source.format, 'png', `${asset}: source format is not PNG`);
    assert.equal(published.format, 'png', `${asset}: public format is not PNG`);
    for (const value of [source.sha256, published.sha256, source.pixelSha256, published.pixelSha256]) assert(sha(value), `${asset}: invalid evidence SHA-256`);
    assert.equal(source.sha256, referenceHashes[asset], `${asset}: evidence does not match the verified candidate bytes`);
    assert.equal(published.sha256, publicHashes[asset], `${asset}: evidence does not match the current public bytes`);
    assert.equal(source.pixelSha256, published.pixelSha256, `${asset}: decoded RGBA pixels differ`);
    for (const dimension of ['width', 'height']) {
      assert(Number.isInteger(source[dimension]) && source[dimension] > 0, `${asset}: invalid ${dimension}`);
      assert.equal(source[dimension], published[dimension], `${asset}: ${dimension} differs`);
    }
    return { path: asset, sourceSha256: source.sha256, publicSha256: published.sha256,
      pixelSha256: source.pixelSha256, width: source.width, height: source.height, format: 'png', samePixels: true };
  });
  return { evidenceAt: proof.at || null, method: 'Exact decoded RGBA SHA-256 and dimensions; both binary hashes bound to current candidate/public assets', images };
}
function compareAssetHashes(referenceHashes, publicHashes, equivalentImages = []) {
  assert.deepEqual(Object.keys(publicHashes).sort(), Object.keys(referenceHashes).sort(), 'Public asset paths differ from the verified candidate');
  const permittedDifferences = new Set(equivalentImages.map(image => image.path));
  for (const asset of Object.keys(referenceHashes)) {
    if (publicHashes[asset] !== referenceHashes[asset]) assert(permittedDifferences.has(asset), `${asset}: public bytes differ without exact image equivalence proof`);
  }
}
function semanticSignature(html) {
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const text = markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const hrefs = [...markup.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map(match => match[1]).sort();
  const fields = [...markup.matchAll(/<(?:input|textarea|select)\b[^>]*>/gi)].map(match => {
    const tag = match[0];
    return [...tag.matchAll(/\b(type|name|placeholder|autocomplete|maxlength|minlength|pattern)="([^"]*)"/gi)].map(m => `${m[1].toLowerCase()}=${m[2]}`).sort().join('|');
  });
  const tree = [...markup.matchAll(/<(?:path|circle|ellipse|line)\b[^>]*>/gi)].map(match => [...match[0].matchAll(/\b(d|cx|cy|r|rx|ry|x1|x2|y1|y2|transform)="([^"]*)"/gi)].map(m => `${m[1]}=${m[2]}`).sort().join('|'));
  return { text: digest(text), links: digest(JSON.stringify(hrefs)), fields: digest(JSON.stringify(fields)), geometry: digest(JSON.stringify(tree)) };
}
async function page(route) {
  const response = await read(route);
  assert(response.headers.get('content-type')?.includes('text/html'), `${route}: expected HTML`);
  assertNoCircles(decodeJs(response.text), route);
  const found = assetPaths(response.text);
  assert(found.some(asset => asset.endsWith('.js')), `${route}: missing Next JavaScript`);
  pageAssets.set(route, found);
  for (const asset of found) assets.add(asset);
  routesChecked.push(route);
  return response;
}
async function codeFor(route) {
  const urls = (pageAssets.get(route) || []).filter(asset => /\.js(?:\?|$)/.test(asset));
  return decodeJs((await Promise.all(urls.map(async asset => (await read(asset)).text))).join('\n'));
}
function serializedBottomLinks(html) {
  // PlatformLayout is a Server Component: the bottom menu is serialized into
  // Flight children behind AuthGuard and need not exist in a client JS chunk.
  const stream = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)].map(match => JSON.parse(match[1])).join('');
  const records = new Map();
  for (const line of stream.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    try { records.set(line.slice(0, colon), JSON.parse(line.slice(colon + 1))); } catch {}
  }
  const seen = new Set();
  let result;
  function resolve(value) {
    if (typeof value === 'string' && /^\$(?:L)?[0-9a-f]+$/i.test(value)) return records.get(value.replace(/^\$L?/, '')) ?? value;
    return value;
  }
  function hrefs(value, visited = new Set()) {
    value = resolve(value);
    if (!value || typeof value !== 'object' || visited.has(value)) return [];
    visited.add(value);
    if (Array.isArray(value)) return value.flatMap(item => hrefs(item, visited));
    return [...(typeof value.href === 'string' ? [value.href] : []), ...Object.values(value).flatMap(item => hrefs(item, visited))];
  }
  function walk(value) {
    value = resolve(value);
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value) && value[1] === 'nav' && String(value[3]?.className).includes('fixed bottom-0')) result = hrefs(value[3]);
    for (const item of Object.values(value)) walk(item);
  }
  for (const value of records.values()) walk(value);
  return result;
}
function checkNavigation(code, html) {
  containsAll(code, ['Navigation membre', 'Navigation membre mobile'], 'member header');
  // Both header variants share the same literal links list. The bottom nav has
  // a second list. Inspect only these arrays, since profile/recommendations still
  // legitimately contain links to the preserved /synergies page.
  const arrays = [...code.matchAll(/\[[^\[\]]{1,4500}\]/g)].map(match => match[0]);
  const links = list => [...list.matchAll(/(?:href|"href")\s*:\s*["']([^"']+)["']/g)].map(match => match[1]);
  const header = arrays.map(links).find(items => items.includes('/dashboard') && items.includes('/annuaire') && items.includes('/education'));
  const bottom = arrays.map(links).find(items => items.includes('/dashboard') && items.includes('/agenda') && items.includes('/messages') && items.includes('/profil')) || serializedBottomLinks(html);
  assert(header, 'Compiled member header navigation list not found');
  assert(bottom, 'Mobile bottom navigation not found in bundle or serialized server layout');
  assert.deepEqual(header, ['/dashboard', '/annuaire', '/evenements', '/offres', '/education']);
  assert.deepEqual(bottom, ['/dashboard', '/agenda', '/messages', '/profil']);
  return { header, bottom };
}

(async () => {
  try {
    if (child) {
      let ready = false;
      for (let i = 0; i < 60; i++) {
        if (spawnError) throw spawnError;
        if (child.exitCode !== null) throw new Error(`Candidate exited before readiness: ${logs}`);
        try { await read('/', { fresh: true, timeout: 2000 }); ready = true; break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      assert(ready, `Candidate not ready: ${logs}`);
    }
    const home = await page('/');
    assert(home.headers.get('cache-control')?.includes('no-store'), 'Homepage HTML must remain no-store');
    containsAll(home.text, ['L’arbre', 'Mali Wuli', 'Le fil du réseau', 'Vos questions', 'viewBox="70 -45 1060 765"', 'Paris 8e', 'href="/register"', 'href="/login"'], 'homepage');
    assert(!home.text.includes('Paris 11e'), 'Old Paris event location returned');
    assert(!home.text.includes('support.js'), 'Prototype support runtime returned');
    const register = await page('/register');
    containsAll(register.text, ['Créer votre compte', 'Adresse e-mail', 'Recevoir mon code', 'type="email"'], 'registration');
    await page('/login');
    containsAll(await codeFor('/register'), ['/auth/request-email-code', '/verify-email', 'mali_wuli_pending_email'], 'preserved registration API flow');
    const signatures = { '/': semanticSignature(home.text), '/register': semanticSignature(register.text) };
    checks.push('homepage-tree-sections-navigation-and-registration-flow-preserved');

    let navigation;
    if (!options.baselineOnly) {
      const routeProbe = '00000000-0000-4000-8000-000000000000';
      const associationRoute = `/associations/${routeProbe}`;
      const memberRoute = `/membres/${routeProbe}`;
      for (const route of ['/dashboard', '/profil', '/annuaire', '/onboarding', '/admin', '/admin/associations', associationRoute, memberRoute, '/synergies']) await page(route);
      checks.push('directory-association-member-and-admin-route-shells-served');
      const directoryCode = await codeFor('/annuaire');
      containsAll(directoryCode, ['Personnes', 'Associations', 'Voir le profil', 'Contacter', 'Voir la page', 'Rejoindre', 'etablissementId', 'promotion', 'aide', 'vocation', '/associations', '/messages/conversations'], 'directory bundle');
      containsAll(await codeFor(associationRoute), ['Demandes d’affiliation', 'Les membres', 'Modifier la couverture', '/affiliations', 'VERIFIE', 'REFUSE'], 'association detail bundle');
      containsAll(await codeFor(memberRoute), ['Retour à l’annuaire', 'Expériences', 'Formations', 'Affiliations validées', 'Coordonnées'], 'member detail bundle');
      containsAll(await codeFor('/admin/associations'), ['Créer une association', 'Responsable de l’association', 'Propositions d’ajout en attente', '/associations/responsables'], 'association administration bundle');
      containsAll(await codeFor('/onboarding'), ['Vos associations', '/onboarding/associations', 'Mes affiliations et demandes'], 'onboarding associations bundle');
      checks.push('new-directory-detail-admin-and-onboarding-interfaces-in-served-bundles');
      const dashboardCode = await codeFor('/dashboard');
      containsAll(dashboardCode, ['Proposer une synergie', 'Synergies suggérées', '/synergies/suggestions'], 'dashboard preserved recommendations');
      containsAll(await codeFor('/profil'), ['Synergies possibles pour vous', '/synergies/suggestions'], 'profile preserved recommendations');
      containsAll(await codeFor('/synergies'), ['Mes synergies'], 'preserved synergy page');
      navigation = checkNavigation(dashboardCode, (await read('/dashboard')).text);
      checks.push('menus-without-circles-or-synergies-recommendations-still-present');
      const retired = await read('/cercles', { manual: true });
      assert([307, 308].includes(retired.status), '/cercles must redirect');
      assert.equal(new URL(retired.headers.get('location'), base).pathname, '/dashboard');
      checks.push('retired-circle-route-redirects-to-dashboard');
    }

    // Fetch each local asset once; verify CSS-referenced fonts as well as preload fonts.
    const firstAssets = await Promise.all([...assets].map(asset => read(asset)));
    for (const resource of firstAssets) {
      if (/\.css(?:\?|$)/.test(resource.path)) {
        assert(resource.headers.get('content-type')?.includes('text/css'), `${resource.path}: CSS content type`);
        for (const match of resource.text.matchAll(/url\(['"]?([^)'"\s]+\.(?:woff2?|ttf)(?:\?[^)'"\s]*)?)['"]?\)/g)) {
          const font = new URL(match[1], base + resource.path);
          assert.equal(font.origin, base, 'Fonts must be self-hosted');
          assets.add(font.pathname + font.search);
        }
      }
      if (/\.js(?:\?|$)/.test(resource.path)) {
        assert(/javascript/.test(resource.headers.get('content-type') || ''), `${resource.path}: JavaScript content type`);
        assertNoCircles(decodeJs(resource.text), resource.path);
      }
    }
    assets.add('/images/landing/mali-wuli-arbre.png');
    const resources = await Promise.all([...assets].sort().map(asset => read(asset)));
    const logo = resources.find(resource => resource.path === '/images/landing/mali-wuli-arbre.png');
    assert(logo.headers.get('content-type')?.startsWith('image/'), 'Landing logo content type');
    assert(resources.some(resource => /\.woff2?(?:\?|$)/.test(resource.path)), 'Self-hosted font files missing');
    const assetHashes = Object.fromEntries(resources.map(resource => [resource.path, resource.sha256]));
    checks.push('all-route-javascript-css-font-and-image-assets-return-http-200');

    if (options.baseline) {
      const baseline = JSON.parse(fs.readFileSync(options.baseline, 'utf8'));
      assert.equal(baseline.status, 'passed', 'Baseline verification did not pass');
      assert.deepEqual(signatures, baseline.semanticSignatures, 'Homepage or registration semantic content changed');
      checks.push('homepage-and-registration-match-pre-release-semantic-baseline');
    }
    let imageEquivalence;
    if (options.reference) {
      const reference = JSON.parse(fs.readFileSync(options.reference, 'utf8'));
      assert.equal(reference.status, 'passed', 'Candidate reference did not pass');
      assert(!reference.baselineOnly, 'A baseline-only result cannot certify a release');
      assert.deepEqual(signatures, reference.semanticSignatures, 'Public homepage/registration differs from candidate');
      assert.deepEqual(routesChecked, reference.routesChecked, 'Public route set differs from candidate');
      if (options['image-equivalence']) {
        const evidenceBytes = fs.readFileSync(options['image-equivalence']);
        imageEquivalence = { ...verifyImageEquivalence(JSON.parse(evidenceBytes.toString('utf8')), reference.assetHashes, assetHashes),
          evidenceFile: path.basename(options['image-equivalence']), evidenceSha256: digest(evidenceBytes) };
        checks.push('documented-png-recompression-exact-pixels-dimensions-and-current-binary-hashes-verified');
      }
      compareAssetHashes(reference.assetHashes, assetHashes, imageEquivalence?.images);
      if (imageEquivalence) checks.push('all-other-assets-byte-identical-to-verified-candidate');
      checks.push('public-assets-and-semantic-content-match-verified-candidate');
    }
    console.log(JSON.stringify({
      status: 'passed', mode: live ? 'public' : 'candidate', baselineOnly: Boolean(options.baselineOnly), base,
      buildId: live ? undefined : fs.readFileSync(path.join(target, '.next/BUILD_ID'), 'utf8').trim(),
      checks, routesChecked, navigation, assetsChecked: resources.length,
      memberBundlesChecked: [...assets].filter(asset => /\.js(?:\?|$)/.test(asset)).length,
      semanticSignatures: signatures, assetHashes, imageEquivalence, databaseWrites: 0, authenticatedRequests: 0,
      limitations: ['Protected pages tested as route shells and downloaded bundles, not as authenticated member/admin sessions', 'Synthetic detail URL only verifies route delivery; no real association or member data is requested', 'Client JavaScript is not executed; interactive behavior and API permissions have separate fixture tests'],
    }, null, 2));
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

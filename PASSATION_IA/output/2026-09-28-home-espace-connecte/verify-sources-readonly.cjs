'use strict';
// Filesystem-only release guard. Never imports an application, ORM or environment file.
// Run beside release-contract.json and both manifests.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const phase = process.argv[2];
assert(['before', 'candidate', 'candidate-built', 'after'].includes(phase), 'PHASE_REQUIRED');
const root = '/home/u668963025/domains/mali-wuli.com/hbuilds';
const back = '/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'release-contract.json'), 'utf8'));
assert.equal(contract.release, '20260928-home-session-r2');
assert.equal(contract.previousFrontend, '20260928-suppressions-droits');
assert.equal(contract.backendRelease, '20260928-suppressions-droits');
assert.equal(contract.frontendOnly, true); assert.equal(contract.migrationAllowed, false); assert.equal(contract.databaseAccess, false);
for (const [file, expected] of [['baseline-source-manifest.json', contract.baselineManifestSha256], ['source-manifest.json', contract.sourceManifestSha256]]) assert.equal(sha(path.join(__dirname, file)), expected, file);
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-source-manifest.json'), 'utf8'));
const candidate = JSON.parse(fs.readFileSync(path.join(__dirname, 'source-manifest.json'), 'utf8'));
const partOf = (m, part) => Object.fromEntries(Object.entries(m).filter(([p]) => p.startsWith(part + '/')));
assert.equal(Object.keys(before).length, 230);
assert.equal(Object.keys(partOf(before, 'frontend')).length, 127);
assert.equal(Object.keys(partOf(before, 'backend')).length, 103);
assert.deepEqual(partOf(candidate, 'backend'), partOf(before, 'backend'), 'BACKEND_MANIFEST_CHANGED');
assert.equal(Object.keys(partOf(candidate, 'frontend')).length, contract.frontendFiles);
assert.equal(Object.keys(partOf(candidate, 'backend')).length, contract.backendFiles);
const targets = { frontend: fs.readlinkSync(root + '/current'), backend: fs.readlinkSync(back + '/current') };
assert.equal(targets.backend, 'versions/' + contract.backendRelease, 'BACKEND_CURRENT_CHANGED');
assert.equal(targets.frontend, 'versions/' + (phase === 'after' ? contract.release : contract.previousFrontend), 'FRONTEND_CURRENT_DRIFT');
if (phase !== 'after') assert.equal(fs.readFileSync(root + '/current/nodejs/.next/BUILD_ID', 'utf8').trim(), contract.baselineBuildId, 'BASELINE_BUILD_DRIFT');
const manifest = phase === 'before' ? before : candidate;
const frontSource = root + '/sources/' + (phase === 'before' ? contract.previousFrontend : contract.release);
for (const [file, expected] of Object.entries(manifest)) {
  const [part, ...rest] = file.split('/');
  assert(['frontend', 'backend'].includes(part) && rest.length && rest.every(p => p !== '..' && p !== '.' && p !== ''), 'INVALID_MANIFEST_PATH');
  const directory = part === 'frontend' ? frontSource : back + '/versions/' + contract.backendRelease + '/nodejs';
  assert.equal(sha(path.join(directory, ...rest)), expected, file);
}
let buildId;
if (phase === 'candidate-built' || phase === 'after') {
  const version = root + '/versions/' + contract.release + '/nodejs';
  assert(fs.statSync(version + '/server.js').isFile(), 'CANDIDATE_SERVER_MISSING');
  buildId = fs.readFileSync(version + '/.next/BUILD_ID', 'utf8').trim();
  assert(buildId && buildId !== contract.baselineBuildId, 'CANDIDATE_BUILD_ID_INVALID');
  if (phase === 'after') assert.equal(fs.readFileSync(root + '/current/nodejs/.next/BUILD_ID', 'utf8').trim(), buildId, 'CURRENT_BUILD_MISMATCH');
}
console.log(JSON.stringify({status:'PASS',kind:'frontend-only-sources-and-targets',at:new Date().toISOString(),phase,release:contract.release,targets,buildId,files:Object.keys(manifest).length,frontendFiles:Object.keys(partOf(manifest,'frontend')).length,backendFiles:103,backendUnchanged:true,databaseRequests:0,databaseWrites:0,remoteWrites:0},null,2));

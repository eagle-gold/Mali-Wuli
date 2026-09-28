#!/usr/bin/env node
'use strict';

// Filesystem and proof verifier for a frontend-only release. It never imports
// application code, opens .env, connects to a database, or sends an HTTP request.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const FRONT = '/home/u668963025/domains/mali-wuli.com/hbuilds';
const BACK = '/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
const RELEASE = '20260928-profil-typographie';
const PREVIOUS = '20260928-liens-sociaux';
const BASELINE_BUILD_ID = 'MF940TX4N8sLGFRsT_gyN';
const BASELINE_MANIFEST_SHA256 = '5a33bd43b7d7b119517eaef7f0a714ee960b033d989f6a7114b320f83ce87f6d';
const EXPECTED_CHANGES = {
  'frontend/src/components/profile/AssociationsProfil.tsx': {
    before: 'ea24ebce655c6d0388c63a7ea0d445ba8c6098e7f6b3c38eea8501deb6c2fb61',
    after: '6e718153b5dadb0678e6e8001753aff50e94b783b43f033e80663293f72a113e',
  },
  'frontend/src/components/profile/LiensSociauxProfil.tsx': {
    before: '133304bca617400bc92cd7b41769b1210323225f6e5c7ce034b3f67832bbe281',
    after: '1a9d38a4b5f2aa8bee2797e0b38c8a40d1011a46004307c1f35cb0bf5e241221',
  },
  'frontend/src/components/profile/ProfilMembre.tsx': {
    before: 'af732be0fc2571f1e65b6ec3fdad19bfd69866f894144134fb8f05289b85de26',
    after: 'e7955986c435696489e33bdf12cc099531c07640ebabdb7789b87cbea888ba1f',
  },
};

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const shaFile = filename => digest(fs.readFileSync(filename));
const readJson = filename => JSON.parse(fs.readFileSync(path.join(__dirname, filename), 'utf8'));
const safeRelative = value => {
  const pieces = value.split('/');
  assert(pieces.length > 1 && ['frontend', 'backend'].includes(pieces[0]), 'MANIFEST_PATH_PART');
  assert(pieces.slice(1).every(piece => piece && piece !== '.' && piece !== '..'), 'MANIFEST_PATH_TRAVERSAL');
  return pieces;
};

function contractAndManifests() {
  const contract = readJson('package-contract.json');
  const baselinePath = path.join(__dirname, 'baseline-source-manifest.json');
  const manifestPath = path.join(__dirname, 'source-manifest.json');
  assert.equal(contract.release, RELEASE, 'CONTRACT_RELEASE');
  assert.equal(contract.previousFrontend, PREVIOUS, 'CONTRACT_PREVIOUS_FRONTEND');
  assert.equal(contract.previousBackend, PREVIOUS, 'CONTRACT_PREVIOUS_BACKEND');
  assert.equal(contract.backendRelease, PREVIOUS, 'CONTRACT_BACKEND_RELEASE');
  assert.equal(contract.baselineBuildId, BASELINE_BUILD_ID, 'CONTRACT_BASELINE_BUILD');
  assert.equal(contract.migrationAllowed, false, 'MIGRATION_MUST_BE_FORBIDDEN');
  assert.equal(contract.databaseWritesAllowed, false, 'DATABASE_WRITES_MUST_BE_FORBIDDEN');
  assert.equal(contract.files, 235, 'CONTRACT_SOURCE_COUNT');
  assert.equal(contract.frontendFiles, 129, 'CONTRACT_FRONTEND_COUNT');
  assert.equal(contract.backendFiles, 106, 'CONTRACT_BACKEND_COUNT');
  assert.equal(contract.baselineManifestSha256, BASELINE_MANIFEST_SHA256, 'CONTRACT_BASELINE_MANIFEST');
  assert.equal(shaFile(baselinePath), BASELINE_MANIFEST_SHA256, 'BASELINE_MANIFEST_CHANGED');
  assert.equal(shaFile(manifestPath), contract.manifestSha256, 'SOURCE_MANIFEST_CHANGED');
  assert.deepEqual(contract.allowedChanges, EXPECTED_CHANGES, 'CONTRACT_ALLOWED_CHANGES');

  const baseline = readJson('baseline-source-manifest.json');
  const manifest = readJson('source-manifest.json');
  assert.equal(Object.keys(baseline).length, 235, 'BASELINE_FILES');
  assert.deepEqual(Object.keys(manifest).sort(), Object.keys(baseline).sort(), 'SOURCE_SET_CHANGED');
  const changed = Object.keys(manifest).filter(name => manifest[name] !== baseline[name]).sort();
  assert.deepEqual(changed, Object.keys(EXPECTED_CHANGES).sort(), 'UNREVIEWED_SOURCE_CHANGE');
  for (const [name, hashes] of Object.entries(EXPECTED_CHANGES)) {
    assert.equal(baseline[name], hashes.before, `BASELINE_HASH_${name}`);
    assert.equal(manifest[name], hashes.after, `REVIEWED_HASH_${name}`);
  }
  return { contract, baseline, manifest };
}

function currentTargets(expectedFrontend) {
  const targets = {
    frontend: fs.readlinkSync(path.join(FRONT, 'current')),
    backend: fs.readlinkSync(path.join(BACK, 'current')),
  };
  assert.equal(targets.frontend, `versions/${expectedFrontend}`, 'FRONTEND_CURRENT_DRIFT');
  assert.equal(targets.backend, `versions/${PREVIOUS}`, 'BACKEND_CURRENT_DRIFT');
  return targets;
}

function verifyPart(manifest, part, root) {
  let files = 0;
  for (const [name, expected] of Object.entries(manifest)) {
    const pieces = safeRelative(name);
    if (pieces[0] !== part) continue;
    const filename = path.join(root, ...pieces.slice(1));
    assert(fs.statSync(filename).isFile(), `SOURCE_NOT_FILE_${name}`);
    assert.equal(shaFile(filename), expected, `SOURCE_HASH_${name}`);
    files += 1;
  }
  return files;
}

function buildId(release = RELEASE) {
  const filename = path.join(FRONT, 'versions', release, 'nodejs', '.next', 'BUILD_ID');
  const value = fs.readFileSync(filename, 'utf8').trim();
  assert(value && !/\s/.test(value), 'BUILD_ID_INVALID');
  return value;
}

function verifyBrowserProof() {
  const proof = readJson('browser-qa.json');
  assert.equal(proof.result, 'PASS', 'BROWSER_QA_FAILED');
  assert.equal(proof.fixture, 'API en mémoire, sans base ni e-mail', 'BROWSER_QA_FIXTURE');
  assert.equal(proof.desktop.horizontalOverflow, false, 'DESKTOP_HORIZONTAL_OVERFLOW');
  assert.equal(proof.mobile.horizontalOverflow, false, 'MOBILE_HORIZONTAL_OVERFLOW');
  assert.equal(proof.desktop.sectionHeading.fontFamily, 'Playfair Display, serif', 'DESKTOP_SECTION_FONT');
  assert.equal(proof.desktop.sectionHeading.fontSize, '30px', 'DESKTOP_SECTION_SIZE');
  assert.equal(proof.mobile.sectionHeading.fontFamily, 'Playfair Display, serif', 'MOBILE_SECTION_FONT');
  assert.equal(proof.mobile.sectionHeading.fontSize, '24px', 'MOBILE_SECTION_SIZE');
  assert.equal(proof.desktop.subheading.fontSize, '20px', 'DESKTOP_SUBHEADING_SIZE');
  assert.equal(proof.mobile.subheading.fontSize, '18px', 'MOBILE_SUBHEADING_SIZE');
  assert.equal(proof.associations.nestedAdminPanelPresent, false, 'NESTED_ADMIN_PANEL_REMAINS');
  assert.equal(proof.associations.emptyManagementPanelHidden, true, 'EMPTY_MANAGEMENT_PANEL_VISIBLE');
  assert.deepEqual(proof.headingsFoundExactlyOnce, [
    'Expériences', 'Formations', 'Réseaux sociaux', 'Dans le réseau',
    'Mon mentorat', 'En ce moment sur le réseau', 'Mes associations', 'Mes contributions',
  ], 'PROFILE_HEADINGS_QA');
}

function run(mode, archive) {
  const { contract, baseline, manifest } = contractAndManifests();
  if (mode === 'package') {
    assert(archive && path.isAbsolute(archive), 'ARCHIVE_ABSOLUTE_PATH_REQUIRED');
    assert.equal(shaFile(archive), contract.frontendArchiveSha256, 'FRONTEND_ARCHIVE_CHANGED');
    return { status: 'PASS', mode, release: RELEASE, archiveSha256: contract.frontendArchiveSha256, databaseWrites: 0, remoteWrites: 0 };
  }

  assert(['before', 'extracted', 'candidate', 'activation', 'after'].includes(mode), 'MODE_INVALID');
  const after = mode === 'after';
  const targets = currentTargets(after ? RELEASE : PREVIOUS);
  if (!after) assert.equal(buildId(PREVIOUS), BASELINE_BUILD_ID, 'BASELINE_BUILD_CHANGED');

  const previousFrontendSource = path.join(FRONT, 'sources', PREVIOUS);
  const previousBackend = path.join(BACK, 'versions', PREVIOUS, 'nodejs');
  let frontendFiles;
  let backendFiles;
  if (mode === 'before') {
    assert(!fs.existsSync(path.join(FRONT, 'sources', RELEASE)), 'CANDIDATE_SOURCE_ALREADY_EXISTS');
    assert(!fs.existsSync(path.join(FRONT, 'versions', RELEASE)), 'CANDIDATE_VERSION_ALREADY_EXISTS');
    frontendFiles = verifyPart(baseline, 'frontend', previousFrontendSource);
    backendFiles = verifyPart(baseline, 'backend', previousBackend);
  } else {
    const candidateSource = path.join(FRONT, 'sources', RELEASE);
    frontendFiles = verifyPart(manifest, 'frontend', candidateSource);
    backendFiles = verifyPart(baseline, 'backend', previousBackend);
    if (mode === 'extracted') {
      assert(!fs.existsSync(path.join(FRONT, 'versions', RELEASE)), 'CANDIDATE_VERSION_ALREADY_EXISTS');
    } else {
      assert(fs.statSync(path.join(FRONT, 'versions', RELEASE, 'nodejs', 'server.js')).isFile(), 'CANDIDATE_SERVER_MISSING');
      const candidateBuild = buildId();
      assert.notEqual(candidateBuild, BASELINE_BUILD_ID, 'CANDIDATE_BUILD_NOT_NEW');
      if (mode === 'activation') {
        const smoke = readJson('candidate-smoke.json');
        const baselineProof = readJson('public-baseline.json');
        assert.equal(smoke.status, 'passed', 'CANDIDATE_SMOKE_FAILED');
        assert.equal(smoke.release, RELEASE, 'CANDIDATE_SMOKE_RELEASE');
        assert.equal(smoke.backendRelease, PREVIOUS, 'CANDIDATE_SMOKE_BACKEND');
        assert.equal(smoke.mode, 'candidate', 'CANDIDATE_SMOKE_MODE');
        assert.equal(smoke.baselineOnly, false, 'CANDIDATE_SMOKE_BASELINE_ONLY');
        assert.equal(smoke.buildId, candidateBuild, 'CANDIDATE_SMOKE_BUILD');
        assert(smoke.checks.includes('profile-typography-hierarchy-and-flat-associations-bundle-verified'), 'TYPOGRAPHY_BUNDLE_CHECK_MISSING');
        assert(smoke.checks.includes('registration-and-home-full-semantic-content-match-pre-release-baseline'), 'HOME_BASELINE_CHECK_MISSING');
        assert.equal(baselineProof.status, 'passed', 'PUBLIC_BASELINE_FAILED');
        assert.equal(baselineProof.release, RELEASE, 'PUBLIC_BASELINE_RELEASE');
        assert.equal(baselineProof.backendRelease, PREVIOUS, 'PUBLIC_BASELINE_BACKEND');
        assert.equal(baselineProof.mode, 'public', 'PUBLIC_BASELINE_MODE');
        assert.equal(baselineProof.baselineOnly, true, 'PUBLIC_BASELINE_NOT_READONLY');
        verifyBrowserProof();
      }
      if (mode === 'after') {
        assert.equal(fs.readFileSync(path.join(FRONT, 'current', 'nodejs', '.next', 'BUILD_ID'), 'utf8').trim(), candidateBuild, 'CURRENT_BUILD_MISMATCH');
        assert.equal(fs.readFileSync(path.join(FRONT, 'versions', RELEASE, '.previous-target'), 'utf8').trim(), `versions/${PREVIOUS}`, 'PREVIOUS_TARGET_PROOF');
      }
    }
  }
  assert.equal(frontendFiles, 129, 'VERIFIED_FRONTEND_FILE_COUNT');
  assert.equal(backendFiles, 106, 'VERIFIED_BACKEND_FILE_COUNT');
  return {
    status: 'PASS', mode, release: RELEASE, backendRelease: PREVIOUS,
    targets, buildId: ['candidate', 'activation', 'after'].includes(mode) ? buildId() : undefined,
    frontendFiles, backendFiles, manifestSha256: contract.manifestSha256,
    migrationAllowed: false, databaseRequests: 0, databaseWrites: 0, remoteWrites: 0,
  };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(run(process.argv[2], process.argv[3]), null, 2));
  } catch (error) {
    const message = String(error && error.message ? error.message : 'SOURCE_VERIFICATION_FAILED').split('\n')[0];
    console.error(JSON.stringify({ status: 'FAIL', check: message, databaseWrites: 0, remoteWrites: 0 }));
    process.exitCode = 1;
  }
}

module.exports = { run };

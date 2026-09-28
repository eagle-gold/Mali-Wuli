'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repo = '/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration';
const staging = path.join(__dirname, 'staging');
const expected = {
  'frontend/src/components/profile/AssociationsProfil.tsx': 'ea24ebce655c6d0388c63a7ea0d445ba8c6098e7f6b3c38eea8501deb6c2fb61',
  'frontend/src/components/profile/LiensSociauxProfil.tsx': '133304bca617400bc92cd7b41769b1210323225f6e5c7ce034b3f67832bbe281',
  'frontend/src/components/profile/ProfilMembre.tsx': 'af732be0fc2571f1e65b6ec3fdad19bfd69866f894144134fb8f05289b85de26',
};
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const installed = [];

for (const [relative, before] of Object.entries(expected)) {
  const target = path.join(repo, relative);
  const source = path.join(staging, relative);
  assert.equal(digest(target), before, `active source changed: ${relative}`);
  assert(fs.statSync(source).isFile(), `staging missing: ${relative}`);
  const after = digest(source);
  fs.copyFileSync(source, target);
  assert.equal(digest(target), after, `install failed: ${relative}`);
  installed.push({ path: relative, before, after });
}

fs.writeFileSync(path.join(__dirname, 'installed.json'), JSON.stringify(installed, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', installed: installed.length }));

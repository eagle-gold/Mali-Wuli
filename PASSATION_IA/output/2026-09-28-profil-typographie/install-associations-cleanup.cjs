'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const relative = 'frontend/src/components/profile/AssociationsProfil.tsx';
const target = path.join('/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration', relative);
const source = path.join(__dirname, 'staging', relative);
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(digest(target), '87866b75173c0f48c8f5f0e56df3433e3b4878c2020c0bdc2404d0da7b0d35f0', 'active association source changed');
const after = digest(source);
fs.copyFileSync(source, target);
assert.equal(digest(target), after, 'cleanup install failed');
console.log(JSON.stringify({ status: 'PASS', path: relative, after }));

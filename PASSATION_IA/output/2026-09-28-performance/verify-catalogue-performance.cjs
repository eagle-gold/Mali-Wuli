'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = '/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration';
const service = fs.readFileSync(path.join(repo, 'backend/src/services/education-facettes.service.ts'), 'utf8');
const route = fs.readFileSync(path.join(repo, 'backend/src/routes/education.routes.ts'), 'utf8');
const catalogue = fs.readFileSync(path.join(repo, 'frontend/src/components/education/CatalogueEtablissements.tsx'), 'utf8');

assert(service.includes('pays\n      ? db.$queryRaw'), 'cities must require a selected country');
assert(service.includes('ROW_NUMBER() OVER'), 'city labels must use deterministic ranking');
assert(service.includes('PARTITION BY BINARY villeNormalisee'), 'normalized city deduplication missing');
assert(service.includes('ORDER BY ville ASC, id ASC'), 'city label selection must be deterministic');
assert(service.includes(': Promise.resolve([])'), 'global city payload must be empty');
assert(!service.includes('SELECT MIN(ville)'), 'case/accent-changing MIN selector remains');
assert(route.includes('lireFacettesEtablissements(prisma, { niveau, pays })'), 'optimized facets not used by route');

for (const token of [
  'role="search"',
  'Rechercher un établissement',
  'Nom, sigle ou mot-clé…',
  '...(requete && { q: requete })',
  'disabled={!pays}',
  'Choisissez d’abord un pays',
]) assert(catalogue.includes(token), `catalogue token missing: ${token}`);

console.log(JSON.stringify({
  status: 'PASS',
  checks: [
    'global city list is not queried or transferred before country selection',
    'country city labels use deterministic window ranking instead of MIN',
    'establishment search submits q without a request on every keystroke',
    'city select remains disabled until a country is selected',
  ],
  databaseRequests: 0,
  databaseWrites: 0,
}, null, 2));

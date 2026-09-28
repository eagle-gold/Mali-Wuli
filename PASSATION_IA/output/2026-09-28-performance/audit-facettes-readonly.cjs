'use strict';
// SELECT-only comparison: no writes, no personal records, no complete city list printed.
const assert = require('node:assert/strict');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
require(path.join(process.cwd(), 'node_modules/dotenv')).config();
const { PrismaClient, Prisma } = require(path.join(process.cwd(), 'node_modules/@prisma/client'));
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/u668963025_maliwuli');
const db = new PrismaClient();
db.$use(async (p, next) => {
  assert(['findMany', 'queryRaw'].includes(p.action), 'NON_READ_OPERATION');
  if (p.action === 'queryRaw') {
    const sql = Array.isArray(p.args) ? p.args[0] : p.args;
    assert(/^\s*(?:SELECT|EXPLAIN SELECT)\b/i.test(typeof sql === 'string' ? sql : sql?.sql || sql?.query || ''), 'NON_SELECT');
  }
  return next(p);
});
const result = [];
async function read(label, fn) {
  const start = performance.now(); const rows = await fn();
  result.push({ label, wallMs: Math.round((performance.now() - start) * 10) / 10, rows: rows.length, bytes: Buffer.byteLength(JSON.stringify(rows)) });
  return rows;
}
(async () => {
  for (const pays of [undefined, 'ML', 'FR']) {
    const scope = pays || 'global';
    const existing = await read(scope + '.existing', () => db.etablissement.findMany({ where: { valide: true, ville: { not: null }, ...(pays ? { paysCode: pays } : {}) }, distinct: ['villeNormalisee'], select: { ville: true }, orderBy: { ville: 'asc' } }));
    const country = pays ? Prisma.sql`AND paysCode = ${pays}` : Prisma.empty;
    const proposed = await read(scope + '.binary-group', () => db.$queryRaw(Prisma.sql`SELECT MIN(ville) AS ville FROM Etablissement WHERE valide = true AND ville IS NOT NULL ${country} GROUP BY BINARY villeNormalisee ORDER BY MIN(ville) ASC`));
    const sorted = a => a.map(r => r.ville).sort();
    const old = sorted(existing), next = sorted(proposed);
    const sameMultiset = JSON.stringify(old) === JSON.stringify(next);
    result.push({ label: scope + '.equivalence', sameCount: old.length === next.length, sameMultiset, exactOrder: JSON.stringify(existing) === JSON.stringify(proposed), differentPairs: sameMultiset ? [] : old.map((v, i) => [v, next[i]]).filter(([a, b]) => a !== b).slice(0, 8) });
    const normalise = v => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const normalizeSet = a => a.map(r => normalise(r.ville)).sort();
    const oldCounts = new Map(), newCounts = new Map();
    for (const v of old) oldCounts.set(v, (oldCounts.get(v) || 0) + 1);
    for (const v of next) newCounts.set(v, (newCounts.get(v) || 0) + 1);
    result.push({ label: scope + '.normalized-options', identical: JSON.stringify(normalizeSet(existing)) === JSON.stringify(normalizeSet(proposed)), variantsChanged: [...new Set([...old, ...next])].filter(v => oldCounts.get(v) !== newCounts.get(v)).length, examples: [...oldCounts.keys()].filter(v => oldCounts.get(v) !== newCounts.get(v)).slice(0, 8) });
  }
  const existing = await read('countries.existing', () => db.etablissement.findMany({ where: { valide: true }, distinct: ['paysCode'], select: { paysCode: true, pays: { select: { nom: true } } }, orderBy: { paysCode: 'asc' } }));
  const countries = await read('countries.exists', () => db.paysEducation.findMany({ where: { etablissements: { some: { valide: true } } }, select: { code: true, nom: true }, orderBy: { code: 'asc' } }));
  result.push({ label: 'countries.equivalence', identical: JSON.stringify(existing.map(r => ({ code: r.paysCode, nom: r.pays.nom }))) === JSON.stringify(countries) });
  console.log(JSON.stringify({ status: 'PASS', databaseWrites: 0, result }, null, 2));
})().catch(error => { console.error(error.code || error.name, error.message); process.exitCode = 1; }).finally(() => db.$disconnect());

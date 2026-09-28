'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'staging/frontend/src/components/profile');
const profile = fs.readFileSync(path.join(root, 'ProfilMembre.tsx'), 'utf8');
const social = fs.readFileSync(path.join(root, 'LiensSociauxProfil.tsx'), 'utf8');
const associations = fs.readFileSync(path.join(root, 'AssociationsProfil.tsx'), 'utf8');
const sectionClass = 'font-display text-2xl font-bold leading-tight';
const subsectionClass = 'font-display text-lg font-bold leading-snug';

for (const label of ['Expériences', 'Formations', 'Mon mentorat']) {
  assert(profile.includes(`titre="${label}"`), `missing ${label}`);
}
assert(profile.includes(`<h2 className="${sectionClass}`), 'profile section heading class');
for (const label of ['En ce moment sur le réseau', 'Dans le réseau']) {
  const at = profile.indexOf(label);
  assert(at > 0 && profile.slice(Math.max(0, at - 180), at).includes(sectionClass), `${label} class`);
}
assert(profile.includes(`${subsectionClass} text-[#292119] sm:text-xl">Mes contributions`), 'contributions hierarchy');
assert(profile.includes(`break-words ${subsectionClass}`), 'experience and formation headings');
assert(social.includes(`${sectionClass} text-[#2e261f] sm:text-3xl">Réseaux sociaux`), 'social section class');
assert(associations.includes(`${sectionClass} text-[#292119] sm:text-3xl">Mes associations`), 'associations section class');
assert(!associations.includes('uppercase tracking-[0.06em]'), 'old artificial heading style removed');
assert(!associations.includes('bg-[#f2f7f3] p-4 sm:p-5'), 'nested tinted management panel removed');
assert(associations.includes('!chargementGestion && (erreurGestion || associationsGerees.length > 0)'), 'empty management block hidden, including during load');
assert(associations.includes('Administration</Link>'), 'association admin action retained');
assert(associations.includes('Gérer mes affiliations</Link>'), 'affiliation action retained');

console.log(JSON.stringify({
  status: 'PASS',
  checks: [
    'section titles use Playfair display at 24px mobile / 30px desktop',
    'experience, formation and contribution subheadings use 18px / 20px hierarchy',
    'uppercase tracked association title removed',
    'empty nested association-management panel is hidden while both actions remain available',
  ],
  files: 3,
  databaseWrites: 0,
}, null, 2));

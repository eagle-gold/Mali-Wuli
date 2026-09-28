const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/node_modules/typescript');
const source = path.join(__dirname, 'staging/src/lib/notifications.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const loaded = new Module(source, module);
loaded._compile(compiled.outputText, source);
const { notificationEstVisible, chargerPageNotificationsVisibles, lireNotificationsNonLuesVisibles } = loaded.exports;
const notification = (id, props = {}) => ({ id, type: 'SYSTEME', titre: id, href: '/dashboard', lue: false, createdAt: '2026-09-28T10:00:00Z', ...props });
const page = (notifications, nextCursor = null, nonLues = 99) => ({ notifications, hasMore: Boolean(nextCursor), nextCursor, nonLues });
function lecteur(pages) {
  const calls = [];
  const lire = async (cursor, limite) => { calls.push({ cursor, limite }); assert(Object.hasOwn(pages, cursor || 'first')); return pages[cursor || 'first']; };
  return { calls, lire };
}
test('notifications et payloads socket de cercles sont masqués par type ou destination', () => {
  for (const props of [{ type: 'CERCLE' }, { type: ' cercle ' }, { href: '/cercles' }, { href: '/cercles#id' }, { href: '/cercles?vue=mes-cercles' }, { href: '/cercles/id' }]) {
    assert.equal(notificationEstVisible(notification('hidden', props)), false);
  }
  assert.equal(notificationEstVisible(notification('normal')), true);
  assert.equal(notificationEstVisible(notification('prefix', { href: '/cercles-autre' })), true);
});
test('la pagination saute des pages entièrement masquées, garde le curseur serveur', async () => {
  const { lire, calls } = lecteur({ first: page([notification('a', { type: 'CERCLE' })], 'a'), a: page([notification('b', { href: '/cercles#b' })], 'b'), b: page([notification('c'), notification('d', { type: 'CERCLE' })], 'd') });
  const result = await chargerPageNotificationsVisibles(lire);
  assert.deepEqual(result.notifications.map(n => n.id), ['c']);
  assert.equal(result.nextCursor, 'd'); assert.equal(result.hasMore, true);
  assert.deepEqual(calls.map(c => c.cursor), [null, 'a', 'b']);
});
test('une page mêlée conserve ses notifications utiles et son curseur non filtré', async () => {
  const { lire } = lecteur({ before: page([notification('a'), notification('b', { type: 'CERCLE' })], 'b') });
  const result = await chargerPageNotificationsVisibles(lire, 'before');
  assert.deepEqual(result.notifications.map(n => n.id), ['a']); assert.equal(result.nextCursor, 'b');
});
test('un historique uniquement masqué se termine sans bouton suivant', async () => {
  const { lire } = lecteur({ first: page([notification('a', { type: 'CERCLE' })], 'a'), a: page([notification('b', { type: 'CERCLE' })]) });
  assert.deepEqual(await chargerPageNotificationsVisibles(lire), { notifications: [], hasMore: false, nextCursor: null });
});
test('compteur et IDs excluent les cercles non lus anciens, les lues et doublons', async () => {
  const { lire, calls } = lecteur({ first: page([notification('a'), notification('read', { lue: true })], 'p2', 3), p2: page([notification('hidden', { type: 'CERCLE' }), notification('a')], 'p3', 3), p3: page([notification('b')], 'old-read', 3) });
  const result = await lireNotificationsNonLuesVisibles(lire);
  assert.deepEqual(result.map(n => n.id), ['a', 'b']); assert.equal(result.length, 2);
  assert.deepEqual(calls.map(c => c.cursor), [null, 'p2', 'p3']); assert(calls.every(c => c.limite === 50));
});
test('zéro non lue arrête après la première page sans parcourir historique lu', async () => {
  const { lire, calls } = lecteur({ first: page([notification('read', { lue: true })], 'old', 0) });
  assert.deepEqual(await lireNotificationsNonLuesVisibles(lire), []); assert.equal(calls.length, 1);
});
test('le compteur arrête aussi lorsque toutes les non lues sont masquées', async () => {
  const { lire, calls } = lecteur({ first: page([notification('hidden', { type: 'CERCLE' })], 'old', 1) });
  assert.deepEqual(await lireNotificationsNonLuesVisibles(lire), []); assert.equal(calls.length, 1);
});
test('curseurs cycliques ou absents échouent au lieu de tourner indéfiniment', async () => {
  const cycle = lecteur({ first: page([notification('hidden', { type: 'CERCLE' })], 'again'), again: page([], 'again') });
  await assert.rejects(chargerPageNotificationsVisibles(cycle.lire), /Pagination/);
  const countCycle = lecteur({ first: page([], 'again'), again: page([], 'again') });
  await assert.rejects(lireNotificationsNonLuesVisibles(countCycle.lire), /Pagination/);
  await assert.rejects(chargerPageNotificationsVisibles(async () => ({ notifications: [], hasMore: true, nextCursor: null, nonLues: 0 })), /Pagination/);
});

test('types, destinations et payloads socket des synergies sont masqués', () => {
  for (const props of [{type:'DEMANDE_SYNERGIE'}, {type:'SYNERGIE_ACCEPTEE'}, {type:'SYNERGIE_REFUSEE'}, {type:' synergie_acceptee '}, {href:'/synergies'}, {href:'/synergies?onglet=demandes'}, {href:'/synergies#id'}, {href:'/synergies/id'}]) {
    assert.equal(notificationEstVisible(notification('hidden', props)), false);
  }
  for (const type of ['NOUVELLE_PUBLICATION', 'NOUVEAU_MESSAGE', 'RENDEZ_VOUS', 'EVENEMENT']) assert.equal(notificationEstVisible(notification('visible', {type})), true);
  assert.equal(notificationEstVisible(notification('prefix', {href:'/synergies-autre'})), true);
});
test('une page de synergies et cercles ne masque pas la page suivante utile', async () => {
  const {lire,calls} = lecteur({first:page([notification('s',{type:'DEMANDE_SYNERGIE'}),notification('c',{type:'CERCLE'})], 'p2'),p2:page([notification('msg',{type:'NOUVEAU_MESSAGE',href:'/messages'})])});
  const result=await chargerPageNotificationsVisibles(lire);
  assert.deepEqual(result.notifications.map(n=>n.id),['msg']); assert.equal(result.hasMore,false); assert.equal(calls.length,2);
});
test('compteur et IDs de Tout lire excluent cercles et synergies ensemble', async () => {
  const {lire,calls}=lecteur({first:page([notification('s',{type:'SYNERGIE_ACCEPTEE'}),notification('c',{type:'CERCLE'}),notification('read',{lue:true})],'p2',4),p2:page([notification('s2',{type:'SYNERGIE_REFUSEE'}),notification('msg',{type:'NOUVEAU_MESSAGE',href:'/messages'})],'old',4)});
  const result=await lireNotificationsNonLuesVisibles(lire);
  assert.deepEqual(result.map(n=>n.id),['msg']);assert.equal(calls.length,2);
});

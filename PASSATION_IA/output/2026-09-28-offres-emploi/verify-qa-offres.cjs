// Fixture tests in RAM only: no listening server, network, real mail or database.
const assert = require('node:assert/strict');
const api = require('./qa-fixtures.cjs');
const results = [];
async function request(method, route, body = {}, token) {
  const url = new URL(route, 'http://qa.invalid');
  return api.dispatch(method, url.pathname, url.searchParams, body, { headers: { authorization: token ? `Bearer ${token}` : '' } });
}
async function handle(method, url, token, body) {
  let bodyRead = false;
  const req = { method, url, headers: { origin: 'http://localhost:3006', authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() { bodyRead = true; if (body !== undefined) yield Buffer.from(JSON.stringify(body)); } };
  const response = { headers: {}, status: 0, bytes: null,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    writeHead(status, headers = {}) { this.status = status; for (const [key, value] of Object.entries(headers)) this.setHeader(key, value); },
    end(value) { this.bytes = Buffer.isBuffer(value) ? value : Buffer.from(value || ''); },
  };
  await api.handle(req, response);
  return { ...response, bodyRead };
}
(async () => {
  api.reset();
  const member = (await request('POST', '/api/auth/login', { email: 'membre@example.test', motDePasse: 'qa-test' })).token;
  const admin = (await request('POST', '/api/auth/login', { email: 'admin@example.test', motDePasse: 'qa-test' })).token;
  const list = await request('GET', '/api/offres', {}, member);
  assert.equal(list.offres.length, 6); assert.equal(list.compteurs.actives, 6); assert.equal(list.compteurs.enregistrees, 1);
  assert.deepEqual([...new Set(list.offres.map(o => o.modeCandidature))].sort(), ['EMAIL', 'LIEN_EXTERNE', 'MALI_WULI']);
  assert.equal((await request('GET', '/api/offres?vue=en-attente', {}, admin)).meta.total, 2);
  await assert.rejects(request('GET', '/api/offres?vue=en-attente', {}, member), e => e.status === 403);
  results.push('six published offers, three application modes, two pending proposals and role restriction');

  const cors = await handle('OPTIONS', '/api/offres/qa-offre-communication/enregistrement', member);
  assert.equal(cors.status, 204); assert.match(cors.headers['access-control-allow-methods'], /PUT/);
  const saved = await handle('PUT', '/api/offres/qa-offre-communication/enregistrement', member, {});
  assert.equal(saved.bodyRead, true); assert.equal(saved.status, 200); assert.equal(JSON.parse(saved.bytes).estEnregistree, true);
  await request('PUT', '/api/offres/qa-offre-communication/enregistrement', {}, member);
  assert.equal((await request('GET', '/api/offres?vue=enregistrees', {}, member)).meta.total, 2);
  await request('DELETE', '/api/offres/qa-offre-communication/enregistrement', {}, member);
  results.push('CORS allows PUT, handler reads PUT bodies and favorites remain idempotent');

  const revisions = Object.fromEntries(list.offres.map(o => [o.id, o.revision]));
  const application = await request('POST', '/api/offres/qa-offre-communication/candidatures', { message: 'Message fictif du candidat.', revision: revisions['qa-offre-communication'] }, member);
  assert.equal(application.aPostule, true); assert.ok(application.conversationId);
  const duplicate = await request('POST', '/api/offres/qa-offre-communication/candidatures', { revision: revisions['qa-offre-communication'] }, member);
  assert.equal(duplicate.conversationId, application.conversationId);
  const conversation = await request('GET', `/api/messages/conversations/${application.conversationId}`, {}, member);
  assert.equal(conversation.messages.length, 1); assert.match(conversation.messages[0].contenu, /membres\/qa-membre/);
  results.push('internal application creates a single readable conversation and profile link');

  const email = await request('POST', '/api/offres/qa-offre-commercial/candidatures', { revision: revisions['qa-offre-commercial'] }, member);
  assert.equal(email.statutCandidature, 'ENVOYEE'); assert.equal(email.conversationId, null);
  await assert.rejects(request('POST', '/api/offres/qa-offre-email-echec/candidatures', { revision: revisions['qa-offre-email-echec'] }, member), e => e.status === 502 && e.payload.statutCandidature === 'ECHEC' && e.payload.aPostule === false);
  assert.equal((await request('GET', '/api/offres/qa-offre-email-echec', {}, member)).offre.statutCandidature, 'ECHEC');
  await assert.rejects(request('POST', '/api/offres/qa-offre-email-echec/candidatures', { revision: revisions['qa-offre-email-echec'] }, member), e => e.status === 502);
  const retry = await request('POST', '/api/offres/qa-offre-email-echec/candidatures', { reessayer: true, revision: revisions['qa-offre-email-echec'] }, member);
  assert.equal(retry.statutCandidature, 'ENVOYEE');
  results.push('email success and first-attempt failure are simulated; explicit retry succeeds without SMTP');

  await assert.rejects(request('GET', '/api/offres/qa-offre-commercial/profil-candidature.pdf', {}, member), e => e.status === 400);
  await assert.rejects(request('POST', '/api/offres/qa-offre-commercial/candidatures', { revision: '0'.repeat(64) }, member), e => e.status === 409);
  const pdf = await handle('GET', `/api/offres/qa-offre-commercial/profil-candidature.pdf?revision=${revisions['qa-offre-commercial']}`, member);
  assert.equal(pdf.status, 200); assert.equal(pdf.headers['content-type'], 'application/pdf');
  assert.equal(pdf.bytes.subarray(0, 4).toString(), '%PDF'); assert.match(pdf.headers['content-disposition'], /profil-qa-fictif\.pdf/);
  results.push('PDF preview handler returns the local fictitious PDF as binary, not JSON');

  const source = list.offres[0];
  const created = await request('POST', '/api/offres', { titre: source.titre, entreprise: source.entreprise, secteur: source.secteur, type: source.type, modeTravail: source.modeTravail, modeCandidature: 'MALI_WULI', pays: source.pays, ville: source.ville, description: source.description }, admin);
  assert.equal(created.offre.statutModeration, 'EN_ATTENTE'); assert.equal(created.offre.valide, false);
  await request('PATCH', `/api/offres/${created.offre.id}/validation`, { valide: true, revision: created.offre.revision }, admin);
  const modified = (await request('PATCH', `/api/offres/${created.offre.id}`, { titre: 'Titre modifié fictif' }, admin)).offre;
  assert.equal(modified.statutModeration, 'EN_ATTENTE');
  assert.match(modified.revision, /^[a-f0-9]{64}$/); assert.notEqual(modified.revision, created.offre.revision);
  await assert.rejects(request('PATCH', `/api/offres/${created.offre.id}/validation`, { valide: true }, admin), e => e.status === 400);
  await assert.rejects(request('PATCH', `/api/offres/${created.offre.id}/validation`, { valide: true, revision: created.offre.revision }, admin), e => e.status === 409);
  assert.equal((await request('GET', `/api/offres/${created.offre.id}`, {}, admin)).offre.statutModeration, 'EN_ATTENTE');
  await request('PATCH', `/api/offres/${created.offre.id}/validation`, { valide: false, revision: modified.revision }, admin);
  assert.equal((await request('GET', `/api/offres/${created.offre.id}`, {}, admin)).offre.statutModeration, 'REFUSEE');
  results.push('creation and edition always await moderation, including administrator offers');
  results.push('moderation requires a fresh revision; obsolete decisions return 409 without publishing changed content');
  api.reset();
  console.log(JSON.stringify({ status: 'passed', checks: results, serverStarted: false, networkCalls: 0, databaseWrites: 0, realEmails: 0 }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });

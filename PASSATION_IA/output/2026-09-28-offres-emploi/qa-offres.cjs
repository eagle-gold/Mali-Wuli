"use strict";
// API de démonstration en RAM uniquement. Aucun accès DB, SMTP ou réseau.
// qa-offre-email-echec : premier envoi EMAIL échoue ; réessayer=true réussit.
// Le seul fichier lu est le PDF fictif de ce dossier, jamais un document utilisateur.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const unique = values => [...new Set(values.filter(Boolean))].sort();
const revisionOffre = offre => createHash('sha256').update(JSON.stringify([
  'titre', 'entreprise', 'secteur', 'type', 'modeTravail', 'modeCandidature', 'pays', 'ville',
  'description', 'profilRecherche', 'salaire', 'emailContact', 'lienCandidature',
  'dateExpiration', 'recommandationPossible', 'valide', 'statutModeration',
].map(key => [key, offre[key] ?? null]))).digest('hex');

function initialOffers() {
  return [
    ['communication', 'Chargé·e de communication', 'ONG Jigui — QA', 'Communication & médias', 'CDI', 'HYBRIDE', 'MALI_WULI', 'Mali', 'Bamako', 'qa-manager'],
    ['commercial', 'Commercial·e terrain', 'Talents Commerce — QA', 'Commerce & vente', 'CDI', 'SUR_SITE', 'EMAIL', 'Mali', 'Sikasso', 'qa-samba'],
    ['data', 'Data analyst', 'Nyeta Numérique — QA', 'Tech & digital', 'CDD', 'HYBRIDE', 'LIEN_EXTERNE', 'France', 'Paris', 'qa-admin'],
    ['email-echec', 'Comptable confirmé·e', 'Horizon Gestion — QA', 'Finance & banque', 'CDI', 'SUR_SITE', 'EMAIL', 'Mali', 'Bamako', 'qa-manager'],
    ['designer', 'Designer de services', 'Atelier Ensemble — QA', 'Tech & digital', 'FREELANCE', 'TELETRAVAIL', 'MALI_WULI', 'Canada', 'Montréal', 'qa-admin'],
    ['stage', 'Stage en gestion de projets', 'Initiatives Dakar — QA', 'ONG & associations', 'STAGE', 'SUR_SITE', 'LIEN_EXTERNE', 'Sénégal', 'Dakar', 'qa-oumar'],
    ['pending-communication', 'Chargé·e de communication associative', 'Ensemble Jeunesse — QA', 'Communication & médias', 'CDD', 'HYBRIDE', 'EMAIL', 'Mali', 'Bamako', 'qa-membre'],
    ['pending-commercial', 'Commercial·e terrain — équipe régionale', 'Coopération Commerce — QA', 'Commerce & vente', 'CDI', 'SUR_SITE', 'MALI_WULI', 'Mali', 'Sikasso', 'qa-manager'],
  ].map(([id, titre, entreprise, secteur, type, modeTravail, modeCandidature, pays, ville, publieurId], index) => ({
    id: `qa-offre-${id}`, titre, entreprise, secteur, type, modeTravail, modeCandidature, pays, ville, publieurId,
    teletravail: modeTravail !== 'SUR_SITE', salaire: index % 2 ? '350 000 à 500 000 FCFA par mois' : 'Selon expérience',
    description: `Rejoignez une équipe engagée pour développer des projets utiles.\n\nVos missions :\n• Préparer et suivre les actions de l’équipe.\n• Échanger avec nos partenaires et les membres du réseau.\n• Partager les résultats et proposer des améliorations.\n\nCette offre et cette organisation sont fictives, réservées à la vérification locale.`,
    profilRecherche: 'Une première expérience du domaine, de bonnes capacités de rédaction et le goût du travail en équipe. Français professionnel ; le bambara est apprécié.',
    emailContact: modeCandidature === 'EMAIL' ? 'recrutement@example.invalid' : null,
    lienCandidature: modeCandidature === 'LIEN_EXTERNE' ? 'https://example.invalid/recrutement' : null,
    dateExpiration: '2099-12-31T23:59:59.999Z', recommandationPossible: index % 2 === 0,
    valide: index < 6, statutModeration: index < 6 ? 'PUBLIEE' : 'EN_ATTENTE',
    createdAt: `2026-09-${String(28 - index).padStart(2, '0')}T09:00:00.000Z`,
  }));
}

function dispatchOffers(method, route, params, body, req, context) {
  const { state, p, fail, person, publicPerson, paginate } = context;
  const mod = p.role === 'ADMIN' || p.role === 'MODERATEUR';
  const published = o => o.valide && o.statutModeration === 'PUBLIEE';
  const expired = o => !!o.dateExpiration && Date.parse(o.dateExpiration) <= Date.now();
  const application = o => state.applications.find(a => a.offreId === o.id && a.profilId === p.id);
  const saved = o => state.offerSaved.some(s => s.offreId === o.id && s.profilId === p.id);
  const view = o => {
    const a = application(o), publisher = person(o.publieurId);
    return { ...o, revision: revisionOffre(o), publieur: publisher ? { ...publicPerson(publisher), nomComplet: `${publisher.prenom} ${publisher.nom}` } : null,
      peutModifier: mod || o.publieurId === p.id, peutModerer: mod, estProprietaire: o.publieurId === p.id,
      estExpiree: expired(o), estEnregistree: saved(o), aPostule: a?.statut === 'ENVOYEE', statutCandidature: a?.statut || null, conversationId: a?.conversationId || null };
  };
  const validate = (values, previous) => {
    for (const [key, min, max] of [['titre',3,150],['entreprise',2,150],['secteur',2,100],['pays',2,100],['description',20,10000]]) {
      const length = String(values[key] || '').trim().length;
      if (length < min || length > max) fail(400, `Champ ${key} incomplet ou trop long.`);
    }
    for (const [key, max] of [['ville',100],['salaire',190],['profilRecherche',10000],['emailContact',190],['lienCandidature',2048]]) if (String(values[key] || '').length > max) fail(400, `Champ ${key} trop long.`);
    if (!['CDI','CDD','STAGE','ALTERNANCE','FREELANCE'].includes(values.type)) fail(400, 'Contrat invalide.');
    if (!['SUR_SITE','HYBRIDE','TELETRAVAIL'].includes(values.modeTravail)) fail(400, 'Mode de travail invalide.');
    if (!['MALI_WULI','EMAIL','LIEN_EXTERNE'].includes(values.modeCandidature)) fail(400, 'Mode de candidature invalide.');
    if (values.modeCandidature === 'LIEN_EXTERNE') {
      let url; try { url = new URL(values.lienCandidature); } catch { fail(400, 'Lien de candidature invalide.'); }
      if (!['http:','https:'].includes(url.protocol)) fail(400, 'Lien de candidature invalide.');
    }
    if (values.modeCandidature === 'EMAIL' && values.emailContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.emailContact)) fail(400, 'E-mail de contact invalide.');
    if (values.dateExpiration && values.dateExpiration !== previous?.dateExpiration && (!Number.isFinite(Date.parse(values.dateExpiration)) || Date.parse(values.dateExpiration) <= Date.now())) fail(400, 'La date limite doit être à venir.');
  };
  const payload = a => ({ modeCandidature: a.modeCandidature, statutCandidature: a.statut, aPostule: a.statut === 'ENVOYEE', conversationId: a.conversationId || null,
    message: a.statut === 'ENVOYEE' ? 'Votre candidature a été transmise (simulation locale).' : a.statut === 'ECHEC' ? 'Échec simulé de l’envoi. Aucun e-mail réel n’a été envoyé. Vous pouvez réessayer.' : 'Transmission simulée en cours.' });
  const response = a => {
    const result = payload(a);
    if (a.statut === 'ECHEC') { const error = new Error(result.message); error.status = 502; error.payload = result; throw error; }
    return result;
  };

  if (route === '/api/offres' && method === 'GET') {
    const vue = params.get('vue') || 'actives';
    if (['en-attente','toutes'].includes(vue) && !mod) fail(403, 'Vue réservée à la modération.');
    const scoped = state.offers.filter(o => vue === 'mes-offres' ? o.publieurId === p.id : vue === 'en-attente' ? o.statutModeration === 'EN_ATTENTE' : vue === 'toutes' ? true : published(o));
    const base = scoped.filter(o => vue !== 'actives' || !expired(o));
    const values = base.filter(o => (vue !== 'enregistrees' || saved(o))
      && ['pays','ville','type','secteur','modeTravail'].every(k => !params.get(k) || o[k] === params.get(k))
      && (!params.get('q') || norm([o.titre,o.entreprise,o.description,o.secteur].join(' ')).includes(norm(params.get('q')))))
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const page = paginate(values, params);
    return { offres: page.values.map(view), meta: { page: page.page, limite: page.limite, total: page.total, totalPages: page.totalPages }, peutModerer: mod,
      compteurs: { actives: state.offers.filter(o => published(o) && !expired(o)).length, enregistrees: state.offers.filter(o => published(o) && saved(o)).length, mesOffres: state.offers.filter(o => o.publieurId === p.id).length, enAttente: mod ? state.offers.filter(o => o.statutModeration === 'EN_ATTENTE').length : 0 },
      facettes: { pays: unique(base.map(o => o.pays)), villes: unique(base.filter(o => !params.get('pays') || o.pays === params.get('pays')).map(o => o.ville)), secteurs: unique(base.map(o => o.secteur)), types: unique(base.map(o => o.type)), modesTravail: unique(base.map(o => o.modeTravail)) } };
  }
  if (route === '/api/offres' && method === 'POST') {
    const value = { ...body, modeTravail: body.modeTravail || 'SUR_SITE', modeCandidature: body.modeCandidature || 'MALI_WULI' };
    validate(value);
    const o = { ...value, id: `qa-offre-created-${++state.sequence}`, publieurId: p.id, valide: false, statutModeration: 'EN_ATTENTE', createdAt: new Date().toISOString(), teletravail: value.modeTravail !== 'SUR_SITE', emailContact: value.emailContact || null, lienCandidature: value.lienCandidature || null, dateExpiration: value.dateExpiration || null, salaire: value.salaire || null, profilRecherche: value.profilRecherche || null, recommandationPossible: !!value.recommandationPossible };
    state.offers.push(o); return { offre: view(o), message: 'Offre fictive envoyée pour validation.' };
  }
  const match = /^\/api\/offres\/([^/]+)(?:\/(validation|enregistrement|candidatures|profil-candidature\.pdf))?$/.exec(route);
  if (!match) fail(404, 'Route offres de fixture inconnue.');
  const id = decodeURIComponent(match[1]), action = match[2];
  const o = state.offers.find(o => o.id === id);
  if (!o || (!published(o) && !mod && o.publieurId !== p.id)) fail(404, 'Offre introuvable.');
  if (!action && method === 'GET') return { offre: view(o) };
  if (!action && ['PATCH','DELETE'].includes(method)) {
    if (!mod && o.publieurId !== p.id) fail(403, 'Modification non autorisée.');
    if (method === 'DELETE') { state.offers = state.offers.filter(x => x.id !== id); state.offerSaved = state.offerSaved.filter(x => x.offreId !== id); state.applications = state.applications.filter(x => x.offreId !== id); return { message: 'Offre fictive supprimée.' }; }
    const value = { ...o, ...body }; validate(value, o);
    Object.assign(o, body, { valide: false, statutModeration: 'EN_ATTENTE', teletravail: value.modeTravail !== 'SUR_SITE' });
    return { offre: view(o), message: 'Offre fictive renvoyée pour validation.' };
  }
  if (action === 'validation' && method === 'PATCH') {
    if (!mod) fail(403, 'Modération requise.');
    if (typeof body.valide !== 'boolean') fail(400, 'Décision invalide.');
    if (typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) fail(400, 'Révision de l’offre requise.');
    if (body.revision !== revisionOffre(o)) fail(409, 'L’offre a changé depuis son affichage. Relisez la version actualisée avant de décider.');
    o.valide = body.valide; o.statutModeration = body.valide ? 'PUBLIEE' : 'REFUSEE';
    return { offre: view(o), message: 'Décision fictive enregistrée.' };
  }
  if (action === 'enregistrement' && ['PUT','DELETE'].includes(method)) {
    state.offerSaved = state.offerSaved.filter(s => s.offreId !== id || s.profilId !== p.id);
    if (method === 'PUT') state.offerSaved.push({ offreId: id, profilId: p.id });
    return { estEnregistree: method === 'PUT' };
  }
  if (action === 'candidatures' || action === 'profil-candidature.pdf') {
    if (!published(o)) fail(404, 'Offre publiée introuvable.');
    if (expired(o)) fail(409, 'Cette offre a expiré.');
    if (o.publieurId === p.id) fail(403, 'Vous ne pouvez pas candidater à votre propre offre.');
    const revision = action === 'profil-candidature.pdf' ? params.get('revision') : body.revision;
    if (typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision)) fail(400, 'Révision de l’offre requise.');
    if (revision !== revisionOffre(o)) fail(409, 'L’offre a changé. Relisez les modalités de candidature actualisées.');
    if (action === 'profil-candidature.pdf' && method === 'GET') return { __qaBuffer: fs.readFileSync(path.join(__dirname, 'profil-candidature-exemple.pdf')), contentType: 'application/pdf', contentDisposition: 'inline; filename="profil-qa-fictif.pdf"' };
    if (action !== 'candidatures' || method !== 'POST') fail(405, 'Méthode non prévue par la fixture.');
    if (String(body.message || '').length > 2000) fail(400, 'Le message ne doit pas dépasser 2 000 caractères.');
    if (o.modeCandidature === 'LIEN_EXTERNE') return { modeCandidature: o.modeCandidature, statutCandidature: null, aPostule: false, conversationId: null, lienExterne: o.lienCandidature, message: 'Lien externe fictif. Aucun envoi.' };
    let a = application(o);
    if (a && (a.statut !== 'ECHEC' || !body.reessayer)) return response(a);
    if (!a) { a = { id: `qa-candidature-${++state.sequence}`, offreId: id, profilId: p.id, modeCandidature: o.modeCandidature, statut: 'EN_COURS', conversationId: null, tentatives: 0 }; state.applications.push(a); }
    a.tentatives++; a.message = String(body.message || '').trim(); a.statut = 'EN_COURS';
    if (o.id === 'qa-offre-email-echec' && a.tentatives === 1) { a.statut = 'ECHEC'; return response(a); }
    if (o.modeCandidature === 'MALI_WULI') {
      let conversation = state.conversations.find(c => c.participants.includes(p.id) && c.participants.includes(o.publieurId));
      if (!conversation) { conversation = { id: `qa-conversation-${++state.sequence}`, participants: [p.id, o.publieurId] }; state.conversations.push(conversation); }
      a.conversationId = conversation.id;
      state.messages.push({ id: `qa-message-${++state.sequence}`, conversationId: conversation.id, auteurId: p.id, contenu: `Candidature à « ${o.titre} » — ${o.entreprise}\n\n${p.prenom} ${p.nom} · ${p.titre}\n${[p.ville,p.pays].filter(Boolean).join(', ')}\n\n${a.message}\n\nConsulter mon profil : https://mali-wuli.com/membres/${encodeURIComponent(p.id)}`, createdAt: new Date().toISOString(), lu: false, auteur: { id: p.id, initiales: p.prenom[0] + p.nom[0], photo: p.photo } });
    }
    a.statut = 'ENVOYEE'; return response(a);
  }
  fail(404, 'Action offres non implémentée dans la fixture.');
}
module.exports = { initialOffers, dispatchOffers };

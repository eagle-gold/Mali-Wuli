'use strict';
// Extension de QA locale, GET uniquement, données fictives dérivées de l'état RAM.
// Aucun serveur démarré, aucun accès fichier, réseau, compte réel ou base.
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const pageOf = (values, params, defaultLimit = 12) => {
  const page = Math.max(1, Number(params.get('page')) || 1), limite = Math.min(100, Math.max(1, Number(params.get('limite')) || defaultLimit));
  return { values: values.slice((page - 1) * limite, page * limite), meta: { page, limite, total: values.length, totalPages: Math.max(1, Math.ceil(values.length / limite)) } };
};
const name = p => `${p.prenom || ''} ${p.nom || ''}`.trim();
const brief = p => ({ id: p.id, prenom: p.prenom, nom: p.nom, nomComplet: name(p), photo: p.photo, titre: p.titre, ville: p.ville, pays: p.pays });
function dispatchAnnexes(method, route, params, _body, _req, context) {
  if (method !== 'GET') return undefined;
  const { state, p, fail } = context;
  const people = state.people.filter(person => person.statut === 'VALIDE');
  const countries = { ML: 'Mali', FR: 'France', SN: 'Sénégal' };
  const schools = Array.from({ length: 15 }, (_, index) => {
    const s = state.schools[index % state.schools.length];
    return { ...s, id: index < 3 ? s.id : `${s.id}-qa-${index}`, nom: index < 3 ? s.nom : `${s.nom} — antenne de démonstration ${index + 1}`,
      sigle: s.type === 'LYCEE' ? 'LH' : 'UT', niveau: s.type === 'LYCEE' ? 'Lycée' : 'Université', pays: countries[s.paysCode] || s.paysCode,
      statut: 'public', ton: ['vert', 'sable', 'orange'][index % 3], resume: 'Établissement entièrement fictif pour le contrôle de la page sur mobile.',
      note: index % 3 ? 4.2 : null, nombreAvis: index % 3 ? 5 : 0, membres: index === 14 ? 26 : index < 3 ? 9 - index * 3 : 0, promotions: 3, insertion: s.type === 'LYCEE' ? null : 82, repondantsInsertion: 10,
    };
  });
  if (route === '/api/education/etablissements') {
    const scope = schools.filter(s => (!params.get('niveau') || s.type === params.get('niveau')) && (!params.get('pays') || s.paysCode === params.get('pays')));
    const result = pageOf(scope.filter(s => !params.get('ville') || s.ville === params.get('ville')).sort((a,b) => b.membres - a.membres || a.nom.localeCompare(b.nom, 'fr') || a.id.localeCompare(b.id)), params);
    return { etablissements: result.values, pagination: result.meta, filtres: { pays: Object.entries(countries).map(([code, nom]) => ({ code, nom })), villes: [...new Set(scope.map(s => s.ville))] } };
  }
  const schoolId = /^\/api\/education\/etablissements\/([^/]+)$/.exec(route)?.[1];
  if (schoolId) {
    const s = schools.find(s => s.id === decodeURIComponent(schoolId)); if (!s) fail(404, 'Établissement QA introuvable.');
    return { etablissement: { ...s, description: 'Fiche fictive : parcours, membres et avis servent uniquement à vérifier les retours à la ligne, les colonnes et les boutons de cette interface.', siteWeb: null,
      parcours: ['Économie et gestion', 'Sciences et technologies'], diaspora: 5, volontaires: 2,
      membresApercu: people.slice(0, 4).map((person, index) => ({ id: person.id, initiales: (person.prenom[0] + person.nom[0]), nom: name(person), fonction: person.titre, ville: person.ville, photo: null, promotion: 2018 + index, ton: 'vert' })),
      avisApercu: [{ id: 'qa-avis-mobile', initiales: 'AD', nom: 'Awa Diarra', photo: null, promotion: 2024, createdAt: '2026-09-20T09:00:00.000Z', note: 4.5, commentaire: 'Avis fictif suffisamment long pour vérifier sa lisibilité sur un petit écran. Les cours étaient complémentaires et les échanges enrichissants.', ton: 'orange' }],
      employeurs: [{ nom: 'Initiatives Ensemble — organisme fictif', secteur: 'Services', ville: 'Bamako', membres: 3 }], villesAnciens: [{ ville: 'Bamako', membres: 5 }, { ville: 'Paris', membres: 3 }],
    }, moi: { affilie: false, formationId: null, avisId: null, peutDonnerAvis: false } };
  }
  const volunteers = people.filter(person => person.volontaire && person.id !== p.id).map((person, index) => ({ ...person.volontaire, profilId: person.id, profil: brief(person), format: ['Visio', 'Téléphone', 'Sur place'][index % 3], dateDebut: null, dateFin: null }));
  if (route === '/api/volontaires') {
    const values = volunteers.filter(v => (!params.get('q') || norm(`${name(v.profil)} ${v.specialite} ${v.profil.ville}`).includes(norm(params.get('q')))) && (!params.get('sujet') || v.sujets.includes(params.get('sujet'))) && (!params.get('format') || v.format === params.get('format')) && (!params.get('pays') || v.profil.pays === params.get('pays')));
    const result = pageOf(values, params, 18); return { volontaires: result.values, meta: result.meta };
  }
  if (route === '/api/volontaires/agenda/me') {
    const past = params.get('periode') === 'passes';
    const values = volunteers.slice(0, 3).map((v, index) => {
      const role = index % 2 ? 'MENTOR' : 'DEMANDEUR';
      const debut = new Date(Date.now() + (past ? -1 : 1) * (index + 2) * 86400000);
      return { id: `qa-rdv-${index}`, debut: debut.toISOString(), fin: new Date(debut.getTime() + 1800000).toISOString(), motif: ['Préparer une évolution professionnelle et valoriser ses compétences', 'Partager un retour d’expérience associatif', 'Découvrir les métiers de la donnée'][index],
        statut: index === 1 ? 'EN_ATTENTE' : 'ACCEPTE', lienAppel: null, role, peutAnnuler: false, peutRepondre: false,
        volontaire: { id: v.id, specialite: v.specialite, format: v.format, profil: role === 'MENTOR' ? brief(p) : v.profil }, demandeur: role === 'MENTOR' ? v.profil : brief(p),
      };
    }).filter(v => !params.get('role') || params.get('role') === 'tous' || v.role === (params.get('role') === 'volontaire' ? 'MENTOR' : 'DEMANDEUR'));
    const result = pageOf(values, params, 50); return { rendezVous: result.values, meta: result.meta };
  }
  const volunteerId = /^\/api\/volontaires\/([^/]+)\/creneaux$/.exec(route)?.[1];
  if (volunteerId) {
    const v = volunteers.find(v => v.id === volunteerId); if (!v) fail(404, 'Volontaire QA introuvable.');
    return { creneaux: [2, 3, 4].map(offset => { const d = new Date(Date.now() + offset * 86400000); d.setUTCHours(10, 0, 0, 0); return { debut: d.toISOString(), fin: new Date(d.getTime() + 1800000).toISOString() }; }), fuseau: v.fuseau, dureeCreneau: v.dureeCreneau };
  }
  return undefined;
}
module.exports = { dispatchAnnexes };

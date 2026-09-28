#!/usr/bin/env node
"use strict";
/**
 * API FICTIVE pour QA visuelle locale uniquement. Aucun Prisma, DB, .env, e-mail,
 * connexion sortante ou fichier utilisateur. Tout l'état (images incluses) est en RAM.
 * Démarrage volontaire : node qa-fixtures.cjs ; aucun listen lorsque require() est utilisé.
 * Ces simulations ne remplacent PAS les tests des vrais handlers du backend.
 */
const http = require("node:http");
const {initialEvents,dispatchEvents}=require("../2026-09-28-evenements-photos/qa-events.cjs");
const crypto = require("node:crypto");
const HOST = "127.0.0.1";
const PORT = 4307;
const ORIGINS = new Set(["http://localhost:3006", "http://127.0.0.1:3006"]);
const PASSWORD = "qa-test"; // Donnée publique de fixture, inutilisable ailleurs.
const FIXED_DATE = "2026-09-28T10:00:00.000Z";
const clone = (v) => JSON.parse(JSON.stringify(v));
const norm = (v = "") => String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const unique = (v) => [...new Set(v.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "fr"));
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new ApiError(status, message); };
let state;

function initialState() {
  const schools = [
    { id: "qa-school-bamako", nom: "Lycée Horizon de Bamako", paysCode: "ML", ville: "Bamako", type: "LYCEE" },
    { id: "qa-univ-paris", nom: "Université des Talents — Paris", paysCode: "FR", ville: "Paris", type: "UNIVERSITE" },
    { id: "qa-univ-dakar", nom: "Institut des Initiatives — Dakar", paysCode: "SN", ville: "Dakar", type: "UNIVERSITE" },
  ];
  const descriptions = [
    ["admin", "admin", "Amadou", "Tounkara", "Mali", "Bamako", "Coordinateur associatif", "ADMIN", "PROFESSIONNEL", 2018, ["Créer une association", "Mentorat"]],
    ["membre", "membre", "Awa", "Diarra", "France", "Paris", "Cheffe de projet numérique", "MEMBRE", "PROFESSIONNEL", 2019, ["Un emploi", "Numérique"]],
    ["manager", "manager", "Mariam", "Traoré", "Mali", "Bamako", "Responsable d'association", "RESPONSABLE_ASSO", "PROFESSIONNEL", 2016, ["Vie associative", "Mentorat"]],
    ["samba", "samba", "Samba", "Keita", "Mali", "Bamako", "Entrepreneur dans l'agroalimentaire", "MEMBRE", "ENTREPRENEUR", 2018, ["Entrepreneuriat"]],
    ["fatou", "fatou", "Fatou", "Coulibaly", "France", "Lille", "Étudiante en économie", "MEMBRE", "ETUDIANT", 2027, []],
    ["oumar", "oumar", "Oumar", "Diallo", "Sénégal", "Dakar", "Ingénieur en énergie", "MEMBRE", "PROFESSIONNEL", 2020, ["Orientation", "Un stage"]],
    ["aminata", "aminata", "Aminata", "Koné", "Canada", "Montréal", "Designer de services", "MEMBRE", "PROFESSIONNEL", 2021, ["Un emploi", "Design"]],
    ["cheick", "cheick", "Cheick", "Sanogo", "France", "Paris", "En recherche d'une première expérience", "MEMBRE", "EN_RECHERCHE", 2024, []],
    ["inscription", "inscription", "Nadia", "Test", "Mali", "Sikasso", "Inscription de démonstration", "MEMBRE", "ETUDIANT", 2026, []],
  ];
  const people = descriptions.map(([id, email, prenom, nom, pays, ville, titre, role, situation, promo, aides], index) => {
    const school = schools[index % schools.length];
    const formation = {
      id: `qa-formation-${id}`, type: school.type === "LYCEE" ? "ecole" : "universite", etablissementId: school.id,
      etablissement: { ...school, sigle: null, pays: { nom: school.paysCode === "ML" ? "Mali" : school.paysCode === "FR" ? "France" : "Sénégal" } },
      anneeDebut: promo - 3, moisDebut: 9, anneeFin: promo, moisFin: 6, anneePromo: promo,
      autreEtablissement: null, diplome: school.type === "LYCEE" ? "Baccalauréat" : "Licence", filiere: "Économie et gestion",
      statutDiplome: promo > 2026 ? "EN_COURS" : "OBTENU", enCours: promo > 2026, systemeEducatifCode: "FR",
      diplomesScolaires: school.type === "LYCEE" ? [{ type: "BAC", libelle: "Baccalauréat", anneeObtention: String(promo), mention: "Bien", serie: "ES", statut: "OBTENU" }] : null,
      avis: { anneePromo: promo, noteEnseignement: 4, noteContenu: 4, noteInfrastructures: 4, commentaire: "Parcours fictif pour le contrôle de l'interface." },
    };
    return {
      id: `qa-${id}`, userId: `qa-user-${id}`, email: `${email}@example.test`, prenom, nom, role,
      statut: id === "inscription" ? "EN_ATTENTE" : "VALIDE", onboardingFini: id !== "inscription", onboardingEtape: id === "inscription" ? 4 : 5,
      createdAt: "2025-04-15T12:00:00.000Z", pays, ville, titre, situation, telephone: null,
      bio: `Profil entièrement fictif de ${prenom} ${nom}, créé uniquement pour la QA locale. Je partage mon expérience dans le réseau.`,
      photo: null, photoCouverture: null, linkedin: null, emailVisible: false, telephoneVisible: false,
      estVolontaire: aides.length > 0, aides, formations: [formation],
      experiences: situation === "ETUDIANT" ? [] : [{ id: `qa-exp-${id}`, poste: titre, entreprise: "Initiatives Ensemble (QA)", ville, pays, secteur: "Services", dateDebut: "2023-01-01T00:00:00.000Z", dateFin: null, estActuel: true, description: "Expérience fictive pour la démonstration." }],
      volontaire: aides.length ? { id: `qa-vol-${id}`, specialite: titre, sujets: aides, precisionsSujets: {}, disponible: true, fuseau: "Africa/Bamako", format: "VIDEO", dureeCreneau: 30, disponibilites: [], maxRdvMois: 4, delaiMinResa: 24 } : null,
    };
  });
  // Ordre de stockage volontairement mélangé : la vue doit calculer son tri.
  // Deux profils permettent de tester le profil propriétaire et la fiche publique.
  for (const p of people.filter((v) => ["qa-membre", "qa-manager"].includes(v.id))) {
    const currentTitle = p.id === "qa-membre" ? "Cheffe de projet numérique" : "Responsable d'association";
    const experience = (suffix, poste, debut, fin) => ({
      id: `${p.id}-exp-${suffix}`, poste, entreprise: "Initiatives Ensemble (QA)", ville: p.ville, pays: p.pays,
      secteur: "Services", typeContrat: fin ? "CDD" : "CDI", dateDebut: debut, dateFin: fin,
      estActuel: fin === null, description: "Expérience fictive pour vérifier le tri récent → ancien.",
    });
    p.experiences = [
      experience("ancienne", "Analyste", "2020-02-01T00:00:00.000Z", "2022-12-01T00:00:00.000Z"),
      experience("actuelle", currentTitle, "2024-07-01T00:00:00.000Z", null),
      experience("intermediaire", "Chargée de mission", "2023-01-01T00:00:00.000Z", "2024-06-01T00:00:00.000Z"),
    ];
    const formation = (suffix, school, diplome, debut, fin, filiere) => ({
      id: `${p.id}-formation-${suffix}`, type: school.type === "LYCEE" ? "ecole" : "universite", etablissementId: school.id,
      etablissement: { ...school, sigle: null, pays: { nom: school.paysCode === "ML" ? "Mali" : "France" } },
      anneeDebut: debut, moisDebut: 9, anneeFin: fin, moisFin: 6, anneePromo: fin,
      autreEtablissement: null, diplome, filiere, mention: "Bien", statutDiplome: "OBTENU", enCours: false,
      systemeEducatifCode: "FR", diplomesScolaires: school.type === "LYCEE" ? [
        { type: "BREVET", libelle: "Diplôme national du brevet", anneeObtention: "2016", mention: "Bien", serie: "", statut: "OBTENU" },
        { type: "BAC", libelle: "Baccalauréat", anneeObtention: String(fin), mention: "Bien", serie: "ES", statut: "OBTENU" },
      ] : null,
      avis: { anneePromo: fin, noteEnseignement: 4, noteContenu: 4, noteInfrastructures: 4,
        commentaire: "Formation fictive pour vérifier le tri récent → ancien." },
    });
    p.formations = [
      formation("lycee", schools[0], "Baccalauréat", 2014, 2019, "Sciences économiques et sociales"),
      formation("master", schools[1], "Master", 2022, 2024, "Gestion de projets"),
      formation("licence", schools[1], "Licence", 2019, 2022, "Économie et gestion"),
    ];
  }
  const associations = [
    { id: "qa-asso-bamako", nom: "Les Jeunes Bâtisseurs", pays: "Mali", ville: "Bamako", vocation: "Éducation et jeunesse", responsableId: "qa-manager", dateCreation: "2014-03-10T00:00:00.000Z", description: "Association fictive qui accompagne les jeunes dans leur orientation et leurs projets collectifs. Ateliers, rencontres et actions citoyennes à Bamako.", site: "https://example.test/jeunes", emailContact: "bonjour@example.test" },
    { id: "qa-asso-paris", nom: "Talents Mali Diaspora", pays: "France", ville: "Paris", vocation: "Entraide et insertion", responsableId: "qa-admin", dateCreation: "2018-09-01T00:00:00.000Z", description: "Réseau associatif fictif d'entraide entre étudiants et professionnels. Nous organisons des rencontres et des ateliers autour de l'emploi et de la vie en France.", site: null, emailContact: "talents@example.test" },
    { id: "qa-asso-dakar", nom: "Santé et Solidarité", pays: "Sénégal", ville: "Dakar", vocation: "Santé et solidarité", responsableId: "qa-manager", dateCreation: "2020-02-20T00:00:00.000Z", description: "Association fictive de sensibilisation à la santé et de solidarité de proximité. Les données de cette fiche servent uniquement au contrôle visuel.", site: null, emailContact: null },
  ].map((a) => ({ ...a, photo: null, photoCouverture: null, valide: true, createdAt: "2025-05-01T00:00:00.000Z" }));
  const affiliations = [
    ["qa-asso-bamako", "qa-manager", "VERIFIE"], ["qa-asso-bamako", "qa-samba", "VERIFIE"],
    ["qa-asso-paris", "qa-aminata", "VERIFIE"], ["qa-asso-paris", "qa-cheick", "VERIFIE"],
    ["qa-asso-paris", "qa-fatou", "EN_ATTENTE"], ["qa-asso-dakar", "qa-oumar", "VERIFIE"],
    ["qa-asso-dakar", "qa-membre", "REFUSE"],
  ].map(([associationId, profilId, statut]) => ({ associationId, profilId, statut, rejointLe: statut === "VERIFIE" ? FIXED_DATE : null }));
  return { events:initialEvents(), people, schools, associations, affiliations, suggestions: [], sessions: new Map(), uploads: new Map(), conversations: [], messages: [], synergies: [], snapshots: {}, sequence: 0 };
}
function reset() { state = initialState(); return { message: "Fixtures fictives réinitialisées en mémoire.", personnesVisibles: 8, associations: 3, qa: true }; }
reset();
function publicPerson(p) { return { id: p.id, userId: p.userId, prenom: p.prenom, nom: p.nom, photo: p.photo, titre: p.titre, ville: p.ville, pays: p.pays }; }
function visible(p) { return p && p.statut === "VALIDE" && p.onboardingFini; }
function person(id) { return state.people.find((p) => p.id === id || p.userId === id); }
function isAdmin(p) { return p.role === "ADMIN"; }
function requireAdmin(p) { if (!isAdmin(p)) fail(403, "Cette action est réservée à l’administration."); }
function affiliation(a, p) { return state.affiliations.find((m) => m.associationId === a.id && m.profilId === p.id); }
function publicAssociation(a, p) {
  const responsable = person(a.responsableId);
  const mine = affiliation(a, p);
  return { ...a, responsableId: undefined, responsable: visible(responsable) ? publicPerson(responsable) : null,
    nbMembres: state.affiliations.filter((m) => m.associationId === a.id && m.statut === "VERIFIE" && visible(person(m.profilId))).length,
    monAffiliation: mine ? { statut: mine.statut, rejointLe: mine.rejointLe } : null, peutGerer: isAdmin(p) || a.responsableId === p.id };
}
function findAssociation(id, p, manage = false) {
  const a = state.associations.find((v) => v.id === id);
  if (!a || (!a.valide && !isAdmin(p))) fail(404, "Association introuvable.");
  if (manage && !isAdmin(p) && a.responsableId !== p.id) fail(403, "Vous ne pouvez pas gérer cette association.");
  return a;
}
function paginate(values, params) {
  const page = Number(params.get("page") || 1), limite = Number(params.get("limite") || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limite) || limite < 1 || limite > 50) fail(400, "Pagination invalide.");
  return { values: values.slice((page - 1) * limite, page * limite), total: values.length, page, limite, totalPages: Math.ceil(values.length / limite) };
}
function stats() { return { nbSynergies: 0, nbRdvAcceptes: 0, nbPublications: 0, nbCommentaires: 0, nbAvis: 1, nbContributions: 1 }; }
function me(p) {
  const { email, prenom, nom, role, statut, createdAt, ...profil } = clone(p);
  delete profil.aides;
  return { id: p.userId, email, prenom, nom, role, statut, createdAt, profil: { ...profil, stats: stats() } };
}
function profile(p, viewer) {
  const data = clone(p);
  delete data.role; delete data.statut; delete data.emailVisible; delete data.telephoneVisible;
  data.email = p.emailVisible ? p.email : null; data.telephone = p.telephoneVisible ? p.telephone : null;
  data.estMoi = p.id === viewer.id; data.membreDepuis = p.createdAt; data.stats = stats(); data.cercles = []; data.synergie = null;
  data.associations = state.associations.filter((a) => a.valide && state.affiliations.some((m) => m.associationId === a.id && m.profilId === p.id && m.statut === "VERIFIE")).map((a) => publicAssociation(a, viewer));
  return data;
}
function parcoursOnboarding(p) {
  const codePays = (pays) => pays === "Mali" ? "ML" : pays === "Sénégal" ? "SN" : pays === "Canada" ? "CA" : "FR";
  const mois = (iso) => iso ? iso.slice(5, 7) : "";
  const annee = (iso) => iso ? iso.slice(0, 4) : "";
  return {
    formations: p.formations.map((f) => ({
      id: f.id, type: f.type, pays: f.etablissement.pays.nom, paysCode: f.etablissement.paysCode,
      ville: f.etablissement.ville, etablissement: f.etablissement.nom, etablissementId: f.etablissementId,
      etablissementSource: "", systemeEducatifCode: f.systemeEducatifCode, diplomesScolaires: clone(f.diplomesScolaires || []),
      programme: f.filiere || "", programmeId: f.filiere ? `autre:${f.id}:programme` : "",
      specialite: f.type === "ecole" ? "ES" : "", specialiteId: f.type === "ecole" ? `autre:${f.id}:specialite` : "", specialiteEstAutre: f.type === "ecole",
      moisDebut: String(f.moisDebut).padStart(2, "0"), anneeDebut: String(f.anneeDebut),
      moisFin: String(f.moisFin).padStart(2, "0"), anneeFin: String(f.anneeFin),
      statutDiplome: f.statutDiplome, diplomeObtenu: f.statutDiplome === "OBTENU", diplome: f.diplome,
      diplomeId: `autre:${f.id}:diplome`, diplomeEstAutre: true, mention: f.mention || "", mentionEstAutre: false,
      anneePromo: String(f.anneePromo), noteEnseignants: f.avis?.noteEnseignement ?? null,
      noteContenu: f.avis?.noteContenu ?? null, noteCadre: f.avis?.noteInfrastructures ?? null,
      demarcheApresFormation: null, delaiPremierEmploi: null, emploiDansLes12Mois: null, lienEmploiFormation: null,
      commentaire: f.avis?.commentaire || "",
    })),
    experiences: p.experiences.map((e) => ({
      id: e.id, poste: e.poste, structure: e.entreprise, typeContrat: e.typeContrat || "CDI", pays: e.pays,
      paysCode: codePays(e.pays), ville: e.ville, moisDebut: mois(e.dateDebut), anneeDebut: annee(e.dateDebut),
      moisFin: mois(e.dateFin), anneeFin: annee(e.dateFin), posteActuel: e.estActuel, description: e.description,
    })),
  };
}
function onboarding(p) {
  return clone(state.snapshots[p.id] || {
    informations: { prenom: p.prenom, nom: p.nom, dateNaissance: "1995-04-15", email: p.email, pays: p.pays, paysCode: p.pays === "Mali" ? "ML" : "FR", ville: p.ville, indicatif: "+223", telephone: "", situation: p.situation },
    ...(["qa-membre", "qa-manager"].includes(p.id) ? parcoursOnboarding(p) : { formations: [], experiences: [] }), mentorat: { estVolontaire: false, specialite: "", sujets: [], precisionsSujets: {}, disponibilites: [] },
  });
}
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 11 * 1024 * 1024) fail(413, "Requête trop volumineuse."); chunks.push(chunk); }
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) return {};
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) return buffer;
  try { return JSON.parse(buffer.toString("utf8")); } catch { fail(400, "JSON invalide."); }
}
function saveImage(req, raw, field, maxBytes) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(req.headers["content-type"] || "");
  if (!boundary || !Buffer.isBuffer(raw)) fail(400, "Image multipart manquante.");
  const source = raw.toString("latin1");
  const parts = source.split(`--${boundary[1] || boundary[2]}`);
  const part = parts.find((s) => s.includes(`name="${field}"`) && s.includes("filename="));
  if (!part) fail(400, `Champ multipart ${field} manquant.`);
  const divider = part.indexOf("\r\n\r\n");
  const header = part.slice(0, divider);
  const data = Buffer.from(part.slice(divider + 4).replace(/\r\n$/, ""), "latin1");
  const mime = /Content-Type:\s*([^\r\n]+)/i.exec(header)?.[1]?.trim();
  const signature = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
    : data[0] === 255 && data[1] === 216 && data[2] === 255 ? "image/jpeg"
    : data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP" ? "image/webp" : null;
  if (!signature || signature !== mime) fail(400, "Image JPEG, PNG ou WebP invalide.");
  if (data.length > maxBytes) fail(400, "Le fichier dépasse la taille autorisée.");
  const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[mime];
  const url = `/uploads/qa/fixture-${++state.sequence}.${extension}`;
  state.uploads.set(url, { data, mime }); return url;
}
function dataAssociation(body, creation) {
  const allowed = ["nom", "description", "pays", "ville", "vocation", "site", "emailContact", "dateCreation", "responsableId", "valide"];
  if (Object.keys(body).some((k) => !allowed.includes(k))) fail(400, "Champ non autorisé.");
  if (creation && ["nom", "description", "pays", "ville", "vocation", "responsableId"].some((k) => !String(body[k] || "").trim())) fail(400, "Renseignez le nom, la description, le pays, la ville, la vocation et le responsable.");
  if (!creation && !Object.keys(body).length) fail(400, "Au moins un champ doit être modifié.");
  if (body.responsableId && !visible(person(body.responsableId))) fail(400, "Le responsable doit être un membre validé.");
  if (body.site && !/^https?:\/\//i.test(body.site)) fail(400, "Le site doit être une URL HTTP ou HTTPS.");
  if (body.dateCreation && (Number.isNaN(Date.parse(body.dateCreation)) || Date.parse(body.dateCreation) > Date.now())) fail(400, "Date de fondation invalide.");
  return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? (v.trim() || null) : v]));
}
function conversationView(c, p) {
  const messages = state.messages.filter((m) => m.conversationId === c.id);
  return { id: c.id, titre: null, estGroupe: false, participants: c.participants.filter((id) => id !== p.id).map((id) => publicPerson(person(id))), dernierMessage: messages.at(-1) || null, nonLus: 0, updatedAt: messages.at(-1)?.createdAt || FIXED_DATE };
}

async function dispatch(method, path, params, body, req) {
  if (method === "POST" && path === "/api/qa/reset") return reset();
  if (method === "GET" && path === "/api/qa/state") return { qa: true, associations: state.associations, affiliations: state.affiliations, suggestions: state.suggestions };
  if (method === "GET" && path === "/api/health") return { status: "OK", database: "NOT_USED", app: "FIXTURES QA EN MÉMOIRE", qa: true };
  if (method === "POST" && path === "/api/auth/login") {
    const p = state.people.find((v) => v.email === String(body.email || "").trim().toLowerCase());
    if (!p || body.motDePasse !== PASSWORD) fail(401, "Identifiants QA incorrects. Utilisez le compte fictif et qa-test.");
    const token = `qa-fixture-${crypto.randomBytes(18).toString("hex")}`;
    state.sessions.set(token, p.id);
    return { token, user: { id: p.userId, prenom: p.prenom, nom: p.nom, role: p.role, statut: p.statut, onboardingFini: p.onboardingFini }, qa: true };
  }
  if (path.startsWith("/api/auth/login/otp/")) fail(501, "QA locale : utilisez le mode mot de passe. Aucun e-mail n'est envoyé.");
  const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
  const p = person(state.sessions.get(token));
  if (!p) fail(401, "Connectez-vous avec un compte de démonstration QA.");
  if (p.statut !== "VALIDE" && !path.startsWith("/api/onboarding") && !path.startsWith("/api/users/me")) fail(403, "Votre profil est encore en cours de validation.");
  if (method === "POST" && path === "/api/auth/logout") { state.sessions.delete(token); return { message: "Session QA fermée." }; }
  if (method === "GET" && path === "/api/users/me") return me(p);
  if (method === "PATCH" && path === "/api/users/me") {
    const allowed = ["prenom", "nom", "titre", "bio", "pays", "ville", "telephone", "linkedin", "situation", "emailVisible", "telephoneVisible"];
    for (const k of allowed) if (k in body) p[k] = body[k];
    return me(p);
  }
  if (method === "GET" && path === "/api/onboarding") return onboarding(p);
  if (method === "POST" && path === "/api/onboarding") { state.snapshots[p.id] = clone(body); p.onboardingFini = true; p.onboardingEtape = 5; return { message: "Questionnaire fictif enregistré en mémoire.", onboardingFini: true, statut: p.statut }; }
  if (method === "GET" && path === "/api/users") {
    const scope = state.people.filter((v) => visible(v) && v.id !== p.id);
    const local = scope.filter((v) => !params.get("pays") || v.pays === params.get("pays"));
    const matchesFormation = (f) => (!params.get("etablissementId") || f.etablissementId === params.get("etablissementId")) && (!params.get("promotion") || [f.anneeFin, f.anneePromo, ...(f.diplomesScolaires || []).map((d) => Number(d.anneeObtention))].includes(Number(params.get("promotion"))));
    const values = local.filter((v) => (!params.get("ville") || v.ville === params.get("ville")) && (!params.get("situation") || v.situation === params.get("situation"))
      && (!params.get("volontaire") || String(v.estVolontaire) === params.get("volontaire")) && (!params.get("aide") || (v.estVolontaire && v.aides.includes(params.get("aide"))))
      && norm(params.get("q") || "").split(/\s+/).every((q) => norm([v.prenom, v.nom, v.titre, v.bio, v.pays, v.ville, ...v.formations.map((f) => f.etablissement.nom)].join(" ")).includes(q))
      && (!(params.get("promotion") || params.get("etablissementId")) || v.formations.some(matchesFormation)));
    const page = paginate(values, params);
    const schools = new Map(local.flatMap((v) => v.formations.map((f) => [f.etablissement.id, { id: f.etablissement.id, nom: f.etablissement.nom }])));
    return { ...page, values: undefined, totalGlobal: scope.length, membres: page.values.map((v) => ({ ...publicPerson(v), bio: v.bio, situation: v.situation, estVolontaire: v.estVolontaire, user: { prenom: v.prenom, nom: v.nom }, aides: v.aides, experiences: v.experiences, formations: v.formations.filter(matchesFormation), cercles: [] })),
      facettes: { pays: unique(scope.map((v) => v.pays)), villes: unique(local.map((v) => v.ville)), etablissements: [...schools.values()], promotions: unique(local.flatMap((v) => v.formations.map((f) => f.anneePromo))).sort((a, b) => b - a), aides: unique(local.flatMap((v) => v.aides)) } };
  }
  const personMatch = /^\/api\/users\/([^/]+)$/.exec(path);
  if (method === "GET" && personMatch) { const other = person(decodeURIComponent(personMatch[1])); if (!visible(other)) fail(404, "Profil introuvable."); return profile(other, p); }
  if (method === "GET" && path === "/api/notifications") return { notifications: [], nonLues: 0, hasMore: false, nextCursor: null };
  if (method === "GET" && path === "/api/notifications/non-lues") return { nonLues: 0 };
  if (method === "GET" && path === "/api/publications") return { publications: [], hasMore: false, nextCursor: null };
  if (method === "GET" && /^\/api\/publications\/profil\/[^/]+$/.test(path)) return { publications: [], hasMore: false, nextCursor: null };
  if (path === "/api/evenements" || path.startsWith("/api/evenements/")) return dispatchEvents(method,path,params,body,req,{state,p,fail,saveImage,person,publicPerson,paginate});
  if (method === "GET" && path === "/api/synergies/suggestions") return { suggestions: [] };
  if (method === "POST" && path === "/api/synergies") {
    if (!visible(person(body.recepteurProfilId)) || body.recepteurProfilId === p.id) fail(400, "Destinataire invalide.");
    if (state.synergies.some((s) => s.demandeurId === p.id && s.recepteurId === body.recepteurProfilId)) fail(409, "Demande déjà envoyée.");
    const synergie = { id: `qa-synergie-${++state.sequence}`, demandeurId: p.id, recepteurId: body.recepteurProfilId, statut: "EN_ATTENTE", createdAt: FIXED_DATE };
    state.synergies.push(synergie); return { message: "Demande QA enregistrée.", synergie };
  }
  if (method === "GET" && path === "/api/messages/conversations") return { conversations: state.conversations.filter((c) => c.participants.includes(p.id)).map((c) => conversationView(c, p)) };
  if (method === "GET" && path === "/api/messages/membres/recherche") return { membres: state.people.filter((v) => visible(v) && v.id !== p.id && norm(`${v.prenom} ${v.nom}`).includes(norm(params.get("q") || ""))).map(publicPerson) };
  if (method === "POST" && path === "/api/messages/conversations") {
    if (!visible(person(body.destinataireId)) || p.id === body.destinataireId) fail(400, "Destinataire invalide.");
    let conversation = state.conversations.find((c) => c.participants.includes(p.id) && c.participants.includes(body.destinataireId));
    if (!conversation) { conversation = { id: `qa-conversation-${++state.sequence}`, participants: [p.id, body.destinataireId] }; state.conversations.push(conversation); }
    return { conversationId: conversation.id, message: null };
  }
  const conversationMatch = /^\/api\/messages\/conversations\/([^/]+)(\/messages)?$/.exec(path);
  if (conversationMatch) {
    const conversation = state.conversations.find((c) => c.id === conversationMatch[1] && c.participants.includes(p.id));
    if (!conversation) fail(403, "Accès refusé.");
    if (method === "GET" && !conversationMatch[2]) return { conversation: conversationView(conversation, p), messages: state.messages.filter((m) => m.conversationId === conversation.id).map((m) => ({ ...m, estMoi: m.auteurId === p.id })), hasMore: false, nextCursor: null };
    if (method === "POST" && conversationMatch[2]) { if (!String(body.contenu || "").trim()) fail(400, "Message vide."); const message = { id: `qa-message-${++state.sequence}`, conversationId: conversation.id, auteurId: p.id, contenu: body.contenu, createdAt: new Date().toISOString(), lu: false, estMoi: true, auteur: { id: p.id, initiales: p.prenom[0] + p.nom[0], photo: p.photo } }; state.messages.push(message); return { message }; }
  }
  if (method === "GET" && path === "/api/admin/stats") { requireAdmin(p); return { membres: 8, enAttente: 1, publications: 0, commentaires: 0, messages: state.messages.length, synergies: state.synergies.length, rendezVous: 0 }; }
  if (method === "GET" && path === "/api/admin/membres") { requireAdmin(p); return { membres: state.people.map(me), total: state.people.length, page: 1, totalPages: 1 }; }
  const onboardingAsso = path.startsWith("/api/onboarding/associations");
  const route = onboardingAsso ? path.slice("/api/onboarding/associations".length) || "/" : path.startsWith("/api/associations") ? path.slice("/api/associations".length) || "/" : null;
  if (route !== null) {
    if (onboardingAsso && !((method === "GET" && ["/", "/mes"].includes(route)) || (method === "POST" && route === "/suggestions") || (["POST", "DELETE"].includes(method) && /^\/[^/]+\/affiliation$/.test(route)))) fail(404, "Route d'inscription non disponible.");
    if (method === "GET" && route === "/") {
      const active = state.associations.filter((a) => a.valide);
      const values = active.filter((a) => ["pays", "ville", "vocation"].every((k) => !params.get(k) || a[k] === params.get(k)) && norm([a.nom, a.description, a.vocation].join(" ")).includes(norm(params.get("q") || "")));
      const page = paginate(values, params);
      return { ...page, values: undefined, associations: page.values.map((a) => publicAssociation(a, p)), totalGlobal: active.length, facettes: { pays: unique(active.map((a) => a.pays)), villes: unique(active.filter((a) => !params.get("pays") || a.pays === params.get("pays")).map((a) => a.ville)), vocations: unique(active.map((a) => a.vocation)) } };
    }
    if (method === "GET" && (route === "/mes-affiliations" || (onboardingAsso && route === "/mes"))) return { associations: state.associations.filter((a) => affiliation(a, p)).map((a) => publicAssociation(a, p)) };
    if (method === "GET" && route === "/mes") return { associations: state.associations.filter((a) => isAdmin(p) || (a.valide && a.responsableId === p.id)).map((a) => publicAssociation(a, p)) };
    if (method === "GET" && route === "/responsables") { requireAdmin(p); return { responsables: state.people.filter((v) => visible(v) && norm(`${v.prenom} ${v.nom}`).includes(norm(params.get("q") || ""))).map(publicPerson) }; }
    if (route === "/suggestions" && method === "POST") {
      if (!String(body.nom || "").trim() || !String(body.pays || "").trim()) fail(400, "Indiquez le nom et le pays.");
      let s = state.suggestions.find((v) => v.proposeurId === p.id && v.nom === body.nom && v.pays === body.pays && v.statut === "EN_ATTENTE");
      if (!s) { s = { id: `qa-suggestion-${++state.sequence}`, nom: body.nom, pays: body.pays, ville: body.ville || null, vocation: body.vocation || null, message: body.message || null, statut: "EN_ATTENTE", createdAt: new Date().toISOString(), proposeurId: p.id, proposeur: publicPerson(p) }; state.suggestions.push(s); }
      return { suggestion: s };
    }
    if (route === "/suggestions" && method === "GET") { requireAdmin(p); const page = paginate(state.suggestions.filter((s) => !params.get("statut") || s.statut === params.get("statut")), params); return { ...page, values: undefined, suggestions: page.values }; }
    const suggestionMatch = /^\/suggestions\/([^/]+)$/.exec(route);
    if (suggestionMatch && method === "PATCH") { requireAdmin(p); const s = state.suggestions.find((v) => v.id === suggestionMatch[1]); if (!s) fail(404, "Proposition introuvable."); if (!["TRAITEE", "REFUSEE"].includes(body.statut)) fail(400, "Statut invalide."); s.statut = body.statut; return { suggestion: s }; }
    if (route === "/" && method === "POST") { requireAdmin(p); const data = dataAssociation(body, true); const a = { id: `qa-asso-created-${++state.sequence}`, createdAt: new Date().toISOString(), valide: true, photo: null, photoCouverture: null, site: null, emailContact: null, dateCreation: null, ...data }; state.associations.push(a); return { association: publicAssociation(a, p) }; }
    const match = /^\/([^/]+)(?:\/(affiliation|affiliations|membres|photo|couverture))?(?:\/([^/]+))?$/.exec(route);
    if (match) {
      const [, associationId, action, targetId] = match;
      if (action === "affiliation" && method === "DELETE") { state.affiliations = state.affiliations.filter((a) => a.associationId !== associationId || a.profilId !== p.id); return { message: "Affiliation QA retirée." }; }
      const manage = action === "affiliations" || action === "photo" || action === "couverture";
      const a = findAssociation(associationId, p, manage);
      if (!action && method === "PATCH") { requireAdmin(p); Object.assign(a, dataAssociation(body, false)); return { association: publicAssociation(a, p) }; }
      if (action === "affiliation" && method === "POST") { if (Object.keys(body).length) fail(400, "Corps de demande invalide."); let m = affiliation(a, p); if (!m) { m = { associationId: a.id, profilId: p.id, statut: "EN_ATTENTE", rejointLe: null }; state.affiliations.push(m); } else if (["REFUSE", "DECLARE"].includes(m.statut)) { m.statut = "EN_ATTENTE"; m.rejointLe = null; } return { monAffiliation: { statut: m.statut, rejointLe: m.rejointLe } }; }
      if (action === "affiliations" && targetId && method === "PATCH") {
        if (!["VERIFIE", "REFUSE"].includes(body.decision)) fail(400, "Décision invalide.");
        if (body.decision === "VERIFIE" && p.id === targetId && !isAdmin(p)) fail(403, "Votre propre affiliation doit être vérifiée par un administrateur.");
        if (body.decision === "VERIFIE" && !visible(person(targetId))) fail(409, "Ce membre doit terminer son inscription et faire valider son profil.");
        const m = state.affiliations.find((v) => v.associationId === a.id && v.profilId === targetId); if (!m) fail(404, "Demande introuvable.");
        if (m.statut !== "EN_ATTENTE" && m.statut !== body.decision) fail(409, "Cette demande a déjà été traitée.");
        m.statut = body.decision; m.rejointLe = body.decision === "VERIFIE" ? (m.rejointLe || new Date().toISOString()) : null;
        return { monAffiliation: { statut: m.statut, rejointLe: m.rejointLe } };
      }
      if (["photo", "couverture"].includes(action) && ["POST", "DELETE"].includes(method)) {
        const field = action === "photo" ? "photo" : "photoCouverture";
        const old = a[field]; a[field] = method === "DELETE" ? null : saveImage(req, body, action, (action === "photo" ? 5 : 10) * 1024 * 1024);
        if (old) state.uploads.delete(old); return { association: publicAssociation(a, p) };
      }
      if (method === "GET" && (action === "affiliations" || action === "membres" || !action)) {
        const pending = action === "affiliations";
        const values = state.affiliations.filter((m) => m.associationId === a.id && m.statut === (pending ? "EN_ATTENTE" : "VERIFIE") && (pending || visible(person(m.profilId))));
        const page = paginate(values, action ? params : new URLSearchParams());
        const membres = page.values.map((m) => ({ ...publicPerson(person(m.profilId)), rejointLe: m.rejointLe }));
        if (!action) return { association: publicAssociation(a, p), membres, totalMembres: page.total, page: 1, totalPagesMembres: page.totalPages };
        if (pending) return { ...page, values: undefined, affiliations: page.values.map((m) => ({ profil: publicPerson(person(m.profilId)), statut: m.statut, rejointLe: m.rejointLe })) };
        return { ...page, values: undefined, membres };
      }
    }
  }
  console.warn(`[QA 404] ${method} ${path}`);
  fail(404, `Route de fixture non implémentée : ${method} ${path}`);
}

async function handle(req, res) {
  const origin = req.headers.origin;
  if (origin && !ORIGINS.has(origin)) { res.writeHead(403, { "Content-Type": "application/json" }); res.end(JSON.stringify({ message: "Origine QA non autorisée." })); return; }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Cache-Control", "no-store"); res.setHeader("X-QA-Fixture", "memory-only");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const media = state.uploads.get(url.pathname);
    if (req.method === "GET" && media) { res.writeHead(200, { "Content-Type": media.mime }); res.end(media.data); return; }
    if (!url.pathname.startsWith("/api/")) { console.warn(`[QA 404] ${req.method} ${url.pathname}`); fail(404, "Route non implémentée (temps réel exclu de cette QA HTTP)."); }
    const body = ["POST", "PATCH", "DELETE"].includes(req.method) ? await readBody(req) : {};
    const data = await dispatch(req.method, url.pathname.replace(/\/$/, ""), url.searchParams, body, req);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data));
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("[QA API]", error);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ message: error.message || "Erreur de fixture.", qa: true }));
  }
}
function createServer() { return http.createServer(handle); }
module.exports = { createServer, handle, dispatch, reset, snapshot: () => ({ events:clone(state.events), associations: clone(state.associations), affiliations: clone(state.affiliations), suggestions: clone(state.suggestions) }) };
if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log(`API FICTIVE QA : http://${HOST}:${PORT}/api — RAM uniquement, aucune base ni e-mail.`);
    console.log("Comptes fictifs : admin@example.test, membre@example.test, manager@example.test, inscription@example.test ; mot de passe public : qa-test.");
    console.log("POST /api/qa/reset réinitialise les fixtures et révoque les sessions. Arrêter le processus efface tout.");
  });
}

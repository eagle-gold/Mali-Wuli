// Classification locale (aucun accès base) des groupes de doublons exacts ML.
const fs = require("fs");
const path = require("path");
const d = require(process.env.EXTRAIT || "./extract.json");
const raw = require(process.env.BRUTS || "./raw2.json");
const OUT = process.argv[2];

const MOTS_GENERIQUES = new Set(`
e ec ecole ecoles etablissement groupe groupes scolaire scolaires complexe complexes
fondamentale fondamental fondamentales ef ecom communautaire communautaires
premier 1er 1ere 1e second seconde deuxieme 2eme 2e 2nd troisieme cycle cycles
pr priv prive privee privees prives p pub public publique publiques laique
med medersa medersas madrasa medressa franco arabe islamique islamiques islamia
lycee college institut centre annexe jardin jardins enfants enfant garderie cdpe prescolaire maternelle primaire
cscom csref sante dar coran corant coranique
d de du des la le les l el al et en a au aux
i ii iii iv km
`.split(/\s+/).filter(Boolean));

const lev = (a, b) => {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
};
// Variantes orthographiques d’un toponyme (Immach / In Mache, Sala / Salla).
const procheToponyme = (x, y) => x && y && (x === y || lev(x, y) / Math.max(x.length, y.length) <= 0.4);

/** Retourne { motsHorsVocabulaire, motsDistinctifs, toponymeSeul }. */
const analyserNom = (nomNormalise, villeNormalisee) => {
  const villeTokens = villeNormalisee.split(" ").filter(Boolean);
  const horsVocabulaire = nomNormalise.split(" ").filter((t) => t
    && !MOTS_GENERIQUES.has(t)
    && t.length > 1
    && !/^\d+(?:er|e|eme|ere)?$/.test(t));
  // Sigle écrit lettre par lettre (« A.H.M » → a h m) : au moins trois lettres = nom propre.
  const lettres = nomNormalise.split(" ").filter((t) => t.length === 1 && /\p{L}/u.test(t));
  if (horsVocabulaire.length === 0 && lettres.length >= 3) horsVocabulaire.push(lettres.join(""));
  const distinctifs = horsVocabulaire.filter((t) => !villeTokens.some((v) => v === t || (t.length >= 4 && procheToponyme(t, v))));
  const toponymeSeul = horsVocabulaire.length > 0
    && (distinctifs.length === 0 || procheToponyme(horsVocabulaire.join(""), villeTokens.join("")));
  return { horsVocabulaire, distinctifs: toponymeSeul ? [] : distinctifs, toponymeSeul };
};

const TYPES_SCOLAIRES = new Set(["FONDAMENTALE", "LYCEE"]);
const typesCompatibles = (a, b) => a === b || (TYPES_SCOLAIRES.has(a) && TYPES_SCOLAIRES.has(b));

const distanceM = (a, b) => {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const cycleNorm = (c) => {
  if (!c) return null;
  const v = String(c).toLowerCase();
  if (v === "f1" || v.startsWith("1er")) return "F1";
  if (v === "f2" || v.startsWith("2")) return "F2";
  if (v === "cdpe") return "CDPE";
  return v;
};

const REGISTRES_OFFICIELS = new Set(["ocha-men-mali-schools-2023", "unicef-men-mali-schools-2013"]);

// Index
const parId = (arr) => arr.reduce((m, x) => ((m[x.id] = m[x.id] || []).push(x), m), {});
const srcParFiche = parId(d.src);
const rawParFiche = parId(raw);
const nivParFiche = parId(d.niv);
const aliasParFiche = parId(d.ali);
const compte = (arr) => Object.fromEntries(arr.map((x) => [x.id, Number(x.n)]));
const nForm = compte(d.form), nAvis = compte(d.avis), nProg = compte(d.prog);
const forumParFiche = parId(d.forum.map((f) => ({ ...f, id: f.etablissementId, questionId: f.id })));
const suggParFiche = d.suggRefs.reduce((m, x) => ((m[x.etablissementId] = m[x.etablissementId] || []).push(x), m), {});
const profParFiche = d.profRefs.reduce((m, x) => ((m[x.etablissementId] = m[x.etablissementId] || []).push(x), m), {});

const fiche = (f) => {
  const rs = rawParFiche[f.id] || [];
  const sources = (srcParFiche[f.id] || []).map((s) => ({ source: s.code, identifiantExterne: s.ext, priorite: Number(s.priorite) }));
  const codesOfficiels = [...new Set(rs.filter((r) => REGISTRES_OFFICIELS.has(r.code)).flatMap((r) => r.codes.map(String)))].sort();
  const clusters = [...new Set(rs.map((r) => r.cluster).filter(Boolean))].sort();
  const cycles = [...new Set(rs.map((r) => cycleNorm(r.cycle)).filter(Boolean))].sort();
  const enseignements = [...new Set(rs.filter((r) => r.code === "ocha-men-mali-schools-2023").map((r) => r.type).filter(Boolean))].sort();
  const communes = [...new Set(rs.map((r) => r.commune).filter(Boolean))].sort();
  const lat = f.lat == null ? null : Number(f.lat), lng = f.lng == null ? null : Number(f.lng);
  return {
    id: f.id, nom: f.nom, sigle: f.sigle, type: f.type, statut: f.statut,
    systemeEducatifCode: f.systemeEducatifCode, ville: f.ville,
    coordonnees: lat != null && lng != null ? { lat, lng } : null,
    siteWeb: f.siteWeb, createdAt: f.createdAt, updatedAt: f.updatedAt,
    sources, codesOfficiels, clustersMen2023: clusters, cycles, enseignements, communesCodes: communes,
    niveaux: (nivParFiche[f.id] || []).map((n) => n.niveau).sort(),
    alias: (aliasParFiche[f.id] || []).map((a) => a.nom),
    compteurs: {
      formations: nForm[f.id] || 0, avis: nAvis[f.id] || 0, etablissementProgrammes: nProg[f.id] || 0,
      suggestions: (suggParFiche[f.id] || []).length, forumQuestions: (forumParFiche[f.id] || []).length,
      profilsSnapshot: (profParFiche[f.id] || []).length,
    },
    references: {
      suggestions: suggParFiche[f.id] || [],
      forumQuestions: (forumParFiche[f.id] || []).map((q) => q.questionId),
      profils: profParFiche[f.id] || [],
    },
    meilleurePrioriteSource: sources.length ? Math.min(...sources.map((s) => s.priorite)) : 999,
  };
};

const groupesBruts = {};
for (const f of d.fiches) (groupesBruts[`${f.nomNormalise}|${f.villeNormalisee}`] = groupesBruts[`${f.nomNormalise}|${f.villeNormalisee}`] || []).push(f);

const disjoints = (a, b) => a.length && b.length && !a.some((x) => b.includes(x));

const groupes = Object.entries(groupesBruts).sort(([a], [b]) => a.localeCompare(b)).map(([cle, brutes]) => {
  const [nomNormalise, villeNormalisee] = cle.split("|");
  const fiches = brutes.map(fiche);
  const bloquants = [];
  const vigilance = [];
  const preuves = [];

  // 1. Nom générique
  const analyse = analyserNom(nomNormalise, villeNormalisee);
  const distinctifs = analyse.distinctifs;
  const bloquantsCodes = new Set();
  if (analyse.horsVocabulaire.length === 0) { bloquants.push("nom générique : uniquement du vocabulaire générique"); bloquantsCodes.add("NOM_VOCABULAIRE"); }
  else if (analyse.toponymeSeul) { bloquants.push(`nom générique : seulement le nom de la localité « ${villeNormalisee} » (ou une variante)`); bloquantsCodes.add("NOM_TOPONYME"); }

  // 2. Types
  for (let i = 0; i < fiches.length; i++) for (let j = i + 1; j < fiches.length; j++) {
    const a = fiches[i], b = fiches[j];
    if (!typesCompatibles(a.type, b.type)) bloquantsCodes.add("TYPE"), bloquants.push(`types incompatibles ${a.type}/${b.type}`);
    if (disjoints(a.codesOfficiels, b.codesOfficiels)) bloquantsCodes.add("CODE"), bloquants.push(`codes officiels MEN différents (${a.codesOfficiels.join("+")} vs ${b.codesOfficiels.join("+")}) : établissements distincts dans le registre`);
    else if (disjoints(a.clustersMen2023, b.clustersMen2023)) bloquantsCodes.add("CODE"), bloquants.push(`codes cluster MEN 2023 différents (${a.clustersMen2023.join("+")} vs ${b.clustersMen2023.join("+")})`);
    if (disjoints(a.cycles, b.cycles)) bloquantsCodes.add("CYCLE"), bloquants.push(`cycles différents (${a.cycles.join("+")} vs ${b.cycles.join("+")})`);
    if (disjoints(a.enseignements, b.enseignements)) bloquantsCodes.add("ENSEIGNEMENT"), bloquants.push(`types d’enseignement différents (${a.enseignements.join("+")} vs ${b.enseignements.join("+")})`);
    if (disjoints(a.communesCodes, b.communesCodes)) bloquantsCodes.add("COMMUNE"), bloquants.push(`communes différentes (${a.communesCodes.join("+")} vs ${b.communesCodes.join("+")})`);
    if (a.statut !== "INCONNU" && b.statut !== "INCONNU" && a.statut !== b.statut) bloquantsCodes.add("STATUT"), bloquants.push(`statuts contradictoires ${a.statut}/${b.statut}`);
    if (a.systemeEducatifCode !== b.systemeEducatifCode) bloquantsCodes.add("SYSTEME"), bloquants.push(`systèmes éducatifs différents ${a.systemeEducatifCode}/${b.systemeEducatifCode}`);
  }
  for (const f of fiches) {
    if (f.communesCodes.length > 1) bloquantsCodes.add("COMMUNE_MULTI"), bloquants.push(`fiche ${f.id} déjà rattachée à plusieurs communes (${f.communesCodes.join(", ")}) : attribution de sources à réparer avant fusion`);
    if (f.codesOfficiels.length > 1) vigilance.push(`fiche ${f.id} porte déjà ${f.codesOfficiels.length} codes officiels (${f.codesOfficiels.join(", ")})`);
  }

  // 3. Preuve d’identité géographique ou par identifiant
  const avecCoord = fiches.filter((f) => f.coordonnees);
  let distanceMax = null;
  for (let i = 0; i < avecCoord.length; i++) for (let j = i + 1; j < avecCoord.length; j++) {
    const dm = distanceM(avecCoord[i].coordonnees, avecCoord[j].coordonnees);
    distanceMax = Math.max(distanceMax ?? 0, dm);
  }
  const codesPartages = fiches.length > 1 && fiches.every((f) => f.codesOfficiels.length)
    && fiches[0].codesOfficiels.some((c) => fiches.every((f) => f.codesOfficiels.includes(c)));
  let preuveIdentite = null;
  if (codesPartages) { preuveIdentite = "code officiel MEN partagé"; preuves.push("toutes les fiches partagent un code officiel MEN"); }
  if (avecCoord.length >= 2) {
    if (distanceMax < 300) { preuveIdentite = preuveIdentite || "distance < 300 m"; preuves.push(`distance maximale ${Math.round(distanceMax)} m`); }
    else { bloquantsCodes.add("DISTANCE"); bloquants.push(`distance maximale ${Math.round(distanceMax)} m (≥ 300 m)`); }
  } else if (avecCoord.length === 1) {
    preuveIdentite = preuveIdentite || "une seule fiche géolocalisée";
    preuves.push("une seule fiche a des coordonnées");
  } else if (!preuveIdentite) {
    bloquantsCodes.add("SANS_PREUVE"), bloquants.push("aucune fiche géolocalisée et aucun identifiant commun");
  }
  if (fiches.length > 2) vigilance.push(`groupe de ${fiches.length} fiches : toutes les paires ont été contrôlées, pas de fusion par transitivité partielle`);
  const osm = fiches.filter((f) => f.sources.some((s) => s.source === "hotosm-mali-education"));
  if (osm.length >= 2) vigilance.push(`${osm.length} nœuds OSM distincts : possible école à cycles séparés sur un même site`);

  const classe = bloquants.length === 0 && preuveIdentite ? "SURE" : "A_VERIFIER";
  const codes = [...bloquantsCodes];
  let sousCategorie = null;
  if (classe === "A_VERIFIER") {
    if (codes.length === 1 && codes[0] === "NOM_TOPONYME" && preuveIdentite) sousCategorie = "PROMOUVABLE_NOM_LOCALITE";
    else if (codes.every((c) => ["CYCLE", "CODE", "ENSEIGNEMENT"].includes(c)) && codes.includes("CYCLE") && preuveIdentite !== null) sousCategorie = "CYCLES_DISTINCTS_MEME_SITE";
    else if (codes.every((c) => ["CYCLE", "CODE", "ENSEIGNEMENT", "SANS_PREUVE"].includes(c)) && codes.includes("CYCLE")) sousCategorie = "CYCLES_DISTINCTS_SANS_COORDONNEES";
    else if (codes.includes("NOM_VOCABULAIRE") || codes.includes("NOM_TOPONYME")) sousCategorie = "NOM_GENERIQUE";
    else if (codes.includes("DISTANCE") || codes.includes("COMMUNE") || codes.includes("COMMUNE_MULTI")) sousCategorie = "SITES_DIFFERENTS";
    else if (codes.includes("CODE")) sousCategorie = "CODES_OFFICIELS_DIFFERENTS";
    else if (codes.includes("SANS_PREUVE")) sousCategorie = "SANS_PREUVE_GEOGRAPHIQUE";
    else sousCategorie = "AUTRE";
  }
  const totalUsage = (f) => f.compteurs.formations + f.compteurs.avis;
  const priorite = fiches.some((f) => totalUsage(f) || f.compteurs.profilsSnapshot || f.compteurs.suggestions || f.compteurs.forumQuestions) ? "haute" : "normale";

  let canonique = null, fusionnes = [], justification = null, miseAJourCanonique = null;
  if (classe === "SURE" || sousCategorie === "PROMOUVABLE_NOM_LOCALITE") {
    const tri = [...fiches].sort((a, b) =>
      totalUsage(b) - totalUsage(a)
      || a.meilleurePrioriteSource - b.meilleurePrioriteSource
      || String(a.createdAt).localeCompare(String(b.createdAt))
      || a.id.localeCompare(b.id));
    const c = tri[0];
    canonique = c.id;
    fusionnes = tri.slice(1).map((f) => f.id);
    const second = tri[1];
    if (totalUsage(c) !== totalUsage(second)) justification = `plus de formations/avis (${totalUsage(c)} contre ${totalUsage(second)})`;
    else if (c.meilleurePrioriteSource !== second.meilleurePrioriteSource) justification = `à usage égal (${totalUsage(c)}), source la plus fiable : ${c.sources.find((s) => s.priorite === c.meilleurePrioriteSource)?.source} (priorité ${c.meilleurePrioriteSource} contre ${second.meilleurePrioriteSource})`;
    else if (c.createdAt !== second.createdAt) justification = `à usage et fiabilité égaux, fiche la plus ancienne (${c.createdAt})`;
    else justification = "tous critères égaux : identifiant le plus petit (ordre déterministe)";
    // Arbitrages de champs fondés sur les fiches fusionnées, jamais sur un simple nom.
    const statutsConnus = [...new Set(fiches.map((f) => f.statut).filter((s) => s !== "INCONNU"))];
    const maj = {};
    if (c.statut === "INCONNU" && statutsConnus.length === 1) maj.statut = statutsConnus[0];
    const sigles = [...new Set(fiches.map((f) => f.sigle).filter(Boolean))];
    if (!c.sigle && sigles.length === 1) maj.sigle = sigles[0];
    if (Object.keys(maj).length) miseAJourCanonique = maj;
  }

  const referencesAReporter = canonique ? {
    formations: fusionnes.reduce((s, id) => s + fiches.find((f) => f.id === id).compteurs.formations, 0),
    avis: fusionnes.reduce((s, id) => s + fiches.find((f) => f.id === id).compteurs.avis, 0),
    etablissementProgrammes: fusionnes.reduce((s, id) => s + fiches.find((f) => f.id === id).compteurs.etablissementProgrammes, 0),
    sources: fusionnes.reduce((s, id) => s + fiches.find((f) => f.id === id).sources.length, 0),
    suggestions: fusionnes.flatMap((id) => fiches.find((f) => f.id === id).references.suggestions),
    forumQuestions: fusionnes.flatMap((id) => fiches.find((f) => f.id === id).references.forumQuestions),
    profils: fusionnes.flatMap((id) => fiches.find((f) => f.id === id).references.profils),
  } : null;

  return {
    cle, nomNormalise, villeNormalisee, classe, sousCategorie, bloquantsCodes: codes, priorite,
    motsDistinctifs: distinctifs,
    raisons: classe === "SURE" ? [preuveIdentite, ...preuves.filter((p) => p !== preuveIdentite)] : [...new Set(bloquants)],
    vigilance: [...new Set(vigilance)],
    distanceMaxM: distanceMax == null ? null : Math.round(distanceMax),
    canoniqueId: classe === "SURE" ? canonique : null, fusionnesIds: classe === "SURE" ? fusionnes : [],
    canoniquePropose: classe === "SURE" ? null : canonique, fusionnesProposes: classe === "SURE" ? null : (canonique ? fusionnes : null), justificationCanonique: justification,
    miseAJourCanonique, referencesAReporter,
    fiches: fiches.map(({ meilleurePrioriteSource, ...f }) => ({ ...f, meilleurePrioriteSource })),
  };
});

const plan = {
  version: 1,
  genereLe: new Date().toISOString(),
  extraitLe: d.extraitLe,
  perimetre: "Etablissement paysCode=ML, valide=1, groupes partageant (nomNormalise, villeNormalisee), taille ≥ 2",
  regles: {
    nomGenerique: "Un nom est générique si, après normalisation, il ne reste aucun mot distinctif une fois retirés : le vocabulaire générique (motsGeneriques), les lettres isolées, les nombres/ordinaux et les mots du nom de la localité (villeNormalisee).",
    motsGeneriques: [...MOTS_GENERIQUES].sort(),
    sure: "Aucun bloquant ET preuve d’identité : distance maximale entre fiches géolocalisées < 300 m, OU une seule fiche géolocalisée, OU code officiel MEN commun à toutes les fiches.",
    bloquants: ["nom générique", "types incompatibles (hors FONDAMENTALE/LYCEE)", "codes officiels MEN (codeCps 2023 / codeEtablissement 2013) disjoints", "codes cluster MEN 2023 disjoints", "cycles disjoints (F1/F2/CDPE)", "enseignement Classique vs Medersa", "codes commune disjoints ou fiche multi-communes", "statuts PUBLIC/PRIVE contradictoires", "systèmes éducatifs différents", "distance ≥ 300 m", "aucune coordonnée ni identifiant commun"],
    canonique: "Plus grand nombre de Formation + AvisEtablissement, puis meilleure priorité de SourceEducative (plus petit nombre), puis createdAt le plus ancien, puis id.",
    miseAJourCanonique: "statut recopié seulement si le canonique est INCONNU et qu’un seul statut connu existe dans le groupe ; sigle seulement si absent et unique.",
  },
  statistiques: null,
  groupes,
};

const sure = groupes.filter((g) => g.classe === "SURE"), av = groupes.filter((g) => g.classe === "A_VERIFIER");
const compteRaisons = {};
for (const g of av) for (const r of g.raisons) { const k = r.replace(/\(.*?\)/g, "").replace(/fiche ml-\S+/, "fiche").replace(/\d+ m/, "N m").replace(/« .* »/, "").trim(); compteRaisons[k] = (compteRaisons[k] || 0) + 1; }
plan.statistiques = {
  groupes: groupes.length, fiches: groupes.reduce((s, g) => s + g.fiches.length, 0),
  sure: { groupes: sure.length, fiches: sure.reduce((s, g) => s + g.fiches.length, 0), fichesADesactiver: sure.reduce((s, g) => s + g.fusionnesIds.length, 0) },
  aVerifier: { groupes: av.length, fiches: av.reduce((s, g) => s + g.fiches.length, 0), prioriteHaute: av.filter((g) => g.priorite === "haute").map((g) => g.cle) },
  raisonsAVerifier: Object.fromEntries(Object.entries(compteRaisons).sort((a, b) => b[1] - a[1])),
  sousCategoriesAVerifier: av.reduce((m, g) => ((m[g.sousCategorie] = (m[g.sousCategorie] || 0) + 1), m), {}),
  bloquantsCodes: av.reduce((m, g) => { for (const c of g.bloquantsCodes) m[c] = (m[c] || 0) + 1; return m; }, {}),
  preuvesSure: sure.reduce((m, g) => ((m[g.raisons[0]] = (m[g.raisons[0]] || 0) + 1), m), {}),
  referencesTrouvees: {
    formations: d.form, avis: d.avis, etablissementProgrammes: d.prog.length,
    suggestionsCatalogue: d.suggRefs, forumQuestions: d.forum, profilsSnapshots: d.profRefs,
    totalSuggestionCatalogue: d.allSuggIds.length,
  },
  referencesAReporterSure: {
    formations: sure.reduce((s, g) => s + g.referencesAReporter.formations, 0),
    avis: sure.reduce((s, g) => s + g.referencesAReporter.avis, 0),
    etablissementProgrammes: sure.reduce((s, g) => s + g.referencesAReporter.etablissementProgrammes, 0),
    sources: sure.reduce((s, g) => s + g.referencesAReporter.sources, 0),
    suggestions: sure.reduce((s, g) => s + g.referencesAReporter.suggestions.length, 0),
    forumQuestions: sure.reduce((s, g) => s + g.referencesAReporter.forumQuestions.length, 0),
    profils: sure.reduce((s, g) => s + g.referencesAReporter.profils.length, 0),
    miseAJourCanonique: sure.filter((g) => g.miseAJourCanonique).length,
  },
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "plan.json"), JSON.stringify(plan, null, 2));
console.log(JSON.stringify(plan.statistiques, null, 2));

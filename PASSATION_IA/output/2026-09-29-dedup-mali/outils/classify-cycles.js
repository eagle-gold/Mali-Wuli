// Classification locale (aucun accès base) des écoles maliennes enregistrées
// par cycle (1er / 2nd cycle, CDPE…) — décision du propriétaire du 29/09 :
// fusionner les cycles d’une même école en une seule fiche.
// Entrée : extract-cycles.json (outils/extract-cycles.js, lecture seule).
// Usage : EXTRAIT=…/extract-cycles.json node classify-cycles.js <dossier de sortie>
const fs = require("fs");
const path = require("path");
const d = require(process.env.EXTRAIT || "./extract-cycles.json");
const OUT = process.argv[2];

// ---------------------------------------------------------------------------
// Repris de classify.js (règle « nom générique » du plan précédent).
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
const procheToponyme = (x, y) => x && y && (x === y || lev(x, y) / Math.max(x.length, y.length) <= 0.4);
/** toponymes : liste de noms de lieux normalisés (ville, localité, commune). */
const analyserNom = (nomNormalise, toponymes) => {
  const horsVocabulaire = nomNormalise.split(" ").filter((t) => t && !MOTS_GENERIQUES.has(t) && t.length > 1 && !/^\d+(?:er|e|eme|ere)?$/.test(t));
  const lettres = nomNormalise.split(" ").filter((t) => t.length === 1 && /\p{L}/u.test(t));
  if (horsVocabulaire.length === 0 && lettres.length >= 3) horsVocabulaire.push(lettres.join(""));
  let toponymeSeul = false, distinctifs = horsVocabulaire;
  for (const lieu of toponymes.filter(Boolean)) {
    const villeTokens = lieu.split(" ").filter(Boolean);
    const reste = horsVocabulaire.filter((t) => !villeTokens.some((v) => v === t || (t.length >= 4 && procheToponyme(t, v))));
    if (horsVocabulaire.length > 0 && (reste.length === 0 || procheToponyme(horsVocabulaire.join(""), villeTokens.join("")))) { toponymeSeul = true; distinctifs = []; break; }
    if (reste.length < distinctifs.length) distinctifs = reste;
  }
  return { horsVocabulaire, distinctifs, toponymeSeul };
};
const distanceM = (a, b) => {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
// ---------------------------------------------------------------------------

const DISTANCE_MAX_M = 500;
const REGISTRES_OFFICIELS = new Set(["ocha-men-mali-schools-2023", "unicef-men-mali-schools-2013"]);
const TYPES_SCOLAIRES = new Set(["FONDAMENTALE", "LYCEE"]);
// Fusions appliquées le 29/09 (plan-applique-29-09.json) : ces groupes ne doivent pas revenir.
const DEJA_FUSIONNES = (() => {
  try {
    const pa = require(path.join(__dirname, "..", "plan-applique-29-09.json"));
    return pa.groupes.filter((g) => g.classe === "SURE").map((g) => ({ cle: g.cle, canoniqueId: g.canoniqueId, fusionnesIds: g.fusionnesIds }));
  } catch { return []; }
})();

/** Même normalisation que normaliserTexteEcoleMali / normaliserEducation (backend). */
const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr")
  .replace(/[’']/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** normaliserEducation (catalog-service.ts) — sert au nomNormalise de la base. */
const normaliserEducation = (v) => String(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Marqueurs de cycle, sur texte normalisé (minuscules, sans accents, ponctuation → espace).
// « c ycle » couvre la graphie OSM « [1er C]ycle ». Les suffixes I/II/A/B isolés restent distinctifs.
const C = "(?:c(?:\\s*y\\s*c?\\s*l\\s*e?s?)?|cyle|cylce)";
const MARQUEURS = [
  { cycle: "F1", re: new RegExp(`\\b(?:1\\s*(?:er|ere|e|ier)?|i(?:er)?|premier|premiere)\\s*${C}\\b`, "g") },
  { cycle: "F2", re: new RegExp(`\\b(?:2\\s*(?:nd|nde|eme|em|e|ieme|me)?|ii|second|seconde|deuxieme)\\s*${C}\\b`, "g") },
  { cycle: "F1", re: /\bcycles?\s+(?:1|i|un)\b/g },
  { cycle: "F2", re: /\bcycles?\s+(?:2|ii|deux)\b/g },
  { cycle: "F1", re: /\b(?:f|ef|fondamentale?)\s*1\b/g },
  { cycle: "F2", re: /\b(?:f|ef|fondamentale?)\s*2\b/g },
  { cycle: "CDPE", re: /\b(?:cdpe|c\s+d\s+p\s+e|jardins?\s+d\s+enfants?)\b/g },
];
const SECTION = /\bcycles?\s+([ab])\b/g;

/** Retourne { base, cycles[], sections[] } à partir d’un nom brut. */
const analyserCycleNom = (nom) => {
  let texte = norm(nom);
  const cycles = new Set(), sections = new Set();
  // « 1er et 2nd cycle(s) » : les deux cycles sur une même fiche.
  texte = texte.replace(/\b(?:1\s*(?:er|ere|e)?|premier)\s+(?:et\s+)?(?:2\s*(?:nd|nde|eme|e)?|second)\s*cycles?\b/g, () => { cycles.add("F1"); cycles.add("F2"); return " "; });
  texte = texte.replace(SECTION, (_, s) => { sections.add(s); return " "; });
  for (const { cycle, re } of MARQUEURS) texte = texte.replace(re, () => { cycles.add(cycle); return " "; });
  texte = texte.replace(/\bcycles?\b/g, " ").replace(/\s+/g, " ").trim();
  return { texte, cycles: [...cycles], sections: [...sections] };
};

// Préfixes génériques (repris de GENERIQUES_NOM, mali-school-registries.ts) + articles de liaison.
const PREFIXE = /^(?:(?:ecole|ecoles)(?: fondamentale?s?| privee?s?| publique?s?| primaire?s?| communautaire?s?| laique?s?)?|groupes? scolaires?|complexes? scolaires?|etablissements? scolaires?)\s+/;
const cleBase = (texte) => {
  let t = texte;
  for (let i = 0; i < 3; i++) t = t.replace(PREFIXE, "").replace(/^(?:de|du|des|d|et)\s+/, "").replace(/\s+(?:de|du|des|d|et)$/, "").trim();
  return t;
};

const cycleRegistre = (c) => {
  if (!c) return null;
  const v = norm(c);
  if (v === "f1" || v.startsWith("1")) return "F1";
  if (v === "f2" || v.startsWith("2")) return "F2";
  if (v === "cdpe") return "CDPE";
  return null;
};
const NIVEAUX_CYCLE = { CDPE: ["PRESCOLAIRE"], F1: ["PRIMAIRE", "FONDAMENTAL"], F2: ["FONDAMENTAL"], SEC: ["SECONDAIRE"] };
const nomCommune = (v) => norm(v).replace(/^commune(?:\s+(?:rurale|urbaine))?\s+(?:de|du|d)\s+/, "").replace(/^commune\s+(?=[ivx\d]+$)/, "commune ");

// Index
const parId = (arr) => arr.reduce((m, x) => ((m[x.id] = m[x.id] || []).push(x), m), {});
const srcParFiche = parId(d.src), nivParFiche = parId(d.niv), aliasParFiche = parId(d.ali);
const compte = (arr) => Object.fromEntries(arr.map((x) => [x.id, Number(x.n)]));
const nForm = compte(d.form), nAvis = compte(d.avis), nProg = compte(d.prog);
const forumParFiche = parId(d.forum.map((f) => ({ ...f, id: f.etablissementId, questionId: f.id })));
const suggParFiche = d.suggRefs.reduce((m, x) => ((m[x.etablissementId] = m[x.etablissementId] || []).push(x), m), {});
const profParFiche = d.profRefs.reduce((m, x) => ((m[x.etablissementId] = m[x.etablissementId] || []).push(x), m), {});

const fiche = (f) => {
  const rs = srcParFiche[f.id] || [];
  const nomAnalyse = analyserCycleNom(f.nom);
  const cyclesRegistre = [...new Set(rs.filter((r) => REGISTRES_OFFICIELS.has(r.code)).map((r) => cycleRegistre(r.cycle)).filter(Boolean))];
  const cycles = new Set([...cyclesRegistre, ...nomAnalyse.cycles]);
  if (!cycles.size && f.type === "LYCEE") cycles.add("SEC");
  const communesPcodes = [...new Set(rs.map((r) => r.communePcode).filter(Boolean))].sort();
  const communesNoms = [...new Set(rs.filter((r) => r.commune).map((r) => `${nomCommune(r.cercle)}|${nomCommune(r.commune)}`))].sort();
  const lieux = [...new Set([f.villeNormalisee, ...rs.flatMap((r) => [r.localite, r.commune ? nomCommune(r.commune) : null]).map((x) => x && norm(x))].filter(Boolean))];
  const lat = f.lat == null ? null : Number(f.lat), lng = f.lng == null ? null : Number(f.lng);
  const sources = rs.map((s) => ({ source: s.code, identifiantExterne: s.ext, priorite: Number(s.priorite) }));
  return {
    id: f.id, nom: f.nom, nomNormalise: f.nomNormalise, villeNormalisee: f.villeNormalisee, sigle: f.sigle, type: f.type, statut: f.statut,
    systemeEducatifCode: f.systemeEducatifCode, ville: f.ville,
    coordonnees: lat != null && lng != null ? { lat, lng } : null,
    siteWeb: f.siteWeb, createdAt: f.createdAt, updatedAt: f.updatedAt,
    nomSansCycle: nomAnalyse.texte, cleBase: cleBase(nomAnalyse.texte),
    cycles: [...cycles].sort(), cyclesRegistre: cyclesRegistre.sort(), cyclesNom: nomAnalyse.cycles.sort(), sections: nomAnalyse.sections,
    sources,
    codesOfficiels: [...new Set(rs.filter((r) => REGISTRES_OFFICIELS.has(r.code)).flatMap((r) => (r.codes || []).map(String)))].sort(),
    clustersMen2023: [...new Set(rs.flatMap((r) => r.clusters || []))].sort(),
    enseignements: [...new Set(rs.filter((r) => r.code === "ocha-men-mali-schools-2023").map((r) => r.enseignement).filter(Boolean))].sort(),
    communesPcodes, communesNoms, lieux,
    niveaux: (nivParFiche[f.id] || []).map((n) => n.niveau).sort(),
    alias: (aliasParFiche[f.id] || []).map((a) => a.nom),
    compteurs: {
      formations: nForm[f.id] || 0, avis: nAvis[f.id] || 0, etablissementProgrammes: nProg[f.id] || 0,
      suggestions: (suggParFiche[f.id] || []).length, forumQuestions: (forumParFiche[f.id] || []).length,
      profilsSnapshot: (profParFiche[f.id] || []).length,
    },
    references: { suggestions: suggParFiche[f.id] || [], forumQuestions: (forumParFiche[f.id] || []).map((q) => q.questionId), profils: profParFiche[f.id] || [] },
    meilleurePrioriteSource: sources.length ? Math.min(...sources.map((s) => s.priorite)) : 999,
  };
};

const fiches = d.fiches.map(fiche);
const LIEUX_MALI = new Set([
  ...d.fiches.map((f) => f.villeNormalisee),
  ...d.src.flatMap((r) => [r.localite, r.commune ? nomCommune(r.commune) : null, r.cercle]).map((x) => x && norm(x)),
].filter((x) => x && x.length >= 3));
const inter = (a, b) => a.some((x) => b.includes(x));

/** Même commune : pcode commun ; à défaut de pcode d’un côté, nom cercle|commune commun. */
const memeCommune = (a, b) => {
  if (a.communesPcodes.length && b.communesPcodes.length) return inter(a.communesPcodes, b.communesPcodes);
  if (a.communesNoms.length && b.communesNoms.length) return inter(a.communesNoms, b.communesNoms);
  return null; // inconnu
};
const communeConnue = (f) => f.communesPcodes.length > 0 || f.communesNoms.length > 0;

// 1. Candidats : même clé de base, au moins un signal de cycle, rattachés à la même commune.
const parBase = {};
let sansBase = 0;
for (const f of fiches) {
  if (!f.cleBase || analyserNom(f.cleBase, []).horsVocabulaire.length === 0) { if (f.cycles.length) sansBase++; continue; }
  (parBase[f.cleBase] = parBase[f.cleBase] || []).push(f);
}
const composantes = [];
for (const [base, liste] of Object.entries(parBase)) {
  if (liste.length < 2 || !liste.some((f) => f.cyclesNom.length || f.cyclesRegistre.length)) continue;
  // Au moins un marqueur de cycle dans les noms OU des cycles registre différents : sinon, doublon exact (plan précédent).
  const parent = liste.map((_, i) => i);
  const racine = (i) => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i], b = liste[j];
    const mc = memeCommune(a, b);
    const lien = mc === true || (mc === null && (!communeConnue(a) || !communeConnue(b)) && a.villeNormalisee === b.villeNormalisee);
    if (lien) parent[racine(i)] = racine(j);
  }
  const comp = {};
  liste.forEach((f, i) => (comp[racine(i)] = comp[racine(i)] || []).push(f));
  for (const g of Object.values(comp)) if (g.length >= 2) composantes.push({ base, fiches: g });
}
// Une composante n’entre dans le plan « cycles » que si les cycles y jouent un rôle :
// marqueur de cycle dans au moins un nom, ou cycles registre différents entre fiches.
const pertinente = (g) => g.fiches.some((f) => f.cyclesNom.length)
  || new Set(g.fiches.map((f) => f.cyclesRegistre.join("+")).filter(Boolean)).size > 1;

// Casse soignée pour le nouveau libellé.
const PARTICULES = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "à", "a", "sur", "d", "l"]);
const MOTS_MINUSCULES_APRES_TETE = new Set(["fondamentale", "fondamental", "scolaire", "privée", "privee", "publique", "communautaire", "laïque", "laique", "franco-arabe", "islamique"]);
const ACCENTS = { ecole: "école", ecoles: "écoles", lycee: "lycée", college: "collège", privee: "privée", laique: "laïque", etablissement: "établissement" };
const ROMAIN = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i;
const majuscule = (m) => m.charAt(0).toLocaleUpperCase("fr") + m.slice(1);
const casserMot = (mot, index) => {
  if (!mot) return mot;
  if (/\./.test(mot) || (/^[A-Z]{2,4}$/.test(mot) && !/[AEIOUY]/.test(mot))) return mot.toLocaleUpperCase("fr"); // sigle
  if (ROMAIN.test(mot) && index > 0) return mot.toUpperCase();
  if (/^[a-z]$/i.test(mot) && index > 0) return mot.toUpperCase();
  const bas = mot.toLocaleLowerCase("fr");
  const accentue = ACCENTS[bas] || bas;
  if (index > 0 && PARTICULES.has(bas)) return accentue;
  // Élisions et composés : N'Guérou, M'Boya, Beko-Bougouda, d'Hamdallaye.
  return accentue.split("-").map((p) => p.split("'").map((q, k) => (k === 0 && index > 0 && ["d", "l"].includes(q) && p.includes("'") ? q : majuscule(q))).join("'")).join("-");
};
const casseSoignee = (texte) => {
  const lettres = texte.replace(/[^\p{L}]/gu, "");
  const toutMaj = lettres && lettres === lettres.toLocaleUpperCase("fr");
  const toutMin = lettres && lettres === lettres.toLocaleLowerCase("fr");
  let mots = texte.split(/\s+/).filter(Boolean);
  if (toutMaj || toutMin) mots = mots.map((m, i) => casserMot(m, i));
  else mots = mots.map((m, i) => { const b = m.toLocaleLowerCase("fr"); return i === 0 && ACCENTS[b] ? majuscule(ACCENTS[b]) : m; });
  // « École Fondamentale de X » → « École fondamentale de X »
  for (let i = 1; i < mots.length; i++) if (/^(?:école|groupe|complexe|lycée)$/i.test(mots[0]) && MOTS_MINUSCULES_APRES_TETE.has(mots[i].toLocaleLowerCase("fr"))) mots[i] = mots[i].toLocaleLowerCase("fr"); else if (i > 0) break;
  return mots.join(" ");
};
/** Retire les marqueurs de cycle d’un libellé affiché, sans toucher au reste. */
const MARQUEURS_AFFICHES = [
  /[\[(]?\s*\b(?:1|2)\s*(?:er|ère|ere|e|è|é|ème|eme|em|nd|nde|ier)?\s*°?\s*(?:c(?:ycle|yle|ylce)?s?)\b\s*[\])]?(?:ycles?\b)?/giu,
  /[\[(]?\s*\b(?:premier|première|premiere|second|seconde|deuxième|deuxieme|i|ii)\s+(?:c(?:ycle)?s?)\b\s*[\])]?/giu,
  /\b(?:1er|premier)\s+(?:et\s+)?(?:2nd|2nde|2ème|2eme|second)\s+cycles?\b/giu,
  /\bcycles?\s+(?:1|2|i|ii|a|b|un|deux)\b/giu,
  /\b(?:f|ef|fondamentale?)\s*[12]\b/giu,
  /\bc\.?\s*d\.?\s*p\.?\s*e\.?(?=\s|$|[-,)\]])/giu,
  /\bjardins?\s+d['’\s]\s*enfants?\b/giu,
];
const libelleSansCycle = (nom) => {
  let t = nom;
  // « [1er C]ycle » : retirer le reliquat « ycle » collé.
  for (const re of MARQUEURS_AFFICHES) t = t.replace(re, " ");
  t = t.replace(/\s*°\s*c\b\.?/giu, " ");
  t = t.replace(/\b(?:et|&)\s*$/i, " ").replace(/[\[\]()]/g, " ").replace(/\s*[-–—,/:]\s*$/g, "").replace(/^\s*[-–—,/:]\s*/g, "");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/^(?:de|du|d['’]|et)\s+/i, "").replace(/\s+(?:de|du|des|d['’]?|et|&)$/i, "").trim();
  return t;
};
const diacritiques = (s) => (s.normalize("NFD").match(/[̀-ͯ]/g) || []).length;
const estCasseMixte = (s) => { const l = s.replace(/[^\p{L}]/gu, ""); return l !== l.toLocaleUpperCase("fr") && l !== l.toLocaleLowerCase("fr"); };

const typeLibelle = /^(?:école|ecole|écoles|groupe|complexe|lycée|lycee|medersa|madrasa|cdpe|jardin|institut|collège|college|centre|etablissement|établissement|e\.?f\.?|ef|ecom)\b/i;
const nomPropose = (groupeFiches, canonique, toponyme, base) => {
  // Le libellé retenu ne doit plus contenir de marqueur et doit redonner la même clé de base.
  const candidats = groupeFiches.map((f) => ({ f, libelle: libelleSansCycle(f.nom) }))
    .filter((c) => { const a = analyserCycleNom(c.libelle); return c.libelle && !a.cycles.length && !a.sections.length && cleBase(a.texte) === base; });
  // Préférence : libellé en casse mixte, puis le plus d’accents, puis qui porte un mot d’école, puis celui du canonique.
  candidats.sort((a, b) => Number(estCasseMixte(b.libelle)) - Number(estCasseMixte(a.libelle))
    || diacritiques(b.libelle) - diacritiques(a.libelle)
    || Number(typeLibelle.test(b.libelle)) - Number(typeLibelle.test(a.libelle))
    || Number(b.f.id === canonique.id) - Number(a.f.id === canonique.id)
    || a.libelle.localeCompare(b.libelle));
  const choisi = candidats[0];
  if (!choisi) return null;
  let nom = casseSoignee(choisi.libelle);
  if (toponyme && !typeLibelle.test(nom)) nom = /^[aeiouyhéèêâîôû]/i.test(nom) ? `École d’${nom}` : `École de ${nom}`;
  return { nom, depuis: choisi.f.id };
};

const disjoints = (a, b) => a.length && b.length && !inter(a, b);

// 2. Classification par composante (toutes les paires doivent passer).
const idsDejaFusionnes = new Set(DEJA_FUSIONNES.flatMap((g) => [g.canoniqueId, ...g.fusionnesIds]));
const groupes = composantes.filter(pertinente).map(({ base, fiches: gf }) => {
  gf.sort((a, b) => a.id.localeCompare(b.id));
  const bloquants = [], codes = new Set(), vigilance = [];
  const add = (code, texte) => { codes.add(code); bloquants.push(texte); };

  const lieux = [...new Set(gf.flatMap((f) => f.lieux))];
  const analyse = analyserNom(base, lieux);
  // Toponyme connu ailleurs au Mali (localité/commune d’une source, ville d’une fiche) : même règle.
  if (!analyse.toponymeSeul && analyse.horsVocabulaire.length && LIEUX_MALI.has(analyse.horsVocabulaire.join(" "))) { analyse.toponymeSeul = true; analyse.distinctifs = []; }
  const clustersCommuns = gf.every((f) => f.clustersMen2023.length) && gf[0].clustersMen2023.filter((c) => gf.every((f) => f.clustersMen2023.includes(c)));
  if (analyse.horsVocabulaire.length === 0) add("NOM_VOCABULAIRE", "nom de base générique : uniquement du vocabulaire générique");
  else if (analyse.toponymeSeul) {
    if (clustersCommuns && clustersCommuns.length) vigilance.push(`nom de base = localité, admis car code cluster MEN 2023 commun (${clustersCommuns.join(", ")})`);
    else add("NOM_TOPONYME", `nom de base = nom de la localité (« ${base} ») sans code cluster MEN commun`);
  }

  let distanceMax = null;
  for (let i = 0; i < gf.length; i++) for (let j = i + 1; j < gf.length; j++) {
    const a = gf[i], b = gf[j];
    if (!a.cycles.length || !b.cycles.length) add("CYCLE_INCONNU", `cycle inconnu pour ${!a.cycles.length ? a.id : b.id} (${!a.cycles.length ? a.nom : b.nom})`);
    else if (inter(a.cycles, b.cycles)) add("MEME_CYCLE", `même cycle des deux côtés (${a.cycles.join("+")} / ${b.cycles.join("+")}) : ${a.nom} / ${b.nom}`);
    if (a.sections.length && b.sections.length && !inter(a.sections, b.sections)) add("SECTION", `sections différentes (${a.sections.join("")} / ${b.sections.join("")})`);
    const mc = memeCommune(a, b);
    if (mc !== true) add("COMMUNE", mc === false ? `communes différentes (${a.communesPcodes.join("+") || a.communesNoms.join("+")} / ${b.communesPcodes.join("+") || b.communesNoms.join("+")})` : `commune non confirmée par une source registre/OSM (${!communeConnue(a) ? a.id : b.id})`);
    if (a.statut !== "INCONNU" && b.statut !== "INCONNU" && a.statut !== b.statut) add("STATUT", `statuts différents ${a.statut}/${b.statut}`);
    if (!(TYPES_SCOLAIRES.has(a.type) && TYPES_SCOLAIRES.has(b.type))) add("TYPE", `types incompatibles ${a.type}/${b.type}`);
    if (a.systemeEducatifCode !== b.systemeEducatifCode) add("SYSTEME", `systèmes éducatifs différents ${a.systemeEducatifCode}/${b.systemeEducatifCode}`);
    if (disjoints(a.enseignements, b.enseignements)) add("ENSEIGNEMENT", `enseignement ${a.enseignements.join("+")} / ${b.enseignements.join("+")}`);
    if (a.coordonnees && b.coordonnees) {
      const dm = distanceM(a.coordonnees, b.coordonnees);
      distanceMax = Math.max(distanceMax ?? 0, dm);
      if (dm >= DISTANCE_MAX_M) add("DISTANCE", `distance ${Math.round(dm)} m ≥ ${DISTANCE_MAX_M} m (${a.id} / ${b.id})`);
    }
  }
  for (const f of gf) {
    if (f.communesPcodes.length > 1) add("COMMUNE_MULTI", `fiche ${f.id} rattachée à plusieurs communes (${f.communesPcodes.join(", ")})`);
    if (f.cyclesNom.length && f.cyclesRegistre.length && disjoints(f.cyclesNom, f.cyclesRegistre)) add("CYCLE_CONTRADICTOIRE", `fiche ${f.id} : cycle du nom (${f.cyclesNom.join("+")}) ≠ cycle du registre (${f.cyclesRegistre.join("+")})`);
    if (idsDejaFusionnes.has(f.id)) vigilance.push(`fiche ${f.id} issue d’une fusion du 29/09 (${DEJA_FUSIONNES.find((g) => g.canoniqueId === f.id || g.fusionnesIds.includes(f.id)).cle})`);
    if (f.codesOfficiels.length > 1) vigilance.push(`fiche ${f.id} porte déjà ${f.codesOfficiels.length} codes officiels (${f.codesOfficiels.join(", ")})`);
  }
  const typesDiff = new Set(gf.map((f) => f.type));
  if (typesDiff.size > 1) vigilance.push(`types ${[...typesDiff].join("/")} : la fiche garde le type du canonique`);
  if (gf.length > 2) vigilance.push(`groupe de ${gf.length} fiches : toutes les paires ont été contrôlées (pas de transitivité)`);
  if (!gf.some((f) => f.coordonnees)) vigilance.push("aucune fiche géolocalisée : rapprochement sur le nom et la commune uniquement");

  const classeCycles = codes.size === 0 ? "CYCLES_SURE" : "CYCLES_A_VERIFIER";
  const ordre = ["COMMUNE_MULTI", "COMMUNE", "TYPE", "SYSTEME", "STATUT", "ENSEIGNEMENT", "DISTANCE", "SECTION", "CYCLE_CONTRADICTOIRE", "MEME_CYCLE", "CYCLE_INCONNU", "NOM_VOCABULAIRE", "NOM_TOPONYME"];
  const motif = classeCycles === "CYCLES_SURE" ? null : ordre.find((c) => codes.has(c));

  const usage = (f) => f.compteurs.formations + f.compteurs.avis;
  const tri = [...gf].sort((a, b) => usage(b) - usage(a) || a.meilleurePrioriteSource - b.meilleurePrioriteSource
    || String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
  const c = tri[0], second = tri[1];
  let justification;
  if (usage(c) !== usage(second)) justification = `plus de formations/avis (${usage(c)} contre ${usage(second)})`;
  else if (c.meilleurePrioriteSource !== second.meilleurePrioriteSource) justification = `à usage égal (${usage(c)}), source la plus fiable : ${c.sources.find((s) => s.priorite === c.meilleurePrioriteSource)?.source} (priorité ${c.meilleurePrioriteSource} contre ${second.meilleurePrioriteSource})`;
  else if (String(c.createdAt) !== String(second.createdAt)) justification = `à usage et fiabilité égaux, fiche la plus ancienne (${c.createdAt})`;
  else justification = "tous critères égaux : identifiant le plus petit (ordre déterministe)";

  const propose = nomPropose(gf, c, analyse.toponymeSeul, base);
  const maj = {};
  if (propose) {
    const nn = normaliserEducation(propose.nom);
    if (propose.nom !== c.nom) { maj.nom = propose.nom; maj.nomNormalise = nn; }
  } else if (classeCycles === "CYCLES_SURE") { codes.add("NOM_PROPOSE"); bloquants.push("aucun libellé exploitable sans marqueur de cycle"); }
  const statutsConnus = [...new Set(gf.map((f) => f.statut).filter((s) => s !== "INCONNU"))];
  if (c.statut === "INCONNU" && statutsConnus.length === 1) maj.statut = statutsConnus[0];
  const sigles = [...new Set(gf.map((f) => f.sigle).filter(Boolean))];
  if (!c.sigle && sigles.length === 1) maj.sigle = sigles[0];
  const niveauxFusion = [...new Set(gf.flatMap((f) => f.niveaux))].sort();
  const niveauxCycles = [...new Set(gf.flatMap((f) => f.cycles.flatMap((cy) => NIVEAUX_CYCLE[cy] || [])))];
  const niveauxManquants = niveauxCycles.filter((n) => !niveauxFusion.includes(n)).sort();
  if (niveauxManquants.length) maj.niveaux = niveauxManquants;
  const niveauxApres = [...new Set([...niveauxFusion, ...niveauxManquants])].sort();

  const classeFinale = codes.size === 0 ? "CYCLES_SURE" : "CYCLES_A_VERIFIER";
  const sure = classeFinale === "CYCLES_SURE";
  const fusionnes = tri.slice(1).map((f) => f.id);
  const somme = (k) => fusionnes.reduce((s, id) => s + gf.find((f) => f.id === id).compteurs[k], 0);
  return {
    cle: `${base}|${c.villeNormalisee}|${gf.map((f) => f.cycles.join("+") || "?").sort().join(",")}`,
    nomNormalise: base,
    villeNormalisee: c.villeNormalisee,
    classe: sure ? "SURE" : "A_VERIFIER",
    classeCycles: classeFinale,
    sousCategorie: "CYCLES",
    motif: sure ? null : (motif || [...codes][0]),
    bloquantsCodes: [...codes],
    raisons: sure ? [`cycles complémentaires ${gf.map((f) => f.cycles.join("+")).join(" / ")}`, "même commune (source registre/OSM)", distanceMax == null ? "au plus une fiche géolocalisée" : `distance maximale ${Math.round(distanceMax)} m`] : [...new Set(bloquants)],
    vigilance: [...new Set(vigilance)],
    distanceMaxM: distanceMax == null ? null : Math.round(distanceMax),
    communes: [...new Set(gf.flatMap((f) => f.communesPcodes.length ? f.communesPcodes : f.communesNoms))],
    canoniqueId: sure ? c.id : null,
    fusionnesIds: sure ? fusionnes : [],
    canoniquePropose: sure ? null : c.id,
    fusionnesProposes: sure ? null : fusionnes,
    justificationCanonique: justification,
    nomAvant: c.nom,
    nomApres: propose ? propose.nom : c.nom,
    nomApresDepuis: propose ? propose.depuis : null,
    niveauxFusionnes: niveauxApres,
    miseAJourCanonique: Object.keys(maj).length ? maj : null,
    referencesAReporter: {
      formations: somme("formations"), avis: somme("avis"), etablissementProgrammes: somme("etablissementProgrammes"),
      sources: fusionnes.reduce((s, id) => s + gf.find((f) => f.id === id).sources.length, 0),
      suggestions: fusionnes.flatMap((id) => gf.find((f) => f.id === id).references.suggestions),
      forumQuestions: fusionnes.flatMap((id) => gf.find((f) => f.id === id).references.forumQuestions),
      profils: fusionnes.flatMap((id) => gf.find((f) => f.id === id).references.profils),
    },
    fiches: gf,
  };
});

// Une fiche ne peut appartenir qu’à un seul groupe appliqué.
const occurrences = {};
for (const g of groupes) for (const f of g.fiches) occurrences[f.id] = (occurrences[f.id] || 0) + 1;
for (const g of groupes) {
  const doubles = g.fiches.filter((f) => occurrences[f.id] > 1);
  if (doubles.length && g.classe === "SURE") {
    g.classe = "A_VERIFIER"; g.classeCycles = "CYCLES_A_VERIFIER"; g.motif = "FICHE_MULTI_GROUPES";
    g.bloquantsCodes.push("FICHE_MULTI_GROUPES"); g.raisons = [`fiche(s) présente(s) dans plusieurs groupes : ${doubles.map((f) => f.id).join(", ")}`];
    g.canoniquePropose = g.canoniqueId; g.fusionnesProposes = g.fusionnesIds; g.canoniqueId = null; g.fusionnesIds = [];
  }
}
// Garde : aucun groupe déjà fusionné le 29/09 ne revient à l’identique.
for (const g of groupes) {
  const ids = g.fiches.map((f) => f.id);
  if (DEJA_FUSIONNES.some((h) => [h.canoniqueId, ...h.fusionnesIds].every((id) => ids.includes(id)))) throw new Error(`groupe déjà fusionné présent : ${g.cle}`);
}
groupes.sort((a, b) => (a.classe === b.classe ? a.cle.localeCompare(b.cle) : a.classe === "SURE" ? -1 : 1));

const sure = groupes.filter((g) => g.classe === "SURE"), av = groupes.filter((g) => g.classe !== "SURE");
const somme = (arr, k) => arr.reduce((s, g) => s + (Array.isArray(g.referencesAReporter[k]) ? g.referencesAReporter[k].length : g.referencesAReporter[k]), 0);
const plan = {
  version: 1,
  genereLe: new Date().toISOString(),
  extraitLe: d.extraitLe,
  sousCategorie: "CYCLES",
  perimetre: "Etablissement paysCode=ML, valide=1 ; groupes de fiches dont le nom, marqueurs de cycle retirés, est identique, rattachées à la même commune (pcode registre/OSM, sinon cercle|commune du registre), avec au moins un marqueur de cycle dans un nom ou des cycles registre différents.",
  regles: {
    decision: "Décision du propriétaire (29/09) : les cycles (1er/2nd/CDPE) d’une même école sont fusionnés en une seule fiche ; les codes officiels restent attachés comme EtablissementSource, les anciens libellés deviennent des EtablissementAlias.",
    marqueursDeCycle: "1er/premier/I cycle, 2nd/second/2ème/II cycle (dont « [1er C] »), cycle 1/2, F1/F2, fondamental(e) 1/2, CDPE, jardin d’enfants ; « cycle A/B » retiré mais conservé comme section (sections différentes → à vérifier). Les suffixes isolés A/B/I/II restent distinctifs.",
    cleDeBase: "nom normalisé, marqueurs retirés, puis préfixe générique retiré (école [fondamentale|privée|publique…], groupe/complexe/établissement scolaire) et articles de liaison en tête/fin.",
    cyclesSure: `toutes les paires : cycles connus et disjoints ; même commune ; statuts identiques ou un INCONNU ; types FONDAMENTALE/LYCEE ; même système éducatif ; pas d’enseignement Classique/Medersa contradictoire ; distance < ${DISTANCE_MAX_M} m si les deux fiches ont des coordonnées ; nom de base non générique (sauf nom = localité ET code cluster MEN 2023 commun à toutes les fiches) ; aucune fiche dans deux groupes.`,
    motsGeneriques: [...MOTS_GENERIQUES].sort(),
    canonique: "Plus grand nombre de Formation + AvisEtablissement, puis meilleure priorité de SourceEducative, puis createdAt le plus ancien, puis id.",
    nouveauNom: "Libellé d’une des fiches, marqueurs de cycle retirés : casse mixte préférée, puis le plus d’accents, puis portant un mot d’école, puis celui du canonique ; casse soignée si tout en majuscules/minuscules ; « École de X » si le nom de base est la localité. nomNormalise = normaliserEducation(nom).",
    miseAJourCanonique: "nom/nomNormalise (ancien nom ajouté en EtablissementAlias par le script), statut si canonique INCONNU et un seul statut connu, sigle si absent et unique, niveaux impliqués par les cycles et absents des fiches.",
  },
  statistiques: null,
  groupes,
};
const compter = (arr, f) => arr.reduce((m, g) => { for (const k of [].concat(f(g))) m[k] = (m[k] || 0) + 1; return m; }, {});
plan.statistiques = {
  fichesPerimetre: fiches.length,
  fichesAvecCycle: fiches.filter((f) => f.cycles.length).length,
  fichesSansNomExploitable: sansBase,
  groupes: groupes.length,
  cyclesSure: { groupes: sure.length, fiches: sure.reduce((s, g) => s + g.fiches.length, 0), fichesADesactiver: sure.reduce((s, g) => s + g.fusionnesIds.length, 0), renommages: sure.filter((g) => g.miseAJourCanonique?.nom).length },
  cyclesAVerifier: { groupes: av.length, fiches: av.reduce((s, g) => s + g.fiches.length, 0), parMotif: compter(av, (g) => g.motif), parBloquant: compter(av, (g) => g.bloquantsCodes) },
  combinaisonsSure: compter(sure, (g) => g.fiches.map((f) => f.cycles.join("+")).sort().join(" / ")),
  referencesAReporterSure: {
    formations: somme(sure, "formations"), avis: somme(sure, "avis"), etablissementProgrammes: somme(sure, "etablissementProgrammes"),
    sources: somme(sure, "sources"), suggestions: somme(sure, "suggestions"), forumQuestions: somme(sure, "forumQuestions"), profils: somme(sure, "profils"),
    miseAJourCanonique: sure.filter((g) => g.miseAJourCanonique).length,
  },
  referencesSurFichesSure: sure.flatMap((g) => g.fiches.filter((f) => f.compteurs.formations || f.compteurs.avis || f.compteurs.profilsSnapshot || f.compteurs.suggestions || f.compteurs.forumQuestions || f.compteurs.etablissementProgrammes)
    .map((f) => ({ groupe: g.cle, id: f.id, role: f.id === g.canoniqueId ? "canonique" : "fusionné", ...f.compteurs }))),
  dejaFusionnes29_09: DEJA_FUSIONNES.map((g) => g.cle),
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "plan-cycles.json"), JSON.stringify(plan, null, 2));
console.log(JSON.stringify(plan.statistiques, null, 2));

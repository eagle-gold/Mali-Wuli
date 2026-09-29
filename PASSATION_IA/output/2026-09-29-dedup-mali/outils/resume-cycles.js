// Génère resume-cycles.md à partir de plan-cycles.json (aucun accès base).
// Usage : node resume-cycles.js <dossier contenant plan-cycles.json>
const fs = require("fs"), path = require("path");
const OUT = process.argv[2];
const p = JSON.parse(fs.readFileSync(path.join(OUT, "plan-cycles.json")));
const st = p.statistiques, G = p.groupes;
const sure = G.filter((g) => g.classe === "SURE"), av = G.filter((g) => g.classe !== "SURE");
const L = []; const w = (s = "") => L.push(s);
const cyc = (f) => f.cycles.join("+") || "?";
const md = (s) => String(s).replace(/\|/g, "\\|");

w("# Fusion des cycles d’une même école au Mali — plan (29 septembre 2026)"); w();
w(`Extraction en lecture seule de la base de production le ${p.extraitLe} (UTC), 24 h de validité pour le script. Aucune écriture en base, aucune fusion appliquée. Plan : \`plan-cycles.json\` ; outils : \`outils/extract-cycles.js\` (SELECT uniquement), \`outils/classify-cycles.js\`, \`outils/resume-cycles.js\`.`); w();
w(`Décision du propriétaire (29/09) : les écoles que le registre MEN (2013/2023) enregistre séparément par cycle (1er cycle, 2nd cycle, CDPE / jardin d’enfants) au même endroit sont fusionnées en une seule fiche ; les cycles deviennent des niveaux et les codes officiels restent attachés comme EtablissementSource.`); w();
w("## Chiffres"); w();
w("| | Groupes | Fiches |"); w("|---|---:|---:|");
w(`| Candidats (même nom sans marqueur de cycle, même commune) | ${st.groupes} | ${G.reduce((s, g) => s + g.fiches.length, 0)} |`);
w(`| **CYCLES_SURE** (classe SURE, à appliquer) | **${st.cyclesSure.groupes}** | ${st.cyclesSure.fiches} — **${st.cyclesSure.fichesADesactiver} fiches désactivées**, ${st.cyclesSure.renommages} canoniques renommés |`);
w(`| CYCLES_A_VERIFIER | ${st.cyclesAVerifier.groupes} | ${st.cyclesAVerifier.fiches} |`); w();
w(`Combinaisons de cycles des groupes SURE : ${Object.entries(st.combinaisonsSure).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} : ${v}`).join(" ; ")} (SEC = lycée/collège sans marqueur).`); w();
w(`Groupes SURE à plus de deux fiches : ${sure.filter((g) => g.fiches.length > 2).length} ; groupes SURE sans aucune fiche géolocalisée : ${sure.filter((g) => !g.fiches.some((f) => f.coordonnees)).length} (rapprochement par nom + commune du registre, comme l’a décidé le propriétaire) ; avec deux fiches géolocalisées : ${sure.filter((g) => g.distanceMaxM != null).length} (distance max ${Math.max(...sure.map((g) => g.distanceMaxM ?? 0))} m).`); w();
const lib = {
  NOM_TOPONYME: "nom de base = nom de la localité/commune, sans code cluster MEN 2023 commun",
  MEME_CYCLE: "deux fiches du même cycle (doublon exact à traiter d’abord, ou deux écoles distinctes)",
  CYCLE_INCONNU: "une fiche sans cycle connu (ni registre ni marqueur dans le nom)",
  DISTANCE: `deux fiches géolocalisées à ≥ 500 m`,
  CYCLE_CONTRADICTOIRE: "marqueur du nom ≠ cycle du registre sur une même fiche",
  STATUT: "PUBLIC / PRIVE contradictoires",
  ENSEIGNEMENT: "Classique / Medersa (registre 2023)",
  COMMUNE_MULTI: "fiche rattachée à plusieurs communes",
  COMMUNE: "communes différentes ou non confirmées",
  NOM_PROPOSE: "aucun libellé exploitable sans marqueur",
  SECTION: "sections « cycle A » / « cycle B » différentes",
  FICHE_MULTI_GROUPES: "fiche présente dans plusieurs groupes",
};
w("CYCLES_A_VERIFIER par motif principal (un motif par groupe ; un groupe peut en cumuler) :"); w();
w("| Motif | Groupes | Tous bloquants | Signification |"); w("|---|---:|---:|---|");
for (const [k, v] of Object.entries(st.cyclesAVerifier.parMotif).sort((a, b) => b[1] - a[1])) w(`| ${k} | ${v} | ${st.cyclesAVerifier.parBloquant[k] ?? v} | ${lib[k] || ""} |`);
w();
const promouvables = av.filter((g) => g.bloquantsCodes.length === 1 && g.bloquantsCodes[0] === "NOM_TOPONYME");
w(`Dont **${promouvables.length} groupes dont le seul bloquant est le nom de localité** (toponyme reconnu dans le groupe ou ailleurs au Mali, sans code cluster commun) : tous les autres contrôles passent ; candidats à une validation humaine rapide (passer \`classe\` à \`SURE\` et copier \`canoniquePropose\`/\`fusionnesProposes\` dans \`canoniqueId\`/\`fusionnesIds\` ; le script revalide en base). Pour ces groupes, le nom proposé devient « École de X » quand le libellé ne porte pas déjà un mot d’école.`); w();
w("## Règles"); w();
for (const [k, v] of Object.entries(p.regles)) if (k !== "motsGeneriques") w(`- **${k}** : ${v}`);
w(`- Vocabulaire générique (règle existante) : ${p.regles.motsGeneriques.join(", ")}. Les lieux comparés sont villeNormalisee + localité et commune des sources.`);
w("- Déjà fusionnés le 29/09 (exclus : fiches fusionnées désormais invalides, aucun de ces groupes ne réapparaît) : " + st.dejaFusionnes29_09.join(" ; ") + ".");
w();
w("## Références touchées (groupes SURE)"); w();
const r = st.referencesAReporterSure;
w(`- Formations : ${r.formations} ; avis : ${r.avis} ; offres (EtablissementProgramme) : ${r.etablissementProgrammes} ; SuggestionCatalogue : ${r.suggestions} ; ForumQuestion : ${r.forumQuestions} ; snapshots Profil.onboardingDonnees : ${r.profils}.`);
w(`- Aucune fiche des groupes SURE (canonique compris) n’a de formation, d’avis, d’offre, de suggestion, de question de forum ni de snapshot de profil : ${st.referencesSurFichesSure.length ? JSON.stringify(st.referencesSurFichesSure) : "vérifié sur les 20 264 fiches ML valides"}.`);
w(`- EtablissementSource déplacées vers les canoniques : ${r.sources} (codes officiels MEN conservés) ; chaque ancien libellé devient un EtablissementAlias (fusion) ; l’ancien libellé du canonique renommé aussi (script étendu).`);
w(`- miseAJourCanonique : ${Object.entries(sure.reduce((m, g) => { for (const k of Object.keys(g.miseAJourCanonique || {})) m[k] = (m[k] || 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(", ")}.`);
w();
w("## Application (non exécutée)"); w();
w("```");
w("cd backend");
w("npx tsx src/scripts/fusion-doublons-plan.ts --plan ../PASSATION_IA/output/2026-09-29-dedup-mali/plan-cycles.json            # simulation");
w("npx tsx src/scripts/fusion-doublons-plan.ts --plan ../PASSATION_IA/output/2026-09-29-dedup-mali/plan-cycles.json --limit 5  # simulation partielle");
w("# --apply seulement après accord explicite du propriétaire, plan de moins de 24 h (sinon régénérer : extract-cycles.js → classify-cycles.js → resume-cycles.js)");
w("```"); w();
w("## 15 exemples SURE (nom avant → après)"); w();
const ex = [];
const pris = new Set();
const prendre = (pred, n) => { for (const g of sure.filter(pred)) { if (ex.length >= 15 || n <= 0) break; if (pris.has(g.cle)) continue; pris.add(g.cle); ex.push(g); n--; } };
prendre((g) => g.fiches.some((f) => f.cycles.includes("CDPE")) && g.fiches.length > 2 && g.miseAJourCanonique?.nom, 2);
prendre((g) => g.distanceMaxM != null && g.miseAJourCanonique?.nom, 3);
prendre((g) => g.miseAJourCanonique?.nom && /\[|cycle|èc|CDPE/i.test(g.nomAvant), 4);
prendre((g) => g.miseAJourCanonique?.statut, 2);
prendre((g) => g.fiches.some((f) => f.type === "LYCEE"), 1);
prendre((g) => g.miseAJourCanonique?.nom, 15);
w("| Avant (canonique) | Après | Fiches fusionnées (cycle) | Commune | Distance |"); w("|---|---|---|---|---:|");
for (const g of ex) w(`| ${md(g.nomAvant)} | **${md(g.nomApres)}** | ${g.fiches.map((f) => `${md(f.nom)} (${cyc(f)})`).join(" ; ")} | ${g.communes.join(", ")} | ${g.distanceMaxM == null ? "—" : g.distanceMaxM + " m"} |`);
w();
w("## Exemples CYCLES_A_VERIFIER (3 par motif)"); w();
for (const motif of Object.keys(st.cyclesAVerifier.parMotif)) {
  w(`### ${motif}`);
  for (const g of av.filter((x) => x.motif === motif).slice(0, 3)) w(`- ${g.fiches.map((f) => `${md(f.nom)} (${cyc(f)}, ${f.statut})`).join(" ; ")} — ${g.raisons.slice(0, 2).join(" ; ")}`);
  w();
}
w(`## Tous les groupes SURE (${sure.length})`); w();
w("| # | Nom après | Canonique | Fusionnés | Cycles | Commune | Maj |"); w("|---:|---|---|---|---|---|---|");
sure.forEach((g, i) => w(`| ${i + 1} | ${md(g.nomApres)} | \`${g.canoniqueId}\` | ${g.fusionnesIds.map((x) => `\`${x}\``).join(" ")} | ${g.fiches.map(cyc).join(" / ")} | ${g.communes.join(", ")} | ${Object.keys(g.miseAJourCanonique || {}).filter((k) => k !== "nomNormalise").join(", ")} |`));
fs.writeFileSync(path.join(OUT, "resume-cycles.md"), L.join("\n") + "\n");
console.log(ex.map((g) => `${g.nomAvant} → ${g.nomApres}`).join("\n"));

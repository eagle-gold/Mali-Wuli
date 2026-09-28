const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../staging/frontend/src");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const checks = [
  ["components/offres/FormulaireOffre.tsx", /type="number"[\s\S]*DEVISES_SALAIRE[\s\S]*PERIODES_SALAIRE/, "salaire numérique, devise et période"],
  ["components/offres/FormulaireOffre.tsx", /<LocalisationSelects[\s\S]*paysId="offre-pays"/, "localisation structurée des offres"],
  ["components/evenements/FormulaireEvenement.tsx", /<LocalisationSelects[\s\S]*paysId="evenement-pays"/, "localisation structurée des événements"],
  ["components/forms/LocalisationSelects.tsx", /<select[\s\S]*Sélectionner un pays[\s\S]*<select[\s\S]*Sélectionner une ville/, "deux listes dépendantes"],
  ["app/api/locations/cities/route.ts", /all["\)]*\s*===\s*"1"|get\("all"\) === "1"/, "chargement contrôlé de toutes les villes"],
  ["components/offres/OffresEdition.module.css", /@media \(max-width: 560px\)[\s\S]*\.grid, \.details \{ grid-template-columns: minmax\(0, 1fr\)/, "alignement mobile offres"],
  ["components/evenements/FormulaireEvenement.module.css", /@media\(max-width:560px\)[^{]*\{[^}]*\.grid[^}]*grid-template-columns:minmax\(0,1fr\)/, "alignement mobile événements"],
];

let failures = 0;
for (const [file, pattern, label] of checks) {
  const ok = pattern.test(read(file));
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
}
process.exitCode = failures ? 1 : 0;

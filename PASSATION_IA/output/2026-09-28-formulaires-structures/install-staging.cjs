const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const cible = process.argv[2] || "/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration";
const source = path.join(__dirname, "staging");
const fichiers = {
  "frontend/src/components/offres/FormulaireOffre.tsx": "d3dbfc2cfb4b7f1cdfcfb709db68e10aa67f669fc6c0d9521e936d44f2b5d813",
  "frontend/src/components/offres/OffresEdition.module.css": "a124e3432842fa14b3622d556fb33bc40e5a67a62a50e470a2f60c7d27212d06",
  "frontend/src/components/evenements/FormulaireEvenement.tsx": "099261c88914e9d2c2ff85c489ff7096e4f7324b373e0b246649c8de95aefaa5",
  "frontend/src/components/evenements/FormulaireEvenement.module.css": "2290876410c86eac01b76209f9ac243646ae33e78d06cd292bf7ed99a3b047d8",
  "frontend/src/app/api/locations/cities/route.ts": "27c2afcc133ce25dc5aaf25249601e8c8d5111ef6bd6bb2b63333af42428737c",
  "frontend/src/lib/offres.ts": "e13c09a08f7fb488be0c09dc7664e4f9ee486afa3de97c0dca9f248d5110ddd8",
  "frontend/src/components/forms/LocalisationSelects.tsx": null,
};
const sha = (contenu) => crypto.createHash("sha256").update(contenu).digest("hex");

for (const [relatif, attendu] of Object.entries(fichiers)) {
  const destination = path.join(cible, relatif);
  if (attendu === null) {
    if (fs.existsSync(destination)) throw new Error(`${relatif} existe déjà : fusion manuelle requise.`);
    continue;
  }
  if (!fs.existsSync(destination)) throw new Error(`${relatif} est absent.`);
  const actuel = sha(fs.readFileSync(destination));
  if (actuel !== attendu) throw new Error(`${relatif} a changé (${actuel}) : fusion manuelle requise.`);
}

for (const relatif of Object.keys(fichiers)) {
  const origine = path.join(source, relatif);
  const destination = path.join(cible, relatif);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(origine, destination);
  console.log(`INSTALLÉ ${relatif}`);
}

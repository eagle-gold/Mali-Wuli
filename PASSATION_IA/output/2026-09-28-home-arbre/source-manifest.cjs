const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[2];
const result = {};
function visit(relative) {
  const p = path.join(root, relative);
  if (!fs.existsSync(p)) return;
  if (fs.lstatSync(p).isDirectory()) for (const name of fs.readdirSync(p).sort()) visit(path.join(relative, name));
  else if (fs.lstatSync(p).isFile()) result[relative] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}
for (const p of ['src','public','package.json','package-lock.json','next.config.js','tailwind.config.ts','postcss.config.js','tsconfig.json']) visit(p);
process.stdout.write(JSON.stringify(result));

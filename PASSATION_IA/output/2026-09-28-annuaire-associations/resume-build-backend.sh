set -eu
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_NODEJS=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/versions/20260928-annuaire-associations/nodejs
MW_UPLOADS=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/uploads
test -f "$MW_NODEJS/package.json"
test -d "$MW_UPLOADS"
test ! -e "$MW_NODEJS/uploads"
ln -s "$MW_UPLOADS" "$MW_NODEJS/uploads"
cd "$MW_NODEJS"
npm ci --include=dev
npm run build
mkdir -p tmp
node -e 'const fs=require("fs"); console.log(JSON.stringify({compiled:fs.existsSync("dist/services/association.service.js"),uploads:fs.realpathSync("uploads")}))'

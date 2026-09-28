set -eu
unset NODE_OPTIONS MW_QA_SOCKET
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_NODEJS="$MW_BACK/versions/20260928-priorite-membres-home/nodejs"
test ! -e "$MW_NODEJS"
mkdir -p "$MW_NODEJS"
tar -xzf "$MW_BACK/priorite-membres-backend-source.tar.gz" -C "$MW_NODEJS"
install -m 600 "$MW_BACK/current/nodejs/.env" "$MW_NODEJS/.env"
MW_UPLOADS=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/uploads
test -d "$MW_UPLOADS"
ln -s "$MW_UPLOADS" "$MW_NODEJS/uploads"
cd "$MW_NODEJS"
npm ci --include=dev
npm run build
mkdir -p tmp
node -e 'const fs=require("fs"),assert=require("assert/strict"); for(const p of ["dist/services/priorite-membres.service.js","dist/services/association.service.js","dist/routes/education.routes.js"]) assert(fs.existsSync(p),p); console.log(JSON.stringify({compiled:true,uploads:fs.realpathSync("uploads")}))'

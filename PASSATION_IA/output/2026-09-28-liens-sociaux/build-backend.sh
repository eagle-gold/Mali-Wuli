set -eu
umask 077
unset NODE_OPTIONS MW_QA_SOCKET
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_NODEJS="$MW_BACK/versions/20260928-liens-sociaux/nodejs"
MW_SCRIPTS=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node "$MW_SCRIPTS/verify-package-readonly.cjs" backend "$MW_BACK/liens-sociaux-backend-source.tar.gz"
test ! -e "$MW_NODEJS"
mkdir -p "$MW_NODEJS"
tar -xzf "$MW_BACK/liens-sociaux-backend-source.tar.gz" -C "$MW_NODEJS"
install -m 600 "$MW_BACK/current/nodejs/.env" "$MW_NODEJS/.env"
MW_UPLOADS=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/uploads
test -d "$MW_UPLOADS"
ln -s "$MW_UPLOADS" "$MW_NODEJS/uploads"
cd "$MW_NODEJS"
npm ci --include=dev
npm run build
mkdir -p tmp
node -e 'const fs=require("fs"),assert=require("assert/strict"); for(const p of ["dist/lib/liens-sociaux.js","dist/routes/user.routes.js","dist/routes/onboarding.routes.js"]) assert(fs.existsSync(p),p); console.log(JSON.stringify({compiled:true,uploads:fs.realpathSync("uploads")}))'

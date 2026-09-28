set -eu
unset NODE_OPTIONS MW_QA_SOCKET
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_NODEJS="$MW_BACK/versions/20260928-roles-actions/nodejs"
test ! -e "$MW_NODEJS"
mkdir -p "$MW_NODEJS"
tar -xzf "$MW_BACK/roles-actions-backend-source.tar.gz" -C "$MW_NODEJS"
install -m 600 "$MW_BACK/current/nodejs/.env" "$MW_NODEJS/.env"
MW_UPLOADS=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/uploads
test -d "$MW_UPLOADS"
ln -s "$MW_UPLOADS" "$MW_NODEJS/uploads"
cd "$MW_NODEJS"
npm ci --include=dev
npm run build
mkdir -p tmp
node -e 'const fs=require("fs"); console.log(JSON.stringify({compiled:fs.existsSync("dist/services/admin-membres.service.js"),uploads:fs.realpathSync("uploads")}))'

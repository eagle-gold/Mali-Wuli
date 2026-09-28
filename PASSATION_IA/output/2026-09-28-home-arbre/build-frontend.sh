set -eu
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_RELEASE=20260928-home-arbre
MW_SOURCE="$MW_FRONT/sources/$MW_RELEASE"
MW_NODEJS="$MW_FRONT/versions/$MW_RELEASE/nodejs"
test "$(readlink "$MW_FRONT/current")" = versions/20260921-brevet-def-label
test ! -e "$MW_SOURCE"
test ! -e "$MW_FRONT/versions/$MW_RELEASE"
mkdir -p "$MW_SOURCE"
tar -xzf "$MW_FRONT/home-arbre-20260928-source.tar.gz" -C "$MW_SOURCE"
test ! -f "$MW_SOURCE/.env.local"
cmp "$MW_SOURCE/package-lock.json" "$MW_FRONT/sources/20260921-profile-schools/package-lock.json"
# Même lockfile, dépendances Linux déjà compilées : copie indépendante.
cp -a "$MW_FRONT/sources/20260921-profile-schools/node_modules" "$MW_SOURCE/node_modules"
cd "$MW_SOURCE"
npm run type-check
NEXT_PUBLIC_API_URL=https://floralwhite-ram-987223.hostingersite.com/api \
NEXT_PUBLIC_SOCKET_URL=https://floralwhite-ram-987223.hostingersite.com \
ALLOW_LOCAL_PRODUCTION_BUILD=false npm run build
mkdir -p "$MW_NODEJS"
cp -a .next/standalone/. "$MW_NODEJS/"
mkdir -p "$MW_NODEJS/.next" "$MW_NODEJS/tmp"
cp -a .next/static "$MW_NODEJS/.next/static"
cp -a public "$MW_NODEJS/public"
if test -f "$MW_FRONT/current/nodejs/.env"; then install -m 600 "$MW_FRONT/current/nodejs/.env" "$MW_NODEJS/.env"; fi
cat "$MW_NODEJS/.next/BUILD_ID"
node "$MW_FRONT/verify-login-fix.cjs" "$MW_NODEJS"

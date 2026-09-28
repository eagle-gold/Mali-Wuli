set -eu
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_RELEASE=20260928-offres-emploi
MW_SOURCE="$MW_FRONT/sources/$MW_RELEASE"
MW_VERSION="$MW_FRONT/versions/$MW_RELEASE"
test ! -e "$MW_SOURCE"
test ! -e "$MW_VERSION"
mkdir -p "$MW_SOURCE"
tar -xzf "$MW_FRONT/offres-frontend-source.tar.gz" -C "$MW_SOURCE"
cd "$MW_SOURCE"
test ! -f .env.local
npm ci --include=dev
ALLOW_LOCAL_PRODUCTION_BUILD=false NEXT_PUBLIC_API_URL=https://floralwhite-ram-987223.hostingersite.com/api NEXT_PUBLIC_SOCKET_URL=https://floralwhite-ram-987223.hostingersite.com npm run build
mkdir -p "$MW_VERSION/nodejs"
cp -a .next/standalone/. "$MW_VERSION/nodejs/"
mkdir -p "$MW_VERSION/nodejs/.next"
cp -a .next/static "$MW_VERSION/nodejs/.next/static"
cp -a public "$MW_VERSION/nodejs/public"
mkdir -p "$MW_VERSION/nodejs/tmp"
if test -f "$MW_FRONT/current/nodejs/.env"; then install -m 600 "$MW_FRONT/current/nodejs/.env" "$MW_VERSION/nodejs/.env"; fi
cat "$MW_VERSION/nodejs/.next/BUILD_ID"

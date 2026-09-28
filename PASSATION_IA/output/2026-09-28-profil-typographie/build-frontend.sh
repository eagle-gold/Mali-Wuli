#!/bin/sh
set -eu
umask 077
unset NODE_OPTIONS MW_QA_SOCKET
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"

MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_RELEASE=20260928-profil-typographie
MW_SOURCE="$MW_FRONT/sources/$MW_RELEASE"
MW_VERSION="$MW_FRONT/versions/$MW_RELEASE"
MW_ARCHIVE="$MW_FRONT/profil-typographie-frontend-source.tar.gz"
MW_SCRIPTS=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# The verifier also proves that backend current remains the published
# social-links release and that no database/migration action belongs to this lot.
node "$MW_SCRIPTS/verify-source-manifest.cjs" package "$MW_ARCHIVE"
node "$MW_SCRIPTS/verify-source-manifest.cjs" before
test ! -e "$MW_SOURCE"
test ! -e "$MW_VERSION"
mkdir -p "$MW_SOURCE"
tar -xzf "$MW_ARCHIVE" -C "$MW_SOURCE"
node "$MW_SCRIPTS/verify-source-manifest.cjs" extracted

cd "$MW_SOURCE"
test ! -f .env.local
test -f package-lock.json
npm ci --include=dev
ALLOW_LOCAL_PRODUCTION_BUILD=false \
NEXT_PUBLIC_API_URL=https://floralwhite-ram-987223.hostingersite.com/api \
NEXT_PUBLIC_SOCKET_URL=https://floralwhite-ram-987223.hostingersite.com \
npm run build

test -f .next/standalone/server.js
test -f .next/BUILD_ID
mkdir -p "$MW_VERSION/nodejs"
cp -a .next/standalone/. "$MW_VERSION/nodejs/"
mkdir -p "$MW_VERSION/nodejs/.next"
cp -a .next/static "$MW_VERSION/nodejs/.next/static"
cp -a public "$MW_VERSION/nodejs/public"
mkdir -p "$MW_VERSION/nodejs/tmp"
if test -f "$MW_FRONT/current/nodejs/.env"; then
  install -m 600 "$MW_FRONT/current/nodejs/.env" "$MW_VERSION/nodejs/.env"
fi

node "$MW_SCRIPTS/verify-source-manifest.cjs" candidate
cat "$MW_VERSION/nodejs/.next/BUILD_ID"

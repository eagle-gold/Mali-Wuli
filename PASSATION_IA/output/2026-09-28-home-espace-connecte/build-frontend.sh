#!/bin/sh
# PREPARED ONLY. Builds a candidate; never switches current or restarts backend.
set -eu
unset NODE_OPTIONS MW_QA_SOCKET NEXT_FONT_GOOGLE_MOCKED_RESPONSES
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_QA=/tmp/mw-home-session-r2-qa
MW_RELEASE=20260928-home-session-r2
MW_EXPECTED=versions/20260928-suppressions-droits
MW_SOURCE="$MW_FRONT/sources/$MW_RELEASE"
MW_VERSION="$MW_FRONT/versions/$MW_RELEASE"
test "$(readlink "$MW_FRONT/current")" = "$MW_EXPECTED"
test "$(readlink "$MW_BACK/current")" = "$MW_EXPECTED"
node "$MW_QA/verify-sources-readonly.cjs" before
test ! -e "$MW_VERSION"
test ! -L "$MW_VERSION"
if test "$#" -eq 0; then
  test ! -e "$MW_SOURCE"
  test ! -L "$MW_SOURCE"
  MW_ARCHIVE_SHA=$(node -e 'process.stdout.write(require(process.argv[1]).frontendArchiveSha256)' "$MW_QA/release-contract.json")
  printf '%s  %s\n' "$MW_ARCHIVE_SHA" "$MW_FRONT/home-session-r2-frontend-source.tar.gz" | sha256sum -c -
  mkdir -p "$MW_SOURCE"
  tar -xzf "$MW_FRONT/home-session-r2-frontend-source.tar.gz" -C "$MW_SOURCE"
else
  test "$#" -eq 1 && test "$1" = --resume
  test -d "$MW_SOURCE"
  test ! -L "$MW_SOURCE"
fi
node "$MW_QA/verify-sources-readonly.cjs" candidate
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
node "$MW_QA/verify-sources-readonly.cjs" candidate-built

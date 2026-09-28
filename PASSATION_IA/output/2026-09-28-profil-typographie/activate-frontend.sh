#!/bin/sh
set -eu
umask 077
unset NODE_OPTIONS MW_QA_SOCKET
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"

MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_RELEASE=20260928-profil-typographie
MW_PREVIOUS=20260928-liens-sociaux
MW_EXPECTED="versions/$MW_PREVIOUS"
MW_VERSION="$MW_FRONT/versions/$MW_RELEASE"
MW_SCRIPTS=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

test -f "$MW_VERSION/nodejs/server.js"
test -f "$MW_VERSION/nodejs/.next/BUILD_ID"
test "$(readlink "$MW_FRONT/current")" = "$MW_EXPECTED"
test "$(readlink "$MW_BACK/current")" = "versions/$MW_PREVIOUS"
test "$(cat "$MW_FRONT/current/nodejs/.next/BUILD_ID")" = "MF940TX4N8sLGFRsT_gyN"
node "$MW_SCRIPTS/verify-source-manifest.cjs" activation

printf '%s\n' "$MW_EXPECTED" > "$MW_VERSION/.previous-target"
MW_LINK="$MW_FRONT/.current-$MW_RELEASE-$$"
test ! -e "$MW_LINK"
test ! -L "$MW_LINK"
ln -s "versions/$MW_RELEASE" "$MW_LINK"

# Recheck both applications immediately before the atomic frontend switch.
if test "$(readlink "$MW_FRONT/current")" != "$MW_EXPECTED"; then
  unlink "$MW_LINK"
  exit 1
fi
if test "$(readlink "$MW_BACK/current")" != "versions/$MW_PREVIOUS"; then
  unlink "$MW_LINK"
  exit 1
fi
mv -Tf "$MW_LINK" "$MW_FRONT/current"
touch "$MW_FRONT/current/nodejs/tmp/restart.txt"

node "$MW_SCRIPTS/verify-source-manifest.cjs" after
readlink "$MW_FRONT/current"
readlink "$MW_BACK/current"
cat "$MW_FRONT/current/nodejs/.next/BUILD_ID"

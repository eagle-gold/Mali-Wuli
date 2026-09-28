#!/bin/sh
# PREPARED ONLY. Run only after candidate tests and explicit root approval.
# Frontend current only; backend current is a read-only guard.
set -eu
unset NODE_OPTIONS MW_QA_SOCKET
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_QA=/tmp/mw-home-session-r2-qa
MW_RELEASE=20260928-home-session-r2
MW_EXPECTED=versions/20260928-suppressions-droits
node "$MW_QA/verify-sources-readonly.cjs" candidate-built
test "$(readlink "$MW_FRONT/current")" = "$MW_EXPECTED"
test "$(readlink "$MW_BACK/current")" = "$MW_EXPECTED"
test -f "$MW_FRONT/versions/$MW_RELEASE/nodejs/server.js"
test ! -e "$MW_FRONT/versions/$MW_RELEASE/.previous-target"
umask 077
printf '%s\n' "$MW_EXPECTED" > "$MW_FRONT/versions/$MW_RELEASE/.previous-target"
MW_LINK="$MW_FRONT/.current-$MW_RELEASE-$$"
test ! -e "$MW_LINK" && test ! -L "$MW_LINK"
ln -s "versions/$MW_RELEASE" "$MW_LINK"
if test "$(readlink "$MW_FRONT/current")" != "$MW_EXPECTED" || test "$(readlink "$MW_BACK/current")" != "$MW_EXPECTED"; then unlink "$MW_LINK"; exit 1; fi
mv -Tf "$MW_LINK" "$MW_FRONT/current"
touch "$MW_FRONT/current/nodejs/tmp/restart.txt"
node "$MW_QA/verify-sources-readonly.cjs" after

#!/bin/sh
# ROOT ONLY, explicitly authorized release operation. Never invoked by read-only QA.
set -eu
umask 077
unset NODE_OPTIONS MW_QA_SOCKET
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_SCRIPTS=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MW_BEFORE=${1:-"$MW_SCRIPTS/database-before.json"}
MW_CANDIDATE=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/versions/20260928-liens-sociaux/nodejs
test -f "$MW_BEFORE"
node "$MW_SCRIPTS/guard-migration.cjs" --backend "$MW_CANDIDATE" --before "$MW_BEFORE" > "$MW_SCRIPTS/migration-guard.json"
cd "$MW_CANDIDATE"
node node_modules/prisma/build/index.js migrate deploy > "$MW_SCRIPTS/migration.log" 2>&1
node "$MW_SCRIPTS/check-database-readonly.cjs" --backend "$MW_CANDIDATE" --phase candidate --before "$MW_BEFORE" > "$MW_SCRIPTS/database-candidate.json"

#!/bin/sh
# Authorized migration step only. Do not run as a generic QA/read-only check.
set -eu
unset NODE_OPTIONS MW_QA_SOCKET
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MW_BEFORE=${1:-"$MW_SCRIPT_DIR/database-before.json"}
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_CANDIDATE="$MW_BACK/versions/20260928-roles-actions/nodejs"
test -f "$MW_BEFORE"
test -f "$MW_CANDIDATE/dist/services/admin-membres.service.js"
node "$MW_SCRIPT_DIR/guard-migration.cjs" --backend "$MW_CANDIDATE" --before "$MW_BEFORE" > "$MW_SCRIPT_DIR/migration-guard.json"
cd "$MW_CANDIDATE"
node node_modules/prisma/build/index.js migrate deploy > "$MW_SCRIPT_DIR/migration.log" 2>&1
node "$MW_SCRIPT_DIR/check-database-readonly.cjs" --backend "$MW_CANDIDATE" --before "$MW_BEFORE" > "$MW_SCRIPT_DIR/database-after.json"

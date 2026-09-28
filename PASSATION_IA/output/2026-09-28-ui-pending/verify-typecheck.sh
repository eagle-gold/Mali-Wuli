#!/bin/sh
set -eu

ACTIVE="/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend"
STAGING="/Users/ibrahimakonate/Documents/ChatGPT/Mali Wuli/output/2026-09-28-ui-pending/staging/frontend"
TMP_ROOT="$(mktemp -d /tmp/mali-wuli-ui-pending.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT INT TERM

mkdir -p "$TMP_ROOT/frontend"
rsync -a --exclude node_modules --exclude .next --exclude tsconfig.tsbuildinfo "$ACTIVE/" "$TMP_ROOT/frontend/"
rsync -a "$STAGING/" "$TMP_ROOT/frontend/"
ln -s "$ACTIVE/node_modules" "$TMP_ROOT/frontend/node_modules"

cd "$TMP_ROOT/frontend"
"$ACTIVE/node_modules/.bin/tsc" --noEmit --incremental false

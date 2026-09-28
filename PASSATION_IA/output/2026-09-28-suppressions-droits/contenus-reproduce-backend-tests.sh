#!/usr/bin/env bash
set -euo pipefail
# Depuis une copie intégrée du backend avec roles.ts PUBLICATIONS_MODERER.
preuve_dir="${1:?Dossier de preuves requis}"
verification_uploads="$(mktemp -d /tmp/mali-wuli-suppressions-tests.XXXXXX)"
node node_modules/typescript/bin/tsc --noEmit
UPLOAD_DIR="$verification_uploads" MAIL_DISABLED=true node --require "$preuve_dir/tests-backend-guard.cjs" --import tsx --test --test-reporter=tap src/routes/publication-suppression.test.ts src/routes/association.routes.test.ts src/routes/offre.routes.test.ts src/routes/evenement.routes.test.ts > "$preuve_dir/tests-backend.tap"

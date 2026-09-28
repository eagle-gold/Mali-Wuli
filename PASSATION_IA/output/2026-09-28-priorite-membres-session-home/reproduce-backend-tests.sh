#!/usr/bin/env bash
set -euo pipefail
# Depuis une copie du backend intégrant les cinq fichiers du lot.
# Le premier argument est le chemin absolu du dossier contenant la garde.
preuve_dir="${1:?Chemin du dossier de preuves requis}"
verification_uploads="$(mktemp -d /tmp/mali-wuli-test-uploads.XXXXXX)"
node node_modules/typescript/bin/tsc --noEmit
UPLOAD_DIR="$verification_uploads" MAIL_DISABLED=true node --require "$preuve_dir/tests-backend-guard.cjs" --import tsx --test --test-reporter=tap src/services/priorite-membres.service.test.ts src/routes/association.routes.test.ts > "$preuve_dir/tests-backend.tap"

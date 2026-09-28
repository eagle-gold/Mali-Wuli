#!/bin/sh
# Run from an integrated backend or an isolated copy; handlers use simulated Prisma.
set -eu
preuve_dir="${1:?Absolute proof directory required}"
case "$preuve_dir" in /*) ;; *) exit 1 ;; esac
test -f "$preuve_dir/tests-social-guard.cjs"
verification_uploads="$(mktemp -d /tmp/mali-wuli-social-tests.XXXXXX)"
UPLOAD_DIR="$verification_uploads" MAIL_DISABLED=true node --require "$preuve_dir/tests-social-guard.cjs" --import tsx --test --test-reporter=tap src/routes/profile-social-links.test.ts src/routes/user-directory.test.ts > "$preuve_dir/tests-backend-social.tap"

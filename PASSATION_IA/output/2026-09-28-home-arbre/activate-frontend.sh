set -eu
MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_RELEASE=20260928-home-arbre
MW_EXPECTED_CURRENT=versions/20260921-brevet-def-label
MW_NODEJS="$MW_FRONT/versions/$MW_RELEASE/nodejs"
test -f "$MW_NODEJS/server.js"
test -f "$MW_NODEJS/.next/BUILD_ID"
test "$(readlink "$MW_FRONT/current")" = "$MW_EXPECTED_CURRENT"
umask 077
printf '%s\n' "$MW_EXPECTED_CURRENT" > "$MW_FRONT/versions/$MW_RELEASE/.previous-target"
MW_NEW_LINK="$MW_FRONT/.current-$MW_RELEASE-$$"
test ! -e "$MW_NEW_LINK"
test ! -L "$MW_NEW_LINK"
ln -s "versions/$MW_RELEASE" "$MW_NEW_LINK"
if test "$(readlink "$MW_FRONT/current")" != "$MW_EXPECTED_CURRENT"; then
  unlink "$MW_NEW_LINK"
  exit 1
fi
mv -Tf "$MW_NEW_LINK" "$MW_FRONT/current"
touch "$MW_FRONT/current/nodejs/tmp/restart.txt"
readlink "$MW_FRONT/current"
cat "$MW_FRONT/current/nodejs/.next/BUILD_ID"
readlink /home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/current

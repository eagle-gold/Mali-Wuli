set -eu
MW_ROOT=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_RELEASE=20260928-roles-actions
MW_EXPECTED=versions/20260928-fond-mobile-roles
test -f "$MW_ROOT/versions/$MW_RELEASE/nodejs/dist/index.js"
test "$(readlink "$MW_ROOT/current")" = "$MW_EXPECTED"
umask 077
printf '%s\n' "$MW_EXPECTED" > "$MW_ROOT/versions/$MW_RELEASE/.previous-target"
MW_LINK="$MW_ROOT/.current-$MW_RELEASE-$$"
test ! -e "$MW_LINK"
test ! -L "$MW_LINK"
ln -s "versions/$MW_RELEASE" "$MW_LINK"
if test "$(readlink "$MW_ROOT/current")" != "$MW_EXPECTED"; then unlink "$MW_LINK"; exit 1; fi
mv -Tf "$MW_LINK" "$MW_ROOT/current"
touch "$MW_ROOT/current/nodejs/tmp/restart.txt"
readlink "$MW_ROOT/current"

#!/bin/sh
set -eu
ssh -o BatchMode=yes -o ControlPath=/tmp/mali-wuli-profile-schools-ssh-%C -p 65002 u668963025@147.93.51.85 'cd domains/floralwhite-ram-987223.hostingersite.com/hbuilds/current/nodejs && /opt/alt/alt-nodejs22/root/usr/bin/node -r dotenv/config' <<'NODE'
const { prisma } = require('./dist/lib/prisma');
async function main() {
  const id = 'qa-ui-selects';
  const email = 'qa-ui-selects-20260921@example.invalid';
  const fixture = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, profil: { select: { id: true, bio: true } } } });
  if (!fixture) { console.log(JSON.stringify({ id, alreadyAbsent: true })); return; }
  if (fixture.email !== email || fixture.profil?.id !== 'qa-ui-selects-profile' || fixture.profil?.bio !== 'Fixture temporaire QA menus 2026-09-21') {
    throw new Error('Fixture identity mismatch; no deletion performed.');
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.loginOtpCode.deleteMany({ where: { email } });
    await tx.passwordResetCode.deleteMany({ where: { email } });
    await tx.emailVerification.deleteMany({ where: { email } });
    // Profil and Formation are deleted by the existing cascading foreign keys.
    return tx.user.deleteMany({ where: { id, email } });
  });
  console.log(JSON.stringify({ id, deleted: result.count }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
NODE

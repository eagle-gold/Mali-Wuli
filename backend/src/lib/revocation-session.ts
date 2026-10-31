import { prisma } from "./prisma";

/** Révoque une session jusqu'à son expiration naturelle, puis purge les entrées périmées. */
export async function revoquerSession(jti: string, userId: string, expireLe: Date) {
  await prisma.jetonRevoque.upsert({
    where: { jti },
    create: { jti, userId, expireLe },
    update: {},
  });
  await prisma.jetonRevoque.deleteMany({ where: { expireLe: { lt: new Date() } } });
}

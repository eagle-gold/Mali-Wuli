import { PrismaClient } from "@prisma/client";

const globalPrisma = globalThis as unknown as { prismaMaliWuli?: PrismaClient };

/**
 * Une seule connexion Prisma pour tout le processus HTTP. Cela évite d'ouvrir
 * un pool par fichier de routes, notamment pendant le rechargement en dev.
 */
export const prisma = globalPrisma.prismaMaliWuli ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalPrisma.prismaMaliWuli = prisma;
}

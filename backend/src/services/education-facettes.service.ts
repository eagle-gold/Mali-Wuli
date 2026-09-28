import { Prisma, type PrismaClient, TypeEtablissement } from "@prisma/client";

type NiveauEtablissement = TypeEtablissement | "INSTITUT" | "GRANDE_ECOLE";
type OptionsFacettes = { niveau?: NiveauEtablissement; pays?: string };
type BaseFacettes = Pick<PrismaClient, "paysEducation" | "$queryRaw">;

export function filtreNiveauEtablissements(niveau?: NiveauEtablissement): Prisma.EtablissementWhereInput {
  if (!niveau) return {};
  if (niveau === "INSTITUT") return { type: TypeEtablissement.ECOLE_SUPERIEURE, nom: { contains: "institut" } };
  if (niveau === "GRANDE_ECOLE") return { type: TypeEtablissement.ECOLE_SUPERIEURE, NOT: { nom: { contains: "institut" } } };
  return { type: niveau };
}

function conditionNiveau(niveau?: NiveauEtablissement) {
  if (!niveau) return Prisma.empty;
  if (niveau === "INSTITUT") return Prisma.sql`AND type = ${TypeEtablissement.ECOLE_SUPERIEURE} AND nom LIKE ${"%institut%"}`;
  if (niveau === "GRANDE_ECOLE") return Prisma.sql`AND type = ${TypeEtablissement.ECOLE_SUPERIEURE} AND NOT (nom LIKE ${"%institut%"})`;
  return Prisma.sql`AND type = ${niveau}`;
}

/** Agrégation en base ; Prisma distinct chargeait tous les établissements en mémoire. */
export async function lireFacettesEtablissements(db: BaseFacettes, { niveau, pays }: OptionsFacettes = {}) {
  const [paysDisponibles, villesDisponibles] = await Promise.all([
    db.paysEducation.findMany({
      where: { etablissements: { some: { valide: true, ...filtreNiveauEtablissements(niveau) } } },
      select: { code: true, nom: true },
      orderBy: { code: "asc" },
    }),
    // Une ville n'est proposée qu'après le choix du pays : cela évite de
    // transférer plus de 32 000 options au premier affichage du catalogue.
    // ROW_NUMBER reproduit le premier libellé trié de l'ancienne lecture
    // Prisma, tout en dédupliquant directement en base.
    pays
      ? db.$queryRaw<{ ville: string }[]>(Prisma.sql`
          SELECT ville
          FROM (
            SELECT ville,
              ROW_NUMBER() OVER (
                PARTITION BY BINARY villeNormalisee
                ORDER BY ville ASC, id ASC
              ) AS rang
            FROM Etablissement
            WHERE valide = true AND ville IS NOT NULL
              ${conditionNiveau(niveau)}
              AND paysCode = ${pays}
          ) AS villes_classees
          WHERE rang = 1
          ORDER BY ville ASC
        `)
      : Promise.resolve([]),
  ]);
  return {
    pays: paysDisponibles.sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" })),
    villes: villesDisponibles.map(({ ville }) => ville).filter(Boolean),
  };
}

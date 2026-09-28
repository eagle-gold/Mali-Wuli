import type { Prisma, PrismaClient } from "@prisma/client";

export const PROFIL_MEMBRE_ELIGIBLE = {
  onboardingFini: true, user: { statut: "VALIDE" as const },
};
type Pagination = { page: number; limite: number };
type SelectionPage = { ids?: string[]; exclureIds?: string[]; skip?: number; take?: number };

/**
 * Le classement porte sur toutes les structures ayant des membres éligibles,
 * sans borner la recherche à la première page alphabétique. Les structures sans
 * membre restent paginées en base : pas de chargement intégral du catalogue.
 * L'ordre alphabétique des ex aequo est celui de la base (collation comprise).
 */
export async function paginerParMembresEligibles<T extends { id: string }>(
  compteurs: ReadonlyMap<string, number>,
  { page, limite }: Pagination,
  classerAlphabetiquement: (ids: string[]) => Promise<Array<{ id: string }>>,
  charger: (selection: SelectionPage) => Promise<T[]>,
): Promise<T[]> {
  const idsAvecMembres = [...compteurs.keys()];
  const ordre = idsAvecMembres.length ? await classerAlphabetiquement(idsAvecMembres) : [];
  // Array.sort est stable : les égalités gardent l'ordre nom/id de la requête.
  ordre.sort((a, b) => compteurs.get(b.id)! - compteurs.get(a.id)!);
  const debut = (page - 1) * limite;
  const idsPage = ordre.slice(debut, debut + limite).map(({ id }) => id);
  const placesRestantes = limite - idsPage.length;
  const [avecMembres, sansMembres] = await Promise.all([
    idsPage.length ? charger({ ids: idsPage }) : Promise.resolve([] as T[]),
    placesRestantes > 0 ? charger({
      exclureIds: idsAvecMembres, skip: Math.max(0, debut - ordre.length), take: placesRestantes,
    }) : Promise.resolve([] as T[]),
  ]);
  const parId = new Map(avecMembres.map((structure) => [structure.id, structure]));
  return [...idsPage.flatMap((id) => parId.has(id) ? [parId.get(id)!] : []), ...sansMembres];
}

const ETABLISSEMENT_LISTE = {
  id: true, nom: true, sigle: true, type: true, ville: true, statut: true,
  description: true, paysCode: true, pays: { select: { nom: true } },
  niveaux: { select: { niveau: true } },
} as const;

export async function listerPageEtablissementsParMembres(
  db: PrismaClient, where: Prisma.EtablissementWhereInput, pagination: Pagination,
) {
  // Une personne peut avoir plusieurs formations dans le même établissement.
  // Grouper la paire évite qu'elle pèse plusieurs fois dans le classement.
  const affiliations = await db.formation.groupBy({
    by: ["etablissementId", "profilId"],
    where: { etablissement: where, profil: PROFIL_MEMBRE_ELIGIBLE },
  });
  const compteurs = new Map<string, number>();
  for (const { etablissementId } of affiliations) {
    if (etablissementId) compteurs.set(etablissementId, (compteurs.get(etablissementId) || 0) + 1);
  }
  return paginerParMembresEligibles(compteurs, pagination,
    (ids) => db.etablissement.findMany({
      where: { AND: [where, { id: { in: ids } }] }, select: { id: true },
      orderBy: [{ nom: "asc" }, { id: "asc" }],
    }),
    ({ ids, exclureIds, skip, take }) => db.etablissement.findMany({
      where: { AND: [where, ...(ids ? [{ id: { in: ids } }] : []),
        ...(exclureIds?.length ? [{ id: { notIn: exclureIds } }] : [])] },
      select: ETABLISSEMENT_LISTE, orderBy: [{ nom: "asc" }, { id: "asc" }], skip, take,
    }),
  );
}

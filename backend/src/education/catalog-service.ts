import {
  NiveauEducation,
  Prisma,
  PrismaClient,
  StatutEtablissement,
  TypeEtablissement,
} from "@prisma/client";

export type TypeRechercheEtablissement = "ecole" | "lycee" | "universite";

export const prismaEducation = new PrismaClient();

export const normaliserEducation = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const filtreType = (type: TypeRechercheEtablissement): Prisma.EtablissementWhereInput => {
  if (type === "universite") {
    return {
      OR: [
        { type: { in: [TypeEtablissement.UNIVERSITE, TypeEtablissement.ECOLE_SUPERIEURE] } },
        { niveaux: { some: { niveau: NiveauEducation.SUPERIEUR } } },
      ],
    };
  }
  if (type === "lycee") {
    return {
      OR: [
        { type: TypeEtablissement.LYCEE },
        { niveaux: { some: { niveau: NiveauEducation.SECONDAIRE } } },
      ],
    };
  }
  return {
    OR: [
      { type: TypeEtablissement.FONDAMENTALE },
      {
        niveaux: {
          some: {
            niveau: {
              in: [NiveauEducation.PRESCOLAIRE, NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL],
            },
          },
        },
      },
    ],
  };
};

const statutPublic = (statut: StatutEtablissement) =>
  statut === StatutEtablissement.PUBLIC
    ? "Public"
    : statut === StatutEtablissement.PRIVE
      ? "Privé"
      : undefined;

export async function chercherEtablissements(params: {
  paysCode: string;
  type: TypeRechercheEtablissement;
  ville?: string;
  recherche?: string;
  limite?: number;
}) {
  const recherche = normaliserEducation(params.recherche || "");
  const termesRecherche = recherche.split(" ").filter(Boolean);
  const ville = normaliserEducation(params.ville || "");
  const etablissements = await prismaEducation.etablissement.findMany({
    where: {
      paysCode: params.paysCode,
      valide: true,
      AND: [
        filtreType(params.type),
        ...(ville ? [{ villeNormalisee: { contains: ville } }] : []),
        ...termesRecherche.map((terme) => ({
          OR: [
            { nomNormalise: { contains: terme } },
            { alias: { some: { nomNormalise: { contains: terme } } } },
          ],
        })),
      ],
    },
    include: {
      sources: { include: { source: true }, orderBy: { confiance: "desc" }, take: 3 },
      niveaux: true,
    },
    orderBy: [{ ville: "asc" }, { nom: "asc" }],
    take: Math.min(Math.max(params.limite || 100, 1), 200),
  });

  return etablissements.map((etablissement) => ({
    id: etablissement.id,
    nom: etablissement.nom,
    paysCode: etablissement.paysCode,
    ville: etablissement.ville || undefined,
    type: params.type,
    statut: statutPublic(etablissement.statut),
    source: etablissement.sources[0]?.source.code || "mali-wuli",
    systemeEducatifCode: etablissement.systemeEducatifCode,
    niveaux: etablissement.niveaux.map(({ niveau }) => niveau),
    provenance: etablissement.sources.map(({ source, urlSource, confiance }) => ({
      nom: source.nom,
      url: urlSource || source.url,
      confiance,
    })),
  }));
}

type WikidataEntite = {
  id: string;
  labels?: Record<string, { value?: string }>;
  aliases?: Record<string, Array<{ value?: string }>>;
  descriptions?: Record<string, { value?: string }>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
};

const valeurClaim = (entite: WikidataEntite | undefined, propriete: string) =>
  entite?.claims?.[propriete]?.[0]?.mainsnak?.datavalue?.value;

const idClaim = (entite: WikidataEntite | undefined, propriete: string) => {
  const valeur = valeurClaim(entite, propriete);
  return typeof valeur === "object" && valeur && "id" in valeur ? String(valeur.id) : undefined;
};

const texteClaim = (entite: WikidataEntite | undefined, propriete: string) => {
  const valeur = valeurClaim(entite, propriete);
  return typeof valeur === "string" ? valeur : undefined;
};

const libelleEntite = (entite?: WikidataEntite) =>
  entite?.labels?.fr?.value || entite?.labels?.en?.value;

async function wikidataApi<T>(parametres: Record<string, string>) {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
    ...parametres,
    format: "json",
    origin: "*",
  })}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "MaliWuli/0.1 education catalogue" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Wikidata ${response.status}`);
  return response.json() as Promise<T>;
}

async function chargerEntitesWikidata(ids: string[]) {
  const entites: Record<string, WikidataEntite> = {};
  for (let index = 0; index < ids.length; index += 50) {
    const lot = ids.slice(index, index + 50);
    const resultat = await wikidataApi<{ entities?: Record<string, WikidataEntite> }>({
      action: "wbgetentities",
      ids: lot.join("|"),
      props: "labels|aliases|descriptions|claims",
      languages: "fr|en",
    });
    Object.assign(entites, resultat.entities || {});
  }
  return entites;
}

const compatibleAvecType = (nom: string, type: TypeRechercheEtablissement) => {
  const valeur = normaliserEducation(nom);
  const superieur = /universit|university|polytech|facult|institut superieur|higher education/.test(valeur);
  const secondaire = /lycee|secondary|high school|senior school|college secondaire|gymnasium/.test(valeur);
  if (type === "universite") return superieur || !secondaire;
  if (type === "lycee") return secondaire && !superieur;
  return !secondaire && !superieur;
};

const typePrisma = (type: TypeRechercheEtablissement) => {
  if (type === "universite") return TypeEtablissement.UNIVERSITE;
  if (type === "lycee") return TypeEtablissement.LYCEE;
  return TypeEtablissement.FONDAMENTALE;
};

const niveauPrisma = (type: TypeRechercheEtablissement) => {
  if (type === "universite") return NiveauEducation.SUPERIEUR;
  if (type === "lycee") return NiveauEducation.SECONDAIRE;
  return NiveauEducation.FONDAMENTAL;
};

/**
 * Enrichit le catalogue sur une recherche explicite. Wikidata est sous CC0 ;
 * chaque ligne importée garde son identifiant et sa provenance.
 */
export async function hydraterDepuisWikidata(
  paysCode: string,
  type: TypeRechercheEtablissement,
  recherche: string,
) {
  if (recherche.trim().length < 2) return 0;
  const source = await prismaEducation.sourceEducative.findUnique({ where: { code: "wikidata" } });
  if (!source) return 0;

  const rechercheApi = await wikidataApi<{ search?: Array<{ id?: string }> }>({
    action: "wbsearchentities",
    search: recherche.trim(),
    language: "fr",
    uselang: "fr",
    type: "item",
    limit: "40",
  });
  const ids = [...new Set((rechercheApi.search || []).map(({ id }) => id).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return 0;
  const entites = Object.values(await chargerEntitesWikidata(ids));
  const idsPays = [...new Set(entites.map((entite) => idClaim(entite, "P17")).filter((id): id is string => Boolean(id)))];
  const idsLieux = [...new Set(entites.map((entite) => idClaim(entite, "P131")).filter((id): id is string => Boolean(id)))];
  const idsLies = [...new Set([...idsPays, ...idsLieux])];
  const lies = idsLies.length ? await chargerEntitesWikidata(idsLies) : {};
  let total = 0;

  for (const entite of entites) {
    const reference = await prismaEducation.etablissementSource.findUnique({
      where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: entite.id } },
    });
    // P576 est la date de dissolution/fermeture. Une organisation historique
    // reste une provenance utile, mais ne doit pas être proposée comme école actuelle.
    if (valeurClaim(entite, "P576")) {
      if (reference) {
        await prismaEducation.etablissement.update({
          where: { id: reference.etablissementId },
          data: { valide: false },
        });
      }
      continue;
    }
    const pays = lies[idClaim(entite, "P17") || ""];
    if (texteClaim(pays, "P297")?.toUpperCase() !== paysCode) continue;
    const nom = libelleEntite(entite)?.trim();
    const description = entite.descriptions?.fr?.value || entite.descriptions?.en?.value || "";
    if (!nom || !compatibleAvecType(`${nom} ${description}`, type)) continue;
    const identifiantExterne = entite.id;
    const itemUrl = `https://www.wikidata.org/wiki/${identifiantExterne}`;
    const nomNormalise = normaliserEducation(nom);
    const ville = libelleEntite(lies[idClaim(entite, "P131") || ""])?.trim() || null;
    const villeNormalisee = normaliserEducation(ville || "");
    let etablissement = reference
      ? await prismaEducation.etablissement.findUnique({ where: { id: reference.etablissementId } })
      : await prismaEducation.etablissement.findFirst({
          where: { paysCode, OR: [{ nomNormalise, villeNormalisee }, { alias: { some: { nomNormalise } } }] },
        });

    if (!etablissement) {
      etablissement = await prismaEducation.etablissement.create({
        data: {
          nom,
          nomNormalise,
          type: typePrisma(type),
          paysCode,
          systemeEducatifCode: paysCode,
          ville,
          villeNormalisee,
          statut: /priv[ée]|private/i.test(description)
            ? StatutEtablissement.PRIVE
            : /public/i.test(description)
              ? StatutEtablissement.PUBLIC
              : StatutEtablissement.INCONNU,
          siteWeb: texteClaim(entite, "P856") || null,
        },
      });
    }
    await prismaEducation.etablissementNiveau.upsert({
      where: { etablissementId_niveau: { etablissementId: etablissement.id, niveau: niveauPrisma(type) } },
      create: { etablissementId: etablissement.id, niveau: niveauPrisma(type) },
      update: {},
    });
    const aliasWikidata = [
      ...(entite.aliases?.fr || []),
      ...(entite.aliases?.en || []),
    ]
      .map(({ value }) => value?.trim())
      .filter((value): value is string => Boolean(value));
    for (const alias of new Set(aliasWikidata)) {
      const nomAliasNormalise = normaliserEducation(alias);
      if (!nomAliasNormalise || nomAliasNormalise === nomNormalise) continue;
      await prismaEducation.etablissementAlias.upsert({
        where: {
          etablissementId_nomNormalise: {
            etablissementId: etablissement.id,
            nomNormalise: nomAliasNormalise,
          },
        },
        create: {
          etablissementId: etablissement.id,
          nom: alias,
          nomNormalise: nomAliasNormalise,
        },
        update: { nom: alias },
      });
    }
    await prismaEducation.etablissementSource.upsert({
      where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne } },
      create: {
        etablissementId: etablissement.id,
        sourceId: source.id,
        identifiantExterne,
        urlSource: itemUrl,
        confiance: 0.7,
        donneesBrutes: { description, aliases: aliasWikidata },
      },
      update: {
        etablissementId: etablissement.id,
        urlSource: itemUrl,
        vuLe: new Date(),
        donneesBrutes: { description, aliases: aliasWikidata },
      },
    });
    total += 1;
  }
  return total;
}

const nomAvecSigle = (item: { nom: string; sigle: string | null }) =>
  item.sigle ? `${item.sigle} — ${item.nom}` : item.nom;

export async function chercherProgrammes(params: {
  paysCode: string;
  etablissementId?: string;
  parentId?: string;
  recherche?: string;
}) {
  const recherche = normaliserEducation(params.recherche || "");
  if (params.parentId) {
    const enfants = await prismaEducation.programmeEducation.findMany({
      where: { parentId: params.parentId, actif: true, ...(recherche ? { nomNormalise: { contains: recherche } } : {}) },
      orderBy: { nom: "asc" },
    });
    return enfants.map((item) => ({ id: item.id, label: nomAvecSigle(item), specialites: [] as string[] }));
  }

  const offres = params.etablissementId
    ? await prismaEducation.etablissementProgramme.findMany({
        where: { etablissementId: params.etablissementId, actif: true },
        include: { programme: { include: { enfants: { where: { actif: true }, orderBy: { nom: "asc" } } } }, diplome: true },
        orderBy: { programme: { nom: "asc" } },
      })
    : [];

  if (offres.length) {
    const programmes = new Map<string, {
      id: string;
      label: string;
      specialites: string[];
      diplomes: string[];
    }>();
    for (const { programme, diplome } of offres) {
      if (recherche && !normaliserEducation(`${programme.nom} ${programme.enfants.map(({ nom }) => nom).join(" ")}`).includes(recherche)) {
        continue;
      }
      const existant = programmes.get(programme.id) || {
        id: programme.id,
        label: nomAvecSigle(programme),
        specialites: programme.enfants.map(nomAvecSigle),
        diplomes: [],
      };
      if (diplome) {
        const libelle = nomAvecSigle(diplome);
        if (!existant.diplomes.includes(libelle)) existant.diplomes.push(libelle);
      }
      programmes.set(programme.id, existant);
    }
    return [...programmes.values()].map((programme) => ({
      ...programme,
      diplomeSuggere: programme.diplomes.length === 1 ? programme.diplomes[0] : undefined,
    }));
  }

  const programmes = await prismaEducation.programmeEducation.findMany({
    where: {
      parentId: null,
      actif: true,
      AND: [
        { OR: [{ paysCode: params.paysCode }, { paysCode: null }] },
        ...(recherche
          ? [{ OR: [{ nomNormalise: { contains: recherche } }, { enfants: { some: { nomNormalise: { contains: recherche } } } }] }]
          : []),
      ],
    },
    include: { enfants: { where: { actif: true }, orderBy: { nom: "asc" } } },
    orderBy: [{ paysCode: "desc" }, { nom: "asc" }],
    take: 150,
  });
  return programmes.map((programme) => ({
    id: programme.id,
    label: nomAvecSigle(programme),
    specialites: programme.enfants.map(nomAvecSigle),
    diplomes: [] as string[],
  }));
}

export async function chercherReferences(
  paysCode: string,
  type: TypeRechercheEtablissement,
  etablissementId?: string,
) {
  const niveaux = type === "ecole"
    ? [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL]
    : type === "lycee"
      ? [NiveauEducation.SECONDAIRE, NiveauEducation.PROFESSIONNEL]
      : [NiveauEducation.SUPERIEUR, NiveauEducation.FORMATION_CONTINUE];
  const etablissement = etablissementId
    ? await prismaEducation.etablissement.findUnique({
        where: { id: etablissementId },
        select: { paysCode: true, systemeEducatifCode: true },
      })
    : null;
  const seriesEtablissement = type === "lycee" && etablissementId
    ? await prismaEducation.etablissementProgramme.findMany({
        where: {
          etablissementId,
          actif: true,
          programme: { type: "SERIE", actif: true },
        },
        include: { programme: true },
        orderBy: { programme: { nom: "asc" } },
      })
    : [];
  const paysReferentiel = etablissement?.systemeEducatifCode !== "AUTRE"
    ? etablissement?.systemeEducatifCode
    : undefined;
  const paysCatalogue = paysReferentiel
    || seriesEtablissement[0]?.programme.paysCode
    || etablissement?.paysCode
    || paysCode;
  const [seriesPays, diplomes, programmes] = await Promise.all([
    type === "lycee" && !seriesEtablissement.length
      ? prismaEducation.programmeEducation.findMany({
          where: { paysCode: paysCatalogue, type: "SERIE", actif: true },
          orderBy: { nom: "asc" },
        })
      : Promise.resolve([]),
    prismaEducation.diplomeEducation.findMany({
      where: { paysCode: paysCatalogue, niveau: { in: niveaux }, actif: true },
      orderBy: { nom: "asc" },
    }),
    type === "universite" ? chercherProgrammes({ paysCode }) : Promise.resolve([]),
  ]);
  const series = seriesEtablissement.length
    ? seriesEtablissement.map(({ programme }) => programme)
    : seriesPays;
  return {
    series: series.map(nomAvecSigle),
    diplomes: diplomes.map(nomAvecSigle),
    programmes,
  };
}

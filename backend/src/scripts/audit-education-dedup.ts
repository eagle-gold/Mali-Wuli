import { PrismaClient } from "@prisma/client";
import { demanderDecisionOpenRouter, type CandidatDeduplication } from "../education/openrouter-deduplication";
import { normaliserEducation } from "../education/catalog-service";
import { similariteLibelles } from "../education/catalog-suggestion-service";

const prisma = new PrismaClient();

const argument = (nom: string) => process.argv.find((item) => item.startsWith(`--${nom}=`))?.split("=").slice(1).join("=");
const paysCode = (argument("country") || "FR").toUpperCase();
const recherche = normaliserEducation(argument("query") || "");
const maximum = Math.min(Math.max(Number(argument("max") || 100), 1), 500);

const domaine = (valeur?: string | null) => {
  if (!valeur) return null;
  try {
    return new URL(valeur).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

async function fusionner(doublonId: string, canoniqueId: string) {
  const doublon = await prisma.etablissement.findUniqueOrThrow({
    where: { id: doublonId },
    include: { alias: true },
  });
  await prisma.formation.updateMany({ where: { etablissementId: doublonId }, data: { etablissementId: canoniqueId } });
  await prisma.avisEtablissement.updateMany({ where: { etablissementId: doublonId }, data: { etablissementId: canoniqueId } });
  await prisma.etablissementSource.updateMany({ where: { etablissementId: doublonId }, data: { etablissementId: canoniqueId } });
  for (const alias of [{ nom: doublon.nom, nomNormalise: doublon.nomNormalise }, ...doublon.alias]) {
    await prisma.etablissementAlias.upsert({
      where: { etablissementId_nomNormalise: { etablissementId: canoniqueId, nomNormalise: alias.nomNormalise } },
      create: { etablissementId: canoniqueId, nom: alias.nom, nomNormalise: alias.nomNormalise },
      update: { nom: alias.nom },
    });
  }
  await prisma.etablissement.update({ where: { id: doublonId }, data: { valide: false } });
}

async function auditer() {
  const sourceRor = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "ror" } });
  const canoniques = await prisma.etablissement.findMany({
    where: { paysCode, valide: true, sources: { some: { sourceId: sourceRor.id } } },
    include: {
      alias: true,
      niveaux: true,
      sources: { include: { source: true }, orderBy: { confiance: "desc" } },
    },
  });
  const generiques = (await prisma.etablissement.findMany({
    where: {
      paysCode,
      valide: true,
      sources: { none: { sourceId: sourceRor.id } },
    },
    include: {
      alias: true,
      niveaux: true,
      sources: { include: { source: true }, orderBy: { confiance: "desc" } },
    },
  }))
    .filter((item) => item.sources.length > 0 && item.sources.every(({ source }) => ["hipo", "wikidata"].includes(source.code)))
    .filter((item) => !recherche || normaliserEducation(`${item.nom} ${item.alias.map(({ nom }) => nom).join(" ")}`).includes(recherche))
    .slice(0, maximum);

  let fusionnes = 0;
  let aRevoir = 0;
  let sansCandidat = 0;
  for (const doublon of generiques) {
    const candidats = canoniques
      .map((canonique) => {
        const libelles = [canonique.nom, canonique.sigle, ...canonique.alias.map(({ nom }) => nom)].filter((item): item is string => Boolean(item));
        const scoreNom = Math.max(...libelles.map((libelle) => similariteLibelles(doublon.nom, libelle)));
        const memeDomaine = Boolean(domaine(doublon.siteWeb) && domaine(doublon.siteWeb) === domaine(canonique.siteWeb));
        const score = Math.min(1, scoreNom + (memeDomaine ? 0.18 : 0));
        return {
          id: canonique.id,
          libelle: canonique.nom,
          score,
          contexte: {
            alias: canonique.alias.map(({ nom }) => nom).slice(0, 15),
            ville: canonique.ville,
            type: canonique.type,
            niveaux: canonique.niveaux.map(({ niveau }) => niveau),
            siteWeb: canonique.siteWeb,
            domaineIdentique: memeDomaine,
            sources: canonique.sources.map(({ source, identifiantExterne, confiance }) => ({
              code: source.code,
              identifiant: identifiantExterne,
              confiance,
            })),
          },
        } satisfies CandidatDeduplication;
      })
      .filter(({ score }) => score >= 0.48)
      .sort((gauche, droite) => droite.score - gauche.score)
      .slice(0, 6);
    if (!candidats.length) {
      sansCandidat += 1;
      continue;
    }

    const decision = await demanderDecisionOpenRouter({
      type: "ETABLISSEMENT_EXISTANT_A_AUDITER",
      libelle: doublon.nom,
      paysCode,
      ville: doublon.ville || undefined,
      contexte: {
        idExistant: doublon.id,
        alias: doublon.alias.map(({ nom }) => nom),
        type: doublon.type,
        niveaux: doublon.niveaux.map(({ niveau }) => niveau),
        siteWeb: doublon.siteWeb,
        sources: doublon.sources.map(({ source, identifiantExterne, confiance }) => ({
          code: source.code,
          identifiant: identifiantExterne,
          confiance,
        })),
        regle: "Ne pas fusionner une composante, un campus, un hôpital, un laboratoire ou une communauté universitaire avec l'université mère.",
      },
      candidats,
    });
    if (decision?.decision === "MATCH" && decision.confidence >= 0.92 && decision.candidateId) {
      await fusionner(doublon.id, decision.candidateId);
      fusionnes += 1;
      console.log(`FUSION ${doublon.nom} -> ${candidats.find(({ id }) => id === decision.candidateId)?.libelle} (${decision.confidence})`);
    } else {
      aRevoir += 1;
      console.log(`REVUE ${doublon.nom}: ${decision?.raison || "IA indisponible"}`);
    }
  }
  console.log(JSON.stringify({ paysCode, recherche, examines: generiques.length, fusionnes, aRevoir, sansCandidat }, null, 2));
}

auditer()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

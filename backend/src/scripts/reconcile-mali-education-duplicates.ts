import { PrismaClient } from "@prisma/client";
import {
  cleRapprochementEtablissement,
  fusionnerEtablissements,
  nomRapprochementEtablissement,
  villeRapprochementMali,
} from "../education/deduplication-etablissements";

const prisma = new PrismaClient();
const paysCode = (process.argv.find((item) => item.startsWith("--country="))?.split("=")[1] || "ML").toUpperCase();
const simulation = process.argv.includes("--dry-run");

async function reconcilier() {
  const sourceOsm = await prisma.sourceEducative.findUniqueOrThrow({ where: { code: "hotosm-mali-education" } });
  const etablissements = await prisma.etablissement.findMany({
    where: { paysCode, valide: true },
    include: { sources: true, alias: true },
  });
  const groupes = new Map<string, typeof etablissements>();
  for (const etablissement of etablissements) {
    for (const nom of new Set([etablissement.nom, ...etablissement.alias.map(({ nom }) => nom)])) {
      const nomCle = nomRapprochementEtablissement(nom);
      if (nomCle.length < 4) continue;
      const cle = cleRapprochementEtablissement({
        nom,
        type: etablissement.type,
        villeNormalisee: paysCode === "ML"
          ? villeRapprochementMali(etablissement.villeNormalisee)
          : etablissement.villeNormalisee,
      });
      const groupe = groupes.get(cle) || [];
      if (!groupe.some(({ id }) => id === etablissement.id)) groupe.push(etablissement);
      groupes.set(cle, groupe);
    }
  }

  let fusionnes = 0;
  let ambigus = 0;
  const candidats: Array<{ canonique: string; doublon: string }> = [];
  for (const groupe of groupes.values()) {
    const canoniques = groupe.filter(({ sources }) => sources.some(({ sourceId }) => sourceId !== sourceOsm.id));
    const osmSeuls = groupe.filter(({ sources }) => sources.length > 0 && sources.every(({ sourceId }) => sourceId === sourceOsm.id));
    if (!osmSeuls.length) continue;
    if (canoniques.length !== 1) {
      if (canoniques.length > 1) ambigus += osmSeuls.length;
      continue;
    }
    for (const doublon of osmSeuls) {
      candidats.push({ canonique: canoniques[0].nom, doublon: doublon.nom });
      if (!simulation) await fusionnerEtablissements(prisma, canoniques[0].id, doublon.id);
      fusionnes += 1;
    }
  }
  console.log(JSON.stringify({ paysCode, simulation, fusionnes, ambigus, candidats }, null, 2));
}

reconcilier()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

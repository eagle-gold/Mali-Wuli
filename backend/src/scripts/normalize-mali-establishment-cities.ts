import { PrismaClient } from "@prisma/client";
import { villeCanoniqueMali } from "../education/normalisation-localisations";

const prisma = new PrismaClient();
const appliquer = process.argv.includes("--apply");
const TAILLE_LOT = 500;

async function normaliserVilles() {
  const etablissements = await prisma.etablissement.findMany({
    where: { paysCode: "ML", ville: { not: null } },
    select: {
      id: true,
      ville: true,
      villeNormalisee: true,
      type: true,
      valide: true,
      sources: {
        where: { source: { code: "hotosm-mali-education" } },
        select: { donneesBrutes: true },
      },
    },
  });
  const corrections = etablissements.flatMap((etablissement) => {
    const contextes = etablissement.sources.flatMap(({ donneesBrutes }) => {
      if (!donneesBrutes || typeof donneesBrutes !== "object" || Array.isArray(donneesBrutes)) return [];
      return [{
        region: typeof donneesBrutes.region === "string" ? donneesBrutes.region : null,
        cercle: typeof donneesBrutes.cercle === "string" ? donneesBrutes.cercle : null,
        commune: typeof donneesBrutes.commune === "string" ? donneesBrutes.commune : null,
      }];
    });
    const localisation = [undefined, ...contextes]
      .map((contexte) => villeCanoniqueMali(etablissement.ville, contexte))
      .find(({ modifiee }) => modifiee)
      || villeCanoniqueMali(etablissement.ville);
    if (
      !localisation.modifiee
      || (etablissement.ville === localisation.ville
        && etablissement.villeNormalisee === localisation.villeNormalisee)
    ) return [];
    return [{ ...etablissement, cible: localisation }];
  });

  const parLibelle = new Map<string, number>();
  const parType = new Map<string, number>();
  for (const correction of corrections) {
    parLibelle.set(correction.ville || "(vide)", (parLibelle.get(correction.ville || "(vide)") || 0) + 1);
    parType.set(correction.type, (parType.get(correction.type) || 0) + 1);
  }

  let modifies = 0;
  if (appliquer) {
    for (let index = 0; index < corrections.length; index += TAILLE_LOT) {
      const lot = corrections.slice(index, index + TAILLE_LOT);
      const resultat = await prisma.etablissement.updateMany({
        where: { id: { in: lot.map(({ id }) => id) } },
        data: { ville: "Bamako", villeNormalisee: "bamako" },
      });
      modifies += resultat.count;
    }
  }

  console.log(JSON.stringify({
    simulation: !appliquer,
    candidats: corrections.length,
    modifies,
    valides: corrections.filter(({ valide }) => valide).length,
    invalides: corrections.filter(({ valide }) => !valide).length,
    parType: Object.fromEntries([...parType.entries()].sort()),
    parLibelle: Object.fromEntries([...parLibelle.entries()].sort()),
  }, null, 2));
}

normaliserVilles()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

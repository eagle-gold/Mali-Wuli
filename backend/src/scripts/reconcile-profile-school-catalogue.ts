import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { fusionnerEtablissements } from "../education/deduplication-etablissements";

// Targeted reconciliation of the names reported in the profile editor.
// Keep the original source records and inactive rows for traceability.
const GROUPES = [
  { id: "ml-angelots", ancien: "ml-registre-6a039c75fffc37a39846fdbb", nom: "Groupe scolaire Les Angelots" },
  { id: "ml-ecole-les-lutins", ancien: "ml-registre-8a481749b42b3f43cc1ee9c7", nom: "École Les Lutins" },
  { id: "ml-lycee-liberte", ancien: "ml-overture-56c57fc29e34b4c69e7dbf10", nom: "Établissement Liberté" },
];
const prisma = new PrismaClient();
const estObjet = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

async function main() {
  const appliquer = process.argv.includes("--apply");
  const groupes = await Promise.all(GROUPES.map(async (groupe) => {
    const [canonique, ancien] = await Promise.all([
      prisma.etablissement.findUniqueOrThrow({ where: { id: groupe.id } }),
      prisma.etablissement.findUniqueOrThrow({ where: { id: groupe.ancien } }),
    ]);
    if (canonique.paysCode !== "ML" || ancien.paysCode !== "ML" || canonique.nom !== groupe.nom) {
      throw new Error(`Catalogue modifié : vérifier ${groupe.id} avant réconciliation.`);
    }
    return { ...groupe, actif: ancien.valide };
  }));
  console.log(JSON.stringify({ appliquer, groupes }));
  if (!appliquer) return;

  for (const groupe of groupes) {
    if (groupe.actif) await fusionnerEtablissements(prisma, groupe.id, groupe.ancien);
    await prisma.etablissement.update({ where: { id: groupe.id }, data: { systemeEducatifCode: "FR" } });
    await prisma.suggestionCatalogue.updateMany({
      where: { type: "ETABLISSEMENT", canoniqueId: groupe.ancien },
      data: { canoniqueId: groupe.id },
    });
    await prisma.suggestionCatalogue.updateMany({
      where: { type: "ETABLISSEMENT", candidatId: groupe.ancien },
      data: { candidatId: groupe.id },
    });
  }

  // The onboarding snapshot takes precedence over relational rows on reload.
  // Rewrite only the catalogue identity and preserve every user-entered field.
  let brouillons = 0;
  const profils = await prisma.profil.findMany({ select: { id: true, onboardingDonnees: true } });
  for (const profil of profils) {
    const donnees = profil.onboardingDonnees;
    if (!estObjet(donnees) || !Array.isArray(donnees.formations)) continue;
    let modifie = false;
    const formations = donnees.formations.map((formation: unknown) => {
      if (!estObjet(formation)) return formation;
      const groupe = groupes.find((item) => item.ancien === formation.etablissementId);
      if (!groupe) return formation;
      modifie = true;
      return { ...formation, etablissementId: groupe.id, etablissement: groupe.nom, etablissementSource: "reference" };
    });
    if (modifie) {
      // Compare the revision to avoid overwriting a form saved concurrently.
      const resultat = await prisma.profil.updateMany({
        where: { id: profil.id, onboardingDonnees: { equals: donnees as Prisma.InputJsonValue } },
        data: { onboardingDonnees: { ...donnees, formations } as Prisma.InputJsonValue },
      });
      if (!resultat.count) throw new Error("Un brouillon vient de changer : relancer la réconciliation.");
      brouillons += resultat.count;
    }
  }
  console.log(JSON.stringify({ termine: true, brouillons }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Réconciliation impossible");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

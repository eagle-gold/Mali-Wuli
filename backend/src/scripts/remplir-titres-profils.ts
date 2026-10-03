import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { titreAutomatiqueDepuisBase } from "../lib/titre-profil";

/**
 * Remplit le titre (courte description sous le nom) des profils qui n'en ont
 * pas, à partir de leur poste actuel ou de leurs études supérieures en cours.
 * Un titre déjà renseigné n'est jamais modifié.
 *
 * Par défaut : SIMULATION, aucune écriture. Écriture seulement avec --apply.
 * L'écriture est conditionnée à « titre encore vide » (updateMany … where) :
 * une saisie faite entre-temps par le membre n'est pas écrasée.
 *
 * Options : --limit N --apply
 * Exemple : npx tsx src/scripts/remplir-titres-profils.ts --limit 50
 */

const TAILLE_LOT = 200;

async function main() {
  const appliquer = process.argv.includes("--apply");
  const indexLimite = process.argv.indexOf("--limit");
  const limite = indexLimite >= 0 ? Number(process.argv[indexLimite + 1]) : Infinity;
  if (!(limite > 0)) throw new Error("--limit doit être un entier positif.");

  const prisma = new PrismaClient();
  const compteurs = { examines: 0, aRemplir: 0, ecrits: 0, sansDonnee: 0, concurrents: 0 };
  const exemples: Array<{ profilId: string; titre: string }> = [];
  let curseur: string | undefined;

  try {
    for (;;) {
      // Pagination par identifiant croissant : le filtre « titre vide » change quand on
      // écrit, un curseur Prisma avec skip sauterait alors un profil par page.
      const profils = await prisma.profil.findMany({
        where: { AND: [curseur ? { id: { gt: curseur } } : {}, { OR: [{ titre: null }, { titre: "" }] }] },
        orderBy: { id: "asc" },
        take: TAILLE_LOT,
        select: {
          id: true,
          experiences: { select: { poste: true, entreprise: true, estActuel: true, dateDebut: true } },
          formations: { select: { type: true, statutDiplome: true, autreEtablissement: true, etablissement: { select: { nom: true } } } },
        },
      });
      if (!profils.length) break;
      curseur = profils[profils.length - 1].id;

      for (const profil of profils) {
        if (compteurs.aRemplir >= limite) break;
        compteurs.examines += 1;
        const titre = titreAutomatiqueDepuisBase(profil.experiences, profil.formations);
        if (!titre) { compteurs.sansDonnee += 1; continue; }
        compteurs.aRemplir += 1;
        if (exemples.length < 10) exemples.push({ profilId: profil.id, titre });
        if (!appliquer) continue;
        const resultat = await prisma.profil.updateMany({
          where: { id: profil.id, OR: [{ titre: null }, { titre: "" }] },
          data: { titre },
        });
        if (resultat.count === 1) compteurs.ecrits += 1;
        else compteurs.concurrents += 1;
      }
      if (compteurs.aRemplir >= limite) break;
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(JSON.stringify({ mode: appliquer ? "apply" : "simulation", compteurs, exemples }, null, 2));
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { selectionParcoursTitre, titreParDefautDepuisBase } from "../lib/titre-profil";

/**
 * Resynchronise le titre par défaut des profils : « Poste - Entreprise », sinon
 * « Étudiant(e) - Université » (études supérieures en cours), sinon
 * « Membre du réseau ». Ne touche que les profils dont le titre n'est PAS
 * personnalisé (titrePersonnalise = faux) : un titre écrit par un membre n'est
 * jamais modifié.
 *
 * Par défaut : SIMULATION, aucune écriture. Écriture seulement avec --apply.
 * L'écriture est conditionnée à « titre inchangé et toujours non personnalisé »
 * (updateMany … where) : une modification faite entre-temps n'est pas écrasée.
 * Prérequis : migration 20261007100000_titre_profil_personnalise appliquée.
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
  const compteurs = { examines: 0, aMettreAJour: 0, ecrits: 0, dejaAJour: 0, concurrents: 0 };
  const exemples: Array<{ profilId: string; avant: string | null; apres: string }> = [];
  let curseur: string | undefined;

  try {
    for (;;) {
      // Pagination par identifiant croissant : écrire ne doit jamais décaler la page suivante.
      const profils = await prisma.profil.findMany({
        where: { AND: [curseur ? { id: { gt: curseur } } : {}, { titrePersonnalise: false }] },
        orderBy: { id: "asc" },
        take: TAILLE_LOT,
        select: { id: true, titre: true, ...selectionParcoursTitre },
      });
      if (!profils.length) break;
      curseur = profils[profils.length - 1].id;

      for (const profil of profils) {
        if (compteurs.aMettreAJour >= limite) break;
        compteurs.examines += 1;
        const titre = titreParDefautDepuisBase(profil.experiences, profil.formations);
        if (profil.titre === titre) { compteurs.dejaAJour += 1; continue; }
        compteurs.aMettreAJour += 1;
        if (exemples.length < 10) exemples.push({ profilId: profil.id, avant: profil.titre, apres: titre });
        if (!appliquer) continue;
        const resultat = await prisma.profil.updateMany({
          where: { id: profil.id, titrePersonnalise: false, titre: profil.titre },
          data: { titre },
        });
        if (resultat.count === 1) compteurs.ecrits += 1;
        else compteurs.concurrents += 1;
      }
      if (compteurs.aMettreAJour >= limite) break;
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

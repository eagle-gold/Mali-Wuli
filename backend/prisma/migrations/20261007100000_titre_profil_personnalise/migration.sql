-- Titre de profil dynamique : par défaut il suit le parcours du membre ; un titre
-- écrit par le membre est marqué « personnalisé » et n'est plus jamais recalculé.

-- AlterTable
ALTER TABLE `Profil` ADD COLUMN `titrePersonnalise` BOOLEAN NOT NULL DEFAULT false;

-- Les titres déjà présents ne pouvaient venir que d'une saisie du membre : on les conserve.
UPDATE `Profil` SET `titrePersonnalise` = true WHERE `titre` IS NOT NULL AND TRIM(`titre`) <> '';

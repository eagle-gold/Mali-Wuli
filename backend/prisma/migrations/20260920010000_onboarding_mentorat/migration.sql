-- Les réglages détaillés du mentorat complètent la table historique sans
-- supprimer ni réinterpréter les volontaires existants.
ALTER TABLE `Volontaire`
  ADD COLUMN `sujets` JSON NULL,
  ADD COLUMN `precisionsSujets` JSON NULL,
  ADD COLUMN `format` VARCHAR(191) NULL,
  ADD COLUMN `dateDebut` DATETIME(3) NULL,
  ADD COLUMN `dateFin` DATETIME(3) NULL,
  ADD COLUMN `disponibilites` JSON NULL,
  ADD COLUMN `maxRdvMois` INTEGER NULL;

-- Localisation détaillée des établissements (Mali : `ville` = chef-lieu de région).
-- Migration additive : colonnes nullables sans valeur par défaut, aucune donnée modifiée.

-- AlterTable
ALTER TABLE `Etablissement` ADD COLUMN `localite` VARCHAR(191) NULL,
    ADD COLUMN `commune` VARCHAR(191) NULL,
    ADD COLUMN `communeCode` VARCHAR(64) NULL,
    ADD COLUMN `cercle` VARCHAR(191) NULL,
    ADD COLUMN `region` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Etablissement_paysCode_communeCode_idx` ON `Etablissement`(`paysCode`, `communeCode`);

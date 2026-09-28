-- Migration additive : conserve les associations et affiliations existantes.
ALTER TABLE `Association`
  MODIFY `description` TEXT NULL,
  MODIFY `site` TEXT NULL,
  ADD COLUMN `ville` VARCHAR(191) NULL,
  ADD COLUMN `vocation` VARCHAR(191) NULL,
  ADD COLUMN `emailContact` VARCHAR(191) NULL,
  ADD COLUMN `photo` TEXT NULL,
  ADD COLUMN `photoCouverture` TEXT NULL,
  ADD COLUMN `dateCreation` DATE NULL;

ALTER TABLE `AssociationMembre`
  MODIFY `statut` ENUM('EN_ATTENTE', 'VERIFIE', 'DECLARE', 'REFUSE') NOT NULL DEFAULT 'EN_ATTENTE';

CREATE INDEX `Association_valide_pays_ville_idx` ON `Association`(`valide`, `pays`, `ville`);
CREATE INDEX `Association_responsableId_idx` ON `Association`(`responsableId`);
CREATE INDEX `AssociationMembre_profilId_statut_idx` ON `AssociationMembre`(`profilId`, `statut`);
CREATE INDEX `AssociationMembre_associationId_statut_idx` ON `AssociationMembre`(`associationId`, `statut`);

CREATE TABLE `AssociationSuggestion` (
  `id` VARCHAR(191) NOT NULL,
  `nom` VARCHAR(191) NOT NULL,
  `pays` VARCHAR(191) NOT NULL,
  `ville` VARCHAR(191) NULL,
  `vocation` VARCHAR(191) NULL,
  `message` TEXT NULL,
  `proposeurId` VARCHAR(191) NOT NULL,
  `statut` ENUM('EN_ATTENTE', 'TRAITEE', 'REFUSEE') NOT NULL DEFAULT 'EN_ATTENTE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `AssociationSuggestion_statut_createdAt_idx` (`statut`, `createdAt`),
  INDEX `AssociationSuggestion_proposeurId_createdAt_idx` (`proposeurId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AssociationSuggestion` ADD CONSTRAINT `AssociationSuggestion_proposeurId_fkey`
  FOREIGN KEY (`proposeurId`) REFERENCES `Profil`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

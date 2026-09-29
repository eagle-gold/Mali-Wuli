-- Signalements de tout contenu + corbeille 30 jours (publications, commentaires).
-- Migration additive : aucune colonne ni table supprimée ; noteInterne est seulement élargie en TEXT.

-- AlterTable
ALTER TABLE `Publication` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `CommentairePublication` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('NOUVEAU_MESSAGE', 'DEMANDE_SYNERGIE', 'SYNERGIE_ACCEPTEE', 'SYNERGIE_REFUSEE', 'NOUVELLE_PUBLICATION', 'NOUVEAU_COMMENTAIRE', 'NOUVELLE_REPONSE', 'NOUVELLE_REACTION', 'RENDEZ_VOUS', 'EVENEMENT', 'OFFRE', 'CERCLE', 'SIGNALEMENT') NOT NULL;

-- AlterTable
ALTER TABLE `Signalement` ADD COLUMN `details` TEXT NULL,
    ADD COLUMN `statut` ENUM('EN_ATTENTE', 'EN_COURS', 'TRAITE', 'REJETE') NOT NULL DEFAULT 'EN_ATTENTE',
    ADD COLUMN `traiteLe` DATETIME(3) NULL,
    ADD COLUMN `traiteParId` VARCHAR(191) NULL,
    MODIFY `noteInterne` TEXT NULL;

-- CreateIndex
CREATE INDEX `Publication_deletedAt_idx` ON `Publication`(`deletedAt`);

-- CreateIndex
CREATE INDEX `Publication_auteurId_deletedAt_idx` ON `Publication`(`auteurId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `CommentairePublication_deletedAt_idx` ON `CommentairePublication`(`deletedAt`);

-- CreateIndex
CREATE INDEX `CommentairePublication_auteurId_deletedAt_idx` ON `CommentairePublication`(`auteurId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `Signalement_statut_createdAt_idx` ON `Signalement`(`statut`, `createdAt`);

-- CreateIndex
CREATE INDEX `Signalement_cibleType_cibleId_idx` ON `Signalement`(`cibleType`, `cibleId`);

-- CreateIndex
CREATE INDEX `Signalement_signaleurId_createdAt_idx` ON `Signalement`(`signaleurId`, `createdAt`);


-- Backfill : les signalements déjà marqués traités passent au statut TRAITE (traite reste synchronisé).
UPDATE `Signalement` SET `statut` = 'TRAITE' WHERE `traite` = true;

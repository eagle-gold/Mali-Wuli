-- AlterTable
ALTER TABLE `Evenement` ADD COLUMN `fuseauHoraire` VARCHAR(191) NULL,
    ADD COLUMN `pays` VARCHAR(191) NULL,
    ADD COLUMN `photoCouverture` TEXT NULL,
    ADD COLUMN `programme` JSON NULL,
    ADD COLUMN `refuse` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `resume` TEXT NULL,
    ADD COLUMN `ville` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `EvenementPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `evenementId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `legende` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EvenementPhoto_evenementId_createdAt_idx`(`evenementId`, `createdAt`),
    INDEX `EvenementPhoto_auteurId_idx`(`auteurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Evenement_valide_refuse_dateDebut_idx` ON `Evenement`(`valide`, `refuse`, `dateDebut`);

-- CreateIndex
CREATE INDEX `Evenement_pays_ville_idx` ON `Evenement`(`pays`, `ville`);

-- AddForeignKey
ALTER TABLE `EvenementPhoto` ADD CONSTRAINT `EvenementPhoto_evenementId_fkey` FOREIGN KEY (`evenementId`) REFERENCES `Evenement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvenementPhoto` ADD CONSTRAINT `EvenementPhoto_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


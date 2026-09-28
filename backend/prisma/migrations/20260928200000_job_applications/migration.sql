-- AlterTable
ALTER TABLE `Offre` ADD COLUMN `modeCandidature` ENUM('MALI_WULI', 'EMAIL', 'LIEN_EXTERNE') NOT NULL DEFAULT 'MALI_WULI',
    ADD COLUMN `modeTravail` ENUM('SUR_SITE', 'HYBRIDE', 'TELETRAVAIL') NOT NULL DEFAULT 'SUR_SITE',
    ADD COLUMN `profilRecherche` TEXT NULL,
    ADD COLUMN `recommandationPossible` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `salaire` VARCHAR(191) NULL,
    ADD COLUMN `statutModeration` ENUM('EN_ATTENTE', 'PUBLIEE', 'REFUSEE') NOT NULL DEFAULT 'EN_ATTENTE';

-- CreateTable
CREATE TABLE `OffreEnregistrement` (
    `offreId` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OffreEnregistrement_profilId_createdAt_idx`(`profilId`, `createdAt`),
    PRIMARY KEY (`offreId`, `profilId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CandidatureOffre` (
    `id` VARCHAR(191) NOT NULL,
    `offreId` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `modeCandidature` ENUM('MALI_WULI', 'EMAIL', 'LIEN_EXTERNE') NOT NULL,
    `statut` ENUM('EN_COURS', 'ENVOYEE', 'ECHEC') NOT NULL DEFAULT 'EN_COURS',
    `message` TEXT NULL,
    `conversationId` VARCHAR(191) NULL,
    `messageId` VARCHAR(191) NULL,
    `tentativeId` VARCHAR(191) NOT NULL,
    `tentatives` INTEGER NOT NULL DEFAULT 1,
    `erreurCode` VARCHAR(191) NULL,
    `envoyeeAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CandidatureOffre_tentativeId_key`(`tentativeId`),
    INDEX `CandidatureOffre_profilId_createdAt_idx`(`profilId`, `createdAt`),
    INDEX `CandidatureOffre_offreId_statut_idx`(`offreId`, `statut`),
    UNIQUE INDEX `CandidatureOffre_offreId_profilId_key`(`offreId`, `profilId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Offre_statutModeration_dateExpiration_createdAt_idx` ON `Offre`(`statutModeration`, `dateExpiration`, `createdAt`);

-- CreateIndex
CREATE INDEX `Offre_modeTravail_pays_ville_idx` ON `Offre`(`modeTravail`, `pays`, `ville`);

-- AddForeignKey
ALTER TABLE `OffreEnregistrement` ADD CONSTRAINT `OffreEnregistrement_offreId_fkey` FOREIGN KEY (`offreId`) REFERENCES `Offre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OffreEnregistrement` ADD CONSTRAINT `OffreEnregistrement_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CandidatureOffre` ADD CONSTRAINT `CandidatureOffre_offreId_fkey` FOREIGN KEY (`offreId`) REFERENCES `Offre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CandidatureOffre` ADD CONSTRAINT `CandidatureOffre_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill borné aux nouvelles colonnes : les contrats historiques restent intacts.
-- Un ancien valide=false ne permet pas de distinguer attente/refus : conserver EN_ATTENTE.
UPDATE `Offre`
SET `statutModeration` = CASE WHEN `valide` = true THEN 'PUBLIEE' ELSE 'EN_ATTENTE' END,
    `modeTravail` = CASE WHEN `teletravail` = true THEN 'TELETRAVAIL' ELSE 'SUR_SITE' END,
    `modeCandidature` = CASE
      WHEN `lienCandidature` IS NOT NULL AND TRIM(`lienCandidature`) <> '' THEN 'LIEN_EXTERNE'
      WHEN `emailContact` IS NOT NULL AND TRIM(`emailContact`) <> '' THEN 'EMAIL'
      ELSE 'MALI_WULI'
    END;

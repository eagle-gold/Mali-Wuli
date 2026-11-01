-- Messagerie : pièces jointes privées et dernière activité des membres.
ALTER TABLE `User` ADD COLUMN `derniereActiviteLe` DATETIME(3) NULL;

CREATE TABLE `PieceJointeMessage` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `mime` VARCHAR(120) NOT NULL,
    `taille` INTEGER NOT NULL,
    `fichier` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PieceJointeMessage_messageId_idx`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PieceJointeMessage` ADD CONSTRAINT `PieceJointeMessage_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

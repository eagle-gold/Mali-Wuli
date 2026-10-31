-- Sessions révoquées avant expiration (déconnexion d'un seul appareil).
CREATE TABLE `JetonRevoque` (
    `jti` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expireLe` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JetonRevoque_expireLe_idx`(`expireLe`),
    INDEX `JetonRevoque_userId_idx`(`userId`),
    PRIMARY KEY (`jti`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `JetonRevoque` ADD CONSTRAINT `JetonRevoque_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

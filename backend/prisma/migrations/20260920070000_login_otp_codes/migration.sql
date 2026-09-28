-- Connexion sans mot de passe : le code à usage unique n'est jamais stocké
-- en clair. Une ligne par adresse permet à une nouvelle demande d'invalider
-- atomiquement tous les codes précédents.
CREATE TABLE `LoginOtpCode` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `codeHash` VARCHAR(191) NOT NULL,
  `expireLe` DATETIME(3) NOT NULL,
  `tentatives` INTEGER NOT NULL DEFAULT 0,
  `utiliseLe` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `LoginOtpCode_email_key`(`email`),
  INDEX `LoginOtpCode_expireLe_idx`(`expireLe`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

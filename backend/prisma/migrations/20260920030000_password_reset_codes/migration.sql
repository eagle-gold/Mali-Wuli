-- Les codes de réinitialisation sont séparés du compte utilisateur : seul leur
-- hash est conservé et chaque nouvelle demande invalide implicitement l'ancien
-- code de la même adresse.
CREATE TABLE `PasswordResetCode` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `codeHash` VARCHAR(191) NOT NULL,
  `expireLe` DATETIME(3) NOT NULL,
  `tentatives` INTEGER NOT NULL DEFAULT 0,
  `utiliseLe` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PasswordResetCode_email_key`(`email`),
  INDEX `PasswordResetCode_expireLe_idx`(`expireLe`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

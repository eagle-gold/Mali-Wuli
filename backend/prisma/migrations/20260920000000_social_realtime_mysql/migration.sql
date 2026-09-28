-- This migration is intentionally additive: the education catalogue and all
-- existing member data remain in place while the social/realtime features are
-- added to the MySQL deployment.

-- Profile media and long-form fields.
ALTER TABLE `Profil`
    MODIFY `bio` TEXT NULL,
    MODIFY `photo` TEXT NULL,
    ADD COLUMN `photoCouverture` TEXT NULL;

ALTER TABLE `AvisEtablissement`
    ADD COLUMN `noteContenu` INTEGER NULL;

ALTER TABLE `Experience`
    ADD COLUMN `typeContrat` VARCHAR(191) NULL;

-- A sorted member-pair key prevents simultaneous A -> B and B -> A synergy
-- requests. Legacy reverse duplicates are retained with a stable suffix; the
-- oldest matching row keeps the canonical pair key used by new requests.
ALTER TABLE `Synergie`
    ADD COLUMN `clePaire` VARCHAR(191) NULL;

UPDATE `Synergie`
SET `clePaire` = CONCAT(
    LEAST(`demandeurId`, `recepteurId`),
    ':',
    GREATEST(`demandeurId`, `recepteurId`)
);

UPDATE `Synergie` AS `courante`
INNER JOIN `Synergie` AS `precedente`
    ON `courante`.`clePaire` = `precedente`.`clePaire`
   AND (
       `precedente`.`createdAt` < `courante`.`createdAt`
       OR (
           `precedente`.`createdAt` = `courante`.`createdAt`
           AND `precedente`.`id` < `courante`.`id`
       )
   )
SET `courante`.`clePaire` = CONCAT(`courante`.`clePaire`, ':legacy:', `courante`.`id`);

ALTER TABLE `Synergie`
    MODIFY `clePaire` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `Synergie_clePaire_key` ON `Synergie`(`clePaire`);

-- Conversation metadata used for idempotent direct conversations and unread
-- counters. Only one legacy conversation per pair receives the canonical key.
ALTER TABLE `Conversation`
    ADD COLUMN `cleDirecte` VARCHAR(191) NULL,
    ADD COLUMN `dernierMessageLe` DATETIME(3) NULL;

CREATE TEMPORARY TABLE `_ConversationDirecteMigration` (
    `conversationId` VARCHAR(191) NOT NULL,
    `cleDirecte` VARCHAR(191) NOT NULL,
    PRIMARY KEY (`conversationId`),
    INDEX `_ConversationDirecteMigration_cleDirecte_idx` (`cleDirecte`)
);

INSERT INTO `_ConversationDirecteMigration` (`conversationId`, `cleDirecte`)
SELECT
    `membre`.`conversationId`,
    CONCAT(MIN(`membre`.`profilId`), ':', MAX(`membre`.`profilId`))
FROM `ConversationMembre` AS `membre`
INNER JOIN `Conversation` AS `conversation`
    ON `conversation`.`id` = `membre`.`conversationId`
WHERE `conversation`.`estGroupe` = FALSE
GROUP BY `membre`.`conversationId`
HAVING COUNT(DISTINCT `membre`.`profilId`) = 2;

CREATE TEMPORARY TABLE `_ConversationDirecteCanonique` (
    `cleDirecte` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    PRIMARY KEY (`cleDirecte`)
);

INSERT INTO `_ConversationDirecteCanonique` (`cleDirecte`, `conversationId`)
SELECT `cleDirecte`, MIN(`conversationId`)
FROM `_ConversationDirecteMigration`
GROUP BY `cleDirecte`;

UPDATE `Conversation` AS `conversation`
INNER JOIN `_ConversationDirecteMigration` AS `candidate`
    ON `candidate`.`conversationId` = `conversation`.`id`
INNER JOIN `_ConversationDirecteCanonique` AS `canonique`
    ON `canonique`.`cleDirecte` = `candidate`.`cleDirecte`
   AND `canonique`.`conversationId` = `candidate`.`conversationId`
SET `conversation`.`cleDirecte` = `candidate`.`cleDirecte`;

DROP TEMPORARY TABLE `_ConversationDirecteCanonique`;
DROP TEMPORARY TABLE `_ConversationDirecteMigration`;

UPDATE `Conversation` AS `conversation`
LEFT JOIN (
    SELECT `conversationId`, MAX(`createdAt`) AS `dernierMessageLe`
    FROM `Message`
    GROUP BY `conversationId`
) AS `dernierMessage`
    ON `dernierMessage`.`conversationId` = `conversation`.`id`
SET `conversation`.`dernierMessageLe` = COALESCE(
    `dernierMessage`.`dernierMessageLe`,
    `conversation`.`createdAt`
);

CREATE UNIQUE INDEX `Conversation_cleDirecte_key` ON `Conversation`(`cleDirecte`);
CREATE INDEX `Conversation_dernierMessageLe_idx` ON `Conversation`(`dernierMessageLe`);

ALTER TABLE `ConversationMembre`
    ADD COLUMN `dernierLuLe` DATETIME(3) NULL;

UPDATE `ConversationMembre`
SET `dernierLuLe` = `rejointLe`;

ALTER TABLE `Message`
    MODIFY `contenu` TEXT NOT NULL;

-- Feed publications, reactions and threaded comments.
CREATE TABLE `Publication` (
    `id` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `intention` ENUM('OFFRE', 'DEMANDE') NOT NULL,
    `thematique` VARCHAR(191) NOT NULL,
    `type` ENUM('TEXTE', 'PHOTO', 'LIEN', 'EVENEMENT') NOT NULL DEFAULT 'TEXTE',
    `contenu` TEXT NOT NULL,
    `photoUrl` TEXT NULL,
    `lienUrl` TEXT NULL,
    `lienTitre` VARCHAR(191) NULL,
    `lienImage` TEXT NULL,
    `epingle` BOOLEAN NOT NULL DEFAULT FALSE,
    `visible` BOOLEAN NOT NULL DEFAULT TRUE,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Publication_auteurId_createdAt_idx`(`auteurId`, `createdAt`),
    INDEX `Publication_intention_thematique_createdAt_idx`(`intention`, `thematique`, `createdAt`),
    INDEX `Publication_visible_createdAt_idx`(`visible`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReactionPublication` (
    `id` VARCHAR(191) NOT NULL,
    `publicationId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `type` ENUM('LIKE', 'BRAVO', 'SOUTIEN', 'INSTRUCTIF', 'INSPIRANT') NOT NULL DEFAULT 'LIKE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReactionPublication_publicationId_idx`(`publicationId`),
    INDEX `ReactionPublication_auteurId_idx`(`auteurId`),
    UNIQUE INDEX `ReactionPublication_publicationId_auteurId_key`(`publicationId`, `auteurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommentairePublication` (
    `id` VARCHAR(191) NOT NULL,
    `publicationId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `contenu` TEXT NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommentairePublication_publicationId_createdAt_idx`(`publicationId`, `createdAt`),
    INDEX `CommentairePublication_auteurId_idx`(`auteurId`),
    INDEX `CommentairePublication_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Durable member notifications, separate from catalogue-admin notifications.
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `destinataireId` VARCHAR(191) NOT NULL,
    `acteurId` VARCHAR(191) NULL,
    `type` ENUM('NOUVEAU_MESSAGE', 'DEMANDE_SYNERGIE', 'SYNERGIE_ACCEPTEE', 'SYNERGIE_REFUSEE', 'NOUVELLE_PUBLICATION', 'NOUVEAU_COMMENTAIRE', 'NOUVELLE_REPONSE', 'NOUVELLE_REACTION', 'RENDEZ_VOUS', 'EVENEMENT', 'OFFRE') NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `detail` TEXT NULL,
    `href` TEXT NULL,
    `payload` JSON NULL,
    `lue` BOOLEAN NOT NULL DEFAULT FALSE,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Notification_destinataireId_lue_createdAt_idx`(`destinataireId`, `lue`, `createdAt`),
    INDEX `Notification_acteurId_idx`(`acteurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Publication`
    ADD CONSTRAINT `Publication_auteurId_fkey`
    FOREIGN KEY (`auteurId`) REFERENCES `Profil`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ReactionPublication`
    ADD CONSTRAINT `ReactionPublication_publicationId_fkey`
    FOREIGN KEY (`publicationId`) REFERENCES `Publication`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ReactionPublication_auteurId_fkey`
    FOREIGN KEY (`auteurId`) REFERENCES `Profil`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CommentairePublication`
    ADD CONSTRAINT `CommentairePublication_publicationId_fkey`
    FOREIGN KEY (`publicationId`) REFERENCES `Publication`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `CommentairePublication_auteurId_fkey`
    FOREIGN KEY (`auteurId`) REFERENCES `Profil`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `CommentairePublication_parentId_fkey`
    FOREIGN KEY (`parentId`) REFERENCES `CommentairePublication`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Notification`
    ADD CONSTRAINT `Notification_destinataireId_fkey`
    FOREIGN KEY (`destinataireId`) REFERENCES `Profil`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `Notification_acteurId_fkey`
    FOREIGN KEY (`acteurId`) REFERENCES `Profil`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

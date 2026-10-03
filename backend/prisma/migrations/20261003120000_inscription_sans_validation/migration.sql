-- Suppression de l'étape « profil en attente de validation ».
-- Un compte créé accède immédiatement au réseau. Les comptes encore en attente
-- sont validés, puis la valeur EN_ATTENTE est retirée de l'énumération.

-- Données : valider les comptes en attente avant de retirer la valeur.
UPDATE `User` SET `statut` = 'VALIDE' WHERE `statut` = 'EN_ATTENTE';

-- AlterTable
ALTER TABLE `User` MODIFY `statut` ENUM('VALIDE', 'REFUSE', 'SUSPENDU') NOT NULL DEFAULT 'VALIDE';

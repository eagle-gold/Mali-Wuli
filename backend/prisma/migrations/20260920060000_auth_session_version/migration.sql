-- Invalide immédiatement les JWT déjà émis après un changement de mot de
-- passe, de statut ou de rôle. La valeur existante 0 conserve les comptes.
ALTER TABLE `User` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

-- Limite les essais de saisie du code de vérification d'e-mail (5 par code).
-- Les codes en attente deviennent des empreintes bcrypt : les demandes
-- antérieures au déploiement exigeront simplement un nouveau code.
ALTER TABLE `EmailVerification` ADD COLUMN `tentatives` INTEGER NOT NULL DEFAULT 0;

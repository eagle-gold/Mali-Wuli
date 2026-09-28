-- Community features use only additive columns and indexes so existing member,
-- education and social data remain untouched.

-- A nullable reservation key is filled only for active appointments created by
-- the new API. MySQL allows several NULL values in a unique index, so legacy
-- and cancelled appointments remain valid while concurrent double bookings
-- are rejected atomically.
ALTER TABLE `RendezVous`
    ADD COLUMN `cleReservation` VARCHAR(191) NULL,
    MODIFY `motif` TEXT NOT NULL;

CREATE UNIQUE INDEX `RendezVous_cleReservation_key`
    ON `RendezVous`(`cleReservation`);
CREATE INDEX `RendezVous_volontaireId_debut_idx`
    ON `RendezVous`(`volontaireId`, `debut`);
CREATE INDEX `RendezVous_demandeurId_debut_idx`
    ON `RendezVous`(`demandeurId`, `debut`);
CREATE INDEX `RendezVous_statut_debut_idx`
    ON `RendezVous`(`statut`, `debut`);

CREATE INDEX `Cercle_actif_theme_idx` ON `Cercle`(`actif`, `theme`);
CREATE INDEX `Cercle_presidentId_idx` ON `Cercle`(`presidentId`);
ALTER TABLE `Cercle` MODIFY `description` TEXT NULL;
CREATE INDEX `CercleMembre_profilId_statut_idx`
    ON `CercleMembre`(`profilId`, `statut`);
CREATE INDEX `CercleMembre_cercleId_statut_idx`
    ON `CercleMembre`(`cercleId`, `statut`);

CREATE INDEX `Evenement_valide_dateDebut_idx`
    ON `Evenement`(`valide`, `dateDebut`);
CREATE INDEX `Evenement_organisateurId_idx`
    ON `Evenement`(`organisateurId`);
ALTER TABLE `Evenement` MODIFY `description` TEXT NOT NULL;
CREATE INDEX `EvenementParticipant_profilId_inscritLe_idx`
    ON `EvenementParticipant`(`profilId`, `inscritLe`);

CREATE INDEX `Offre_valide_dateExpiration_createdAt_idx`
    ON `Offre`(`valide`, `dateExpiration`, `createdAt`);
CREATE INDEX `Offre_publieurId_createdAt_idx`
    ON `Offre`(`publieurId`, `createdAt`);
CREATE INDEX `Offre_type_secteur_pays_idx`
    ON `Offre`(`type`, `secteur`, `pays`);
ALTER TABLE `Offre` MODIFY `description` TEXT NOT NULL;

-- Dedicated member notification for circle membership activity.
ALTER TABLE `Notification`
    MODIFY `type` ENUM(
      'NOUVEAU_MESSAGE',
      'DEMANDE_SYNERGIE',
      'SYNERGIE_ACCEPTEE',
      'SYNERGIE_REFUSEE',
      'NOUVELLE_PUBLICATION',
      'NOUVEAU_COMMENTAIRE',
      'NOUVELLE_REPONSE',
      'NOUVELLE_REACTION',
      'RENDEZ_VOUS',
      'EVENEMENT',
      'OFFRE',
      'CERCLE'
    ) NOT NULL;

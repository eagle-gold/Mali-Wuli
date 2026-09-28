-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `prenom` VARCHAR(191) NULL,
    `nom` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `motDePasse` VARCHAR(191) NULL,
    `dateNaissance` DATETIME(3) NULL,
    `role` ENUM('MEMBRE', 'VOLONTAIRE', 'PRESIDENT_CERCLE', 'RESPONSABLE_ASSO', 'MODERATEUR', 'ADMIN') NOT NULL DEFAULT 'MEMBRE',
    `statut` ENUM('EN_ATTENTE', 'VALIDE', 'REFUSE', 'SUSPENDU') NOT NULL DEFAULT 'EN_ATTENTE',
    `emailVerifie` BOOLEAN NOT NULL DEFAULT false,
    `codeVerif` VARCHAR(191) NULL,
    `codeExpire` DATETIME(3) NULL,
    `cguAccepteLe` DATETIME(3) NULL,
    `parrainId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerification` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `codeExpire` DATETIME(3) NOT NULL,
    `verifieLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmailVerification_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profil` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `telephone` VARCHAR(191) NULL,
    `pays` VARCHAR(191) NULL,
    `ville` VARCHAR(191) NULL,
    `situation` ENUM('ETUDIANT', 'PROFESSIONNEL', 'ENTREPRENEUR', 'EN_RECHERCHE') NULL,
    `titre` VARCHAR(191) NULL,
    `bio` VARCHAR(191) NULL,
    `photo` VARCHAR(191) NULL,
    `linkedin` VARCHAR(191) NULL,
    `emailVisible` BOOLEAN NOT NULL DEFAULT false,
    `telephoneVisible` BOOLEAN NOT NULL DEFAULT false,
    `estVolontaire` BOOLEAN NOT NULL DEFAULT false,
    `onboardingEtape` INTEGER NOT NULL DEFAULT 0,
    `onboardingFini` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Profil_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaysEducation` (
    `code` CHAR(2) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `nomAnglais` VARCHAR(191) NULL,
    `codeIso3` CHAR(3) NULL,
    `drapeau` VARCHAR(191) NULL,
    `indicatif` VARCHAR(191) NULL,
    `prioriteDiaspora` INTEGER NOT NULL DEFAULT 999,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaysEducation_codeIso3_key`(`codeIso3`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Etablissement` (
    `id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `nomNormalise` VARCHAR(191) NOT NULL,
    `sigle` VARCHAR(191) NULL,
    `type` ENUM('FONDAMENTALE', 'LYCEE', 'UNIVERSITE', 'ECOLE_SUPERIEURE') NOT NULL,
    `paysCode` CHAR(2) NOT NULL,
    `systemeEducatifCode` VARCHAR(16) NOT NULL,
    `ville` VARCHAR(191) NULL,
    `villeNormalisee` VARCHAR(191) NOT NULL DEFAULT '',
    `statut` ENUM('PUBLIC', 'PRIVE', 'INCONNU') NOT NULL DEFAULT 'INCONNU',
    `habilite` BOOLEAN NULL,
    `description` VARCHAR(191) NULL,
    `siteWeb` VARCHAR(191) NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `valide` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Etablissement_paysCode_nomNormalise_villeNormalisee_idx`(`paysCode`, `nomNormalise`, `villeNormalisee`),
    INDEX `Etablissement_paysCode_type_villeNormalisee_idx`(`paysCode`, `type`, `villeNormalisee`),
    INDEX `Etablissement_systemeEducatifCode_idx`(`systemeEducatifCode`),
    INDEX `Etablissement_nomNormalise_idx`(`nomNormalise`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EtablissementNiveau` (
    `etablissementId` VARCHAR(191) NOT NULL,
    `niveau` ENUM('PRESCOLAIRE', 'PRIMAIRE', 'FONDAMENTAL', 'SECONDAIRE', 'PROFESSIONNEL', 'SUPERIEUR', 'FORMATION_CONTINUE') NOT NULL,

    INDEX `EtablissementNiveau_niveau_idx`(`niveau`),
    PRIMARY KEY (`etablissementId`, `niveau`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EtablissementAlias` (
    `id` VARCHAR(191) NOT NULL,
    `etablissementId` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `nomNormalise` VARCHAR(191) NOT NULL,
    `langue` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EtablissementAlias_nomNormalise_idx`(`nomNormalise`),
    UNIQUE INDEX `EtablissementAlias_etablissementId_nomNormalise_key`(`etablissementId`, `nomNormalise`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgrammeEducation` (
    `id` VARCHAR(191) NOT NULL,
    `paysCode` CHAR(2) NULL,
    `parentId` VARCHAR(191) NULL,
    `nom` VARCHAR(191) NOT NULL,
    `nomNormalise` VARCHAR(191) NOT NULL,
    `sigle` VARCHAR(191) NULL,
    `type` ENUM('DOMAINE', 'FORMATION', 'FILIERE', 'SPECIALITE', 'PARCOURS', 'SERIE') NOT NULL,
    `niveau` ENUM('PRESCOLAIRE', 'PRIMAIRE', 'FONDAMENTAL', 'SECONDAIRE', 'PROFESSIONNEL', 'SUPERIEUR', 'FORMATION_CONTINUE') NOT NULL,
    `codeOfficiel` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProgrammeEducation_paysCode_type_niveau_idx`(`paysCode`, `type`, `niveau`),
    INDEX `ProgrammeEducation_parentId_idx`(`parentId`),
    INDEX `ProgrammeEducation_nomNormalise_idx`(`nomNormalise`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiplomeEducation` (
    `id` VARCHAR(191) NOT NULL,
    `paysCode` CHAR(2) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `nomNormalise` VARCHAR(191) NOT NULL,
    `sigle` VARCHAR(191) NULL,
    `niveau` ENUM('PRESCOLAIRE', 'PRIMAIRE', 'FONDAMENTAL', 'SECONDAIRE', 'PROFESSIONNEL', 'SUPERIEUR', 'FORMATION_CONTINUE') NOT NULL,
    `niveauEntree` VARCHAR(191) NULL,
    `niveauSortie` VARCHAR(191) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiplomeEducation_paysCode_niveau_idx`(`paysCode`, `niveau`),
    UNIQUE INDEX `DiplomeEducation_paysCode_niveau_nomNormalise_key`(`paysCode`, `niveau`, `nomNormalise`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EtablissementProgramme` (
    `id` VARCHAR(191) NOT NULL,
    `etablissementId` VARCHAR(191) NOT NULL,
    `programmeId` VARCHAR(191) NOT NULL,
    `diplomeId` VARCHAR(191) NULL,
    `niveau` ENUM('PRESCOLAIRE', 'PRIMAIRE', 'FONDAMENTAL', 'SECONDAIRE', 'PROFESSIONNEL', 'SUPERIEUR', 'FORMATION_CONTINUE') NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EtablissementProgramme_etablissementId_niveau_idx`(`etablissementId`, `niveau`),
    INDEX `EtablissementProgramme_programmeId_idx`(`programmeId`),
    UNIQUE INDEX `EtablissementProgramme_etablissementId_programmeId_diplomeId_key`(`etablissementId`, `programmeId`, `diplomeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SourceEducative` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `paysCode` CHAR(2) NULL,
    `licence` VARCHAR(191) NULL,
    `conditionsUrl` VARCHAR(191) NULL,
    `modeUtilisation` ENUM('IMPORT_OUVERT', 'API_OFFICIELLE', 'VALIDATION_SEULE', 'REFERENCEMENT') NOT NULL,
    `priorite` INTEGER NOT NULL DEFAULT 100,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SourceEducative_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EtablissementSource` (
    `id` VARCHAR(191) NOT NULL,
    `etablissementId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `identifiantExterne` VARCHAR(191) NOT NULL,
    `urlSource` VARCHAR(191) NULL,
    `confiance` DOUBLE NOT NULL DEFAULT 0.5,
    `vuLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `donneesBrutes` JSON NULL,

    INDEX `EtablissementSource_etablissementId_idx`(`etablissementId`),
    UNIQUE INDEX `EtablissementSource_sourceId_identifiantExterne_key`(`sourceId`, `identifiantExterne`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgrammeSource` (
    `id` VARCHAR(191) NOT NULL,
    `programmeId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `identifiantExterne` VARCHAR(191) NOT NULL,
    `urlSource` VARCHAR(191) NULL,
    `confiance` DOUBLE NOT NULL DEFAULT 0.5,
    `vuLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProgrammeSource_programmeId_idx`(`programmeId`),
    UNIQUE INDEX `ProgrammeSource_sourceId_identifiantExterne_key`(`sourceId`, `identifiantExterne`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiplomeSource` (
    `id` VARCHAR(191) NOT NULL,
    `diplomeId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `identifiantExterne` VARCHAR(191) NOT NULL,
    `urlSource` VARCHAR(191) NULL,
    `confiance` DOUBLE NOT NULL DEFAULT 0.5,
    `vuLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiplomeSource_diplomeId_idx`(`diplomeId`),
    UNIQUE INDEX `DiplomeSource_sourceId_identifiantExterne_key`(`sourceId`, `identifiantExterne`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OffreFormationSource` (
    `id` VARCHAR(191) NOT NULL,
    `offreId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `identifiantExterne` VARCHAR(191) NOT NULL,
    `urlSource` VARCHAR(191) NULL,
    `confiance` DOUBLE NOT NULL DEFAULT 0.5,
    `vuLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OffreFormationSource_offreId_idx`(`offreId`),
    UNIQUE INDEX `OffreFormationSource_sourceId_identifiantExterne_key`(`sourceId`, `identifiantExterne`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportEducation` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `paysCode` CHAR(2) NULL,
    `statut` ENUM('EN_COURS', 'TERMINE', 'PARTIEL', 'ECHEC') NOT NULL DEFAULT 'EN_COURS',
    `ajoutes` INTEGER NOT NULL DEFAULT 0,
    `modifies` INTEGER NOT NULL DEFAULT 0,
    `ignores` INTEGER NOT NULL DEFAULT 0,
    `erreurs` INTEGER NOT NULL DEFAULT 0,
    `detail` JSON NULL,
    `commenceLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `termineLe` DATETIME(3) NULL,

    INDEX `ImportEducation_sourceId_paysCode_commenceLe_idx`(`sourceId`, `paysCode`, `commenceLe`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SuggestionCatalogue` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('ETABLISSEMENT', 'PROGRAMME', 'SPECIALITE', 'SERIE', 'DIPLOME') NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `libelleBrut` VARCHAR(191) NOT NULL,
    `libelleNormalise` VARCHAR(191) NOT NULL,
    `paysCode` CHAR(2) NOT NULL,
    `ville` VARCHAR(191) NULL,
    `villeNormalisee` VARCHAR(191) NOT NULL DEFAULT '',
    `contexteCle` VARCHAR(191) NOT NULL DEFAULT '',
    `contexte` JSON NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'A_VALIDER', 'ACCEPTEE', 'REFUSEE', 'FUSIONNEE') NOT NULL DEFAULT 'EN_ATTENTE',
    `nombreContributeurs` INTEGER NOT NULL DEFAULT 0,
    `candidatId` VARCHAR(191) NULL,
    `scoreDeterministe` DOUBLE NULL,
    `decisionIA` JSON NULL,
    `modeleIA` VARCHAR(191) NULL,
    `versionPrompt` VARCHAR(191) NULL,
    `canoniqueId` VARCHAR(191) NULL,
    `valideParId` VARCHAR(191) NULL,
    `valideLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SuggestionCatalogue_type_paysCode_villeNormalisee_statut_idx`(`type`, `paysCode`, `villeNormalisee`, `statut`),
    INDEX `SuggestionCatalogue_statut_nombreContributeurs_idx`(`statut`, `nombreContributeurs`),
    UNIQUE INDEX `SuggestionCatalogue_type_fingerprint_key`(`type`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContributionSuggestionCatalogue` (
    `id` VARCHAR(191) NOT NULL,
    `suggestionId` VARCHAR(191) NOT NULL,
    `contributorKey` VARCHAR(191) NOT NULL,
    `libelleBrut` VARCHAR(191) NOT NULL,
    `contexte` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContributionSuggestionCatalogue_contributorKey_idx`(`contributorKey`),
    UNIQUE INDEX `ContributionSuggestionCatalogue_suggestionId_contributorKey_key`(`suggestionId`, `contributorKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationAdmin` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `suggestionId` VARCHAR(191) NOT NULL,
    `lue` BOOLEAN NOT NULL DEFAULT false,
    `traitee` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationAdmin_suggestionId_key`(`suggestionId`),
    INDEX `NotificationAdmin_traitee_createdAt_idx`(`traitee`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Formation` (
    `id` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `etablissementId` VARCHAR(191) NULL,
    `programmeReferenceId` VARCHAR(191) NULL,
    `parcoursReferenceId` VARCHAR(191) NULL,
    `diplomeReferenceId` VARCHAR(191) NULL,
    `autreEtablissement` VARCHAR(191) NULL,
    `moisDebut` INTEGER NULL,
    `anneeDebut` INTEGER NULL,
    `moisFin` INTEGER NULL,
    `anneeFin` INTEGER NULL,
    `diplome` VARCHAR(191) NULL,
    `mention` VARCHAR(191) NULL,
    `filiere` VARCHAR(191) NULL,
    `specialite` VARCHAR(191) NULL,
    `serie` VARCHAR(191) NULL,
    `statutDiplome` ENUM('OBTENU', 'EN_COURS', 'NON_OBTENU', 'NON_DIPLOMANTE') NOT NULL DEFAULT 'OBTENU',
    `demarcheApresFormation` ENUM('RECHERCHE_EMPLOI', 'POURSUITE_ETUDES', 'AUTRE_PROJET') NULL,
    `delaiPremierEmploi` ENUM('MOINS_3_MOIS', 'DE_3_A_6_MOIS', 'DE_7_A_12_MOIS', 'PLUS_12_MOIS', 'MOINS_DE_12_MOIS_DEPUIS_FIN', 'PAS_ENCORE') NULL,
    `emploiDansLes12Mois` BOOLEAN NULL,
    `lienEmploiFormation` ENUM('DIRECT', 'PARTIEL', 'AUCUN') NULL,
    `enCours` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Formation_programmeReferenceId_idx`(`programmeReferenceId`),
    INDEX `Formation_parcoursReferenceId_idx`(`parcoursReferenceId`),
    INDEX `Formation_diplomeReferenceId_idx`(`diplomeReferenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AvisEtablissement` (
    `id` VARCHAR(191) NOT NULL,
    `formationId` VARCHAR(191) NOT NULL,
    `etablissementId` VARCHAR(191) NOT NULL,
    `noteEnseignement` INTEGER NULL,
    `noteInfrastructures` INTEGER NULL,
    `noteInsertion` INTEGER NULL,
    `noteAmbiance` INTEGER NULL,
    `commentaire` VARCHAR(191) NULL,
    `anneePromo` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AvisEtablissement_formationId_key`(`formationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Experience` (
    `id` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `poste` VARCHAR(191) NOT NULL,
    `entreprise` VARCHAR(191) NOT NULL,
    `ville` VARCHAR(191) NULL,
    `pays` VARCHAR(191) NULL,
    `secteur` VARCHAR(191) NULL,
    `dateDebut` DATETIME(3) NOT NULL,
    `dateFin` DATETIME(3) NULL,
    `estActuel` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Synergie` (
    `id` VARCHAR(191) NOT NULL,
    `demandeurId` VARCHAR(191) NOT NULL,
    `recepteurId` VARCHAR(191) NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'ACCEPTE', 'REFUSE') NOT NULL DEFAULT 'EN_ATTENTE',
    `raison` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Synergie_demandeurId_recepteurId_key`(`demandeurId`, `recepteurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NULL,
    `estGroupe` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationMembre` (
    `conversationId` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `rejointLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`conversationId`, `profilId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `contenu` VARCHAR(191) NOT NULL,
    `lu` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Volontaire` (
    `id` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `specialite` VARCHAR(191) NOT NULL,
    `disponible` BOOLEAN NOT NULL DEFAULT true,
    `fuseau` VARCHAR(191) NOT NULL DEFAULT 'Africa/Bamako',
    `dureeCreneau` INTEGER NOT NULL DEFAULT 30,
    `delaiMinResa` INTEGER NOT NULL DEFAULT 24,

    UNIQUE INDEX `Volontaire_profilId_key`(`profilId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RendezVous` (
    `id` VARCHAR(191) NOT NULL,
    `volontaireId` VARCHAR(191) NOT NULL,
    `demandeurId` VARCHAR(191) NOT NULL,
    `debut` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NOT NULL,
    `motif` VARCHAR(191) NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'ACCEPTE', 'REFUSE', 'ANNULE') NOT NULL DEFAULT 'EN_ATTENTE',
    `lienAppel` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cercle` (
    `id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `theme` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `presidentId` VARCHAR(191) NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CercleMembre` (
    `cercleId` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'ACCEPTE', 'REFUSE') NOT NULL DEFAULT 'EN_ATTENTE',
    `motivation` VARCHAR(191) NULL,
    `rejointLe` DATETIME(3) NULL,

    PRIMARY KEY (`cercleId`, `profilId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CercleDocument` (
    `id` VARCHAR(191) NOT NULL,
    `cercleId` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CercleReunion` (
    `id` VARCHAR(191) NOT NULL,
    `cercleId` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `ordreJour` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `lienAppel` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CercleMessage` (
    `id` VARCHAR(191) NOT NULL,
    `cercleId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `contenu` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ForumQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `contenu` VARCHAR(191) NOT NULL,
    `secteur` VARCHAR(191) NULL,
    `etablissementId` VARCHAR(191) NULL,
    `valide` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ForumReponse` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `contenu` VARCHAR(191) NOT NULL,
    `estAcceptee` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Association` (
    `id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `pays` VARCHAR(191) NOT NULL,
    `site` VARCHAR(191) NULL,
    `responsableId` VARCHAR(191) NULL,
    `valide` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssociationMembre` (
    `associationId` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'VERIFIE', 'DECLARE') NOT NULL DEFAULT 'EN_ATTENTE',
    `rejointLe` DATETIME(3) NULL,

    PRIMARY KEY (`associationId`, `profilId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evenement` (
    `id` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `lieu` VARCHAR(191) NULL,
    `lienVideo` VARCHAR(191) NULL,
    `dateDebut` DATETIME(3) NOT NULL,
    `dateFin` DATETIME(3) NULL,
    `capacite` INTEGER NULL,
    `organisateurId` VARCHAR(191) NOT NULL,
    `valide` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvenementParticipant` (
    `evenementId` VARCHAR(191) NOT NULL,
    `profilId` VARCHAR(191) NOT NULL,
    `inscritLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`evenementId`, `profilId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Offre` (
    `id` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `entreprise` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `secteur` VARCHAR(191) NOT NULL,
    `pays` VARCHAR(191) NOT NULL,
    `ville` VARCHAR(191) NULL,
    `teletravail` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NOT NULL,
    `lienCandidature` VARCHAR(191) NULL,
    `emailContact` VARCHAR(191) NULL,
    `dateExpiration` DATETIME(3) NULL,
    `publieurId` VARCHAR(191) NOT NULL,
    `valide` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Signalement` (
    `id` VARCHAR(191) NOT NULL,
    `signaleurId` VARCHAR(191) NOT NULL,
    `cibleType` VARCHAR(191) NOT NULL,
    `cibleId` VARCHAR(191) NOT NULL,
    `motif` VARCHAR(191) NOT NULL,
    `traite` BOOLEAN NOT NULL DEFAULT false,
    `noteInterne` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Annonce` (
    `id` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `contenu` VARCHAR(191) NOT NULL,
    `epingle` BOOLEAN NOT NULL DEFAULT false,
    `auteurId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_parrainId_fkey` FOREIGN KEY (`parrainId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Profil` ADD CONSTRAINT `Profil_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Etablissement` ADD CONSTRAINT `Etablissement_paysCode_fkey` FOREIGN KEY (`paysCode`) REFERENCES `PaysEducation`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtablissementNiveau` ADD CONSTRAINT `EtablissementNiveau_etablissementId_fkey` FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtablissementAlias` ADD CONSTRAINT `EtablissementAlias_etablissementId_fkey` FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgrammeEducation` ADD CONSTRAINT `ProgrammeEducation_paysCode_fkey` FOREIGN KEY (`paysCode`) REFERENCES `PaysEducation`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgrammeEducation` ADD CONSTRAINT `ProgrammeEducation_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ProgrammeEducation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiplomeEducation` ADD CONSTRAINT `DiplomeEducation_paysCode_fkey` FOREIGN KEY (`paysCode`) REFERENCES `PaysEducation`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtablissementProgramme` ADD CONSTRAINT `EtablissementProgramme_etablissementId_fkey` FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtablissementProgramme` ADD CONSTRAINT `EtablissementProgramme_programmeId_fkey` FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeEducation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtablissementProgramme` ADD CONSTRAINT `EtablissementProgramme_diplomeId_fkey` FOREIGN KEY (`diplomeId`) REFERENCES `DiplomeEducation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SourceEducative` ADD CONSTRAINT `SourceEducative_paysCode_fkey` FOREIGN KEY (`paysCode`) REFERENCES `PaysEducation`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtablissementSource` ADD CONSTRAINT `EtablissementSource_etablissementId_fkey` FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtablissementSource` ADD CONSTRAINT `EtablissementSource_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `SourceEducative`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgrammeSource` ADD CONSTRAINT `ProgrammeSource_programmeId_fkey` FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeEducation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgrammeSource` ADD CONSTRAINT `ProgrammeSource_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `SourceEducative`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiplomeSource` ADD CONSTRAINT `DiplomeSource_diplomeId_fkey` FOREIGN KEY (`diplomeId`) REFERENCES `DiplomeEducation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiplomeSource` ADD CONSTRAINT `DiplomeSource_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `SourceEducative`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OffreFormationSource` ADD CONSTRAINT `OffreFormationSource_offreId_fkey` FOREIGN KEY (`offreId`) REFERENCES `EtablissementProgramme`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OffreFormationSource` ADD CONSTRAINT `OffreFormationSource_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `SourceEducative`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportEducation` ADD CONSTRAINT `ImportEducation_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `SourceEducative`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportEducation` ADD CONSTRAINT `ImportEducation_paysCode_fkey` FOREIGN KEY (`paysCode`) REFERENCES `PaysEducation`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContributionSuggestionCatalogue` ADD CONSTRAINT `ContributionSuggestionCatalogue_suggestionId_fkey` FOREIGN KEY (`suggestionId`) REFERENCES `SuggestionCatalogue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationAdmin` ADD CONSTRAINT `NotificationAdmin_suggestionId_fkey` FOREIGN KEY (`suggestionId`) REFERENCES `SuggestionCatalogue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Formation` ADD CONSTRAINT `Formation_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Formation` ADD CONSTRAINT `Formation_etablissementId_fkey` FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Formation` ADD CONSTRAINT `Formation_programmeReferenceId_fkey` FOREIGN KEY (`programmeReferenceId`) REFERENCES `ProgrammeEducation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Formation` ADD CONSTRAINT `Formation_parcoursReferenceId_fkey` FOREIGN KEY (`parcoursReferenceId`) REFERENCES `ProgrammeEducation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Formation` ADD CONSTRAINT `Formation_diplomeReferenceId_fkey` FOREIGN KEY (`diplomeReferenceId`) REFERENCES `DiplomeEducation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AvisEtablissement` ADD CONSTRAINT `AvisEtablissement_formationId_fkey` FOREIGN KEY (`formationId`) REFERENCES `Formation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AvisEtablissement` ADD CONSTRAINT `AvisEtablissement_etablissementId_fkey` FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Experience` ADD CONSTRAINT `Experience_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Synergie` ADD CONSTRAINT `Synergie_demandeurId_fkey` FOREIGN KEY (`demandeurId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Synergie` ADD CONSTRAINT `Synergie_recepteurId_fkey` FOREIGN KEY (`recepteurId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationMembre` ADD CONSTRAINT `ConversationMembre_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationMembre` ADD CONSTRAINT `ConversationMembre_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Volontaire` ADD CONSTRAINT `Volontaire_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RendezVous` ADD CONSTRAINT `RendezVous_volontaireId_fkey` FOREIGN KEY (`volontaireId`) REFERENCES `Volontaire`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RendezVous` ADD CONSTRAINT `RendezVous_demandeurId_fkey` FOREIGN KEY (`demandeurId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CercleMembre` ADD CONSTRAINT `CercleMembre_cercleId_fkey` FOREIGN KEY (`cercleId`) REFERENCES `Cercle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CercleMembre` ADD CONSTRAINT `CercleMembre_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CercleDocument` ADD CONSTRAINT `CercleDocument_cercleId_fkey` FOREIGN KEY (`cercleId`) REFERENCES `Cercle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CercleReunion` ADD CONSTRAINT `CercleReunion_cercleId_fkey` FOREIGN KEY (`cercleId`) REFERENCES `Cercle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CercleMessage` ADD CONSTRAINT `CercleMessage_cercleId_fkey` FOREIGN KEY (`cercleId`) REFERENCES `Cercle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForumReponse` ADD CONSTRAINT `ForumReponse_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `ForumQuestion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssociationMembre` ADD CONSTRAINT `AssociationMembre_associationId_fkey` FOREIGN KEY (`associationId`) REFERENCES `Association`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssociationMembre` ADD CONSTRAINT `AssociationMembre_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvenementParticipant` ADD CONSTRAINT `EvenementParticipant_evenementId_fkey` FOREIGN KEY (`evenementId`) REFERENCES `Evenement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvenementParticipant` ADD CONSTRAINT `EvenementParticipant_profilId_fkey` FOREIGN KEY (`profilId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offre` ADD CONSTRAINT `Offre_publieurId_fkey` FOREIGN KEY (`publieurId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Signalement` ADD CONSTRAINT `Signalement_signaleurId_fkey` FOREIGN KEY (`signaleurId`) REFERENCES `Profil`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

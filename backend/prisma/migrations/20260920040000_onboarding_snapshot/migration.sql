-- Le questionnaire complet sert à restituer fidèlement les champs d'édition
-- qui n'ont pas tous un équivalent dans les tables métier normalisées.
ALTER TABLE `Profil`
  ADD COLUMN `onboardingDonnees` JSON NULL;

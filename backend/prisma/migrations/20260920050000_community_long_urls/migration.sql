-- Application and video URLs routinely exceed the historical VARCHAR(191)
-- limit. Widening to TEXT is non-destructive and matches the API validation.
ALTER TABLE `Evenement` MODIFY `lienVideo` TEXT NULL;
ALTER TABLE `Offre` MODIFY `lienCandidature` TEXT NULL;

-- Optional profile links. Existing LinkedIn values and all profile data are preserved.
ALTER TABLE `Profil`
  MODIFY COLUMN `linkedin` VARCHAR(500) NULL,
  ADD COLUMN `facebook` VARCHAR(500) NULL,
  ADD COLUMN `instagram` VARCHAR(500) NULL,
  ADD COLUMN `tiktok` VARCHAR(500) NULL;

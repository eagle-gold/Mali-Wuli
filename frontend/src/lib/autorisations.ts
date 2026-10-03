export const PERMISSIONS_ADMINISTRATION = [
  "OFFRES_MODERER", "EVENEMENTS_MODERER", "CATALOGUE_GERER",
  "ASSOCIATIONS_GERER", "PUBLICATIONS_MODERER", "MEMBRES_GERER", "SIGNALEMENTS_CONSULTER", "ROLES_GERER", "STATS_CONSULTER",
] as const;
export type PermissionAdministration = typeof PERMISSIONS_ADMINISTRATION[number];
export type AutorisationsUtilisateur = {
  role?: string | null;
  rolesDelegues?: string[];
  permissions?: string[];
  revisionDroits?: string;
};

/** Les permissions viennent de l’API. Un champ absent n’accorde aucun accès. */
export function aPermission(utilisateur: AutorisationsUtilisateur | null | undefined, permission: PermissionAdministration) {
  return Array.isArray(utilisateur?.permissions) && utilisateur.permissions.includes(permission);
}

export function aAccesAdministration(utilisateur: AutorisationsUtilisateur | null | undefined) {
  return PERMISSIONS_ADMINISTRATION.some((permission) => aPermission(utilisateur, permission));
}

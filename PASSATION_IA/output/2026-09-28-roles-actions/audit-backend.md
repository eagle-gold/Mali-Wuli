# Audit des autorisations backend — 28 septembre 2026

Lecture de la source active `MALI-WULI-hostinger-integration/backend`, sans accès DB/SSH. Le modèle a été ajusté après confirmation utilisateur : cinq domaines cumulables **INSCRIPTIONS, OFFRES, EVENEMENTS, CATALOGUE, ASSOCIATIONS**. Signalements et cercles ne deviennent pas de nouveaux rôles proposés.

## État constaté et invariants

- `authenticate` vérifie le JWT, relit rôle/statut/email/tokenVersion en base et ignore le rôle déclaré dans le JWT. ADMIN est effectif seulement pour le rôle DB ADMIN et l’adresse propriétaire désignée dans `lib/roles.ts`.
- `/auth/register`, login mot de passe, login OTP et `/users/me` normalisent le rôle. `ADMIN_EMAILS` ne peut plus attribuer un rôle administrateur.
- Seul le propriétaire gère les rôles et les statistiques administratives. Un changement de rôle actuel utilise une transaction Serializable, révoque OTP et tokenVersion, puis déconnecte les sockets après commit.
- Les autorisations d’un auteur, d’un participant, du responsable d’une association et du président historique d’un cercle sont des droits sur une ressource, indépendants des rôles délégués.
- Le booléen `moderateur` des services offres/événements contrôle aussi les listes privées, compteurs, modifications et suppressions. Modifier seulement les middlewares de validation serait insuffisant.
- Le service associations utilise aujourd’hui un booléen `administrateur` : il faut distinguer le gestionnaire délégué du véritable administrateur principal, notamment pour l’auto-approbation d’une affiliation.

## Cartographie des endpoints et contrôles à convertir

| Domaine | Surfaces | Permission future |
|---|---|---|
| Inscriptions | GET `/admin/inscriptions`, PUT `/admin/inscriptions/:id/valider`, PUT `.../refuser` | `INSCRIPTIONS_GERER` ; délégué limité EN_ATTENTE, exclut soi/propriétaire/tout compte délégué ou ancien MODERATEUR |
| Offres | GET liste/détail privés, compteurs attente, PATCH/DELETE d’autrui, PATCH `/offres/:id/validation` | `OFFRES_MODERER`, propagée à `offre.service.acteur` ; dépôt/édition restent en attente même par modérateur |
| Événements | GET listes privées/détails, PATCH/DELETE d’autrui, validation, couvertures, album/suppression photo | `EVENEMENTS_MODERER`, propagée au service et préautorisation avant Multer ; conserver le comportement existant de publication par modérateur |
| Catalogue | GET `/admin/notifications`, PUT `/admin/notifications/:id/lire`, GET `/admin/catalogue/suggestions`, PUT décisions accepter/refuser | `CATALOGUE_GERER` ; les notifications catalogue ne sont pas les notifications personnelles |
| Associations | Création/édition administrative, inactives, recherche responsables, suggestions, gestion toutes affiliations, médias | `ASSOCIATIONS_GERER` ; responsable désigné inchangé, auto-approbation de sa propre affiliation reste propriétaire seulement |
| Gestion des accès | GET `/admin/roles`, GET `/admin/membres`, PATCH délégations | Propriétaire unique ; aucun délégué ne peut attribuer des droits |
| Statistiques admin | GET `/admin/stats` | Propriétaire uniquement |
| Signalements | GET `/admin/signalements` | Permission historique `SIGNALEMENTS_CONSULTER` pour propriétaire/ancien MODERATEUR ; pas de nouvelle mutation inventée |
| Cercles historiques | POST `/cercles`, demandes membres, PATCH/DELETE d’autrui | Permission historique `CERCLES_GERER` pour propriétaire/ancien MODERATEUR ; aucune UI cercle nouvelle |

`publication.routes.ts` autorise la suppression à l’auteur (commentaire : auteur du commentaire ou de la publication), sans exception globale. Messagerie : appartenance à la conversation ; notifications : destinataire personnel ; synergies : participants ; volontariat/RDV : demandeur ou volontaire. Ne pas étendre ces surfaces aux spécialistes.

Les références publiques d’éducation et les propositions faites par un membre restent régies par leurs gardes actuelles. L’affiliation pendant onboarding utilise son routeur séparé ; ne pas élargir l’exemption d’authentification.

## Modèle retenu

Table additive `UserRoleGrant` : `userId`, `code` String, `createdAt`, clé composée `(userId,code)`, index `code`, FK User cascade. Aucun changement des anciens enums et aucun backfill nécessaire : le MODERATEUR historique conserve explicitement ses anciennes permissions via un registre.

Registre en code, seul endroit associant rôles proposés à permissions :

- INSCRIPTIONS → INSCRIPTIONS_GERER
- OFFRES → OFFRES_MODERER
- EVENEMENTS → EVENEMENTS_MODERER
- CATALOGUE → CATALOGUE_GERER
- ASSOCIATIONS → ASSOCIATIONS_GERER

Le MODERATEUR historique reçoit les quatre premiers domaines et SIGNALEMENTS_CONSULTER/CERCLES_GERER, **pas** ASSOCIATIONS_GERER. Il n’est plus attribuable. Un spécialiste reste MEMBRE en base et reçoit seulement ses grants. Une édition explicite d’un ancien MODERATEUR le remplace par la combinaison choisie, avec avertissement UI sur la perte des droits historiques supplémentaires.

Le registre facilite l’ajout de préréglages ou la composition de permissions déjà implémentées sans migration d’enum. Un nouveau domaine fonctionnel exigera toujours un contrôle serveur explicite : le stockage générique ne doit jamais signifier accès automatique à des endpoints inconnus.

## Contrat JSON et concurrence

`/users/me` et réponses d’authentification : `rolesDelegues:string[]`, `permissions:string[]`, rôle principal inchangé. Le middleware dérive les permissions depuis la base à chaque requête, jamais depuis le corps ou le JWT.

`GET /admin/roles` retourne les cinq définitions avec code/libellé/description/permissions/attribuable. `GET /admin/membres` conserve q/statut/role/page/limite et ajoute `roleDelegue=OFFRES`. Chaque membre retourne les grants stockés (ancien MODERATEUR sans grants → []), permissions effectives et `revisionDroits`.

`PATCH /admin/membres/:id/roles` : `{rolesDelegues, expectedRevision}` strict. Révision SHA256 du rôle DB, grants triés et tokenVersion. Transaction Serializable : relire propriétaire et cible, vérifier compte validé et email confirmé, protéger soi/ADMIN, comparer révision, CAS tokenVersion, remplacer grants, normaliser rôle à MEMBRE, supprimer OTP. Déconnecter les sockets après commit. Une liste vide retire les délégations. Un no-op ne révoque pas inutilement les sessions. Ancien PATCH rôle simple retourne 409 demandant la nouvelle interface.

## Temps réel et tests

Socket.IO n’offre aucune action d’administration : son handshake relit statut/email/tokenVersion, puis les événements de conversation vérifient l’appartenance. Réutiliser `revoquerSocketsUtilisateur` après modification d’accès. Ne pas créer de salon administrateur public ni exposer les grants via un événement global.

Tests attendus : chacune des cinq permissions isolée, combinaisons, aucun droit croisé, ADMIN unique, spécialiste jamais ADMIN/MODERATEUR, ancien global conservé, édition/retrait/collision de révision, JWT ancien révoqué, OTP supprimé, sockets après commit uniquement, absence d’effets au rollback, propriétaire protégé, associations auto-approbation refusée au délégué, offre/PDF/messagerie inchangés. Tests RAM avec garde bloquant réseau, Prisma réel et SMTP.

## Fichiers à modifier

`schema.prisma`, migration additive ; `lib/roles.ts`, `middlewares/auth.middleware.ts` ; `routes/auth.routes.ts`, `routes/user.routes.ts`, `routes/admin.routes.ts`, `services/admin-membres.service.ts` ; couples routes/services offres, événements, associations ; `routes/cercle.routes.ts` et helper communautaire si devenu inutilisé ; tests d’autorisation et fixtures.

Aucune modification des données de production exécutée pendant cet audit. Migration et déploiement restent des opérations distinctes orchestrées par le parent.

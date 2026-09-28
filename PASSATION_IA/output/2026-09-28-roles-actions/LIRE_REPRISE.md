# Reprise — rôles spécialisés cumulables

Livraison du 28 septembre 2026. Lire d’abord le journal partagé, puis LIRE_EN_PREMIER et le guide 05. La source active est dans `../MALI-WULI-hostinger-integration`. Aucun commit ni push ; préserver tout l’état non commité.

## Fonctionnement livré

L’administrateur général `ik736764@gmail.com` choisit une combinaison de cinq rôles : inscriptions, offres, événements, catalogue scolaire et associations. Dans **Administration → Membres et rôles**, rechercher une personne, ouvrir **Modifier les rôles**, cocher les choix, vérifier le récapitulatif puis confirmer. Tout décocher retire les délégations sans supprimer le compte.

Les contrôles s’appliquent aux API et aux services. Chaque domaine reste indépendant ; les délégués ne deviennent jamais ADMIN. Le compte propriétaire est protégé. Les comptes non validés ou sans e-mail confirmé ne peuvent pas recevoir de rôle. La modification des droits invalide les sessions, OTP et sockets de la cible.

Le volontariat et la responsabilité d’une association précise restent distincts. Le rôle Gestion des associations permet d’administrer toutes les associations, mais pas de valider sa propre affiliation. L’ancien MODERATEUR global reste compatible jusqu’à modification explicite ; il n’est plus attribuable. L’interface avertit des droits historiques retirés lors de sa conversion.

## Publication

- Frontend et backend : `versions/20260928-roles-actions`.
- Build frontend : `FuGDWQkQpcBCevVL404El`.
- Anciennes cibles : `versions/20260928-fond-mobile-roles`, conservées dans `.previous-target`.
- Migration appliquée : `20260928210000_delegated_roles`, soit 14 migrations au total.
- Base : `u668963025_maliwuli`. La nouvelle table UserRoleGrant est vide ; aucun backfill ni rôle réel attribué.
- Sauvegarde privée : `/home/u668963025/private-backups/20260928-roles-actions/before.sql.gz`, 31 534 306 octets. Gzip et SHA vérifiés. Compteurs et empreinte des droits User préservés.

## Contrat technique

`backend/src/lib/roles.ts` contient le registre des cinq codes et leurs permissions. Les combinaisons existantes se changent dans l’interface ; un nouveau domaine métier nécessite naturellement son contrôle backend.

`UserRoleGrant(userId, code, createdAt)` possède une clé primaire composite et une relation vers User. Le code est une chaîne filtrée par le registre : un code inconnu n’accorde rien. L’authentification relit les grants depuis la base et renvoie `rolesDelegues:string[]` et `permissions:string[]`.

La gestion administrative expose une `revisionDroits:string`, empreinte SHA-256 du rôle DB, des grants triés et de tokenVersion. `PATCH /api/admin/membres/:id/roles` reçoit `{rolesDelegues, expectedRevision}`. Seul le propriétaire validé est autorisé. La modification utilise une transaction sérialisable et un contrôle de version, puis révoque les sessions. L’ancien endpoint `/role` répond 409 et demande d’utiliser la nouvelle interface.

Les permissions frontend viennent uniquement de l’API ; un champ absent n’ouvre aucun accès. La page Administration appelle seulement les endpoints autorisés. Les boutons d’édition d’offre suivent `peutModifier`, calculé par le backend.

## Preuves

- `verification.json` : synthèse finale.
- `installed-final.json` : 36 fichiers modifiés ou ajoutés ; `before/` et `before-manifest.json` : références initiales.
- `source-manifest.json` : 222 sources compilées et publiées.
- `tests-backend.json` : 70 tests réussis ; `tests-frontend-roles.log` : 11 groupes ; `tests-deploy-scripts.json` : 4 groupes.
- `audit-independant.md` : revue sans défaut bloquant.
- `browser-verification.json` et `roles-cumulables.png` : interface testée sur comptes fictifs en mémoire, cumul et refus d’accès, largeurs 320/375/768/1280.
- `live-browser.json` : nouvelle page publique chargée, visiteur anonyme redirigé vers la connexion.
- `frontend-public.json` : 25 routes, 66 assets et 39 bundles conformes. Les deux PNG historiquement recompressés sont vérifiés par pixels et empreintes.
- `database-after.json` : 14 migrations et compteurs préservés.

## Limites et état d’arrêt

Aucune attribution de rôle réelle, aucun e-mail de test. Les interactions ont utilisé une API fictive en RAM ; le service compilé a été vérifié sur la base réelle en lecture seule. Le scénario de refus à un compte ordinaire éligible n’était pas réalisable avec les comptes de production disponibles ; il est couvert par les tests backend.

Pas de téléphone physique, Safari, mutation concurrente réelle MySQL ou répétition de restauration. Socket.IO n’est pas implémenté par les fixtures locales : leurs 404 sont attendus. Serveurs locaux arrêtés, onglets temporaires fermés, viewport rétabli. Aucune fonction à moitié écrite.

## Attention aux scripts

`aide-deploiement.md` décrit les scripts figés de cette publication, déjà exécutée. Ne pas les relancer automatiquement pour un autre lot. La migration doit précéder l’activation du nouveau backend, car authenticate lit User.rolesDelegues.

Le dossier `staging/backend/.verification` est un overlay de test : ne jamais le copier dans le dépôt ou une archive de publication. Les secrets restent privés sur le serveur ; aucun `.env` n’est inclus dans output.

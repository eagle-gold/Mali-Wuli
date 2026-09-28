# Préparation de publication — rôles par actions

28 septembre 2026. Cette aide et les scripts du dossier sont préparés depuis les deux lots précédents, sans SSH, connexion DB, création d'archive ni déploiement. Les tests locaux portent sur les scripts uniquement. L'agent principal conserve le journal, l'installation des sources et l'exécution de la publication.

## Versions et contrat figés

- Candidate : `20260928-roles-actions`.
- Les deux liens `current` attendus avant bascule : `versions/20260928-fond-mobile-roles`.
- Baseline de sources distante : **220 fichiers**, repris exactement du `source-manifest.json` du lot fond/mobile.
- Baseline DB : **13 migrations** appliquées, dont `20260928200000_job_applications` ; empreintes historiques toutes conservées dans `migration-contract.json`.
- Seule migration nouvelle : `20260928210000_delegated_roles`.
- SHA-256 du SQL relu : `67d8f0e24b2630378e2a28aa6724568afb85282a29168e4545c3946bd2942945`.
- Effet SQL : création de `UserRoleGrant(userId, code, createdAt)`, clé primaire `(userId,code)`, index `UserRoleGrant_code_idx`, FK `UserRoleGrant_userId_fkey` vers `User.id`, cascades suppression/mise à jour. Collation `utf8mb4_unicode_ci`, dates en millisecondes. Aucun backfill, `UPDATE User`, changement d'enum ni suppression.
- Le service expose cinq rôles délégués : `INSCRIPTIONS`, `OFFRES`, `EVENEMENTS`, `CATALOGUE`, `ASSOCIATIONS`. Le registre/factory a été relu pour adapter le contrôle d'exploitation ; la matrice métier reste vérifiée par les agents backend/UI.

Si le SQL change, **ne pas contourner le garde** : faire relire la nouvelle migration, mettre à jour son empreinte, recompiler la candidate et refaire les preuves. Les scripts sont propres à cette version.

## Fichiers préparés et origine

| Nouveau fichier | Source / adaptation |
| --- | --- |
| `compare-production.cjs` | Preuve **avant publication** : manifest de 220 sources du lot fond/mobile ; vérifie aussi les deux `current` précédents. Ne certifie pas la candidate. |
| `package-sources.py` | Adaptation du packager fond/mobile. Vérifie que chaque fichier staging non caché correspond au dépôt actif, exclut les chemins cachés et symlinks ; inclut `backend/src`, `prisma`, `assets`, `frontend/src`, `public`, manifests et configurations. Écrit les deux archives, le nouveau `source-manifest.json`, `compare-candidate.cjs` et `compare-current.cjs`. |
| `build-backend.sh` | Version et nom d'archive mis à jour ; `npm ci` puis `prisma generate && tsc`. Copie privée de l'environnement serveur existant, symlink vers les uploads existants. Aucun `migrate` dans le build. |
| `build-frontend.sh` | Source/version isolées, build Next Linux avec API publique explicite, assemblage standalone + static + public. Refuse `.env.local`. |
| `activate-backend.sh`, `activate-frontend.sh` | Bascule atomique du lien après double contrôle de la cible précédente ; conserve `.previous-target` et demande redémarrage Passenger. |
| `verify-release.cjs` | Smoke du lot fond/mobile conservant 25 routes, assets/fonts, home/inscription, recommandations, menus et beige. Contrat membres mis à jour : `rolesDelegues`, `expectedRevision`, « Rôles délégués ». Commentaire Unix corrigé vers le préfixe `mali-wuli-home-qa-`. |
| `verify-api-public.cjs` | GET `/health` et endpoints protégés sans session ; vérifie la réponse 401 et n'écrit rien. Ne prouve pas à lui seul les permissions spécialisées. |
| `backup-before.cjs` | Adaptation de la sauvegarde offres : nouvelle destination privée, compte aussi les tables candidatures/favoris, vérifie l'intégrité gzip et conserve une empreinte des valeurs `User(id,role,tokenVersion,statut,emailVerifie)` sans exporter les lignes dans le rapport. |
| `migration-contract.json` | Les 13 historiques et l'unique SQL approuvé ; statut `READY`. |
| `guard-migration.cjs` | SELECT + lectures de fichiers. Base/host attendus, 13 historiques identiques, aucune migration inachevée, seule additive pendante, nouvelle table absente, sources SQL exactes et liens `current` inchangés. Avec `--before`, vérifie les octets du dump contre le SHA enregistré. |
| `apply-migration.sh` | **Étape mutante explicite** : exécute le garde avec preuve de sauvegarde, `prisma migrate deploy`, puis le contrôle postmigration. Ne fait aucune bascule. |
| `check-database-readonly.cjs` | Avant activation : 14 migrations, table/colonnes/index/FK exacts, nouveaux grants vides, comptes existants inchangés et empreinte des droits `User` identique. Vérifie les relations du client Prisma généré et appelle le service sous garde antiécriture. |
| `verify-roles-service-readonly.cjs` | Réutilisable après application de la migration et après bascule : factory compilée avec proxy Prisma n'acceptant que les lectures ; rejette transactions/raw/writes, sockets et notifications. Vérifie catalogue, propriétaire protégé, révisions, absence de `tokenVersion` dans les réponses et refus d'un compte ordinaire existant. Aucun JWT ni attribution réelle. |
| `verify-deploy-scripts.cjs` | Tests locaux des scripts : syntaxe, SHA et nature additive, refus de sources migrations altérées/manquantes/supplémentaires, garde antiécriture. Résultats `tests-deploy-scripts.json`. |

Les scripts de build annulent `NODE_OPTIONS` et `MW_QA_SOCKET` hérités pour qu'un adaptateur de smoke ne contamine jamais le build. Les processus candidats peuvent ensuite recevoir ces variables explicitement.

## Ordre de publication recommandé

1. Terminer revue/QA métier et UI, puis installer le staging dans le dépôt actif avec la garde de sources de la session principale. Ne pas copier `.verification`, fixtures, output ou `.env`.
2. Exécuter **sur serveur** `compare-production.cjs` pour certifier le baseline actuel avant de préparer les nouvelles versions. Si la cible ou un hash a changé, réconcilier ; ne pas remplacer l'assertion par une valeur devinée.
3. Exécuter localement `package-sources.py` une fois les sources gelées. Il produit `backend-source.tar.gz`, `frontend-source.tar.gz` et le manifest de la candidate. La preuve historique ne doit jamais être rebaptisée en preuve candidate.
4. Transférer les archives sous les noms attendus : `roles-actions-backend-source.tar.gz` dans les hbuilds backend, `roles-actions-frontend-source.tar.gz` dans les hbuilds frontend. Exécuter les deux scripts de build. Les chemins de candidate doivent être absents au départ : ils ne sont pas écrasés.
5. Contrôler `compare-candidate.cjs` (**nouveau manifest complet**), les tests Linux requis, le smoke frontend candidat et la signature sémantique de la home/inscription. Le smoke frontend n'interroge pas le backend avec une session et peut tourner avant migration.
6. Transférer ensemble le contrat, les scripts de migration/lecture et la sauvegarde. Exécuter d'abord `guard-migration.cjs` sans `--before` pour le précontrôle, puis `backup-before.cjs > database-before.json`. Le dump reste sous `private-backups/20260928-roles-actions/before.sql.gz`, modes 0700/0600. Ne pas rapatrier le dump dans le dépôt.
7. Lancer seulement à l'étape autorisée `apply-migration.sh /CHEMIN_ABSOLU/database-before.json`. Elle écrit `migration-guard.json`, `migration.log`, `database-after.json`. La migration est une écriture SQL ; les contrôles qui l'entourent sont en lecture seule. Un échec après DDL exige inspection avant toute relance : MySQL ne rend pas automatiquement atomique l'ensemble des opérations DDL.
8. Si postmigration PASS, activer backend puis frontend, en conservant les précédents liens. Le schéma additif doit exister **avant** le démarrage du backend qui lit `User.rolesDelegues`.
9. Vérifier API publique, smoke public contre **la candidate de cette release**, `compare-current.cjs`, liens `current` et BUILD_ID. Le vérificateur de service peut être relancé en lecture seule après bascule ; le contrôle postmigration complet, lui, exige encore les anciens `current` et appartient donc à l'étape 7.
10. Consigner les preuves et limites réelles, puis arrêter seulement les processus/onglets/socket de QA de cette session. Ne pas annoncer « aucune écriture DB » pour tout le lot : il y a une migration additive et son inscription dans `_prisma_migrations`, mais aucun rôle réel n'a besoin d'être attribué pour tester.

## Exemples de commandes réservées à l'agent principal

Ces exemples n'ont pas été exécutés. Adapter uniquement le répertoire où les scripts de QA ont été transférés, pas les cibles de version figées.

```sh
# Local, après intégration et gel :
python3 output/2026-09-28-roles-actions/package-sources.py

# Serveur, frontend candidat (adaptateur déjà disponible dans hbuilds) :
MW_QA_SOCKET=/tmp/mali-wuli-home-qa-roles-actions-$$.sock \
NODE_OPTIONS=--require=/home/u668963025/domains/mali-wuli.com/hbuilds/qa-unix-transport.cjs \
node verify-release.cjs \
  /home/u668963025/domains/mali-wuli.com/hbuilds/versions/20260928-roles-actions/nodejs \
  > frontend-candidate.json

# Serveur, garde préalable sans migration :
node guard-migration.cjs \
  --backend /home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/versions/20260928-roles-actions/nodejs

# Serveur, lecture seule après migration :
node verify-roles-service-readonly.cjs \
  --backend /home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/versions/20260928-roles-actions/nodejs \
  > roles-service-readonly.json

# Public, sans précharger le transport candidat :
node verify-release.cjs https://mali-wuli.com \
  --reference frontend-candidate.json \
  --image-equivalence /CHEMIN/public-images-comparison.json \
  > frontend-public.json
```

Une baseline sémantique explicite peut être capturée avec `--baseline-only`, puis transmise en `--baseline baseline.json` aux contrôles suivants. Le lot précédent fournit déjà une baseline vérifiée si la home/inscription n'ont pas changé.

## Pièges vérifiés dans les anciens scripts

- `offres-emploi/guard-migration.cjs` attend **12→13**, l'absence des tables candidatures et des versions plus anciennes : il ne convient pas au nouveau lot. Le SQL jobs est désormais historique et ne doit pas être rejoué.
- `fond-mobile-roles/compare-production.cjs` contient **214 sources du baseline offres**. C'était une preuve avant publication du lot mobile ; la preuve candidate mobile est de 220. Le nouveau `compare-production.cjs` contient bien 220 et vérifie les versions fond/mobile.
- L'ancien contrôle réel des rôles impose seulement `MEMBRE/MODERATEUR` et 13 migrations. Le nouveau contrôle attend les cinq délégations et 14 migrations, sans aucune attribution réelle.
- Le proxy Unix historique refuse tous les chemins ne commençant pas par `/tmp/mali-wuli-home-qa-` ; certains anciens commentaires indiquaient à tort `events-qa-`. Son `NODE_OPTIONS` est réservé au smoke et à son enfant `server.js`, jamais à Passenger.
- Les deux PNG (`/images/landing/mali-wuli-arbre.png`, `/images/logo-mali-wuli.png`) peuvent être recompressés sans perte par Hostinger. La preuve historique existe dans `output/2026-09-28-annuaire-associations/public-images-comparison.json`. Le smoke exige qu'elle corresponde aux **SHA binaires actuels** candidate/public, aux pixels RGBA et dimensions. Si les hashes changent, refaire la comparaison ; tous les autres assets doivent rester identiques octet par octet.
- Une sauvegarde valide n'est pas une répétition de restauration. Ici, gzip et SHA sont contrôlés ; la restauration complète n'est pas testée. Les nombres de lignes et l'empreinte `User` sont des instantanés distincts du dump : activité concurrente légitime à examiner en cas de différence.
- Le smoke HTTP sans session certifie livraison de routes/bundles/assets et rejet sans authentification, pas la matrice de permissions. Conserver les tests métier et UI spécifiques des autres agents.
- Le rollback des liens conserve la table additive et ses données. Les anciennes versions ne comprennent pas les droits spécialisés : un retour arrière retire leur efficacité dans l'UI/API, sans effacer les grants. Ne pas appliquer de migration inverse destructive automatiquement.

## Résultat local disponible

`tests-deploy-scripts.json` : PASS, quatre groupes de contrôles, 13 historiques + 1 nouvelle migration liés au SQL exact. **0 SSH, 0 requête DB, 0 archive créée et 0 script opérationnel exécuté** pendant cette préparation.

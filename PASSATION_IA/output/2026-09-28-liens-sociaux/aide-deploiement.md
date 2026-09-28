# Liens sociaux — opérations préparées

Version cible : `20260928-liens-sociaux`, frontend et backend. Base observée le 28 septembre : frontend `20260928-home-session-r2`, build `ZbOkxHyHSm-qkR0dR9Qeh` ; backend `20260928-suppressions-droits`. **230 sources identiques et 14 migrations complètes vérifiées par SSH en lecture seule** dans `production-baseline-readonly.json`. Aucune sauvegarde, compilation, migration ou bascule exécutée par l’agent qui prépare ces scripts.

La migration unique `20260928220000_profile_social_links` ajoute trois colonnes facultatives et élargit LinkedIn. SQL SHA-256 `4589bd57ab81031d583431eba8e8477d572a220d47367debc7a1c918a3fbdf0b`. Aucun UPDATE/DELETE, backfill ou réduction de colonne. MariaDB renvoie le défaut SQL NULL sous forme de chaîne `NULL` : la garde le normalise, et conserve le contrôle de tous les autres attributs des colonnes.

## Ordre d’exécution pour la session principale

1. Finir les tests métier/UI et intégrer les sources approuvées. Exécuter localement `python3 output/2026-09-28-liens-sociaux/package-sources.py`. Il refuse schéma/SQL non revus et staging différent des sources actives. Il produit les deux archives, `source-manifest.json` et `package-contract.json`.
2. Copier les scripts `.cjs`/`.sh`, les deux contrats et les deux manifestes dans un même répertoire privé d’opérations, par exemple `$MW_BACK/liens-sociaux-ops`. Copier `backend-source.tar.gz` vers `$MW_BACK/liens-sociaux-backend-source.tar.gz`, et `frontend-source.tar.gz` vers `$MW_FRONT/liens-sociaux-frontend-source.tar.gz`. Ne pas copier `staging`, tests locaux ou la preuve contenant le dump : le dump reste uniquement dans le répertoire privé du serveur.
3. Exécuter les commandes serveur ci-dessous dans cet ordre. Les noms de preuves sont obligatoires pour la garde d’activation. Les scripts de build et de sauvegarde refusent d’écraser une version ou un dump existant.

```sh
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
unset NODE_OPTIONS MW_QA_SOCKET
MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
MW_OPS="$MW_BACK/liens-sociaux-ops"
MW_CANDIDATE="$MW_BACK/versions/20260928-liens-sociaux/nodejs"
MW_FRONT_CANDIDATE="$MW_FRONT/versions/20260928-liens-sociaux/nodejs"
cd "$MW_OPS"
umask 077
node compare-production.cjs > source-production-before.json
node check-database-readonly.cjs --backend "$MW_BACK/current/nodejs" --phase before > database-observed-before.json
node verify-release.cjs https://mali-wuli.com --baseline-only > public-baseline.json
sh build-backend.sh > build-backend.log 2>&1
sh build-frontend.sh > build-frontend.log 2>&1
node compare-candidate.cjs > source-candidate.json
node backup-before.cjs > database-before.json
sh apply-migration.sh "$MW_OPS/database-before.json"
MW_QA_SOCKET=/tmp/mali-wuli-home-qa-liens-sociaux.sock NODE_OPTIONS="--require=$MW_FRONT/qa-unix-transport.cjs" node verify-release.cjs "$MW_FRONT_CANDIDATE" --baseline public-baseline.json > candidate-smoke.json
sh activate-backend.sh
sh activate-frontend.sh
node compare-current.cjs > source-production-after.json
node check-database-readonly.cjs --backend "$MW_CANDIDATE" --phase after --before "$MW_OPS/database-before.json" > database-after.json
node verify-release.cjs https://mali-wuli.com --reference candidate-smoke.json --baseline public-baseline.json > public-smoke.json
```

L’opérateur conserve son contrôle avant chaque bascule. La garde d’activation exige migration et préservation réussies, source et smoke du même nouveau build, baseline home/inscription inchangée, et présence des quatre champs et liens sociaux dans les bundles. Elle impose backend puis frontend. Le build backend partage le répertoire d’uploads existant ; aucun fichier média n’est déplacé.

Si les deux PNG sont à nouveau recompressés par hcdn, ajouter uniquement `--image-equivalence /chemin/public-images-comparison.json`, après comparaison exacte des pixels source/public. La preuve existante du lot `2026-09-28-annuaire-associations` est réutilisable seulement si ses deux empreintes binaires correspondent encore à celles de cette exécution ; le script le vérifie. Aucun autre asset ne peut différer.

## Garde des données et limites

La sauvegarde MySQL gzip reste dans `/home/u668963025/private-backups/20260928-liens-sociaux/before.sql.gz` (dossier 0700, fichier 0600). Mot de passe transmis à `mysqldump` par environnement uniquement, jamais dans les arguments ou preuves. La gzip est relue intégralement et hachée ; ceci ne remplace pas un exercice de restauration.

Avant/après : 18 compteurs, empreintes comptes/rôles/statuts/tokenVersion, grants, et `(id, linkedin)` sont identiques. Toutes les anciennes colonnes Profil doivent rester identiques sauf la longueur LinkedIn. Les nouvelles valeurs doivent être NULL immédiatement après migration. Des éditions réelles pendant les contrôles provoqueront volontairement un échec à examiner ; ne pas remplacer la baseline pour masquer un écart. La migration est additive : un retour applicatif aux anciens `current` laisse les nouvelles colonnes en place, sans migration inverse ni perte de données.

Le smoke HTTP est anonyme : il ne remplit aucun profil, ne valide pas une persistance authentifiée et n’appelle aucune API mutable. Les tests métier/UI RAM complètent cette preuve. `verify-deploy-scripts.cjs` couvre sept groupes avec mocks : SQL exact, migrations déviantes, schéma réel MariaDB, conservation des données, dérive des sources, preuves d’activation et syntaxe des scripts. Rapport : `tests-deploy-scripts.json`.

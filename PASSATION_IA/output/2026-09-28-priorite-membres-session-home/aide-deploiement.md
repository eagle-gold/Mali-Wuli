# Publication du 28 septembre — priorité aux membres et session sur l’accueil

Ces scripts sont préparés et testés localement. Leur préparation n’a exécuté ni SSH, ni requête réelle de base, ni création d’archive, ni bascule. La session principale assure les opérations et conserve leurs preuves.

## Contrat figé

- Version cible : `20260928-priorite-membres-home`.
- Les deux liens `current` doivent encore viser `versions/20260928-roles-actions` avant activation.
- Ancien BUILD_ID frontend : `FuGDWQkQpcBCevVL404El` ; baseline de **222 sources** issue de `../2026-09-28-roles-actions/source-manifest.json`.
- **Aucune migration.** Les 14 migrations, leurs SHA-256 et le schéma Prisma sont identiques à la version précédente. `database-contract.json` contient cette référence fermée.
- Les scripts `apply-migration`, `guard-migration` et `backup-before` du lot précédent ne sont pas utilisés. Aucun `prisma migrate deploy`, `db push`, seed ou UPDATE n’est nécessaire.
- L’authentification de l’accueil reste une vérification côté navigateur. Aucun compte, jeton ou connexion de test réelle n’est créé par les vérificateurs.

## Scripts et ordre d’exécution

1. La preuve `source-production-before.json` a déjà été produite par la session principale avec `compare-production.cjs` : sources précédentes, liens `current` et BUILD_ID. Inutile de refaire cette baseline sans nouveau motif.
2. Intégrer les sources staging approuvées, terminer les tests métier/session et geler le lot. Exécuter localement `python3 package-sources.py`. Ce script refuse toute divergence staging/actif et tout changement de schéma/migration avant de créer les archives.
3. Les archives locales sont `frontend-source.tar.gz` et `backend-source.tar.gz`. Leurs noms attendus sur le serveur sont respectivement `priorite-membres-frontend-source.tar.gz` et `priorite-membres-backend-source.tar.gz`, dans le `hbuilds` de chaque site. La sortie du packaging donne leurs SHA-256 ; vérifier les copies.
4. Exécuter les deux scripts `build-frontend.sh` et `build-backend.sh`. Ils créent des dossiers neufs, gardent les liens courants et ne touchent pas au schéma. `.env` et les téléversements restent sur le serveur. Les builds désactivent les variables d’adaptateur QA.
5. Exécuter le nouveau `compare-candidate.cjs` généré par le packaging. Son manifeste porte sur toutes les sources du nouveau lot, pas seulement les fichiers modifiés.
6. Copier ensemble `database-contract.json`, `check-database-readonly.cjs` et `verify-priority-service-readonly.cjs` dans un dossier de vérification. Exécuter les phases `before`, puis `candidate` ci-dessous. **Les deux utilisent le backend candidat déjà compilé ; “before” signifie avant bascule, pas avant build.** Elles attendent toujours les anciens liens `current`.
7. Exécuter le smoke frontend candidat avec l’adaptateur Unix. Passer le résultat public vérifié de la version précédente à `--baseline`. L’inscription complète et la géométrie SVG sont conservées ; texte et liens de compte sur l’accueil évoluent volontairement.
8. Après toutes les preuves, activer backend puis frontend avec les scripts dédiés. Chaque script vérifie deux fois la cible précédente et remplace son lien atomiquement. Le lot étant sans migration, ancien et nouveau frontend utilisent le même schéma.
9. Exécuter le `compare-current.cjs` généré, la phase DB `after`, le smoke public contre le résultat candidat, puis `verify-api-public.cjs`. Conserver chaque résultat séparément.

Les scripts shell sont à lancer avec `sh`. Ils ne prennent pas de mot de passe et n’en impriment aucun. Aucun secret n’est inclus dans les archives locales.

## Base et tri : lectures seulement

Exemples à exécuter **sur le serveur par la session principale**, depuis le dossier où les trois fichiers de vérification sont copiés. Remplacer le chemin du dossier de preuves, pas les cibles de version :

```sh
MW_QA_DIR=/CHEMIN/ABSOLU/DU/DOSSIER/DE/PREUVES
MW_CANDIDATE_BACKEND=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/versions/20260928-priorite-membres-home/nodejs
env -u NODE_OPTIONS -u MW_QA_SOCKET node "$MW_QA_DIR/check-database-readonly.cjs" --backend "$MW_CANDIDATE_BACKEND" --phase before > "$MW_QA_DIR/database-before.json"
env -u NODE_OPTIONS -u MW_QA_SOCKET node "$MW_QA_DIR/check-database-readonly.cjs" --backend "$MW_CANDIDATE_BACKEND" --phase candidate --before "$MW_QA_DIR/database-before.json" > "$MW_QA_DIR/database-candidate.json"
```

Après activation des deux services :

```sh
env -u NODE_OPTIONS -u MW_QA_SOCKET node "$MW_QA_DIR/check-database-readonly.cjs" --backend "$MW_CANDIDATE_BACKEND" --phase after --before "$MW_QA_DIR/database-before.json" > "$MW_QA_DIR/database-after.json"
```

Ces lectures vérifient : 14 migrations terminées, aucun élément en attente, nom/base/hôte attendus, schéma exact, effectifs de 14 tables métier et empreintes des rôles/statuts/sessions et délégations. Les identités ne sont pas imprimées. Les services compilés reçoivent un proxy qui n’autorise que `find*`, `count`, `aggregate` et `groupBy` : écritures, transactions et SQL brut y sont refusés.

Le tri des associations et établissements est comparé à des décomptes globaux de profils éligibles distincts : onboarding fini, compte validé, et affiliation vérifiée pour les associations. Les pages 1 et 2 et la transition vers les structures sans membre sont contrôlées ; les compteurs affichés des associations sont aussi vérifiés. Seules les structures ayant des membres sont chargées en entier ; les structures sans membre restent paginées. Aucun plafond arbitraire n’est ajouté.

Les champs `exercisedNonEmptyOrder` et `exercisedDistinctCounts` disent ce que les données présentes permettent réellement de vérifier. Si aucun profil éligible n’existe, le contrôle d’association le signale comme non exercé. Les cas de filtres, égalités et pagination riche restent couverts par les tests RAM du backend. Des lectures successives ne forment pas un instantané transactionnel : une activité réelle concurrente peut faire échouer une comparaison. Examiner l’écart ; ne pas supprimer les assertions pour obtenir un résultat vert.

## Frontend candidat et public

Sur Hostinger, exemple candidat :

```sh
MW_QA_SOCKET=/tmp/mali-wuli-home-qa-$$.sock \
NODE_OPTIONS=--require=/home/u668963025/domains/mali-wuli.com/hbuilds/qa-unix-transport.cjs \
node "$MW_QA_DIR/verify-release.cjs" /home/u668963025/domains/mali-wuli.com/hbuilds/versions/20260928-priorite-membres-home/nodejs \
  --baseline "$MW_QA_DIR/frontend-public-roles-actions.json" > "$MW_QA_DIR/frontend-candidate.json"
```

Le candidat démarre temporairement son serveur Next puis l’arrête. Aucun JavaScript téléchargé n’est exécuté. Le contrôle exige le SSR `data-session-state="loading"`, sans flash de liens connexion/inscription, et la présence des branches visiteurs/membres et de `/users/me` dans les bundles. Il vérifie aussi les autres routes, les fichiers JS/CSS/polices/images, les menus sans cercles/Synergies, les recommandations conservées et le fond beige.

Après bascule, sans adaptateur :

```sh
env -u NODE_OPTIONS -u MW_QA_SOCKET node "$MW_QA_DIR/verify-release.cjs" https://mali-wuli.com \
  --reference "$MW_QA_DIR/frontend-candidate.json" \
  --image-equivalence "$MW_QA_DIR/public-images-comparison.json" > "$MW_QA_DIR/frontend-public.json"
env -u NODE_OPTIONS -u MW_QA_SOCKET node "$MW_QA_DIR/verify-api-public.cjs" > "$MW_QA_DIR/api-public.json"
```

La preuve de recompression PNG existe dans `../2026-09-28-annuaire-associations/public-images-comparison.json`. Elle ne vaut que pour les deux chemins explicitement documentés et si les SHA binaires actuels candidat/public, dimensions et SHA des pixels RGBA correspondent exactement. Tous les autres assets doivent être identiques octet pour octet. Les hashes bruts sont conservés dans le résultat.

Le smoke public ne remplace pas les tests de session : visiteur, membre validé, onboarding incomplet, inscription en attente, erreur réseau, session expirée et réponses arrivant dans le mauvais ordre doivent être vérifiés par les tests RAM et le navigateur de la session principale. Il ne prouve pas non plus le tri en exécutant une session réelle ; c’est le rôle du contrôle compilé en lecture seule ci-dessus.

## Vérification locale disponible

```sh
node output/2026-09-28-priorite-membres-session-home/verify-deploy-scripts.cjs
```

Résultat actuel : **6 groupes PASS**, dans `tests-deploy-scripts.json`. Syntaxes CJS/shell/Python, contrat 222 sources/14 migrations, refus de dérive des sources, blocage des écritures, protection des snapshots et détection de mauvais ordre/compteurs sont testés avec des fichiers temporaires et objets en mémoire. Aucune opération de publication n’est lancée par ce test.

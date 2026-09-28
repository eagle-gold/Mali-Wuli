# Liens sociaux — reprise du lot

**Terminé et publié le 28 septembre 2026.** Frontend et backend `versions/20260928-liens-sociaux`, build `MF940TX4N8sLGFRsT_gyN`. Migration `20260928220000_profile_social_links` appliquée sur `u668963025_maliwuli` : 15 migrations. Anciens current conservés : frontend home-session-r2, backend suppressions-droits. Lire `verification.json`, `public-smoke.json`, `runtime-after.json` et le journal. Aucun fichier partiel, commit ou push.

17 tests backend, 7 groupes frontend, 7 groupes scripts, TypeScript et builds Linux passent. 235 sources, 25 routes et 62 ressources publiques conformes. Compte fictif : ajout des quatre liens, validation, enregistrement complet, profils personnel/annuaire, réouverture et mobile320. Aucune donnée métier réelle modifiée.

La sauvegarde privée reste uniquement sur Hostinger : `/home/u668963025/private-backups/20260928-liens-sociaux/before.sql.gz`, 31534387 octets, gzip et empreinte vérifiés. Les 18 compteurs, rôles/statuts/sessions, délégations et anciens LinkedIn sont préservés.

**Incident de publication résolu :** les liens current et restart.txt étaient corrects mais les processus conservaient les anciennes versions. Toucher aussi les anciens tmp/restart.txt n’a pas suffi. `passenger-config` ne démarre pas (Ruby absent). Après vérification de chaque PID et de son `/proc/PID/cwd` exact, SIGTERM ciblé de l’ancien backend puis de l’ancien frontend ; Hostinger les a relancés. Santé API, nouveaux cwd et bundles publics comparés ensuite. `runtime-after.json` prouve la version exécutée. Ne jamais réutiliser les PID historiques ni lancer un kill global.

## Demande et parcours

LinkedIn, Facebook, Instagram et TikTok deviennent quatre champs facultatifs dans **Informations**, après la création du compte. **Modifier mes infos** ouvre le même formulaire via `/onboarding?etape=informations`. Aucune duplication dans les pages de création de compte. Les quatre liens valides apparaissent dans une carte **Réseaux sociaux**, sur le profil personnel et la fiche membre de l’annuaire, avec icône et nom. Ils restent visibles même si les coordonnées privées ne sont pas affichées. Ouverture dans un nouvel onglet avec `noopener noreferrer` ; aucune longue URL affichée comme libellé.

Le bouton **Continuer** de la première étape garde les informations dans l’état et le cache local. La persistance serveur se fait toujours au **terme du parcours onboarding**. Ne pas conclure à une sauvegarde en base après la seule première étape. Le GET serveur remplace les valeurs obsolètes du cache ; les profils consultés lisent leurs réponses API relationnelles, pas le brouillon local.

## Contrat API et données

Les quatre champs ont les mêmes noms plats : `linkedin`, `facebook`, `instagram`, `tiktok`.

| Route | Emplacement et comportement |
|---|---|
| `GET /users/me` | Dans `profil`, quatre valeurs `string | null` normalisées/filtrées. |
| `GET /users/:id` | Dans la fiche membre renvoyée, quatre valeurs `string | null` ; règles d’accès au profil inchangées. |
| `PUT /users/me`, `PATCH /users/me` | Champs plats facultatifs du corps ; réponse existante `{ message, user }`. |
| `GET /onboarding` | Dans `informations` ; valeurs relationnelles prioritaires sur le snapshot, y compris un `null` après effacement. |
| `POST /onboarding` | Champs dans `informations` ; persistance relationnelle et snapshot cohérents dans la transaction existante. |

Un champ omis conserve la valeur, afin de rester compatible avec les anciens clients. `null`, chaîne vide ou espaces seuls effacent explicitement. Une URL renseignée est nettoyée, validée par `new URL()` et normalisée : protocole HTTP(S), nom d’hôte, aucun identifiant utilisateur/mot de passe, 500 caractères maximum avant **et après** normalisation. Les caractères Unicode peuvent allonger la valeur encodée. Les anciens liens invalides ne sont pas exposés comme liens cliquables ; leur omission dans une écriture ne les supprime pas de la base. Pas de restriction aux domaines des marques, de requête distante de vérification ni de connexion OAuth.

Migration appliquée : `20260928220000_profile_social_links`. Elle élargit `Profil.linkedin` de `VARCHAR(191)` à `VARCHAR(500) NULL` et ajoute `facebook`, `instagram`, `tiktok` en `VARCHAR(500) NULL`. Aucune reprise de valeurs, suppression de données, table ou clé étrangère. Les 14 migrations précédentes doivent conserver leurs empreintes ; 15 sont appliquées après contrôle. Le PDF de candidature garde son seul LinkedIn existant, sans ajout des autres réseaux.

## Sources, tests et preuves

`installed.json` recense **14 fichiers intégrés** : huit frontend et six backend, dont la migration et les tests. Le package contient **235 sources**. `before/`, `baseline-source-manifest.json`, `source-manifest.json`, `package-contract.json` et `migration-contract.json` conservent les états et empreintes ; ne pas remplacer une ancienne référence pour masquer une différence.

Contrôles acquis à la rédaction :

- **17 tests backend réussis** : 13 tests sociaux et quatre régressions d’annuaire, vrais handlers et Prisma simulé. Le garde interdit sockets, HTTP, base et email réels. Résultats : `tests-backend-social.json` / `.tap` ; reproduction : `reproduce-backend-social-tests.sh`.
- **Sept groupes frontend réussis**, sources TS/TSX réelles, hooks/stockage/transport mémoire et rendu React statique. URL/Unicode, champs requis, focus et erreurs, effacement, ancien brouillon, cache prioritaire remplacé par GET, étapes et POST final, stockage refusé, profils personnel/public : `verify-liens-sociaux.cjs` et `frontend-social-tests.log`.
- **Overlay frontend : huit fichiers, zéro diagnostic**, sans émission de build. La session principale confirme également TypeScript réussi dans les deux applications intégrées. La mention de typecheck encore « Pending » dans le JSON des tests backend décrit le moment antérieur à l’intégration.
- **Production avant livraison : lecture seule réussie**, 230 sources, anciennes cibles, schéma et 14 migrations contrôlés dans `production-baseline-readonly.json`.

Contrôles finaux réussis : navigateur desktop/mobile320 (`browser-qa.json`), sauvegarde privée (`database-before.json`), builds Linux, migration15 et préservation (`database-after.json`), 235 sources (`source-production-after.json`), 25 routes/62 ressources (`public-smoke.json`), nouveaux processus et bundles (`runtime-after.json`). Aucun compte réel modifié pour tester.

## Livraison et retour arrière

Les scripts du dossier sont liés aux manifests, archives et cibles attendues de **ce lot**. Ils ne constituent pas une recette à rejouer pour un nouveau lot : relire le guide04, les traces et les liens `current` avant toute reprise. L’autorisation persistante donnée par l’utilisateur permet à la session principale de publier les lots achevés après vérifications ; elle ne dispense pas des sauvegardes ni des gardes.

La migration modifie le schéma MySQL ; un retour arrière applicatif ne l’annule pas. Après application, l’ancien code peut conserver les colonnes supplémentaires et l’élargissement de LinkedIn. Ne pas supprimer ces colonnes ni rétrécir LinkedIn pour un simple rollback d’application : cela pourrait perdre des liens créés entre-temps. Un besoin de restauration de base relève d’une décision distincte avec analyse des écritures postérieures à la sauvegarde. Publier le backend compatible avant le frontend consommateur.

Préserver les archives des versions antérieures pour le diagnostic ; ne pas redéployer une ancienne archive seule, qui pourrait réintroduire des décisions retirées. Aucun secret ni contenu de `.env` ne doit être ajouté aux preuves.

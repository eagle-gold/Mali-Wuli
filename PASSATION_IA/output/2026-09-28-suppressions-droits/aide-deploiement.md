# Publication — suppressions et droits, 28 septembre 2026

Lot **publié et vérifié**. Ce document décrit les actions effectuées ; les scripts sont figés pour cette livraison et ne doivent pas être rejoués sur les liens courants.

## Résultat

- Backend et frontend : `versions/20260928-suppressions-droits`.
- Anciennes cibles : `versions/20260928-priorite-membres-home`, conservées.
- Build frontend : `cNI0N04igTlrU9KwyDz4k` ; précédent `dj5SeEGNIha9psRUR-GDY`.
- Sources consolidées : 230 fichiers ; inventaire de 31 fichiers touchés dans `installed.json`.
- Base `u668963025_maliwuli` : aucune migration ni mutation métier, 14 migrations inchangées. 18 compteurs et empreintes des rôles/statuts/sessions/délégations préservés.

## Séquence réalisée

1. Comparaison des 226 sources précédentes, des deux `current` et de l’ancien build ; `source-production-before.json`.
2. Tests en mémoire, TypeScript, revue indépendante puis archives sans secrets ni dépendances macOS. Schéma et migrations comparés strictement au contrat.
3. Compilations Linux isolées. Backend réussi. Frontend interrompu pendant npm ci par la connexion SSH, puis reprise contrôlée. Échec transitoire next/font Fraunces lors du premier build repris ; nouvelle lecture CSS avec trois URL woff2 valides, simple relance réussie sans changement de police ni dépendance. Logs conservés.
4. Vérification des 230 sources candidates, contrôle frontend par socket Unix privé, contrôle DB en lecture seule avant bascule. Aucun compte réel, suppression ou désactivation pour les tests.
5. Backend activé à 20:21:56 CEST ; contrôle API publique santé200 et routes privées401 (`api-before-frontend.json`).
6. Frontend activé à 20:22:37 CEST ; chaque bascule atomique conserve la cible précédente et redémarre Passenger. Uploads persistants inchangés.
7. Vérifications finales : `source-current.json`, `database-after.json` et `frontend-public.json` réussis. 25 routes, 62 ressources et 39 bundles contrôlés. Ressources publiques identiques à la candidate, hormis deux PNG dont la recompression CDN conserve strictement dimensions/pixels et empreintes documentées.

## Reprise future

Lire `LIRE_REPRISE.md`, le journal et `verification.json`, puis vérifier les cibles actuelles avant de préparer une nouvelle livraison. Adapter version, cibles attendues, manifeste et contrat de base ; ne jamais réexécuter les activate/build de ce lot tel quel. `package-sources.py` refuse toute divergence staging/source active et toute modification du schéma ou des migrations. Les scripts shell s’exécutent avec `sh`.

Les vérificateurs de base n’autorisent que des lectures. Les contrôles de tri établissements/associations, hérités du lot précédent, servent de régression ; ils ne testent pas une suppression réelle. Les suppressions et désactivations sont couvertes par 81 tests backend en mémoire et les fixtures navigateur. Les comparaisons DB utilisent des lectures distinctes : une activité réelle concurrente doit être examinée si elle produit un écart.

Le contrôle public ne remplace pas les tests d’autorisations authentifiés en mémoire. Il prouve les routes, ressources et correspondance avec la candidate. Les tests scripts locaux, sans SSH ni SQL réel, sont conservés dans `tests-deploy-scripts.json` (6 groupes).

Aucun `prisma migrate deploy`, `db push`, seed, import ou UPDATE n’a été exécuté pour cette livraison. Les scripts de migration des lots plus anciens ne sont pas utilisés.

# Contrôle backend après migration — lecture seule

Script : `verify-associations-readonly.cjs`, préparé le 28 septembre 2026. Sa préparation et ses tests locaux n'ont exécuté aucune connexion SSH ni requête en base.

## Usage explicite

Exécuter avec Node 22+ dans l'environnement distant déjà autorisé. Le chemin `--backend` est obligatoirement absolu et désigne le dossier **nodejs** d'une candidate ou de `current`, avec son `package.json`, ses dépendances Linux, `prisma/` et `dist/services/`.

```sh
node verify-associations-readonly.cjs \
  --backend "$MW_BACK_NODEJS" \
  --env-file "$MW_BACK_NODEJS/.env" \
  --mode post \
  --before "$MW_BEFORE_COUNTS_JSON" \
  > backend-readonly-after.json
```

Les variables représentent des chemins préalablement contrôlés par l'opérateur. Le script ne choisit pas une version à sa place. Le fichier `.env` explicite fournit seulement `DATABASE_URL` au client Prisma ; il n'est ni affiché ni copié. En l'absence de `--env-file`, la variable doit déjà être fournie au processus. Aucun token n'est créé.

Pour relever les compteurs avant migration, utiliser le même script avec `--mode baseline` sur le backend courant. Ce mode n'exige ni la nouvelle table ni les nouveaux services. Ne pas ajouter `--before` pour un premier relevé.

Le fichier de comparaison peut être le rapport baseline ou un document de forme `{"counts":{"User":2,"Profil":2,...}}`. Le fichier local `backup-verification.json` existant est accepté directement : les tables dont le compteur préalable manque seront signalées, sans valeur supposée. `AssociationSuggestion:null` exprime une table encore absente avant migration.

## Ce qui est contrôlé

- Existence des tables et colonnes ajoutées, types/nullable, nouvelle valeur `REFUSE`, indexes et FK des propositions.
- Migration `20260928180000_association_directory` appliquée et non annulée ; checksum SQL égal à celui de la candidate ; aucune migration inachevée non annulée.
- Compteurs des tables membres, profils, formations, expériences, associations, affiliations, propositions, établissements, publications, notifications et messages.
- Recherche d'un profil **existant**, validé, e-mail vérifié et onboarding terminé : priorité à un administrateur. Seul son rôle de contrôle est indiqué dans le rapport, jamais ses identifiants, son nom ni son adresse.
- Vrais services compilés : annuaire/facettes associatives, affiliations personnelles, gestion, fiche/roster s'il existe une association, propositions et responsables si un administrateur existe.
- Jointures et sélections des nouveaux champs exécutées même si les tables associatives sont vides.
- Vrais constructeurs de filtres personnes : recherche, promotion, aide, établissement/promotion sur la même formation, pays/ville ; sélections de profils et associations vérifiées.
- Sémantique MySQL des filtres JSON pour promotion et aides via des littéraux fictifs en `SELECT`.

Les réponses de services sont utilisées en mémoire pour vérifier leur structure puis jetées. Le rapport JSON contient seulement des compteurs, des résultats de contrôle, des empreintes et des avertissements génériques. En cas d'erreur Prisma, le message, la stack et les métadonnées ne sont pas imprimés.

## Garanties de lecture seule

Le client transmis aux services est un Proxy qui refuse toutes les opérations autres que `find*`, `count`, `aggregate` et `groupBy`. Il bloque également les méthodes Prisma `$*` depuis les services. Les seules requêtes SQL directes du script sont des `SELECT` constants, sans SQL fourni par l'opérateur. Aucun import d'`index.js`, route Express, authentification, upload, job, notification ou ancien script de smoke.

Le script ne lance aucun serveur, aucune commande de migration, aucun processus enfant et aucun appel HTTP. Il ne crée aucun compte ou association, ne change aucune affiliation et n'écrit aucun message. `--before` ne provoque qu'une lecture de fichier. La redirection stdout ci-dessus enregistre le rapport localement, sans effet sur la DB.

## Résultats et limites

- `PASS` : contrôles exécutés réussis.
- `WARN` : requêtes réussies avec couverture partielle explicitée, données absentes ou compteurs ayant augmenté. Le code de sortie reste 0 ; lire les avertissements.
- `FAIL` : contrôle échoué ou requête incompatible, code de sortie 1. Le script s'arrête au premier échec, puis déconnecte Prisma.

Une baisse d'un compteur connu bloque le contrôle. Une hausse est signalée, car des inscriptions/messages réels peuvent survenir entre relevés. `--strict-counts` impose l'égalité de tous les compteurs fournis lorsque l'opérateur sait qu'aucune écriture concurrente n'a eu lieu. Des compteurs égaux ne prouvent pas à eux seuls l'intégrité de chaque ligne ; conserver la sauvegarde vérifiée.

Dans l'état relevé avant migration, `Association` et `AssociationMembre` sont vides. Le contrôle des fiches par identifiant sera donc explicitement sauté, tandis que les requêtes de sélection et jointures fonctionneront sur zéro ligne. Ne pas créer une vraie association pour faire disparaître cet avertissement.

Ce contrôle n'est pas une validation HTTP des middlewares ni une authentification utilisateur : les autorisations ont été testées séparément avec les vrais handlers et Prisma simulé. Compléter après bascule par les lectures HTTPS publiques autorisées, sans OTP, nouveaux profils ou tests mutables.

## Relecture du plan de publication

Le guide `PASSATION_IA/04_EXPLOITATION_DEPLOIEMENT.md` et les traces actuelles conduisent à cet ordre : sauvegarde récente achevée et vérifiée, candidates Linux compilées avec URLs publiques, vérification que seule la migration prévue est en attente, application autorisée, script readonly sur la candidate, bascule backend puis frontend avec contrôle des liens attendus, contrôle HTTPS et journal.

Préserver le répertoire d'uploads partagé et les versions précédentes. Ne pas publier le build local QA qui contient `127.0.0.1:4307`. L'adaptateur socket Unix éventuel appartient seulement aux processus de contrôle ; ne pas exporter son `NODE_OPTIONS` vers le service publié.

En retour arrière, conserver les colonnes et données ajoutées. La valeur enum `REFUSE` nécessite de revoir la compatibilité d'un ancien client Prisma si des refus ont déjà été enregistrés. Un retour de code ne constitue pas une autorisation de restaurer la DB ni de supprimer les nouvelles données.

Vérifications de préparation : syntaxe Node, aide CLI, validation des arguments et blocage des écritures sur un objet Prisma fictif. Aucune DB interrogée par le préparateur.

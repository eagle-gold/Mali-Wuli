# Événements et photos — reprise du lot du 28 septembre 2026

Lire d’abord PASSATION_IA/JOURNAL_REPRISE.md et respecter son verrou. Cette implémentation locale est distincte du lot associations déjà publié.

## Autorisation

Demande : événements selon captures, tout participant inscrit peut ajouter les photos. Pas d’accord explicite de migration/publication de ce lot à ce stade. L’accord précédent concernait associations. Aucun import de données de maquette, aucun smoke écrivant dans une base réelle.

## Travaux

Contrat détaillé : CONTRAT_API.md. Nouveaux types et helpers frontend, liste, fiche, album, participants, formulaire et administration. Backend : service injectable et routes, migration additive 20260928190000_event_photos. Dates stockées UTC avec fuseau IANA d’affichage. Résumé, album et couverture ne dépublient pas l’événement ; modification principale par organisateur repasse en validation.

Les fichiers avant cette session sont dans before/. staging/ porte le lot ; installed.json énumère les fichiers réellement installés et leur empreinte. integrate.py protège chaque copie des modifications concurrentes. Ne pas recopier staging/backend/.verification (client Prisma et environnement temporaire de test).

## Vérification locale sans base

qa-fixtures.cjs + qa-events.cjs : API en RAM sur 127.0.0.1:4307 ; comptes fictifs uniquement (mot de passe public qa-test). Aucun accès MySQL, aucun email et aucune donnée réelle. Frontend QA compilé avec API 4307 : NE PAS le déployer. La compilation de publication doit se faire sous Linux avec les URLs publiques selon la passation.

Tests backend : depuis backend, UPLOAD_DIR=/tmp/mali-evenements-test-uploads node --import tsx --test src/routes/evenement.routes.test.ts. Tests dates : node --import tsx --test ../frontend/src/lib/evenements.test.ts. Contrôles UI simulés dans ce dossier.

## Migration à préparer seulement après accord

Dernière production connue : frontend/backend versions/20260928-annuaire-associations, build oEfW-e-0s4HeQEgov9CNS, base u668963025_maliwuli, 11 migrations. Ce constat est daté du lot précédent ; le relire sur SSH avant toute action.

Avant nouvelle migration : sauvegarde privée MySQL récente et contrôlée, comparer toutes les migrations appliquées à leurs checksums, confirmer que seule 20260928190000_event_photos est en attente. Elle ajoute des colonnes nullable et refuse=false à Evenement, la table EvenementPhoto et des indexes ; pas de suppression de données. Tester le schéma additif en lecture seule après application, garder les counts des tables existantes. Les médias utilisent le dossier partagé uploads/evenements.

Ne pas remplacer les sources non commitées. Ne pas copier .env, secrets, node_modules, .next ou .verification dans les archives de source. Les anciennes versions doivent être conservées pour rollback applicatif ; ne pas revenir en arrière sur le schéma/base automatiquement.

## Clôture locale

26 fichiers intégrés et 193 sources archivées, build et tests locaux réussis (voir verification.json). La demande asynchrone d’accord publication est en attente. Aucun transfert serveur ni migration. Tentative SSH en BatchMode : authentification expirée ; il faudra rouvrir une session autorisée sans consigner le secret.

Les serveurs QA 3006 et 4307 sont arrêtés, leur contenu RAM a été effacé ; onglet temporaire fermé et viewport normal. Le script qa-events.cjs contient désormais un programme de fixture avec heures HH:mm (les premières captures du scénario historique gardent Début/Fin de la maquette).

Archives frontend-source.tar.gz et backend-source.tar.gz vérifiées par source-manifest.json. build-*.sh, backup-before.cjs et guard-migration.cjs sont préparés pour 20260928-evenements-photos, NON exécutés. verify-events-release.cjs conserve les contrôles précédents plus les nouvelles routes ; verify-events-readonly.cjs a été complété par root avec contrôle explicite du nom de base. Le hash initial de ce script dans review-final.json est donc celui d’avant ce dernier contrôle ; le hash final figure dans verification.json.

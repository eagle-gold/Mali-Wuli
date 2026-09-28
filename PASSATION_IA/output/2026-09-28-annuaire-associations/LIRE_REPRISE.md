# Annuaire et associations — reprise du 28 septembre 2026

Développement dans `/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration`. **État : migration et publication terminées et vérifiées le 28 septembre 2026 à 17 h 42 CEST.** Lire intégralement `PASSATION_IA/JOURNAL_REPRISE.md` en premier, puis respecter `PROMPT_CODEX_TRACES.txt` avant toute nouvelle intervention. Le statut de coordination courant reste celui du journal, à relire avant toute intervention.

L’utilisateur a explicitement autorisé la migration et la publication (« Oui, migrer et mettre en ligne »). La migration est désormais appliquée en production ; ne plus considérer ce lot comme un développement exclusivement local. Les contrôles publics sont conservés dans `frontend-public.json`, `backend-public.json` et `remote-final.json`.

## Produit

- Annuaire membre `/annuaire` : catégories Personnes / Associations, compteurs réels, pays/ville/recherche ; établissements, promotions, aides et statut pour les personnes ; vocation pour associations.
- Profils des membres `/membres/[id]` : formations, expériences, coordonnées selon visibilité et associations actives dont affiliation VERIFIE uniquement. Contact vers messagerie ; propositions de synergie préservées.
- Admin `/admin/associations` : crée/modifie la fiche, nom, description, pays, ville, vocation et responsable (profil existant validé) requis à la création ; date de fondation, site et contact public facultatifs. Photos depuis la fiche.
- Association `/associations/[id]` : profil, couverture, description, lieu, date de fondation, responsable et membres validés ; demande d’affiliation, annulation/départ ; validation/refus des demandes par responsable désigné ou admin.
- Profil propriétaire : affiliations validées, demandes privées et associations gérées. Un responsable peut gérer sans être lui-même affilié.
- Onboarding : étape 5 facultative après mentorat ; affiliations enregistrées indépendamment du snapshot pour préserver les données scolaires. Gestion directe `/onboarding?etape=associations` retourne au profil sans réécriture du snapshot.
- Association absente : formulaire de contact interne, proposition visible dans l’administration ; aucune création automatique, aucun e-mail externe.
- Compte encore EN_ATTENTE : seulement recherche/demande/retrait/suggestion par `/api/onboarding/associations`, jamais roster/gestion. Validation affiliation après validation du compte et fin onboarding. Un responsable non admin ne peut pas approuver sa propre affiliation.
- Cercles toujours masqués ; seuls les menus Synergies sont retirés comme demandé précédemment. Polices globales inchangées.

## Code et API

`installed.json` inventorie les fichiers installés et empreintes avant/après. `before/` contient les sources avant cette session ; `staging/` les fichiers préparés. Ne pas restaurer globalement `before/` et ne pas copier les dossiers `.verification`.

Backend : `src/services/association.service.ts`, `src/routes/association.routes.ts`, montage dans `src/index.ts`. Personnes : `src/services/annuaire.ts`, `src/routes/user.routes.ts`. Contrat détaillé : `CONTRAT_API.md`.

Frontend : `components/directory`, `components/associations`, `types/associations.ts`, nouvelles pages membres/associations/admin, `StepAssociations`, `AssociationsProfil`. Le lien de contact présélectionne la conversation via `?conversation=`.

## Migration appliquée et publication vérifiée

La migration `20260928180000_association_directory` a été appliquée avec succès le 28 septembre 2026 vers 17 h 37 CEST sur **`u668963025_maliwuli`**. Preuves : `migration-guard.json`, `migration-deploy.txt` et `backend-readonly-after.json`. Le garde-fou a confirmé les empreintes des dix migrations déjà appliquées et cette seule migration en attente. Il ne faut pas rejouer la migration manuellement.

Elle ajoute ville, vocation, contact, photos et date de fondation, élargit deux colonnes texte, ajoute `REFUSE` à la fin de l’enum d’affiliation et crée `AssociationSuggestion` avec ses index et sa clé étrangère. Aucune suppression, fusion, import ni seed. Les 47 contrôles backend en lecture seule sont réussis, et les onze comptages suivis restent cohérents avec le relevé préalable : notamment 2 utilisateurs, 2 profils, 9 formations, 2 expériences et aucune association ou affiliation. Le rapport conserve volontairement **`WARN`** avec **`DETAIL_SKIPPED_NO_ACTIVE_ASSOCIATION`** : aucune association active n’existe pour tester une vraie fiche et ses membres. Ne pas présenter ce contrôle non exécuté comme réussi.

La sauvegarde complète préalable est restée privée sur le serveur : `/home/u668963025/private-backups/20260928-annuaire-associations/before.sql.gz`, **31 533 042 octets**, SHA-256 `3ebbf89d92b81f61ada694dedf5a00c0358ef6d386bb3a3137cf994bddf566df`. `backup-verification.json` contient uniquement ses métadonnées. La sauvegarde a été achevée et vérifiée ; aucune restauration d’essai n’est attestée par ces preuves. Ne pas recopier le dump dans le dossier de passation.

Les candidates backend et frontend ont été compilées sur Linux dans **`versions/20260928-annuaire-associations`** ; build frontend **`oEfW-e-0s4HeQEgov9CNS`**. Les 46 assets et 25 bundles frontend contrôlés sur la candidate répondent correctement ; les signatures de l’accueil et de l’inscription sont conservées. Ce test vérifie les coques de pages et les bundles, sans session membre/admin et sans exécuter le JavaScript client.

Avant la bascule, les cibles observées étaient frontend `versions/20260928-menu-synergies` (build `DPia9wiu4OeyoZRNtEXYH`) et backend `versions/20260921-profile-schools-r2`. Les deux cibles `current` sont désormais `versions/20260928-annuaire-associations`, build frontend `oEfW-e-0s4HeQEgov9CNS`. Les anciennes cibles restent conservées dans les fichiers `.previous-target`. Santé API et base OK ; routes anonymes protégées (401). Les 46 assets publics et 25 bundles sont vérifiés ; tous scripts/styles/polices identiques à la candidate. Deux PNG sont recompressés sans perte par Hostinger : mêmes dimensions et mêmes pixels, preuve `public-images-comparison.json`. URL API publique compilée vérifiée, aucune URL QA dans les bundles publiés.

**Le build frontend local reste un build QA avec API locale `127.0.0.1:4307` : ne pas le déployer.** Les candidates Linux ont été construites séparément à partir des archives de sources consolidées avec les URLs publiques. Le backend doit conserver le dossier d’uploads partagé configuré par `UPLOAD_DIR` ; son absence sous l’ancien `nodejs` ne signifie pas que les images sont absentes.

Pour un retour arrière, conserver les nouvelles colonnes et données : rétablir d’abord un frontend compatible, puis le backend si nécessaire, uniquement après diagnostic et demande explicite. Relire `current`, les cibles conservées et la compatibilité ; ne pas restaurer MySQL pour annuler une simple publication. Une DDL partiellement appliquée ne se reprend pas à l’aveugle ; relire l’état du schéma et `_prisma_migrations`. Voir les guides 03 et 04.

## Vérification

- `backend-tests.txt` : tests backend (vrais handlers/auth, Prisma simulé), annuaire/confidentialité, non-régression du parcours scolaire.
- `frontend-build.txt` : compilation complète locale Next.js avec API de fixtures, non déployable.
- `linux-backend-build.txt` et `linux-frontend-build.txt` : compilations des candidates sur le serveur Linux.
- `frontend-candidate.json` : routes, menus, 46 assets, 25 bundles et comparaison accueil/inscription avant activation.
- `associations-counts-before.json` et `backend-readonly-after.json` : comptages et contrôle du schéma/services sur MySQL réel, sans écriture de données métier.
- `verify-directory-ui.cjs` et `verify-admin-onboarding-profile.cjs` : contrôles des composants avec API/hooks/navigation simulés, sans DB.
- `qa-fixtures.cjs` : API fictive locale en mémoire, aucun Prisma ni .env, aucun appel sortant. Comptes .test documentés dans ce script, inutilisables en production. Les données sont perdues à son arrêt.
- Les contrôles visuels et la clôture définitive sont consignés dans `verification.json` ; ne pas assimiler mocks à un test sur vraie base MySQL.

Les parcours de création, affiliation, validation et upload ont été exercés sur l’API locale de fixtures en mémoire ; ils ne constituent pas des écritures métier effectuées en production. La seule mutation de base attestée à ce stade est la migration autorisée. Aucun compte de test, association, affiliation, message ou e-mail réel n’a été créé pour les contrôles décrits ici.

## Archives et prochaine reprise

Conserver ensemble `before/`, `installed.json`, les deux archives `frontend-source.tar.gz` / `backend-source.tar.gz`, `source-manifest.json`, les logs Linux, les preuves de sauvegarde et migration, les rapports de candidate et de vérification publique finale. L’audit local a confirmé **174 fichiers** (90 frontend, 84 backend) identiques au manifeste et aux sources actives, sans `.env`, dépendances ou livrables compilés dans les archives. Ne pas écraser ces preuves avec une nouvelle tentative ; utiliser un nom de reprise distinct.

Ne pas rejouer les archives du retrait étendu de Synergies, les anciens patches ou une restauration globale de `before/`. Les cercles restent masqués ; seules les entrées de menu Synergies sont retirées, ses recommandations et actions restent présentes. L’accueil sans notices, Paris 8e, les liens directs `/register`, les polices et l’ancien parcours scolaire restent conservés.

Aucun travail applicatif à moitié fait. Le catalogue associatif est vide : l’administrateur peut créer les premières associations via `/admin/associations`, après quoi les membres peuvent demander leur affiliation. Pour une prochaine demande, relire le journal et les sources actives ; ne pas redéployer ce lot sans demande. Aucun script mutable, import, seed ou nouvelle création de données réelles ne découle automatiquement de cette note.

Aperçus locaux et API de fixtures arrêtés, onglets QA fermés et viewport rétabli. Capture lisible avec données de test : `annuaire-associations-apercu.png`. Les autres captures de cette session présentent un artefact de composition du navigateur ; elles ne servent pas de preuve visuelle finale.

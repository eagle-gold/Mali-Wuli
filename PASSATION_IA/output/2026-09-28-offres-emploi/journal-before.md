# Journal de reprise Mali Wuli

Journal partagé entre les agents (Codex, Claude) qui travaillent sur le projet. **Lire ce fichier avant tout travail, et le mettre à jour pendant et après.** Entrées les plus récentes en haut. Ne jamais supprimer ni réécrire une ancienne entrée : ajouter une correction datée.

Dépôt actif : `/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration`

## Statut courant

<!-- Une seule ligne, remplacée à chaque début et fin de session. -->
LIBRE — dernière session terminée : Codex, 2026-09-28 18:32:36 CEST.

## Modèle d'entrée

```
### AAAA-MM-JJ HH:MM — <agent> — <titre court>
- Statut : EN COURS | TERMINÉ | INTERROMPU
- Demande de l'utilisateur : <reformulation en une phrase>
- État Git au début : branche, HEAD, nb modifiés / non suivis
- Fichiers touchés : <chemins relatifs au dépôt actif>
- Fait et vérifié : <ce qui marche, avec la commande ou le test qui le prouve>
- Fait mais non vérifié : <...>
- Actions à effet externe : déploiement (version, build ID, cible current précédente), migration, import, fusion, script mutable, base visée — ou « aucune »
- Décisions de l'utilisateur prises pendant la session : <...>
- Arrêté à : <étape exacte, fichier/fonction en cours, ce qui est à moitié fait>
- Prochaine action : <une action concrète>
- Preuves : <dossier output/<date-sujet>/ ou « aucune »>
```

## Entrées

### 2026-09-28 18:22:48 CEST — Codex — Parcours récents en premier
- Statut : TERMINÉ
- Demande de l'utilisateur : afficher la dernière expérience en premier, et le même ordre pour les formations.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 68 suivis modifiés/supprimés / 75 entrées non suivies (125 fichiers).
- Fichiers touchés : frontend/src/lib/periode.ts ; frontend/src/lib/education/parcours-scolaire.test.ts ; frontend/src/components/profile/ProfilMembre.tsx ; frontend/src/components/directory/ProfilPublic.tsx ; frontend/src/components/onboarding/StepFormations.tsx. Journal, guides 02/05, LIRE et preuves actualisés.
- Fait et vérifié : tri décroissant sur profils et formulaires, dates inconnues à la fin et égalités stables ; sélection du poste actuel adaptée ; fusion scolaire interne croissante préservée. 9 tests métier, 7 contrôles rendu/fusion, compilation Linux et relecture indépendante réussis. Rendu navigateur sur fixtures personnel/public/formations validé ; 193 sources, 54 ressources et 30 bundles publics conformes.
- Fait mais non vérifié : pas de parcours authentifié sur données réelles en production ; vérifications interactives sur fixtures RAM, production en lecture seule. Pas de téléphone physique, styles inchangés.
- Actions à effet externe : frontend current versions/20260928-evenements-photos → versions/20260928-parcours-recents ; build g_ZlNJ4g3BexnPjw2JQYj → OsGa4wg5bN0eLzWW4pzBH ; redémarrage effectué, précédente version conservée. Backend reste evenements-photos. Aucune migration, import, fusion ou écriture en base.
- Décisions de l'utilisateur prises pendant la session : le tri du plus récent au plus ancien remplace la décision précédente du plus ancien au plus récent, expériences et formations. Autorisation persistante de publication conservée.
- Arrêté à : correctif publié et vérifié, aucune fonction à moitié écrite. Serveurs QA arrêtés, onglet fermé et viewport rétabli. Anciennes entrées du journal vérifiées inchangées.
- Prochaine action : attendre la prochaine demande ; conserver cet ordre décroissant et l’autorisation persistante de publication après vérifications.
- Preuves : `output/2026-09-28-parcours-recents/verification.json`.

- Étape : 2026-09-28 18:25:07 CEST — Cinq fichiers adaptés : tri récent en premier, fusion scolaire explicitement croissante conservée, expérience du titre et profil public corrigés, texte formulaire harmonisé. Neuf tests parcours réussis ; comparaison des vues et publication frontend en préparation.

- Étape : 2026-09-28 18:26:37 CEST — Neuf tests métier et sept contrôles de rendu/fusion réussis. Sources production193 fichiers conformes. Archive frontend consolidée transférée ; compilation Linux20260928-parcours-recents lancée. Backend/base conservés, aucune migration nécessaire pour ce tri visuel.

- Étape : 2026-09-28 18:30:41 CEST — Compilation Linux et candidate réussies (build OsGa4wg5bN0eLzWW4pzBH), 193 empreintes sources conformes. Vérification navigateur : expériences/formations du profil personnel, public et formulaire dans le nouvel ordre ; relecture indépendante sans blocage. Bascule frontend prête, backend et base inchangés.

- Étape : 2026-09-28 18:30:54 CEST — Frontend activé : current versions/20260928-evenements-photos → versions/20260928-parcours-recents ; build g_ZlNJ4g3BexnPjw2JQYj → OsGa4wg5bN0eLzWW4pzBH. Redémarrage effectué, ancienne version conservée ; backend reste evenements-photos. Aucune écriture en base ni migration. Vérification HTTPS finale en cours.

- État Git final (2026-09-28 18:32:36 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 68 suivis modifiés/supprimés / 75 entrées non suivies (125 fichiers). Aucun commit ni push ; modifications antérieures préservées.
- Clôture : 2026-09-28 18:32:36 CEST — publication et contrôles HTTPS réussis, traces finalisées, statut LIBRE.

### 2026-09-28 18:07:37 CEST — Codex — Recherche dans l’en-tête
- Statut : TERMINÉ
- Demande de l'utilisateur : faire tenir la recherche dans son cadre, expliquer les résultats, puis migrer/publier les événements et ne plus demander confirmation de routine pour les prochains lots terminés.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 68 suivis modifiés/supprimés / 75 entrées non suivies (125 fichiers).
- Fichiers touchés : frontend/src/components/MaliWuliHeader.tsx (largeur260/290) ; lot événements préexistant publié sans autre changement applicatif. Journal, LIRE_EN_PREMIER.md, guide05 et preuves dans output/2026-09-28-recherche-header.
- Fait et vérifié : recherche lisible en1280/1536, navigation mobile320 sans débordement, recherche personnes puis associations testée sur fixtures. Migration événements et publication backend/frontend terminées. Builds Linux réussis,193sources conformes,91contrôles SQL/services réussis,compteurs préservés. API/base saines,54assets/30bundles publics conformes, anonyme /evenements renvoyé vers /login.
- Fait mais non vérifié : catalogue réel sans événement ; mutations et album testés sur fixtures, pas sur compte réel en production. Limites existantes recherche documentées dans audit-recherche.md, non corrigées par ce changement visuel. Pas de téléphone physique ni restauration d’essai de la sauvegarde.
- Actions à effet externe : sauvegarde privée31 533 348octets sous /home/u668963025/private-backups/20260928-evenements-photos/before.sql.gz. Migration20260928190000_event_photos appliquée à u668963025_maliwuli. Backend/frontend current annuaire-associations → evenements-photos ; frontend build oEfW-e-0s4HeQEgov9CNS → g_ZlNJ4g3BexnPjw2JQYj, redémarrages effectués. Aucun import/fusion/donnée de test réelle.
- Décisions de l'utilisateur prises pendant la session : ajuster le texte au cadre et expliquer la recherche ; puis accord explicite « Migre evenement et n’attend plus pour migrer quand tu finis quelque chose migre ». Publication/migration événements autorisées, et autorisation persistante de migrer/publier les futurs lots terminés après vérifications ; sauvegardes et contrôles restent requis.
- Arrêté à : événements et correctif recherche publiés et vérifiés ; aucune fonction à moitié écrite. ServeursQA arrêtés, onglets temporaires fermés, viewport rétabli ; traces finales prêtes.
- Prochaine action : attendre prochaine demande et conserver l’accord persistant de migration/publication après contrôles. Source actuelle et preuves consolidées dans le nouveau dossier, ne pas déployer une ancienne archive événements sans le correctif header.
- Preuves : `output/2026-09-28-recherche-header/verification.json`.

- Étape : 2026-09-28 18:09:03 CEST — Champ recherche élargi, texte/police/logique inchangés. Nouvelle autorisation utilisateur : migrer événements et publier systématiquement les lots achevés et vérifiés. Reprise des scripts préparés événements, sans réécriture de l’entrée précédente.

- Étape : 2026-09-28 18:12:04 CEST — SSH relu : frontend/backend annuaire-associations, build oEfW-e-0s4HeQEgov9CNS. Comparaison des 174 sources production réussie. Archives consolidées 193 fichiers : seule modification depuis tests événements = largeur header. Sauvegarde MySQL privée créée, contrôles de référence enregistrés. Texte complet contrôlé en navigateur 1280/1536.

- Étape : 2026-09-28 18:13:49 CEST — Compilations Linux backend/frontend réussies (build g_ZlNJ4g3BexnPjw2JQYj). Garde migration PASS : 11 historiques conformes, seule 20260928190000_event_photos attendue et SQL SHA identique. Contrôles candidate avant migration/bascule en préparation ; sauvegarde 31 533 348 octets, sans avertissement.

- Étape : 2026-09-28 18:14:59 CEST — Candidate frontend validée : routes événements, album, admin, recommandations, largeur260/290 et ressources conformes ; home/inscription préservées. Migration autorisée lancée après vérification gzip du backup et nouveau garde, base u668963025_maliwuli ; résultat attendu.

- Étape : 2026-09-28 18:15:17 CEST — Migration 20260928190000_event_photos appliquée avec succès à u668963025_maliwuli ; Prisma confirme 12 migrations et schéma à jour. Versions actives encore annuaire-associations. Vérification SELECT du schéma, services et comptages avant bascule.

- Étape : 2026-09-28 18:15:46 CEST — Contrôle post migration interrompu avant bascule : comptes tous inchangés, champs présents, assertion type JSON programme non conforme au type retourné. Diagnostic du moteur/stockage JSON en cours ; versions actives inchangées.

- Étape : 2026-09-28 18:16:11 CEST — Diagnostic confirmé : serveur MariaDB11.8.9, JSON exposé comme LONGTEXT avec CHECK(json_valid(programme)). Schéma conforme au SQL appliqué, correctif du vérificateur prévu pour valider strictement cet alias ; application et données inchangées.

- Étape : 2026-09-28 18:17:33 CEST — Postmigration vérifiée : 91 contrôles réussis, comptes existants inchangés, JSON MariaDB validé par sa contrainte active. Seule limite : détail réel non exerçable car aucun événement en base ; parcours déjà testés sur fixtures. Bascule backend prête.

- Étape : 2026-09-28 18:17:37 CEST — Backend activé : current versions/20260928-annuaire-associations → versions/20260928-evenements-photos, restart.txt mis à jour, uploads partagés conservés. Vérification API publique avant bascule frontend.

- Étape : 2026-09-28 18:18:13 CEST — API publiée saine (base OK), événements/photos/participants protégés 401 en anonyme. Frontend activé : current annuaire-associations / oEfW-e-0s4HeQEgov9CNS → versions/20260928-evenements-photos / g_ZlNJ4g3BexnPjw2JQYj. Contrôle HTTPS final lancé.

- Étape : 2026-09-28 18:19:14 CEST — Contrôle HTTPS public réussi : événements/proposition/album/admin, annuaire et header servis ; 54 assets et 30 bundles conformes à la candidate. JS/CSS/polices identiques, deux PNG recompressés validés pixels+empreintes. Versions frontend/backend confirmées evenements-photos, build g_ZlNJ4g3BexnPjw2JQYj.

- État Git final (2026-09-28 18:20:29 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 68 suivis modifiés/supprimés / 75 entrées non suivies (125 fichiers). Aucun commit/push. Modifications antérieures préservées.
- Clôture : 2026-09-28 18:20:29 CEST — publication terminée, preuves et passation finalisées, statut LIBRE.

- Complément de clôture : 2026-09-28 18:22:00 CEST — capture complète header-verifie.png enregistrée après correction d’un recadrage de preuve mal dimensionné. Aperçu RAM rouvert puis arrêté, onglet fermé. Aucun changement applicatif ni distant supplémentaire ; état Git inchangé, statut LIBRE.

### 2026-09-28 17:44:01 CEST — Codex — Événements et photos des participants
- Statut : INTERROMPU — implémentation locale terminée ; accord de migration/publication événements en attente
- Demande de l'utilisateur : développer événements selon maquettes, proposition/validation, participation et photos ajoutées par tout participant.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 68 suivis modifiés/supprimés / 67 entrées non suivies (106 fichiers).
- Fichiers touchés : 26 fichiers applicatifs/test/schema (6 backend, 20 frontend), inventaire et empreintes dans installed.json ; journal, guide 05, procédures et preuves dans output/2026-09-28-evenements-photos.
- Fait et vérifié : Événements liste/détail/proposition/admin et album contributif prêts localement. Prisma generate local, TypeScript backend et build frontend réussis ; 16 tests événements, 29 régressions, 4 groupes dates/ICS, 14 groupes formulaire/admin, 9 groupes UI. QA navigateur : filtre, création avec couverture/programme, validation admin, inscription et photos par participante avant/après événement. Responsive CSS320 sans débordement. 26 empreintes concordent, 170 sources antérieures préservées, 193 sources archivées sans secrets.
- Fait mais non vérifié : Migration 20260928190000_event_photos non appliquée, compilation Linux/publication non effectuées. Aucun test MySQL réel concurrent. ICS contenu testé, mais capture du téléchargement IAB expirée. Scripts de publication/lecture seule préparés, non exécutés sur serveur. Connexion SSH de lecture seule en BatchMode expirée, aucune commande distante exécutée.
- Actions à effet externe : aucune. Tests et photos exclusivement sur fixtures locales en RAM, serveurs arrêtés et onglet temporaire fermé ; aucune donnée réelle ni mail.
- Décisions de l'utilisateur prises pendant la session : tout participant peut ajouter des photos, remplace la restriction organisateur seul de la maquette. Conserver design et mobile ; préserver fonctionnalités précédentes.
- Arrêté à : Code intégré et vérifications locales terminées ; aucune fonction à moitié écrite. Demande asynchrone d’accord migration additive et publication événements en attente. Serveurs QA 3006/4307 arrêtés, viewport rétabli.
- Prochaine action : Attendre accord utilisateur pour ce lot. Ensuite relire current/état DB via SSH, comparer sources, sauvegarder MySQL, compiler Linux, contrôler candidate et unique migration attendue, migrer puis publier avec preuves. Guide LIRE_REPRISE.md dans output détaille la reprise.
- Preuves : `output/2026-09-28-evenements-photos/verification.json`.
- Étape : 2026-09-28 17:49:00 CEST — Contrat API et rôles fixés, lots backend/liste-détail/formulaire-admin délégués. Helpers dates avec fuseaux/DST et export calendrier prêts : 4 tests réussis. Liens agenda/fil et accès admin préparés en staging.
- Étape : 2026-09-28 17:53:50 CEST — Schéma et migration additive relus, droits album contrôlés avant upload et sauvegarde. Formulaire, liste et administration écrits en staging ; fixtures QA lancées en mémoire sur 4307. Relecture a relevé deux compatibilités à corriger : capacité lors édition concurrente et ancien hybride sans lien.
- Étape : 2026-09-28 17:54:25 CEST — Backend intégré : 6 fichiers, client Prisma généré sans migration. TypeScript strict et 16 tests réels handlers/service/médias simulés réussis. Édition capacité transactionnelle et compatibilité ancien HYBRIDE corrigées.
- Étape : 2026-09-28 17:59:53 CEST — Frontend intégré (20 fichiers), compilation réussie. Essais navigateur : filtre France 2 événements, inscription puis ajout de 2 images par participante, attribution Awa et album ouvrable ; création avec couverture et programme, fuseau Paris correct, proposition en attente. Formulaire CSS320 sans débordement.
- Étape : 2026-09-28 18:01:35 CEST — QA navigateur terminée : création/couverture/programme, validation admin et passage 3→2 en attente, fiche publiée, album futur 2 photos et passé 1 photo par participante. Largeurs CSS320 formulaire/liste/admin/album sans débordement. 14 groupes formulaire-admin et 9 groupes événements UI passent. Accord migration/publication demandé pour ce nouveau lot.
- État Git final (2026-09-28 18:05:27 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 68 suivis modifiés/supprimés / 75 entrées non suivies (125 fichiers). Aucun commit ni push. Modifications antérieures préservées.
- Clôture : 2026-09-28 18:05:27 CEST — implémentation locale vérifiée, publication en attente d’accord, statut LIBRE.

### 2026-09-28 17:05:05 CEST — Codex — Annuaire et associations
- Statut : TERMINÉ
- Demande de l'utilisateur : annuaire Personnes/Associations, création administrateur avec responsable et fiche détaillée, affiliations validées par responsable, recherche dans onboarding et affichage des affiliations validées sur profil.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 67 suivis modifiés/supprimés / 57 entrées non suivies (85 fichiers).
- Fichiers touchés : 31 fichiers applicatifs/test/schema : liste exhaustive et empreintes dans output/2026-09-28-annuaire-associations/installed.json. Backend associations/annuaire, migration/schema, index et user.routes ; frontend annuaire, membres, associations, admin, onboarding, profil et lien messagerie. Journal, LIRE_EN_PREMIER.md, guide 05, reprise et preuves.
- Fait et vérifié : Annuaire personnes/associations, admin/responsable, affiliations et onboarding publiés. 29 tests backend, 7 groupes annuaire et 14 groupes admin/onboarding/profil ; builds locaux/Linux réussis. QA interactive avec fixtures, responsive CSS 320. 47 contrôles MySQL readonly réussis, comptes existants inchangés ; API/base publiques OK. 46 assets/25 bundles vérifiés (2 PNG CDN strictement identiques en pixels). 31 empreintes finales conformes ; aucun changement inattendu hors fichiers attribués.
- Fait mais non vérifié : Aucun travail applicatif partiel. Catalogue réel vide : fiche réelle et mutation métier live non exercées ; parcours testés sur fixtures. Pas de téléphone physique ni restauration d’essai du backup.
- Actions à effet externe : Migration 20260928180000_association_directory appliquée à u668963025_maliwuli. Backend current profile-schools-r2 → annuaire-associations ; frontend current menu-synergies (DPia9wiu4OeyoZRNtEXYH) → annuaire-associations (oEfW-e-0s4HeQEgov9CNS), redémarrages effectués. Anciennes versions et backup privé conservés. Aucune donnée de test/import/fusion.
- Décisions de l’utilisateur prises pendant la session : annuaire à deux catégories, responsable désigné par admin, affiliation validée avant affichage public, étape onboarding facultative et demande interne d’ajout ; préserver recommandations et retrait des cercles. Accord explicite reçu : « Oui, migrer et mettre en ligne ».
- Arrêté à : Publication et vérifications terminées ; aucune fonction en cours. Serveurs QA arrêtés, onglets temporaires fermés, viewport rétabli. Documentation finale prête.
- Prochaine action : Attendre prochaine demande. Les premières associations peuvent être créées depuis /admin/associations ; ne pas créer/importer automatiquement des données de test en production.
- Preuves : `output/2026-09-28-annuaire-associations/verification.json`.
- Étape : 2026-09-28 17:10:02 CEST — Contrat API associations fixé ; trois lots délégués sans chevauchement (backend, annuaire/fiches, admin/onboarding/profil). Types partagés créés. Extension annuaire personnes et lien Contacter vers conversation préparés en staging. Onboarding associatif indépendant du snapshot pour préserver formations et mentorat.
- Étape : 2026-09-28 17:13:59 CEST — Extension annuaire personnes terminée en staging : recherche prénom/nom, filtres établissement/promotion/aides, compteurs réels, profil public avec affiliations validées uniquement et lien messagerie. Dix tests unitaires/handlers préparés sans DB. Migration associations relue additive, validation de droits revue.
- Étape : 2026-09-28 17:17:44 CEST — Backend intégré, client Prisma généré localement ; TypeScript backend réussi. 29 tests handlers/auth/annuaire/onboarding réussis sans DB. Les 20 fichiers frontend sont intégrés, TypeScript en cours. Recherche et cartes harmonisées avec la formation filtrée ; aucune production modifiée.
- Étape : 2026-09-28 17:21:06 CEST — Compilation frontend locale réussie après extraction des cartes hors page Next ; 7 contrôles annuaire et 14 groupes admin/onboarding/profil réussis. Accès responsable indépendant de son affiliation ajouté. Documentation migration/reprise préparée ; build local explicitement non déployable (API fixtures).
- Étape : 2026-09-28 17:26:50 CEST — QA navigateur sur API fictive réussie : filtre pays, affiliation demandée puis absente du profil public, responsable depuis son profil, validation et apparition du membre dans associations publiques, création admin avec responsable, photo chargée ; fiche contrôlée à largeur CSS 320 sans débordement.
- Étape : 2026-09-28 17:30:42 CEST — Décision utilisateur reçue : « Oui, migrer et mettre en ligne ». Autorisation de migration additive et publication backend/frontend. Relevé SSH lecture seule : base u668963025_maliwuli, frontend menu-synergies / DPia9wiu4OeyoZRNtEXYH, backend profile-schools-r2 ; 10 migrations appliquées.
- Étape : 2026-09-28 17:32:36 CEST — Sources comparées à la production : 148 fichiers identiques à la sauvegarde de début. Archives de 174 fichiers transférées ; revue indépendante conforme, sans secrets/build local. Sauvegarde complète MySQL privée lancée.
- Étape : 2026-09-28 17:33:13 CEST — Sauvegarde complète réussie : before.sql.gz, 31 533 042 octets, empreinte conservée. Base compte 2 utilisateurs, 2 profils, 9 formations, 0 associations/affiliations. Préparation backend arrêtée sans mutation active : uploads absents sous nodejs car UPLOAD_DIR pointe vers le dossier partagé du domaine ; cible correcte identifiée.
- Étape : 2026-09-28 17:36:05 CEST — Compilations Linux frontend et backend réussies. Frontend build oEfW-e-0s4HeQEgov9CNS. Comptage complet de référence obtenu en lecture seule ; contrôle des migrations et candidate avant bascule.
- Étape : 2026-09-28 17:37:07 CEST — Garde de migration réussi : 10 checksums appliqués identiques, seule 20260928180000_association_directory en attente. Candidate frontend validée. Migration autorisée lancée sur u668963025_maliwuli ; attente du résultat.
- Étape : 2026-09-28 17:37:16 CEST — Migration 20260928180000_association_directory appliquée avec succès sur u668963025_maliwuli. Candidate frontend : 46 assets, 25 bundles, routes, menus et recommandations validés ; home et inscription identiques au relevé préalable.
- Étape : 2026-09-28 17:37:46 CEST — Contrôle MySQL et services réels réussi : nouveaux champs, indexes, enum, migration/checksum, filtres personnes et associations. Comptages existants inchangés. Seule limite : fiche association réelle non testable car catalogue vide ; parcours déjà validé avec fixtures.
- Étape : 2026-09-28 17:38:00 CEST — Backend activé : current versions/20260921-profile-schools-r2 → versions/20260928-annuaire-associations, restart.txt mis à jour ; uploads partagés conservés.
- Étape : 2026-09-28 17:38:22 CEST — API publiée saine, base connectée ; routes associations/onboarding/personnes protégées (401 anonyme). Frontend activé : menu-synergies / DPia9wiu4OeyoZRNtEXYH → versions/20260928-annuaire-associations / oEfW-e-0s4HeQEgov9CNS.
- Étape : 2026-09-28 17:39:16 CEST — Contrôle public : routes et bundles de la nouvelle version servis, JavaScript/CSS/polices identiques à la candidate. Comparaison binaire diffère uniquement sur deux logos PNG ; diagnostic CDN/encodage en cours. Navigation anonyme /annuaire renvoie bien vers login.
- Étape : 2026-09-28 17:41:51 CEST — Contrôle public final réussi : 46 assets, 25 bundles et routes vérifiés ; scripts/styles/polices identiques, deux PNG recompressés sans perte avec SHA pixels identiques. API saine. Aperçus locaux arrêtés, onglets QA fermés et viewport rétabli.
- État Git final (2026-09-28 17:43:01 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 68 suivis modifiés/supprimés / 67 entrées non suivies (106 fichiers). Aucun commit ni push. Modifications antérieures préservées.
- Clôture : 2026-09-28 17:43:01 CEST — publication contrôlée, passation actualisée, statut LIBRE.

### 2026-09-28 16:53:14 CEST — Codex — Frontend sans synergies
- Statut : TERMINÉ
- Demande de l'utilisateur : retirer uniquement la section Synergies des menus et conserver toute logique de recommandation et actions sur les autres pages (précision en cours de session).
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 67 suivis modifiés/supprimés / 57 entrées non suivies (85 fichiers).
- Fichiers touchés : Diff final : frontend/src/components/MaliWuliHeader.tsx et frontend/src/app/(platform)/layout.tsx ; les 11 autres fichiers initialement modifiés ont été rétablis. Journal, guide 05 et preuves.
- Fait et vérifié : Correction finale publiée : seuls les liens Synergies des menus desktop/mobile sont retirés. Recommandations, boutons, compteurs, notifications, API/listeners et page dédiée rétablis. Comparaison 76 sources : seuls 2 fichiers de menus diffèrent. Six tests SSR/effets, compilation Linux/TypeScript et contrôles HTTP candidate/public réussis (26 assets et recommandations présentes).
- Fait mais non vérifié : Aucun travail partiel. Contrôles UI avec fixtures/mocks ; pas de test connecté avec compte réel ni téléphone physique. Aucune écriture en base.
- Actions à effet externe : Deux déploiements frontend : sans-cercles-r2 (j0CKbKg2B4_1p7LIJYq-o) → sans-synergies (VONsvj3hhv9tNqFn-AA-K), puis correction utilisateur → versions/20260928-menu-synergies (DPia9wiu4OeyoZRNtEXYH). Bascule current et restart.txt à chaque fois, anciennes cibles conservées. Backend versions/20260921-profile-schools-r2 inchangé. Aucune migration/import/fusion/écriture base.
- Décisions de l'utilisateur prises pendant la session : correction après première publication : enlever uniquement la section Synergies des menus ; conserver recommandations et actions sur les autres pages. Remplace le retrait étendu appliqué initialement.
- Arrêté à : Correctif menu-synergies publié et contrôlé sur le site public. Aucun fichier ni fonction en cours.
- Prochaine action : Attendre la prochaine demande ; préserver la précision utilisateur : menus uniquement, recommandations conservées.
- Preuves : `output/2026-09-28-frontend-sans-synergies/verification.json`.
- Étape : 2026-09-28 16:54:19 CEST — Navigation desktop/mobile, annuaire, page synergies en redirection, types, statistique admin et mentions publiques nettoyés en staging. Fil et profil en cours séparément. Production relue : sans-cercles-r2, build j0CKbKg2B4_1p7LIJYq-o.
- Étape : 2026-09-28 16:55:18 CEST — Fil et profil nettoyés en staging ; compteurs/cartes/API/listeners supprimés. Trois types de notifications synergies et liens correspondants ajoutés au filtre existant. Audit backend confirme messagerie indépendante des synergies ; aucune modification backend.
- Étape : 2026-09-28 16:55:58 CEST — Treize fichiers installés après comparaison aux sauvegardes, TypeScript actif réussi, 11 tests notifications réussis. Seules références restantes : redirection et filtre des notifications masquées. Archive vérifiée : 76 fichiers, 13 changements ciblés.
- Étape : 2026-09-28 16:56:14 CEST — Relecture indépendante des 13 fichiers réussie. Archive et contrôle HTTP transférés sur Hostinger pour nouvelle candidate.
- Étape : 2026-09-28 16:57:07 CEST — Compilation Linux, TypeScript et lint réussis ; assemblage et contrôle HTTP candidate en cours. Guide 05 mis à jour avec retrait et dépendance backend résiduelle des notifications de publications.
- Étape : 2026-09-28 16:57:45 CEST — Candidate validée : build VONsvj3hhv9tNqFn-AA-K, 26 assets et 20 bundles sans interface synergies/cercles. Redirections /synergies et /cercles vers /dashboard réussies.
- Étape : 2026-09-28 16:58:28 CEST — Sept contrôles SSR/effets réussis sur le src actif : menus desktop/mobile, fil/profil, annuaire, admin et requêtes/listeners. Current relu identique à sans-cercles-r2 ; candidate prête.
- Étape : 2026-09-28 16:58:32 CEST — Bascule atomique effectuée : current versions/20260928-frontend-sans-synergies, build VONsvj3hhv9tNqFn-AA-K. Backend toujours versions/20260921-profile-schools-r2.
- Étape : 2026-09-28 16:59:03 CEST — Correction utilisateur reçue après bascule : retirer seulement la section du menu ; conserver recommandations et logique sur les autres pages. Le retrait étendu est remplacé par un retrait des entrées de navigation uniquement.
- Étape : 2026-09-28 16:59:39 CEST — Restauration ciblée terminée : 11 fichiers rétablis. Comparaison complète aux 76 sources avant session : seuls MaliWuliHeader.tsx et layout plateforme diffèrent (retrait des liens menus). Page Synergies, recommandations/actions, compteurs, notifications et FAQ rétablis.
- Étape : 2026-09-28 17:00:13 CEST — Archive corrigée et contrôle vérifiant le maintien des recommandations transférés sur Hostinger.
- Étape : 2026-09-28 17:00:47 CEST — Six contrôles SSR/effets réussis sur la source rétablie : menus sans entrée, recommandations et compteurs fil/profil conservés, annuaire avec propositions, API et listeners synergies présents. Scripts QA local et distant nommés séparément.
- Étape : 2026-09-28 17:02:15 CEST — Correctif compilé (DPia9wiu4OeyoZRNtEXYH). Recommandations présentes dans les bundles ; contrôle texte initial échoue sur accents encodés en JavaScript (vérifié dans bundle dashboard). Contrôle corrigé pour décoder les chaînes ; application inchangée.
- Étape : 2026-09-28 17:03:03 CEST — Candidate menu-synergies validée : build DPia9wiu4OeyoZRNtEXYH, page et recommandations Synergies présentes, 26 assets valides ; retrait cercles conservé. Current relu sans-synergies. Tentative QA précédente stoppée par garde-fou de préfixe socket avant lancement, reprise avec préfixe attendu réussie.
- Étape : 2026-09-28 17:03:07 CEST — Correctif publié : current versions/20260928-menu-synergies, build DPia9wiu4OeyoZRNtEXYH. Backend toujours versions/20260921-profile-schools-r2.
- Étape : 2026-09-28 17:04:07 CEST — Contrôle public du correctif réussi : Synergies et recommandations rétablies, assets identiques à la candidate. Deux fichiers de menus seulement modifiés par rapport au début de session.
- État Git final (2026-09-28 17:04:07 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 67 suivis modifiés/supprimés / 57 entrées non suivies (85 fichiers). Aucun commit ni push.
- Clôture : 2026-09-28 17:04:07 CEST — terminé, statut LIBRE.

### 2026-09-28 16:38:50 CEST — Codex — Frontend sans cercles
- Statut : TERMINÉ
- Demande de l'utilisateur : enlever toute logique de cercle du frontend, fonctionnalité reportée à plus tard.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 suivis modifiés/supprimés / 56 entrées non suivies (84 fichiers).
- Fichiers touchés : frontend/next.config.js; frontend/src/app/(auth)/onboarding/page.tsx; frontend/src/app/(platform)/annuaire/page.tsx; frontend/src/app/(platform)/cercles/page.tsx; frontend/src/components/MaliWuliHeader.tsx; frontend/src/components/feed/ActualiteFeed.tsx; frontend/src/components/notifications/NotificationsPopover.tsx; frontend/src/components/onboarding/StepMentorat.tsx; frontend/src/components/profile/ProfilMembre.tsx; frontend/src/lib/notifications.ts; frontend/src/types/api.ts; frontend/src/types/index.ts; frontend/src/types/profile.ts ; journal, guide 05 et preuves.
- Fait et vérifié : Cercles retirés navigation/fil/profil/annuaire/onboarding, API/listener dédiés supprimés, notifications historiques masquées. TypeScript et compilation Linux réussis ; 8 tests notifications, 5 contrôles SSR/effets et contrôles HTTP candidate/public réussis (26 assets, 18 bundles membres). Redirection serveur /cercles → /dashboard validée.
- Fait mais non vérifié : Aucun travail partiel. Vérifications UI et notifications simulées ; aucun test connecté avec un vrai compte ni téléphone physique. Backend conservé, aucun test écrivant en base.
- Actions à effet externe : Déploiement frontend versions/20260928-home-paris8 (6kWRIfnkU5zQUYQGMeVaJ) → versions/20260928-frontend-sans-cercles-r2 (j0CKbKg2B4_1p7LIJYq-o), lien current atomique et restart.txt. Candidate r1 conservée non activée. Backend versions/20260921-profile-schools-r2 inchangé. Aucune migration/import/fusion/écriture base.
- Décisions de l'utilisateur prises pendant la session : cercles retirés du frontend et implémentation reportée ; backend et données existantes conservés.
- Arrêté à : Frontend sans cercles publié et contrôlé. Aucun fichier ni fonction en cours.
- Prochaine action : Attendre la prochaine demande ; réimplémentation des cercles reportée par l’utilisateur.
- Preuves : `output/2026-09-28-frontend-sans-cercles/verification.json`.
- Étape : 2026-09-28 16:40:48 CEST — Staging préparé : navigation, page cercles remplacée par redirection /dashboard, annuaire, onboarding et types nettoyés. Sous-agents ont retiré les dépendances du fil et du profil, TypeScript overlays valide. Vérification des notifications historiques en cours.
- Étape : 2026-09-28 16:41:33 CEST — Retrait du fil et profil relu : filtres/panneaux/API/listener supprimés, synergies et événements préservés. Anciennes notifications cercle à masquer aussi ; ajustement du compteur et du clic Tout lire pour ne pas modifier les notifications masquées. Décision produit mise à jour dans 05.
- Étape : 2026-09-28 16:42:24 CEST — Dix fichiers frontend installés après comparaison aux sauvegardes : cercles retirés navigation/fil/profil/annuaire/onboarding/types et page convertie en redirection. Backend conservé. Notifications en staging séparé.
- Étape : 2026-09-28 16:46:24 CEST — Douze fichiers frontend installés et relus. TypeScript complet valide, 8 scénarios notifications et 5 contrôles SSR/effets simulés réussis. Archive 76 fichiers : seuls les 12 fichiers prévus diffèrent de la version publiée.
- Étape : 2026-09-28 16:46:43 CEST — Archive source et script de contrôle transférés sur Hostinger ; current encore attendu sur home-paris8.
- Étape : 2026-09-28 16:47:25 CEST — Compilation Linux en cours, TypeScript serveur passé. Inventaire final : seules références conservées sont le type de rôle serveur et le filtre masquant les notifications historiques. Aucune interface ni requête dédiée aux cercles.
- Étape : 2026-09-28 16:48:01 CEST — Build Linux réussi (yakfUqeRsqCXhAgwW4gvC), contrôles pages/ressources/bundles réussis ; contrôle redirection stricte échoue car la redirection de page ne renvoie pas un statut HTTP 307/308. Candidate non activée.
- Étape : 2026-09-28 16:48:49 CEST — Redirection temporaire serveur ajoutée dans next.config.js ; archive corrigée transférée, 13 fichiers diffèrent de la production. Nouvelle candidate r2, premier build conservé et jamais activé.
- Étape : 2026-09-28 16:50:22 CEST — Candidate r2 entièrement validée : build j0CKbKg2B4_1p7LIJYq-o, 26 assets et 18 bundles membres vérifiés ; /cercles redirige correctement vers /dashboard. Current relu versions/20260928-home-paris8.
- Étape : 2026-09-28 16:50:27 CEST — Bascule atomique effectuée : current versions/20260928-frontend-sans-cercles-r2, build j0CKbKg2B4_1p7LIJYq-o ; backend toujours versions/20260921-profile-schools-r2.
- Étape : 2026-09-28 16:51:37 CEST — Contrôle HTTPS public réussi : pages et 26 ressources accessibles, 18 bundles membres sans fonctionnalité cercle, /cercles redirige vers /dashboard. Assets publics identiques à la candidate.
- État Git final (2026-09-28 16:52:25 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 67 suivis modifiés/supprimés / 57 entrées non suivies (85 fichiers). Aucun commit ni push.
- Clôture : 2026-09-28 16:52:25 CEST — terminé, statut LIBRE.

### 2026-09-28 16:35:43 CEST — Codex — Lieu de l’afterwork Paris 8e
- Statut : TERMINÉ
- Demande de l'utilisateur : remplacer Paris 11e par Paris 8e sur la home publiée.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 suivis modifiés/supprimés / 56 entrées non suivies (84 fichiers).
- Fichiers touchés : frontend/src/components/landing/landing-data.ts ; journal, guide 05 et preuves.
- Fait et vérifié : Paris 8e remplace Paris 11e. Diff limité à cette valeur ; compilation Linux, TypeScript/lint et contrôles HTTP candidate/public réussis, 26 assets valides.
- Fait mais non vérifié : Aucun travail restant dans cette correction de libellé.
- Actions à effet externe : Déploiement frontend versions/20260928-home-presentation (ffELDPgTjnC3CY7hSOXld) → versions/20260928-home-paris8 (6kWRIfnkU5zQUYQGMeVaJ), bascule atomique et restart.txt ; backend versions/20260921-profile-schools-r2 inchangé. Aucune écriture base/migration/import/fusion.
- Décisions de l'utilisateur prises pendant la session : Paris 8e remplace Paris 11e pour l’afterwork.
- Arrêté à : Correction publiée et contrôlée. Aucun fichier ni fonction en cours.
- Prochaine action : Attendre la prochaine demande.
- Preuves : `output/2026-09-28-home-paris8/verification.json`.
- Étape : 2026-09-28 16:36:26 CEST — Occurrence unique remplacée dans landing-data.ts. Le reste des 75 fichiers source du frontend est identique à la version publiée.
- Étape : 2026-09-28 16:36:34 CEST — Archive et contrôle transférés, compilation Linux lancée.
- Étape : 2026-09-28 16:36:51 CEST — Relecture indépendante : unique remplacement Paris 11e → Paris 8e, 74 autres fichiers identiques, aucun ajout/suppression. Décision consignée dans le guide 05.
- Étape : 2026-09-28 16:37:40 CEST — Compilation Linux et contrôle candidate réussis, build 6kWRIfnkU5zQUYQGMeVaJ ; Paris 8e présent, Paris 11e absent, 26 assets HTTP 200.
- Étape : 2026-09-28 16:37:57 CEST — Bascule effectuée : current versions/20260928-home-paris8, build 6kWRIfnkU5zQUYQGMeVaJ ; backend inchangé.
- Étape : 2026-09-28 16:38:09 CEST — Contrôle public réussi : Paris 8e présent et Paris 11e absent ; homepage, inscription/connexion et 26 assets HTTP 200, ressources identiques à la candidate.
- État Git final (2026-09-28 16:38:09 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 suivis modifiés/supprimés / 56 entrées non suivies (84 fichiers). Aucun commit ni push.
- Clôture : 2026-09-28 16:38:09 CEST — terminé, statut LIBRE.

### 2026-09-28 16:31:57 CEST — Codex — Home sans mentions illustratives
- Statut : TERMINÉ
- Demande de l'utilisateur : retirer les quatre mentions illustratives de la home pour une présentation ; brancher les données réelles plus tard.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 entrées suivies modifiées/supprimées / 56 entrées non suivies (84 fichiers).
- Fichiers touchés : frontend/src/components/landing/LandingArbre.tsx; frontend/src/components/landing/LandingTree.tsx; frontend/src/components/landing/LandingArbre.module.css ; journal, guide 05 et preuves.
- Fait et vérifié : Les 4 notices et descriptions accessibles retirées, CSS inutilisé supprimé. Compilation Linux/TypeScript, contrôle indépendant du diff et HTTP candidate/public réussis. Labels absents du HTML et du bundle ; inscription conservée.
- Fait mais non vérifié : Aucun travail partiel. Les données réelles restent à connecter ultérieurement, selon la décision utilisateur.
- Actions à effet externe : Déploiement frontend : current versions/20260928-home-arbre (r6fxXo2h-I-T9b-iHpHsU) → versions/20260928-home-presentation (ffELDPgTjnC3CY7hSOXld), restart.txt. Backend versions/20260921-profile-schools-r2 inchangé. Aucune migration/import/fusion/écriture base.
- Décisions de l'utilisateur prises pendant la session : retirer les mentions de démonstration de l’interface pour sa présentation ; connexion aux données réelles reportée. Remplace la décision précédente d’afficher ces mentions.
- Arrêté à : Correction publiée et vérifiée. Aucun fichier ni fonction en cours.
- Prochaine action : Attendre la prochaine demande ; le branchement aux données réelles est un futur chantier.
- Preuves : `output/2026-09-28-home-presentation/verification.json`.
- Étape : 2026-09-28 16:32:58 CEST — Quatre notices retirées, textes accessibles harmonisés et styles inutilisés supprimés. Seuls 3 fichiers landing diffèrent du build publié. CTA inscription et responsive conservés.
- Étape : 2026-09-28 16:33:11 CEST — Relecture indépendante valide un diff limité aux notices/CSS, inscriptions inchangées. Sources et scripts transférés sur Hostinger.
- Étape : 2026-09-28 16:34:00 CEST — Les trois fichiers ont été transférés ; compilation Linux en cours dans la nouvelle source 20260928-home-presentation. Inscription et données inchangées.
- Étape : 2026-09-28 16:34:30 CEST — Compilation Linux, TypeScript/lint et contrôle candidate réussis : build ffELDPgTjnC3CY7hSOXld, 26 assets valides, mentions absentes du HTML et du bundle homepage. Current relu : versions/20260928-home-arbre.
- Étape : 2026-09-28 16:34:43 CEST — Bascule atomique effectuée vers 20260928-home-presentation, build ffELDPgTjnC3CY7hSOXld. Ancienne cible conservée, backend inchangé.
- Étape : 2026-09-28 16:35:14 CEST — Site public vérifié : les quatre mentions et descriptions accessibles sont absentes ; 26 assets valides identiques à la candidate. Panneau France ouvert sans notice et capture live-home.png conservée. Aucun débordement.
- État Git final (2026-09-28 16:35:14 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 entrées suivies modifiées/supprimées / 56 entrées non suivies (84 fichiers). Aucun commit ni push.
- Clôture : 2026-09-28 16:35:14 CEST — terminé, statut LIBRE.

### 2026-09-28 16:08:00 CEST — Codex — Intégration et mise en ligne de la home Arbre
- Statut : TERMINÉ
- Demande de l'utilisateur : mettre en place en live la page d’accueil fournie dans « Plateforme Alumni Mali diaspora.zip ».
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 entrées suivies modifiées/supprimées / 55 entrées non suivies (78 fichiers non suivis).
- Fichiers touchés : dans dépôt actif : frontend/src/app/page.tsx ; frontend/src/components/landing/{LandingArbre.tsx,LandingArbre.module.css,LandingTree.tsx,landing-data.ts,tree-geometry.ts} ; frontend/public/images/landing/mali-wuli-arbre.png. Documentation : journal, guides 04/05 et dossier output daté.
- Fait et vérifié : Home du ZIP intégrée dans Next.js, sans support.js ni modal inscription. TypeScript/lint/build Linux réussis. Smokes connexion/API/villes/Sharp et home (26 assets) réussis. Assets publics identiques à la candidate. Navigateur desktop et mobile (320/375 px) : pas de débordement, menu/FAQ/panneau arbre utilisables, console sans erreur. Clic inscription public vers /register confirmé sans soumission.
- Fait mais non vérifié : Aucun travail applicatif à moitié fait. Pas de test sur téléphone physique ni de réception email ; aucune donnée utilisateur créée. Les profils/événements de la maquette restent explicitement illustratifs.
- Actions à effet externe : Déploiement frontend : versions/20260921-brevet-def-label (build YcLgbCm833jUBenTkA30s) → versions/20260928-home-arbre (build r6fxXo2h-I-T9b-iHpHsU), lien current atomique et restart.txt. Backend inchangé. Aucune migration/import/fusion/écriture base.
- Décisions de l'utilisateur prises pendant la session : homepage du ZIP à mettre en ligne. Nouvelle instruction : tous les boutons d’inscription et appels à l’action vont directement vers la logique existante `/register` ; ignorer le modal d’inscription de la maquette. Cette décision remplace le plan de préremplissage/cartes d’inscription. Aucun changement du parcours d’inscription existant. Exigence mobile friendly ajoutée et vérifiée à 320/375 px.
- Arrêté à : Homepage intégrée et publiée, contrôles terminés. Aucun fichier ni fonction en cours. Serveur local de prévisualisation arrêté.
- Prochaine action : À la prochaine demande, lire le journal puis ouvrir une nouvelle entrée ; source déployée dans hbuilds/sources/20260928-home-arbre. Aucun autre chantier engagé.
- Preuves : `output/2026-09-28-home-arbre/verification.json`.

- Étape : 2026-09-28 16:10:30 CEST — ZIP inspecté : design React à adapter sans runtime support.js. SSH lecture seule réussie : frontend versions/20260921-brevet-def-label, build YcLgbCm833jUBenTkA30s ; backend versions/20260921-profile-schools-r2. Page Next et polices locales préparées en staging ; composants et préremplissage délégués. Tentative de création staging sous mauvais cwd refusée par sandbox, aucun fichier applicatif créé.
- Étape : 2026-09-28 16:12:12 CEST — Contrôle préalable : les 68 fichiers frontend sélectionnés (sources, public et configurations) sont identiques entre le dépôt local et la source de compilation Hostinger. Les polices de la nouvelle home seront limitées à cette route ; les données de démonstration seront identifiées comme illustratives.
- Étape : 2026-09-28 16:14:26 CEST — Décision utilisateur reçue et appliquée au lot : tous CTA inscription vers /register, sans modal ni préremplissage. Les 4 fichiers de préremplissage préparés ont été écartés dans non-retenu-prefill, jamais copiés dans le dépôt actif. Composant home ajusté par le sous-agent.
- Étape : 2026-09-28 16:15:34 CEST — Décision CTA consignée aussi dans 05_ETAT_ET_REPRISE.md. Page racine avec polices scoping local et logo préparés ; arbre SVG, données et CSS créés en staging. Suppression du modal en cours avant copie. Vérifications prévues en lecture seule, aucun test créant un compte ou envoyant un e-mail.
- Étape : 2026-09-28 16:16:10 CEST — Intégration ciblée effectuée avec autorisation de sandbox : 7 fichiers installés (page.tsx, 5 composants/données/styles landing, logo). Fichier existant sauvegardé dans before/. Aucune modification register/onboarding/backend. Aperçu local Next.js lancé sur 127.0.0.1:3006 ; contrôle TypeScript en cours.
- Étape : 2026-09-28 16:17:55 CEST — TypeScript complet réussi. QA navigateur : polices Fraunces/Instrument Sans correctement calculées, 0 formulaire, tous CTA pointent vers /register. Défaut d’hydratation dû aux arrondis trigonométriques et deux détails SVG mobile/focus repérés puis corrigés : précision 3 décimales, viewBox élargi, focus première forme path.
- Étape : 2026-09-28 16:21:14 CEST — Demande mobile friendly ajoutée. Vérification réelle à 375 × 812 : largeur document 375, sans débordement horizontal, en-tête compact et cartes en une colonne ; correction SVG sans erreur dans un onglet neuf. Tous les CTA mènent à /register, test de navigation effectué sans soumission.
- Étape : 2026-09-28 16:22:30 CEST — Archive source de 75 fichiers (sans .env ni dépendances macOS) et scripts transférés sur Hostinger. Relecture indépendante confirme : seuls page.tsx + 5 fichiers landing + logo diffèrent, aucune action DB.
- Étape : 2026-09-28 16:23:06 CEST — QA mobile terminée à 320 et 375 px : aucun débordement, FAQ ouvrable, fiche arbre en panneau bas fermable, menu compact utilisable. Console nouvel onglet : 0 erreur ; inscription accessible sans modal. Build Linux en cours, les contrôles TypeScript serveur ont réussi.
- Étape : 2026-09-28 16:23:53 CEST — Compilation Linux, lint et TypeScript réussis ; candidate versions/20260928-home-arbre créée, build r6fxXo2h-I-T9b-iHpHsU. Contrôle historique connexion/API/Sharp en cours ; homepage spécifique à vérifier ensuite.
- Étape : 2026-09-28 16:26:10 CEST — Smokes initiaux non concluants : processus candidat Ready mais TCP 127.0.0.1 refusé, confirmé par serveur HTTP vide sur autre port (ECONNREFUSED). Aucun défaut applicatif démontré. Préparation d’un transport de test par socket Unix, uniquement pour les scripts QA ; fichiers applicatifs inchangés.
- Étape : 2026-09-28 16:27:32 CEST — Candidate validée : smoke connexion/API/villes/Sharp réussi et homepage réussie (26 assets). Les smokes utilisent un socket Unix privé car TCP loopback refusé ; mêmes assertions, aucune modification applicative. Current relu identique à versions/20260921-brevet-def-label. Activation autorisée par la demande utilisateur live.
- Étape : 2026-09-28 16:27:51 CEST — Bascule atomique effectuée, current=versions/20260928-home-arbre ; build r6fxXo2h-I-T9b-iHpHsU. Ancienne cible conservée dans .previous-target. Backend toujours versions/20260921-profile-schools-r2.
- Étape : 2026-09-28 16:29:21 CEST — Production confirmée : home HTTP 200, 26 assets identiques à la candidate, no-store et register/login accessibles. Navigateur public 1280 et 375 px sans erreur console ni débordement ; clic Créer mon profil confirmé sur /register avec formulaire existant, sans soumission. Captures live-desktop.png et live-mobile.png enregistrées.

- État Git final (2026-09-28 16:30:37 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 entrées suivies modifiées/supprimées / 56 entrées non suivies (84 fichiers non suivis). Aucun commit ni push. Modifications antérieures préservées.
- Clôture : 2026-09-28 16:30:37 CEST — site public vérifié et traces terminées, statut rendu LIBRE.

### 2026-09-26 22:07:51 CEST — Codex — Adoption du protocole de traces
- Statut : TERMINÉ
- Demande de l'utilisateur : appliquer la journalisation obligatoire et la coordination de reprise entre Codex et Claude.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 entrées suivies modifiées/supprimées / 55 entrées non suivies (78 fichiers non suivis avec `--untracked-files=all`).
- Fichiers touchés : aucun dans le dépôt actif ; dans `Mali Wuli` : `PASSATION_IA/JOURNAL_REPRISE.md`, `LIRE_EN_PREMIER.md`, guides `01`, `03`, `04`, `05`, `PROMPT_REPRISE.txt`, et `output/2026-09-26-protocole-traces/verification.json`. `PROMPT_CODEX_TRACES.txt` et l’entrée Claude conservés sans modification.
- Fait et vérifié : protocole intégré aux points d’entrée et guides ; 32 liens locaux valides ; 17 blocs shell vérifiés par `bash -n` sans exécution ; contrôle des 150 empreintes réussi (0 modification, 0 absence) ; ancienne entrée Claude identique par SHA-256 ; état Git final identique au début. Relecture indépendante en lecture seule effectuée.
- Fait mais non vérifié : aucun travail partiellement implémenté ; tests applicatifs, serveur, base et production non recontrôlés dans cette session documentaire.
- Actions à effet externe : aucune.
- Décisions de l'utilisateur prises pendant la session : journal obligatoire au démarrage, à chaque étape significative et à la fin ; arrêt si un autre agent est EN COURS ; pas de push/déploiement sans demande explicite ni de script mutable sans vérification des effets/base et accord ; pas de stash global, de secret dans les traces ni de modification des entrées d'autres agents.
- Arrêté à : harmonisation documentaire et contrôles terminés. Aucun fichier ni fonction applicative en cours, aucun changement à moitié fait.
- Prochaine action : à la prochaine demande utilisateur, relire le journal puis ouvrir une nouvelle session. Les pages proposées dans l’entrée Claude restent une proposition, sans démarrage ni déploiement implicite.
- Preuves : `output/2026-09-26-protocole-traces/verification.json`.
- Étapes : 2026-09-26 22:07:51 CEST — ouverture de session ; aucune action externe.

- Étape documentaire : 2026-09-26 22:08:49 CEST — `PASSATION_IA/LIRE_EN_PREMIER.md` mis à jour, contenu relu ; aucune action externe.
- Étape documentaire : 2026-09-26 22:08:49 CEST — `PASSATION_IA/01_DEMARRER_ET_TRAVAILLER.md` mis à jour, contenu relu ; aucune action externe.
- Étape documentaire : 2026-09-26 22:08:49 CEST — `PASSATION_IA/05_ETAT_ET_REPRISE.md` mis à jour, contenu relu ; aucune action externe.
- Étape documentaire : 2026-09-26 22:08:49 CEST — `PASSATION_IA/PROMPT_REPRISE.txt` mis à jour, contenu relu ; aucune action externe.
- Étape : 2026-09-26 22:09:27 CEST — `python3 PASSATION_IA/verifier_sources.py` réussi : 150 fichiers identiques, aucun absent. Relecture indépendante déléguée en lecture seule : précisions nécessaires dans les guides 03/04 ; aucune écriture par le sous-agent.
- Étape : 2026-09-26 22:09:27 CEST — guide 03 terminé : accord préalable explicite aussi pour les scripts mutables en QA ; aucune action externe.
- Étape : 2026-09-26 22:09:27 CEST — guide 04 terminé : demande explicite pour déploiement/retour arrière, accord des smokes QA, journal immédiat et preuves datées ; aucune action externe.
- État Git final (2026-09-26 22:10:05 CEST) : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`, 66 entrées suivies modifiées/supprimées / 55 entrées non suivies (78 fichiers non suivis). Aucun commit, push ni déploiement.
- Clôture : 2026-09-26 22:10:05 CEST — contrôles terminés, statut rendu LIBRE.

### 2026-09-26 — Claude — Reprise et inventaire des pages
- Statut : TERMINÉ
- Demande : état des lieux après lecture de la passation, puis liste des pages restant à développer.
- État Git au début : branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264`, 66 modifiés / 55 non suivis. `verifier_sources.py` : 150 fichiers, 0 modifié, 0 absent.
- Fichiers touchés : aucun dans le dépôt actif. Créés : `PASSATION_IA/JOURNAL_REPRISE.md`, `PASSATION_IA/PROMPT_CODEX_TRACES.txt`.
- Vérifié : production `mali-wuli.com/login` HTTP 200, build `YcLgbCm833jUBenTkA30s` (identique au 21/09) ; `/api/health` backend OK, base OK. Backend (version, migrations) non vérifié faute de SSH.
- Actions à effet externe : aucune.
- Inventaire des pages manquantes (code vs `Specification_Fonctionnelle_Mali_Wuli.md`) :
  1. Liens cassés (404) : `/cgu` (lien obligatoire à l'inscription), `/confidentialite`, `/contact`.
  2. Profil d'un autre membre : aucune route ; l'annuaire ne mène à aucun profil (`GET /api/users/:id` existe côté backend).
  3. Absents : forum éducation, associations, albums photo, réglages de visibilité des coordonnées, liste des filleuls.
  4. Admin : pas d'écran signalements (route backend existe), ni membres/rôles, cercles, annonces, arbre de parrainage, validation offres/événements/photos ; pas de bouton « Signaler » côté membre.
- Arrêté à : question posée à l'utilisateur — textes CGU/confidentialité fournis ou brouillon à rédiger ?
- Prochaine action proposée : pages `/cgu`, `/confidentialite`, `/contact`, puis profil d'un autre membre.

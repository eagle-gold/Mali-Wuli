# État livré, sujets ouverts et preuves

## 28 septembre 2026 — liens sociaux publiés

**Décision utilisateur :** ajouter LinkedIn, Facebook, Instagram et TikTok à l’inscription et au profil, visibles et cliquables. Les quatre champs sont facultatifs dans Informations ; « Modifier mes infos » ouvre ce même formulaire. Il faut terminer le parcours pour enregistrer sur le serveur. Icônes et noms affichés dans les profils personnel et annuaire, ouverture dans un nouvel onglet. Les accès membres existants sont conservés.

**La limitation précédente au seul LinkedIn est remplacée par quatre liens.** GET/PUT/PATCH users et GET/POST onboarding les conservent ; absence = conserver, vide/null = effacer. Les valeurs relationnelles remplacent l’ancien snapshot à la lecture. HTTP(S), sans identifiants, 500 caractères après normalisation. Le PDF de candidature garde seulement son LinkedIn existant.

Frontend/backend `versions/20260928-liens-sociaux`, build `MF940TX4N8sLGFRsT_gyN`. Anciennes références frontend home-session-r2 / backend suppressions-droits deviennent historiques. Migration additive `20260928220000_profile_social_links`, total15 : LinkedIn élargi500 et trois colonnesNULL. Sauvegarde privée vérifiée sur Hostinger ;18compteurs, comptes/rôles/grants/anciensLinkedIn préservés. Aucune donnée métier réelle modifiée pour les tests.

17tests backend,7groupes frontend,7groupes scripts,TypeScript et buildsLinux passent.235sources,25routes,62ressources publiques conformes. Navigateur compte fictif : ajout, refusURLinvalide, enregistrement complet, réouverture, profils et mobile320 sans débordement. Pas de test sur téléphone physique/Safari ni de mutation authentifiée en production.

**Procédure de publication complétée :** vérifier les processus exécutés et bundles publics, pas seulement current/restart.txt. Ce lot conservait les anciens processus après bascule ; touch des anciens tmp n’a pas suffi, passenger-config était inutilisable (Ruby absent). SIGTERM ciblé backend puis frontend après identification et garde exacte PID/cwd, puis santéHTTP/nouveauxcwd/empreintes publiques validés. Ne pas réutiliser les PID historiques ni arrêter globalement des processus. Voir `runtime-after.json` et `DEPLOIEMENT_EFFECTIF.md`.

Reprise et preuves : `output/2026-09-28-liens-sociaux/LIRE_REPRISE.md`, `verification.json`, `installed.json`. Serveurs/ongletQA fermés, viewport rétabli. Aucun commit/push, aucun fichier partiel. Les anciennes colonnes supplémentaires restent en place lors d’un éventuel rollback applicatif.

## 28 septembre 2026 — accueil connecté, synchronisation complétée

**Précision utilisateur :** connecté sur mali-wuli.com sans www, l’accueil doit afficher Mon espace, pas créer un compte. Cette règle confirme la décision précédente ; la vérification limitée au montage/focus est remplacée par une synchronisation aussi sur pageshow, retour visible et notification après chaque changement effectif de session.

Six fichiers frontend : helpers session communs, hook accueil, login, inscription détails, vérification email et PublicHeader/logout. La home exige toujours une réponse /users/me confirmée. Ancien401/réseau ne doivent pas effacer une nouvelle session. Labels, polices, backend et données conservés.

Publié : frontend versions/20260928-home-session-r2, build ZbOkxHyHSm-qkR0dR9Qeh ; précédent suppressions-droits/cNI0N04igTlrU9KwyDz4k conservé. Backend reste suppressions-droits, aucune migration ni accès SQL. 13groupes session,10tests garde,5tests packager,TypeScript/build réussis.230sources/25routes/62assets publics conformes. Navigateur compte fictif : connexion, retour arrière, reload, autre onglet et mobile375 valides.

Reproduction isolée confirme lacune lifecycle, pas la cause exacte de la capture utilisateur. Aucune session réelle inspectée, pas Safari/téléphone physique. www/apex restent séparés, piste écartée de cette livraison après réponse utilisateur. Preuves et reprise : output/2026-09-28-home-espace-connecte/verification.json et LIRE_REPRISE.md. Aucun commit/push, aucun travail partiel.


## 28 septembre 2026 — suppressions et droits par domaine publiés

**Décision confirmée par l’utilisateur :** « Oui, droits par domaine cumulables ». L’administrateur général agit sur tous les domaines ; les autres membres reçoivent uniquement les domaines choisis. **La limitation précédente à cinq rôles est remplacée par sept rôles cumulables** : Publications et Membres s’ajoutent à Inscriptions, Offres, Événements, Catalogue et Associations. Seul le propriétaire attribue ou retire des rôles, à partir du catalogue serveur ; l’ancien MODERATEUR ne reçoit pas implicitement les nouveaux droits.

Boutons de suppression avec confirmation et contrôles API : publication par auteur/délégué Publications/admin ; commentaire par auteur, auteur de la publication ou modération Publications ; association par responsable désigné/délégué Associations/admin ; offre par auteur/délégué Offres/admin ; événement par organisateur/délégué Événements/admin. Les suppressions liées sont atomiques et le nettoyage des médias suit le commit. Le modèle association ne possède pas de créateur permanent : le responsable actuel gère la fiche. Les comptes des membres restent conservés lorsque l’association est retirée.

**Comptes : choix conservateur annoncé, faute de réponse sur le caractère définitif.** L’action livrée est une désactivation réversible (`SUSPENDU`), qui bloque l’accès et retire le profil des listes éligibles. Rétablir repasse en `EN_ATTENTE`, avec revalidation nécessaire. Sessions/OTP/sockets révoqués, données conservées. Le rôle Membres ne peut agir sur soi-même, le propriétaire ni tout compte privilégié. L’administrateur peut gérer les délégués, mais ne peut se désactiver lui-même. Aucun effacement définitif de compte ni libre-service de suppression de compte ajouté.

État publié : frontend/backend `versions/20260928-suppressions-droits`, build `cNI0N04igTlrU9KwyDz4k`, remplaçant `versions/20260928-priorite-membres-home` et `dj5SeEGNIha9psRUR-GDY`. Anciennes versions et uploads conservés ; aucune migration ni donnée métier réelle modifiée, 14 migrations inchangées. Publication backend puis frontend, contrôles publics/DB après bascule réussis.

81 tests backend, 8 groupes UI, 4 scénarios fixtures, 6 groupes scripts, TypeScript et builds Linux réussis. 230 sources, 25 routes/62 ressources publiques conformes ; 18 compteurs et empreintes des comptes/délégations préservés. Navigateur sur comptes fictifs : annulation, suppression, refus403, compteur commentaires, association, désactivation/rétablissement et protections. Mobile320/375 sans débordement. Pas de téléphone physique/Safari, aucun compte réel utilisé pour des mutations ; courses socket/HTTP testées par mocks.

Preuves et reprise : `output/2026-09-28-suppressions-droits/verification.json`, `LIRE_REPRISE.md`, `installed.json`. Aucun travail partiel, aucun commit/push ; serveurs/onglets QA fermés. Les notices de versions ci-dessous sont historiques.


## 28 septembre 2026 — priorité aux affiliations et session sur l’accueil

**Décision remplacée :** le tri alphabétique par défaut des annuaires établissements et associations laisse place au nombre décroissant de membres affiliés visibles, puis nom et identifiant pour départager. Le tri doit porter sur tous les résultats filtrés avant pagination, et non uniquement les fiches déjà chargées. Les profils comptés sont validés, onboarding terminé ; une personne compte une fois par établissement et une association exige une affiliation validée. Les structures sans membre restent accessibles après les autres.

**Précision remplaçant les CTA systématiquement anonymes :** la home conserve les boutons d’inscription pour les visiteurs. Pour une session valide, elle doit afficher l’accès à l’espace membre et au profil, et orienter les autres actions vers les rubriques correspondantes. Le retour à la home ne ferme pas la session ; une panne réseau transitoire ne doit pas l’effacer. Une session réellement expirée reste refusée par les routes protégées.

État : publié et vérifié, frontend/backend `versions/20260928-priorite-membres-home`, build `dj5SeEGNIha9psRUR-GDY`. Remplace roles-actions sans migration ni écriture en base (14 migrations). 23tests backend,8groupes session,6groupes scripts et builds Linux valides ; 226sources/25routes/66assets publics conformes. Sept établissements réellement affiliés en tête ; associations réelles vides donc tri testé sur RAM. Accueil connecté/rechargement/retour au fil et mobile320 vérifiés sur comptes fictifs. Détails et limites : `output/2026-09-28-priorite-membres-session-home/LIRE_REPRISE.md` et `verification.json`.

## 28 septembre 2026 — rôles spécialisés cumulables publiés

**Décision précédente remplacée :** l’utilisateur confirme que l’administrateur général reste `ik736764@gmail.com`, et demande des rôles spécialisés cumulables. La limitation précédente Membre/Modérateur global est remplacée. Le propriétaire choisit librement toute combinaison de cinq rôles et peut la modifier sans développement :

| Rôle | Actions |
|---|---|
| Validation des inscriptions | Consulter et valider/refuser les inscriptions ordinaires en attente. |
| Gestion des offres | Consulter les propositions, modérer, modifier et retirer les offres. |
| Gestion des événements | Modérer les événements, gérer informations, couverture et photos. |
| Gestion du catalogue | Traiter les propositions et notifications du catalogue éducatif. |
| Gestion des associations | Créer/gérer fiches, responsables, suggestions et affiliations ; pas valider sa propre affiliation. |

Seul le propriétaire attribue/retire les rôles et voit les statistiques globales. Aucun de ces rôles spécialisés n’accorde les autres domaines. La responsabilité d’une association précise reste distincte et conserve ses droits sur cette association. L’ancien MODERATEUR global reste compatible mais n’est plus attribuable ; sa modification explicite le remplace par les cases choisies avec avertissement de perte de ses autres droits. Aucun compte réel n’a été modifié pendant la livraison.

**Accès : Administration → Membres et rôles → rechercher une personne → Modifier les rôles → cocher plusieurs choix → Vérifier les changements → Confirmer.** Tout décocher retire les délégations, sans supprimer le compte. Le propriétaire est protégé. Un compte doit être validé et avoir confirmé son e-mail avant attribution. Les changements ferment les anciennes sessions et invalident les OTP/sockets. Les menus et API sont contrôlés par permission, pas seulement par affichage de boutons.

Frontend et backend publiés : `versions/20260928-roles-actions`, build `FuGDWQkQpcBCevVL404El`. Remplace `versions/20260928-fond-mobile-roles`. Migration additive `20260928210000_delegated_roles` appliquée : table UserRoleGrant, 14 migrations au total, aucune reprise de données, aucun rôle réel attribué. Sauvegarde privée avant migration, 12 compteurs et empreinte User(role/tokenVersion/statut) inchangés.

70 tests backend, 11 groupes frontend, 4 groupes scripts, TypeScript et builds Linux réussis. 222 sources, 25 routes, 66 assets et 39 bundles publics contrôlés ; accueil/inscription conservés. QA navigateur sur RAM : cumul Offres+Événements, réouverture des cases, navigation limitée, accès aux offres et refus rôles/associations ; 320/375/768/1280 sans débordement. Production : API saine et redirection anonyme de membres/rôles vers connexion. Pas de téléphone physique/Safari ni mutation métier réelle pour les tests.

Reprise et preuves : `output/2026-09-28-roles-actions/LIRE_REPRISE.md` et `verification.json`. Aucune fonction à moitié écrite. Serveurs et onglets de QA fermés, aucun commit/push.

## 28 septembre 2026 — fond uniforme, mobile et rôles publiés

**Décision nouvelle/remplacée :** l’utilisateur choisit un **Modérateur global**, au lieu de droits séparés. `ik736764@gmail.com` reste le seul administrateur et le seul à attribuer/retirer les rôles. L’ancien modèle autorisant plusieurs ADMIN via `ADMIN_EMAILS` est remplacé : ADMIN effectif exige désormais l’adresse propriétaire et le rôle DB ADMIN. Le compte était déjà le seul ADMIN validé et confirmé ; aucune correction de base nécessaire.

Accès **Administration → Membres et rôles** : recherche, filtres, choix Membre/Modérateur, confirmation. Compte propriétaire protégé, comptes non validés/non confirmés non assignables ; modification concurrente refusée, sessions/OTP/sockets invalidés. Le modérateur valide les inscriptions ordinaires en attente, les offres, les événements et le catalogue, et consulte les signalements. Rôles, associations admin et statistiques restent réservés au propriétaire. Volontariat et responsabilité d’association sont des fonctions séparées, liées au profil ou à la fiche d’association.

Toutes les racines de page partagent `--color-page:#f4ecdd` ; les variations antérieures de fond sont remplacées. Cartes claires et polices conservées. Correctifs mobiles : OTP six cases, formulaires mentorat/événements, filtres, actions longues, pagination, messagerie ; recherche dans le menu mobile et déconnexion accessible tablette. Synergies et recommandations ailleurs conservées, aucun retour des cercles.

Nouvelle version des deux applications : `versions/20260928-fond-mobile-roles`, build `XKxGZymQs7bdnHFnsf0bl`. Remplace les current `versions/20260928-offres-emploi` décrits ci-dessous ; fonctionnalités antérieures conservées. **Aucune migration ni écriture base, 13 migrations inchangées.** 65 tests backend, 7 groupes frontend, 66 mesures navigateur sur 320/375/768/1280, 220 sources/66 assets/39 bundles et 25 routes publics vérifiés. Interactions sur RAM ; service compilé vérifié sur base réelle en lecture seule. Pas de téléphone physique/Safari ni attribution de rôle réelle pour le test.

Preuves et reprise : `output/2026-09-28-fond-mobile-roles/verification.json`, `LIRE_REPRISE.md`. Aucun commit/push. Serveurs QA arrêtés, onglets fermés et viewport rétabli.


## 28 septembre 2026 — offres d’emploi publiées

**Nouvelle décision utilisateur :** reprendre la maquette offres, proposer trois modes de candidature et conserver une validation admin avant publication. L’ancien écran d’offres simple est remplacé. La procédure d’autorisation persistante des migrations/publications reste en vigueur.

Frontend et backend publiés : `versions/20260928-offres-emploi`, build frontend `R-M49imb1rXepiN59auq5`. Cela remplace les cibles courantes décrites ci-dessous (frontend parcours-recents/backend evenements-photos), dont les fonctionnalités sont conservées. Migration additive `20260928200000_job_applications` appliquée à `u668963025_maliwuli`, 13 migrations vérifiées, backup privé 31 533 640 octets, compteurs existants inchangés.

Liste/détail avec cinq filtres, favoris privés, dépôt avec aperçu et admin dédié. Création et modification remettent en attente, même par admin ; validation ADMIN/MODERATEUR obligatoire. Lien externe : redirection HTTP(S). Mali Wuli : message au déposant avec profil et lien. E-mail : PDF professionnel envoyé depuis `contact@mali-wuli.com` vers l’adresse de candidature fournie, sinon celle du compte déposant, avec Reply-To candidat. Coordonnées partagées explicites, téléphone seulement visible ; aucune donnée privée annexe du profil. Révision obligatoire avant modération et candidature évite la validation ou l’envoi vers une offre changée après lecture. Dates limites fin de journée UTC, indiquées au formulaire.

Candidatures uniques et reprises explicites après échec certain ; SMTP ambigu reste `EN_COURS` sans renvoi automatique. Vérifier les journaux SMTP avant de débloquer un tel cas, ne pas convertir arbitrairement en échec. Détails opérationnels dans `output/2026-09-28-offres-emploi/LIRE_REPRISE.md`. Inclure désormais `backend/assets/fonts` dans les archives backend (PDFKit/Noto).

61 tests backend,19 groupes frontend et7 fixtures, PDF court/long/Linux vérifiés. 81 contrôles SQL/services réussis,60 ressources et34 bundles publics conformes, mobile320 sans débordement. Aucune offre réelle dans la base lors des tests ; parcours interactifs sur RAM, SMTP contact vérifié sans envoi d’une candidature réelle. Aucun commit/push. Preuves : `output/2026-09-28-offres-emploi/verification.json`.


## 28 septembre 2026 — parcours récents en premier

**Décision remplacée :** l’utilisateur demande désormais la dernière expérience en premier, et le même sens pour les formations. Le tri ancien → récent décrit dans la passation initiale est annulé. Nouveau tri par date de début décroissante sur profil personnel/public et formulaires de modification, avec dates manquantes à la fin et égalités stables. Le regroupement interne des anciennes écoles/lycées conserve son ordre croissant nécessaire à la fusion ; aucun changement des périodes ou diplômes stockés. Publication terminée et vérifiée : frontend `versions/20260928-parcours-recents`, build `OsGa4wg5bN0eLzWW4pzBH`, remplace `versions/20260928-evenements-photos` / `g_ZlNJ4g3BexnPjw2JQYj`. Backend inchangé `versions/20260928-evenements-photos`, aucune migration ni écriture en base. 9 tests métier et 7 contrôles rendu/fusion réussis, profil personnel/public et formulaire vérifiés sur fixtures, 193 empreintes sources conformes, 54 ressources et 30 bundles HTTPS conformes. Voir `output/2026-09-28-parcours-recents/verification.json`.

## 28 septembre 2026 — autorisation persistante des publications

**Procédure remplacée par décision explicite de l’utilisateur :** « Migre evenement et n’attend plus pour migrer quand tu finis quelque chose migre ». L’accord est désormais donné pour migrer et publier les lots achevés après vérifications, dont événements et recherche en cours. Ne plus redemander un accord de routine à chaque lot. Les sauvegardes, contrôles des effets/base, migrations ciblées et preuves restent obligatoires ; cet accord ne vaut pas autorisation d’imports, fusions ou suppressions massives. L’ancienne attente d’accord événements ci-dessous est levée ; publication en cours, suivre le journal.

## 28 septembre 2026 — événements et recherche publiés

**État remplacé : l’attente d’accord et le statut local du lot événements ci-dessous sont dépassés.** Accord reçu (« Migre evenement… »), sauvegarde complète récente vérifiée, migration additive `20260928190000_event_photos` appliquée et publication terminée. Frontend et backend : `versions/20260928-evenements-photos`, build frontend `g_ZlNJ4g3BexnPjw2JQYj`. Ancienne cible des deux applications : `versions/20260928-annuaire-associations`, conservée dans `.previous-target`. Aucun import ni donnée de démonstration en production.

L’en-tête a aussi été corrigé : champ recherche élargi à 260 px dès xl / 290 px dès 2xl, texte complet visible, polices inchangées. Il ouvre l’annuaire Personnes ; l’onglet Associations conserve le terme. Ce n’est pas une recherche globale des événements/publications/messages. Limites observées, non modifiées par ce correctif : URL non synchronisée lors des modifications internes de filtres/onglet, nouvelle recherche header conservant les filtres existants, absence de maxLength100 côté header, recherche associations par expression entière. Détail dans `audit-recherche.md`.

Preuves consolidées : `output/2026-09-28-recherche-header/verification.json`, `LIRE_REPRISE.md`, `source-manifest.json`. 193 sources comparées au code compilé, 54 assets et 30 bundles publics conformes ; UI header 1280/1536 et mobile320 vérifiée, recherche Personnes→Associations exercée sur fixtures. 91 contrôles schéma/services réussis et comptes préservés. Le seul WARN est l’absence d’événement réel pour vérifier une fiche en base. La route publique `/evenements` redirige l’anonyme vers `/login`.

Le serveur de base utilise MariaDB11.8.9 avec provider Prisma mysql : `programme JSON` est exposé comme LONGTEXT utf8mb4_bin avec CHECK(JSON_VALID(programme)). Le premier vérificateur exigeait le type natif JSON ; il a été corrigé strictement après lecture du schéma et vérifie les contraintes actives. Aucune modification applicative ni migration supplémentaire n’était nécessaire. Script final dans ce nouveau dossier ; ne pas relancer l’ancien vérificateur événements qui ignore l’alias.

## 28 septembre 2026 — événements et albums contributifs préparés localement

**Nouvelle décision :** tout participant inscrit peut ajouter des photos à l’événement, même après sa fin. Cette règle remplace la restriction « organisateur seulement » visible sur la maquette. Les photos de l’album sont visibles par les membres ayant accès à l’événement. L’auteur, l’organisateur et la modération peuvent retirer une photo ; la couverture reste gérée par l’organisateur/modération.

Implémentation locale : liste à venir/passés groupée par mois, filtres, fiche avec programme/participants/album, proposition avec couverture et fuseau horaire, espace admin pour publier/refuser. Les modifications principales par l’organisateur repassent en validation ; résumé seul, couverture et album conservent la publication. Inscription avant le début, désinscription fermée après le début pour préserver l’historique. Les nouvelles pages reprennent Inter/Playfair et le design existant, avec contrôles mobiles à 320 px.

**Non publié à ce stade.** Migration additive `20260928190000_event_photos` préparée, non appliquée. L’accord de migration/publication précédent concernait les associations ; un nouvel accord a été demandé pour ce lot. Production dernière connue inchangée : `versions/20260928-annuaire-associations`. Aucun événement de démonstration n’a été créé dans la base. Les essais fonctionnels utilisent uniquement une API locale en RAM.

Preuves : `output/2026-09-28-evenements-photos/verification.json`, `review-final.json`, `installed.json`, `LIRE_REPRISE.md`. Client Prisma local généré, TypeScript et build frontend passés, 16 tests backend événements, 29 régressions, 4 groupes dates/ICS, 14 groupes formulaire/admin et 9 groupes UI. QA navigateur : proposition/couverture → validation admin, inscription → photos par participante, ajout après événement, responsive320. Le contenu ICS est testé ; l’automatisation IAB n’a pas confirmé le fichier téléchargé, malgré le déclenchement visible. Préserver les décisions précédentes associations/scolaire/cercles/Synergies.

## 28 septembre 2026 — annuaire et associations publiés

**Nouvelle demande et autorisation explicite :** annuaire Personnes / Associations, fiches publiques des membres, gestion des associations par un responsable validé et par l’administrateur, affiliations soumises à validation et propositions d’ajout internes. L’utilisateur a ensuite autorisé la migration et la publication (« Oui, migrer et mettre en ligne »).

L’étape Associations est facultative, après les quatre étapes existantes de l’onboarding. Ses demandes sont enregistrées séparément du snapshot scolaire. Le profil propriétaire distingue affiliations validées, demandes privées, fiches non publiées et « Associations que je gère » ; un responsable n’a pas besoin de s’affilier à sa propre association. Les profils publics n’exposent que les affiliations validées d’associations actives. Les comptes EN_ATTENTE restent limités aux demandes personnelles, sans gestion d’autrui.

**État confirmé : migration appliquée et publication vérifiée le 28 septembre 2026 à 17 h 42 CEST.** La migration additive `20260928180000_association_directory` a réussi sur `u668963025_maliwuli`, après une sauvegarde privée complète de 31 533 042 octets et un contrôle des dix migrations déjà appliquées. Les comptages suivis sont préservés. Les 47 contrôles MySQL en lecture seule réussissent ; le rapport porte `WARN` uniquement pour `DETAIL_SKIPPED_NO_ACTIVE_ASSOCIATION` : zéro association active, donc aucun détail réel à exercer.

Les deux versions Linux actives sont `versions/20260928-annuaire-associations`, build frontend `oEfW-e-0s4HeQEgov9CNS`. La candidate frontend passe les contrôles de routes, navigation, 46 assets et 25 bundles ; accueil et inscription conservent leurs signatures. Les parcours interactifs ont été vérifiés séparément sur fixtures locales : tests, affiliations, gestion responsable/admin, photo et mobile 320 px. Cela ne vaut pas un parcours métier authentifié complet sur la production.

Avant bascule, frontend `versions/20260928-menu-synergies` / `DPia9wiu4OeyoZRNtEXYH` et backend `versions/20260921-profile-schools-r2`. Les deux liens `current` pointent désormais sur `versions/20260928-annuaire-associations`. API et base saines ; contrôles HTTPS réussis : 46 assets, 25 bundles, routes et recommandations. JavaScript, styles et polices identiques à la candidate ; les deux PNG sont recompressés sans perte par le CDN, vérifiés par hash des pixels et dimensions. Les anciennes versions sont conservées dans `.previous-target`. Le build local avec API `127.0.0.1:4307` reste exclusivement QA ; seules les candidates recompilées sous Linux avec les URLs publiques sont destinées à la publication.

Les décisions antérieures restent en vigueur : cercles masqués, menus Synergies retirés mais recommandations/actions conservées, Paris 8e, accueil sans notices et CTA directs vers `/register`, typographie existante et données scolaires préservées. Les archives sources actuelles sont conformes au manifeste (174 fichiers, sans secrets ni builds) ; ne pas réappliquer un ancien lot retirant entièrement Synergies.

Preuves : `output/2026-09-28-annuaire-associations/verification.json`, `LIRE_REPRISE.md`, `backup-verification.json`, `migration-guard.json`, `migration-deploy.txt`, `backend-readonly-after.json`, `frontend-candidate.json`, `frontend-public.json`, `backend-public.json`, `remote-final.json`, `public-images-comparison.json`, `source-manifest.json`. La sauvegarde elle-même reste privée sur le serveur. Garder ces preuves et les anciennes releases ; un retour arrière applicatif conserve le schéma additif et les nouvelles données, sans restauration automatique de MySQL.


## 28 septembre 2026 — Synergies : uniquement les menus

**Décision remplacée après précision de l’utilisateur :** le retrait étendu de Synergies est annulé. Il faut uniquement enlever l’entrée « Synergies » des menus desktop/mobile, y compris la navigation basse. Les recommandations, propositions, compteurs, appels API, événements temps réel et notifications des autres pages restent disponibles. La page `/synergies` reste accessible pour les liens existants et la gestion des demandes.

État : correctif publié et vérifié sur https://mali-wuli.com : `versions/20260928-menu-synergies`, build `DPia9wiu4OeyoZRNtEXYH`. Remplace la publication initiale trop étendue (`20260928-frontend-sans-synergies`, build `VONsvj3hhv9tNqFn-AA-K`). Onze fichiers sont rétablis ; seuls `MaliWuliHeader.tsx` et `(platform)/layout.tsx` diffèrent de la version avant cette session (`20260928-frontend-sans-cercles-r2`). Six contrôles SSR/effets, compilation et HTTP candidate/public réussis, recommandations présentes. Preuves et chronologie : `output/2026-09-28-frontend-sans-synergies/verification.json`.

Le retrait des cercles reste en vigueur. Backend et base n’ont été ni modifiés ni migrés. Les notifications liées aux synergies sont à nouveau visibles et leurs compteurs/actions conservent la logique existante. Les anciens contrôles `*-retrait-etendu.*` décrivent la première publication annulée par la précision utilisateur, pas l’état final attendu.

## 28 septembre 2026 — cercles reportés

**Décision remplacée :** les cercles ne doivent plus être proposés dans le frontend. Retirer navigation, filtres/panneaux du fil, cartes/propositions de profil, badges de l’annuaire et mentions d’onboarding ; supprimer appels API et abonnements temps réel dédiés. L’ancien chemin `/cercles` renverra vers `/dashboard`. Les notifications historiques liées aux cercles doivent rester masquées, sans être marquées lues automatiquement. Les données et routes backend sont conservées pour une future implémentation, sans migration ni écriture en base.

État : publié et contrôlé sur https://mali-wuli.com. Frontend `versions/20260928-frontend-sans-cercles-r2`, build `j0CKbKg2B4_1p7LIJYq-o`, remplace `versions/20260928-home-paris8`. Backend `versions/20260921-profile-schools-r2` inchangé. 8 tests notifications, 5 contrôles SSR/effets simulés, compilation Linux et contrôles HTTP candidate/public réussis. Ancien chemin couvert par une redirection temporaire dans `next.config.js` et un repli dans la page. Preuves : `output/2026-09-28-frontend-sans-cercles/verification.json`.

Détails de reprise : aucun appel `/cercles` ni listener `cercle_modifie` ne subsiste dans le frontend. Le rôle `PRESIDENT_CERCLE` est conservé uniquement dans le type du contrat serveur. Le filtre de notifications ignore le type `CERCLE` et les destinations `/cercles` ; compteur et « Tout lire » portent sur les notifications visibles. Sans filtre backend, le compteur effectue 1 à N lectures de 50 notifications jusqu’à retrouver toutes les non lues, et « Tout lire » utilise un PATCH par notification visible (lots de 10). Tests uniquement simulés, aucune lecture n’est marquée automatiquement en base.


## 28 septembre 2026 — afterwork à Paris 8e

**Lieu remplacé sur demande utilisateur :** l’afterwork diaspora affiche désormais « Paris 8e » au lieu de « Paris 11e ». Correction publiée et vérifiée : frontend `versions/20260928-home-paris8`, build `6kWRIfnkU5zQUYQGMeVaJ` ; remplace `versions/20260928-home-presentation`. Preuves dans `output/2026-09-28-home-paris8/verification.json`.


## 28 septembre 2026 — présentation sans mentions de démonstration

**Décision remplacée :** les notices « Arbre illustratif », « Profils et chiffres présentés à titre illustratif », « Publications et profils illustratifs » et « Événements illustratifs » doivent être retirées, ainsi que leurs formulations accessibles, sur instruction explicite de l’utilisateur pour sa présentation. Les données de la maquette restent en place ; leur connexion aux données réelles est prévue plus tard et ne fait pas partie de cette correction. Aucun changement de l’inscription ou de la base.

État : publié et vérifié sur https://mali-wuli.com ; frontend `versions/20260928-home-presentation`, build `ffELDPgTjnC3CY7hSOXld`, remplace `versions/20260928-home-arbre`. Backend inchangé, aucune écriture en base. Voir `output/2026-09-28-home-presentation/verification.json` et l’entrée correspondante du journal.


## 28 septembre 2026 — accueil Arbre publié

Demande utilisateur : intégrer et mettre en ligne la homepage du ZIP « Plateforme Alumni Mali diaspora.zip ». Le design Arbre est adapté au frontend existant ; ses polices Fraunces / Instrument Sans sont limitées à l’accueil. La décision de conserver Inter / Playfair sur les autres pages reste valable.

**Décision remplacée dans le plan d’intégration :** la carte d’inscription de la maquette et le préremplissage envisagé sont abandonnés sur instruction explicite de l’utilisateur. Tous les boutons d’inscription et appels à l’action doivent aller directement vers `/register`, qui conserve la logique d’inscription existante. « Se connecter » reste relié à `/login` ; les ancres, FAQ et interactions de découverte de l’arbre servent leur fonction de navigation/exploration.

Exigence utilisateur ajoutée : rendu adapté au mobile. Contrôles navigateur effectués à 320 × 740 et 375 × 812 : aucun débordement horizontal, menu compact, cartes en une colonne, FAQ et panneau de l’arbre utilisables au toucher.

État : publié sur https://mali-wuli.com. Frontend `versions/20260928-home-arbre`, build `r6fxXo2h-I-T9b-iHpHsU` ; remplace `versions/20260921-brevet-def-label` conservée pour retour arrière. Backend inchangé (`versions/20260921-profile-schools-r2`), aucune écriture en base. Les contrôles publics et les 26 assets correspondent à la candidate. Les chiffres/profils/événements de la maquette sont signalés comme illustratifs. Voir l’entrée du 28 septembre dans le journal et `output/2026-09-28-home-arbre/verification.json` pour les vérifications et la version effectivement publiée.

## 26 septembre 2026 — procédure de traces remplacée

**Ancienne procédure remplacée :** un compte rendu après les travaux significatifs et la lecture de `LIRE_EN_PREMIER.md` seuls ne suffisent plus. La consigne explicite de l’utilisateur impose désormais de lire [JOURNAL_REPRISE.md](JOURNAL_REPRISE.md) en premier, de prendre le statut de session, puis de tenir son entrée à jour à chaque étape significative et à la clôture.

Le protocole complet est dans [PROMPT_CODEX_TRACES.txt](PROMPT_CODEX_TRACES.txt). Il impose notamment : arrêt et question à l’utilisateur si un autre agent est EN COURS ; état Git au début et à la fin ; indication exacte « Arrêté à » ; traçabilité immédiate des actions externes ou « aucune » ; décisions utilisateur ; preuves dans `output/<AAAA-MM-JJ>-<sujet>/verification.json` ; aucune réécriture d’une entrée d’un autre agent.

Aucun push ni déploiement sans demande explicite. Aucun import, fusion, nettoyage ou smoke écrivant en base sans contrôle des effets et de la base visée, puis accord utilisateur. Pas de stash global ni de secret dans les traces. Les commits éventuels doivent être ciblés et leurs hashes inscrits au journal. Clôturer son entrée avec TERMINÉ ou INTERROMPU, l’étape de reprise et la prochaine action, puis remettre « Statut courant » à LIBRE.

Cette mise à jour concerne la méthode de travail. Elle ne change aucune décision produit et n’autorise aucune intervention applicative ou en production. Les observations ultérieures de Claude et Codex sont consignées dans le journal ; l’état historique ci-dessous reste daté de la passation initiale.

## Situation à la fin de cette conversation de développement

Le dernier changement applicatif demandé était le libellé **« Ajouter le brevet / DEF »**. Il a été déployé et le texte du bundle public vérifié le 21 septembre. Les demandes suivantes n’ont pas ajouté de changement applicatif : le 26 septembre, le demandeur a demandé cette passation locale.

Les vérifications historiques ci-dessous sont des résultats conservés, pas des tests relancés le 26 septembre. La rédaction de la passation n’a modifié ni l’application active, ni la base, ni la production.

| Sujet | État confirmé dans le travail précédent | Limite à connaître |
|---|---|---|
| Connexion par code | URL publique corrigée dans le JavaScript de production ; navigation jusqu’à la saisie du code testée. | La réception réelle d’un email n’a pas été testée. Ne pas confondre absence d’erreur de la requête et délivrabilité SMTP. |
| Navigation publique | Liens de l’espace membre cachés avant connexion, y compris menu mobile. | Refaire une vérification déconnectée si le header ou l’authentification change. |
| Écoles et lycées | Formulaire commun, plusieurs diplômes, programme scolaire indépendant du pays, dates compatibles avec plusieurs diplômes dans une même scolarité. | Le catalogue et les programmes externes peuvent contenir des libellés hétérogènes. |
| Insertion et avis | Questions d’insertion réservées au supérieur ; les réponses scolaires d’insertion sont écartées côté backend. | Les avis sur l’établissement scolaire existent toujours, selon les conditions de date. |
| Tri | Formations et expériences classées du plus ancien au plus récent. | Préserver le tri après ajout, modification et lecture des anciennes données. |
| Profil | Prénom/nom, photo de couverture modifiable, validation des uploads et affichage mobile vérifiés. | Pas de demande en attente de remplacer le titre par « Votre profil » : le choix final est prénom/nom. |
| Typographie | Retour à la configuration originale Inter / Playfair Display et anciens styles de titres. | La version Source Sans 3 dans des archives plus anciennes a été annulée. |
| Sélecteurs scolaires | Diplôme, mention et série avec choix proposés, « Autre », retour à la liste et conservation du texte. | Vérifier les valeurs historiques absentes du menu, qui s’ouvrent comme personnalisées. |
| Statut individuel | Sélecteur présent seulement si le statut global est `EN_COURS`. | Le choix global `OBTENU` met aussi les diplômes individuels à `OBTENU`. |
| Libellés | L1 → Licence ; bouton et catégorie Brevet / DEF. | Les identifiants du catalogue n’ont pas été renommés pour un simple changement d’affichage. |
| Catalogue | Trois rapprochements ciblés corrigés, références locales obsolètes corrigées, audit global effectué. | Les nouveaux candidats de l’audit n’ont pas fait l’objet d’un nettoyage global. |
| Parrainage | Lien d’invitation et rattachement du parrain présents. | Aucun système de récompenses, compteur dédié ou notifications de parrainage confirmé. |

## Prochaine priorité technique connue : le catalogue

L’audit a parcouru **141 941 fiches actives**, dans **200 pays et territoires**, dont **20 270 au Mali**. Ce total correspond à l’export du 21 septembre, pas à un comptage en temps réel.

- Au Mali : **31 paires à forte concordance**, soit 62 fiches ; **22 paires supplémentaires** par rapport au précédent rapprochement des registres. Exemples : Oumou Sidibé, Aminata Haïdara, Moustaph, Oumoutah et Sogoba. Ce sont des doublons probables, pas des établissements certifiés identiques par une enquête indépendante.
- Au Mali également : **2 398 paires ambiguës**, impliquant 4 006 fiches, et 295 collisions de codes de cluster. Les catégories de signaux se recoupent ; ne pas additionner les paires comme un nombre de suppressions à effectuer.
- Hors Mali : 121 671 fiches parcourues ; 305 paires prioritaires concernant 543 fiches. La liste contient des doublons probables **et** des anomalies de rattachement, pas seulement des doublons.
- Des rattachements antérieurs trop larges ont été relevés, notamment plusieurs identifiants ROR d’établissements distincts réunis sous une fiche. Un code, sigle, alias ou domaine commun ne suffit pas pour une fusion.

Le rapport lisible est dans [le dossier d’audit](../output/catalogue-audit-2026-09-21/README.md). Les résultats détaillés et l’export `catalogue.jsonl.gz` y sont conservés. Aucun dump contenant les profils utilisateurs n’est copié dans la passation.

Si le demandeur souhaite poursuivre ce nettoyage :

1. Reprendre les 31 paires et les priorités hors Mali, puis confirmer les identités à partir des sources. Distinguer établissement, branche, campus, cycle et composante.
2. Vérifier que les fiches et rattachements n’ont pas évolué depuis l’export.
3. Préparer un plan de rapprochement explicite et une sauvegarde récente avant toute mutation.
4. Traiter aussi les références hors clés étrangères : brouillons JSON, suggestions, contexte et questions de forum. Voir le guide backend.
5. Appliquer un lot vérifié, contrôler la conservation des formations, avis, offres, alias et sources, puis les résultats réellement servis au frontend.

Le script nommé `audit-education-dedup.ts` **n’est pas un audit neutre** : il peut muter la base et appelle un service externe. Ne pas le lancer pour simplement « regarder les doublons ».

## Régressions déjà rencontrées à éviter

- **URL locale dans le client de production** : `NEXT_PUBLIC_*` est figé au build. Corriger l’environnement du processus après compilation ne répare pas le JavaScript servi.
- **Build macOS déployé sous Linux** : problème de dépendance native Sharp. Compiler le livrable de production sous Linux avec les dépendances appropriées.
- **HTML ancien mis en cache** : références vers des chunks disparus et écran blanc. Conserver le traitement du rendu dynamique et vérifier le HTML servi.
- **Références scolaires asynchrones** : après passage du programme malien au français, une réponse du contexte précédent ne doit pas réalimenter le formulaire. Le cache est indexé par contexte et un repli immédiat existe.
- **Diplômes techniques** : BTS, BT et brevets professionnels/techniques ne doivent pas être classés comme brevet scolaire.
- **Liste locale mélangée au catalogue actif** : elle réintroduisait des identifiants obsolètes. Le frontend renvoie maintenant la liste serveur telle quelle quand la requête réussit, même vide ; le secours n’intervient qu’en panne.
- **Saisie personnalisée dans une liste** : préserver le texte lors de la réédition, d’un changement de programme et du retrait d’une autre ligne.
- **Sauvegarde incomplète du questionnaire** : le bouton du formulaire et « Continuer » actualisent l’état local ; le POST serveur est déclenché à la fin du questionnaire. Ne pas conclure à une persistance serveur après le seul bouton d’une fiche.

## Historique utile des versions

Toutes les versions ci-dessous ont été observées dans le travail du 21 septembre. Les chemins et liens actifs doivent être relus avant une reprise de production.

| Version frontend | Contenu principal | Preuve locale |
|---|---|---|
| `20260921-login-api-fix` | URL publique de connexion, garde-fou de build et vérification des assets | [Résultat](preuves/verification-login-fix-2026-09-21.json) |
| `20260921-profile-schools-r2` | Parcours scolaire, profil/couverture, corrections ciblées du catalogue, validation des références | [Résultat](preuves/verification-profile-schools-2026-09-21.json) |
| `20260921-hide-catalogue-label` | Suppression du badge de validation du catalogue et de son explication | Historique de la conversation et code actuel ; pas de fichier `verification.json` distinct copié ici |
| `20260921-canonical-suggestions` | Suppression du mélange catalogue/liste locale et correction des références de secours | [Résultat](preuves/verification-catalogue-audit-2026-09-21.json) |
| `20260921-licence-label` | L1 affiché Licence, anciens libellés et recherche adaptés | [Résultat](preuves/verification-licence-label-2026-09-21.json) |
| `20260921-school-selects-font-rollback` | Anciennes polices et sélecteurs avec Autre | [Résultat](preuves/verification-school-selects-font-rollback-2026-09-21.json) |
| `20260921-diploma-status` | Statut individuel seulement en cours de formation | [Résultat](preuves/verification-diploma-status-2026-09-21.json) |
| `20260921-brevet-def-label` | Libellé Brevet / DEF | [Résultat](preuves/verification-brevet-def-label-2026-09-21.json) |

Le backend est resté sur `20260921-profile-schools-r2` pour les dernières modifications de présentation. Un retour vers un ancien frontend pourrait réintroduire des décisions annulées ; conserver une trace précise du changement voulu.

## Niveau de vérification atteint

Les vérifications conservées comprennent compilation Linux, TypeScript, tests ciblés, smoke HTTP, recherches publiques et essais dans le navigateur. Les scénarios scolaires comprenaient un brevet 2014 et un bac 2019 dans une scolarité 2012–2019 ; les sélecteurs ont été vérifiés avec un diplôme, une mention et une série personnalisés, y compris sauvegarde complète, réouverture et lecture base/snapshot.

Les comptes temporaires créés pour ces essais ont été supprimés ; aucun identifiant de connexion QA n’est réutilisable comme accès durable. Aucun avis QA n’a été laissé lors du dernier contrôle des sélecteurs.

La passation n’établit pas un audit complet de sécurité, de délivrabilité email, de performances, de toutes les fonctions sociales ou de toute la base. Ne pas étendre une vérification ciblée en garantie générale.

## Mettre la passation à jour

Après un nouveau travail significatif, noter la date, le besoin utilisateur final, les fichiers concernés, la version déployée, les tests réellement exécutés et les sujets restants. Si une décision change, marquer l’ancienne comme remplacée. Mettre à jour les empreintes seulement après avoir conservé l’ancien relevé ; ne pas écraser la trace d’un état utile au diagnostic.

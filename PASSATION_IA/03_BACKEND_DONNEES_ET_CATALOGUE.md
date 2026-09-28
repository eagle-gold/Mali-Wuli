# Backend, données et catalogue — passation IA

> **Actualisation remplaçant les limites ci-dessous — suppressions, 28 septembre 2026 :** registre à sept rôles avec PUBLICATIONS→PUBLICATIONS_MODERER et MEMBRES→MEMBRES_GERER. GET /admin/roles et /admin/membres autorisés à MEMBRES_GERER en lecture, mais PATCH roles reste propriétaire seul. La révision inclut désormais statut/role/grants/tokenVersion. PATCH /admin/membres/:id/statut désactive/rétablit avec révision, transaction sérialisable, protections propriétaire/soi/comptes privilégiés et révocation. Supprimer un contenu est distinct de désactiver un compte. Les API fournissent peutSupprimer avec contrôles serveur par domaine. Aucune migration supplémentaire, 14 au total. Détails à jour : guide05 et output/2026-09-28-suppressions-droits/LIRE_REPRISE.md ; ancienne note cinq rôles/GET propriétaire seul remplacée.

> **Actualisation du 28 septembre — délégations :** `User.rolesDelegues` est une relation vers UserRoleGrant(code String, clé userId+code). Registre strict backend/src/lib/roles.ts : cinq rôles cumulables, permissions calculées côté serveur et relues à chaque authentification. ADMIN exige toujours email propriétaire + rôle DB. GET /admin/roles, GET /admin/membres et PATCH /admin/membres/:id/roles sont réservés au propriétaire. PATCH strict `{rolesDelegues, expectedRevision}` utilise SHA256(role/grants/tokenVersion), transaction sérialisable et CAS, puis révocation sessions/OTP/sockets. L’ancien PATCH /role répond409 et n’accorde plus MODERATEUR. Migration20260928210000_delegated_roles appliquée ; 14 au total. Détails et limites dans guide05 et output/2026-09-28-roles-actions.

Document préparé le **26 septembre 2026** par lecture du code et des preuves locales. **Dernières vérifications de production documentées : 21 septembre 2026.** Aucune connexion à la production, authentification distante, migration ni modification de données n’a été effectuée pour rédiger ce document. Ne pas présenter les constats du 21 septembre comme des contrôles du jour.

Le code de travail à reprendre est dans :

`/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration`

Le dossier `Mali Wuli` contient notamment les rapports et cette passation ; ne pas le confondre avec ce dépôt d’intégration. Aucun secret, mot de passe ou contenu privé de configuration n’est reproduit ici.

## 1. Architecture réelle

Le backend est une application **Express 4 + TypeScript**, avec **Prisma 5.21.1 et MySQL**. Le fournisseur de la base est explicitement `mysql` dans le schéma Prisma. Certains commentaires et champs de réponse historiques disent encore `postgresql` : ce libellé ne décrit pas la base utilisée.

Node.js 22 minimum et npm 10 minimum sont déclarés dans `backend/package.json`. `npm run build` génère le client Prisma puis compile TypeScript dans `dist` ; cette commande écrit des fichiers locaux, mais n’applique pas de migration. Le point d’entrée est `backend/src/index.ts` et le démarrage compilé utilise `dist/index.js`.

L’application expose les routes sous `/api`, sert les fichiers `/uploads`, et initialise Socket.IO pour les fonctions communautaires. Prisma est partagé via `backend/src/lib/prisma.ts`. La route `GET /api/health` effectue un `SELECT 1` ; elle renseigne la disponibilité de la base, pas le bon fonctionnement de tous les parcours ni la réception des e-mails.

## 2. Modèles à connaître

| Modèle | Rôle et précaution |
|---|---|
| `User` | Identité, adresse e-mail, hash du mot de passe, rôle, statut, vérification e-mail, `tokenVersion`, lien facultatif `parrainId`. |
| `Profil` | Informations du membre, avatar, `photoCouverture`, progression et **snapshot JSON `onboardingDonnees`**. |
| `Formation` | Parcours rattaché au profil, établissement et références pédagogiques, dates, diplôme historique, programme scolaire, diplômes multiples, réponses d’insertion. |
| `AvisEtablissement` | Avis associé à une formation, notes, commentaire et année de promotion. Un seul avis par formation. |
| `Experience`, `Volontaire` | Expériences et configuration de mentorat enregistrées avec l’onboarding. |
| `Etablissement`, `EtablissementAlias`, `EtablissementNiveau` | Identité d’établissement, variantes de nom et niveaux couverts. Deux établissements distincts peuvent avoir le même nom dans la même ville. |
| `ProgrammeEducation`, `DiplomeEducation`, `EtablissementProgramme` | Programmes, diplômes et offres propres aux établissements. |
| `SourceEducative`, `EtablissementSource`, `ProgrammeSource`, `DiplomeSource`, `OffreFormationSource` | Provenance, identifiants externes et traçabilité des imports. |
| `SuggestionCatalogue` | Proposition de catalogue, contributeurs, candidat et référence canonique. Plusieurs identifiants et liens de contexte sont de simples chaînes/JSON, sans clé étrangère. |
| `EmailVerification`, `LoginOtpCode`, `PasswordResetCode` | Vérification d’inscription, connexion par code et réinitialisation du mot de passe : trois mécanismes distincts. |

Le schéma complet est [schema.prisma](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/prisma/schema.prisma). Les migrations sont dans `backend/prisma/migrations/`. Celle des diplômes multiples est **`20260921000000_school_curriculum_diplomas`** : ajout nullable de `Formation.systemeEducatifCode` et `Formation.diplomesScolaires`. Les migrations antérieures couvrent notamment le snapshot, les sessions et les codes de connexion.

## 3. Onboarding : deux représentations à garder cohérentes

Les endpoints sont `GET /api/onboarding` et `POST /api/onboarding`, authentifiés. Le payload contient `informations`, `formations`, `experiences` et `mentorat`.

**Le GET donne priorité à `Profil.onboardingDonnees` lorsqu’il passe la validation Zod.** Il reconstruit le formulaire depuis les tables relationnelles uniquement si le snapshot est absent ou invalide. Une correction faite seulement dans `Formation` peut donc ne pas apparaître lors de la réouverture du formulaire.

Le POST :

1. valide les données et l’identité du compte ;
2. conserve les nouveaux champs de diplômes/programme lorsqu’un ancien client les omet et qu’une formation existante correspond ;
3. vérifie les références canoniques et les règles d’avis/insertion ;
4. enregistre le snapshot et les données relationnelles dans une transaction.

**Ce POST remplace les formations et expériences du profil : il supprime puis recrée leurs lignes.** Ce n’est pas une API de modification partielle d’une seule formation. Les identifiants relationnels recréés peuvent différer des identifiants conservés dans le snapshot. Ne pas traiter l’ID éditorial du snapshot comme une clé relationnelle stable.

Les formations et expériences du snapshot sont triées par date de début croissante, avec le mois. Les lectures de formations dans les endpoints de profil utilisent aussi l’ordre croissant. Les nouveaux tableaux de diplômes sont triés par année.

La réponse du POST contient actuellement `statut: "EN_ATTENTE"`, mais la transaction ne réinitialise pas pour autant `User.statut` : elle met à jour les noms et les données du profil. Relire le compte pour connaître son statut effectif.

Il n’existe pas de nouvelle route dédiée à une sauvegarde partielle de brouillon dans cette implémentation. Le snapshot est écrit lors de la sauvegarde complète.

## 4. Scolarité, diplômes multiples et programme éducatif

Le formulaire réunit école et lycée. L’API garde les types historiques `ecole`, `lycee`, `universite`, et normalise le type d’après l’établissement canonique. Les types école/lycée sont compatibles entre eux ; présenter un établissement scolaire comme supérieur, ou l’inverse, est refusé.

Le contrat ajouté à une formation est :

```ts
systemeEducatifCode?: string;
diplomesScolaires?: Array<{
  type: "BREVET" | "BAC" | "AUTRE";
  libelle: string;
  anneeObtention: string;
  mention: string;
  serie: string;
  statut?: "OBTENU" | "EN_COURS";
}>;
```

Le tableau est stocké dans un champ JSON nullable et validé par Zod, avec dix diplômes maximum. Les champs historiques `diplome`, `mention`, `serie`/`specialite` et `anneePromo` restent alimentés à partir du diplôme principal pour les consommateurs existants. Le statut global du parcours reste distinct du statut de chaque diplôme.

Les années obtenues doivent être comprises dans la période scolaire et ne pas être futures. Elles **n’ont plus à être égales à l’année de sortie** : une scolarité 2012–2019 peut contenir un brevet 2014 et un bac 2019. Pour un diplôme en préparation, une année prévue renseignée doit rester dans la période ; le schéma backend accepte aussi une année vide lorsque le diplôme est en cours.

Les anciennes fiches à diplôme unique sont reconstruites sans perdre leur diplôme. Un tableau vide explicite permet de retirer les diplômes ; un champ omis par un ancien client ne doit pas effacer les nouveaux diplômes déjà enregistrés. La classification legacy distingue les vrais brevets scolaires des **BT, BTS et brevets professionnels/techniques**, rangés dans `AUTRE`.

**Pays d’implantation et programme scolaire sont indépendants.** `paysCode=ML` et `systemeEducatifCode=FR` sont compatibles. Le code de programme explicite est conservé et prioritaire pour le référentiel scolaire ; il doit être un code présent dans `PaysEducation` ou `AUTRE`. Le code `INT` n’est pas accepté par ce contrat.

`GET /api/education/catalogue/references` accepte `country`, `type`, `institutionId` et `systemeEducatifCode`. Pour école/lycée, la réponse réunit les références scolaires couvrant brevet et bac ainsi que les séries. `AUTRE` ne renvoie pas artificiellement des références nationales. Pour le supérieur, les rattachements de programme/diplôme à l’établissement continuent d’être vérifiés.

### Avis et insertion

- Pour une école ou un lycée, un avis exige un parcours déclaré obtenu et **un an écoulé depuis le mois de fin de scolarité**, ainsi qu’au moins une note. La date d’un brevet antérieur ne débloque pas l’avis avant le départ de l’établissement.
- Les réponses d’insertion sont réservées à `universite`. Elles sont mises à `null` dans les tables **et dans le snapshot** pour les parcours scolaires.
- Pour le supérieur hors formation en cours, le résultat d’insertion à douze mois est recalculé côté serveur d’après les réponses détaillées. Les statistiques excluent notamment les poursuites d’études et les suivis encore trop récents.

Le 21 septembre, la sauvegarde puis la réouverture d’un compte QA ont confirmé trois diplômes et des valeurs personnalisées dans **la table et le snapshot**, avec une fin de scolarité en septembre 2026 et **zéro avis créé**. Le compte QA a ensuite été supprimé ; ne pas réutiliser d’anciens identifiants de test. Preuve : [vérification des menus scolaires](</Users/ibrahimakonate/Documents/ChatGPT/Mali Wuli/output/school-selects-font-rollback-2026-09-21/verification.json>).

## 5. Authentification et droits : état connu

Deux modes de connexion existent :

| Endpoint | Fonction |
|---|---|
| `POST /api/auth/login/otp/request` | Demande d’un code à six chiffres ; réponse volontairement générique. |
| `POST /api/auth/login/otp/verify` | Vérification et consommation du code, puis émission de la session. |
| `POST /api/auth/login` | Connexion par mot de passe ; désactivable explicitement par configuration. |
| `POST /api/auth/request-email-code`, `/verify-registration-email`, `/resend-registration-code`, `/register` | Parcours de vérification d’e-mail puis création du compte. L’inscription finale actuelle demande aussi un mot de passe. |
| `POST /api/auth/forgot-password`, `/reset-password` | Réinitialisation par code. |

Le code de connexion est haché avec bcrypt, valable dix minutes, consommable une seule fois et limité à cinq tentatives. La consommation utilise une transaction et une réclamation atomique, avec vérification du hash courant pour ne pas consommer un code renvoyé entre-temps. Des limites par IP/adresse et un délai de renvoi existent ; leurs valeurs opérationnelles sont configurables.

La demande OTP programme l’envoi d’e-mail en arrière-plan et renvoie une réponse générique même dans certains cas d’erreur. **Un HTTP 200 ou l’apparition de l’écran de saisie ne prouve donc pas la livraison du mail.** Le correctif du 21 septembre a remplacé l’URL locale compilée dans le client par l’API publique. Le rapport de cette intervention indique explicitement que la réception effective d’un e-mail n’a pas été testée.

Les JWT d’accès durent sept jours et portent un `tokenVersion`. À chaque requête protégée, le backend relit le compte, son rôle, son statut et la version de session. La réinitialisation du mot de passe incrémente cette version, invalide les OTP en attente et révoque les sockets concernés.

Un membre `EN_ATTENTE` peut consulter/modifier son propre profil et l’onboarding, mais pas accéder aux fonctions réservées aux membres validés. Les comptes refusés ou suspendus sont bloqués. L’annuaire et les profils des autres membres filtrent les utilisateurs `VALIDE`.

Le service d’e-mail utilise Nodemailer, un transport SMTP lorsqu’il est configuré, sinon sendmail. `MAIL_DISABLED=true` coupe l’envoi pour les tests ; cette option ne rend pas les autres opérations du test inoffensives pour la base.

## 6. Profil et photo de couverture

Les lectures du profil exposent désormais `systemeEducatifCode`, `diplomesScolaires` et `photoCouverture`. Endpoints principaux :

- `GET /api/users/me`, `PUT /api/users/me`, `PATCH /api/users/me/bio` ;
- `POST /api/users/me/photo`, `DELETE /api/users/me/photo` ;
- `POST /api/users/me/couverture`, `DELETE /api/users/me/couverture` ;
- `GET /api/users` et `GET /api/users/:id` pour l’annuaire et les profils autorisés.

L’upload de couverture utilise un formulaire multipart avec le champ `couverture`. JPEG, PNG et WebP sont acceptés, jusqu’à 10 Mo ; l’avatar est limité à 5 Mo. Le backend vérifie le type annoncé puis la signature binaire du fichier. La couverture est stockée sur disque, et la base conserve son URL relative sous `/uploads/couvertures/`. Le remplacement supprime l’ancien fichier après mise à jour ; une erreur nettoie le nouvel upload.

Le répertoire provient de `UPLOAD_DIR`, sinon de `uploads` dans le répertoire courant. **La persistance de ce dossier doit être préservée lors d’un changement de release** : les images ne sont pas des blobs dans MySQL. Le test du 21 septembre a couvert le multipart, la persistance et le refus d’un faux type de fichier sans remplacer l’image précédente.

## 7. Parrainage actuellement implémenté

Le lien proposé après l’onboarding est de la forme `/register?parrain=<id utilisateur>`. La page d’inscription conserve cette valeur dans le stockage local, puis l’envoie comme `parrainCode` lors de la création finale du compte ; elle la retire après succès.

Le backend interprète ce code comme un **ID de `User`**, vérifie que ce compte existe, puis enregistre son ID dans `User.parrainId`. Un code introuvable est ignoré. La relation inverse `filleuls` existe dans Prisma.

Le code relu ne montre ni récompense, ni commission, ni validation automatique du filleul, ni envoi automatique d’invitation, ni tableau de suivi dédié. Le parrain n’est pas filtré ici sur le statut `VALIDE` : le contrôle actuel est son existence. Présenter le système comme un rattachement à l’inscription, pas comme un programme de récompenses ou une preuve de confiance.

## 8. Catalogue : corrections appliquées et audit resté sans écriture

### Corrections ciblées déjà réalisées

Les trois cas signalés ont été rapprochés en conservant les liens et provenances :

| Établissement | ID canonique conservé |
|---|---|
| Groupe scolaire Les Angelots | `ml-angelots` |
| École Les Lutins | `ml-ecole-les-lutins` |
| Établissement Liberté | `ml-lycee-liberte` |

Le script `reconcile-profile-school-catalogue.ts` concerne uniquement ces trois groupes. Il met aussi à jour les suggestions et les identités du snapshot ; une mise à jour de brouillon a été documentée. Ce script contient une affectation explicite du programme `FR` aux trois canoniques : **ne pas le généraliser à d’autres établissements**.

Une autre cause de doublons visibles se trouvait côté frontend : la route de recherche mélangeait systématiquement le résultat du serveur avec une liste embarquée. Depuis la correction vérifiée `20260921-canonical-suggestions`, elle restitue exactement la liste backend, **même vide**, et conserve les homonymes portant des IDs distincts. Le secours ne s’active qu’en cas d’indisponibilité ou de réponse invalide. Sur 21 références locales, 10 IDs périmés ont été remplacés et Cathédrale, ambiguë, retirée du secours ; **20 références** restent. Les deux fiches Cathédrale dans la base n’ont pas été supprimées.

### Audit global du 21 septembre : aucune nouvelle fusion

| Périmètre | Résultat documenté |
|---|---|
| Ensemble | **141 941 fiches actives**, 200 pays et territoires, export en lecture seule. |
| Mali | **20 270 fiches**, **31 paires à forte concordance** concernant 62 fiches, dont 22 paires absentes du précédent rapprochement des registres. Ce sont des candidats probables, pas des suppressions approuvées. |
| Hors Mali | **121 671 fiches** ; 1 cas à indices très concordants, 5 autres candidats très forts, 2 anomalies de rattachement de sources et 297 paires ambiguës dans la synthèse prioritaire. |
| Ancien audit strict des registres Mali | 20 157 fiches scolaires, 103 paires proposées, zéro appliquée. Périmètre et critères différents du contrôle global : ne pas additionner les résultats. |

Le balayage est global sur l’export, mais n’est pas une certification manuelle de chaque identité. Des sources peuvent recopier les mêmes données ; un nom identique, un domaine partagé, un sigle ou des coordonnées identiques ne suffisent pas à fusionner deux campus. Les catégories de signaux se recoupent et les nombres de paires ne donnent pas un nombre de fiches à supprimer.

Des rapprochements antérieurs trop larges ont aussi été détectés : plusieurs identifiants officiels de structures distinctes peuvent se retrouver sur une même fiche. Il faut parfois **réparer une attribution de source**, plutôt que fusionner davantage. Exemple prioritaire hors Mali : Lycée Louis-le-Grand, présent sous une fiche UAI et une fiche ROR classée université, à examiner avec ses sources.

Tous les éléments sont dans [le dossier d’audit](</Users/ibrahimakonate/Documents/ChatGPT/Mali Wuli/output/catalogue-audit-2026-09-21/README.md>) :

- `audit-perimetre.json` et `catalogue.jsonl.gz` : périmètre, export et empreinte ;
- `audite-ml-synthese-verifiee.json`, `audite-ml-paires-forte-concordance.json`, `audite-ml-paires-ambigues.json` : résultats Mali ;
- `audit-global-summary.json`, `audit-global-priority.json`, `audit-global-identity-anomalies.json` : résultats hors Mali ;
- `registry-audit.json` : simulation du rapprochement historique ;
- `frontend-fallback-audit.json` et `verification.json` : correction du secours et vérifications du déploiement.

**Le nettoyage global n’a pas été appliqué.** Ne pas annoncer « tous les doublons supprimés ».

## 9. Fusion : limites techniques à traiter avant nettoyage global

Le helper `fusionnerEtablissements` effectue une transaction : il transfère formations, avis et sources, recopie alias/niveaux, rapproche les offres et leur provenance, puis marque l’ancien établissement `valide=false`. Il ne supprime pas physiquement la fiche historique. Il refuse les pays incompatibles et les types incompatibles, en autorisant le rapprochement école/lycée.

Il ne constitue toutefois pas une procédure globale complète :

- `Profil.onboardingDonnees` doit être corrigé en plus des tables, puisque le GET lui donne priorité ;
- `SuggestionCatalogue.candidatId`, `canoniqueId`, le JSON `contexte` et les clés de contexte peuvent porter des anciens IDs sans clé étrangère ;
- `ForumQuestion.etablissementId` est également une chaîne sans relation Prisma ;
- les liens déjà distribués et brouillons de navigateur peuvent encore contenir l’ancien ID ; aucune table générale de redirection ancien → canonique n’est prévue ici ;
- lors d’une collision d’offres, vérifier `actif` et `niveau` : le helper conserve l’offre canonique, sans arbitrage complet de tous ses attributs ;
- le programme éducatif, le statut public/privé, les noms, la description et les métadonnées doivent être arbitrés à partir des preuves, pas copiés arbitrairement.

Avant toute nouvelle application : établir une sauvegarde restaurable de la base **et des uploads**, figer un plan explicite ancien ID → canonique, conserver les preuves de chaque rapprochement, compter toutes les références avant/après et prévoir le contrôle des snapshots. Ne pas fusionner par simple transitivité A–B–C ni uniquement par nom. Le script ciblé utilise une comparaison du JSON avant mise à jour pour éviter d’écraser un brouillon modifié entre-temps, mais cette réécriture est séparée de la transaction de fusion et doit pouvoir être reprise.

## 10. Scripts et tests : effets réels

**Règle utilisateur ajoutée le 26 septembre 2026 :** avant tout import, fusion, nettoyage ou smoke qui écrit en base, vérifier les effets et la base visée, puis obtenir l’accord de l’utilisateur, y compris sur une base QA. Consigner immédiatement toute exécution dans sa propre entrée de [JOURNAL_REPRISE.md](JOURNAL_REPRISE.md), avec la base visée sans secret et les preuves. Les commandes et modes de simulation ci-dessous ne valent pas autorisation.

| Script ou famille | Effet à connaître avant exécution |
|---|---|
| `audit-education-dedup.ts` / `education:audit:dedup` | **Écrit en base par défaut**, sans nécessité de `--apply`, et peut appeler une IA externe via OpenRouter. Examine surtout HIPO/Wikidata face à ROR, sur un lot limité ; ce n’est pas un audit global en lecture seule. Son helper de fusion historique est moins complet et non transactionnel. Ne pas l’utiliser comme commande d’inspection. |
| `reconcile-mali-school-registries.ts` | Simulation sans `--apply` ; écrit avec `--apply`. Le critère F1/F2 et le critère sources croisées géolocalisées sont différents. |
| `reconcile-mali-education-duplicates.ts` | Simulation sans `--apply`, mais télécharge la source HOT/HDX ; écrit avec `--apply`. Limité à OSM Mali. |
| `reconcile-profile-school-catalogue.ts` | Lecture de contrôle sans `--apply` ; avec ce flag, applique uniquement les trois groupes codés en dur et réécrit des snapshots. |
| `normalize-mali-establishment-cities.ts` | Simulation sans `--apply`, mises à jour avec ce flag. |
| Scripts `seed-*` et `import-*` | Écritures de catalogue ; certains imports comportent aussi des rapprochements. Ne pas lancer pour « juste vérifier ». |
| `check-onboarding-canonical-security.ts` | Lit un catalogue réel et vérifie les règles canoniques ; pas de mutation prévue. Nécessite une base contenant les références attendues. |
| `onboarding-school-records.test.ts` | Tests avec méthodes Prisma remplacées et serveur HTTP local éphémère ; pas d’accès à une base réelle dans les scénarios actuels. |
| Tests unitaires `backend/src/education/*.test.ts` | Tests des fonctions d’import/normalisation/rapprochement ; distincts des commandes d’import elles-mêmes. |
| `smoke-login-otp.ts` | **Crée, modifie et supprime** un utilisateur et des codes dans la base configurée. `NODE_ENV=test` et `MAIL_DISABLED=true` n’isolent pas automatiquement `DATABASE_URL`. |
| `smoke-social.ts` | **Crée puis nettoie** des utilisateurs, publications et données sociales dans la base configurée. Demande `NODE_ENV=test`. |
| `smoke-community.ts` | **Crée puis nettoie** des comptes et données communautaires, rendez-vous, événements, offres, etc. Ne pas exécuter sur une base réelle comme simple health check. |
| `output/profile-schools-2026-09-21/smoke-profile-schools.cjs` | Vrai test HTTP/Prisma avec compte temporaire, donc **mutation réelle**. Son mode exceptionnel de compte isolé a servi le 21 septembre après sauvegarde ; ne pas le réactiver implicitement. |

La présence d’un `finally` de nettoyage ne rend pas un test en lecture seule et ne garantit pas son nettoyage après interruption brutale. Les preuves du 21 septembre indiquent sept régressions backend, neuf frontend et sept scénarios HTTP/Prisma réussis pour la livraison des parcours ; ces résultats ne sont pas une nouvelle exécution du 26 septembre.

### Commandes de contrôle sans écriture en base

À partir du dossier `backend` du dépôt d’intégration :

```sh
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/tsx --test src/services/onboarding-school-records.test.ts
./node_modules/.bin/tsx --test src/education/normalisation-localisations.test.ts src/education/mali-school-registries.test.ts src/education/mali-registry-reconciliation.test.ts src/education/import-mali-osm-utils.test.ts
```

La première est une vérification de compilation sans émission de fichiers. Les tests suivants utilisent les scénarios isolés décrits ci-dessus ; ils peuvent ouvrir un serveur local ou utiliser des fichiers temporaires. Aucun de ces exemples n’est une commande de déploiement, de migration ou de fusion.

Pour les scripts de réconciliation, le mode sans `--apply` a été inspecté comme simulation, mais il faut néanmoins vérifier **quelle base est configurée** et s’assurer que le script n’a pas changé avant toute exécution. Ne pas lancer `prisma migrate dev`, `db push`, un import ou un smoke mutable sur la base de production par habitude.

## 11. Carte des fichiers de reprise

Tous les chemins ci-dessous sont relatifs au dépôt d’intégration indiqué au début.

| Fichier | Sujet |
|---|---|
| `backend/src/index.ts` | Montage des routes, CORS, health check, uploads, serveur et Socket.IO. |
| `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Contrat de données et migrations. |
| `backend/src/routes/onboarding.routes.ts` | Validation Zod, GET snapshot/reconstruction, sauvegarde transactionnelle, avis et insertion. |
| `backend/src/services/onboarding-school-records.ts` | Compatibilité historique, conservation des champs omis, reconstruction des diplômes, tri. |
| `backend/src/services/onboarding-education-validation.ts` | Contrôle canonique des établissements, pays, programmes, séries et diplômes. |
| `backend/src/services/onboarding-school-records.test.ts` | Régressions diplôme/date/programme/roundtrip. |
| `backend/src/routes/user.routes.ts` | Profils, visibilité, sérialisation des formations et couverture. |
| `backend/src/middlewares/upload.middleware.ts` | Stockage des images, limites et contrôle du contenu. |
| `backend/src/routes/auth.routes.ts`, `backend/src/lib/auth-token.ts` | Inscription, OTP, mot de passe, sessions, parrainage. |
| `backend/src/middlewares/auth.middleware.ts` | Droits et restrictions des comptes en attente. |
| `backend/src/services/email.service.ts` | Transport des e-mails et désactivation explicite pour tests. |
| `backend/src/routes/education.routes.ts`, `backend/src/education/catalog-service.ts` | API du catalogue, références et recherche. |
| `backend/src/education/catalog-suggestion-service.ts` | Propositions, validation et rattachement canonique. |
| `backend/src/education/deduplication-etablissements.ts` | Helper de fusion et limites listées ci-dessus. |
| `backend/src/education/mali-registry-reconciliation.ts`, `import-mali-osm-utils.ts` | Critères de rapprochement et exclusions. |
| `frontend/src/app/api/education/institutions/route.ts` | Proxy canonique sans mélange du secours. |
| `frontend/src/lib/education/reference.ts` | Références de secours, programme scolaire et libellés. |
| `frontend/src/components/onboarding/StepFormations.tsx`, `frontend/src/lib/education/parcours-scolaire.ts` | Contrat d’interface à garder compatible avec le backend. |

## 12. Priorités de reprise

1. **Reprendre l’audit global sans l’assimiler à un nettoyage terminé.** Examiner d’abord les 31 paires Mali, les anomalies de provenance et les six candidats prioritaires hors Mali, avec identifiants officiels et preuves de campus.
2. **Compléter la procédure de fusion avant toute série d’écritures** : snapshots, références sans clé étrangère, redirection des anciens IDs, inventaire avant/après et restauration testable.
3. **Conserver les invariants de l’onboarding** : programme distinct du pays, plusieurs diplômes par scolarité, mentions/séries libres préservées, ordre chronologique, avis après la sortie, insertion uniquement dans le supérieur.
4. **Recontrôler l’exploitation au moment de la reprise** : état effectif des migrations, base, images persistantes et livraison d’e-mails si le besoin porte sur ce dernier point. Une ancienne validation de formulaire ou un health check ne couvre pas ces sujets.
5. **Distinguer les validations locales des essais sur données réelles.** Préférer une base QA dédiée aux smokes mutables ; ne jamais réutiliser un vrai profil pour un test.

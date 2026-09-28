# Audit frontend — autorisations par action

Date : 28 septembre 2026. Lecture seule du dépôt `/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration`. Aucun code, journal, serveur ou compte modifié. Cette note propose un contrat ; elle ne constitue pas une décision sur les rôles en attente de réponse utilisateur.

## Décision confirmée et contrat retenu après cet audit

L’utilisateur a confirmé cinq rôles spécialisés cumulables : `INSCRIPTIONS`, `OFFRES`, `EVENEMENTS`, `CATALOGUE`, `ASSOCIATIONS`. Aucun nouveau rôle global ni ADMIN n’est attribuable. L’ancien MODERATEUR reste inchangé jusqu’à une édition explicite, qui le remplace par les cases choisies et retire ses autres anciens droits.

Contrat final backend : `/users/me` expose `rolesDelegues` et `permissions`. `/admin/membres` ajoute la révision opaque `revisionDroits: string` (SHA256 du rôle, des délégations et de la version de session). Mutation `PATCH /admin/membres/:id/roles {rolesDelegues, expectedRevision}`. Filtre `roleDelegue=OFFRES`. Permissions exactes : `INSCRIPTIONS_GERER`, `OFFRES_MODERER`, `EVENEMENTS_MODERER`, `CATALOGUE_GERER`, `ASSOCIATIONS_GERER`. Le propriétaire conserve `ROLES_GERER`, `STATS_CONSULTER` et tous les autres accès ; `SIGNALEMENTS_CONSULTER` reste au propriétaire et à l’ancien MODERATEUR, pas aux cinq délégations nouvelles.

Implémentation frontend terminée uniquement en `staging/frontend` : 16 fichiers, dont `lib/autorisations.ts`. Aucun accès n’est déduit du nom du rôle ; les capacités métier renvoyées par les fiches restent la source des actions. Vérification `node verify-frontend-roles.cjs` : 11 groupes API/SSR simulés réussis, aucune requête réelle ni écriture DB. `node verify-frontend-overlay.cjs` : 15 TS/TSX, 0 diagnostic. QA visuelle et publication relèvent de la session principale. La proposition initiale ci-dessous est conservée comme historique d’audit et n’est pas le contrat final.

## État actuel et points à adapter

Chemins ci-dessous relatifs à `frontend/src` ; lignes relevées sur la version active de cet audit.

| Emplacement | Contrôle actuel | Adaptation nécessaire |
| --- | --- | --- |
| `components/MaliWuliHeader.tsx:180–256` | Lit `/users/me`, conserve un `role`, montre Administration pour ADMIN ou MODERATEUR. Navigation bureau/mobile utilise le même tableau. | Conserver les autorisations renvoyées par `/users/me` et afficher Administration dès qu’au moins un espace administratif est accessible. Rien avant la réponse ni après erreur. |
| `app/(admin)/admin/page.tsx:83–111,166–198` | ADMIN/MODERATEUR ; charge ensemble catalogue, inscriptions et signalements ; statistiques ADMIN seulement ; membres/associations ADMIN seulement. | Charger et rendre chaque section/lien selon sa permission. Ne jamais envoyer une requête d’une section interdite : aujourd’hui un seul 403 fait échouer le `Promise.all` entier. Statistiques et gestion des rôles restent au propriétaire. |
| `components/admin/GestionMembres.tsx:9–16,47–56,90–132` | Sélection unique MEMBRE/MODERATEUR ; filtre rôle unique ; `PATCH {role,expectedRole}` ; propriétaire protégé. | Utiliser un ensemble de rôles délégués, cases à cocher, résumé des actions, confirmation des ajouts/retraits et révision de l’ensemble. Maintenir accès exclusif propriétaire, protections et révocation des anciennes sessions. |
| `components/offres/AdminOffres.tsx:29–47` | Guard ADMIN/MODERATEUR, puis `data.peutModerer` issu de la liste. | Guard permission offres ; conserver le second contrôle de capacité renvoyé par l’API et le CAS `revision` de chaque offre. |
| `app/(admin)/admin/evenements/page.tsx:31–48` | Guard ADMIN/MODERATEUR, puis `data.peutModerer`. | Guard permission événements, garder la capacité métier renvoyée par l’API. |
| `app/(admin)/admin/associations/page.tsx:39–87` | ADMIN seul ; une fois autorisé, charge associations gérées, suggestions et recherche des responsables. | Guard association correspondant exactement aux opérations autorisées. La page réunit création/modification, désignation d’un responsable et traitement de suggestions : un droit « validation seulement » ne peut pas ouvrir toute la page sans séparer ses contrôles. |
| `components/offres/FormulaireOffre.tsx:78–87` | Édition permise au propriétaire, ADMIN ou MODERATEUR d’après `/users/me`. | Utiliser `offre.peutModifier` fourni par le serveur, pour ne pas refuser un délégué offres ni autoriser visuellement un délégué d’un autre domaine. |
| `components/offres/DetailOffre.tsx:17` | Bouton Modifier réservé à `estProprietaire`. | Si le contrat autorise réellement l’édition par le délégué offres, montrer le bouton selon `peutModifier`. Le formulaire et le bouton doivent employer la même capacité. |
| `components/profile/ProfilMembre.tsx:960` + `components/profile/AssociationsProfil.tsx:10,68–75` | Prop `estAdministrateur` issue de `role === ADMIN` pour lien admin et accès à une fiche non publiée. | Passer la capacité de gestion du catalogue associatif, distincte de la responsabilité d’une association. Garder l’exception de statut et les affiliations personnelles. |

Il n’existe pas de hook partagé de rôle/authentification utilisé par ces pages : chacune lit actuellement `/users/me`. `PlatformAuthGuard.tsx` vérifie onboarding/statut, pas la modération ; ne pas en faire une autorisation administrative implicite.

## Capacités métier déjà utilisables

- `components/evenements/ListeEvenements.tsx:54` et `components/offres/OffresPage.tsx:93` affichent déjà le lien admin d’après `data.peutModerer` : la nouvelle matrice doit être reflétée par le backend, sans test de nom de rôle supplémentaire.
- `components/evenements/FormulaireEvenement.tsx:49`, `FicheEvenement.tsx:83` et `AlbumEvenement.tsx` utilisent `peutModifier`, `peutAjouterPhotos` et `peutSupprimer` issus de l’API. Les droits du propriétaire et des participants doivent rester indépendants des délégations administratives.
- `components/associations/FicheAssociation.tsx:49,74` utilise `association.peutGerer` pour photos et affiliations. Cela permet au responsable désigné de continuer à gérer son association sans obtenir un rôle administratif global.
- Le backend offres renvoie déjà `peutModifier` et `peutModerer` par fiche (`backend/src/services/offre.service.ts:66`), mais `types/offres.ts:7–15` les omet. Ajouter ces champs au type plutôt que reconstruire l’autorisation à partir de `role`.
- `types/api.ts:192–209`, `types/profile.ts:138–147` et `types/index.ts:23–33` doivent porter le contrat des autorisations de session. Ne pas déduire les droits d’un jeton décodé ou du stockage local.

## Contrat UI proposé, à valider par la session principale

Séparer le rôle propriétaire des délégations cumulables. Conserver `role` pour la compatibilité des données, sans l’utiliser comme substitut des permissions nouvelles.

1. `/users/me` renvoie `estAdminPrincipal`, `rolesDelegues: string[]`, `permissions: string[]` calculées côté serveur. Les permissions réservées au propriétaire (rôles, statistiques) ne sont jamais comprises dans une délégation globale. Des champs manquants valent absence de droit ; pas de repli automatique vers MODERATEUR sur les nouveaux contrôles.
2. `/admin/roles` renvoie un catalogue d’options `{code, libelle, description, permissions, attribuable}`. Les descriptions explicitent les opérations réellement possibles. Le serveur définit le rôle global et son expansion ; le frontend ne maintient pas une seconde matrice d’autorisations.
3. `/admin/membres` conserve recherche/statut/pagination/protections et ajoute `rolesDelegues`, `permissions`, `revisionAutorisations` par membre. Le filtre rôle signifie « possède cette délégation » ; une éventuelle recherche par permission effective doit être explicitement nommée.
4. Mutation unique proposée : `PATCH /admin/membres/:id/autorisations {rolesDelegues: string[], expectedRevision: string}` remplace l’ensemble. Révision calculée sur l’ensemble canonique des délégations ; un simple `expectedRole` ne couvre pas deux changements de cases indépendants. Une réponse 409 recharge les données, ferme la confirmation et conserve l’explication à l’écran.
5. Les réponses métier conservent les booléens `peutModerer`/`peutModifier`/`peutGerer`, calculés à partir de la nouvelle matrice et de la propriété de la ressource. Ces booléens gouvernent les actions sur les fiches ; les permissions de session gouvernent l’accès aux espaces et leurs requêtes.

Noms techniques illustratifs : `inscriptions.valider`, `offres.moderer`, `evenements.moderer`, `catalogue.moderer`, `associations.gerer`, `signalements.consulter`, `membres.autorisations`, `statistiques.consulter`. Les noms finaux doivent venir du contrat backend, avant implémentation.

## Présentation recommandée

La fiche d’un membre dans `/admin/membres` propose des cases à cocher avec une description courte des actions. « Aucun rôle délégué » conserve les fonctions ordinaires du membre. Le rôle global est une option clairement décrite ; ses domaines couverts peuvent être indiqués sans inventer des combinaisons contradictoires ou des exclusions. Le compte propriétaire reste en lecture seule.

La confirmation affiche les délégations ajoutées et retirées, les principales conséquences et la reconnexion nécessaire. Ne pas confondre changement de rôle et validation du compte. Éviter un formulaire massif pour chaque ligne : ouvrir l’éditeur ciblé seulement pour le membre choisi, puis le refermer après succès. Cases étiquetées, retour de focus, statut d’enregistrement et une seule mutation active ; grille une colonne sur mobile.

Deux décisions doivent être explicites dans le contrat :

- **Associations** : gérer toutes les fiches/désigner les responsables ou seulement traiter les propositions ; l’interface actuelle regroupe ces opérations. Cela reste distinct du responsable local d’une seule association.
- **Signalements** : permission propre ou comprise dans le rôle global uniquement. Ne pas l’accorder automatiquement à tout délégué offres/inscriptions sans décision.

## Vérifications prévues après accord

Comptes simulés : propriétaire, membre ordinaire, chaque délégation seule, deux délégations cumulées, global et délégation retirée. Vérifier pour chaque cas les liens bureau/mobile, accès direct aux routes et absence de requêtes interdites. Tester l’édition d’offres via capacité de ressource, la gestion associative locale conservée, la confirmation de l’ensemble, le 409, les rôles inconnus et les sessions révoquées. Aucun test de cette note ne requiert un compte réel ou un envoi de mail.

Limites : audit statique, sans navigateur, base, réseau ni modification applicative. Les permissions et noms d’API ci-dessus sont une proposition, pas un contrat déjà implémenté.

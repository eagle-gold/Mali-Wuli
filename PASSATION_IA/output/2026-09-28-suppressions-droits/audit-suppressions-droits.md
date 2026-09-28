# Audit avant choix de la suppression et des droits — 28 septembre 2026

Lecture des sources actives avant modification du lot. Aucune base consultée ou modifiée, aucun appel externe. Les conclusions ci-dessous décrivent le code ; elles ne constituent pas une décision sur les deux questions utilisateur encore ouvertes : désactivation ou effacement définitif, périmètre par domaine ou gestion globale.

**Décision prise ensuite par la session principale :** désactivation réversible et rôles spécialisés. Le backend préparé dans ce lot ajoute `MEMBRES_GERER`, un catalogue/liste en lecture pour ce rôle et une action de statut séparée de la modification des rôles, qui demeure réservée au principal. Le rétablissement passe obligatoirement par `EN_ATTENTE`, puis une nouvelle validation. Les délégations sont conservées ; seul le principal peut gérer ces comptes et les revalider. Le texte suivant garde le détail de l’audit préalable pour expliquer les choix.

## Constats utiles à la décision

**La solution minimale sans migration est une désactivation réversible avec le statut existant `SUSPENDU`.** Un effacement définitif n’est pas un simple `user.delete` : plusieurs relations le bloquent, d’autres effacent des contenus en cascade, et des références/fichiers resteraient hors contrainte. Ne pas appeler « suppression définitive » une simple suspension.

**Les cinq rôles délégués actuels sont des domaines cumulables, pas une hiérarchie N/N−1.** Détenir `OFFRES` ne donne aucun droit sur un autre membre ni sur le catalogue. Un gestionnaire global devrait être défini explicitement ; le nombre de rôles attribués ne peut pas servir de rang hiérarchique.

## État actuel des suppressions

| Objet | Contrôle observé | Effet actuel |
|---|---|---|
| Compte membre | Aucune route de suppression/désactivation dans `admin.routes.ts` ou `user.routes.ts` | Pas d’action de compte disponible |
| Publication | Auteur seulement, y compris lorsqu’un administrateur appelle la route | Suppression de la publication, cascades réactions/commentaires et retrait de son image |
| Commentaire | Auteur du commentaire ou auteur de la publication | Suppression, y compris ses réponses en cascade |
| Offre | Déposant ou permission `OFFRES_MODERER` | Suppression, sauf candidature `EN_COURS` ; favoris/candidatures liés en cascade |
| Événement | Organisateur ou permission `EVENEMENTS_MODERER` | Participants/photos supprimés explicitement en transaction, médias nettoyés après commit, notifications d’annulation |
| Photo d’événement | Auteur, organisateur ou modération événements | Suppression du média selon droits de la fiche |
| Association | Gestionnaire global du domaine ou responsable selon opération | Gestion fiche/médias/affiliations ; pas de DELETE fiche dans le routeur actuel |
| Photo/couverture de profil | Le compte lui-même via `/users/me` | Suppression uniquement de son média |

Le statut « administrateur » ne suffit donc pas aujourd’hui à supprimer toutes les publications : les routes ne regardent que la propriété. C’est un écart concret si la nouvelle demande exige une modération globale du fil. Les boutons doivent suivre les mêmes droits calculés côté serveur, sans remplacer le contrôle API.

## Conséquences d’un effacement physique de compte

Les migrations SQL font foi et confirment les comportements suivants :

- `User` → `Profil` et `UserRoleGrant` : CASCADE. Le parrainage d’autres comptes devient NULL.
- `Profil` → formations/avis liés, expériences, volontariat, publications/réactions/commentaires, notifications reçues, suggestions d’associations, favoris et candidatures : cascades selon chaque relation.
- Relations **RESTRICT** bloquantes : synergies envoyées/reçues, participants de conversation, messages, rendez-vous, membres de cercles, affiliations d’associations, participations d’événements, offres publiées, signalements et auteur de photo d’événement. Les rendez-vous empêchent aussi la cascade depuis `Volontaire`.
- Références sans FK utilisateur/profil : notamment `Association.responsableId`, `Evenement.organisateurId`, `Cercle.presidentId`, auteurs de forum/messages de cercle/annonces, informations de certaines notifications. Elles nécessitent une politique explicite de retrait, transfert ou anonymisation.
- `EmailVerification`, `LoginOtpCode` et `PasswordResetCode` sont indexés par e-mail, sans relation `User` : aucune cascade ne les purge.
- Les fichiers des profils, publications, événements ou associations sont des chemins externes à la base ; une cascade SQL ne les supprime pas du stockage. Les fichiers partagés ne doivent pas être retirés sans vérifier les références restantes.

Les échanges d’autres membres, les candidatures déjà envoyées et les événements/associations gérés rendent nécessaire une décision sur la conservation, l’anonymisation et la transmission de responsabilités. Une suppression définitive demanderait un service transactionnel dédié avec inventaire des dépendances, puis un nettoyage contrôlé des médias après commit. Ni une cascade élargie, ni une suite générique de `deleteMany` n’est une solution minimale acceptable.

## Suspension, session et réactivation

Le middleware `authenticate` relit le compte et ses délégations à chaque requête. Il refuse déjà `SUSPENDU`/`REFUSE`, les versions de jeton anciennes et les e-mails non vérifiés. Connexion par mot de passe et connexion OTP refusent les comptes suspendus ; les nouvelles connexions socket exigent `VALIDE` et la bonne version du jeton.

Une suspension correcte peut donc, sans migration :

1. Relire acteur et cible dans une transaction sérialisable ; exiger une révision attendue et vérifier les protections côté serveur.
2. Changer le statut en `SUSPENDU` et incrémenter `tokenVersion` atomiquement. Une suspension répétée ne doit pas multiplier les effets.
3. Invalider les OTP de connexion en attente, puis révoquer les sockets après commit. Ne pas envoyer de message à la place de l’utilisateur.
4. Exposer une réactivation distincte, avec nouvelle confirmation, version de jeton incrementée et statut final autorisé. Ne pas modifier le mot de passe, l’e-mail ou la complétude d’onboarding pour faire fonctionner la réactivation.

Deux précautions concrètes :

- `deciderInscription` autorise actuellement l’administrateur principal à revalider une cible quel que soit son statut, donc également `SUSPENDU`. Si la réactivation devient une action dédiée, cette route doit refuser les comptes suspendus ; sinon elle contournerait la confirmation et la révision de la nouvelle action.
- Les rôles délégués restent stockés pendant une suspension, sauf choix explicite de les retirer. Ils redeviendraient effectifs lors de la réactivation. L’interface doit montrer cette conséquence, ou le service doit réactiver en membre ordinaire si telle est la décision produit. Ne pas inventer ce choix silencieusement.

La réinitialisation de mot de passe ne change pas le statut : elle ne débloque pas un compte suspendu. La terminaison d’une inscription existante conserve aussi son statut. Il faut toutefois éviter de présenter une réussite de connexion lorsqu’un jeton est ensuite refusé par le middleware.

Les annuaires et compteurs de membres filtrent les comptes validés, mais les messages historiques et certains contenus déjà publiés peuvent rester visibles. Une suspension empêche l’accès du membre ; elle ne garantit pas un effacement général de son nom et de ses contributions. Cette différence doit être annoncée clairement si la demande est seulement de désactiver.

## Protections minimales des cibles

- Protéger le compte administrateur principal côté serveur et ne jamais se fonder sur une étiquette UI. Le code actuel protège aussi tout ancien `role=ADMIN`, même si le rôle effectif a été ramené à membre : conserver cette protection explicite tant qu’aucune autre décision n’est prise.
- Interdire au gestionnaire de désactiver son propre compte depuis la liste administrative ; une éventuelle fermeture personnelle aurait un flux distinct.
- Une délégation `INSCRIPTIONS` ne doit pas devenir implicitement un droit de suspension des membres validés ou des autres gestionnaires. Elle traite actuellement seulement les inscriptions ordinaires en attente ; les comptes administrateurs, modérateurs et porteurs de grants sont exclus.
- Vérifier l’autorisation de l’acteur en transaction, pas seulement au passage du middleware, pour refuser une action après retrait concurrent de ses droits.
- Inclure statut et version dans la révision d’action. `revisionDroits` contient déjà rôle, grants et tokenVersion ; l’incrément systématique du tokenVersion rend un changement de statut visible, mais une révision dédiée incluant le statut évite de dépendre d’une convention implicite.
- Distinguer l’autorisation de modérer un contenu et celle de gérer les comptes/les rôles : aucune déduction automatique depuis `peutModifier`, une responsabilité d’association ou le rôle du propriétaire d’un contenu.

## QA à prévoir une fois les décisions fixées

Tests RAM/API : acteur ordinaire refusé ; domaine non concerné refusé ; administrateur autorisé sur cible ordinaire ; protection de soi et du principal ; cible gestionnaire selon règle choisie ; révision périmée 409 ; deux requêtes concurrentes ; suspension idempotente ; échec transactionnel sans révocation prématurée ; révocation OTP/socket après succès ; anciens jetons refusés ; réactivation explicite ; route de validation ne contournant pas la suspension. Aucun test destructif sur un compte réel.

Tests UI : libellé exact de l’action, identité de la cible, explication des données conservées/perdues, confirmation locale explicite, contrôle clavier/mobile, verrou pendant mutation, retour d’erreur sans retirer abusivement la ligne, actualisation des permissions reçues du serveur. Publication/commentaire : auteur, auteur du fil et modération respectent leurs périmètres distincts.

Publication : baseline `20260928-priorite-membres-home`, BUILD_ID `dj5SeEGNIha9psRUR-GDY`, 226 sources et 14 migrations. Tant que la solution reste sans modification de schéma, les scripts refusent toute quinzième migration et comparent comptes/rôles/statuts/sessions avant/après publication. Cette publication doit ajouter la capacité, sans suspendre ni supprimer réellement un membre.

## Sources lues

- [Schéma Prisma](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/prisma/schema.prisma)
- [Migration de référence et FK](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/prisma/migrations/20260919000000_production_baseline/migration.sql)
- [Rôles et permissions](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/src/lib/roles.ts)
- [Gestion des membres](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/src/services/admin-membres.service.ts)
- [Middleware d’authentification](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/src/middlewares/auth.middleware.ts)
- [Routes d’authentification](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/src/routes/auth.routes.ts)
- [Routes publications](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/src/routes/publication.routes.ts)
- [Service offres](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/src/services/offre.service.ts)
- [Service événements](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/src/services/evenement.service.ts)

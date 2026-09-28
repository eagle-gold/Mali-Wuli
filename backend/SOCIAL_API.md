# Contrat API social et temps réel

Toutes les routes ci-dessous sont préfixées par `/api`, exigent `Authorization: Bearer <JWT>` et utilisent des identifiants de **profil** (pas de compte utilisateur), sauf mention contraire. Les listes paginées bornent `limite` côté serveur.

## Publications

- `GET /publications?scope=tout|cercles|pays|ville&cursor=&limite=15` (alias accepté : `filtre`) → `{ publications, hasMore, nextCursor }`.
- `POST /publications` en `multipart/form-data`, champs `intention` (`OFFRE` ou `DEMANDE`), `thematique`, `contenu`, éventuellement `photo`, `lienUrl`, `lienTitre` → publication directe.
- `GET /publications/profil/:profilId` → `{ publications }`.
- `DELETE /publications/:id` → réservé à l’auteur.
- `POST /publications/:id/reactions`, corps `{ type }` → `{ publicationId, maReaction, nbReactions, decompteReactions }`. Envoyer deux fois la même réaction la retire.
- `GET /publications/:id/supporters?cursor=&limite=25` → `{ supporters, total, hasMore, nextCursor }`, limité strictement aux réactions `SOUTIEN`. `supporters` contient les profils publics résumés et la limite est bornée à 50.
- `GET /publications/:id/reactions?cursor=&limite=25` → `{ reactions, decompteReactions, nbReactions, hasMore, nextCursor }`. Chaque réaction expose son type, sa date et l'identité publique minimale de son auteur. La limite est bornée à 50.
- `GET /publications/:id/commentaires` → `{ commentaires, total }`. Tous les commentaires accessibles sont renvoyés avec leur auteur et leurs réponses imbriquées, dans l'ordre chronologique.
- `POST /publications/:id/commentaires`, corps `{ contenu, parentId? }` → commentaire direct. `parentId`, lorsqu'il est fourni, doit désigner un commentaire racine : les fils sont limités à un niveau de réponses.
- `DELETE /publications/:id/commentaires/:commentaireId` → auteur du commentaire ou de la publication.

Une publication expose notamment `id`, `intention`, `thematique`, `contenu`, `photoUrl`, `createdAt`, `auteur`, `nbReactions`, `decompteReactions`, `maReaction`, `nbCommentaires`. `nbCommentaires` compte les commentaires racines et toutes leurs réponses. Les commentaires inclus dans une publication restent un aperçu ; l'endpoint dédié renvoie l'arbre complet.

L’auteur a la forme :

```json
{
  "id": "profil-id",
  "photo": null,
  "titre": "…",
  "ville": "…",
  "pays": "…",
  "user": { "prenom": "…", "nom": "…" }
}
```

## Messagerie

- `GET /messages/conversations` → `{ conversations }`, avec dernier message et `nonLus` par membre.
- `GET /messages/conversations/:id?cursor=&limite=30` → `{ conversation, messages, hasMore, nextCursor }` et marque la conversation lue pour l’appelant.
- `POST /messages/conversations`, corps `{ destinataireId, premierMessage? }` → `{ conversationId, message }`. La clé de paire rend la création idempotente.
- `POST /messages/conversations/:id/messages`, corps `{ contenu }` → `{ message }`.
- `GET /messages/membres/recherche?q=` → `{ membres }`.

## Notifications

- `GET /notifications?cursor=&limite=20` → `{ notifications, nonLues, hasMore, nextCursor }`.
- `GET /notifications/non-lues` → `{ nonLues }`.
- `PATCH /notifications/:id/lire` → `{ notification }`.
- `PATCH /notifications/tout-lire` → `{ misesAJour }`.

Les notifications sont persistées avant leur émission temps réel et ne peuvent être lues que par leur destinataire.

## Profils et synergies

- `GET /users/me` → compte direct et `profil` complet : médias, confidentialité, formations (références, avis et suivi d’insertion), expériences, mentorat, cercles et statistiques.
- `PUT /users/me` → mise à jour validée des informations éditables.
- `PATCH /users/me/bio`, `POST|DELETE /users/me/photo`, `POST|DELETE /users/me/couverture`.
- `GET /users?q=&pays=&ville=&situation=&volontaire=&page=&limite=` → `{ membres, page, limite, total, totalPages }`.
- `GET /users/:id` accepte un identifiant de profil ou de compte et masque e-mail/téléphone selon les préférences.
- `GET /synergies`, `GET /synergies/suggestions`.
- `POST /synergies`, corps `{ recepteurProfilId }` → `{ message, synergie, notification }`.
- `PUT /synergies/:id`, corps `{ decision: "ACCEPTE"|"REFUSE" }`.
- `DELETE /synergies/:id`.

## Socket.io

Connexion à l’origine du backend avec `auth: { token: JWT }`. Le serveur vérifie le JWT, résout le profil puis inscrit le socket dans `user:<userId>`. Il vérifie l’appartenance en base avant `rejoindre_conversation` et `en_train_decrire`.

Événements reçus :

- `nouveau_message` et `message:created` → message complet ;
- `nouvelle_notification` → notification complète ;
- `nouvelle_publication` et `publication:created` → `{ publication }` ;
- `nouveau_commentaire` et `publication:commentCreated` → `{ publicationId, commentaire, nbCommentaires }` ;
- `reaction_mise_a_jour` et `publication:reactionUpdated` → `{ publicationId, nbReactions, decompteReactions }`. `maReaction`, propre au membre connecté, reste uniquement dans la réponse HTTP de l'action ;
- événements de suppression `publication_supprimee` / `publication:deleted` et `commentaire_supprime` / `publication:commentDeleted` ;
- `messages_lus`, `interlocuteur_ecrit`, ainsi que les événements de synergie historiques et leurs alias `synergie:*`.

## Déploiement MySQL

La source de vérité est MySQL pour tous les environnements. Exécuter dans `backend` :

```sh
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
```

Les migrations sont additives. Une base Hostinger existante doit d’abord avoir la migration `20260919000000_production_baseline` marquée comme appliquée conformément au runbook de déploiement ; ne jamais rejouer cette création de schéma sur une base remplie. `UPLOAD_DIR` doit pointer vers un dossier persistant et `FRONTEND_URL` peut contenir plusieurs origines séparées par des virgules.

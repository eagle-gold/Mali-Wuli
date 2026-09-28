# Suppressions du contenu — lot frontend, 28 septembre 2026

Le bouton manquant des publications personnelles est ajouté directement sur la carte. Les commentaires, y compris les réponses, disposent du même contrôle lorsque l’API l’autorise. Les fiches d’associations, d’offres et d’événements ainsi que les listes administratives d’offres/événements en attente proposent également la suppression.

## Contrat et comportement

- Visibilité stricte selon `peutSupprimer === true`, renvoyé pour le lecteur courant. Aucun droit dérivé du nom de rôle ou d’un simple droit de modification. Les quatre types API acceptent le champ optionnel pour la compatibilité des anciennes réponses : l’absence du champ masque l’action.
- Confirmation séparée, intitulé explicite et conséquences avant le DELETE. Annuler n’effectue aucun appel. Escape annule hors envoi, le focus revient au bouton après annulation. Le bouton de confirmation est protégé contre les doubles envois, avec état « Suppression… ».
- Succès : retrait immédiat du contenu. Le fil et les listes gardent les identifiants supprimés en mémoire pour éviter qu’une ancienne lecture les réinsère. Les compteurs et la pagination des offres/événements administratifs sont relus. Le détail d’offre ferme également sa sélection mobile et retire son paramètre d’URL. Les fiches autonomes affichent un succès et un lien vers leur liste.
- HTTP 403/409/500 ou erreur réseau : le contenu reste à l’écran, le message s’affiche et la personne peut réessayer. HTTP 404 : le contenu déjà absent est retiré de la vue. Une candidature en cours peut donc empêcher la suppression d’une offre sans faire disparaître sa fiche.
- Suppressions distantes : les deux alias socket `publication_supprimee` et `publication:deleted` retirent la carte immédiatement et enregistrent son identifiant avant toute relecture ; une ancienne requête GET ne peut donc la réinsérer. Les alias sont regroupés dans une seule actualisation des données et panneaux.
- Compteurs de commentaires : la réponse DELETE fournit `nbCommentaires`, appliqué comme valeur absolue lorsqu’il s’agit d’un entier positif ou nul. Aucun décrément local après un retour socket n’est effectué. Un404 ou une réponse sans compteur valide déclenche la relecture sans soustraction.
- Le responsable d’une publication peut retirer ses commentaires, ainsi que ceux déposés sous sa publication, conformément au droit historique du backend. Retirer un commentaire racine retire ses réponses. Les comptes des auteurs sont préservés.
- Les propositions en attente sont accessibles à leur auteur depuis « Mes offres » / « Mes propositions » ; la suppression est également proposée directement dans les listes de modération. Les actions de validation sont verrouillées pendant un DELETE dans l’administration.

Treize fichiers du lot sont listés avec leurs empreintes dans `suppression-frontend-files.json`. Aucun fichier `lib/api.ts` ni aucune donnée applicative réelle ne sont modifiés par ce sous-lot. La gestion des membres et le registre des rôles sont traités séparément par la session principale.

## Vérifications locales

- `node output/2026-09-28-suppressions-droits/verify-suppression-ui.cjs` : 8 groupes réussis (confirmation/annulation/doublons, erreurs et 404, droits/cartes/commentaires récursifs, offres et sélection mobile, fiches retirées, administration et compteurs).
- `node output/2026-09-28-suppressions-droits/verify-qa-suppressions.cjs` : 4 scénarios réussis, appel direct aux fixtures RAM sans démarrer de serveur : publication/commentaires, association/affiliations, offre en attente/compteurs, événement en attente/compteurs ; permissions propres, tiers refusés et domaines autorisés.
- `node output/2026-09-28-suppressions-droits/verify-frontend-overlay.cjs` : 0 diagnostic, 15 sources TypeScript de staging au moment du contrôle (y compris les fichiers de la session principale), aucune émission dans le dépôt actif.

Ces tests simulés ne remplacent pas les tests des vrais handlers backend, effectués indépendamment. La session principale prend en charge les vérifications navigateur et la publication.

## Fixtures navigateur disponibles

Les fichiers `qa-fixtures.cjs`, `qa-publications.cjs`, `qa-events.cjs`, `qa-offres.cjs`, `qa-annexes.cjs` et `qa-admin.cjs` sont locaux, sans accès à une base, au SMTP ou à un réseau sortant. Leur import n’ouvre aucun port. `qa-admin.cjs` et la délégation des rôles restent sous la responsabilité de la session principale.

Compte fictif Awa (`membre@example.test`, mot de passe public de fixture `qa-test`) :

- `qa-post-membre` : publication personnelle supprimable avec un commentaire et une réponse pour vérifier la cascade.
- `qa-post-other` : publication d’un tiers ; seul son commentaire `qa-comment-own` est supprimable.
- `qa-post-echec` : le droit est affiché mais le DELETE renvoie volontairement 403, simulant une révocation intervenue depuis la lecture. La carte doit rester avec l’erreur.
- `qa-offre-pending-communication` : offre en attente appartenant à Awa.

Compte fictif Mariam (`manager@example.test`, même mot de passe de fixture) : responsable de `qa-asso-bamako` et auteur de propositions d’événements. Le compte administrateur fictif permet de contrôler les listes de modération. Les tests `verify-qa-suppressions.cjs` réinitialisent leur état RAM en début et fin d’exécution ; ils n’agissent jamais sur un éventuel serveur de fixture déjà lancé.

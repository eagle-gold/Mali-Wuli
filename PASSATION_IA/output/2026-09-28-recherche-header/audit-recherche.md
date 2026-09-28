# Recherche du header — audit du 28 septembre 2026

Lecture seule des sources frontend/backend actives dans `/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration`. Aucun serveur, appel API ou accès base effectué pour cet audit. La publication et les contrôles navigateur sont gérés par la session principale.

## Fonctionnement actuel

- `frontend/src/components/MaliWuliHeader.tsx:245` : le formulaire ouvre `/annuaire?recherche=<terme encodé>`, ou `/annuaire` si vide. Il recherche dans l’annuaire, pas dans les événements, publications ou messages. Le formulaire est visible à partir de `xl` ; les nouvelles largeurs sont 260 px puis 290 px à `2xl`.
- `frontend/src/app/(platform)/annuaire/page.tsx:26` : `q` dans l’URL est prioritaire sur `recherche`. L’onglet initial est Personnes, sauf `type=associations`. Le champ de l’annuaire déclenche la recherche après 350 ms, avec aussi un bouton de soumission.
- `backend/src/services/annuaire.ts:32` : Personnes cherche chaque mot dans prénom, nom, titre, bio, pays/ville, poste/entreprise/secteur, nom d’établissement, établissement saisi librement, filière, spécialité de formation et spécialité de volontariat. Tous les mots doivent correspondre, mais ils peuvent appartenir à des champs différents. Seuls les profils validés ayant terminé l’inscription sont inclus ; son propre profil est exclu. Les coordonnées privées et les contenus de la plateforme ne font pas partie de la recherche.
- `backend/src/services/association.service.ts:98` : Associations cherche l’expression complète dans un seul champ parmi nom, description, vocation, pays et ville, uniquement pour les associations actives. Les responsables et les membres de l’association ne sont pas cherchés.
- `frontend/src/app/(platform)/annuaire/page.tsx:49` : changer d’onglet conserve le terme, pays et ville. Les autres filtres sont gardés en mémoire mais transmis seulement à leur catégorie. Résultats par 12, tri alphabétique, pas de classement par pertinence. Les compteurs des onglets sont les totaux globaux, distincts du nombre de résultats filtrés.

## Limites laissées en place

1. Le texte du header et celui de l’annuaire ont des états séparés. Ouvrir une URL contenant un terme préremplit l’annuaire, pas le header.
2. Modifier ou effacer la recherche dans l’annuaire, changer d’onglet ou réinitialiser les filtres ne met pas l’URL à jour. Un rafraîchissement ou un partage du lien peut donc rétablir l’ancien terme et l’ancien onglet. En conséquence, resoumettre depuis le header exactement l’URL déjà affichée ne réinitialise pas les états locaux modifiés entre-temps : les dépendances `qUrl`/`typeUrl` de l’effet ne changent pas. Ce dernier cas est déduit du code, pas vérifié ici dans le navigateur.
3. Une nouvelle recherche depuis le header conserve les filtres déjà actifs dans l’annuaire, y compris ceux susceptibles de réduire les résultats.
4. Le header n’a pas de `maxLength`, alors que les API limitent le terme à 100 caractères : un terme plus long entraîne une réponse 400. Le champ de l’annuaire impose déjà cette limite.
5. La recherche Associations est plus restrictive pour plusieurs mots : « culture Bamako » ne combine pas une vocation « culture » avec une ville « Bamako », contrairement au traitement par mots de Personnes. Aucun mécanisme de correction des fautes ou de recherche approximative n’est prévu dans ces filtres.

## Contrôle de publication préparé

Le `verify-events-release.cjs` de ce dossier conserve tous les contrôles événements, associations, navigation, accueil, inscription et ressources. Il vérifie en plus que le bundle servi contient les classes du formulaire de recherche `w-[260px]`, `2xl:w-[290px]`, `hidden` et `xl:block` ensemble. Cette assertion de bundle ne mesure pas le rendu : la vérification visuelle reste distincte. Le mode `--baseline-only` ne réclame pas les nouvelles largeurs, pour permettre la comparaison avec la version précédente.

Ces limites fonctionnelles ne sont pas modifiées par le lot de largeur du header. Aucun résultat de publication n’est revendiqué par cette note.

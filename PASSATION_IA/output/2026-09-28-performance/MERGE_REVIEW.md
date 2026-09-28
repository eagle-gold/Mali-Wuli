# Revue d’intégration du lot performance après la typographie du profil

Date : 2026-09-28

## Verdict

Le lot est intégrable, mais **le staging actuel ne doit pas être installé tel quel**. Il écraserait la typographie désormais validée du profil et son installateur refuse déjà le nouvel état du dépôt. La partie session/navigation et les variantes d’images sont cohérentes. L’optimisation des facettes de villes demande encore une décision/correction avant mise en production.

## Conflit avec les changements actifs

Trois sources du manifeste de référence ont changé depuis la préparation du lot :

- `frontend/src/components/profile/ProfilMembre.tsx`
- `frontend/src/components/profile/AssociationsProfil.tsx`
- `frontend/src/components/profile/LiensSociauxProfil.tsx`

`install-staging.py` vérifie tout le manifeste, même les deux derniers fichiers qui ne sont pas dans le staging performance. Il échouera donc sur `baseline changed`. Il ne faut ni contourner cette garde ni recopier tout le profil depuis le staging.

Le `ProfilMembre.tsx` du staging performance contient encore les anciens titres en petites capitales (`text-sm/text-xs`, `uppercase`, `tracking`) et rétablirait exactement l’aspect rejeté par l’utilisateur. L’intégration sûre consiste à partir du profil actif, puis à appliquer uniquement :

1. l’import et l’appel de `useSessionMembre` ;
2. le chargement indépendant du profil et des suggestions ;
3. `sessionMembre?.actualiser()` après l’enregistrement de la photo.

Le patch prêt à appliquer sur le profil actif est :

`output/2026-09-28-performance/profil-performance-on-top-of-typography.patch`

Il conserve toutes les classes typographiques validées et la nouvelle présentation aplatie des associations.

## Vérifications exécutées

- Staging performance brut : 19 groupes de tests de session/navigation réussis.
- Staging performance brut : vérification TypeScript frontend, 0 diagnostic.
- Backend en overlay : vérification TypeScript, 0 diagnostic sur les 3 sources ajoutées/modifiées.
- Variantes des logos : 3 groupes réussis ; les 7 WebP correspondent pixel par pixel aux redimensionnements de référence et conservent l’alpha.
- Overlay fusionné temporaire, fondé sur le profil typographique actif :
  - 19 groupes session/navigation réussis ;
  - TypeScript frontend : 0 diagnostic sur 12 sources en overlay ;
  - vérificateur typographique : réussi pour les trois composants de profil.
- Aucun fichier du dépôt actif, aucune base et aucun service externe n’ont été modifiés par cette revue.

Le build de production temporaire a atteint `next build`, puis a échoué uniquement parce que l’environnement local ne résout pas `fonts.googleapis.com` pour `next/font`. Il faut donc refaire le build dans l’environnement Hostinger habituel, qui a déjà construit ces polices, ou avec un cache/réseau de build valide. Ce résultat ne valide pas encore le bundle de production fusionné.

## Défaut à corriger dans les facettes scolaires

La preuve existante `facettes-equivalence-before.json` montre :

- Mali : équivalence exacte, 5 227 villes ;
- global : même nombre et mêmes valeurs une fois normalisées, mais 140 variantes de libellés changent ;
- France : même nombre et mêmes valeurs une fois normalisées, mais 30 variantes changent.

Exemples concernés : accents ou casse tels que `Déchy`, `Échirolles`, `Épernay`, etc. Le `MIN(ville)` sous la collation SQL ne reproduit donc pas toujours le libellé que la lecture Prisma ordonnée choisissait. Comme le chantier vise aussi à ne plus salir les localisations, publier ce changement sans décision explicite peut afficher une variante moins propre.

Solution recommandée : choisir la ligne représentative avec une fonction de fenêtre, en partitionnant sur `BINARY villeNormalisee` et en reprenant un ordre déterministe compatible avec l’ancien résultat (`ville`, puis `id`), puis refaire l’audit d’équivalence. Si la version SQL cible ne permet pas les fonctions de fenêtre, conserver provisoirement l’ancienne lecture pour les villes et déployer séparément les autres gains.

Le lot réduit le temps mesuré des villes globales d’environ 1 109 ms à 357 ms, mais renvoie encore environ 32 813 options / 797 Ko quand aucun pays n’est choisi. Le meilleur gain suivant consiste à ne charger les villes qu’après le choix d’un pays, ou à fournir une recherche/autocomplétion paginée. L’agrégation SQL seule ne règle pas le poids de la réponse ni le coût du rendu du sélecteur.

## Risques et lacunes avant activation

1. Ajouter des tests backend dédiés à `GET /users/me/session` : contrat minimal, droits délégués, absence de données lourdes/secrètes, `Cache-Control: private, no-store`, révocation entre le middleware et la seconde lecture.
2. Vérifier les facettes pour chaque niveau (`INSTITUT`, `GRANDE_ECOLE` et les types Prisma), avec et sans pays. La preuve actuelle ne couvre que le niveau absent.
3. Faire la QA navigateur avec la fixture lente : Dashboard → Profil → Annuaire → Profil ; confirmer que le header et la photo ne repassent pas à `MW`, qu’une seule lecture légère accompagne chaque navigation et que le profil s’affiche avant les suggestions.
4. Faire la même QA à 390 px et à la largeur tablette, sans débordement horizontal et avec la navigation basse.
5. Construire frontend et backend en production, puis exécuter le smoke candidat et la comparaison des assets publics.
6. Ajouter une politique de cache immutable pour `/images/optimized/*` afin que les noms hashés servent réellement la performance. Sans règle dédiée, les fichiers de `public/` peuvent rester à `max-age=0` selon la réponse Hostinger.
7. Sur une entrée directe ou un rechargement complet, le header initialise encore son état local à `MW`, puis applique le contexte dans un effet. La navigation interne ne remonte plus le header, mais un flash d’une image peut subsister après le premier contrôle. Pour le supprimer totalement, initialiser nom/initiales/photo depuis `sessionMembre?.compte` ou les dériver directement du contexte au premier rendu.
8. Mesurer après publication avec un navigateur (LCP/CLS/INP). Les mesures actuelles sont des temps HTTP/SQL et ne constituent pas des Core Web Vitals.

## Scripts de publication à rebaser

`release-contract.json`, `activate.cjs`, `verify-sources-readonly.cjs` et les scripts associés supposent encore que frontend et backend pointent tous deux sur `versions/20260928-liens-sociaux` et que le build frontend de référence est `MF940TX4N8sLGFRsT_gyN`.

Si la typographie est publiée avant le lot performance, le frontend précédent sera différent du backend précédent. Le contrat doit enregistrer séparément `previousFrontend`, `previousBackend` et le vrai build ID immédiatement avant l’activation. `activate.cjs` utilise actuellement `previousRelease` pour les deux cibles : il faut le corriger pour utiliser la valeur propre à chaque mode. Tous les manifests et nombres de fichiers doivent être régénérés après la fusion, sans réutiliser les anciennes empreintes.

## Ordre d’intégration recommandé

1. Finir/publier la typographie du profil, ou figer son état local comme nouvelle base.
2. Corriger ou isoler l’optimisation des facettes de villes.
3. Copier les autres fichiers du staging performance.
4. Appliquer le patch ciblé du profil sur l’état actif.
5. Régénérer manifestes et contrat de version depuis cet état fusionné.
6. Exécuter les tests backend, session, typographie, TypeScript, build et QA navigateur.
7. Construire un candidat Hostinger, vérifier la base en lecture seule, faire le smoke candidat, puis activer backend et frontend avec leurs cibles précédentes exactes.

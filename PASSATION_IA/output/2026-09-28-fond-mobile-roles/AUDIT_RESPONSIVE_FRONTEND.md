# Fonds et adaptation mobile — lot frontend

Date : 28 septembre 2026. Source relue : `MALI-WULI-hostinger-integration/frontend/src`. Modifications préparées uniquement dans `staging/frontend/src`. Aucun serveur, compte réel, API distante, base de données ni déploiement utilisé par cet audit.

## Fond uniforme

Le tableau de bord utilisait `#f4ecdd`, le profil `#f4eee1`, l'authentification `#f6efe3`, l'éducation `#f5efe2`, la landing `#f5eedf`, tandis que le body et le layout de la plateforme avaient `bg-sable-50` (`#fdf8f0`). Quand le contenu du tableau de bord se terminait, le fond plus clair du cadre restait visible.

Le choix validé est `--color-page: #f4ecdd`. `html`, `body`, le cadre de la plateforme, le layout d'authentification et les fonds des pages concernés utilisent cette valeur. Les cartes blanches/claires, surfaces des conversations, bandeaux bruns, couleurs de marque et polices sont conservés. La landing réutilise le fond commun dans sa variable locale `--cream`.

Le `main` de la plateforme reste flexible et peut se réduire (`min-w-0`) ; son `overflow-y-auto` est retiré. Sans hauteur contrainte, ce conteneur n'avait pas besoin d'un second défilement vertical et pouvait transformer un débordement horizontal enfant en zone de défilement implicite. Aucun `overflow-x:hidden` n'est ajouté globalement. Ceux des racines onboarding sont retirés ; le découpage local des images, bulles et animations reste intentionnel.

## Audit par famille de routes

Les largeurs **320 / 375 / 768 px sont les cibles de la QA navigateur principale**. Ce tableau décrit l'audit du code et les changements préparés ; il ne prétend pas remplacer la mesure dans le navigateur.

| Routes / composants | Constat et correction | Vérification navigateur ciblée |
| --- | --- | --- |
| `/dashboard` | Fond du cadre aligné ; texte de publication et métadonnées longues peuvent revenir à la ligne. Suppression du minimum de 220 px du texte de l'étape de publication. | Page courte et longue, menu des filtres, composer ouvert, publication avec URL longue. |
| `/profil` | Fond commun pour contenu/chargement/erreur ; titres des sections peuvent répartir leurs actions ; boutons des suggestions sur une colonne sur mobile ; noms/lieux longs contenus. | Expériences, formations, suggestions et actions Synergie encore visibles/fonctionnelles. |
| `/annuaire`, `/membres/[id]`, `/associations/[id]` | CSS partagé : pistes de formulaire réductibles, actions pouvant se répartir, boutons couverture bornés ; demandes d'affiliation sur une deuxième ligne sur mobile pour ne pas écraser le nom. | Deux catégories, filtres, fiche association/profil, longue adresse, contrôles gérant, popup proposition. |
| `/evenements`, `/evenements/[id]` | Mise en page existante déjà adaptée ; textes longs et enfants flex sont bornés, boutons contraints à la largeur disponible. | Hero, filtres, participants, album/upload, visionneuse. Les recadrages de photo restent locaux. |
| `/evenements/proposer` | À moins de 380 px, choix de format empilés : radio + « Présentiel » n'étaient pas confortables sur trois petites colonnes. Titres de section avec actions peuvent se répartir. | Formulaire, programme, dates, aperçu et choix du format. |
| `/offres` | Grilles et bascule liste/détail mobiles existantes conservées ; largeur minimale et textes longs des cartes/auteurs contenus. | Liste puis détail, 5 filtres, confirmation de candidature, fermeture et PDF. Aucun flux candidature modifié. |
| `/offres/deposer` | `OffresEdition.module.css` relu : grilles en `minmax(0,1fr)`, formulaire une colonne <520 px, aperçu sous le formulaire <900 px. Aucun changement nécessaire. Fond hérité commun. | Long titre/entreprise et formulaire avec les trois modes candidature. |
| `/messages` | Fond du cadre commun ; minimum de hauteur réduit de 500 à 320 px pour les petits écrans ; bulles peuvent casser les URL/mots très longs. La hauteur dynamique et le défilement interne restent conservés. | Liste et conversation, clavier ouvert, message long sans espace, retour à la liste. |
| `/education`, `/education/etablissements/[id]` | Fond commun ; noms/avis longs contenus ; pagination peut passer à la ligne au lieu de déborder à 320 px. | 15 établissements fictifs pour afficher pagination, fiche avec membres/avis, filtres pays/ville. |
| `/agenda` | Racine réductible, long motif/noms à la ligne, deuxième piste d'information `minmax(0,1fr)` au lieu de `1fr`. | Mentorat et événements, onglets passé/avenir, filtre rôle. |
| `/volontaires` | Recherche sans minimum rigide ; selects en pleine largeur sur mobile et bornés à leur parent ; noms/sujets longs à la ligne. | Filtres sujet/pays, carte, ouverture réservation et liste créneaux. |
| `/synergies` | Code relu : onglets en défilement horizontal local explicite, cartes en 1/2/3 colonnes. Aucun changement fonctionnel ni de menu. Fond hérité commun. | Onglets accessibles, cartes et actions conservées. |
| `/login`, `/register`, `/register/details`, `/forgot-password`, `/reset-password` | Fonds racines alignés ; layout authentification autorise les longues adresses à revenir à la ligne. | Cartes et messages d'erreur à 320 px. |
| `/verify-email` | Anciennes cases fixes : 6×44 + 5×8 = 304 px dans un contenu mobile plus étroit. Remplacement par grille à 6 pistes `minmax(0,1fr)`, inputs `min-w-0`, marge intérieure réduite sur mobile. | Six cases toutes visibles, collage 6 chiffres et déplacement du focus inchangés. |
| `/onboarding` étapes 0–6 | Fond commun, masquage horizontal des racines retiré. Mentorat : formats empilés <400 px, boutons durée réduits en marge intérieure, contrôles dates réductibles. Formations et expériences avaient déjà des pistes `minmax` et actions réparties. | Chaque étape, sélecteurs école/diplômes, ajout/retrait, mentorat avec créneaux ouverts, confirmation. |
| `/` landing | Fond local synchronisé ; grilles existantes 1 colonne en mobile, menu existant conservé. Le découpage du SVG/arbre est intentionnel et local. | Arbre complet/réduction animations, feuille/bottom-sheet, FAQ et CTA inscription. |

Les pages admin et la navigation `MaliWuliHeader` sont suivies par les autres agents du même lot ; aucun changement de rôles, de type/API, de navigation ou de logique métier n'est inclus dans ces 24 fichiers.

## Contrôles réalisés

- TypeScript de l'ensemble frontend avec substitutions staging : **0 diagnostic**, sans émission de fichier. Commande : `node output/2026-09-28-fond-mobile-roles/verify-frontend-overlay.cjs`.
- Compilation Tailwind du CSS global avec le contenu actif et staging : **aucun avertissement**. Vérification de la couleur générée via variable, des six pistes OTP réductibles et analyse syntaxique de tous les CSS modules staging. Commande : `node output/2026-09-28-fond-mobile-roles/verify-styles.cjs`. Résultat `styles-verification.json`.
- Fixture supplémentaire `qa-annexes.cjs` : huit assertions ont vérifié pagination de 15 écoles, fiche détail, filtrage volontaires, agenda et trois créneaux ; les POST ne sont pas pris en charge par cette extension. Aucun serveur démarré.

## Limites et points de QA restants

- La géométrie réelle, le clavier virtuel, le focus et la navigation mobile sont vérifiés par l'agent principal sur le frontend intégré. Les tests TypeScript/CSS ne certifient pas ces interactions.
- Les interfaces natives de date/heure varient selon le navigateur. Contrôler en particulier le mentorat et le formulaire événement à 320 px.
- La messagerie garde son propre défilement et une hauteur minimale de 320 px : vérifier que le compositeur reste atteignable en paysage et lorsque le clavier apparaît.
- Les URL ou noms sans espace servent de cas limite : ils doivent revenir à la ligne, sans agrandir la page. Les cartes gardent leur contenu intégral sauf les troncatures déjà intentionnelles de titres/aperçus.
- Les popups portées par le header et les tableaux admin relèvent des fichiers des autres agents. Les SVG décoratifs et recadrages de photos ne doivent pas être comptés comme débordements de page.

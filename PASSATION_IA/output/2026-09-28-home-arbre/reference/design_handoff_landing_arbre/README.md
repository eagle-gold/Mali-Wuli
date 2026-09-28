# Handoff : Landing page Mali Wuli — « L'arbre de la diaspora »

## Overview
Landing page publique de Mali Wuli, réseau des Maliens d'ici et d'ailleurs. Objectif unique : **l'inscription** (création de profil).
Concept : un baobab interactif piloté au scroll. Le tronc = le Mali (membres locaux), chaque branche = un pays, chaque feuille = une personne. Une feuille dorée « Vous ? » représente le visiteur : c'est le CTA d'inscription.

## About the Design Files
Le fichier `Mali Wuli - Landing Arbre.dc.html` est une **référence de design en HTML** (prototype montrant le rendu et le comportement attendus), pas du code de production à copier tel quel. Il s'ouvre directement dans un navigateur (avec `support.js` à côté). La tâche : **recréer ce design dans la stack existante du site** (React/Next, Vue, etc.) avec ses conventions. S'il n'y a pas de stack, choisir la plus adaptée (ex. Next.js + CSS modules/Tailwind).
La logique de l'arbre (géométrie, animation, interactions) est dans le `<script data-dc-script>` en bas du fichier : classe `Component`, méthode `buildTree()`. Elle est portable quasi telle quelle en composant React.

## Fidelity
**High-fidelity.** Couleurs, typos, espacements et textes sont finaux. Reproduire fidèlement.

## Structure de la page (de haut en bas)

### 1. Header (sticky, dans la zone arbre)
- Hauteur 76px, padding 0 48px, fond `#F5EEDF`, bordure basse 1px `#E4D8C4`, flex, gap 28px.
- Gauche : logo `mali-wuli-arbre.png` (h 46px) + « Mali Wuli » (Fraunces 700, 20px, `#1A1410`).
- Nav : « Comment ça marche · Opportunités · Événements · FAQ » (Instrument Sans 500, 14px, gap 24px). **Cachée (opacity 0, non cliquable) tant que l'arbre n'est pas complet** ; elle apparaît en fondu avec le bandeau final (progression scroll ≥ 0.8).
- Droite (white-space: nowrap) : « Se connecter » (600, 14px, texte noir) + « Créer mon profil » (700, 14px, blanc sur `#0F5C33`, radius 999px, padding 10px 20px) → ouvre la carte d'inscription.

### 2. Hero « Arbre » (scroll-driven)
- Conteneur de scroll : hauteur **460vh**. À l'intérieur, un panneau `position: sticky; top: 0; height: 100vh; overflow: hidden`.
- Progression `p` (0→1) = `-rect.top / (rect.height - innerHeight)`.
- L'arbre (SVG, viewBox `115 -45 970 765`, `preserveAspectRatio xMidYMid meet`) occupe la zone entre top 56px et bottom 96px (les 96px du bas sont réservés aux légendes et au bandeau final).
- **Au chargement** : on ne voit que l'arbre. Tronc et branches « poussent » en ~1,9s (croissance animée via un timer `setInterval`, pas via rAF). Les branches sont forcées à 100% dès que p > 0.03.

**Phases du scroll :**
| p | Ce qui apparaît | Légende (Fraunces 34px, centrée en bas) |
|---|---|---|
| 0–0.03 | Indice « FAITES DÉFILER » + petit trait `#B85C2E` | — |
| 0.03–0.2 | Étiquettes pays au bout des branches, une par une | « Le tronc, c'est le Mali et ceux qui y vivent. Chaque branche, un pays. » |
| 0.1–0.2 | 5 feuilles sur le tronc (membres au Mali) | idem |
| 0.26–0.6 | 24 feuilles nommées (3 par branche) + petites feuilles décoratives, apparition échelonnée avec easing « back » | « Chaque feuille, une personne. » |
| 0.64–0.72 | Feuille dorée « Vous ? » + rameau, halo pulsant | « Il ne manque plus qu'une feuille… » / « La vôtre. » |
| ≥ 0.8 | Bandeau final en bas (fondu + translateY 20→0) + nav du header | — |

**Géométrie (voir `BR`, `taper()`, `buildTree()` dans le code) :**
- Tronc de baobab en bouteille : `M455,705 C480,640 466,560 480,500 C490,455 505,430 515,412 L685,412 C695,430 710,455 720,500 C734,560 720,640 745,705 Z`, dégradé horizontal `#3F2C1E → #6E5039 → #8C6B4F → #6E5039 → #3A281B`, plis verticaux, 4 contreforts de racines, ombre au sol.
- Texture d'écorce : filtre SVG `feTurbulence` (fractalNoise, baseFrequency 0.012 0.16, 3 octaves), sur le tronc et les branches.
- « MALI » gravé sur le tronc : Fraunces 700, 36px, letter-spacing 7, `#EAD7B9`.
- 8 branches = courbes quadratiques converties en formes pleines effilées (largeur 34 → 7), fill `#6A4D37` (survol `#5A4130`, sélection contour `#0F5C33`) ; 2 rameaux secondaires et 2 fourches au bout de chaque branche.
- Pays : Maroc, France, Canada, États-Unis, Sénégal, Côte d'Ivoire, Belgique, Espagne. Étiquette = pilule `#FDFAF3`, bordure `#D8C9B1`, texte 16px 700 majuscules.
- Feuille : `M-44,0 C-26,-22 26,-22 44,0 C26,22 -26,22 -44,0 Z` à l'échelle 1.3, couleurs `#0F5C33 #2E7A4A #4F7F36 #B85C2E #9A6A12`, prénom 15px 700 blanc.
- Feuille « Vous ? » : fill `#E7B634`, contour pointillé `#1A1410`, halo `#D9A21B` animé (keyframes `mwPulse`, 2,4s).

**Interactions (carte de détail à droite, top 92px, largeur 320px, fond `#FDFAF3`, radius 16px) :**
- Clic sur une **branche** ou une **étiquette pays** → carte « BRANCHE » : pays, « N membres · N offres », 3 membres cliquables.
- Clic sur une **feuille** → carte « FEUILLE · PAYS » : prénom, métier · ville, pastille de l'offre, bouton « Entrer en contact » + « Réservé aux membres : créez votre profil pour écrire. »
- Clic sur le **tronc** → carte « LE TRONC » : Mali, 214 membres, membres locaux.
- Clic sur **« Vous ? »**, « Créer mon profil » ou un CTA → carte d'inscription : bascule « Je vis au Mali / À l'étranger », Prénom, E-mail, bouton « Ajouter ma feuille », « Gratuit · 2 minutes · profil visible des seuls membres ».
- Clic dans le vide du SVG → ferme la carte. Survol des feuilles : échelle ×1.1.

**Bandeau final** (bottom 18px, centré, flex wrap) : surtitre « MALIENS D'ICI ET D'AILLEURS », H1 « L'arbre grandit avec chacun de nous. » (Fraunces 30px) + bouton « Ajouter ma feuille, c'est gratuit ».

### 3. Comment ça marche — fond blanc `#FFFFFF`, texte noir
Grille titre à gauche (« De l'inscription à la première rencontre », Fraunces 40px) + 3 cartes (`#FDFAF3`, bordure `#E4D8C4`, radius 16px, pastille numérotée `#6B4A2F`) : Créez votre profil / Offrez et demandez / Rencontrez-vous.

### 4. Opportunités « Le fil du réseau » — fond marron `#6B4A2F`, texte blanc
Titre, texte descriptif blanc 17px, lien « Voir tout le fil après inscription → ». 3 publications façon fil social (cartes blanches, radius 12px) : avatar à initiales, nom, poste · ville, ancienneté, « + Suivre », texte du post, encadré coloré (type, titre, méta), compteurs soutiens/réponses, barre d'actions « Soutenir · Répondre · [Postuler|Proposer|Réserver] ».

### 5. Événements à venir — fond marron `#6B4A2F`, texte blanc
H2 blanc 40px + description blanche. 3 cartes `#FDFAF3` avec une tuile calendrier (mois sur bandeau `#0F5C33`, jour en Fraunces 24px) : Forum emploi Bamako (18 oct.), Afterwork diaspora (25 oct.), Webinaire : revenir au Mali (7 nov.).

### 6. FAQ — fond `#FDFAF3`, texte noir
Accordéon à 5 questions (+/−), une seule colonne à droite du titre.

### 7. CTA final — fond `#0F5C33`, texte blanc
« Il ne manque plus que votre feuille. » + bouton crème → remonte au bandeau final de l'arbre et ouvre l'inscription.

## Règle de lisibilité (demandée par le client)
**Fond foncé → texte blanc. Fond clair → texte noir (`#1A1410`).** Pas de gris ni de beige atténués pour le texte courant.

## State Management
- `p` (progression scroll 0–1), `intro` (0–1, croissance initiale)
- `sel` : null | {type: 'country'|'person'|'mali'|'vous', …}
- `hover` : clé de l'élément survolé
- `away` : bascule Mali/étranger du formulaire
- `open` : index FAQ ouverts
- Données : pays et nombre de membres, membres (prénom, métier, ville, offre, pays), membres au Mali, publications, événements.
- **Garder ces données d'exemple telles quelles** (prénoms, métiers, villes, pays, compteurs, publications, événements) : elles font partie du design validé. Les reprendre à l'identique depuis les constantes `BR`, `PPL`, `MALI` et `renderVals()` du fichier HTML, dans un fichier de données statique (ex. `landingData.ts`). Ne pas les brancher sur une API pour l'instant.

## Design Tokens
- Fond crème `#F5EEDF` · carte `#FDFAF3` · blanc `#FFFFFF` · bordure `#E4D8C4` / `#EFE6D6`
- Texte noir `#1A1410` · marron `#6B4A2F` · vert `#0F5C33` (hover `#0A4426`) · terracotta `#B85C2E` · or `#D9A21B` / `#E7B634`
- Teintes : vert clair `#E3EFE7` · terracotta clair `#F6E3D6` · sable `#EDE3D3`
- Typo : **Fraunces** 600/700 (titres), **Instrument Sans** 400–700 (texte). Google Fonts.
- Radius : 999px (pilules), 16px (grandes cartes), 12–14px (cartes), 10px (boutons/inputs)
- Ombres : `0 20px 50px rgba(42,33,24,0.16)` (carte flottante)
- Sections : padding 80–88px vertical, 48px horizontal, contenu max 1280px

## Responsive
- Grilles en `repeat(auto-fit, minmax(…,1fr))`.
- Header : masquer la nav sous ~1000px (burger), boutons en nowrap.
- Mobile : réduire la hauteur de scroll (~300vh), afficher l'arbre complet plus tôt, carte de détail en bottom sheet.
- Respecter `prefers-reduced-motion` : arbre affiché complet, sans animation.

## Assets
- `mali-wuli-arbre.png` : logo (header)
- L'arbre est entièrement généré en SVG par le code (aucune image).

## Files
- `Mali Wuli - Landing Arbre.dc.html` : le design complet (template + logique)
- `support.js` : runtime nécessaire pour ouvrir le prototype dans un navigateur (pas à intégrer au site)
- `mali-wuli-arbre.png` : logo

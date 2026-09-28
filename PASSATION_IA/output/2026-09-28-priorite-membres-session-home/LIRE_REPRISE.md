# Reprise — priorité aux membres et session accueil

Lire le journal partagé avant toute intervention. Source active : `../MALI-WULI-hostinger-integration`, état Git non commité à préserver.

## État livré

Frontend/backend : `versions/20260928-priorite-membres-home`, build `dj5SeEGNIha9psRUR-GDY`. Anciennes cibles `versions/20260928-roles-actions`, build `FuGDWQkQpcBCevVL404El`, conservées. Aucune migration ni écriture DB, 14 migrations inchangées.

Établissements et associations : tri global par nombre de membres éligibles décroissant, puis nom/id, avant pagination. Compte validé et onboarding terminé ; profils distincts par établissement, affiliations VERIFIE par association. Helpers dans `backend/src/services/priorite-membres.service.ts`, appelés depuis education.routes et association.service. Les fiches sans membre sont paginées en SQL ; aucun chargement intégral des 143458 établissements. Les autocomplétions scolaires gardent leur pertinence de recherche.

Accueil : LandingArbre lisait auparavant zéro état de session et affichait toujours les boutons visiteurs ; le token restait actif. `useSessionAccueil` vérifie passivement /users/me et les liens deviennent Mon espace/Mon profil. Les visiteurs conservent /register. Les destinations respectent onboarding/validation. États SSR indéterminés sans faux bouton visiteur, erreur réseau réessayable sans effacement, refus403 avec motif autorisé et lien connexion. L’intercepteur api.ts ne purge que le jeton effectivement refusé, jamais une nouvelle session après une réponse ancienne. Le guard privé reste fermé si la vérification échoue.

## Preuves et limites

23 tests backend, 8 groupes frontend session, 6 groupes scripts ; TypeScript/builds Linux valides. 226 empreintes sources, 25 routes et66 assets HTTPS conformes. Browser-verification couvre aller-retour/reload/dashboard, logout volontaire, visiteurs et320px ; comptes RAM uniquement. DB read-only réelle : sept établissements affiliés avant141934 sans membre ; zéro association réelle, tests RAM pour celles-ci. Compteurs et empreintes rôles/tokenVersion/grants préservés.

Un503 temporaire a été observé au premier contrôle backend pendant le restart ; second contrôle complet réussi avant activation frontend. API saine au contrôle final. Anciennes versions et uploads conservés.

Serveurs QA locaux arrêtés, onglets temporaires fermés, viewport rétabli. Aucun commit/push, aucune fonction à moitié écrite. `aide-deploiement.md` et scripts sont figés pour cette release déjà exécutée : ne pas les rejouer pour un autre lot. `before/` et `before-manifest.json` décrivent le début de session ; `installed.json` le correctif ; `source-manifest.json` le code complet publié. Pas de secrets dans ces fichiers.

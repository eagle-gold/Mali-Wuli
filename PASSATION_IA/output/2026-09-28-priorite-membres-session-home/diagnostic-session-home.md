# Retour à l’accueil et session — 28 septembre 2026

## Cause établie

`LandingArbre.tsx` possédait un en-tête indépendant qui affichait toujours « Se connecter » / « Créer mon profil » et des CTA vers `/register`. Il ne lisait aucune session. Revenir à `/` ne supprimait pas le jeton. La reproduction navigateur de la session principale confirme qu’un retour ultérieur au tableau de bord restait possible sans nouvelle connexion.

Deux défauts connexes ont été corrigés : l’intercepteur Axios supprimait le jeton courant pour toute réponse 401, même issue d’une requête envoyée avec un ancien jeton ; la garde privée redirigeait vers la connexion sur une panne réseau ou serveur, même si le jeton était encore présent.

## Comportement retenu

- SSR puis hydratation : état `loading`, aucun lien actif de connexion/inscription avant lecture locale ; un jeton présent est vérifié avec `GET /users/me` et ne suffit pas à déclarer la personne connectée.
- Visiteur sans jeton ou session réellement expirée : parcours habituel `/login` et `/register`, sans quitter automatiquement l’accueil.
- Compte confirmé : « Mon profil » et « Mon espace », et liens contextualisés vers annuaire, fil, offres et événements. Les cartes de présentation ne déclenchent aucune action sur des personnes fictives.
- Priorité des destinations : `onboardingFini !== true` (y compris profil absent/null) → `/onboarding` ; statut non validé avec profil terminé → `/profil` ; compte validé → destination demandée.
- Erreur réseau/serveur : aucun effacement du jeton. Une session déjà confirmée reste affichée ; sans confirmation initiale, le bouton « Vérifier ma session » permet de réessayer. Focus, retour en ligne et changement de jeton entre onglets relancent la vérification.
- 403 : motif explicite limité aux messages connus de confirmation e-mail, suspension ou refus ; lien « Se connecter avec un autre compte » sans suppression du jeton. Les erreurs réseau gardent uniquement leur possibilité de réessayer.
- 401 : comparaison du jeton envoyé avec le jeton courant avant toute invalidation. Une lecture passive depuis l’accueil reste sur la page ; une réponse 401 privée courante conserve la déconnexion prévue. Les réponses obsolètes ou annulées ne peuvent confirmer un ancien compte.
- Garde privée : contenu masqué jusqu’à confirmation du compte et de la route ; erreur transitoire → message et bouton « Réessayer », sans redirection trompeuse vers la connexion.

## Fichiers de staging

`frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/hooks/useSessionAccueil.ts`, `frontend/src/components/auth/PlatformAuthGuard.tsx`, `frontend/src/components/landing/LandingArbre.tsx`, `frontend/src/components/landing/LandingTree.tsx`, `frontend/src/components/landing/LandingArbre.module.css`.

Le tracé SVG, les données de présentation, les polices et les pages d’inscription restent inchangés. Marqueur de contrôle : `data-session-state` vaut `loading`, `visitor`, `authenticated` ou `unavailable`.

## Vérification locale

- `node output/2026-09-28-priorite-membres-session-home/verify-frontend-overlay.cjs` : 6 sources TypeScript de staging, 0 diagnostic, aucune émission dans le dépôt actif.
- `node output/2026-09-28-priorite-membres-session-home/verify-session-home.cjs` : 8 groupes de contrôles réussis, transport Axios, stockage et hooks React simulés. Cas : SSR/visiteur, étapes du compte, initialisation et récupération réseau, expiration passive/privée, requêtes anciennes (succès et 401), annulation au démontage, garde privée et CTA par contexte.

La session principale effectue séparément les contrôles navigateur desktop/mobile, refresh, déconnexion explicite et publication. Ces contrôles locaux n’utilisent ni compte réel, ni base, ni réseau.

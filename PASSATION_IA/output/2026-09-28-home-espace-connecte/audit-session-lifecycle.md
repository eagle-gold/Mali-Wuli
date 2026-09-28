# Accueil et état connecté — correctif du 28 septembre 2026

## Cause constatée dans le code et reproduction

Le précédent correctif d’accueil est bien présent dans le dépôt actif : `LandingArbre` affiche « Mon profil » et « Mon espace » après une réponse `/users/me` confirmée. Les liens visiteur sont rendus uniquement dans l’état `visitor`. Une panne réseau produit `unavailable`, pas `visitor`.

Deux déclencheurs manquaient :

- Le hook n’écoutait ni `pageshow` au retour d’une page restaurée, ni `visibilitychange` au retour visible d’un onglet.
- Les parcours de connexion, création de compte, fin de session et vérification e-mail écrivaient directement dans localStorage. Or l’événement natif `storage` n’est pas émis dans le document qui effectue l’écriture. L’événement interne existant n’était envoyé que lors de l’invalidation HTTP401.

Reproduction locale avant changement, sans réseau : monter l’accueil sans jeton → `visitor` ; ajouter un nouveau jeton au stockage comme après connexion ; envoyer `pageshow` → toujours `visitor`, zéro lecture `/users/me`. Le même scénario suivi de `focus` lançait la lecture et passait à `authenticated`. Cela établit une lacune reproductible du cycle de vie ; ce test ne prouve pas à lui seul que la capture utilisateur était précisément une restauration bfcache.

La session principale a constaté que www et le domaine sans www répondent séparément. Leurs stockages navigateur sont distincts, mais l’utilisateur a confirmé utiliser `mali-wuli.com` sans www. Aucun changement de domaine, cookie partagé, redirection ou configuration backend n’est inclus dans ce lot.

## Correctif ciblé

Six fichiers de staging, listés et hachés dans `manifest-session-frontend.json` :

- `lib/session.ts` : `enregistrerSession(jeton, utilisateurId)` et `terminerSession()` centralisent les clés `mali_wuli_token` / `mali_wuli_user_id`. Ils émettent `mali-wuli:session-modifiee` uniquement si une valeur change réellement. Les erreurs du stockage ne sont pas masquées au login ; une mutation partielle effective notifie aussi les lecteurs. `invaliderSessionCourante` conserve sa comparaison du jeton envoyé avec le jeton courant avant suppression.
- `hooks/useSessionAccueil.ts` : nouvelle vérification sur `pageshow` et sur `visibilitychange` uniquement lorsque le document devient visible. Les listeners sont retirés au démontage ; les requêtes anciennes restent annulées/ignorées et les réponses d’un ancien jeton ne peuvent invalider la nouvelle session.
- `login/page.tsx` : les deux modes OTP et mot de passe passent par le même helper de création.
- `register/details/page.tsx` : création de session notifiée après inscription.
- `verify-email/page.tsx` : fin notifiée de l’ancienne session lors du passage au jeton de création de compte.
- `components/MaliWuliHeader.tsx` : déconnexion via le helper ; `PublicHeader` écoute aussi l’événement interne, `pageshow` et le retour visible, avec lecture sûre du stockage.

Le retrait des clés propres à l’inscription reste dans les parcours existants. `lib/api.ts`, la garde privée, `LandingArbre`, les destinations onboarding/profil/dashboard et les textes « Mon espace » / « Mon profil » restent inchangés. Aucun accès privé n’est accordé sur simple présence d’un jeton par le hook d’accueil : `/users/me` doit toujours confirmer le compte.

## Vérifications

`node output/2026-09-28-home-espace-connecte/verify-session-home.cjs` : **13 groupes réussis**, transport et navigateur simulés, aucune base ni réseau. Les huit groupes antérieurs sont conservés : destinations du compte, HTTP401 courant/ancien/passif, SSR, réseau, HTTP403, requêtes obsolètes, garde privée et CTA. Les nouveaux contrôles couvrent :

- création/fin de session dans le même document, notification unique par changement réel ;
- `pageshow` après connexion et après déconnexion ;
- onglet caché puis visible, concurrence de relectures, ancien401 ignoré, panne réseau et nettoyage des listeners ;
- mêmes transitions dans `PublicHeader` ;
- raccordement des quatre parcours d’écriture aux helpers centralisés.

`node output/2026-09-28-home-espace-connecte/verify-frontend-overlay.cjs` : **6 sources TypeScript, zéro diagnostic**, aucune émission dans le dépôt actif.

La session principale effectue séparément l’installation, la vérification navigateur réelle et le déploiement. Aucun fichier actif, journal, serveur ni compte n’a été modifié par ce sous-agent.

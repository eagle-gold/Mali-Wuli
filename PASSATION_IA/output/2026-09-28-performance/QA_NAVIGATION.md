# QA navigation lente — mémoire uniquement

Fixture préparée à partir du lot liens sociaux, sans serveur démarré par le sous-agent. État fictif entièrement en RAM. Écoute volontaire existante uniquement sur `127.0.0.1:4307`, CORS autorise `localhost:3006` / `127.0.0.1:3006`. Aucun Prisma, base, SMTP ou appel sortant. `require('./qa-fixtures.cjs')` ne démarre pas de serveur.

- Compte de connexion via l’interface : `membre@example.test`, mot de passe public de test `qa-test`.
- `GET /api/users/me/session` reprend le contrat backend léger et attend **1 500 ms** avant d’authentifier/répondre.
- `GET /api/synergies/suggestions` attend **4 000 ms** ; la liste reste fictive et vide.
- `GET /api/qa/performance` retourne les compteurs par méthode/chemin, `sessionsServies`, `profilsCompletsServis`, et les horodatages début/fin/durée/statut des 1 000 derniers appels. Les compteurs cumulatifs couvrent toute la période. Cette route ne se compte pas elle-même et ne révèle aucun jeton ni corps de requête.
- `POST /api/qa/performance/reset` remet seulement les métriques à zéro, sans déconnecter ni changer les données QA.
- `POST /api/qa/reset` reste la remise à zéro complète des anciennes fixtures, avec invalidation des sessions.

Scénario prévu : connexion normale, attendre le premier contrôle, remettre les seuls compteurs à zéro, naviguer Dashboard → Profil → Annuaire → Profil. Vérifier que l’en-tête reste présent pendant les 1,5 s de contrôle, que le profil apparaît avant la fin des suggestions, et qu’une requête `/users/me/session` accompagne chaque navigation sans double lecture par l’en-tête. En mode développement, React StrictMode et la reconnexion du socket peuvent ajouter des appels ; les horodatages permettent de les distinguer. La fixture HTTP ne simule pas le socket.

Les délais ajoutés servent à rendre les dépendances visibles ; ce ne sont pas des mesures de latence de production. `finishedAt` signifie que la réponse a été préparée côté fixture, y compris si le navigateur a entre-temps annulé sa requête.

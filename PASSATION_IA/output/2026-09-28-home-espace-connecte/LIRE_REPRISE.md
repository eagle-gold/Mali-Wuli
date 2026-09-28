# Accueil connecté — reprise

Frontend publié : `versions/20260928-home-session-r2`, build `ZbOkxHyHSm-qkR0dR9Qeh`, remplace `versions/20260928-suppressions-droits` / `cNI0N04igTlrU9KwyDz4k`. Backend conservé sur `versions/20260928-suppressions-droits`. Voir verification.json et frontend-public.json pour les contrôles finaux.

L’utilisateur confirme utiliser mali-wuli.com sans www et demande Mon espace lorsqu’il est connecté. Le correctif précédent reconnaissait la session au montage mais ne couvrait pas pageshow/visibilitychange. Les écritures connexion/inscription/déconnexion ne notifiaient pas le document courant. Le harness reproduit ce cas ; il ne prouve pas que la capture utilisateur venait précisément d’une restauration bfcache.

Six fichiers modifiés, listés dans installed.json. Les helpers enregistrerSession/terminerSession centralisent uniquement token/user_id et notifient les changements effectifs. Accueil et PublicHeader relisent la session au retour de page/onglet et à l’événement session. La home attend toujours /users/me pour confirmer le compte et respecte onboarding/validation. Intercepteur401, routes privées, design, polices et données inchangés.

13 groupes de tests mémoire, TypeScript et build Linux réussis. QA navigateur compte fictif : connexion, Mon espace/Mon profil, retour arrière, rechargement, déconnexion/reconnexion dans un autre onglet, mobile375 sans débordement. Capture accueil-connecte.png. Pas de téléphone physique/Safari ni session réelle utilisée. Les événements pageshow/visibilité et courses réseau sont couverts dans le harness ; détails audit-session-lifecycle.md.

Livraison : archive127fichiers frontend, manifeste230sources, backend103fichiers conservés ; aucun accès SQL, migration ou mutation métier. Dix tests garde et cinq tests packager sur fixtures, syntaxe scripts vérifiée. Les scripts de LIVRAISON_FRONTEND.md ont été exécutés par la racine et sont désormais historiques : préparation, build, candidate, activation, public. Ne pas les rejouer tels quels. Adapter version/manifeste/cible attendue pour le prochain lot.

Le premier lancement du vérificateur candidat a refusé le nom de socket QA non conforme au préfixe imposé. Relancé avec le préfixe prévu, sans changement applicatif ni affaiblissement du garde, puis succès. activation.log conserve deux rapports successifs candidate-built/after ; activation.json contient le dernier objet JSON valide.

Les hôtes apex/www servent encore le site séparément et leurs stockages ne sont pas partagés. Ce point a été observé, mais exclu du correctif après la précision de l’utilisateur. Ne pas transférer les jetons ni rediriger les sessions existantes sans besoin établi.

Aucun commit/push. QA locale arrêtée et onglets fermés, viewport rétabli. Aucune fonction partielle.

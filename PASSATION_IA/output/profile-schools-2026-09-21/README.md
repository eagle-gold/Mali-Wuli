# Smoke profil et parcours scolaires

`smoke-profile-schools.cjs` effectue un vrai roundtrip HTTP et Prisma uniquement
sur une base MySQL locale dédiée aux tests. Il n’a pas été exécuté sur une base.

Prérequis : backend compilé, migrations appliquées, pays `ML`/`FR` et établissement
Liberté déjà présents dans cette base QA. Le script ne modifie pas le catalogue.

Définir `BACKEND_ROOT` vers le dossier backend compilé et `QA_DATABASE_URL` dans
l’environnement, puis lancer `node /chemin/vers/smoke-profile-schools.cjs`.
Le nom de base doit contenir un segment `qa` ou `test` ; les hôtes distants sont
refusés. `QA_INSTITUTION_ID` permet de choisir l’identifiant existant de Liberté.

Le script crée un seul compte `example.invalid`, signe un JWT temporaire sans
connexion ni e-mail, puis vérifie :

- lecture d’un ancien snapshot avec diplôme unique ;
- sauvegarde d’une scolarité française au Mali, brevet 2014 et bac 2019 ;
- restitution avec et sans snapshot et ordre chronologique ;
- présence des champs dans `/users/me` ;
- refus d’une année hors scolarité sans écraser les données sauvegardées.

Le `finally` ferme le serveur isolé, supprime le compte QA et ses données liées,
ferme Prisma et retire son dossier temporaire. Aucun compte réel n’est utilisé.


## Déploiement vérifié

Version `20260921-profile-schools-r2` en ligne. Les tests HTTP/Prisma ont été exécutés sur un serveur Express isolé lié à la base sauvegardée, avec un compte temporaire EN_ATTENTE inaccessible dans l’annuaire, sans e-mail. Les scénarios ne modifient que ce compte ; nettoyage vérifié. `QA_SCOPED_ACCOUNT_ONLY=1` autorise explicitement ce mode. Les tests navigateur utilisent également un compte temporaire supprimé après vérification. Voir `verification.json`.

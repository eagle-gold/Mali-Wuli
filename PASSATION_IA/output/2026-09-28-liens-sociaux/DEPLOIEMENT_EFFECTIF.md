# Publication effective et précaution de reprise

Voir verification.json et runtime-after.json. Les scripts sont figés pour ce lot déjà publié : ne pas les rejouer sans relecture des versions, bases et effets. Le contrôle public a d’abord refusé les anciens bundles, malgré current correct. Redémarrage ciblé des anciens processus après vérification PID/cwd, puis second contrôle public réussi.

Pour le prochain lot : ne pas considérer un touch restart.txt comme preuve de relance. Vérifier la version exécutée et les ressources servies. Si un processus ancien persiste, identifier le PID du seul backend/frontend concerné et son répertoire exact avant un éventuel SIGTERM, puis vérifier sa relance automatique et la santé HTTP. Pas de pkill global, pas de PID repris de ce document.

Rollback applicatif possible en réactivant les anciennes versions conservées puis vérifiant réellement les processus et HTTP. La migration additive reste en place ; aucune migration inverse ni suppression de colonne/donnée.

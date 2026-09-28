# Origine des preuves

Ce dossier réunit deux catégories de traces, à ne pas confondre :

- `verification-*-2026-09-21.json` : copies des résultats historiques conservés dans les sous-dossiers de `../../output/`. Elles ne constituent pas de nouveaux tests ni une nouvelle inspection de production au 26 septembre.
- `etat-local-2026-09-26.json` et `empreintes-source-2026-09-26.json` : relevé de l’état Git et empreintes SHA-256 de 150 fichiers sélectionnés dans le dépôt actif. Le relevé inclut les fichiers de travail modifiés ou non suivis, pas seulement HEAD.

Les empreintes couvrent les sources applicatives, migrations, ressources publiques et principaux manifests/configurations. Elles excluent les dépendances installées, builds, fichiers privés d’environnement, uploads et bases de données. Elles ne permettent pas de restaurer le code : ce dossier n’est pas une sauvegarde.

Le contrôle [verifier_sources.py](../verifier_sources.py) compare ces 150 fichiers en lecture seule, sans réseau. Il ne recherche pas les nouveaux fichiers et ne vérifie ni la base, ni les variables d’environnement, ni la version servie en production. Au contrôle du 26 septembre : **150 fichiers identiques, aucun absent**.

Les documents de passation et leurs liens locaux ont été vérifiés séparément. Aucun test applicatif, smoke mutable, accès SSH ou déploiement n’a été relancé pour rédiger cette documentation.

Conserver ces traces datées lors d’une prochaine mise à jour ; ajouter de nouveaux résultats plutôt que remplacer silencieusement les anciens.

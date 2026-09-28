# Livraison frontend — accueil et session

Version préparée : `20260928-home-session-r2`. Backend à conserver : `versions/20260928-suppressions-droits`. Aucun changement de base, migration, polices, hôtes canoniques ou données métier n’est prévu.

## Diagnostic effectué

`production-before.json` constate le 28 septembre 2026 les deux liens `current` sur `versions/20260928-suppressions-droits`, le build frontend `cNI0N04igTlrU9KwyDz4k` et les 230 empreintes attendues : 127 fichiers frontend et 103 backend. Le contrôle a seulement lu les fichiers et effectué des requêtes publiques `HEAD`.

HTTP redirige vers HTTPS. En revanche, `https://mali-wuli.com/` et `https://www.mali-wuli.com/` répondent chacun 200 sans redirection entre eux, avec HTML `no-store`. Leur stockage navigateur est distinct. Cela constitue une piste de diagnostic ; aucune session réelle n’a été lue et aucune modification d’hôte canonique n’a été préparée.

## Scripts préparés, non exécutés en production

- `package-frontend.py` : à lancer localement après intégration du staging et gel des tests. Produit uniquement l’archive frontend, le manifeste combiné et le contrat de livraison. Refuse les 103 fichiers backend modifiés, toute modification frontend non couverte par le staging, le staging non intégré et tout écrasement d’artefact existant.
- `verify-sources-readonly.cjs` : garde sans import applicatif ni accès DB, modes `before`, `candidate`, `candidate-built`, `after`. Vérifie les manifests, les deux liens de version, les 103 empreintes backend et le build attendu selon la phase.
- `build-frontend.sh` : construit une nouvelle source/version frontend ; n’active pas le site. `--resume` est réservé à une source candidate déjà créée mais sans version finale, et vérifie de nouveau toutes les empreintes avant la reprise. La compilation garde les mêmes polices et le même endpoint API.
- `activate-frontend.sh` : script préparé à l’intention de la racine. Vérifie la candidate, le frontend précédent et le backend inchangé, puis échange uniquement le lien frontend et son signal de redémarrage. Aucun lancement par le sous-agent.
- `verify-release.cjs` : reprend les 25 routes et les contrôles assets/API en bundle de la livraison précédente. Ajoute les événements `pageshow`, `visibilitychange` et `mali-wuli:session-modifiee` dans le bundle d’accueil. Les libellés et le rendu SSR existants restent exigés. Il peut comparer les assets candidats et publics.
- `verify-api-public.cjs` : contrôle GET anonyme optionnel conservé, sans connexion utilisateur ni mutation. Il n’a pas été exécuté pour ce lot par le sous-agent.

## Ordre d’utilisation par la racine

1. Intégrer le staging, terminer les tests asynchrones de session, puis lancer `python3 package-frontend.py` depuis ce dossier local.
2. Après autorisation de livraison, transférer `frontend-source.tar.gz` vers `/home/u668963025/domains/mali-wuli.com/hbuilds/home-session-r2-frontend-source.tar.gz`. Transférer les deux manifests, `release-contract.json` et les scripts utiles vers `/tmp/mw-home-session-r2-qa`. Aucun fichier backend à transférer.
3. Garder les résultats `before`, build, `candidate-built` et du smoke candidat. Le smoke démarre seulement le serveur frontend candidat sur son transport QA et ne crée aucune session réelle.
4. Après validation de la candidate, exécuter uniquement l’activation frontend préparée. Conserver sa sortie `after`.
5. Comparer le frontend public à la candidate, y compris les assets. Les deux PNG éventuellement recompressés par le CDN doivent conserver une preuve liée aux empreintes exactes et aux pixels, selon le vérificateur existant.

Le premier build Fraunces de la livraison précédente avait reçu une URL CSS incompatible avec le chargeur Next. La relance à sources et polices identiques a réussi. En cas de réapparition, diagnostiquer le CSS public puis relancer la candidate ; ne pas substituer de police ni activer une candidate partielle.

## Tests locaux des scripts

`node --test verify-delivery-guards.test.cjs` : 10 scénarios sur le vrai garde chargé dans une VM et un système de fichiers exclusivement en mémoire. Refus des divergences backend, manifests, sources frontend, liens et build actif.

`python3 verify-package-fixtures.py` : 5 contrôles du vrai packager dans un faux dépôt jetable sous `/tmp`. Archive frontend seule, backend conservé, écrasement interdit, dérive backend bloquée, changement non relu ou staging non intégré refusés. Aucun fichier du dépôt actif n’est modifié.

Preuves : `tests-delivery-guards.tap`, `tests-package-fixtures.json`, `tests-delivery-syntax.json`. Aucun build réel, push, activation, migration ou accès DB n’a été exécuté par ces tests. Les tests de session et la QA navigateur sont gérés séparément par la racine et l’agent frontend.

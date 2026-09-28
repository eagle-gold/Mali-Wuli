# État final : Synergies retiré des menus uniquement

La précision utilisateur a remplacé le retrait étendu appliqué au début de cette session.

Version finale publiée : `20260928-menu-synergies`, build `DPia9wiu4OeyoZRNtEXYH`.

Deux fichiers modifiés par rapport à la version avant session : MaliWuliHeader.tsx et layout de la plateforme. Tout le reste, y compris recommandations, API, actions, notifications et page /synergies, est rétabli.

Preuves finales : verification.json, source-diff.json, source-manifest.json, ui-menu-check.json (6 contrôles), candidate-check.json, live-check.json, activation.txt.

Scripts finaux : verify-ui-menu-synergies.cjs (local simulé), verify-menu-synergies.cjs (HTTP lecture seule), build.sh et activate.sh (actions externes soumises à autorisation, versions existantes protégées).

Les scripts verify-sans-synergies.cjs, verify-ui-sans-synergies.cjs, notification-filter.test.cjs ainsi que ui-check.json et notification-tests.log décrivent le retrait étendu abandonné. Ne pas les considérer comme tests attendus de la décision finale. staging-retrait-etendu et les fichiers *-retrait-etendu conservent les preuves de cet état intermédiaire.

Aucune écriture base, migration, import ou fusion. Aucun commit ni push.

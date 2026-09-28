# Reprise événements publiés + champ recherche — 28 septembre 2026

Lire le journal et sa dernière entrée avant toute intervention. La session précédente événements était locale ; son attente d’accord est levée et sa publication est terminée dans cette session.

- Autorisation persistante utilisateur : migrer/publier les lots achevés après vérifications sans confirmation de routine. Préserver sauvegardes, contrôle cible/effets et versions de retour. Imports, fusions et suppressions massives ne sont pas implicitement autorisés.
- Frontend/backend current : versions/20260928-evenements-photos ; build g_ZlNJ4g3BexnPjw2JQYj. Les deux previous-target : versions/20260928-annuaire-associations.
- Migration appliquée : 20260928190000_event_photos, douzième migration, DB u668963025_maliwuli. Ne pas rejouer guard-migration qui attendait précisément la migration non appliquée.
- Backup privé : /home/u668963025/private-backups/20260928-evenements-photos/before.sql.gz (31 533 348 octets, gzip testé). Hash/compteurs dans backup-verification.json ; aucun contenu DB ou secret ici.
- Backend et frontend événements avaient déjà été testés dans ../2026-09-28-evenements-photos. Seule modification applicative supplémentaire : frontend/src/components/MaliWuliHeader.tsx largeur du champ 260/290. Archives de ce dossier consolidées, 193 sources, source-manifest.json conforme au serveur et au dépôt actif.
- Vérifications : candidate puis HTTPS public : 54 assets et 30 bundles, API/base OK, 91 contrôles DB en lecture seule, comptages delta 0. Côté navigateur : texte complet à 1280/1536 px, mobile320 sans débordement, recherche « Mali » personnes puis associations conservant le terme sur fixtures ; production /evenements → /login en anonyme. Aucun parcours mutation avec compte réel.
- Moteur réel MariaDB11.8.9 : programme JSON alias LONGTEXT avec CHECK JSON_VALID; seul vérificateur de ce dossier supporte strictement alias, collation et contraintes actives. backend-readonly-after.json garde premier échec; backend-readonly-final.json final : 91 contrôles OK, WARN uniquement aucun événement réel.
- Limites recherche : audit-recherche.md. Ne pas présenter la barre comme recherche universelle; ne pas étendre automatiquement portée à événements/publications.
- Serveurs QA locaux 3006/4307 arrêtés, onglets temporaires fermés, viewport rétabli. Pas de commit/push. Les modifications antérieures sont préservées.

Le contrôle public accepte exactement les deux PNG du CDN dont les empreintes source/public et pixels sont liées par la preuve précédente ../2026-09-28-annuaire-associations/public-images-comparison.json. Toutes les autres ressources sont identiques octet par octet.

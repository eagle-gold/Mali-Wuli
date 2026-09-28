# Offres d’emploi — version publiée le 28 septembre 2026

Lire le journal global avant toute intervention. Le dépôt actif reste `../MALI-WULI-hostinger-integration`, avec de nombreuses modifications préexistantes non commitées à préserver.

## État publié

Frontend et backend : `versions/20260928-offres-emploi`. Build frontend : `R-M49imb1rXepiN59auq5`. Anciennes cibles conservées : frontend `versions/20260928-parcours-recents`, backend `versions/20260928-evenements-photos`. Migration `20260928200000_job_applications` appliquée à `u668963025_maliwuli` ; total13 migrations, historique et empreintes conformes.

Sauvegarde privée avant migration : `/home/u668963025/private-backups/20260928-offres-emploi/before.sql.gz`, 31 533 640 octets, gzip vérifié. Ne pas copier de sauvegarde, de .env ou de secret dans les preuves. Un retour applicatif utilise les anciennes cibles ; ne pas restaurer automatiquement la base ni supprimer les nouvelles tables.

## Fonctionnement

- `/offres` : recherche, cinq filtres, cartes/détail, favoris personnels et offres déposées. Lien de fiche : `/offres?offre=<id>` ; pour une offre déposée en attente : `?vue=mes-offres&offre=<id>`.
- `/offres/deposer` : champs poste, entreprise, localisation, description, profil, contrat/mode/salaire et candidature ; `?id=<id>` pour modifier. Création ET modification remettent l’offre en attente, même par admin. Date limite au dernier instant UTC de la date choisie, explicitée dans le formulaire.
- `/admin/offres` : ADMIN/MODERATEUR seulement, lecture complète et confirmation de publication/refus. Pas de promesse de délai administratif inventée.
- LIEN_EXTERNE : lien HTTP(S) validé ; aucune candidature interne, message ou e-mail créé.
- MALI_WULI : un message atomique au déposant, avec profil professionnel et lien cliquable ; conversation accessible après envoi.
- EMAIL : PDF professionnel généré en mémoire et envoyé depuis `contact@mali-wuli.com` à l’adresse de candidature de l’offre, sinon à l’adresse privée du compte déposant. Reply-To = adresse du candidat. L’e-mail du candidat est partagé ; téléphone inclus seulement s’il est visible. Pas de photo ni données privées annexes dans le PDF.
- Candidat confirme le destinataire avant envoi et peut préparer un aperçu PDF privé. Révision SHA256 obligatoire pour candidature/PDF/modération ; changement de contenu ou destinataire =>409 et nouvelle lecture/confirmation.
- Réservations uniques `(offreId,profilId)` et transaction Serializable. Une candidature réussie n’est jamais renvoyée ; un échec certain accepte une reprise explicite. SMTP ambigu après DATA ou accepté avec échec de mise à jour DB => `EN_COURS`, jamais renvoi automatique. En cas réel, vérifier d’abord les journaux SMTP via l’identifiant message déterministe `<candidature-ID@mali-wuli.com>` ; ne pas forcer ECHEC sans preuve de non-livraison. Aucun outil de résolution automatique ajouté.

## Fichiers et vérifications

`installed-final.json` liste29 fichiers intégrés ; `source-manifest.json` contient214 empreintes publiées. Backend PDFKit embarque les polices Noto dans `backend/assets/fonts` : inclure ces assets dans toute future archive backend. Sources de tous les agents intégrées,185 fichiers antérieurs inchangés, aucun commit/push.

61 tests backend passent (17 offres +44 régressions),19 groupes UI,7 contrôles fixtures,8 contrôles e-mail simulé. PDF court1page/long6pages relus ; génération Linux pure vérifiée. Types et compilations Linux réussis.81 contrôles SQL/services lecture seule passent ; seul WARN : zéro offre réelle en base, donc détail réel non exerçable.60 ressources et34 bundles HTTPS conformes à la candidate ; accueil/inscription conservés. Première lecture main-app après restart transitoirement différente ; seconde lecture brute identique, vérificateur strict repassé sans exception ajoutée.

Navigateur sur RAM : filtre France, lien externe, candidature message + profil cliquable, aperçu PDF et succès EMAIL simulé, dépôt en attente puis publication admin, mobile320 formulaire/liste/détail/dialogue/admin sans débordement. Aucun e-mail réel de candidature envoyé en production ; SMTP contact authentifié via verify seulement, réception réelle non vérifiée. Tests SMTP utilisent transport VM interdit réseau. Un premier test mal substitué avait tenté sendmail LOCAL vers adresse fictive réservée example.test (échec75), remplacé avant tout essai SMTP réel ; voir journal.

Les scripts `guard-migration.cjs` et `check-database-readonly.cjs` sont destinés aux étapes AVANT activation et ne doivent pas être relancés tels quels après publication. Ne pas rejouer migration/activation automatiquement. Les fixtures `qa-fixtures.cjs` sont entièrement en mémoire sur4307 ; frontenddev3006. Comptes fictifs en tête du script. Serveurs arrêtés, onglet QA fermé, viewport rétabli.

`verification.json` résume les preuves, limites et Git final. Captures finales : `offres-verifiees.png`, `mobile-candidature.png`, PDF `pdf-final-1.png` et `pdf-long-2.png`. Les anciennes captures profil-pdf-1/2/3 décrivent un essai corrigé de pagination, ne pas les utiliser comme état final.

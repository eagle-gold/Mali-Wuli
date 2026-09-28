# Lot fond beige, mobile et rôles — livré le 28 septembre 2026

## Reprendre
Lire d’abord le journal partagé, puis LIRE_EN_PREMIER et guide05. Le dépôt actif reste `../MALI-WULI-hostinger-integration`, branche `ibrahima-catalogue-scolaire-partage`, sans nouveau commit. Ne pas nettoyer l’état non commité.

## Publication
Frontend et backend : `versions/20260928-fond-mobile-roles`. Build frontend `XKxGZymQs7bdnHFnsf0bl`. Les deux anciens current pointaient sur `versions/20260928-offres-emploi`, conservés dans `.previous-target`. Aucune migration, aucun rôle réel changé, aucune écriture base pendant les vérifications. La base `u668963025_maliwuli` conserve 13 migrations.

## Décisions et fonctionnement
- Un seul ADMIN effectif : rôle DB ADMIN + email principal normalisé. `ADMIN_EMAILS` ne peut plus élargir ce droit. Le compte principal était déjà le seul ADMIN validé et confirmé ; aucun script correctif de données nécessaire.
- Menu Administration visible aux ADMIN/MODERATEUR. Le propriétaire ouvre **Administration → Membres et rôles**, cherche une personne validée, choisit Membre ou Modérateur, puis confirme. Son propre compte est protégé.
- Modérateur global : inscriptions ordinaires EN_ATTENTE, offres, événements, catalogue et lecture des signalements. Pas de gestion des rôles, d’administration des associations ni de statistiques globales.
- Changement de rôle : contrôle de concurrence `expectedRole`, transaction sérialisable, incrément tokenVersion et retrait OTP. Les sessions et sockets de la cible sont invalidées ; elle se reconnecte. Aucun envoi de notification de rôle implémenté.
- Volontariat = fonction du profil ; responsabilité associative = personne désignée sur la fiche. Ce ne sont pas des droits de modération. Les anciens rôles DB sont conservés ; aucun cercle remis dans l’interface.
- Fond de page commun `--color-page:#f4ecdd`, y compris en dessous du contenu. Cartes claires, polices Inter/Playfair et identité conservées. OTP sur six colonnes réductibles, mentorat/formulaires, actions longues, pagination, messagerie, recherche mobile et déconnexion tablette corrigés.

## Fichiers et preuves
`installed-final.json` = 41 fichiers applicatifs touchés. `before/` et `before-manifest.json` = état de départ. `source-manifest.json` = 220 fichiers réellement compilés/publics. `staging/backend/.verification` est uniquement un overlay de test, à ne jamais copier dans le dépôt ni publier. L’installateur ignore les chemins cachés.

65 tests backend sous garde réseau/Prisma/SMTP, 7 groupes frontend admin, typechecks et builds Linux passés. 66 mesures de géométrie sur 320/375/768/1280 ; pages publiques, espace membre, fiches, formulaires et admin. Comptes fictifs RAM uniquement ; propriétaire protégé, attribution/retrait, refus modérateur/membre vérifiés. La capture `membres-et-roles.png` montre des données de test.

25 routes publiques et 66 assets vérifiés ; 39 bundles. Les deux PNG historiques recompressés par Hostinger ont une équivalence pixel exacte vérifiée. Home et inscription gardent leur contenu/signature sémantique. Contrôle navigateur live home1280/login375 et fond commun. Le service rôles compilé a été appelé sur la base réelle via proxy lecture seule ; aucun JWT de test créé.

## Limites
Pas de test sur téléphone physique/clavier virtuel/Safari. Pas d’attribution de rôle en production pour tester. Les fixtures HTTP locales n’implémentent pas Socket.IO ; les 404 socket attendus ne sont pas une preuve de panne en production. Aucune fonction laissée à moitié écrite. Serveurs locaux arrêtés et onglets temporaires fermés.

## Publication future
Inclure backend/src, prisma, assets/fonts et manifests ; frontend/src, public et configs. Exclure `.verification`, fixtures, output, node_modules locaux et .env. Scripts de ce dossier sont liés à CETTE version : ne pas les relancer tels quels. Garder le proxy Unix de QA seulement dans les processus candidats, jamais dans Passenger. Lire `verification.json` avant toute reprise.

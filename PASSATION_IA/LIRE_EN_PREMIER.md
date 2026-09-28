# Reprendre Mali Wuli

> **Dernier état — liens sociaux publiés :** frontend/backend `versions/20260928-liens-sociaux`, build `MF940TX4N8sLGFRsT_gyN`,15migrations. LinkedIn/Facebook/Instagram/TikTok facultatifs dans Informations et visibles/cliquables sur les profils.235sources/25routes/62ressources vérifiées. Guide05 et `output/2026-09-28-liens-sociaux/LIRE_REPRISE.md`. Les versions ci-dessous sont historiques. Pour publier, confirmer aussi le cwd des processus et les bundles servis : restart.txt seul n’a pas suffi sur ce lot.

> **Dernier état — accueil connecté actualisé :** frontend `versions/20260928-home-session-r2`, build `ZbOkxHyHSm-qkR0dR9Qeh`. Backend reste `versions/20260928-suppressions-droits`. Mon espace/Mon profil synchronisés après connexion et retour de page/onglet ; aucune migration ni écriture base. Guide05 et `output/2026-09-28-home-espace-connecte/LIRE_REPRISE.md`. Les versions frontend ci-dessous deviennent historiques.

> **Dernier état — suppressions et droits :** frontend/backend `versions/20260928-suppressions-droits`, build `cNI0N04igTlrU9KwyDz4k`. Suppressions auteurs/responsables et délégations par domaine ; sept rôles cumulables (Publications et Membres ajoutés). Comptes désactivables de façon réversible, propriétaire protégé. 14 migrations, aucune nouvelle migration. Voir guide05 et `output/2026-09-28-suppressions-droits/LIRE_REPRISE.md`. Les versions et le nombre de cinq rôles décrits ci-dessous sont historiques et remplacés par cet état.

> **Dernier état — priorité aux affiliations et session accueil :** frontend/backend `versions/20260928-priorite-membres-home`, build `dj5SeEGNIha9psRUR-GDY`. Tri par membres affiliés avant pagination ; accueil reconnaît la session et conserve les accès connectés. Aucune migration, 14 au total. Voir guide05 et `output/2026-09-28-priorite-membres-session-home/LIRE_REPRISE.md`.

> **Autorisation utilisateur du 28 septembre 2026 :** migrer et publier les lots terminés après vérifications, sans nouvelle demande de confirmation de routine. Cet accord persistant remplace l’attente d’accord par lot ; sauvegarde, contrôle de la base, revue des migrations et preuves restent requis. Voir la dernière entrée du journal et le guide 05.

> **Dernier état — rôles spécialisés cumulables :** frontend/backend `versions/20260928-roles-actions`, build `FuGDWQkQpcBCevVL404El`, 14 migrations. L’administrateur général attribue cinq rôles cumulables dans Administration → Membres et rôles. Cette décision remplace la limitation Membre/Modérateur global décrite dans les états historiques ci-dessous. Voir guide05 et `output/2026-09-28-roles-actions/LIRE_REPRISE.md`.

> **État courant après le lot rôles/mobile du 28 septembre :** frontend et backend `versions/20260928-fond-mobile-roles`, build `XKxGZymQs7bdnHFnsf0bl`. Fond beige commun, mobile corrigé, propriétaire seul ADMIN et Modérateur global attribuable dans Administration → Membres et rôles. Pas de migration supplémentaire (13 au total). Le relevé offres ci-dessous devient historique pour les versions. Voir guide05 et `output/2026-09-28-fond-mobile-roles/LIRE_REPRISE.md`.

> **Actualisation du 28 septembre 2026 :** offres d’emploi publiées : frontend et backend `versions/20260928-offres-emploi`, build `R-M49imb1rXepiN59auq5`. Migration `20260928200000_job_applications` appliquée (13 au total). Trois modes de candidature, PDF professionnel depuis contact@ et modération. Parcours récents en premier, événements/albums, annuaire/associations et recherche préservés. Voir journal, guide05 et `output/2026-09-28-offres-emploi/LIRE_REPRISE.md`. Les relevés plus anciens ci-dessous restent historiques.

Passation préparée le **26 septembre 2026**. Les fichiers locaux ont été relus à cette date. Les dernières vérifications de production conservées datent du **21 septembre 2026** ; aucun contrôle SSH ou du site en ligne n’a été effectué pour rédiger ce dossier.

## Protocole de reprise obligatoire — ajouté le 26 septembre 2026

**Lire d’abord [JOURNAL_REPRISE.md](JOURNAL_REPRISE.md) en entier**, puis le présent document et les guides utiles. Le journal contient aussi les observations plus récentes que les preuves historiques de cette passation.

Si son « Statut courant » indique EN COURS par un autre agent, arrêter et demander à l’utilisateur avant toute modification du code. Sinon, prendre le statut EN COURS avec son nom, la date/heure et le sujet, puis ajouter une entrée avec l’état Git initial. Actualiser cette entrée à chaque étape significative, puis la clôturer avec l’état Git final et remettre le statut LIBRE. Ne pas modifier les entrées d’autres agents.

La [consigne complète de traçabilité](PROMPT_CODEX_TRACES.txt) est obligatoire. Aucun push ni déploiement sans demande explicite ; aucun import, fusion, nettoyage ou smoke écrivant en base sans vérification des effets et de la base visée, puis accord de l’utilisateur. Les anciennes procédures techniques ne valent pas autorisation.

## Commencer ici

**Le code à reprendre n’est pas celui du dossier qui contient cette passation.**

| Dossier | Rôle constaté |
|---|---|
| `/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration` | Source utilisée pour les derniers correctifs et déploiements. Branche `ibrahima-catalogue-scolaire-partage`. |
| `/Users/ibrahimakonate/Documents/ChatGPT/Mali Wuli` | Ancienne copie sur `master`, artefacts de vérification et ce dossier de passation. Son ancien README décrit encore Next 14/PostgreSQL : ces indications ne décrivent pas la version déployée. |

La source active utilise **Next.js 15.5.24, React 18, Tailwind 3, Express 4, Prisma 5.21.1 et MySQL**, avec Node 22 et npm 10 minimum selon les manifests actuels.

Au relevé local : **66 entrées Git suivies modifiées/supprimées et 55 entrées non suivies** dans le dépôt actif. Certaines entrées non suivies sont des dossiers contenant plusieurs fichiers. Le dernier commit est `0d01264`, mais il ne contient pas tout le travail effectué. **Un clone ou un worktree basé uniquement sur ce commit perdrait des correctifs.** Ne pas nettoyer, réinitialiser, écraser ou enregistrer en bloc cet état sans examiner les fichiers.

## Ordre de lecture

1. [Démarrer et travailler](01_DEMARRER_ET_TRAVAILLER.md) : chemins, environnement, commandes, carte du code et méthode.
2. [Produit et interface](02_PRODUIT_ET_INTERFACE.md) : décisions finales du demandeur et fonctionnement du formulaire.
3. [Backend, données et catalogue](03_BACKEND_DONNEES_ET_CATALOGUE.md) : modèles, validations, audit et risques de fusion.
4. [Exploitation et déploiement](04_EXPLOITATION_DEPLOIEMENT.md) : Hostinger, compilation Linux, vérification et retour arrière.
5. [État et suite du travail](05_ETAT_ET_REPRISE.md) : ce qui a été livré, ce qui reste ouvert, preuves et limites.

Un [prompt prêt à transmettre](PROMPT_REPRISE.txt) permet d’orienter un nouvel agent vers ces documents.

## État à retenir avant toute modification

- Dernier frontend vérifié : `20260921-brevet-def-label`, build `YcLgbCm833jUBenTkA30s`.
- Dernier backend vérifié : `20260921-profile-schools-r2`.
- Le libellé **« L1 » s’affiche « Licence »**, sans « 1re année ».
- La modification globale en Source Sans 3 a été **annulée**. Les anciennes polices et styles de titres ont été rétablis.
- Le profil affiche **prénom et nom** : cette décision explicite a remplacé la demande antérieure « Votre profil ».
- École et lycée forment une seule fiche avec plusieurs diplômes, dont brevet/DEF et bac, et un programme scolaire indépendant du pays géographique.
- Les champs diplôme, mention et série proposent une liste **avec « Autre »**. Les anciennes datalists ont été retirées.
- Le statut individuel du diplôme apparaît seulement si la formation est **en cours**. Un menu n’offrant que « Obtenu » a été supprimé.
- Le bouton et le titre indiquent **« Brevet / DEF »**.
- Le badge « Proposition en validation » et son remplacement explicatif ont été **retirés de l’interface**. La logique interne du catalogue existe toujours.
- L’audit des doublons a été élargi à tout le catalogue actif, mais **le nettoyage global n’a pas été exécuté**. Ne pas annoncer que tous les doublons ont été supprimés.

## Sources de vérité et précautions de reprise

Les décisions finales ci-dessus priment sur les anciennes formulations dans les captures, comptes rendus ou archives. Pour le comportement actuel, relire le code actif. Pour la production actuelle, vérifier le lien `current`, l’identifiant du build et les réponses servies avant d’affirmer qu’ils correspondent encore aux relevés du 21 septembre.

Ce dossier contient des explications, des empreintes de fichiers et des copies de résultats de vérification. **Ce n’est pas une sauvegarde complète du code ni de la base.** Les archives de septembre conservées dans `output/` correspondent à plusieurs états successifs ; ne pas redéployer une ancienne archive seule.

Les mots de passe SSH, secrets JWT, accès MySQL et SMTP ne sont pas copiés ici. Utiliser les accès existants ou les demander au propriétaire au moment nécessaire. Ne pas afficher le contenu des fichiers `.env` dans les sorties d’outils.

Le périmètre d’écriture autorisé à la création de cette passation est le dossier `Mali Wuli`, alors que la source active est dans son dossier voisin. Un prochain agent doit vérifier ses propres permissions avant d’y écrire ou d’utiliser SSH ; ouvrir le bon projet ou obtenir l’autorisation adaptée si nécessaire.

## Premier contrôle local

Depuis le dossier qui contient cette passation :

```bash
python3 PASSATION_IA/verifier_sources.py
```

Ce contrôle lit les fichiers, compare leurs empreintes au relevé du 26 septembre et ne lance ni serveur, ni migration, ni appel réseau. Une différence signifie qu’il faut examiner l’évolution ; elle n’autorise pas à restaurer automatiquement l’ancienne version.

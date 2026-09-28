# Démarrer et travailler sur le projet

## 0. Ouvrir et tenir la session dans le journal

Lire intégralement [JOURNAL_REPRISE.md](JOURNAL_REPRISE.md) avant toute intervention. Respecter le statut d’un autre agent et le protocole détaillé dans [PROMPT_CODEX_TRACES.txt](PROMPT_CODEX_TRACES.txt). Une entrée doit décrire l’état Git initial, les fichiers touchés, les décisions, les vérifications, les actions externes et l’étape exacte où reprendre. La tenir à jour pendant le travail, pas seulement à la fin.

À la clôture, relever aussi l’état Git final, indiquer TERMINÉ ou INTERROMPU, une prochaine action et remettre le statut courant LIBRE. Conserver les anciennes entrées intactes ; ajouter une correction datée si nécessaire. Les sous-tâches déléguées d’une même session sont consignées dans l’entrée tenue par l’agent principal.

## 1. Identifier le bon dépôt et préserver l’existant

Source active constatée le 26 septembre :

```bash
cd '/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration'
pwd
git branch --show-current
git status --short
git log -5 --oneline
```

Branche relevée : `ibrahima-catalogue-scolaire-partage`. HEAD : `0d01264` (`feat: partager le catalogue entre écoles et lycées`). L’état non commité comprend notamment les fonctionnalités sociales, l’authentification, les migrations et les correctifs d’interface de cette conversation. Ce n’est pas un petit reliquat à supprimer.

Lire les éventuelles nouvelles instructions `AGENTS.md` du dépôt et de ses parents avant de travailler. Aucun fichier de ce nom n’a été trouvé dans les deux arbres de projet lors du relevé. Une instruction ajoutée après la passation doit être prise en compte.

Avant une modification, noter les fichiers déjà touchés et comparer uniquement le périmètre utile. Ne pas utiliser `git reset --hard`, `git clean`, une restauration globale, un stash global ou un remplacement du dossier par un clone. Si une isolation est nécessaire, inclure aussi les modifications non commitées et les fichiers non suivis pertinents, en conservant les secrets hors des copies partagées. Ne pas prendre un worktree issu seulement de HEAD pour la version complète.

Le fichier [état local](preuves/etat-local-2026-09-26.json) conserve les chemins, branche, commit et statut. Le fichier [empreintes](preuves/empreintes-source-2026-09-26.json) couvre le code source, les migrations, les fichiers de configuration et les manifests sélectionnés.

## 2. Comprendre la structure

| Partie | Point d’entrée ou dossier | Rôle |
|---|---|---|
| Frontend | `frontend/src/app/layout.tsx`, `globals.css`, `frontend/tailwind.config.ts` | Document, polices et styles communs. Le rendu dynamique du layout évite les anciennes références de chunks mises en cache. |
| Authentification | `frontend/src/app/(auth)/`, `frontend/src/components/auth/` | Connexion par code ou mot de passe, inscription, vérification, réinitialisation, questionnaire. |
| Espace membre | `frontend/src/app/(platform)/`, `frontend/src/components/MaliWuliHeader.tsx` | Navigation, profil et fonctionnalités du réseau. |
| Formations | `frontend/src/components/onboarding/StepFormations.tsx` | Recherche d’établissement, programme scolaire, diplômes, avis et insertion. |
| Logique de présentation | `frontend/src/lib/education/`, `frontend/src/lib/periode.ts` | Références, libellés, règles scolaires, suivi et tri chronologique. |
| Profil | `frontend/src/components/profile/ProfilMembre.tsx`, `frontend/src/types/profile.ts` | Affichage du nom, formations, expériences, photo et couverture. |
| API intermédiaire Next | `frontend/src/app/api/education/`, `frontend/src/app/api/locations/` | Recherche catalogue/références/villes ; certains replis locaux en cas de panne. |
| Client API / session | `frontend/src/lib/api.ts`, `frontend/src/hooks/`, `frontend/src/lib/media.ts` | URL backend, état d’authentification et médias. |
| Serveur | `backend/src/index.ts` | Express, CORS, healthcheck, uploads, montage des routes et Socket.IO. |
| Base | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Schéma MySQL et migrations versionnées. |
| Métier | `backend/src/routes/`, `backend/src/services/` | Auth, profils, onboarding et autres fonctionnalités. |
| Catalogue | `backend/src/education/`, `backend/src/scripts/import-*`, `reconcile-*` | Normalisation, recherche, suggestions, imports et fusions. |
| Temps réel | `backend/src/realtime/` | Échanges Socket.IO et contrôle de session. |

Les routes Express sont montées sous `/api/auth`, `/api/onboarding`, `/api/users`, `/api/synergies`, `/api/messages`, `/api/notifications`, `/api/publications`, `/api/cercles`, `/api/volontaires`, `/api/evenements`, `/api/offres`, `/api/education` et `/api/admin`. `/api/health` effectue une lecture SQL `SELECT 1`.

Le README du dépôt actif, `backend/SOCIAL_API.md` et `backend/COMMUNITY_API.md` donnent le contexte des autres modules. Leur présence ne prouve pas que toutes les fonctionnalités de la spécification initiale sont livrées : distinguer les routes réellement implémentées des ambitions de la spécification.

## 3. Préparer un environnement de développement

Prérequis déclarés : **Node >= 22**, **npm >= 10**, **MySQL 8**. Prisma utilise le provider `mysql`, pas PostgreSQL. Il n’existe pas de commande de test unique déclarée pour tout le dépôt.

```bash
node --version
npm --version
```

Les manifests et lockfiles existent dans `backend/` et `frontend/`. Sur un environnement à préparer, `npm ci` doit être exécuté dans chaque dossier nécessaire ; ne pas réinstaller sans raison une installation déjà utilisable. Ces commandes et les builds peuvent écrire des fichiers et nécessiter du réseau : vérifier les permissions de la session.

Créer les configurations locales à partir de `backend/.env.example` et `frontend/.env.local.example` **seulement si les fichiers locaux n’existent pas déjà**. Ne pas écraser les configurations existantes, ni copier les secrets de production par commodité.

Backend : les variables importantes sont `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `PORT`, `HOST`, `NODE_ENV`, `UPLOAD_DIR`, les variables SMTP et `MAIL_DISABLED`. Les exemples listent aussi les paramètres de limitation des tentatives d’authentification et OpenRouter. Frontend : `NEXT_PUBLIC_API_URL` et `NEXT_PUBLIC_SOCKET_URL`.

Pour tester les écritures, utiliser une base MySQL dédiée et clairement identifiée comme développement/QA. Vérifier la destination de `DATABASE_URL` sans afficher son mot de passe. Sur cette base dédiée, préparer le schéma avec `prisma migrate deploy`. Les seeds et imports écrivent des données et ne doivent être lancés qu’en cas de besoin sur la destination choisie.

Exemple cohérent de lancement local, **après** préparation d’une configuration backend pointant sur une base locale dédiée :

```bash
# Terminal backend, depuis backend/
NODE_ENV=development HOST=127.0.0.1 PORT=5000 \
FRONTEND_URL=http://localhost:3000 MAIL_DISABLED=true npm run dev

# Terminal frontend, depuis frontend/
NEXT_PUBLIC_API_URL=http://localhost:5000/api \
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000 \
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Les ports de cet exemple sont un choix local cohérent. Ne pas déduire le port réellement utilisé d’un ancien message ou d’une valeur de repli `8002`/`8004` dans le code. Toujours aligner le port backend, l’URL API et l’URL Socket.

## 4. Vérifier un changement à la bonne échelle

Depuis `frontend/` :

```bash
npm run type-check
../backend/node_modules/.bin/tsx --test src/lib/education/parcours-scolaire.test.ts
```

Depuis `backend/` :

```bash
./node_modules/.bin/tsx --test src/services/onboarding-school-records.test.ts
```

Les tests unitaires de normalisation et de rapprochement sont listés sous `backend/src/education/*.test.ts`. Choisir ceux qui concernent la modification. `npm run build` dans le backend génère le client Prisma puis compile TypeScript ; ce n’est pas une migration de base.

Le build frontend requiert une URL API explicite. Pour la production, utiliser les URL publiques définies dans le guide de déploiement. `ALLOW_LOCAL_PRODUCTION_BUILD=true` est réservé à un build local volontaire ; ne pas l’utiliser pour contourner le garde-fou sur Hostinger.

Les scripts `smoke-*` créent et nettoient des données dans la base configurée. `check-onboarding-canonical-security.ts` lit un catalogue réel et ne prévoit pas de mutation dans sa version relue. Le script externe `output/profile-schools-2026-09-21/smoke-profile-schools.cjs` possède aussi un mode explicitement autorisé permettant un compte QA sur une base distante. **Lire le script et ses paramètres avant de le lancer** ; les smokes ne sont pas des contrôles génériques sans effet. Voir le guide backend.

Pour un simple libellé, une compilation et la vérification du texte servi suffisent généralement. Pour un changement de saisie, vérifier les choix, le mode « Autre », la conservation des anciennes valeurs et le cycle de sauvegarde complet. Ne pas créer des tests qui reproduisent seulement la ligne modifiée.

## 5. Méthode attendue

1. Reformuler brièvement le résultat voulu en français et repérer les fichiers concernés avec `rg`.
2. Lire le comportement existant et les décisions finales avant de modifier. Les demandes successives ont parfois annulé une modification antérieure.
3. Préserver l’état de travail et les données existantes. Séparer correction d’affichage, changement métier et migration de données.
4. Réaliser le changement puis vérifier le parcours affecté. Déléguer les sous-tâches indépendantes sans faire éditer le même fichier en parallèle.
5. Si un déploiement est demandé, préparer une version compilée et vérifiée puis suivre la procédure Hostinger. Ne pas considérer une modification locale comme déjà en ligne.
6. Indiquer clairement ce qui est livré, ce qui est seulement analysé et les limites de vérification. Conserver un petit `verification.json` dans `output/<AAAA-MM-JJ>-<sujet>/`, citer le chemin dans le journal et noter la version, le build ID ainsi que les cibles `current` précédente et nouvelle en cas de déploiement.

Les commits éventuels sont ciblés, avec message explicite et hash inscrit au journal. **Aucun push ni déploiement sans demande explicite de l’utilisateur.** Aucun import, fusion, nettoyage ou smoke qui écrit en base sans avoir vérifié ses effets et la base visée, puis obtenu l’accord de l’utilisateur. Ne conserver aucun secret ni contenu de configuration privée dans le journal ou `output/`.

Le demandeur préfère des réponses françaises courtes, des actions concrètes et peu de demandes de confirmation répétées. Cela ne permet pas de supposer qu’une fusion ambiguë de données est correcte. Poser seulement les questions réellement nécessaires ; poursuivre les travaux indépendants autorisés.

Pour les vérifications visuelles, le navigateur intégré caché a été utilisé afin de ne pas interrompre le Chrome de l’utilisateur. Les comptes QA temporaires étaient isolés, en attente de validation, puis supprimés. Ne pas réutiliser un vrai profil pour tester des modifications. Les anciens comptes QA et les anciens onglets de cette conversation ont été nettoyés.

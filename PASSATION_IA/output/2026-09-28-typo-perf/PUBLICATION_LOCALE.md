# Publication locale — lots typographie profil + performance

Préparé le 28/09/2026 par Claude cloud (sans SSH ni base). À exécuter depuis le poste du propriétaire, **une seule publication à la fois**. Sources : guide 04 (§4 à §10), `output/2026-09-28-liens-sociaux/LIRE_REPRISE.md` et `DEPLOIEMENT_EFFECTIF.md`, contrôles de `verification.json` (même dossier). Ne pas rejouer les scripts figés des lots précédents (`activate*.sh`, `activate.cjs`, `release-contract.json`…) : ils visent d'autres versions.

## 0. Références contrôlées

| Élément | Valeur |
|---|---|
| Commit contrôlé de `main` | `9ad8df3b12f5cbc799ff3dafd34b797fa6f966d7` (les commits suivants ne touchent que `PASSATION_IA/`) |
| Arbre `frontend/` attendu | `564ace231998e15277fb7fa59c3bd222bcd5bc68` |
| Arbre `backend/` attendu | `db7ac8f5980841dcc7d8b589a00510f6935a120e` |
| Nouvelle version | `20260929-typo-perf` (frontend **et** backend) |
| Version publiée attendue | `versions/20260928-liens-sociaux` des deux côtés, build `MF940TX4N8sLGFRsT_gyN` |
| Migrations | 15, dernière `20260928220000_profile_social_links` ; **aucune nouvelle migration** dans ce lot |
| Écart publié → main | 12 fichiers modifiés + 4 sources et 7 WebP ajoutés, tous issus des deux lots (détail dans `verification.json`) |

Ordre imposé : **backend d'abord** (le frontend appelle `GET /api/users/me/session`), puis frontend.

## 1. Préalables locaux

```sh
git fetch origin main && git checkout main && git pull --ff-only origin main
SHA=9ad8df3b12f5cbc799ff3dafd34b797fa6f966d7
test "$(git rev-parse $SHA:frontend)" = 564ace231998e15277fb7fa59c3bd222bcd5bc68
test "$(git rev-parse $SHA:backend)"  = db7ac8f5980841dcc7d8b589a00510f6935a120e
test "$(git rev-parse HEAD:frontend)" = 564ace231998e15277fb7fa59c3bd222bcd5bc68   # sinon : du code a changé depuis ce contrôle → refaire l'étape a
git archive --format=tar.gz -o /tmp/typo-perf-frontend.tar.gz $SHA:frontend
git archive --format=tar.gz -o /tmp/typo-perf-backend.tar.gz  $SHA:backend
shasum -a 256 /tmp/typo-perf-*.tar.gz     # noter les empreintes dans le journal
```

`git archive` ne contient ni `.env`, ni `node_modules`, ni `.next`. Mettre le journal en EN COURS avant toute connexion.

## 2. Relevé en lecture seule (SSH `-p 65002`, authentification autorisée, aucun secret dans les traces)

```sh
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"; node --version; npm --version
MW_FRONT=/home/u668963025/domains/mali-wuli.com/hbuilds
MW_BACK=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds
readlink "$MW_FRONT/current"; readlink "$MW_BACK/current"
cat "$MW_FRONT/current/nodejs/.next/BUILD_ID"
test ! -e "$MW_FRONT/versions/20260929-typo-perf" && test ! -e "$MW_BACK/versions/20260929-typo-perf"
stat -c '%a %n' "$MW_FRONT/current/nodejs/.env" "$MW_BACK/current/nodejs/.env"
cd "$MW_BACK/current/nodejs" && npx --no-install prisma migrate status
node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.$queryRaw`SELECT VERSION() AS v`.then(r=>console.log(r[0].v)).finally(()=>p.$disconnect())'
```

**Arrêt si** : une cible `current` ≠ `versions/20260928-liens-sociaux`, BUILD_ID ≠ `MF940TX4N8sLGFRsT_gyN`, migration en attente ou échec, dossier de version déjà présent, ou version SQL < MySQL 8.0 / MariaDB 10.2 (la nouvelle facette villes utilise `ROW_NUMBER() OVER`). Consigner les valeurs relevées ; elles deviennent `MW_EXPECTED_CURRENT`.

## 3. Transfert

`scp -P 65002 /tmp/typo-perf-*.tar.gz u668963025@147.93.51.85:` vers `$MW_BACK/typo-perf-backend.tar.gz` et `$MW_FRONT/typo-perf-frontend.tar.gz`, puis `sha256sum` distant = empreintes locales.

## 4. Candidate backend (sans bascule)

```sh
set -eu; umask 077; export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
MW_NODEJS="$MW_BACK/versions/20260929-typo-perf/nodejs"
test ! -e "$MW_NODEJS"; mkdir -p "$MW_NODEJS"
tar -xzf "$MW_BACK/typo-perf-backend.tar.gz" -C "$MW_NODEJS"
install -m 600 "$MW_BACK/current/nodejs/.env" "$MW_NODEJS/.env"      # jamais affiché
MW_UPLOADS=/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/uploads
test -d "$MW_UPLOADS"; ln -s "$MW_UPLOADS" "$MW_NODEJS/uploads"       # uploads partagés conservés
cd "$MW_NODEJS"; npm ci --include=dev; npm run build; mkdir -p tmp
test -f dist/index.js; test -f dist/services/education-facettes.service.js
grep -q '/me/session' dist/routes/user.routes.js
npx --no-install prisma migrate status      # doit indiquer 15 migrations, schéma à jour
```

**Si une migration apparaît en attente** (non prévu) : arrêt, accord explicite du propriétaire, sauvegarde privée récente vérifiée (taille, gzip, SHA, guide 04 §8), puis `npx --no-install prisma migrate deploy` uniquement. Jamais `migrate dev`, `migrate reset`, `db push` ni `npm run prisma:migrate`.

## 5. Candidate frontend (sans bascule)

Suivre le guide 04 §5 avec `MW_RELEASE=20260929-typo-perf` : extraire `typo-perf-frontend.tar.gz` dans `$MW_FRONT/sources/20260929-typo-perf`, supprimer `tsconfig.tsbuildinfo`, puis `npm ci --include=dev`, `npm run type-check` et :

```sh
ALLOW_LOCAL_PRODUCTION_BUILD=false \
NEXT_PUBLIC_API_URL=https://floralwhite-ram-987223.hostingersite.com/api \
NEXT_PUBLIC_SOCKET_URL=https://floralwhite-ram-987223.hostingersite.com \
npm run build
```

Assemblage standalone + `.next/static` + `public` + `tmp/`, `.env` frontend copié par `install -m 600` sans affichage, noter le nouveau `BUILD_ID`. Vérifier la présence des 7 fichiers `public/images/optimized/*.webp`.

## 6. Vérifier les candidates avant activation

- Frontend : port 31543 libre, puis `node "$MW_FRONT/verify-login-fix.cjs" "$MW_FRONT/versions/20260929-typo-perf/nodejs"` (chemin absolu du dossier `nodejs`). Tout doit passer.
- Aucune URL `localhost` dans `.next/static` ; l'URL API publique est présente.
- Routes touchées présentes dans la candidate : `/profil`, `/dashboard`, `/annuaire`, `/education` (catalogue établissements), `(platform)/loading`.
- Backend : `dist/` complet (étape 4), `.env` en 600, lien `uploads` vers le dossier partagé, `migrate status` à jour.

## 7. Activation backend, puis frontend

Pour chaque racine (`$MW_BACK` puis `$MW_FRONT`), recette du guide 04 §7 : `MW_ACTIVATE=yes`, `MW_RELEASE=20260929-typo-perf`, `MW_EXPECTED_CURRENT=versions/20260928-liens-sociaux` **relu à l'instant** (pas recopié de ce document), `.previous-target` écrit, lien temporaire, second contrôle, `mv -Tf`, `touch current/nodejs/tmp/restart.txt`. Contrôler `dist/index.js` pour le backend, `server.js` + `BUILD_ID` pour le frontend.

Après chaque bascule, **vérifier le processus réellement exécuté** (restart.txt a été insuffisant le 28/09) :

```sh
for p in /proc/[0-9]*; do [ -O "$p" ] || continue; c=$(readlink "$p/cwd" 2>/dev/null) || continue
  case "$c" in /home/u668963025/domains/*/hbuilds/versions/*) echo "${p#/proc/} $c";; esac; done
```

Si un processus tourne encore dans `.../versions/20260928-liens-sociaux/nodejs` de l'application basculée : vérifier son `cwd` exact, `kill -TERM <ce PID seul>` (pas de pkill global, pas de PID historique), attendre la relance à la première requête, relister. Backend : `curl -s https://floralwhite-ram-987223.hostingersite.com/api/health` → `status OK`, `database OK` **avant** de basculer le frontend.

## 8. Contrôle public (sans vrai compte ni vrai e-mail)

- Build servi : le HTML de `https://mali-wuli.com/login` référence `/_next/static/<nouveau BUILD_ID>/`.
- `/login`, `/register`, accueil : 200 ; bundles avec l'URL API publique, sans localhost.
- Profil : titres de section en Playfair (24/30 px mobile, 30/36 px bureau), sans capitales forcées ; section associations sans panneau imbriqué.
- Navigation Dashboard → Profil → Annuaire → Profil : l'en-tête reste monté, une requête `/api/users/me/session` par navigation, profil affiché avant les suggestions.
- Établissements (`/education`) : barre de recherche ; filtre Ville désactivé tant qu'aucun pays n'est choisi.
- Mobile 390 px et 320 px : aucun débordement horizontal (`scrollWidth` = largeur).
- Les parcours connectés se testent sur fixtures RAM (`output/2026-09-28-performance/qa-fixtures.cjs`) ou avec une session déjà ouverte du propriétaire, sans créer de compte ni envoyer d'e-mail.

## 9. Retour arrière

- **Code** (frontend et/ou backend séparément) : guide 04 §10 avec `MW_FAILED_RELEASE=20260929-typo-perf` et `.previous-target` (= `versions/20260928-liens-sociaux`), puis même contrôle des processus (§7) et santé HTTP. Revenir d'abord au frontend précédent si seul l'affichage pose problème ; le backend précédent reste compatible (pas de migration).
- **Base** : aucune migration dans ce lot, donc rien à annuler. Jamais de restauration de base sans diagnostic et accord explicite du propriétaire.

## 10. Traces

Entrée de journal propre à la publication (cibles avant/après, BUILD_ID avant/après, PID relancés sans les réutiliser), preuves dans `PASSATION_IA/output/2026-09-29-typo-perf-publication/verification.json`, sans secret ni donnée réelle ; commit et push sur `Alienmap/mali-wuli` `main` uniquement.

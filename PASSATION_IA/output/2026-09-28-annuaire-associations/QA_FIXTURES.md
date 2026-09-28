# API fictive pour QA navigateur locale

Ce serveur simule les réponses nécessaires à la vérification visuelle de l'annuaire et des associations. Il n'importe ni Prisma ni le backend réel ; il ne lit aucun `.env`, n'utilise aucune base, ne contacte aucun service et n'envoie aucun e-mail. Personnes, associations, demandes et images sont fictives et stockées en mémoire. Ces essais d'interface sont distincts des tests des vrais handlers Prisma simulés.

## Lancement volontaire

Le serveur n'a pas été lancé lors de sa préparation. Depuis ce dossier :

```sh
node qa-fixtures.cjs
```

Écoute exclusivement sur `127.0.0.1:4307`, préfixe API `/api`. CORS autorise uniquement `http://localhost:3006` et `http://127.0.0.1:3006`. L'API renvoie `X-QA-Fixture: memory-only` et interdit le cache.

Le frontend local doit être lancé avec `NEXT_PUBLIC_API_URL=http://127.0.0.1:4307/api` et son propre port `3006`. Il faut utiliser ce frontend local, jamais le site de production. Toutes les données sont perdues à l'arrêt ; `POST /api/qa/reset` rétablit l'état initial et invalide les sessions QA. `GET /api/qa/state` permet d'inspecter associations, affiliations et propositions fictives.

## Comptes publics de démonstration

Dans le formulaire de connexion, choisir **Utiliser mon mot de passe**. Mot de passe commun : **`qa-test`**. Ce sont des données de fixture publiques, pas des identifiants réels.

| E-mail fictif | Profil | Accès |
|---|---|---|
| `admin@example.test` | Amadou Tounkara (`qa-admin`) | Administrateur, responsable de Talents Mali Diaspora |
| `membre@example.test` | Awa Diarra (`qa-membre`) | Membre validé, aucune affiliation publique initialement |
| `manager@example.test` | Mariam Traoré (`qa-manager`) | Responsable des Jeunes Bâtisseurs et Santé et Solidarité |
| `inscription@example.test` | Nadia Test (`qa-inscription`) | Inscription incomplète, compte en attente ; accès au parcours et à ses demandes |

Huit profils validés couvrent Mali, France, Sénégal et Canada ; le compte technique d'inscription constitue un neuvième profil, invisible dans l'annuaire. L'annuaire exclut le profil connecté, conformément au backend. Les autres adresses fictives sont `samba`, `fatou`, `oumar`, `aminata`, `cheick` suivies de `@example.test` (même mot de passe).

## Scénarios prêts

1. Se connecter comme membre, ouvrir `/annuaire?type=associations`, puis **Les Jeunes Bâtisseurs** (`qa-asso-bamako`). Faire une demande : elle reste en attente, sans afficher l'association sur son profil public.
2. Se connecter comme responsable dans un autre profil de navigateur (les comptes partagent le même état serveur ; le stockage du navigateur est distinct), ouvrir `/associations/qa-asso-bamako`, valider Awa Diarra. Après actualisation, l'association apparaît sur `/membres/qa-membre` et dans ses affiliations personnelles.
3. **Santé et Solidarité** (`qa-asso-dakar`) contient un refus initial pour le membre ; redemander ramène le statut à `EN_ATTENTE`. **Talents Mali Diaspora** (`qa-asso-paris`) contient une demande de Fatou déjà en attente pour l'administrateur.
4. Comme membre, proposer une association absente. Comme administrateur, ouvrir `/admin/associations`, reprendre la proposition, renseigner description/pays/ville/vocation/responsable, créer la fiche puis marquer la proposition traitée. La création de fiche et le traitement de proposition restent deux opérations.
5. Comme responsable, charger une photo JPEG/PNG/WebP et une couverture. Les images restent en RAM et sont servies sous `/uploads/qa/…`, puis disparaissent au reset ou à l'arrêt.
6. Comme compte inscription, ouvrir `/onboarding?etape=associations`. La recherche et sa demande fonctionnent ; l'accès au roster ou à la validation d'autrui reste refusé. Ce compte ne peut pas être vérifié comme membre d'association tant que son compte n'est pas validé.

## Routes simulées

- Authentification : `POST /api/auth/login`, `POST /api/auth/logout`. Tokens opaques QA propres au processus, sans rapport avec les JWT réels. OTP renvoie explicitement 501, sans envoi.
- Session/profil : `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/users`, `GET /api/users/:id`. Filtres pays, ville, situation, volontaire, aide, établissement et promotion ; facettes et pagination. Les profils publics masquent e-mail/téléphone selon leurs préférences et ne montrent que les affiliations vérifiées actives.
- Parcours : `GET` et `POST /api/onboarding`, snapshot fictif indépendant des affiliations. Le POST ne reproduit pas toute la validation des études du vrai backend.
- Associations : liste, fiche, `/mes`, `/mes-affiliations`, `/responsables`, `/suggestions`, traitement des propositions, création et modification administratives ; affiliation personnelle POST/DELETE ; attentes et décisions des responsables/admin ; membres vérifiés ; uploads et suppression photo/couverture. Contrats décrits dans [CONTRAT_API.md](CONTRAT_API.md).
- Inscription : `/api/onboarding/associations` avec uniquement recherche, `/mes`, suggestions et demande/annulation personnelle. Pas de gestion d'autrui.
- En-tête : notifications vides via `GET /api/notifications` et `/non-lues`, conversations via `/api/messages/conversations`.
- Messagerie : recherche de membres, création de conversation, détail et envoi de messages en mémoire. Aucun envoi extérieur.
- Dashboard : publications et événements vides ; suggestions de synergies vides ; demande de synergie fictive persistée en mémoire.
- Administration d'accueil : statistiques et liste de comptes fictifs.
- Diagnostic : `GET /api/health`, `GET /api/qa/state`, `POST /api/qa/reset`.

Les routes inconnues renvoient 404 et sont journalisées `[QA 404]` : aucun succès silencieux. Le temps réel Socket.IO n'est pas simulé ; ses tentatives renvoient 404 et peuvent apparaître dans la console. Utiliser les actions de rechargement de l'interface après un changement effectué dans un autre navigateur. Les routes Next locales de pays/villes restent celles du frontend ; ce serveur ne télécharge aucun catalogue.

## Vérifications déjà effectuées, sans ouvrir de port

- `node --check qa-fixtures.cjs` : syntaxe valide.
- Appels directs au dispatcher en mémoire : connexion des trois rôles, demande → attente → validation responsable → profil public, auto-validation refusée, proposition puis création administrateur, restriction du compte en attente, route inconnue 404, reset à trois associations.

Ces vérifications confirment le fonctionnement de la fixture. Elles ne valident ni MySQL, ni la migration, ni les uploads du serveur réel, ni Socket.IO.

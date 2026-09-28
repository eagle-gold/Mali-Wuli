# Associations — contrat API, 28 septembre 2026

Toutes les routes exigent la session membre existante. Les listes et fiches courantes sont réservées aux comptes validés ; le routeur distinct `/api/onboarding/associations` permet uniquement recherche et gestion de sa propre demande pendant l'inscription. Le snapshot d'onboarding reste indépendant.

## Objet association

`id, nom, description: string|null, pays, ville: string|null, vocation: string|null, site: string|null, emailContact: string|null, photo: string|null, photoCouverture: string|null, dateCreation: ISO|null, createdAt: ISO, valide: boolean, responsable: {id (Profil.id), userId, prenom, nom, photo}|null, nbMembres: number, monAffiliation: {statut, rejointLe: ISO|null}|null, peutGerer: boolean`.

`nbMembres` et les listes publiques comptent uniquement les affiliations `VERIFIE` de profils validés ayant terminé l'onboarding. `dateCreation` est la date de fondation déclarée, distincte de `createdAt`. `responsableId` désigne un profil validé ayant terminé l'onboarding. Aucun e-mail privé de membre n'est exposé ; `emailContact` est le contact public de l'association.

## Consultation

- `GET /api/associations?q=&pays=&ville=&vocation=&page=1&limite=20` → `{associations, total, totalGlobal, page, totalPages, facettes: {pays, villes, vocations}}` ; associations actives (`valide=true`). `limite` maximum 50. Facettes des associations actives ; villes limitées au pays sélectionné, pays/vocations globaux.
- `GET /api/associations/:id` → `{association, membres, totalMembres, page:1, totalPagesMembres}` ; premiers 20 membres vérifiés.
- `GET /api/associations/:id/membres?page=1&limite=20` → `{membres, total, page, totalPages}`. Membre : `{id (Profil.id), userId, prenom, nom, photo, titre, ville, pays, rejointLe}`.
- `GET /api/associations/mes` → `{associations}` ; associations dont le membre est responsable, toutes pour l'administrateur.
- `GET /api/associations/mes-affiliations` → `{associations}` ; toutes ses affiliations (statut dans `monAffiliation`, y compris attentes/refus).

## Affiliation et gestion

- `POST /api/associations/:id/affiliation`, corps vide → `{monAffiliation}`. Crée `EN_ATTENTE`. Idempotent pour `EN_ATTENTE` et `VERIFIE` ; une ancienne affiliation `REFUSE` ou `DECLARE` devient `EN_ATTENTE`.
- `DELETE /api/associations/:id/affiliation` → `{message}` ; annule/quitte sa propre affiliation, idempotent.
- `GET /api/associations/:id/affiliations?page=1&limite=20` → `{affiliations, total, page, totalPages}` ; attentes réservées au responsable de cette association ou administrateur. Affiliation : `{profil: {id,userId,prenom,nom,photo,titre,ville,pays}, statut, rejointLe}`.
- `PATCH /api/associations/:id/affiliations/:profilId` corps `{decision:"VERIFIE"|"REFUSE"}` → `{monAffiliation}` ; responsable concerné ou administrateur. Responsable ne peut approuver sa propre affiliation. Pour approuver, profil cible validé et onboarding terminé. Seules les demandes en attente peuvent être décidées (une répétition de même décision est idempotente).
- `POST /api/associations` et `PATCH /api/associations/:id` : administrateur seulement. Corps `{nom,description?,pays,ville?,vocation?,site?,emailContact?,dateCreation?,responsableId?,valide?}` ; réponse `{association}`. Création exige nom, description non vide, pays, ville, vocation et responsableId valide ; modification partielle non vide. `dateCreation` accepte `YYYY-MM-DD` ou ISO ; liens web HTTP(S) seulement.
- `GET /api/associations/responsables?q=` → `{responsables: [{id,userId,prenom,nom,photo,titre,ville,pays}]}` ; administrateur, recherche limitée aux profils validés, onboarding terminé (20 résultats).
- `POST /api/associations/:id/photo` (`multipart photo`, JPEG/PNG/WebP ≤5 Mo) et `POST /:id/couverture` (`multipart couverture`, ≤10 Mo) → `{association}` ; administrateur ou responsable concerné, signature réelle du fichier contrôlée.
- `DELETE /api/associations/:id/photo` ou `/:id/couverture` → `{association}` ; mêmes droits.

## Proposition d'association

- `POST /api/associations/suggestions` corps `{nom,pays,ville?,vocation?,message?}` → `{suggestion:{id,statut,createdAt}}` ; demande interne, aucun e-mail/notification envoyé.
- `GET /api/associations/suggestions?page=1&limite=20&statut=EN_ATTENTE` → `{suggestions,total,page,totalPages}` ; administrateur. Les suggestions comprennent les champs soumis et `proposeur:{id,userId,prenom,nom}`.
- `PATCH /api/associations/suggestions/:id` corps `{statut:"TRAITEE"|"REFUSEE"}` → `{suggestion}` ; administrateur. Traiter une proposition ne crée pas automatiquement l'association.

## Inscription (même comportement, accès EN_ATTENTE autorisé)

- `GET /api/onboarding/associations` : même liste filtrable que la consultation, sans roster.
- `GET /api/onboarding/associations/mes` : mêmes affiliations personnelles.
- `POST` / `DELETE /api/onboarding/associations/:id/affiliation` : mêmes demandes personnelles.
- `POST /api/onboarding/associations/suggestions` : même proposition interne.

Aucune route d'administration, de validation d'autrui, de roster ou d'upload n'est montée sous `/api/onboarding/associations`. Une absence de profil donne 404 ; non-authentifié 401 ; droits insuffisants 403 ; donnée invalide 400 ; transition impossible 409. `DECLARE` reste lisible pour les données historiques mais aucune nouvelle demande ne le produit.

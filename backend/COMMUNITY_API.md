# API communauté Mali Wuli

Préfixe : `/api`. Toutes les routes ci-dessous exigent
`Authorization: Bearer <jwt>`. Les dates envoyées et reçues sont des chaînes
ISO 8601 en UTC. Une erreur suit toujours la forme `{ "message": "..." }`.

Les listes acceptent `page` (défaut `1`) et `limite` (défaut `20`, maximum
`50`) et renvoient :

```json
{
  "items": [],
  "meta": { "page": 1, "limite": 20, "total": 0, "totalPages": 0 }
}
```

Le nom de `items` est remplacé par la ressource (`cercles`, `evenements`,
`offres`, `volontaires` ou `rendezVous`). Les mutations concurrentes qui ne
peuvent pas être appliquées renvoient `409`.

## Cercles

### `GET /cercles`

Filtres : `q`, `theme`, `membre=tous|mes-cercles`, `page`, `limite`.

```json
{
  "cercles": [{
    "id": "...",
    "nom": "Numérique & IA",
    "theme": "Numérique",
    "description": "...",
    "presidentId": "profil-id",
    "president": { "id": "...", "nomComplet": "...", "photo": null },
    "nbMembres": 31,
    "statutMembre": "PRESIDENT|ACCEPTE|EN_ATTENTE|REFUSE|null",
    "actif": true
  }],
  "meta": {}
}
```

- `GET /cercles/:id` → `{ cercle }` avec `documents` et `reunions`.
- `GET /cercles/:id/membres` → `{ membres, meta }`. Le public connecté voit
  les membres acceptés. Le président et la modération peuvent ajouter
  `statut=EN_ATTENTE|ACCEPTE|REFUSE`.
- `POST /cercles/:id/adherer` avec `{ "motivation": "..." }` → adhésion
  immédiate et idempotente.
- `DELETE /cercles/:id/adherer` → quitter/annuler son adhésion. Le président
  ne peut pas quitter son propre cercle.
- `POST /cercles` : création réservée à `ADMIN`/`MODERATEUR`, corps
  `{ nom, theme, description?, presidentId? }`.
- `PATCH /cercles/:id` : modification `{ nom?, theme?, description? }` par le
  président ou la modération.
- `DELETE /cercles/:id` : désactivation réversible en base par le président ou
  la modération (aucune donnée membre n'est supprimée).

## Événements

### `GET /evenements`

Filtres : `q`, `type=EN_LIGNE|PRESENTIEL|HYBRIDE`,
`periode=a_venir|passes|tous`, `participation=mes-evenements` (événements
organisés ou rejoints par le membre), `page`, `limite`.

Réponse `{ evenements, meta }`. Chaque élément contient `nbParticipants`,
`estInscrit`, `estProprietaire` et `organisateur`. Les membres voient les
événements validés ainsi que leurs propres propositions en attente.

- `GET /evenements/:id` → `{ evenement }`.
- `POST /evenements` :

```json
{
  "titre": "Atelier orientation",
  "description": "Description détaillée",
  "type": "PRESENTIEL",
  "lieu": "Bamako",
  "lienVideo": null,
  "dateDebut": "2026-10-20T18:00:00.000Z",
  "dateFin": "2026-10-20T20:00:00.000Z",
  "capacite": 40
}
```

Une proposition d'un membre attend la validation. Une proposition de la
modération est publiée immédiatement.

- `POST /evenements/:id/participer` → inscription atomique avec contrôle de
  capacité.
- `DELETE /evenements/:id/participer` → annuler sa participation.
- `PATCH /evenements/:id` : modification partielle par l'organisateur ou la
  modération. Une modification par l'organisateur renvoie la proposition en
  validation et notifie les inscrits.
- `DELETE /evenements/:id` : annulation par l'organisateur ou la modération ;
  les inscrits sont notifiés avant la suppression.
- `PATCH /evenements/:id/validation` avec `{ "valide": true }` : réservé aux
  rôles `ADMIN` et `MODERATEUR`.

## Offres

### `GET /offres`

Filtres : `q`, `type=CDI|CDD|STAGE|ALTERNANCE|FREELANCE`, `secteur`, `pays`,
`ville`, `teletravail=true|false`, `vue=actives|toutes|mes-offres`, `page`,
`limite`. Réponse `{ offres, meta }`. Chaque offre contient `publieur`,
`estProprietaire` et `estExpiree`.

- `GET /offres/:id` → `{ offre }`.
- `POST /offres` :

```json
{
  "titre": "Data analyst",
  "entreprise": "Nyeta Pay",
  "type": "CDI",
  "secteur": "Numérique",
  "pays": "Mali",
  "ville": "Bamako",
  "teletravail": true,
  "description": "Description détaillée du poste",
  "lienCandidature": "https://example.org/jobs/1",
  "emailContact": null,
  "dateExpiration": "2026-12-01T23:59:59.000Z"
}
```

Un lien de candidature ou un e-mail de contact est obligatoire.

- `PATCH /offres/:id` : champs partiels, propriétaire ou modération. Une
  modification par le propriétaire renvoie l'offre en validation.
- `DELETE /offres/:id` : propriétaire ou modération.
- `PATCH /offres/:id/validation` avec `{ "valide": true }` : `ADMIN` ou
  `MODERATEUR`.

## Volontaires et rendez-vous

### `GET /volontaires`

Filtres : `q`, `sujet`, `format`, `pays`, `ville`, `page`, `limite`. Le profil
connecté est exclu de la liste pour empêcher une auto-réservation. Réponse :

```json
{
  "volontaires": [{
    "id": "...",
    "profilId": "...",
    "specialite": "Orientation post-bac, Premier emploi",
    "sujets": ["Orientation post-bac", "Premier emploi"],
    "precisionsSujets": {},
    "disponible": true,
    "fuseau": "Africa/Bamako",
    "dureeCreneau": 30,
    "format": "Visio",
    "dateDebut": null,
    "dateFin": null,
    "maxRdvMois": 4,
    "delaiMinResa": 24,
    "profil": { "id": "...", "nomComplet": "...", "photo": null }
  }],
  "meta": {}
}
```

- `GET /volontaires/:id` → `{ volontaire }`.
- `GET /volontaires/:id/creneaux?jours=30` →
  `{ creneaux: [{ debut, fin }], fuseau, dureeCreneau }`. Le calcul respecte
  les disponibilités hebdomadaires, le fuseau, les changements d'heure, le
  délai minimal, les bornes de dates, les rendez-vous déjà pris et le quota
  mensuel.
- `POST /volontaires/:id/reserver` avec
  `{ "debut": "<ISO affiché par /creneaux>", "motif": "..." }`.
  L'écriture est transactionnelle et protégée contre une double réservation.

### Agenda

- `GET /volontaires/agenda/me` avec `role=tous|demandeur|volontaire`,
  `periode=a_venir|passes|tous`, `page`, `limite` → `{ rendezVous, meta }`.
- `DELETE /volontaires/agenda/:rendezVousId` → annulation par l'un des deux
  participants.
- `PATCH /volontaires/agenda/:rendezVousId/statut` avec
  `{ "statut": "ACCEPTE|REFUSE" }` → réponse du mentor.

Chaque rendez-vous renvoyé contient `role=MENTOR|DEMANDEUR`, `peutAnnuler`,
`peutRepondre`, le volontaire avec son profil et le profil du demandeur.

## Temps réel et notifications

Les actions importantes créent une notification persistante et déclenchent
les événements Socket.IO ciblés suivants dans la room privée de l'utilisateur :

- `cercle_modifie` avec `{ cercleId }` ;
- `evenement_modifie` avec `{ evenementId }` ;
- `offre_modifiee` / `offre_supprimee` avec `{ offreId }` ;
- `rendez_vous_modifie` avec `{ rendezVousId }` ;
- `nouvelle_notification` avec la notification complète.

Le socket doit être ouvert avec le JWT dans `handshake.auth.token`. Les sockets
accélèrent l'interface ; après une reconnexion, le client recharge toujours
l'API HTTP, qui reste la source de vérité.

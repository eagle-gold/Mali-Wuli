# Formulaires structurés — offres et événements

## Résultat préparé

- Les formulaires d’offre et d’événement partagent `LocalisationSelects`.
- Le pays est choisi dans le catalogue ISO en français.
- La ville est chargée après le pays et choisie dans le catalogue ; aucune nouvelle valeur libre ne peut être envoyée.
- Une valeur historique inconnue reste affichée et conservée lors d’une édition.
- Le salaire comporte un minimum numérique, un maximum facultatif, une devise et une période.
- Le backend reçoit une chaîne canonique comme `400 000 à 550 000 XOF par mois`, compatible avec le champ `Offre.salaire` existant.
- Une ancienne valeur libre reste intacte tant qu’elle n’est pas explicitement remplacée ou effacée.
- Les grilles passent sur une colonne à 560 px ; le salaire passe de quatre à deux puis une colonne.

## Contrat et migration

La migration de base n’est pas indispensable pour ce besoin d’interface. `Offre.salaire` accepte déjà une chaîne de 190 caractères et tous les écrans lisent cette valeur. Conserver ce contrat évite de casser les offres existantes et évite un backfill incertain des anciens textes libres.

Une migration additive (`salaireMinimum`, `salaireMaximum`, `salaireDevise`, `salairePeriode`) deviendra utile seulement si le produit doit filtrer, trier ou agréger les offres par salaire. À ce moment-là, il faudra garder `salaire` pendant une période de transition et backfiller uniquement les valeurs canoniques reconnues.

## Fichiers

- `staging/frontend/src/components/forms/LocalisationSelects.tsx` (nouveau)
- `staging/frontend/src/components/offres/FormulaireOffre.tsx`
- `staging/frontend/src/components/offres/OffresEdition.module.css`
- `staging/frontend/src/components/evenements/FormulaireEvenement.tsx`
- `staging/frontend/src/components/evenements/FormulaireEvenement.module.css`
- `staging/frontend/src/app/api/locations/cities/route.ts`
- `staging/frontend/src/lib/offres.ts`

## Vérifications effectuées

- TypeScript frontend : réussi.
- Build Next.js de production : réussi avec les URL publiques de production.
- Tests de sérialisation/compatibilité salaire : 5 réussis.
- Vérification statique des deux localisations, des champs salaire et des règles mobile : 7 réussies.
- Première tentative de build bloquée uniquement par le réseau isolé vers Google Fonts ; le même build a réussi avec l’accès réseau autorisé.

## Installation sûre

Depuis ce dossier :

```bash
node install-staging.cjs
```

Le script vérifie les empreintes des six fichiers existants et exige que le nouveau composant soit absent. Il s’arrête sans écrire si le dépôt a changé, afin d’éviter d’écraser le travail d’un autre agent.

Après installation, relancer :

```bash
cd frontend
npm run type-check
NEXT_PUBLIC_API_URL=https://floralwhite-ram-987223.hostingersite.com/api \
NEXT_PUBLIC_SOCKET_URL=https://floralwhite-ram-987223.hostingersite.com \
npm run build
```

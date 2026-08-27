# Catalogue éducatif Mali Wuli

Le catalogue sépare les données de référence des formations déclarées par les membres.

## Relations principales

- `PaysEducation` possède des établissements, des diplômes et des séries nationales.
- `Etablissement` possède un ou plusieurs niveaux et des références vers ses sources.
- `ProgrammeEducation` est un arbre : formation → filière → spécialité/parcours.
- `EtablissementProgramme` relie un établissement, une formation et, quand il est connu, le diplôme délivré.
- `Formation` (parcours saisi par un membre) peut référencer l'établissement, le programme, le parcours et le diplôme du catalogue.
- Chaque import conserve la source, son identifiant externe, l'URL consultée et un indice de confiance.

Une offre établissement–formation n'est créée que lorsqu'une source permet de l'attester. Les domaines génériques ne sont donc pas attribués artificiellement à toutes les universités.

## Import

```bash
DATABASE_URL='postgresql://…' npm run education:seed
DATABASE_URL='postgresql://…' npm run education:seed:all
DATABASE_URL='postgresql://…' npm run education:import:france-programmes -- --institution=fr-universite-paris-cite
DATABASE_URL='postgresql://…' npm run education:import:france-universites
```

Le second script ajoute le catalogue mondial Hipo. Les imports sont idempotents et fusionnent les lignes à partir de l'identifiant externe, puis du nom et de la ville normalisés.

L'import des programmes français charge Mon Master et Parcoursup en dehors du parcours utilisateur, relie les formations à l'établissement par son UAI officiel, fusionne les codes techniques qui désignent le même intitulé et conserve la provenance. La commande `education:import:france-universites` traite en une fois tous les établissements présents dans Mon Master et ajoute également leurs formations Parcoursup. La recherche côté interface lit ensuite uniquement PostgreSQL.

Les recherches d'écoles et de lycées peuvent compléter la base à la demande depuis Wikidata (CC0). Une ligne ainsi découverte est persistée avec son identifiant Wikidata.

## Propositions des membres et unicité

Les champs « Autre » créent une `SuggestionCatalogue`, jamais une ligne publique directement.

- une contribution est unique par suggestion et par compte (identifiant haché) ;
- les libellés sont normalisés puis comparés par trigrammes ;
- OpenRouter n'intervient que sur les correspondances ambiguës et ne reçoit aucune donnée personnelle ;
- à partir de deux comptes distincts, une `NotificationAdmin` est créée ;
- l'admin peut fusionner avec une référence existante, accepter comme nouvelle donnée ou refuser ;
- après acceptation, la référence canonique est immédiatement disponible dans les recherches publiques.

Configuration serveur facultative pour la levée d'ambiguïté :

```bash
OPENROUTER_API_KEY='…'
OPENROUTER_MODEL='openai/gpt-4o-mini'
```

Sans clé ou si OpenRouter est indisponible, le traitement déterministe et la validation humaine continuent de fonctionner.

## Règles appliquées aux sources

- `IMPORT_OUVERT` : import autorisé par une licence ouverte.
- `API_OFFICIELLE` : interrogation d'une API institutionnelle.
- `REFERENCEMENT` : utilisation ciblée et sourcée, sans copie massive.
- `VALIDATION_SEULE` : vérification manuelle ; aucune aspiration globale.

Les sources proposées pour le Mali (Le Grand Frère, Fabert, Écoles Mali, WHED et IPEF Dakar) sont enregistrées dans `SourceEducative`. WHED et Écoles Mali interdisant la reproduction substantielle sans autorisation, ils sont utilisés uniquement pour valider et tracer des fiches individuelles.

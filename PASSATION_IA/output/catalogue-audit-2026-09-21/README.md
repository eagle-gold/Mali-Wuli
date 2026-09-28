# Audit des doublons du catalogue — 21 septembre 2026

Le contrôle a été élargi à **141 941 fiches actives**, réparties sur **200 pays et territoires**. Il dépasse les exemples Angelots, Lutins et Liberté déjà corrigés. La base a été exportée en lecture seule ; aucune nouvelle fusion n’a été exécutée pendant cet audit.

## Ce que le contrôle a trouvé

| Périmètre | Fiches analysées | Résultat prioritaire |
|---|---:|---|
| Mali | 20 270 | 31 paires à forte concordance, soit 62 fiches ; 22 de ces paires ne figuraient pas dans le précédent rapprochement des registres |
| Hors Mali | 121 671 | 1 doublon à indices très concordants, 5 autres candidats très forts, 2 anomalies de rattachement de sources et 297 paires ambiguës |
| Suggestions de secours du site | 21 | 11 identifiants obsolètes : 10 remplacés par leur référence active et 1 référence ambiguë retirée du secours |

Exemples non signalés au Mali : **Oumou Sidibé, Aminata Haïdara, Moustaph, Oumoutah et Sogoba**, à Bamako. Les noms, communes, statuts et coordonnées concordent entre OSM et le registre scolaire de 2013. Ce sont des doublons probables à examiner ; deux sources peuvent avoir repris les mêmes données initiales.

Hors Mali, **Lycée Louis-le-Grand** apparaît sous une fiche UAI et une fiche ROR, avec le même nom, la même ville et le même site institutionnel. La fiche ROR est classée université. Des fiches canadiennes proches sont aussi à vérifier, en conservant la distinction entre cycles et campus.

Le contrôle révèle également des rapprochements antérieurs trop larges : plusieurs identifiants officiels d’établissements différents peuvent être rattachés à une seule fiche. Les collisions de code ou de sigle ne doivent donc pas déclencher de fusion automatique.

## Correction des suggestions

Le site mélangeait les résultats du serveur avec une petite liste embarquée, dont certains identifiants n’existaient plus dans le catalogue actif. La correction conserve désormais exactement la réponse du serveur, même vide. La liste embarquée intervient uniquement en cas d’indisponibilité ; ses 20 références restantes ont été alignées sur le catalogue actif. Les homonymes ayant des identifiants distincts restent visibles.

Cathédrale a été retirée uniquement de la liste de secours : deux candidats existent dans la base et restent accessibles par la recherche normale. Ce retrait ne supprime aucune fiche du catalogue.

La correction est en ligne dans la version `20260921-canonical-suggestions`. La compilation Linux, TypeScript, les scénarios de secours et six recherches publiques comparées au backend ont réussi.

## Méthode et limites

Comparaison des noms, alias, pays, villes, identifiants officiels, sources et sites ; contrôle des coordonnées et des subdivisions administratives lorsque disponibles. Au Mali, génération supplémentaire de variantes de noms et de campus. Les noms limités à une localité, les branches différentes, les statuts contradictoires et les campus sont traités avec prudence.

Le balayage automatisé porte sur toutes les fiches, mais ne constitue pas une vérification manuelle de chaque établissement ni une garantie d’absence de doublon. Les noms entièrement différents sans identifiant commun peuvent échapper au rapprochement. Les nombres de paires ne représentent pas des fiches à supprimer et les catégories de signaux peuvent se recouper.

## Fichiers de travail

- `audit-perimetre.json` : périmètre et empreinte de l’export.
- `audite-ml-synthese-verifiee.json` et `audite-ml-paires-forte-concordance.json` : résultats Mali.
- `audit-global-summary.json` et `audit-global-priority.json` : résultats hors Mali.
- `audit-global-identity-anomalies.json` : rattachements ROR incorrects et preuves conservées.
- `frontend-fallback-audit.json` : état initial des 21 références locales.
- `verification.json` : correction, déploiement et vérifications réussies.

**État des données : audit effectué ; nettoyage global de la base non appliqué.** Les prochains rapprochements doivent préserver formations, avis, programmes, brouillons et références avant toute fusion.

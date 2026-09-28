Audit en lecture seule du catalogue Mali : 20270 fiches dans l’export de 141 941 établissements. Aucune modification en base.

Résultat : 31 paires à forte concordance, soit 31 groupes de deux et 62 fiches. Parmi elles, 22 paires ne figurent pas dans les 103 plans du rapprochement existant ; 9 y figurent déjà.

Il s’agit de doublons probables à examiner, pas de doublons certifiés. Le classement combine un nom cohérent distinct de la ville/localité renseignée, des provenances disjointes et une distance maximale de 40 m, sans contradiction connue. Des sources différentes peuvent réutiliser les mêmes coordonnées. Les noms réduits à la localité — notamment BADOGO — restent ambigus même à coordonnées identiques.

Le balayage large a produit 19419 paires candidates : 2398 paires ambiguës impliquant 4006 fiches, et 16990 paires exclues d’une fusion automatique. Ces chiffres ne sont pas des nombres de fiches à supprimer. Les catégories et les fiches se recoupent.

Exemples nouveaux :

| Variante 1 | Variante 2 | Ville | Distance | Provenances |
|---|---|---|---:|---|
| GROUPE SCOLAIRE École privée AMINATA HAIDARA | GROUPE SCOLAIRE PRIVE AMINATA HAIDARA | Bamako | 0 m | HOTOSM / UNICEF-MEN 2013 |
| École privée MOUSTAPH | PRIVEE MOUSTAPH | Bamako | 0 m | HOTOSM / UNICEF-MEN 2013 |
| École privée OUMOU SIDIBE | PRIVE OUMOU SIDIBE | Bamako | 0 m | HOTOSM / UNICEF-MEN 2013 |
| École privée OUMOUTAH | PRIVEE OUMOUTAH | Bamako | 0 m | HOTOSM / UNICEF-MEN 2013 |
| École privée SOGOBA | PRIVEE SOGOBA | Bamako | 0 m | HOTOSM / UNICEF-MEN 2013 |

La Cathédrale de Bamako / CATHEDRALE est bien recensée parmi les cas ambigus : noms rapprochables et même commune III, sans coordonnées comparables sur les deux fiches.

Anomalies supplémentaires : 295 paires portent le même code de cluster 2023 malgré des noms différents. Par exemple Tiébiziédougou et Zangasso partagent SIKKAD0301. Ces codes ne doivent jamais suffire à fusionner.

Supérieur : INTEC SUP et une variante OSM ; Institut Vitos / institut vito s (21,8 m, même source OSM) ; TechnoLAB-ISTA et une variante OSM. La provenance enregistrée de TechnoLAB pointe une URL dont le libellé est ISTG, distinct d’ISTA : contrôle nécessaire. Aucun rapprochement supérieur n’est certifié ici.

Catégories d’ambiguïté, non exclusives :

- nom_de_localite_ou_village : 604
- pas_de_distance_comparable : 1512
- source_commune_identifiants_distincts : 1834
- distance_40m_a_1km : 492
- types_superieur : 3

Le script audite-ml.py est indépendant, ne contacte aucun service et ne modifie aucune base. Il lit uniquement l’export compressé et les plans existants, puis produit les rapports JSON. La détection couvre noms et alias, variantes de cycle, suffixes de ville, identifiants, domaines, rapprochements textuels locaux et proximité spatiale. Elle ne garantit pas la découverte de noms totalement différents sans autre indice partagé.

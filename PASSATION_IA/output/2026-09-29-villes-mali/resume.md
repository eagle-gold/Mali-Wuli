# Villes des établissements du Mali — plan de normalisation (simulation, rien d'appliqué)

Extraction : `2026-09-29T00:44:02.368Z` (SELECT seul), fiches `paysCode='ML' AND valide=1`.
Fichiers : `plan-villes.json` (1 ligne par fiche), `referentiel-communes.json` (communes + incohérences), `stats.json`, outils dans `outils/`.

## 1. Chiffres clés

| | Avant | Après (tout appliqué) | Après (BASSE non appliquée) |
|---|---|---|---|
| Fiches | 19720 | 19720 | 19720 |
| `ville` distinctes (libellé brut) | 5593 | 700 | ≈810 |
| `villeNormalisee` distinctes | 5227 | 700 | 810 |
| Valeurs à une seule fiche | 3411 | 2 | — |

- Fiches dont `ville` ou `villeNormalisee` change : **10511** (dont 2850 changements seulement de casse ou d'accents, `villeNormalisee` identique).
- Ancienne valeur conservée comme localité : **7931** fiches.
- Fiches rattachées à une commune du référentiel : **19666** / 19720 (99.7 %).
- Confiance : **HAUTE 18456** (93.6 %), MOYENNE 1071, BASSE 193.
- Statuts : unanime 19401, conflit 165, ville_bamako_sans_commune 42, knn_bamako 30, knn_faible 21, knn_unanime 17, conflit_departage_knn 14, non_resolu 12, conflit_bamako 10, ville_egale_commune 8.
- Villes les plus fréquentes après : Bamako (2097), Sikasso (375), Ségou (321), Kalabancoro (286), Mopti (205), Koutiala (201), Salam (165), Ménaka (136), Koro (119), Pelengana (116), Niono (114), Kita (113), Kayes (112), Tombouctou (109), Dogofry (108).

## 2. Commune disponible par source

| Source | Fiches portant la source | Commune résolue | Comment |
|---|---|---|---|
| OSM (HOT/HDX) | 10282 | 10281 | `adm3_name` + `adm3_pcode` (COD-AB OCHA) déjà présents dans `donneesBrutes` — jointure polygonale faite par HDX. Aucune localité (`adm4` vide). |
| MEN 2023 (OCHA) | 8106 | 8106 | `commune` + `codeCommune` (P-code), mais **P-code faux ou absent sur 440 lignes** : on résout par le **nom dans le cercle**, le P-code n'est qu'un indice. |
| MEN 2013 (UNICEF) | 9289 | 9232 | `commune` en majuscules, sans P-code (« COMMUNE DE KAYES », « COMMUNE V ») + `localite` (village) + `cap`. |

Combinaisons de sources : MEN2023 5613, OSM 4559, MEN2013+OSM 3876, MEN2013 3066, MEN2013+MEN2023+OSM 1679, MEN2013+MEN2023 662, MEN2023+OSM 152, autre 95, OSM+autre 12, MEN2013+OSM+autre 4, MEN2013+autre 2.
Méthodes de résolution des lignes registre : MEN2013:NON 60, MEN2013:equivalence 55, MEN2013:exact 9391, MEN2013:flou 392, MEN2013:hors 7, MEN2013:prefixe 92, MEN2013:variante 75, MEN2023:exact 7471, MEN2023:exact(nom) 326, MEN2023:flou 482, MEN2023:prefixe 158, MEN2023:variante 216.

**Couverture globale d'une commune fiable** : 18456 fiches HAUTE (93.6 %) ; 19666 fiches (99.7 %) avec une commune quelle que soit la confiance.

### Plus proches voisins (sans géocodage externe)
Les fiches OSM ont déjà leur commune (polygone). Le kNN ne sert donc qu'à trois cas :
- fiches sans source administrative (Overture, campus, LeGrandFrère… : 95 fiches seules) : k=5, rayon 3 km, ≥3 voisins, **unanimité** → MOYENNE ; 1-2 voisins unanimes → BASSE (`knn_faible`) ; voisins tous dans Bamako → Bamako ;
- départage des conflits OSM ≠ registre : voisins **registre** uniquement (sinon le kNN recopie le polygone OSM), unanimes et égaux à l'un des candidats → MOYENNE (`conflit_departage_knn`) ;
- confirmation des résolutions MOYENNE (voisins unanimes → HAUTE).
Une fiche marquée Bamako sans commune et sans voisins reste Bamako (`ville_bamako_sans_commune`, MOYENNE) : le kNN ne peut pas la déplacer vers une commune périphérique à 2 km.

## 3. Référentiel des communes (`referentiel-communes.json`)

- **717 communes** : 695 « COD-AB via OSM (adm3) », 22 « MEN 2023 seul (absente d'OSM/COD-AB, à vérifier) ». (Le Mali compte 703 communes COD-AB ; la base OSM en couvre 695.)
- Pour chaque commune : P-code, nom officiel (COD-AB, accents : « Baraouéli », « Ségou », « Kéniéba »), cercle, région, variantes rencontrées par source (« Baroueli », « BAROUELI », « COMMUNE DE … »), nombre de fiches.
- Règles de rapprochement (dans le cercle) : exact après normalisation (préfixes « commune (rurale/urbaine) de » retirés, chiffres → romains) → squelette phonétique (ou/u, dj/j, c/k, lettres doublées : Diougani/Dioungani, Marico/Mariko) → abréviation unique (« Finkolo G » → Finkolo Ganadougou) → équivalences manuelles probables (Kolombine = Colimbiné, Djouma = Diouman, Nioro Togoune = Nioro Tougouné Rangaba, Sere Moussa Ani Samou = … de Siékorolé ; MOYENNE) → flou ≥ 0,80 avec écart ≥ 0,10 (MOYENNE) → nom unique au Mali (cercle réorganisé : Ménaka).

### Incohérences signalées (pcode_men2023_contredit_par_nom 60, commune_registre_non_reconnue 8, homonymes 13)
- **P-codes MEN 2023 décalés** (60 couples, 440 lignes), surtout cercle de Banamba (MEN 2023 « Duguwolowila » porte ML020106 = Madina Sacko chez COD-AB, « Madina-Sacko » porte ML020108 = Toubacoro), Salam (ML060507→510 pour une seule commune ML060505) et région de Ménaka (MEN 2023 en ML07xx, COD-AB en ML10xx après création de la région). → Ne jamais utiliser `codeCommune` MEN 2023 comme clé.
- **Communes présentes seulement dans MEN 2023** (22), à vérifier : Bandiagara (Bandiagara, 36 f.), Tindirma (Dire, 4 f.), Aljounoub (Goundam, 10 f.), Ouinerden (Gourma-Rharous, 3 f.), Tadriyante (Inekar, 6 f.), Tabankort (MENAKA, 6 f.), Intadeyné (Tidermene, 15 f.), Ouineren (Gourma-Rharous, 1 f.), Inlamawane (Inekar, 2 f.), Tissouwagh (Inekar, 5 f.), Koporo- Na (Koro, 42 f.), Assakaraye (MENAKA, 15 f.), Inazole (MENAKA, 7 f.), Infoukaretane (MENAKA, 5 f.), Iziguiret (MENAKA, 11 f.), Tin -Abaw (Menaka, 20 f.), Alata (Tidermene, 11 f.), Inhinita (Tidermene, 2 f.), Intadayné (Tidermene, 3 f.), Chimam (Tidermene, 7 f.), Tadjerert (Tidermene, 1 f.), Tedjerert (Tidermene, 6 f.). Bandiagara (commune urbaine), Aljounoub, Tindirma, Ouinerden sont réelles mais sans école OSM ; les « communes » de la région de Ménaka (Assakaraye, Inazole, Iziguiret, Tin-Abaw, Alata, Chimam…) correspondent au découpage 2023 non repris par COD-AB — à valider avant de les afficher comme villes.
- **Noms registre non reconnus** (8 libellés, 60 lignes, toutes MEN 2013) : OUALIA (BAFOULABE, 19), MACONO (KITA, 11), TIAKADOUGOU-FARABA (KATI, 9), BADENYA (KITA, 8), COMMUNE DE FEGUI (KAYES, 6), COMMUNE DE KOUNIAKARY (KAYES, 4), FINKOLO SIKASSO (SIKASSO, 2), INTEDJEDIT (TIN-ESSAKO, 1).
- **Homonymes** (13 noms, 615 fiches) : Kapala (Sikasso/Koutiala), Tilemsi (Gao/Goundam), Farako (Kolondieba/Ségou), Diedougou (Dioila/Ségou/Koutiala), Baye (Bankass/Kéniéba), Benkadi (Sikasso/Dioila/Kangaba), Faraba (Kéniéba/Kati), Niamana (Nara/San), Dogofry (Nara/Niono), Koula (Koulikoro/Tominian), Bougoula (Kolondieba/Kati), Bamba (Koro/Bourem), Somo (Baraouéli/San). La facette les fusionnerait (même `villeNormalisee`).
- Graphies COD-AB discutables mais retenues (source officielle OCHA) : « Ben Kadi » (Banamba) vs « Benkadi » ailleurs, « Sony Aliber » (MEN : « Soni Ali Ber »), « Koporokendie Na ». Une table de libellés d'affichage peut les corriger sans toucher au P-code.

## 4. Règle cible proposée

1. `ville` = **nom officiel de la commune** (référentiel, accents usuels, casse soignée). Exception : communes I à VI du District → `ville = "Bamako"`.
2. `villeNormalisee` = `villeNormaliseePourPays("ML", ville).villeNormalisee` (même `normaliser` que le catalogue ; pour « Bamako » : `bamako`).
3. Choix de la commune : sources unanimes → HAUTE ; conflit → vote (nombre de sources, puis MEN 2023 > MEN 2013 > OSM), départage kNN registre, sinon BASSE ; conflit limité aux communes de Bamako → Bamako, HAUTE.
4. Ancienne `ville` (village, quartier, faute) → **localité**, si elle diffère de la ville et de la commune et n'est pas une étiquette « Commune I…VI / District de Bamako » ; sinon `localite` MEN 2013. Casse soignée seulement pour les libellés tout en majuscules.
5. Application recommandée : HAUTE + MOYENNE ; BASSE (193 : conflit 160, knn_faible 21, non_resolu 12) en revue manuelle — `ville` inchangée en attendant.

## 5. Schéma : pas de champ existant adapté → migration additive

`Etablissement` n'a que `ville`, `villeNormalisee`, `description`, `latitude`, `longitude` ; `EtablissementAlias` (`nom`, `nomNormalise`, `langue`) n'a pas de type et sert à la recherche par nom (y mettre des villages polluerait la recherche) ; `donneesBrutes` garde déjà la provenance mais n'est ni indexé ni affiché. Migration proposée (**non écrite dans schema.prisma**) :

```prisma
model Etablissement {
  // …champs existants…
  localite            String?                  // village / quartier / ancienne valeur de `ville`
  commune             String?                  // nom officiel (ex. « Commune V », « Kalabancoro »)
  communeCode         String?  @db.VarChar(24) // P-code COD-AB (ML090105) ou code provisoire « ML23:… »
  cercle              String?
  region              String?

  @@index([paysCode, communeCode])
}
```

SQL équivalent (MySQL, colonnes nullables, sans valeur par défaut, instantané) :

```sql
ALTER TABLE `Etablissement`
  ADD COLUMN `localite` VARCHAR(191) NULL,
  ADD COLUMN `commune` VARCHAR(191) NULL,
  ADD COLUMN `communeCode` VARCHAR(24) NULL,
  ADD COLUMN `cercle` VARCHAR(191) NULL,
  ADD COLUMN `region` VARCHAR(191) NULL;
CREATE INDEX `Etablissement_paysCode_communeCode_idx` ON `Etablissement`(`paysCode`, `communeCode`);
```

Minimum indispensable : `localite` (sans elle, l'ancienne valeur ne reste que dans `donneesBrutes`) ; `commune` est nécessaire pour Bamako (commune I–VI) ; `communeCode`/`cercle`/`region` évitent de recalculer et permettent de désambiguïser les homonymes. Colonnes génériques : utilisables plus tard pour la France (commune INSEE) ou le Maroc.

## 6. Bamako

- Aujourd'hui : 2097 fiches proposées avec `ville = "Bamako"` — Commune I 308, Commune II 171, Commune III 148, Commune IV 360, Commune V 510, Commune VI 558, null 42 (« None » = Bamako certain, commune I–VI inconnue).
- **Proposition : garder `ville = "Bamako"`** et mettre « Commune I…VI » dans `commune` (et le quartier — Badalabougou, Hamdallaye ACI… — dans `localite`). Raisons : c'est la ville que les membres cherchent et que liste l'onboarding (47 villes `@countrystatecity`, « Bamako » mais aucune « Commune V ») ; `villeCanoniqueMali`, `variantesVille` et l'import OSM forcent déjà Bamako ; les 6 communes ne sont pas des villes au sens usuel.
- Filtre optionnel ensuite : un sous-filtre « Commune » visible seulement quand ville = Bamako (facette sur `commune`).
- Les communes périphériques (Kalabancoro, Sangarébougou, Dialakorodji, Moribabougou…) restent des villes distinctes : ce sont des communes du cercle de Kati. Conflits aux limites (OSM Sangarébougou vs MEN 2013 Commune I : 11 fiches) → BASSE, revue.

## 7. Impact sur le code

- **Facettes** (`education-facettes.service.ts`) : `ROW_NUMBER() … PARTITION BY BINARY villeNormalisee ORDER BY ville` → le libellé affiché devient celui du référentiel. Liste des villes du Mali : 5227 → 700 entrées. Les homonymes (13) sont fusionnés : acceptable, ou suffixer le cercle dans le libellé (« Benkadi (Dioïla) »).
- **Filtre catalogue** (`GET /etablissements?ville=`) : `villeNormalisee contains` → un filtre « Ségou » ne ramènera plus « segou koko » etc. ; plus de doublons casse/accents (« Segou »/« Ségou », « KALABANCORO »/« Kalabancoro »).
- **Onboarding** (`chercherEtablissements`, égalité stricte sur `villeNormalisee` via `variantesVille`) : fiches atteignables depuis les 47 villes proposées : ≈4 289 → ≈4 603. Les écoles de villages restent introuvables tant que l'onboarding filtre par ville : prévoir une recherche par `commune`/`localite` ou élargir `variantesVille` (hors périmètre).
- **Suggestions** (`catalog-suggestion-service.ts` l.49/92) : comparent via `normaliserEducation`, pas via la règle Mali — sans effet nouveau mais à aligner.
- **Imports** (risque majeur) : `villeDepuisAdministration` (MEN 2013/2023 : localité d'abord) et `import-mali-osm-education.ts` (`addr_city || adm4 || adm3`) **réécriraient les villages** au prochain import et casseraient les rapprochements par `type|villeNormalisee|nom` (`deduplication-etablissements.ts`). À changer avant/avec l'application : commune d'abord, localité dans `localite`.
- **Fusion** (`fusion-doublons-plan.ts`) vérifie `villeNormalisee` : tout plan de fusion antérieur devient caduc → régénérer après application.
- Copies : `Formation` n'a pas de ville ; 6 fiches ML ont des formations, 7 copies dans `Profil.onboardingDonnees.formations[].ville` — toutes Bamako → Bamako, **aucun changement visible pour les membres**.
- `normalize-mali-establishment-cities.ts` : son `--apply` écrit « Bamako » en dur pour tous les candidats ; à remplacer par un script `--plan plan-villes.json` (contrôle par fiche que `ville`/`villeNormalisee` n'ont pas changé depuis l'extraction, lots, journal).

## 8. 30 exemples

| # | Établissement | Ville actuelle | Ville proposée | Commune / cercle | Localité conservée | Confiance | Preuves |
|---|---|---|---|---|---|---|---|
| 1 | BAN-MARKALA | Ban Markala | **Korodougou** | Korodougou / Bla | Ban Markala | HAUTE (unanime) | MEN2013:KORODOUGOU |
| 2 | NOINA | Noina | **Pondori** | Pondori / Djenné | Noina | HAUTE (unanime) | MEN2013:PONDORI + MEN2023:Pondori + OSM:Pondori |
| 3 | MEDERSA SABIL SAADATI | Saadaty | **Guégnéka** | Guégnéka / Dioila | Saadaty | HAUTE (unanime) | MEN2013:GUEGNEKA + OSM:Guégnéka |
| 4 | DOUNA | Douna | **Koury** | Koury / Yorosso | Douna | HAUTE (unanime) | MEN2013:KOURY + MEN2023:Koury + OSM:Koury |
| 5 | MAKONONI | Makononi | **Kaniogo** | Kaniogo / Kangaba | Makononi | HAUTE (unanime) | MEN2013:KANIOGO + OSM:Kaniogo |
| 6 | Tassilima | Ouagadou | **Ouagadou** | Ouagadou / Nara | Tassilima | HAUTE (unanime) | MEN2013:OUAGADOU + MEN2023:Ouagadou |
| 7 | Takoni | Takoni | **Kassaro** | Kassaro / Kita | Takoni | HAUTE (unanime) | MEN2013:KASSARO + OSM:Kassaro |
| 8 | TOUN [1er C]YCLE | Toum | **Sokoura** | Sokoura / Bankass | Toum | HAUTE (unanime) | OSM:Sokoura |
| 9 | LELE BOUGORO | Lelebougou | **Nafanga** | Nafanga / Koutiala | Lelebougou | HAUTE (unanime) | OSM:Nafanga |
| 10 | Ségou-Coura | Segou-Coura | **Kokry Centre** | Kokry Centre / Macina | Segou-Coura | HAUTE (unanime) | OSM:Kokry Centre |
| 11 | N'Tiele | N'Tiele | **Duguwolowula** | Duguwolowula / Banamba | N'Tiele | HAUTE (unanime) | OSM:Duguwolowula |
| 12 | Ménaka I V P/C | MENAKA | **Ménaka** | Ménaka / Ménaka | — | HAUTE (unanime) | MEN2023:MENAKA |
| 13 | Dedji | Kendie | **Kendié** | Kendié / Bandiagara | — | HAUTE (unanime) | MEN2023:Kendie |
| 14 | Medersa Dintiola | M'Pessoba | **M'pessoba** | M'pessoba / Koutiala | — | HAUTE (unanime) | MEN2023:M'Pessoba |
| 15 | BOULKASSOUMBOUGOU [2ème C] IV | Sangarébougou | **Bamako** | Commune I / Bamako | Sangarébougou | BASSE (conflit) | MEN2013:COMMUNE I + OSM:Sangarébougou |
| 16 | LE BELEDOUGOU | Dialakorodji | **Bamako** | Commune I / Bamako | Dialakorodji | MOYENNE (conflit_departage_knn) | MEN2013:COMMUNE I + OSM:Dialakorodji |
| 17 | BOULKASSOUMBOUGOU [2ème C] II | Sangarébougou | **Bamako** | Commune I / Bamako | Sangarébougou | BASSE (conflit) | MEN2013:COMMUNE I + OSM:Sangarébougou |
| 18 | SOMA NIAKATE | Dialakorodji | **Bamako** | Commune I / Bamako | Dialakorodji | MOYENNE (conflit_departage_knn) | MEN2013:COMMUNE I + OSM:Dialakorodji |
| 19 | Tarbiatou Islamiyatou Oula | Songo-Doubakore | **Songo Doubacoro** | Songo Doubacoro / Koutiala | Songo-Doubakore | MOYENNE (unanime) | MEN2023:Songo-Doubakore |
| 20 | MOUNTAN SONINKE | Mounta Soninke | **Fatao** | Fatao / Diéma | Mounta Soninke | MOYENNE (unanime) | MEN2013:COMMUNE DE FATAOU |
| 21 | Inlamawane | Inlamawane | **Inlamawane** | Inlamawane / Inekar | — | MOYENNE (unanime) | MEN2023:Inlamawane |
| 22 | Enko Bamako International School | Bamako | **Bamako** | Commune III / Bamako | — | HAUTE (knn_bamako) | — |
| 23 | Complexe Scolaire Alif | Bamako | **Bamako** | Commune IV / Bamako | — | HAUTE (knn_bamako) | — |
| 24 | SELINGUE [1er C] A | Selingue | **Tagandougou** | Tagandougou / Yanfolila | Selingue | MOYENNE (conflit_departage_knn) | MEN2013:BAYA + OSM:Tagandougou |
| 25 | SOMA NIAKATE | Dialakorodji | **Bamako** | Commune I / Bamako | Dialakorodji | MOYENNE (conflit_departage_knn) | MEN2013:COMMUNE I + OSM:Dialakorodji |
| 26 | SAH | Ec1-Saah | **Banco** | Banco / Dioila | Ec1-Saah | BASSE (conflit) | MEN2013:BANCO + OSM:N'golobougou |
| 27 | NOUROUL YAKINOU AMEDIKEOU | Diafounou Diongaga | **Marekaffo** | Marekaffo / Yélimané | Diafounou Diongaga | BASSE (conflit) | MEN2013:MAREKHAFFO + OSM:Diafounou Diongaga |
| 28 | DENGOUALA | Degouala | **Ména** | Ména / Kolondieba | Degouala | BASSE (conflit) | MEN2013:MENA + OSM:Koumantou |
| 29 | KONIAKARY A | KOUNIAKARY | **KOUNIAKARY** | — / — | — | BASSE (non_resolu) | MEN2013:COMMUNE DE KOUNIAKARY |
| 30 | SOLAHI WANANDJAHI FEGUI | FEGUI | **FEGUI** | — / — | — | BASSE (non_resolu) | MEN2013:COMMUNE DE FEGUI |

## 9. Cas non résolus (12 fiches `non_resolu`, ville inchangée)

- `ml-registre-02c305254e2aa6a6dec85476` MOUSSA LAMINE COULIBALY — ville actuelle « OUALIA » — MEN2013:OUALIA
- `ml-registre-2c743e3cbb2376ed230fbe73` KONIAKARY B — ville actuelle « KOUNIAKARY » — MEN2013:COMMUNE DE KOUNIAKARY
- `ml-registre-63c4eb639d5bece1d4f1dd1a` OUALIA 2è C — ville actuelle « OUALIA » — MEN2013:OUALIA
- `ml-registre-71fbb98c9027f2a0d57ae26f` KONIAKARY A — ville actuelle « KOUNIAKARY » — MEN2013:COMMUNE DE KOUNIAKARY
- `ml-registre-9b473152c6bc82248f7c4398` MANAHARA AL HOUDA FEGUI — ville actuelle « FEGUI » — MEN2013:COMMUNE DE FEGUI
- `ml-registre-9e1309f4b8c59423982376ff` SOLINTA — ville actuelle « OUALIA » — MEN2013:OUALIA
- `ml-registre-d2220539194ce52b10e5dbc9` SOLAHI WANANDJAHI FEGUI — ville actuelle « FEGUI » — MEN2013:COMMUNE DE FEGUI
- `ml-registre-ded888e2a29b337e62cb0161` TAHAFIZOU AL KOURANA — ville actuelle « KOUNIAKARY » — MEN2013:COMMUNE DE KOUNIAKARY
- `ml-registre-e031f7e96297b2c5c1efcc10` MANAHARA AL HOUDA — ville actuelle « FEGUI » — MEN2013:COMMUNE DE FEGUI
- `ml-registre-ea53f14c0f6d35f7b3435c51` SALAHI WANADIAHI — ville actuelle « FEGUI » — MEN2013:COMMUNE DE FEGUI
- `ml-registre-fc010f16506e234fcf8e4569` KONIAKARY . — ville actuelle « KOUNIAKARY » — MEN2013:COMMUNE DE KOUNIAKARY
- `ml-registre-ffacf164a89bef45eda4ebff` FEGUI — ville actuelle « FEGUI » — MEN2013:COMMUNE DE FEGUI

Autres BASSE : conflit 160, knn_faible 21, non_resolu 12 — détail dans `plan-villes.json` (`conflit`, `knn`).

## 10. Risques

- MEN 2023 : P-codes décalés ; seul le nom dans le cercle est fiable.
- Conflits OSM ≠ registre (165 + 14 départagés) : parfois fusion antérieure erronée plutôt que frontière — à examiner avec le plan de fusion.
- Communes rurales dont le nom n'est pas celui d'un bourg (« Sony Aliber », « Duguwolowula », « Wassoulou Balle ») : ville exacte administrativement mais peu parlante ; la localité conservée doit être affichée sur la fiche (« Kiban · commune de Duguwolowula »).
- Imports et scripts à aligner avant toute écriture, sinon régression au prochain import.
- Plan valable pour l'extraction du 2026-09-29 ; à régénérer s'il date de plus de 24 h.

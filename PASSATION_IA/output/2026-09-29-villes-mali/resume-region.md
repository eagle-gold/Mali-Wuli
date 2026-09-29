# Villes des établissements du Mali — règle « chef-lieu de région » (plan, rien d'appliqué)

Décision du propriétaire du 2026-09-29 (remplace « ville = commune »). Extraction `2026-09-29T00:44:02.368Z` (SELECT seul, fiches `paysCode='ML' AND valide=1`), résolution des communes reprise de `plan-villes.json` (même extraction, < 24 h : pas de réextraction). Fichiers : `plan-villes-region.json`, `stats-region.json`, outil `outils/plan-villes-region.py`.

## 1. Règle

- `ville` = chef-lieu de la région **OCHA admin1 (COD-AB)** de la commune ; District → « Bamako ».
- `villeNormalisee` = `normaliserEducation(ville)` (recalculée par le script d'application).
- Détails : `commune` (nom officiel COD-AB, « Commune I…VI » pour le District), `communeCode` (P-code COD-AB ou code provisoire `ML23:…`), `cercle`, `region`.
- `localite` = ancienne `ville` si elle diffère de la nouvelle ville et de la commune (et n'est pas « Commune V », « District de Bamako »…), sinon localité MEN 2013.
- Application : confiance HAUTE et MOYENNE ; BASSE inchangées (aucune colonne écrite).

## 2. Table région → chef-lieu

| P-code | Région | Chef-lieu (= ville) | Fiches (après) |
|---|---|---|---|
| ML01 | Kayes | Kayes | 1904 |
| ML02 | Koulikoro | Koulikoro | 2905 |
| ML03 | Sikasso | Sikasso | 4236 |
| ML04 | Ségou | Ségou | 3168 |
| ML05 | Mopti | Mopti | 2712 |
| ML06 | Tombouctou | Tombouctou | 1145 |
| ML07 | Gao | Gao | 863 |
| ML08 | Kidal | Kidal | 135 |
| ML09 | Bamako | Bamako | 2086 |
| ML10 | Ménaka | Ménaka | 373 |
| — | Taoudénit | Taoudéni | 0 |

Taoudénit n'existe pas dans COD-AB (ses cercles restent dans Tombouctou) : **0 fiche** ; entrée gardée pour de futurs imports.

**Régions créées en 2023** (Nioro, Kita, Dioïla, Nara, Bougouni, Koutiala, San, Douentza, Bandiagara) : aucune source ne les utilise comme région (MEN 2013, MEN 2023 et OSM/HDX sont en admin1 OCHA). Les fiches restent donc dans leur région OCHA d'origine. À titre indicatif, fiches appliquées situées dans le **cercle éponyme** (borne basse : les nouvelles régions englobent d'autres cercles) :

- Bandiagara (région OCHA Mopti) : 519
- Bougouni (région OCHA Sikasso) : 662
- Dioila (région OCHA Koulikoro) : 489
- Douentza (région OCHA Mopti) : 256
- Kita (région OCHA Kayes) : 500
- Koutiala (région OCHA Sikasso) : 832
- Nara (région OCHA Koulikoro) : 343
- Nioro (région OCHA Kayes) : 139
- San (région OCHA Ségou) : 306

## 3. Chiffres

| | Avant | Après (HAUTE+MOYENNE appliquées) | Si tout appliqué |
|---|---|---|---|
| `ville` distinctes (brut) | 5593 | 147 | 10 |
| `villeNormalisee` distinctes | 5227 | 147 (10 chefs-lieux + 137 valeurs des fiches BASSE) | 10 |

- Fiches : 19720 ; appliquées 19527 (HAUTE 18456, MOYENNE 1071) ; BASSE inchangées 193.
- `ville` modifiée : **16576** fiches ; ville identique mais détails écrits : 2951.
- Avec `commune` : 19485 ; avec `localite` : 7655.
- Fiches avec formations dont la ville change : 0.
- Attendu ≈ 11 : on obtient **10** chefs-lieux (pas de Taoudéni). Les 137 autres valeurs viennent des 193 BASSE laissées telles quelles. Parmi elles, **136** ont toutes leurs communes candidates dans la même région : le chef-lieu est certain (champ `chefLieuSiRegionUnique`) ; les appliquer en « ville seule » ramènerait à 30 valeurs. Non fait (règle : BASSE inchangées) — décision à prendre.

### Répartition après application

| Ville | Fiches |
|---|---|
| Sikasso | 4236 |
| Ségou | 3168 |
| Koulikoro | 2905 |
| Mopti | 2712 |
| Bamako | 2086 |
| Kayes | 1904 |
| Tombouctou | 1145 |
| Gao | 863 |
| Ménaka | 373 |
| Kidal | 135 |

## 4. Exemples

| # | Établissement | Ville actuelle | Ville proposée | Localité · Commune · Cercle · Région | Confiance |
|---|---|---|---|---|---|
| 1 | Kongolikoro | Niena | **Sikasso** | — · Niéna · Sikasso · Sikasso | HAUTE (unanime) |
| 2 | YOGOLA | Yogola | **Sikasso** | Yogola · Niéna · Sikasso · Sikasso | HAUTE (unanime) |
| 3 | WAKORO YANGASSO | Wakoro | **Ségou** | Wakoro · Yangasso · Bla · Ségou | HAUTE (unanime) |
| 4 | Med Man Baou Ouloumi | Dogofry | **Ségou** | — · Dogofry · Niono · Ségou | HAUTE (unanime) |
| 5 | Nara 'G' | Nara | **Koulikoro** | — · Nara · Nara · Koulikoro | HAUTE (unanime) |
| 6 | MEDERSA HAMZATOU SINSINA | Sinsina | **Koulikoro** | Sinsina · Sanankoroba · Kati · Koulikoro | HAUTE (unanime) |
| 7 | PÊH | Peh | **Mopti** | Peh · Ouonkoro · Bankass · Mopti | HAUTE (unanime) |
| 8 | Irebane I | Bamba | **Mopti** | — · Bamba · Koro · Mopti | HAUTE (unanime) |
| 9 | BANCONI FARADA | Dialakorodji | **Bamako** | Dialakorodji · Commune I · Bamako · Bamako | MOYENNE (conflit_departage_knn) |
| 10 | LE BELEDOUGOU | Dialakorodji | **Bamako** | Dialakorodji · Commune I · Bamako · Bamako | MOYENNE (conflit_departage_knn) |
| 11 | MAKANIA | Diamou | **Kayes** | — · Diamou · Kayes · Kayes | HAUTE (unanime) |
| 12 | MEDERSA NAFADJI-COURA | Nafadji Coura | **Kayes** | Nafadji Coura · Kassaro · Kita · Kayes | HAUTE (unanime) |
| 13 | SAKOÏRA | Sakoira | **Tombouctou** | Sakoira · Dangha · Diré · Tombouctou | HAUTE (unanime) |
| 14 | [2ème C] de DOUEKIRE | Douekire | **Tombouctou** | — · Douékire · Goundam · Tombouctou | HAUTE (unanime) |
| 15 | Izo | TESSIT | **Gao** | — · Tessit · Ansongo · Gao | HAUTE (unanime) |
| 16 | Sidi Med Lamine | ANSONGO | **Gao** | — · Ansongo · Ansongo · Gao | HAUTE (unanime) |
| 17 | Ingouyass | Tin -Abaw | **Ménaka** | — · Tin -Abaw · Ménaka · Ménaka | MOYENNE (unanime) |
| 18 | Ménaka II P/C | MENAKA | **Ménaka** | — · Ménaka · Ménaka · Ménaka | HAUTE (unanime) |
| 19 | Amachach | Tessalit | **Kidal** | — · Tessalit · Tessalit · Kidal | HAUTE (unanime) |
| 20 | Toua Ag Adass | Tinessako | **Kidal** | — · Tin Essako · Tin-Essako · Kidal | HAUTE (unanime) |
| 21 | Bèna | Menamba | **Sikasso** | Menamba · Menamba I · Yorosso · Sikasso | MOYENNE (unanime) |
| 22 | Kokry /B | Kokry | **Ségou** | Kokry · Kokry Centre · Macina · Ségou | MOYENNE (unanime) |
| 23 | Sao | Gouadji Sougouna | **Sikasso** | Gouadji Sougouna · Gouadié Sougouna · Koutiala · Sikasso | MOYENNE (unanime) |
| 24 | DAOUDABOUGOU ''D'' | Bamako | **Bamako** | Daoudabougou · Commune V · Bamako · Bamako | HAUTE (unanime) |
| 25 | DAOUDABOUGOU ''B'' | Bamako | **Bamako** | Daoudabougou · Commune V · Bamako · Bamako | HAUTE (unanime) |

## 5. Cas BASSE (193, inchangés)

Par statut : conflit 160, knn_faible 21, non_resolu 12.

- 136 fiches : région certaine, commune incertaine (conflit entre communes d'une même région).
- Fiches sans région certaine (conflit entre régions, kNN faible, non résolues) :

| Établissement | Ville actuelle | Statut | Candidats |
|---|---|---|---|
| ECOM CONZE (`ml-osm-0313f1bdffb45c2114184352`) | Conze | conflit | Domba (ML030107), Massigui (ML020215) |
| GOUANKELE ECOM (`ml-osm-0854368ef3d4bcc9362da36e`) | N'Gouaguele | conflit | Massigui (ML020215), Domba (ML030107) |
| BANANCORO [2ème C] I (`ml-osm-11c4e1e4f131f288eac16076`) | Bamako | conflit | Commune VI (ML090106), Sanankoroba (ML020431) |
| BANANKORO B [1er C] (`ml-osm-18db28803ee51f20f6884fa8`) | Bamako | conflit | Commune VI (ML090106), Sanankoroba (ML020431) |
| BOULKASSOUMBOUGOU [2ème C] II (`ml-osm-27c6a78b5d7b28bfbff83999`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BASSA ECOM (`ml-osm-2c6653a80be4a8c24dc9616f`) | Bassa | conflit | Ouélessébougou (ML020428), Kéléya (ML030111) |
| BOULKASSOUMBOUGOU B (`ml-osm-2d024b15ea7e5f7c86eeb951`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BOULKASSOUMBOUGOU [2ème C] IV (`ml-osm-4dcee206b3577b2e9b84899a`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BOULKASSOUMBOUGOU E (`ml-osm-5033907dd5feffd45a6957ea`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BOULKASSOUMBOUGOU [2ème C] I (`ml-osm-578023a38611c372d6b93ce6`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BOULKASSOUMBOUGOU F (`ml-osm-5b0f45d4006a464018d74d28`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| TABACORO ECOM (DOMBA) (`ml-osm-641b87d3a78ad83a56396026`) | Tabakoro | conflit | Massigui (ML020215), Domba (ML030107) |
| INTINAWENE (`ml-osm-86d9ca4ed39a0a6e5836bf6c`) | In Tinawene | conflit | Haribomo (ML060305), Ménaka (ML100101) |
| WAKOUNGO ECOM (`ml-osm-8862ca43e0a88dc7b7478b52`) | Ouakounga | conflit | Diora (ML040702), Koumbia (ML030704) |
| INTIBAKATENE (`ml-osm-a9d25bffbc6a725c878afbe5`) | In Tagaten | conflit | Anchawadi (ML070301), Ménaka (ML100101) |
| BOULKASSOUMBOUGOU [2ème C] III (`ml-osm-b3f270b50e85753909606f32`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BOULKASSOUMBOUGOU C (`ml-osm-b8cfbc5b24d60a09dd2bb9c7`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BANANCORO [1er C] A (`ml-osm-c32a724f846460b3e8c8be00`) | Bamako | conflit | Commune VI (ML090106), Sanankoroba (ML020431) |
| BOULKASSOUMBOUGOU D (`ml-osm-d3afdefd6d39822aeee3d2eb`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| FAMANA [1er C] (`ml-osm-d9c1cc434dbbe6fb57667e2e`) | Famana | conflit | Ouélessébougou (ML020428), Kéléya (ML030111) |
| SOUNSOUNKORO II (`ml-osm-da2f59112094d76d4d6d82fa`) | Sounsounkoro 2 | conflit | Massigui (ML020215), Débélin (ML030104) |
| BOULKASSOUMBOUGOU A (`ml-osm-ee43964fa7d39ab1a1234e0b`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BOUGOUDIRE [1er C]. (`ml-osm-f0a5cfd0a7715ca454e3e1ed`) | None | knn_faible | — |
| BOULKASSOUMBOUGOU V (`ml-osm-f83bfebc67b235c49b809bfa`) | Sangarébougou | conflit | Sangarébougou (ML020432), Commune I (ML090101) |
| BANANKORO [2ème C] II (`ml-osm-f8d5d7d9156b40be3312c8f1`) | Bamako | conflit | Commune VI (ML090106), Sanankoroba (ML020431) |
| École de Musique de Kirina (`ml-overture-e97603fcecd9e49c63878d29`) | Kirina | knn_faible | — |
| MOUSSA LAMINE COULIBALY (`ml-registre-02c305254e2aa6a6dec85476`) | OUALIA | non_resolu | OUALIA |
| TOUNOUFOU (`ml-registre-0dcf132aa5c592df02c1607b`) | Tounoufou | knn_faible | TIAKADOUGOU-FARABA |
| DIALADIAN (`ml-registre-132ad56a978b57c1f4d6af31`) | OUALIA | knn_faible | OUALIA |
| NARY (`ml-registre-1658b8ffa221401a57cbd9d3`) | OUALIA | knn_faible | OUALIA |
| SELINKEGNY (`ml-registre-1ebc71e80bbf8c814584a8ca`) | OUALIA | knn_faible | OUALIA |
| KONIAKARY B (`ml-registre-2c743e3cbb2376ed230fbe73`) | KOUNIAKARY | non_resolu | COMMUNE DE KOUNIAKARY |
| ACHIBOGO (`ml-registre-2e99a1810ea876b9acdfb8b2`) | INTEDJEDIT | knn_faible | INTEDJEDIT |
| FANGALA (`ml-registre-4b80187052b60e28de9034da`) | OUALIA | knn_faible | OUALIA |
| DIALAKON (`ml-registre-5feb3448813ee411da351b38`) | OUALIA | knn_faible | OUALIA |
| OUALIA 2è C (`ml-registre-63c4eb639d5bece1d4f1dd1a`) | OUALIA | non_resolu | OUALIA |
| DIOUBEBA (`ml-registre-6b240835f6e0f03bfc877bd9`) | OUALIA | knn_faible | OUALIA |
| DAFELA (`ml-registre-6e1201e11e35408654ba2b7c`) | BADENYA | knn_faible | BADENYA, BADENYA |
| KONIAKARY A (`ml-registre-71fbb98c9027f2a0d57ae26f`) | KOUNIAKARY | non_resolu | COMMUNE DE KOUNIAKARY |
| DIABALA (`ml-registre-72215ba2fcf90dea51c562b6`) | MACONO | knn_faible | MACONO |
| SOUGOUTALI (`ml-registre-775b2753a9833677cda1aa86`) | OUALIA | knn_faible | OUALIA |
| TOUMOUMBA (`ml-registre-8c0e9117807a5bb99758776d`) | BADENYA | knn_faible | BADENYA |
| MANAHARA AL HOUDA FEGUI (`ml-registre-9b473152c6bc82248f7c4398`) | FEGUI | non_resolu | COMMUNE DE FEGUI |
| SOLINTA (`ml-registre-9e1309f4b8c59423982376ff`) | OUALIA | non_resolu | OUALIA |
| MAKANA BADENYA (`ml-registre-a7abefcc7eccef470a9d2e5d`) | BADENYA | knn_faible | BADENYA |
| Djombomadji (`ml-registre-b3bc61755855524fd4c5922c`) | OUALIA | knn_faible | OUALIA |
| KOBOKOTO (`ml-registre-d053de798579e5de8e0a95e0`) | OUALIA | knn_faible | OUALIA |
| SOLAHI WANANDJAHI FEGUI (`ml-registre-d2220539194ce52b10e5dbc9`) | FEGUI | non_resolu | COMMUNE DE FEGUI |
| BOUGOUBA (`ml-registre-d880a45b2e8c6dad112d3666`) | Bougouba | knn_faible | TIAKADOUGOU-FARABA |
| TAHAFIZOU AL KOURANA (`ml-registre-ded888e2a29b337e62cb0161`) | KOUNIAKARY | non_resolu | COMMUNE DE KOUNIAKARY |
| MANAHARA AL HOUDA (`ml-registre-e031f7e96297b2c5c1efcc10`) | FEGUI | non_resolu | COMMUNE DE FEGUI |
| Badumbe (`ml-registre-e33da403d82e8dac79cbe003`) | OUALIA | knn_faible | OUALIA, OUALIA |
| GOUMANKO (`ml-registre-e60aa011c0fb6af24ab8adb1`) | BADENYA | knn_faible | BADENYA |
| SALAHI WANADIAHI (`ml-registre-ea53f14c0f6d35f7b3435c51`) | FEGUI | non_resolu | COMMUNE DE FEGUI |
| MADINA (OUALIA) (`ml-registre-fa23139a49ea9f47f092c32d`) | OUALIA | knn_faible | OUALIA |
| KONIAKARY . (`ml-registre-fc010f16506e234fcf8e4569`) | KOUNIAKARY | non_resolu | COMMUNE DE KOUNIAKARY |
| FEGUI (`ml-registre-ffacf164a89bef45eda4ebff`) | FEGUI | non_resolu | COMMUNE DE FEGUI, COMMUNE DE FEGUI |

## 6. Application

```
# simulation (défaut), depuis backend/ sur le serveur, après la migration 20260929120000_etablissement_localisation
npx tsx src/scripts/appliquer-plan-villes.ts --plan <chemin>/plan-villes-region.json --journal simulation-villes.json
# puis, après accord explicite et sauvegarde : --apply
```

Le script refuse un plan de plus de 36 h (extraction du 2026-09-29T00:44Z → à réextraire après le 2026-09-30T12:44Z), ignore les fiches dont `ville`/`villeNormalisee`/`valide` ont changé depuis l'extraction et journalise chaque lot de 200.

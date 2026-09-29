# Fusion des cycles d’une même école au Mali — plan (29 septembre 2026)

Extraction en lecture seule de la base de production le 2026-09-29T00:22:18.995Z (UTC), 24 h de validité pour le script. Aucune écriture en base, aucune fusion appliquée. Plan : `plan-cycles.json` ; outils : `outils/extract-cycles.js` (SELECT uniquement), `outils/classify-cycles.js`, `outils/resume-cycles.js`.

Décision du propriétaire (29/09) : les écoles que le registre MEN (2013/2023) enregistre séparément par cycle (1er cycle, 2nd cycle, CDPE / jardin d’enfants) au même endroit sont fusionnées en une seule fiche ; les cycles deviennent des niveaux et les codes officiels restent attachés comme EtablissementSource.

## Chiffres

| | Groupes | Fiches |
|---|---:|---:|
| Candidats (même nom sans marqueur de cycle, même commune) | 1324 | 2943 |
| **CYCLES_SURE** (classe SURE, à appliquer) | **525** | 1069 — **544 fiches désactivées**, 211 canoniques renommés |
| CYCLES_A_VERIFIER | 799 | 1874 |

Combinaisons de cycles des groupes SURE : F1 / F2 : 433 ; CDPE / F1 : 63 ; CDPE / F1 / F2 : 19 ; CDPE / F2 : 7 ; CDPE / F1+F2 : 2 ; CDPE / SEC : 1 (SEC = lycée/collège sans marqueur).

Groupes SURE à plus de deux fiches : 19 ; groupes SURE sans aucune fiche géolocalisée : 447 (rapprochement par nom + commune du registre, comme l’a décidé le propriétaire) ; avec deux fiches géolocalisées : 18 (distance max 274 m).

CYCLES_A_VERIFIER par motif principal (un motif par groupe ; un groupe peut en cumuler) :

| Motif | Groupes | Tous bloquants | Signification |
|---|---:|---:|---|
| NOM_TOPONYME | 346 | 698 | nom de base = nom de la localité/commune, sans code cluster MEN 2023 commun |
| MEME_CYCLE | 198 | 277 | deux fiches du même cycle (doublon exact à traiter d’abord, ou deux écoles distinctes) |
| CYCLE_INCONNU | 120 | 156 | une fiche sans cycle connu (ni registre ni marqueur dans le nom) |
| DISTANCE | 78 | 79 | deux fiches géolocalisées à ≥ 500 m |
| CYCLE_CONTRADICTOIRE | 34 | 39 | marqueur du nom ≠ cycle du registre sur une même fiche |
| STATUT | 12 | 12 | PUBLIC / PRIVE contradictoires |
| ENSEIGNEMENT | 7 | 7 | Classique / Medersa (registre 2023) |
| COMMUNE_MULTI | 2 | 2 | fiche rattachée à plusieurs communes |
| NOM_PROPOSE | 1 | 1 | aucun libellé exploitable sans marqueur |
| COMMUNE | 1 | 1 | communes différentes ou non confirmées |

Dont **346 groupes dont le seul bloquant est le nom de localité** (toponyme reconnu dans le groupe ou ailleurs au Mali, sans code cluster commun) : tous les autres contrôles passent ; candidats à une validation humaine rapide (passer `classe` à `SURE` et copier `canoniquePropose`/`fusionnesProposes` dans `canoniqueId`/`fusionnesIds` ; le script revalide en base). Pour ces groupes, le nom proposé devient « École de X » quand le libellé ne porte pas déjà un mot d’école.

## Règles

- **decision** : Décision du propriétaire (29/09) : les cycles (1er/2nd/CDPE) d’une même école sont fusionnés en une seule fiche ; les codes officiels restent attachés comme EtablissementSource, les anciens libellés deviennent des EtablissementAlias.
- **marqueursDeCycle** : 1er/premier/I cycle, 2nd/second/2ème/II cycle (dont « [1er C] »), cycle 1/2, F1/F2, fondamental(e) 1/2, CDPE, jardin d’enfants ; « cycle A/B » retiré mais conservé comme section (sections différentes → à vérifier). Les suffixes isolés A/B/I/II restent distinctifs.
- **cleDeBase** : nom normalisé, marqueurs retirés, puis préfixe générique retiré (école [fondamentale|privée|publique…], groupe/complexe/établissement scolaire) et articles de liaison en tête/fin.
- **cyclesSure** : toutes les paires : cycles connus et disjoints ; même commune ; statuts identiques ou un INCONNU ; types FONDAMENTALE/LYCEE ; même système éducatif ; pas d’enseignement Classique/Medersa contradictoire ; distance < 500 m si les deux fiches ont des coordonnées ; nom de base non générique (sauf nom = localité ET code cluster MEN 2023 commun à toutes les fiches) ; aucune fiche dans deux groupes.
- **canonique** : Plus grand nombre de Formation + AvisEtablissement, puis meilleure priorité de SourceEducative, puis createdAt le plus ancien, puis id.
- **nouveauNom** : Libellé d’une des fiches, marqueurs de cycle retirés : casse mixte préférée, puis le plus d’accents, puis portant un mot d’école, puis celui du canonique ; casse soignée si tout en majuscules/minuscules ; « École de X » si le nom de base est la localité. nomNormalise = normaliserEducation(nom).
- **miseAJourCanonique** : nom/nomNormalise (ancien nom ajouté en EtablissementAlias par le script), statut si canonique INCONNU et un seul statut connu, sigle si absent et unique, niveaux impliqués par les cycles et absents des fiches.
- Vocabulaire générique (règle existante) : 1e, 1er, 1ere, 2e, 2eme, 2nd, a, al, annexe, arabe, au, aux, cdpe, centre, college, communautaire, communautaires, complexe, complexes, coran, coranique, corant, cscom, csref, cycle, cycles, d, dar, de, des, deuxieme, du, e, ec, ecole, ecoles, ecom, ef, el, en, enfant, enfants, et, etablissement, fondamental, fondamentale, fondamentales, franco, garderie, groupe, groupes, i, ii, iii, institut, islamia, islamique, islamiques, iv, jardin, jardins, km, l, la, laique, le, les, lycee, madrasa, maternelle, med, medersa, medersas, medressa, p, pr, premier, prescolaire, primaire, priv, prive, privee, privees, prives, pub, public, publique, publiques, sante, scolaire, scolaires, second, seconde, troisieme. Les lieux comparés sont villeNormalisee + localité et commune des sources.
- Déjà fusionnés le 29/09 (exclus : fiches fusionnées désormais invalides, aucun de ces groupes ne réapparaît) : complexe scolaire mali univers|bamako ; ecole de lambatra|tringa ; essakane ii|menaka ; niomi|bamako ; s i t|djenne ; teriya|bamako.

## Références touchées (groupes SURE)

- Formations : 0 ; avis : 0 ; offres (EtablissementProgramme) : 0 ; SuggestionCatalogue : 0 ; ForumQuestion : 0 ; snapshots Profil.onboardingDonnees : 0.
- Aucune fiche des groupes SURE (canonique compris) n’a de formation, d’avis, d’offre, de suggestion, de question de forum ni de snapshot de profil : vérifié sur les 20 264 fiches ML valides.
- EtablissementSource déplacées vers les canoniques : 568 (codes officiels MEN conservés) ; chaque ancien libellé devient un EtablissementAlias (fusion) ; l’ancien libellé du canonique renommé aussi (script étendu).
- miseAJourCanonique : nom 211, nomNormalise 211, statut 14, niveaux 3.

## Application (non exécutée)

```
cd backend
npx tsx src/scripts/fusion-doublons-plan.ts --plan ../PASSATION_IA/output/2026-09-29-dedup-mali/plan-cycles.json            # simulation
npx tsx src/scripts/fusion-doublons-plan.ts --plan ../PASSATION_IA/output/2026-09-29-dedup-mali/plan-cycles.json --limit 5  # simulation partielle
# --apply seulement après accord explicite du propriétaire, plan de moins de 24 h (sinon régénérer : extract-cycles.js → classify-cycles.js → resume-cycles.js)
```

## 15 exemples SURE (nom avant → après)

| Avant (canonique) | Après | Fiches fusionnées (cycle) | Commune | Distance |
|---|---|---|---|---:|
| Den Kadi 1èc | **Den Kadi** | Den Kadi 1èc (F1) ; Den Kadi 2èc (F2) ; Den Kadi (CDPE) | koutiala|n gountjina | — |
| ESPOIR JIGI | **Espoir JIGI** | ESPOIR JIGI (F2) ; Espoir JIGI (CDPE) ; ESPOIR JIGI (F1) | ML040616 | — |
| AHALIYA [1er C] (FOABOUGOU) | **Ahaliya Foabougou** | AHALIYA [1er C] (FOABOUGOU) (F1) ; AHALIYA [2ème C] (FOABOUGOU) (F2) | ML040406 | 159 m |
| AHALIYA [1er C] | **Ahaliya** | AHALIYA [1er C] (F1) ; AHALIYA [2ème C] (F2) | ML040624 | 171 m |
| BADUMBE | **Badumbe** | BADUMBE (F1) ; BADUMBE SECOND-CYCLE (F2) | bafoulabe|oualia | 0 m |
| ABDOUL KADRI SEGNON [1er C] | **Abdoul Kadri Segnon** | ABDOUL KADRI SEGNON [1er C] (F1) ; Abdoul Kadri Segnon 2è C (F2) | ML050303 | — |
| ACHCAR 2èc | **Achcar** | ACHCAR 2èc (F2) ; ACHCAR 1èc (F1) | koutiala|n gountjina | — |
| Aïné Rahamat Arabanat 1èc | **Aïné Rahamat Arabanat** | Aïné Rahamat Arabanat 1èc (F1) ; Aïné Rahamat Arabanat 2èc (F2) | koutiala|koutiala | — |
| AÏSSATA MAÏGA 1èc | **Aïssata Maïga** | AÏSSATA MAÏGA 1èc (F1) ; AÏSSATA MAÏGA 2èc (F2) | koutiala|koutiala | — |
| Jardin d'Enfants Aliou | **Aliou** | ALIOU [2e C] (F2) ; Jardin d'Enfants Aliou (CDPE) | ML080203 | — |
| AVENIR JE | **Avenir Je** | AVENIR JE (CDPE) ; AVENIR JE (F1) | ML040616 | — |
| COLLEGE G' A.T.T. [2ème C] | **Collège G' A.T.T.** | COLLEGE G' A.T.T. [2ème C] (F2) ; COLLEGE G' A.T.T. [1er C] (F1) | ML040406 | 29 m |
| AL Ahaliat (Sanga) 2èc | **AL Ahaliat Sanga** | AL Ahaliat (Sanga) 2èc (F2) ; AL Ahaliat (Sanga) 1èc (F1) | koutiala|n gountjina | — |
| Al Ane Waar Al Islamiya 1èc | **Al Ane Waar Al Islamiya** | Al Ane Waar Al Islamiya 1èc (F1) ; Al Ane Waar Al Islamiya 2èc (F2) | koutiala|koutiala | — |
| AL IMAM OUSMANE TOURE | **Al Imam Ousmane Toure** | AL IMAM OUSMANE TOURE (F2) ; AL IMAM OUSMANE TOURE (F1) | ML040611 | — |

## Exemples CYCLES_A_VERIFIER (3 par motif)

### MEME_CYCLE
- Adama Dagnon /B (F1, INCONNU) ; Adama Dagnon /B (F2, INCONNU) ; Adama Dagnon /B (F1, INCONNU) — même cycle des deux côtés (F1 / F1) : Adama Dagnon /B / Adama Dagnon /B
- AÏTE [1er C]ycle (F1, PUBLIC) ; AÏTE (F1, PUBLIC) — même cycle des deux côtés (F1 / F1) : AÏTE [1er C]ycle / AÏTE
- Al Medersa Nourou Mohamed(Kourouma) (F1, PRIVE) ; Al Medersa Nourou Mohamed(Kourouma) (F1, PRIVE) ; Al Medersa Nourou Mohamed(Kourouma) (F2, PRIVE) — même cycle des deux côtés (F1 / F1) : Al Medersa Nourou Mohamed(Kourouma) / Al Medersa Nourou Mohamed(Kourouma)

### NOM_TOPONYME
- École Adamabougou (F1, PUBLIC) ; ADAMABOUGOU (F2, INCONNU) — nom de base = nom de la localité (« adamabougou ») sans code cluster MEN commun
- Aguel-Hoc [2ème C] (F2, PUBLIC) ; CDPE Aguel-hoc (CDPE, INCONNU) — nom de base = nom de la localité (« aguel hoc ») sans code cluster MEN commun
- ALLAHINA (F1, PUBLIC) ; Allahina (F2, INCONNU) — nom de base = nom de la localité (« allahina ») sans code cluster MEN commun

### DISTANCE
- École privée Alikaou Blen 1er cycle (F1, INCONNU) ; École privée Alikaou Blen 1er cycle (F1, INCONNU) ; École privée Alikaou Blen (?, INCONNU) ; École privée Alikaou Blen 2nd cycle (F2, INCONNU) — même cycle des deux côtés (F1 / F1) : École privée Alikaou Blen 1er cycle / École privée Alikaou Blen 1er cycle ; distance 621 m ≥ 500 m (ml-osm-02d7a9e439eb4f9d3763d647 / ml-osm-7c738b41f1e11e9b4f65d174)
- ALMAMY KOUREISSI [1er C] (F1, PUBLIC) ; ALMAMY KOUREISSI [2ème C] (F2, PUBLIC) — distance 681 m ≥ 500 m (ml-osm-163ab1388e02aa5dcb4fb23f / ml-osm-4e2e7ebb659e6b3077662343)
- BABOUGOU (?, PUBLIC) ; BABOUGOU [2ème C] (F2, PUBLIC) ; CDPE BABOUGOU (CDPE, INCONNU) — nom de base = nom de la localité (« babougou ») sans code cluster MEN commun ; cycle inconnu pour ml-osm-26209b5537eb2c0f288b04e6 (BABOUGOU)

### CYCLE_INCONNU
- ATTARA (?, PUBLIC) ; CDPE-Attara (CDPE, INCONNU) — nom de base = nom de la localité (« attara ») sans code cluster MEN commun ; cycle inconnu pour ml-osm-16ff3fb6738350cd8e12d499 (ATTARA)
- École primaire de Badumbé (?, PUBLIC) ; BADUMBE [2ème C] (F2, PUBLIC) — cycle inconnu pour ml-osm-4055475c3f42e39f4b60e9cd (École primaire de Badumbé)
- BAGUINI (?, INCONNU) ; Baguini (F1, INCONNU) ; CDPE Baguini (CDPE, INCONNU) — nom de base = nom de la localité (« baguini ») sans code cluster MEN commun ; cycle inconnu pour ml-osm-e6e907d20ffe26fee3d88092 (BAGUINI)

### CYCLE_CONTRADICTOIRE
- BAGADADJI [2ème C] (CDPE+F2, PUBLIC) ; Bagadadji (F2, PUBLIC) — même cycle des deux côtés (CDPE+F2 / F2) : BAGADADJI [2ème C] / Bagadadji ; fiche ml-osm-09835a1defb3be88f9c4ae53 : cycle du nom (F2) ≠ cycle du registre (CDPE)
- BANANKORONI [2ème C] (F1+F2, PUBLIC) ; École Fondamentale Banankoroni (F2, PUBLIC) — nom de base = nom de la localité (« banankoroni ») sans code cluster MEN commun ; même cycle des deux côtés (F1+F2 / F2) : BANANKORONI [2ème C] / École Fondamentale Banankoroni
- BORKO [1er C]YCLE (F1, PUBLIC) ; BORKO [2ème C] (F1+F2, PUBLIC) ; Borko (F2, INCONNU) — nom de base = nom de la localité (« borko ») sans code cluster MEN commun ; même cycle des deux côtés (F1 / F1+F2) : BORKO [1er C]YCLE / BORKO [2ème C]

### STATUT
- BOUGOUNI [2ème C]YCLE (F2, PUBLIC) ; BOUGOUNI [1er C] (F1, INCONNU) ; Bougouni (F1, INCONNU) ; Bougouni (F2, INCONNU) ; Jardin d' enfants de Bougouni (CDPE, PRIVE) — nom de base = nom de la localité (« bougouni ») sans code cluster MEN commun ; même cycle des deux côtés (F2 / F2) : BOUGOUNI [2ème C]YCLE / Bougouni
- BREHIMA OULALE [2ème C]ycle /B (F2, PRIVE) ; BREHIMA OULALE [1er C]/B (F1, PUBLIC) ; BREHIMA OULALE /B (F2, INCONNU) — statuts différents PRIVE/PUBLIC ; même cycle des deux côtés (F2 / F2) : BREHIMA OULALE [2ème C]ycle /B / BREHIMA OULALE /B
- DIAKY-WERE [1er C] (F1, PUBLIC) ; DIAKY WERE [2ème C]YCLE (F2, PUBLIC) ; Diaky-were (F2, INCONNU) ; Jardin d' enfants de Diaky-wèrè (CDPE, PRIVE) — nom de base = nom de la localité (« diaky were ») sans code cluster MEN commun ; statuts différents PUBLIC/PRIVE

### ENSEIGNEMENT
- Dar Hadiss (F1, PRIVE) ; Dar Hadiss (F2, PRIVE) — enseignement Medersa / Classique
- G. S. Cissé FA (F2, PRIVE) ; G S Cissé FA (F1, PRIVE) ; G S Cissé FA (CDPE, PRIVE) — enseignement Medersa / Classique
- I.E.A . Islamiques (F2, PRIVE) ; I.E.A . Islamiques (F1, INCONNU) ; I.E.A . Islamiques (F1, PRIVE) — enseignement Medersa / Classique ; même cycle des deux côtés (F1 / F1) : I.E.A . Islamiques / I.E.A . Islamiques

### NOM_PROPOSE
- E.P Maari °C (F1, PRIVE) ; E.P Maari °C (F2, PRIVE) — aucun libellé exploitable sans marqueur de cycle

### COMMUNE_MULTI
- École Sebete (F1, PUBLIC) ; SEBETE (F2, INCONNU) — nom de base = nom de la localité (« sebete ») sans code cluster MEN commun ; fiche ml-osm-99ee1da0d63b1c2b3f19888a rattachée à plusieurs communes (ML020107, ML020109)
- TOTA (F1, PUBLIC) ; Tota (F2, INCONNU) — nom de base = nom de la localité (« tota ») sans code cluster MEN commun ; fiche ml-osm-185b3e5467a51048cdad9361 rattachée à plusieurs communes (ML020106, ML020108)

### COMMUNE
- Ecole fondamentale de Somo second cycle (F2, PUBLIC) ; CDPE Somo (CDPE, INCONNU) ; Somo (F2, INCONNU) ; Somo (F1, INCONNU) ; SOMO SECOND CYCLE (F2, PUBLIC) — nom de base = nom de la localité (« somo ») sans code cluster MEN commun ; même cycle des deux côtés (F2 / F2) : Ecole fondamentale de Somo second cycle / Somo

## Tous les groupes SURE (525)

| # | Nom après | Canonique | Fusionnés | Cycles | Commune | Maj |
|---:|---|---|---|---|---|---|
| 1 | A.H.M | `ml-registre-7214a867ff44119560a0a69d` | `ml-registre-d335615332190fc9d4ba3680` | F2 / F1 | ML070101 |  |
| 2 | A.O.Bah | `ml-registre-1567707272bc1a2e658f77dc` | `ml-registre-205d90dd7d2a92c9b6dae078` | F2 / F1 | ML040305 |  |
| 3 | Abdoul Kadri Segnon | `ml-osm-7608e607e9e7471c6e33a216` | `ml-registre-1412b1914e25a62e13802c36` | F1 / F2 | ML050303 | nom |
| 4 | Abdoul Wahid | `ml-registre-67d108fc4e84e5270e929dd7` | `ml-registre-adcaa8b6b0da115c7daf4ca1` | F1 / F2 | ML050609 |  |
| 5 | Achcar | `ml-registre-61a6f998cb80e2f936ba8b25` | `ml-registre-a5e8bf40857f647354c271c2` | F2 / F1 | koutiala|n gountjina | nom |
| 6 | Adama Coulibaly | `ml-registre-0ebb526d73447dcf47e0b1b5` | `ml-registre-dd57fa5451dcc91ab9e358c9` | F2 / F1 | ML030519 |  |
| 7 | Adama Dagnon /A | `ml-registre-220a35a51df0f396f5bf4fad` | `ml-registre-cd03318678ec21f2360d3e6e` | F2 / F1 | ML040620 |  |
| 8 | Adawal Al islamia | `ml-registre-44f009cfbd7460c88544ab0d` | `ml-registre-89e0af952abb04155554e37c` | F2 / F1 | ML050614 |  |
| 9 | Ahaliya Foabougou | `ml-osm-1650b88c0a923dd9e2aefb65` | `ml-osm-2e3f9061d82fa82f7d7b69a0` | F1 / F2 | ML040406 | nom |
| 10 | Ahaliya | `ml-osm-a02874999f59dbbd3ba353c9` | `ml-osm-dd846c62f01252b33e83b163` | F1 / F2 | ML040624 | nom |
| 11 | Ahalya Foabougou | `ml-registre-c1b27fe180b6f7c8a5582155` | `ml-registre-f07414f15435d633c9f54000` | F2 / F1 | ML040406 |  |
| 12 | Aide à l'Enfance | `ml-registre-6087dc710ba2e2b0a12dd151` | `ml-registre-8eae209b0ea88d43164d7f14` `ml-registre-fb369c56d56bb7ce9201d7cc` | CDPE / F2 / F1 | ML030204 |  |
| 13 | Aïné Rahamat Arabanat | `ml-registre-3af2cd4a0e1fe87b0bafca87` | `ml-registre-eb5e10453da29d718f828949` | F1 / F2 | koutiala|koutiala | nom |
| 14 | Aïssata Maïga | `ml-registre-09edb9a447b3117919538aa8` | `ml-registre-c824872b11249f922b5fe765` | F1 / F2 | koutiala|koutiala | nom |
| 15 | AL Ahaliat Sanga | `ml-registre-979131d08d5e2a993bf00229` | `ml-registre-be16e39d268cc4ac19f36e3b` | F2 / F1 | koutiala|n gountjina | nom |
| 16 | Al Ane Waar Al Islamiya | `ml-registre-74d95847a51d059dcfb75fd0` | `ml-registre-ffdd2b4e4c3b9cab0dbd67ac` | F1 / F2 | koutiala|koutiala | nom |
| 17 | Al Imam Ousmane Toure | `ml-registre-a073b54df961a7054bc6da2a` | `ml-registre-fdd89226794c0026e180ad2e` | F2 / F1 | ML040611 | nom |
| 18 | Al Islahi Wal Najahi | `ml-registre-30b66fb8bf3eb21c582a336d` | `ml-registre-7730e689f051beaffa854529` | F1 / F2 | ML040626 |  |
| 19 | Al Islamiyatou Ismailiyatou Sorobasso | `ml-registre-82b35fe2a91bfe31fda64a2e` | `ml-registre-ef618888984e4cc65bb2932c` | F1 / F2 | koutiala|sorobasso | nom |
| 20 | Al Kafalatou Al islam | `ml-registre-b860f2a888ba1c54903bfdc4` | `ml-registre-cb74e5d92e6d68fa884501b7` | F1 / F2 | ML040626 |  |
| 21 | Alamou Taouhid | `ml-registre-0907392b59801cb0fea3853e` | `ml-registre-98bdfc227d8bcc9813c531fe` | F2 / F1 | ML030507 |  |
| 22 | Alfaouzouwa Nadiahi | `ml-registre-0b291064d7722387b12d18c3` | `ml-registre-d9602e210768c2a94de764f5` | F1 / F2 | ML050609 |  |
| 23 | Alfarouk El Islamiya | `ml-registre-2ecfb8c00f296e07af4d9379` | `ml-registre-e052776e76fcf45bba49aecb` | F1 / F2 | koutiala|n gountjina | nom |
| 24 | Aliou | `ml-registre-1264d870898ef407067dae53` | `ml-osm-6c1cc2390107150bc2038449` | F2 / CDPE | ML080203 | nom, statut |
| 25 | Almagsam Atila | `ml-registre-294b2349da5dd3df547638af` | `ml-registre-c0b3698852b2ed0579353d5a` | F1 / CDPE | ML060505 |  |
| 26 | Alpha Seydou | `ml-registre-621d2aafab8dc816a84eafa4` | `ml-registre-c00658c46d038ac740131112` | F1 / CDPE | ML070101 |  |
| 27 | Aly KONATE | `ml-registre-552a037e0c36bff1f038623a` | `ml-registre-bb158c1b6238c2e611f9b5de` | F1 / F2 | koutiala|sincina | nom |
| 28 | AMA Association des Musulmans d'Afrique | `ml-registre-e32e7255abe0665fa4fbf534` | `ml-registre-e60022939f480c0f9c3b2e32` | F2 / F1 | ML050101 | nom |
| 29 | Amachach | `ml-osm-9ff716e08dfa49e7c24ac4c3` | `ml-registre-ac0e48a9caf03267a1641f2c` | F1 / CDPE | ML080302 |  |
| 30 | Amadou dit Koké Minta | `ml-registre-101e8e2acd3163e3f1f2c101` | `ml-registre-8bab124f558d85ac062b4b03` | F1 / F2 | ML050609 |  |
| 31 | Amayowo | `ml-registre-0a493607a163aea8ac7ea36d` | `ml-registre-a5f27290adaea20b14085b70` | F1 / F2 | ML050101 |  |
| 32 | Amene Kodio A | `ml-osm-fd97865eb0c37bb5b4781d5a` | `ml-registre-0b48556cddbe9235601e13d1` | F1 / F2 | ML050212 | nom |
| 33 | Amene Kodio B | `ml-osm-7e9f6b52aeb18f42c9c3f024` | `ml-registre-e51532b81851618b1b1b47bb` | F1 / F2 | ML050212 | nom |
| 34 | Aminata KOUYATE | `ml-registre-db67df5012a832d5a5740b1d` | `ml-registre-def5578d6ab1234a6a33ddf6` | F2 / F1 | koutiala|koutiala | nom |
| 35 | Anakila | `ml-registre-d1f8fe0d8227c52f4dcc36c2` | `ml-registre-fa9300027e401e4028d28c33` | CDPE / F1 | ML050504 |  |
| 36 | Annadia Walhouda | `ml-registre-9ee5301937b8607cc97d3e6b` | `ml-registre-c4fc9c19ff67cbf26469cf2b` | F2 / F1 | ML050609 |  |
| 37 | Annadiah Medina Coura | `ml-registre-152a08411ad6c57b8c6e3faf` | `ml-registre-dc7e401b059466b6c14aa2f9` | F1 / F2 | ML050609 |  |
| 38 | Annour | `ml-registre-015376b766d6f30a9d7faeff` | `ml-registre-8ad58b0758f07bd42b99b40a` | F2 / F1 | ML050609 |  |
| 39 | Ansamba Yanogué de Goro | `ml-registre-4f551f3f7d3d0b55e56cb5a3` | `ml-registre-57a284603ec249f20350caa0` | F2 / F1 | ML050107 |  |
| 40 | Ansardine Djenédaga | `ml-registre-044ee124c1a921689016d705` | `ml-registre-91a622831c209ba23c0e88f1` | F1 / F2 | ML050609 |  |
| 41 | Ansardine Moss. | `ml-registre-723996f8b97e6fc0925b45e9` | `ml-registre-a2b6359e871c4bf478f738df` | F2 / F1 | ML050609 |  |
| 42 | Ansardine Sévaré | `ml-registre-195b009c6c04315b52242bbb` | `ml-registre-c56a09bee00695f702959aad` | F1 / F2 | ML050609 |  |
| 43 | Antoine Atoïn Dara | `ml-registre-3b90f6e38f12e686ba54d092` | `ml-registre-6b12fe58b3d0495ed3395062` | F1 / F2 | ML050502 | nom |
| 44 | Appui au Sahel | `ml-osm-0f17805ba57109dfb9cacf08` | `ml-registre-d590cf1faf515fc18e8676ae` | F1 / F2 | ML040406 | nom |
| 45 | Arayane | `ml-registre-24a83cbcb4fcd74fe27b885d` | `ml-registre-f3d561187b3c92f72d1b982b` | F2 / F1 | koutiala|koutiala | nom |
| 46 | Aridouane | `ml-registre-926e20634553ecf607e5f46d` | `ml-registre-a2206e618c9cab6e3bcde0e9` | F2 / F1 | koutiala|koutiala | nom |
| 47 | Arissalatou Mouhamadiyatou Sanguéla | `ml-registre-504e1de93c83e8950ddc16cf` | `ml-registre-8354366044988b49e8041854` | F1 / F2 | koutiala|gouadji sougouna |  |
| 48 | Assadiq de Bienfaisance | `ml-registre-beff4337b4a4ad1eda35fe13` | `ml-registre-f4f19e24b95cd5ac6291210d` | F1 / F2 | ML060303 | nom |
| 49 | Assidikiya | `ml-registre-2231128214b245968765ea7b` | `ml-registre-48ae2e8dbe7e80d727ab76a1` | F1 / F2 | koutiala|koutiala | nom |
| 50 | Attawacoulo | `ml-registre-2096e940084ab4be88028722` | `ml-registre-ca9f7dca1582fabe5f53fae6` | F2 / F1 | koutiala|koutiala | nom |
| 51 | Avenir Je | `ml-registre-67bc10fdcbb8e46c1e5b1a1c` | `ml-registre-e22ed395bc03cff4553739ab` | CDPE / F1 | ML040616 | nom, statut |
| 52 | Awreiwira | `ml-registre-4c2e22966d8162b779c77880` | `ml-registre-dd76dc9d04419b888e4e66cf` | CDPE / F1 | ML060505 | nom |
| 53 | B.N.T | `ml-registre-248b7d56fd42837c86fc715a` | `ml-registre-984ee31b193d62749d1e8de2` | F2 / F1 | ML040310 | nom |
| 54 | Baba Traoré | `ml-registre-b2d017e28333916313161c92` | `ml-osm-bef7a4ce7e0d2cd4b6f56145` | F2 / CDPE | ML040408 | nom |
| 55 | Badumbe | `ml-registre-e33da403d82e8dac79cbe003` | `ml-registre-e68c5f9e706de7bc97ba5176` | F1 / F2 | bafoulabe|oualia | nom |
| 56 | Bagadadji Km 36 | `ml-registre-9914214d6d5979c8b87ab59b` | `ml-registre-d2e29ee71e81755b87956139` | F2 / F1 | niono|sirifila boundy, ML040409 |  |
| 57 | Bakari Kamian | `ml-registre-6819ad65d12dc47d643bac0a` | `ml-registre-fe05ab10950184da85842110` | F2 / F1 | ML050308 | nom |
| 58 | Banine Wal Banati Misséni | `ml-registre-7d18730fb5f805188e05b553` | `ml-registre-ab8140d6a2137ad2d2441639` | F2 / F1 | ML030207 | nom |
| 59 | École prive Barela | `ml-osm-f257bf75fac2e02e13752bec` | `ml-registre-b59b206e39903431bbb9e03d` | F1 / F2 | ML020415, kati|kalabancoro | nom |
| 60 | Bargondaga | `ml-registre-0a8dfd77ef197ba762cbe117` | `ml-registre-3029af97fa20d3a9a96d914f` | F1 / F2 | ML050609 |  |
| 61 | Bas Fond Ibrahima TEMBELY | `ml-registre-15714e0dab7966e2a37c2bed` | `ml-registre-1dc4361c9d2e4cedb5ec63a5` | F2 / F1 | ML050609 | nom |
| 62 | Bazil Mawa | `ml-registre-0f4a18083ab30057611cb623` | `ml-registre-f6e03af8cd9b72761315a354` | F2 / F1 | ML050614 |  |
| 63 | Bertha | `ml-registre-164d77000bcc5f1969a2f8ba` | `ml-registre-d51af69e4181acf60f9c6056` | F2 / F1 | ML040308 |  |
| 64 | Bilal Islamiya | `ml-registre-42ba041e504533b756222e0e` | `ml-registre-d394e5bb8d08d58bb4393925` | F1 / F2 | koutiala|koutiala | nom |
| 65 | Bilali SANOGO | `ml-registre-08af762e42acf540086ca714` | `ml-registre-8aea0f54e1ee10da9bd2319e` | F2 / F1 | koutiala|sincina | nom |
| 66 | Bô Sangaré | `ml-osm-21600db4aab992f360b49d40` | `ml-registre-0f162101f06698a84b535b13` | F1 / F2 | ML090104, bamako|commune iv |  |
| 67 | Borogoba | `ml-registre-332680765b6f17fefab7352e` | `ml-registre-3d0c063b42c803663612e859` | F2 / F1 | ML030204 |  |
| 68 | Bouréma Kanté | `ml-registre-11013835ec2ff8825189d5cc` | `ml-registre-22e6a0372845c82fec7539d4` | F1 / F2 | ML030525 |  |
| 69 | Bourhahimidine El Islam | `ml-registre-6c88aa9da5394a211879f2a7` | `ml-registre-77452aa4a46457049bbbbb02` | F2 / F1 | koutiala|koutiala | nom |
| 70 | Brehima Oulale A | `ml-osm-3e9dc57ade3b102998753562` | `ml-registre-e135e74527332c4db1354434` | F1 / F2 | ML040620 | nom |
| 71 | C.M.G.A.T .T. | `ml-registre-54d3f585ce7c10013805f7e8` | `ml-registre-d277aee43b123c2c908369fe` | F1 / F2 | ML040406 |  |
| 72 | C.S.L.Samassékou | `ml-registre-d225b81514d529361b3f4412` | `ml-registre-f9ea9bb8f60c0f6d0085bd5a` | F1 / F2 | ML050609 |  |
| 73 | C.S.Larabi | `ml-registre-38558145ccd76dc48dafdc73` | `ml-registre-ebc081362e5e458018ca86f7` `ml-registre-fc2df07451934b96d171c0a5` | CDPE / F2 / F1 | ML050609 |  |
| 74 | C. Scolaire Y.B.Koné | `ml-registre-779271d83dad0549ba45ae27` | `ml-registre-e7adbad3e5557870645907d5` | F1 / CDPE | ML050614 |  |
| 75 | Cefak | `ml-registre-5416d1008979eb80be30ec2c` | `ml-registre-be5fd82832e4abac8dc15568` | F1 / CDPE | ML050304 | nom |
| 76 | École Cendrillon | `ml-osm-2865ba00d9bd2ecb3e66204b` | `ml-registre-41c80483c61262cd83d66238` | F1 / F2 | ML090106, bamako|commune vi | nom |
| 77 | Cheick Modibo DIARRA | `ml-registre-129e49e08e0f677c5a8389c2` | `ml-registre-90fe58a471f23c438bd044e9` | F1 / F2 | ML030203 |  |
| 78 | Collège Cheick Anta Diop | `ml-registre-9c0df293002c7f3ce4166852` | `ml-registre-e63088942559f85c9ce884ce` | F2 / F1 | ML040406 | nom |
| 79 | Collège G' A.T.T. | `ml-osm-78554166688805e73881271b` | `ml-osm-d866fc0fac7b26fa4bba6fc3` | F2 / F1 | ML040406 | nom, niveaux |
| 80 | Collège Moderne Adja Fanta Touré | `ml-registre-3021fa7286831ff6cf0599e7` | `ml-registre-da00e93c6d6339d1221344b9` | F2 / F1 | ML040626 | nom |
| 81 | Collège Moderne de Sincina | `ml-osm-260d9c162e19184068b641f5` | `ml-osm-4a163810f974bbbb0e2a5145` | CDPE / SEC | ML030416 | nom, niveaux |
| 82 | Collège Pr Julia SAADE | `ml-registre-097e5b68815719e70c85beaa` | `ml-registre-84765b282bd6410b55e50cb7` | F1 / F2 | koutiala|koutiala | nom |
| 83 | Collège SAMUEL | `ml-registre-098fd1d030d88d82c79aabb0` | `ml-registre-259b2d6d3a943e3cf5c1724d` | F1+F2 / CDPE | koutiala|koutiala | nom |
| 84 | Daa Watoul Islamiya | `ml-registre-d80ebff685037d89da508ad4` | `ml-registre-e4ddf3b03cc43389cbf26939` | F2 / F1 | koutiala|koutiala | nom |
| 85 | Daga Tereli | `ml-registre-c50b1a06d7dd9977e03b13cb` | `ml-registre-cec3bcc80c7f345bdaf87f2b` | F1 / CDPE | ML050117 | nom |
| 86 | Dally Doucoure | `ml-registre-7db499e8a7c7321c4916d387` | `ml-registre-b7e9c4348c79b19f89bcb259` | F1 / F2 | ML020709 |  |
| 87 | Damassongo | `ml-registre-6d1597ffee231d76b53e55ba` | `ml-registre-dfaba7649d2e5ae2e50c6471` | CDPE / F1 | ML050501 |  |
| 88 | Daoula - Sonzana | `ml-registre-0c87bc8ec6e4a94f68534c04` | `ml-registre-42813a41fc8bfd35aae5f4c3` | F2 / F1 | ML030523 |  |
| 89 | Dar Al Ouloum Med | `ml-registre-bf5cc94396e7c854244e7245` | `ml-registre-f390424946b65c8647415e75` | F2 / F1 | sikasso|lobougoula | nom |
| 90 | Dar El Hadiss | `ml-registre-d9bd2e6b607ccc36905d1008` | `ml-registre-eca85835844e2a3f78504a92` | F1 / F2 | ML040625 |  |
| 91 | Dar Hadis Niaré | `ml-registre-046c14d4f71b94977036c03c` | `ml-registre-5f7264f671075c5d7f6a6c26` | F1 / F2 | ML020110 |  |
| 92 | Daral Hadis Al Kuran | `ml-registre-26bc0bdcd0ba09bcd1c26ca9` | `ml-registre-4d41baf26df7a899a4eb64ad` | F2 / F1 | ML050201 | nom |
| 93 | Daros Hadiss Son | `ml-registre-516bf81cad8a18139309cbf8` | `ml-registre-92ca10fe00dc5960b16f495f` | F1 / F2 | ML040629, segou|souba |  |
| 94 | Darouchafakati | `ml-registre-a46fc966fdd0b5dedfd383c2` | `ml-registre-cb5c907d17dcfc3a599ccd55` | F1 / F2 | ML030207 |  |
| 95 | Daroul Coraan W-H | `ml-registre-519952cc5233118357469470` | `ml-registre-f121d989d42d89f7fccf5c52` | F2 / F1 | ML040626 |  |
| 96 | Daroul Hadis Péguéna | `ml-registre-0813349ac961fc5b28e48791` | `ml-registre-ece4579735bce5ddfde7195f` | F2 / F1 | ML040406 | nom |
| 97 | Dawatil | `ml-registre-68de9b9155570436b98e0f59` | `ml-registre-e5f1a2cfe48cafbca0335edd` | F2 / F1 | ML040305 |  |
| 98 | Demba Gnuma | `ml-registre-10e5d48d2801317d69c39c85` | `ml-registre-5e8c681de202ba2002827ccf` | F2 / F1 | koutiala|koutiala | nom |
| 99 | Den Kadi | `ml-registre-5a76eb592c875f17c0d83b7e` | `ml-registre-736dc418784b6538aedaa9fb` `ml-registre-fbcad0b331cf8a0a2fa10e4c` | F1 / F2 / CDPE | koutiala|n gountjina | nom |
| 100 | Diallangou | `ml-registre-4edb993944defcf01769ba50` | `ml-registre-dd4d1cf9d442e976c1b81e95` | F1 / CDPE | ML050614 |  |
| 101 | Diambourou | `ml-registre-6fee72c09dff1201bda50917` | `ml-registre-a0d60dd91890e9e958384877` | CDPE / F1 | ML060308 | statut |
| 102 | Diamstaki | `ml-registre-2bb662dec46a9fdf9acf50ce` | `ml-registre-73eb4e8f35220b0dfa0f62ab` | F2 / F1 | koutiala|koutiala | nom |
| 103 | Dico SAKHO | `ml-registre-31f0f68489491d03e1998c2b` | `ml-registre-4d1a24c937c4724b9f9c37d7` | F2 / F1 | koutiala|koutiala | nom |
| 104 | Diondiori Catholique | `ml-registre-8eee7711f10ec15cd3269a73` | `ml-registre-bd3e482c67a5644150c366e9` | F1 / F2 | ML050614 |  |
| 105 | Djama Jigui Niamanasso | `ml-registre-00bca78e5dc9abf3457ec118` | `ml-registre-3cdcf1792efd254a55755645` | F1 / F2 | koutiala|n golonianasso | nom |
| 106 | Djibril Barry | `ml-registre-20a66d8114f1e46f51ee753b` | `ml-osm-2684f3c0fa1624ea1b621d2c` | F2 / CDPE | ML050512 | nom, statut |
| 107 | Djichini | `ml-registre-f4a2be33e242c7e27c24e70d` | `ml-registre-ff655566288b39bf6a645038` | F2 / F1 | ML070101 | statut |
| 108 | Djiguiya | `ml-registre-718e5eefb8da02e56b7ea6f3` | `ml-registre-a76d1b61c8c037c2802ab2c1` | F1 / F2 | ML050609 |  |
| 109 | Doundiourou | `ml-osm-d850bab150d4bdedf12f0953` | `ml-registre-e4fea25c8e27cec0c0c06fe7` | F1 / F2 | ML050108 | nom |
| 110 | Dououli Ilmihi Wassakafati | `ml-registre-1235cbcb71c63af2f4da29de` | `ml-registre-51e2db4353c3047288828cb6` | F1 / F2 | ML040612 | nom |
| 111 | E.C Dembayuman | `ml-registre-35bb81cef4aeeae52ef8f320` | `ml-registre-cc1e410cd69aac5d7eb34a05` | F2 / F1 | ML040626 |  |
| 112 | E.C Denbaw Jigi | `ml-registre-dcebd526c207acd55950add6` | `ml-registre-f926a1229dda3ea5d8aa888f` | F2 / F1 | ML040626 |  |
| 113 | E.C les Allies | `ml-registre-97e288926ac9dbc6c4380425` | `ml-registre-b027f940653a6765a34a91f5` | F2 / F1 | ML040626 | nom |
| 114 | E.D.A | `ml-registre-6e68b041b15bf1263998b07c` | `ml-registre-ea3d2f9a95b230040220c893` | F1 / F2 | ML040626, segou|segou |  |
| 115 | E.M.Sogodogo | `ml-registre-92dcf5d0b7b25a02735e040c` | `ml-registre-ab745853923ec1bc01dd588a` | F1 / F2 | sikasso|kouoro | nom |
| 116 | E.P- A.H.BÂ | `ml-registre-32d23a338398bfc89ef861f3` | `ml-registre-688892266a69492191fa7202` | F2 / F1 | ML040626 |  |
| 117 | E.P Aïssata Kané | `ml-registre-8cd9681207375dabe934be08` | `ml-registre-a249b15bff6513c31e8d2e36` | F1 / F2 | ML040626 |  |
| 118 | E.P Amadou farota | `ml-registre-43a95b92fce1176b9c17a843` | `ml-registre-dd14ee8d7d2cfad2f57dee30` | F2 / F1 | ML040620 |  |
| 119 | E P Baarama | `ml-registre-ddc49f06389089468237c6f4` | `ml-registre-fdbc3a1d20e5819d067d25b3` | F1 / F2 | macina|macina |  |
| 120 | E P Baba MAÏGA M'Bewani | `ml-registre-196a9f925b67872fd776eb0e` | `ml-registre-defbe399260e943061e25899` | F2 / F1 | niono|pogo | nom |
| 121 | E.P Babougou N'Dji | `ml-registre-9cd6b7667e664ef4850493fe` | `ml-registre-d0ea7f3b283224a68d403008` | F1 / F2 | ML040620 |  |
| 122 | E.P Bahawa Coulibaly | `ml-registre-2184abf9bb41cd0c9b5b9b45` | `ml-registre-dc1838a7d948d46f555ae0c3` | F1 / F2 | ML040620 |  |
| 123 | E.P Bakary Keïta | `ml-registre-5bda64523aa6bd8bf01351dc` | `ml-registre-77f883dc2feffb0f372d5cf7` | F2 / F1 | ML040620 |  |
| 124 | E.P Bourema Sidi Cissé | `ml-registre-1a42aadc08bb43b63bd340d5` | `ml-registre-52a202de10c6a7bc2998ea4e` | F1 / F2 | ML040620 |  |
| 125 | E.P Cheick Modibo Diarra | `ml-registre-0373fda00ab2af358ad1b88a` | `ml-registre-aa1bbbd649c5a493f0187e3c` | F1 / F2 | ML040626 | nom |
| 126 | E.P D.Tangara | `ml-registre-7620ef2bd13f83e9fe8962cf` | `ml-registre-9ae73afa42a3de04c0faedad` | F2 / F1 | ML040626 |  |
| 127 | E.P.F.A Ramatoulaye | `ml-registre-45d099649cd61f1c0dcd9cc6` | `ml-registre-af8fc3760d72e6a93b0262fe` | F1 / F2 | ML040626 | nom |
| 128 | E.P Fatoumata Koné | `ml-registre-5286795dd594b831939fdfd4` | `ml-registre-bb6e7172f43ed855a715fbec` | F1 / F2 | ML040626 | nom |
| 129 | E.P Gavardo | `ml-registre-7dbd159ec1bfebec6a57cb5d` | `ml-registre-bbff0cbb275c41d2e8e58bea` | F1 / F2 | ML040620 |  |
| 130 | E.P Indépendance | `ml-registre-5282410052e70f3444de4853` | `ml-registre-a646566b3283ba8db1b76147` | F2 / F1 | ML040626 |  |
| 131 | E.P Jean Marie Dakouo | `ml-registre-032cfcc6148ac12a9e400355` | `ml-registre-f7576a2cbfa9342e26e019c9` | F1 / F2 | ML040626 |  |
| 132 | E.P.K | `ml-registre-62071efe08aee3a8cbd06481` | `ml-registre-788d32d0e33807c3a3189f5e` | F1 / F2 | bamako|commune iv |  |
| 133 | E.P Kalanso Niaro karamoko | `ml-registre-cdcfe8f4c725abb0bbfa9ca8` | `ml-registre-f91289c1e86f4465730992a3` | F1 / F2 | ML040626 |  |
| 134 | E.P Kawsar | `ml-registre-b1d680b1c7d36be299f2bbdc` | `ml-registre-ed047feba1272e5ce9a0773b` | F1 / F2 | ML040625 |  |
| 135 | E.P Ladamuso | `ml-registre-8ea8b894ceada2cbd2513b2c` | `ml-registre-944368e85c125b7cf09caf83` | F1 / F2 | ML040626 |  |
| 136 | E.P Larousse | `ml-registre-619a9affa8afb691b83fae0a` | `ml-registre-e209261fe692f9e6896326c7` | F2 / F1 | ML040626 |  |
| 137 | E.P Le Bon Berger | `ml-registre-2763666adba74a07bcb915d9` | `ml-registre-a9aee0286485971c43b4914e` | F2 / F1 | ML040626 |  |
| 138 | E.P Les Génies | `ml-registre-94e887f50c36b175a0268e4b` | `ml-registre-f97dced2aa4ca7b306611609` | F1 / F2 | ML040626 |  |
| 139 | E.P les Oasis | `ml-registre-4ef6404d42c53c4aab16622e` | `ml-registre-a8ca718e015ee2ebd611ff2f` | F2 / F1 | ML040626 | nom |
| 140 | E.P Les Savoirs | `ml-registre-1598fbb58a5362ce83845ecd` | `ml-registre-d723ac19392d236de76011e2` | F2 / F1 | ML040626 |  |
| 141 | E.P Maître Mountaga Tall | `ml-registre-47bcc198a9fea7f062c4cd4d` | `ml-registre-54115d1d31d06eb5215742de` | F1 / F2 | ML040626, segou|segou |  |
| 142 | E.P Maria Blanca | `ml-registre-143dc65e0ab4c08a85f86f8d` | `ml-registre-16ab7556a5ad01d3a508c71f` | F2 / F1 | ML040626 |  |
| 143 | E.P Moussa Diaby | `ml-registre-17044170af63e24c040db4d3` | `ml-registre-43f7fbeb8c0bfe33155282b5` | F1 / F2 | ML040626 |  |
| 144 | E.P Nelson Mandela | `ml-registre-6c5d62d8fcaeaf5185db237b` | `ml-registre-8bf44626845c29f11adf19c5` | F2 / F1 | ML040626 |  |
| 145 | E.P Rokia Traoré | `ml-registre-182a489dd722d3d7df09afa9` | `ml-registre-6c8f79cc7054575d8c7986cd` | F2 / F1 | ML040626 | nom |
| 146 | E.P Vicenta Maria | `ml-registre-33fe37732bf0ea062e2b8295` | `ml-registre-578b2d83ae197cb52b2da5b4` | F1 / F2 | ML040626 |  |
| 147 | E.P Walia | `ml-registre-13b59f4ba58de1f1f3936b61` | `ml-registre-1bf3a09da5b76eed78f4e041` | F2 / F1 | ML040626 |  |
| 148 | E.P Yaya Dembele | `ml-registre-54ec178a58086fc605d4f72b` | `ml-registre-c111407631181a8ab8b503ad` | F2 / F1 | ML040620 | nom |
| 149 | E.Pr Abbé Pièrre Kanouté | `ml-registre-32882b2b4afe0382fc723707` | `ml-registre-d2d07ae66885b83e57140abb` | F2 / F1 | sikasso|sikasso |  |
| 150 | E.Pr Aimée Césaire | `ml-registre-153218ab65062c0cf48d1be8` | `ml-registre-3f056e25adcaf53daf6dd123` | F1 / F2 | sikasso|sikasso |  |
| 151 | E.Pr Amadou Sogodogo | `ml-registre-1641aefe4413f51cb3274dd1` | `ml-registre-766788577c41dd9128ec1360` | F1 / F2 | sikasso|sikasso |  |
| 152 | E.Pr Awa COULIBALY | `ml-registre-77963fd1af956c08e2c5c019` | `ml-registre-acccdf4b5a43d9fbe8e1ea84` | F2 / F1 | sikasso|sikasso |  |
| 153 | E.Pr Aya Bintou | `ml-registre-4a64e7f29d03b9581450d0e0` | `ml-registre-f78df4960e864de56a95dd9d` | F1 / F2 | sikasso|sikasso |  |
| 154 | E.Pr Ba Aminata | `ml-registre-154cc6332a955f717d7c802d` | `ml-registre-552df21ae85d012ca0f6da24` | F1 / F2 | sikasso|sikasso |  |
| 155 | E.Pr Badico | `ml-registre-40ba646c991e6f8e240f0157` | `ml-registre-665bf73995133461bafbf6b1` | F1 / F2 | sikasso|sikasso |  |
| 156 | E.Pr Bazani Théra | `ml-registre-20f06deb46c03268eebae170` | `ml-registre-d20399557eda1f4489ac5526` | F2 / F1 | sikasso|sikasso |  |
| 157 | E.Pr Binta Diaby | `ml-registre-614a512ac622232ba029ce9e` | `ml-registre-6afb33601ee4f1be8b346af6` | F1 / F2 | sikasso|sikasso |  |
| 158 | E.Pr Bréhima Djiré | `ml-registre-24c0f511ef2cfb5461036dd2` | `ml-registre-3c160899a2b2611906355965` | F2 / F1 | sikasso|sikasso |  |
| 159 | E.Pr Cheick Modibo Diarra | `ml-registre-300dd405a0770e7a21df7078` | `ml-registre-feb4faee77df241109e3928b` | F1 / F2 | sikasso|sikasso |  |
| 160 | E.Pr Collège Méridien | `ml-registre-08700caa8a330b3a5a6cdc04` | `ml-registre-f56505c01b218df8a717bb27` | F1 / F2 | sikasso|sikasso |  |
| 161 | E.Pr Collège Mory Ouattara | `ml-registre-3661ae9420dcbca634d8a152` | `ml-registre-77f96d95c88be184a5b3ab7b` | F1 / F2 | sikasso|sikasso |  |
| 162 | E.Pr Collège Saama | `ml-registre-464015fe5b5b94c3afdce448` | `ml-registre-d7ce22cb10cd8e2861382179` | F2 / F1 | sikasso|sikasso |  |
| 163 | E.Pr Dembagnouma Ramata TOLO | `ml-registre-8b989cc7a8ddbee6a75c9cb9` | `ml-registre-f94d3f10bf8277a61f3c32cf` | F1 / F2 | sikasso|sikasso |  |
| 164 | E.Pr Dôh Goïta | `ml-registre-015fa73278064f89b6109c98` | `ml-registre-c85f265d8fa38cd9843bd513` | F2 / F1 | sikasso|sikasso |  |
| 165 | E.Pr Emmanuel | `ml-registre-1bb09cd10290c4e73ff2fbae` | `ml-registre-9df5c14471d7e9f581670dfb` | F1 / F2 | sikasso|sikasso |  |
| 166 | E.Pr Fadiala Coulibaly | `ml-registre-8610c4b231b5a7216c1512cf` | `ml-registre-ea503e897d7fd10f8b9cb91d` | F2 / F1 | sikasso|sikasso |  |
| 167 | E.Pr Fatoumata Coulibaly | `ml-registre-378e1b9aa014c1d46c02cc7b` | `ml-registre-41633afb8fa95d412fd461b3` | F1 / F2 | sikasso|sikasso |  |
| 168 | E.Pr Founémousso Dlé | `ml-registre-06dc178a157639dc46803410` | `ml-registre-389889571d86b636db6b38d6` | F1 / F2 | sikasso|sikasso |  |
| 169 | E.Pr Kadidia Sawadogo | `ml-registre-17dda31cecb397a21baf2de9` | `ml-registre-ff77ab55b97854ed00e5b458` | F2 / F1 | sikasso|sikasso |  |
| 170 | E.Pr Kalagna Sanogo | `ml-registre-c6cae31d12130494b2293ec0` | `ml-registre-fab8860e955f7f0a727ac037` | F1 / F2 | sikasso|sikasso |  |
| 171 | E.Pr Karidia Koné | `ml-registre-8d45440d860a880a9b2c2607` | `ml-registre-dd7af35fa7315db59d6f4689` | F2 / F1 | sikasso|sikasso |  |
| 172 | E.Pr Kodon Soh | `ml-registre-c365c1ff6d752d700d978390` | `ml-registre-cbd887cec941a81b23623f87` | F2 / F1 | sikasso|sikasso |  |
| 173 | E.Pr La Paix | `ml-registre-0ffc468b7fdd5689bf3d429b` | `ml-registre-8f5ecd43a2858eb447df3f66` | F1 / F2 | sikasso|sikasso |  |
| 174 | E.Pr La Référence Plus | `ml-registre-250c137d1bf423613a333aee` | `ml-registre-7896249be449c40d09f47980` | F1 / F2 | sikasso|sikasso |  |
| 175 | E.Pr Lala Fatouma Haidara | `ml-registre-63d8eaa48abb73f595af77dd` | `ml-registre-ea503bd2e460973e382b2fca` | F2 / F1 | sikasso|sikasso |  |
| 176 | E.Pr Le Bâtiment | `ml-registre-765217ddd428f9724a899241` | `ml-registre-7b1ea3791f561c2cffbd2ac2` | F2 / F1 | sikasso|sikasso |  |
| 177 | E.Pr Le Soleil | `ml-registre-1facb98591c8510b05489496` | `ml-registre-3a0eb1f2ca3498b67bb20833` | F1 / F2 | sikasso|sikasso |  |
| 178 | E.Pr Les Bambinos | `ml-registre-0f40385bcceb258ac26def92` | `ml-registre-a6d72097f5f7ee6b09010253` | F1 / F2 | sikasso|sikasso |  |
| 179 | E.Pr Les Pionniers | `ml-registre-7c437a24b663f92d2604f71a` | `ml-registre-dbcb0ef7e27b912605139670` | F2 / F1 | sikasso|sikasso |  |
| 180 | E.Pr Liméda | `ml-registre-ee975589f1507e699f426bfe` | `ml-registre-fdfe38469b43d46eefb0c601` | F1 / F2 | sikasso|sikasso |  |
| 181 | E.Pr Lumière | `ml-registre-05c6755b755c920405040c87` | `ml-registre-62ab59ebc192258803bd9eb4` | F2 / F1 | sikasso|sikasso |  |
| 182 | E.Pr Mamadou Coulibaly | `ml-registre-9ae8f6fdeeafc0824352219f` | `ml-registre-b9248bda57072a39f2d80df4` | F2 / F1 | sikasso|sikasso |  |
| 183 | E.Pr Mamadou TOGO | `ml-registre-995182cac6bbb0345a682f03` | `ml-registre-fb8ad141c3e5ef10a7ea5aad` | F1 / F2 | sikasso|sikasso |  |
| 184 | E.Pr Mamadou Traoré | `ml-registre-040ccaa964be249aedac2f98` | `ml-registre-7a30a2b59b326ef1a6869f78` | F2 / F1 | sikasso|sikasso |  |
| 185 | E.Pr Mariétou Haïdara | `ml-registre-2c66f0986bb3aaf4168a235f` | `ml-registre-f924c0da8d2206b53fed8b55` | F2 / F1 | sikasso|sikasso |  |
| 186 | E.Pr Mômô | `ml-registre-3fe47b050983c26ea24b2d8c` | `ml-registre-a34ff8975c8e03b8dc1019ab` | F2 / F1 | sikasso|sikasso | nom |
| 187 | E.Pr Moussa COULIBALY | `ml-registre-a6bdb2b3437922471fb58437` | `ml-registre-d37784dd5dcb9a8e1495bb3c` | F2 / F1 | sikasso|sikasso |  |
| 188 | E.Pr Moussa Sidiki BENGALY | `ml-registre-4760d433bd34829c4f4f1094` | `ml-registre-9e2d733c1124125b11a11b63` | F1 / F2 | sikasso|sikasso |  |
| 189 | E.Pr Mylène | `ml-registre-14b0d71f2fae25b51f191032` | `ml-registre-abb71600cda160d905f31275` | F2 / F1 | sikasso|sikasso |  |
| 190 | E.Pr Paul Diallo | `ml-registre-a6f84ae373b7570464d7e3ad` | `ml-registre-de86b9c1a5856e6887dcbcfe` | F1 / F2 | sikasso|sikasso |  |
| 191 | E.Pr Prince | `ml-registre-8c539971bc4fb2697f12e85a` | `ml-registre-aaa2eaff1643a8964ebdd3dc` | F1 / F2 | sikasso|sikasso |  |
| 192 | E.Pr Prof. Mamadou Lamine Traoré | `ml-registre-2b1f5879d0d4b0d80f232f03` | `ml-registre-f454e61ff49dd70f6b2bdc63` | F2 / F1 | sikasso|sikasso |  |
| 193 | E.Pr Rokiatou Berthé | `ml-registre-60aa1f9b293417703634e6bd` | `ml-registre-e616659c989c8f51af140907` | F2 / F1 | sikasso|sikasso |  |
| 194 | E.Pr Saint Fréderic | `ml-registre-2f5e038d9eedcc66fd94fe0c` | `ml-registre-ca4c13ffa6f409a4579b0fe1` | F2 / F1 | sikasso|sikasso |  |
| 195 | E.Pr Salama | `ml-registre-0a75d47161e470d2812c58af` | `ml-registre-85fddbd39604d31e75045d13` | F2 / F1 | sikasso|sikasso |  |
| 196 | E.Pr Salia Traoré | `ml-registre-4924cad28c6b846b71f0389f` | `ml-registre-e3b0e7d792e1f07d89a6ca17` | F2 / F1 | sikasso|sikasso |  |
| 197 | E.Pr Thianzié Bolézogola | `ml-registre-3b334785413b2b0d85584a66` | `ml-registre-99920a34b16bbb8b365bb3b0` | F1 / F2 | sikasso|sikasso |  |
| 198 | E.Pr Tiona | `ml-registre-90133d11e9a2b069a894b79b` | `ml-registre-baff8fcaebf48f1ff9803a83` | F1 / F2 | sikasso|sikasso |  |
| 199 | E.Pr Wagnan Diarra | `ml-registre-c35763e11d0fcbafee2f46a9` | `ml-registre-e061f5f7af4582c290fae9d3` | F1 / F2 | sikasso|sikasso |  |
| 200 | E.Pr.Yaya Ballo | `ml-registre-45990a9633e28c35d3ebb4f1` | `ml-registre-bc923df2f5c51a3c46ceb291` | F1 / F2 | ML030519 |  |
| 201 | Eda | `ml-registre-06788e715e8cdbe16a54f0f2` | `ml-registre-b083717f53685c19e15596da` | F1 / F2 | sikasso|sikasso | nom |
| 202 | El Ahababou | `ml-registre-4c012f95c4938438df03a0aa` | `ml-registre-601f9c5f6555e2963d68960b` | F2 / F1 | koutiala|koutiala | nom |
| 203 | El Hadji Yaya | `ml-registre-804143f51ee7b977455c8295` | `ml-registre-e906c02d15b23d9fc122a578` | F1 / F2 | ML030203 |  |
| 204 | El Kitab Wa Sunna | `ml-registre-031cb7c58967bec0bfdfeb9c` | `ml-registre-6a263e489ecb2017453d2df2` | F1 / F2 | ML040624 | nom |
| 205 | El Kitabou Wa SUNNA | `ml-registre-0219d39741be3eadc81fa193` | `ml-registre-a871cee0f8c8ec7010d4cb10` | F1 / F2 | koutiala|n gountjina | nom |
| 206 | Em-Nelher | `ml-registre-3e765e12673423b93aebd97b` | `ml-registre-78fd71087c6cd76368a02991` | F1 / F2 | ML050614 |  |
| 207 | Ende-Ouo | `ml-registre-33d95095fbd40f54c4980490` | `ml-registre-aa27358b84bc9592a0b3d3b5` | F1 / CDPE | ML050205 | nom |
| 208 | EP Le Vestibule du Savoir E.V.F.S Koyan N'Golobala | `ml-registre-3c61787760d16d4f856813fc` | `ml-registre-85c24d4f60076b4849607309` | F1 / F2 | niono|niono | nom |
| 209 | Eréwi | `ml-registre-a07408c754d6345f1ff06d22` | `ml-registre-cc5ac02f1340959359c57255` | F2 / F1 | ML060305 | statut |
| 210 | Espoir JIGI | `ml-registre-4d21ff38c9957ac0eac4c7c0` | `ml-registre-69b8bfa1cc4a1ead8500a8ee` `ml-registre-77dec8d5a37b7a83ada15e1f` | F2 / CDPE / F1 | ML040616 | nom |
| 211 | Excellence | `ml-registre-40832ceeba3d4e9467cc9fa6` | `ml-registre-85048535958a60f4f591f947` | F2 / F1 | ML070303 |  |
| 212 | École FA AID | `ml-osm-a1d8622f41ed75f5c165c30f` | `ml-registre-45c801b09b45c458174e2f78` | F1 / F2 | ML050303 |  |
| 213 | Fa Keïta /A | `ml-osm-615b5a4b7efe2a45f2bca294` | `ml-registre-d37424875dec13b3b64cbe22` | F1 / F2 | ML040620 | nom |
| 214 | Faboly Bengaly | `ml-registre-14c44b5a3d9c9486e69fa3c1` | `ml-registre-9bd89aa5020f875b1688275d` | F2 / F1 | ML030507 |  |
| 215 | École privée Fadah DIALLO | `ml-registre-1ec7df09888c3701f0899192` | `ml-registre-254c2a9f5d5b086bcd7b5fe8` `ml-registre-cc3b88c3e39cc1b7c70e11bf` | F2 / F1 / CDPE | ML050614 | nom |
| 216 | Fagnouma Fomba | `ml-registre-837254bf781f1c1a10924d19` | `ml-registre-863a04cda21adbdb0072b302` | F2 / F1 | ML030519 |  |
| 217 | Farou Mane Baou Sadati N'Tiesso | `ml-registre-12dd22cd206332f4a2761635` | `ml-registre-e912c38a08bc8c3dd95f2ba3` | F2 / F1 | koutiala|koutiala | nom |
| 218 | Faso Kanu | `ml-registre-1c1ffa0ae264bd7175c5d049` | `ml-registre-4a89dc8c09fc6bc8b7eff9c1` | F1 / F2 | ML030531 |  |
| 219 | École fondamentale Fasseny Diakité | `ml-osm-3cb816b7da662ced632296de` | `ml-registre-fd4ee03a37092e9a70f259b1` | F1 / F2 | ML020415, kati|kalabancoro | nom |
| 220 | Fasso Kanou | `ml-registre-23a8060c050e9e7d572e4879` | `ml-registre-27fdd1eb7d03df2654506eff` | F2 / F1 | ML030209 |  |
| 221 | Fasso Yeelen | `ml-registre-700942b35b75e8a42240cfcf` | `ml-registre-e3f5d0a9345fcc73a68cf06c` | CDPE / F1 | ML030204 |  |
| 222 | Fatoumata Zaharaou | `ml-registre-d6148419cc27a6b65b4117ec` | `ml-registre-f5d180c150bec1889345ba81` | F1 / CDPE | ML040625 |  |
| 223 | Complexe scolaire Foité DIARRA | `ml-registre-c57072add9dabb0c13f494b1` | `ml-registre-e8cbe1500315af951860524f` | F2 / F1 | koutiala|koutiala | nom |
| 224 | Fongo Baber | `ml-osm-14686ea4c8b3603e9270e766` | `ml-registre-51b1c8fe90870e6473ee1aa2` | F1 / CDPE | ML060107 | nom |
| 225 | Foourou Alpha CISSE | `ml-registre-8580d8ec3eabbf9ee8f2100c` | `ml-registre-9ecdb2c3e8de3fe549e304a4` | F1 / F2 | ML050303 |  |
| 226 | Fraternité Koko | `ml-registre-987eb1d7020902f7ee20afd9` | `ml-registre-9a9a42be73b5967cd5ebd1af` `ml-registre-de887f983cfbdc451e7b7a3c` | CDPE / F1 / F2 | ML030204 |  |
| 227 | G. Bertsch | `ml-registre-343990a979e6f4b9e4223dd2` | `ml-registre-993c4048ddcd52efd3c418d0` | F1 / F2 | ML050609 |  |
| 228 | G.S.I.D A | `ml-osm-459fa3cd858c8a338f0ba105` | `ml-osm-dca6e6a1c797ff45b14c0bc4` | F2 / F1 | ML020101 | nom |
| 229 | G.S.I.D. B | `ml-osm-6d8e9cf3341c191d015a59e4` | `ml-osm-e9f8cfd76698f92e6d6d8118` | F1 / F2 | ML020101 | nom |
| 230 | G.S.Konaké | `ml-registre-2f447dffad2ca97e178a55d0` | `ml-registre-3a7104f4a0ddde1156d1f41f` | F2 / F1 | ML050609 |  |
| 231 | G.S.M. Keita | `ml-registre-506c92bed024f534dec6798d` | `ml-registre-c61a471b3a2f87b63ae4317e` | F1 / CDPE | ML050614 | nom |
| 232 | G.S.P Touba Coura | `ml-registre-51d270a6aff6250dc8571a93` | `ml-registre-d7f11f0af3e7513a31131deb` | F1 / F2 | ML020106 |  |
| 233 | Gabéro -Zinda | `ml-registre-74ef997cee3524c0275c38bf` | `ml-osm-fec6e13088a710c4894d9250` | F1 / CDPE | ML070302 | statut |
| 234 | Ganima Fahd Zahim | `ml-registre-37844907c773361fce1339d0` | `ml-registre-81d5bfc8f87c1ebeff311dde` | F1 / F2 | ML050604 |  |
| 235 | Gaoussou DIALLO privé | `ml-registre-8e674484539ad9bbbc5f2280` | `ml-registre-cc671fecce2d558c26706a38` | F1 / F2 | koutiala|koutiala | nom |
| 236 | Gari | `ml-registre-a5207c465601e583335ae38a` | `ml-registre-bff43c0c4102dd74b4c4f85e` | CDPE / F1 | ML060113 | nom |
| 237 | Gathi | `ml-registre-46b9fd15a56bd93b63e49710` | `ml-registre-b5b14e792a2449fc13ac4fc3` | F1 / F2 | ML050805 |  |
| 238 | Gbaanni Koko | `ml-registre-9502c21f324dca5568a072ad` | `ml-registre-e106235ca00a00d643baabd0` | F2 / CDPE | ML030204 |  |
| 239 | École fondamentale Georges Biard | `ml-registre-c69cf55dbdd218287abf9723` | `ml-registre-d584cfa70ee9721af4ac346d` | F2 / F1 | ML050101 | nom |
| 240 | Gologou | `ml-registre-1f35dca25b1874bf417c5f58` | `ml-registre-9b462972626036e530d35855` | F1 / CDPE | ML050104 |  |
| 241 | Gouréli Wèrè | `ml-registre-3c574061de70e7a4f87cc789` | `ml-registre-cfa1933d67e57c6d8079517b` | F1 / CDPE | ML040106 |  |
| 242 | Gouro SANOGO | `ml-registre-22af01da4263ec0417abfcde` | `ml-registre-3cf5ff7c265728b7d0e7f4e6` | F2 / F1 | sikasso|farakala |  |
| 243 | GS Les Merveilles | `ml-registre-9397821143235a6272d43afd` | `ml-registre-b3926702b7f84fd92056cfcf` | F2 / F1 | koutiala|sincina | nom |
| 244 | Gsid A | `ml-registre-9fbb4297cb50b267d7d4bb30` | `ml-registre-eabd2fcfadc6f719ff019801` | F1 / F2 | ML020101 | nom |
| 245 | Gsid B | `ml-registre-5b6e4510addd6e3e231fb1ea` | `ml-registre-88006e3d1ac17e5e746ab8ab` | F1 / F2 | ML020101 | nom |
| 246 | GSM Camara | `ml-registre-aff79d01353663885dcf5f3b` | `ml-registre-e10a33866623547010f2262f` | F1 / F2 | koutiala|koutiala | nom |
| 247 | Guidiowel | `ml-registre-4c6f52f7db6951a7c42796e4` | `ml-registre-b5bfc78212290a771cd55406` | CDPE / F1 | ML050304 | nom |
| 248 | Guindio ALMAMY | `ml-registre-6448c82cfd26111a66f23fd8` | `ml-registre-ef7c57eca65ec7b1b2ceb71c` | F2 / F1 | koutiala|sincina | nom |
| 249 | Guingal | `ml-registre-2a625aa976fd38e8891e5f60` | `ml-registre-a5dce2251bab46bdb9548d22` | F1 / CDPE | ML050511 | nom |
| 250 | Gwary | `ml-registre-92c776cdbb9bfca8132ea864` | `ml-registre-eec2b9876d560489d7f16894` | F2 / F1 | ML050212 | nom, statut |
| 251 | H. Gmeiner | `ml-registre-ea41dc8f9be9f3d40b2b1828` | `ml-registre-f3915a22216995d55e938d94` | F1 / F2 | ML050614 |  |
| 252 | Ha Wou Doul Wilayatou NGuéguésso II | `ml-registre-06ee5b41ca6c8ac04a0b5773` | `ml-registre-9feb018b22aacd19b78c91bb` | F2 / F1 | koutiala|koningue | nom |
| 253 | Hadaratoul Islam | `ml-registre-16bace5ddb893da4c2c8ac00` | `ml-registre-909c6a2722c50a4c0d20030e` | F1 / F2 | ML050609 |  |
| 254 | Hadyou Nabi | `ml-registre-4ccb8e0e5179bcedd3269ad7` | `ml-registre-e294e912bac8b807e3b34015` | F1 / F2 | ML050609 |  |
| 255 | Hahalia Bani | `ml-registre-2b1685071039e331dc941344` | `ml-registre-885ce75092e0716bbcbeff96` | F1 / F2 | ML040601, segou|banguidadougou |  |
| 256 | Hamadoun Mobo Haïdara | `ml-registre-802967b2fbe55c2443b950ce` | `ml-registre-91fa6a3b9186acfa49cc2e06` | F2 / F1 | ML050614 |  |
| 257 | Hanafiatou Ibrahima | `ml-registre-1e94d50b293c447ed3d72630` | `ml-registre-50e048afffcfb235bcb9dd04` | F2 / F1 | ML040620 |  |
| 258 | Harouna SISSOKO | `ml-registre-00d078b243d2ca17bf252a75` | `ml-registre-c259bec184d1620d81189fb0` | CDPE / F1 | ML050609 |  |
| 259 | Hassi-Hamou | `ml-registre-c3837ef69813db8bd4e1dfc1` | `ml-registre-f80256e67bd73e9c89db043c` | F1 / CDPE | ML060505 |  |
| 260 | Hayatoul Islam | `ml-registre-9b2056295d86e4f880da7bf1` | `ml-registre-e7c35bd377444abd17b41f40` | F2 / F1 | ML040620 |  |
| 261 | Hilal Islamiya Wala Wala | `ml-registre-609fbfa083be59af2794cfcf` | `ml-registre-9964d2e16901291b14a5e2e0` | F1 / F2 | koutiala|koutiala | nom |
| 262 | I.A.islamiya | `ml-registre-09a62cb60ebf54a7b6a9abe9` | `ml-registre-66d248b915f757884b7194e5` | F1 / F2 | ML020106 |  |
| 263 | École privée I B K | `ml-osm-9c6ce2cbeaa461a7ae08cb9b` | `ml-osm-b587e852bce6908458e85fdb` | F1 / F2 | ML090101 | nom |
| 264 | I.F.P.T | `ml-osm-1ea0643d8b4e6a05fe07a937` | `ml-osm-40ab760624625a8e65ee35c0` | F2 / F1 | ML090101 | nom |
| 265 | Ihya Oulimidine Kla | `ml-registre-3c1cf538d927a4d59afbfaee` | `ml-registre-fb234e52bb75281baed2c3ab` | F1 / F2 | koutiala|koutiala | nom |
| 266 | Ihya Oulimidine N'Togonasso | `ml-osm-d6caa819e35a118d12cdccea` | `ml-registre-67cf3dd0bc9049633c195a6b` | F1 / F2 | ML030406, koutiala|gouadji kao | nom |
| 267 | Ihya Ouloumoudine | `ml-registre-b4d377275526ccfdb08aba47` | `ml-registre-bf71add6a60e8e6dd17f3046` | F2 / F1 | ML050609 |  |
| 268 | Imam Aroune Islamiya N'Gountjina | `ml-registre-2523fcc43dc519f632ba5bd5` | `ml-registre-43b21983da5964711dacbf5b` | F1 / F2 | koutiala|n gountjina | nom |
| 269 | Institut Gemaco | `ml-registre-087aff43d6eb926b96340bd7` | `ml-registre-f43b70752a34e441025d10a8` | F2 / F1 | ML040616 | nom |
| 270 | Isabelle Josso | `ml-registre-644539ccee83e2e98a5abcb7` | `ml-registre-ee03f8301e6800f5ac29204e` | CDPE / F1 | ML050609 |  |
| 271 | Islamiatou TANAPO | `ml-registre-22df9969fbb7b7c99162d07f` | `ml-registre-e49ee8014aa0b2f38b6b3893` | F1 / F2 | koutiala|koutiala | nom |
| 272 | École privée Jean Piaget | `ml-osm-3074b1c6d62c0d8736792f7f` | `ml-registre-89c22a7a78f06e62b4c69c68` | F2 / F1 | ML020415, bamako|commune v | nom |
| 273 | Kabaica | `ml-registre-261ce695a817b3589e64c9d0` | `ml-registre-72970296fe2ec50626a3ae8e` | F1 / CDPE | ML060107 | nom |
| 274 | Kadi - Kadidia | `ml-registre-7a6e480fa1caafd3901977f3` | `ml-registre-a59d30c1caf6a2aaae87d960` | F1 / F2 | koutiala|koutiala | nom |
| 275 | Kadidia Guindo | `ml-registre-8beebf064c6972c6e726f954` | `ml-registre-d4d0b78de6a16937cc25a377` | F1 / CDPE | ML050201 | nom |
| 276 | Kadiolo-Dioulasso | `ml-registre-d13749631ea3fe3bf982e1de` | `ml-registre-b4238799d6e1154bbc10a7c1` | F2 / F1 | kadiolo|kadiolo, ML030204 |  |
| 277 | Kadiolo Noumousso | `ml-registre-3c7e153a1fa7496afc463e3b` | `ml-registre-aa23e9528a7810d5c49baae3` | F2 / F1 | ML030204 | statut |
| 278 | Kalamu | `ml-registre-7cbbb84c67fd1d0e7e68d4ed` | `ml-registre-df6f13af88d92c6d02376a64` | F2 / F1 | ML030204 |  |
| 279 | Kalfa SANOGO de Tiagala | `ml-registre-200c15e7ee71110a50ad6dc9` | `ml-registre-33e3ad429be4861e4c3b0657` | F1 / F2 | sikasso|kapolondougou |  |
| 280 | Kani-Komboley | `ml-registre-6489d4c4454a7c704af1e8af` | `ml-registre-b3700927701ce7070c9a9292` | F2 / F1 | ML050205 | nom |
| 281 | Kanso | `ml-registre-2d8ac8512a9e94611070e934` | `ml-registre-8e9a967ac0a548474a5273e3` | F1 / F2 | ML030531 |  |
| 282 | Kaouli | `ml-osm-a3fba78224b1b2743f0b6afe` | `ml-registre-dda2a780c0a90bc4e1f6cc45` | F1 / CDPE | ML050501 | nom |
| 283 | Kargué | `ml-registre-698784aebabee4c813404f3a` | `ml-registre-f23a9be4de6d6486059a912a` | F1 / F2 | ML050111 |  |
| 284 | Kessana | `ml-registre-1a628c05a1aa35fbaf201b78` | `ml-registre-d2916fd8373e40752c46f641` | F1 / F2 | ML030504 |  |
| 285 | Kids Dream | `ml-registre-396ac7f651d044b0c5aac4af` | `ml-registre-823a475ac79168426441f5f5` `ml-registre-86f45e8c1bb5f1c61149b8e3` | F1 / CDPE / F2 | ML050609 | nom |
| 286 | Klélani | `ml-registre-2b0470732e0da6bb225b7315` | `ml-registre-857af7231083959779325e7f` | CDPE / F1 | ML030507 | nom |
| 287 | Kodon-So | `ml-registre-7073892d35c764e5c93c7ffb` | `ml-registre-8a7e946eb63a8d3721c07595` | F1 / F2 | koutiala|koutiala | nom |
| 288 | Kolomousso | `ml-registre-4bbc39475c0b0f38050f2465` | `ml-registre-f99580d5a90ef59edc9a3414` | F1 / F2 | koutiala|m pessoba |  |
| 289 | Komberou | `ml-registre-1415c49bb96e2c6c7a1bd760` | `ml-registre-eb5b79f933ef00c23ba6fca6` | CDPE / F1 | ML050118 |  |
| 290 | Korotoumou TRAORE | `ml-registre-b86ee93ee5d27240af19487b` | `ml-registre-e87a81a9cb373e391c89fa63` | F2 / F1 | koutiala|koutiala | nom |
| 291 | Kouloukan | `ml-registre-3a72a1ebf75dd524160a653a` | `ml-registre-46ff76ede1abc021e94b9e22` | F1 / F2 | sikasso|finkolo |  |
| 292 | Koundianga | `ml-osm-1012f17155ba364d365cdc3a` | `ml-registre-f30102d167d20e4da312b6ab` | F1 / CDPE | ML050501 | nom |
| 293 | Kouô | `ml-registre-3c083bcf98abea8289f87adf` | `ml-registre-42f6175b4609ad2498e0d576` | F2 / F1 | koutiala|diedougou |  |
| 294 | Koutiala Catholique | `ml-registre-1af9ee44e5550a6a05d1377a` | `ml-registre-9521b0a92cdfb4faacb92819` | F1 / F2 | koutiala|koutiala |  |
| 295 | KT - Kellè | `ml-registre-845d1215e81551538ebde76d` | `ml-registre-df746fb1f5cba0118cb51e77` | F2 / F1 | ML040308 |  |
| 296 | L'Amitié | `ml-registre-239f9fe9269e31a4c2a64402` | `ml-registre-4c9014e6daaa81c218450fc1` | F1 / CDPE | ML050614 |  |
| 297 | La Colline du Savoir | `ml-registre-bd2cf37cfad836c61138d404` | `ml-registre-c1493a6f499dbb491ddcdfbb` | CDPE / F1 | ML050614 |  |
| 298 | La Destinée | `ml-registre-23b0164b5f82741c91369580` | `ml-registre-4fd1119364d07ced920632e2` `ml-registre-d9e2624d69f46a32ffb91b93` | F2 / CDPE / F1 | ML050614 |  |
| 299 | La Lumiere | `ml-registre-79ef26d2a868426ee17e7843` | `ml-registre-89035e9807f5f02b253014ed` | F1 / CDPE | ML050609 | nom |
| 300 | École privée la Paix | `ml-registre-15d41117e54499ee2220f3cd` | `ml-registre-7e65158e7a94e30cb8910d1d` | F1 / CDPE | ML080203 | nom |
| 301 | La Plume du Savoir | `ml-registre-5bc6529080566f1af4da3ed2` | `ml-registre-8bb6a238deabbfe05da8a832` | F1 / F2 | ML050609 |  |
| 302 | La Sagesse | `ml-registre-1f1ce0edd8a3f9ce836dff20` | `ml-registre-aec8e124f8c5303fabc5fce3` | CDPE / F1 | ML050614 |  |
| 303 | La Tolérance | `ml-registre-44dfeddf1ea6b2b12ecf8720` | `ml-registre-ae588d4cc91724e34e5fd8f5` | F2 / F1 | ML050609 | nom |
| 304 | Lany Tounka | `ml-osm-007f57eb51c97e90372f29ec` | `ml-osm-aa8ba14d2a5462e5afbc01bf` | F1 / F2 | ML010309 | nom |
| 305 | Lassana Koureich | `ml-registre-038d6fa6a6402bb94b28f707` | `ml-registre-373f696a8512861aac1bc4b5` | F1 / F2 | ML020711 |  |
| 306 | Le Centre Socio Educatif | `ml-registre-1d5d5cec96f8f1072e89d2f8` | `ml-registre-9581aafc93a8ffa797ccfb0a` | F2 / F1 | ML050614 |  |
| 307 | Le Cinquantenaire | `ml-registre-a94786e5aa296303aa2601ac` | `ml-registre-ce330612e1390411b782eca9` | CDPE / F1 | ML050609 |  |
| 308 | Le Grénier | `ml-registre-0b89ed8a081785fabf19d83d` | `ml-registre-2ac1425ad58d1918d5fc27bc` | CDPE / F1 | ML040626 |  |
| 309 | Le Pedagogue | `ml-registre-91d99432382d9133f526c55f` | `ml-registre-dfc9a53e3bb680dcd4ebc83e` | F2 / F1 | ML050201 | nom |
| 310 | Le Savoir | `ml-registre-1e48be6670fcb3e92d58e182` | `ml-registre-f561debc18776953c276dfa8` | CDPE / F1 | ML030204 |  |
| 311 | École privée Le Savoir | `ml-registre-5b7f4d75015eeb684dbbbf9f` | `ml-registre-73271bc99d771669910cc90f` | CDPE / F1 | ML050614 | nom |
| 312 | École privée le Songhoi | `ml-osm-e1b10310a5a3e1d8ccd16cf4` | `ml-registre-3fbdd8af4383f6ec8163b329` | F1 / F2 | ML090106, bamako|commune vi | nom |
| 313 | École privée Le Vivier | `ml-osm-81cebf2e0df4f292d31b1f94` | `ml-registre-eda86ffad66fbc5648839a12` | F1 / F2 | ML090106, bamako|commune vi | nom |
| 314 | Les CIMES | `ml-osm-1ff018cfb28427a09fcec5ef` | `ml-registre-33dece8a864b42d4ff3edb20` | F1 / F2 | ML090101, bamako|commune i |  |
| 315 | Les Colombes | `ml-registre-9714e64fb2010c12b0a67fed` | `ml-registre-ad9b089a09ea428bb6954221` | F2 / F1 | ML050614 |  |
| 316 | Les Disciples | `ml-osm-8c178e26be4cdb393aa2cd9f` | `ml-registre-224659b0393864ceddd5ae37` `ml-registre-9ee0c6d36d83ed8693f4ab2e` | CDPE / F2 / F1 | ML040626 | nom |
| 317 | Les Horizons | `ml-registre-11037737f972537d296b034c` | `ml-registre-1847918a282a70b9e3eddbb4` `ml-registre-5ff7c472c6aabb09259b351e` | F1 / F2 / CDPE | ML050609 |  |
| 318 | Les Khalifas | `ml-registre-21f76d51e179595b8a15af20` | `ml-registre-decae898dd6d1b5588897be2` | F2 / F1 | koutiala|koutiala | nom |
| 319 | Les Mains Unies | `ml-osm-759c4dd7d568984511fabbcf` | `ml-registre-214f77340f47039ced531128` | F1 / F2 | ML050609 | nom |
| 320 | École fondamentale M'bamakan Damba | `ml-osm-7bddca711787567f3adb49b5` | `ml-registre-5c592ef34bd494d626553a7d` | F1 / F2 | ML090104, bamako|commune iv | nom |
| 321 | M.C Charif Ousmaïl Wal kitabi wa Suna | `ml-registre-064d3b2b2e238dafad98a007` | `ml-registre-cca0224f05ff2d2a2a951f29` | F1 / F2 | ML040615 |  |
| 322 | M.C D.C.W.H Pél | `ml-registre-49a5524acaec3a4710ee2bf8` | `ml-registre-51c08419c09293075cf0a466` | F2 / F1 | ML040620 | nom |
| 323 | M.C Semebougou.Diaw | `ml-registre-34aefb986d1b30a98f16455b` | `ml-registre-45fe9054109703a3a5dac08a` | F1 / F2 | ML040620 |  |
| 324 | M'Péla | `ml-registre-1f1f6954b0e41dfc0fc29507` | `ml-registre-8b6c7ed07dea210db9bba261` | F1 / CDPE | ML030507 |  |
| 325 | M'pèlogosso | `ml-registre-2131e55b8efa72e80d48f7e0` | `ml-registre-39a50dd3eae342fd8e2734d7` | CDPE / F1 | koutiala|n golonianasso | nom |
| 326 | M'Pèrè Oumar Sanogo | `ml-registre-4d69a3ef26ed2fd196f3d523` | `ml-registre-efa3c721ba7a6ac9205e04a0` `ml-registre-ff26db141dba9b42ef84379c` | F1 / F2 / CDPE | ML030508 |  |
| 327 | M'Pèrèbala | `ml-registre-5b9d667ded99d056395c770e` | `ml-registre-eac64e936ad1a181f9d91aac` | F1 / CDPE | ML030514 |  |
| 328 | M'Pèresso | `ml-registre-14e37302feb699ae26182ec1` | `ml-registre-2f673ac46407ace6d8d431f8` | F1 / CDPE | koutiala|koloningue | nom |
| 329 | Maahadou Atahazibiatou Islamiya | `ml-registre-01203041f3dd8706d0b2ecef` | `ml-registre-907bd24166e2da47cd26af6c` | F1 / F2 | koutiala|koutiala | nom |
| 330 | Maahadou Courane Wal Hadiss | `ml-registre-73f6711490880b578096002f` | `ml-registre-97d87a7ca24a170bebe25e6a` | F2 / F1 | koutiala|koutiala | nom |
| 331 | Maahadou Dari El Hidjirati El Islamiya | `ml-registre-1e38cf01d069a17bcd905a9a` | `ml-registre-805db57918ac16ba30eafb43` | F2 / F1 | koutiala|koutiala | nom |
| 332 | Madiè NIARE | `ml-registre-ce7b1871d0a3a0283673ab02` | `ml-registre-e804a14d874388601d222e33` | CDPE / F1 | ML030204 |  |
| 333 | Madrassatou Solahi Dine El Islamiya Tarasso | `ml-registre-2712c7d42f4b91720e942eba` | `ml-registre-69226d4a8ced106e1647aaef` | F1 / F2 | koutiala|koloningue |  |
| 334 | Mahadou Rachad | `ml-registre-33ffafe62b761c680f34de65` | `ml-registre-6c59b741ef8f8d53181999a6` | F2 / F1 | ML050609 |  |
| 335 | Malloli Ag Lawech | `ml-registre-0fb5e09f1db79b39589f2eb4` | `ml-registre-6e097bd0e0b35bacb44a479f` | F2 / F1 | ML060303 | statut |
| 336 | Mamadou SAYE de Doucombo | `ml-registre-523a3a3d93c0c94212ef166a` | `ml-registre-524bbdeb73db46016aa25cf0` | F2 / F1 | ML050107 |  |
| 337 | Mamadou Tolo | `ml-osm-d84f1b6c0e596093d156f1b6` | `ml-osm-ff5eadee076f8c86ebe0a6af` | F1 / F2 | ML050104 | nom |
| 338 | École privée Mami-Bel | `ml-osm-a411dab0b9e0ab3079ff9305` | `ml-osm-7c992cec024cf14218ca9c48` | F2 / F1 | ML090104 | nom |
| 339 | Mane Baou Saadati Darslam | `ml-registre-240d90cd59bfdc5e48a3254d` | `ml-registre-355664eeb32af854cea20624` | F2 / F1 | koutiala|koutiala | nom |
| 340 | Marhazil Fouhoumi | `ml-registre-335e69cffe5a2e943e481d8a` | `ml-registre-ddcd30c4a76935d335e39b87` | F2 / F1 | ML040630 |  |
| 341 | MC Ann çardine | `ml-registre-b0694eca566875b6e7ae2268` | `ml-registre-f8c88e62d25cefa48eec6a4f` | F2 / F1 | ML040626 |  |
| 342 | Med Aboubacar Sidiki | `ml-registre-98b5c434df7a428d43e99d22` | `ml-registre-b531528bf8e592b14941d356` | F1 / F2 | ML040408 |  |
| 343 | Med Al Richad | `ml-registre-9fcc45fd47fe0728ce82d485` | `ml-registre-dac55756852100d0ec9b237f` | F1 / F2 | sikasso|sikasso |  |
| 344 | Med. Alkitab Wal Hikmat | `ml-registre-6f77305db3da8e268f6b0a18` | `ml-registre-b33fbe8205f267a5ef0a3995` | F1 / F2 | ML020106 |  |
| 345 | Med. Badembara | `ml-registre-1bc42ab86cd501a7812cd9d2` | `ml-registre-56a7ed2d5258c597825f81d6` | F2 / F1 | ML020106 |  |
| 346 | Med Bintou Arama | `ml-registre-46a7c3e12cbb540b53cc45f6` | `ml-registre-6654d49b8f86013360c7d287` | F1 / F2 | ML040620 |  |
| 347 | Med Dar adis | `ml-registre-7d471495a99dadd642e784aa` | `ml-registre-90952f4a4aa7f5b7eb41ed8f` | F1 / F2 | ML030531 |  |
| 348 | Med Dar Al Hadis | `ml-registre-61f880d29ee9683925210be5` | `ml-registre-86b7fda76250cb75126c3b94` | F1 / F2 | sikasso|sikasso |  |
| 349 | Med Dar Houdal Islamia | `ml-registre-aa91d1890dd204e3776a308b` | `ml-registre-f861807f755c93e392f40a2b` | F2 / F1 | sikasso|sikasso |  |
| 350 | Med. Daroul Houda Banamba | `ml-registre-e662174ed91a6733498a15f5` | `ml-registre-f739947780dd54c478335882` | F1 / F2 | ML020101 |  |
| 351 | Med Dialacorocamp | `ml-registre-28e19025259bc451b0aedf0d` | `ml-registre-29fe8cf784e68ed274a721ac` | F2 / F1 | ML040304 |  |
| 352 | Med Diyaoudine | `ml-registre-138e8a904d6e36a8d3748dfe` | `ml-registre-c8300941d5e5223b0d168622` | F1 / F2 | ML030543 |  |
| 353 | Med Dyaoudine Konkolikoro | `ml-registre-69e5ff8cd13a0bc75ca6af4b` | `ml-registre-a2806207eb99658c94b15311` | F2 / F1 | sikasso|lobougoula |  |
| 354 | Med Fatoumatou Hamady Bah | `ml-registre-0d3dd4b398207e3edbb467b3` | `ml-registre-77865550aea4e81762b478ef` | F2 / F1 | ML040626 |  |
| 355 | Med Franco Arabe Saadizi Waaza | `ml-registre-6ca70ccfa0f9b0b793f9165f` | `ml-registre-d7ae07b2cd0c86e0c19a9053` | F2 / F1 | sikasso|sikasso |  |
| 356 | Med Franco Arabe Sidiki Daou | `ml-registre-b53dfb1ba059bf54f1205595` | `ml-registre-ecfe76116a901e2cf88cb30b` | F1 / F2 | sikasso|sikasso |  |
| 357 | Med hadikatoul Islama | `ml-registre-407c1fceaeb88a6378c2f20a` | `ml-registre-9d0e70b20711221c46af4262` | F2 / F1 | ML040620 |  |
| 358 | Med. Km 23 Sabil El Anwar Essakafia | `ml-registre-97a9f895b4b64d7ec040879f` | `ml-registre-efa036dcbfc3848d1f90be04` | F1 / F2 | ML040406 | nom |
| 359 | Med. Km 36 Bagadadji | `ml-registre-a54b79240c13d05531a6073e` | `ml-registre-f5ce72211cfe26b75de25ae3` | F1 / F2 | ML040409, niono|sirifila boundy | nom |
| 360 | Med Lafiabougou | `ml-registre-4ecdbd861b5b373babd0c3dc` | `ml-registre-98d952250eef466cdef73d0a` | F2 / F1 | macina|macina, ML040305 | nom |
| 361 | Med Mahaad Imam. Ibrahim | `ml-registre-2a8faee78b8aa238b2d68297` | `ml-registre-94f9613f918fefe6922e17fe` | F2 / F1 | sikasso|sikasso |  |
| 362 | Med Mahadi Imam | `ml-registre-1c81678cef0282cfc6a96044` | `ml-registre-96fe20283c520b629bbaeb39` | F2 / F1 | ML030531 |  |
| 363 | Med Mahadoul Islam | `ml-registre-1c25fa369c73f92105b16ad5` | `ml-registre-9e77d1ff3ab4ddc0862242ee` | F2 / F1 | ML040410 |  |
| 364 | Med Malikia | `ml-registre-56f8cf2e7dc6781e3839811e` | `ml-registre-eee99801d4c1511237c0ca68` | F1 / F2 | ML040406 |  |
| 365 | Med. N5 Tigabougou | `ml-registre-13575e59ccb3d7d7e6221343` | `ml-registre-916df06c4bdbc2ee5d5dc57b` | F1 / F2 | ML040412 | nom |
| 366 | Med Nahadjou Salami | `ml-registre-38f1873f3e26a772992ffaac` | `ml-registre-a0c726fce949d6674e63a45c` | F1 / F2 | sikasso|sikasso |  |
| 367 | Med Niangassoba | `ml-registre-456689d00bf25f28f80d01d9` | `ml-registre-f5cd51ea02679c25e2a6a839` | F2 / F1 | sikasso|kapala |  |
| 368 | Med Nourdine | `ml-registre-1ba38ce2a8b67f4a90b86050` | `ml-registre-8010331f1a9966f90c1488cb` | F1 / F2 | ML030531 |  |
| 369 | Med NOUROUDINE | `ml-registre-a3caa7edf66e19d4dc81951f` | `ml-registre-ffb2ec8350c4c775eea1679e` | F2 / F1 | sikasso|farakala | nom |
| 370 | Med Ouloum Addin | `ml-registre-122df76e705f70e7b83fd2ff` | `ml-registre-2108ae36ad954497d5f39bd6` | F1 / F2 | sikasso|sikasso |  |
| 371 | Med Ouloum Adine de Kéna | `ml-registre-18914a18342364521886a392` | `ml-registre-2f06dd8d3efddf1efc48b513` | F1 / F2 | sikasso|natien |  |
| 372 | Med Oumar Ben Katabi | `ml-registre-5519d70cc23e8a60acd9ee47` | `ml-registre-5d95b6c91c573523333acdc0` | F2 / F1 | ML030504 |  |
| 373 | Med Saadati El Abadiati Siribala | `ml-registre-39b93055addc4100d2cfe932` | `ml-registre-4c59294cbf8199990433cd64` | F2 / F1 | niono|siribala | nom |
| 374 | Med Sabil El Islamia Nassoriaty | `ml-registre-012ec41923f7c3c109e3078c` | `ml-registre-19ff1d44a16160ca661260e6` | F2 / F1 | niono|siribala |  |
| 375 | Med Sabil Houda de Baye | `ml-registre-6b7b5f65f6fba71ac56f5db2` | `ml-registre-85d52a186e0f517aacb5fd2a` | F1 / F2 | ML050202 | nom |
| 376 | Med Sabilou Houda | `ml-registre-7d2dffb8928df5a97fb1e3cf` | `ml-registre-ba796022d5dd8dd5f35ffd98` | F1 / F2 | ML030531 |  |
| 377 | Med Salahou Dine El Ayoubi | `ml-registre-1abab07b4eeb26f1fb751906` | `ml-registre-d04c65350743bdd7a119cd94` | F2 / F1 | sikasso|sikasso |  |
| 378 | Med Sekou Diakité Hamd. | `ml-registre-8fbf59af7f8a8734e6c42bbd` | `ml-registre-ebde3650d001a462900c8c1c` | F1 / F2 | sikasso|sikasso |  |
| 379 | Med. Tadamouni Islamia | `ml-registre-1e923012335d23d484aeb170` | `ml-registre-78551ab4080014556fa649be` | F1 / F2 | ML040410 |  |
| 380 | Med Tahafiz Al Coran | `ml-registre-7344520c8f8e775dbfbf73a1` | `ml-registre-e444fc9aa1a6f8a05b283ac6` | F1 / F2 | sikasso|sikasso |  |
| 381 | Med Tarbia Al Islamia | `ml-registre-aaabc33154a5c4d838929f9c` | `ml-registre-ac469b22b499d66b35120ba9` | F2 / F1 | sikasso|sikasso |  |
| 382 | Medersa Al Ittiyad | `ml-registre-38c6bc954b34ebf702edc822` | `ml-registre-4ab4fabba355cbabb2aeb9b1` | F2 / F1 | ML050101 |  |
| 383 | Medersa Alkalifa | `ml-registre-7fce26ec04317fb5a5d8f16c` | `ml-registre-f92cf757b127d8c9300ab525` | F1 / F2 | ML040616 | nom |
| 384 | Medersa Ansardine de Dioro | `ml-registre-48f06ad5ca8e1855fc6a7cda` | `ml-registre-744166d2b56c954f6c71bed0` | F2 / F1 | ML040607 | nom |
| 385 | MEDERSA ASSADIQ de BIENFAISANCE | `ml-osm-a6fca2c417baf5aa8b528e11` | `ml-osm-eed6e6527fcbae4a603a9aea` | F1 / F2 | ML060303 | nom |
| 386 | Medersa Baitoul Amanati | `ml-registre-84fb6c26ad5248637dba2aa7` | `ml-registre-d4ef5f7e52111f0b37d1acf2` | F2 / F1 | ML050501 | nom |
| 387 | Medersa Bani Wal Banati Tori | `ml-registre-f091c53165d99d765e033425` | `ml-registre-f108bfe4749bdcf9431b4640` | F1 / F2 | ML050212 | nom |
| 388 | Medersa Belma | `ml-registre-1b878809648bb096b4b77278` | `ml-registre-64714fbfb74d1b549b993738` | F1 / F2 | ML050501 | nom |
| 389 | Medersa Darousalam Kouoro-Barrage | `ml-registre-8b773e92c6ca21aded089dab` | `ml-registre-9e3db06439b3de67be0a60a3` | F2 / F1 | sikasso|kouoro |  |
| 390 | Medersa de Banankani | `ml-registre-ef28c0a87bcf0d5658789f15` | `ml-registre-f857f70044f07141f00575e4` | F1 / F2 | ML050113 |  |
| 391 | Medersa de Mory | `ml-registre-5f54fc5baca0bf3dada84a90` | `ml-registre-94147b344d2180af6a60d3f5` | F2 / F1 | ML050112 | statut |
| 392 | Medersa Djil Assayid | `ml-registre-3c32f717c99cdbae17fd58dd` | `ml-registre-49ca8053d4963a5812b80c1d` | F2 / F1 | ML050101 |  |
| 393 | Medersa Elhadji Oumar Tall | `ml-registre-959fc15f61d53a85d9d849d2` | `ml-registre-dbfe5412145acf314ca4582b` | F2 / F1 | ML050101 |  |
| 394 | Medersa Nahar Djoliba | `ml-registre-e375469986d8fc8761325400` | `ml-registre-f963ca1a0e84f961320601dd` | F1 / F2 | ML050118 |  |
| 395 | Medersa Saadatou Leabadiyatou | `ml-registre-0ba432e3e837f5e35e627fe5` | `ml-registre-65d344d1d34540d6488746df` | F1 / F2 | ML040609 | nom |
| 396 | Medersa Sabil El Houda | `ml-registre-18cb49ba2e15355a0ef136f0` | `ml-registre-f460763d564eaca205d9cd26` | F2 / F1 | sikasso|danderesso |  |
| 397 | Medersa SABILEL FALAH Niono Adama were | `ml-registre-4fa0e38a6397dca83a412715` | `ml-registre-d808477001912643f2fc6ad8` | F2 / F1 | niono|niono | nom |
| 398 | Medersa Sabilil Falahi | `ml-registre-889f2739d8d0b427a6d0f481` | `ml-registre-896251a1101b83645b65743b` | F1 / F2 | ML050101 |  |
| 399 | Medersa TAFIZ KOURAN Privée | `ml-registre-4206d6c6bd5e5a1d6953a8f7` | `ml-registre-e8903aef6160a9cf5d411b0a` | F2 / F1 | ML050406 | nom |
| 400 | Medersas Loukoumane Ourikela | `ml-osm-479520905315e91544250590` | `ml-registre-865e58dac6f7828d7c059970` | F1 / F2 | ML030708, yorosso|ourikela | nom |
| 401 | Medersatoul Yaguine | `ml-registre-4c72945bf1525881effa07cb` | `ml-registre-c65ea48ce4f2a58fbf9e53d9` | F2 / F1 | ML050201 | nom |
| 402 | Métaga GOITA | `ml-registre-ea74b0d6b3eb6f65895cf9f3` | `ml-registre-fe63de413f8cd3520040a930` | F1 / F2 | koutiala|koutiala | nom |
| 403 | Miftahoul Dianati | `ml-registre-6311c7c2f86a1fe013dee8d8` | `ml-registre-6f1772f1723f8fd1367f8673` | F2 / F1 | koutiala|n gountjina | nom |
| 404 | Miftahoul Fachidaty | `ml-registre-115b0b8cbdb2ade4e0f9cda1` | `ml-registre-b5bad9810d4d25c9e5b77167` | F1 / F2 | koutiala|sincina | nom |
| 405 | Minhadj Salama | `ml-registre-37563c2bd1a980f22f33abae` | `ml-registre-40c26933d6d842d7e08145a6` | F2 / F1 | ML050609 |  |
| 406 | Minhadjou Salami | `ml-registre-cb641678df5af17e980769fe` | `ml-registre-d469bbc9b91405a1ceb29973` | F1 / F2 | ML040607 | nom |
| 407 | Mission Catholique | `ml-registre-402969e34e363df58459128b` | `ml-registre-8666ebb10bbced06099bf407` | F2 / CDPE | ML030204 |  |
| 408 | Modibo Kane Cissé | `ml-registre-0cce83a324d4071bd5299055` | `ml-registre-612c1eed730aae83964d1426` | F2 / F1 | ML030519 |  |
| 409 | Mohamed Kaïraba Diaby | `ml-registre-8764da878f89177e21c27597` | `ml-registre-f961b4d983647652614e7b53` | F2 / F1 | ML040630 |  |
| 410 | Molobaly SANGARE | `ml-registre-10e1080b6cae6d3de11b2318` | `ml-registre-b5c9f5480baf1d2f25ceb287` | CDPE / F1 | ML030209 |  |
| 411 | Molodo Bamanan | `ml-registre-e278cb28811ef039cf0e16f3` | `ml-registre-e939504c5d609a7430b2d220` | CDPE / F1 | ML040403 | nom |
| 412 | Moréna Zanga Nian | `ml-registre-76605da02c10b941dcdb6e0f` | `ml-registre-82d5ed45d396e96e813a436a` | F2 / F1 | koutiala|n gountjina | nom |
| 413 | Mory | `ml-registre-8a3cfefa15bbfb51f8a33cd5` | `ml-registre-996e8ecd68abb4ba3326ac3f` | F1 / F2 | ML050112 |  |
| 414 | Mory | `ml-osm-067d6d3c78f8e42d362f8eec` | `ml-osm-b02d742bbbcb6edc256e2047` | F1 / F2 | ML050121 | nom |
| 415 | Mouhamadiya | `ml-registre-4f32965e6d4cd0bab3d62460` | `ml-registre-b52f028fccf1a6a6dd02355f` | F1 / F2 | ML040626 |  |
| 416 | Moulaye Dembélé | `ml-osm-34a47582e3faab1916946f88` | `ml-osm-c121f5243b9ae5d042b36a81` `ml-registre-1a5f218483870be931b00ab1` | F1 / F2 / CDPE | ML050609 | nom |
| 417 | Moussa B Traoré | `ml-registre-0e2717fea0a3dc7b21b3f32f` | `ml-registre-22b6f4936d65e4038dd7193f` | F1 / F2 | ML030507 |  |
| 418 | N'Djila | `ml-registre-0baa689eab7dae10faf6528e` | `ml-registre-ecc1ddc9d879bb41e0ebd6c6` | F1 / F2 | ML040105 |  |
| 419 | N'Goïna | `ml-registre-322a4b37274c34be7fb83c04` | `ml-registre-a799aaa33b562f3ec6709e5a` | CDPE / F1 | ML040106 | nom |
| 420 | N'Golasso I | `ml-registre-5288a921345f1631df499e10` | `ml-registre-dae2b16a6a2f76aa8cc9c5e4` | F2 / F1 | ML030535 |  |
| 421 | N'Golasso II | `ml-registre-0d74f68083f695b6bcd5a1f3` | `ml-registre-55f7d9315c897a8509c5efcd` `ml-registre-6711e686f5216b96d8938aaa` | F2 / F1 / CDPE | ML030535 |  |
| 422 | N'Goloklola | `ml-registre-3a077738013d079b1873ea91` | `ml-registre-42986dd95c59bd8b7e889baa` | F1 / CDPE | ML030514 |  |
| 423 | N'Hadatou Sagafatou | `ml-registre-442695b4ce2dcd7b8a2d3ee4` | `ml-registre-679ee4049d0659a814cbba19` | F2 / F1 | ML050605 | nom |
| 424 | N'Tiesso | `ml-registre-2ee9d17957950832f0448a3e` | `ml-registre-3a0da816e79a8695f2021f70` | F1 / F2 | koutiala|koutiala |  |
| 425 | N'Togonasso | `ml-registre-b4bf473e7bd0f83f10c928bb` | `ml-registre-ebd0ee7db43d4ff14bf02cc0` | F2 / F1 | koutiala|gouadji kao | nom |
| 426 | Nachir Dine El Islamiya Darsalam | `ml-registre-1dc684f9b32d96be585f2a79` | `ml-registre-f3f23cffff42d1d681bfa92b` | F2 / F1 | koutiala|koutiala | nom |
| 427 | Nadiahi Al falahi - Bertha | `ml-registre-cf6289527cb6994c104f23c2` | `ml-registre-f5be42764f853a72b92bb404` | F2 / F1 | ML040308 |  |
| 428 | Nahadatou Islamiya Sougoumba | `ml-registre-a667ffdbc1c5e90bd1333a28` | `ml-registre-d953e0f10fce23e014b41da5` | F1 / F2 | koutiala|koningue |  |
| 429 | Najah Alah Sabil El Falah | `ml-registre-8e1755e6646b572a57e6a259` | `ml-registre-d2290f8f6fc78c5ad0c290a4` | F1 / F2 | koutiala|koutiala | nom |
| 430 | Nankoun Diassa | `ml-registre-b8b0fdfcfde55b5622220a2f` | `ml-registre-c425ee843cdc78f246461980` | F1 / F2 | sikasso|sikasso |  |
| 431 | Naomie II | `ml-registre-26e9baf73df064982ab0a84b` | `ml-registre-7de83701c8c725cc3da069ca` | F1 / F2 | ML040626 |  |
| 432 | Naomie III | `ml-registre-6006185f24e6eb7966a4ae35` | `ml-registre-dfee494706f3bff040c58226` | CDPE / F1 | ML040626 | nom, statut |
| 433 | Niégué km 23 | `ml-registre-4b35bdcbe7cb23b75dea2a27` | `ml-registre-b737166d9f99502aa30704c4` | CDPE / F1 | ML040406 | nom |
| 434 | Niguitio CISSE | `ml-registre-dcf5910e933b271075234bfc` | `ml-registre-e201acd24fd36b7e2bdf12b4` | F2 / F1 | ML030203 |  |
| 435 | Nion | `ml-registre-1e3df240f726c88b3c5be83a` | `ml-registre-778c6882b94647c3fce673cc` | CDPE / F1 | ML050208 | nom |
| 436 | Noumpounon Diarra | `ml-registre-1f241b5ab87a0310a9b871cb` | `ml-registre-f24882d7ad7acaa2b4d8d7f3` | F1 / F2 | ML050302 |  |
| 437 | Nour Al Fallah | `ml-registre-42a4ed143adc50cb5adfa671` | `ml-registre-f432e2cb187d4411d6a46335` | F1 / F2 | ML060303 |  |
| 438 | Nour Dine Molobala | `ml-registre-143662d86a06b1a540c89ef7` | `ml-registre-69f708003f1aaf0bd3c99524` | F2 / F1 | koutiala|koloningue | nom |
| 439 | Nour El Islam | `ml-registre-22b5bcc20a24bd7c38d6ad73` | `ml-registre-cdfc9e7d5c9bea6157a52a4e` | F1 / F2 | ML030209 |  |
| 440 | École Nour Kountié | `ml-osm-92a2bb186c871a3ca62d8c8d` | `ml-registre-a2bc53355846aab4ee14125f` | F1 / F2 | ML090106, bamako|commune vi |  |
| 441 | Nouril Houda Islamiya | `ml-registre-480dbce37a4f73f42008910c` | `ml-registre-b46b5f6d286342c00080979c` | F1 / F2 | koutiala|koutiala | nom |
| 442 | Nourou Dine Islamiya | `ml-registre-ef0f3a3cd0c6ea7e2854c903` | `ml-registre-ff70c426aef0c4b9d4a8eb3b` | F2 / F1 | koutiala|koutiala | nom |
| 443 | Nouroudine | `ml-osm-39750bc4c0203788f9d168c4` | `ml-registre-f7ab1b2cdb4cb6cd8dcd6c34` | F1 / F2 | ML050609 | nom |
| 444 | Nouroul islam | `ml-registre-35d20fa0387c30fe1f05c140` | `ml-registre-97cf139c1d6678a74834914f` | F1 / F2 | koutiala|n tossoni |  |
| 445 | Nouvel Espoir | `ml-registre-43eb6eb94f680d7fe4fe6d17` | `ml-registre-d94a696b52defd9be79e5b2c` | CDPE / F2 | ML040620 |  |
| 446 | Nyétasso | `ml-registre-64a624ccfed5a81338a66775` | `ml-registre-7086941b1644f19ced2c30d8` | F2 / F1 | koutiala|koutiala | nom |
| 447 | Ouarasso | `ml-registre-0108ddd6bb30c56964bda1b9` | `ml-registre-d77bd121410c98298dfd9099` | F1 / CDPE | sikasso|danderesso |  |
| 448 | Oudouhouli Islamiya | `ml-registre-15ddcc4307b6a171f7cc7861` | `ml-registre-8d784a15aefbec5e9f72cfbf` | F2 / F1 | koutiala|koutiala | nom |
| 449 | Oumar Ba | `ml-registre-b0a86cdd58cb701be421063c` | `ml-registre-d2735a40ed3e66704ef587c0` | F1 / F2 | ML050104 |  |
| 450 | École privée Oumou Sangare la "DIVA" | `ml-registre-2269af8c17ad76cc8360428c` | `ml-registre-c08401f2ba96045618e8026d` | F1 / F2 | niono|niono | nom |
| 451 | Oumou Souleïm | `ml-registre-3510343efe7beb81f9be9954` | `ml-registre-39d87e708bacaab577be5f06` | F2 / F1 | ML050609 |  |
| 452 | Ousmane SIDIBE | `ml-registre-80e48983baea328911aa92c2` | `ml-registre-ebaef98c25bbcb8190c4bf49` `ml-registre-fcc2e86f2936b0d6186bd3ce` | CDPE / F1 / F2 | koutiala|koutiala |  |
| 453 | École privée Pédagogue | `ml-registre-919e78ccf3fbd9ad5bbb60f9` | `ml-osm-0e1e04c9c071d300e6c6c169` | F2 / CDPE | ML050201 | nom |
| 454 | Périmpé | `ml-registre-093e1b2f7be8e11275ab265c` | `ml-registre-a73881bdf8576ea93391bc4f` | F1 / CDPE | ML050613 | nom |
| 455 | Philippe KODIO | `ml-registre-6cab8c0659b116b27dd33bad` | `ml-registre-aa0492333720248c9542fdfe` | CDPE / F1 | ML050614 |  |
| 456 | École fondamentale de Plateau | `ml-osm-0fd55d76186144403b49cacb` | `ml-osm-1c15c53196408b0bd8a91244` | F1 / F2 | ML010312 | nom |
| 457 | Pr Kalanso Niaro Karamoko | `ml-registre-61c076a45ce41d2daef61d2b` | `ml-registre-a9354020566519880f4d83ee` | F2 / F1 | ML040406 |  |
| 458 | Prive Youssouf Sanogo | `ml-registre-3a13becbced01a945fd1f457` | `ml-registre-faa46a08cdc893d81dc6ad74` | F1 / F2 | yorosso|koury | nom |
| 459 | Privée Yeleen | `ml-registre-ed600c28bca95469b8596a50` | `ml-registre-f14163221a2afe4eb264a778` | F2 / F1 | ML040408 |  |
| 460 | Promani | `ml-osm-39e3d7f06c20049294db30bc` | `ml-registre-36f915b3f6401e7e562c3d6c` | F1 / CDPE | ML050307 | nom |
| 461 | Ramadan | `ml-registre-57b1602cc9e3b7462b81ae7c` | `ml-registre-73dad6da3809fc04f7caa195` | CDPE / F1 | ML050609 |  |
| 462 | Raoudatoul Islam | `ml-registre-8d76aac07f6fa0b933ab7e66` | `ml-registre-dbdb8258c6f919d06783979b` | F1 / F2 | ML050609 |  |
| 463 | Rosemarie E.Beck | `ml-osm-13d06e0ae00dbbc302124f53` | `ml-registre-12d33100f059f2292817de4a` | F1 / F2 | ML050609 | nom |
| 464 | Rouhou Dine Islam | `ml-registre-008669c2d6360ed4fa5905fb` | `ml-registre-cecf0c2156d1cfff313ac15f` | F1 / F2 | ML040620 |  |
| 465 | Rubin DEMBELE | `ml-registre-907919a116175f2cee634170` | `ml-registre-d1b11d3ac71ba207629070df` | F1 / F2 | ML040309 |  |
| 466 | Ryad Solihim | `ml-registre-3dae4129fe99e6b983b40927` | `ml-registre-dcf9d506a2f9a340a68f72fd` | F2 / F1 | koutiala|koutiala | nom |
| 467 | S Tamboura | `ml-registre-0a9038b6d88a4734223f4f12` | `ml-registre-42af84c58848edd70d1a3201` | F2 / F1 | ML050710 | nom |
| 468 | Saada | `ml-registre-a10a348187881a3a75669ba5` | `ml-registre-b376086c3308e38b0a73097b` | F2 / F1 | ML050609 |  |
| 469 | Sabil-Alhidaya | `ml-registre-043f4883f13273a6d3ef35c3` | `ml-registre-7a561b032c3b2c30e29b16de` | F2 / F1 | ML060405 |  |
| 470 | Sabil El Falah Cinzana Gare | `ml-registre-1cb3a778c3655a7a72fc2dfc` | `ml-registre-37272b883b3d3e11b8bce7c7` | F2 / F1 | ML040604 | nom |
| 471 | Sabil El Falah | `ml-registre-3153a3ecb079a863d6e621b3` | `ml-registre-c47b461c698826ccb6c2e9c7` | F2 / F1 | ML040403 |  |
| 472 | Sabil El Hidayati de Ornio | `ml-registre-6dce1abc274414a996816dcc` | `ml-registre-7ab392ad8f368fa32f37c041` | F2 / F1 | ML050613 |  |
| 473 | Sabil El Hidayati | `ml-registre-238dc2cf2fdd12bfcf3ec8b6` | `ml-registre-28dbbaaced2f4ab2d72fa403` | F2 / F1 | ML050609 |  |
| 474 | Sabil El Richad | `ml-registre-0cfb56e3212741cc76619e5f` | `ml-registre-2963dacd01a87703fbe19bb4` | F1 / F2 | ML040626 |  |
| 475 | Sabil Najah | `ml-registre-306be4cbec5c8e13cc69399c` | `ml-registre-38c607fecc9c6a3c354a1cee` | F2 / F1 | koutiala|koutiala | nom |
| 476 | Sabil Rachad | `ml-registre-0a5d5fb8ed788e2f259a30ac` | `ml-registre-74544f26b77ab0554be742c9` | F2 / F1 | ML030519 |  |
| 477 | Sabil Rachade | `ml-registre-75b5d6cc97002f2c11d6b944` | `ml-registre-8f1cf6ea421b9a7fece5aec8` | F2 / F1 | koutiala|koutiala | nom |
| 478 | Sabil Saadati | `ml-registre-68426d954e139a3e98c6f9fe` | `ml-registre-69c437ad611ca2cb026bd559` | F1 / F2 | ML040305 |  |
| 479 | Sabiloul Houda | `ml-registre-7eb218a5a2fd7ea4f94a9f8a` | `ml-registre-b3871b0d842f5aadfdc23304` | F1 / F2 | ML040626 |  |
| 480 | Sabiloul Najahi Péleng | `ml-registre-5296c15af0384e5323d10d31` | `ml-registre-7d831124cacca08221ab6928` | F1 / F2 | ML040620, segou|pelengana | nom |
| 481 | Saint FRANçOIS | `ml-registre-ca38837692da6f7617ef05e3` | `ml-registre-cee10f42e6031dd557fc66fd` `ml-registre-eb3f2b0e679a9679873a693f` | F2 / F1 / CDPE | koutiala|koutiala | nom |
| 482 | Sainte Famille | `ml-registre-6a0ad77c606adbc191f9bb8c` | `ml-registre-9f2d7646b05fe61164a1f68e` | CDPE / F1 | ML030204 |  |
| 483 | Salakoïra | `ml-registre-85495d2a53ff0797deda1c9b` | `ml-osm-3e24e823c97335e64004c74c` | F1 / CDPE | ML060102 | nom, statut |
| 484 | Salam Watakadoumi | `ml-registre-3fcf5e520ccec5c35dbddeba` | `ml-registre-8255166204785f59cf97cc78` | F2 / F1 | ML030519 |  |
| 485 | Sampara | `ml-registre-0ce70e95c1144e6090cd7ebb` | `ml-registre-1bcc0a95157e7953bf85581a` `ml-registre-1f8ff868236c84eb8d04814a` | CDPE / F1 / F2 | ML050601 | nom |
| 486 | Samssoul Biladi | `ml-registre-4954d2311d1526ec0427a42e` | `ml-registre-6d057ee333a6004484760177` | F2 / F1 | ML050609 |  |
| 487 | École privée Sankaranka | `ml-osm-e3ee633e66852951b3965e4e` | `ml-registre-fcbaeb334f395eb90c1fd4b7` | F1 / F2 | ML090106, bamako|commune vi |  |
| 488 | Saréma | `ml-registre-1070d3abcecf5bc95e5dceb1` | `ml-registre-3f2140f7c7f004b2d675b550` `ml-registre-757212eec8e4d213e027d9e8` | F2 / F1 / CDPE | ML050614 |  |
| 489 | Sebil El Islamia Nassoriaty | `ml-registre-82c6aa99c3bd737570b8a0bf` | `ml-registre-edb5fbf08b1d63be4eaca2db` | F2 / F1 | ML040620 |  |
| 490 | Seydou BOUARE Diabolo | `ml-osm-3f78de58bc6cb35b28bcee5e` | `ml-registre-2d6380f5c03e48e35e25cdeb` | F1 / F2 | ML050303 | nom |
| 491 | École Prive Simbo Keita | `ml-osm-5e826790649ef686b6470278` | `ml-registre-fcf099170b5320a8f98c749f` | F1 / F2 | ML020415, kati|kalabancoro | nom |
| 492 | Sirandji Mounir | `ml-registre-397acd8180e3a4ad08e0e37a` | `ml-registre-63ac4750bb0db0a27524613a` | F1 / F2 | ML020711 |  |
| 493 | Souboulou Salam | `ml-registre-48508073f91dc30c5cafa8d2` | `ml-registre-7870a7930e12890b135c7b07` | F2 / F1 | ML040626 |  |
| 494 | Soumeïya El islamiya | `ml-registre-1087d525e4a931b87ca4477d` | `ml-registre-2d52e2dcf6f32305a4eac5a2` | F2 / F1 | ML040620 |  |
| 495 | Souvenir | `ml-registre-01dfe7217e4318d1d6d07926` | `ml-registre-661cb91848d0991f12fdb876` `ml-registre-71b3d904514e68085247ab1e` | F1 / CDPE / F2 | ML030203 |  |
| 496 | Ste Marie Dembagnouma | `ml-registre-c7bb071a044102b709190ab0` | `ml-registre-fa8559c4ce0db220cea4c902` | F1 / CDPE | segou|dougabougou | nom |
| 497 | Syn "FA" | `ml-osm-d096bc3a15806d67e3018ddd` | `ml-registre-e12642e192f04423c5cb5d2c` | F1 / F2 | ML050303 | nom |
| 498 | Syn Medersa | `ml-osm-134afc36f5f2b6391109d34d` | `ml-registre-f208c80304df0cfe7dc0f221` | F1 / F2 | ML050303 | nom |
| 499 | Tahazib Islamique | `ml-registre-8057934708352413cb71d5de` | `ml-registre-db7a56e402eae1404c82b3b3` | F1 / F2 | ML040626 |  |
| 500 | Tahirou CISSE 'A' | `ml-registre-5e978302a8ee0d335d1ea157` | `ml-registre-b623c02f05c9dad3095da099` | F2 / F1 | ML050708 | nom, statut |
| 501 | Tahirou CISSE B | `ml-osm-0333eceb104b37e238ffb18b` | `ml-registre-7c4a185854eb38caa51d2b90` | F2 / F1 | ML050708 | nom |
| 502 | Taoudenit At Kaza | `ml-registre-1fd687171d42f2ba963d8278` | `ml-registre-a623012ecddb28de3241ac1f` | CDPE / F1 | ML060505 | nom |
| 503 | Tarbiatoul Banini Wal Banati de Niono | `ml-registre-1ae990f57d12f0bf3b394fe6` | `ml-registre-b7632f84ccdeb7d7a930a505` | F1 / F2 | ML040406 |  |
| 504 | Tarbiatoul Banini Wal Banati DGB | `ml-registre-13708cd6644b0ffac4eb21cc` | `ml-registre-f035036b66ad780911b895d9` | F2 / F1 | ML040609 | nom |
| 505 | Tarbiatoul Banini Wal Banati Km 23 | `ml-registre-16b77c2e7bea7692103e5469` | `ml-registre-3702b60a76acbec4f170b862` | F1 / F2 | niono|niono |  |
| 506 | Tarbiatoul Banini Wal Banati Kolodougou coura | `ml-registre-62eed0775c1311682ed663b9` | `ml-registre-7a14d6b0dd45a9698b45e6f7` | F2 / F1 | niono|niono |  |
| 507 | Tarbiyatou Dine Soussoula | `ml-registre-45a5dc821959cc9b05667c20` | `ml-registre-901611977f909db8d6e10536` | F2 / F1 | koutiala|koloningue | nom |
| 508 | Tarbiyatou E.B.WAL Banati | `ml-registre-53f058148b331bf1d6b3a930` | `ml-registre-7a463abe2131f28fdec0ec77` | F2 / F1 | ML050203 | nom |
| 509 | Tarbiyatoul Houda | `ml-registre-e83dd3d621f4095ffa1d8001` | `ml-registre-ef2ddf0d3f79c3f9074c80af` | F2 / F1 | ML040620 |  |
| 510 | Tarbiyatoul Islamia | `ml-registre-35a10e358d9dd23a1d72cde1` | `ml-registre-4cb15761fa29b6561af646a9` | F1 / F2 | ML040630 |  |
| 511 | Taribyatou Banina Wal Banati | `ml-registre-9f15759847a713bd84d9b3da` | `ml-registre-be237ae5a074ad5f6bdc164c` | F2 / F1 | ML050609 |  |
| 512 | Complexe scolaire Thomas Sankara de Siribala | `ml-registre-8a2e3ec062a4d13ff318a66f` | `ml-registre-b24707e3819c594e61c9d5f7` | F1 / F2 | ML040408 | nom |
| 513 | Tiborogo | `ml-registre-5069dfb325a0e50988ade313` | `ml-registre-e83b6ac185525b3c5116390d` | F2 / F1 | ML030203 |  |
| 514 | Tidiane KONE | `ml-registre-059a7e3571be553ff2cdecf5` | `ml-registre-33b3189014a17f02a7341f4c` | F1 / F2 | koutiala|koutiala | nom |
| 515 | Tiéba TRAORE | `ml-registre-3717db52cc312df4e1f9d901` | `ml-registre-9cb6daeaf99595ac2de4ace8` `ml-registre-a0a1c1c3ed5b696bea09bbe5` | CDPE / F2 / F1 | ML050614 |  |
| 516 | Tombouctou Coura | `ml-registre-3027207d8df1cf92d48bd6b4` | `ml-registre-5c43259c0c4181bacd18f231` | F1 / F2 | ML050609 |  |
| 517 | Tonthan I | `ml-registre-b6c06d5422ae8319d28c34ae` | `ml-registre-bda5c1175a292577ab405350` | F1 / F2 | bamako|commune vi | nom |
| 518 | Toriquou Najati | `ml-registre-340447cb1cce5f5ae6bba0e5` | `ml-registre-b0f8304a8d8e7c77249ffe3b` | F1 / F2 | ML040620 |  |
| 519 | Une Chance Pour Tous | `ml-osm-19680990f353f1c73c4065a2` | `ml-registre-1954087289914c3f3287222f` | F1 / F2 | ML040620 | nom |
| 520 | École privée Wassa | `ml-osm-02842fe7e1630df07a558217` | `ml-osm-1f16c9acd7d013620a199580` | F1+F2 / CDPE | ML020417 | nom, niveaux |
| 521 | Weleguena A | `ml-registre-80443854ad383275016dff3f` | `ml-registre-e38fb4941db61052b9ebf8de` | F2 / F1 | koutiala|n gountjina | nom |
| 522 | Weleguena B | `ml-registre-5dce38deb798273f0dd73933` | `ml-registre-f2d10a0e460674a571a0cf1d` | F2 / F1 | koutiala|n gountjina | nom |
| 523 | Groupe scolaire Ya Samaké | `ml-osm-a2b6b1804da66b4ca30bc793` | `ml-registre-d3c8f95107657b7cd119cf71` | F1 / F2 | ML090104, bamako|commune iv |  |
| 524 | Yangassadiou | `ml-osm-ee448143c2c8faa050674401` | `ml-registre-24b682db1242481f94140a79` | F1 / F2 | ML050413 | nom |
| 525 | École Youre | `ml-osm-fc8e9fc6692c4fed875ba4ad` | `ml-registre-84aa3ec634ff6adfaf1cffbf` | F1 / CDPE | ML050613 |  |

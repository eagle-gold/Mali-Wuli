# Doublons exacts d’établissements au Mali — plan de fusion (29 septembre 2026)

Extraction en lecture seule de la base de production le 2026-09-28T23:57:50.493Z (UTC). Aucune écriture en base, aucune fusion appliquée. Plan : `plan.json` ; script d’application (non exécuté) : `backend/src/scripts/fusion-doublons-plan.ts`.

## Chiffres

| | Groupes | Fiches |
|---|---:|---:|
| Périmètre (ML, valide=1, même nomNormalise + villeNormalisee) | 900 | 1916 |
| **SURE** | **5** | 10 (5 à désactiver) |
| **A_VERIFIER** | **895** | 1906 |

Sous-catégories A_VERIFIER (une seule par groupe, par ordre de priorité) :

| Sous-catégorie | Groupes | Signification |
|---|---:|---|
| CYCLES_DISTINCTS_SANS_COORDONNEES | 417 | registre MEN : cycles différents (F1/F2/CDPE) et/ou codes officiels différents, aucune coordonnée — établissements distincts au sens du registre |
| NOM_GENERIQUE | 326 | nom générique (vocabulaire seul ou nom de la localité seul) avec d’autres signaux insuffisants ou contraires |
| CYCLES_DISTINCTS_MEME_SITE | 55 | cycles/codes officiels différents mais même site (< 300 m ou une seule fiche géolocalisée) — probables complexes F1+F2 : décision produit (fusionner les cycles ou non) |
| CODES_OFFICIELS_DIFFERENTS | 41 | codes officiels MEN différents (sans conflit de cycle) |
| PROMOUVABLE_NOM_LOCALITE | 30 | seul bloquant : nom = localité ; preuve géographique présente, aucun conflit de registre — candidats à validation humaine rapide (canonique proposé dans le plan) |
| SITES_DIFFERENTS | 20 | distance ≥ 300 m ou communes différentes |
| SANS_PREUVE_GEOGRAPHIQUE | 4 | aucune coordonnée ni identifiant commun (nom distinctif, pas de conflit) |
| AUTRE | 2 | types incompatibles ou statuts contradictoires |

Bloquants rencontrés (un groupe peut en cumuler plusieurs) : CODE 692, CYCLE 543, SANS_PREUVE 500, NOM_TOPONYME 324, DISTANCE 259, COMMUNE 146, NOM_VOCABULAIRE 32, ENSEIGNEMENT 9, COMMUNE_MULTI 3, TYPE 2, STATUT 1.

## Règles

- **Nom générique** : Un nom est générique si, après normalisation, il ne reste aucun mot distinctif une fois retirés : le vocabulaire générique (motsGeneriques), les lettres isolées, les nombres/ordinaux et les mots du nom de la localité (villeNormalisee). Un sigle écrit lettre par lettre d’au moins trois lettres (« A.H.M ») est considéré comme distinctif. Une variante orthographique du nom de localité (distance d’édition ≤ 40 % de la longueur, ex. Immach / In Mache) compte comme la localité.
- Vocabulaire générique : 1e, 1er, 1ere, 2e, 2eme, 2nd, a, al, annexe, arabe, au, aux, cdpe, centre, college, communautaire, communautaires, complexe, complexes, coran, coranique, corant, cscom, csref, cycle, cycles, d, dar, de, des, deuxieme, du, e, ec, ecole, ecoles, ecom, ef, el, en, enfant, enfants, et, etablissement, fondamental, fondamentale, fondamentales, franco, garderie, groupe, groupes, i, ii, iii, institut, islamia, islamique, islamiques, iv, jardin, jardins, km, l, la, laique, le, les, lycee, madrasa, maternelle, med, medersa, medersas, medressa, p, pr, premier, prescolaire, primaire, priv, prive, privee, privees, prives, pub, public, publique, publiques, sante, scolaire, scolaires, second, seconde, troisieme.
- **SURE** : Aucun bloquant ET preuve d’identité : distance maximale entre fiches géolocalisées < 300 m, OU une seule fiche géolocalisée, OU code officiel MEN commun à toutes les fiches.
- Bloquants (→ A_VERIFIER) : nom générique ; types incompatibles (hors FONDAMENTALE/LYCEE) ; codes officiels MEN (codeCps 2023 / codeEtablissement 2013) disjoints ; codes cluster MEN 2023 disjoints ; cycles disjoints (F1/F2/CDPE) ; enseignement Classique vs Medersa ; codes commune disjoints ou fiche multi-communes ; statuts PUBLIC/PRIVE contradictoires ; systèmes éducatifs différents ; distance ≥ 300 m ; aucune coordonnée ni identifiant commun. Les codes officiels viennent de `donneesBrutes` (codeCps 2023 = codeEtablissement 2013). Les groupes de plus de deux fiches exigent que toutes les paires passent les contrôles.
- **Canonique** : Plus grand nombre de Formation + AvisEtablissement, puis meilleure priorité de SourceEducative (plus petit nombre), puis createdAt le plus ancien, puis id.
- statut recopié seulement si le canonique est INCONNU et qu’un seul statut connu existe dans le groupe ; sigle seulement si absent et unique.

## Références trouvées (fiches du périmètre)

- Formation : ml-complexe-scolaire-mali-univers (1) ; AvisEtablissement : aucun ; EtablissementProgramme : 1 fiche(s).
- SuggestionCatalogue : 0 référence (2 suggestions en base, types SERIE/SPECIALITE, sans candidatId/canoniqueId).
- ForumQuestion.etablissementId : 0 référence.
- Profil.onboardingDonnees : 1 profil / snapshot (ml-complexe-scolaire-mali-univers en $.formations.1.etablissementId). Ce profil pointe vers la fiche qui doit rester canonique ; aucun snapshot n’est modifié par les groupes SURE.
- À reporter pour les groupes SURE : {"formations":0,"avis":0,"etablissementProgrammes":0,"sources":5,"suggestions":0,"forumQuestions":0,"profils":0,"miseAJourCanonique":2}.
- Groupe prioritaire : « Complexe Scolaire Mali Univers » (Bamako) — seule formation réelle ; classé A_VERIFIER faute de coordonnées et d’identifiant commun (DGI/LinkedIn vs registre MEN 2013 F1+F2). Si validé, garder `ml-complexe-scolaire-mali-univers` comme canonique : le snapshot n’aura alors rien à réécrire.

## Groupes SURE (5, tous listés)

### Ecole de Lambatra — Tringa
- Preuve : distance < 300 m ; distance maximale 157 m — vigilance : 2 nœuds OSM distincts : possible école à cycles séparés sur un même site
- Canonique `ml-osm-0f794ce569f48e4ede2d718f` : tous critères égaux : identifiant le plus petit (ordre déterministe)
  - **canonique** `ml-osm-0f794ce569f48e4ede2d718f` INCONNU (14.637328, -10.701791) — hotosm-mali-education:node/5127523172
  - fusionné `ml-osm-99f09a86f1a263c5f47a9e88` INCONNU (14.638693, -10.701429) — hotosm-mali-education:node/5127508291

### Essakane II — MENAKA
- Preuve : une seule fiche géolocalisée ; une seule fiche a des coordonnées
- Canonique `ml-registre-0cfdae6e4b6493d06cfe8ce9` : à usage égal (0), source la plus fiable : ocha-men-mali-schools-2023 (priorité 4 contre 9) ; mise à jour {"statut":"PUBLIC"}
  - **canonique** `ml-registre-0cfdae6e4b6493d06cfe8ce9` INCONNU (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:MENMEN0031:95bb1f1268 — cycle F1
  - fusionné `ml-registre-ed7821cecce06b2408288e71` PUBLIC (15.908048, 2.415222) — unicef-men-mali-schools-2013:men-2013:962676 — cycle F1

### Niomi — Bamako
- Preuve : une seule fiche géolocalisée ; une seule fiche a des coordonnées — vigilance : 2 nœuds OSM distincts : possible école à cycles séparés sur un même site
- Canonique `ml-osm-2709607e6e5f3252f31cf740` : tous critères égaux : identifiant le plus petit (ordre déterministe) ; mise à jour {"statut":"PUBLIC"}
  - **canonique** `ml-osm-2709607e6e5f3252f31cf740` INCONNU (12.655227, -8.029072) — hotosm-mali-education:node/7038695079
  - fusionné `ml-osm-fc1d91a9670a42499a618985` PUBLIC (sans coordonnées) — hotosm-mali-education:way/669553601

### S.I.T. — Djenne
- Preuve : distance < 300 m ; distance maximale 47 m — vigilance : 2 nœuds OSM distincts : possible école à cycles séparés sur un même site
- Canonique `ml-osm-631bae55b38afe97f57effda` : tous critères égaux : identifiant le plus petit (ordre déterministe)
  - **canonique** `ml-osm-631bae55b38afe97f57effda` PUBLIC (13.90606, -4.55327) — hotosm-mali-education:node/3079761978
  - fusionné `ml-osm-8ffa51f7d00c55ae2a4c6dbf` PUBLIC (13.90593, -4.55368) — hotosm-mali-education:node/3079761979

### Teriya — Bamako
- Preuve : une seule fiche géolocalisée ; une seule fiche a des coordonnées — vigilance : fiche ml-registre-8149834b9d0403821f50e865 porte déjà 2 codes officiels (11040151, 722906)
- Canonique `ml-registre-8149834b9d0403821f50e865` : à usage égal (0), source la plus fiable : unicef-men-mali-schools-2013 (priorité 9 contre 35)
  - fusionné `ml-osm-298de3d7867aaf63663c5801` INCONNU (12.59966, -8.017678) — hotosm-mali-education:node/6834178807
  - **canonique** `ml-registre-8149834b9d0403821f50e865` PRIVE (sans coordonnées) — unicef-men-mali-schools-2013:men-2013:11040151, unicef-men-mali-schools-2013:men-2013:722906 — cycle F1+F2

## Candidats promouvables (A_VERIFIER, seul bloquant = nom de localité) : 30

Pour les promouvoir après contrôle humain, passer leur `classe` à `SURE` et copier `canoniquePropose`/`fusionnesProposes` dans `canoniqueId`/`fusionnesIds` ; le script revalide tout en base.

| Groupe | Distance max | Canonique proposé | Fusionné(s) |
|---|---:|---|---|
| bignekolobougou|bignekolobougou | 265 m | `ml-registre-a3b3985115eb6288373e91a9` | `ml-osm-cf8ef825bed3665caf53ce80` |
| communautaire de manalo|manallo | 291 m | `ml-registre-29690582a1cc3b3f3a63a234` | `ml-osm-8ce45fde82d347646f1f7eef` |
| dar corant de walitoumbou|walitoumbou | 296 m | `ml-registre-08d285d9c52442834b359bc9` | `ml-osm-ae9c517d4ace07bed8338739` |
| diababougou|diababougou | 261 m | `ml-registre-2902e9cc6d914ca8373b785b` | `ml-osm-834ed22d0df2b48c3f8d059d` |
| ecom karako|karako | 286 m | `ml-registre-ae941f9cfc4724b46a070e6e` | `ml-osm-2f4c6601c60307381b10920f` |
| ecom kinsika|kinsiya | 219 m | `ml-registre-62042c401c7e8429086c3d41` | `ml-osm-9f31e49b1d7ffefe7552e3ed` |
| gogui 2eme c|gogui | 1 seule géolocalisée | `ml-osm-2704b03715da81fbfe2e5746` | `ml-osm-d1a144552275f2e8b92d15e8` |
| gonido|gonido | 249 m | `ml-registre-d382bc0118b649aed0621921` | `ml-osm-820132fc03e4ac3c54b63486` |
| immach|in mache | 280 m | `ml-registre-97b1a50eda128d89d818bdfc` | `ml-osm-66f0397d2400283d4aa7ac00` |
| ingouyas|in gouyas | 295 m | `ml-registre-0223f5522f2a59ad8347d675` | `ml-osm-c60fa84dbc2a8bb2b66e2209` |
| kaimpo|kaimpo | 249 m | `ml-registre-97f96e20b6e62b3136fe7eda` | `ml-osm-7d84116c011c4834efa3fd25` |
| kara|kara | 173 m | `ml-osm-11c75d5b51906aa39268f663` | `ml-osm-49bc7bb2763c7f92c0bb5de9` |
| kodiani|kodiani | 294 m | `ml-registre-ac162d6480e4f71005525005` | `ml-osm-19fc6c6c7444f0e6026af4e8` |
| kongosso|kongosso | 241 m | `ml-registre-3470326a4152354c73f89628` | `ml-osm-a69a29ffb263599b96f5961f` |
| kouremale|kouremale | 1 seule géolocalisée | `ml-registre-4b5fff3f56bffb508fcab7f4` | `ml-osm-d1e58aa063fe86ba23d8c06d` |
| n gassola|n gassola | 1 seule géolocalisée | `ml-registre-20d514cda602dbb8385b7c41` | `ml-osm-04ab101889bd5f726a5a6cdc` |
| nioro tougoune rangabe|nioro tougoune rangabe | 1 seule géolocalisée | `ml-registre-db551b4ac04a6941eb7eadd9` | `ml-osm-70aa460e995202ece8e00180` |
| ouesso|ouesso | 257 m | `ml-registre-f52e197b23817b4ecfb4b743` | `ml-osm-220c55b9108b6995412a4ec7` |
| sala|salla | 1 seule géolocalisée | `ml-registre-c08a950fcd55d99f77b86b86` | `ml-osm-a1d6b3a6fd5dcf29fd065d19` |
| seregnana|sereyana | 279 m | `ml-registre-44f666c32656ca620a26026b` | `ml-osm-9d9d4e14a6ece4554d3b7bcf` |
| sikoroni|sikoroni | 202 m | `ml-registre-1462d441b8f8cbd1e37ed8b6` | `ml-osm-746d636a3ab68230726fe06e` |
| sinsimba|sinsimba | 283 m | `ml-registre-79539a17ae4eafaec6e4018e` | `ml-osm-fe7a4c7ca31a97355ebdfb92` |
| sirablo|sirablo | 255 m | `ml-registre-522bd556efd0b49ff7ab3709` | `ml-osm-7855a8ff6495e64d6b426b0a` |
| tamani|tamani | 1 seule géolocalisée | `ml-registre-1bd340041c4c7ebebc08c488` | `ml-registre-a48c4f896729754365d7b294` |
| tin eloine|tin elouane | 290 m | `ml-registre-cdcad7b60a37fdfc1849a427` | `ml-osm-2f38ded6ab33e07106cb51db` |
| tleladji|tleladji | 209 m | `ml-registre-ec613f8fb4871f99dbc0802a` | `ml-osm-0a1ed1dfd8cbf3120db56498` |
| waranzan were|warazan were | 271 m | `ml-registre-11864ec731dc11367d755069` | `ml-osm-3aee841c13e5d0e1171ed8c4` |
| yollo were|yolo were | 274 m | `ml-osm-84138167f3a04fe27ba23cc7` | `ml-registre-735b0db8e5e8e36cc69da58d` |
| zanguenabougou|zanguenabougou | 205 m | `ml-registre-95e562d14df746cbfafcef1c` | `ml-osm-2c7f92d766d10b5c13c9ea00` |
| zeala|ziela | 281 m | `ml-registre-3025a79b68b76ccee9f9201e` | `ml-osm-2c90dc7c88e966b490218d6a` |

## 15 exemples A_VERIFIER

- **a h m|ansongo** [CYCLES_DISTINCTS_SANS_COORDONNEES] : codes officiels MEN différents (11079213 vs 11028703) : établissements distincts dans le registre ; cycles différents (F2 vs F1) ; aucune fiche géolocalisée et aucun identifiant commun
  - `ml-registre-7214a867ff44119560a0a69d` PRIVE (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:GAOANS0002:da90f7623e — cycle F2
  - `ml-registre-d335615332190fc9d4ba3680` PRIVE (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:GAOANS0001:06a6fdf028 — cycle F1
- **amayowo|bandiagara** [CYCLES_DISTINCTS_MEME_SITE] : codes officiels MEN différents (1008022 vs 11083364) : établissements distincts dans le registre ; cycles différents (F1 vs F2)
  - `ml-registre-0a493607a163aea8ac7ea36d` PRIVE (14.35, -3.611) — ocha-men-mali-schools-2023:men-2023:BANBAN0009:1f627ddb7e, unicef-men-mali-schools-2013:men-2013:1008022 — cycle F1
  - `ml-registre-a5f27290adaea20b14085b70` PRIVE (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:BANBAN0010:4acadc6a2c — cycle F2
- **1er cycle|madina** [NOM_GENERIQUE] : nom générique : uniquement du vocabulaire générique
  - `ml-osm-355864919d2cefac14805d3c` INCONNU (13.398806, -8.859369) — hotosm-mali-education:node/6027317626
  - `ml-osm-e4e1b237b78fff8e3953aa09` INCONNU (13.39817, -8.859108) — hotosm-mali-education:node/6027317628
- **almatla|salam** [CODES_OFFICIELS_DIFFERENTS] : codes cluster MEN 2023 différents (TAOBOU0006 vs TAOACH0008) ; aucune fiche géolocalisée et aucun identifiant commun
  - `ml-registre-4a554cf50e1a6f66b9570a03` INCONNU (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:TAOBOU0006:e258694191 — cycle F1
  - `ml-registre-5ca20277fdffdfb20b419c17` INCONNU (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:TAOACH0008:a9a409d961 — cycle F1
- **amadou kodio de domini|domoni** [SITES_DIFFERENTS] : distance maximale 347 m (≥ 300 m)
  - `ml-osm-677a7138f7ae0e8e13b4a3fa` PUBLIC (14.281165, -2.992017) — hotosm-mali-education:node/3079736635
  - `ml-registre-d0f342030457819599b67cac` PUBLIC (14.28, -2.995) — unicef-men-mali-schools-2013:men-2013:1058163 — cycle F1
- **complexe scolaire mali univers|bamako** [SANS_PREUVE_GEOGRAPHIQUE] : aucune fiche géolocalisée et aucun identifiant commun
  - `ml-complexe-scolaire-mali-univers` PRIVE (sans coordonnées) — dgi-mali:082212399B, linkedin-organisations:csmaliunivers
  - `ml-registre-3cf74d907f6665a6738beb73` PRIVE (sans coordonnées) — unicef-men-mali-schools-2013:men-2013:11040673, unicef-men-mali-schools-2013:men-2013:960441 — cycle F1+F2
- **institut des hautes etudes en management|bamako** [AUTRE] : types incompatibles ECOLE_SUPERIEURE/LYCEE
  - `ml-ihem` PRIVE (sans coordonnées) — legrandfrere-mali:institut-des-hautes-etudes-en-management-ihem
  - `ml-osm-8933418efb351d21e5350fb9` PRIVE (12.628459, -8.033563) — hotosm-mali-education:node/3592316323
- **e pr les pionniers|sikasso** [CYCLES_DISTINCTS_SANS_COORDONNEES] : codes cluster MEN 2023 différents (SIKSIK0119 vs SIKSIK0120) ; cycles différents (F2 vs F1) ; aucune fiche géolocalisée et aucun identifiant commun
  - `ml-registre-7c437a24b663f92d2604f71a` PRIVE (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:SIKSIK0119:0796043bb2 — cycle F2
  - `ml-registre-dbcb0ef7e27b912605139670` PRIVE (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:SIKSIK0120:7ce93ca4f0 — cycle F1
- **koundianga|bamba** [CYCLES_DISTINCTS_MEME_SITE] : codes cluster MEN 2023 différents (DOUMAD0075 vs DOUMAD0076) ; cycles différents (F1 vs CDPE)
  - `ml-osm-1012f17155ba364d365cdc3a` PUBLIC (14.651186, -3.087102) — hotosm-mali-education:node/3079737581, unicef-men-mali-schools-2013:men-2013:741073, ocha-men-mali-schools-2023:men-2023:DOUMAD0075:e80592ab43 — cycle F1
  - `ml-registre-f30102d167d20e4da312b6ab` INCONNU (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:DOUMAD0076:ad29dd2544 — cycle CDPE
- **kabala|kabala** [NOM_GENERIQUE] : nom générique : seulement le nom de la localité « kabala » (ou une variante) ; distance maximale 105270 m (≥ 300 m)
  - `ml-osm-066626acc2e8d33069ddc273` PUBLIC (12.524317, -8.0419) — hotosm-mali-education:node/3079746086, hotosm-mali-education:node/3079746089
  - `ml-registre-8862f36105fdf600f22420ca` PUBLIC (12.01625, -7.224383) — unicef-men-mali-schools-2013:men-2013:712039 — cycle F1
- **koungoba|benkadi** [CODES_OFFICIELS_DIFFERENTS] : codes cluster MEN 2023 différents (SIKNIE0075 vs SIKNIE0074)
  - `ml-registre-33e4319993a0362ec490af1f` PUBLIC (11.603115, -6.43484) — unicef-men-mali-schools-2013:men-2013:939794, ocha-men-mali-schools-2023:men-2023:SIKNIE0075:7643df0773, unicef-men-mali-schools-2013:men-2013:753004 — cycle F1+F2
  - `ml-registre-3e1e0292d93f1eaac9935279` INCONNU (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:SIKNIE0074:390041f9aa — cycle F1
- **ecole privee alikaou blen 1er cycle|bamako** [SITES_DIFFERENTS] : distance maximale 621 m (≥ 300 m)
  - `ml-osm-02d7a9e439eb4f9d3763d647` INCONNU (12.589013, -7.958575) — hotosm-mali-education:node/5352353624
  - `ml-osm-7c738b41f1e11e9b4f65d174` INCONNU (12.587181, -7.963977) — hotosm-mali-education:node/5358502321
- **thiombougou|sanando** [SANS_PREUVE_GEOGRAPHIQUE] : aucune fiche géolocalisée et aucun identifiant commun
  - `ml-registre-65a52ffe4e448bff30cc67d3` INCONNU (sans coordonnées) — unicef-men-mali-schools-2013:men-2013:710103 — cycle F1
  - `ml-registre-dac64a94b8d60f4cae12df35` INCONNU (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:SEGSAN0069:e978714535 — cycle F1
- **institut national de formation en sciences de la sante|bamako** [AUTRE] : types incompatibles ECOLE_SUPERIEURE/LYCEE
  - `ml-infss` PUBLIC (sans coordonnées) — campus-mali-api:universite:bab0ade7-45be-4dbb-a932-91dcd5390d7e
  - `ml-osm-8653703dddef214e2a68beda` INCONNU (12.659336, -8.012751) — hotosm-mali-education:node/6325344275
- **med tahafiz al coran|sikasso** [CYCLES_DISTINCTS_SANS_COORDONNEES] : codes officiels MEN différents (951229 vs 11040633) : établissements distincts dans le registre ; cycles différents (F1 vs F2) ; aucune fiche géolocalisée et aucun identifiant commun
  - `ml-registre-7344520c8f8e775dbfbf73a1` PRIVE (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:SIKSIK0435:f00fe78784 — cycle F1
  - `ml-registre-e444fc9aa1a6f8a05b283ac6` PRIVE (sans coordonnées) — ocha-men-mali-schools-2023:men-2023:SIKSIK0436:990c201956 — cycle F2

## Limites

- Le groupement suit strictement `nomNormalise + villeNormalisee` : les doublons à nom légèrement différent ne sont pas couverts ; des fiches d’un même groupe déjà `valide=0` sont ignorées.
- 5 groupes SURE seulement : l’essentiel des 900 groupes correspond à des entrées distinctes du registre MEN (premier cycle / second cycle / CDPE, codes officiels différents). Les fusionner serait une décision produit (regrouper les cycles d’un complexe), pas un dédoublonnage.
- Trois groupes SURE reposent sur deux objets OSM distincts sans registre : un même site peut héberger deux cycles.
- Les liens déjà diffusés et brouillons navigateur contenant un ancien id ne sont pas redirigés : la fiche fusionnée reste en base avec `valide=false`.

## Régénérer le plan (obligatoire au-delà de 24 h)

Depuis `outils/` (lecture seule, SELECT uniquement) : `ssh … 'cd <app> && node -' < extract.js > extract.json`, idem `raw2.js > raw2.json`, puis `node classify.js <dossier>` et `node resume.js <dossier>`. Le script d’application refuse un plan dont `extraitLe` a plus de 24 h ou dont une fiche a changé (`updatedAt`).

Simulation : `cd backend && ./node_modules/.bin/tsx src/scripts/fusion-doublons-plan.ts [--limit N]` (écrit seulement un journal JSON à côté du plan). Application : ajouter `--apply`, uniquement après sauvegarde restaurable et accord explicite, puis consigner dans JOURNAL_REPRISE.md.

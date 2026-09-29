#!/usr/bin/env python3
"""Génère ../resume.md à partir de plan-villes.json, referentiel-communes.json, stats.json (hors ligne)."""
import json, os, random, collections as C

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
plan = json.load(open(os.path.join(OUT, "plan-villes.json")))
ref = json.load(open(os.path.join(OUT, "referentiel-communes.json")))
st = json.load(open(os.path.join(OUT, "stats.json")))
F = plan["fiches"]
random.seed(29)


def pick(cond, k):
    xs = [l for l in F if cond(l)]
    return random.sample(xs, min(k, len(xs)))


def src(l):
    return " + ".join(sorted({f'{e["source"]}:{e.get("communeBrute") or "?"}' for e in l["preuve"]})) or "—"


exemples = []
exemples += pick(lambda l: l["confiance"] == "HAUTE" and l["localiteConservee"] and l["villeProposee"] != "Bamako"
                 and any(e["source"] == "MEN2013" for e in l["preuve"]), 7)
exemples += pick(lambda l: l["confiance"] == "HAUTE" and l["localiteConservee"] and l["villeProposee"] != "Bamako"
                 and not any(e["source"] == "MEN2013" for e in l["preuve"]), 4)
exemples += pick(lambda l: l["change"] and l["villeNormaliseeActuelle"] == l["villeNormaliseeProposee"], 3)
exemples += pick(lambda l: l["villeProposee"] == "Bamako" and l["villeActuelle"] != "Bamako", 4)
exemples += pick(lambda l: l["confiance"] == "MOYENNE" and l["statut"] == "unanime", 3)
exemples += pick(lambda l: l["statut"] in ("knn_unanime", "knn_bamako"), 2)
exemples += pick(lambda l: l["statut"] == "conflit_departage_knn", 2)
exemples += pick(lambda l: l["confiance"] == "BASSE" and l["statut"] == "conflit", 3)
exemples += pick(lambda l: l["statut"] == "non_resolu", 2)

lignes_ex = "\n".join(
    f'| {i+1} | {l["nom"][:38]} | {l["villeActuelle"] or "∅"} | **{l["villeProposee"]}** | {l["commune"] or "—"} / {l["cercle"] or "—"} | {l["localiteConservee"] or "—"} | {l["confiance"]} ({l["statut"]}) | {src(l)[:80]} |'
    for i, l in enumerate(exemples[:30]))

nonres = [l for l in F if l["statut"] == "non_resolu"]
nonres_txt = "\n".join(f'- `{l["id"]}` {l["nom"]} — ville actuelle « {l["villeActuelle"]} » — {src(l)}' for l in nonres)
basse = C.Counter(l["statut"] for l in F if l["confiance"] == "BASSE")
inco = C.Counter(x["type"] for x in ref["incoherences"])
nonreco = [x for x in ref["incoherences"] if x["type"] == "commune_registre_non_reconnue"]
pcode_faux = [x for x in ref["incoherences"] if x["type"] == "pcode_men2023_contredit_par_nom"]
homo = [x for x in ref["incoherences"] if x["type"] == "homonymes"]
seul23 = [c for c in ref["communes"] if c["origine"].startswith("MEN 2023")]
cov = st["couvertureParSource"]
top = C.Counter(l["villeProposee"] for l in F).most_common(15)
bk = st["bamakoParCommune"]

md = f"""# Villes des établissements du Mali — plan de normalisation (simulation, rien d'appliqué)

Extraction : `{plan['extraitLe']}` (SELECT seul), fiches `paysCode='ML' AND valide=1`.
Fichiers : `plan-villes.json` (1 ligne par fiche), `referentiel-communes.json` (communes + incohérences), `stats.json`, outils dans `outils/`.

## 1. Chiffres clés

| | Avant | Après (tout appliqué) | Après (BASSE non appliquée) |
|---|---|---|---|
| Fiches | {st['fiches']} | {st['fiches']} | {st['fiches']} |
| `ville` distinctes (libellé brut) | {st['villesDistinctesAvant']} | {st['villeNormaliseeDistinctesApres']} | ≈{st['villeNormaliseeDistinctesApresSiBasseNonAppliquee']} |
| `villeNormalisee` distinctes | {st['villeNormaliseeDistinctesAvant']} | {st['villeNormaliseeDistinctesApres']} | {st['villeNormaliseeDistinctesApresSiBasseNonAppliquee']} |
| Valeurs à une seule fiche | {st['singletonsAvant']} | {st['singletonsApres']} | — |

- Fiches dont `ville` ou `villeNormalisee` change : **{st['changements']}** (dont {st['changements'] - sum(1 for l in F if l['villeNormaliseeActuelle'] != l['villeNormaliseeProposee'])} changements seulement de casse ou d'accents, `villeNormalisee` identique).
- Ancienne valeur conservée comme localité : **{st['localiteConservee']}** fiches.
- Fiches rattachées à une commune du référentiel : **{st['fichesAvecCommune']}** / {st['fiches']} ({100*st['fichesAvecCommune']/st['fiches']:.1f} %).
- Confiance : **HAUTE {st['confiance'].get('HAUTE',0)}** ({100*st['confiance'].get('HAUTE',0)/st['fiches']:.1f} %), MOYENNE {st['confiance'].get('MOYENNE',0)}, BASSE {st['confiance'].get('BASSE',0)}.
- Statuts : {', '.join(f'{k} {v}' for k, v in sorted(st['statut'].items(), key=lambda x: -x[1]))}.
- Villes les plus fréquentes après : {', '.join(f'{v} ({n})' for v, n in top)}.

## 2. Commune disponible par source

| Source | Fiches portant la source | Commune résolue | Comment |
|---|---|---|---|
| OSM (HOT/HDX) | {cov['OSM']['fiches']} | {cov['OSM']['communeResolue']} | `adm3_name` + `adm3_pcode` (COD-AB OCHA) déjà présents dans `donneesBrutes` — jointure polygonale faite par HDX. Aucune localité (`adm4` vide). |
| MEN 2023 (OCHA) | {cov['MEN2023']['fiches']} | {cov['MEN2023']['communeResolue']} | `commune` + `codeCommune` (P-code), mais **P-code faux ou absent sur {st['lignesMen2023PcodeContredit']} lignes** : on résout par le **nom dans le cercle**, le P-code n'est qu'un indice. |
| MEN 2013 (UNICEF) | {cov['MEN2013']['fiches']} | {cov['MEN2013']['communeResolue']} | `commune` en majuscules, sans P-code (« COMMUNE DE KAYES », « COMMUNE V ») + `localite` (village) + `cap`. |

Combinaisons de sources : {', '.join(f'{k} {v}' for k, v in st['combinaisons'].items())}.
Méthodes de résolution des lignes registre : {', '.join(f'{k} {v}' for k, v in st['resolutionRegistres'].items())}.

**Couverture globale d'une commune fiable** : {st['confiance'].get('HAUTE',0)} fiches HAUTE ({100*st['confiance'].get('HAUTE',0)/st['fiches']:.1f} %) ; {st['fichesAvecCommune']} fiches ({100*st['fichesAvecCommune']/st['fiches']:.1f} %) avec une commune quelle que soit la confiance.

### Plus proches voisins (sans géocodage externe)
Les fiches OSM ont déjà leur commune (polygone). Le kNN ne sert donc qu'à trois cas :
- fiches sans source administrative (Overture, campus, LeGrandFrère… : {st['combinaisons'].get('autre',0)} fiches seules) : k=5, rayon 3 km, ≥3 voisins, **unanimité** → MOYENNE ; 1-2 voisins unanimes → BASSE (`knn_faible`) ; voisins tous dans Bamako → Bamako ;
- départage des conflits OSM ≠ registre : voisins **registre** uniquement (sinon le kNN recopie le polygone OSM), unanimes et égaux à l'un des candidats → MOYENNE (`conflit_departage_knn`) ;
- confirmation des résolutions MOYENNE (voisins unanimes → HAUTE).
Une fiche marquée Bamako sans commune et sans voisins reste Bamako (`ville_bamako_sans_commune`, MOYENNE) : le kNN ne peut pas la déplacer vers une commune périphérique à 2 km.

## 3. Référentiel des communes (`referentiel-communes.json`)

- **{st['communesReferentiel']} communes** : {', '.join(f'{v} « {k} »' for k, v in st['communesReferentielParOrigine'].items())}. (Le Mali compte 703 communes COD-AB ; la base OSM en couvre 695.)
- Pour chaque commune : P-code, nom officiel (COD-AB, accents : « Baraouéli », « Ségou », « Kéniéba »), cercle, région, variantes rencontrées par source (« Baroueli », « BAROUELI », « COMMUNE DE … »), nombre de fiches.
- Règles de rapprochement (dans le cercle) : exact après normalisation (préfixes « commune (rurale/urbaine) de » retirés, chiffres → romains) → squelette phonétique (ou/u, dj/j, c/k, lettres doublées : Diougani/Dioungani, Marico/Mariko) → abréviation unique (« Finkolo G » → Finkolo Ganadougou) → équivalences manuelles probables (Kolombine = Colimbiné, Djouma = Diouman, Nioro Togoune = Nioro Tougouné Rangaba, Sere Moussa Ani Samou = … de Siékorolé ; MOYENNE) → flou ≥ 0,80 avec écart ≥ 0,10 (MOYENNE) → nom unique au Mali (cercle réorganisé : Ménaka).

### Incohérences signalées ({', '.join(f'{k} {v}' for k, v in inco.items())})
- **P-codes MEN 2023 décalés** ({len(pcode_faux)} couples, {st['lignesMen2023PcodeContredit']} lignes), surtout cercle de Banamba (MEN 2023 « Duguwolowila » porte ML020106 = Madina Sacko chez COD-AB, « Madina-Sacko » porte ML020108 = Toubacoro), Salam (ML060507→510 pour une seule commune ML060505) et région de Ménaka (MEN 2023 en ML07xx, COD-AB en ML10xx après création de la région). → Ne jamais utiliser `codeCommune` MEN 2023 comme clé.
- **Communes présentes seulement dans MEN 2023** ({len(seul23)}), à vérifier : {', '.join(f"{c['nom']} ({c['cercle']}, {c['fichesProposees']} f.)" for c in seul23)}. Bandiagara (commune urbaine), Aljounoub, Tindirma, Ouinerden sont réelles mais sans école OSM ; les « communes » de la région de Ménaka (Assakaraye, Inazole, Iziguiret, Tin-Abaw, Alata, Chimam…) correspondent au découpage 2023 non repris par COD-AB — à valider avant de les afficher comme villes.
- **Noms registre non reconnus** ({len(nonreco)} libellés, {st['lignesRegistreNonResolues']} lignes, toutes MEN 2013) : {', '.join(f"{x['commune']} ({x['cercle']}, {x['lignes']})" for x in nonreco)}.
- **Homonymes** ({len(homo)} noms, {st['fichesSurCommunesHomonymes']} fiches) : {', '.join(f"{x['nom']} ({'/'.join(y['cercle'] for y in x['communes'])})" for x in homo)}. La facette les fusionnerait (même `villeNormalisee`).
- Graphies COD-AB discutables mais retenues (source officielle OCHA) : « Ben Kadi » (Banamba) vs « Benkadi » ailleurs, « Sony Aliber » (MEN : « Soni Ali Ber »), « Koporokendie Na ». Une table de libellés d'affichage peut les corriger sans toucher au P-code.

## 4. Règle cible proposée

1. `ville` = **nom officiel de la commune** (référentiel, accents usuels, casse soignée). Exception : communes I à VI du District → `ville = "Bamako"`.
2. `villeNormalisee` = `villeNormaliseePourPays("ML", ville).villeNormalisee` (même `normaliser` que le catalogue ; pour « Bamako » : `bamako`).
3. Choix de la commune : sources unanimes → HAUTE ; conflit → vote (nombre de sources, puis MEN 2023 > MEN 2013 > OSM), départage kNN registre, sinon BASSE ; conflit limité aux communes de Bamako → Bamako, HAUTE.
4. Ancienne `ville` (village, quartier, faute) → **localité**, si elle diffère de la ville et de la commune et n'est pas une étiquette « Commune I…VI / District de Bamako » ; sinon `localite` MEN 2013. Casse soignée seulement pour les libellés tout en majuscules.
5. Application recommandée : HAUTE + MOYENNE ; BASSE ({st['confiance'].get('BASSE',0)} : {', '.join(f'{k} {v}' for k, v in basse.items())}) en revue manuelle — `ville` inchangée en attendant.

## 5. Schéma : pas de champ existant adapté → migration additive

`Etablissement` n'a que `ville`, `villeNormalisee`, `description`, `latitude`, `longitude` ; `EtablissementAlias` (`nom`, `nomNormalise`, `langue`) n'a pas de type et sert à la recherche par nom (y mettre des villages polluerait la recherche) ; `donneesBrutes` garde déjà la provenance mais n'est ni indexé ni affiché. Migration proposée (**non écrite dans schema.prisma**) :

```prisma
model Etablissement {{
  // …champs existants…
  localite            String?                  // village / quartier / ancienne valeur de `ville`
  commune             String?                  // nom officiel (ex. « Commune V », « Kalabancoro »)
  communeCode         String?  @db.VarChar(24) // P-code COD-AB (ML090105) ou code provisoire « ML23:… »
  cercle              String?
  region              String?

  @@index([paysCode, communeCode])
}}
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

- Aujourd'hui : {st['fichesBamako']} fiches proposées avec `ville = "Bamako"` — {', '.join(f'{k} {v}' for k, v in sorted(bk.items(), key=lambda x: str(x[0])))} (« None » = Bamako certain, commune I–VI inconnue).
- **Proposition : garder `ville = "Bamako"`** et mettre « Commune I…VI » dans `commune` (et le quartier — Badalabougou, Hamdallaye ACI… — dans `localite`). Raisons : c'est la ville que les membres cherchent et que liste l'onboarding (47 villes `@countrystatecity`, « Bamako » mais aucune « Commune V ») ; `villeCanoniqueMali`, `variantesVille` et l'import OSM forcent déjà Bamako ; les 6 communes ne sont pas des villes au sens usuel.
- Filtre optionnel ensuite : un sous-filtre « Commune » visible seulement quand ville = Bamako (facette sur `commune`).
- Les communes périphériques (Kalabancoro, Sangarébougou, Dialakorodji, Moribabougou…) restent des villes distinctes : ce sont des communes du cercle de Kati. Conflits aux limites (OSM Sangarébougou vs MEN 2013 Commune I : 11 fiches) → BASSE, revue.

## 7. Impact sur le code

- **Facettes** (`education-facettes.service.ts`) : `ROW_NUMBER() … PARTITION BY BINARY villeNormalisee ORDER BY ville` → le libellé affiché devient celui du référentiel. Liste des villes du Mali : {st['villeNormaliseeDistinctesAvant']} → {st['villeNormaliseeDistinctesApres']} entrées. Les homonymes ({len(homo)}) sont fusionnés : acceptable, ou suffixer le cercle dans le libellé (« Benkadi (Dioïla) »).
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
{lignes_ex}

## 9. Cas non résolus ({len(nonres)} fiches `non_resolu`, ville inchangée)

{nonres_txt}

Autres BASSE : {', '.join(f'{k} {v}' for k, v in basse.items())} — détail dans `plan-villes.json` (`conflit`, `knn`).

## 10. Risques

- MEN 2023 : P-codes décalés ; seul le nom dans le cercle est fiable.
- Conflits OSM ≠ registre ({st['statut'].get('conflit',0)} + {st['statut'].get('conflit_departage_knn',0)} départagés) : parfois fusion antérieure erronée plutôt que frontière — à examiner avec le plan de fusion.
- Communes rurales dont le nom n'est pas celui d'un bourg (« Sony Aliber », « Duguwolowula », « Wassoulou Balle ») : ville exacte administrativement mais peu parlante ; la localité conservée doit être affichée sur la fiche (« Kiban · commune de Duguwolowula »).
- Imports et scripts à aligner avant toute écriture, sinon régression au prochain import.
- Plan valable pour l'extraction du {plan['extraitLe'][:10]} ; à régénérer s'il date de plus de 24 h.
"""
open(os.path.join(OUT, "resume.md"), "w").write(md)
print(len(md))

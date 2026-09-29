#!/usr/bin/env python3
"""Écrit ../resume-region.md à partir de plan-villes-region.json et stats-region.json (hors ligne)."""
import json, os, random, collections as C

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
plan = json.load(open(os.path.join(OUT, "plan-villes-region.json")))
st = json.load(open(os.path.join(OUT, "stats-region.json")))
F = plan["fiches"]
L = []
w = L.append

w("# Villes des établissements du Mali — règle « chef-lieu de région » (plan, rien d'appliqué)\n")
w(f"Décision du propriétaire du 2026-09-29 (remplace « ville = commune »). Extraction `{plan['extraitLe']}` (SELECT seul, "
  "fiches `paysCode='ML' AND valide=1`), résolution des communes reprise de `plan-villes.json` "
  "(même extraction, < 24 h : pas de réextraction). Fichiers : `plan-villes-region.json`, `stats-region.json`, "
  "outil `outils/plan-villes-region.py`.\n")
w("## 1. Règle\n")
w("- `ville` = chef-lieu de la région **OCHA admin1 (COD-AB)** de la commune ; District → « Bamako ».")
w("- `villeNormalisee` = `normaliserEducation(ville)` (recalculée par le script d'application).")
w("- Détails : `commune` (nom officiel COD-AB, « Commune I…VI » pour le District), `communeCode` (P-code COD-AB ou code provisoire `ML23:…`), `cercle`, `region`.")
w("- `localite` = ancienne `ville` si elle diffère de la nouvelle ville et de la commune (et n'est pas « Commune V », « District de Bamako »…), sinon localité MEN 2013.")
w("- Application : confiance HAUTE et MOYENNE ; BASSE inchangées (aucune colonne écrite).\n")
w("## 2. Table région → chef-lieu\n")
w("| P-code | Région | Chef-lieu (= ville) | Fiches (après) |\n|---|---|---|---|")
rep = st["repartitionApres"]
for r in plan["regionsChefsLieux"]:
    w(f"| {r['regionPcode'] or '—'} | {r['region']} | {r['chefLieu']} | {rep.get(r['chefLieu'], 0)} |")
w("\nTaoudénit n'existe pas dans COD-AB (ses cercles restent dans Tombouctou) : **0 fiche** ; entrée gardée pour de futurs imports.\n")
w("**Régions créées en 2023** (Nioro, Kita, Dioïla, Nara, Bougouni, Koutiala, San, Douentza, Bandiagara) : aucune source ne les "
  "utilise comme région (MEN 2013, MEN 2023 et OSM/HDX sont en admin1 OCHA). Les fiches restent donc dans leur région OCHA "
  "d'origine. À titre indicatif, fiches appliquées situées dans le **cercle éponyme** (borne basse : les nouvelles régions "
  "englobent d'autres cercles) :\n")
for k, v in st["fichesDansCerclesEponymesNouvellesRegions2023"].items():
    w(f"- {k} : {v}")
w("\n## 3. Chiffres\n")
w("| | Avant | Après (HAUTE+MOYENNE appliquées) | Si tout appliqué |\n|---|---|---|---|")
w(f"| `ville` distinctes (brut) | {st['villesDistinctesAvant']} | {st['libellesApres']} | 10 |")
w(f"| `villeNormalisee` distinctes | {st['villeNormaliseeDistinctesAvant']} | {st['villeNormaliseeDistinctesApres']} (10 chefs-lieux + {st['villeNormaliseeDistinctesApresHorsChefsLieux(BASSE)']} valeurs des fiches BASSE) | {st['villeNormaliseeDistinctesSiToutApplique']} |")
w(f"\n- Fiches : {st['fiches']} ; appliquées {st['appliquees']} (HAUTE {st['confiance']['HAUTE']}, MOYENNE {st['confiance']['MOYENNE']}) ; BASSE inchangées {st['nonAppliquees']}.")
w(f"- `ville` modifiée : **{st['villeChange']}** fiches ; ville identique mais détails écrits : {st['villeInchangeeMaisDetailsEcrits']}.")
w(f"- Avec `commune` : {st['avecCommune']} ; avec `localite` : {st['localite']}.")
w(f"- Fiches avec formations dont la ville change : {st['fichesAvecFormationQuiChangent']}.")
w(f"- Attendu ≈ 11 : on obtient **10** chefs-lieux (pas de Taoudéni). Les {st['villeNormaliseeDistinctesApresHorsChefsLieux(BASSE)']} autres valeurs viennent des 193 BASSE laissées telles quelles. "
  f"Parmi elles, **{st['basseAvecRegionUnique']}** ont toutes leurs communes candidates dans la même région : le chef-lieu est certain "
  f"(champ `chefLieuSiRegionUnique`) ; les appliquer en « ville seule » ramènerait à {st['villeNormaliseeDistinctesSiBasseRegionUniqueAppliquee']} valeurs. Non fait (règle : BASSE inchangées) — décision à prendre.\n")
w("### Répartition après application\n")
w("| Ville | Fiches |\n|---|---|")
for k, v in rep.items():
    w(f"| {k} | {v} |")
w("\n## 4. Exemples\n")
w("| # | Établissement | Ville actuelle | Ville proposée | Localité · Commune · Cercle · Région | Confiance |\n|---|---|---|---|---|---|")
random.seed(29)
app = [l for l in F if l["appliquer"]]
ex = []
for ville in rep:
    cand = [l for l in app if l["villeProposee"] == ville and l["change"]]
    ex += random.sample(cand, min(2, len(cand)))
ex += random.sample([l for l in app if l["confiance"] == "MOYENNE"], 3)
ex += random.sample([l for l in app if l["villeProposee"] == "Bamako" and l["localite"]], 2)
for i, l in enumerate(ex, 1):
    det = " · ".join(x or "—" for x in (l["localite"], l["commune"], l["cercle"], l["region"]))
    w(f"| {i} | {l['nom']} | {l['villeActuelle']} | **{l['villeProposee']}** | {det} | {l['confiance']} ({l['statut']}) |")
w("\n## 5. Cas BASSE (193, inchangés)\n")
basse = [l for l in F if not l["appliquer"]]
w("Par statut : " + ", ".join(f"{k} {v}" for k, v in C.Counter(l["statut"] for l in basse).most_common()) + ".\n")
w(f"- {st['basseAvecRegionUnique']} fiches : région certaine, commune incertaine (conflit entre communes d'une même région).")
w("- Fiches sans région certaine (conflit entre régions, kNN faible, non résolues) :\n")
w("| Établissement | Ville actuelle | Statut | Candidats |\n|---|---|---|---|")
for l in basse:
    if l.get("chefLieuSiRegionUnique"):
        continue
    cand = ", ".join(l.get("conflit", {}).keys()) or ", ".join(e.get("communeBrute") or "" for e in l["preuve"]) or "—"
    w(f"| {l['nom']} (`{l['id']}`) | {l['villeActuelle']} | {l['statut']} | {cand} |")
w("\n## 6. Application\n")
w("```\n# simulation (défaut), depuis backend/ sur le serveur, après la migration 20260929120000_etablissement_localisation\n"
  "npx tsx src/scripts/appliquer-plan-villes.ts --plan <chemin>/plan-villes-region.json --journal simulation-villes.json\n"
  "# puis, après accord explicite et sauvegarde : --apply\n```\n")
w("Le script refuse un plan de plus de 36 h (extraction du 2026-09-29T00:44Z → à réextraire après le 2026-09-30T12:44Z), "
  "ignore les fiches dont `ville`/`villeNormalisee`/`valide` ont changé depuis l'extraction et journalise chaque lot de 200.")
open(os.path.join(OUT, "resume-region.md"), "w").write("\n".join(L) + "\n")
print("ok", len(L))

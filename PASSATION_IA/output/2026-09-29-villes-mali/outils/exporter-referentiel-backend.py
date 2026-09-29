#!/usr/bin/env python3
"""Exporte le référentiel des communes (COD-AB OCHA + 22 MEN 2023 à vérifier) vers
backend/src/education/data/communes-mali.json, versionné et utilisé par les imports."""
import json, os, importlib.util, collections as C
ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(ICI)
spec = importlib.util.spec_from_file_location("pvr", os.path.join(ICI, "plan-villes-region.py"))
# Réutilise region_de / libelle_cercle sans relancer le plan : on exécute le module (écrit aussi le plan, idempotent).
pvr = importlib.util.module_from_spec(spec); spec.loader.exec_module(pvr)
ref = json.load(open(os.path.join(OUT, "referentiel-communes.json")))
communes = []
for c in ref["communes"]:
    reg = pvr.region_de(c["region"], c["pcode"])
    variantes = sorted({v for v in c["variantes"]} | {c["nom"]}, key=str.lower)
    communes.append({
        "code": c["pcode"], "nom": c["nom"], "cercle": pvr.libelle_cercle(c["cercle"]), "cercleCode": c["cerclePcode"],
        "region": reg[1], "regionCode": reg[0],
        "aVerifier": c["origine"].startswith("MEN 2023 seul"),
        "variantes": [v for v in variantes if v != c["nom"]],
    })
racine = os.path.abspath(os.path.join(OUT, "..", "..", ".."))
cible = os.path.join(racine, "backend", "src", "education", "data", "communes-mali.json")
entete = {
    "source": "COD-AB OCHA (admin3 via HOT/HDX OSM) + 22 communes présentes seulement dans le registre MEN 2023 (aVerifier)",
    "genereLe": ref["genereLe"],
    "regions": [{"code": p, "nom": n, "chefLieu": cl} for p, n, cl in pvr.REGIONS],
}
# Une commune par ligne : diff lisible.
texte = json.dumps(entete, ensure_ascii=False, indent=1)[:-2] + ',\n "communes": [\n' + ",\n".join(
    "  " + json.dumps(c, ensure_ascii=False) for c in communes) + "\n ]\n}\n"
json.loads(texte)
open(cible, "w").write(texte)
print(cible, len(communes), os.path.getsize(cible))

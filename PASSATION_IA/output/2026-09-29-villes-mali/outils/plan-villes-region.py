#!/usr/bin/env python3
"""Plan « villes Mali », règle du 2026-09-29 (décision du propriétaire) — HORS LIGNE.

ville = CHEF-LIEU DE LA RÉGION (découpage OCHA admin1 / COD-AB du référentiel) de la
commune de l'établissement. Détails conservés : commune (nom officiel), communeCode
(P-code), cercle, region, localite (ancienne valeur quand elle diffère de la ville et
de la commune).

Entrées (déjà produites, SELECT seulement) : ../extract-villes.json, ../plan-villes.json
(résolution de la commune par fiche, confiance), ../referentiel-communes.json.
Sorties : ../plan-villes-region.json, ../stats-region.json, ../resume-region.md.
Aucune écriture en base.
"""
import json, re, unicodedata, os, collections as C

ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(ICI)
extract = json.load(open(os.path.join(OUT, "extract-villes.json")))
ancien = json.load(open(os.path.join(OUT, "plan-villes.json")))
ref = json.load(open(os.path.join(OUT, "referentiel-communes.json")))
assert ancien["extraitLe"] == extract["extraitLe"], "plan-villes.json et extract-villes.json de dates différentes"


def sans_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")


def normaliser(s):
    """Réplique de normaliserEducation (catalog-service.ts)."""
    return re.sub(r"[\W_]+", " ", sans_accents(s).lower()).strip()


def casse_soignee(s):
    if not s or s != s.upper():
        return s
    petits = {"de", "du", "des", "la", "le", "les", "d", "et"}
    mots = re.split(r"(\s+|-|')", s.lower())
    return "".join(m if (i and m in petits) else m[:1].upper() + m[1:] for i, m in enumerate(mots))


# ------------------------------------------------------------------ Régions -> chef-lieu
# Découpage du référentiel = COD-AB OCHA admin1 (10 unités : 8 régions historiques,
# Ménaka ML10, District de Bamako ML09). Taoudénit n'existe pas dans ce découpage
# (ses cercles restent dans Tombouctou) ; ajoutée pour les futurs imports.
REGIONS = [
    # pcode, libellé région, chef-lieu (= ville)
    ("ML01", "Kayes", "Kayes"),
    ("ML02", "Koulikoro", "Koulikoro"),
    ("ML03", "Sikasso", "Sikasso"),
    ("ML04", "Ségou", "Ségou"),
    ("ML05", "Mopti", "Mopti"),
    ("ML06", "Tombouctou", "Tombouctou"),
    ("ML07", "Gao", "Gao"),
    ("ML08", "Kidal", "Kidal"),
    ("ML09", "Bamako", "Bamako"),
    ("ML10", "Ménaka", "Ménaka"),
    (None, "Taoudénit", "Taoudéni"),
]
PAR_NOM = {normaliser(n): (p, n, cl) for p, n, cl in REGIONS}
PAR_NOM.update({"district de bamako": PAR_NOM["bamako"], "menaka": PAR_NOM["menaka"],
                "taoudeni": PAR_NOM["taoudenit"], "timbuktu": PAR_NOM["tombouctou"]})
PAR_PCODE = {p: (p, n, cl) for p, n, cl in REGIONS if p}
# Régions créées en 2023 (loi de 2023) : non reprises par COD-AB. Rattachées à leur
# région OCHA d'origine (celle du cercle éponyme dans le référentiel).
NOUVELLES_2023 = {"nioro": "Kayes", "kita": "Kayes", "dioila": "Koulikoro", "nara": "Koulikoro",
                  "bougouni": "Sikasso", "koutiala": "Sikasso", "san": "Ségou",
                  "douentza": "Mopti", "bandiagara": "Mopti"}


def region_de(nom_region, pcode_commune):
    r = PAR_NOM.get(normaliser(nom_region or ""))
    if r:
        return r
    if normaliser(nom_region or "") in NOUVELLES_2023:
        return PAR_NOM[normaliser(NOUVELLES_2023[normaliser(nom_region)])]
    if pcode_commune and pcode_commune[:4] in PAR_PCODE:
        return PAR_PCODE[pcode_commune[:4]]
    return None


communes = {c["pcode"]: c for c in ref["communes"]}

# Libellé soigné du cercle : variante accentuée / non capitale la plus fréquente.
cercles = C.defaultdict(C.Counter)
for c in ref["communes"]:
    cercles[normaliser(c["cercle"])][c["cercle"]] += max(c["fichesProposees"], 1)


def libelle_cercle(cercle):
    if not cercle:
        return None
    var = cercles.get(normaliser(cercle)) or C.Counter({cercle: 1})
    meilleur = sorted(var.items(), key=lambda x: (x[0] == x[0].upper(), x[0] == sans_accents(x[0]), -x[1]))[0][0]
    return casse_soignee(meilleur)


# Localité MEN 2013 par fiche (village), en secours de l'ancienne ville
loc2013 = C.defaultdict(list)
for s in extract["src"]:
    if s["code"] == "unicef-men-mali-schools-2013" and s.get("localite"):
        loc2013[s["id"]].append(s["localite"])

BAMAKO_ETIQ = re.compile(r"^(?:district(?: de)? )?bamako$|^commune (?:i{1,3}|iv|vi?|[1-6])(?: .*)?$")

plan, regions_sans_table = [], C.Counter()
for l in ancien["fiches"]:
    appliquer = l["confiance"] in ("HAUTE", "MOYENNE")
    p = l.get("communePcode")
    c = communes.get(p) if p else None
    ancienne = l["villeActuelle"]
    if c:
        reg = region_de(c["region"], p)
        if not reg:
            regions_sans_table[c["region"]] += 1
        commune, cercle = c["nom"], libelle_cercle(c["cercle"])
    elif l["statut"] == "ville_bamako_sans_commune":
        reg, commune, cercle = PAR_PCODE["ML09"], None, "Bamako"
    else:
        reg, commune, cercle = None, None, None
    if reg:
        ville, region, region_pcode = reg[2], reg[1], reg[0]
    else:
        ville, region, region_pcode = ancienne, None, None
        appliquer = False
    na = normaliser(ancienne)
    colle = lambda x: normaliser(x).replace(" ", "")  # « Tinessako » = « Tin Essako »
    exclus = {colle(ville), colle(commune or "")}
    localite = None
    if ancienne and colle(ancienne) not in exclus and not BAMAKO_ETIQ.match(na):
        localite = casse_soignee(ancienne.strip())
    if not localite:
        for lb in loc2013.get(l["id"], []):
            if colle(lb) not in exclus and not BAMAKO_ETIQ.match(normaliser(lb)):
                localite = casse_soignee(lb.strip())
                break
    ligne = {
        "id": l["id"], "nom": l["nom"], "type": l["type"],
        "villeActuelle": ancienne, "villeNormaliseeActuelle": l["villeNormaliseeActuelle"], "valideActuel": True,
        "villeProposee": ville, "villeNormaliseeProposee": normaliser(ville),
        "localite": localite, "commune": commune, "communeCode": p if c else None,
        "cercle": cercle, "region": region, "regionPcode": region_pcode,
        "confiance": l["confiance"], "statut": l["statut"], "appliquer": appliquer,
        "change": appliquer and (ancienne != ville or l["villeNormaliseeActuelle"] != normaliser(ville)),
        "preuve": l.get("preuve", []),
    }
    if not appliquer:
        # Revue BASSE : si toutes les communes candidates sont dans la même région,
        # le chef-lieu est certain même si la commune ne l'est pas (non appliqué).
        pcs = {re.search(r"\(([^)]+)\)$", k).group(1) for k in (l.get("conflit") or {})}
        pcs |= {e["pcode"] for e in l.get("preuve", []) if e.get("pcode")}
        regs = {region_de(communes[x]["region"], x) for x in pcs if x in communes}
        if len(regs) == 1:
            ligne["chefLieuSiRegionUnique"] = next(iter(regs))[2]
        ligne["regionsCandidates"] = sorted(r[1] for r in regs)
    for k in ("conflit", "knn", "formations"):
        if l.get(k):
            ligne[k] = l[k]
    plan.append(ligne)

assert not regions_sans_table, regions_sans_table

json.dump({
    "extraitLe": extract["extraitLe"], "perimetre": "Etablissement paysCode=ML valide=1",
    "regle": "ville = chef-lieu de la région OCHA admin1 (COD-AB) de la commune ; Bamako pour le district ; "
             "villeNormalisee = normaliserEducation(ville) ; commune/communeCode/cercle/region détaillés ; "
             "localite = ancienne ville si différente de la ville et de la commune (sinon localité MEN 2013) ; "
             "appliquer = confiance HAUTE ou MOYENNE (BASSE inchangées)",
    "regionsChefsLieux": [{"regionPcode": p, "region": n, "chefLieu": cl} for p, n, cl in REGIONS],
    "fiches": plan,
}, open(os.path.join(OUT, "plan-villes-region.json"), "w"), ensure_ascii=False, indent=0)

# ------------------------------------------------------------------ Statistiques
fiches = extract["fiches"]
avant_brut = {f["ville"] for f in fiches}
avant = C.Counter(f["villeNormalisee"] for f in fiches)
apres = C.Counter(l["villeNormaliseeProposee"] if l["appliquer"] else l["villeNormaliseeActuelle"] for l in plan)
apres_libelle = C.Counter(l["villeProposee"] if l["appliquer"] else l["villeActuelle"] for l in plan)
apres_tout = C.Counter(l["villeNormaliseeProposee"] for l in plan if l["region"])
chefs = {normaliser(cl) for _, _, cl in REGIONS}
nouvelles = C.Counter()
for l in plan:
    if l["appliquer"] and l["cercle"] and normaliser(l["cercle"]) in NOUVELLES_2023:
        nouvelles[(l["cercle"], l["region"])] += 1
stats = {
    "fiches": len(plan),
    "villesDistinctesAvant": len(avant_brut),
    "villeNormaliseeDistinctesAvant": len(avant),
    "villeNormaliseeDistinctesApres": len(apres),
    "villeNormaliseeDistinctesApresChefsLieux": len([v for v in apres if v in chefs]),
    "villeNormaliseeDistinctesApresHorsChefsLieux(BASSE)": len([v for v in apres if v not in chefs]),
    "villeNormaliseeDistinctesSiToutApplique": len(apres_tout),
    "confiance": dict(C.Counter(l["confiance"] for l in plan)),
    "appliquees": sum(1 for l in plan if l["appliquer"]),
    "nonAppliquees": sum(1 for l in plan if not l["appliquer"]),
    "villeChange": sum(1 for l in plan if l["change"]),
    "villeInchangeeMaisDetailsEcrits": sum(1 for l in plan if l["appliquer"] and not l["change"]),
    "localite": sum(1 for l in plan if l["appliquer"] and l["localite"]),
    "avecCommune": sum(1 for l in plan if l["appliquer"] and l["commune"]),
    "repartitionApres": dict(sorted(((k, v) for k, v in C.Counter(l["villeProposee"] for l in plan if l["appliquer"]).items()), key=lambda x: -x[1])),
    "fichesDansCerclesEponymesNouvellesRegions2023": {f"{a} (région OCHA {b})": n for (a, b), n in sorted(nouvelles.items())},
    "basseAvecRegionUnique": sum(1 for l in plan if l.get("chefLieuSiRegionUnique")),
    "villeNormaliseeDistinctesSiBasseRegionUniqueAppliquee": len(C.Counter(
        normaliser(l["chefLieuSiRegionUnique"]) if l.get("chefLieuSiRegionUnique") else (l["villeNormaliseeProposee"] if l["appliquer"] else l["villeNormaliseeActuelle"])
        for l in plan)),
    "fichesTaoudenit": sum(1 for l in plan if l["region"] == "Taoudénit"),
    "fichesAvecFormationQuiChangent": sum(1 for l in plan if l.get("formations") and l["change"]),
    "libellesApres": len(apres_libelle),
}
json.dump(stats, open(os.path.join(OUT, "stats-region.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps(stats, ensure_ascii=False, indent=1))

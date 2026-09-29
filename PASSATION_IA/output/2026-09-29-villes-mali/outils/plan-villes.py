#!/usr/bin/env python3
"""Plan « villes Mali » — HORS LIGNE, à partir de extract-villes.json (SELECT seulement).

Produit :
  ../referentiel-communes.json  (communes : P-code COD-AB, nom officiel, cercle, région, variantes)
  ../plan-villes.json           (par fiche : ville actuelle -> proposée, localité, preuve, confiance)
  ../stats.json                 (chiffres repris dans resume.md)
Aucune écriture en base.
"""
import json, re, unicodedata, math, difflib, collections as C, os

ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(ICI)
d = json.load(open(os.path.join(OUT, "extract-villes.json")))

OSM, M13, M23 = "hotosm-mali-education", "unicef-men-mali-schools-2013", "ocha-men-mali-schools-2023"
COURT = {OSM: "OSM", M13: "MEN2013", M23: "MEN2023"}


def sans_accents(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def normaliser(s):
    """Réplique de `normaliser` (normalisation-localisations.ts) -> villeNormalisee."""
    s = sans_accents(s).lower()
    return re.sub(r"[\W_]+", " ", s).strip()


ROMAIN = {"1": "I", "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI",
          "i": "I", "ii": "II", "iii": "III", "iv": "IV", "v": "V", "vi": "VI"}


def cle_commune(s):
    k = normaliser(s).replace("'", " ")
    k = re.sub(r"^(?:commune|cne|cr|cu)(?:\s+(?:rurale|urbaine))?\s+(?:de|du|d|des)\s+", "", k)
    k = re.sub(r"^(?:commune|cne)\s+(?:rurale|urbaine)\s+", "", k)
    m = re.match(r"^commune\s+(i{1,3}|iv|vi?|[1-6])(?:\s.*)?$", k)
    if m:
        return "commune " + ROMAIN[m.group(1)].lower()
    k = re.sub(r"\s([1-6])$", lambda m: " " + ROMAIN[m.group(1)].lower(), k)
    k = k.replace(" ", "")
    return EQUIVALENCES.get(k, k)


# Équivalences sûres (même commune, graphies trop éloignées pour la règle floue)
EQUIVALENCES = {"aguelhoc": "adjelhoc"}
# Équivalences probables relevées à la main (MEN 2013 -> COD-AB) : confiance MOYENNE, à valider
EQUIV_MANUELLES = {"kolombine": "colimbine", "seremoussaanisamou": "seremoussaanisamodesiekorole",
                   "niorotogoune": "niorotougounerangaba", "djouma": "diouman"}


def squelette(k):
    """Clé phonétique grossière pour les variantes (Diougani/Dioungani, Marico/Mariko…)."""
    if k.startswith("commune "):
        return k
    s = k.replace("dj", "j").replace("ou", "u").replace("c", "k").replace("q", "k").replace("y", "i").replace("h", "")
    s = re.sub(r"n(?=[gk])", "", s)
    s = re.sub(r"(.)\1+", r"\1", s)
    return s


ALIAS_CERCLE = {"baroueli": "baraoueli", "ander": "anderamboukane"}


def cle_cercle(s):
    k = normaliser(s)
    k = re.sub(r"^cercle\s+(?:de|du|d)\s+", "", k)
    return ALIAS_CERCLE.get(k, k)


def distance_m(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371000 * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def casse_soignee(s):
    """Seulement pour les libellés tout en majuscules (registre 2013)."""
    if not s or s != s.upper():
        return s
    mots = re.split(r"(\s+|-|')", s.lower())
    petits = {"de", "du", "des", "la", "le", "les", "d", "et"}
    res = []
    for i, m in enumerate(mots):
        res.append(m if (i and m in petits) else m[:1].upper() + m[1:])
    return "".join(res)


fiches = {f["id"]: f for f in d["fiches"]}
sources = C.defaultdict(list)
for s in d["src"]:
    sources[s["id"]].append(s)
formations = {x["id"]: x["n"] for x in d["form"]}

# ------------------------------------------------------------------ 1. Référentiel
communes = {}  # pcode -> info
cercle_pcode = {}
for s in d["src"]:
    if s["code"] == OSM and s["communePcode"]:
        c = communes.setdefault(s["communePcode"], {
            "pcode": s["communePcode"], "noms": C.Counter(), "cerclePcode": s["cerclePcode"],
            "cercles": C.Counter(), "regionPcode": s["regionPcode"], "regions": C.Counter(),
            "variantes": C.defaultdict(C.Counter), "origine": "COD-AB via OSM (adm3)"})
        c["noms"][s["commune"]] += 1
        c["cercles"][s["cercle"]] += 1
        c["regions"][s["region"]] += 1
        c["variantes"][s["commune"]]["OSM"] += 1
        cercle_pcode[cle_cercle(s["cercle"])] = s["cerclePcode"]

incoherences = []
def finaliser():
  for c in communes.values():
    c["nom"] = c["noms"].most_common(1)[0][0]
    c["cercle"] = sorted(c["cercles"].items(), key=lambda x: (-x[1], x[0] == sans_accents(x[0])))[0][0]
    c["region"] = sorted(c["regions"].items(), key=lambda x: (-x[1], x[0] == sans_accents(x[0])))[0][0]
    c["bamako"] = (c["pcode"] or "").startswith("ML0901")
    c["nom"] = casse_soignee(c["nom"])
  index_exact.clear(); index_sq.clear(); par_cercle.clear(); national.clear()
  for p, c in communes.items():
    kc = cle_cercle(c["cercle"])
    for nom in c["noms"]:
        index_exact[(kc, cle_commune(nom))].add(p)
        index_sq[(kc, squelette(cle_commune(nom)))].add(p)
        national[cle_commune(nom)].add(p)
        national[squelette(cle_commune(nom))].add(p)
    par_cercle[kc].add(p)


index_exact = C.defaultdict(set)
index_sq = C.defaultdict(set)
par_cercle = C.defaultdict(set)
national = C.defaultdict(set)
finaliser()


def resoudre(cercle, commune, pcode_brut=None):
    """Retourne (pcode, methode) ou (None, raison)."""
    kc = cle_cercle(cercle or "")
    k = cle_commune(commune or "")
    if not k:
        return None, "commune vide"
    if k.startswith("commune ") and kc == "bamako":
        for p, c in communes.items():
            if c["bamako"] and cle_commune(c["nom"]) == k:
                return p, "exact"
    cand = index_exact.get((kc, k))
    if cand and len(cand) == 1:
        p = next(iter(cand))
        return p, "exact" if (not pcode_brut or pcode_brut == p) else "exact(nom) ; pcode source " + pcode_brut + " ignoré"
    cand = index_sq.get((kc, squelette(k)))
    if cand and len(cand) == 1:
        p = next(iter(cand))
        return p, "variante"
    if k in EQUIV_MANUELLES:
        cand = index_exact.get((kc, EQUIV_MANUELLES[k]))
        if cand and len(cand) == 1:
            return next(iter(cand)), "equivalence manuelle"
    # abréviation (« Finkolo G » -> « Finkolo Ganadougou ») puis nom tronqué (« Kiffosso » -> « Kiffosso I »)
    if len(k) >= 5:
        abr = {p for p in par_cercle.get(kc, ()) for n in communes[p]["noms"] if cle_commune(n).startswith(k) and cle_commune(n) != k}
        if len(abr) == 1:
            return next(iter(abr)), "prefixe (abréviation)"
        tr = {p for p in par_cercle.get(kc, ()) for n in communes[p]["noms"] if k.startswith(cle_commune(n)) and len(cle_commune(n)) >= 5 and len(k) - len(cle_commune(n)) <= 3}
        if len(tr) == 1 and not abr:
            return next(iter(tr)), "prefixe (nom plus long)"
        if abr or tr:
            return None, "prefixe ambigu dans le cercle %s" % (cercle or "?")
    # flou dans le cercle
    scores = []
    for p in par_cercle.get(kc, ()):
        best = max(difflib.SequenceMatcher(None, k, cle_commune(n)).ratio() for n in communes[p]["noms"])
        scores.append((best, p))
    scores.sort(reverse=True)
    if scores and scores[0][0] >= 0.8 and (len(scores) == 1 or scores[0][0] - scores[1][0] >= 0.1):
        return scores[0][1], "flou %.2f" % scores[0][0]
    nat = national.get(k) or national.get(squelette(k))
    if nat and len(nat) == 1:
        return next(iter(nat)), "hors cercle (nom unique au Mali)"
    return None, "non reconnue dans le cercle %s" % (cercle or "?")


# Communes absentes d'OSM : créées depuis MEN 2023 seulement si le nom n'est pas reconnu
pcodes_osm = set(communes)
nouvelles = C.defaultdict(list)
for s in d["src"]:
    if s["code"] == M23:
        p, _ = resoudre(s["cercle"], s["commune"], s["communePcode"])
        if not p:
            nouvelles[(cle_cercle(s["cercle"]), squelette(cle_commune(s["commune"])))].append(s)
for (kc, k), lignes in nouvelles.items():
    pb = C.Counter(x["communePcode"] for x in lignes).most_common(1)[0][0]
    cle = pb if pb and pb not in communes else "ML23:" + kc + ":" + k
    c = communes.setdefault(cle, {"pcode": cle, "noms": C.Counter(), "cerclePcode": None, "cercles": C.Counter(),
                                  "regionPcode": None, "regions": C.Counter(), "variantes": C.defaultdict(C.Counter),
                                  "origine": "MEN 2023 seul (absente d'OSM/COD-AB, à vérifier)"})
    for x in lignes:
        c["noms"][x["commune"]] += 1
        c["cercles"][x["cercle"]] += 1
        c["regions"][x["region"]] += 1
        c["cerclePcode"] = c["cerclePcode"] or x["cerclePcode"]
        c["regionPcode"] = c["regionPcode"] or x["regionPcode"]
finaliser()

resolutions = C.Counter()
non_resolues = C.Counter()
pcode23_faux = C.Counter()
for s in d["src"]:
    if s["code"] in (M13, M23):
        p, meth = resoudre(s["cercle"], s["commune"], s["communePcode"] if s["code"] == M23 else None)
        s["_p"], s["_m"] = p, meth
        resolutions[(COURT[s["code"]], meth.split(" ")[0] if p else "NON")] += 1
        if p:
            communes[p]["variantes"][s["commune"]][COURT[s["code"]]] += 1
            if s["code"] == M23 and s["communePcode"] and s["communePcode"] != p:
                pcode23_faux[(s["communePcode"], s["commune"], p, communes[p]["nom"])] += 1
        else:
            non_resolues[(COURT[s["code"]], s["region"], s["cercle"], s["commune"])] += 1
    elif s["code"] == OSM:
        s["_p"], s["_m"] = (s["communePcode"], "pcode adm3") if s["communePcode"] in communes else (None, "pas de pcode")

for (pb, nb, p, n), k in pcode23_faux.most_common():
    incoherences.append({"type": "pcode_men2023_contredit_par_nom", "pcodeSource": pb, "communeSource": nb,
                         "pcodeRetenu": p, "communeRetenue": n, "lignes": k})
for (src, r, ce, co), k in non_resolues.most_common():
    incoherences.append({"type": "commune_registre_non_reconnue", "source": src, "region": r, "cercle": ce,
                         "commune": co, "lignes": k})

# homonymes (même nom dans plusieurs cercles)
par_nom = C.defaultdict(list)
for p, c in communes.items():
    if not c["bamako"]:
        par_nom[normaliser(c["nom"])].append(p)
homonymes = {k: v for k, v in par_nom.items() if len(v) > 1}
for k, v in homonymes.items():
    incoherences.append({"type": "homonymes", "nom": communes[v[0]]["nom"],
                         "communes": [{"pcode": p, "cercle": communes[p]["cercle"]} for p in v]})

# ------------------------------------------------------------------ 2. Commune par fiche
PRIO = {"MEN2023": 3, "MEN2013": 2, "OSM": 1}


def coords(f):
    try:
        la, lo = float(f["lat"]), float(f["lng"])
        return (la, lo) if la and lo else None
    except (TypeError, ValueError):
        return None


decisions = {}
for fid, f in fiches.items():
    ev = []
    for s in sources[fid]:
        if s["code"] in COURT:
            ev.append({"source": COURT[s["code"]], "communeBrute": s["commune"], "cercleBrut": s["cercle"],
                       "pcodeBrut": s["communePcode"], "localiteBrute": s["localite"] or s.get("villeSource"),
                       "pcode": s["_p"], "methode": s["_m"]})
    res = [e for e in ev if e["pcode"]]
    ps = C.Counter(e["pcode"] for e in res)
    dec = {"evidences": ev}
    if not ps:
        dec["statut"] = "sans_commune"
    elif len(ps) == 1:
        p = next(iter(ps))
        dec.update(statut="unanime", pcode=p)
        fiable = [e for e in res if e["methode"].startswith(("exact", "pcode adm3", "variante"))
                  and not communes[e["pcode"]]["origine"].startswith("MEN 2023 seul")]
        dec["confiance"] = "HAUTE" if fiable else "MOYENNE"
    else:
        tous_bko = all(communes[p]["bamako"] for p in ps)
        # vote : nombre de sources, puis priorité déclarative (MEN2023 > MEN2013 > OSM)
        score = C.Counter()
        for e in res:
            score[e["pcode"]] += 10 + PRIO[e["source"]]
        p = score.most_common(1)[0][0]
        dec.update(statut="conflit_bamako" if tous_bko else "conflit", pcode=p)
        majorite = ps[p] > len(res) / 2
        dec["confiance"] = "HAUTE" if tous_bko else ("MOYENNE" if majorite else "BASSE")
        dec["conflit"] = {communes[q]["nom"] + " (" + q + ")": n for q, n in ps.items()}
    decisions[fid] = dec

# kNN sur les fiches résolues (pas de géocodage externe)
refs = [(coords(fiches[i]), decisions[i]["pcode"]) for i in fiches
        if decisions[i].get("pcode") and decisions[i].get("confiance") == "HAUTE" and coords(fiches[i])]
grille = C.defaultdict(list)
CELL = 0.05  # ~5,5 km
for (la, lo), p in refs:
    grille[(int(la / CELL), int(lo / CELL))].append((la, lo, p))


def voisins(pt, k=5, rayon=3000):
    ci, cj = int(pt[0] / CELL), int(pt[1] / CELL)
    cand = []
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for la, lo, p in grille.get((ci + di, cj + dj), ()):
                dist = distance_m(pt, (la, lo))
                if dist <= rayon:
                    cand.append((dist, p))
    cand.sort()
    return cand[:k]


KNN_K, KNN_RAYON, KNN_MIN = 5, 3000, 3
nom_unique = {}
for p, c in communes.items():
    for nom in c["noms"]:
        nom_unique.setdefault(normaliser(nom), set()).add(p)

BAMAKO_VILLE = re.compile(r"^(?:bamako|district de bamako|commune (?:i{1,3}|iv|vi?|[1-6]))\b")
# Références « registre » : communes HAUTE portées par au moins un registre MEN (pas seulement le polygone OSM)
refs_registre = C.defaultdict(list)
for i in fiches:
    dd = decisions[i]
    if dd.get("confiance") == "HAUTE" and coords(fiches[i]) and any(e["source"] != "OSM" and e["pcode"] == dd["pcode"] for e in dd["evidences"]):
        la, lo = coords(fiches[i])
        refs_registre[(int(la / CELL), int(lo / CELL))].append((la, lo, dd["pcode"]))


def voisins_registre(pt, k=5, rayon=3000):
    ci, cj = int(pt[0] / CELL), int(pt[1] / CELL)
    cand = [(distance_m(pt, (la, lo)), p) for di in (-1, 0, 1) for dj in (-1, 0, 1)
            for la, lo, p in refs_registre.get((ci + di, cj + dj), ())]
    return sorted(x for x in cand if x[0] <= rayon)[:k]


for fid, dec in decisions.items():
    f = fiches[fid]
    pt = coords(f)
    vn = normaliser(f["ville"])
    if dec["statut"] == "sans_commune":
        if pt:
            v = voisins(pt, KNN_K, KNN_RAYON)
            dec["knn"] = [{"distanceM": round(x), "pcode": p} for x, p in v]
            ps = {p for _, p in v}
            if v and all(communes[p]["bamako"] for p in ps):
                dec.update(statut="knn_bamako", pcode=C.Counter(p for _, p in v).most_common(1)[0][0],
                           confiance="HAUTE" if len(v) >= KNN_MIN else "MOYENNE")
                continue
            if len(v) >= KNN_MIN and len(ps) == 1:
                dec.update(statut="knn_unanime", pcode=v[0][1], confiance="MOYENNE")
                continue
            if v and len(ps) == 1 and not BAMAKO_VILLE.match(vn):
                dec.update(statut="knn_faible", pcode=v[0][1], confiance="BASSE")
                continue
        if BAMAKO_VILLE.match(vn):
            dec.update(statut="ville_bamako_sans_commune", pcode=None, confiance="MOYENNE", villeSeule="Bamako")
        elif vn in nom_unique and len(nom_unique[vn]) == 1:
            dec.update(statut="ville_egale_commune", pcode=next(iter(nom_unique[vn])), confiance="MOYENNE")
        else:
            dec.update(statut="non_resolu", confiance="BASSE")
    elif pt and dec["statut"] == "conflit" and dec["confiance"] != "HAUTE":
        # départage par les plus proches fiches REGISTRE (k=5, 3 km, unanimité, >=3 voisins)
        cands = {q for q in C.Counter(e["pcode"] for e in dec["evidences"] if e["pcode"])}
        v = voisins_registre(pt, KNN_K, KNN_RAYON)
        dec["knn"] = [{"distanceM": round(x), "pcode": p} for x, p in v]
        ps = {p for _, p in v}
        if len(v) >= KNN_MIN and len(ps) == 1 and next(iter(ps)) in cands:
            dec["pcode"] = next(iter(ps))
            dec["confiance"] = "MOYENNE"
            dec["statut"] = "conflit_departage_knn"
    elif pt and dec.get("confiance") == "MOYENNE":
        v = voisins(pt, KNN_K, KNN_RAYON)
        dec["knn"] = [{"distanceM": round(x), "pcode": p} for x, p in v]
        if len(v) >= KNN_MIN and {p for _, p in v} == {dec["pcode"]}:
            dec["confiance"] = "HAUTE"
            dec["knnConfirme"] = True

# ------------------------------------------------------------------ 3. Ville cible + localité
BAMAKO_ETIQ = re.compile(r"^(?:district(?: de)? )?bamako$|^commune (?:i{1,3}|iv|vi?|[1-6])(?: .*)?$")
plan = []
for fid, f in fiches.items():
    dec = decisions[fid]
    p = dec.get("pcode")
    c = communes.get(p) if p else None
    if c:
        ville = "Bamako" if c["bamako"] else c["nom"]
        commune = c["nom"]
        cercle, region = c["cercle"], c["region"]
    elif dec.get("villeSeule"):
        ville, commune, cercle, region = dec["villeSeule"], None, "Bamako", "Bamako"
    else:
        ville, commune, cercle, region = f["ville"], None, None, None
    ancienne = f["ville"]
    na = normaliser(ancienne)
    localite = None
    if ancienne and na != normaliser(ville) and not BAMAKO_ETIQ.match(na) and na != normaliser(commune or ""):
        localite = casse_soignee(ancienne.strip())
    if not localite:
        for e in dec["evidences"]:
            lb = e.get("localiteBrute")
            if lb and e["source"] == "MEN2013" and normaliser(lb) not in (normaliser(ville), normaliser(commune or "")) \
                    and not BAMAKO_ETIQ.match(normaliser(lb)):
                localite = casse_soignee(lb.strip())
                break
    preuve = [{k: e[k] for k in ("source", "communeBrute", "cercleBrut", "pcodeBrut", "pcode", "methode") if e.get(k)}
              for e in dec["evidences"]]
    ligne = {
        "id": fid, "nom": f["nom"], "type": f["type"],
        "villeActuelle": ancienne, "villeNormaliseeActuelle": f["villeNormalisee"],
        "villeProposee": ville, "villeNormaliseeProposee": normaliser(ville),
        "commune": commune, "communePcode": p if c else None, "cercle": cercle, "region": region,
        "localiteConservee": localite,
        "change": (ancienne != ville) or (f["villeNormalisee"] != normaliser(ville)),
        "confiance": dec.get("confiance", "BASSE"), "statut": dec["statut"], "preuve": preuve,
    }
    if dec.get("conflit"):
        ligne["conflit"] = dec["conflit"]
    if dec.get("knn"):
        ligne["knn"] = [{"distanceM": x["distanceM"], "commune": communes[x["pcode"]]["nom"]} for x in dec["knn"]]
    if formations.get(fid):
        ligne["formations"] = formations[fid]
    plan.append(ligne)

# ------------------------------------------------------------------ 4. Sorties
ref_sortie = []
for p, c in sorted(communes.items()):
    ref_sortie.append({
        "pcode": p, "nom": c["nom"], "villeAffichee": "Bamako" if c["bamako"] else c["nom"],
        "villeNormalisee": normaliser("Bamako" if c["bamako"] else c["nom"]),
        "cercle": c["cercle"], "cerclePcode": c["cerclePcode"], "region": c["region"], "regionPcode": c["regionPcode"],
        "origine": c["origine"],
        "variantes": {k: dict(v) for k, v in sorted(c["variantes"].items())},
        "fichesProposees": sum(1 for l in plan if l["communePcode"] == p),
    })
json.dump({"genereLe": d["extraitLe"], "source": "extract-villes.json (SELECT seul)", "communes": ref_sortie,
           "incoherences": incoherences}, open(os.path.join(OUT, "referentiel-communes.json"), "w"),
          ensure_ascii=False, indent=1)
json.dump({"extraitLe": d["extraitLe"], "perimetre": "Etablissement paysCode=ML valide=1",
           "regle": "ville = nom officiel de la commune (COD-AB/OCHA via OSM adm3), Bamako pour les communes I à VI ; "
                    "villeNormalisee = normaliser(ville) ; ancienne ville -> localiteConservee",
           "parametresKnn": {"k": KNN_K, "rayonM": KNN_RAYON, "minVoisins": KNN_MIN, "unanimite": True},
           "fiches": plan}, open(os.path.join(OUT, "plan-villes.json"), "w"), ensure_ascii=False, indent=0)

# stats
avant = C.Counter(f["villeNormalisee"] for f in fiches.values())
apres = C.Counter(l["villeNormaliseeProposee"] for l in plan)
apres_haute = C.Counter(l["villeNormaliseeProposee"] if l["confiance"] != "BASSE" else l["villeNormaliseeActuelle"] for l in plan)
stats = {
    "fiches": len(plan),
    "villesDistinctesAvant": len({f["ville"] for f in fiches.values()}),
    "villeNormaliseeDistinctesAvant": len(avant), "singletonsAvant": sum(1 for v in avant.values() if v == 1),
    "villeNormaliseeDistinctesApres": len(apres), "singletonsApres": sum(1 for v in apres.values() if v == 1),
    "villeNormaliseeDistinctesApresSiBasseNonAppliquee": len(apres_haute),
    "confiance": dict(C.Counter(l["confiance"] for l in plan)),
    "statut": dict(C.Counter(l["statut"] for l in plan)),
    "changements": sum(1 for l in plan if l["change"]),
    "changementsParConfiance": dict(C.Counter(l["confiance"] for l in plan if l["change"])),
    "localiteConservee": sum(1 for l in plan if l["localiteConservee"]),
    "fichesAvecCommune": sum(1 for l in plan if l["communePcode"]),
    "fichesBamako": sum(1 for l in plan if l["villeProposee"] == "Bamako"),
    "bamakoParCommune": dict(C.Counter(l["commune"] for l in plan if l["villeProposee"] == "Bamako")),
    "fichesAvecFormationQuiChangent": sum(1 for l in plan if l.get("formations") and l["change"]),
    "communesReferentiel": len(communes),
    "communesReferentielParOrigine": dict(C.Counter(c["origine"] for c in communes.values())),
    "communesUtilisees": len({l["communePcode"] for l in plan if l["communePcode"]}),
    "homonymes": len(homonymes),
    "fichesSurCommunesHomonymes": sum(1 for l in plan if l["communePcode"] and normaliser(communes[l["communePcode"]]["nom"]) in homonymes),
    "resolutionRegistres": {f"{a}:{b}": n for (a, b), n in sorted(resolutions.items())},
    "lignesRegistreNonResolues": sum(non_resolues.values()),
    "lignesMen2023PcodeContredit": sum(pcode23_faux.values()),
    "couvertureParSource": {},
    "combinaisons": dict(C.Counter("+".join(sorted({COURT.get(s["code"], "autre") for s in sources[i]})) for i in fiches).most_common()),
    "incoherencesParType": dict(C.Counter(x["type"] for x in incoherences)),
}
for src in ("OSM", "MEN2023", "MEN2013"):
    avec = [i for i in fiches if any(e["source"] == src for e in decisions[i]["evidences"])]
    stats["couvertureParSource"][src] = {
        "fiches": len(avec),
        "communeResolue": sum(1 for i in avec if any(e["source"] == src and e["pcode"] for e in decisions[i]["evidences"])),
    }
json.dump(stats, open(os.path.join(OUT, "stats.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps(stats, ensure_ascii=False, indent=1)[:6000])

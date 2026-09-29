import assert from "node:assert/strict";
import test from "node:test";
import {
  CHEFS_LIEUX_MALI,
  cleLocaliteRapprochementMali,
  communeParVoisinsMali,
  estChefLieuMali,
  localisationMali,
  regionMali,
  trouverCommuneMali,
} from "./localisation-mali";
import { normaliserEducation } from "./catalog-service";
import { donneesLigne, ficheInchangee, verifierFraicheurPlan } from "../scripts/appliquer-plan-villes";

test("table région OCHA → chef-lieu", () => {
  assert.deepEqual(CHEFS_LIEUX_MALI, [
    "Kayes", "Koulikoro", "Sikasso", "Ségou", "Mopti", "Tombouctou", "Gao", "Kidal", "Bamako", "Ménaka", "Taoudéni",
  ]);
  assert.equal(regionMali("SEGOU")?.chefLieu, "Ségou");
  assert.equal(regionMali("District de Bamako")?.chefLieu, "Bamako");
  assert.equal(regionMali("BKO")?.chefLieu, "Bamako");
  assert.equal(regionMali("Menaka")?.chefLieu, "Ménaka");
  assert.equal(regionMali("ML0401")?.chefLieu, "Ségou");
  assert.equal(regionMali("MLO7")?.chefLieu, "Gao");
  assert.equal(regionMali("Taoudénit")?.chefLieu, "Taoudéni");
  // Régions de 2023 rattachées à leur région OCHA d'origine.
  assert.equal(regionMali("Kita")?.chefLieu, "Kayes");
  assert.equal(regionMali("Dioïla")?.chefLieu, "Koulikoro");
  assert.equal(regionMali("Bandiagara")?.chefLieu, "Mopti");
  assert.equal(regionMali("Atlantide"), null);
  assert.ok(estChefLieuMali("segou"));
  assert.ok(!estChefLieuMali("Kati"));
});

test("résout la commune par P-code fiable, par nom dans le cercle et pour Bamako", () => {
  assert.equal(trouverCommuneMali({ code: "ML090105", codeFiable: true })?.nom, "Commune V");
  assert.equal(trouverCommuneMali({ commune: "COMMUNE V", cercle: "BAMAKO", region: "BAMAKO" })?.code, "ML090105");
  assert.equal(trouverCommuneMali({ commune: "Commune 5", region: "Bamako" })?.code, "ML090105");
  assert.equal(trouverCommuneMali({ commune: "COMMUNE DE KAYES", cercle: "KAYES", region: "KAYES" })?.cercle, "Kayes");
  // Homonymes : Dogofry existe à Nara (Koulikoro) et à Niono (Ségou).
  assert.equal(trouverCommuneMali({ commune: "Dogofry", cercle: "Niono", region: "Segou" })?.region, "Ségou");
  assert.equal(trouverCommuneMali({ commune: "Dogofry", cercle: "Nara", region: "Koulikoro" })?.region, "Koulikoro");
  assert.equal(trouverCommuneMali({ commune: "Dogofry" }), null);
  // Un P-code MEN 2023 (indicatif) ne l'emporte pas sur le nom dans le cercle.
  const parNom = trouverCommuneMali({ commune: "Kalabancoro", cercle: "Kati", region: "Koulikoro", code: "ML090101" });
  assert.equal(parNom?.nom, "Kalabancoro");
});

test("ville = chef-lieu de région, détails conservés", () => {
  const village = localisationMali({ commune: "KALABANCORO", cercle: "KATI", region: "KOULIKORO", localite: "KABALA" });
  assert.equal(village.ville, "Koulikoro");
  assert.equal(village.villeNormalisee, "koulikoro");
  assert.equal(village.commune, "Kalabancoro");
  assert.equal(village.cercle, "Kati");
  assert.equal(village.region, "Koulikoro");
  assert.equal(village.localite, "Kabala");
  assert.match(village.communeCode || "", /^ML02/);
  assert.equal(village.resolution, "commune");

  const bamako = localisationMali({ commune: "COMMUNE IV", cercle: "BAMAKO", region: "BAMAKO", localite: "Commune IV" });
  assert.deepEqual([bamako.ville, bamako.commune, bamako.localite], ["Bamako", "Commune IV", null]);

  const memeNom = localisationMali({ commune: "Sikasso", cercle: "Sikasso", region: "Sikasso", localite: "SIKASSO" });
  assert.equal(memeNom.localite, null);

  const regionSeule = localisationMali({ commune: "Commune inconnue de Zzz", region: "MOPTI", cercle: "BANKASS" });
  assert.equal(regionSeule.ville, "Mopti");
  assert.equal(regionSeule.communeCode, null);
  assert.equal(regionSeule.resolution, "region");

  assert.equal(localisationMali({ localite: "Quelque part" }).ville, null);
});

test("la commune fait partie de la clé de rapprochement", () => {
  const a = cleLocaliteRapprochementMali({ villeNormalisee: "koulikoro", communeCode: "ML020301" });
  const b = cleLocaliteRapprochementMali({ villeNormalisee: "koulikoro", communeCode: "ML020302" });
  assert.notEqual(a, b);
  assert.equal(
    cleLocaliteRapprochementMali({ villeNormalisee: "bamako", commune: "Commune V" }),
    cleLocaliteRapprochementMali({ villeNormalisee: "bamako", commune: "COMMUNE 5" }),
  );
  assert.equal(cleLocaliteRapprochementMali({ villeNormalisee: "segou" }), "segou|?");
});

test("commune par plus proches voisins : unanimité et au moins 3 voisins", () => {
  const ref = (latitude: number, communeCode: string) => ({ latitude, longitude: -7.98, communeCode });
  const point = { latitude: 12.6, longitude: -7.98 };
  assert.equal(communeParVoisinsMali(point, [ref(12.601, "ML090105"), ref(12.602, "ML090105"), ref(12.603, "ML090105")])?.nom, "Commune V");
  assert.equal(communeParVoisinsMali(point, [ref(12.601, "ML090105"), ref(12.602, "ML090105")]), null);
  assert.equal(communeParVoisinsMali(point, [ref(12.601, "ML090105"), ref(12.602, "ML090106"), ref(12.603, "ML090105")]), null);
  assert.equal(communeParVoisinsMali({ latitude: null, longitude: null }, []), null);
});

test("script du plan : fraîcheur, contrôle de la fiche, données écrites", () => {
  const maintenant = new Date("2026-09-30T00:00:00Z");
  verifierFraicheurPlan({ extraitLe: "2026-09-29T00:44:02Z" }, maintenant);
  assert.throws(() => verifierFraicheurPlan({ extraitLe: "2026-09-28T11:00:00Z" }, maintenant), /36 h/);
  assert.throws(() => verifierFraicheurPlan({ extraitLe: "n'importe" }, maintenant), /invalide/);

  const ligne = {
    id: "x", nom: "École", villeActuelle: "Kabala", villeNormaliseeActuelle: "kabala", valideActuel: true,
    villeProposee: "Koulikoro", villeNormaliseeProposee: "koulikoro", localite: "Kabala", commune: "Kalabancoro",
    communeCode: "ML020308", cercle: "Kati", region: "Koulikoro", confiance: "HAUTE" as const, appliquer: true,
  };
  assert.ok(ficheInchangee(ligne, { ville: "Kabala", villeNormalisee: "kabala", valide: true }));
  assert.ok(!ficheInchangee(ligne, { ville: "Kabala ", villeNormalisee: "kabala", valide: true }));
  assert.ok(!ficheInchangee(ligne, { ville: "Kabala", villeNormalisee: "kabala", valide: false }));
  const donnees = donneesLigne(ligne);
  assert.equal(donnees.villeNormalisee, normaliserEducation("Koulikoro"));
  assert.equal(donneesLigne({ ...ligne, villeProposee: "Ségou", villeNormaliseeProposee: "segou" }).villeNormalisee, "segou");
  assert.throws(() => donneesLigne({ ...ligne, villeNormaliseeProposee: "autre" }), /normaliserEducation/);
});

test("imports MEN : le campus prend le chef-lieu, la commune et la localité", async () => {
  const { regrouperCampusRegistreMali } = await import("./mali-school-registries");
  const [campus] = regrouperCampusRegistreMali([{
    sourceCode: "unicef-men-mali-schools-2013",
    identifiantExterne: "t-1",
    nom: "KABALA [1er C]",
    cycle: "1er cycle",
    statutBrut: "Public",
    typeEnseignement: null,
    codesOfficiels: [],
    codesCluster: [],
    region: "KOULIKORO",
    cercle: "KATI",
    commune: "KALABANCORO",
    localite: "KABALA",
    latitude: null,
    longitude: null,
    donneesBrutes: {},
  }]);
  assert.equal(campus.ville, "Koulikoro");
  assert.equal(campus.villeNormalisee, "koulikoro");
  assert.equal(campus.localisation.commune, "Kalabancoro");
  assert.equal(campus.localisation.localite, "Kabala");
  // L'administration brute reste disponible pour les signatures de rapprochement.
  assert.equal(campus.commune, "KALABANCORO");
});

test("imports Overture : localité → commune, voisins, région ou Bamako", async () => {
  const { localisationOvertureMali } = await import("./mali-overture-education");
  const base = { ville: "Kati", villeNormalisee: "kati", region: null, latitude: 12.74, longitude: -8.07, donneesBrutes: { adresse: { locality: "Kati" } } };
  const kati = localisationOvertureMali(base);
  assert.deepEqual([kati.ville, kati.commune, kati.localite], ["Koulikoro", "Kati", null]);

  const quartier = localisationOvertureMali({ ...base, ville: "Bamako", villeNormalisee: "bamako", donneesBrutes: { adresse: { locality: "Sébéninkoro" } } });
  assert.deepEqual([quartier.ville, quartier.localite, quartier.commune], ["Bamako", "Sébéninkoro", null]);

  const inconnu = { ...base, ville: "Hameau X", villeNormalisee: "hameau x", donneesBrutes: { adresse: { locality: "Hameau X" } } };
  const voisins = [0.001, 0.002, 0.003].map((ecart) => ({ latitude: 12.74 + ecart, longitude: -8.07, communeCode: "ML020415" }));
  const parVoisins = localisationOvertureMali(inconnu, voisins);
  assert.deepEqual([parVoisins.ville, parVoisins.commune, parVoisins.localite], ["Koulikoro", "Kalabancoro", "Hameau X"]);
  assert.equal(localisationOvertureMali(inconnu).resolution, "aucune");
  assert.equal(localisationOvertureMali(inconnu).ville, "Hameau X");
});

test("recherche : une ville de l'onboarding trouve aussi la commune et la localité au Mali", async () => {
  const { filtreVilleEtablissements, filtreTermeEtablissement } = await import("./catalog-service");
  assert.deepEqual(filtreVilleEtablissements("ML", "Kati"), {
    OR: [{ villeNormalisee: { in: ["kati"] } }, { commune: "Kati" }, { localite: "Kati" }],
  });
  assert.deepEqual(filtreVilleEtablissements("ML", "Cercle d’Abeïbara"), {
    OR: [{ villeNormalisee: { in: ["cercle d abeibara"] } }, { cercle: "Abeïbara" }, { commune: "Abeïbara" }],
  });
  assert.deepEqual(filtreVilleEtablissements("ML", "Koutiala Cercle"), {
    OR: [{ villeNormalisee: { in: ["koutiala cercle"] } }, { cercle: "Koutiala" }, { commune: "Koutiala" }],
  });
  assert.deepEqual(filtreVilleEtablissements("FR", "Lyon"), { villeNormalisee: { in: ["lyon"] } });
  assert.equal(filtreVilleEtablissements("ML", "  "), null);
  assert.equal(filtreTermeEtablissement("kabala", "ML").OR?.length, 4);
  assert.equal(filtreTermeEtablissement("kabala", "FR").OR?.length, 2);
});

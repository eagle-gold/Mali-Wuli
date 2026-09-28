import assert from "node:assert/strict";
import test from "node:test";
import { NiveauEducation, TypeEtablissement } from "@prisma/client";
import {
  type CandidatOverture,
  type EcoleOverture,
  type FeatureOverture,
  convertirFeatureOverture,
  lireFeaturesOverture,
  normaliserNomRapprochementOverture,
  signatureBrancheOverture,
  trouverCorrespondanceOverture,
} from "./mali-overture-education";

const feature = (params: {
  id?: string;
  nom?: string;
  categorie?: string;
  confiance?: number | null;
  ville?: string | null;
  region?: string | null;
  pays?: string;
  longitude?: number;
  latitude?: number;
} = {}): FeatureOverture => ({
  id: params.id || "gers-1",
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [params.longitude ?? -8.01, params.latitude ?? 12.62],
  },
  properties: {
    names: { primary: params.nom || "École Horizon" },
    categories: { primary: params.categorie || "school" },
    confidence: params.confiance === undefined ? 0.82 : params.confiance,
    addresses: [{
      country: params.pays || "ML",
      locality: params.ville === undefined ? "Bamako" : params.ville,
      region: params.region,
    }],
    sources: [{ dataset: "meta", record_id: "123" }],
  },
});

const ecole = (params: Partial<EcoleOverture> = {}): EcoleOverture => ({
  identifiantExterne: "gers-1",
  nom: "École Horizon",
  nomNormalise: "ecole horizon",
  nomRapproche: "horizon",
  signatureBranche: "",
  aliases: [],
  categorie: "school",
  confiance: 0.82,
  type: TypeEtablissement.FONDAMENTALE,
  statut: "INCONNU",
  niveaux: ["PRIMAIRE", "FONDAMENTAL"],
  ville: "Bamako",
  villeNormalisee: "bamako",
  region: null,
  regionNormalisee: "",
  localisationsNormalisees: new Set(["bamako"]),
  latitude: 12.62,
  longitude: -8.01,
  donneesBrutes: {},
  ...params,
});

const candidat = (params: Partial<CandidatOverture> = {}): CandidatOverture => ({
  id: "existant-1",
  nomsExacts: new Set(["ecole horizon"]),
  nomsRapproches: new Set(["horizon"]),
  signatureBranche: "",
  type: TypeEtablissement.FONDAMENTALE,
  localisationsNormalisees: new Set(["bamako"]),
  regionsNormalisees: new Set(),
  latitude: 12.6205,
  longitude: -8.01,
  ...params,
});

test("ne conserve que les établissements scolaires maliens suffisamment fiables", () => {
  assert.ok(convertirFeatureOverture(feature()).ecole);
  assert.equal(convertirFeatureOverture(feature({ confiance: 0.699 })).raisonIgnoree, "confiance-insuffisante");
  assert.equal(convertirFeatureOverture(feature({ categorie: "college_university" })).raisonIgnoree, "categorie-non-scolaire");
  assert.equal(convertirFeatureOverture(feature({ pays: "SN" })).raisonIgnoree, "pays-non-malien");
  assert.equal(convertirFeatureOverture(feature({ ville: null })).raisonIgnoree, "localisation-manquante");
});

test("écarte l'enseignement supérieur et les auto-écoles même mal classés par la source", () => {
  assert.equal(
    convertirFeatureOverture(feature({ nom: "École Nationale d'Ingénieurs", categorie: "school" })).raisonIgnoree,
    "enseignement-superieur",
  );
  assert.equal(
    convertirFeatureOverture(feature({ nom: "Auto École Donia", categorie: "school" })).raisonIgnoree,
    "hors-scolaire",
  );
});

test("écarte une coordonnée incompatible avec une adresse à Bamako", () => {
  assert.equal(
    convertirFeatureOverture(feature({ ville: "Bamako", longitude: 0.703, latitude: 15.284 })).raisonIgnoree,
    "coordonnees-incompatibles-localite",
  );
  assert.equal(
    convertirFeatureOverture(feature({ ville: "Quartier inconnu", region: "BKO", longitude: 0.703, latitude: 15.284 })).raisonIgnoree,
    "coordonnees-incompatibles-localite",
  );
});

test("distingue collège fondamental, lycée secondaire et enseignement professionnel", () => {
  const college = convertirFeatureOverture(feature({ categorie: "middle_school", nom: "Collège Horizon" })).ecole;
  assert.equal(college?.type, TypeEtablissement.FONDAMENTALE);
  assert.deepEqual(college?.niveaux, [NiveauEducation.FONDAMENTAL]);

  const lycee = convertirFeatureOverture(feature({ categorie: "high_school", nom: "Lycée de Kita", ville: "Kita", longitude: -9.49, latitude: 13.04 })).ecole;
  assert.equal(lycee?.type, TypeEtablissement.LYCEE);
  assert.deepEqual(lycee?.niveaux, [NiveauEducation.SECONDAIRE]);

  const secondaire = convertirFeatureOverture(feature({ nom: "Omo Osin Aremu Secondary school" })).ecole;
  assert.equal(secondaire?.type, TypeEtablissement.LYCEE);
  assert.deepEqual(secondaire?.niveaux, [NiveauEducation.SECONDAIRE]);

  for (const nom of ["École Hôtelière Chiaka Sidibé", "École de Musique de Kirina", "Institut professionnel Wuli"]) {
    const specialisee = convertirFeatureOverture(feature({ nom })).ecole;
    assert.equal(specialisee?.type, TypeEtablissement.LYCEE, nom);
    assert.deepEqual(specialisee?.niveaux, [NiveauEducation.PROFESSIONNEL], nom);
  }
});

test("cumule les niveaux d'un établissement maternel et fondamental", () => {
  const mixte = convertirFeatureOverture(feature({ nom: "École Maternelle et Fondamentale La Sagesse" })).ecole;
  assert.equal(mixte?.type, TypeEtablissement.FONDAMENTALE);
  assert.deepEqual(mixte?.niveaux, [
    NiveauEducation.PRESCOLAIRE,
    NiveauEducation.PRIMAIRE,
    NiveauEducation.FONDAMENTAL,
  ]);
  assert.deepEqual(
    convertirFeatureOverture(feature({ categorie: "preschool", nom: "Maternelle Sagesse" })).ecole?.niveaux,
    [NiveauEducation.PRESCOLAIRE],
  );
});

test("canonise les quartiers de Bamako et le code régional BKO sans absorber Kati", () => {
  const sebeninkoro = convertirFeatureOverture(feature({ ville: "Sébéninkoro" })).ecole;
  assert.equal(sebeninkoro?.ville, "Bamako");
  assert.equal(sebeninkoro?.villeNormalisee, "bamako");
  assert.ok(sebeninkoro?.localisationsNormalisees.has("sebeninkoro"));
  assert.ok(sebeninkoro?.localisationsNormalisees.has("bamako"));

  const bko = convertirFeatureOverture(feature({ ville: "Quartier du Fleuve", region: "BKO" })).ecole;
  assert.equal(bko?.ville, "Bamako");
  assert.equal(bko?.regionNormalisee, "bamako");

  const kati = convertirFeatureOverture(feature({ ville: "Kati" })).ecole;
  assert.equal(kati?.ville, "Kati");
  assert.equal(kati?.villeNormalisee, "kati");
});

test("rapproche seulement avec nom, ville et distance", () => {
  assert.deepEqual(trouverCorrespondanceOverture(ecole(), [candidat()]), {
    id: "existant-1",
    raison: "nom-exact",
    candidats: ["existant-1"],
  });
  assert.equal(
    trouverCorrespondanceOverture(ecole(), [candidat({ localisationsNormalisees: new Set(["segou"]) })]).raison,
    "nouveau",
  );
  assert.equal(
    trouverCorrespondanceOverture(ecole(), [candidat({ latitude: null, longitude: null })]).raison,
    "ambigu",
  );
  assert.equal(
    trouverCorrespondanceOverture(ecole(), [candidat({ longitude: -7.9 })]).raison,
    "nouveau",
  );
});

test("rapproche un libellé relâché à moins de 150 mètres", () => {
  const resultat = trouverCorrespondanceOverture(
    ecole({ nom: "Lycée Horizon", nomNormalise: "lycee horizon", type: TypeEtablissement.LYCEE }),
    [candidat({ nomsExacts: new Set(["ecole horizon"]), nomsRapproches: new Set(["horizon"]) })],
  );
  assert.equal(resultat.id, "existant-1");
  assert.equal(resultat.raison, "nom-relache");
});

test("préserve les communes, les branches et les établissements filles/garçons", () => {
  assert.notEqual(signatureBrancheOverture("Collège Horizon Commune I"), signatureBrancheOverture("Collège Horizon Commune V"));
  assert.notEqual(signatureBrancheOverture("Lycée A filles"), signatureBrancheOverture("Lycée A garçons"));
  assert.equal(
    trouverCorrespondanceOverture(
      ecole({ signatureBranche: "commune:1|suffixe:1" }),
      [candidat({ signatureBranche: "commune:5|suffixe:5" })],
    ).raison,
    "nouveau",
  );
  // Une source sans marqueur n'invalide pas un match par nom + ville + distance.
  assert.equal(
    trouverCorrespondanceOverture(ecole({ signatureBranche: "" }), [candidat({ signatureBranche: "commune:1|suffixe:1" })]).id,
    "existant-1",
  );
});

test("met en quarantaine plusieurs candidats sûrs au lieu de choisir le plus proche", () => {
  const resultat = trouverCorrespondanceOverture(ecole(), [
    candidat({ id: "a" }),
    candidat({ id: "b", longitude: -8.0101 }),
  ]);
  assert.equal(resultat.raison, "ambigu");
  assert.deepEqual(new Set(resultat.candidats), new Set(["a", "b"]));
});

test("lit un FeatureCollection et du NDJSON", () => {
  const une = feature({ id: "a" });
  const deux = feature({ id: "b" });
  assert.equal(lireFeaturesOverture(JSON.stringify({ type: "FeatureCollection", features: [une, deux] })).length, 2);
  assert.equal(lireFeaturesOverture(`${JSON.stringify(une)}\n${JSON.stringify(deux)}\n`).length, 2);
});

test("la normalisation relâchée conserve les marqueurs distinctifs", () => {
  assert.equal(normaliserNomRapprochementOverture("École privée Horizon A"), "horizon a");
  assert.equal(normaliserNomRapprochementOverture("Lycée Horizon filles"), "horizon filles");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  NiveauEducation,
  StatutEtablissement,
  TypeEtablissement,
} from "@prisma/client";
import {
  ajouterCandidat,
  agregerLignesParId,
  centroideGeometrie,
  choisirCanoniqueReconciliation,
  dedupliquerLignesOsm,
  nomCampusRapprochement,
  nomContientBrancheDistincte,
  resoudreCandidats,
  signatureBrancheDistincte,
  signaturesBrancheCompatibles,
  type LigneAgregationOsm,
} from "./import-mali-osm-utils";

const proche = (valeur: number, attendu: number, epsilon = 1e-9) => {
  assert.ok(Math.abs(valeur - attendu) <= epsilon, `${valeur} devrait être proche de ${attendu}`);
};

test("calcule le centroïde des Point, Polygon et MultiPolygon", () => {
  assert.deepEqual(centroideGeometrie({ type: "Point", coordinates: [-8, 12.6] }), {
    longitude: -8,
    latitude: 12.6,
  });

  const polygone = centroideGeometrie({
    type: "Polygon",
    coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
  });
  proche(polygone.longitude!, 1);
  proche(polygone.latitude!, 1);

  const multiPolygone = centroideGeometrie({
    type: "MultiPolygon",
    coordinates: [
      [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
      [[[4, 0], [6, 0], [6, 2], [4, 2], [4, 0]]],
    ],
  });
  proche(multiPolygone.longitude!, 3);
  proche(multiPolygone.latitude!, 1);
});

test("rejette les coordonnées invalides et les géométries non prises en charge", () => {
  assert.deepEqual(centroideGeometrie({ type: "Point", coordinates: [250, 12] }), {
    longitude: null,
    latitude: null,
  });
  assert.deepEqual(centroideGeometrie({ type: "LineString", coordinates: [[0, 0], [1, 1]] }), {
    longitude: null,
    latitude: null,
  });
});

const ligne = (params: Partial<LigneAgregationOsm> & Pick<LigneAgregationOsm, "id" | "osmId">): LigneAgregationOsm => ({
  id: params.id,
  osmId: params.osmId,
  nom: params.nom || "École Horizon",
  nomNormalise: params.nomNormalise || "ecole horizon",
  aliases: params.aliases || [],
  type: params.type || TypeEtablissement.FONDAMENTALE,
  statut: params.statut || StatutEtablissement.INCONNU,
  niveaux: params.niveaux || [NiveauEducation.FONDAMENTAL],
  villeNormalisee: params.villeNormalisee ?? "bamako",
  admin3Pcode: params.admin3Pcode ?? "ML0101",
  admin3NomNormalise: params.admin3NomNormalise ?? "commune i",
  localiteNormalisee: params.localiteNormalisee ?? "bamako",
  latitude: params.latitude === undefined ? 12.65 : params.latitude,
  longitude: params.longitude === undefined ? -8 : params.longitude,
  existant: params.existant || false,
});

test("fusionne un lycée et une école du même campus à moins de 150 m", () => {
  const resultat = dedupliquerLignesOsm([
    ligne({ id: "a", osmId: "node/1", nom: "École Horizon" }),
    ligne({
      id: "b",
      osmId: "way/2",
      nom: "Lycée Horizon",
      nomNormalise: "lycee horizon",
      type: TypeEtablissement.LYCEE,
      niveaux: [NiveauEducation.SECONDAIRE],
      longitude: -7.9995,
    }),
  ]);

  assert.equal(resultat.lignes[0].id, resultat.lignes[1].id);
  assert.equal(resultat.statistiques.groupesFusionnes, 1);
  assert.equal(resultat.statistiques.lignesFusionnees, 1);
});

test("ne rend compatibles que les types fondamentale et lycée", () => {
  const resultat = dedupliquerLignesOsm([
    ligne({
      id: "universite",
      osmId: "node/1",
      nom: "Campus Horizon",
      nomNormalise: "campus horizon",
      type: TypeEtablissement.UNIVERSITE,
      niveaux: [NiveauEducation.SUPERIEUR],
    }),
    ligne({
      id: "ecole-superieure",
      osmId: "way/2",
      nom: "Campus Horizon",
      nomNormalise: "campus horizon",
      type: TypeEtablissement.ECOLE_SUPERIEURE,
      niveaux: [NiveauEducation.SUPERIEUR],
    }),
  ]);
  assert.notEqual(resultat.lignes[0].id, resultat.lignes[1].id);
});

test("refuse un libellé composé uniquement d'un numéro de cycle", () => {
  assert.equal(nomCampusRapprochement("1er cycle", TypeEtablissement.FONDAMENTALE), "");
  assert.equal(nomCampusRapprochement("premier cycle", TypeEtablissement.FONDAMENTALE), "");
  assert.equal(nomCampusRapprochement("TIELE [2ème C]", TypeEtablissement.FONDAMENTALE), "tiele");
});

test("réunit les cycles complémentaires d'un même campus très proche", () => {
  const resultat = dedupliquerLignesOsm([
    ligne({
      id: "castors-f1",
      osmId: "node/3079731112",
      nom: "LES CASTORS [1er C]",
      latitude: 12.6106278,
      longitude: -7.9965163,
      existant: true,
    }),
    ligne({
      id: "castors-f2",
      osmId: "node/3079731113",
      nom: "LES CASTORS [2ème C]",
      latitude: 12.6106047,
      longitude: -7.9965167,
      existant: true,
    }),
  ]);

  assert.equal(nomCampusRapprochement("LES CASTORS [1er C]", TypeEtablissement.FONDAMENTALE), "castors");
  assert.equal(nomCampusRapprochement("LES CASTORS [2ème C]", TypeEtablissement.FONDAMENTALE), "castors");
  assert.equal(resultat.statistiques.groupesAmbigus, 1);
  assert.deepEqual(resultat.ambiguites[0].idsExistants, ["castors-f1", "castors-f2"]);
  assert.equal(signaturesBrancheCompatibles([
    "LES CASTORS [1er C]",
    "LES CASTORS [2ème C]",
  ]), true);
});

test("ne fusionne pas deux cycles homonymes placés sur des campus éloignés", () => {
  const resultat = dedupliquerLignesOsm([
    ligne({
      id: "campus-a",
      osmId: "node/1",
      nom: "École Horizon 1er cycle",
      latitude: 12.61,
      longitude: -7.99,
    }),
    ligne({
      id: "campus-b",
      osmId: "node/2",
      nom: "École Horizon 2ème cycle",
      latitude: 12.62,
      longitude: -8.01,
    }),
  ]);

  assert.notEqual(resultat.lignes[0].id, resultat.lignes[1].id);
  assert.equal(resultat.statistiques.groupesFusionnes, 0);
});

test("préserve les branches A et B même quand chacune possède plusieurs cycles", () => {
  const resultat = dedupliquerLignesOsm([
    ligne({ id: "a-f1", osmId: "node/1", nom: "MOURDIAH [1er C] A" }),
    ligne({ id: "a-f2", osmId: "node/2", nom: "MOURDIAH [2ème C] A", longitude: -7.9999 }),
    ligne({ id: "b-f1", osmId: "node/3", nom: "MOURDIAH [1er C] B", longitude: -7.9998 }),
    ligne({ id: "b-f2", osmId: "node/4", nom: "MOURDIAH [2ème C] B", longitude: -7.9997 }),
  ]);

  assert.equal(resultat.lignes[0].id, resultat.lignes[1].id);
  assert.equal(resultat.lignes[2].id, resultat.lignes[3].id);
  assert.notEqual(resultat.lignes[0].id, resultat.lignes[2].id);
});

test("ne fusionne jamais sur le nom seul", () => {
  const cas = [
    // Coordonnées manquantes.
    [
      ligne({ id: "a", osmId: "node/1", latitude: null, longitude: null }),
      ligne({ id: "b", osmId: "node/2" }),
    ],
    // Localité manquante des deux côtés.
    [
      ligne({ id: "a", osmId: "node/1", admin3Pcode: "", admin3NomNormalise: "", localiteNormalisee: "" }),
      ligne({ id: "b", osmId: "node/2", admin3Pcode: "", admin3NomNormalise: "", localiteNormalisee: "" }),
    ],
    // Plus de 150 mètres.
    [
      ligne({ id: "a", osmId: "node/1", longitude: -8 }),
      ligne({ id: "b", osmId: "node/2", longitude: -7.997 }),
    ],
    // Deux communes dont les pcodes se contredisent.
    [
      ligne({ id: "a", osmId: "node/1", admin3Pcode: "ML0101" }),
      ligne({ id: "b", osmId: "node/2", admin3Pcode: "ML0102" }),
    ],
  ];

  for (const lignes of cas) {
    const resultat = dedupliquerLignesOsm(lignes);
    assert.notEqual(resultat.lignes[0].id, resultat.lignes[1].id);
    assert.equal(resultat.statistiques.groupesFusionnes, 0);
  }
});

test("rattache un nouvel objet au seul établissement existant compatible", () => {
  const resultat = dedupliquerLignesOsm([
    ligne({ id: "canonique", osmId: "node/1", existant: true }),
    ligne({ id: "nouveau", osmId: "way/2", longitude: -7.9995 }),
  ]);
  assert.equal(resultat.lignes[1].id, "canonique");
  assert.equal(resultat.lignes[1].existant, true);
  assert.equal(resultat.statistiques.lignesRattacheesAExistant, 1);
});

test("signale deux ids existants concurrents au lieu d'en choisir un", () => {
  const resultat = dedupliquerLignesOsm([
    ligne({ id: "canonique-a", osmId: "node/1", existant: true }),
    ligne({ id: "canonique-b", osmId: "way/2", existant: true, longitude: -7.9995 }),
  ]);
  assert.equal(resultat.lignes[0].id, "canonique-a");
  assert.equal(resultat.lignes[1].id, "canonique-b");
  assert.equal(resultat.statistiques.groupesAmbigus, 1);
  assert.deepEqual(resultat.ambiguites[0].idsExistants, ["canonique-a", "canonique-b"]);
});

test("utilise un lien complet et ne crée pas une chaîne géographique", () => {
  const resultat = dedupliquerLignesOsm([
    ligne({ id: "a", osmId: "node/1", latitude: 0, longitude: 0 }),
    ligne({ id: "b", osmId: "node/2", latitude: 0, longitude: 0.0009 }),
    ligne({ id: "c", osmId: "node/3", latitude: 0, longitude: 0.0018 }),
  ]);
  assert.equal(resultat.lignes[0].id, resultat.lignes[1].id);
  assert.notEqual(resultat.lignes[0].id, resultat.lignes[2].id);
});

test("agrège niveaux et alias quand plusieurs objets partagent le même id", () => {
  const agreges = agregerLignesParId([
    ligne({
      id: "campus",
      osmId: "node/1",
      nom: "École Horizon",
      aliases: ["Groupe scolaire Horizon"],
      statut: StatutEtablissement.PUBLIC,
      niveaux: [NiveauEducation.PRIMAIRE],
    }),
    ligne({
      id: "campus",
      osmId: "way/2",
      nom: "Lycée Horizon",
      nomNormalise: "lycee horizon",
      aliases: ["Horizon Bamako"],
      type: TypeEtablissement.LYCEE,
      statut: StatutEtablissement.PUBLIC,
      niveaux: [NiveauEducation.SECONDAIRE],
    }),
  ]);

  assert.equal(agreges.length, 1);
  assert.equal(agreges[0].type, TypeEtablissement.LYCEE);
  assert.deepEqual(agreges[0].niveaux, [NiveauEducation.PRIMAIRE, NiveauEducation.SECONDAIRE]);
  assert.deepEqual(new Set(agreges[0].aliases), new Set([
    "Groupe scolaire Horizon",
    "Lycée Horizon",
    "Horizon Bamako",
  ]));
});

test("détecte une résolution canonique ambiguë sans last-write-wins", () => {
  const index = new Map<string, Set<string>>();
  ajouterCandidat(index, "scolaire|bamako|horizon", "id-a");
  ajouterCandidat(index, "scolaire|bamako|horizon", "id-b");
  const resolution = resoudreCandidats(index.get("scolaire|bamako|horizon"));
  assert.deepEqual(resolution, {
    id: null,
    candidats: ["id-a", "id-b"],
    ambigu: true,
  });
});

test("n'utilise pas un libellé scolaire entièrement générique comme campus", () => {
  assert.equal(nomCampusRapprochement("École fondamentale", TypeEtablissement.FONDAMENTALE), "");
  assert.equal(nomCampusRapprochement("Lycée Horizon", TypeEtablissement.LYCEE), "horizon");
});

test("détecte les marqueurs de branche à comparer avant une fusion automatique", () => {
  for (const nom of [
    "École Horizon A",
    "Groupe fondamental Plateau II",
    "École II de Magnambougou",
    "Groupe B de Kalaban",
    "Groupe scolaire V de Bamako",
    "Groupe scolaire VI de Bamako",
    "Groupe scolaire C de Kalaban",
    "École Horizon 1",
    "École Horizon 2",
    "École Horizon 3",
    "École des filles de Kalaban",
    "Lycée garçons de Bamako",
  ]) {
    assert.equal(nomContientBrancheDistincte(nom), true, nom);
  }
  assert.equal(nomContientBrancheDistincte("Lycée Askia Mohamed"), false);
  assert.equal(nomContientBrancheDistincte("École Horizon - 2e cycle"), false);
});

test("autorise uniquement une signature de branche identique sur tout le groupe", () => {
  assert.equal(signatureBrancheDistincte("Groupe fondamental Plateau II"), "branche:2");
  assert.equal(signaturesBrancheCompatibles([
    "École fondamentale Plateau II",
    "Lycée Plateau II",
  ]), true);
  assert.equal(signaturesBrancheCompatibles([
    "École Horizon",
    "Lycée Horizon",
  ]), true);

  for (const noms of [
    ["École Horizon A", "École Horizon B"],
    ["Groupe fondamental Plateau I", "Groupe fondamental Plateau II"],
    ["École des filles de Kalaban", "École des garçons de Kalaban"],
    ["Groupe fondamental Plateau II", "Groupe fondamental Plateau"],
  ]) {
    assert.equal(signaturesBrancheCompatibles(noms), false, noms.join(" / "));
  }
  assert.equal(signaturesBrancheCompatibles([
    "École Horizon 1er cycle",
    "École Horizon 2ème cycle",
  ]), true);
});

test("choisit un canonique externe unique et refuse deux canoniques externes", () => {
  const candidats = [
    { id: "osm-riche", provenanceNonOsm: false, activite: 20, richesse: 20, creeLe: 1 },
    { id: "canonique", provenanceNonOsm: true, activite: 0, richesse: 1, creeLe: 2 },
  ];
  assert.deepEqual(choisirCanoniqueReconciliation(candidats), {
    id: "canonique",
    raison: "provenance-non-osm",
  });
  assert.deepEqual(choisirCanoniqueReconciliation([
    ...candidats,
    { id: "autre-canonique", provenanceNonOsm: true, activite: 10, richesse: 10, creeLe: 0 },
  ]), {
    id: null,
    raison: "plusieurs-canoniques",
  });
});

test("garde sinon la fiche la plus utilisée puis la plus riche", () => {
  assert.deepEqual(choisirCanoniqueReconciliation([
    { id: "ancien", provenanceNonOsm: false, activite: 1, richesse: 50, creeLe: 1 },
    { id: "actif", provenanceNonOsm: false, activite: 2, richesse: 1, creeLe: 2 },
  ]), {
    id: "actif",
    raison: "fiche-la-plus-riche",
  });
});

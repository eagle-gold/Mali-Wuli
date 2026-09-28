import assert from "node:assert/strict";
import test from "node:test";
import { TypeEtablissement } from "@prisma/client";
import {
  type FicheReconciliationRegistre,
  type ReferenceReconciliationRegistre,
  choisirCanoniqueRegistre,
  evaluerFusionSourcesCroisees,
  nomCampusDiscriminant,
  planifierReconciliationRegistres,
} from "./mali-registry-reconciliation";
import { normaliserNomCampusMali } from "./mali-school-registries";

const administration = {
  region: "Bamako",
  cercle: "Bamako",
  commune: "Commune IV",
  localite: "Lafiabougou",
};

const reference = (partiel: Partial<ReferenceReconciliationRegistre> = {}): ReferenceReconciliationRegistre => ({
  sourceCode: "unicef-men-mali-schools-2013",
  identifiantExterne: "ref-2013",
  nom: "Collège Horizon",
  cycle: "1er cycle",
  codesCluster: [],
  latitude: null,
  longitude: null,
  ...administration,
  ...partiel,
});

const fiche = (partiel: Partial<FicheReconciliationRegistre> & Pick<FicheReconciliationRegistre, "id">): FicheReconciliationRegistre => {
  const nom = partiel.nom || "Collège Horizon";
  const references = partiel.references || [reference({ identifiantExterne: `ref-${partiel.id}`, nom })];
  return {
    nom,
    type: TypeEtablissement.FONDAMENTALE,
    nomsExacts: new Set([normaliserNomCampusMali(nom)]),
    latitude: 12.6200,
    longitude: -8.0000,
    sourceCodes: new Set(references.map(({ sourceCode }) => sourceCode)),
    sourcePrioriteMin: 9,
    activite: 0,
    richesse: references.length,
    creeLe: 1,
    ...partiel,
    references,
  };
};

test("réunit uniquement un F1 et un F2 UNICEF du même campus administratif complet", () => {
  const resultat = planifierReconciliationRegistres([
    fiche({
      id: "horizon-f1",
      references: [reference({ identifiantExterne: "horizon-f1", cycle: "F1" })],
    }),
    fiche({
      id: "horizon-f2",
      references: [reference({ identifiantExterne: "horizon-f2", cycle: "2ème cycle" })],
    }),
  ]);
  assert.equal(resultat.plans.length, 1);
  assert.deepEqual(resultat.plans[0].criteres, ["cycles-complementaires-2013"]);
  assert.deepEqual(new Set(resultat.plans[0].ids), new Set(["horizon-f1", "horizon-f2"]));
});

test("accepte une localité absente des deux lignes si région, cercle et commune sont complets", () => {
  const resultat = planifierReconciliationRegistres([
    fiche({
      id: "bamako-f1",
      references: [reference({ identifiantExterne: "bamako-f1", cycle: "F1", localite: null })],
    }),
    fiche({
      id: "bamako-f2",
      references: [reference({ identifiantExterne: "bamako-f2", cycle: "F2", localite: null })],
    }),
  ]);
  assert.equal(resultat.plans.length, 1);
});

test("refuse un groupe UNICEF qui contient plus d'une ligne pour un cycle", () => {
  const resultat = planifierReconciliationRegistres([
    fiche({ id: "f1-a", references: [reference({ identifiantExterne: "f1-a", cycle: "F1" })] }),
    fiche({ id: "f1-b", references: [reference({ identifiantExterne: "f1-b", cycle: "1er cycle" })] }),
    fiche({ id: "f2", references: [reference({ identifiantExterne: "f2", cycle: "F2" })] }),
  ]);
  assert.equal(resultat.plans.length, 0);
  assert.ok(resultat.exclusions.some(({ raison }) => raison === "cycles-non-complementaires"));
});

test("ne rapproche pas F1/F2 sans hiérarchie administrative complète", () => {
  const incomplet = { ...administration, commune: null, localite: null };
  const resultat = planifierReconciliationRegistres([
    fiche({ id: "f1", references: [reference({ identifiantExterne: "f1", cycle: "F1", ...incomplet })] }),
    fiche({ id: "f2", references: [reference({ identifiantExterne: "f2", cycle: "F2", ...incomplet })] }),
  ]);
  assert.equal(resultat.plans.length, 0);
});

test("accepte deux sources distinctes au même nom, même administration et à moins de 100 m", () => {
  const a = fiche({
    id: "source-2013",
    references: [reference({ sourceCode: "unicef-men-mali-schools-2013", identifiantExterne: "2013" })],
  });
  const b = fiche({
    id: "source-2023",
    latitude: 12.6204,
    references: [reference({ sourceCode: "ocha-men-mali-schools-2023", identifiantExterne: "2023", codesCluster: ["BamCom001"] })],
    sourcePrioriteMin: 4,
  });
  const resultat = evaluerFusionSourcesCroisees(a, b);
  assert.equal(resultat.accepte, true);
  assert.equal(planifierReconciliationRegistres([a, b]).plans[0].criteres.includes("sources-croisees-geolocalisees"), true);
});

test("préserve Deguere et Fa Keita B lorsque les codes cluster 2023 sont concurrents", () => {
  for (const nom of ["Deguere", "Fa Keita B"]) {
    const a = fiche({
      id: `${nom}-1`,
      nom,
      nomsExacts: new Set([normaliserNomCampusMali(nom)]),
      references: [reference({ sourceCode: "ocha-men-mali-schools-2023", identifiantExterne: `${nom}-1`, nom, codesCluster: ["DouMad0037"] })],
      sourceCodes: new Set(["ocha-men-mali-schools-2023", "unicef-men-mali-schools-2013"]),
    });
    const b = fiche({
      id: `${nom}-2`,
      nom,
      nomsExacts: new Set([normaliserNomCampusMali(nom)]),
      latitude: 12.6201,
      references: [reference({ sourceCode: "ocha-men-mali-schools-2023", identifiantExterne: `${nom}-2`, nom, codesCluster: ["DouMad0038"] })],
    });
    assert.deepEqual(evaluerFusionSourcesCroisees(a, b), {
      accepte: false,
      raison: "clusters-2023-concurrents",
    });
  }
});

test("ne rattache pas un ancien Deguere sans cluster à l'un de plusieurs clusters 2023 possibles", () => {
  const nom = "Deguere";
  const ancien = fiche({
    id: "deguere-2013",
    nom,
    nomsExacts: new Set([normaliserNomCampusMali(nom)]),
    references: [reference({ sourceCode: "unicef-men-mali-schools-2013", identifiantExterne: "deguere-2013", nom })],
  });
  const recentA = fiche({
    id: "deguere-2023-a",
    nom,
    nomsExacts: new Set([normaliserNomCampusMali(nom)]),
    latitude: 12.6201,
    references: [reference({ sourceCode: "ocha-men-mali-schools-2023", identifiantExterne: "deguere-a", nom, codesCluster: ["DouMad0037"] })],
  });
  const recentB = fiche({
    id: "deguere-2023-b",
    nom,
    nomsExacts: new Set([normaliserNomCampusMali(nom)]),
    latitude: 12.6202,
    references: [reference({ sourceCode: "ocha-men-mali-schools-2023", identifiantExterne: "deguere-b", nom, codesCluster: ["DouMad0038"] })],
  });
  const resultat = planifierReconciliationRegistres([ancien, recentA, recentB]);
  assert.equal(resultat.plans.length, 0);
  assert.ok(resultat.exclusions.some(({ raison }) => raison === "clusters-2023-concurrents"));
});

test("préserve les branches A/B/I/II et les écoles filles/garçons", () => {
  for (const [nomA, nomB] of [
    ["École Alpha A", "École Alpha B"],
    ["École Alpha I", "École Alpha II"],
    ["École Alpha filles", "École Alpha garçons"],
  ]) {
    const cleForcee = new Set(["alpha"]);
    const a = fiche({
      id: nomA,
      nom: nomA,
      nomsExacts: cleForcee,
      references: [reference({ sourceCode: "unicef-men-mali-schools-2013", identifiantExterne: nomA, nom: nomA })],
    });
    const b = fiche({
      id: nomB,
      nom: nomB,
      nomsExacts: cleForcee,
      references: [reference({ sourceCode: "ocha-men-mali-schools-2023", identifiantExterne: nomB, nom: nomB })],
    });
    assert.deepEqual(evaluerFusionSourcesCroisees(a, b), { accepte: false, raison: "branche-distincte" });
  }
});

test("refuse les libellés génériques, les coordonnées absentes, la distance et la même source", () => {
  assert.equal(nomCampusDiscriminant("école fondamentale publique"), false);
  assert.equal(nomCampusDiscriminant("médersa"), false);
  const base = fiche({ id: "base" });
  const generique = fiche({
    id: "generique",
    nom: "École fondamentale publique",
    nomsExacts: new Set([normaliserNomCampusMali("École fondamentale publique")]),
    references: [reference({ sourceCode: "ocha-men-mali-schools-2023", nom: "École fondamentale publique" })],
  });
  base.nomsExacts = new Set(generique.nomsExacts);
  assert.deepEqual(evaluerFusionSourcesCroisees(base, generique), { accepte: false, raison: "nom-generique" });

  const baseNomme = fiche({ id: "base-nommee" });
  const autreSource = fiche({
    id: "autre",
    references: [reference({ sourceCode: "ocha-men-mali-schools-2023", identifiantExterne: "autre" })],
  });
  assert.deepEqual(evaluerFusionSourcesCroisees({ ...baseNomme, latitude: null }, autreSource), {
    accepte: false,
    raison: "coordonnees-manquantes",
  });
  assert.deepEqual(evaluerFusionSourcesCroisees({ ...baseNomme, latitude: 12.62 }, { ...autreSource, latitude: 12.63 }), {
    accepte: false,
    raison: "distance-superieure-100m",
  });
  const memeSource = fiche({ id: "meme", references: [reference({ identifiantExterne: "meme" })] });
  assert.deepEqual(evaluerFusionSourcesCroisees(baseNomme, memeSource), { accepte: false, raison: "meme-source" });
});

test("un lien complet interdit la fusion transitive de deux campus distants", () => {
  const a = fiche({
    id: "a",
    longitude: -8.0000,
    references: [reference({ sourceCode: "unicef-men-mali-schools-2013", identifiantExterne: "a" })],
  });
  const b = fiche({
    id: "b",
    longitude: -7.9994,
    references: [reference({ sourceCode: "ocha-men-mali-schools-2023", identifiantExterne: "b" })],
  });
  const c = fiche({
    id: "c",
    longitude: -7.9988,
    references: [reference({ sourceCode: "hotosm-mali-education", identifiantExterne: "c" })],
  });
  const resultat = planifierReconciliationRegistres([a, b, c]);
  assert.equal(resultat.plans.length, 1);
  assert.equal(resultat.plans[0].ids.length, 2);
  assert.ok(resultat.exclusions.some(({ raison }) => raison === "grappe-non-complete"));
});

test("choisit d'abord la fiche utilisée puis la source la plus prioritaire", () => {
  const active = fiche({ id: "active", activite: 2, sourcePrioriteMin: 100 });
  const officielle = fiche({ id: "officielle", activite: 0, sourcePrioriteMin: 4 });
  assert.deepEqual(choisirCanoniqueRegistre([officielle, active]), { id: "active", raison: "activite" });
  assert.deepEqual(
    choisirCanoniqueRegistre([{ ...active, activite: 0 }, officielle]),
    { id: "officielle", raison: "source-prioritaire" },
  );
});

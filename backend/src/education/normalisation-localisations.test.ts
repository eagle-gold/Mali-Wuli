import assert from "node:assert/strict";
import test from "node:test";
import { villeCanoniqueMali, villeNormaliseePourPays } from "./normalisation-localisations";

test("rattache les six communes du district à Bamako", () => {
  for (const valeur of [
    "Commune I",
    "Commune II",
    "Commune III",
    "Commune IV",
    "Commune V",
    "Commune VI",
    "Commune 1",
    "Commune 6 du district de Bamako",
  ]) {
    assert.deepEqual(villeCanoniqueMali(valeur), {
      ville: "Bamako",
      villeNormalisee: "bamako",
      modifiee: true,
    });
  }
});

test("rattache les libellés de quartier de Bamako à la ville", () => {
  for (const valeur of ["District de Bamako", "Bamako, Hipp", "Bamako ACI 2000", "Bamako Coura K13"]) {
    assert.equal(villeCanoniqueMali(valeur).ville, "Bamako");
  }
});

test("utilise le contexte administratif OSM pour les quartiers de Bamako", () => {
  for (const [ville, commune] of [
    ["Daoudabougou", "Commune V"],
    ["Banankoro", "Commune VI"],
    ["Dialakorodji", "Commune I"],
  ]) {
    assert.equal(villeCanoniqueMali(ville, { region: "Bamako", cercle: "Bamako", commune }).ville, "Bamako");
  }
  assert.equal(villeCanoniqueMali("Dialakorodji").ville, "Dialakorodji");
});

test("ne rattache pas une autre commune à Bamako", () => {
  assert.deepEqual(villeCanoniqueMali("Kalaban-Coro"), {
    ville: "Kalaban-Coro",
    villeNormalisee: "kalaban coro",
    modifiee: false,
  });
  assert.equal(villeCanoniqueMali("Bamakoni").ville, "Bamakoni");
  assert.equal(villeNormaliseePourPays("FR", "Commune I").ville, "Commune I");
});

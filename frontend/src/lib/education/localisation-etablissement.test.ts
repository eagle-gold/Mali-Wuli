import assert from "node:assert/strict";
import test from "node:test";
import { detailLieu, estChefLieuMali, nomAvecLocalite } from "./localisation-etablissement";

test("détail du lieu sans doublon", () => {
  assert.equal(
    detailLieu({ localite: "Kabala", commune: "Kalabancoro", cercle: "Kati", region: "Koulikoro" }),
    "Kabala · Kalabancoro · Cercle de Kati · Région de Koulikoro",
  );
  assert.equal(detailLieu({ commune: "Sikasso", cercle: "Sikasso", region: "Sikasso" }), "Sikasso");
  assert.equal(detailLieu({ commune: "Commune V", cercle: "Bamako", region: "Bamako" }), "Commune V · District de Bamako");
  assert.equal(detailLieu({}), "");
});

test("nom avec localité et ville", () => {
  assert.equal(nomAvecLocalite("École A", { localite: "Kabala", ville: "Koulikoro" }), "École A — Kabala (Koulikoro)");
  assert.equal(nomAvecLocalite("École A", { ville: "Koulikoro" }), "École A");
  assert.equal(nomAvecLocalite("École A", { localite: "Ségou", ville: "Segou" }), "École A — Ségou");
});

test("chefs-lieux du Mali", () => {
  assert.ok(estChefLieuMali("segou"));
  assert.ok(!estChefLieuMali("Kati"));
});

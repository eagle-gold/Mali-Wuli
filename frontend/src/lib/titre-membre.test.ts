import assert from "node:assert/strict";
import { test } from "node:test";
import { TITRE_PAR_DEFAUT, titreMembre } from "./titre-membre";

test("titre d'un membre : le titre trimé, sinon « Membre du réseau »", () => {
  assert.equal(titreMembre("  Développeuse - Orange Mali "), "Développeuse - Orange Mali");
  for (const vide of [undefined, null, "", "   "]) assert.equal(titreMembre(vide), TITRE_PAR_DEFAUT);
  assert.equal(TITRE_PAR_DEFAUT, "Membre du réseau");
});

import assert from "node:assert/strict";
import test from "node:test";
import { confirmationValide } from "./suppression-compte.service";

test("confirmation de suppression : adresse exacte, casse et espaces ignorés", () => {
  assert.equal(confirmationValide("awa@exemple.ml", "awa@exemple.ml"), true);
  assert.equal(confirmationValide("  AWA@Exemple.ML ", "awa@exemple.ml"), true);
  for (const invalide of ["", "awa@exemple.com", "awa", null, undefined, 42, { email: "awa@exemple.ml" }]) {
    assert.equal(confirmationValide(invalide, "awa@exemple.ml"), false);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { rubriqueActive } from "./navigation";

test("rubrique active sur la page et ses sous-pages seulement", () => {
  assert.equal(rubriqueActive("/offres", "/offres"), true);
  assert.equal(rubriqueActive("/offres/deposer", "/offres"), true);
  assert.equal(rubriqueActive("/offresX", "/offres"), false);
  assert.equal(rubriqueActive("/dashboard", "/offres"), false);
  assert.equal(rubriqueActive(null, "/offres"), false);
});

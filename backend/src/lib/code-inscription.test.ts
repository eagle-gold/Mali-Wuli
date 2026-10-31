import assert from "node:assert/strict";
import test from "node:test";
import {
  TENTATIVES_CODE_MAX,
  codeCorrespond,
  formatCodeValide,
  genererCodeVerification,
  hacherCodeVerification,
  messageCodeIncorrect,
  tentativesRestantes,
} from "./code-inscription";

test("code généré : toujours 6 chiffres", () => {
  for (let index = 0; index < 500; index += 1) {
    assert.match(genererCodeVerification(), /^\d{6}$/);
  }
});

test("empreinte : le bon code correspond, jamais un autre ni un format invalide", async () => {
  const empreinte = await hacherCodeVerification("482913");
  assert.notEqual(empreinte, "482913");
  assert.equal(await codeCorrespond("482913", empreinte), true);
  assert.equal(await codeCorrespond("482914", empreinte), false);
  for (const invalide of ["48291", "4829133", "48 913", "abcdef", 482913, null, undefined]) {
    assert.equal(formatCodeValide(invalide), false);
    assert.equal(await codeCorrespond(invalide, empreinte), false);
  }
});

test("tentatives : décompte puis blocage", () => {
  assert.equal(TENTATIVES_CODE_MAX, 5);
  assert.equal(tentativesRestantes(1), 4);
  assert.equal(tentativesRestantes(9), 0);
  assert.equal(messageCodeIncorrect(1), "Code incorrect. Il vous reste 4 essais.");
  assert.equal(messageCodeIncorrect(4), "Code incorrect. Il vous reste 1 essai.");
  assert.match(messageCodeIncorrect(5), /demandez un nouveau code/);
});

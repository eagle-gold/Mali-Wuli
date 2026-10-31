import assert from "node:assert/strict";
import test from "node:test";
import { definirMessagesNonLus, libellePastille, lireMessagesNonLus } from "./compteur-messages";

test("compteur de messages : valeurs invalides ramenées à zéro", () => {
  definirMessagesNonLus(4);
  assert.equal(lireMessagesNonLus(), 4);
  for (const invalide of [-3, Number.NaN, Number.POSITIVE_INFINITY]) {
    definirMessagesNonLus(invalide);
    assert.equal(lireMessagesNonLus(), 0);
  }
  definirMessagesNonLus(2.7);
  assert.equal(lireMessagesNonLus(), 2);
});

test("libellé de pastille plafonné à 99+", () => {
  assert.equal(libellePastille(7), "7");
  assert.equal(libellePastille(99), "99");
  assert.equal(libellePastille(100), "99+");
});

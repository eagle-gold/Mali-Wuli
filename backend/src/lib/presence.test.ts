import assert from "node:assert/strict";
import test from "node:test";
import { connexionFermee, connexionOuverte, estEnLigne, reinitialiserPresencePourTests } from "./presence";

test("présence : en ligne tant qu'une connexion reste ouverte (plusieurs onglets)", () => {
  reinitialiserPresencePourTests();
  assert.equal(estEnLigne("u1"), false);
  assert.equal(connexionOuverte("u1"), true, "première connexion");
  assert.equal(connexionOuverte("u1"), false, "second onglet");
  assert.equal(connexionFermee("u1"), false, "un onglet reste ouvert");
  assert.equal(estEnLigne("u1"), true);
  assert.equal(connexionFermee("u1"), true, "dernier onglet fermé");
  assert.equal(estEnLigne("u1"), false);
  assert.equal(connexionFermee("u1"), true, "fermeture en trop sans compteur négatif");
  assert.equal(estEnLigne("u1"), false);
});

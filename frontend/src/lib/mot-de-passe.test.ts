import assert from "node:assert/strict";
import test from "node:test";
import { emailValide, motDePasseValide, robustesseMotDePasse } from "./mot-de-passe";

test("mot de passe : mêmes règles que le serveur", () => {
  assert.equal(motDePasseValide("Abcdefg1"), true);
  for (const invalide of ["abcdefg1", "ABCDEFG1", "Abcdefgh", "Abc1"]) assert.equal(motDePasseValide(invalide), false, invalide);
});

test("robustesse progressive", () => {
  assert.equal(robustesseMotDePasse("").niveau, 0);
  assert.equal(robustesseMotDePasse("abc").libelle, "Trop faible");
  assert.equal(robustesseMotDePasse("Abcdefg1").libelle, "Correct");
  assert.equal(robustesseMotDePasse("Abcdefghijk1").libelle, "Solide");
  assert.equal(robustesseMotDePasse("Abcdefghij1!").libelle, "Excellent");
});

test("adresse e-mail", () => {
  assert.equal(emailValide(" awa@exemple.ml "), true);
  for (const invalide of ["", "awa", "awa@", "awa@exemple", "a wa@exemple.ml"]) assert.equal(emailValide(invalide), false, invalide);
});

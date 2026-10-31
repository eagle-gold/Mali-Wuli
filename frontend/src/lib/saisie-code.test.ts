import assert from "node:assert/strict";
import test from "node:test";
import { codeComplet, formaterDecompte, insererDansCode } from "./saisie-code";

const vide = () => Array(6).fill("");

test("un chiffre avance d'une case", () => {
  const { cases, focus } = insererDansCode(vide(), 0, "4");
  assert.deepEqual(cases, ["4", "", "", "", "", ""]);
  assert.equal(focus, 1);
});

test("un code complet collé dans n'importe quelle case remplit tout", () => {
  const { cases, focus } = insererDansCode(vide(), 3, " 482-913 ");
  assert.deepEqual(cases, ["4", "8", "2", "9", "1", "3"]);
  assert.equal(focus, 5);
  assert.equal(codeComplet(cases), true);
});

test("une saisie partielle part de la case courante sans déborder", () => {
  const { cases } = insererDansCode(["1", "2", "", "", "", ""], 4, "789");
  assert.deepEqual(cases, ["1", "2", "", "", "7", "8"]);
});

test("caractères non numériques ignorés, effacement", () => {
  assert.deepEqual(insererDansCode(["5", "", "", "", "", ""], 0, "a").cases, vide());
  assert.equal(codeComplet(["1", "2", "3", "4", "5", ""]), false);
});

test("décompte", () => {
  assert.equal(formaterDecompte(42), "0:42");
  assert.equal(formaterDecompte(60), "1:00");
  assert.equal(formaterDecompte(-3), "0:00");
});

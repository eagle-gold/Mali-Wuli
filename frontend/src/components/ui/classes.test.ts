import assert from "node:assert/strict";
import test from "node:test";
import { classesBouton, classesCarte, classesPastille } from "./classes";

test("bouton primaire par défaut : marque, taille moyenne, focus visible", () => {
  const classes = classesBouton();
  assert.match(classes, /\bbg-brand\b/);
  assert.match(classes, /\bmin-h-11\b/);
  assert.match(classes, /focus-visible:ring-2/);
  assert.doesNotMatch(classes, /\bw-full\b/);
});

test("chaque variante a un style de survol et un anneau de focus", () => {
  for (const variante of ["primaire", "secondaire", "discret", "inverse", "danger"] as const) {
    const classes = classesBouton({ variante });
    assert.match(classes, /hover:/, variante);
    assert.match(classes, /focus-visible:ring-(brand|gold|danger)/, variante);
  }
});

test("les cibles tactiles font au moins 44 px dès la taille moyenne", () => {
  assert.match(classesBouton({ taille: "md" }), /min-h-11/);
  assert.match(classesBouton({ taille: "lg" }), /min-h-12/);
});

test("options pleine largeur et classes additionnelles", () => {
  const classes = classesBouton({ pleineLargeur: true, className: "mt-4" });
  assert.match(classes, /\bw-full\b/);
  assert.ok(classes.endsWith("mt-4"));
  assert.doesNotMatch(classes, /undefined|false/);
});

test("carte interactive et pastilles", () => {
  assert.match(classesCarte({ interactive: true }), /hover:shadow-raised/);
  assert.doesNotMatch(classesCarte(), /hover:/);
  assert.match(classesPastille("marque"), /bg-brand-50/);
  assert.match(classesPastille(), /bg-surface-sunken/);
});

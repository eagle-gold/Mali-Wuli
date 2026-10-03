import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { texteMultiligneSchema } from "./validation";

test("texte multiligne : CRLF et CR isolés deviennent LF", () => {
  const schema = texteMultiligneSchema(50);
  assert.equal(schema.parse("a\r\nb\rc\nd"), "a\nb\nc\nd");
});

test("texte multiligne : la limite se mesure après normalisation (envoi multipart avec photo)", () => {
  const schema = texteMultiligneSchema(10);
  const saisi = "abcde\nfghi"; // 10 caractères dans le champ du navigateur
  assert.equal(saisi.length, 10);
  assert.equal(schema.safeParse(saisi.replace(/\n/g, "\r\n")).success, true);
  assert.equal(schema.safeParse("abcde\nfghij").success, false);
});

test("texte multiligne : valeur absente avec .default(\"\"), espaces de bord retirés, non-texte refusé", () => {
  const schema = z.object({ contenu: texteMultiligneSchema(10).default("") });
  assert.deepEqual(schema.parse({}), { contenu: "" });
  assert.equal(schema.parse({ contenu: "  a\r\nb  " }).contenu, "a\nb");
  assert.equal(schema.safeParse({ contenu: 12 }).success, false);
});

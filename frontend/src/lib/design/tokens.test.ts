import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Les tokens sont lus dans globals.css : le test suit la source unique.
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");
const tokens = new Map<string, [number, number, number]>();
for (const [, nom, r, g, b] of css.matchAll(/--mw-([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) {
  tokens.set(nom, [Number(r), Number(g), Number(b)]);
}

function luminance([r, g, b]: [number, number, number]) {
  const canal = (valeur: number) => {
    const c = valeur / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(premier: string, second: string) {
  const a = tokens.get(premier);
  const b = tokens.get(second);
  assert.ok(a && b, `token manquant : ${premier} ou ${second}`);
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

test("les tokens attendus sont définis", () => {
  for (const nom of ["brand", "brand-700", "ink", "ink-soft", "ink-muted", "page", "surface", "surface-raised", "line", "bark", "gold", "danger"]) {
    assert.ok(tokens.has(nom), nom);
  }
});

test("texte courant : contraste WCAG AA (≥ 4,5:1) sur toutes les surfaces claires", () => {
  for (const texte of ["ink", "ink-soft", "ink-muted", "brand", "brand-700", "danger"]) {
    for (const fond of ["page", "surface", "surface-raised", "surface-sunken"]) {
      const ratio = contraste(texte, fond);
      assert.ok(ratio >= 4.5, `${texte} sur ${fond} : ${ratio.toFixed(2)}`);
    }
  }
});

test("texte blanc sur les boutons pleins (≥ 4,5:1)", () => {
  tokens.set("blanc", [255, 255, 255]);
  for (const fond of ["brand", "brand-700", "danger", "bark"]) {
    const ratio = contraste("blanc", fond);
    assert.ok(ratio >= 4.5, `blanc sur ${fond} : ${ratio.toFixed(2)}`);
  }
});

test("en-tête écorce : texte et repère or lisibles", () => {
  assert.ok(contraste("bark-text", "bark") >= 4.5, "texte de l'en-tête");
  assert.ok(contraste("gold", "bark") >= 3, "repère actif et focus (non textuel, ≥ 3:1)");
});

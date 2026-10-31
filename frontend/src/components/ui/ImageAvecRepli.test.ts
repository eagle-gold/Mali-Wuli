import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsx compile le JSX en mode classique (React.createElement) hors de Next.
(globalThis as { React?: typeof React }).React = React;

async function rendu(src: string | null | undefined) {
  const { default: ImageAvecRepli } = await import("./ImageAvecRepli");
  return renderToStaticMarkup(createElement(ImageAvecRepli, { src, className: "rond", repli: createElement("span", null, "AT") }));
}

test("sans photo : les initiales s'affichent, aucune image", async () => {
  for (const vide of [null, undefined, ""]) assert.equal(await rendu(vide), "<span>AT</span>");
});

test("avec photo : une image décorative (alt vide) avec ses classes", async () => {
  const html = await rendu("/uploads/photo.webp");
  assert.match(html, /^<img /);
  assert.match(html, /src="\/uploads\/photo.webp"/);
  assert.match(html, /alt=""/);
  assert.match(html, /class="rond"/);
});

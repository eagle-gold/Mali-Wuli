import assert from "node:assert/strict";
import { test } from "node:test";
import { erreurImagePublication, TAILLE_MAX_IMAGE_PUBLICATION } from "./publication-image";

test("formats JPEG, PNG et WebP acceptés", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(erreurImagePublication({ type, size: 1024 }), null, type);
  }
});

test("autres formats refusés, dont GIF, SVG et PDF", () => {
  for (const type of ["image/gif", "image/svg+xml", "application/pdf", "video/mp4", ""]) {
    assert.match(erreurImagePublication({ type, size: 1024 }) ?? "", /Format non supporté/, type);
  }
});

test("taille : exactement 10 Mo accepté, au-delà refusé, fichier vide refusé", () => {
  assert.equal(erreurImagePublication({ type: "image/png", size: TAILLE_MAX_IMAGE_PUBLICATION }), null);
  assert.match(erreurImagePublication({ type: "image/png", size: TAILLE_MAX_IMAGE_PUBLICATION + 1 }) ?? "", /10 Mo/);
  assert.match(erreurImagePublication({ type: "image/png", size: 0 }) ?? "", /vide/);
});

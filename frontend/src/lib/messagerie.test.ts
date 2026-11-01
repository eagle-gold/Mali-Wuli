import assert from "node:assert/strict";
import test from "node:test";
import { familleFichier, formaterTaille, libelleJour, libellePresence, positionsMessages, trierFichiers } from "./messagerie";

const maintenant = new Date(2026, 10, 1, 15, 0); // samedi 1er novembre 2026, 15 h

test("présence : en ligne, minutes, aujourd'hui, hier, semaine, date ; rien si inconnue", () => {
  const il = (minutes: number) => new Date(maintenant.getTime() - minutes * 60_000).toISOString();
  assert.equal(libellePresence(true, null, maintenant), "En ligne");
  assert.equal(libellePresence(false, il(0.5), maintenant), "Actif à l’instant");
  assert.equal(libellePresence(false, il(5), maintenant), "Actif il y a 5 min");
  assert.equal(libellePresence(false, new Date(2026, 10, 1, 9, 5).toISOString(), maintenant), "Actif aujourd’hui à 09:05");
  assert.equal(libellePresence(false, new Date(2026, 9, 31, 18, 30).toISOString(), maintenant), "Actif hier à 18:30");
  assert.equal(libellePresence(false, new Date(2026, 9, 28, 10, 0).toISOString(), maintenant), "Actif mercredi");
  assert.equal(libellePresence(false, new Date(2026, 8, 12, 10, 0).toISOString(), maintenant), "Actif le 12 sept.");
  assert.equal(libellePresence(false, new Date(2025, 8, 12, 10, 0).toISOString(), maintenant), "Actif le 12 sept. 2025");
  for (const inconnu of [null, undefined, "pas une date"]) assert.equal(libellePresence(false, inconnu, maintenant), null);
});

test("séparateurs de jour", () => {
  assert.equal(libelleJour(new Date(2026, 10, 1, 8).toISOString(), maintenant), "Aujourd’hui");
  assert.equal(libelleJour(new Date(2026, 9, 31, 8).toISOString(), maintenant), "Hier");
  assert.equal(libelleJour(new Date(2026, 9, 28, 8).toISOString(), maintenant), "Mercredi 28 octobre");
});

test("regroupement : même auteur à moins de 5 min, nouveau groupe au changement de jour ou d'auteur", () => {
  const m = (id: string, auteur: string, heure: number, minute: number, jour = 1) =>
    ({ id, auteur, envoyeLe: new Date(2026, 10, jour, heure, minute).toISOString() });
  const positions = positionsMessages([
    m("1", "moi", 14, 0), m("2", "moi", 14, 2), m("3", "autre", 14, 3), m("4", "autre", 14, 20), m("5", "autre", 14, 21),
  ], maintenant);
  assert.deepEqual(positions.map((p) => [p.debutGroupe, p.finGroupe]), [[true, false], [false, true], [true, true], [true, false], [false, true]]);
  assert.equal(positions[0].separateurJour, "Aujourd’hui");
  assert.equal(positions[1].separateurJour, null);
  const surDeuxJours = positionsMessages([m("a", "moi", 23, 58, 31 - 31 + 0), m("b", "moi", 0, 1)], maintenant);
  assert.equal(surDeuxJours[1].debutGroupe, true);
});

test("sélection de fichiers : format, taille, nombre", () => {
  const { acceptes, refus } = trierFichiers(3, [
    { name: "photo.JPG", size: 2_000 },
    { name: "script.exe", size: 10 },
    { name: "enorme.pdf", size: 11 * 1024 * 1024 },
    { name: "cv.pdf", size: 5_000 },
    { name: "notes.docx", size: 5_000 },
  ]);
  assert.deepEqual(acceptes, [0, 3]);
  assert.equal(refus.length, 3);
  assert.match(refus.join(" "), /script\.exe.*format/);
  assert.match(refus.join(" "), /10 Mo/);
  assert.match(refus.join(" "), /5 fichiers au maximum/);
});

test("tailles et familles de fichiers", () => {
  assert.equal(formaterTaille(512), "512 o");
  assert.equal(formaterTaille(2048), "2 Ko");
  assert.equal(formaterTaille(1.5 * 1024 * 1024), "1,5 Mo");
  assert.equal(familleFichier("Relevé.PDF"), "pdf");
  assert.equal(familleFichier("budget.xlsx"), "tableur");
  assert.equal(familleFichier("archive"), "autre");
});

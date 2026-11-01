import assert from "node:assert/strict";
import test from "node:test";
import { contentDisposition, detecterType, nettoyerNomFichier, nomFichierStockage } from "./pieces-jointes";

const octets = (...valeurs: number[]) => Buffer.from(valeurs);

test("images reconnues à leur signature, quelle que soit l'extension annoncée", () => {
  assert.deepEqual(detecterType(octets(0xff, 0xd8, 0xff, 0xe0), "photo.png"), { mime: "image/jpeg", image: true });
  assert.equal(detecterType(octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "a.png")?.mime, "image/png");
  assert.equal(detecterType(Buffer.from("RIFF\0\0\0\0WEBPVP8 "), "a.webp")?.mime, "image/webp");
  assert.equal(detecterType(Buffer.from("GIF89a..."), "a.gif")?.mime, "image/gif");
});

test("documents : PDF, bureautique et texte", () => {
  assert.equal(detecterType(Buffer.from("%PDF-1.7"), "cv.pdf")?.mime, "application/pdf");
  assert.match(detecterType(octets(0x50, 0x4b, 0x03, 0x04), "lettre.docx")!.mime, /wordprocessingml/);
  assert.equal(detecterType(octets(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), "ancien.doc")?.mime, "application/msword");
  assert.match(detecterType(Buffer.from("nom;ville\nAwa;Bamako"), "liste.csv")!.mime, /^text\/csv/);
});

test("refus : exécutable, script déguisé, archive non bureautique, binaire en .txt", () => {
  assert.equal(detecterType(Buffer.from("MZ\x90\0"), "photo.jpg"), null);
  assert.equal(detecterType(Buffer.from("<script>alert(1)</script>"), "image.png"), null);
  assert.equal(detecterType(Buffer.from("<html>"), "page.html"), null);
  assert.equal(detecterType(octets(0x50, 0x4b, 0x03, 0x04), "archive.zip"), null);
  assert.equal(detecterType(octets(0x41, 0x00, 0x42), "notes.txt"), null);
  assert.equal(detecterType(Buffer.alloc(0), "vide.txt"), null);
});

test("noms de fichiers nettoyés, sans chemin ni caractères dangereux", () => {
  assert.equal(nettoyerNomFichier("../../etc/passwd"), "passwd");
  assert.equal(nettoyerNomFichier("C:\\Users\\awa\\CV final.pdf"), "CV final.pdf");
  assert.equal(nettoyerNomFichier('re"ponse<>|?.pdf'), "reponse.pdf");
  assert.equal(nettoyerNomFichier("   "), "fichier");
  const long = nettoyerNomFichier(`${"a".repeat(300)}.pdf`);
  assert.equal(long.length, 120);
  assert.ok(long.endsWith(".pdf"));
});

test("nom de stockage aléatoire et en-tête de téléchargement accentué", () => {
  assert.match(nomFichierStockage("Mon CV.PDF"), /^[0-9a-f-]{36}\.pdf$/);
  assert.notEqual(nomFichierStockage("a.pdf"), nomFichierStockage("a.pdf"));
  assert.equal(contentDisposition("Relevé de notes.pdf", false), `attachment; filename="Releve de notes.pdf"; filename*=UTF-8''Relev%C3%A9%20de%20notes.pdf`);
  assert.match(contentDisposition("photo.jpg", true), /^inline;/);
});

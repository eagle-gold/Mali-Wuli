import assert from "node:assert/strict";
import { test } from "node:test";
import { LONGUEUR_MAX_TITRE, titreAEnregistrer, titreAutomatique, titreAutomatiqueDepuisBase, type ExperienceTitre } from "./titre-profil";

const exp = (poste: string, structure: string, posteActuel: boolean, anneeDebut: number, moisDebut = 1): ExperienceTitre =>
  ({ poste, structure, posteActuel, anneeDebut, moisDebut });

test("titre automatique : poste actuel le plus récent, « Poste chez Structure »", () => {
  const titre = titreAutomatique([exp("Stagiaire", "Banque A", false, 2022), exp("Data Scientist", "Natixis CIB", true, 2024), exp("Analyste", "Cabinet B", true, 2023)], []);
  assert.equal(titre, "Data Scientist chez Natixis CIB");
});

test("titre automatique : poste sans structure, espaces normalisés", () => {
  assert.equal(titreAutomatique([exp("  Ingénieure   data ", "  ", true, 2024)], []), "Ingénieure data");
});

test("titre automatique : sans poste actuel, étudiant(e) si études supérieures en cours", () => {
  const formations = [
    { type: "lycee", etablissement: "Lycée X", statutDiplome: "EN_COURS" },
    { type: "universite", etablissement: "Université Paris Dauphine-PSL", statutDiplome: "EN_COURS" },
  ];
  assert.equal(titreAutomatique([exp("Ancien poste", "Ex", false, 2020)], formations), "Étudiant(e) à Université Paris Dauphine-PSL");
});

test("titre automatique : rien à déduire → null (lycée en cours, diplôme obtenu, aucune donnée)", () => {
  assert.equal(titreAutomatique([], []), null);
  assert.equal(titreAutomatique([], [{ type: "lycee", etablissement: "Lycée X", statutDiplome: "EN_COURS" }]), null);
  assert.equal(titreAutomatique([], [{ type: "universite", etablissement: "Univ", statutDiplome: "OBTENU" }]), null);
});

test("titre automatique : tronqué à la longueur maximale avec ellipse", () => {
  const titre = titreAutomatique([exp("P".repeat(100), "S".repeat(100), true, 2024)], []);
  assert.equal(titre?.length, LONGUEUR_MAX_TITRE);
  assert.ok(titre?.endsWith("…"));
});

test("titre à enregistrer : le titre saisi l'emporte, même s'il existe un titre ou un parcours", () => {
  const experiences = [exp("Data Scientist", "Natixis", true, 2024)];
  assert.equal(titreAEnregistrer({ saisi: "  Data Scientist | Étudiant  ", existant: "Ancien", experiences, formations: [] }), "Data Scientist | Étudiant");
});

test("titre à enregistrer : champ absent → le titre existant est conservé, jamais écrasé", () => {
  const experiences = [exp("Data Scientist", "Natixis", true, 2024)];
  assert.equal(titreAEnregistrer({ saisi: undefined, existant: "Mon titre perso", experiences, formations: [] }), "Mon titre perso");
});

test("titre à enregistrer : champ vide ou aucun titre existant → titre déduit, sinon null", () => {
  const experiences = [exp("Data Scientist", "Natixis", true, 2024)];
  assert.equal(titreAEnregistrer({ saisi: "", existant: "Ancien", experiences, formations: [] }), "Data Scientist chez Natixis");
  assert.equal(titreAEnregistrer({ saisi: undefined, existant: null, experiences, formations: [] }), "Data Scientist chez Natixis");
  assert.equal(titreAEnregistrer({ saisi: "", existant: null, experiences: [], formations: [] }), null);
});

test("titre automatique : une coupure ne laisse jamais la moitié d'un emoji", () => {
  const titre = titreAutomatique([exp("A".repeat(150), "🚀".repeat(6), true, 2024)], []) ?? "";
  assert.ok(titre.length <= LONGUEUR_MAX_TITRE);
  assert.ok(titre.endsWith("…"));
  assert.equal(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(titre), false, "surrogate orphelin");
});

test("titre à enregistrer : un titre resté automatique suit le nouveau parcours", () => {
  const ancien = "Dev chez A";
  const experiences = [exp("Lead Dev", "B", true, 2025)];
  assert.equal(titreAEnregistrer({ saisi: ancien, existant: ancien, ancienAutomatique: ancien, experiences, formations: [] }), "Lead Dev chez B");
});

test("titre à enregistrer : un titre modifié par le membre n'est jamais remplacé par le parcours", () => {
  const experiences = [exp("Lead Dev", "B", true, 2025)];
  assert.equal(titreAEnregistrer({ saisi: "Ma phrase perso", existant: "Ma phrase perso", ancienAutomatique: "Dev chez A", experiences, formations: [] }), "Ma phrase perso");
  assert.equal(titreAEnregistrer({ saisi: "Dev chez A", existant: "Dev chez A", ancienAutomatique: null, experiences, formations: [] }), "Dev chez A");
});

test("titre depuis la base : même règle que le questionnaire (poste actuel, nom canonique de l'établissement)", () => {
  assert.equal(titreAutomatiqueDepuisBase([{ poste: "Analyste", entreprise: "Banque X", estActuel: true, dateDebut: new Date("2024-05-10T00:00:00Z") }], []), "Analyste chez Banque X");
  assert.equal(titreAutomatiqueDepuisBase([], [{ type: "universite", statutDiplome: "EN_COURS", autreEtablissement: "Saisie libre", etablissement: { nom: "Université canonique" } }]), "Étudiant(e) à Université canonique");
  assert.equal(titreAutomatiqueDepuisBase([], [{ type: "universite", statutDiplome: "EN_COURS", autreEtablissement: "Saisie libre", etablissement: null }]), "Étudiant(e) à Saisie libre");
});

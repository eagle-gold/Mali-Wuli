import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LONGUEUR_MAX_TITRE,
  TITRE_PAR_DEFAUT,
  resoudreTitre,
  titreSignificatif,
  titreAutomatique,
  titreParDefaut,
  titreParDefautDepuisBase,
  type ExperienceTitre,
} from "./titre-profil";

const exp = (poste: string, structure: string, posteActuel: boolean, anneeDebut: number, moisDebut = 1): ExperienceTitre =>
  ({ poste, structure, posteActuel, anneeDebut, moisDebut });
const univ = (etablissement: string, statutDiplome = "EN_COURS", type = "universite") => ({ type, etablissement, statutDiplome });

test("titre par défaut : poste actuel le plus récent, « Poste - Entreprise »", () => {
  const titre = titreParDefaut([exp("Stagiaire", "Banque A", false, 2022), exp("Data Scientist", "Natixis CIB", true, 2024), exp("Analyste", "Cabinet B", true, 2023)], []);
  assert.equal(titre, "Data Scientist - Natixis CIB");
});

test("titre par défaut : le poste actuel l'emporte sur des études en cours", () => {
  assert.equal(titreParDefaut([exp("Développeuse", "Orange Mali", true, 2024)], [univ("Université de Bamako")]), "Développeuse - Orange Mali");
});

test("titre par défaut : poste sans entreprise, espaces normalisés", () => {
  assert.equal(titreParDefaut([exp("  Ingénieure   data ", "  ", true, 2024)], []), "Ingénieure data");
});

test("titre par défaut : sans poste actuel, « Étudiant(e) - Université » si études supérieures en cours", () => {
  const formations = [univ("Lycée X", "EN_COURS", "lycee"), univ("Université Paris Dauphine-PSL")];
  assert.equal(titreParDefaut([exp("Ancien poste", "Ex", false, 2020)], formations), "Étudiant(e) - Université Paris Dauphine-PSL");
  assert.equal(titreParDefaut([], [univ("")]), "Étudiant(e)");
});

test("titre par défaut : sinon « Membre du réseau » (rien, lycée en cours, diplôme obtenu)", () => {
  assert.equal(TITRE_PAR_DEFAUT, "Membre du réseau");
  assert.equal(titreParDefaut([], []), "Membre du réseau");
  assert.equal(titreParDefaut([], [univ("Lycée X", "EN_COURS", "lycee")]), "Membre du réseau");
  assert.equal(titreParDefaut([], [univ("Univ", "OBTENU")]), "Membre du réseau");
  assert.equal(titreAutomatique([], []), null);
});

test("titre par défaut : tronqué à la longueur maximale, sans casser un emoji", () => {
  const long = titreParDefaut([exp("P".repeat(100), "S".repeat(100), true, 2024)], []);
  assert.equal(long.length, LONGUEUR_MAX_TITRE);
  assert.ok(long.endsWith("…"));
  const emoji = titreParDefaut([exp("A".repeat(150), "🚀".repeat(6), true, 2024)], []);
  assert.ok(emoji.length <= LONGUEUR_MAX_TITRE);
  assert.equal(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(emoji), false, "surrogate orphelin");
});

const dynamique = { titre: "Dev - A", personnalise: false };

test("résolution : texte du membre → titre personnalisé", () => {
  assert.deepEqual(resoudreTitre({ saisi: "  Papa, mentor et passionné  ", actuel: dynamique, defaut: "Dev - A" }), { titre: "Papa, mentor et passionné", personnalise: true });
});

test("résolution : vide, null ou identique au titre par défaut → retour au titre dynamique", () => {
  const perso = { titre: "Mon titre", personnalise: true };
  assert.deepEqual(resoudreTitre({ saisi: "", actuel: perso, defaut: "Lead - B" }), { titre: "Lead - B", personnalise: false });
  assert.deepEqual(resoudreTitre({ saisi: null, actuel: perso, defaut: "Lead - B" }), { titre: "Lead - B", personnalise: false });
  assert.deepEqual(resoudreTitre({ saisi: "   ", actuel: perso, defaut: "Lead - B" }), { titre: "Lead - B", personnalise: false });
  assert.deepEqual(resoudreTitre({ saisi: "Lead - B", actuel: perso, defaut: "Lead - B" }), { titre: "Lead - B", personnalise: false });
});

test("résolution : champ absent → un titre personnalisé est conservé, un titre dynamique suit le parcours", () => {
  assert.deepEqual(resoudreTitre({ saisi: undefined, actuel: { titre: "Mon titre", personnalise: true }, defaut: "Lead - B" }), { titre: "Mon titre", personnalise: true });
  assert.deepEqual(resoudreTitre({ saisi: undefined, actuel: dynamique, defaut: "Lead - B" }), { titre: "Lead - B", personnalise: false });
  assert.deepEqual(resoudreTitre({ saisi: undefined, actuel: { titre: null, personnalise: false }, defaut: "Membre du réseau" }), { titre: "Membre du réseau", personnalise: false });
});

test("résolution : un titre personnalisé trop long est tronqué proprement", () => {
  const resolu = resoudreTitre({ saisi: "x".repeat(500), actuel: dynamique, defaut: "Dev - A" });
  assert.equal(resolu.titre.length, LONGUEUR_MAX_TITRE);
  assert.equal(resolu.personnalise, true);
});

test("titre depuis la base : même règle (poste actuel, nom canonique de l'établissement)", () => {
  assert.equal(titreParDefautDepuisBase([{ poste: "Analyste", entreprise: "Banque X", estActuel: true, dateDebut: new Date("2024-05-10T00:00:00Z") }], []), "Analyste - Banque X");
  assert.equal(titreParDefautDepuisBase([], [{ type: "universite", statutDiplome: "EN_COURS", autreEtablissement: "Saisie libre", etablissement: { nom: "Université canonique" } }]), "Étudiant(e) - Université canonique");
  assert.equal(titreParDefautDepuisBase([], [{ type: "universite", statutDiplome: "EN_COURS", autreEtablissement: "Saisie libre", etablissement: null }]), "Étudiant(e) - Saisie libre");
  assert.equal(titreParDefautDepuisBase([], []), "Membre du réseau");
});

test("titre dans un document pro : le libellé générique est écarté, un vrai titre est conservé", () => {
  assert.equal(titreSignificatif("Membre du réseau"), null);
  assert.equal(titreSignificatif("  Membre du réseau "), null);
  assert.equal(titreSignificatif(null), null);
  assert.equal(titreSignificatif(""), null);
  assert.equal(titreSignificatif(" Développeuse - Orange Mali "), "Développeuse - Orange Mali");
});

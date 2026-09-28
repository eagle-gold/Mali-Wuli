import assert from "node:assert/strict";
import { test } from "node:test";
import { trierParDateDebut } from "../periode";
import { cleReferencesFormation, referencesFormationDisponibles, getDiplomes, getSeries, libelleProgramme } from "./reference";
import { avisEtablissementScolaireEstDisponible } from "./suivi";
import { diplomesDuParcoursScolaire, diplomeScolairePrincipal, erreurDiplomeScolaire, typeDiplomeScolaire, type DiplomeScolaire } from "./parcours-scolaire";

const brevet: DiplomeScolaire = { type: "BREVET", libelle: "Diplôme national du brevet (DNB)", anneeObtention: "2014", mention: "Bien", serie: "", statut: "OBTENU" };
const bac: DiplomeScolaire = { type: "BAC", libelle: "Baccalauréat général", anneeObtention: "2019", mention: "Bien", serie: "Ancienne série ES — économique et social", statut: "OBTENU" };

test("brevet et bac sont valides dans une seule scolarité 2012–2019", () => {
  assert.equal(erreurDiplomeScolaire(brevet, "2012", "2019"), "");
  assert.equal(erreurDiplomeScolaire(bac, "2012", "2019"), "");
  assert.equal(diplomeScolairePrincipal([bac, brevet]), bac);
  assert.match(erreurDiplomeScolaire({ ...brevet, anneeObtention: "2011" }, "2012", "2019"), /période/);
  assert.match(erreurDiplomeScolaire({ ...brevet, anneeObtention: "2020" }, "2012", "2019"), /période/);
});

test("un diplôme obtenu ne peut pas être futur, un diplôme préparé le peut", () => {
  const maintenant = new Date("2026-09-21");
  assert.match(erreurDiplomeScolaire({ ...bac, anneeObtention: "2027" }, "2024", "2027", maintenant), /future/);
  assert.equal(erreurDiplomeScolaire({ ...bac, anneeObtention: "2027", statut: "EN_COURS" }, "2024", "2027", maintenant), "");
});

test("migration d’un ancien lycée conserve le bac, la mention et la série", () => {
  assert.deepEqual(diplomesDuParcoursScolaire({ type: "lycee", diplome: bac.libelle, anneePromo: "2019", mention: "Bien", specialite: bac.serie, statutDiplome: "OBTENU" }), [bac]);
  const existants = [brevet, bac];
  assert.deepEqual(diplomesDuParcoursScolaire({ type: "ecole", diplomesScolaires: existants, diplome: "Ancien champ" }), existants);
  assert.deepEqual(diplomesDuParcoursScolaire({ type: "ecole", diplomesScolaires: [], diplome: "Ancien champ" }), []);
});

test("parcours récents en premier, dates absentes en dernier, sans mutation", () => {
  const valeurs = [{ id: "2008", anneeDebut: "2008", moisDebut: "01" }, { id: "sans-date" }, { id: "2005", anneeDebut: "2005", moisDebut: "06" }, { id: "2006", anneeDebut: "2006", moisDebut: "01" }];
  assert.deepEqual(trierParDateDebut(valeurs).map((item) => item.id), ["2008", "2006", "2005", "sans-date"]);
  assert.equal(valeurs[0].id, "2008");
  assert.deepEqual(trierParDateDebut(valeurs, "croissant").map((item) => item.id), ["2005", "2006", "2008", "sans-date"]);
  const memesAnnees = Object.freeze([
    { id: "septembre", anneeDebut: "2024", moisDebut: "09" },
    { id: "inconnue-1", anneeDebut: null },
    { id: "octobre-1", anneeDebut: 2024, moisDebut: 10 },
    { id: "octobre-2", anneeDebut: "2024", moisDebut: "10" },
    { id: "inconnue-2", anneeDebut: "????" },
  ]);
  assert.deepEqual(trierParDateDebut(memesAnnees).map((item) => item.id), ["octobre-1", "octobre-2", "septembre", "inconnue-1", "inconnue-2"]);
  assert.equal(memesAnnees[0].id, "septembre");
});

test("programme français sélectionne brevet, bac et anciennes séries françaises", () => {
  assert.ok(getDiplomes("FR", "ecole").some((diplome) => diplome.includes("DNB")));
  assert.ok(getDiplomes("FR", "lycee").includes("Baccalauréat général"));
  assert.ok(getSeries("FR").some((serie) => serie.includes("série ES")));
  assert.ok(!getDiplomes("FR", "lycee").includes("Baccalauréat malien"));
});

test("L1 est affiché comme Licence", () => {
  assert.equal(libelleProgramme("L1 - Chimie"), "Licence - Chimie");
  assert.equal(libelleProgramme("L3 - Droit"), "Licence — 3e année - Droit");
  assert.equal(libelleProgramme("Master - Droit"), "Master - Droit");
});

test("avis scolaire ouvert un an après le départ même si le brevet est antérieur", () => {
  assert.equal(avisEtablissementScolaireEstDisponible("OBTENU", "06", "2019", "2014", new Date("2020-05-15")), false);
  assert.equal(avisEtablissementScolaireEstDisponible("OBTENU", "06", "2019", "2014", new Date("2020-06-15")), true);
  assert.equal(avisEtablissementScolaireEstDisponible("EN_COURS", "06", "2019", "2014", new Date("2026-09-21")), false);
});


test("ML→FR immédiat ignore les anciennes références avant la réponse réseau", () => {
  const mali = { type: "ecole" as const, paysCode: "ML", systemeEducatifCode: "ML", institutionId: "mali-school" };
  const liberte = { ...mali, systemeEducatifCode: "FR", institutionId: "liberte" };
  const reponseMali = { cle: cleReferencesFormation(mali), series: ["TSE"], diplomes: ["BT — Brevet de technicien", "Baccalauréat malien"] };
  const immediates = referencesFormationDisponibles(liberte, reponseMali);
  assert.equal(immediates.diplomes.find((item) => typeDiplomeScolaire(item) === "BREVET"), "Diplôme national du brevet (DNB)");
  assert.equal(immediates.diplomes.find((item) => typeDiplomeScolaire(item) === "BAC"), "Baccalauréat général");
  assert.ok(!immediates.diplomes.includes("Baccalauréat malien"));
  assert.ok(immediates.series.some((serie) => serie.includes("série ES")));
  const reponseFrance = { cle: cleReferencesFormation(liberte), series: ["ES"], diplomes: ["DNB", "Baccalauréat général"] };
  assert.deepEqual(referencesFormationDisponibles(liberte, reponseFrance), reponseFrance);
  assert.notDeepEqual(referencesFormationDisponibles({ ...liberte, institutionId: "autre-lycee" }, reponseFrance), reponseFrance);
});

test("les brevets professionnels ou techniques ne sont jamais le brevet scolaire", () => {
  for (const libelle of ["BT — Brevet de technicien", "Brevet technicien", "BTS", "Brevet professionnel", "Brevet des métiers d’art", "Brevet technique"]) {
    assert.equal(typeDiplomeScolaire(libelle), "AUTRE", libelle);
  }
  assert.equal(typeDiplomeScolaire("Diplôme national du brevet (DNB)"), "BREVET");
  assert.equal(typeDiplomeScolaire("DEF — Diplôme d’études fondamentales"), "BREVET");
});

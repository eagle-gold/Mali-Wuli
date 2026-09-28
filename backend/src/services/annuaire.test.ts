import assert from "node:assert/strict";
import test from "node:test";
import { annuaireSchema, construireFiltresAnnuaire, perimetreAnnuaire, promotionsFormation, sujetsAide } from "./annuaire";

test("annuaire : membres validés et inscrits, profil courant exclu", () => {
  assert.deepEqual(perimetreAnnuaire("moi"), { id: { not: "moi" }, onboardingFini: true, user: { statut: "VALIDE" } });
  const where = construireFiltresAnnuaire(annuaireSchema.parse({ pays: "Mali", ville: "Bamako" }), "moi");
  assert.equal(where.pays, "Mali");
  assert.equal(where.ville, "Bamako");
  assert.deepEqual(where.user, { statut: "VALIDE" });
});

test("annuaire : prénom et nom recherchés séparément sans élargir le périmètre", () => {
  const where = construireFiltresAnnuaire(annuaireSchema.parse({ q: "  Awa   Diarra " }));
  const clauses = where.AND as any[];
  assert.equal(clauses.length, 2);
  assert.deepEqual(clauses[0].OR[0], { user: { prenom: { contains: "Awa" } } });
  assert.deepEqual(clauses[1].OR[1], { user: { nom: { contains: "Diarra" } } });
  assert.equal(where.onboardingFini, true);
});

test("annuaire : établissement et promotion doivent appartenir à la même formation", () => {
  const where = construireFiltresAnnuaire(annuaireSchema.parse({ etablissementId: "ecole-1", promotion: "2019" }));
  const clauses = where.AND as any[];
  assert.equal(clauses.length, 1);
  assert.equal(clauses[0].formations.some.etablissementId, "ecole-1");
  assert.deepEqual(clauses[0].formations.some.OR, [
    { anneeFin: 2019 }, { avis: { is: { anneePromo: 2019 } } },
    { diplomesScolaires: { array_contains: [{ anneeObtention: "2019" }] } },
  ]);
});

test("annuaire : aides limitées aux sujets déclarés par les volontaires", () => {
  const where = construireFiltresAnnuaire(annuaireSchema.parse({ aide: "Un emploi" }));
  assert.deepEqual(where.AND, [{ estVolontaire: true, volontaire: { is: { sujets: { array_contains: "Un emploi" } } } }]);
  assert.deepEqual(sujetsAide(["Mentorat", "  Mentorat ", "", null, 4, "Logement"]), ["Mentorat", "Logement"]);
  assert.deepEqual(sujetsAide({ prive: true }), []);
});

test("annuaire : années historiques et diplômes scolaires fusionnés dédupliqués", () => {
  assert.deepEqual(promotionsFormation({ anneeFin: 2019, avis: { anneePromo: 2020 }, diplomesScolaires: [
    { anneeObtention: "2014" }, { anneeObtention: "2019" }, { anneeObtention: "abc" }, null,
  ] }), [2020, 2019, 2014]);
  assert.deepEqual(promotionsFormation({ anneeFin: null }), []);
});

test("annuaire : filtres invalides refusés avant toute requête", () => {
  for (const query of [{ limite: "100" }, { page: "0" }, { page: "1.1" }, { promotion: "1880" }, { promotion: "abc" }, { q: "a".repeat(101) }]) {
    assert.equal(annuaireSchema.safeParse(query).success, false);
  }
  assert.equal(annuaireSchema.parse({}).limite, 20);
});

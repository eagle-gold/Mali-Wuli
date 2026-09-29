import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { lireFacettesEtablissements } from "./education-facettes.service";

const base = (villes: string[], communes: string[]) => {
  const requetes: string[] = [];
  return {
    requetes,
    db: {
      paysEducation: { findMany: async () => [{ code: "ML", nom: "Mali" }] },
      $queryRaw: async (sql: Prisma.Sql) => {
        requetes.push(sql.sql);
        return sql.sql.includes("DISTINCT commune")
          ? communes.map((commune) => ({ commune }))
          : villes.map((ville) => ({ ville }));
      },
    } as never,
  };
};

test("Mali : facette villes limitée aux chefs-lieux de région", async () => {
  const { db, requetes } = base(["Bamako", "Kati", "Ségou", "Tombouctou", "Yogola"], []);
  const facettes = await lireFacettesEtablissements(db, { pays: "ML" });
  assert.deepEqual(facettes.villes, ["Bamako", "Ségou", "Tombouctou"]);
  assert.deepEqual(facettes.communes, []);
  assert.equal(requetes.length, 1);
});

test("filtre secondaire commune proposé quand une ville est choisie", async () => {
  const { db, requetes } = base(["Bamako"], ["Commune I", "Commune V"]);
  const facettes = await lireFacettesEtablissements(db, { pays: "ML", ville: "Bamako" });
  assert.deepEqual(facettes.communes, ["Commune I", "Commune V"]);
  assert.equal(requetes.length, 2);
});

test("hors Mali : villes inchangées", async () => {
  const { db } = base(["Lyon", "Paris"], []);
  assert.deepEqual((await lireFacettesEtablissements(db, { pays: "FR" })).villes, ["Lyon", "Paris"]);
});

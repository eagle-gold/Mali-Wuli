/** Vrais helpers et delegates Prisma en mémoire ; aucune base, aucun serveur. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { listerPageEtablissementsParMembres } from "./priorite-membres.service";

type Ecole = { id: string; nom: string; valide: boolean; paysCode: string; villeNormalisee: string; type: string; nomNormalise: string; sigle: string; alias: { nomNormalise: string }[] };
type Profil = { id: string; onboardingFini: boolean; user: { statut: string } };
type Formation = { etablissementId: string | null; profilId: string };
function ecole(id: string, nom: string, autres: Partial<Ecole> = {}): Ecole {
  return { id, nom, nomNormalise: nom.toLowerCase(), valide: true, paysCode: "ML", villeNormalisee: "bamako", type: "UNIVERSITE", sigle: "", alias: [], ...autres };
}
function correspond(objet: any, filtre: any): boolean {
  return Object.entries(filtre).every(([champ, valeur]: [string, any]) => {
    if (champ === "AND") return valeur.every((condition: any) => correspond(objet, condition));
    if (champ === "OR") return valeur.some((condition: any) => correspond(objet, condition));
    if (champ === "NOT") return !correspond(objet, valeur);
    if (typeof valeur !== "object" || valeur === null) return objet[champ] === valeur;
    if ("in" in valeur) return valeur.in.includes(objet[champ]);
    if ("notIn" in valeur) return !valeur.notIn.includes(objet[champ]);
    if ("contains" in valeur) return String(objet[champ] || "").includes(valeur.contains);
    if ("some" in valeur) return objet[champ].some((ligne: any) => correspond(ligne, valeur.some));
    return correspond(objet[champ], valeur);
  });
}
function fixture(ecoles: Ecole[], formations: Formation[] = [], profils: Profil[] = []) {
  const appels: Array<{ methode: string; args: any }> = [];
  const db = {
    formation: { groupBy: async (args: any) => {
      appels.push({ methode: "formation.groupBy", args });
      assert.deepEqual(args.by, ["etablissementId", "profilId"]);
      const uniques = new Map<string, Formation>();
      for (const formation of formations) {
        const lieu = ecoles.find((e) => e.id === formation.etablissementId);
        const profil = profils.find((p) => p.id === formation.profilId);
        if (lieu && profil && correspond(lieu, args.where.etablissement) && correspond(profil, args.where.profil)) {
          uniques.set(`${formation.etablissementId}:${formation.profilId}`, formation);
        }
      }
      return [...uniques.values()];
    } },
    etablissement: { findMany: async (args: any) => {
      appels.push({ methode: "etablissement.findMany", args });
      assert.deepEqual(args.orderBy, [{ nom: "asc" }, { id: "asc" }]);
      return ecoles.filter((e) => correspond(e, args.where))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.id.localeCompare(b.id))
        .slice(args.skip || 0, args.take === undefined ? undefined : (args.skip || 0) + args.take)
        .map((e) => args.select.nom ? e : { id: e.id });
    } },
  } as unknown as PrismaClient;
  const liste = (page = 1, limite = 2, where: Prisma.EtablissementWhereInput = { valide: true }) =>
    listerPageEtablissementsParMembres(db, where, { page, limite });
  return { liste, appels };
}
const actif = (id: string): Profil => ({ id, onboardingFini: true, user: { statut: "VALIDE" } });

test("établissements : priorité globale avant pagination et profils distincts malgré plusieurs formations", async () => {
  const f = fixture([ecole("a", "Alpha"), ecole("z", "Zulu"), ecole("b", "Beta")], [
    ...Array.from({ length: 12 }, () => ({ etablissementId: "b", profilId: "un" })),
    { etablissementId: "z", profilId: "un" }, { etablissementId: "z", profilId: "deux" },
  ], [actif("un"), actif("deux")]);
  assert.deepEqual((await f.liste(1, 1)).map((e) => e.id), ["z"]);
  assert.deepEqual((await f.liste(2, 1)).map((e) => e.id), ["b"]);
  assert.deepEqual((await f.liste(3, 1)).map((e) => e.id), ["a"]);
  assert.deepEqual((await f.liste(4, 1)).map((e) => e.id), []);
});

test("établissements : comptes en attente/refusés, parcours incomplets et établissements invalides exclus", async () => {
  const f = fixture([ecole("a", "Alpha"), ecole("z", "Zulu"), ecole("cachee", "École cachée", { valide: false })], [
    { etablissementId: "a", profilId: "attente" }, { etablissementId: "a", profilId: "refuse" },
    { etablissementId: "a", profilId: "incomplet" }, { etablissementId: "z", profilId: "un" },
    { etablissementId: "cachee", profilId: "un" }, { etablissementId: null, profilId: "un" },
  ], [actif("un"), { ...actif("attente"), user: { statut: "EN_ATTENTE" } },
    { ...actif("refuse"), user: { statut: "REFUSE" } }, { ...actif("incomplet"), onboardingFini: false }]);
  assert.deepEqual((await f.liste()).map((e) => e.id), ["z", "a"]);
  assert.deepEqual(f.appels[0].args.where.profil, { onboardingFini: true, user: { statut: "VALIDE" } });
});

test("établissements : les filtres pays/ville/niveau et la recherche par alias sont conservés au comptage et à la page", async () => {
  const f = fixture([
    ecole("a", "Alpha", { alias: [{ nomNormalise: "liberte" }] }),
    ecole("z", "Zulu", { alias: [{ nomNormalise: "liberte" }] }),
    ecole("fr", "Paris", { paysCode: "FR", alias: [{ nomNormalise: "liberte" }] }),
    ecole("ville", "Sikasso", { villeNormalisee: "sikasso", alias: [{ nomNormalise: "liberte" }] }),
    ecole("lycee", "Lycée", { type: "LYCEE", alias: [{ nomNormalise: "liberte" }] }),
    ecole("autre", "Autre université"),
  ], ["z", "fr", "ville", "lycee", "autre"].map((etablissementId) => ({ etablissementId, profilId: "un" })), [actif("un")]);
  const filtre: Prisma.EtablissementWhereInput = {
    valide: true, paysCode: "ML", type: "UNIVERSITE", villeNormalisee: { contains: "bamako" },
    AND: [{ OR: [{ nomNormalise: { contains: "liberte" } }, { alias: { some: { nomNormalise: { contains: "liberte" } } } }] }],
  };
  assert.deepEqual((await f.liste(1, 3, filtre)).map((e) => e.id), ["z", "a"]);
  assert.deepEqual(f.appels[0].args.where.etablissement, filtre);
});

test("établissements : page mixte puis sans membres sans omission ni répétition ; égalités ordonnées nom/id", async () => {
  const f = fixture([ecole("z2", "Zulu"), ecole("z1", "Zulu"), ecole("b", "Beta"), ecole("a", "Alpha"), ecole("c", "Charlie")], [
    { etablissementId: "z2", profilId: "un" }, { etablissementId: "z1", profilId: "un" },
  ], [actif("un")]);
  const premiere = await f.liste(1, 3); const seconde = await f.liste(2, 3);
  assert.deepEqual(premiere.map((e) => e.id), ["z1", "z2", "a"]);
  assert.deepEqual(seconde.map((e) => e.id), ["b", "c"]);
  assert.equal(new Set([...premiere, ...seconde].map((e) => e.id)).size, 5);
});

test("établissements : pas de plafond arbitraire de classement ni de chargement du catalogue sans membres", async () => {
  const zeros = Array.from({ length: 1_500 }, (_, n) => ecole(`zero-${n}`, `Alpha ${String(n).padStart(4, "0")}`));
  const f = fixture([...zeros, ecole("z", "Zulu")], [{ etablissementId: "z", profilId: "un" }], [actif("un")]);
  assert.deepEqual((await f.liste(1, 2)).map((e) => e.id), ["z", "zero-0"]);
  const requetes = f.appels.filter((a) => a.methode === "etablissement.findMany");
  const sansLimite = requetes.filter((a) => a.args.take === undefined);
  assert.ok(sansLimite.every((a) => a.args.where.AND.some((c: any) => c.id?.in?.length === 1)));
  assert.equal(requetes.find((a) => a.args.take !== undefined)!.args.take, 1);
});

test("établissements : catalogue sans membres ou filtre vide conserve une pagination alphabétique normale", async () => {
  const f = fixture([ecole("b", "Beta"), ecole("a", "Alpha"), ecole("c", "Charlie")]);
  assert.deepEqual((await f.liste(2, 2)).map((e) => e.id), ["c"]);
  assert.deepEqual((await f.liste(1, 2, { valide: true, paysCode: "CA" })).map((e) => e.id), []);
  assert.equal(f.appels.filter((a) => a.methode === "etablissement.findMany").length, 2);
});

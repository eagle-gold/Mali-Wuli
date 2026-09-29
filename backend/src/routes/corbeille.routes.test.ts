/** Corbeille 30 jours : vrais handlers/auth/services ; base, socket et médias simulés en mémoire. */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { creerRouteurCorbeille } from "./corbeille.routes";
import { creerRouteurPublications } from "./publication.routes";
import { prisma } from "../lib/prisma";
import { filtrerNotificationsContenuSupprime, planifierPurgeCorbeille, purgerCorbeille } from "../services/corbeille.service";
import { compteMemoire, creerBaseMemoire, profilMemoire, requeteMemoire } from "./base-memoire.fixture";

const secretAvant = process.env.JWT_SECRET;
process.env.JWT_SECRET = "fixture-corbeille-sans-base-reseau";
const findAvant = prisma.user.findUnique;
const comptes = new Map(["owner", "commentateur", "other", "admin", "publications"].map((id) => [`user-${id}`, compteMemoire(id, {
  email: id === "admin" ? "ik736764@gmail.com" : `${id}@example.invalid`,
  role: id === "admin" ? "ADMIN" : "MEMBRE",
  rolesDelegues: id === "publications" ? [{ code: "PUBLICATIONS" }] : [],
})]));
prisma.user.findUnique = (async ({ where }: any) => comptes.get(where.id) || null) as typeof prisma.user.findUnique;
after(() => { prisma.user.findUnique = findAvant; if (secretAvant === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretAvant; });
type Row = Record<string, any>;

const JOUR = 24 * 60 * 60 * 1000;
const MAINTENANT = new Date("2026-09-29T12:00:00Z");
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);
const pub = (id: string, auteurId: string, extra: Row = {}) => ({
  id, auteurId, visible: true, photoUrl: null, lienUrl: null, contenu: `Contenu ${id}`, intention: "OFFRE", thematique: "Entraide", type: "TEXTE",
  createdAt: ilYa(40), updatedAt: ilYa(40), epingle: false, deletedAt: null, deletedById: null, ...extra,
});
const com = (id: string, publicationId: string, auteurId: string, extra: Row = {}) => ({
  id, publicationId, auteurId, contenu: `Commentaire ${id}`, parentId: null, createdAt: ilYa(40), deletedAt: null, deletedById: null, ...extra,
});

function fixture() {
  const base = creerBaseMemoire({
    profil: [...comptes.keys()].map((u) => profilMemoire(u.replace("user-", ""))),
    publication: [
      pub("vivante", "owner"),
      pub("parAuteur", "owner", { photoUrl: "/uploads/publications/a.jpg", deletedAt: ilYa(2), deletedById: "owner" }),
      pub("parModo", "owner", { deletedAt: ilYa(1), deletedById: "publications" }),
      pub("expiree", "owner", { photoUrl: "/uploads/publications/old.jpg", deletedAt: ilYa(31), deletedById: "owner" }),
      pub("autrui", "other", { deletedAt: ilYa(3), deletedById: "other" }),
    ],
    commentairePublication: [
      com("racine", "vivante", "commentateur", { deletedAt: ilYa(1), deletedById: "commentateur" }),
      com("reponse", "vivante", "other", { parentId: "racine" }),
      com("retireParPost", "vivante", "commentateur", { deletedAt: ilYa(1), deletedById: "owner" }),
      com("surPubSupprimee", "parAuteur", "commentateur", { deletedAt: ilYa(2), deletedById: "commentateur" }),
      com("vieux", "vivante", "commentateur", { deletedAt: ilYa(45), deletedById: "commentateur" }),
    ],
    reactionPublication: [{ id: "r-exp", publicationId: "expiree", auteurId: "other", type: "LIKE", createdAt: ilYa(40) }],
  });
  const medias: Array<string | null | undefined> = [];
  const emissions: Array<{ nom: string; payload: Row }> = [];
  const socket = (() => ({ emit: (nom: string, payload: Row) => { emissions.push({ nom, payload }); } })) as any;
  const corbeille = creerRouteurCorbeille({ db: base.db as PrismaClient, retirerMedia: (url) => { medias.push(url); }, obtenirSocket: socket, maintenant: () => MAINTENANT });
  const publications = creerRouteurPublications({ db: base.db as PrismaClient, retirerMedia: () => undefined, obtenirSocket: socket });
  const requete = (method: string, path: string, compte = "owner") => requeteMemoire(corbeille, method, path, { compte, base: "/api/corbeille" });
  const fil = async (compte = "owner") => (await requeteMemoire(publications, "GET", "/", { compte, base: "/api/publications" })).body.publications.map((p: Row) => p.id);
  return { ...base, requete, fil, medias, emissions, publications };
}

test("GET /corbeille : éléments de moins de 30 jours de l'auteur, date d'effacement et droits", async () => {
  const f = fixture();
  const r = await f.requete("GET", "/");
  assert.equal(r.status, 200); assert.equal(r.body.dureeConservationJours, 30);
  // « expiree » (31 j) est en attente de purge : plus proposée à la restauration. « autrui » n'est pas à lui.
  // « retireParPost » : commentaire d'autrui qu'il a retiré de son post ; listé sans droit d'agir.
  assert.deepEqual(r.body.elements.map((e: Row) => e.id).sort(), ["parAuteur", "parModo", "retireParPost"]);
  assert.equal(r.body.elements.at(-1).id, "parAuteur", "tri par date de suppression décroissante");
  const retire = r.body.elements.find((e: Row) => e.id === "retireParPost");
  assert.equal(retire.estAuteur, false); assert.equal(retire.peutRestaurer, false); assert.equal(retire.peutEffacer, false);
  const parAuteur = r.body.elements.find((e: Row) => e.id === "parAuteur");
  assert.equal(parAuteur.type, "publication"); assert.equal(parAuteur.peutRestaurer, true); assert.equal(parAuteur.peutEffacer, true);
  assert.equal(new Date(parAuteur.effacementDefinitifLe).getTime(), ilYa(2).getTime() + 30 * JOUR);
  const parModo = r.body.elements.find((e: Row) => e.id === "parModo");
  assert.equal(parModo.supprimeParModeration, true); assert.equal(parModo.peutRestaurer, false); assert.match(parModo.raisonBlocage, /modération/);

  const c = await f.requete("GET", "/", "commentateur");
  assert.deepEqual(c.body.elements.map((e: Row) => e.id).sort(), ["racine", "retireParPost", "surPubSupprimee"]);
  const bloque = c.body.elements.find((e: Row) => e.id === "surPubSupprimee");
  assert.equal(bloque.type, "commentaire"); assert.equal(bloque.peutRestaurer, false); assert.equal(bloque.peutEffacer, true);
  const retireChezAuteur = c.body.elements.find((e: Row) => e.id === "retireParPost");
  assert.equal(retireChezAuteur.supprimeParModeration, true); assert.equal(retireChezAuteur.peutRestaurer, false);
});

test("restauration : auteur seul, réapparition dans le fil, refus clair si retiré par la modération", async () => {
  const f = fixture();
  assert.ok(!(await f.fil()).includes("parAuteur"));
  assert.equal((await f.requete("POST", "/publication/parAuteur/restaurer", "other")).status, 403);
  assert.equal((await f.requete("POST", "/publication/parAuteur/restaurer", "publications")).status, 403);
  const ok = await f.requete("POST", "/publication/parAuteur/restaurer");
  assert.equal(ok.status, 200); assert.equal(f.ligne("publication", "parAuteur")!.deletedAt, null);
  assert.equal(f.ligne("publication", "parAuteur")!.deletedById, null);
  assert.ok((await f.fil()).includes("parAuteur"));
  assert.equal(f.emissions.at(-1)!.nom, "publication:restored");
  assert.equal((await f.requete("POST", "/publication/parAuteur/restaurer")).status, 404);

  const refus = await f.requete("POST", "/publication/parModo/restaurer");
  assert.equal(refus.status, 403); assert.match(refus.body.message, /modération/);
  assert.ok(f.ligne("publication", "parModo")!.deletedAt);
  assert.equal((await f.requete("DELETE", "/publication/parModo")).status, 403);
  assert.ok(f.ligne("publication", "parModo"));

  assert.equal((await f.requete("POST", "/publication/expiree/restaurer")).status, 404);
  assert.equal((await f.requete("POST", "/inconnu/parAuteur/restaurer")).status, 400);
});

test("restauration commentaire : réponse réaffichée avec sa racine ; conteneur supprimé et retrait par l'auteur du post refusés", async () => {
  const f = fixture();
  const avant = await requeteMemoire(f.publications, "GET", "/vivante/commentaires", { compte: "other", base: "/api/publications" });
  assert.equal(avant.body.total, 0);
  assert.equal((await f.requete("POST", "/commentaire/racine/restaurer", "commentateur")).status, 200);
  const apres = await requeteMemoire(f.publications, "GET", "/vivante/commentaires", { compte: "other", base: "/api/publications" });
  assert.equal(apres.body.total, 2); assert.equal(apres.body.commentaires[0].reponses[0].id, "reponse");

  const conteneur = await f.requete("POST", "/commentaires/surPubSupprimee/restaurer", "commentateur");
  assert.equal(conteneur.status, 409); assert.match(conteneur.body.message, /publication/);
  assert.equal((await f.requete("POST", "/commentaire/retireParPost/restaurer", "commentateur")).status, 403);
  assert.equal((await f.requete("POST", "/commentaire/retireParPost/restaurer", "owner")).status, 403);
});

test("effacement définitif immédiat : auteur seul, média retiré après effacement, cascade", async () => {
  const f = fixture();
  assert.equal((await f.requete("DELETE", "/publication/parAuteur", "other")).status, 403);
  assert.equal((await f.requete("DELETE", "/publication/vivante")).status, 404);
  const r = await f.requete("DELETE", "/publication/parAuteur");
  assert.equal(r.status, 200);
  assert.equal(f.ligne("publication", "parAuteur"), undefined);
  assert.equal(f.ligne("commentairePublication", "surPubSupprimee"), undefined);
  assert.deepEqual(f.medias, ["/uploads/publications/a.jpg"]);
  assert.equal((await f.requete("DELETE", "/commentaire/racine", "commentateur")).status, 200);
  assert.equal(f.ligne("commentairePublication", "reponse"), undefined, "la réponse suit sa racine (ON DELETE CASCADE)");
});

test("purge : efface physiquement ce qui a plus de 30 jours, garde le reste, idempotente", async () => {
  const f = fixture();
  const medias: string[] = [];
  const resultat = await purgerCorbeille(f.db as PrismaClient, { maintenant: MAINTENANT, retirerMedia: (url) => { if (url) medias.push(url); } });
  assert.deepEqual({ p: resultat.publications, c: resultat.commentaires }, { p: 1, c: 1 });
  assert.equal(f.ligne("publication", "expiree"), undefined); assert.equal(f.table("reactionPublication").length, 0);
  assert.equal(f.ligne("commentairePublication", "vieux"), undefined);
  assert.deepEqual(medias, ["/uploads/publications/old.jpg"]);
  for (const id of ["vivante", "parAuteur", "parModo", "autrui"]) assert.ok(f.ligne("publication", id), id);
  for (const id of ["racine", "reponse", "retireParPost", "surPubSupprimee"]) assert.ok(f.ligne("commentairePublication", id), id);
  const second = await purgerCorbeille(f.db as PrismaClient, { maintenant: MAINTENANT });
  assert.deepEqual([second.publications, second.commentaires], [0, 0]);
  // Par lots : plusieurs passes si nécessaire.
  const g = fixture();
  for (const p of g.table("publication")) p.deletedAt = ilYa(60);
  const parLots = await purgerCorbeille(g.db as PrismaClient, { maintenant: MAINTENANT, lot: 2 });
  assert.equal(parLots.publications, 5); assert.equal(g.table("publication").length, 0);
});

test("purge planifiée désactivable par CORBEILLE_PURGE_DISABLED=true", () => {
  const avant = process.env.CORBEILLE_PURGE_DISABLED;
  process.env.CORBEILLE_PURGE_DISABLED = "true";
  try { assert.equal(planifierPurgeCorbeille({} as PrismaClient), null); }
  finally { if (avant === undefined) delete process.env.CORBEILLE_PURGE_DISABLED; else process.env.CORBEILLE_PURGE_DISABLED = avant; }
});

test("notifications liées à un contenu en corbeille ou effacé masquées, les autres conservées", async () => {
  const f = fixture();
  const notifications = [
    { id: "a", payload: { publicationId: "vivante" } },
    { id: "b", payload: { publicationId: "parAuteur" } },
    { id: "c", payload: { publicationId: "vivante", commentaireId: "racine" } },
    { id: "d", payload: { publicationId: "absente" } },
    { id: "e", payload: { synergieId: "s1" } },
    { id: "f", payload: null },
  ];
  const visibles = await filtrerNotificationsContenuSupprime(f.db as PrismaClient, notifications);
  assert.deepEqual(visibles.map((n) => n.id), ["a", "e", "f"]);
});

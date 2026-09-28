/** Vrais handlers/auth ; DB et socket exclusivement en mémoire (aucune base, aucun réseau). */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { creerRouteurPublications } from "./publication.routes";
import { prisma } from "../lib/prisma";
import { signerTokenAcces } from "../lib/auth-token";

const secretAvant = process.env.JWT_SECRET;
process.env.JWT_SECRET = "fixture-publications-modifications-sans-base-reseau";
const findAvant = prisma.user.findUnique;
const comptes = new Map(["owner", "commentateur", "other", "admin", "publications"].map((id) => [`user-${id}`, {
  id: `user-${id}`, email: id === "admin" ? "ik736764@gmail.com" : `${id}@example.invalid`,
  role: id === "admin" ? "ADMIN" : "MEMBRE", emailVerifie: true, tokenVersion: 0, statut: "VALIDE",
  rolesDelegues: id === "publications" ? [{ code: "PUBLICATIONS" }] : [],
}]));
prisma.user.findUnique = (async ({ where }: any) => comptes.get(where.id) || null) as typeof prisma.user.findUnique;
after(() => { prisma.user.findUnique = findAvant; if (secretAvant === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretAvant; });

type Row = Record<string, any>;
function fixture() {
  const publications = new Map<string, Row>([
    ["pub", { id: "pub", auteurId: "owner", visible: true, photoUrl: null, lienUrl: null, contenu: "Texte initial", intention: "OFFRE", thematique: "Entraide", type: "TEXTE", createdAt: new Date(), updatedAt: new Date(), epingle: false }],
    ["photo", { id: "photo", auteurId: "owner", visible: true, photoUrl: "/uploads/publications/x.jpg", lienUrl: null, contenu: "Avec photo", intention: "OFFRE", thematique: "Entraide", type: "PHOTO", createdAt: new Date(), updatedAt: new Date(), epingle: false }],
  ]);
  const commentaires = new Map<string, Row>([
    ["comment", { id: "comment", publicationId: "pub", auteurId: "commentateur", contenu: "Racine", parentId: null, createdAt: new Date() }],
    ["hors", { id: "hors", publicationId: "photo", auteurId: "commentateur", contenu: "Autre fil", parentId: null, createdAt: new Date() }],
  ]);
  const emissions: Array<{ nom: string; payload: Row }> = [];
  const profil = (id: string) => ({ id, pays: "Mali", ville: "Bamako", titre: null, photo: null, user: { prenom: "Test", nom: id }, cerclesMembres: [] });
  const comment = (c: Row): Row => ({ ...c, auteur: profil(c.auteurId), publication: { auteurId: publications.get(c.publicationId)?.auteurId }, reponses: [] });
  const enrichir = (p: Row) => ({ ...p, auteur: profil(p.auteurId), reactions: [], commentaires: [], _count: { commentaires: 0 } });
  const db: any = {
    profil: { findUnique: async ({ where }: Row) => profil(where.userId.replace("user-", "")) },
    publication: {
      findFirst: async ({ where }: Row) => { const p = publications.get(where.id); return p && (where.visible === undefined || p.visible === where.visible) ? p : null; },
      update: async ({ where, data }: Row) => { const p = publications.get(where.id); Object.assign(p!, data); return enrichir(p!); },
    },
    commentairePublication: {
      findMany: async ({ where }: Row) => [...commentaires.values()].filter((c) => c.publicationId === where.publicationId).map((c) => ({ ...c, auteur: profil(c.auteurId) })),
      findFirst: async ({ where }: Row) => { const c = commentaires.get(where.id); return c && c.publicationId === where.publicationId ? comment(c) : null; },
      update: async ({ where, data }: Row) => { const c = commentaires.get(where.id); Object.assign(c!, data); return comment(c!); },
    },
  };
  const router = creerRouteurPublications({ db: db as PrismaClient, retirerMedia: () => undefined, obtenirSocket: (() => ({ emit: (nom: string, payload: Row) => { emissions.push({ nom, payload }); } })) as any });
  return { router, publications, commentaires, emissions };
}

async function requete(router: Router, method: string, path: string, compte: string, body: Row = {}) {
  const token = signerTokenAcces({ id: `user-${compte}`, tokenVersion: 0 });
  const req = { method, url: path, originalUrl: `/api/publications${path}`, headers: { authorization: `Bearer ${token}` }, query: {}, body, params: {} } as unknown as Request;
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json(corps: any) { resolve({ status, body: corps }); return this; } } as unknown as Response;
    (router as any).handle(req, res, (erreur?: unknown) => erreur ? reject(erreur) : resolve({ status: 404, body: {} }));
  });
}

test("modification publication : auteur seul, modérateurs refusés, texte uniquement", async () => {
  for (const compte of ["owner", "admin", "publications", "other"]) {
    const f = fixture(); const autorise = compte === "owner";
    const resultat = await requete(f.router, "PATCH", "/pub", compte, { contenu: "  Texte modifié  ", thematique: "Piratage", auteurId: compte });
    assert.equal(resultat.status, autorise ? 200 : 403);
    assert.equal(f.publications.get("pub")!.contenu, autorise ? "Texte modifié" : "Texte initial");
    assert.equal(f.publications.get("pub")!.thematique, "Entraide"); assert.equal(f.publications.get("pub")!.auteurId, "owner");
    assert.equal(f.emissions.length, autorise ? 1 : 0);
    if (autorise) { assert.equal(resultat.body.contenu, "Texte modifié"); assert.equal(resultat.body.peutModifier, true); assert.equal(resultat.body.peutSupprimer, true); }
  }
});

test("modification publication : validation, texte vide seulement si média, introuvable", async () => {
  const f = fixture();
  assert.equal((await requete(f.router, "PATCH", "/pub", "owner", { contenu: "   " })).status, 400);
  assert.equal((await requete(f.router, "PATCH", "/pub", "owner", { contenu: "x".repeat(1201) })).status, 400);
  assert.equal((await requete(f.router, "PATCH", "/pub", "owner", {})).status, 400);
  assert.equal(f.publications.get("pub")!.contenu, "Texte initial");
  assert.equal((await requete(f.router, "PATCH", "/photo", "owner", { contenu: "" })).status, 200);
  assert.equal(f.publications.get("photo")!.contenu, "");
  assert.equal((await requete(f.router, "PATCH", "/absente", "owner", { contenu: "ok" })).status, 404);
});

test("modification commentaire : auteur du commentaire seul, couple post/commentaire vérifié", async () => {
  for (const compte of ["commentateur", "owner", "admin", "publications", "other"]) {
    const f = fixture(); const autorise = compte === "commentateur";
    const resultat = await requete(f.router, "PATCH", "/pub/commentaires/comment", compte, { contenu: " Corrigé ", parentId: "hors" });
    assert.equal(resultat.status, autorise ? 200 : 403);
    assert.equal(f.commentaires.get("comment")!.contenu, autorise ? "Corrigé" : "Racine");
    assert.equal(f.commentaires.get("comment")!.parentId, null);
    if (autorise) { assert.equal(resultat.body.peutModifier, true); assert.equal(resultat.body.peutSupprimer, true); assert.equal(f.emissions[0].nom, "publication:commentUpdated"); }
  }
  const f = fixture();
  assert.equal((await requete(f.router, "PATCH", "/pub/commentaires/hors", "commentateur", { contenu: "ok" })).status, 404);
  assert.equal((await requete(f.router, "PATCH", "/pub/commentaires/comment", "commentateur", { contenu: "  " })).status, 400);
  assert.equal((await requete(f.router, "PATCH", "/pub/commentaires/comment", "commentateur", { contenu: "x".repeat(1001) })).status, 400);
  assert.equal(f.commentaires.get("comment")!.contenu, "Racine"); assert.equal(f.commentaires.get("hors")!.contenu, "Autre fil");
});

test("flags peutModifier exposés dans les listes : auteur uniquement, indépendants de peutSupprimer", async () => {
  for (const [compte, modifier, supprimer] of [["commentateur", true, true], ["owner", false, true], ["admin", false, true], ["other", false, false]] as const) {
    const f = fixture();
    const liste = await requete(f.router, "GET", "/pub/commentaires", compte);
    assert.equal(liste.status, 200);
    assert.equal(liste.body.commentaires[0].peutModifier, modifier); assert.equal(liste.body.commentaires[0].peutSupprimer, supprimer);
  }
});

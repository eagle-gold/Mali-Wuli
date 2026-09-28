/** Vrais handlers/auth/services ; DB, effets socket et nettoyage média exclusivement en mémoire. */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { creerRouteurPublications } from "./publication.routes";
import { prisma } from "../lib/prisma";
import { signerTokenAcces } from "../lib/auth-token";

const secretAvant = process.env.JWT_SECRET;
process.env.JWT_SECRET = "fixture-publications-suppressions-sans-base-reseau";
const findAvant = prisma.user.findUnique;
const comptes = new Map(["owner", "commentateur", "other", "admin", "publications", "offres", "pending", "suspended"].map((id) => [`user-${id}`, {
  id: `user-${id}`, email: id === "admin" ? "ik736764@gmail.com" : `${id}@example.invalid`,
  role: id === "admin" ? "ADMIN" : "MEMBRE", emailVerifie: true, tokenVersion: 0,
  statut: id === "pending" ? "EN_ATTENTE" : id === "suspended" ? "SUSPENDU" : "VALIDE",
  rolesDelegues: id === "publications" ? [{ code: "PUBLICATIONS" }] : id === "offres" ? [{ code: "OFFRES" }] : [],
}]));
prisma.user.findUnique = (async ({ where }: any) => comptes.get(where.id) || null) as typeof prisma.user.findUnique;
after(() => { prisma.user.findUnique = findAvant; if (secretAvant === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretAvant; });
type Row = Record<string, any>;
function fixture() {
  let publications = new Map<string, Row>([
    ["pub", { id: "pub", auteurId: "owner", visible: true, photoUrl: "/uploads/publications/fixture.jpg", contenu: "Publication test", intention: "OFFRE", thematique: "Entraide", type: "PHOTO", createdAt: new Date(), updatedAt: new Date(), epingle: false }],
    ["autre", { id: "autre", auteurId: "other", visible: true, photoUrl: null, contenu: "Autre publication", intention: "DEMANDE", thematique: "Entraide", type: "TEXTE", createdAt: new Date(), updatedAt: new Date(), epingle: false }],
  ]);
  let commentaires = new Map<string, Row>([
    ["comment", { id: "comment", publicationId: "pub", auteurId: "commentateur", contenu: "Racine", parentId: null, createdAt: new Date() }],
    ["reply", { id: "reply", publicationId: "pub", auteurId: "other", contenu: "Réponse", parentId: "comment", createdAt: new Date() }],
    ["hors", { id: "hors", publicationId: "autre", auteurId: "owner", contenu: "Autre fil", parentId: null, createdAt: new Date() }],
  ]);
  let reactions = [{ publicationId: "pub", auteurId: "other", type: "LIKE" }];
  let echec = false;
  let echecMedia = false;
  const medias: Array<string | null | undefined> = [];
  const emissions: Array<{ nom: string; payload: Row }> = [];
  const profil = (id: string) => ({ id, pays: "Mali", ville: "Bamako", titre: null, photo: null, user: { prenom: "Test", nom: id }, cerclesMembres: [] });
  const comment = (c: Row): Row => ({ ...c, auteur: profil(c.auteurId), publication: { auteurId: publications.get(c.publicationId)?.auteurId }, reponses: [...commentaires.values()].filter((r) => r.parentId === c.id).map((r) => ({ ...r, auteur: profil(r.auteurId) })) });
  const enrichir = (p: Row) => ({ ...p, auteur: profil(p.auteurId), reactions: reactions.filter((r) => r.publicationId === p.id), commentaires: [...commentaires.values()].filter((c) => c.publicationId === p.id && c.parentId === null).map(comment), _count: { commentaires: [...commentaires.values()].filter((c) => c.publicationId === p.id).length } });
  const retirerCommentaire = (id: string) => {
    for (const c of commentaires.values()) if (c.parentId === id) retirerCommentaire(c.id);
    commentaires.delete(id);
  };
  const db: any = {
    profil: { findUnique: async ({ where }: Row) => profil(where.userId.replace("user-", "")) },
    publication: {
      findUnique: async ({ where }: Row) => publications.get(where.id) || null,
      findFirst: async ({ where }: Row) => { const p = publications.get(where.id); return p && (where.visible === undefined || p.visible === where.visible) ? p : null; },
      findMany: async ({ where }: Row) => [...publications.values()].filter((p) => (!where.auteurId || p.auteurId === where.auteurId) && (where.visible === undefined || p.visible === where.visible)).map(enrichir),
      delete: async ({ where }: Row) => {
        if (echec) throw Error("FIXTURE_DELETE_FAILURE");
        const avant = publications.get(where.id); publications.delete(where.id);
        for (const c of commentaires.values()) if (c.publicationId === where.id) retirerCommentaire(c.id);
        reactions = reactions.filter((r) => r.publicationId !== where.id); return avant;
      },
    },
    commentairePublication: {
      findMany: async ({ where }: Row) => [...commentaires.values()].filter((c) => c.publicationId === where.publicationId).map(comment),
      findFirst: async ({ where }: Row) => { const c = commentaires.get(where.id); return c && c.publicationId === where.publicationId ? comment(c) : null; },
      delete: async ({ where }: Row) => { retirerCommentaire(where.id); if (echec) throw Error("FIXTURE_DELETE_FAILURE"); return {}; },
      count: async ({ where }: Row) => [...commentaires.values()].filter((c) => c.publicationId === where.publicationId).length,
    },
    $transaction: async (action: (tx: any) => Promise<unknown>, options: Row) => {
      assert.equal(options.isolationLevel, "Serializable");
      const copie = structuredClone({ publications, commentaires, reactions });
      try { return await action(db); } catch (erreur) { ({ publications, commentaires, reactions } = copie); throw erreur; }
    },
  };
  const router = creerRouteurPublications({ db: db as PrismaClient, retirerMedia: (url) => { if (echecMedia) throw Error("FIXTURE_MEDIA_FAILURE"); medias.push(url); }, obtenirSocket: (() => ({ emit: (nom: string, payload: Row) => { emissions.push({ nom, payload }); } })) as any });
  return { router, medias, emissions, get publications() { return publications; }, get commentaires() { return commentaires; }, get reactions() { return reactions; }, echec: (v: boolean) => { echec = v; }, echecMedia: () => { echecMedia = true; } };
}
async function requete(router: Router, method: string, path: string, compte = "owner", sansToken = false) {
  const token = signerTokenAcces({ id: `user-${compte}`, tokenVersion: 0 });
  const req = { method, url: path, originalUrl: `/api/publications${path}`, headers: sansToken ? {} : { authorization: `Bearer ${token}` }, query: {}, body: {}, params: {} } as unknown as Request;
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json(body: any) { resolve({ status, body }); return this; } } as unknown as Response;
    (router as any).handle(req, res, (erreur?: unknown) => erreur ? reject(erreur) : resolve({ status: 404, body: {} }));
  });
}

test("suppression publication : auteur/admin/PUBLICATIONS uniquement, flags identiques aux droits serveur", async () => {
  for (const compte of ["owner", "admin", "publications", "other", "offres"]) {
    const f = fixture(); const autorise = ["owner", "admin", "publications"].includes(compte);
    const liste = await requete(f.router, "GET", "/", compte);
    assert.equal(liste.status, 200); assert.equal(liste.body.publications.find((p: Row) => p.id === "pub").peutSupprimer, autorise);
    const autreProfil = await requete(f.router, "GET", "/profil/owner", compte);
    assert.equal(autreProfil.body.publications[0].peutSupprimer, autorise);
    assert.equal((await requete(f.router, "DELETE", "/pub", compte)).status, autorise ? 200 : 403);
    assert.equal(f.publications.has("pub"), !autorise);
    assert.equal(f.medias.length, autorise ? 1 : 0); assert.equal(f.emissions.length, autorise ? 2 : 0);
  }
});

test("suppression publication : anonyme/en attente/suspendu refusés, introuvable sans effet", async () => {
  const f = fixture();
  assert.equal((await requete(f.router, "DELETE", "/pub", "owner", true)).status, 401);
  assert.equal((await requete(f.router, "DELETE", "/pub", "pending")).status, 403);
  assert.equal((await requete(f.router, "DELETE", "/pub", "suspended")).status, 403);
  assert.equal((await requete(f.router, "DELETE", "/absente", "admin")).status, 404);
  assert.equal(f.medias.length + f.emissions.length, 0); assert.equal(f.publications.size, 2);
});

test("suppression publication atomique : cascade commentaires/réponses/réactions, médias après commit", async () => {
  const f = fixture(); f.echec(true);
  assert.equal((await requete(f.router, "DELETE", "/pub")).status, 500);
  assert.equal(f.publications.size, 2); assert.equal(f.commentaires.size, 3); assert.equal(f.reactions.length, 1);
  assert.equal(f.medias.length + f.emissions.length, 0);
  f.echec(false);
  assert.equal((await requete(f.router, "DELETE", "/pub")).status, 200);
  assert.deepEqual([...f.publications.keys()], ["autre"]); assert.deepEqual([...f.commentaires.keys()], ["hors"]);
  assert.equal(f.reactions.length, 0); assert.deepEqual(f.medias, ["/uploads/publications/fixture.jpg"]);
  assert.equal((await requete(f.router, "DELETE", "/pub")).status, 404);
});

test("commentaires : auteur, auteur du post, admin ou PUBLICATIONS ; autres domaines refusés", async () => {
  for (const compte of ["commentateur", "owner", "admin", "publications", "other", "offres"]) {
    const f = fixture(); const autorise = ["commentateur", "owner", "admin", "publications"].includes(compte);
    const liste = await requete(f.router, "GET", "/pub/commentaires", compte);
    assert.equal(liste.status, 200); assert.equal(liste.body.commentaires[0].peutSupprimer, autorise);
    const resultat = await requete(f.router, "DELETE", "/pub/commentaires/comment", compte);
    assert.equal(resultat.status, autorise ? 200 : 403);
    if (autorise) { assert.equal(resultat.body.nbCommentaires, 0); assert.deepEqual([...f.commentaires.keys()], ["hors"]); }
    else assert.equal(f.commentaires.size, 3);
    assert.equal(f.medias.length, 0);
  }
});

test("commentaires : couple post/commentaire vérifié, réponse propre seule, rollback et compteurs cohérents", async () => {
  const f = fixture();
  assert.equal((await requete(f.router, "DELETE", "/autre/commentaires/comment", "admin")).status, 404);
  const liste = await requete(f.router, "GET", "/pub/commentaires", "other");
  assert.equal(liste.body.commentaires[0].peutSupprimer, false); assert.equal(liste.body.commentaires[0].reponses[0].peutSupprimer, true);
  f.echec(true);
  assert.equal((await requete(f.router, "DELETE", "/pub/commentaires/reply", "other")).status, 500);
  assert.equal(f.commentaires.size, 3); assert.equal(f.emissions.length, 0);
  f.echec(false);
  const resultat = await requete(f.router, "DELETE", "/pub/commentaires/reply", "other");
  assert.equal(resultat.status, 200); assert.equal(resultat.body.nbCommentaires, 1);
  assert.ok(f.commentaires.has("comment")); assert.ok(f.commentaires.has("hors"));
  assert.equal(f.emissions.length, 2);
});


test("publication supprimée : échec du nettoyage média après commit ne donne pas un faux échec", async () => {
  const f = fixture(); f.echecMedia();
  assert.equal((await requete(f.router, "DELETE", "/pub")).status, 200);
  assert.equal(f.publications.has("pub"), false); assert.equal(f.emissions.length, 2);
});

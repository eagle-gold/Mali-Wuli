/** Vrais handlers/auth/services ; DB, effets socket et nettoyage média exclusivement en mémoire. */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { creerRouteurPublications } from "./publication.routes";
import { prisma } from "../lib/prisma";
import { compteMemoire, creerBaseMemoire, profilMemoire, requeteMemoire } from "./base-memoire.fixture";

const secretAvant = process.env.JWT_SECRET;
process.env.JWT_SECRET = "fixture-publications-suppressions-sans-base-reseau";
const findAvant = prisma.user.findUnique;
const comptes = new Map(["owner", "commentateur", "other", "admin", "publications", "offres", "pending", "suspended"].map((id) => [`user-${id}`, compteMemoire(id, {
  email: id === "admin" ? "ik736764@gmail.com" : `${id}@example.invalid`,
  role: id === "admin" ? "ADMIN" : "MEMBRE",
  statut: id === "pending" ? "SUSPENDU" : id === "suspended" ? "SUSPENDU" : "VALIDE",
  rolesDelegues: id === "publications" ? [{ code: "PUBLICATIONS" }] : id === "offres" ? [{ code: "OFFRES" }] : [],
})]));
prisma.user.findUnique = (async ({ where }: any) => comptes.get(where.id) || null) as typeof prisma.user.findUnique;
after(() => { prisma.user.findUnique = findAvant; if (secretAvant === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretAvant; });
type Row = Record<string, any>;

function fixture() {
  const base = creerBaseMemoire({
    profil: [...comptes.keys()].map((u) => profilMemoire(u.replace("user-", ""))),
    publication: [
      { id: "pub", auteurId: "owner", visible: true, photoUrl: "/uploads/publications/fixture.jpg", contenu: "Publication test", intention: "OFFRE", thematique: "Entraide", type: "PHOTO", createdAt: new Date("2026-09-01"), updatedAt: new Date(), epingle: false, deletedAt: null, deletedById: null },
      { id: "autre", auteurId: "other", visible: true, photoUrl: null, contenu: "Autre publication", intention: "DEMANDE", thematique: "Entraide", type: "TEXTE", createdAt: new Date("2026-09-02"), updatedAt: new Date(), epingle: false, deletedAt: null, deletedById: null },
    ],
    commentairePublication: [
      { id: "comment", publicationId: "pub", auteurId: "commentateur", contenu: "Racine", parentId: null, createdAt: new Date("2026-09-03"), deletedAt: null, deletedById: null },
      { id: "reply", publicationId: "pub", auteurId: "other", contenu: "Réponse", parentId: "comment", createdAt: new Date("2026-09-04"), deletedAt: null, deletedById: null },
      { id: "hors", publicationId: "autre", auteurId: "owner", contenu: "Autre fil", parentId: null, createdAt: new Date("2026-09-05"), deletedAt: null, deletedById: null },
    ],
    reactionPublication: [{ id: "r1", publicationId: "pub", auteurId: "other", type: "LIKE", createdAt: new Date() }],
    notification: [
      { id: "n-pub", destinataireId: "owner", lue: false, payload: { publicationId: "pub" } },
      { id: "n-com", destinataireId: "commentateur", lue: false, payload: { publicationId: "autre", commentaireId: "comment" } },
      { id: "n-autre", destinataireId: "other", lue: false, payload: { publicationId: "autre" } },
    ],
  });
  const medias: Array<string | null | undefined> = [];
  const emissions: Array<{ nom: string; payload: Row }> = [];
  let echecMedia = false;
  const router = creerRouteurPublications({
    db: base.db as PrismaClient,
    retirerMedia: (url) => { if (echecMedia) throw Error("FIXTURE_MEDIA_FAILURE"); medias.push(url); },
    obtenirSocket: (() => ({ emit: (nom: string, payload: Row) => { emissions.push({ nom, payload }); } })) as any,
  });
  const requete = (method: string, path: string, compte: string | null = "owner", body: Row = {}) =>
    requeteMemoire(router, method, path, { compte, body, base: "/api/publications" });
  return { ...base, router, requete, medias, emissions, echecMedia: () => { echecMedia = true; } };
}
const attendreEffets = () => new Promise((r) => setImmediate(r));

test("suppression publication : auteur/admin/PUBLICATIONS uniquement, flags identiques aux droits serveur", async () => {
  for (const compte of ["owner", "admin", "publications", "other", "offres"]) {
    const f = fixture(); const autorise = ["owner", "admin", "publications"].includes(compte);
    const liste = await f.requete("GET", "/", compte);
    assert.equal(liste.status, 200); assert.equal(liste.body.publications.find((p: Row) => p.id === "pub").peutSupprimer, autorise);
    const autreProfil = await f.requete("GET", "/profil/owner", compte);
    assert.equal(autreProfil.body.publications[0].peutSupprimer, autorise);
    const suppression = await f.requete("DELETE", "/pub", compte);
    assert.equal(suppression.status, autorise ? 200 : 403);
    // Suppression logique : la ligne reste, marquée avec l'identité de la personne qui a supprimé.
    const pub = f.ligne("publication", "pub")!;
    assert.equal(pub.deletedAt instanceof Date, autorise);
    assert.equal(pub.deletedById, autorise ? compte : null);
    if (autorise) assert.equal(suppression.body.corbeille, compte === "owner");
    assert.equal(f.medias.length, 0); assert.equal(f.emissions.length, autorise ? 2 : 0);
  }
});

test("suppression publication : anonyme/en attente/suspendu refusés, introuvable sans effet", async () => {
  const f = fixture();
  assert.equal((await f.requete("DELETE", "/pub", null)).status, 401);
  assert.equal((await f.requete("DELETE", "/pub", "pending")).status, 403);
  assert.equal((await f.requete("DELETE", "/pub", "suspended")).status, 403);
  assert.equal((await f.requete("DELETE", "/absente", "admin")).status, 404);
  assert.equal(f.medias.length + f.emissions.length, 0);
  assert.ok(f.table("publication").every((p) => p.deletedAt === null));
});

test("suppression logique atomique : rien d'effacé, exclusion du fil, du profil, des commentaires et des actions", async () => {
  const f = fixture(); f.echec("publication.update");
  assert.equal((await f.requete("DELETE", "/pub")).status, 500);
  assert.equal(f.ligne("publication", "pub")!.deletedAt, null); assert.equal(f.emissions.length, 0);
  f.echec("publication.update", false);
  assert.equal((await f.requete("DELETE", "/pub")).status, 200);
  // Rien n'est effacé physiquement : commentaires, réactions et média restent pour une restauration.
  assert.equal(f.table("publication").length, 2); assert.equal(f.table("commentairePublication").length, 3);
  assert.equal(f.table("reactionPublication").length, 1); assert.deepEqual(f.medias, []);
  for (const compte of ["owner", "other", "admin"]) {
    const fil = await f.requete("GET", "/", compte);
    assert.deepEqual(fil.body.publications.map((p: Row) => p.id), ["autre"]);
    assert.deepEqual((await f.requete("GET", "/profil/owner", compte)).body.publications, []);
  }
  assert.equal((await f.requete("GET", "/pub/commentaires", "other")).status, 404);
  assert.equal((await f.requete("POST", "/pub/commentaires", "other", { contenu: "Encore là ?" })).status, 404);
  assert.equal((await f.requete("POST", "/pub/reactions", "other")).status, 404);
  assert.equal((await f.requete("GET", "/pub/reactions", "other")).status, 404);
  assert.equal((await f.requete("PATCH", "/pub", "owner", { contenu: "Modif" })).status, 404);
  assert.equal((await f.requete("DELETE", "/pub")).status, 404);
  await attendreEffets();
  // Les notifications liées sont marquées lues ; les autres ne bougent pas.
  assert.equal(f.ligne("notification", "n-pub")!.lue, true);
  assert.equal(f.ligne("notification", "n-autre")!.lue, false);
});

test("commentaires : auteur, auteur du post, admin ou PUBLICATIONS ; autres domaines refusés", async () => {
  for (const compte of ["commentateur", "owner", "admin", "publications", "other", "offres"]) {
    const f = fixture(); const autorise = ["commentateur", "owner", "admin", "publications"].includes(compte);
    const liste = await f.requete("GET", "/pub/commentaires", compte);
    assert.equal(liste.status, 200); assert.equal(liste.body.commentaires[0].peutSupprimer, autorise);
    const resultat = await f.requete("DELETE", "/pub/commentaires/comment", compte);
    assert.equal(resultat.status, autorise ? 200 : 403);
    assert.equal(f.table("commentairePublication").length, 3);
    assert.equal(f.ligne("commentairePublication", "comment")!.deletedById, autorise ? compte : null);
    if (autorise) {
      // La réponse disparaît avec sa racine (masquée, pas effacée).
      assert.equal(resultat.body.nbCommentaires, 0);
      const apres = await f.requete("GET", "/pub/commentaires", compte);
      assert.deepEqual(apres.body.commentaires, []); assert.equal(apres.body.total, 0);
      const pub = (await f.requete("GET", "/", compte)).body.publications.find((p: Row) => p.id === "pub");
      assert.equal(pub.nbCommentaires, 0); assert.deepEqual(pub.commentaires, []);
      assert.equal((await f.requete("POST", "/pub/commentaires", compte, { contenu: "Réponse", parentId: "comment" })).status, 400);
      await attendreEffets();
      assert.equal(f.ligne("notification", "n-com")!.lue, true);
    }
    assert.equal(f.medias.length, 0);
  }
});

test("commentaires : couple post/commentaire vérifié, réponse propre seule, rollback et compteurs cohérents", async () => {
  const f = fixture();
  assert.equal((await f.requete("DELETE", "/autre/commentaires/comment", "admin")).status, 404);
  const liste = await f.requete("GET", "/pub/commentaires", "other");
  assert.equal(liste.body.commentaires[0].peutSupprimer, false); assert.equal(liste.body.commentaires[0].reponses[0].peutSupprimer, true);
  f.echec("commentairePublication.update");
  assert.equal((await f.requete("DELETE", "/pub/commentaires/reply", "other")).status, 500);
  assert.equal(f.ligne("commentairePublication", "reply")!.deletedAt, null); assert.equal(f.emissions.length, 0);
  f.echec("commentairePublication.update", false);
  const resultat = await f.requete("DELETE", "/pub/commentaires/reply", "other");
  assert.equal(resultat.status, 200); assert.equal(resultat.body.nbCommentaires, 1);
  assert.equal(f.ligne("commentairePublication", "comment")!.deletedAt, null);
  assert.equal((await f.requete("GET", "/pub/commentaires", "other")).body.commentaires[0].reponses.length, 0);
  assert.equal(f.emissions.length, 2);
  // Un commentaire déjà à la corbeille ne peut être ni supprimé à nouveau ni modifié.
  assert.equal((await f.requete("DELETE", "/pub/commentaires/reply", "other")).status, 404);
  assert.equal((await f.requete("PATCH", "/pub/commentaires/reply", "other", { contenu: "x" })).status, 404);
});

test("publication supprimée : aucun média retiré avant la purge, pas de faux échec", async () => {
  const f = fixture(); f.echecMedia();
  assert.equal((await f.requete("DELETE", "/pub")).status, 200);
  assert.ok(f.ligne("publication", "pub")!.deletedAt); assert.equal(f.emissions.length, 2); assert.equal(f.medias.length, 0);
});

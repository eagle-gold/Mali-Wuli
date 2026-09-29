/** Signalements : vrais handlers/auth/services ; base et notifications simulées en mémoire (aucune base, aucun réseau). */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { creerRouteurSignalements } from "./signalement.routes";
import { creerRouteurAdmin } from "./admin.routes";
import { prisma } from "../lib/prisma";
import { creerServiceSignalements, LIMITE_SIGNALEMENTS_24H } from "../services/signalement.service";
import type { NouvelleNotification } from "../services/notification.service";
import { compteMemoire, creerBaseMemoire, profilMemoire, requeteMemoire } from "./base-memoire.fixture";

const secretAvant = process.env.JWT_SECRET;
process.env.JWT_SECRET = "fixture-signalements-sans-base-reseau";
const findAvant = prisma.user.findUnique;
const comptes = new Map(["alice", "bob", "carol", "admin", "mod", "suspended", "pending", "offres"].map((id) => [`user-${id}`, compteMemoire(id, {
  email: id === "admin" ? "ik736764@gmail.com" : `${id}@example.invalid`,
  role: id === "admin" ? "ADMIN" : id === "mod" ? "MODERATEUR" : "MEMBRE",
  statut: id === "suspended" ? "SUSPENDU" : id === "pending" ? "EN_ATTENTE" : "VALIDE",
  rolesDelegues: id === "offres" ? [{ code: "OFFRES" }] : [],
})]));
prisma.user.findUnique = (async ({ where }: any) => comptes.get(where.id) || null) as typeof prisma.user.findUnique;
after(() => { prisma.user.findUnique = findAvant; if (secretAvant === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretAvant; });
type Row = Record<string, any>;
const MAINTENANT = new Date("2026-09-29T12:00:00Z");

function fixture() {
  const base = creerBaseMemoire({
    profil: [...comptes.keys()].map((u) => profilMemoire(u.replace("user-", ""))),
    publication: [
      { id: "pub", auteurId: "bob", visible: true, contenu: "Achetez mes followers ".repeat(20), thematique: "Entraide", deletedAt: null, deletedById: null, createdAt: MAINTENANT },
      { id: "pubSupprimee", auteurId: "bob", visible: true, contenu: "Retirée", thematique: "Entraide", deletedAt: MAINTENANT, deletedById: "bob", createdAt: MAINTENANT },
    ],
    commentairePublication: [{ id: "com", publicationId: "pub", auteurId: "bob", contenu: "Commentaire douteux", parentId: null, deletedAt: null, createdAt: MAINTENANT }],
    association: [{ id: "asso", nom: "Asso Test", ville: "Bamako", pays: "Mali" }],
    etablissement: [{ id: "etab", nom: "Lycée Test", ville: "Kayes" }],
    evenement: [{ id: "evt", titre: "Soirée", organisateurId: "bob", dateDebut: MAINTENANT }],
    offre: [{ id: "offre", titre: "Stage", entreprise: "ACME", publieurId: "bob" }],
    conversation: [{ id: "conv" }],
    conversationMembre: [{ conversationId: "conv", profilId: "alice" }, { conversationId: "conv", profilId: "bob" }],
    message: [{ id: "msg", conversationId: "conv", auteurId: "bob", contenu: "Message insultant" }],
    signalement: [],
  });
  const notifications: NouvelleNotification[] = [];
  const service = creerServiceSignalements(base.db as PrismaClient, { notifier: async (n) => { notifications.push(n); }, maintenant: () => MAINTENANT });
  const routeur = creerRouteurSignalements({ service });
  const admin = creerRouteurAdmin(undefined, { signalements: service });
  const signaler = (compte: string | null, body: Row) => requeteMemoire(routeur, "POST", "/", { compte, body, base: "/api/signalements" });
  const adminReq = (method: string, url: string, compte: string, body: Row = {}) => requeteMemoire(admin, method, url, { compte, body, base: "/api/admin" });
  return { ...base, signaler, adminReq, notifications };
}

test("création : chaque type de cible valide, motif et détails contrôlés, statut EN_ATTENTE", async () => {
  const f = fixture();
  const cibles: Array<[string, string]> = [["PUBLICATION", "pub"], ["COMMENTAIRE", "com"], ["PROFIL", "bob"], ["ASSOCIATION", "asso"], ["ETABLISSEMENT", "etab"], ["EVENEMENT", "evt"], ["OFFRE", "offre"], ["MESSAGE", "msg"]];
  for (const [cibleType, cibleId] of cibles) {
    const r = await f.signaler("alice", { cibleType, cibleId, motif: "SPAM", details: "  Voir capture  " });
    assert.equal(r.status, 201, `${cibleType} : ${JSON.stringify(r.body)}`);
    assert.equal(r.body.signalement.statut, "EN_ATTENTE"); assert.equal(r.body.signalement.details, "Voir capture");
  }
  const lignes = f.table("signalement");
  assert.equal(lignes.length, 8); assert.ok(lignes.every((s) => s.signaleurId === "alice" && s.traite === false));
  for (const body of [
    { cibleType: "PUBLICATION", cibleId: "pub", motif: "INCONNU" },
    { cibleType: "TOTO", cibleId: "pub", motif: "SPAM" },
    { cibleType: "PUBLICATION", cibleId: "pub", motif: "AUTRE", details: "x".repeat(1001) },
    { cibleType: "PUBLICATION", cibleId: "", motif: "SPAM" },
    { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM", signaleurId: "bob" },
  ]) assert.equal((await f.signaler("carol", body)).status, 400, JSON.stringify(body));
  assert.equal((await f.signaler("carol", { cibleType: "PUBLICATION", cibleId: "pub", motif: "AUTRE", details: "x".repeat(1000) })).status, 201);
});

test("création : cible absente/supprimée/inaccessible, auto-signalement, comptes bloqués", async () => {
  const f = fixture();
  assert.equal((await f.signaler("alice", { cibleType: "PUBLICATION", cibleId: "absente", motif: "SPAM" })).status, 404);
  assert.equal((await f.signaler("alice", { cibleType: "PUBLICATION", cibleId: "pubSupprimee", motif: "SPAM" })).status, 404);
  assert.equal((await f.signaler("alice", { cibleType: "PROFIL", cibleId: "absent", motif: "USURPATION" })).status, 404);
  // Un message privé n'est signalable que par un participant.
  assert.equal((await f.signaler("carol", { cibleType: "MESSAGE", cibleId: "msg", motif: "HARCELEMENT" })).status, 404);
  const soi = await f.signaler("alice", { cibleType: "PROFIL", cibleId: "alice", motif: "USURPATION" });
  assert.equal(soi.status, 400); assert.match(soi.body.message, /propre profil/);
  assert.equal((await f.signaler(null, { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM" })).status, 401);
  assert.equal((await f.signaler("suspended", { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM" })).status, 403);
  assert.equal((await f.signaler("pending", { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM" })).status, 403);
  assert.equal(f.table("signalement").length, 0);
});

test("doublon ouvert refusé (409), nouveau signalement possible après clôture ; limite de 20 par 24 h", async () => {
  const f = fixture();
  const cible = { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM" };
  const premier = await f.signaler("alice", cible);
  assert.equal(premier.status, 201);
  assert.equal((await f.signaler("alice", { ...cible, motif: "HARCELEMENT" })).status, 409);
  assert.equal((await f.signaler("bob", cible)).status, 201, "un autre membre peut signaler la même cible");
  f.ligne("signalement", premier.body.signalement.id)!.statut = "EN_COURS";
  assert.equal((await f.signaler("alice", cible)).status, 409);
  f.ligne("signalement", premier.body.signalement.id)!.statut = "REJETE";
  assert.equal((await f.signaler("alice", cible)).status, 201);

  const g = fixture();
  for (let i = 0; i < LIMITE_SIGNALEMENTS_24H; i++) g.table("signalement").push({ id: `s${i}`, signaleurId: "carol", cibleType: "OFFRE", cibleId: `o${i}`, statut: "REJETE", createdAt: new Date(MAINTENANT.getTime() - 60_000) });
  const limite = await g.signaler("carol", { cibleType: "OFFRE", cibleId: "offre", motif: "SPAM" });
  assert.equal(limite.status, 429);
  for (const s of g.table("signalement")) s.createdAt = new Date(MAINTENANT.getTime() - 25 * 60 * 60 * 1000);
  assert.equal((await g.signaler("carol", { cibleType: "OFFRE", cibleId: "offre", motif: "SPAM" })).status, 201);
});

test("admin : liste filtrée par statut/type avec aperçu de cible ; permission SIGNALEMENTS_CONSULTER", async () => {
  const f = fixture();
  await f.signaler("alice", { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM" });
  await f.signaler("alice", { cibleType: "MESSAGE", cibleId: "msg", motif: "HARCELEMENT", details: "Insultes" });
  await f.signaler("carol", { cibleType: "PROFIL", cibleId: "bob", motif: "USURPATION" });
  f.table("signalement").push({ id: "orphelin", signaleurId: "carol", cibleType: "OFFRE", cibleId: "effacee", motif: "SPAM", statut: "TRAITE", traite: true, createdAt: MAINTENANT });
  for (const compte of ["alice", "offres"]) assert.equal((await f.adminReq("GET", "/signalements", compte)).status, 403);
  const tout = await f.adminReq("GET", "/signalements", "mod");
  assert.equal(tout.status, 200); assert.equal(tout.body.signalements.length, 4);
  const pub = tout.body.signalements.find((s: Row) => s.cibleType === "PUBLICATION");
  assert.equal(pub.cible.existe, true); assert.equal(pub.cible.auteur, "Test bob"); assert.ok(pub.cible.apercu.length <= 160);
  assert.equal(pub.cible.href, "/dashboard?publication=pub"); assert.equal(pub.signaleur.user.nom, "alice");
  assert.equal(tout.body.signalements.find((s: Row) => s.cibleType === "MESSAGE").cible.apercu, "Message insultant");
  assert.equal(tout.body.signalements.find((s: Row) => s.id === "orphelin").cible.existe, false);
  const filtre = await f.adminReq("GET", "/signalements?statut=EN_ATTENTE&type=PROFIL", "admin");
  assert.deepEqual(filtre.body.signalements.map((s: Row) => s.cibleId), ["bob"]);
  assert.equal((await f.adminReq("GET", "/signalements?statut=TRAITE", "admin")).body.signalements.length, 1);
  assert.equal((await f.adminReq("GET", "/signalements?statut=FINI", "admin")).status, 400);
});

test("admin : traitement EN_COURS → TRAITE/REJETE, `traite` synchronisé, notification unique au signaleur", async () => {
  const f = fixture();
  const cree = await f.signaler("alice", { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM" });
  const id = cree.body.signalement.id;
  assert.equal((await f.adminReq("PUT", `/signalements/${id}`, "alice", { statut: "TRAITE" })).status, 403);
  assert.equal((await f.adminReq("PUT", `/signalements/${id}`, "mod", { statut: "FINI" })).status, 400);
  assert.equal((await f.adminReq("PUT", `/signalements/${id}`, "mod", { statut: "TRAITE", traite: false })).status, 400);
  assert.equal((await f.adminReq("PUT", "/signalements/absent", "mod", { statut: "TRAITE" })).status, 404);

  const enCours = await f.adminReq("PUT", `/signalements/${id}`, "mod", { statut: "EN_COURS", noteInterne: "Je regarde" });
  assert.equal(enCours.status, 200); assert.equal(enCours.body.signaleurNotifie, false);
  let ligne = f.ligne("signalement", id)!;
  assert.equal(ligne.statut, "EN_COURS"); assert.equal(ligne.traite, false); assert.equal(ligne.traiteParId, "user-mod"); assert.equal(ligne.traiteLe, null);
  assert.equal(f.notifications.length, 0);

  const traite = await f.adminReq("PUT", `/signalements/${id}`, "admin", { statut: "TRAITE", noteInterne: "Publication retirée" });
  assert.equal(traite.status, 200); assert.equal(traite.body.signaleurNotifie, true);
  ligne = f.ligne("signalement", id)!;
  assert.equal(ligne.traite, true); assert.equal(ligne.traiteParId, "user-admin"); assert.equal(ligne.traiteLe.getTime(), MAINTENANT.getTime());
  assert.equal(ligne.noteInterne, "Publication retirée");
  assert.equal(f.notifications.length, 1);
  const n = f.notifications[0];
  assert.equal(n.destinataireId, "alice"); assert.equal(n.type, "SIGNALEMENT"); assert.equal(n.acteurId, null);
  assert.match(n.titre, /traité/); assert.equal(JSON.stringify(n).includes("Publication retirée"), false, "la note interne n'est jamais envoyée au signaleur");

  // Même statut : pas de seconde notification. Changement vers REJETE : nouvelle notification.
  assert.equal((await f.adminReq("PUT", `/signalements/${id}`, "admin", { statut: "TRAITE" })).body.signaleurNotifie, false);
  assert.equal((await f.adminReq("PUT", `/signalements/${id}`, "admin", { statut: "REJETE" })).status, 200);
  assert.equal(f.notifications.length, 2); assert.match(f.notifications[1].titre, /pas été retenu/);
  // Réouverture : traite repasse à false.
  assert.equal((await f.adminReq("PUT", `/signalements/${id}`, "admin", { statut: "EN_ATTENTE" })).status, 200);
  ligne = f.ligne("signalement", id)!;
  assert.equal(ligne.traite, false); assert.equal(ligne.traiteParId, null); assert.equal(ligne.traiteLe, null);
});

test("admin : décisions concurrentes → une gagne, l'autre 409, une seule notification ; échec base sans effet", async () => {
  const f = fixture();
  const id = (await f.signaler("alice", { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM" })).body.signalement.id;
  const statuts = (await Promise.all([
    f.adminReq("PUT", `/signalements/${id}`, "mod", { statut: "TRAITE" }),
    f.adminReq("PUT", `/signalements/${id}`, "admin", { statut: "REJETE" }),
  ])).map((r) => r.status).sort();
  assert.deepEqual(statuts, [200, 409]); assert.equal(f.notifications.length, 1);

  const g = fixture();
  const autre = (await g.signaler("alice", { cibleType: "PUBLICATION", cibleId: "pub", motif: "SPAM" })).body.signalement.id;
  g.echec("signalement.update");
  assert.equal((await g.adminReq("PUT", `/signalements/${autre}`, "mod", { statut: "TRAITE" })).status, 500);
  assert.equal(g.notifications.length, 0); assert.equal(g.ligne("signalement", autre)!.statut, "EN_ATTENTE");
});

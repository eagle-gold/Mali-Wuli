import "dotenv/config";
import { strict as assert } from "node:assert";
import { AddressInfo } from "node:net";
import { httpServer } from "../index";
import { signerTokenAcces } from "../lib/auth-token";
import { prisma } from "../lib/prisma";

type Json = Record<string, any>;

async function main() {
  assert.equal(
    process.env.NODE_ENV,
    "test",
    "Lancez ce test avec NODE_ENV=test afin de ne pas démarrer deux serveurs.",
  );
  assert(process.env.JWT_SECRET, "JWT_SECRET est requis pour le smoke test.");

  const suffixe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emails = ["auteur", "aminata", "boubacar"].map(
    (nom) => `smoke-social-${nom}-${suffixe}@maliwuli.test`,
  );
  let publicationId: string | undefined;

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (httpServer.address() as AddressInfo).port;
  const api = `http://127.0.0.1:${port}/api`;

  const appel = async (token: string, chemin: string, init: RequestInit = {}) => {
    const reponse = await fetch(`${api}${chemin}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const json = (await reponse.json()) as Json;
    return { statut: reponse.status, json };
  };

  try {
    const utilisateurs = await Promise.all(
      emails.map((email, index) =>
        prisma.user.create({
          data: {
            email,
            prenom: ["Fatoumata", "Aminata", "Boubacar"][index],
            nom: "Smoke",
            statut: "VALIDE",
            emailVerifie: true,
            profil: {
              create: {
                ville: "Bamako",
                pays: "Mali",
                titre: index === 0 ? "Autrice test" : "Membre test",
                onboardingFini: true,
              },
            },
          },
          include: { profil: true },
        }),
      ),
    );
    const tokens = utilisateurs.map(signerTokenAcces);
    const profils = utilisateurs.map((utilisateur) => utilisateur.profil!);

    const creation = await appel(tokens[0], "/publications", {
      method: "POST",
      body: JSON.stringify({
        intention: "DEMANDE",
        thematique: "Test social",
        contenu: "Publication temporaire pour vérifier les commentaires et les soutiens.",
      }),
    });
    assert.equal(creation.statut, 201);
    publicationId = creation.json.id ?? creation.json.publication?.id;
    assert(publicationId, "La publication créée doit avoir un identifiant.");

    const commentaireA = await appel(tokens[1], `/publications/${publicationId}/commentaires`, {
      method: "POST",
      body: JSON.stringify({ contenu: "Commentaire visible d’Aminata." }),
    });
    assert.equal(commentaireA.statut, 201);

    const commentaireB = await appel(tokens[2], `/publications/${publicationId}/commentaires`, {
      method: "POST",
      body: JSON.stringify({ contenu: "Commentaire visible de Boubacar." }),
    });
    assert.equal(commentaireB.statut, 201);

    const reponse = await appel(tokens[0], `/publications/${publicationId}/commentaires`, {
      method: "POST",
      body: JSON.stringify({
        contenu: "Merci Aminata, votre retour est bien visible.",
        parentId: commentaireA.json.id,
      }),
    });
    assert.equal(reponse.statut, 201);

    const profondeurInterdite = await appel(
      tokens[2],
      `/publications/${publicationId}/commentaires`,
      {
        method: "POST",
        body: JSON.stringify({
          contenu: "Cette profondeur supplémentaire doit être refusée.",
          parentId: reponse.json.id,
        }),
      },
    );
    assert.equal(profondeurInterdite.statut, 400);

    for (const index of [1, 2]) {
      const soutien = await appel(tokens[index], `/publications/${publicationId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ type: "SOUTIEN" }),
      });
      assert.equal(soutien.statut, 200);
    }

    const commentaires = await appel(tokens[2], `/publications/${publicationId}/commentaires`);
    assert.equal(commentaires.statut, 200);
    assert.equal(commentaires.json.total, 3);
    assert.equal(commentaires.json.commentaires.length, 2);
    const racineA = commentaires.json.commentaires.find(
      (commentaire: Json) => commentaire.id === commentaireA.json.id,
    );
    assert.equal(racineA.auteur.id, profils[1].id);
    assert.equal(racineA.reponses.length, 1);
    assert.equal(racineA.reponses[0].auteur.id, profils[0].id);

    const soutiens = await appel(tokens[0], `/publications/${publicationId}/supporters?limite=1`);
    assert.equal(soutiens.statut, 200);
    assert.equal(soutiens.json.total, 2);
    assert.equal(soutiens.json.supporters.length, 1);
    assert.equal(soutiens.json.hasMore, true);
    assert(soutiens.json.nextCursor);

    const secondePage = await appel(
      tokens[0],
      `/publications/${publicationId}/supporters?limite=1&cursor=${encodeURIComponent(soutiens.json.nextCursor)}`,
    );
    assert.equal(secondePage.statut, 200);
    assert.equal(secondePage.json.supporters.length, 1);
    assert.notEqual(secondePage.json.supporters[0].id, soutiens.json.supporters[0].id);

    const fil = await appel(tokens[0], "/publications?limite=10");
    assert.equal(fil.statut, 200);
    const publication = fil.json.publications.find((element: Json) => element.id === publicationId);
    assert(publication, "La publication temporaire doit être visible dans le fil.");
    assert.equal(publication.nbCommentaires, 3);
    assert.equal(publication.decompteReactions.SOUTIEN, 2);

    console.log(
      "Smoke social OK : commentaires multi-auteurs, réponse, profondeur, soutiens, pagination et compteurs.",
    );
  } finally {
    if (publicationId) {
      await prisma.publication.deleteMany({ where: { id: publicationId } });
    }
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Smoke social en échec :", error);
  process.exitCode = 1;
});

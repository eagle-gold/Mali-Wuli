import "dotenv/config";
import { strict as assert } from "node:assert";
import { AddressInfo } from "node:net";
import { httpServer } from "../index";
import { signerTokenAcces } from "../lib/auth-token";
import { prisma } from "../lib/prisma";

type Json = Record<string, any>;

async function main() {
  assert(process.env.JWT_SECRET, "JWT_SECRET est requis pour le smoke test.");
  const suffixe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emails = ["mentor", "membre", "concurrent"].map(
    (nom) => `smoke-${nom}-${suffixe}@maliwuli.test`,
  );
  const idsProfils: string[] = [];
  let cercleId: string | undefined;
  let evenementId: string | undefined;
  let offreId: string | undefined;

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
    const json = await reponse.json() as Json;
    return { statut: reponse.status, json };
  };

  try {
    const utilisateurs = await Promise.all(
      emails.map((email, index) => prisma.user.create({
        data: {
          email,
          prenom: ["Aminata", "Boubacar", "Coumba"][index],
          nom: "Smoke",
          role: index === 0 ? "ADMIN" : "MEMBRE",
          statut: "VALIDE",
          emailVerifie: true,
          profil: {
            create: {
              ville: "Bamako",
              pays: "Mali",
              titre: index === 0 ? "Mentor test" : "Membre test",
              onboardingFini: true,
            },
          },
        },
        include: { profil: true },
      })),
    );
    for (const utilisateur of utilisateurs) idsProfils.push(utilisateur.profil!.id);
    const tokens = utilisateurs.map(signerTokenAcces);

    const disponibilites = [
      "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
    ].map((jour) => ({ jour, ouvert: true, plages: [{ debut: "09:00", fin: "17:00" }] }));
    const volontaire = await prisma.volontaire.create({
      data: {
        profilId: utilisateurs[0].profil!.id,
        specialite: "Orientation post-bac, Premier emploi",
        sujets: ["Orientation post-bac", "Premier emploi"],
        disponible: true,
        fuseau: "Africa/Bamako",
        dureeCreneau: 30,
        format: "Visio",
        disponibilites,
        maxRdvMois: 10,
        delaiMinResa: 0,
      },
    });
    const sansAuthentification = await fetch(`${api}/cercles`);
    assert.equal(sansAuthentification.status, 401);

    const creationCercle = await appel(tokens[0], "/cercles", {
      method: "POST",
      body: JSON.stringify({
        nom: `Cercle smoke ${suffixe}`,
        theme: "Tests",
        description: "Cercle éphémère utilisé pour tester l'API.",
      }),
    });
    assert.equal(creationCercle.statut, 201);
    const cercle = creationCercle.json.cercle;
    cercleId = cercle.id;

    const cercles = await appel(tokens[1], "/cercles?q=Cercle%20smoke");
    assert.equal(cercles.statut, 200);
    assert(cercles.json.cercles.some((item: Json) => item.id === cercle.id));
    const adhesion = await appel(tokens[1], `/cercles/${cercle.id}/adherer`, {
      method: "POST",
      body: JSON.stringify({ motivation: "Je souhaite aider ce cercle." }),
    });
    assert.equal(adhesion.statut, 201);
    assert.equal(adhesion.json.statutMembre, "ACCEPTE");
    const cercleInterdit = await appel(tokens[1], `/cercles/${cercle.id}`, {
      method: "PATCH",
      body: JSON.stringify({ theme: "Tentative interdite" }),
    });
    assert.equal(cercleInterdit.statut, 403);
    const cercleModifie = await appel(tokens[0], `/cercles/${cercle.id}`, {
      method: "PATCH",
      body: JSON.stringify({ theme: "Tests automatisés" }),
    });
    assert.equal(cercleModifie.statut, 200);

    const dateDebut = new Date(Date.now() + 7 * 86_400_000);
    const evenement = await appel(tokens[0], "/evenements", {
      method: "POST",
      body: JSON.stringify({
        titre: `Atelier smoke ${suffixe}`,
        description: "Un événement suffisamment détaillé pour le test d'intégration.",
        type: "PRESENTIEL",
        lieu: "Bamako",
        dateDebut: dateDebut.toISOString(),
        dateFin: new Date(dateDebut.getTime() + 3_600_000).toISOString(),
        capacite: 10,
      }),
    });
    assert.equal(evenement.statut, 201);
    evenementId = evenement.json.evenement.id;
    const participation = await appel(tokens[1], `/evenements/${evenementId}/participer`, {
      method: "POST",
    });
    assert.equal(participation.statut, 201);
    const evenementInterdit = await appel(tokens[1], `/evenements/${evenementId}`, {
      method: "PATCH",
      body: JSON.stringify({ titre: "Modification interdite" }),
    });
    assert.equal(evenementInterdit.statut, 403);

    const offre = await appel(tokens[0], "/offres", {
      method: "POST",
      body: JSON.stringify({
        titre: `Développeur smoke ${suffixe}`,
        entreprise: "Mali Wuli Test",
        type: "CDI",
        secteur: "Numérique",
        pays: "Mali",
        ville: "Bamako",
        teletravail: true,
        description: "Une offre temporaire destinée au test d'intégration automatisé.",
        lienCandidature: "https://example.org/candidature",
        dateExpiration: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      }),
    });
    assert.equal(offre.statut, 201);
    offreId = offre.json.offre.id;
    const offreInterdite = await appel(tokens[1], `/offres/${offreId}`, {
      method: "PATCH",
      body: JSON.stringify({ titre: "Modification interdite" }),
    });
    assert.equal(offreInterdite.statut, 403);

    const volontaires = await appel(tokens[1], "/volontaires?sujet=Orientation");
    assert.equal(volontaires.statut, 200);
    assert(volontaires.json.volontaires.some((item: Json) => item.id === volontaire.id));
    const creneaux = await appel(tokens[1], `/volontaires/${volontaire.id}/creneaux?jours=14`);
    assert.equal(creneaux.statut, 200);
    assert(creneaux.json.creneaux.length > 0, "Au moins un créneau doit être calculé.");
    const debut = creneaux.json.creneaux[0].debut;
    const reservation = await appel(tokens[1], `/volontaires/${volontaire.id}/reserver`, {
      method: "POST",
      body: JSON.stringify({ debut, motif: "Je souhaite préparer mon orientation professionnelle." }),
    });
    assert.equal(reservation.statut, 201);
    const conflit = await appel(tokens[2], `/volontaires/${volontaire.id}/reserver`, {
      method: "POST",
      body: JSON.stringify({ debut, motif: "Je souhaite réserver exactement le même créneau." }),
    });
    assert.equal(conflit.statut, 409);

    const rendezVousId = reservation.json.rendezVous.id;
    const confirmationInterdite = await appel(tokens[1], `/volontaires/agenda/${rendezVousId}/statut`, {
      method: "PATCH",
      body: JSON.stringify({ statut: "ACCEPTE" }),
    });
    assert.equal(confirmationInterdite.statut, 403);
    const confirmation = await appel(tokens[0], `/volontaires/agenda/${rendezVousId}/statut`, {
      method: "PATCH",
      body: JSON.stringify({ statut: "ACCEPTE" }),
    });
    assert.equal(confirmation.statut, 200);
    const agenda = await appel(tokens[1], "/volontaires/agenda/me?periode=tous");
    assert.equal(agenda.statut, 200);
    assert(agenda.json.rendezVous.some((item: Json) => item.id === rendezVousId));
    const annulation = await appel(tokens[1], `/volontaires/agenda/${rendezVousId}`, {
      method: "DELETE",
    });
    assert.equal(annulation.statut, 200);

    const notifications = await appel(tokens[0], "/notifications");
    assert.equal(notifications.statut, 200);
    assert(notifications.json.notifications.length > 0);
    console.log("Smoke communauté OK : auth, ownership, cercles, événements, offres, créneaux, anti-double-booking et notifications.");
  } finally {
    await prisma.rendezVous.deleteMany({ where: { demandeurId: { in: idsProfils } } });
    await prisma.notification.deleteMany({
      where: { OR: [{ destinataireId: { in: idsProfils } }, { acteurId: { in: idsProfils } }] },
    });
    if (evenementId) {
      await prisma.evenementParticipant.deleteMany({ where: { evenementId } });
      await prisma.evenement.deleteMany({ where: { id: evenementId } });
    }
    if (offreId) await prisma.offre.deleteMany({ where: { id: offreId } });
    if (cercleId) {
      await prisma.cercleMembre.deleteMany({ where: { cercleId } });
      await prisma.cercle.deleteMany({ where: { id: cercleId } });
    }
    await prisma.volontaire.deleteMany({ where: { profilId: { in: idsProfils } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Smoke communauté en échec :", error);
  process.exitCode = 1;
});

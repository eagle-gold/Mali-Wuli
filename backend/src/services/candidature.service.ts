import { titreSignificatif } from "../lib/titre-profil";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { NouvelleNotification } from "./notification.service";
import { ErreurOffre, OFFRE_PUBLIEE, PROFIL_OFFRE_SELECT, resumeProfilOffre, revisionOffre, type ActeurOffre, type DBOffre, type ProfilCandidat } from "./offre.service";

export type EmailCandidature = { destinataire: string; candidatNom: string; offreTitre: string; entreprise: string; urlProfil: string; pdf: Buffer; candidatureId: string; message?: string; replyTo?: string };
export type MessageCandidature = { id: string; conversationId: string; contenu: string; createdAt: Date; lu: boolean; estMoi: boolean; auteur: { id: string; initiales: string; photo: string | null } };
export type EffetsCandidature = {
  genererPdf: (profilId: string) => Promise<Buffer>;
  envoyerEmail: (d: EmailCandidature) => Promise<void>;
  notifier: (n: NouvelleNotification) => Promise<unknown>;
  nouveauMessage: (message: MessageCandidature, destinataireUserId: string, auteurUserId: string) => void;
};
const candidatureSelect = { id: true, statut: true, modeCandidature: true, conversationId: true, message: true, tentativeId: true } as const;
type Candidature = Prisma.CandidatureOffreGetPayload<{ select: typeof candidatureSelect }>;
const profilURL = (profilId: string) => `https://mali-wuli.com/membres/${encodeURIComponent(profilId)}`;
const ponctuel = (s: string | null | undefined, max: number) => (s || "").trim().slice(0, max);
export function contenuCandidature(o: { titre: string; entreprise: string }, p: ProfilCandidat, message?: string | null) {
  const nom = resumeProfilOffre(p).nomComplet;
  return [
    `Candidature à « ${ponctuel(o.titre,150)} » — ${ponctuel(o.entreprise,150)}`,
    `${ponctuel(nom,190)}${titreSignificatif(p.titre) ? ` · ${ponctuel(titreSignificatif(p.titre)!,190)}` : ""}`,
    [p.ville, p.pays].filter(Boolean).join(", ").slice(0, 200),
    p.bio ? ponctuel(p.bio, 500) : "", message ? `Message du candidat :\n${ponctuel(message,2000)}` : "",
    `Consulter mon profil : ${profilURL(p.id)}`,
  ].filter(Boolean).join("\n\n");
}
function reponse(c: Candidature, nouvelle = false) {
  return { httpStatus: c.statut === "ENVOYEE" ? (nouvelle ? 201 : 200) : c.statut === "EN_COURS" ? 202 : 502,
    payload: { modeCandidature: c.modeCandidature, statutCandidature: c.statut, aPostule: c.statut === "ENVOYEE", conversationId: c.conversationId,
      message: c.statut === "ENVOYEE" ? "Votre candidature a été transmise." : c.statut === "EN_COURS" ? "La transmission de votre candidature est en cours. Actualisez son état avant de réessayer." : "Votre candidature n’a pas pu être transmise. Vous pouvez réessayer après vérification." } };
}

// Après DATA, une rupture de transport peut masquer l’acceptation du serveur.
// Une réponse SMTP explicite de refus, ou une erreur avant DATA, permet seule une reprise.
export function envoiSmtpIncertain(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;
  const e = error as { command?: string; code?: string; responseCode?: number };
  if (typeof e.responseCode === "number" && e.responseCode >= 400 && e.responseCode <= 599) return false;
  if (["EAUTH", "EENVELOPE", "EDNS", "ECONNECTION", "MAIL_DISABLED"].includes(e.code || "") && e.command !== "DATA") return false;
  if (/^(?:CONN|CONNECT|EHLO|HELO|STARTTLS|AUTH|MAIL FROM|RCPT TO)$/i.test(e.command || "")) return false;
  return true;
}

export function creerServiceCandidatures(db: PrismaClient, effets: EffetsCandidature, horloge = () => new Date()) {
  async function eligible(id: string, a: ActeurOffre, revision: string, base: DBOffre = db) {
    const profil = await base.profil.findFirst({ where: { id: a.profilId, userId: a.userId, onboardingFini: true, user: { statut: "VALIDE", emailVerifie: true } }, select: PROFIL_OFFRE_SELECT });
    if (!profil) throw new ErreurOffre(403, "Un profil validé et complété est nécessaire pour candidater.");
    const offre = await base.offre.findFirst({ where: { id, ...OFFRE_PUBLIEE }, include: { publieur: { select: PROFIL_OFFRE_SELECT } } });
    if (!offre) throw new ErreurOffre(404, "Offre publiée introuvable.");
    if (revisionOffre(offre) !== revision) throw new ErreurOffre(409, "Cette offre a changé. Actualisez-la et vérifiez le destinataire avant de confirmer votre candidature.");
    if (offre.dateExpiration && offre.dateExpiration <= horloge()) throw new ErreurOffre(409, "Cette offre a expiré.");
    if (offre.publieurId === a.profilId) throw new ErreurOffre(403, "Vous ne pouvez pas candidater à votre propre offre.");
    if (offre.publieur.user.statut !== "VALIDE" || !offre.publieur.onboardingFini) throw new ErreurOffre(409, "Le déposant de cette offre n’est plus disponible.");
    return { offre, profil };
  }
  async function apercuPdf(id: string, a: ActeurOffre, revision: string) {
    await eligible(id, a, revision);
    return effets.genererPdf(a.profilId);
  }
  async function effetsApresCommit(action: () => Promise<unknown> | void) { try { await action(); } catch { console.error("[candidatures] Notification différée."); } }
  async function reserver(id: string, a: ActeurOffre, options: { revision: string; message?: string; reessayer?: boolean }) {
    // Deadlocks/écritures concurrentes MySQL peuvent faire échouer une transaction Serializable.
    // Toute reprise recommence AVANT les effets externes ; unique(offreId,profilId) reste l’arbitre.
    for (let essai = 0; ; essai++) {
      try {
        return await db.$transaction(async (tx) => {
          const { offre, profil } = await eligible(id, a, options.revision, tx);
          if (offre.modeCandidature === "LIEN_EXTERNE") {
            if (!offre.lienCandidature || !/^https?:\/\//i.test(offre.lienCandidature)) throw new ErreurOffre(409, "Le lien de candidature n’est pas disponible.");
            return { kind: "lien" as const, offre };
          }
          const where = { offreId_profilId: { offreId: id, profilId: a.profilId } };
          let candidature = await tx.candidatureOffre.findUnique({ where, select: candidatureSelect });
          if (candidature && (candidature.statut !== "ECHEC" || !options.reessayer)) return { kind: "existante" as const, candidature };
          const tentativeId = randomUUID();
          const message = options.message === undefined ? candidature?.message || null : options.message || null;
          if (candidature) {
            const claim = await tx.candidatureOffre.updateMany({ where: { id: candidature.id, statut: "ECHEC" }, data: { statut: "EN_COURS", modeCandidature: offre.modeCandidature, tentativeId, tentatives: { increment: 1 }, erreurCode: null, message } });
            if (claim.count !== 1) {
              const courante = await tx.candidatureOffre.findUniqueOrThrow({ where, select: candidatureSelect });
              return { kind: "existante" as const, candidature: courante };
            }
            candidature = { ...candidature, statut: "EN_COURS", modeCandidature: offre.modeCandidature, tentativeId, message };
          } else {
            candidature = await tx.candidatureOffre.create({ data: { offreId: id, profilId: a.profilId, modeCandidature: offre.modeCandidature, statut: "EN_COURS", tentativeId, message }, select: candidatureSelect });
          }
          if (offre.modeCandidature === "EMAIL") return { kind: "email" as const, candidature, offre, profil };
          const conversation = await tx.conversation.upsert({ where: { cleDirecte: [a.profilId, offre.publieurId].sort().join(":") },
            create: { cleDirecte: [a.profilId, offre.publieurId].sort().join(":"), estGroupe: false, participants: { create: [{ profilId: a.profilId }, { profilId: offre.publieurId }] } }, update: {}, select: { id: true } });
          const cree = await tx.message.create({ data: { conversationId: conversation.id, auteurId: a.profilId, contenu: contenuCandidature(offre, profil, message) } });
          await tx.conversation.update({ where: { id: conversation.id }, data: { dernierMessageLe: cree.createdAt } });
          const envoyee = await tx.candidatureOffre.update({ where: { id: candidature.id }, data: { statut: "ENVOYEE", conversationId: conversation.id, messageId: cree.id, envoyeeAt: horloge() }, select: candidatureSelect });
          return { kind: "message" as const, candidature: envoyee, offre, profil, message: cree };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
        if (essai < 2 && (code === "P2034" || code === "P2002")) continue;
        throw error;
      }
    }
  }
  async function postuler(id: string, a: ActeurOffre, options: { revision: string; message?: string; reessayer?: boolean }) {
    const reservation = await reserver(id, a, options);
    if (reservation.kind === "lien") return { httpStatus: 200, payload: { modeCandidature: "LIEN_EXTERNE", statutCandidature: null, aPostule: false, conversationId: null, lienExterne: reservation.offre.lienCandidature, message: "Poursuivez votre candidature sur le site de l’employeur." } };
    if (reservation.kind === "existante") return reponse(reservation.candidature);
    if (reservation.kind === "message") {
      const { offre, profil, message } = reservation;
      await effetsApresCommit(() => effets.notifier({ destinataireId: offre.publieurId, acteurId: a.profilId, type: "NOUVEAU_MESSAGE", titre: `${resumeProfilOffre(profil).nomComplet} a candidaté à votre offre`, detail: `${offre.titre} · ${offre.entreprise}`, href: `/messages?conversation=${encodeURIComponent(message.conversationId)}`, payload: { offreId: id, conversationId: message.conversationId, messageId: message.id } }));
      await effetsApresCommit(() => effets.nouveauMessage({ id: message.id, conversationId: message.conversationId, contenu: message.contenu, createdAt: message.createdAt, lu: false, estMoi: false,
        auteur: { id: profil.id, initiales: `${profil.user.prenom?.[0] || ""}${profil.user.nom?.[0] || ""}`.toUpperCase(), photo: profil.photo } }, offre.publieur.userId, a.userId));
      return reponse(reservation.candidature, true);
    }
    const { candidature, offre, profil } = reservation;
    let smtpAccepte = false;
    let erreurCode = "PDF_GENERATION_FAILED";
    try {
      const pdf = await effets.genererPdf(a.profilId);
      if (!Buffer.isBuffer(pdf) || pdf.length === 0) throw new Error("PDF_INDISPONIBLE");
      erreurCode = "MAIL_TRANSPORT_FAILED";
      await effets.envoyerEmail({ destinataire: offre.emailContact || offre.publieur.user.email, candidatNom: resumeProfilOffre(profil).nomComplet,
        offreTitre: offre.titre, entreprise: offre.entreprise, urlProfil: profilURL(profil.id), pdf, candidatureId: candidature.id,
        message: candidature.message || undefined, replyTo: profil.user.email });
      smtpAccepte = true;
      const result = await db.candidatureOffre.updateMany({ where: { id: candidature.id, tentativeId: candidature.tentativeId, statut: "EN_COURS" }, data: { statut: "ENVOYEE", envoyeeAt: horloge(), erreurCode: null } });
      if (result.count !== 1) throw new Error("EMAIL_STATUS_NOT_CONFIRMED");
      return reponse({ ...candidature, statut: "ENVOYEE" }, true);
    } catch (error) {
      // Après acceptation SMTP, un problème DB ne permet pas de déclarer l'envoi échoué
      // ni de l'envoyer à nouveau : EN_COURS impose une vérification sans nouvel envoi.
      if (smtpAccepte || (erreurCode === "MAIL_TRANSPORT_FAILED" && envoiSmtpIncertain(error))) { console.error("[candidatures] État de transmission incertain, confirmation à vérifier."); return reponse(candidature); }
      try {
        const result = await db.candidatureOffre.updateMany({ where: { id: candidature.id, tentativeId: candidature.tentativeId, statut: "EN_COURS" }, data: { statut: "ECHEC", erreurCode } });
        if (result.count === 1) return reponse({ ...candidature, statut: "ECHEC" });
      } catch { /* Ne pas annoncer un succès ni autoriser un nouvel envoi non réservé. */ }
      return reponse(candidature);
    }
  }
  return { postuler, apercuPdf };
}
export type ServiceCandidatures = ReturnType<typeof creerServiceCandidatures>;

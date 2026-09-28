import nodemailer from "nodemailer";

type MessageEmail = {
  destinataire: string;
  sujet: string;
  texte: string;
  html: string;
  expediteur?: string;
  repondreA?: string;
  piecesJointes?: { filename:string; content:Buffer; contentType:string }[];
  messageId?: string;
};

const adresseExpediteur = process.env.MAIL_FROM || "Mali Wuli <no-reply@maliwuli.com>";

function creerTransporteur() {
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" }
        : undefined,
    });
  }

  // Hostinger expose sendmail dans l'environnement de l'application Node.
  // Le chemin peut être remplacé sans changer le code si l'hébergeur évolue.
  return nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path: process.env.SENDMAIL_PATH || "/usr/sbin/sendmail",
  });
}

export async function envoyerEmail(message: MessageEmail) {
  // Permet aux tests d'intégration d'exercer tout le parcours sans envoyer de
  // vrai message. Cette option reste désactivée par défaut en exploitation.
  if (process.env.MAIL_DISABLED === "true") return;

  const transporteur = creerTransporteur();
  await transporteur.sendMail({
    from: message.expediteur || adresseExpediteur,
    replyTo: message.repondreA,
    attachments: message.piecesJointes,
    messageId: message.messageId,
    disableFileAccess: true,
    disableUrlAccess: true,
    to: message.destinataire,
    subject: message.sujet,
    text: message.texte,
    html: message.html,
  });
}

export async function envoyerCodeVerification(destinataire: string, code: string) {
  const codeSecurise = code.replace(/[^0-9]/g, "");
  await envoyerEmail({
    destinataire,
    sujet: "Votre code de vérification Mali Wuli",
    texte: `Votre code Mali Wuli est ${codeSecurise}. Il expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2e261f">
        <h1 style="color:#0d6738">Mali Wuli</h1>
        <p>Voici votre code de vérification :</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${codeSecurise}</p>
        <p>Ce code expire dans 15 minutes.</p>
        <p style="color:#776b5e">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
      </div>
    `,
  });
}

export async function envoyerCodeReinitialisation(destinataire: string, code: string) {
  const codeSecurise = code.replace(/[^0-9]/g, "");
  await envoyerEmail({
    destinataire,
    sujet: "Réinitialisation de votre mot de passe Mali Wuli",
    texte: `Votre code de réinitialisation Mali Wuli est ${codeSecurise}. Il expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2e261f">
        <h1 style="color:#0d6738">Mali Wuli</h1>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${codeSecurise}</p>
        <p>Ce code expire dans 15 minutes et ne peut être utilisé qu'une seule fois.</p>
        <p style="color:#776b5e">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail. Votre mot de passe reste inchangé.</p>
      </div>
    `,
  });
}

export async function envoyerCodeConnexion(destinataire: string, code: string) {
  const codeSecurise = code.replace(/[^0-9]/g, "");
  await envoyerEmail({
    destinataire,
    sujet: "Votre code de connexion Mali Wuli",
    texte: `Votre code de connexion Mali Wuli est ${codeSecurise}. Il expire dans 10 minutes et ne peut être utilisé qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2e261f">
        <h1 style="color:#0d6738">Mali Wuli</h1>
        <p>Voici votre code de connexion :</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${codeSecurise}</p>
        <p>Ce code expire dans 10 minutes et ne peut être utilisé qu'une seule fois.</p>
        <p style="color:#776b5e">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
      </div>
    `,
  });
}

export async function envoyerCandidatureEmail(params:{destinataire:string;candidatNom:string;offreTitre:string;entreprise:string;urlProfil:string;pdf:Buffer;candidatureId:string;message?:string;replyTo?:string}) {
  if(process.env.MAIL_DISABLED === "true") throw Object.assign(new Error("L’envoi des candidatures par e-mail est désactivé."), { code: "MAIL_DISABLED" });
  const echapper=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
  const nomFichier=params.candidatNom.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]+/g,'-').slice(0,90)||'candidat';
  await envoyerEmail({
    destinataire:params.destinataire,
    expediteur:"Mali Wuli <contact@mali-wuli.com>",
    repondreA:params.replyTo,
    messageId:`<candidature-${params.candidatureId.replace(/[^a-zA-Z0-9-]/g,'')}@mali-wuli.com>`,
    sujet:`Candidature - ${params.offreTitre.replace(/[\r\n]/g,' ')} - ${params.candidatNom.replace(/[\r\n]/g,' ')}`,
    texte:`${params.candidatNom} postule à votre offre « ${params.offreTitre} » chez ${params.entreprise}.\n\n${params.message ? params.message+'\n\n':''}Son profil est joint en PDF.\nProfil Mali Wuli : ${params.urlProfil}\n\nVous pouvez répondre à cet e-mail pour contacter la personne.`,
    html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#2e261f"><h1 style="color:#0d6738">Nouvelle candidature</h1><p><strong>${echapper(params.candidatNom)}</strong> postule à votre offre <strong>${echapper(params.offreTitre)}</strong> chez ${echapper(params.entreprise)}.</p>${params.message?`<p style="white-space:pre-wrap">${echapper(params.message)}</p>`:''}<p>Son profil est joint en PDF.</p><p><a href="${echapper(params.urlProfil)}">Consulter son profil Mali Wuli</a></p><p>Vous pouvez répondre à cet e-mail pour contacter la personne.</p></div>`,
    piecesJointes:[{filename:`Profil-${nomFichier}.pdf`,content:params.pdf,contentType:'application/pdf'}],
  });
}

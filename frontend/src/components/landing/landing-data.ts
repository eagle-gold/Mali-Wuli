/**
 * Contenu de la page d'accueil publique.
 * Règle : ne décrire que des fonctionnalités réellement disponibles et
 * n'afficher aucun chiffre, membre ou contenu inventé.
 */

import type { Branch } from "./tree-geometry";

export interface BrancheArbre extends Branch {
  readonly name: string;
}

/** Branches du baobab illustratif : quelques pays de la diaspora (sans effectifs). */
export const BRANCHES: readonly BrancheArbre[] = [
  { name: "Maroc", sx: 530, sy: 430, cx: 420, cy: 470, ex: 185, ey: 540 },
  { name: "France", sx: 548, sy: 420, cx: 400, cy: 340, ex: 215, ey: 260 },
  { name: "Canada", sx: 568, sy: 418, cx: 470, cy: 290, ex: 330, ey: 140 },
  { name: "États-Unis", sx: 588, sy: 414, cx: 560, cy: 250, ex: 500, ey: 55 },
  { name: "Sénégal", sx: 612, sy: 414, cx: 640, cy: 250, ex: 700, ey: 55 },
  { name: "Côte d'Ivoire", sx: 632, sy: 418, cx: 730, cy: 290, ex: 870, ey: 140 },
  { name: "Belgique", sx: 652, sy: 420, cx: 800, cy: 340, ex: 985, ey: 260 },
  { name: "Espagne", sx: 670, sy: 430, cx: 780, cy: 470, ex: 1015, ey: 540 },
];

export type IconeFonctionnalite = "annuaire" | "fil" | "offres" | "mentorat" | "evenements" | "associations" | "etablissements" | "messages";

export interface Fonctionnalite {
  readonly icone: IconeFonctionnalite;
  readonly titre: string;
  readonly description: string;
}

/** Fonctionnalités disponibles dans l'espace membre (vérifiées dans le code). */
export const FONCTIONNALITES: readonly Fonctionnalite[] = [
  { icone: "fil", titre: "Je cherche, je propose", description: "Publiez ce dont vous avez besoin ou ce que vous pouvez offrir : un conseil, un contact, un coup de main. Le réseau répond." },
  { icone: "mentorat", titre: "Mentorat", description: "Proposez quelques heures pour accompagner un étudiant ou un jeune professionnel, ou trouvez la personne qui a déjà fait le chemin." },
  { icone: "offres", titre: "Offres d'emploi", description: "Emplois, stages et missions publiés par les membres. Candidatez directement depuis votre profil." },
  { icone: "annuaire", titre: "Annuaire des membres", description: "Retrouvez des talents par domaine, pays, ville ou établissement, au Mali comme dans la diaspora." },
  { icone: "evenements", titre: "Événements", description: "Forums, rencontres et webinaires proposés par la communauté, en présentiel ou en ligne." },
  { icone: "associations", titre: "Associations", description: "Rattachez votre profil aux associations dont vous êtes membre et découvrez celles du réseau." },
  { icone: "etablissements", titre: "Écoles et universités", description: "Un catalogue d'établissements au Mali et à l'étranger, avec les formations et les avis des membres." },
  { icone: "messages", titre: "Messagerie", description: "Échangez en privé avec les membres, en temps réel." },
];

export interface Etape {
  readonly numero: string;
  readonly titre: string;
  readonly description: string;
}

export const ETAPES: readonly Etape[] = [
  { numero: "01", titre: "Créez votre profil", description: "Votre parcours, vos études, votre pays et ce que vous pouvez apporter. Gratuit, en quelques minutes." },
  { numero: "02", titre: "Dites ce que vous cherchez et offrez", description: "Un mentor, un stage, un contact à Bamako, ou au contraire votre expérience à partager." },
  { numero: "03", titre: "Entrez en relation", description: "Mali Wuli vous suggère des membres au parcours proche. Vous choisissez qui contacter." },
];

export interface QuestionFrequente {
  readonly question: string;
  readonly reponse: string;
}

export const FAQ: readonly QuestionFrequente[] = [
  { question: "C'est gratuit ?", reponse: "Oui. L'inscription et l'utilisation de Mali Wuli sont gratuites, sans cotisation." },
  { question: "Qui peut s'inscrire ?", reponse: "Tout Malien ou ami du Mali, au pays ou à l'étranger : étudiants, professionnels, entrepreneurs, membres de la diaspora revenus au Mali." },
  { question: "Faut-il vivre à l'étranger ?", reponse: "Non. Le tronc de l'arbre, c'est le Mali : celles et ceux qui vivent au pays sont au cœur du réseau." },
  { question: "Comment fonctionne la mise en relation ?", reponse: "Vous indiquez votre parcours, ce que vous offrez et ce que vous cherchez. Mali Wuli vous suggère des membres compatibles ; vous restez libre de les contacter." },
  { question: "Qui voit mon profil ?", reponse: "Seuls les membres connectés. Votre e-mail et votre téléphone restent masqués tant que vous ne décidez pas de les afficher." },
];

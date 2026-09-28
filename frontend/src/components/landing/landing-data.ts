/**
 * Contenu illustratif repris de la maquette « Mali Wuli - Landing Arbre ».
 * Ces profils, effectifs, opportunités et événements ne sont pas des données du réseau.
 */

export interface LandingCountry {
  readonly name: string;
  readonly count: number;
  readonly sx: number;
  readonly sy: number;
  readonly cx: number;
  readonly cy: number;
  readonly ex: number;
  readonly ey: number;
}

export interface LandingPerson {
  readonly name: string;
  readonly job: string;
  readonly city: string;
  readonly offer: string;
  readonly country: string;
}

export interface LandingStep {
  readonly number: string;
  readonly title: string;
  readonly description: string;
}

export interface LandingOpportunity {
  readonly name: string;
  readonly role: string;
  readonly time: string;
  readonly initials: string;
  readonly color: string;
  readonly backgroundColor: string;
  readonly text: string;
  readonly tag: string;
  readonly title: string;
  readonly meta: string;
  readonly likes: number;
  readonly comments: number;
  readonly cta: string;
}

export interface LandingEvent {
  readonly month: string;
  readonly day: string;
  readonly title: string;
  readonly description: string;
  readonly location: string;
}

export interface LandingFaqItem {
  readonly question: string;
  readonly answer: string;
}

/** L'ordre des branches correspond aux groupes de trois personnes de PEOPLE. */
export const COUNTRIES: readonly LandingCountry[] = [
  { name: "Maroc", count: 24, sx: 530, sy: 430, cx: 420, cy: 470, ex: 185, ey: 540 },
  { name: "France", count: 138, sx: 548, sy: 420, cx: 400, cy: 340, ex: 215, ey: 260 },
  { name: "Canada", count: 57, sx: 568, sy: 418, cx: 470, cy: 290, ex: 330, ey: 140 },
  { name: "États-Unis", count: 41, sx: 588, sy: 414, cx: 560, cy: 250, ex: 500, ey: 55 },
  { name: "Sénégal", count: 63, sx: 612, sy: 414, cx: 640, cy: 250, ex: 700, ey: 55 },
  { name: "Côte d'Ivoire", count: 49, sx: 632, sy: 418, cx: 730, cy: 290, ex: 870, ey: 140 },
  { name: "Belgique", count: 32, sx: 652, sy: 420, cx: 800, cy: 340, ex: 985, ey: 260 },
  { name: "Espagne", count: 18, sx: 670, sy: 430, cx: 780, cy: 470, ex: 1015, ey: 540 },
];

export const PEOPLE: readonly LandingPerson[] = [
  { name: "Awa", job: "Étudiante en médecine", city: "Rabat", offer: "Cherche un mentor", country: "Maroc" },
  { name: "Cheick", job: "Ingénieur télécom", city: "Casablanca", offer: "Offre du mentorat", country: "Maroc" },
  { name: "Nana", job: "Doctorante en économie", city: "Fès", offer: "Relit des mémoires", country: "Maroc" },
  { name: "Fatoumata", job: "Cheffe de projet digital", city: "Paris", offer: "Recrute pour sa startup", country: "France" },
  { name: "Ibrahima", job: "Comptable", city: "Lyon", offer: "Offre du mentorat", country: "France" },
  { name: "Mariam", job: "Étudiante en droit", city: "Bordeaux", offer: "Cherche un stage", country: "France" },
  { name: "Seydou", job: "Développeur", city: "Montréal", offer: "Offre du mentorat tech", country: "Canada" },
  { name: "Djeneba", job: "Infirmière", city: "Québec", offer: "Conseille sur l'expatriation", country: "Canada" },
  { name: "Boubacar", job: "Data scientist", city: "Toronto", offer: "Cherche des projets au Mali", country: "Canada" },
  { name: "Adama", job: "Chercheur en agronomie", city: "Washington", offer: "Offre du mentorat", country: "États-Unis" },
  { name: "Oumou", job: "Diplômée MBA", city: "New York", offer: "Cherche des contacts à Bamako", country: "États-Unis" },
  { name: "Salif", job: "Ingénieur civil", city: "Houston", offer: "Conseille sur les carrières", country: "États-Unis" },
  { name: "Ramata", job: "Sage-femme", city: "Dakar", offer: "Anime des formations", country: "Sénégal" },
  { name: "Modibo", job: "Entrepreneur", city: "Dakar", offer: "Cherche des associés", country: "Sénégal" },
  { name: "Aïssata", job: "Juriste", city: "Saint-Louis", offer: "Offre du conseil juridique", country: "Sénégal" },
  { name: "Souleymane", job: "Banquier", city: "Abidjan", offer: "Offre du mentorat finance", country: "Côte d'Ivoire" },
  { name: "Rokia", job: "Commerciale", city: "Abidjan", offer: "Recrute des commerciaux", country: "Côte d'Ivoire" },
  { name: "Youssouf", job: "Logisticien", city: "San-Pédro", offer: "Cherche un emploi", country: "Côte d'Ivoire" },
  { name: "Assitan", job: "Pharmacienne", city: "Bruxelles", offer: "Offre du mentorat santé", country: "Belgique" },
  { name: "Mamadou", job: "Étudiant ingénieur", city: "Liège", offer: "Cherche un stage", country: "Belgique" },
  { name: "Sidiki", job: "Chef cuisinier", city: "Bruxelles", offer: "Organise des événements", country: "Belgique" },
  { name: "Oumar", job: "Agronome", city: "Madrid", offer: "Conseille les porteurs de projet", country: "Espagne" },
  { name: "Hawa", job: "Traductrice", city: "Barcelone", offer: "Donne des cours de langue", country: "Espagne" },
  { name: "Sékou", job: "Étudiant en commerce", city: "Valence", offer: "Cherche un mentor", country: "Espagne" },
];

export const MALI_PEOPLE: readonly LandingPerson[] = [
  { name: "Moussa", job: "Entrepreneur agricole", city: "Ségou", offer: "Cherche des investisseurs", country: "Mali" },
  { name: "Aminata", job: "Développeuse", city: "Bamako", offer: "Offre du mentorat tech", country: "Mali" },
  { name: "Kadiatou", job: "Médecin", city: "Kayes", offer: "Cherche une formation", country: "Mali" },
  { name: "Bakary", job: "Enseignant", city: "Sikasso", offer: "Offre du soutien scolaire", country: "Mali" },
  { name: "Fanta", job: "Commerçante", city: "Mopti", offer: "Cherche des partenaires", country: "Mali" },
];

export const STEPS: readonly LandingStep[] = [
  {
    number: "1",
    title: "Créez votre profil",
    description: "Votre parcours, votre pays, vos compétences. Deux minutes suffisent.",
  },
  {
    number: "2",
    title: "Offrez et demandez",
    description: "Un conseil, un mentorat, un poste, un contact : dites ce que vous pouvez donner et ce qu'il vous faut.",
  },
  {
    number: "3",
    title: "Rencontrez-vous",
    description: "Nous vous mettons en relation avec les bonnes personnes, au Mali comme dans la diaspora.",
  },
];

export const OPPORTUNITIES: readonly LandingOpportunity[] = [
  {
    name: "Fatoumata Keïta",
    role: "Cheffe de projet digital · Paris",
    time: "2 h",
    initials: "FK",
    color: "#0F5C33",
    backgroundColor: "#E3EFE7",
    text: "Nyeta Pay, une fintech de Bamako, recrute. Je connais bien l'équipe : je peux recommander deux profils du réseau. Écrivez-moi !",
    tag: "EMPLOI",
    title: "Data analyst, CDI",
    meta: "Nyeta Pay · Bamako",
    likes: 34,
    comments: 12,
    cta: "Postuler",
  },
  {
    name: "Awa Diarra",
    role: "Étudiante en master finance · Rabat",
    time: "5 h",
    initials: "AD",
    color: "#B85C2E",
    backgroundColor: "#F6E3D6",
    text: "Je prépare mon retour au Mali dans deux ans. Je cherche un·e mentor en finance d'entreprise, idéalement quelqu'un qui a fait le chemin.",
    tag: "DEMANDE DE MENTORAT",
    title: "Finance d'entreprise",
    meta: "1 h par mois · en visio",
    likes: 21,
    comments: 8,
    cta: "Proposer",
  },
  {
    name: "Seydou Coulibaly",
    role: "Responsable RH · Montréal",
    time: "1 j",
    initials: "SC",
    color: "#6B4A2F",
    backgroundColor: "#EDE3D3",
    text: "Dix ans en recrutement. J'offre deux soirs par mois pour relire vos CV et préparer vos entretiens, que vous soyez au Mali ou ailleurs.",
    tag: "J'OFFRE",
    title: "Relecture de CV et entretiens",
    meta: "2 créneaux par mois",
    likes: 47,
    comments: 15,
    cta: "Réserver",
  },
];

export const EVENTS: readonly LandingEvent[] = [
  {
    month: "OCT",
    day: "18",
    title: "Forum emploi Bamako",
    description: "Recruteurs, candidats et membres de la diaspora en visio.",
    location: "Hôtel Djoliba, Bamako",
  },
  {
    month: "OCT",
    day: "25",
    title: "Afterwork diaspora",
    description: "Rencontre informelle entre professionnels maliens.",
    location: "Paris 8e",
  },
  {
    month: "NOV",
    day: "7",
    title: "Webinaire : revenir au Mali",
    description: "Témoignages et conseils pratiques de membres revenus.",
    location: "En ligne",
  },
];

export const FAQ: readonly LandingFaqItem[] = [
  {
    question: "C'est gratuit ?",
    answer: "Oui. L'inscription et l'utilisation de Mali Wuli sont gratuites, sans cotisation.",
  },
  {
    question: "Qui peut s'inscrire ?",
    answer: "Tout Malien ou ami du Mali, au pays ou à l'étranger : étudiants, professionnels, anciens de la diaspora revenus au Mali.",
  },
  {
    question: "Faut-il vivre à l'étranger ?",
    answer: "Non. Le tronc de l'arbre, c'est le Mali : ceux qui vivent au pays sont au cœur du réseau.",
  },
  {
    question: "Comment fonctionne la mise en relation ?",
    answer: "Vous indiquez ce que vous offrez et ce que vous cherchez. Nous vous proposons des profils compatibles ; vous choisissez qui contacter.",
  },
  {
    question: "Mes données sont-elles protégées ?",
    answer: "Votre profil n'est visible que par les membres. Vous choisissez ce que vous partagez.",
  },
];

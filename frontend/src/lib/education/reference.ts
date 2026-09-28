export type FormationType = "ecole" | "lycee" | "universite";

export type InstitutionReference = {
  id: string;
  nom: string;
  paysCode: string;
  ville?: string;
  type: FormationType;
  statut?: "Public" | "Privé";
  systemeEducatifCode?: string;
  source: "reference" | "education-fr" | "esr-fr" | "hipo" | "wikidata";
};

export type ProgrammeReference = {
  id: string;
  label: string;
  specialites: string[];
  diplomes?: string[];
  diplomeSuggere?: string;
};

const AUTRE = "Autre";

// Secours uniquement : identifiants et libellés vérifiés dans le catalogue actif le 21 septembre 2026.
export const INSTITUTIONS_PRIORITAIRES: InstitutionReference[] = [
  { id: "ml-ecole-mamadou-konate", nom: "École fondamentale Mamadou Konaté", paysCode: "ML", ville: "Bamako", type: "ecole", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-lycee-askia", nom: "Lycée Askia Mohamed", paysCode: "ML", ville: "Bamako", type: "lycee", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-lycee-liberte", nom: "Établissement Liberté", paysCode: "ML", ville: "Bamako", type: "lycee", statut: "Privé", systemeEducatifCode: "FR", source: "reference" },
  { id: "ml-osm-363151e3cd30077109a3a444", nom: "Lycée Technique de Bamako", paysCode: "ML", ville: "Bamako", type: "lycee", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-osm-427d40348b9ebf220abd9d2c", nom: "Lycée Bouillagui Fadiga", paysCode: "ML", ville: "Bamako", type: "lycee", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-usttb", nom: "Université des Sciences, des Techniques et des Technologies de Bamako", paysCode: "ML", ville: "Bamako", type: "universite", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-ussgb", nom: "Université des Sciences Sociales et de Gestion de Bamako", paysCode: "ML", ville: "Bamako", type: "universite", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-ulshb", nom: "Université Yambo Ouologuem de Bamako", paysCode: "ML", ville: "Bamako", type: "universite", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-usjpb", nom: "Université Kurukan Fuga de Bamako", paysCode: "ML", ville: "Bamako", type: "universite", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-segou", nom: "Université de Ségou", paysCode: "ML", ville: "Ségou", type: "universite", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-sikasso", nom: "Université de Sikasso", paysCode: "ML", ville: "Sikasso", type: "universite", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-eni-abt", nom: "École Nationale d’Ingénieurs Abderhamane Baba Touré", paysCode: "ML", ville: "Bamako", type: "universite", statut: "Public", systemeEducatifCode: "ML", source: "reference" },
  { id: "ml-osm-203650e897345f1d19e494c2", nom: "Institut Universitaire de Gestion", paysCode: "ML", ville: "Bamako", type: "universite", systemeEducatifCode: "ML", source: "reference" },
  { id: "fr-universite-paris-cite", nom: "Université Paris Cité", paysCode: "FR", ville: "Paris", type: "universite", statut: "Public", systemeEducatifCode: "FR", source: "reference" },
  { id: "ror-03haqmz43", nom: "Université Félix Houphouët-Boigny", paysCode: "CI", ville: "Abidjan", type: "universite", systemeEducatifCode: "CI", source: "reference" },
  { id: "ror-03f915n15", nom: "Institut National Polytechnique Félix Houphouët-Boigny", paysCode: "CI", ville: "Yamoussoukro", type: "universite", systemeEducatifCode: "CI", source: "reference" },
  { id: "cmua35fpk0s4g5etjv96zj0oi", nom: "University of Lagos", paysCode: "NG", ville: "Lagos", type: "universite", systemeEducatifCode: "NG", source: "reference" },
  { id: "cmua35fp10s3o5etjes6qv2cf", nom: "University of Ibadan", paysCode: "NG", ville: "Ibadan", type: "universite", systemeEducatifCode: "NG", source: "reference" },
  { id: "cmua35fhz0rtc5etj1itqnn6u", nom: "Université Abdou Moumouni de Niamey", paysCode: "NE", ville: "Niamey", type: "universite", systemeEducatifCode: "NE", source: "reference" },
  { id: "cmua35eoy0qu85etj299vdav3", nom: "Université de Nouakchott", paysCode: "MR", ville: "Nouakchott", type: "universite", systemeEducatifCode: "MR", source: "reference" },
];

const SERIES_GENERIQUES = [
  "Sciences et mathématiques",
  "Sciences de la vie et de la terre",
  "Économie et sciences sociales",
  "Lettres, langues et philosophie",
  "Sciences humaines",
  "Technologies et ingénierie",
  "Gestion, commerce et comptabilité",
  "Santé et sciences médico-sociales",
  "Agriculture et environnement",
  "Arts et création",
  "Hôtellerie et restauration",
  "Formation professionnelle ou technique",
  AUTRE,
];

const SERIES_PAR_PAYS: Record<string, string[]> = {
  ML: [
    "Série TSE — sciences exactes",
    "Série TSECO — sciences économiques",
    "Série TSS — sciences sociales",
    "Série TLL — langues et littérature",
    "Série TAL — arts et lettres",
    "Série STI — sciences et technologies industrielles",
    "Série STG — sciences et technologies de gestion",
    "Série SE — sciences exactes (ancienne série)",
    "Série SB — sciences biologiques (ancienne série)",
    "Série SH — sciences humaines (ancienne série)",
    "Série LL — langues et littérature (ancienne série)",
    AUTRE,
  ],
  FR: [
    "Ancienne série S — scientifique",
    "Ancienne série ES — économique et social",
    "Ancienne série L — littéraire",
    "Baccalauréat général — mathématiques",
    "Baccalauréat général — physique-chimie",
    "Baccalauréat général — sciences de la vie et de la Terre",
    "Baccalauréat général — sciences économiques et sociales",
    "Baccalauréat général — histoire-géographie, géopolitique et sciences politiques",
    "Baccalauréat général — humanités, littérature et philosophie",
    "Baccalauréat général — langues, littératures et cultures étrangères et régionales",
    "Baccalauréat général — numérique et sciences informatiques",
    "Baccalauréat général — sciences de l’ingénieur",
    "Baccalauréat général — arts",
    "Baccalauréat technologique STMG",
    "Baccalauréat technologique STI2D",
    "Baccalauréat technologique ST2S",
    "Baccalauréat technologique STL",
    "Baccalauréat technologique STD2A",
    "Baccalauréat technologique STHR",
    "Baccalauréat technologique S2TMD",
    "Baccalauréat technologique STAV",
    "Baccalauréat professionnel",
    AUTRE,
  ],
  CI: [
    "Série A1 — lettres et mathématiques",
    "Série A2 — lettres et langues",
    "Série C — mathématiques et sciences physiques",
    "Série D — mathématiques et sciences de la vie",
    "Série E — mathématiques et technique",
    "Série F1 — construction mécanique",
    "Série F2 — électronique",
    "Série F3 — électrotechnique",
    "Série F4 — génie civil",
    "Série G1 — techniques administratives",
    "Série G2 — techniques quantitatives de gestion",
    "Série G3 — techniques commerciales",
    AUTRE,
  ],
  NG: [
    "Science",
    "Arts and Humanities",
    "Commercial / Business Studies",
    "Technical and Vocational Studies",
    "Agricultural Science",
    AUTRE,
  ],
  NE: [
    "Série A — lettres et sciences humaines",
    "Série C — mathématiques et sciences physiques",
    "Série D — mathématiques et sciences naturelles",
    "Série E — mathématiques et technique",
    "Série F — technique industrielle",
    "Série G — économie et gestion",
    AUTRE,
  ],
  MR: [
    "Série C — mathématiques",
    "Série D — sciences naturelles",
    "Série A — lettres modernes",
    "Série O — lettres originelles",
    "Série T — technique",
    AUTRE,
  ],
};

const SERIES_LYCEE_FRANCAIS_LIBERTE = [
  "Ancienne série S — scientifique",
  "Ancienne série ES — économique et social",
  "Ancienne série L — littéraire",
  "Spécialité HGGSP — histoire-géographie, géopolitique et sciences politiques",
  "Spécialité HLP — humanités, littérature et philosophie",
  "Spécialité LLCER — anglais",
  "Spécialité LLCER — anglais, monde contemporain",
  "Spécialité Mathématiques",
  "Spécialité NSI — numérique et sciences informatiques",
  "Spécialité Physique-chimie",
  "Spécialité SVT — sciences de la vie et de la Terre",
  "Spécialité SES — sciences économiques et sociales",
  AUTRE,
];

const DIPLOMES_GENERIQUES: Record<FormationType, string[]> = {
  ecole: [
    "Certificat de fin d’études primaires",
    "Brevet ou certificat de fin d’études fondamentales",
    "Certificat de premier cycle secondaire",
    AUTRE,
  ],
  lycee: [
    "Baccalauréat ou diplôme de fin d’études secondaires",
    "Certificat technique ou professionnel",
    "Diplôme d’accès aux études supérieures",
    AUTRE,
  ],
  universite: [
    "Certificat universitaire",
    "Diplôme universitaire de technologie / diplôme court",
    "BTS / technicien supérieur",
    "Associate degree / diplôme de cycle court",
    "Licence / Bachelor (Bac+3)",
    "Licence professionnelle",
    "Maîtrise (ancien système)",
    "Master (Bac+5)",
    "Diplôme d’ingénieur",
    "MBA",
    "Diplôme d’État de santé",
    "Doctorat / PhD",
    "Habilitation à diriger des recherches",
    AUTRE,
  ],
};

const DIPLOMES_PAR_PAYS: Record<string, Partial<Record<FormationType, string[]>>> = {
  ML: {
    ecole: ["DEF — Diplôme d’études fondamentales", "Certificat d’études primaires", AUTRE],
    lycee: ["Baccalauréat malien", "Brevet de technicien (BT)", "Certificat d’aptitude professionnelle (CAP)", AUTRE],
    universite: ["DUT / DEUG (Bac+2)", "Licence (Bac+3)", "Licence professionnelle", "Maîtrise", "Master (Bac+5)", "Diplôme d’ingénieur", "Diplôme d’État de santé", "Doctorat / PhD", AUTRE],
  },
  FR: {
    ecole: ["Diplôme national du brevet (DNB)", "Certificat de formation générale (CFG)", AUTRE],
    lycee: ["Baccalauréat général", "Baccalauréat technologique", "Baccalauréat professionnel", "CAP", "Brevet professionnel", AUTRE],
    universite: ["DEUST", "BTS / BTSA", "DUT / BUT", "Licence (Bac+3)", "Licence professionnelle", "Master (Bac+5)", "Diplôme d’ingénieur", "Diplôme d’État de santé", "Doctorat / PhD", AUTRE],
  },
  CI: {
    ecole: ["CEPE — Certificat d’études primaires élémentaires", "BEPC — Brevet d’études du premier cycle", AUTRE],
    lycee: ["Baccalauréat ivoirien", "Brevet de technicien (BT)", "CAP", AUTRE],
    universite: ["BTS", "DUT", "Licence", "Licence professionnelle", "Master", "Diplôme d’ingénieur", "Doctorat / PhD", AUTRE],
  },
  NG: {
    ecole: ["Primary School Leaving Certificate", "Basic Education Certificate / JSCE", AUTRE],
    lycee: ["WASSCE / WAEC", "SSCE / NECO", "NABTEB NTC / NBC", AUTRE],
    universite: ["NCE", "National Diploma (ND)", "Higher National Diploma (HND)", "Bachelor’s degree", "Postgraduate Diploma", "Master’s degree", "Doctorate / PhD", AUTRE],
  },
  NE: {
    ecole: ["CFEPD — Certificat de fin d’études du premier degré", "BEPC", AUTRE],
    lycee: ["Baccalauréat nigérien", "Brevet de technicien", "CAP", AUTRE],
    universite: ["DUT", "Licence", "Licence professionnelle", "Master", "Diplôme d’ingénieur", "Doctorat / PhD", AUTRE],
  },
  MR: {
    ecole: ["Certificat d’études fondamentales", "BEPC", AUTRE],
    lycee: ["Baccalauréat mauritanien", "Brevet de technicien", "CAP", AUTRE],
    universite: ["DUT", "Licence", "Licence professionnelle", "Master", "Diplôme d’ingénieur", "Doctorat / PhD", AUTRE],
  },
};

const PROGRAMMES_GENERIQUES: ProgrammeReference[] = [
  { id: "education", label: "Sciences de l’éducation", specialites: ["Enseignement primaire", "Enseignement secondaire", "Pédagogie", "Administration de l’éducation", "Éducation spécialisée", AUTRE] },
  { id: "arts", label: "Arts, design et création", specialites: ["Arts plastiques", "Design", "Musique", "Arts du spectacle", "Audiovisuel", "Mode", AUTRE] },
  { id: "lettres", label: "Lettres, langues et humanités", specialites: ["Littérature", "Langues étrangères", "Linguistique", "Histoire", "Philosophie", "Théologie", AUTRE] },
  { id: "sciences-sociales", label: "Sciences sociales et comportementales", specialites: ["Économie", "Science politique", "Sociologie", "Psychologie", "Anthropologie", "Géographie", AUTRE] },
  { id: "information-communication", label: "Information et communication", specialites: ["Journalisme", "Communication", "Médias numériques", "Documentation", AUTRE] },
  { id: "commerce-gestion", label: "Commerce, administration et gestion", specialites: ["Gestion", "Finance", "Comptabilité", "Marketing", "Ressources humaines", "Entrepreneuriat", "Logistique", AUTRE] },
  { id: "droit", label: "Droit", specialites: ["Droit privé", "Droit public", "Droit international", "Droit des affaires", "Droit fiscal", AUTRE] },
  { id: "biologie", label: "Sciences biologiques", specialites: ["Biologie", "Biochimie", "Biotechnologies", "Génétique", "Microbiologie", "Écologie", AUTRE] },
  { id: "environnement", label: "Environnement", specialites: ["Sciences de l’environnement", "Gestion des ressources naturelles", "Climat", "Développement durable", AUTRE] },
  { id: "sciences-physiques", label: "Sciences physiques", specialites: ["Physique", "Chimie", "Sciences de la Terre", "Astronomie", AUTRE] },
  { id: "mathematiques", label: "Mathématiques et statistiques", specialites: ["Mathématiques", "Mathématiques appliquées", "Statistiques", "Actuariat", AUTRE] },
  { id: "informatique", label: "Informatique et systèmes d’information", specialites: ["Génie logiciel", "Systèmes d’information", "Science des données", "Intelligence artificielle", "Cybersécurité", "Réseaux", "Informatique de gestion", AUTRE] },
  { id: "ingenierie", label: "Ingénierie", specialites: ["Génie civil", "Génie mécanique", "Génie électrique", "Électronique", "Télécommunications", "Génie industriel", "Énergétique", AUTRE] },
  { id: "architecture", label: "Architecture, urbanisme et construction", specialites: ["Architecture", "Urbanisme", "Aménagement du territoire", "Bâtiment et travaux publics", AUTRE] },
  { id: "agriculture", label: "Agriculture, foresterie et pêche", specialites: ["Agronomie", "Productions végétales", "Productions animales", "Foresterie", "Pêche et aquaculture", AUTRE] },
  { id: "veterinaire", label: "Sciences vétérinaires", specialites: ["Médecine vétérinaire", "Santé animale", "Productions animales", AUTRE] },
  { id: "sante", label: "Santé", specialites: ["Médecine", "Pharmacie", "Odontologie", "Sciences infirmières", "Maïeutique", "Santé publique", "Analyses biomédicales", "Kinésithérapie", AUTRE] },
  { id: "social", label: "Travail social", specialites: ["Action sociale", "Éducation spécialisée", "Développement communautaire", AUTRE] },
  { id: "services", label: "Services", specialites: ["Hôtellerie et restauration", "Tourisme", "Transport", "Sécurité", "Sport", "Services à la personne", AUTRE] },
  { id: "autre", label: AUTRE, specialites: [AUTRE] },
];

const PROGRAMMES_PAR_PAYS: Record<string, ProgrammeReference[]> = {
  FR: [
    {
      id: "fr-master-meci",
      label: "Master — Métiers des études, du conseil et de l’intervention (MECI)",
      specialites: [
        "PISE — Projets informatiques et stratégie d’entreprise",
        "ADL — Aménagement et développement local",
        "CCESE — Consultants et chargés d’études socio-économiques et environnementales",
        AUTRE,
      ],
      diplomeSuggere: "Master (Bac+5)",
    },
  ],
};

export const getSystemeEducatifCode = (paysCode: string, institutionId?: string) =>
  INSTITUTIONS_PRIORITAIRES.find((institution) => institution.id === institutionId)?.systemeEducatifCode
  || paysCode;

export const getSeries = (paysCode: string, institutionId?: string) => {
  if (institutionId === "ml-lycee-liberte") return SERIES_LYCEE_FRANCAIS_LIBERTE;
  const systemeEducatifCode = getSystemeEducatifCode(paysCode, institutionId);
  return SERIES_PAR_PAYS[systemeEducatifCode] || SERIES_GENERIQUES;
};

export const getDiplomes = (paysCode: string, type: FormationType, institutionId?: string) => {
  const systemeEducatifCode = getSystemeEducatifCode(paysCode, institutionId);
  return DIPLOMES_PAR_PAYS[systemeEducatifCode]?.[type] || DIPLOMES_GENERIQUES[type];
};

export const getProgrammes = (paysCode: string) => {
  const prioritaires = PROGRAMMES_PAR_PAYS[paysCode] || [];
  const ids = new Set(prioritaires.map((programme) => programme.id));
  return [...prioritaires, ...PROGRAMMES_GENERIQUES.filter((programme) => !ids.has(programme.id))];
};

const LIBELLES_SYSTEMES: Record<string, string> = {
  ML: "Programme malien", FR: "Programme français", CI: "Programme ivoirien",
  NG: "Programme nigérian", NE: "Programme nigérien", MR: "Programme mauritanien",
  AUTRE: "Autre programme / programme international",
};

export const libelleSystemeEducatif = (code?: string) => {
  if (!code) return "";
  if (LIBELLES_SYSTEMES[code]) return LIBELLES_SYSTEMES[code];
  try {
    return `Programme : ${new Intl.DisplayNames(["fr"], { type: "region" }).of(code) || code}`;
  } catch {
    return `Programme : ${code}`;
  }
};

/** Présente L1 comme « Licence », y compris les libellés enregistrés auparavant. */
export const libelleProgramme = (label?: string | null) =>
  (label || "")
    .replace(/^Licence\s*[—–-]\s*1re\s+année(?=\s|[-–—:]|$)/i, "Licence")
    .replace(/^L([123])(?=\s|[-–—:]|$)/i, (_, annee: string) => annee === "1" ? "Licence" : `Licence — ${annee}e année`);

export type ContexteReferencesFormation = {
  type: FormationType;
  paysCode: string;
  systemeEducatifCode?: string;
  institutionId?: string;
};

export const cleReferencesFormation = (contexte: ContexteReferencesFormation) =>
  JSON.stringify([contexte.type, contexte.paysCode, contexte.systemeEducatifCode || "", contexte.institutionId || ""]);

/** Une réponse précédente ne doit jamais alimenter les choix d’un nouveau contexte. */
export const referencesFormationDisponibles = (
  contexte: ContexteReferencesFormation,
  chargees?: { cle: string; series: string[]; diplomes: string[] } | null,
) => {
  if (chargees?.cle === cleReferencesFormation(contexte)) return chargees;
  const systeme = contexte.systemeEducatifCode || getSystemeEducatifCode(contexte.paysCode, contexte.institutionId);
  return {
    series: contexte.type === "universite" ? [] : getSeries(systeme),
    diplomes: contexte.type === "universite"
      ? getDiplomes(contexte.paysCode, "universite", contexte.institutionId)
      : [...new Set([...getDiplomes(systeme, "ecole"), ...getDiplomes(systeme, "lycee")])],
  };
};

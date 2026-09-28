import {
  ModeUtilisationSource,
  NiveauEducation,
  StatutEtablissement,
  TypeEtablissement,
  TypeProgrammeEducation,
} from "@prisma/client";

export type SourceSeed = {
  code: string;
  nom: string;
  url: string;
  paysCode?: string;
  licence?: string;
  conditionsUrl?: string;
  modeUtilisation: ModeUtilisationSource;
  priorite: number;
};

export type InstitutionSeed = {
  key: string;
  nom: string;
  sigle?: string;
  aliases?: string[];
  systemeEducatifCode?: string;
  type: TypeEtablissement;
  niveaux: NiveauEducation[];
  ville?: string;
  statut: StatutEtablissement;
  description?: string;
  siteWeb?: string;
  sources: Array<{
    code: string;
    identifiantExterne: string;
    urlSource?: string;
    confiance: number;
  }>;
};

export type ProgrammeSeed = {
  key: string;
  nom: string;
  sigle?: string;
  paysCode?: string;
  type: TypeProgrammeEducation;
  niveau: NiveauEducation;
  parentKey?: string;
  sourceCode: string;
};

export const SOURCES_EDUCATIVES: SourceSeed[] = [
  {
    code: "campus-mali-api",
    nom: "Campus Mali — catalogue officiel des formations",
    url: "https://api.campusmali.edu.ml/sigu/api/v1/structure/universities?size=5000",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.API_OFFICIELLE,
    priorite: 5,
  },
  {
    code: "cscmd-officiel",
    nom: "Complexe Scolaire Cheick Modibo Diarra — site officiel",
    url: "https://cs-cmd.com/",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 5,
  },
  {
    code: "aefe",
    nom: "AEFE — Annuaire des établissements français à l’étranger",
    url: "https://aefe.gouv.fr/fr/etablissements",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 5,
  },
  {
    code: "dgi-mali",
    nom: "Mali — Direction générale des impôts",
    url: "https://www.dgi.gouv.ml/",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 7,
  },
  {
    code: "enko-kalanso-kodonso",
    nom: "Enko Education — Kalanso et Kodonso",
    url: "https://www.enkoeducation.com/fr/kalanso/home",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 6,
  },
  {
    code: "maarif-mali",
    nom: "Écoles Maarif de Türkiye au Mali",
    url: "https://ml.ecolesmaarif.org/contact",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 6,
  },
  {
    code: "journal-officiel-mali",
    nom: "Journal officiel de la République du Mali",
    url: "https://sgg-mali.ml/JO/2014/mali-jo-2014-40.pdf",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 6,
  },
  {
    code: "linkedin-organisations",
    nom: "Profils publics d’organisations LinkedIn",
    url: "https://www.linkedin.com/",
    modeUtilisation: ModeUtilisationSource.VALIDATION_SEULE,
    priorite: 80,
  },
  {
    code: "countries-states-cities",
    nom: "Countries States Cities Database",
    url: "https://github.com/dr5hn/countries-states-cities-database",
    licence: "ODbL-1.0",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 20,
  },
  {
    code: "wikidata",
    nom: "Wikidata",
    url: "https://www.wikidata.org/",
    licence: "CC0-1.0",
    conditionsUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 30,
  },
  {
    code: "hipo",
    nom: "Hipo University Domains List",
    url: "https://github.com/Hipo/university-domains-list",
    licence: "MIT",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 40,
  },
  {
    code: "ror",
    nom: "Research Organization Registry (ROR)",
    url: "https://ror.org/registry/",
    licence: "CC0-1.0",
    conditionsUrl: "https://ror.readme.io/docs/data-dump",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 8,
  },
  {
    code: "unesco-isced",
    nom: "UNESCO — Classification internationale type de l’éducation (CITE/ISCED)",
    url: "https://www.uis.unesco.org/en/methods-and-tools/isced",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 25,
  },
  {
    code: "education-fr",
    nom: "Ministère français de l’Éducation — Annuaire de l’éducation",
    url: "https://data.education.gouv.fr/explore/dataset/fr-en-annuaire-education/",
    paysCode: "FR",
    licence: "Licence Ouverte 2.0",
    modeUtilisation: ModeUtilisationSource.API_OFFICIELLE,
    priorite: 10,
  },
  {
    code: "statcan-odef",
    nom: "Statistique Canada — Base de données ouvertes sur les établissements d’enseignement",
    url: "https://open.canada.ca/data/fr/dataset/4dd64c98-b12a-49c7-be29-21c77d22b675",
    paysCode: "CA",
    licence: "Licence du gouvernement ouvert — Canada",
    conditionsUrl: "https://open.canada.ca/fr/licence-du-gouvernement-ouvert-canada",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 10,
  },
  {
    code: "menps-maroc",
    nom: "Maroc — Ministère de l’Éducation nationale, du Préscolaire et des Sports",
    url: "https://data.gov.ma/data/fr/organization/ministere-de-l-education-nationale-et-de-la-formation-professionnelle",
    paysCode: "MA",
    licence: "ODbL-1.0",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 10,
  },
  {
    code: "eduscol-bac-fr",
    nom: "Éduscol — enseignements de spécialité du baccalauréat français",
    url: "https://eduscol.education.gouv.fr/sites/default/files/document/menesr-efe-enseignements-specialite-voie-generale-efe-homologues-annee2025-26pdf-112299.pdf",
    paysCode: "FR",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 9,
  },
  {
    code: "esr-fr",
    nom: "Ministère français de l’Enseignement supérieur et de la Recherche",
    url: "https://data.enseignementsup-recherche.gouv.fr/",
    paysCode: "FR",
    licence: "Licence Ouverte 2.0",
    modeUtilisation: ModeUtilisationSource.API_OFFICIELLE,
    priorite: 10,
  },
  {
    code: "legrandfrere-mali",
    nom: "Le Grand Frère — établissements et formations au Mali",
    url: "https://legrandfrere.africa/mali/",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
    priorite: 15,
  },
  {
    code: "fabert-mali",
    nom: "Fabert — établissements privés au Mali",
    url: "https://www.fabert.com/etablissement-prive/?country=Mali",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.VALIDATION_SEULE,
    priorite: 60,
  },
  {
    code: "ecoles-mali",
    nom: "Écoles au Mali",
    url: "https://ecoles-mali.com/",
    paysCode: "ML",
    conditionsUrl: "https://ecoles-mali.com/cu.php?id=3-conditions-generales-d-utilisation",
    modeUtilisation: ModeUtilisationSource.VALIDATION_SEULE,
    priorite: 55,
  },
  {
    code: "maliatlas-ecoles",
    nom: "MaliAtlas — écoles",
    url: "https://maliatlas.com/ecoles",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.VALIDATION_SEULE,
    priorite: 58,
  },
  {
    code: "ocha-men-mali-schools-2023",
    nom: "OCHA/HDX — registre 2023 des écoles du Ministère de l’Éducation du Mali",
    url: "https://data.humdata.org/dataset/mali-schools",
    paysCode: "ML",
    licence: "CC BY 3.0 IGO",
    conditionsUrl: "https://creativecommons.org/licenses/by/3.0/igo/legalcode",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 4,
  },
  {
    code: "unicef-men-mali-schools-2013",
    nom: "UNICEF/Ministère de l’Éducation du Mali — registre géolocalisé des écoles",
    url: "https://github.com/jokkolabs/mali_schools",
    paysCode: "ML",
    licence: "Public Domain",
    conditionsUrl: "https://github.com/jokkolabs/mali_schools/blob/master/README.md",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 9,
  },
  {
    code: "overture-places-mali",
    nom: "Overture Maps Places — établissements scolaires au Mali",
    url: "https://docs.overturemaps.org/guides/places/",
    paysCode: "ML",
    licence: "CDLA-Permissive-2.0 (avec licences des sources par objet)",
    conditionsUrl: "https://cdla.dev/permissive-2-0/",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 45,
  },
  {
    code: "hotosm-mali-education",
    nom: "HOT/HDX — équipements éducatifs du Mali (OpenStreetMap)",
    url: "https://data.humdata.org/dataset/hotosm_mli_education_facilities",
    paysCode: "ML",
    licence: "ODbL-1.0",
    conditionsUrl: "https://www.openstreetmap.org/copyright",
    modeUtilisation: ModeUtilisationSource.IMPORT_OUVERT,
    priorite: 35,
  },
  {
    code: "whed",
    nom: "World Higher Education Database (WHED)",
    url: "https://whed.net/results_institutions.php?Chp1=Mali",
    paysCode: "ML",
    conditionsUrl: "https://whed.net/Terms_of_use.html",
    modeUtilisation: ModeUtilisationSource.VALIDATION_SEULE,
    priorite: 12,
  },
  {
    code: "ipef-dakar",
    nom: "Inspection des écoles d’enseignement français d’Afrique occidentale",
    url: "https://www.ipefdakar.org/-mali-.html",
    paysCode: "ML",
    modeUtilisation: ModeUtilisationSource.VALIDATION_SEULE,
    priorite: 70,
  },
];

const grandFrere = (slug: string, confiance = 0.78) => ({
  code: "legrandfrere-mali",
  identifiantExterne: slug,
  urlSource: `https://legrandfrere.africa/etablissement/${slug}/`,
  confiance,
});

export const INSTITUTIONS_MALI: InstitutionSeed[] = [
  {
    key: "ml-ecole-mamadou-konate",
    nom: "École fondamentale Mamadou Konaté",
    type: TypeEtablissement.FONDAMENTALE,
    niveaux: [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL],
    ville: "Bamako",
    statut: StatutEtablissement.PUBLIC,
    sources: [{ code: "ecoles-mali", identifiantExterne: "recherche:ecole-fondamentale-mamadou-konate", confiance: 0.55 }],
  },
  {
    key: "ml-lycee-askia",
    nom: "Lycée Askia Mohamed",
    aliases: ["Lycée Askia Mohammed"],
    type: TypeEtablissement.LYCEE,
    niveaux: [NiveauEducation.SECONDAIRE],
    ville: "Bamako",
    statut: StatutEtablissement.PUBLIC,
    sources: [{ code: "ecoles-mali", identifiantExterne: "recherche:lycee-askia-mohamed", confiance: 0.55 }],
  },
  {
    key: "ml-cscmd-hamdallaye",
    nom: "Complexe Scolaire Cheick Modibo Diarra",
    sigle: "CSCMD",
    aliases: [
      "Lycée Cheick Modibo Diarra",
      "Lycee Cheick Modibo Diarra",
      "Lycée Moderne Cheick Modibo Diarra",
      "LMCMD",
      "Collège Moderne Cheick Modibo Diarra",
      "Collège Cheick Modibo Diarra",
      "École Cheick Modibo Diarra",
      "Complexe Scolaire Cheikh Modibo Diarra",
    ],
    type: TypeEtablissement.LYCEE,
    niveaux: [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL, NiveauEducation.SECONDAIRE],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    description: "Complexe scolaire de Hamdallaye proposant le primaire, le collège et le lycée.",
    siteWeb: "https://cs-cmd.com/",
    sources: [
      {
        code: "cscmd-officiel",
        identifiantExterne: "complexe-scolaire-cheick-modibo-diarra-hamdallaye",
        urlSource: "https://cs-cmd.com/",
        confiance: 0.99,
      },
    ],
  },
  {
    key: "ml-osm-89c5f26451060843808abe9a",
    nom: "École Kalanso — Enko Education",
    aliases: ["Kalanso", "École Kalanso", "Enko Kalanso", "Kalanso International School"],
    type: TypeEtablissement.FONDAMENTALE,
    niveaux: [NiveauEducation.PRESCOLAIRE, NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    siteWeb: "https://www.enkoeducation.com/fr/kalanso/home",
    sources: [
      {
        code: "enko-kalanso-kodonso",
        identifiantExterne: "kalanso",
        urlSource: "https://www.enkoeducation.com/fr/kalanso/home",
        confiance: 0.99,
      },
    ],
  },
  {
    key: "ml-osm-0cf001310dede404e132bc2d",
    nom: "Lycée Kodonso — Enko Education",
    aliases: ["Kodonso", "Lycée Kodonso", "Enko Kodonso", "Kodonso International School", "ex Kodonso"],
    type: TypeEtablissement.LYCEE,
    niveaux: [NiveauEducation.FONDAMENTAL, NiveauEducation.SECONDAIRE],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    siteWeb: "https://www.enkoeducation.com/fr/kodonso/home",
    sources: [
      {
        code: "enko-kalanso-kodonso",
        identifiantExterne: "kodonso",
        urlSource: "https://www.enkoeducation.com/fr/kodonso/home",
        confiance: 0.99,
      },
    ],
  },
  ...[
    {
      key: "ml-maarif-korofina",
      nom: "École Maarif de Türkiye — Campus Korofina",
      aliases: [
        "Collège Horizon",
        "College Horizon",
        "Collège Horizon Korofina",
        "AEI Collège Horizon",
        "Complexe scolaire Collège Horizon",
      ],
      ville: "Bamako",
      identifiantExterne: "campus-korofina",
      sourcesHistoriques: true,
    },
    {
      key: "ml-maarif-badalabougou",
      nom: "École Maarif de Türkiye — Campus Badalabougou",
      aliases: [
        "École privée Collège Horizon",
        "Ecole privee College Horizon",
        "École privée Horizon",
        "Collège Horizon Badalabougou",
      ],
      ville: "Bamako",
      identifiantExterne: "campus-badalabougou",
      sourcesHistoriques: true,
    },
    {
      key: "ml-maarif-fethi-sekin",
      nom: "École Maarif de Türkiye — Campus du Martyr Fethi Sekin",
      aliases: ["Campus Fethi Sekin", "École Maarif Sébénicoro", "Ecole Maarif Sebenicoro"],
      ville: "Bamako",
      identifiantExterne: "campus-fethi-sekin-sebenicoro",
      sourcesHistoriques: false,
    },
    {
      key: "ml-maarif-sokorodji",
      nom: "École Maarif de Türkiye — Campus Sokorodji",
      aliases: ["École Maarif Sokorodji", "Ecole Maarif Sokorodji"],
      ville: "Bamako",
      identifiantExterne: "campus-sokorodji",
      sourcesHistoriques: false,
    },
    {
      key: "ml-maarif-segou",
      nom: "École Maarif de Türkiye — Campus Ségou",
      aliases: ["École Maarif Ségou", "Ecole Maarif Segou"],
      ville: "Ségou",
      identifiantExterne: "campus-segou",
      sourcesHistoriques: false,
    },
  ].map<InstitutionSeed>(({ key, nom, aliases, ville, identifiantExterne, sourcesHistoriques }) => ({
    key,
    nom,
    aliases,
    type: TypeEtablissement.LYCEE,
    niveaux: [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL, NiveauEducation.SECONDAIRE],
    ville,
    statut: StatutEtablissement.PRIVE,
    siteWeb: "https://ml.ecolesmaarif.org/",
    description: sourcesHistoriques
      ? "Établissement actuellement exploité par la Fondation Maarif ; l’ancien nom Collège Horizon est conservé pour les anciens élèves."
      : undefined,
    sources: [
      {
        code: "maarif-mali",
        identifiantExterne,
        urlSource: "https://ml.ecolesmaarif.org/contact",
        confiance: 0.99,
      },
      ...(sourcesHistoriques
        ? [{
          code: "journal-officiel-mali",
          identifiantExterne: `ancien-college-horizon:${identifiantExterne}`,
          urlSource: "https://sgg-mali.ml/JO/2019/mali-jo-2019-21.pdf",
          confiance: 0.95,
        }]
        : []),
    ],
  })),
  {
    key: "ml-lycee-castors-bamako",
    nom: "Lycée Castors Bamako",
    aliases: ["Lycée Castors", "Lycee Castors", "Lycée Les Castors", "Castors"],
    type: TypeEtablissement.LYCEE,
    niveaux: [NiveauEducation.SECONDAIRE],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    sources: [
      {
        code: "ecoles-mali",
        identifiantExterne: "2390",
        urlSource: "https://ecoles-mali.com/ecole.php?id=2390-lycee-castors-bamako-quatrieme-arrondissement-de-bamako",
        confiance: 0.82,
      },
    ],
  },
  {
    key: "ml-lycee-liberte",
    nom: "Établissement Liberté",
    aliases: ["Lycée Français Liberté", "Lycée Liberté", "Lycée Français Liberté 2"],
    systemeEducatifCode: "FR",
    type: TypeEtablissement.LYCEE,
    niveaux: [
      NiveauEducation.PRESCOLAIRE,
      NiveauEducation.PRIMAIRE,
      NiveauEducation.FONDAMENTAL,
      NiveauEducation.SECONDAIRE,
    ],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    siteWeb: "https://www.libertebko.org/",
    sources: [
      {
        code: "aefe",
        identifiantExterne: "etablissement-liberte-bamako",
        urlSource: "https://aefe.gouv.fr/fr/etablissements/etablissement-liberte",
        confiance: 0.99,
      },
      { code: "fabert-mali", identifiantExterne: "lycee-francais-liberte", urlSource: "https://www.fabert.com/etablissement-prive/1106/LYCEE-FRANCAIS-LIBERTE.html", confiance: 0.78 },
      { code: "ipef-dakar", identifiantExterne: "lycee-liberte-bamako", urlSource: "https://www.ipefdakar.org/-mali-.html", confiance: 0.72 },
    ],
  },
  {
    key: "ml-complexe-scolaire-mali-univers",
    nom: "Complexe Scolaire Mali Univers",
    aliases: ["Groupe scolaire Mali Univers", "Mali Univers"],
    type: TypeEtablissement.FONDAMENTALE,
    niveaux: [
      NiveauEducation.PRESCOLAIRE,
      NiveauEducation.PRIMAIRE,
      NiveauEducation.FONDAMENTAL,
      NiveauEducation.SECONDAIRE,
    ],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    description: "Établissement historique de Faladié conservé dans le catalogue pour les anciens élèves ; statut d’activité actuel à confirmer.",
    sources: [
      {
        code: "dgi-mali",
        identifiantExterne: "082212399B",
        urlSource: "https://www.dgi.gouv.ml/wp-content/uploads/2021/01/CONTRIBUABLES-RIVE-DROITE-.pdf",
        confiance: 0.96,
      },
      {
        code: "linkedin-organisations",
        identifiantExterne: "csmaliunivers",
        urlSource: "https://ml.linkedin.com/company/csmaliunivers",
        confiance: 0.72,
      },
    ],
  },
  {
    key: "ml-ecole-les-lutins",
    nom: "École Les Lutins",
    systemeEducatifCode: "FR",
    type: TypeEtablissement.FONDAMENTALE,
    niveaux: [NiveauEducation.PRESCOLAIRE, NiveauEducation.PRIMAIRE],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    sources: [
      { code: "fabert-mali", identifiantExterne: "ecole-les-lutins", confiance: 0.78 },
      { code: "ipef-dakar", identifiantExterne: "ecole-les-lutins-bamako", confiance: 0.72 },
    ],
  },
  ...[
    ["ml-angelots", "Groupe scolaire Les Angelots", "groupe-scolaire-les-angelots-bamako"],
    ["ml-ecrivains", "École Les Écrivains", "ecole-les-ecrivains-bamako"],
    ["ml-sequoia", "Sequoia International Academy", "sequoia-international-academy-bamako"],
    ["ml-laureats", "École Les Lauréats", "ecole-les-laureats-bamako"],
    ["ml-petite-academy", "La Petite Academy", "la-petite-academy-bamako"],
  ].map<InstitutionSeed>(([key, nom, externalId]) => ({
    key,
    nom,
    ...(key === "ml-angelots" ? { systemeEducatifCode: "FR" } : {}),
    type: TypeEtablissement.FONDAMENTALE,
    niveaux: [NiveauEducation.PRESCOLAIRE, NiveauEducation.PRIMAIRE],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    sources: [{ code: "ipef-dakar", identifiantExterne: externalId, confiance: 0.68 }],
  })),
  {
    key: "ml-eni-abt",
    nom: "École Nationale d’Ingénieurs Abderhamane Baba Touré",
    sigle: "ENI-ABT",
    aliases: ["Abderhamane Baba Touré - National School of Engineering"],
    type: TypeEtablissement.ECOLE_SUPERIEURE,
    niveaux: [NiveauEducation.SUPERIEUR],
    ville: "Bamako",
    statut: StatutEtablissement.PUBLIC,
    sources: [{ code: "whed", identifiantExterne: "IAU-004089", urlSource: "https://whed.net/results_institutions.php?Chp1=Mali", confiance: 0.95 }],
  },
  {
    key: "ml-iam",
    nom: "Institut Africain de Management de Bamako",
    sigle: "IAM Bamako",
    aliases: ["African Management Institute", "Institut africain de Management"],
    type: TypeEtablissement.ECOLE_SUPERIEURE,
    niveaux: [NiveauEducation.SUPERIEUR, NiveauEducation.FORMATION_CONTINUE],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    siteWeb: "https://iambamako.com/",
    sources: [
      grandFrere("iam-bamako", 0.9),
      { code: "whed", identifiantExterne: "IAU-007880-024813", confiance: 0.95 },
    ],
  },
  {
    key: "ml-ucao-uuba",
    nom: "Université Catholique de l’Afrique de l’Ouest — Unité Universitaire de Bamako",
    sigle: "UCAO-UUBa",
    aliases: ["Catholic University of West Africa - Bamako University Unit"],
    type: TypeEtablissement.UNIVERSITE,
    niveaux: [NiveauEducation.SUPERIEUR],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    sources: [grandFrere("universite-catholique-de-lafrique-de-louest-unite-universitaire-de-bamako-ucao-uuba"), { code: "whed", identifiantExterne: "IAU-031316", confiance: 0.95 }],
  },
  {
    key: "ml-uamsat",
    nom: "Université Africaine de Management, des Sciences Appliquées et de Télécommunications",
    sigle: "UAMSAT",
    aliases: ["African University of Management, Applied Sciences and Telecommunications"],
    type: TypeEtablissement.UNIVERSITE,
    niveaux: [NiveauEducation.SUPERIEUR],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    sources: [grandFrere("universite-africaine-de-management-des-sciences-appliquees-et-de-telecommunications-uamsat"), { code: "whed", identifiantExterne: "IAU-031350", confiance: 0.95 }],
  },
  {
    key: "ml-bazo",
    nom: "Complexe Scolaire et Universitaire Privé BAZO",
    sigle: "CSUP-BAZO",
    aliases: ["Bazo Private School and University Complex"],
    type: TypeEtablissement.ECOLE_SUPERIEURE,
    niveaux: [NiveauEducation.PRIMAIRE, NiveauEducation.FONDAMENTAL, NiveauEducation.SECONDAIRE, NiveauEducation.SUPERIEUR],
    ville: "Bamako",
    statut: StatutEtablissement.PRIVE,
    sources: [grandFrere("universite-bazo"), { code: "whed", identifiantExterne: "IAU-031274", confiance: 0.95 }],
  },
  ...[
    ["ml-kankou-moussa", "Université Kankou Moussa", "UKM", "universite-kankou-moussa", TypeEtablissement.UNIVERSITE],
    ["ml-ispric", "Institut des Sciences Politiques, Relations Internationales et Communications", "ISPRIC", "ispric", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-ihem", "Institut des Hautes Études en Management", "IHEM", "institut-des-hautes-etudes-en-management-ihem", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-estm", "École Supérieure de Technologie et de Management", "ESTM", "ecole-superieure-de-technologie-et-de-management-estm", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-supmanagement", "École Supérieure de Management du Commerce et d’Informatique", "SUP’MANAGEMENT", "112385", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-technolab", "Institut Supérieur de Technologies Appliquées", "TechnoLAB-ISTA", "institut-superieur-de-technologie-et-de-gestion-istg-2", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-istag", "Institut Supérieur de Technologie Appliquée et de Gestion", "ISTAG", "istag", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-espgm", "École Supérieure Privée de Géologie et des Mines", "ESPGM", "espgm", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-esgic", "École Supérieure de Gestion d’Informatique et de Comptabilité", "ESGIC", "ecole-superieure-de-gestion-dinformatique-et-de-comptabilite-esgic", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-itma", "Institut Africain de Technologies et de Management", "ITMA", "institut-africain-de-technologies-et-de-management-itma", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-intec-sup", "Institut Supérieur des Techniques Économiques, Comptables et Commerciales", "INTEC SUP", "institut-superieur-des-techniques-economiques-comptables-et-commerciales-intec-sup", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-upmsc", "Université Privée Mary Saint Claire", "UPMSC", "universite-privee-mary-saint-claire-upmsc", TypeEtablissement.UNIVERSITE],
    ["ml-escaep", "École Spéciale Privée de Commerce, d’Administration et de l’Entrepreneuriat", "ESCAE-P", "ecole-speciale-privee-de-commerce-dadministration-et-de-lentrepreneuriat-escae-p", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-ens", "École Normale Supérieure de Bamako", "ENSup", "ecole-normale-superieure-de-bamako", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-hetec", "École Supérieure des Hautes Études Technologiques et Commerciales", "HETEC Mali", "ecole-superieure-des-hautes-etudes-technologiques-et-commerciales-hetec-mali", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-upmh", "Université Privée Prince Moulay Hassan", "UPMH", "universite-privee-prince-moulay-hassan-upmh", TypeEtablissement.UNIVERSITE],
    ["ml-upmkd", "Université Privée Modibo Kane Dilly", "UPMKD", "universite-privee-modibo-kane-dilly-upmkd", TypeEtablissement.UNIVERSITE],
    ["ml-enetp", "École Normale d’Enseignement Technique et Professionnel", "ENETP", "ecole-normale-denseignement-technique-et-professionnel", TypeEtablissement.ECOLE_SUPERIEURE],
    ["ml-esc", "École Supérieure de Commerce — Mali School of Management Bamako", "ESC Mali", "esc-mali", TypeEtablissement.ECOLE_SUPERIEURE],
  ].map<InstitutionSeed>(([key, nom, sigle, slug, type]) => ({
    key: String(key), nom: String(nom), sigle: String(sigle), type: type as TypeEtablissement,
    niveaux: [NiveauEducation.SUPERIEUR],
    ville: "Bamako",
    statut: key === "ml-ens" || key === "ml-enetp"
      ? StatutEtablissement.PUBLIC
      : StatutEtablissement.PRIVE,
    sources: [grandFrere(String(slug))],
  })),
  ...[
    ["ml-usttb", "Université des Sciences, des Techniques et des Technologies de Bamako", "USTTB", "Bamako"],
    ["ml-ussgb", "Université des Sciences Sociales et de Gestion de Bamako", "USSGB", "Bamako"],
    ["ml-ulshb", "Université Yambo Ouologuem de Bamako", "UYOB", "Bamako"],
    ["ml-usjpb", "Université Kurukan Fuga de Bamako", "UKB", "Bamako"],
    ["ml-segou", "Université de Ségou", "US", "Ségou"],
    ["ml-sikasso", "Université de Sikasso", "USi", "Sikasso"],
  ].map<InstitutionSeed>(([key, nom, sigle, ville]) => ({
    key,
    nom,
    sigle,
    aliases: key === "ml-ulshb"
      ? [
        "ULSHB",
        "Université des Lettres et des Sciences Humaines de Bamako",
        "Université des Lettres, Langues et des Sciences Humaines de Bamako",
      ]
      : key === "ml-usjpb"
        ? [
          "USJPB",
          "Université des Sciences Juridiques et Politiques de Bamako",
          "Université Kurukanfuga de Bamako",
        ]
        : undefined,
    type: TypeEtablissement.UNIVERSITE,
    niveaux: [NiveauEducation.SUPERIEUR], ville, statut: StatutEtablissement.PUBLIC,
    sources: [
      { code: "wikidata", identifiantExterne: `reference:${key}`, confiance: 0.7 },
      ...(key === "ml-usjpb" ? [grandFrere("luniversite-des-sciences-juridiques-et-politiques-de-bamako-usjpb")] : []),
    ],
  })),
  {
    key: "ml-ipr-ifra",
    nom: "Institut Polytechnique Rural de Formation et de Recherche Appliquée",
    sigle: "IPR/IFRA",
    type: TypeEtablissement.ECOLE_SUPERIEURE,
    niveaux: [NiveauEducation.SUPERIEUR],
    ville: "Katibougou",
    statut: StatutEtablissement.PUBLIC,
    siteWeb: "https://www.ipr-ifra.edu.ml/",
    sources: [grandFrere("institut-polytechnique-rural-de-formation-et-de-recherche-appliquee-ipr-ifra", 0.88)],
  },
];

export const INSTITUTIONS_INTERNATIONALES: InstitutionSeed[] = [
  {
    key: "fr-universite-paris-cite",
    nom: "Université Paris Cité",
    sigle: "UPCité",
    aliases: [
      "Université de Paris",
      "Université Paris Descartes",
      "Université René Descartes (Paris V)",
      "Université Paris V",
      "Université Paris Diderot",
      "Université Denis Diderot (Paris VII)",
      "Université Diderot Paris 7",
      "Université Paris VII",
    ],
    type: TypeEtablissement.UNIVERSITE,
    niveaux: [NiveauEducation.SUPERIEUR],
    ville: "Paris",
    statut: StatutEtablissement.PUBLIC,
    siteWeb: "https://u-paris.fr/",
    sources: [
      { code: "esr-fr", identifiantExterne: "0755976N", confiance: 0.98 },
    ],
  },
];

export const SERIES_PAR_PAYS: Record<string, string[]> = {
  ML: [
    "Série TSE — sciences exactes",
    "Série TSEXP — sciences expérimentales",
    "Série TSECO — sciences économiques",
    "Série TSS — sciences sociales",
    "Série TLL — langues et littérature",
    "Série TAL — arts et lettres",
    "Série STI — sciences et technologies industrielles",
    "Série STI-GC — génie civil",
    "Série STI-GM — génie mécanique",
    "Série STI-GEN — génie énergétique",
    "Série STI-GEL — génie électrique",
    "Série STI-GELN — génie électronique",
    "Série STI-GMI — génie minier",
    "Série STG — sciences et technologies de gestion",
    "Série STG-CF — comptabilité et finance",
    "Série STG-GCO — gestion et commerce",
  ],
  FR: ["Baccalauréat général — mathématiques", "Baccalauréat général — physique-chimie", "Baccalauréat général — sciences de la vie et de la Terre", "Baccalauréat général — sciences économiques et sociales", "Baccalauréat général — numérique et sciences informatiques", "Baccalauréat technologique STMG", "Baccalauréat technologique STI2D", "Baccalauréat technologique ST2S", "Baccalauréat professionnel"],
  CI: ["Série A1 — lettres et mathématiques", "Série A2 — lettres et langues", "Série C — mathématiques et sciences physiques", "Série D — mathématiques et sciences de la vie", "Série E — mathématiques et technique", "Série F — technique industrielle", "Série G — économie et gestion"],
  NG: ["Science", "Arts and Humanities", "Commercial / Business Studies", "Technical and Vocational Studies", "Agricultural Science"],
  NE: ["Série A — lettres et sciences humaines", "Série C — mathématiques et sciences physiques", "Série D — mathématiques et sciences naturelles", "Série E — mathématiques et technique", "Série F — technique industrielle", "Série G — économie et gestion"],
  MR: ["Série C — mathématiques", "Série D — sciences naturelles", "Série A — lettres modernes", "Série O — lettres originelles", "Série T — technique"],
};

// Le lycée Liberté suit le système français. Les anciennes séries restent
// proposées pour permettre aux anciens élèves de décrire fidèlement leur bac ;
// les spécialités correspondent à l'offre homologuée 2025-2026 de l'établissement.
export const SERIES_LYCEE_FRANCAIS_LIBERTE: ProgrammeSeed[] = [
  { key: "liberte-bac-ancienne-s", nom: "Ancienne série S — scientifique", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-ancienne-es", nom: "Ancienne série ES — économique et social", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-ancienne-l", nom: "Ancienne série L — littéraire", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-hggsp", nom: "Spécialité HGGSP — histoire-géographie, géopolitique et sciences politiques", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-hlp", nom: "Spécialité HLP — humanités, littérature et philosophie", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-llcer-anglais", nom: "Spécialité LLCER — anglais", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-llcer-amc", nom: "Spécialité LLCER — anglais, monde contemporain", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-mathematiques", nom: "Spécialité Mathématiques", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-nsi", nom: "Spécialité NSI — numérique et sciences informatiques", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-physique-chimie", nom: "Spécialité Physique-chimie", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-svt", nom: "Spécialité SVT — sciences de la vie et de la Terre", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
  { key: "liberte-bac-ses", nom: "Spécialité SES — sciences économiques et sociales", paysCode: "FR", type: TypeProgrammeEducation.SERIE, niveau: NiveauEducation.SECONDAIRE, sourceCode: "eduscol-bac-fr" },
];

export const SERIES_GENERIQUES = [
  "Sciences et mathématiques", "Sciences de la vie et de la terre", "Économie et sciences sociales",
  "Lettres, langues et philosophie", "Sciences humaines", "Technologies et ingénierie",
  "Gestion, commerce et comptabilité", "Santé et sciences médico-sociales", "Agriculture et environnement",
  "Arts et création", "Formation professionnelle ou technique",
];

export const DIPLOMES_PAR_PAYS: Record<string, Array<{ nom: string; niveau: NiveauEducation; sigle?: string }>> = {
  ML: [
    { nom: "Diplôme d’études fondamentales", sigle: "DEF", niveau: NiveauEducation.FONDAMENTAL },
    { nom: "Baccalauréat malien", niveau: NiveauEducation.SECONDAIRE },
    { nom: "Brevet de technicien", sigle: "BT", niveau: NiveauEducation.PROFESSIONNEL },
    { nom: "Certificat d’aptitude professionnelle", sigle: "CAP", niveau: NiveauEducation.PROFESSIONNEL },
    { nom: "Diplôme universitaire de technicien supérieur", sigle: "DUTS", niveau: NiveauEducation.SUPERIEUR },
    { nom: "Diplôme universitaire de technologie", sigle: "DUT", niveau: NiveauEducation.SUPERIEUR },
    { nom: "Diplôme interuniversitaire", sigle: "DIU", niveau: NiveauEducation.SUPERIEUR },
    { nom: "Maîtrise", niveau: NiveauEducation.SUPERIEUR },
    { nom: "Licence professionnelle", niveau: NiveauEducation.SUPERIEUR },
    { nom: "Licence", niveau: NiveauEducation.SUPERIEUR }, { nom: "Bachelor", niveau: NiveauEducation.SUPERIEUR },
    { nom: "Master", niveau: NiveauEducation.SUPERIEUR }, { nom: "Diplôme d’ingénieur", niveau: NiveauEducation.SUPERIEUR },
    { nom: "MBA", niveau: NiveauEducation.FORMATION_CONTINUE }, { nom: "Doctorat / PhD", niveau: NiveauEducation.SUPERIEUR },
  ],
  FR: [
    { nom: "Diplôme national du brevet", sigle: "DNB", niveau: NiveauEducation.FONDAMENTAL },
    { nom: "Baccalauréat général", niveau: NiveauEducation.SECONDAIRE }, { nom: "Baccalauréat technologique", niveau: NiveauEducation.SECONDAIRE },
    { nom: "Baccalauréat professionnel", niveau: NiveauEducation.PROFESSIONNEL }, { nom: "CAP", niveau: NiveauEducation.PROFESSIONNEL },
    { nom: "BTS / BTSA", niveau: NiveauEducation.SUPERIEUR }, { nom: "DUT / BUT", niveau: NiveauEducation.SUPERIEUR },
    { nom: "Licence", niveau: NiveauEducation.SUPERIEUR }, { nom: "Master", niveau: NiveauEducation.SUPERIEUR },
    { nom: "Diplôme d’ingénieur", niveau: NiveauEducation.SUPERIEUR }, { nom: "Doctorat / PhD", niveau: NiveauEducation.SUPERIEUR },
  ],
  CI: [{ nom: "BEPC", niveau: NiveauEducation.FONDAMENTAL }, { nom: "Baccalauréat ivoirien", niveau: NiveauEducation.SECONDAIRE }, { nom: "BTS", niveau: NiveauEducation.SUPERIEUR }, { nom: "Licence", niveau: NiveauEducation.SUPERIEUR }, { nom: "Master", niveau: NiveauEducation.SUPERIEUR }, { nom: "Doctorat / PhD", niveau: NiveauEducation.SUPERIEUR }],
  NG: [{ nom: "Basic Education Certificate / JSCE", niveau: NiveauEducation.FONDAMENTAL }, { nom: "WASSCE / WAEC", niveau: NiveauEducation.SECONDAIRE }, { nom: "SSCE / NECO", niveau: NiveauEducation.SECONDAIRE }, { nom: "National Diploma", sigle: "ND", niveau: NiveauEducation.SUPERIEUR }, { nom: "Higher National Diploma", sigle: "HND", niveau: NiveauEducation.SUPERIEUR }, { nom: "Bachelor’s degree", niveau: NiveauEducation.SUPERIEUR }, { nom: "Master’s degree", niveau: NiveauEducation.SUPERIEUR }, { nom: "Doctorate / PhD", niveau: NiveauEducation.SUPERIEUR }],
  NE: [{ nom: "BEPC", niveau: NiveauEducation.FONDAMENTAL }, { nom: "Baccalauréat nigérien", niveau: NiveauEducation.SECONDAIRE }, { nom: "Licence", niveau: NiveauEducation.SUPERIEUR }, { nom: "Master", niveau: NiveauEducation.SUPERIEUR }, { nom: "Doctorat / PhD", niveau: NiveauEducation.SUPERIEUR }],
  MR: [{ nom: "BEPC", niveau: NiveauEducation.FONDAMENTAL }, { nom: "Baccalauréat mauritanien", niveau: NiveauEducation.SECONDAIRE }, { nom: "Licence", niveau: NiveauEducation.SUPERIEUR }, { nom: "Master", niveau: NiveauEducation.SUPERIEUR }, { nom: "Doctorat / PhD", niveau: NiveauEducation.SUPERIEUR }],
};

export const DIPLOMES_GENERIQUES = [
  { nom: "Certificat de fin d’études primaires", niveau: NiveauEducation.PRIMAIRE },
  { nom: "Brevet ou certificat de fin d’études fondamentales", niveau: NiveauEducation.FONDAMENTAL },
  { nom: "Baccalauréat ou diplôme de fin d’études secondaires", niveau: NiveauEducation.SECONDAIRE },
  { nom: "Certificat technique ou professionnel", niveau: NiveauEducation.PROFESSIONNEL },
  { nom: "Diplôme court de l’enseignement supérieur", niveau: NiveauEducation.SUPERIEUR },
  { nom: "Licence / Bachelor", niveau: NiveauEducation.SUPERIEUR },
  { nom: "Master", niveau: NiveauEducation.SUPERIEUR },
  { nom: "Diplôme d’ingénieur", niveau: NiveauEducation.SUPERIEUR },
  { nom: "Doctorat / PhD", niveau: NiveauEducation.SUPERIEUR },
];

const domaines: Array<[string, string, string[]]> = [
  ["education", "Sciences de l’éducation", ["Enseignement primaire", "Enseignement secondaire", "Pédagogie", "Administration de l’éducation", "Éducation spécialisée"]],
  ["arts", "Arts, design et création", ["Arts plastiques", "Design", "Musique", "Arts du spectacle", "Audiovisuel", "Mode"]],
  ["humanites", "Lettres, langues et humanités", ["Littérature", "Langues étrangères", "Linguistique", "Histoire", "Philosophie"]],
  ["sciences-sociales", "Sciences sociales et comportementales", ["Économie", "Science politique", "Sociologie", "Psychologie", "Anthropologie", "Géographie"]],
  ["communication", "Information et communication", ["Journalisme", "Communication", "Médias numériques", "Documentation"]],
  ["gestion", "Commerce, administration et gestion", ["Gestion", "Finance", "Comptabilité", "Marketing", "Ressources humaines", "Entrepreneuriat", "Logistique"]],
  ["droit", "Droit", ["Droit privé", "Droit public", "Droit international", "Droit des affaires", "Droit fiscal"]],
  ["biologie", "Sciences biologiques", ["Biologie", "Biochimie", "Biotechnologies", "Génétique", "Microbiologie", "Écologie"]],
  ["environnement", "Environnement", ["Sciences de l’environnement", "Gestion des ressources naturelles", "Climat", "Développement durable"]],
  ["sciences-physiques", "Sciences physiques", ["Physique", "Chimie", "Sciences de la Terre", "Astronomie"]],
  ["mathematiques", "Mathématiques et statistiques", ["Mathématiques", "Mathématiques appliquées", "Statistiques", "Actuariat"]],
  ["informatique", "Informatique et systèmes d’information", ["Génie logiciel", "Systèmes d’information", "Science des données", "Intelligence artificielle", "Cybersécurité", "Réseaux", "Informatique de gestion"]],
  ["ingenierie", "Ingénierie", ["Génie civil", "Génie mécanique", "Génie électrique", "Électronique", "Télécommunications", "Génie industriel", "Énergétique"]],
  ["architecture", "Architecture, urbanisme et construction", ["Architecture", "Urbanisme", "Aménagement du territoire", "Bâtiment et travaux publics"]],
  ["agriculture", "Agriculture, foresterie et pêche", ["Agronomie", "Productions végétales", "Productions animales", "Foresterie", "Pêche et aquaculture"]],
  ["sante", "Santé", ["Médecine", "Pharmacie", "Odontologie", "Sciences infirmières", "Maïeutique", "Santé publique", "Analyses biomédicales", "Kinésithérapie"]],
  ["services", "Services", ["Hôtellerie et restauration", "Tourisme", "Transport", "Sécurité", "Sport", "Services à la personne"]],
];

export const PROGRAMMES_GENERIQUES: ProgrammeSeed[] = domaines.flatMap(([key, nom, enfants]) => [
  { key: `global-${key}`, nom, type: TypeProgrammeEducation.FORMATION, niveau: NiveauEducation.SUPERIEUR, sourceCode: "unesco-isced" },
  ...enfants.map((enfant, index) => ({
    key: `global-${key}-${index}`,
    nom: enfant,
    type: TypeProgrammeEducation.FILIERE,
    niveau: NiveauEducation.SUPERIEUR,
    parentKey: `global-${key}`,
    sourceCode: "unesco-isced",
  })),
]);

export const PROGRAMMES_SPECIFIQUES: ProgrammeSeed[] = [
  { key: "fr-meci", nom: "Master — Métiers des études, du conseil et de l’intervention", sigle: "MECI", paysCode: "FR", type: TypeProgrammeEducation.FORMATION, niveau: NiveauEducation.SUPERIEUR, sourceCode: "esr-fr" },
  { key: "fr-meci-pise", nom: "Projets informatiques et stratégie d’entreprise", sigle: "PISE", paysCode: "FR", type: TypeProgrammeEducation.PARCOURS, niveau: NiveauEducation.SUPERIEUR, parentKey: "fr-meci", sourceCode: "esr-fr" },
  { key: "fr-meci-adl", nom: "Aménagement et développement local", sigle: "ADL", paysCode: "FR", type: TypeProgrammeEducation.PARCOURS, niveau: NiveauEducation.SUPERIEUR, parentKey: "fr-meci", sourceCode: "esr-fr" },
  { key: "fr-meci-ccese", nom: "Consultants et chargés d’études socio-économiques et environnementales", sigle: "CCESE", paysCode: "FR", type: TypeProgrammeEducation.PARCOURS, niveau: NiveauEducation.SUPERIEUR, parentKey: "fr-meci", sourceCode: "esr-fr" },
  { key: "ml-iam-bachelor-admin", nom: "Bachelor — Administration des affaires", paysCode: "ML", type: TypeProgrammeEducation.FORMATION, niveau: NiveauEducation.SUPERIEUR, sourceCode: "legrandfrere-mali" },
  ...["Marketing et intelligence des affaires", "Banque et ingénierie financière", "Audit et contrôle de gestion", "Gestion logistique et transport", "Gestion des ressources humaines"].map((nom, index) => ({ key: `ml-iam-bachelor-admin-${index}`, nom, paysCode: "ML", type: TypeProgrammeEducation.SPECIALITE, niveau: NiveauEducation.SUPERIEUR, parentKey: "ml-iam-bachelor-admin", sourceCode: "legrandfrere-mali" })),
  { key: "ml-iam-bachelor-info", nom: "Bachelor — Informatique de gestion", paysCode: "ML", type: TypeProgrammeEducation.FORMATION, niveau: NiveauEducation.SUPERIEUR, sourceCode: "legrandfrere-mali" },
  ...["Développement d’applications", "Réseaux et systèmes"].map((nom, index) => ({ key: `ml-iam-bachelor-info-${index}`, nom, paysCode: "ML", type: TypeProgrammeEducation.SPECIALITE, niveau: NiveauEducation.SUPERIEUR, parentKey: "ml-iam-bachelor-info", sourceCode: "legrandfrere-mali" })),
  { key: "ml-iam-licence-droit", nom: "Licence — Droit des affaires", paysCode: "ML", type: TypeProgrammeEducation.FORMATION, niveau: NiveauEducation.SUPERIEUR, sourceCode: "legrandfrere-mali" },
  { key: "ml-iam-master", nom: "Master spécialisé", paysCode: "ML", type: TypeProgrammeEducation.FORMATION, niveau: NiveauEducation.SUPERIEUR, sourceCode: "legrandfrere-mali" },
  ...["Marketing et intelligence des affaires", "Banque et ingénierie financière", "Audit et contrôle de gestion", "Gestion des ressources humaines", "Gestion de projets", "Transport et logistique", "Développement d’applications", "Systèmes informatiques communicants", "Droit des affaires"].map((nom, index) => ({ key: `ml-iam-master-${index}`, nom, paysCode: "ML", type: TypeProgrammeEducation.SPECIALITE, niveau: NiveauEducation.SUPERIEUR, parentKey: "ml-iam-master", sourceCode: "legrandfrere-mali" })),
  { key: "ml-iam-mba", nom: "Executive MBA", sigle: "MBA", paysCode: "ML", type: TypeProgrammeEducation.FORMATION, niveau: NiveauEducation.FORMATION_CONTINUE, sourceCode: "legrandfrere-mali" },
  ...["Gestion de projet", "Finance", "Transport et logistique", "Gestion des ressources humaines", "Marketing"].map((nom, index) => ({ key: `ml-iam-mba-${index}`, nom, paysCode: "ML", type: TypeProgrammeEducation.SPECIALITE, niveau: NiveauEducation.FORMATION_CONTINUE, parentKey: "ml-iam-mba", sourceCode: "legrandfrere-mali" })),
  { key: "ml-ipr-agriculture", nom: "Agriculture et développement rural", paysCode: "ML", type: TypeProgrammeEducation.FORMATION, niveau: NiveauEducation.SUPERIEUR, sourceCode: "legrandfrere-mali" },
  ...["Agronomie", "Élevage", "Halieutique", "Économie rurale", "Gestion des ressources naturelles"].map((nom, index) => ({ key: `ml-ipr-agriculture-${index}`, nom, paysCode: "ML", type: TypeProgrammeEducation.FILIERE, niveau: NiveauEducation.SUPERIEUR, parentKey: "ml-ipr-agriculture", sourceCode: "legrandfrere-mali" })),
];

export const OFFRES_SPECIFIQUES: Array<{ institutionKey: string; programmeKey: string; diplomes: string[] }> = [
  { institutionKey: "ml-iam", programmeKey: "ml-iam-bachelor-admin", diplomes: ["Bachelor"] },
  { institutionKey: "ml-iam", programmeKey: "ml-iam-bachelor-info", diplomes: ["Bachelor"] },
  { institutionKey: "ml-iam", programmeKey: "ml-iam-licence-droit", diplomes: ["Licence"] },
  { institutionKey: "ml-iam", programmeKey: "ml-iam-master", diplomes: ["Master"] },
  { institutionKey: "ml-iam", programmeKey: "ml-iam-mba", diplomes: ["MBA"] },
  { institutionKey: "ml-ipr-ifra", programmeKey: "ml-ipr-agriculture", diplomes: ["Diplôme universitaire de technicien supérieur", "Licence", "Diplôme d’ingénieur", "Master", "Doctorat / PhD"] },
  { institutionKey: "fr-universite-paris-cite", programmeKey: "fr-meci", diplomes: ["Master"] },
];

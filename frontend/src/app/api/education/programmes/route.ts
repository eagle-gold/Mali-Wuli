import { NextRequest, NextResponse } from "next/server";
import { getProgrammes, type ProgrammeReference } from "@/lib/education/reference";

export const runtime = "nodejs";
const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";

const normaliser = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const echapperOds = (valeur: string) => valeur.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const phrase = (valeur: string) => {
  const propre = valeur.trim().replace(/\s+/g, " ");
  if (!propre || propre !== propre.toUpperCase()) return propre;
  const minuscules = propre.toLocaleLowerCase("fr");
  return minuscules.charAt(0).toLocaleUpperCase("fr") + minuscules.slice(1);
};

const formaterMention = (valeur: string) =>
  phrase(valeur)
    .replace(/^Metiers des etudes/i, "Métiers des études")
    .replace(/\(meci\)/i, "(MECI)");

const ajouterAcronymeParcours = (valeur: string) => {
  const parcours = phrase(valeur);
  if (/projets informatiques et strat[ée]gie d['’]entreprise/i.test(valeur)) {
    return "PISE — Projets informatiques et stratégie d’entreprise";
  }
  if (/^am[ée]nagement et d[ée]veloppement local$/i.test(valeur)) {
    return "ADL — Aménagement et développement local";
  }
  if (/^consultants et charg[ée]s d['’][ée]tudes socio/i.test(valeur)) {
    return "CCESE — Consultants et chargés d’études socio-économiques et environnementales";
  }
  return parcours;
};

const lireJson = async <T,>(url: string) => {
  const reponse = await fetch(url, {
    headers: { "User-Agent": "MaliWuli/0.1 (education directory)" },
    signal: AbortSignal.timeout(7_000),
    next: { revalidate: 86_400 },
  });
  if (!reponse.ok) throw new Error(`Source distante indisponible (${reponse.status}).`);
  return reponse.json() as Promise<T>;
};

const chercherMonMaster = async (uai: string, recherche: string): Promise<ProgrammeReference[]> => {
  const conditions = [`session=2025`, `eta_uai="${uai}"`];
  if (recherche) {
    const q = echapperOds(recherche);
    conditions.push(`(search(mention,"${q}") or search(parcours,"${q}"))`);
  }
  const parametres = new URLSearchParams({
    select: "inm,mention,parcours",
    where: conditions.join(" and "),
    order_by: "mention,parcours",
    limit: "100",
  });
  const url = `https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-mon_master/records?${parametres}`;
  const donnees = await lireJson<{
    results?: Array<{ inm: string; mention: string; parcours?: string }>;
  }>(url);

  const programmes = new Map<string, ProgrammeReference>();
  for (const resultat of donnees.results || []) {
    const id = `monmaster:${resultat.inm || normaliser(resultat.mention)}`;
    const label = `Master — ${formaterMention(resultat.mention)}`;
    const specialite = resultat.parcours ? ajouterAcronymeParcours(resultat.parcours) : "Parcours général";
    const existant = programmes.get(id);
    if (existant) {
      if (!existant.specialites.includes(specialite)) existant.specialites.push(specialite);
    } else {
      programmes.set(id, {
        id,
        label,
        specialites: [specialite, "Autre"],
        diplomes: ["Master (Bac+5)"],
        diplomeSuggere: "Master (Bac+5)",
      });
    }
  }
  return [...programmes.values()];
};

const diplomeParType = (type: string) => {
  const cle = normaliser(type);
  if (cle.includes("bts")) return "BTS / BTSA";
  if (cle.includes("but") || cle.includes("dut")) return "DUT / BUT";
  if (cle.includes("licence")) return "Licence (Bac+3)";
  if (cle.includes("ingenieur")) return "Diplôme d’ingénieur";
  return undefined;
};

const chercherParcoursup = async (uai: string, recherche: string): Promise<ProgrammeReference[]> => {
  const conditions = [`annee=2026`, `etab_uai="${uai}"`];
  if (recherche) {
    const q = echapperOds(recherche);
    conditions.push(`(search(nm,"${q}") or search(fl,"${q}"))`);
  }
  const parametres = new URLSearchParams({
    select: "code_formation,tf,fl,nm",
    where: conditions.join(" and "),
    order_by: "fl",
    limit: "100",
  });
  const url = `https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-cartographie_formations_parcoursup/records?${parametres}`;
  const donnees = await lireJson<{
    results?: Array<{
      code_formation?: string;
      tf?: string[];
      fl?: string[];
      nm?: string[];
    }>;
  }>(url);

  return (donnees.results || []).flatMap((resultat, index) => {
    const formations = resultat.fl?.length ? resultat.fl : resultat.tf || [];
    const specialites = resultat.nm?.length ? resultat.nm : ["Parcours général"];
    return formations.map((formation, formationIndex) => {
      const diplomeSuggere = diplomeParType(resultat.tf?.[0] || formation);
      return {
        id: `parcoursup:${resultat.code_formation || `${index}-${formationIndex}`}`,
        label: phrase(formation),
        specialites: [...new Set([...specialites.map(phrase), "Autre"])],
        diplomes: diplomeSuggere ? [diplomeSuggere] : [],
        diplomeSuggere,
      };
    });
  });
};

const chercherCatalogue = async (
  paysCode: string,
  institutionId: string,
  recherche: string,
): Promise<{ programmes: ProgrammeReference[]; couvertureEtablissement: boolean }> => {
  const parametres = new URLSearchParams({ country: paysCode });
  if (institutionId) parametres.set("institutionId", institutionId);
  if (recherche) parametres.set("q", recherche);
  const reponse = await fetch(`${BACKEND_API}/education/catalogue/programmes?${parametres}`, {
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!reponse.ok) throw new Error(`Catalogue Mali Wuli indisponible (${reponse.status}).`);
  const donnees = await reponse.json() as {
    programmes?: ProgrammeReference[];
    couvertureEtablissement?: boolean;
  };
  return {
    programmes: donnees.programmes || [],
    couvertureEtablissement: Boolean(donnees.couvertureEtablissement),
  };
};

const fusionner = (programmes: ProgrammeReference[]) => {
  const uniques = new Map<string, ProgrammeReference>();
  for (const programme of programmes) {
    const cle = normaliser(programme.label);
    const existant = uniques.get(cle);
    if (!existant) {
      uniques.set(cle, {
        ...programme,
        specialites: [...programme.specialites],
        diplomes: [...(programme.diplomes || [])],
      });
      continue;
    }
    for (const specialite of programme.specialites) {
      if (!existant.specialites.some((item) => normaliser(item) === normaliser(specialite))) {
        existant.specialites.push(specialite);
      }
    }
    if (!existant.diplomeSuggere && programme.diplomeSuggere) {
      existant.diplomeSuggere = programme.diplomeSuggere;
    }
    for (const diplome of programme.diplomes || []) {
      if (!(existant.diplomes || []).some((item) => normaliser(item) === normaliser(diplome))) {
        existant.diplomes = [...(existant.diplomes || []), diplome];
      }
    }
  }
  return [...uniques.values()].slice(0, 120).map((programme) => ({
    ...programme,
    specialites: [
      ...programme.specialites.filter((specialite) => normaliser(specialite) !== "autre"),
      "Autre",
    ],
  }));
};

export async function GET(request: NextRequest) {
  const paysCode = (request.nextUrl.searchParams.get("country") || "").toUpperCase();
  const institutionId = (request.nextUrl.searchParams.get("institutionId") || "").trim();
  const recherche = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  if (!/^[A-Z]{2}$/.test(paysCode)) {
    return NextResponse.json({ message: "Code pays invalide." }, { status: 400 });
  }

  const rechercheNormalisee = normaliser(recherche);
  const references = getProgrammes(paysCode).filter((programme) => {
    if (!rechercheNormalisee) return true;
    return normaliser(`${programme.label} ${programme.specialites.join(" ")}`).includes(rechercheNormalisee);
  });

  const recherches: Array<Promise<ProgrammeReference[]>> = [];
  if (paysCode === "FR" && /^[0-9]{7}[A-Z]$/.test(institutionId)) {
    recherches.push(chercherMonMaster(institutionId, recherche));
    recherches.push(chercherParcoursup(institutionId, recherche));
  }
  const [catalogue, distants] = await Promise.all([
    chercherCatalogue(paysCode, institutionId, recherche).catch(() => ({
      programmes: [] as ProgrammeReference[],
      couvertureEtablissement: false,
    })),
    Promise.allSettled(recherches),
  ]);
  const programmesDistants = distants.flatMap((resultat) =>
    resultat.status === "fulfilled" ? resultat.value : [],
  );
  const programmes = catalogue.couvertureEtablissement
    ? fusionner([...programmesDistants, ...catalogue.programmes])
    : fusionner([...programmesDistants, ...catalogue.programmes, ...references]);

  return NextResponse.json({
    programmes,
    couvertureEtablissement: catalogue.couvertureEtablissement || programmesDistants.length > 0,
    sources: ["Catalogue relationnel Mali Wuli", "Mon Master", "Parcoursup", "UNESCO ISCED-F 2013"],
  });
}

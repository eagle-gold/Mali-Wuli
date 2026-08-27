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

  const catalogue = await chercherCatalogue(paysCode, institutionId, recherche).catch(() => ({
    programmes: [] as ProgrammeReference[],
    couvertureEtablissement: false,
  }));
  const programmes = catalogue.couvertureEtablissement
    ? fusionner(catalogue.programmes)
    : fusionner([...catalogue.programmes, ...references]);

  return NextResponse.json({
    programmes,
    couvertureEtablissement: catalogue.couvertureEtablissement,
    sources: [
      "Catalogue PostgreSQL Mali Wuli",
      "Mon Master (import officiel)",
      "Parcoursup (import officiel)",
      "UNESCO ISCED-F 2013",
    ],
  });
}

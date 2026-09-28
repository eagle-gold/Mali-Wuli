import { NextRequest, NextResponse } from "next/server";
import {
  INSTITUTIONS_PRIORITAIRES,
  type FormationType,
  type InstitutionReference,
} from "@/lib/education/reference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TYPES = new Set<FormationType>(["ecole", "lycee", "universite"]);
const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";

const normaliser = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const correspondAuType = (institution: InstitutionReference, type: FormationType) =>
  type === "universite"
    ? institution.type === "universite"
    : institution.type === "ecole" || institution.type === "lycee";

const referencesLocales = (
  paysCode: string,
  type: FormationType,
  ville: string,
  recherche: string,
) => {
  const villeNormalisee = normaliser(ville);
  const termes = normaliser(recherche).split(" ").filter(Boolean);
  return INSTITUTIONS_PRIORITAIRES.filter((institution) => {
    if (institution.paysCode !== paysCode || !correspondAuType(institution, type)) return false;
    if (villeNormalisee && !normaliser(institution.ville || "").includes(villeNormalisee)) return false;
    const nom = normaliser(institution.nom);
    return termes.every((terme) => nom.includes(terme));
  }).map((institution) => ({ ...institution, type }));
};

export async function GET(request: NextRequest) {
  const paysCode = (request.nextUrl.searchParams.get("country") || "").toUpperCase();
  const type = request.nextUrl.searchParams.get("type") as FormationType;
  const ville = (request.nextUrl.searchParams.get("city") || "").trim().slice(0, 100);
  const recherche = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);

  if (!/^[A-Z]{2}$/.test(paysCode) || !TYPES.has(type)) {
    return NextResponse.json({ message: "Pays ou type d’établissement invalide." }, { status: 400 });
  }

  const parametres = new URLSearchParams({ country: paysCode, type });
  if (ville) parametres.set("city", ville);
  if (recherche) parametres.set("q", recherche);
  const secours = referencesLocales(paysCode, type, ville, recherche);

  try {
    const reponse = await fetch(`${BACKEND_API}/education/catalogue/etablissements?${parametres}`, {
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (!reponse.ok) {
      throw new Error(`Catalogue PostgreSQL indisponible (${reponse.status}).`);
    }

    const donnees = await reponse.json() as { institutions?: InstitutionReference[] };
    if (!Array.isArray(donnees.institutions)) {
      throw new Error("Réponse du catalogue d’établissements invalide.");
    }
    // La base conserve les identités canoniques : les références embarquées
    // servent uniquement de secours quand le catalogue est indisponible.
    return NextResponse.json(
      {
        institutions: donnees.institutions,
        stockage: "postgresql",
        cataloguePartiel: false,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("Recherche des établissements dans la base :", error);
    if (secours.length) {
      return NextResponse.json(
        {
          institutions: secours,
          stockage: "references-locales",
          cataloguePartiel: true,
          message: "Le catalogue complet est momentanément indisponible. Les références vérifiées restent proposées.",
        },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
      );
    }
    return NextResponse.json(
      { institutions: [], stockage: "postgresql", message: "Le catalogue est momentanément indisponible." },
      { status: 503 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { FormationType, InstitutionReference } from "@/lib/education/reference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TYPES = new Set<FormationType>(["ecole", "lycee", "universite"]);
const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";

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

  try {
    const reponse = await fetch(`${BACKEND_API}/education/catalogue/etablissements?${parametres}`, {
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (!reponse.ok) {
      throw new Error(`Catalogue PostgreSQL indisponible (${reponse.status}).`);
    }

    const donnees = await reponse.json() as { institutions?: InstitutionReference[] };
    return NextResponse.json(
      {
        institutions: donnees.institutions || [],
        stockage: "postgresql",
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("Recherche PostgreSQL des établissements :", error);
    return NextResponse.json(
      { institutions: [], stockage: "postgresql", message: "Le catalogue est momentanément indisponible." },
      { status: 503 },
    );
  }
}

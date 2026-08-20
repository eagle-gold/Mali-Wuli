import { NextRequest, NextResponse } from "next/server";
import {
  getDiplomes,
  getProgrammes,
  getSeries,
  type FormationType,
} from "@/lib/education/reference";

export const runtime = "nodejs";
export const revalidate = 86_400;
const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";

const TYPES = new Set<FormationType>(["ecole", "lycee", "universite"]);

export async function GET(request: NextRequest) {
  const paysCode = (request.nextUrl.searchParams.get("country") || "").toUpperCase();
  const type = request.nextUrl.searchParams.get("type") as FormationType;
  const institutionId = (request.nextUrl.searchParams.get("institutionId") || "").trim();

  if (!/^[A-Z]{2}$/.test(paysCode) || !TYPES.has(type)) {
    return NextResponse.json({ message: "Pays ou type de formation invalide." }, { status: 400 });
  }

  try {
    const parametres = new URLSearchParams({ country: paysCode, type });
    if (institutionId) parametres.set("institutionId", institutionId);
    const reponse = await fetch(`${BACKEND_API}/education/catalogue/references?${parametres}`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (reponse.ok) {
      const donnees = await reponse.json() as {
        series?: string[];
        diplomes?: string[];
        programmes?: unknown[];
      };
      return NextResponse.json({
        series: donnees.series || [],
        diplomes: donnees.diplomes || [],
        programmes: donnees.programmes || [],
        sources: ["Catalogue relationnel Mali Wuli"],
      });
    }
  } catch {
    // Le référentiel embarqué assure le fonctionnement hors ligne.
  }

  return NextResponse.json({
    series: type === "lycee" ? getSeries(paysCode, institutionId) : [],
    diplomes: getDiplomes(paysCode, type, institutionId),
    programmes: type === "universite" ? getProgrammes(paysCode) : [],
    sources: [
      "https://www.uis.unesco.org/en/methods-and-tools/isced",
      "Référentiels nationaux des pays prioritaires Mali Wuli",
    ],
  });
}

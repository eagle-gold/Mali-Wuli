import { NextResponse } from "next/server";
import countriesData from "@countrystatecity/countries/data/countries.json";
import type { ICountry } from "@countrystatecity/countries";

export const runtime = "nodejs";
export const revalidate = 86_400;

const PAYS_PRIORITAIRES = ["ML", "CI", "NG", "NE", "MR", "FR"];
const NOMS_FRANCAIS_PRIORITAIRES: Record<string, string> = {
  CI: "Côte d’Ivoire",
  NG: "Nigéria",
};
const rangPrioritaire = new Map(
  PAYS_PRIORITAIRES.map((code, index) => [code, index]),
);

export async function GET() {
  const nomsFrancais = new Intl.DisplayNames(["fr"], { type: "region" });
  const collator = new Intl.Collator("fr", { sensitivity: "base" });
  // L'import JSON direct est fiable avec Next.js, contrairement au chargeur
  // dynamique du paquet qui ne retrouve pas toujours son fichier en mode dev.
  const countries = countriesData as ICountry[];

  const pays = countries
    .map((country) => ({
      code: country.iso2,
      nom: NOMS_FRANCAIS_PRIORITAIRES[country.iso2]
        || nomsFrancais.of(country.iso2)
        || country.name,
      indicatif: country.phonecode.replace(/^\+/, ""),
      drapeau: country.emoji,
    }))
    .sort((a, b) => {
      const rangA = rangPrioritaire.get(a.code);
      const rangB = rangPrioritaire.get(b.code);

      if (rangA !== undefined || rangB !== undefined) {
        return (rangA ?? Number.MAX_SAFE_INTEGER) - (rangB ?? Number.MAX_SAFE_INTEGER);
      }

      return collator.compare(a.nom, b.nom);
    });

  return NextResponse.json({
    pays,
    source: "https://github.com/dr5hn/countries-states-cities-database",
  });
}

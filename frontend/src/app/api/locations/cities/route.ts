import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ICity, IState } from "@countrystatecity/countries";

export const runtime = "nodejs";

type Ville = {
  id: number;
  nom: string;
  region: string;
};

const cacheVilles = new Map<string, Promise<Ville[]>>();
const dossierDonnees = path.join(
  process.cwd(),
  "node_modules",
  "@countrystatecity",
  "countries",
  "dist",
  "data",
);

const normaliser = (valeur: string) =>
  valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");

const lireJson = async <T,>(chemin: string) =>
  JSON.parse(await readFile(chemin, "utf8")) as T;

const trouverDossier = (dossiers: string[], code: string) =>
  dossiers.find((dossier) => dossier.endsWith(`-${code}`));

const chargerVilles = (codePays: string) => {
  const villesEnCache = cacheVilles.get(codePays);
  if (villesEnCache) return villesEnCache;

  const chargement = (async () => {
    const dossiersPays = await readdir(dossierDonnees, { withFileTypes: true });
    const dossierPays = trouverDossier(
      dossiersPays.filter((entree) => entree.isDirectory()).map((entree) => entree.name),
      codePays,
    );
    if (!dossierPays) return [];

    const cheminPays = path.join(dossierDonnees, dossierPays);
    const states = await lireJson<IState[]>(path.join(cheminPays, "states.json"));
    const dossiersRegions = await readdir(cheminPays, { withFileTypes: true });
    const nomsDossiersRegions = dossiersRegions
      .filter((entree) => entree.isDirectory())
      .map((entree) => entree.name);
    const cities = (
      await Promise.all(
        states.map(async (state) => {
          const dossierRegion = trouverDossier(nomsDossiersRegions, state.iso2);
          if (!dossierRegion) return [];
          return lireJson<ICity[]>(path.join(cheminPays, dossierRegion, "cities.json"));
        }),
      )
    ).flat();

    const regions = new Map(states.map((state) => [state.iso2, state.name]));
    const villesUniques = new Map<string, Ville>();

    for (const city of cities) {
      const region = regions.get(city.state_code) || city.state_code || "";
      const cle = `${normaliser(city.name)}|${normaliser(region)}`;
      if (!villesUniques.has(cle)) {
        villesUniques.set(cle, { id: city.id, nom: city.name, region });
      }
    }

    return [...villesUniques.values()].sort((a, b) =>
      a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }),
    );
  })();

  cacheVilles.set(codePays, chargement);
  return chargement;
};

export async function GET(request: NextRequest) {
  const codePays = (request.nextUrl.searchParams.get("country") || "").toUpperCase();
  const recherche = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const limiteDemandee = Number(request.nextUrl.searchParams.get("limit") || 60);
  const limite = Number.isFinite(limiteDemandee)
    ? Math.min(Math.max(limiteDemandee, 1), 100)
    : 60;

  if (!/^[A-Z]{2}$/.test(codePays)) {
    return NextResponse.json({ message: "Code pays invalide." }, { status: 400 });
  }

  const toutesLesVilles = await chargerVilles(codePays);
  const rechercheNormalisee = normaliser(recherche);
  const villes = rechercheNormalisee
    ? toutesLesVilles
        .filter((ville) => normaliser(ville.nom).includes(rechercheNormalisee))
        .sort((a, b) => {
          const aCommencePar = normaliser(a.nom).startsWith(rechercheNormalisee);
          const bCommencePar = normaliser(b.nom).startsWith(rechercheNormalisee);
          if (aCommencePar !== bCommencePar) return aCommencePar ? -1 : 1;
          return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
        })
        .slice(0, limite)
    : [];

  return NextResponse.json({
    villes,
    total: toutesLesVilles.length,
    source: "https://github.com/dr5hn/countries-states-cities-database",
  });
}

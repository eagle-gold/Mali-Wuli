/**
 * Affichage de la localisation d'un établissement. Au Mali, `ville` est le
 * chef-lieu de la région (règle du 2026-09-29) ; la localité (village,
 * quartier), la commune, le cercle et la région précisent le lieu.
 */
export type LieuEtablissement = {
  ville?: string | null;
  localite?: string | null;
  commune?: string | null;
  cercle?: string | null;
  region?: string | null;
};

/** Chefs-lieux des régions du Mali (découpage OCHA admin1 + Taoudénit). */
export const CHEFS_LIEUX_MALI = [
  "Bamako", "Gao", "Kayes", "Kidal", "Koulikoro", "Ménaka", "Mopti", "Ségou", "Sikasso", "Taoudéni", "Tombouctou",
] as const;

const cle = (valeur: string) => valeur
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("fr")
  .replace(/[^\p{L}\p{N}]+/gu, "");

export const estChefLieuMali = (ville?: string | null) =>
  Boolean(ville) && CHEFS_LIEUX_MALI.some((chefLieu) => cle(chefLieu) === cle(ville || ""));

/** « Localité · Commune · Cercle · Région », sans répétition ni valeur vide. */
export function detailLieu(lieu: LieuEtablissement) {
  const vus = new Set<string>();
  // Le district de Bamako n'a ni cercle ni région au sens usuel.
  const district = cle(lieu.region || "") === "bamako";
  return [
    lieu.localite,
    lieu.commune,
    lieu.cercle && !district ? `Cercle de ${lieu.cercle}` : null,
    lieu.region ? (district ? "District de Bamako" : `Région de ${lieu.region}`) : null,
  ]
    .map((valeur) => valeur?.trim())
    .filter((valeur): valeur is string => {
      if (!valeur) return false;
      const sansPrefixe = cle(valeur.replace(/^(?:Cercle|Région|District) de /, ""));
      if (vus.has(sansPrefixe)) return false;
      vus.add(sansPrefixe);
      return true;
    })
    .join(" · ");
}

/** « Nom — Localité (Ville) » quand une localité est connue, sinon le nom seul. */
export function nomAvecLocalite(nom: string, lieu: LieuEtablissement) {
  const localite = lieu.localite?.trim();
  if (!localite) return nom;
  const ville = lieu.ville?.trim();
  return ville && cle(ville) !== cle(localite) ? `${nom} — ${localite} (${ville})` : `${nom} — ${localite}`;
}

import { z } from "zod";

export const schemaDiplomeScolaire = z.object({
  type: z.enum(["BREVET", "BAC", "AUTRE"]),
  libelle: z.string().trim().min(1).max(300),
  anneeObtention: z.union([z.string().regex(/^\d{4}$/), z.literal("")]),
  mention: z.string().trim().max(191).default(""),
  serie: z.string().trim().max(300).default(""),
  statut: z.enum(["OBTENU", "EN_COURS"]).default("OBTENU"),
});

export const schemaDiplomesScolaires = z.array(schemaDiplomeScolaire).max(10);
export type DiplomeScolaire = z.infer<typeof schemaDiplomeScolaire>;

export function lireDiplomesScolaires(valeur: unknown): DiplomeScolaire[] | undefined {
  const resultat = schemaDiplomesScolaires.safeParse(valeur);
  return resultat.success ? resultat.data : undefined;
}

type FormationExistante = {
  id?: string;
  type: string;
  etablissementId?: string | null;
  etablissement?: string;
  autreEtablissement?: string | null;
  anneeDebut?: string | number | null;
  anneeFin?: string | number | null;
  systemeEducatifCode?: string | null;
  diplomesScolaires?: unknown;
};

/** Les anciens clients peuvent omettre les deux nouvelles propriétés. */
export function conserverDiplomesExistants<T extends FormationExistante>(formation: T, existantes: FormationExistante[]): T {
  const precedente = existantes.find((item) => formation.id && item.id === formation.id)
    || existantes.find((item) => (item.type === "universite") === (formation.type === "universite")
      && (formation.etablissementId && !formation.etablissementId.startsWith("autre:")
        ? item.etablissementId === formation.etablissementId
        : (item.etablissement || item.autreEtablissement) === formation.etablissement)
      && String(item.anneeDebut) === String(formation.anneeDebut)
      && String(item.anneeFin) === String(formation.anneeFin));
  if (!precedente) return formation;
  return {
    ...formation,
    systemeEducatifCode: formation.systemeEducatifCode ?? precedente.systemeEducatifCode ?? undefined,
    // Un tableau vide explicite signifie que le membre a retiré les diplômes.
    diplomesScolaires: formation.diplomesScolaires ?? lireDiplomesScolaires(precedente.diplomesScolaires),
  };
}

type FormationScolaire = {
  type: string;
  diplome: string;
  diplomeId?: string;
  specialite: string;
  specialiteId?: string;
  mention: string;
  anneePromo: string;
  statutDiplome: string;
  diplomesScolaires?: DiplomeScolaire[];
};

/** Conserve les anciens champs pour les clients et les statistiques existants. */
export function normaliserDiplomesScolaires<T extends FormationScolaire>(formation: T): T {
  if (formation.type === "universite") return formation;
  let diplomes = formation.diplomesScolaires;
  if (diplomes === undefined && formation.diplome
    && ["OBTENU", "EN_COURS"].includes(formation.statutDiplome)) {
    const libelle = formation.diplome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    diplomes = [{
      type: /baccalaureat|\bbac\b/.test(libelle) ? "BAC"
        : /\b(?:bt|bts)\b|brevet\s+(?:(?:de\s+)?technicien|professionnel|des\s+metiers|technique)/.test(libelle) ? "AUTRE"
          : /brevet|\b(?:dnb|def|bepc)\b|fondamental/.test(libelle) ? "BREVET" : "AUTRE",
      libelle: formation.diplome,
      anneeObtention: formation.anneePromo,
      mention: formation.mention,
      serie: formation.specialite,
      statut: formation.statutDiplome as "OBTENU" | "EN_COURS",
    }];
  }
  if (!diplomes) return formation;
  const tries = [...diplomes].sort((a, b) =>
    (Number(a.anneeObtention) || 9999) - (Number(b.anneeObtention) || 9999));
  const principal = tries[tries.length - 1];
  if (!principal) return { ...formation, diplomesScolaires: tries };
  return {
    ...formation,
    diplomesScolaires: tries,
    diplome: principal.libelle,
    diplomeId: formation.diplome === principal.libelle ? formation.diplomeId : "",
    specialite: principal.serie,
    specialiteId: formation.specialite === principal.serie ? formation.specialiteId : "",
    mention: principal.mention,
    anneePromo: principal.anneeObtention,
  };
}

export function trierParDate<T extends { anneeDebut: string; moisDebut: string; anneeFin?: string; moisFin?: string }>(entrees: T[]): T[] {
  return [...entrees].sort((a, b) =>
    (Number(a.anneeDebut) * 12 + Number(a.moisDebut))
    - (Number(b.anneeDebut) * 12 + Number(b.moisDebut))
    || (Number(a.anneeFin || 9999) * 12 + Number(a.moisFin || 12))
    - (Number(b.anneeFin || 9999) * 12 + Number(b.moisFin || 12)));
}

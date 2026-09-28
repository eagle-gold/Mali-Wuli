import { TypeEtablissement } from "@prisma/client";
import {
  type AdministrationEcoleMali,
  type CoordonneesEcoleMali,
  distanceMetres,
  normaliserNomCampusMali,
  normaliserTexteEcoleMali,
  signatureAdministrationMali,
  signatureBrancheEcoleMali,
  typesScolairesCompatibles,
} from "./mali-school-registries";

export const SOURCES_REGISTRES_MALI = new Set([
  "ocha-men-mali-schools-2023",
  "unicef-men-mali-schools-2013",
]);

const SOURCE_2013 = "unicef-men-mali-schools-2013";
const SOURCE_2023 = "ocha-men-mali-schools-2023";
const MOTS_GENERIQUES = new Set([
  "academie", "centre", "college", "complexe", "ecole", "ecoles", "enseignement",
  "etablissement", "etablissements", "fondamental", "fondamentale", "fondamentales",
  "groupe", "groupes", "lycee", "maternelle", "prive", "privee", "public", "publique",
  "primaire", "scolaire", "scolaires", "secondaire", "cycle", "premier", "second",
  "communautaire", "medersa", "medersas", "madrasa", "jardin", "enfants",
  "de", "des", "du", "d", "la", "le", "les", "un", "une",
]);

export type CycleRegistreMali = "F1" | "F2";

export type ReferenceReconciliationRegistre = AdministrationEcoleMali & CoordonneesEcoleMali & {
  sourceCode: string;
  identifiantExterne: string;
  nom: string;
  cycle: string | null;
  codesCluster: string[];
};

export type FicheReconciliationRegistre = CoordonneesEcoleMali & {
  id: string;
  nom: string;
  type: TypeEtablissement;
  nomsExacts: Set<string>;
  references: ReferenceReconciliationRegistre[];
  sourceCodes: Set<string>;
  sourcePrioriteMin: number;
  activite: number;
  richesse: number;
  creeLe: number;
};

export type CritereFusionRegistre =
  | "cycles-complementaires-2013"
  | "sources-croisees-geolocalisees";

export type RaisonExclusionRegistre =
  | "administration-incomplete"
  | "cycles-non-complementaires"
  | "nom-generique"
  | "branche-distincte"
  | "type-incompatible"
  | "meme-source"
  | "administration-incompatible"
  | "coordonnees-manquantes"
  | "distance-superieure-100m"
  | "clusters-2023-concurrents"
  | "grappe-non-complete";

export type ExclusionReconciliationRegistre = {
  raison: RaisonExclusionRegistre;
  ids: string[];
  nomCampus: string;
  detail?: string;
};

export type PlanReconciliationRegistre = {
  ids: string[];
  canoniqueId: string;
  doublonIds: string[];
  criteres: CritereFusionRegistre[];
  raisonCanonique: "activite" | "source-prioritaire" | "fiche-plus-riche" | "ancienne-id-stable";
};

type AreteFusion = {
  a: string;
  b: string;
  criteres: Set<CritereFusionRegistre>;
  nomCampus: string;
};

const clePaire = (a: string, b: string) => [a, b].sort().join("|");

const signatureComplete = (administration: AdministrationEcoleMali) => {
  const signature = signatureAdministrationMali(administration);
  // Région, cercle et commune constituent la hiérarchie administrative. La
  // localité peut être absente dans le registre 2013, mais deux valeurs
  // différentes (y compris renseignée/non renseignée) gardent des groupes séparés.
  return signature.split("|").slice(0, 3).every(Boolean) ? signature : null;
};

const hierarchie = (administration: AdministrationEcoleMali) => {
  const composants = signatureAdministrationMali(administration).split("|");
  return composants.slice(0, 3).every(Boolean) ? composants.slice(0, 3).join("|") : null;
};

const localiteNormalisee = (administration: AdministrationEcoleMali) => (
  signatureAdministrationMali(administration).split("|")[3] || ""
);

export const cycleRegistreMali = (cycle: string | null): CycleRegistreMali | null => {
  const valeur = normaliserTexteEcoleMali(cycle || "");
  if (/^(?:f\s*1|1(?:er|ere|e)?\s*(?:c|cycle)|premier\s+cycle)$/.test(valeur)) return "F1";
  if (/^(?:f\s*2|2(?:eme|e)?\s*(?:c|cycle)|second\s+cycle)$/.test(valeur)) return "F2";
  return null;
};

/** Un libellé purement générique n'est jamais une preuve d'identité. */
export const nomCampusDiscriminant = (nomNormalise: string) => {
  const mots = normaliserTexteEcoleMali(nomNormalise)
    .split(" ")
    .filter((mot) => mot.length >= 2 && !MOTS_GENERIQUES.has(mot) && !/^\d+$/.test(mot));
  return mots.some((mot) => mot.length >= 3);
};

const signaturesBranche = (fiche: FicheReconciliationRegistre) => new Set(
  [fiche.nom, ...fiche.references.map(({ nom }) => nom)]
    .map(signatureBrancheEcoleMali)
    .filter(Boolean),
);

const branchesCompatibles = (a: FicheReconciliationRegistre, b: FicheReconciliationRegistre) => {
  const signaturesA = signaturesBranche(a);
  const signaturesB = signaturesBranche(b);
  if (!signaturesA.size && !signaturesB.size) return true;
  if (signaturesA.size !== 1 || signaturesB.size !== 1) return false;
  return [...signaturesA][0] === [...signaturesB][0];
};

const administrationsCompatibles = (a: FicheReconciliationRegistre, b: FicheReconciliationRegistre) => {
  const administrationsA = a.references
    .map((reference) => ({ hierarchie: hierarchie(reference), localite: localiteNormalisee(reference) }))
    .filter(({ hierarchie: valeur }) => Boolean(valeur));
  const administrationsB = b.references
    .map((reference) => ({ hierarchie: hierarchie(reference), localite: localiteNormalisee(reference) }))
    .filter(({ hierarchie: valeur }) => Boolean(valeur));
  const hierarchiesA = new Set(administrationsA.map(({ hierarchie: valeur }) => valeur!));
  const hierarchiesB = new Set(administrationsB.map(({ hierarchie: valeur }) => valeur!));
  // Une fiche portant déjà plusieurs hiérarchies contradictoires doit être revue manuellement.
  if (hierarchiesA.size !== 1 || hierarchiesB.size !== 1) return false;
  const valeurA = [...hierarchiesA][0];
  const valeurB = [...hierarchiesB][0];
  if (valeurA !== valeurB) return false;
  const localitesA = new Set(administrationsA.map(({ localite }) => localite).filter(Boolean));
  const localitesB = new Set(administrationsB.map(({ localite }) => localite).filter(Boolean));
  if (localitesA.size > 1 || localitesB.size > 1) return false;
  if (!localitesA.size || !localitesB.size) return true;
  return [...localitesA][0] === [...localitesB][0];
};

const clusters2023 = (fiche: FicheReconciliationRegistre) => new Set(
  fiche.references
    .filter(({ sourceCode }) => sourceCode === SOURCE_2023)
    .flatMap(({ codesCluster }) => codesCluster)
    .filter(Boolean),
);

const clusters2023Compatibles = (a: FicheReconciliationRegistre, b: FicheReconciliationRegistre) => {
  const codesA = clusters2023(a);
  const codesB = clusters2023(b);
  if (codesA.size > 1 || codesB.size > 1) return false;
  if (!codesA.size || !codesB.size) return true;
  return [...codesA][0] === [...codesB][0];
};

const sourcesDistinctes = (a: FicheReconciliationRegistre, b: FicheReconciliationRegistre) => (
  [...a.sourceCodes].some((source) => !b.sourceCodes.has(source))
  || [...b.sourceCodes].some((source) => !a.sourceCodes.has(source))
);

const clustersConcurrentsAutour = (
  fiche: FicheReconciliationRegistre,
  candidates: readonly FicheReconciliationRegistre[],
) => {
  if (clusters2023(fiche).size) return false;
  const codes = new Set<string>();
  for (const candidat of candidates) {
    if (candidat.id === fiche.id || !branchesCompatibles(fiche, candidat) || !administrationsCompatibles(fiche, candidat)) continue;
    const distance = distanceMetres(fiche, candidat);
    if (distance === null || distance > 100) continue;
    for (const code of clusters2023(candidat)) codes.add(code);
  }
  return codes.size > 1;
};

const nomExactCommun = (a: FicheReconciliationRegistre, b: FicheReconciliationRegistre) => (
  [...a.nomsExacts].find((nom) => b.nomsExacts.has(nom) && nomCampusDiscriminant(nom)) || null
);

export const evaluerFusionSourcesCroisees = (
  a: FicheReconciliationRegistre,
  b: FicheReconciliationRegistre,
): { accepte: true; nomCampus: string; distance: number } | { accepte: false; raison: RaisonExclusionRegistre } => {
  if (!typesScolairesCompatibles(a.type, b.type)) return { accepte: false, raison: "type-incompatible" };
  if (![...a.sourceCodes, ...b.sourceCodes].some((source) => SOURCES_REGISTRES_MALI.has(source))) {
    return { accepte: false, raison: "meme-source" };
  }
  if (!sourcesDistinctes(a, b)) return { accepte: false, raison: "meme-source" };
  const nomCampus = nomExactCommun(a, b);
  if (!nomCampus) return { accepte: false, raison: "nom-generique" };
  if (!branchesCompatibles(a, b)) return { accepte: false, raison: "branche-distincte" };
  if (!clusters2023Compatibles(a, b)) return { accepte: false, raison: "clusters-2023-concurrents" };
  if (!administrationsCompatibles(a, b)) return { accepte: false, raison: "administration-incompatible" };
  const distance = distanceMetres(a, b);
  if (distance === null) return { accepte: false, raison: "coordonnees-manquantes" };
  if (distance > 100) return { accepte: false, raison: "distance-superieure-100m" };
  return { accepte: true, nomCampus, distance };
};

export const choisirCanoniqueRegistre = (fiches: readonly FicheReconciliationRegistre[]) => {
  const triees = [...fiches].sort((a, b) => (
    b.activite - a.activite
    || a.sourcePrioriteMin - b.sourcePrioriteMin
    || b.richesse - a.richesse
    || a.creeLe - b.creeLe
    || a.id.localeCompare(b.id, "fr")
  ));
  const canonique = triees[0];
  if (!canonique) throw new Error("Impossible de choisir une fiche canonique dans un groupe vide.");
  const autres = triees.slice(1);
  const raison = autres.some(({ activite }) => activite !== canonique.activite)
    ? "activite"
    : autres.some(({ sourcePrioriteMin }) => sourcePrioriteMin !== canonique.sourcePrioriteMin)
      ? "source-prioritaire"
      : autres.some(({ richesse }) => richesse !== canonique.richesse)
        ? "fiche-plus-riche"
        : "ancienne-id-stable";
  return { id: canonique.id, raison } as const;
};

const ajouterExclusion = (
  exclusions: ExclusionReconciliationRegistre[],
  raison: RaisonExclusionRegistre,
  ids: Iterable<string>,
  nomCampus: string,
  detail?: string,
) => exclusions.push({ raison, ids: [...new Set(ids)].sort(), nomCampus, detail });

const ajouterArete = (
  aretes: Map<string, AreteFusion>,
  a: string,
  b: string,
  critere: CritereFusionRegistre,
  nomCampus: string,
) => {
  const cle = clePaire(a, b);
  const existante = aretes.get(cle);
  if (existante) existante.criteres.add(critere);
  else aretes.set(cle, { a, b, criteres: new Set([critere]), nomCampus });
};

export const planifierReconciliationRegistres = (fiches: readonly FicheReconciliationRegistre[]) => {
  const parId = new Map(fiches.map((fiche) => [fiche.id, fiche]));
  const aretes = new Map<string, AreteFusion>();
  const exclusions: ExclusionReconciliationRegistre[] = [];

  // Critère A : une seule ligne F1 et une seule ligne F2 sur une hiérarchie complète.
  const groupes2013 = new Map<string, Array<{ fiche: FicheReconciliationRegistre; reference: ReferenceReconciliationRegistre }>>();
  for (const fiche of fiches) {
    for (const reference of fiche.references.filter(({ sourceCode }) => sourceCode === SOURCE_2013)) {
      const nomCampus = normaliserNomCampusMali(reference.nom || fiche.nom);
      const administration = signatureComplete(reference);
      if (!administration) continue;
      const cle = `${nomCampus}|${administration}`;
      const groupe = groupes2013.get(cle) || [];
      groupe.push({ fiche, reference });
      groupes2013.set(cle, groupe);
    }
  }
  for (const groupe of groupes2013.values()) {
    const ids = [...new Set(groupe.map(({ fiche }) => fiche.id))];
    if (ids.length < 2) continue;
    const nomCampus = normaliserNomCampusMali(groupe[0].reference.nom || groupe[0].fiche.nom);
    if (!nomCampusDiscriminant(nomCampus)) {
      ajouterExclusion(exclusions, "nom-generique", ids, nomCampus);
      continue;
    }
    if (!groupe.every(({ fiche }) => typesScolairesCompatibles(groupe[0].fiche.type, fiche.type))) {
      ajouterExclusion(exclusions, "type-incompatible", ids, nomCampus);
      continue;
    }
    const branches = new Set(groupe.map(({ reference }) => signatureBrancheEcoleMali(reference.nom)).filter(Boolean));
    if (branches.size > 1) {
      ajouterExclusion(exclusions, "branche-distincte", ids, nomCampus);
      continue;
    }
    const cycles = groupe.map(({ reference }) => cycleRegistreMali(reference.cycle));
    const f1 = cycles.filter((cycle) => cycle === "F1").length;
    const f2 = cycles.filter((cycle) => cycle === "F2").length;
    if (groupe.length !== 2 || f1 !== 1 || f2 !== 1) {
      ajouterExclusion(exclusions, "cycles-non-complementaires", ids, nomCampus, `F1=${f1}, F2=${f2}, lignes=${groupe.length}`);
      continue;
    }
    ajouterArete(aretes, ids[0], ids[1], "cycles-complementaires-2013", nomCampus);
  }

  // Critère B : nom exact, administrations compatibles et deux points à 100 m maximum.
  const idsParNom = new Map<string, Set<string>>();
  for (const fiche of fiches) {
    for (const nom of fiche.nomsExacts) {
      if (!nomCampusDiscriminant(nom)) continue;
      const ids = idsParNom.get(nom) || new Set<string>();
      ids.add(fiche.id);
      idsParNom.set(nom, ids);
    }
  }
  const pairesVues = new Set<string>();
  for (const [nomCampus, idsEnsemble] of idsParNom) {
    const ids = [...idsEnsemble].sort();
    const fichesDuNom = ids.map((id) => parId.get(id)!);
    for (let index = 0; index < ids.length; index += 1) {
      for (let autre = index + 1; autre < ids.length; autre += 1) {
        const cle = clePaire(ids[index], ids[autre]);
        if (pairesVues.has(cle)) continue;
        pairesVues.add(cle);
        const ficheA = parId.get(ids[index])!;
        const ficheB = parId.get(ids[autre])!;
        if (clustersConcurrentsAutour(ficheA, fichesDuNom) || clustersConcurrentsAutour(ficheB, fichesDuNom)) {
          ajouterExclusion(exclusions, "clusters-2023-concurrents", [ids[index], ids[autre]], nomCampus);
          continue;
        }
        const resultat = evaluerFusionSourcesCroisees(ficheA, ficheB);
        if (resultat.accepte) {
          ajouterArete(aretes, ids[index], ids[autre], "sources-croisees-geolocalisees", resultat.nomCampus);
        } else if (resultat.raison !== "meme-source") {
          ajouterExclusion(exclusions, resultat.raison, [ids[index], ids[autre]], nomCampus);
        }
      }
    }
  }

  // Fusion des arêtes à lien complet : aucune chaîne A—B—C ne peut entraîner A+C.
  const groupes = new Map<string, Set<string>>();
  const groupeParId = new Map<string, string>();
  for (const id of new Set([...aretes.values()].flatMap(({ a, b }) => [a, b]))) {
    groupes.set(id, new Set([id]));
    groupeParId.set(id, id);
  }
  const aretesTriees = [...aretes.values()].sort((a, b) => (
    Number(!a.criteres.has("cycles-complementaires-2013")) - Number(!b.criteres.has("cycles-complementaires-2013"))
    || clePaire(a.a, a.b).localeCompare(clePaire(b.a, b.b), "fr")
  ));
  for (const arete of aretesTriees) {
    const cleA = groupeParId.get(arete.a)!;
    const cleB = groupeParId.get(arete.b)!;
    if (cleA === cleB) continue;
    const groupeA = groupes.get(cleA)!;
    const groupeB = groupes.get(cleB)!;
    const fusionComplete = [...groupeA].every((idA) => [...groupeB].every((idB) => aretes.has(clePaire(idA, idB))));
    if (!fusionComplete) {
      ajouterExclusion(exclusions, "grappe-non-complete", [...groupeA, ...groupeB], arete.nomCampus);
      continue;
    }
    const fusion = new Set([...groupeA, ...groupeB]);
    groupes.set(cleA, fusion);
    groupes.delete(cleB);
    for (const id of fusion) groupeParId.set(id, cleA);
  }

  const plans: PlanReconciliationRegistre[] = [...groupes.values()]
    .filter((groupe) => groupe.size > 1)
    .map((groupe) => {
      const ids = [...groupe].sort();
      const fichesGroupe = ids.map((id) => parId.get(id)!);
      const canonique = choisirCanoniqueRegistre(fichesGroupe);
      const criteres = new Set<CritereFusionRegistre>();
      for (let index = 0; index < ids.length; index += 1) {
        for (let autre = index + 1; autre < ids.length; autre += 1) {
          for (const critere of aretes.get(clePaire(ids[index], ids[autre]))?.criteres || []) criteres.add(critere);
        }
      }
      return {
        ids,
        canoniqueId: canonique.id,
        doublonIds: ids.filter((id) => id !== canonique.id),
        criteres: [...criteres].sort(),
        raisonCanonique: canonique.raison,
      };
    });

  return {
    plans,
    exclusions,
    statistiques: {
      fichesAnalysees: fiches.length,
      aretesRetenues: aretes.size,
      groupesRetenus: plans.length,
      fusionsPrevues: plans.reduce((total, plan) => total + plan.doublonIds.length, 0),
    },
  };
};

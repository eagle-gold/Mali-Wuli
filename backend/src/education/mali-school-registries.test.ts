import assert from "node:assert/strict";
import test from "node:test";
import { NiveauEducation, StatutEtablissement, TypeEtablissement } from "@prisma/client";
import {
  type AdministrationEcoleMali,
  type LigneRegistreEcoleMali,
  lireCoordonneesMali,
  normaliserNomCampusMali,
  normaliserNomRapprochementMali,
  regrouperCampusRegistreMali,
  signatureAdministrationMali,
  signatureBrancheEcoleMali,
  signatureHierarchieMali,
} from "./mali-school-registries";
import {
  ajouterCandidatIndex,
  type CandidatIndex,
  indexVide,
  trouverCorrespondance,
} from "../scripts/import-mali-school-registries";

const ligne = (partiel: Partial<LigneRegistreEcoleMali> & Pick<LigneRegistreEcoleMali, "identifiantExterne" | "nom">): LigneRegistreEcoleMali => ({
  sourceCode: "unicef-men-mali-schools-2013",
  cycle: "1er cycle",
  statutBrut: "Public",
  typeEnseignement: null,
  codesOfficiels: [],
  codesCluster: [],
  region: "Bamako",
  cercle: "Bamako",
  commune: "Commune I",
  localite: null,
  latitude: null,
  longitude: null,
  donneesBrutes: {},
  ...partiel,
});

const candidat = (partiel: {
  id: string;
  nom: string;
  administration: AdministrationEcoleMali;
  codesOfficiels?: string[];
  villeNormalisee?: string;
}): CandidatIndex => {
  const branche = signatureBrancheEcoleMali(partiel.nom);
  return {
    id: partiel.id,
    nouveau: false,
    nom: partiel.nom,
    ville: null,
    nomsExacts: new Set([normaliserNomCampusMali(partiel.nom)]),
    nomsRapproches: new Set([normaliserNomRapprochementMali(partiel.nom)]),
    type: TypeEtablissement.FONDAMENTALE,
    statut: StatutEtablissement.INCONNU,
    villeNormalisee: partiel.villeNormalisee || "",
    latitude: null,
    longitude: null,
    ...partiel.administration,
    signaturesAdministration: new Set([signatureAdministrationMali(partiel.administration)]),
    signaturesHierarchie: new Set([signatureHierarchieMali(partiel.administration)]),
    signaturesBranche: new Set(branche ? [branche] : []),
    codesOfficiels: new Set(partiel.codesOfficiels || []),
    codesCluster: new Set(),
    referencesSource: new Set(),
  };
};

test("lit les coordonnées maliennes avec virgule et répare un couple inversé", () => {
  assert.deepEqual(lireCoordonneesMali("-7,9804", "12,6102"), { longitude: -7.9804, latitude: 12.6102 });
  assert.deepEqual(lireCoordonneesMali("12,6102", "-7,9804"), { longitude: -7.9804, latitude: 12.6102 });
  assert.deepEqual(lireCoordonneesMali("0", "0"), { longitude: null, latitude: null });
});

test("retire les marqueurs de cycle sans supprimer un numéro de branche", () => {
  assert.equal(normaliserNomCampusMali("Kalanso [1er C]"), "kalanso");
  assert.equal(normaliserNomCampusMali("Kalanso 2ème cycle"), "kalanso");
  assert.equal(normaliserNomCampusMali("École Kalanso 2"), "ecole kalanso 2");
  assert.equal(normaliserNomCampusMali("OUAYEREMA [1er C]ycle I"), "ouayerema i");
});

test("regroupe F1 et F2 d'un campus et réunit leurs niveaux", () => {
  const campus = regrouperCampusRegistreMali([
    ligne({ identifiantExterne: "f1", nom: "Collège Horizon F1", cycle: "1er cycle", codesCluster: ["campus-horizon"] }),
    ligne({ identifiantExterne: "f2", nom: "Collège Horizon F2", cycle: "2ème cycle", codesCluster: ["campus-horizon"] }),
  ]);
  assert.equal(campus.length, 1);
  assert.deepEqual(new Set(campus[0].niveaux), new Set([
    NiveauEducation.PRIMAIRE,
    NiveauEducation.FONDAMENTAL,
  ]));
  assert.equal(campus[0].type, TypeEtablissement.FONDAMENTALE);
  assert.equal(campus[0].nom, "Collège Horizon");
  const nomLong = regrouperCampusRegistreMali([
    ligne({ identifiantExterne: "cycle-long", nom: "Tarbiatoul Islamia 1ère Cycle" }),
  ]);
  assert.equal(nomLong[0].nom, "Tarbiatoul Islamia");
  assert.equal(campus[0].lignes.length, 2);
});

test("regroupe les cycles UNICEF de COMPLEXE SCOLAIRE MALI UNIVERS malgré leurs codes distincts", () => {
  const administration = {
    region: "BAMAKO",
    cercle: "BAMAKO",
    commune: "COMMUNE VI",
    localite: null,
  };
  const campus = regrouperCampusRegistreMali([
    ligne({
      identifiantExterne: "men-2013:960441",
      nom: "COMPLEXE SCOLAIRE MALI UNIVERS [1er C]",
      cycle: "1er cycle",
      codesOfficiels: ["960441"],
      ...administration,
    }),
    ligne({
      identifiantExterne: "men-2013:11040673",
      nom: "COMPLEXE SCOLAIRE MALI UNIVERS [2ème C]",
      cycle: "2ème cycle",
      codesOfficiels: ["11040673"],
      ...administration,
    }),
  ]);

  assert.equal(campus.length, 1);
  assert.equal(campus[0].nom, "COMPLEXE SCOLAIRE MALI UNIVERS");
  assert.deepEqual(campus[0].codesOfficiels.sort(), ["11040673", "960441"]);
  assert.deepEqual(new Set(campus[0].niveaux), new Set([
    NiveauEducation.PRIMAIRE,
    NiveauEducation.FONDAMENTAL,
  ]));
  assert.equal(campus[0].lignes.length, 2);
});

test("ne regroupe pas deux cycles UNICEF homonymes lorsque leurs coordonnées se contredisent", () => {
  const campus = regrouperCampusRegistreMali([
    ligne({
      identifiantExterne: "univers-f1-ouest",
      nom: "COMPLEXE SCOLAIRE MALI UNIVERS [1er C]",
      cycle: "1er cycle",
      latitude: 12.62,
      longitude: -8.08,
    }),
    ligne({
      identifiantExterne: "univers-f2-est",
      nom: "COMPLEXE SCOLAIRE MALI UNIVERS [2ème C]",
      cycle: "2ème cycle",
      latitude: 12.62,
      longitude: -7.92,
    }),
  ]);
  assert.equal(campus.length, 2);
});

test("classe F2 dans le fondamental et jamais comme lycée", () => {
  const campus = regrouperCampusRegistreMali([
    ligne({ identifiantExterne: "f2-seul", nom: "École de Kati F2", cycle: "F2" }),
  ]);
  assert.equal(campus[0].type, TypeEtablissement.FONDAMENTALE);
  assert.deepEqual(campus[0].niveaux, [NiveauEducation.FONDAMENTAL]);
  assert.equal(new Set<NiveauEducation>(campus[0].niveaux).has(NiveauEducation.SECONDAIRE), false);
});

test("ne fusionne pas des homonymes situés dans deux régions", () => {
  const campus = regrouperCampusRegistreMali([
    ligne({ identifiantExterne: "mopti", nom: "Kapala", region: "Mopti", cercle: "Koro", commune: "Kapala" }),
    ligne({ identifiantExterne: "segou", nom: "Kapala", region: "Ségou", cercle: "Bla", commune: "Kapala" }),
  ]);
  assert.equal(campus.length, 2);
});

test("conserve les branches A et B comme deux campus", () => {
  const campus = regrouperCampusRegistreMali([
    ligne({ identifiantExterne: "a", nom: "Alpha Ali Seck A" }),
    ligne({ identifiantExterne: "b", nom: "Alpha Ali Seck B" }),
  ]);
  assert.equal(campus.length, 2);
});

test("sépare deux implantations homonymes éloignées dans la même commune", () => {
  const campus = regrouperCampusRegistreMali([
    ligne({ identifiantExterne: "ouest", nom: "École Djiguiya", latitude: 12.62, longitude: -8.08 }),
    ligne({ identifiantExterne: "est", nom: "École Djiguiya", latitude: 12.62, longitude: -7.92 }),
  ]);
  assert.equal(campus.length, 2);
});

test("ne regroupe pas des unités Deguere sans coordonnée portant des codes cluster distincts", () => {
  const campus = regrouperCampusRegistreMali([
    ligne({ identifiantExterne: "DouMad0037", nom: "Deguere", cycle: "CDPE", codesCluster: ["DouMad0037"] }),
    ligne({ identifiantExterne: "DouMad0038", nom: "Deguere", cycle: "CDPE", codesCluster: ["DouMad0038"] }),
    ligne({ identifiantExterne: "DouMad0039", nom: "Deguere", cycle: "CDPE", codesCluster: ["DouMad0039"] }),
  ]);
  assert.equal(campus.length, 3);
});

test("un code CPS réutilisé ne fusionne pas des écoles de communes ou régions différentes", () => {
  const campus = regrouperCampusRegistreMali([
    ligne({
      identifiantExterne: "BanBan0006",
      nom: "AMENE KODIO 1°C A",
      region: "Mopti",
      cercle: "Bankass",
      commune: "Tori",
      codesOfficiels: ["709058"],
      codesCluster: ["BanBan0006"],
    }),
    ligne({
      identifiantExterne: "BanSok0046",
      nom: "MANKANOU 1°C",
      region: "Mopti",
      cercle: "Bankass",
      commune: "Sokoura",
      codesOfficiels: ["709058"],
      codesCluster: ["BanSok0046"],
    }),
    ligne({
      identifiantExterne: "DouKor0098",
      nom: "GOMOU I",
      region: "Mopti",
      cercle: "Koro",
      commune: "Koporo-Pen",
      codesOfficiels: ["741112"],
      codesCluster: ["DouKor0098"],
    }),
    ligne({
      identifiantExterne: "SegMar0268",
      nom: "TLA",
      region: "Ségou",
      cercle: "Ségou",
      commune: "Kamiandougou",
      codesOfficiels: ["741112"],
      codesCluster: ["SegMar0268"],
    }),
  ]);
  assert.equal(campus.length, 4);
});

test("refuse un code CPS unique dans l'index lorsque nom et administration se contredisent", () => {
  for (const exemple of [
    {
      code: "709058",
      existant: { nom: "AMENE KODIO", administration: { region: "Mopti", cercle: "Bankass", commune: "Tori", localite: null } },
      entrant: { nom: "MANKANOU", region: "Mopti", cercle: "Bankass", commune: "Sokoura", localite: null },
    },
    {
      code: "741112",
      existant: { nom: "GOMOU I", administration: { region: "Mopti", cercle: "Koro", commune: "Koporo-Pen", localite: null } },
      entrant: { nom: "TLA", region: "Ségou", cercle: "Ségou", commune: "Kamiandougou", localite: null },
    },
  ]) {
    const index = indexVide();
    ajouterCandidatIndex(index, candidat({ id: `existant-${exemple.code}`, ...exemple.existant, codesOfficiels: [exemple.code] }));
    const [campus] = regrouperCampusRegistreMali([
      ligne({
        identifiantExterne: `entrant-${exemple.code}`,
        ...exemple.entrant,
        codesOfficiels: [exemple.code],
      }),
    ]);
    assert.equal(trouverCorrespondance(index, campus).raison, "ambigu");
  }
});

test("ne fusionne pas N’Tjikouna sur nom et ville quand les hiérarchies se contredisent", () => {
  const index = indexVide();
  ajouterCandidatIndex(index, candidat({
    id: "ntjikouna-koutiala",
    nom: "N’Tjikouna",
    villeNormalisee: "ntjikouna",
    administration: { region: "Sikasso", cercle: "Koutiala", commune: "N’Tjikouna", localite: null },
  }));
  const [campus] = regrouperCampusRegistreMali([
    ligne({
      identifiantExterne: "ntjikouna-sikasso",
      nom: "N'Tjikouna",
      region: "Sikasso",
      cercle: "Sikasso",
      commune: "N’Tjikouna",
    }),
  ]);
  assert.deepEqual(trouverCorrespondance(index, campus), { id: null, raison: "nouveau" });
});

test("rapproche une variante orthographique privée sans coordonnées avec administration exacte", () => {
  const administration = { region: "Bamako", cercle: "Bamako", commune: "Commune IV", localite: null };
  const index = indexVide();
  ajouterCandidatIndex(index, candidat({
    id: "jean-piaget",
    nom: "École privée Jean Piaget",
    administration,
  }));
  const [campus] = regrouperCampusRegistreMali([
    ligne({ identifiantExterne: "jean-piaget-variante", nom: "École prive Jean Piaget", ...administration }),
  ]);
  assert.deepEqual(trouverCorrespondance(index, campus), { id: "jean-piaget", raison: "nom-relache-admin" });
});

test("départage deux campus homonymes d'une commune avec les coordonnées officielles", () => {
  const administration = { region: "Sikasso", cercle: "Sikasso", commune: "Sikasso", localite: null };
  const index = indexVide();
  const proche = candidat({ id: "ouayerema-i", nom: "OUAYEREMA [1er C]ycle I", administration });
  proche.latitude = 11.3178167;
  proche.longitude = -5.6671833;
  ajouterCandidatIndex(index, proche);
  const eloigne = candidat({ id: "ouayerema-second-cycle-i", nom: "OUAYEREMA [2ème C] I", administration });
  eloigne.latitude = 11.3278269;
  eloigne.longitude = -5.6625819;
  ajouterCandidatIndex(index, eloigne);

  const [campus] = regrouperCampusRegistreMali([
    ligne({
      identifiantExterne: "men-2013:760041",
      nom: "OUAYEREMA 1er Cycle I",
      region: "Sikasso",
      cercle: "Sikasso",
      commune: "Sikasso",
      localite: "Wayerma 1",
      latitude: 11.31781667,
      longitude: -5.66718333,
    }),
  ]);
  assert.deepEqual(trouverCorrespondance(index, campus), {
    id: "ouayerema-i",
    raison: "nom-coordonnees",
  });
});

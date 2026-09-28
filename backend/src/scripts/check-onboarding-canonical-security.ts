import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import {
  ErreurCatalogueOnboarding,
  typeFormationDepuisEtablissement,
  verifierFormationsEducation,
  type FormationEducationSoumise,
} from "../services/onboarding-education-validation";

const formationDeBase = (valeurs: Partial<FormationEducationSoumise>): FormationEducationSoumise => ({
  type: "universite",
  pays: "Mali",
  paysCode: "ML",
  ville: "Bamako",
  etablissement: "Autre établissement",
  etablissementId: "autre:test",
  programme: "Autre programme",
  programmeId: "autre:test",
  specialite: "",
  specialiteId: "",
  diplome: "",
  diplomeId: "",
  ...valeurs,
});

async function doitEchouer(formation: FormationEducationSoumise, motif: RegExp) {
  await assert.rejects(
    () => verifierFormationsEducation([formation]),
    (erreur: unknown) => erreur instanceof ErreurCatalogueOnboarding
      && erreur.erreurs.some((message) => motif.test(message)),
  );
}

async function main() {
  const ecole = await prisma.etablissement.findFirstOrThrow({
    where: { type: "FONDAMENTALE", valide: true },
    include: { pays: true },
  });
  const baseEcole = formationDeBase({
    type: "lycee",
    pays: ecole.pays.nom,
    paysCode: ecole.paysCode,
    ville: ecole.ville || "",
    etablissement: "Nom falsifié par le client",
    etablissementId: ecole.id,
    programme: "",
    programmeId: "",
  });

  const [normalisee] = await verifierFormationsEducation([baseEcole]);
  assert.equal(normalisee.type, "ecole", "une école canonique doit être normalisée en école");
  assert.equal(normalisee.etablissement, ecole.nom, "le libellé canonique doit remplacer le libellé client");

  await doitEchouer(
    { ...baseEcole, type: "universite" },
    /type envoyé ne correspond pas/,
  );
  await doitEchouer(
    { ...baseEcole, paysCode: ecole.paysCode === "FR" ? "ML" : "FR" },
    /pays envoyé ne correspond pas/,
  );

  const etablissementAvecOffres = await prisma.etablissement.findFirst({
    where: { valide: true, type: { in: ["UNIVERSITE", "ECOLE_SUPERIEURE"] }, programmes: { some: { actif: true } } },
    include: { pays: true, programmes: { where: { actif: true }, select: { programmeId: true } } },
  });
  if (etablissementAvecOffres) {
    const idsLies = etablissementAvecOffres.programmes.map(({ programmeId }) => programmeId);
    const programmeNonLie = await prisma.programmeEducation.findFirst({
      where: { actif: true, id: { notIn: idsLies } },
    });
    if (programmeNonLie) {
      await doitEchouer(formationDeBase({
        type: typeFormationDepuisEtablissement(etablissementAvecOffres.type),
        pays: etablissementAvecOffres.pays.nom,
        paysCode: etablissementAvecOffres.paysCode,
        ville: etablissementAvecOffres.ville || "",
        etablissement: etablissementAvecOffres.nom,
        etablissementId: etablissementAvecOffres.id,
        programme: programmeNonLie.nom,
        programmeId: programmeNonLie.id,
      }), /pas rattachée à l'établissement/);
    }
  }

  const [autre] = await verifierFormationsEducation([formationDeBase({})]);
  assert.equal(autre.etablissementId, "autre:test", "une entrée « autre » doit rester autorisée");

  console.log(JSON.stringify({
    statut: "ok",
    controles: [
      "type canonique",
      "anti-contournement scolaire/supérieur",
      "pays canonique",
      "rattachement programme",
      "compatibilité des entrées autre",
    ],
  }, null, 2));
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

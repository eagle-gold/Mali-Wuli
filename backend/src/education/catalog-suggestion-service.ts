import { createHash } from "node:crypto";
import {
  ModeUtilisationSource,
  NiveauEducation,
  Prisma,
  StatutEtablissement,
  StatutSuggestionCatalogue,
  TypeEtablissement,
  TypeProgrammeEducation,
  TypeSuggestionCatalogue,
} from "@prisma/client";
import { demanderDecisionOpenRouter, type CandidatDeduplication } from "./openrouter-deduplication";
import { normaliserEducation, prismaEducation } from "./catalog-service";
import { villeNormaliseePourPays } from "./normalisation-localisations";

export type SuggestionCatalogueInput = {
  clientKey: string;
  type: TypeSuggestionCatalogue;
  libelle: string;
  paysCode: string;
  ville?: string;
  contexteCle?: string;
  contexte?: Record<string, unknown>;
};

const empreinte = (valeur: string) => createHash("sha256").update(valeur).digest("hex");

const trigrammes = (valeur: string) => {
  const texte = `  ${normaliserEducation(valeur)} `;
  const resultat = new Set<string>();
  for (let index = 0; index <= texte.length - 3; index += 1) resultat.add(texte.slice(index, index + 3));
  return resultat;
};

export const similariteLibelles = (gauche: string, droite: string) => {
  const a = trigrammes(gauche);
  const b = trigrammes(droite);
  if (!a.size && !b.size) return 1;
  let communs = 0;
  for (const valeur of a) if (b.has(valeur)) communs += 1;
  return (2 * communs) / (a.size + b.size);
};

const contexteJson = (contexte: Record<string, unknown>): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(contexte)) as Prisma.InputJsonValue;

async function correspondanceCanonique(input: SuggestionCatalogueInput) {
  const nomNormalise = normaliserEducation(input.libelle);
  const villeNormalisee = normaliserEducation(input.ville || "");
  if (input.type === TypeSuggestionCatalogue.ETABLISSEMENT) {
    const exact = await prismaEducation.etablissement.findFirst({
      where: {
        valide: true,
        paysCode: input.paysCode,
        ...(villeNormalisee ? { villeNormalisee } : {}),
        OR: [{ nomNormalise }, { alias: { some: { nomNormalise } } }],
      },
      select: { id: true, nom: true },
    });
    if (exact) return { id: exact.id, libelle: exact.nom };
  }
  if (
    input.type === TypeSuggestionCatalogue.PROGRAMME
    || input.type === TypeSuggestionCatalogue.SPECIALITE
    || input.type === TypeSuggestionCatalogue.SERIE
  ) {
    const parentId = typeof input.contexte?.programmeId === "string" ? input.contexte.programmeId : undefined;
    const exact = await prismaEducation.programmeEducation.findFirst({
      where: {
        nomNormalise,
        actif: true,
        ...(input.type === TypeSuggestionCatalogue.SPECIALITE ? { parentId } : { parentId: null }),
        ...(input.type === TypeSuggestionCatalogue.SERIE
          ? { paysCode: input.paysCode, type: TypeProgrammeEducation.SERIE }
          : { OR: [{ paysCode: input.paysCode }, { paysCode: null }] }),
      },
      select: { id: true, nom: true },
    });
    if (exact) return { id: exact.id, libelle: exact.nom };
  }
  if (input.type === TypeSuggestionCatalogue.DIPLOME) {
    const exact = await prismaEducation.diplomeEducation.findFirst({
      where: { paysCode: input.paysCode, nomNormalise, actif: true },
      select: { id: true, nom: true },
    });
    if (exact) return { id: exact.id, libelle: exact.nom };
  }
  return null;
}

async function candidatsCanoniques(input: SuggestionCatalogueInput): Promise<CandidatDeduplication[]> {
  const villeNormalisee = normaliserEducation(input.ville || "");
  if (input.type === TypeSuggestionCatalogue.ETABLISSEMENT) {
    const lignes = await prismaEducation.etablissement.findMany({
      where: { valide: true, paysCode: input.paysCode, ...(villeNormalisee ? { villeNormalisee } : {}) },
      select: {
        id: true,
        nom: true,
        sigle: true,
        paysCode: true,
        ville: true,
        type: true,
        statut: true,
        siteWeb: true,
        niveaux: { select: { niveau: true } },
        alias: { select: { nom: true }, take: 10 },
        sources: {
          orderBy: { confiance: "desc" },
          take: 4,
          select: {
            confiance: true,
            urlSource: true,
            source: { select: { code: true, nom: true } },
          },
        },
        programmes: {
          where: { actif: true },
          take: 12,
          select: {
            programme: { select: { id: true, nom: true, type: true, niveau: true } },
          },
        },
      },
      take: 400,
    });
    return lignes
      .map((ligne) => {
        const libellesConnus = [ligne.nom, ligne.sigle, ...ligne.alias.map(({ nom }) => nom)]
          .filter((libelle): libelle is string => Boolean(libelle));
        const score = Math.max(...libellesConnus.map((libelle) => similariteLibelles(input.libelle, libelle)));
        return {
          id: ligne.id,
          libelle: ligne.nom,
          score,
          contexte: {
            entite: "ETABLISSEMENT_CANONIQUE",
            sigle: ligne.sigle,
            alias: ligne.alias.map(({ nom }) => nom),
            paysCode: ligne.paysCode,
            ville: ligne.ville,
            typePrincipal: ligne.type,
            statut: ligne.statut,
            niveaux: ligne.niveaux.map(({ niveau }) => niveau),
            siteWeb: ligne.siteWeb,
            programmes: ligne.programmes.map(({ programme }) => ({
              id: programme.id,
              nom: programme.nom,
              type: programme.type,
              niveau: programme.niveau,
            })),
            sources: ligne.sources.map(({ source, urlSource, confiance }) => ({
              code: source.code,
              nom: source.nom,
              url: urlSource,
              confiance,
            })),
          },
        };
      })
      .filter(({ score }) => score >= 0.62)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }
  if (input.type === TypeSuggestionCatalogue.DIPLOME) {
    const lignes = await prismaEducation.diplomeEducation.findMany({
      where: { paysCode: input.paysCode, actif: true },
      select: {
        id: true,
        nom: true,
        sigle: true,
        paysCode: true,
        niveau: true,
        niveauEntree: true,
        niveauSortie: true,
        sources: {
          take: 4,
          select: { source: { select: { code: true, nom: true } }, urlSource: true, confiance: true },
        },
        programmes: {
          where: { actif: true },
          take: 12,
          select: {
            programme: { select: { id: true, nom: true, type: true } },
            etablissement: { select: { id: true, nom: true, ville: true } },
          },
        },
      },
      take: 300,
    });
    return lignes
      .map((ligne) => {
        const score = Math.max(
          similariteLibelles(input.libelle, ligne.nom),
          ligne.sigle ? similariteLibelles(input.libelle, ligne.sigle) : 0,
        );
        return {
          id: ligne.id,
          libelle: ligne.nom,
          score,
          contexte: {
            entite: "DIPLOME_CANONIQUE",
            sigle: ligne.sigle,
            paysCode: ligne.paysCode,
            niveau: ligne.niveau,
            niveauEntree: ligne.niveauEntree,
            niveauSortie: ligne.niveauSortie,
            offres: ligne.programmes.map(({ programme, etablissement }) => ({
              programmeId: programme.id,
              programme: programme.nom,
              typeProgramme: programme.type,
              etablissementId: etablissement.id,
              etablissement: etablissement.nom,
              ville: etablissement.ville,
            })),
            sources: ligne.sources.map(({ source, urlSource, confiance }) => ({
              code: source.code,
              nom: source.nom,
              url: urlSource,
              confiance,
            })),
          },
        };
      })
      .filter(({ score }) => score >= 0.62)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }
  const parentId = input.type === TypeSuggestionCatalogue.SPECIALITE
    && typeof input.contexte?.programmeId === "string"
    ? input.contexte.programmeId
    : undefined;
  const type = input.type === TypeSuggestionCatalogue.SERIE
    ? TypeProgrammeEducation.SERIE
    : input.type === TypeSuggestionCatalogue.SPECIALITE
      ? TypeProgrammeEducation.SPECIALITE
      : undefined;
  const lignes = await prismaEducation.programmeEducation.findMany({
    where: {
      actif: true,
      ...(parentId ? { parentId } : input.type === TypeSuggestionCatalogue.PROGRAMME ? { parentId: null } : {}),
      ...(type ? { type } : {}),
      OR: [{ paysCode: input.paysCode }, { paysCode: null }],
    },
    select: {
      id: true,
      nom: true,
      sigle: true,
      paysCode: true,
      type: true,
      niveau: true,
      codeOfficiel: true,
      parent: { select: { id: true, nom: true, type: true } },
      enfants: { where: { actif: true }, take: 12, select: { id: true, nom: true, type: true } },
      etablissements: {
        where: { actif: true },
        take: 12,
        select: { etablissement: { select: { id: true, nom: true, ville: true, paysCode: true } } },
      },
      sources: {
        take: 4,
        select: { source: { select: { code: true, nom: true } }, urlSource: true, confiance: true },
      },
    },
    take: 400,
  });
  return lignes
    .map((ligne) => {
      const score = Math.max(
        similariteLibelles(input.libelle, ligne.nom),
        ligne.sigle ? similariteLibelles(input.libelle, ligne.sigle) : 0,
      );
      return {
        id: ligne.id,
        libelle: ligne.nom,
        score,
        contexte: {
          entite: "PROGRAMME_CANONIQUE",
          sigle: ligne.sigle,
          paysCode: ligne.paysCode,
          type: ligne.type,
          niveau: ligne.niveau,
          codeOfficiel: ligne.codeOfficiel,
          parent: ligne.parent,
          enfants: ligne.enfants,
          etablissements: ligne.etablissements.map(({ etablissement }) => etablissement),
          sources: ligne.sources.map(({ source, urlSource, confiance }) => ({
            code: source.code,
            nom: source.nom,
            url: urlSource,
            confiance,
          })),
        },
      };
    })
    .filter(({ score }) => score >= 0.62)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export async function soumettreSuggestion(input: SuggestionCatalogueInput, contributorKey: string) {
  const libelle = input.libelle.trim().slice(0, 180);
  const libelleNormalise = normaliserEducation(libelle);
  const paysCode = input.paysCode.toUpperCase();
  const localisation = villeNormaliseePourPays(paysCode, input.ville?.trim().slice(0, 120));
  const { ville, villeNormalisee } = localisation;
  const contexteCle = normaliserEducation(input.contexteCle || "");
  const contexte = input.contexte || {};
  const canonique = await correspondanceCanonique({ ...input, libelle, paysCode, ville: ville || undefined });
  if (canonique) {
    return { clientKey: input.clientKey, statut: "EXISTANT" as const, canoniqueId: canonique.id, libelle: canonique.libelle };
  }

  const suggestionsProches = await prismaEducation.suggestionCatalogue.findMany({
    where: {
      type: input.type,
      paysCode,
      villeNormalisee,
      contexteCle,
      statut: { in: [StatutSuggestionCatalogue.EN_ATTENTE, StatutSuggestionCatalogue.A_VALIDER] },
    },
    orderBy: [{ nombreContributeurs: "desc" }, { updatedAt: "desc" }],
    take: 30,
    include: {
      contributions: {
        orderBy: { createdAt: "asc" },
        take: 8,
        select: { libelleBrut: true },
      },
    },
  });
  const proches = suggestionsProches
    .map((suggestion) => ({ suggestion, score: similariteLibelles(libelle, suggestion.libelleBrut) }))
    .filter(({ score }) => score >= 0.62)
    .sort((a, b) => b.score - a.score);
  let suggestionCible = proches[0]?.score >= 0.88 ? proches[0].suggestion : null;
  let decisionIA: Awaited<ReturnType<typeof demanderDecisionOpenRouter>> = null;

  const candidatsCanoniquesTrouves = await candidatsCanoniques({ ...input, libelle, paysCode, ville: ville || undefined });
  const candidatsIA: CandidatDeduplication[] = [
    ...proches.slice(0, 6).map(({ suggestion, score }) => ({
      id: `suggestion:${suggestion.id}`,
      libelle: suggestion.libelleBrut,
      score,
      contexte: {
        entite: "SUGGESTION_EN_ATTENTE",
        type: suggestion.type,
        paysCode: suggestion.paysCode,
        ville: suggestion.ville,
        contexteMetier: suggestion.contexte,
        nombreContributeurs: suggestion.nombreContributeurs,
        variantesSaisies: suggestion.contributions.map(({ libelleBrut: variante }) => variante),
      },
    })),
    ...candidatsCanoniquesTrouves.map((candidat) => ({ ...candidat, id: `canonique:${candidat.id}` })),
  ].slice(0, 8);

  if (!suggestionCible && candidatsIA.length) {
    decisionIA = await demanderDecisionOpenRouter({
      type: input.type,
      libelle,
      paysCode,
      ville: ville || undefined,
      contexte: {
        typePropose: input.type,
        libelleNormalise,
        contexteCle,
        contexteMetier: contexte,
      },
      candidats: candidatsIA,
    });
    if (decisionIA?.decision === "MATCH" && decisionIA.confidence >= 0.9 && decisionIA.candidateId?.startsWith("suggestion:")) {
      suggestionCible = suggestionsProches.find(({ id }) => `suggestion:${id}` === decisionIA?.candidateId) || null;
    }
  }

  const fingerprint = empreinte(`${input.type}|${paysCode}|${villeNormalisee}|${contexteCle}|${libelleNormalise}`);
  const candidatCanoniqueChoisiParIA = decisionIA?.decision === "MATCH"
    && decisionIA.confidence >= 0.9
    && decisionIA.candidateId?.startsWith("canonique:")
    ? candidatsCanoniquesTrouves.find(({ id }) => `canonique:${id}` === decisionIA?.candidateId)
    : undefined;
  const candidatCanonique = candidatCanoniqueChoisiParIA || candidatsCanoniquesTrouves[0];
  const suggestion = suggestionCible || await prismaEducation.suggestionCatalogue.upsert({
    where: { type_fingerprint: { type: input.type, fingerprint } },
    create: {
      type: input.type,
      fingerprint,
      libelleBrut: libelle,
      libelleNormalise,
      paysCode,
      ville,
      villeNormalisee,
      contexteCle,
      contexte: contexteJson(contexte),
      candidatId: candidatCanonique?.id || null,
      scoreDeterministe: candidatCanonique?.score || proches[0]?.score || null,
      decisionIA: decisionIA ? contexteJson(decisionIA) : undefined,
      modeleIA: decisionIA?.modele,
      versionPrompt: decisionIA ? "catalogue-dedup-v2-contexte-complet" : undefined,
    },
    update: {
      candidatId: candidatCanonique?.id || undefined,
      scoreDeterministe: candidatCanonique?.score || proches[0]?.score || undefined,
      decisionIA: decisionIA ? contexteJson(decisionIA) : undefined,
      modeleIA: decisionIA?.modele,
      versionPrompt: decisionIA ? "catalogue-dedup-v2-contexte-complet" : undefined,
    },
  });

  await prismaEducation.contributionSuggestionCatalogue.upsert({
    where: { suggestionId_contributorKey: { suggestionId: suggestion.id, contributorKey } },
    create: { suggestionId: suggestion.id, contributorKey, libelleBrut: libelle, contexte: contexteJson(contexte) },
    update: { libelleBrut: libelle, contexte: contexteJson(contexte) },
  });
  const nombreContributeurs = await prismaEducation.contributionSuggestionCatalogue.count({ where: { suggestionId: suggestion.id } });
  const doitNotifier = nombreContributeurs >= 2
    && suggestion.statut === StatutSuggestionCatalogue.EN_ATTENTE;
  const miseAJour = await prismaEducation.suggestionCatalogue.update({
    where: { id: suggestion.id },
    data: {
      nombreContributeurs,
      ...(doitNotifier ? { statut: StatutSuggestionCatalogue.A_VALIDER } : {}),
    },
  });
  if (nombreContributeurs >= 2) {
    await prismaEducation.notificationAdmin.upsert({
      where: { suggestionId: suggestion.id },
      create: {
        suggestionId: suggestion.id,
        type: "CATALOGUE_EDUCATION",
        titre: "Nouvelle donnée éducative à valider",
        message: `${nombreContributeurs} personnes ont proposé « ${suggestion.libelleBrut} » (${paysCode}${ville ? `, ${ville}` : ""}).`,
      },
      update: { message: `${nombreContributeurs} personnes ont proposé « ${suggestion.libelleBrut} » (${paysCode}${ville ? `, ${ville}` : ""}).`, traitee: false },
    });
  }
  return {
    clientKey: input.clientKey,
    statut: miseAJour.statut,
    suggestionId: miseAJour.id,
    nombreContributeurs,
  };
}

const niveauDepuisContexte = (contexte: Record<string, unknown>) => {
  const type = String(contexte.formationType || "universite");
  if (type === "ecole") return NiveauEducation.FONDAMENTAL;
  if (type === "lycee") return NiveauEducation.SECONDAIRE;
  return NiveauEducation.SUPERIEUR;
};

const typeEtablissementDepuisContexte = (contexte: Record<string, unknown>) => {
  const type = String(contexte.formationType || "universite");
  if (type === "ecole") return TypeEtablissement.FONDAMENTALE;
  if (type === "lycee") return TypeEtablissement.LYCEE;
  return TypeEtablissement.UNIVERSITE;
};

export async function publierSuggestion(id: string, validateurId: string, fusionnerAvecId?: string) {
  const suggestion = await prismaEducation.suggestionCatalogue.findUniqueOrThrow({ where: { id } });
  if (
    suggestion.statut !== StatutSuggestionCatalogue.EN_ATTENTE
    && suggestion.statut !== StatutSuggestionCatalogue.A_VALIDER
  ) {
    throw new Error("Cette suggestion a déjà été traitée.");
  }
  const contexte = suggestion.contexte as Record<string, unknown>;
  if (fusionnerAvecId) {
    const cible = suggestion.type === TypeSuggestionCatalogue.ETABLISSEMENT
      ? await prismaEducation.etablissement.findFirst({
          where: { id: fusionnerAvecId, paysCode: suggestion.paysCode, valide: true },
          select: { id: true },
        })
      : suggestion.type === TypeSuggestionCatalogue.DIPLOME
        ? await prismaEducation.diplomeEducation.findFirst({
            where: { id: fusionnerAvecId, paysCode: suggestion.paysCode },
            select: { id: true },
          })
        : await prismaEducation.programmeEducation.findFirst({
            where: {
              id: fusionnerAvecId,
              OR: [{ paysCode: suggestion.paysCode }, { paysCode: null }],
              ...(suggestion.type === TypeSuggestionCatalogue.SPECIALITE
                && typeof contexte.programmeId === "string"
                ? { parentId: contexte.programmeId }
                : {}),
            },
            select: { id: true },
          });
    if (!cible) throw new Error("La donnée choisie pour la fusion n'est pas compatible.");
  }
  const source = await prismaEducation.sourceEducative.upsert({
    where: { code: "communaute-mali-wuli" },
    create: {
      code: "communaute-mali-wuli",
      nom: "Communauté Mali Wuli",
      url: "https://maliwuli.com/",
      modeUtilisation: ModeUtilisationSource.REFERENCEMENT,
      priorite: 80,
    },
    update: { actif: true },
  });
  let canoniqueId = fusionnerAvecId || "";

  if (suggestion.type === TypeSuggestionCatalogue.ETABLISSEMENT) {
    if (fusionnerAvecId) {
      await prismaEducation.etablissementAlias.upsert({
        where: { etablissementId_nomNormalise: { etablissementId: fusionnerAvecId, nomNormalise: suggestion.libelleNormalise } },
        create: { etablissementId: fusionnerAvecId, nom: suggestion.libelleBrut, nomNormalise: suggestion.libelleNormalise },
        update: { nom: suggestion.libelleBrut },
      });
    } else {
      const existant = await prismaEducation.etablissement.findFirst({
        where: { valide: true, paysCode: suggestion.paysCode, nomNormalise: suggestion.libelleNormalise, villeNormalisee: suggestion.villeNormalisee },
      });
      const etablissement = existant || await prismaEducation.etablissement.create({
        data: {
          nom: suggestion.libelleBrut,
          nomNormalise: suggestion.libelleNormalise,
          type: typeEtablissementDepuisContexte(contexte),
          paysCode: suggestion.paysCode,
          systemeEducatifCode: suggestion.paysCode,
          ville: suggestion.ville,
          villeNormalisee: suggestion.villeNormalisee,
          statut: StatutEtablissement.INCONNU,
        },
      });
      canoniqueId = etablissement.id;
      const niveau = niveauDepuisContexte(contexte);
      await prismaEducation.etablissementNiveau.upsert({
        where: { etablissementId_niveau: { etablissementId: canoniqueId, niveau } },
        create: { etablissementId: canoniqueId, niveau },
        update: {},
      });
      await prismaEducation.etablissementSource.upsert({
        where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: suggestion.id } },
        create: { etablissementId: canoniqueId, sourceId: source.id, identifiantExterne: suggestion.id, confiance: 0.65 },
        update: { etablissementId: canoniqueId, vuLe: new Date() },
      });
    }
  } else if (suggestion.type === TypeSuggestionCatalogue.DIPLOME) {
    if (!fusionnerAvecId) {
      const niveau = niveauDepuisContexte(contexte);
      const diplome = await prismaEducation.diplomeEducation.upsert({
        where: { paysCode_niveau_nomNormalise: { paysCode: suggestion.paysCode, niveau, nomNormalise: suggestion.libelleNormalise } },
        create: { paysCode: suggestion.paysCode, niveau, nom: suggestion.libelleBrut, nomNormalise: suggestion.libelleNormalise },
        update: { actif: true },
      });
      canoniqueId = diplome.id;
      await prismaEducation.diplomeSource.upsert({
        where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: suggestion.id } },
        create: { diplomeId: canoniqueId, sourceId: source.id, identifiantExterne: suggestion.id, confiance: 0.65 },
        update: { diplomeId: canoniqueId, vuLe: new Date() },
      });
    }
  } else {
    if (!fusionnerAvecId) {
      const parentId = suggestion.type === TypeSuggestionCatalogue.SPECIALITE && typeof contexte.programmeId === "string"
        ? contexte.programmeId
        : null;
      const type = suggestion.type === TypeSuggestionCatalogue.SERIE
        ? TypeProgrammeEducation.SERIE
        : suggestion.type === TypeSuggestionCatalogue.SPECIALITE
          ? TypeProgrammeEducation.SPECIALITE
          : TypeProgrammeEducation.FORMATION;
      const programmeExistant = await prismaEducation.programmeEducation.findFirst({
        where: {
          paysCode: suggestion.paysCode,
          parentId,
          nomNormalise: suggestion.libelleNormalise,
          type,
          actif: true,
        },
      });
      const programme = programmeExistant || await prismaEducation.programmeEducation.create({
          data: {
            paysCode: suggestion.paysCode,
            parentId,
            nom: suggestion.libelleBrut,
            nomNormalise: suggestion.libelleNormalise,
            type,
            niveau: niveauDepuisContexte(contexte),
          },
        });
      canoniqueId = programme.id;
      await prismaEducation.programmeSource.upsert({
        where: { sourceId_identifiantExterne: { sourceId: source.id, identifiantExterne: suggestion.id } },
        create: { programmeId: canoniqueId, sourceId: source.id, identifiantExterne: suggestion.id, confiance: 0.65 },
        update: { programmeId: canoniqueId, vuLe: new Date() },
      });
      if (suggestion.type === TypeSuggestionCatalogue.PROGRAMME && typeof contexte.etablissementId === "string") {
        const etablissementExiste = await prismaEducation.etablissement.findUnique({ where: { id: contexte.etablissementId } });
        if (etablissementExiste) {
          const offreExiste = await prismaEducation.etablissementProgramme.findFirst({
            where: { etablissementId: contexte.etablissementId, programmeId: canoniqueId },
          });
          if (!offreExiste) {
            await prismaEducation.etablissementProgramme.create({
              data: { etablissementId: contexte.etablissementId, programmeId: canoniqueId, niveau: niveauDepuisContexte(contexte) },
            });
          }
        }
      }
    }
  }

  const statut = fusionnerAvecId ? StatutSuggestionCatalogue.FUSIONNEE : StatutSuggestionCatalogue.ACCEPTEE;
  const resultat = await prismaEducation.suggestionCatalogue.update({
    where: { id },
    data: { statut, canoniqueId, valideParId: validateurId, valideLe: new Date() },
  });
  await prismaEducation.notificationAdmin.updateMany({ where: { suggestionId: id }, data: { lue: true, traitee: true } });
  return resultat;
}

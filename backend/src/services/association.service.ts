import { Prisma, type PrismaClient } from "@prisma/client";
import { paginerParMembresEligibles, PROFIL_MEMBRE_ELIGIBLE } from "./priorite-membres.service";

export class ErreurAssociation extends Error {
  constructor(public readonly statut: number, message: string) { super(message); }
}

export type ActeurAssociation = { profilId: string; gestionnaireGlobal: boolean; administrateurPrincipal: boolean };
export type PaginationAssociation = { page: number; limite: number };
export type FiltresAssociations = PaginationAssociation & {
  q?: string; pays?: string; ville?: string; vocation?: string;
};
export type DonneesAssociation = {
  nom: string; pays: string; description?: string | null; ville?: string | null;
  vocation?: string | null; site?: string | null; emailContact?: string | null;
  dateCreation?: Date | null; responsableId?: string | null; valide?: boolean;
};
export type DonneesSuggestionAssociation = {
  nom: string; pays: string; ville?: string | null; vocation?: string | null; message?: string | null;
};

const PROFIL_PUBLIC = {
  id: true, userId: true, photo: true, titre: true, ville: true, pays: true,
  user: { select: { prenom: true, nom: true } },
} as const;
const PROFIL_VISIBLE = PROFIL_MEMBRE_ELIGIBLE;
type ProfilPublic = Prisma.ProfilGetPayload<{ select: typeof PROFIL_PUBLIC }>;
function formaterProfil(profil: ProfilPublic) {
  const { user, ...champs } = profil;
  return { ...champs, prenom: user.prenom, nom: user.nom };
}
function selectionAssociation(profilId: string) {
  return {
    id: true, nom: true, description: true, pays: true, ville: true, vocation: true,
    site: true, emailContact: true, photo: true, photoCouverture: true,
    dateCreation: true, createdAt: true, responsableId: true, valide: true,
    membres: { where: { profilId }, select: { statut: true, rejointLe: true }, take: 1 },
    _count: { select: { membres: { where: { statut: "VERIFIE" as const, profil: PROFIL_VISIBLE } } } },
  } as const;
}
type AssociationSelectionnee = Prisma.AssociationGetPayload<{ select: ReturnType<typeof selectionAssociation> }>;
const meta = (page: number, limite: number, total: number) => ({ total, page, totalPages: Math.ceil(total / limite) });
const affiliationSelection = { statut: true, rejointLe: true } as const;

/** Toutes les opérations reçoivent la vraie identité contrôlée par authenticate. */
export function creerServiceAssociations(db: PrismaClient) {
  async function acteur(userId: string | undefined, role: string | undefined, permissions: readonly string[] = []): Promise<ActeurAssociation> {
    const profil = userId && await db.profil.findUnique({ where: { userId }, select: { id: true } });
    if (!profil) throw new ErreurAssociation(404, "Profil introuvable.");
    return { profilId: profil.id, gestionnaireGlobal: permissions.includes("ASSOCIATIONS_GERER"), administrateurPrincipal: role === "ADMIN" };
  }

  async function associationAccessible(id: string, identite: ActeurAssociation) {
    const association = await db.association.findUnique({
      where: { id }, select: { id: true, valide: true, responsableId: true },
    });
    if (!association || (!association.valide && !identite.gestionnaireGlobal)) {
      throw new ErreurAssociation(404, "Association introuvable.");
    }
    return association;
  }

  async function autoriserGestion(id: string, identite: ActeurAssociation) {
    const association = await associationAccessible(id, identite);
    if (!identite.gestionnaireGlobal && association.responsableId !== identite.profilId) {
      throw new ErreurAssociation(403, "Vous ne pouvez pas gérer cette association.");
    }
    return association;
  }

  async function formater(associations: AssociationSelectionnee[], identite: ActeurAssociation) {
    const ids = [...new Set(associations.flatMap((a) => a.responsableId ? [a.responsableId] : []))];
    const responsables = ids.length ? await db.profil.findMany({
      where: { id: { in: ids }, ...PROFIL_VISIBLE }, select: PROFIL_PUBLIC,
    }) : [];
    const parId = new Map(responsables.map((profil) => [profil.id, profil]));
    return associations.map(({ membres, _count, responsableId, ...association }) => {
      const responsable = responsableId ? parId.get(responsableId) : undefined;
      return {
        ...association,
        responsable: responsable ? {
          id: responsable.id, userId: responsable.userId, prenom: responsable.user.prenom,
          nom: responsable.user.nom, photo: responsable.photo, estMoi: responsable.id === identite.profilId,
        } : null,
        nbMembres: _count.membres,
        monAffiliation: membres[0] || null,
        peutGerer: identite.gestionnaireGlobal || responsableId === identite.profilId,
        peutSupprimer: identite.gestionnaireGlobal || responsableId === identite.profilId,
      };
    });
  }

  async function fiche(id: string, identite: ActeurAssociation) {
    await associationAccessible(id, identite);
    const association = await db.association.findUnique({ where: { id }, select: selectionAssociation(identite.profilId) });
    if (!association) throw new ErreurAssociation(404, "Association introuvable.");
    return (await formater([association], identite))[0];
  }

  async function pageParMembres(where: Prisma.AssociationWhereInput, pagination: PaginationAssociation, profilId: string) {
    // La clé primaire (associationId, profilId) garantit un membre distinct par ligne.
    const groupes = await db.associationMembre.groupBy({
      by: ["associationId"], where: { association: where, statut: "VERIFIE", profil: PROFIL_VISIBLE },
      _count: { profilId: true },
    });
    const compteurs = new Map(groupes.map(({ associationId, _count }) => [associationId, _count.profilId]));
    return paginerParMembresEligibles(compteurs, pagination,
      (ids) => db.association.findMany({
        where: { AND: [where, { id: { in: ids } }] }, select: { id: true },
        orderBy: [{ nom: "asc" }, { id: "asc" }],
      }),
      ({ ids, exclureIds, skip, take }) => db.association.findMany({
        where: { AND: [where, ...(ids ? [{ id: { in: ids } }] : []),
          ...(exclureIds?.length ? [{ id: { notIn: exclureIds } }] : [])] },
        select: selectionAssociation(profilId), orderBy: [{ nom: "asc" }, { id: "asc" }], skip, take,
      }),
    );
  }

  async function liste(filtres: FiltresAssociations, identite: ActeurAssociation) {
    const { q, pays, ville, vocation, page, limite } = filtres;
    const where: Prisma.AssociationWhereInput = {
      valide: true, ...(pays ? { pays } : {}), ...(ville ? { ville } : {}), ...(vocation ? { vocation } : {}),
      ...(q ? { OR: [{ nom: { contains: q } }, { description: { contains: q } }, { vocation: { contains: q } }, { ville: { contains: q } }, { pays: { contains: q } }] } : {}),
    };
    const [associations, total, totalGlobal, paysOptions, villesOptions, vocationsOptions] = await Promise.all([
      pageParMembres(where, { page, limite }, identite.profilId),
      db.association.count({ where }),
      db.association.count({ where: { valide: true } }),
      db.association.findMany({ where: { valide: true }, select: { pays: true }, distinct: ["pays"], orderBy: { pays: "asc" } }),
      db.association.findMany({ where: { valide: true, ville: { not: null }, ...(pays ? { pays } : {}) }, select: { ville: true }, distinct: ["ville"], orderBy: { ville: "asc" } }),
      db.association.findMany({ where: { valide: true, vocation: { not: null } }, select: { vocation: true }, distinct: ["vocation"], orderBy: { vocation: "asc" } }),
    ]);
    return {
      associations: await formater(associations, identite), ...meta(page, limite, total), totalGlobal,
      facettes: {
        pays: paysOptions.map((v) => v.pays).filter(Boolean),
        villes: villesOptions.flatMap((v) => v.ville ? [v.ville] : []),
        vocations: vocationsOptions.flatMap((v) => v.vocation ? [v.vocation] : []),
      },
    };
  }

  async function mesAssociations(identite: ActeurAssociation, gestion: boolean) {
    const where: Prisma.AssociationWhereInput = gestion
      ? (identite.gestionnaireGlobal ? {} : { valide: true, responsableId: identite.profilId })
      : { membres: { some: { profilId: identite.profilId } } };
    const associations = await db.association.findMany({
      where, select: selectionAssociation(identite.profilId), orderBy: [{ nom: "asc" }, { id: "asc" }],
    });
    return { associations: await formater(associations, identite) };
  }

  async function membres(id: string, identite: ActeurAssociation, pagination: PaginationAssociation, demandes = false) {
    if (demandes) await autoriserGestion(id, identite);
    else await associationAccessible(id, identite);
    const { page, limite } = pagination;
    const where: Prisma.AssociationMembreWhereInput = {
      associationId: id, statut: demandes ? "EN_ATTENTE" : "VERIFIE",
      ...(demandes ? {} : { profil: PROFIL_VISIBLE }),
    };
    const [total, affiliations] = await Promise.all([
      db.associationMembre.count({ where }),
      db.associationMembre.findMany({
        where, select: { statut: true, rejointLe: true, profil: { select: PROFIL_PUBLIC } },
        orderBy: [{ profil: { user: { nom: "asc" } } }, { profilId: "asc" }],
        skip: (page - 1) * limite, take: limite,
      }),
    ]);
    return demandes
      ? { affiliations: affiliations.map(({ profil, ...a }) => ({ ...a, profil: formaterProfil(profil) })), ...meta(page, limite, total) }
      : { membres: affiliations.map(({ profil, rejointLe }) => ({ ...formaterProfil(profil), rejointLe })), ...meta(page, limite, total) };
  }

  async function demanderAffiliation(id: string, identite: ActeurAssociation) {
    await associationAccessible(id, identite);
    const where = { associationId_profilId: { associationId: id, profilId: identite.profilId } };
    // Ne jamais réinitialiser une validation si deux demandes arrivent simultanément.
    await db.associationMembre.upsert({
      where, create: { associationId: id, profilId: identite.profilId, statut: "EN_ATTENTE" }, update: {},
    });
    await db.associationMembre.updateMany({
      where: { associationId: id, profilId: identite.profilId, statut: { in: ["DECLARE", "REFUSE"] } },
      data: { statut: "EN_ATTENTE", rejointLe: null },
    });
    return db.associationMembre.findUniqueOrThrow({ where, select: affiliationSelection });
  }

  async function quitter(id: string, identite: ActeurAssociation) {
    // Permet aussi de quitter sa propre ancienne association devenue inactive.
    await db.associationMembre.deleteMany({ where: { associationId: id, profilId: identite.profilId } });
  }

  async function decider(id: string, profilId: string, decision: "VERIFIE" | "REFUSE", identite: ActeurAssociation) {
    await autoriserGestion(id, identite);
    if (decision === "VERIFIE" && profilId === identite.profilId && !identite.administrateurPrincipal) {
      throw new ErreurAssociation(403, "Votre propre affiliation doit être vérifiée par un autre responsable habilité.");
    }
    if (decision === "VERIFIE") {
      const profil = await db.profil.findFirst({ where: { id: profilId, ...PROFIL_VISIBLE }, select: { id: true } });
      if (!profil) throw new ErreurAssociation(409, "Ce membre doit d’abord terminer son inscription et faire valider son profil.");
    }
    const where = { associationId_profilId: { associationId: id, profilId } };
    const demande = await db.associationMembre.findUnique({ where, select: affiliationSelection });
    if (!demande) throw new ErreurAssociation(404, "Demande d’affiliation introuvable.");
    if (demande.statut === decision) return demande;
    if (demande.statut !== "EN_ATTENTE") throw new ErreurAssociation(409, "Cette demande a déjà été traitée.");
    const resultat = await db.associationMembre.updateMany({
      where: { associationId: id, profilId, statut: "EN_ATTENTE" },
      data: { statut: decision, rejointLe: decision === "VERIFIE" ? new Date() : null },
    });
    if (resultat.count !== 1) throw new ErreurAssociation(409, "Cette demande a été modifiée. Actualisez la page.");
    return db.associationMembre.findUniqueOrThrow({ where, select: affiliationSelection });
  }

  async function validerResponsable(id?: string | null) {
    if (!id) return;
    const profil = await db.profil.findFirst({ where: { id, ...PROFIL_VISIBLE }, select: { id: true } });
    if (!profil) throw new ErreurAssociation(400, "Le responsable doit être un membre validé ayant terminé son inscription.");
  }

  function exigerAdmin(identite: ActeurAssociation) {
    if (!identite.gestionnaireGlobal) throw new ErreurAssociation(403, "Cette action est réservée à l’administration.");
  }
  async function enregistrer(donnees: DonneesAssociation | Partial<DonneesAssociation>, identite: ActeurAssociation, id?: string) {
    exigerAdmin(identite);
    await validerResponsable(donnees.responsableId);
    if (id) await associationAccessible(id, identite);
    const association = id
      ? await db.association.update({ where: { id }, data: donnees })
      : await db.association.create({ data: donnees as DonneesAssociation });
    return fiche(association.id, identite);
  }

  async function responsables(q: string, identite: ActeurAssociation) {
    exigerAdmin(identite);
    const profils = await db.profil.findMany({
      where: { ...PROFIL_VISIBLE, AND: q.split(/\s+/).filter(Boolean).slice(0, 5).map((terme) => ({
        user: { OR: [{ prenom: { contains: terme } }, { nom: { contains: terme } }] },
      })) },
      select: PROFIL_PUBLIC, orderBy: [{ user: { nom: "asc" } }, { id: "asc" }], take: 20,
    });
    return { responsables: profils.map(formaterProfil) };
  }

  async function proposer(donnees: DonneesSuggestionAssociation, identite: ActeurAssociation) {
    const existante = await db.associationSuggestion.findFirst({
      where: { proposeurId: identite.profilId, nom: donnees.nom, pays: donnees.pays, ville: donnees.ville || null, statut: "EN_ATTENTE" },
      select: { id: true, statut: true, createdAt: true },
    });
    if (existante) return existante;
    return db.associationSuggestion.create({
      data: { ...donnees, proposeurId: identite.profilId }, select: { id: true, statut: true, createdAt: true },
    });
  }

  async function suggestions(pagination: PaginationAssociation & { statut?: "EN_ATTENTE" | "TRAITEE" | "REFUSEE" }, identite: ActeurAssociation) {
    exigerAdmin(identite);
    const { page, limite, statut } = pagination;
    const where = statut ? { statut } : {};
    const [total, propositions] = await Promise.all([
      db.associationSuggestion.count({ where }),
      db.associationSuggestion.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limite, take: limite,
        include: { proposeur: { select: { id: true, userId: true, user: { select: { prenom: true, nom: true } } } } },
      }),
    ]);
    return { suggestions: propositions.map(({ proposeur, ...s }) => ({
      ...s, proposeur: { id: proposeur.id, userId: proposeur.userId, prenom: proposeur.user.prenom, nom: proposeur.user.nom },
    })), ...meta(page, limite, total) };
  }

  async function traiterSuggestion(id: string, statut: "TRAITEE" | "REFUSEE", identite: ActeurAssociation) {
    exigerAdmin(identite);
    const suggestion = await db.associationSuggestion.findUnique({ where: { id }, select: { id: true } });
    if (!suggestion) throw new ErreurAssociation(404, "Proposition introuvable.");
    return db.associationSuggestion.update({ where: { id }, data: { statut } });
  }

  async function supprimer(id: string, identite: ActeurAssociation) {
    return db.$transaction(async (tx) => {
      const association = await tx.association.findUnique({
        where: { id }, select: { id: true, responsableId: true, photo: true, photoCouverture: true },
      });
      if (!association) throw new ErreurAssociation(404, "Association introuvable.");
      if (!identite.gestionnaireGlobal && association.responsableId !== identite.profilId) {
        throw new ErreurAssociation(403, "Vous ne pouvez pas supprimer cette association.");
      }
      await tx.associationMembre.deleteMany({ where: { associationId: id } });
      await tx.association.delete({ where: { id } });
      return [association.photo, association.photoCouverture].filter((url): url is string => !!url);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async function modifierMedia(id: string, champ: "photo" | "photoCouverture", url: string | null, identite: ActeurAssociation) {
    await autoriserGestion(id, identite);
    const ancienne = await db.association.findUnique({ where: { id }, select: { photo: true, photoCouverture: true } });
    await db.association.update({ where: { id }, data: { [champ]: url } });
    return { ancienMedia: ancienne?.[champ] || null };
  }

  return { acteur, liste, fiche, mesAssociations, membres, demanderAffiliation, quitter, decider,
    autoriserGestion, enregistrer, responsables, proposer, suggestions, traiterSuggestion, modifierMedia, supprimer };
}

export type ServiceAssociations = ReturnType<typeof creerServiceAssociations>;

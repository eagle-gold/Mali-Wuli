import { Prisma } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { COMMENTAIRE_ACTIF, PUBLICATION_ACTIVE } from "../services/corbeille.service";
import { roleEffectif, droitsUtilisateur, revisionDroits } from "../lib/roles";
import { champsLiensSociaux, liensSociauxProfil, modificationsLiensSociaux, selectionLiensSociaux } from "../lib/liens-sociaux";
import { authenticate, AuthRequest } from "../middlewares/auth.middleware";
import {
  supprimerUpload,
  uploadAvatar,
  uploadCouverture,
  verifierImageChargee,
} from "../middlewares/upload.middleware";

import { annuaireSchema, construireFiltresAnnuaire, filtreFormationAnnuaire, perimetreAnnuaire, promotionsFormation, sujetsAide } from "../services/annuaire";

const router = Router();

const FORMATION_SELECT = {
  id: true,
  type: true,
  etablissementId: true,
  programmeReferenceId: true,
  parcoursReferenceId: true,
  diplomeReferenceId: true,
  autreEtablissement: true,
  moisDebut: true,
  anneeDebut: true,
  moisFin: true,
  anneeFin: true,
  diplome: true,
  systemeEducatifCode: true,
  diplomesScolaires: true,
  mention: true,
  filiere: true,
  specialite: true,
  serie: true,
  statutDiplome: true,
  demarcheApresFormation: true,
  delaiPremierEmploi: true,
  emploiDansLes12Mois: true,
  lienEmploiFormation: true,
  enCours: true,
  etablissement: {
    select: {
      id: true,
      nom: true,
      sigle: true,
      type: true,
      ville: true,
      paysCode: true,
      pays: { select: { nom: true, drapeau: true } },
    },
  },
  programmeReference: { select: { id: true, nom: true, sigle: true, type: true, niveau: true } },
  parcoursReference: { select: { id: true, nom: true, sigle: true, type: true, niveau: true } },
  diplomeReference: { select: { id: true, nom: true, sigle: true, niveau: true } },
  avis: true,
} as const;

const EXPERIENCE_SELECT = {
  id: true,
  poste: true,
  entreprise: true,
  ville: true,
  pays: true,
  secteur: true,
  typeContrat: true,
  dateDebut: true,
  dateFin: true,
  estActuel: true,
  description: true,
} as const;

const PROFIL_ANNUAIRE_SELECT = {
  id: true,
  userId: true,
  titre: true,
  bio: true,
  photo: true,
  pays: true,
  ville: true,
  situation: true,
  estVolontaire: true,
  user: { select: { prenom: true, nom: true } },
  experiences: {
    where: { estActuel: true },
    orderBy: { dateDebut: "desc" as const },
    take: 1,
    select: { poste: true, entreprise: true },
  },
  cerclesMembres: {
    where: { statut: "ACCEPTE" as const },
    take: 5,
    select: { cercle: { select: { id: true, nom: true, theme: true } } },
  },
  formations: {
    orderBy: [{ anneeFin: "desc" as const }, { anneeDebut: "desc" as const }, { id: "asc" as const }],
    take: 3,
    select: { id: true, anneeFin: true, diplome: true, autreEtablissement: true, diplomesScolaires: true,
      avis: { select: { anneePromo: true } }, etablissement: { select: { id: true, nom: true, sigle: true } } },
  },
  volontaire: { select: { sujets: true } },
} satisfies Prisma.ProfilSelect;

const idSchema = z.string().trim().min(1).max(191);


const texteNullable = (maximum: number) =>
  z.union([z.string().trim().max(maximum), z.null()]).optional();

const miseAJourSchema = z.object({
  prenom: z.string().trim().min(1).max(100).optional(),
  nom: z.string().trim().min(1).max(100).optional(),
  telephone: texteNullable(40),
  pays: texteNullable(100),
  ville: texteNullable(100),
  titre: texteNullable(160),
  bio: texteNullable(2000),
  ...champsLiensSociaux,
  situation: z.union([
    z.enum(["ETUDIANT", "PROFESSIONNEL", "ENTREPRENEUR", "EN_RECHERCHE"]),
    z.null(),
  ]).optional(),
  emailVisible: z.boolean().optional(),
  telephoneVisible: z.boolean().optional(),
}).strict().refine((valeur) => Object.keys(valeur).length > 0, "Aucune modification fournie.");

const bioSchema = z.object({ bio: z.string().trim().max(2000) }).strict();

function valeurNullable(valeur: string | null | undefined) {
  return typeof valeur === "string" ? valeur || null : valeur;
}

async function lireProfilComplet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      prenom: true,
      nom: true,
      email: true,
      role: true,
      rolesDelegues: { select: { code: true } },
      statut: true,
      createdAt: true,
      profil: {
        select: {
          id: true,
          telephone: true,
          pays: true,
          ville: true,
          situation: true,
          titre: true,
          bio: true,
          photo: true,
          photoCouverture: true,
          ...selectionLiensSociaux,
          emailVisible: true,
          telephoneVisible: true,
          estVolontaire: true,
          onboardingEtape: true,
          onboardingFini: true,
          createdAt: true,
          formations: { select: FORMATION_SELECT, orderBy: [{ anneeDebut: "asc" }, { moisDebut: "asc" }, { id: "asc" }] },
          experiences: { select: EXPERIENCE_SELECT, orderBy: { dateDebut: "desc" } },
          volontaire: {
            select: {
              id: true,
              specialite: true,
              sujets: true,
              precisionsSujets: true,
              disponible: true,
              fuseau: true,
              dureeCreneau: true,
              format: true,
              dateDebut: true,
              dateFin: true,
              disponibilites: true,
              maxRdvMois: true,
              delaiMinResa: true,
            },
          },
          cerclesMembres: {
            where: { statut: "ACCEPTE" },
            select: {
              cercle: { select: { id: true, nom: true, theme: true, presidentId: true } },
            },
          },
        },
      },
    },
  });
  if (!user?.profil) return user ? { ...user, role: roleEffectif(user), ...droitsUtilisateur(user) } : user;

  const profilId = user.profil.id;
  const [nbSynergies, nbRdvAcceptes, nbPublications, nbCommentaires] = await Promise.all([
    prisma.synergie.count({
      where: { statut: "ACCEPTE", OR: [{ demandeurId: profilId }, { recepteurId: profilId }] },
    }),
    prisma.rendezVous.count({ where: { volontaire: { profilId }, statut: "ACCEPTE" } }),
    prisma.publication.count({ where: { auteurId: profilId, visible: true, ...PUBLICATION_ACTIVE } }),
    prisma.commentairePublication.count({ where: { auteurId: profilId, ...COMMENTAIRE_ACTIF, publication: PUBLICATION_ACTIVE } }),
  ]);
  const nbAvis = user.profil.formations.filter(({ avis }) => avis !== null).length;
  return {
    ...user,
    role: roleEffectif(user),
    ...droitsUtilisateur(user),
    profil: {
      ...user.profil,
      ...liensSociauxProfil(user.profil),
      cercles: user.profil.cerclesMembres.map(({ cercle }) => ({
        id: cercle.id,
        nom: cercle.nom,
        theme: cercle.theme,
        role: cercle.presidentId === profilId ? "president" : "membre",
      })),
      cerclesMembres: undefined,
      stats: {
        nbSynergies,
        nbRdvAcceptes,
        nbPublications,
        nbCommentaires,
        nbAvis,
        nbContributions: nbAvis + nbRdvAcceptes + nbPublications + nbCommentaires,
      },
    },
  };
}

// Lecture réservée aux consommateurs de session : aucune formation ni statistique.
router.get("/me/session", authenticate, async (req: AuthRequest, res: Response) => {
  res.set("Cache-Control", "private, no-store");
  try {
    if (!req.userId) return res.status(401).json({ message: "Session invalide." });
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, prenom: true, nom: true, email: true, role: true, statut: true,
        rolesDelegues: { select: { code: true } }, tokenVersion: true,
        profil: { select: {
          id: true, photo: true, onboardingEtape: true, onboardingFini: true,
          pays: true, ville: true, titre: true,
        } },
      },
    });
    // Une révocation intervenue depuis authenticate ne doit pas rafraîchir la session.
    if (!user || user.tokenVersion !== req.authenticatedUser?.tokenVersion) {
      return res.status(401).json({ message: "Session révoquée ou invalide." });
    }
    const { tokenVersion: _tokenVersion, ...session } = user;
    return res.json({ ...session, role: roleEffectif(user), ...droitsUtilisateur(user), revisionDroits: revisionDroits(user) });
  } catch (error) {
    console.error("[GET /users/me/session]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Session invalide." });
    const user = await lireProfilComplet(req.userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });
    if (!user.profil) return res.status(404).json({ message: "Profil introuvable." });
    return res.json(user);
  } catch (error) {
    console.error("[GET /users/me]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.route("/me").put(authenticate, mettreAJourProfil).patch(authenticate, mettreAJourProfil);

async function mettreAJourProfil(req: AuthRequest, res: Response) {
  const donnees = miseAJourSchema.safeParse(req.body);
  if (!donnees.success) {
    return res.status(400).json({
      message: "Informations invalides.",
      erreurs: donnees.error.flatten().fieldErrors,
    });
  }

  const { prenom, nom, ...profil } = donnees.data;
  try {
    if (!req.userId) return res.status(401).json({ message: "Session invalide." });
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(prenom !== undefined ? { prenom } : {}),
        ...(nom !== undefined ? { nom } : {}),
        profil: {
          upsert: {
            create: {
              telephone: valeurNullable(profil.telephone),
              pays: valeurNullable(profil.pays),
              ville: valeurNullable(profil.ville),
              titre: valeurNullable(profil.titre),
              bio: valeurNullable(profil.bio),
              ...modificationsLiensSociaux(profil),
              situation: profil.situation,
              emailVisible: profil.emailVisible,
              telephoneVisible: profil.telephoneVisible,
            },
            update: {
              ...(profil.telephone !== undefined ? { telephone: valeurNullable(profil.telephone) } : {}),
              ...(profil.pays !== undefined ? { pays: valeurNullable(profil.pays) } : {}),
              ...(profil.ville !== undefined ? { ville: valeurNullable(profil.ville) } : {}),
              ...(profil.titre !== undefined ? { titre: valeurNullable(profil.titre) } : {}),
              ...(profil.bio !== undefined ? { bio: valeurNullable(profil.bio) } : {}),
              ...modificationsLiensSociaux(profil),
              ...(profil.situation !== undefined ? { situation: profil.situation } : {}),
              ...(profil.emailVisible !== undefined ? { emailVisible: profil.emailVisible } : {}),
              ...(profil.telephoneVisible !== undefined
                ? { telephoneVisible: profil.telephoneVisible }
                : {}),
            },
          },
        },
      },
    });
    return res.json({ message: "Profil mis à jour.", user: await lireProfilComplet(req.userId) });
  } catch (error) {
    console.error("[PUT /users/me]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
}

router.patch("/me/bio", authenticate, async (req: AuthRequest, res: Response) => {
  const donnees = bioSchema.safeParse(req.body);
  if (!donnees.success) return res.status(400).json({ message: "Bio invalide." });
  try {
    const profil = await prisma.profil.update({
      where: { userId: req.userId },
      data: { bio: donnees.data.bio || null },
      select: { bio: true },
    });
    return res.json({ message: "Description mise à jour.", bio: profil.bio });
  } catch (error) {
    console.error("[PATCH /users/me/bio]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post(
  "/me/photo",
  authenticate,
  uploadAvatar.single("photo"),
  verifierImageChargee,
  async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ message: "Aucun fichier reçu." });
    const url = `/uploads/avatars/${req.file.filename}`;
    try {
      const ancien = await prisma.profil.findUnique({
        where: { userId: req.userId },
        select: { photo: true },
      });
      await prisma.profil.update({ where: { userId: req.userId }, data: { photo: url } });
      supprimerUpload(ancien?.photo);
      return res.json({ message: "Photo mise à jour.", url });
    } catch (error) {
      supprimerUpload(url);
      console.error("[POST /users/me/photo]", error);
      return res.status(500).json({ message: "Erreur lors de l’upload." });
    }
  },
);

router.delete("/me/photo", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existant = await prisma.profil.findUnique({
      where: { userId: req.userId },
      select: { photo: true },
    });
    await prisma.profil.update({ where: { userId: req.userId }, data: { photo: null } });
    supprimerUpload(existant?.photo);
    return res.json({ message: "Photo supprimée." });
  } catch (error) {
    console.error("[DELETE /users/me/photo]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post(
  "/me/couverture",
  authenticate,
  uploadCouverture.single("couverture"),
  verifierImageChargee,
  async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ message: "Aucun fichier reçu." });
    const url = `/uploads/couvertures/${req.file.filename}`;
    try {
      const ancien = await prisma.profil.findUnique({
        where: { userId: req.userId },
        select: { photoCouverture: true },
      });
      await prisma.profil.update({ where: { userId: req.userId }, data: { photoCouverture: url } });
      supprimerUpload(ancien?.photoCouverture);
      return res.json({ message: "Photo de couverture mise à jour.", url });
    } catch (error) {
      supprimerUpload(url);
      console.error("[POST /users/me/couverture]", error);
      return res.status(500).json({ message: "Erreur lors de l’upload." });
    }
  },
);

router.delete("/me/couverture", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existant = await prisma.profil.findUnique({
      where: { userId: req.userId },
      select: { photoCouverture: true },
    });
    await prisma.profil.update({ where: { userId: req.userId }, data: { photoCouverture: null } });
    supprimerUpload(existant?.photoCouverture);
    return res.json({ message: "Photo de couverture supprimée." });
  } catch (error) {
    console.error("[DELETE /users/me/couverture]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const query = annuaireSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Filtres invalides." });

  try {
    const moi = await prisma.profil.findUnique({ where: { userId: req.userId }, select: { id: true } });
    const { pays, page, limite, promotion, etablissementId } = query.data;
    const formationCorrespondante = filtreFormationAnnuaire(etablissementId, promotion);
    const where = construireFiltresAnnuaire(query.data, moi?.id);
    const perimetre = perimetreAnnuaire(moi?.id);
    const perimetreLocal = { ...perimetre, ...(pays ? { pays } : {}) };
    const [membres, total, totalGlobal, paysOptions, villesOptions, formationsOptions, aidesOptions] = await Promise.all([
      prisma.profil.findMany({
        where, select: { ...PROFIL_ANNUAIRE_SELECT, formations: { ...PROFIL_ANNUAIRE_SELECT.formations, ...(formationCorrespondante ? { where: formationCorrespondante } : {}) } },
        orderBy: [{ user: { prenom: "asc" } }, { user: { nom: "asc" } }, { id: "asc" }],
        skip: (page - 1) * limite, take: limite,
      }),
      prisma.profil.count({ where }),
      prisma.profil.count({ where: perimetre }),
      prisma.profil.findMany({ where: perimetre, distinct: ["pays"], select: { pays: true }, orderBy: { pays: "asc" } }),
      prisma.profil.findMany({ where: perimetreLocal, distinct: ["ville"], select: { ville: true }, orderBy: { ville: "asc" } }),
      prisma.formation.findMany({ where: { profil: perimetreLocal }, select: {
        anneeFin: true, diplomesScolaires: true, avis: { select: { anneePromo: true } },
        etablissement: { select: { id: true, nom: true } },
      } }),
      prisma.volontaire.findMany({ where: { profil: { ...perimetreLocal, estVolontaire: true } }, select: { sujets: true } }),
    ]);
    const etablissements = new Map<string, { id: string; nom: string }>();
    for (const formation of formationsOptions) if (formation.etablissement) etablissements.set(formation.etablissement.id, formation.etablissement);
    return res.json({
      membres: membres.map(({ cerclesMembres, volontaire: mentorat, formations, ...membre }) => ({
        ...membre,
        formations: formations.map(({ avis, diplomesScolaires, ...formation }) => ({ ...formation, anneePromo: promotion ?? avis?.anneePromo ?? promotionsFormation({ ...formation, diplomesScolaires })[0] ?? null })),
        aides: membre.estVolontaire ? sujetsAide(mentorat?.sujets) : [],
        cercles: cerclesMembres.map(({ cercle }) => cercle),
      })),
      page,
      limite,
      total,
      totalPages: Math.ceil(total / limite),
      totalGlobal,
      facettes: {
        pays: paysOptions.map(p => p.pays).filter((p): p is string => Boolean(p)),
        villes: villesOptions.map(p => p.ville).filter((p): p is string => Boolean(p)),
        etablissements: [...etablissements.values()].sort((a,b) => a.nom.localeCompare(b.nom, "fr")),
        promotions: [...new Set(formationsOptions.flatMap(promotionsFormation))].sort((a,b) => b-a),
        aides: [...new Set(aidesOptions.flatMap(v => sujetsAide(v.sujets)))].sort((a,b) => a.localeCompare(b, "fr")),
      },
    });
  } catch (error) {
    console.error("[GET /users]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "Identifiant invalide." });

  try {
    const moi = await prisma.profil.findUnique({ where: { userId: req.userId }, select: { id: true } });
    const profil = await prisma.profil.findFirst({
      where: {
        OR: [{ id: id.data }, { userId: id.data }],
        onboardingFini: true,
        user: { statut: "VALIDE" },
      },
      select: {
        id: true,
        userId: true,
        telephone: true,
        pays: true,
        ville: true,
        situation: true,
        titre: true,
        bio: true,
        photo: true,
        photoCouverture: true,
        ...selectionLiensSociaux,
        emailVisible: true,
        telephoneVisible: true,
        estVolontaire: true,
        user: { select: { prenom: true, nom: true, email: true, createdAt: true } },
        formations: { select: FORMATION_SELECT, orderBy: [{ anneeDebut: "asc" }, { moisDebut: "asc" }, { id: "asc" }] },
        experiences: { select: EXPERIENCE_SELECT, orderBy: { dateDebut: "desc" } },
        volontaire: {
          select: {
            specialite: true,
            sujets: true,
            precisionsSujets: true,
            disponible: true,
            fuseau: true,
            dureeCreneau: true,
            format: true,
            dateDebut: true,
            dateFin: true,
            disponibilites: true,
            maxRdvMois: true,
            delaiMinResa: true,
          },
        },
        cerclesMembres: {
          where: { statut: "ACCEPTE" },
          select: { cercle: { select: { id: true, nom: true, theme: true } } },
        },
        associations: {
          where: { statut: "VERIFIE", association: { valide: true } },
          select: { association: { select: { id: true, nom: true, description: true, pays: true, ville: true, vocation: true, photo: true, photoCouverture: true, site: true, dateCreation: true } } },
        },
        _count: {
          select: {
            publications: { where: { visible: true, ...PUBLICATION_ACTIVE } },
            commentairesPub: { where: { ...COMMENTAIRE_ACTIF, publication: PUBLICATION_ACTIVE } },
          },
        },
      },
    });
    if (!profil) return res.status(404).json({ message: "Profil introuvable." });

    const synergie = moi && moi.id !== profil.id
      ? await prisma.synergie.findUnique({
          where: { clePaire: [moi.id, profil.id].sort().join(":") },
          select: { id: true, statut: true, demandeurId: true, recepteurId: true },
        })
      : null;
    const nbSynergies = await prisma.synergie.count({
      where: { statut: "ACCEPTE", OR: [{ demandeurId: profil.id }, { recepteurId: profil.id }] },
    });
    const { user, cerclesMembres, associations, _count, emailVisible, telephoneVisible, ...publicProfil } = profil;
    return res.json({
      ...publicProfil,
      ...liensSociauxProfil(publicProfil),
      estMoi: moi?.id === profil.id,
      prenom: user.prenom,
      nom: user.nom,
      email: emailVisible ? user.email : null,
      telephone: telephoneVisible ? profil.telephone : null,
      membreDepuis: user.createdAt,
      associations: associations.map(({ association }) => association),
      cercles: cerclesMembres.map(({ cercle }) => cercle),
      synergie,
      stats: {
        nbSynergies,
        nbPublications: _count.publications,
        nbCommentaires: _count.commentairesPub,
      },
    });
  } catch (error) {
    console.error("[GET /users/:id]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;

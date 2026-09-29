/**
 * Base Prisma simulée en mémoire pour les tests de routes (aucune base, aucun réseau).
 * Couvre le sous-ensemble utilisé par publications, corbeille et signalements :
 * where (égalité, null, in/not/gte/gt/lt/lte, AND/OR/NOT, relations is/some, chemins JSON),
 * select imbriqué, _count filtré, orderBy, take, cascades et transactions avec rollback.
 */
import type { Request, Response, Router } from "express";
import { signerTokenAcces } from "../lib/auth-token";

type Row = Record<string, any>;
type Relation = { table: string; cle: string; vers?: string; multiple?: boolean };

const RELATIONS: Record<string, Record<string, Relation>> = {
  publication: {
    auteur: { table: "profil", cle: "auteurId" },
    reactions: { table: "reactionPublication", cle: "publicationId", multiple: true },
    commentaires: { table: "commentairePublication", cle: "publicationId", multiple: true },
  },
  commentairePublication: {
    auteur: { table: "profil", cle: "auteurId" },
    publication: { table: "publication", cle: "publicationId" },
    parent: { table: "commentairePublication", cle: "parentId" },
    reponses: { table: "commentairePublication", cle: "parentId", multiple: true },
  },
  reactionPublication: { auteur: { table: "profil", cle: "auteurId" } },
  signalement: { signaleur: { table: "profil", cle: "signaleurId" } },
  offre: { publieur: { table: "profil", cle: "publieurId" } },
  message: {
    auteur: { table: "profil", cle: "auteurId" },
    conversation: { table: "conversation", cle: "conversationId" },
  },
  conversation: { participants: { table: "conversationMembre", cle: "conversationId", multiple: true } },
};
/** Suppressions en cascade (FK ON DELETE CASCADE du schéma). */
const CASCADES: Record<string, Array<{ table: string; cle: string }>> = {
  publication: [{ table: "commentairePublication", cle: "publicationId" }, { table: "reactionPublication", cle: "publicationId" }],
  commentairePublication: [{ table: "commentairePublication", cle: "parentId" }],
};

export function creerBaseMemoire(initial: Record<string, Row[]>) {
  let tables: Record<string, Row[]> = structuredClone(initial);
  const lignes = (table: string) => (tables[table] ||= []);
  let compteur = 0;
  const echecs = new Set<string>();

  function cible(table: string, row: Row, nom: string) {
    const rel = RELATIONS[table]?.[nom];
    if (!rel) return undefined;
    if (rel.multiple) return lignes(rel.table).filter((r) => r[rel.cle] === row.id);
    const id = row[rel.cle];
    return id == null ? null : lignes(rel.table).find((r) => r.id === id) || null;
  }

  function scalaire(x: any, v: any): boolean {
    if (v === null) return x == null;
    if (v instanceof Date) return x instanceof Date && x.getTime() === v.getTime();
    if (typeof v !== "object") return x === v;
    return Object.entries(v).every(([op, val]: [string, any]) => {
      if (op === "in") return val.includes(x);
      if (op === "notIn") return !val.includes(x);
      if (op === "not") return val === null ? x != null : !scalaire(x, val);
      if (op === "equals") return scalaire(x, val);
      if (op === "gte") return x != null && x >= val;
      if (op === "gt") return x != null && x > val;
      if (op === "lte") return x != null && x <= val;
      if (op === "lt") return x != null && x < val;
      if (op === "path") return true;
      throw Error(`Opérateur non simulé : ${op}`);
    });
  }

  function correspond(table: string, row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (k === "AND") return (v as Row[]).every((w) => correspond(table, row, w));
      if (k === "OR") return (v as Row[]).some((w) => correspond(table, row, w));
      if (k === "NOT") return !(Array.isArray(v) ? v : [v]).some((w) => correspond(table, row, w));
      const rel = RELATIONS[table]?.[k];
      if (rel) {
        const valeur = cible(table, row, k);
        if (rel.multiple) {
          if ("some" in v) return (valeur as Row[]).some((r) => correspond(rel.table, r, v.some));
          if ("none" in v) return !(valeur as Row[]).some((r) => correspond(rel.table, r, v.none));
          throw Error("Filtre de relation multiple non simulé");
        }
        if (v === null) return valeur === null;
        const filtre = "is" in v ? v.is : v;
        if (filtre === null) return valeur === null;
        return Boolean(valeur) && correspond(rel.table, valeur as Row, filtre);
      }
      if (v && typeof v === "object" && "path" in v) {
        const cle = String(v.path).replace(/^\$\./, "");
        return row[k] && typeof row[k] === "object" && scalaire(row[k][cle], { equals: v.equals });
      }
      const x = row[k];
      // Objet imbriqué simulé (ex. profil.user) : filtre récursif.
      if (x && typeof x === "object" && !(x instanceof Date) && !Array.isArray(x) && v && typeof v === "object") return correspond("", x, v);
      return scalaire(x, v);
    });
  }

  function trier(rows: Row[], orderBy?: Row | Row[]) {
    const ordres = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o) => Object.entries(o));
    return [...rows].sort((a, b) => {
      for (const [champ, sens] of ordres) {
        const x = a[champ] instanceof Date ? a[champ].getTime() : a[champ];
        const y = b[champ] instanceof Date ? b[champ].getTime() : b[champ];
        if (x === y) continue;
        return (x < y ? -1 : 1) * (sens === "desc" ? -1 : 1);
      }
      return 0;
    });
  }

  function projeter(table: string, row: Row | null, select?: Row, include?: Row): Row | null {
    if (!row) return null;
    if (!select && !include) return { ...row };
    const sortie: Row = select ? {} : { ...row };
    for (const [k, v] of Object.entries(select || include || {})) {
      if (!v) continue;
      if (k === "_count") {
        sortie._count = Object.fromEntries(Object.entries(v.select).map(([nom, opts]: [string, any]) => {
          const rel = RELATIONS[table][nom];
          const liste = cible(table, row, nom) as Row[];
          return [nom, opts === true ? liste.length : liste.filter((r) => correspond(rel.table, r, opts.where)).length];
        }));
        continue;
      }
      const rel = RELATIONS[table]?.[k];
      if (rel) {
        const valeur = cible(table, row, k);
        const opts = v === true ? {} : v;
        if (rel.multiple) {
          let liste = (valeur as Row[]).filter((r) => correspond(rel.table, r, opts.where));
          liste = trier(liste, opts.orderBy);
          if (opts.take) liste = liste.slice(0, opts.take);
          sortie[k] = liste.map((r) => projeter(rel.table, r, opts.select, opts.include));
        } else sortie[k] = projeter(rel.table, valeur as Row | null, opts.select, opts.include);
        continue;
      }
      if (v === true) sortie[k] = row[k];
      else if (Array.isArray(row[k])) sortie[k] = row[k];
      else if (v.select) sortie[k] = row[k] == null ? null : Object.fromEntries(Object.keys(v.select).map((c) => [c, row[k][c]]));
    }
    return sortie;
  }

  function delegue(table: string) {
    const trouver = (args: Row = {}) => {
      let rows = lignes(table).filter((r) => correspond(table, r, args.where));
      rows = trier(rows, args.orderBy);
      if (args.skip) rows = rows.slice(args.skip);
      if (args.take) rows = rows.slice(0, args.take);
      return rows;
    };
    const echouer = (op: string) => { if (echecs.has(`${table}.${op}`)) throw Error(`FIXTURE_${table}_${op}_FAILURE`); };
    const supprimer = (row: Row) => {
      for (const { table: enfant, cle } of CASCADES[table] || []) {
        for (const r of lignes(enfant).filter((x) => x[cle] === row.id)) delegue(enfant).__supprimer(r);
      }
      tables[table] = lignes(table).filter((r) => r !== row);
    };
    return {
      __supprimer: supprimer,
      findUnique: async (args: Row) => projeter(table, trouver({ where: args.where })[0] || null, args.select, args.include),
      findFirst: async (args: Row = {}) => projeter(table, trouver(args)[0] || null, args.select, args.include),
      findMany: async (args: Row = {}) => trouver(args).map((r) => projeter(table, r, args.select, args.include)),
      count: async (args: Row = {}) => trouver({ where: args.where }).length,
      create: async (args: Row) => {
        echouer("create");
        const row = { id: `${table}-${++compteur}`, createdAt: new Date(), ...args.data };
        lignes(table).push(row);
        return projeter(table, row, args.select, args.include);
      },
      update: async (args: Row) => {
        echouer("update");
        const row = lignes(table).find((r) => correspond(table, r, args.where));
        if (!row) throw Object.assign(Error("Record not found"), { code: "P2025" });
        Object.assign(row, args.data);
        return projeter(table, row, args.select, args.include);
      },
      updateMany: async (args: Row) => {
        echouer("update");
        const rows = trouver({ where: args.where });
        for (const r of rows) Object.assign(r, args.data);
        return { count: rows.length };
      },
      delete: async (args: Row) => {
        echouer("delete");
        const row = trouver({ where: args.where })[0];
        if (!row) throw Object.assign(Error("Record not found"), { code: "P2025" });
        supprimer(row);
        return row;
      },
      deleteMany: async (args: Row = {}) => {
        echouer("delete");
        const rows = trouver({ where: args.where });
        for (const r of rows) if (lignes(table).includes(r)) supprimer(r);
        return { count: rows.length };
      },
    };
  }

  const tablesConnues = ["profil", "publication", "commentairePublication", "reactionPublication", "notification", "signalement", "association", "etablissement", "evenement", "offre", "message", "conversation", "conversationMembre", "synergie"];
  const db: any = Object.fromEntries(tablesConnues.map((t) => [t, delegue(t)]));
  db.$transaction = async (action: (tx: any) => Promise<unknown>, options?: Row) => {
    if (options) db.__niveauxIsolation.push(options.isolationLevel);
    const copie = structuredClone(tables);
    try { return await action(db); } catch (erreur) { tables = copie; throw erreur; }
  };
  db.__niveauxIsolation = [] as string[];
  return {
    db,
    table: (nom: string) => lignes(nom),
    ligne: (nom: string, id: string) => lignes(nom).find((r) => r.id === id),
    echec: (op: string, actif = true) => { if (actif) echecs.add(op); else echecs.delete(op); },
  };
}

/** Profil simulé avec l'utilisateur imbriqué, comme les `select` des routes l'attendent. */
export const profilMemoire = (id: string, extra: Row = {}) => ({
  id, userId: `user-${id}`, pays: "Mali", ville: "Bamako", titre: null, photo: null,
  user: { prenom: "Test", nom: id, statut: "VALIDE" }, cerclesMembres: [], ...extra,
});

/** Compte simulé pour `authenticate` (prisma.user.findUnique remplacé par le test). */
export const compteMemoire = (id: string, extra: Row = {}) => ({
  id: `user-${id}`, email: `${id}@example.invalid`, role: "MEMBRE", emailVerifie: true, tokenVersion: 0,
  statut: "VALIDE", rolesDelegues: [] as Array<{ code: string }>, ...extra,
});

/** Exécute une requête sur un routeur Express sans serveur HTTP. */
export async function requeteMemoire(router: Router, method: string, url: string, options: { compte?: string | null; body?: Row; base?: string } = {}) {
  const [path, recherche = ""] = url.split("?");
  const compte = options.compte === undefined ? "owner" : options.compte;
  const headers = compte ? { authorization: `Bearer ${signerTokenAcces({ id: `user-${compte}`, tokenVersion: 0 })}` } : {};
  const req = {
    method, url, path, originalUrl: `${options.base || "/api"}${url}`, headers,
    query: Object.fromEntries(new URLSearchParams(recherche)), body: options.body || {}, params: {},
  } as unknown as Request;
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json(corps: any) { resolve({ status, body: corps }); return this; } } as unknown as Response;
    (router as any).handle(req, res, (erreur?: unknown) => erreur ? reject(erreur) : resolve({ status: 404, body: {} }));
  });
}

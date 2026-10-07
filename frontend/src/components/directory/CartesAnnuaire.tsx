"use client";

import { TITRE_PAR_DEFAUT } from "@/lib/titre-membre";
import Link from "next/link";
import { MapPin, GraduationCap, UsersRound } from "lucide-react";
import { nomComplet } from "@/lib/community";
import type { Association } from "@/types/associations";
import BoutonAffiliation from "@/components/associations/BoutonAffiliation";
import { ActionsMembre, AvatarAnnuaire } from "./DirectoryUi";
import type { MembreAnnuaire } from "./types";
import styles from "./Directory.module.css";

export function CartePersonne({ membre }: { membre: MembreAnnuaire }) {
  const nom = nomComplet(membre.user.prenom, membre.user.nom);
  const formation = membre.formations?.[0];
  const etablissement = formation?.etablissement?.nom || formation?.autreEtablissement;
  const promotion = formation?.anneePromo ?? formation?.anneeFin;
  // Lien « étiré » : toute la carte mène au profil, les boutons du pied restent cliquables au-dessus.
  return <article className={`${styles.card} ${styles.directoryCard} relative transition hover:border-[#2a5b37] focus-within:border-[#2a5b37]`}><div className={styles.cardHead}><AvatarAnnuaire nom={nom} photo={membre.photo} /><div className={styles.memberMain}><h2 className={styles.cardTitle}><Link href={`/membres/${encodeURIComponent(membre.id)}`} className="after:absolute after:inset-0 after:rounded-[15px] after:content-[''] hover:underline focus:outline-none focus-visible:underline">{nom}</Link></h2><p className={styles.cardRole}>{membre.titre?.trim() || membre.experiences?.[0]?.poste || TITRE_PAR_DEFAUT}</p></div></div><p className={styles.location}><MapPin size={13} aria-hidden />{[membre.ville, membre.pays].filter(Boolean).join(", ") || "Localisation non renseignée"}</p>{etablissement && <p className={styles.location} style={{ marginTop: 9 }}><GraduationCap size={14} aria-hidden /><span>{etablissement}{promotion ? ` · promo ${promotion}` : ""}</span></p>}<div className={styles.tags}>{membre.aides?.map((aide) => <span key={aide} className={styles.tag}>{aide}</span>)}{membre.estVolontaire && <span className={`${styles.tag} ${styles.tagBrown}`}>Volontaire</span>}</div><div className={`${styles.directoryFooter} relative z-10`}><ActionsMembre profilId={membre.id} /></div></article>;
}

export function CarteAssociation({ association, actualiser }: { association: Association; actualiser: () => void }) {
  return <article className={`${styles.card} ${styles.directoryCard}`}><div className={styles.cardHead}><AvatarAnnuaire nom={association.nom} photo={association.photo} carre /><div className={styles.memberMain}><h2 className={styles.cardTitle}>{association.nom}</h2>{association.vocation && <p className={styles.associationVocation}>{association.vocation}</p>}</div></div>{association.description && <p className={`${styles.description} ${styles.cardDescription}`}>{association.description}</p>}<p className={styles.location}><MapPin size={13} aria-hidden />{[association.ville, association.pays].filter(Boolean).join(", ")}</p><p className={styles.location} style={{ margin: "9px 0 17px" }}><UsersRound size={14} aria-hidden />{association.nbMembres} membre{association.nbMembres > 1 ? "s" : ""} dans le réseau</p><div className={`${styles.directoryFooter} ${styles.actionRow}`}><Link className={styles.button} href={`/associations/${encodeURIComponent(association.id)}`}>Voir la page</Link><BoutonAffiliation association={association} actualiser={actualiser} compact /></div></article>;
}


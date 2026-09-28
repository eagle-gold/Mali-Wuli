import type { ModeCandidature, ModeTravail, TypeOffre } from "@/types/offres";
export const TYPES_OFFRE: {value:TypeOffre;label:string}[] = [
 {value:"CDI",label:"CDI"},{value:"CDD",label:"CDD"},{value:"STAGE",label:"Stage"},{value:"ALTERNANCE",label:"Alternance"},{value:"FREELANCE",label:"Freelance"},
];
export const MODES_TRAVAIL: {value:ModeTravail;label:string}[] = [{value:"SUR_SITE",label:"Sur site"},{value:"HYBRIDE",label:"Hybride"},{value:"TELETRAVAIL",label:"Télétravail"}];
export const MODES_CANDIDATURE: {value:ModeCandidature;label:string}[] = [{value:"MALI_WULI",label:"Via Mali Wuli"},{value:"EMAIL",label:"Par e-mail"},{value:"LIEN_EXTERNE",label:"Lien externe"}];
export const SECTEURS_OFFRES = ["Tech & digital","Finance & banque","Commerce & vente","Éducation","Santé","BTP & industrie","Agriculture","Communication & médias","Transport & logistique","Hôtellerie & restauration","Administration","ONG & associations","Autre"];
export const libelleModeTravail=(mode:ModeTravail)=>MODES_TRAVAIL.find(x=>x.value===mode)?.label||mode;
export const libelleTypeOffre=(type:TypeOffre)=>TYPES_OFFRE.find(x=>x.value===type)?.label||type;
export function lienExterneSur(url:string|null|undefined){try{const u=new URL(url||'');return (u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function dateLimiteOffre(jour:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(jour))throw new Error('Date limite invalide.');const d=new Date(`${jour}T23:59:59.999Z`);if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==jour)throw new Error('Date limite invalide.');return d.toISOString();}

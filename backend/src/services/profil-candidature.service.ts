import PDFDocument from "pdfkit";
import path from "node:path";
import { prisma } from "../lib/prisma";

export type ProfilCandidature = {
 id: string; titre?: string | null; bio?: string | null; ville?: string | null; pays?: string | null;
 telephone?: string | null; telephoneVisible?: boolean; linkedin?: string | null;
 user: { prenom: string | null; nom: string | null; email: string };
 experiences: { poste:string; entreprise:string; dateDebut:Date; dateFin:Date|null; estActuel:boolean; ville?:string|null; pays?:string|null; description?:string|null }[];
 formations: { anneeDebut:number|null; moisDebut:number|null; anneeFin:number|null; moisFin:number|null; enCours:boolean; autreEtablissement:string|null; diplome:string|null; filiere:string|null; specialite:string|null; mention:string|null; serie:string|null; diplomesScolaires:unknown; etablissement:{nom:string}|null; programmeReference?:{libelle:string}|null; diplomeReference?:{libelle:string}|null }[];
};
const texte = (value:unknown) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim() : '';
const licence = (value:unknown) => texte(value).replace(/^L[123]\s*[-–—:]?\s*/i,'Licence - ');
const joindre = (...values:unknown[]) => values.map(texte).filter(Boolean).join(' · ');
const urlSure = (value:string|null|undefined) => {try{const u=new URL(value||'');return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}};
const date = (value:Date) => new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(value);
function annee(value:number|null,mois:number|null){return value ? (mois?date(new Date(Date.UTC(value,mois-1,1))):String(value)) : 'Date non renseignée';}

/** Données professionnelles uniquement : aucune note interne, demande privée ou secret. */
export async function lireProfilCandidature(profilId:string):Promise<ProfilCandidature> {
 const profil = await prisma.profil.findUnique({
   where: { id: profilId },
   select: {
     id: true, titre: true, bio: true, ville: true, pays: true,
     telephone: true, telephoneVisible: true, linkedin: true,
     user: { select: { prenom: true, nom: true, email: true } },
     experiences: { orderBy: { dateDebut: 'desc' }, select: {
       poste: true, entreprise: true, dateDebut: true, dateFin: true,
       estActuel: true, ville: true, pays: true, description: true,
     } },
     formations: { orderBy: [{ anneeDebut: 'desc' }, { moisDebut: 'desc' }], select: {
       anneeDebut: true, moisDebut: true, anneeFin: true, moisFin: true,
       enCours: true, autreEtablissement: true, diplome: true, filiere: true,
       specialite: true, mention: true, serie: true, diplomesScolaires: true,
       etablissement: { select: { nom: true } },
     } },
   },
 });
 if(!profil)throw new Error('Profil introuvable.');
 return profil;
}

export function creerProfilCandidaturePdf(profil:ProfilCandidature):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const nom=joindre(profil.user.prenom,profil.user.nom).replace(' · ',' ');
  const doc=new PDFDocument({size:'A4',margins:{top:48,bottom:54,left:48,right:48},bufferPages:true,info:{Title:`Profil - ${nom}`,Author:'Mali Wuli',Subject:'Candidature professionnelle'}});
  const morceaux:Buffer[]=[];doc.on('data',chunk=>morceaux.push(chunk));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(morceaux)));
  try{
   const fonts=path.resolve(__dirname,'../../assets/fonts');
   doc.registerFont('Regular',path.join(fonts,'NotoSans-Regular.ttf'));doc.registerFont('Bold',path.join(fonts,'NotoSans-Bold.ttf'));
   const largeur=doc.page.width-96, vert='#0d6738', brun='#705136', noir='#2e261f',gris='#766b5e';
   const place=(height:number)=>{if(doc.y+height>doc.page.height-64)doc.addPage();};
   const paragraph=(value:string,size=10,color=noir)=>{if(!value)return;doc.font('Regular').fontSize(size).fillColor(color).text(value,{width:largeur,lineGap:3});doc.moveDown(0.5);};
   const section=(title:string)=>{place(68);doc.moveDown(0.7);const y=doc.y;doc.moveTo(48,y).lineTo(doc.page.width-48,y).strokeColor('#e9ddc8').stroke();doc.y=y+15;doc.font('Bold').fontSize(13).fillColor(brun).text(title);doc.moveDown(0.6);};
   doc.font('Bold').fontSize(10).fillColor(vert).text('MALI WULI   /   PROFIL PROFESSIONNEL');doc.moveDown(0.8);
   doc.font('Bold').fontSize(25).fillColor(noir).text(nom,{width:largeur});doc.moveDown(0.2);
   const recent=[...profil.experiences].sort((a,b)=>b.dateDebut.getTime()-a.dateDebut.getTime());
   paragraph(texte(profil.titre)||recent.find(e=>e.estActuel)?.poste||recent[0]?.poste||'',12,brun);
   paragraph(joindre(profil.ville,profil.pays));
   paragraph(joindre(profil.user.email,profil.telephoneVisible?profil.telephone:null),10,gris);
   const linkedin=urlSure(profil.linkedin);if(linkedin)paragraph(linkedin,9,vert);
   const origin='https://mali-wuli.com';
   const profilUrl=`${origin}/membres/${encodeURIComponent(profil.id)}`;
   doc.font('Regular').fontSize(9).fillColor(vert).text('Voir le profil sur Mali Wuli',{link:profilUrl,underline:true});
   if(texte(profil.bio)){section('À propos');paragraph(texte(profil.bio));}
   if(recent.length){section('Expériences');for(const e of recent){place(70);doc.font('Bold').fontSize(11).fillColor(noir).text(joindre(e.poste,e.entreprise),{width:largeur});doc.moveDown(0.2);paragraph(`${date(e.dateDebut)} - ${e.estActuel?'aujourd’hui':e.dateFin?date(e.dateFin):'Fin non renseignée'}${joindre(e.ville,e.pays)?` · ${joindre(e.ville,e.pays)}`:''}`,9,gris);paragraph(texte(e.description));doc.moveDown(0.25);}}
   if(profil.formations.length){section('Formations');for(const f of [...profil.formations].sort((a,b)=>(b.anneeDebut||0)*12+(b.moisDebut||1)-(a.anneeDebut||0)*12-(a.moisDebut||1))){place(70);doc.font('Bold').fontSize(11).fillColor(noir).text(texte(f.etablissement?.nom)||texte(f.autreEtablissement)||'Établissement non renseigné',{width:largeur});doc.moveDown(0.2);paragraph(`${annee(f.anneeDebut,f.moisDebut)} - ${f.enCours?'en cours':annee(f.anneeFin,f.moisFin)}`,9,gris);
    const diplomes=Array.isArray(f.diplomesScolaires)?f.diplomesScolaires:[];
    if(diplomes.length){for(const brut of diplomes){if(!brut||typeof brut!=='object')continue;const d=brut as Record<string,unknown>;paragraph(joindre(d.libelle||d.diplome||d.type,d.anneeObtention?String(d.anneeObtention):'',d.mention?`Mention ${texte(d.mention)}`:'',d.serie),10);}}
    else paragraph(joindre(licence(f.diplomeReference?.libelle||f.diplome),licence(f.programmeReference?.libelle||f.filiere||f.specialite),f.mention?`Mention ${f.mention}`:'',f.serie));
    doc.moveDown(0.25);
   }}
   const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);const ancienneMarge=doc.page.margins.bottom;doc.page.margins.bottom=0;const y=doc.page.height-37;doc.font('Regular').fontSize(8).fillColor(gris).text(`Mali Wuli · ${nom}`,48,y,{width:largeur-70,lineBreak:false});doc.text(`${i+1} / ${range.count}`,doc.page.width-100,y,{width:52,align:'right',lineBreak:false});doc.page.margins.bottom=ancienneMarge;}
   doc.end();
  }catch(error){doc.destroy();reject(error);}
 });
}
export async function genererProfilCandidaturePdf(profilId:string){return creerProfilCandidaturePdf(await lireProfilCandidature(profilId));}

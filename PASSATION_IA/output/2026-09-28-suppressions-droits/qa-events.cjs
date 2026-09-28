// Fixtures locales uniquement : aucun accès DB, fichier privé ou réseau sortant.
function initialEvents() {
  const events = [
    ['forum','Forum emploi Bamako','2026-10-18T09:00:00Z','2026-10-18T17:00:00Z','Mali','Bamako','PRESENTIEL','Africa/Bamako'],
    ['afterwork','Afterwork diaspora','2026-10-25T18:00:00Z','2026-10-25T21:00:00Z','France','Paris 8e','PRESENTIEL','Europe/Paris'],
    ['mentorat','Mentorat : réussir sa première candidature','2026-10-29T19:00:00Z',null,'France','Paris','EN_LIGNE','Europe/Paris'],
    ['webinaire','Webinaire : revenir au Mali','2026-11-07T18:00:00Z',null,'Mali','Bamako','EN_LIGNE','Africa/Bamako'],
    ['montreal','Rencontre des Maliens de Montréal','2026-11-14T19:00:00Z',null,'Canada','Montréal','PRESENTIEL','America/Toronto'],
    ['sante','Journée santé : formation échographie','2026-11-28T10:00:00Z',null,'Mali','Kayes','PRESENTIEL','Africa/Bamako'],
    ['rentree','Soirée de rentrée des étudiants','2026-09-12T17:00:00Z','2026-09-12T21:00:00Z','Belgique','Bruxelles','PRESENTIEL','Europe/Brussels'],
    ['table-ronde','Table ronde : entreprendre au Mali','2026-08-30T17:00:00Z',null,'Mali','Bamako','EN_LIGNE','Africa/Bamako'],
    ['tournoi','Tournoi de football de la diaspora','2026-11-21T14:00:00Z',null,'France','Saint-Denis','PRESENTIEL','Europe/Paris'],
    ['atelier','Atelier : lever des fonds pour sa startup','2026-12-03T19:00:00Z',null,'Mali','Bamako','EN_LIGNE','Africa/Bamako'],
  ].map(([id,titre,dateDebut,dateFin,pays,ville,type,fuseauHoraire],index)=>({
    id:`qa-event-${id}`,titre,dateDebut,dateFin,pays,ville,type,fuseauHoraire,
    description:"Une rencontre pour échanger, partager ses expériences et construire des projets entre les membres du réseau.",
    lieu:type==='EN_LIGNE'?null:`Maison des rencontres, ${ville}`,lienVideo:type==='EN_LIGNE'?'https://example.test/rencontre':null,
    photoCouverture:null,programme:[{heure:'09:00',libelle:'Accueil des participants'},{heure:'10:00',libelle:'Présentations et échanges'},{heure:'12:00',libelle:'Temps de rencontre libre'}],
    resume:index>=6&&index<8?'Des échanges utiles, des idées partagées et de nouvelles rencontres entre membres.':null,
    capacite:id==='forum'?2:60,organisateurId:index%2?'qa-manager':'qa-samba',valide:index<8,refuse:false,createdAt:'2026-09-27T10:00:00Z',
    participants:index===6?['qa-membre','qa-aminata','qa-fatou']:['qa-oumar'],photos:[],
  }));
  return events;
}

function dispatchEvents(method,path,params,body,req,c) {
  const {state,p,fail,saveImage,person,publicPerson,paginate}=c;
  const mod=require('./qa-admin.cjs').has(p,'EVENEMENTS_MODERER');
  const passed=e=>Date.parse(e.dateFin||e.dateDebut)<=Date.now();
  const personView=id=>{const v=person(id);return v?{...publicPerson(v),nomComplet:`${v.prenom} ${v.nom}`} : null;};
  const photoView=(ph,e)=>({...ph,auteur:personView(ph.auteurId),peutSupprimer:mod||e.organisateurId===p.id||ph.auteurId===p.id});
  const eventView=e=>({...e,participants:undefined,photos:undefined,organisateur:personView(e.organisateurId),nbParticipants:e.participants.length,
    statut:e.valide?'VALIDE':e.refuse?'REFUSE':'EN_ATTENTE',estInscrit:e.participants.includes(p.id),estProprietaire:e.organisateurId===p.id,
    peutSupprimer:mod||e.organisateurId===p.id,estPasse:passed(e),peutModifier:mod||e.organisateurId===p.id,peutModerer:mod,
    peutAjouterPhotos:mod||e.organisateurId===p.id||(e.valide&&e.participants.includes(p.id))});
  const meta=page=>({page:page.page,limite:page.limite,total:page.total,totalPages:page.totalPages});
  if(path==='/api/evenements'&&method==='GET') {
    const status=params.get('statut'),period=params.get('periode')||'a_venir';
    if(['en_attente','refuses'].includes(status)&&!mod)fail(403,'Accès réservé à la modération.');
    const geography=e=>(!params.get('pays')||e.pays===params.get('pays'))&&(!params.get('ville')||e.ville===params.get('ville'))&&(!params.get('type')||e.type===params.get('type'));
    const published=state.events.filter(e=>e.valide&&geography(e));
    const values=state.events.filter(e=>geography(e)&&(status==='mes'?e.organisateurId===p.id:status==='en_attente'?!e.valide&&!e.refuse:status==='refuses'?e.refuse:e.valide)
      &&(period==='tous'||(period==='passes'?passed(e):!passed(e)))&&(!params.get('participation')||e.organisateurId===p.id||e.participants.includes(p.id)))
      .sort((a,b)=>(Date.parse(a.dateDebut)-Date.parse(b.dateDebut))*(period==='passes'?-1:1));
    const page=paginate(values,params);return {evenements:page.values.map(eventView),meta:meta(page),peutModerer:mod,
      compteurs:{aVenir:published.filter(e=>!passed(e)).length,passes:published.filter(passed).length,aValider:mod?state.events.filter(e=>!e.valide&&!e.refuse).length:0,mesPropositions:state.events.filter(e=>e.organisateurId===p.id).length},
      facettes:{pays:[...new Set(state.events.filter(e=>e.valide).map(e=>e.pays))].sort(),villes:[...new Set(state.events.filter(e=>e.valide&&(!params.get('pays')||e.pays===params.get('pays'))).map(e=>e.ville))].sort()}};
  }
  if(path==='/api/evenements'&&method==='POST') {
    if(!body.titre||body.description?.length<10||Date.parse(body.dateDebut)<=Date.now())fail(400,'Événement incomplet ou date passée.');
    const e={...body,id:`qa-event-created-${++state.sequence}`,valide:mod,refuse:false,organisateurId:p.id,participants:[],photos:[],photoCouverture:null,createdAt:new Date().toISOString()};state.events.push(e);return {evenement:eventView(e),message:mod?'Événement publié.':'Proposition enregistrée.'};
  }
  const match=/^\/api\/evenements\/([^/]+)(?:\/(participants|photos|couverture|validation|participer))?(?:\/([^/]+))?$/.exec(path);
  if(!match)fail(404,'Route événements inconnue.');
  const e=state.events.find(v=>v.id===match[1]);if(!e||(!e.valide&&!mod&&e.organisateurId!==p.id))fail(404,'Événement introuvable.');
  const [,id,action,photoId]=match;const manage=mod||e.organisateurId===p.id;
  if(!action&&method==='GET')return {evenement:eventView(e),participants:e.participants.slice(0,12).map(personView),totalParticipants:e.participants.length,photos:e.photos.slice(0,24).map(ph=>photoView(ph,e)),totalPhotos:e.photos.length};
  if(!action&&method==='DELETE'){if(!manage)fail(403,'Suppression non autorisée.');state.events=state.events.filter(v=>v.id!==e.id);for(const url of [e.photoCouverture,...e.photos.map(ph=>ph.url)])if(url)state.uploads.delete(url);return{message:'Événement fictif supprimé.'};}
  if(!action&&method==='PATCH'){if(!manage)fail(403,'Modification non autorisée.');const main=Object.keys(body).some(k=>k!=='resume'&&JSON.stringify(body[k])!==JSON.stringify(e[k]));Object.assign(e,body);if(main&&!mod){e.valide=false;e.refuse=false;}return{evenement:eventView(e),message:'Événement modifié.'};}
  if(action==='validation'&&method==='PATCH'){if(!mod)fail(403,'Modération requise.');e.valide=body.valide;e.refuse=!body.valide;return{evenement:eventView(e),message:'Décision enregistrée.'};}
  if(action==='participer') {
    if(method==='POST'){if(!e.valide||Date.parse(e.dateDebut)<=Date.now())fail(409,'Inscriptions fermées.');if(!e.participants.includes(p.id)){if(e.capacite&&e.participants.length>=e.capacite)fail(409,'Événement complet.');e.participants.push(p.id);}return {estInscrit:true,message:'Participation confirmée.'};}
    if(method==='DELETE'){if(passed(e))fail(409,'Cet événement est terminé.');e.participants=e.participants.filter(id=>id!==p.id);return{estInscrit:false,message:'Participation annulée.'};}
  }
  if(action==='participants'&&method==='GET'){const page=paginate(e.participants.map(personView),params);return{participants:page.values,meta:meta(page)};}
  if(action==='couverture'){if(!manage)fail(403,'Modification non autorisée.');const old=e.photoCouverture;e.photoCouverture=method==='POST'?saveImage(req,body,'couverture',10*1024*1024):null;if(old)state.uploads.delete(old);return{evenement:eventView(e)};}
  if(action==='photos'){
    if(method==='GET'){const page=paginate(e.photos,params);return{photos:page.values.map(ph=>photoView(ph,e)),meta:meta(page)};}
    if(method==='POST'){if(!eventView(e).peutAjouterPhotos)fail(403,'Inscrivez-vous pour ajouter des photos.');const url=saveImage(req,body,'photo',10*1024*1024);const photo={id:`qa-photo-${++state.sequence}`,url,legende:null,auteurId:p.id,createdAt:new Date().toISOString()};e.photos.unshift(photo);return{photo:photoView(photo,e),message:'Photo ajoutée.'};}
    if(method==='DELETE'){const photo=e.photos.find(ph=>ph.id===photoId);if(!photo)fail(404,'Photo introuvable.');if(!photoView(photo,e).peutSupprimer)fail(403,'Suppression non autorisée.');e.photos=e.photos.filter(ph=>ph!==photo);state.uploads.delete(photo.url);return{message:'Photo supprimée.'};}
  }
  fail(404,'Action événements non implémentée dans les fixtures.');
}
module.exports={initialEvents,dispatchEvents};

/* UI checks in memory. No live API, authentication, filesystem mutation or database. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root='/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend';
const staged=path.join(__dirname,'staging/frontend/src');
const ts=require(path.join(root,'node_modules/typescript')),React=require(path.join(root,'node_modules/react'));
const {renderToStaticMarkup}=require(path.join(root,'node_modules/react-dom/server'));
const checks=[],apiCalls=[],navigations=[];
const jsx=require(path.join(root,'node_modules/react/jsx-runtime'));
const style=new Proxy({}, {get:(_o,k)=>String(k)});
const fixtures={
 '/users':{membres:[],total:0,totalGlobal:23,page:1,limite:12,totalPages:0,facettes:{pays:['Mali'],villes:['Bamako'],etablissements:[{id:'school',nom:'Liberté'}],promotions:[2019],aides:['Orientation']}},
 '/associations':{associations:[],total:0,totalGlobal:7,page:1,totalPages:0,facettes:{pays:['Mali'],villes:['Bamako'],vocations:['Éducation']}},
};
const api={
 get:async(url,config)=>{apiCalls.push({method:'GET',url,params:config?.params});assert(url in fixtures,`Unexpected GET ${url}`);return {data:fixtures[url]};},
 post:async(url,body)=>{apiCalls.push({method:'POST',url,body});return {data:url==='/messages/conversations'?{conversationId:'conversation-fixture'}:{monAffiliation:{statut:'EN_ATTENTE'}}};},
 delete:async(url)=>{apiCalls.push({method:'DELETE',url});return {data:{}};},
 patch:async(url,body)=>{apiCalls.push({method:'PATCH',url,body});return {data:{}};},
};
const defaults={react:React,'react/jsx-runtime':jsx,'lucide-react':require(path.join(root,'node_modules/lucide-react')),
 'next/link':({children,...props})=>React.createElement('a',props,children),
 'next/navigation':{useRouter:()=>({push:url=>navigations.push(url)}),useSearchParams:()=>new URLSearchParams()},
 '@/lib/api':api,'@/lib/media':{urlMediaBackend:v=>v||null},'@/lib/community':{nomComplet:(a,b)=>[a,b].filter(Boolean).join(' '),messageErreur:(_e,f)=>f},
 '@/hooks/useCountries':{useCountries:()=>[{code:'ML',nom:'Mali'}]},
 '@/lib/periode':{trierParDateDebut:a=>[...a].sort((a,b)=>a.anneeDebut-b.anneeDebut),formaterMoisAnnee:(_m,y)=>y},
 '@/lib/education/reference':{libelleProgramme:v=>v,libelleSystemeEducatif:v=>v},
 '@/components/community/CommunityUi':{Chargement:({texte})=>jsx.jsx('p',{children:texte}),ErreurChargement:({message})=>jsx.jsx('p',{children:message})},
};
function load(file, overrides={},extra='') {
 const filename=path.join(staged,file),source=fs.readFileSync(filename,'utf8')+extra;
 const imports={...defaults,...overrides},module={exports:{}};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require(id){
  if(id.endsWith('.module.css'))return {__esModule:true,default:style};
  if(id in imports)return imports[id];
  const local=id.startsWith('@/')?id.slice(2):id.startsWith('.')?path.relative(staged,path.resolve(path.dirname(filename),id)):null;
  if(local){for(const ext of ['.tsx','.ts'])if(fs.existsSync(path.join(staged,local+ext)))return load(local+ext,overrides);}
  throw new Error(`Unmocked ${id}`);
 },console,URL,AbortController,FormData,setTimeout,clearTimeout,window:{setTimeout,clearTimeout}});
 return module.exports;
}
function harness(seed={}) {
 let index=0,effects=[];const state=[];
 return {react:{...React,useState(initial){const i=index++;if(!(i in state))state[i]=i in seed?seed[i]:typeof initial==='function'?initial():initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useRef:value=>({current:value}),useMemo:fn=>fn(),useId:()=>':fixture:'},
 render(fn,props){index=0;effects=[];return fn(props);},effects:()=>effects,state};
}
function nodes(element){if(element==null||typeof element==='boolean')return[];if(Array.isArray(element))return element.flatMap(nodes);if(typeof element!=='object')return[element];return [element,...nodes(element.props?.children)];}
const label=e=>nodes(e).filter(n=>typeof n==='string'||typeof n==='number').join('');
const button=(tree,text)=>nodes(tree).find(n=>n?.type==='button'&&label(n).includes(text));
const settle=()=>new Promise(r=>setTimeout(r,0));
async function main(){
 const allowedPageExports=new Set(['default','config','generateStaticParams','revalidate','dynamic','dynamicParams','fetchCache','preferredRegion','runtime','maxDuration','metadata','generateMetadata','viewport','generateViewport','experimental_ppr']);
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
 for(const file of walk(path.join(staged,'app')).filter(file=>file.endsWith('/page.tsx'))){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  for(const statement of ast.statements){
   if(!statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)||statement.modifiers.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword))continue;
   const names=ts.isVariableStatement(statement)?statement.declarationList.declarations.map(d=>d.name.text):[statement.name?.text];
   for(const name of names.filter(Boolean))assert(allowedPageExports.has(name),`Unsupported Next page export ${name} in ${file}`);
  }
 }
 checks.push('next-app-router-pages-only-expose-supported-exports');

 const assoc={id:'association-fixture',nom:'Association test',description:'Une mission réelle.',pays:'Mali',ville:'Bamako',vocation:'Éducation',site:null,emailContact:null,photo:null,photoCouverture:null,dateCreation:null,createdAt:'2026-09-28T12:00:00Z',responsable:null,nbMembres:4,monAffiliation:null,peutGerer:false};
 const page=load('components/directory/CartesAnnuaire.tsx');
 const card=renderToStaticMarkup(React.createElement(page.CartePersonne,{membre:{id:'profil-fixture',userId:'user-fixture',user:{prenom:'Awa',nom:'Diarra'},ville:'Bamako',pays:'Mali',titre:'Médecin',estVolontaire:true,aides:['Orientation'],formations:[{id:'f',etablissement:{id:'school',nom:'Liberté'},anneePromo:2019}]}}));
 for(const value of ['Awa Diarra','Orientation','Volontaire','Liberté','promo 2019','Voir le profil','Contacter','Proposer une synergie','href="/membres/profil-fixture"'])assert(card.includes(value));
 const acard=renderToStaticMarkup(React.createElement(page.CarteAssociation,{association:assoc,actualiser(){}}));
 for(const value of ['Association test','4 membres','Voir la page','Rejoindre','href="/associations/association-fixture"'])assert(acard.includes(value));
 checks.push('cards-use-real-counts-education-aid-and-keep-member-actions');
 const h=harness(); const ui=load('components/directory/DirectoryUi.tsx',{react:h.react});
 let tree=h.render(ui.ActionsMembre,{profilId:'profil-fixture'});
 button(tree,'Contacter').props.onClick();await settle();
 assert.deepEqual(JSON.parse(JSON.stringify(apiCalls.at(-1))),{method:'POST',url:'/messages/conversations',body:{destinataireId:'profil-fixture'}});
 assert.equal(navigations.at(-1),'/messages?conversation=conversation-fixture');
 tree=h.render(ui.ActionsMembre,{profilId:'profil-fixture'});button(tree,'Proposer une synergie').props.onClick();await settle();
 assert.equal(apiCalls.at(-1).url,'/synergies');assert.equal(apiCalls.at(-1).body.recepteurProfilId,'profil-fixture');
 tree=h.render(ui.ActionsMembre,{profilId:'profil-fixture'});assert(button(tree,'Demande envoyée').props.disabled);
 checks.push('contact-selects-conversation-and-synergy-action-remains');
 const join=harness();let refresh=0;const affiliation=load('components/associations/BoutonAffiliation.tsx',{react:join.react});
 tree=join.render(affiliation.default,{association:assoc,actualiser(){refresh++;}});button(tree,'Rejoindre').props.onClick();await settle();
 assert.equal(apiCalls.at(-1).url,'/associations/association-fixture/affiliation');assert.equal(apiCalls.at(-1).method,'POST');assert.equal(refresh,1);
 const pending={...assoc,monAffiliation:{statut:'EN_ATTENTE',rejointLe:null}};
 tree=join.render(affiliation.default,{association:pending,actualiser(){refresh++;}});assert(label(tree).includes('avant qu’elle apparaisse sur votre profil'));const before=apiCalls.length;button(tree,'Annuler').props.onClick();assert.equal(apiCalls.length,before);
 tree=join.render(affiliation.default,{association:pending,actualiser(){refresh++;}});button(tree,'Confirmer').props.onClick();await settle();assert.equal(apiCalls.at(-1).method,'DELETE');
 checks.push('affiliation-pending-label-and-confirmed-cancellation');
 const dh=harness({0:'personnes',1:'Awa',2:'Awa',3:{pays:'Mali',ville:'Bamako',etablissementId:'school',promotion:'2019',aide:'Orientation',situation:'PROFESSIONNEL',volontaire:true,vocation:''},4:2});
 const directory=load('app/(platform)/annuaire/page.tsx',{react:dh.react},'\nexport { AnnuaireContenu };');
 dh.render(directory.AnnuaireContenu);dh.effects().at(-1)();await settle();const query=apiCalls.at(-1);assert.equal(query.url,'/users');
 for(const [key,value] of Object.entries({q:'Awa',pays:'Mali',ville:'Bamako',etablissementId:'school',promotion:'2019',aide:'Orientation',situation:'PROFESSIONNEL',volontaire:'true',page:2,limite:12}))assert.equal(query.params[key],value);
 tree=dh.render(directory.AnnuaireContenu);button(tree,'Associations').props.onClick();dh.render(directory.AnnuaireContenu);dh.effects().at(-1)();await settle();const aq=apiCalls.at(-1);assert.equal(aq.url,'/associations');assert.equal(aq.params.page,1);assert(!('aide' in aq.params));assert(!('etablissementId' in aq.params));
 assert.equal(nodes(tree).find(n=>n?.type==='input'&&n.props.type==='search').props.maxLength,100);
 checks.push('directory-filters-and-tab-change-target-correct-endpoint');
 const busy=[],sh=harness({0:true,3:{nom:'Une association',pays:'Mali',ville:'Bamako',vocation:'Éducation',message:'Présentation'}});
 const proposal=load('components/associations/ProposerAssociation.tsx',{react:sh.react});tree=sh.render(proposal.default,{apiBase:'/onboarding/associations',onBusyChange:v=>busy.push(v)});
 nodes(tree).find(n=>n?.type==='form').props.onSubmit({preventDefault(){}});await settle();assert.equal(apiCalls.at(-1).url,'/onboarding/associations/suggestions');assert.deepEqual(busy,[true,false]);
 checks.push('onboarding-proposal-uses-restricted-endpoint-and-busy-state');
 const ph=harness({0:{id:'p',userId:'u',prenom:'Awa',nom:'Diarra',estMoi:false,formations:[],experiences:[],associations:[{id:assoc.id,nom:assoc.nom,pays:'Mali'}]},1:false});
 const profile=load('components/directory/ProfilPublic.tsx',{react:ph.react});const profileHtml=renderToStaticMarkup(React.createElement(profile.default,{profilId:'p'}));assert(profileHtml.includes('Association test'));assert(profileHtml.includes('Affiliations validées'));assert(!profileHtml.includes('mailto:'));assert(!profileHtml.includes('tel:'));
 checks.push('public-profile-shows-provided-associations-and-no-hidden-contact-placeholder');
 console.log(JSON.stringify({status:'passed',checks,simulatedActions:apiCalls.length,networkCalls:0,databaseWrites:0,limitations:['Simulated React hooks, API and router; no live session or visual browser test','Backend access control and affiliation selection tested separately']},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

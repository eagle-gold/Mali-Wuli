const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const target = process.argv[2];
const live = target?.startsWith('https://');
assert(target, 'release nodejs directory or public URL required');
const base = live ? target.replace(/\/$/, '') : 'http://127.0.0.1:31544';
const child = live ? null : spawn(process.execPath, ['server.js'], { cwd: target, env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: '31544' }, stdio: ['ignore','pipe','pipe'] });
let logs = '';
child?.stdout.on('data', d => logs += d.toString()); child?.stderr.on('data', d => logs += d.toString());
async function read(url) {
 const r = await fetch(base + url, {signal: AbortSignal.timeout(25000)});
 assert.equal(r.status, 200, `${url}: HTTP ${r.status}`); return r;
}
(async () => {
 try {
  if (child) {
   let ready=false;
   for(let i=0;i<30;i++) { if(child.exitCode!==null) throw new Error(logs); try{await read('/');ready=true;break;}catch{} await new Promise(r=>setTimeout(r,300)); }
   assert(ready,'candidate not ready');
  }
  const res=await read('/'); const html=await res.text();
  assert(res.headers.get('cache-control')?.includes('no-store'),'HTML cache must remain no-store');
  for(const value of ['L’arbre','Mali Wuli','Le fil du réseau','Vos questions','viewBox="70 -45 1060 765"']) assert(html.includes(value),`Missing ${value}`);
  assert(html.includes('Paris 8e'),'Paris 8e missing');
  assert(!html.includes('Paris 11e'),'Old Paris 11e remains');
  assert(!html.includes('support.js'),'prototype runtime shipped');
  assert(!/illustrati(?:f|ve)/i.test(html),'Illustrative label remains in HTML');
  const assets=[...new Set([...html.matchAll(/(?:src|href)="([^"\s]+)"/g)].map(m=>m[1]).filter(p=>p.startsWith('/_next/') || p.startsWith('/images/')))];
  const resources=await Promise.all(assets.map(async p=>({path:p,response:await read(p)})));
  for(const resource of resources.filter(r=>r.path.includes('/app/page-'))) {
   const bundle=await resource.response.text();
   for(const label of ['Profils et chiffres présentés','Arbre illustratif','Publications et profils illustratifs','Événements illustratifs','Profil illustratif']) assert(!bundle.includes(label),'Removed label in homepage bundle: '+label);
  }
  const fonts=[];
  for(const resource of resources.filter(r=>r.path.endsWith('.css'))) {
   const css=await resource.response.text();
   for(const match of css.matchAll(/url\(['"]?([^)'"\s]+\.woff2)['"]?\)/g)) {
    const font=new URL(match[1],base+resource.path).pathname;
    if(!fonts.includes(font)) fonts.push(font);
   }
  }
  assert(fonts.length>0 || assets.some(p=>p.endsWith('.woff2')),'font files missing from HTML and CSS');
  await Promise.all(fonts.map(p=>read(p)));
  for(const font of fonts) if(!assets.includes(font)) assets.push(font);
  const logo=await read('/images/landing/mali-wuli-arbre.png'); assert(logo.headers.get('content-type')?.startsWith('image/'));
  const protectedAssets=new Set();
  const forbidden=['Mes cercles','Les cercles','Cercles qui peuvent vous intéresser','Découvrir les cercles','Gérer mes cercles','Tous les cercles','rejoindre un cercle','cercles de réflexion','cercle_modifie','mes-cercles','Mes synergies','Synergies','Proposer une synergie','synergie_creee','synergie_mise_a_jour','synergie_supprimee','synergie:created','synergie:updated','synergie:deleted'];
  for(const route of ['/register','/login','/dashboard','/profil','/annuaire','/onboarding','/admin','/messages']) {
   const pageHtml=await (await read(route)).text();
   for(const label of forbidden) assert(!pageHtml.includes(label),'Removed circle UI in '+route+': '+label);
   for(const match of pageHtml.matchAll(/<script[^>]+src="([^"]+)"/g)) protectedAssets.add(match[1]);
  }
  for(const asset of protectedAssets) {
   const bundle=await (await read(asset)).text();
   for(const label of forbidden) assert(!bundle.includes(label),'Removed circle logic in '+asset+': '+label);
  }
  for (const retiredRoute of ['/cercles', '/synergies']) {
  const redirect=await fetch(base+retiredRoute,{redirect:'manual',signal:AbortSignal.timeout(25000)});
  assert([307,308].includes(redirect.status),'Retired circle route must redirect');
  assert.equal(new URL(redirect.headers.get('location'),base).pathname,'/dashboard','Old feature URL destination');
  }

  console.log(JSON.stringify({status:'passed',base,buildId:live?undefined:fs.readFileSync(path.join(target,'.next/BUILD_ID'),'utf8').trim(),assetsChecked:assets.length,memberBundlesChecked:protectedAssets.size,retiredRoutes:['/cercles -> /dashboard','/synergies -> /dashboard'],checks:['home HTTP 200','no-store','tree SVG','home sections','bundles CSS fonts image HTTP 200','no prototype runtime','register/login/member routes reachable','no circle or synergy feature in member bundles','old circle and synergy routes redirect'],homeAssets:assets}));
 } finally { child?.kill('SIGTERM'); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});

'use strict';
// Anonymous GET/filesystem diagnostics only. No API/auth/session/app mutation.
const fs=require('node:fs'),crypto=require('node:crypto');
const root='/home/u668963025/domains/mali-wuli.com/hbuilds';
const ops='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/liens-sociaux-ops';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const decode=v=>v.replace(/\\x([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\u\{([0-9a-f]{1,6})\}/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/\\u([0-9a-f]{4})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));
const candidate=JSON.parse(fs.readFileSync(ops+'/candidate-smoke.json','utf8'));
const headers=r=>Object.fromEntries([...r.headers].filter(([k])=>/cache|age|etag|last-modified|server|vary|content-type|encoding|date/.test(k)));
async function get(p){const r=await fetch('https://mali-wuli.com'+p,{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await r.arrayBuffer());return{path:p,status:r.status,headers:headers(r),bytes,text:bytes.toString('utf8')};}
const assets=t=>[...new Set([...t.matchAll(/(?:src|href)="([^"\s]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&')).filter(x=>x.startsWith('/_next/')&&x.endsWith('.js')))];
(async()=>{const rows=[];for(const route of ['/profil','/profil?mw_readonly_diagnostic=liens-sociaux','/membres/00000000-0000-4000-8000-000000000000','/onboarding','/']){
 const page=await get(route);const list=assets(page.text);const chunks=[];for(const p of list){const result=await get(p);const code=decode(result.text);let localHash=null;const file=root+'/current/nodejs/.next/'+p.slice('/_next/'.length);if(fs.existsSync(file))localHash=hash(fs.readFileSync(file));chunks.push({path:p,status:result.status,headers:result.headers,sha256:hash(result.bytes),candidateSha256:candidate.assetHashes[p]||null,localHash,bytes:result.bytes.length,labels:['Réseaux sociaux','Réseaux sociaux (facultatif)','Facebook','Instagram','TikTok','Synergies possibles pour vous'].filter(x=>code.includes(x)),socialFragments:[...code.matchAll(/.{0,20}(?:sociaux|Facebook).{0,45}/g)].map(m=>m[0]).slice(0,4)});}
 rows.push({route,status:page.status,headers:page.headers,htmlSha256:hash(page.bytes),chunks});
 }
 console.log(JSON.stringify({at:new Date().toISOString(),target:fs.readlinkSync(root+'/current'),buildId:fs.readFileSync(root+'/current/nodejs/.next/BUILD_ID','utf8').trim(),candidateBuildId:candidate.buildId,candidateSocialCheck:candidate.checks.includes('optional-four-network-fields-and-safe-own-public-profile-links-present-in-bundles'),rows,databaseRequests:0,remoteWrites:0},null,2));
})().catch(()=>{console.error('READONLY_PUBLIC_DIAGNOSTIC_FAILED');process.exitCode=1});

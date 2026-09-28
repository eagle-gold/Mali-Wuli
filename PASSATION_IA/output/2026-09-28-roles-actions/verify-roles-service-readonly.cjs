'use strict';
// Compiled candidate services, existing database accounts, strict read-only Prisma proxy.
// No HTTP/JWT, role assignment, server, sockets, notifications or e-mail.
const path=require('node:path'),assert=require('node:assert/strict');
const {contract,options,connect,auditMigrations,digest,safeFailure}=require('./guard-migration.cjs');
const READS=new Set(['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy']);
function readonlyClient(client){
 const delegates=new Map();return new Proxy(client,{get(target,name){
  if(typeof name!=='string'||name.startsWith('$')||name.startsWith('_'))throw Error('READ_ONLY_GUARD');
  if(!delegates.has(name)){const delegate=target[name];if(!delegate||typeof delegate!=='object')throw Error('READ_ONLY_GUARD');delegates.set(name,new Proxy(delegate,{get(object,operation){if(!READS.has(operation)||typeof object[operation]!=='function')throw Error('READ_ONLY_GUARD');return object[operation].bind(object);},set(){throw Error('READ_ONLY_GUARD');}}));}return delegates.get(name);
 },set(){throw Error('READ_ONLY_GUARD');}});
}
async function userRoleFingerprint(client){const rows=await client.$queryRaw`SELECT id,role,tokenVersion,statut,emailVerifie FROM User ORDER BY id`;return digest(JSON.stringify(rows.map(row=>[row.id,row.role,Number(row.tokenVersion),row.statut,Boolean(row.emailVerifie)])));}
async function verifyService(connection){
 const {client,from,backend}=connection,db=readonlyClient(client);
 const before=await userRoleFingerprint(client),grantsBefore=await db.userRoleGrant.count();
 const admins=await db.user.findMany({where:{role:'ADMIN'},select:{id:true,role:true,email:true,statut:true,emailVerifie:true,tokenVersion:true,rolesDelegues:{select:{code:true}}}});
 assert.equal(admins.length,1,'ADMIN_COUNT');const owner=admins[0];
 const registry=from(path.join(backend,'dist/lib/roles.js'));assert(registry.estAdminPrincipal(owner),'PRINCIPAL_IDENTITY');assert(owner.statut==='VALIDE'&&owner.emailVerifie,'PRINCIPAL_STATUS');
 const deny=()=>{throw Error('SIDE_EFFECT_FORBIDDEN');};const {creerServiceGestionMembres}=from(path.join(backend,'dist/services/admin-membres.service.js'));
 const service=creerServiceGestionMembres(db,{revoquerSockets:deny,notifierInscription:deny});
 const roles=await service.roles(owner.id);const expected=['INSCRIPTIONS','OFFRES','EVENEMENTS','CATALOGUE','ASSOCIATIONS'];
 assert.deepEqual(roles.roles.map(role=>role.code).sort(),[...expected].sort(),'DELEGATED_ROLE_CATALOGUE');assert(roles.roles.every(role=>role.attribuable&&Array.isArray(role.permissions)&&role.permissions.length>0),'ROLE_DESCRIPTIONS');
 assert.equal(roles.peutGererRoles,true,'OWNER_ROLE_MANAGEMENT');assert.equal(roles.roleCourant,'ADMIN','OWNER_EFFECTIVE_ROLE');assert(Array.isArray(roles.rolesDelegues)&&Array.isArray(roles.permissions),'OWNER_RIGHTS_SHAPE');assert(roles.permissions.includes('ROLES_GERER')&&roles.permissions.includes('STATS_CONSULTER'),'OWNER_CAPABILITIES');
 const members=await service.liste(owner.id,{page:1,limite:30});assert(members.membres.every(member=>!('tokenVersion'in member)),'TOKEN_VERSION_DISCLOSURE');
 for(const member of members.membres){assert(Array.isArray(member.rolesDelegues)&&Array.isArray(member.permissions),'MEMBER_RIGHTS_SHAPE');assert(/^[a-f0-9]{64}$/.test(member.revisionDroits||''),'RIGHTS_REVISION_MISSING');}
 const ownerList=await service.liste(owner.id,{q:owner.email,page:1,limite:30});const self=ownerList.membres.find(member=>member.id===owner.id);assert(self&&self.estAdminPrincipal&&!self.peutModifierRole,'OWNER_PROTECTION');
 const ordinary=await db.user.findFirst({where:{role:'MEMBRE',statut:'VALIDE',emailVerifie:true,rolesDelegues:{none:{}}},select:{id:true}});
 if(ordinary)await assert.rejects(()=>service.roles(ordinary.id),error=>error.statut===403,'ORDINARY_ROLE_MANAGEMENT_DENIED');
 assert.equal(await userRoleFingerprint(client),before,'USER_ROLES_CHANGED_DURING_READS');assert.equal(await db.userRoleGrant.count(),grantsBefore,'GRANTS_CHANGED_DURING_READS');
 return {ownerProtected:true,adminCount:admins.length,memberCount:members.total,ordinaryDenied:!!ordinary,delegatedRoles:expected,grantsCount:grantsBefore,checks:['compiled registry and candidate service on existing DB through read-only delegates','five assignable delegated capabilities without ADMIN or MODERATEUR choice','protected principal and revision hashes','no tokenVersion in member payload','ordinary role catalogue denied if existing ordinary account available','User fingerprints and grant count unchanged'],limitations:['No specialized grant assigned to a real account; authorization matrix tested with fixtures separately.','No HTTP authentication or JWT minted.','Concurrent legitimate role changes can fail the stability check and require review.']};
}
async function main(opts){let client;try{const connection=await connect(opts);client=connection.client;const migrations=await auditMigrations(client,connection.backend,true);return{status:'PASS',kind:'delegated-roles-service-readonly',at:new Date().toISOString(),...migrations,...await verifyService(connection),databaseWrites:0,realRoleChanges:0};}finally{await client?.$disconnect();}}
module.exports={readonlyClient,userRoleFingerprint,verifyService};
if(require.main===module){let opts;try{opts=options(process.argv.slice(2));}catch{console.error('INVALID_ARGUMENTS');process.exitCode=2;}
 if(opts?.help)console.log('Read-only: node verify-roles-service-readonly.cjs --backend /ABS/versions/20260928-roles-actions/nodejs. Requires the migration already applied.');
 else if(opts)main(opts).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(JSON.stringify({status:'FAIL',check:safeFailure(error),databaseWrites:0}));process.exitCode=1;});}

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const backend = '/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds/versions/20260928-annuaire-associations/nodejs';
const config = require(path.join(backend, 'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend, '.env')));
const {PrismaClient} = require(path.join(backend, 'node_modules/@prisma/client'));
const prisma = new PrismaClient({datasources:{db:{url:config.DATABASE_URL}}});
(async()=>{
  try {
    const [{db}] = await prisma.$queryRaw`SELECT DATABASE() AS db`;
    assert.equal(db,'u668963025_maliwuli');
    const rows = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;
    assert(rows.every(r=>r.finished_at && !r.rolled_back_at), 'Unfinished or rolled back migration requires review');
    const dir=path.join(backend,'prisma/migrations');
    const names=fs.readdirSync(dir).filter(n=>fs.statSync(path.join(dir,n)).isDirectory()).sort();
    for(const row of rows){
      assert(names.includes(row.migration_name),'Applied migration absent from source');
      assert.equal(createHash('sha256').update(fs.readFileSync(path.join(dir,row.migration_name,'migration.sql'))).digest('hex'),row.checksum,'Applied migration checksum differs');
    }
    const pending=names.filter(n=>!rows.some(r=>r.migration_name===n));
    assert.deepEqual(pending,['20260928180000_association_directory']);
    const front='/home/u668963025/domains/mali-wuli.com/hbuilds';
    const back='/home/u668963025/domains/floralwhite-ram-987223.hostingersite.com/hbuilds';
    assert.equal(fs.readlinkSync(front+'/current'),'versions/20260928-menu-synergies');
    assert.equal(fs.readlinkSync(back+'/current'),'versions/20260921-profile-schools-r2');
    console.log(JSON.stringify({status:'PASS',at:new Date().toISOString(),database:db,appliedCount:rows.length,pending,allAppliedChecksumsMatch:true,currentTargetsUnchanged:true},null,2));
  } finally { await prisma.$disconnect(); }
})().catch(e=>{console.error('Migration guard failed:',e.code||e.name);process.exitCode=1;});

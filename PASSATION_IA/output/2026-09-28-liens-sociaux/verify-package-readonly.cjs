'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const g=require('./guard-migration.cjs');const [part,archive]=process.argv.slice(2);
assert(['frontend','backend'].includes(part)&&path.isAbsolute(archive),'PACKAGE_ARGUMENTS');g.assertTargets();
const record=JSON.parse(fs.readFileSync(path.join(__dirname,'package-contract.json'),'utf8'));
assert.equal(record.release,g.contract.release,'PACKAGE_RELEASE');assert.equal(g.digest(fs.readFileSync(path.join(__dirname,'migration-contract.json'))),record.migrationContractSha256,'MIGRATION_CONTRACT_CHANGED');assert.equal(g.digest(fs.readFileSync(path.join(__dirname,'source-manifest.json'))),record.manifestSha256,'PACKAGE_MANIFEST_CHANGED');
const hash=crypto.createHash('sha256');(async()=>{for await(const chunk of fs.createReadStream(archive))hash.update(chunk);assert.equal(hash.digest('hex'),record.archives[part],'ARCHIVE_CHANGED');console.log(JSON.stringify({status:'PASS',kind:'source-archive',release:g.contract.release,part,remoteWrites:0}));})().catch(()=>{console.error('ARCHIVE_CHECK_FAILED');process.exitCode=1;});

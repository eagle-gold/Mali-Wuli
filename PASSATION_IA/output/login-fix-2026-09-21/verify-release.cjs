const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = process.argv[2];
assert(root, 'Release directory required');
const base = 'http://127.0.0.1:31543';
const publicApi = 'https://floralwhite-ram-987223.hostingersite.com/api';
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: '31543' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', data => { logs += data.toString(); });
child.stderr.on('data', data => { logs += data.toString(); });

async function read(url) {
  const response = await fetch(base + url, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
  return response;
}

(async () => {
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
      try { await read('/login'); ready = true; break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    assert(ready, `Server not ready: ${logs}`);
    const response = await read('/login');
    const html = await response.text();
    assert(html.includes('Recevoir mon code'));
    assert(response.headers.get('cache-control')?.includes('no-store'));
    const assets = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
    const bundles = await Promise.all(assets.map(async url => ({ url, text: await (await read(url)).text() })));
    const login = bundles.find(bundle => bundle.url.includes('/login/page-'));
    assert(login, 'Login bundle missing');
    assert(login.text.includes(`baseURL:"${publicApi}"`), 'Incorrect compiled API URL');
    assert(!bundles.some(bundle => /localhost:800[24]/.test(bundle.text)), 'Development URL in bundles');
    for (const [country, q, expected] of [['FR', 'par', 'Paris'], ['ML', 'bam', 'Bamako']]) {
      const data = await (await read(`/api/locations/cities?country=${country}&q=${q}&limit=5`)).json();
      assert.equal(data.villes[0].nom, expected);
    }
    const schools = await (await read('/api/education/institutions?country=ML&type=ecole&city=Bamako&q=castors')).json();
    assert.equal(schools.institutions.length, 1);
    assert.equal(schools.institutions[0].nom, 'Lycée Castors Bamako');
    assert.equal(schools.stockage, 'postgresql');
    const sharp = require(path.join(root, 'node_modules/sharp'));
    assert(sharp.versions.vips, 'Native image dependency missing');
    await read('/_next/image?url=%2Fimages%2Flogo-mali-wuli.png&w=64&q=75');
    console.log(JSON.stringify({
      status: 'passed',
      buildId: fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8').trim(),
      loginBundle: login.url,
      checks: ['login page', 'all login scripts', 'compiled public API', 'no development URLs', 'no-store HTML', 'Paris', 'Bamako', 'Castors unique from backend', 'Linux Sharp', 'image optimization'],
    }));
  } finally {
    child.kill('SIGTERM');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

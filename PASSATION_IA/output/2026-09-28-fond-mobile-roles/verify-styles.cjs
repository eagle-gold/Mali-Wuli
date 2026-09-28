'use strict';
// Compile the staged global stylesheet and parse changed CSS modules, without app writes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const active = '/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend';
const staged = path.join(__dirname, 'staging/frontend/src');
const postcss = require(path.join(active, 'node_modules/postcss'));
const tailwind = require(path.join(active, 'node_modules/tailwindcss'));
const imported = require(path.join(active, 'tailwind.config.ts'));
const config = imported.default || imported;
const list = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? list(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
(async () => {
  const source = path.join(staged, 'app/globals.css');
  const built = await postcss([tailwind({...config, content: [path.join(active, 'src/**/*.{ts,tsx}'), path.join(staged, '**/*.{ts,tsx}')], corePlugins:{...config.corePlugins}})]).process(fs.readFileSync(source, 'utf8'), {from:source});
  assert.equal(built.warnings().length, 0);
  let backgroundUtility = false, pageToken = false, otpTracks = false;
  built.root.walkDecls(decl => {
    if (decl.prop === '--color-page' && decl.value === '#f4ecdd') pageToken = true;
    if (decl.prop === 'background-color' && decl.value === 'var(--color-page)' && decl.parent.selector.includes('bg-')) backgroundUtility = true;
    if (decl.prop === 'grid-template-columns' && decl.value === 'repeat(6, minmax(0, 1fr))') otpTracks = true;
  });
  assert(pageToken && backgroundUtility && otpTracks, 'Tailwind must produce page backgrounds and six shrinkable OTP tracks');
  const styles = list(staged).filter(file => file.endsWith('.module.css'));
  for (const file of styles) postcss.parse(fs.readFileSync(file, 'utf8'), {from:file});
  const result = {status:'passed', checks:['Tailwind compilation without warnings','page token and generated CSS variable background','six shrinkable OTP tracks','all staged CSS modules parse'], cssModules:styles.length, generatedCssBytes:Buffer.byteLength(built.css), limitations:['Browser geometry, keyboard, responsive content and bottom navigation verified separately by the main agent']};
  fs.writeFileSync(path.join(__dirname, 'styles-verification.json'), JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
})().catch(error => {console.error(error);process.exitCode=1;});

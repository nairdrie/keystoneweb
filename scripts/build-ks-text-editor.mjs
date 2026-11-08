// Bundles the in-canvas text editor (lib/v2/canvas/text-editor.ts, ProseMirror)
// into public/ks/text-editor.js, which public/ks/editor.js loads in the v2 editor.
//
//   node scripts/build-ks-text-editor.mjs          build
//   node scripts/build-ks-text-editor.mjs --check  fail if the committed bundle is out of date
//
// The bundle is committed (like the rest of public/ks) so the site can serve it
// without a build step; `npm run test:v2` runs the --check.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'lib/v2/canvas/text-editor.ts');
const outfile = path.join(root, 'public/ks/text-editor.js');
const check = process.argv.includes('--check');

const banner = '/* Keystone v2 canvas text editor. Generated from lib/v2/canvas/text-editor.ts by scripts/build-ks-text-editor.mjs; do not edit. */';
const result = await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  legalComments: 'none',
  banner: { js: banner },
  write: false,
  outfile,
  logLevel: 'warning',
});
const code = result.outputFiles[0].text;

if (check) {
  let current = '';
  try { current = readFileSync(outfile, 'utf8'); } catch { /* missing */ }
  if (current !== code) {
    console.error('public/ks/text-editor.js is out of date. Run: node scripts/build-ks-text-editor.mjs');
    process.exit(1);
  }
  console.log('public/ks/text-editor.js is up to date');
} else {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outfile, code);
  console.log(`wrote public/ks/text-editor.js (${(code.length / 1024).toFixed(1)} KB)`);
}

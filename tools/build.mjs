/* Bundles the project into one self-contained file for publishing as a Claude artifact.
   The artifact host wraps the file in its own skeleton, so we emit title + style + body + script
   with no doctype/html/head of our own, and escape every non-ASCII char in the script. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

const index = read('index.html');
const title = /<title>(.*?)<\/title>/s.exec(index)[1];
const fonts = [...index.matchAll(/<link rel="stylesheet" href="(https:\/\/fonts[^"]+)">/g)].map(m => m[1]);

const css = read('src/style.css');
const body = read('src/body.html');
const js = read('src/game.js');
{ const norm = t => t.replace(/\s+/g, ' ').trim();
  const inIndex = /<div id="app">[\s\S]*<\/div>\s*(?=<script)/.exec(index);
  if (!inIndex || !norm(inIndex[0]).startsWith(norm(body).slice(0, 400)))
    throw new Error('index.html body has drifted from src/body.html - keep them in sync'); }
const three = read('vendor/three.bundle.js');
const music = read('vendor/music.bundle.js');

const esc = s => [...s].map(c => (c.codePointAt(0) < 128 ? c : '\\u' + c.codePointAt(0).toString(16).padStart(4, '0'))).join('');

const out =
`<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts.map(u => `<link rel="stylesheet" href="${u}">`).join('\n')}
<style>
${css}
</style>

${body}
<script>window.__ASHVALE_NO_ASSETS=1;</script>
<script>
${three}
</script>
<script>
${music}
</script>
<script>
${esc(js)}
</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log(`dist/artifact.html  ${kb} KB` + (kb > 16000 ? '  !! over the 16MB artifact cap' : ''));

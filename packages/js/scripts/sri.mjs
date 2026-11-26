// Sürümlü CDN dosyasının SRI hash'ini (sha384) hesaplar ve README'deki işaretli bloğu günceller.
// --check: README'deki hash derlenen dosyayla aynı değilse çıkış kodu 1 (CI / test için).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const fileName = `crafterpayments-${pkg.version}.umd.min.js`;
const integrity = `sha384-${createHash('sha384').update(readFileSync(join(root, 'dist', fileName))).digest('base64')}`;
// v1: CDN kanalı (#463 §9, https://js.crafterpayments.com/v1/crafter.js); sürümlü dosya bu kanalda değişmez
const url = `https://js.crafterpayments.com/v1/${fileName}`;

const block = [
  '<!-- sri:start -->',
  '```html',
  `<script src="${url}"`,
  `        integrity="${integrity}"`,
  '        crossorigin="anonymous"></script>',
  '```',
  '',
  `| Version | File | SRI |`,
  `|---|---|---|`,
  `| ${pkg.version} | \`${fileName}\` | \`${integrity}\` |`,
  '<!-- sri:end -->',
].join('\n');

const readmePath = join(root, 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const pattern = /<!-- sri:start -->[\s\S]*?<!-- sri:end -->/g;
const matches = readme.match(pattern) ?? [];
if (!matches.length) {
  console.error('README.md has no <!-- sri:start --> … <!-- sri:end --> block.');
  process.exit(1);
}
if (process.argv.includes('--check')) {
  const stale = matches.filter((m) => m !== block);
  if (stale.length) {
    console.error(`README SRI is stale. Run "npm run sri". Expected ${integrity}`);
    process.exit(1);
  }
  console.log(`README SRI ok: ${integrity}`);
} else {
  writeFileSync(readmePath, readme.replace(pattern, block));
  console.log(`${fileName}: ${integrity}`);
}

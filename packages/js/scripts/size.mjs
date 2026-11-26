// Boyut bütçesi: CDN (UMD, min) dosyası. Aşılırsa çıkış kodu 1.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUDGET = { minBytes: 22 * 1024, gzipBytes: 8 * 1024 };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'dist/crafterpayments.umd.min.js');
const source = readFileSync(file);
const gzip = gzipSync(source, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(2)} KB`;
console.log(`crafterpayments.umd.min.js: ${kb(source.length)} min, ${kb(gzip)} gzip (budget ${kb(BUDGET.minBytes)} / ${kb(BUDGET.gzipBytes)})`);
if (source.length > BUDGET.minBytes || gzip > BUDGET.gzipBytes) {
  console.error('Size budget exceeded.');
  process.exit(1);
}

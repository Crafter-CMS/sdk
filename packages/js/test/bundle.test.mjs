import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { PK, SK } from './helpers.mjs';

const root = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

test('UMD: <script> ile window.CrafterPayments; sürümlü dosya aynı içerik', async () => {
  const umd = readFileSync(new URL('dist/crafterpayments.umd.min.js', root), 'utf8');
  const versioned = readFileSync(new URL(`dist/crafterpayments-${pkg.version}.umd.min.js`, root), 'utf8');
  assert.equal(umd, versioned);
  assert.ok(umd.startsWith(`/*! @crafterpayments/js v${pkg.version}`));
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://shop.example.com/', runScripts: 'outside-only' });
  dom.window.eval(umd);
  const lib = dom.window.CrafterPayments;
  assert.equal(typeof lib.loadCrafterPayments, 'function');
  assert.equal(typeof lib.handleReturn, 'function');
  assert.equal(lib.version, pkg.version);
  const cp = await lib.loadCrafterPayments(PK);
  assert.equal(cp.checkoutOrigin, 'https://checkout.crafterpayments.com');
  await assert.rejects(lib.loadCrafterPayments(SK), (e) => e.code === 'secret_key_in_browser');
});

test('CJS girişi yüklenir', () => {
  const require = createRequire(import.meta.url);
  const cjs = require('../dist/index.cjs');
  assert.equal(typeof cjs.loadCrafterPayments, 'function');
  assert.equal(cjs.version, pkg.version);
});

test('paket dosyaları gizli anahtar örneği ya da sağlayıcı adı içermez', () => {
  for (const file of ['dist/index.mjs', 'dist/crafterpayments.umd.min.js']) {
    const text = readFileSync(new URL(file, root), 'utf8');
    assert.doesNotMatch(text, /cp_sk_(test|live)_[A-Za-z0-9]{8}/, file);
    assert.doesNotMatch(text, /stripe/i, file);
  }
});

test('boyut bütçesi', () => {
  execFileSync(process.execPath, [new URL('scripts/size.mjs', root).pathname], { stdio: 'pipe' });
});

test('README SRI hash derlenen sürümlü dosyayla aynı', () => {
  execFileSync(process.execPath, [new URL('scripts/sri.mjs', root).pathname, '--check'], { stdio: 'pipe' });
});

// Yapılandırma birim testleri: moda göre varsayılan API adresi. Ağ kullanılmaz; adresler buildUrl ile denetlenir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crafter } from '../dist/index.mjs';

test('direct mod varsayılan olarak https://api.crafter.net.tr kullanır', () => {
  const crafter = new Crafter({ mode: 'direct', websiteId: 'site-1' });
  assert.equal(crafter.config.apiBase, 'https://api.crafter.net.tr');
  assert.equal(crafter.http.buildUrl('/products'), 'https://api.crafter.net.tr/website/site-1/products');
  assert.equal(crafter.http.buildUrl('/v2/auth/signin'), 'https://api.crafter.net.tr/website/v2/site-1/auth/signin');
});

test('websiteId verilip mod verilmezse direct mod seçilir', () => {
  const crafter = new Crafter({ websiteId: 'site-1' });
  assert.equal(crafter.http.mode, 'direct');
  assert.equal(crafter.config.mode, 'direct');
  assert.equal(crafter.http.buildUrl('/products'), 'https://api.crafter.net.tr/website/site-1/products');
});

test('storefront mod varsayılan olarak /api/storefront kullanır', () => {
  const crafter = new Crafter();
  assert.equal(crafter.http.mode, 'storefront');
  assert.equal(crafter.config.apiBase, '/api/storefront');
  assert.equal(crafter.http.buildUrl('/products'), '/api/storefront/products');
});

test('verilen apiBase her iki modda da korunur', () => {
  const direct = new Crafter({ mode: 'direct', websiteId: 'site-1', apiBase: 'https://dev-api.crafter.net.tr/' });
  assert.equal(direct.http.buildUrl('/products'), 'https://dev-api.crafter.net.tr/website/site-1/products');
  const storefront = new Crafter({ mode: 'storefront', apiBase: '/proxy' });
  assert.equal(storefront.http.buildUrl('/products'), '/proxy/products');
});

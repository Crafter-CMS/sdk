import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PK, PK_LIVE, SK, SID, SECRET, setupDom } from './helpers.mjs';

const mod = await import('../dist/index.mjs');

test('SSR: window yokken null döner', async () => {
  delete globalThis.window;
  delete globalThis.document;
  assert.equal(await mod.loadCrafterPayments(PK), null);
});

test('gizli anahtar tarayıcıda reddedilir', async () => {
  setupDom();
  await assert.rejects(mod.loadCrafterPayments(SK), (e) => e.code === 'secret_key_in_browser' && /cp_sk_/.test(e.message));
  await assert.rejects(mod.loadCrafterPayments('cp_rk_live_' + 'x'.repeat(30)), { code: 'secret_key_in_browser' });
  await assert.rejects(mod.loadCrafterPayments(' cp_sk_live_' + 'x'.repeat(30)), { code: 'secret_key_in_browser' });
});

test('geçersiz publishable anahtar', async () => {
  setupDom();
  await assert.rejects(mod.loadCrafterPayments('pk_test_123'), { code: 'invalid_publishable_key' });
  await assert.rejects(mod.loadCrafterPayments(''), { code: 'invalid_publishable_key' });
});

test('aynı anahtarla aynı örnek; livemode anahtardan', async () => {
  setupDom();
  const a = await mod.loadCrafterPayments(PK);
  const b = await mod.loadCrafterPayments(PK);
  assert.equal(a, b);
  assert.equal(a.livemode, false);
  assert.equal((await mod.loadCrafterPayments(PK_LIVE)).livemode, true);
});

test('ortam: development adresleri; checkoutOrigin yalnızca https/localhost', async () => {
  setupDom();
  const cp = await mod.loadCrafterPayments(PK, { environment: 'development' });
  assert.equal(cp.checkoutOrigin, 'https://dev-checkout.crafterpayments.com');
  const local = new mod.CrafterPayments(PK, { checkoutOrigin: 'http://localhost:3000/x' });
  assert.equal(local.checkoutOrigin, 'http://localhost:3000');
  assert.throws(() => new mod.CrafterPayments(PK, { checkoutOrigin: 'http://evil.example' }), { code: 'invalid_options' });
});

test('clientSecret alanına gizli anahtar, uyumsuz sır ve mod uyuşmazlığı', async () => {
  const { window } = setupDom();
  const cp = new mod.CrafterPayments(PK);
  assert.throws(() => cp.mountCheckout('#pay', { sessionId: SID, clientSecret: SK }), { code: 'secret_key_in_browser' });
  const other = 'cs_test_' + 'Q'.repeat(24) + '_secret_' + 'Z'.repeat(24);
  assert.throws(() => cp.mountCheckout('#pay', { sessionId: SID, clientSecret: other }), { code: 'invalid_client_secret' });
  const live = new mod.CrafterPayments(PK_LIVE);
  assert.throws(() => live.mountCheckout('#pay', { clientSecret: SECRET }), (e) => e.code === 'invalid_session_id' && /test session/.test(e.message));
  assert.throws(() => cp.open({ sessionId: 'nope' }), { code: 'invalid_session_id' });
  assert.equal(window.document.querySelectorAll('iframe').length, 0);
});

test('redirectToCheckout: yalnızca checkout origin; doğru adrese gider', async () => {
  const { navigations } = setupDom();
  const cp = new mod.CrafterPayments(PK);
  await assert.rejects(cp.redirectToCheckout({ url: 'https://evil.example/c/' + SID }), { code: 'invalid_checkout_url' });
  await assert.rejects(cp.redirectToCheckout({ url: 'https://checkout.crafterpayments.com/admin' }), { code: 'invalid_checkout_url' });
  await assert.rejects(cp.redirectToCheckout({}), { code: 'invalid_options' });
  await cp.redirectToCheckout({ sessionId: SID });
  await cp.redirectToCheckout({ url: `https://checkout.crafterpayments.com/c/${SID}` });
  assert.equal(navigations.length, 2);
});

test('sürüm ve API sürümü dışa açık', () => {
  assert.match(mod.version, /^\d+\.\d+\.\d+/);
  assert.equal(mod.API_VERSION, '2026-12');
});

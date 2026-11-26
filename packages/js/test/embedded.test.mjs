import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PK, SID, SECRET, CHECKOUT, API, setupDom, mockFetch, publicSession, postFromFrame, page, tick } from './helpers.mjs';

const { CrafterPayments } = await import('../dist/index.mjs');

function mount(opts = {}) {
  const env = setupDom();
  const cp = new CrafterPayments(PK);
  const checkout = cp.mountCheckout('#pay', { clientSecret: SECRET, loadTimeoutMs: 60000, ...opts });
  const sent = [];
  checkout.iframe.contentWindow.postMessage = (data, targetOrigin) => sent.push({ data, targetOrigin });
  return { ...env, cp, checkout, sent };
}

test('iframe: /embed adresi, clientSecret adreste yok, allow=payment ve sandbox', () => {
  const { checkout, window } = mount({ locale: 'tr' });
  const iframe = window.document.querySelector('#pay iframe');
  assert.equal(iframe, checkout.iframe);
  assert.ok(iframe.src.startsWith(`${CHECKOUT}/embed/${SID}?locale=tr#`), iframe.src);
  assert.ok(!iframe.src.includes('secret'), 'clientSecret must not be in the URL');
  assert.ok(iframe.src.includes(encodeURIComponent('https://shop.example.com')));
  assert.equal(iframe.getAttribute('allow'), 'payment');
  assert.match(iframe.getAttribute('sandbox'), /allow-scripts/);
  assert.doesNotMatch(iframe.getAttribute('sandbox'), /allow-top-navigation(\s|$)/);
  checkout.destroy();
});

test('ready → init yalnızca checkout origin hedefli; yanlış origin/kaynak yok sayılır', async () => {
  const { checkout, window, sent } = mount({
    appearance: {
      theme: 'dark',
      variables: { colorPrimary: '#7c3aed', borderRadius: '10px', fontFamily: 'Inter, sans-serif', colorText: 'red;}body{x:url(a)', bogus: '1' },
    },
  });
  const ready = [];
  checkout.on('ready', (e) => ready.push(e));
  postFromFrame(window, checkout.iframe, page('ready'), 'https://evil.example');
  window.dispatchEvent(new window.MessageEvent('message', { data: page('ready'), origin: CHECKOUT, source: window }));
  postFromFrame(window, checkout.iframe, { ...page('ready'), v: 2 });
  assert.equal(sent.length, 0);
  assert.equal(ready.length, 0);

  postFromFrame(window, checkout.iframe, page('ready'));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].targetOrigin, CHECKOUT);
  assert.equal(sent[0].data.type, 'init');
  assert.equal(sent[0].data.clientSecret, SECRET);
  assert.equal(sent[0].data.publishableKey, PK);
  assert.deepEqual(sent[0].data.appearance, {
    theme: 'dark',
    variables: { colorPrimary: '#7c3aed', borderRadius: '10px', fontFamily: 'Inter, sans-serif' },
  });
  assert.equal(ready.length, 1);
  // iframe yeniden yüklenirse init tekrar gider, ready olayı tekrar etmez
  postFromFrame(window, checkout.iframe, page('ready'));
  assert.equal(sent.length, 2);
  assert.equal(ready.length, 1);
  checkout.destroy();
});

test('resize yüksekliği uygular ve sınırlar', () => {
  const { checkout, window } = mount();
  postFromFrame(window, checkout.iframe, page('resize', { height: 612.2 }));
  assert.equal(checkout.iframe.style.height, '613px');
  postFromFrame(window, checkout.iframe, page('resize', { height: 1e9 }));
  assert.equal(checkout.iframe.style.height, '10000px');
  postFromFrame(window, checkout.iframe, page('resize', { height: 'x' }));
  assert.equal(checkout.iframe.style.height, '10000px');
  checkout.destroy();
});

test('complete → /public ile doğrulanır (verified)', async () => {
  const { checkout, window } = mount();
  const calls = mockFetch([publicSession('complete')]);
  const events = [];
  checkout.on('complete', (e) => events.push(e));
  postFromFrame(window, checkout.iframe, page('complete', { status: 'complete' }));
  const result = await checkout.result;
  assert.deepEqual(result, { sessionId: SID, status: 'complete', orderId: 'CR-7F3K2M', verified: true });
  assert.equal(events.length, 1);
  assert.equal(calls[0].url, `${API}/checkout/sessions/${SID}/public`);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${PK}`);
  assert.equal(calls[0].init.headers['X-Client-Secret'], SECRET);
  assert.equal(calls[0].init.headers['Crafter-Version'], '2026-12');
  assert.equal(calls[0].init.credentials, 'omit');
  checkout.destroy();
});

test('complete: /public okunamazsa doğrulanmamış sonuç', async () => {
  const { checkout, window } = mount();
  mockFetch([new Error('offline')]);
  postFromFrame(window, checkout.iframe, page('complete'));
  assert.deepEqual(await checkout.result, { sessionId: SID, status: 'complete', verified: false });
  checkout.destroy();
});

test('cancel, expired, payment_failed, error olayları', async () => {
  let { checkout, window } = mount();
  const failed = [];
  checkout.on('payment_failed', (e) => failed.push(e));
  postFromFrame(window, checkout.iframe, page('payment_failed', { code: 'card_declined' }));
  assert.deepEqual(failed, [{ sessionId: SID, code: 'card_declined' }]);
  postFromFrame(window, checkout.iframe, page('cancel'));
  assert.equal((await checkout.result).status, 'canceled');
  checkout.destroy();

  ({ checkout, window } = mount());
  postFromFrame(window, checkout.iframe, page('expired'));
  assert.equal((await checkout.result).status, 'expired');
  checkout.destroy();

  ({ checkout, window } = mount());
  const errors = [];
  checkout.on('error', (e) => errors.push(e));
  postFromFrame(window, checkout.iframe, page('error', { code: 'embedding_not_allowed', message: 'nope' }));
  await assert.rejects(checkout.result, { code: 'embedding_not_allowed' });
  assert.equal(errors[0].error.code, 'embedding_not_allowed');
  checkout.destroy();
});

test('başka oturumun mesajı yok sayılır', async () => {
  const { checkout, window } = mount();
  const events = [];
  checkout.on('cancel', (e) => events.push(e));
  postFromFrame(window, checkout.iframe, page('cancel', { sessionId: 'cs_test_' + 'x'.repeat(24) }));
  await tick();
  assert.equal(events.length, 0);
  checkout.destroy();
});

test('ready gelmezse embed_load_timeout', async () => {
  const env = setupDom();
  const cp = new CrafterPayments(PK);
  const checkout = cp.mountCheckout(env.window.document.getElementById('pay'), { clientSecret: SECRET, loadTimeoutMs: 20 });
  await assert.rejects(checkout.result, { code: 'embed_load_timeout' });
  checkout.destroy();
});

test('destroy: iframe kalkar, destroy mesajı gider, close olayı', async () => {
  const { checkout, window, sent } = mount();
  const closes = [];
  checkout.on('close', (e) => closes.push(e));
  checkout.destroy();
  assert.equal(window.document.querySelectorAll('iframe').length, 0);
  assert.equal(sent.at(-1).data.type, 'destroy');
  assert.equal(await checkout.result, null);
  assert.equal(closes.length, 1);
});

test('redirect_required: ayrı pencere açılır, sonuç yoklamayla', async () => {
  const { checkout, window, opened } = mount();
  mockFetch([publicSession('complete')]);
  const seen = [];
  checkout.on('redirect_required', (e) => seen.push(e));
  postFromFrame(window, checkout.iframe, page('redirect_required', { url: 'javascript:alert(1)' }));
  assert.equal(opened.length, 0);
  postFromFrame(window, checkout.iframe, page('redirect_required', { url: 'https://bank.example/auth?x=1' }));
  assert.equal(opened.length, 1);
  assert.equal(opened[0].url, 'https://bank.example/auth?x=1');
  assert.equal(seen.length, 1);
  checkout.destroy();
});

test('mount hedefi yoksa hata', () => {
  setupDom();
  const cp = new CrafterPayments(PK);
  assert.throws(() => cp.mountCheckout('#missing', { clientSecret: SECRET }), { code: 'mount_target_not_found' });
  assert.throws(() => cp.mountCheckout('#pay', { sessionId: SID }), { code: 'invalid_options' });
});

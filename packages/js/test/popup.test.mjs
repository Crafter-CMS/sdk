import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PK, SID, SECRET, CHECKOUT, setupDom, mockFetch, publicSession, postFromFrame, page, tick } from './helpers.mjs';

const { CrafterPayments, handleReturn } = await import('../dist/index.mjs');
const RETURN = (status) => ({ source: 'crafterpayments-js', v: 1, type: 'return', sessionId: SID, status });

test('popup: tıklama anında açılır; dönüş kanalı + /public ile tamamlanır, ack gönderilir', async () => {
  const { opened } = setupDom();
  const calls = mockFetch([publicSession('complete')]);
  const cp = new CrafterPayments(PK);
  const acks = [];
  const returnTab = new BroadcastChannel('crafter-checkout');
  returnTab.onmessage = (e) => acks.push(e.data);
  const checkout = cp.open({ sessionId: SID, clientSecret: SECRET });
  assert.equal(opened.length, 1, 'window.open must run synchronously');
  assert.equal(opened[0].url, `${CHECKOUT}/c/${SID}`);
  assert.equal(opened[0].target, 'crafterpayments_checkout');
  assert.match(opened[0].features, /popup=yes,width=480,height=720/);
  const ready = [];
  checkout.on('ready', (e) => ready.push(e));
  await tick();
  assert.equal(ready.length, 1);

  returnTab.postMessage({ ...RETURN('complete'), sessionId: 'cs_test_' + 'x'.repeat(24) }); // başka oturum
  returnTab.postMessage(RETURN('complete'));
  const result = await checkout.result;
  assert.deepEqual(result, { sessionId: SID, status: 'complete', orderId: 'CR-7F3K2M', verified: true });
  assert.equal(calls.length, 1);
  await tick(10);
  assert.deepEqual(acks.filter((a) => a.type === 'ack'), [{ source: 'crafterpayments-js', v: 1, type: 'ack', sessionId: SID }]);
  returnTab.close();
});

test('popup: alıcı "Geri dön" dedi (sunucuda open) → cancel, doğrulanmamış', async () => {
  setupDom();
  mockFetch([publicSession('open')]);
  const cp = new CrafterPayments(PK);
  const tab = new BroadcastChannel('crafter-checkout');
  const checkout = cp.open({ sessionId: SID, clientSecret: SECRET, mode: 'popup' });
  await tick();
  tab.postMessage(RETURN('canceled'));
  assert.deepEqual(await checkout.result, { sessionId: SID, status: 'canceled', orderId: undefined, verified: false });
  tab.close();
});

test('popup: clientSecret yoksa yalnızca dönüş kanalı', async () => {
  setupDom();
  const cp = new CrafterPayments(PK);
  const tab = new BroadcastChannel('crafter-checkout');
  const checkout = cp.open({ sessionId: SID });
  await tick();
  tab.postMessage(RETURN('complete'));
  assert.deepEqual(await checkout.result, { sessionId: SID, status: 'complete', orderId: undefined, verified: false });
  tab.close();
});

test('popup: kanal gelmese de yoklama sonucu bulur (2 sn)', async () => {
  setupDom();
  mockFetch([publicSession('processing'), publicSession('complete')]);
  const cp = new CrafterPayments(PK);
  const checkout = cp.open({ clientSecret: SECRET });
  const result = await checkout.result;
  assert.equal(result.status, 'complete');
  assert.equal(result.verified, true);
});

test('popup: 4xx yanıt yoklamayı durdurur ve error verir', async () => {
  setupDom();
  mockFetch([{ status: 403, body: { error: { type: 'CHECKOUT_ORIGIN_NOT_ALLOWED', message: 'Origin not allowed' } } }]);
  const cp = new CrafterPayments(PK);
  const tab = new BroadcastChannel('crafter-checkout');
  const checkout = cp.open({ clientSecret: SECRET });
  await tick();
  tab.postMessage(RETURN('complete'));
  // kanal ipucu varken API hatası: ipucuyla doğrulanmamış sonuç
  assert.equal((await checkout.result).verified, false);
  tab.close();

  setupDom();
  mockFetch([{ status: 404, body: { error: { type: 'CHECKOUT_SESSION_NOT_FOUND', message: 'x' } } }]);
  const c2 = new CrafterPayments(PK).open({ clientSecret: SECRET });
  await assert.rejects(c2.result, (e) => e.code === 'api_error' && e.type === 'CHECKOUT_SESSION_NOT_FOUND' && e.status === 404);
});

test('popup engellenirse: varsayılan yönlendirme, onPopupBlocked=error ile hata', async () => {
  let env = setupDom();
  env.window.open = () => null;
  const cp = new CrafterPayments(PK);
  cp.open({ sessionId: SID });
  await tick();
  assert.equal(env.navigations.length, 1);

  env = setupDom();
  env.window.open = () => null;
  const checkout = new CrafterPayments(PK).open({ sessionId: SID, onPopupBlocked: 'error' });
  await assert.rejects(checkout.result, { code: 'popup_blocked' });
  assert.equal(env.navigations.length, 0);
});

test('createSession: pencere senkron about:blank açılır, oturum gelince yönlenir', async () => {
  const { opened } = setupDom();
  const cp = new CrafterPayments(PK);
  let resolve;
  const checkout = cp.open({ createSession: () => new Promise((r) => (resolve = r)) });
  assert.equal(opened.length, 1);
  assert.equal(opened[0].url, 'about:blank');
  await tick();
  resolve({ sessionId: SID });
  await tick();
  assert.deepEqual(opened[0].replaced, [`${CHECKOUT}/c/${SID}`]);
  checkout.close();
  assert.equal(opened[0].closed, true);
  assert.equal(await checkout.result, null);
});

test('createSession hata verirse pencere kapanır', async () => {
  const { opened } = setupDom();
  const checkout = new CrafterPayments(PK).open({ createSession: async () => { throw new Error('server down'); } });
  await assert.rejects(checkout.result, (e) => e.code === 'create_session_failed' && /server down/.test(e.message));
  assert.equal(opened[0].closed, true);
});

test('createSession gizli anahtar döndürürse reddedilir', async () => {
  setupDom();
  const checkout = new CrafterPayments(PK).open({ createSession: async () => ({ sessionId: SID, clientSecret: 'cp_sk_live_' + 'x'.repeat(30) }) });
  await assert.rejects(checkout.result, { code: 'secret_key_in_browser' });
});

test('mobilde auto → yönlendirme, mobile=new_tab → yeni sekme', async () => {
  let env = setupDom();
  env.window.innerWidth = 375;
  new CrafterPayments(PK).open({ sessionId: SID });
  await tick();
  assert.equal(env.opened.length, 0);
  assert.equal(env.navigations.length, 1);

  env = setupDom();
  env.window.innerWidth = 375;
  const c = new CrafterPayments(PK).open({ sessionId: SID, mobile: 'new_tab' });
  assert.equal(env.opened[0].target, '_blank');
  assert.equal(env.opened[0].features, undefined);
  c.close();
});

test('modal: tıklamada açılır, iframe yüklenir, Escape kapatır', async () => {
  const { window } = setupDom();
  const cp = new CrafterPayments(PK);
  let resolve;
  const checkout = cp.open({ mode: 'modal', createSession: () => new Promise((r) => (resolve = r)) });
  const overlay = window.document.querySelector('[data-crafterpayments-modal]');
  assert.ok(overlay, 'modal opens immediately');
  assert.equal(window.document.body.style.overflow, 'hidden');
  assert.equal(overlay.querySelector('iframe'), null);
  await tick();
  resolve({ sessionId: SID, clientSecret: SECRET });
  await tick();
  const iframe = overlay.querySelector('iframe');
  assert.ok(iframe.src.startsWith(`${CHECKOUT}/embed/${SID}`));
  const closes = [];
  checkout.on('close', (e) => closes.push(e));
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(window.document.querySelector('[data-crafterpayments-modal]'), null);
  assert.equal(window.document.body.style.overflow, '');
  assert.equal(closes.length, 1);
  assert.equal(await checkout.result, null);
});

test('modal: complete sonrası kendiliğinden kapanır; clientSecret zorunlu', async () => {
  const { window } = setupDom();
  mockFetch([publicSession('complete')]);
  const cp = new CrafterPayments(PK);
  const checkout = cp.open({ mode: 'modal', clientSecret: SECRET });
  await tick();
  const iframe = window.document.querySelector('[data-crafterpayments-modal] iframe');
  iframe.contentWindow.postMessage = () => {};
  postFromFrame(window, iframe, page('ready'));
  postFromFrame(window, iframe, page('complete'));
  assert.equal((await checkout.result).status, 'complete');
  await tick();
  assert.equal(window.document.querySelector('[data-crafterpayments-modal]'), null);

  setupDom();
  const c2 = new CrafterPayments(PK).open({ mode: 'modal', sessionId: SID });
  await assert.rejects(c2.result, { code: 'invalid_options' });
  c2.close();
});

test('handleReturn: kanala yazar, açan sayfa yanıtlarsa pencereyi kapatır', async () => {
  const { window } = setupDom(`https://shop.example.com/thanks?session_id=${SID}&cp_status=complete&cp_ts=1&cp_sig=${'a'.repeat(64)}`);
  let closed = false;
  window.close = () => { closed = true; };
  const opener = new BroadcastChannel('crafter-checkout');
  opener.onmessage = (e) => {
    if (e.data.type === 'return') opener.postMessage({ source: 'crafterpayments-js', v: 1, type: 'ack', sessionId: e.data.sessionId });
  };
  const result = await handleReturn({ ackTimeoutMs: 500 });
  assert.deepEqual(result, { sessionId: SID, status: 'complete', signed: true, openedByCheckout: true });
  assert.equal(closed, true);
  opener.close();
});

test('handleReturn: açan yoksa pencere kapanmaz; geçersiz parametre null', async () => {
  const { window } = setupDom(`https://shop.example.com/cart?cp_session=${SID}&cp_status=canceled`);
  let closed = false;
  window.close = () => { closed = true; };
  const result = await handleReturn({ ackTimeoutMs: 30 });
  assert.deepEqual(result, { sessionId: SID, status: 'canceled', signed: false, openedByCheckout: false });
  assert.equal(closed, false);
  setupDom('https://shop.example.com/thanks?session_id=x&cp_status=complete');
  assert.equal(await handleReturn(), null);
  setupDom(`https://shop.example.com/thanks?session_id=${SID}&cp_status=paid`);
  assert.equal(await handleReturn(), null);
});


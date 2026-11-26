// Hybrid cart (#434) unit tests: storefront cart endpoints, syncing the localStorage cart, cross-tab
// signal and error mapping. Tests the built package (dist). All values are synthetic.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  Crafter,
  CrafterError,
  CrafterCouponError,
  CouponErrorType,
  COUPON_ERROR_TYPES,
  isCouponError,
  CART_STORAGE_KEY,
  CART_COUPON_KEY,
  CART_SYNC_KEY,
  CART_SYNCED_KEY,
  legacyCartDiff,
} from '../dist/index.mjs';

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

let calls;
let routes;
let domEvents;

const context = {
  sdkVersion: '1.5.1',
  websiteId: 'site-1',
  apiBase: '/api/storefront',
  locale: 'de',
  defaultLocale: 'en',
  localePrefix: '/de',
  languages: ['en', 'de'],
  storeCurrency: 'USD',
  customerCurrency: 'EUR',
  rate: 0.92,
  currencies: ['USD', 'EUR'],
  routes: { cart: '/de/cart', checkout: '/checkout', localization: '/localization', cartApi: '/cart' },
};

function line(id, quantity, unitPrice = 10) {
  return { key: id, id, productId: id, name: `Product ${id}`, slug: id, url: `/products/${id}`, price: unitPrice, unitPrice, discountType: null, discountValue: null, quantity, lineTotal: unitPrice * quantity, images: [`/${id}.png`], image: `/${id}.png`, stock: -1, options: null };
}

function cartBody(items = [], extra = {}) {
  return {
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.lineTotal, 0),
    currency: 'USD',
    coupon: null,
    removed: [],
    adjusted: [],
    mode: 'guest',
    ...extra,
  };
}

function install() {
  const storage = new FakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  const doc = new EventTarget();
  doc.addEventListener('crafter:cart:updated', (e) => domEvents.push(e.detail));
  globalThis.document = doc;
  const win = new EventTarget();
  win.location = { pathname: '/', search: '', href: 'https://shop.example.test/', assign() {} };
  win.document = doc;
  globalThis.window = win;
  return { storage, win };
}

/** routes: "METHOD url" → (body) => { status, body } ; a queue consumed in order is also supported */
beforeEach(() => {
  calls = [];
  routes = {};
  domEvents = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url: String(url), body, init });
    const handler = routes[`${method} ${url}`];
    if (!handler) return new Response(JSON.stringify({ success: false, type: 'not_found' }), { status: 404 });
    const next = Array.isArray(handler) ? handler.shift() : handler(body);
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
});

test('server cart if the context has routes.cartApi, localStorage otherwise', async () => {
  install();
  routes['GET /cart.js'] = () => ({ body: cartBody([line('p1', 2)]) });
  const server = new Crafter({ context });
  assert.equal(server.cart.isServerBacked, true);
  const cart = await server.cart.get();
  assert.equal(cart.itemCount, 2);
  assert.equal(cart.items[0].unitPrice, 10);

  const legacyContext = { ...context, routes: { cart: '/cart', checkout: '/checkout', localization: '/localization' } };
  assert.equal(new Crafter({ context: legacyContext }).cart.isServerBacked, false);
  assert.equal(new Crafter().cart.isServerBacked, false);
  assert.equal(new Crafter({ context: { ...context, routes: { ...context.routes, cartApi: '' } } }).cart.isServerBacked, false);
});

test('endpoint calls: method, URL, body (no price), headers and crafter:cart:updated', async () => {
  const { storage } = install();
  routes['GET /cart.js'] = () => ({ body: cartBody() });
  routes['POST /cart/add.js'] = (b) => ({ body: cartBody([line(b.id, b.quantity)]) });
  routes['POST /cart/change.js'] = (b) => ({ body: cartBody(b.quantity ? [line(b.id, b.quantity)] : []) });
  routes['POST /cart/clear.js'] = () => ({ body: cartBody() });
  routes['POST /cart/coupon.js'] = (b) => ({ body: cartBody([], { coupon: b.code }) });
  const crafter = new Crafter({ context });

  let cart = await crafter.cart.add({ id: 7, name: 'X', price: 0.01, discountType: 'fixed', discountValue: 5 }, 3);
  assert.deepEqual(calls[0], { ...calls[0], method: 'POST', url: '/cart/add.js', body: { id: '7', quantity: 3 } });
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.headers.Accept, 'application/json');
  assert.equal(calls[0].init.headers['X-Crafter-Locale'], 'de');
  assert.equal(cart.subtotal, 30);
  assert.equal(cart.currency, 'USD');

  await crafter.cart.add({ id: 'p2', options: { size: 'L' } });
  assert.deepEqual(calls.at(-1).body, { id: 'p2', quantity: 1, options: { size: 'L' } });

  cart = await crafter.cart.update('7', 5000);
  assert.deepEqual(calls.at(-1).body, { id: '7', quantity: 999 });
  cart = await crafter.cart.remove(7);
  assert.deepEqual([calls.at(-1).url, calls.at(-1).body], ['/cart/change.js', { id: '7', quantity: 0 }]);
  cart = await crafter.cart.setCoupon('  KOD10 ');
  assert.deepEqual([calls.at(-1).url, calls.at(-1).body], ['/cart/coupon.js', { code: 'KOD10' }]);
  assert.equal(cart.coupon, 'KOD10');
  await crafter.cart.setCoupon(null);
  assert.deepEqual(calls.at(-1).body, { code: null });
  cart = await crafter.cart.clear();
  assert.equal(calls.at(-1).url, '/cart/clear.js');
  assert.equal(cart.itemCount, 0);

  assert.equal(domEvents.length, 7);
  assert.equal(domEvents[0].itemCount, 3);
  // The change is signalled to other tabs; the localStorage cart is not written
  assert.ok(Number(storage.getItem(CART_SYNC_KEY)) > 0);
  assert.equal(storage.getItem(CART_STORAGE_KEY), null);
  // GET was never sent (there was no record to migrate)
  assert.equal(calls.filter((c) => c.method === 'GET').length, 0);
});

test('removed / adjusted notes are returned in CartState', async () => {
  install();
  routes['GET /cart.js'] = () => ({
    body: cartBody([line('p1', 3)], {
      removed: [{ productId: 'old', key: 'old', name: 'Old', quantity: 1, reason: 'out_of_stock' }],
      adjusted: [{ productId: 'p1', key: 'p1', name: 'Product p1', from: 5, to: 3, reason: 'stock_limit' }],
    }),
  });
  const cart = await new Crafter({ context }).cart.get();
  assert.equal(cart.removed[0].reason, 'out_of_stock');
  assert.equal(cart.adjusted[0].to, 3);
});

test('sync: on the first sync the localStorage lines (replace) and the coupon are sent; cart stays, the coupon key is removed', async () => {
  const { storage } = install();
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'p1', name: 'A', price: 99, quantity: 2 }, { id: 'p2', price: 1, quantity: 1 }, { name: 'idsiz' }]));
  storage.setItem(CART_COUPON_KEY, 'ESKI10');
  routes['GET /cart.js'] = () => ({ body: cartBody() });
  routes['POST /cart/add.js'] = (b) => ({ body: cartBody(b.items.map((i) => line(i.id, i.quantity))) });
  routes['POST /cart/coupon.js'] = (b) => ({ body: cartBody([line('p1', 2), line('p2', 1)], { coupon: b.code }) });
  const crafter = new Crafter({ context });
  const cart = await crafter.cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js', 'POST /cart/add.js', 'POST /cart/coupon.js']);
  assert.deepEqual(calls[1].body, { items: [{ id: 'p1', quantity: 2 }, { id: 'p2', quantity: 1 }], replace: true });
  assert.equal(cart.itemCount, 3);
  assert.equal(cart.coupon, 'ESKI10');
  assert.ok(storage.getItem(CART_STORAGE_KEY));
  assert.deepEqual(JSON.parse(storage.getItem(CART_SYNCED_KEY)), { p1: 2, p2: 1 });
  assert.equal(storage.getItem(CART_COUPON_KEY), null);

  // Migration runs once per page; the next read is a plain GET
  await crafter.cart.get();
  assert.deepEqual(calls.slice(3).map((c) => `${c.method} ${c.url}`), ['GET /cart.js']);
});

test('sync: a new localStorage selection is not lost while an old unpaid server cart is not empty (#434 bug)', async () => {
  const { storage } = install();
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'fresh', price: 1, quantity: 1 }]));
  storage.setItem(CART_COUPON_KEY, 'OLDCODE');
  routes['GET /cart.js'] = () => ({ body: cartBody([line('stale', 1)], { coupon: 'SERVER' }) });
  routes['POST /cart/add.js'] = (b) => ({ body: cartBody([line('stale', 1), ...(b.items || [b]).map((i) => line(i.id, i.quantity))], { coupon: 'SERVER' }) });
  const crafter = new Crafter({ context });
  const cart = await crafter.cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js', 'POST /cart/add.js']);
  assert.deepEqual(calls[1].body, { items: [{ id: 'fresh', quantity: 1 }], replace: true });
  assert.deepEqual(cart.items.map((i) => i.id), ['stale', 'fresh']);
  // The server's coupon is kept; the old coupon is not sent but its key is removed
  assert.equal(cart.coupon, 'SERVER');
  assert.equal(storage.getItem(CART_COUPON_KEY), null);
  assert.deepEqual(JSON.parse(storage.getItem(CART_SYNCED_KEY)), { fresh: 1 });
});

test('sync: running again does not double quantities; unchanged lines are not sent, the same product becomes one line', async () => {
  const { storage } = install();
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'p1', quantity: 1 }, { id: 'p1', quantity: 2 }, { id: 'p2', quantity: 1 }]));
  let server = [];
  routes['GET /cart.js'] = () => ({ body: cartBody(server) });
  // Storefront replace: the quantity is set to the given value
  routes['POST /cart/add.js'] = (b) => {
    for (const item of b.items) {
      const found = server.find((l) => l.id === item.id);
      if (found && b.replace) found.quantity = item.quantity;
      else if (found) found.quantity += item.quantity;
      else server.push(line(item.id, item.quantity));
    }
    server = server.map((l) => line(l.id, l.quantity));
    return { body: cartBody(server) };
  };
  await new Crafter({ context }).cart.get();
  assert.deepEqual(calls[1].body, { items: [{ id: 'p1', quantity: 3 }, { id: 'p2', quantity: 1 }], replace: true });

  // Next page: cart unchanged, only a GET; p2, sold out and removed on the server, does not come back
  server = server.filter((l) => l.id !== 'p2');
  calls = [];
  let cart = await new Crafter({ context }).cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js']);
  assert.deepEqual(cart.items.map((i) => [i.id, i.quantity]), [['p1', 3]]);

  // Even if the record could not be written (two tabs / quota), a resend does not double quantities
  storage.removeItem(CART_SYNCED_KEY);
  calls = [];
  cart = await new Crafter({ context }).cart.get();
  assert.equal(calls[1].body.replace, true);
  assert.deepEqual(cart.items.map((i) => [i.id, i.quantity]).sort(), [['p1', 3], ['p2', 1]]);
});

test('sync: a quantity changed after the sync is set, a line removed from cart is dropped on the server', async () => {
  const { storage } = install();
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'a', quantity: 3 }, { id: 'c', quantity: 1 }]));
  storage.setItem(CART_SYNCED_KEY, JSON.stringify({ a: 1, b: 1, c: 1 }));
  routes['GET /cart.js'] = () => ({ body: cartBody([line('a', 1), line('b', 1), line('c', 1)]) });
  routes['POST /cart/add.js'] = () => ({ body: cartBody([line('a', 3), line('b', 1), line('c', 1)]) });
  routes['POST /cart/change.js'] = () => ({ body: cartBody([line('a', 3), line('c', 1)]) });
  const cart = await new Crafter({ context }).cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js', 'POST /cart/add.js', 'POST /cart/change.js']);
  assert.deepEqual(calls[1].body, { items: [{ id: 'a', quantity: 3 }], replace: true });
  assert.deepEqual(calls[2].body, { id: 'b', quantity: 0 });
  assert.deepEqual(cart.items.map((i) => [i.id, i.quantity]), [['a', 3], ['c', 1]]);
  assert.deepEqual(JSON.parse(storage.getItem(CART_SYNCED_KEY)), { a: 3, c: 1 });
});

test('sync: if cart is \'[]\' the synced lines are dropped; without the cart key no line is removed and the record is cleared', async () => {
  let { storage } = install();
  storage.setItem(CART_STORAGE_KEY, '[]');
  storage.setItem(CART_SYNCED_KEY, JSON.stringify({ a: 1 }));
  routes['GET /cart.js'] = () => ({ body: cartBody([line('a', 1)]) });
  routes['POST /cart/change.js'] = () => ({ body: cartBody() });
  await new Crafter({ context }).cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js', 'POST /cart/change.js']);
  assert.deepEqual(JSON.parse(storage.getItem(CART_SYNCED_KEY)), {});

  ({ storage } = install());
  storage.setItem(CART_SYNCED_KEY, JSON.stringify({ a: 1 }));
  storage.setItem(CART_COUPON_KEY, 'X');
  routes['GET /cart.js'] = () => ({ body: cartBody([line('a', 1)], { coupon: 'X' }) });
  calls = [];
  await new Crafter({ context }).cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js']);
  assert.equal(storage.getItem(CART_SYNCED_KEY), null);

  // With no record at all no network request is made; a leftover sync record is removed
  ({ storage } = install());
  storage.setItem(CART_SYNCED_KEY, JSON.stringify({ a: 1 }));
  calls = [];
  const crafter = new Crafter({ context });
  routes['GET /cart.js'] = () => ({ body: cartBody([line('a', 1)]) });
  await crafter.cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js']);
  assert.equal(storage.getItem(CART_SYNCED_KEY), null);
});

test('legacyCartDiff: same diff rule as the storefront checkout', () => {
  const legacy = { items: [{ id: 'a', quantity: 2 }, { id: 'n', quantity: 1 }], coupon: null, present: true };
  assert.deepEqual(legacyCartDiff(legacy, null), { set: legacy.items, remove: [] });
  assert.deepEqual(legacyCartDiff(legacy, new Map([['a', 2], ['x', 1]])), { set: [{ id: 'n', quantity: 1 }], remove: ['x'] });
  assert.deepEqual(legacyCartDiff({ ...legacy, present: false }, new Map([['x', 1]])).remove, []);
});

test('localStorage store: cart stays \'[]\' when a synced cart is emptied', async () => {
  const { storage } = install();
  const headless = new Crafter();
  await headless.cart.add({ id: 'p1', name: 'A', price: 1 });
  await headless.cart.clear();
  assert.equal(storage.getItem(CART_STORAGE_KEY), null);
  storage.setItem(CART_SYNCED_KEY, JSON.stringify({ p1: 1 }));
  await headless.cart.add({ id: 'p1', name: 'A', price: 1 });
  await headless.cart.clear();
  assert.equal(storage.getItem(CART_STORAGE_KEY), '[]');
});

test('sync: on a network or server error the record is not updated; a 4xx rejection counts this state as synced', async () => {
  let { storage } = install();
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'p1', price: 1, quantity: 1 }]));
  routes['GET /cart.js'] = [new TypeError('no network'), { body: cartBody() }];
  let crafter = new Crafter({ context });
  const cart = await crafter.cart.get();
  assert.equal(cart.itemCount, 0);
  assert.ok(storage.getItem(CART_STORAGE_KEY));

  ({ storage } = install());
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'p1', price: 1, quantity: 1 }]));
  routes['GET /cart.js'] = () => ({ body: cartBody() });
  routes['POST /cart/add.js'] = [{ status: 503, body: { success: false, type: 'cart_unavailable', message: 'x' } }];
  crafter = new Crafter({ context });
  await crafter.cart.get();
  assert.ok(storage.getItem(CART_STORAGE_KEY));
  assert.equal(storage.getItem(CART_SYNCED_KEY), null);

  ({ storage } = install());
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'gone', price: 1, quantity: 1 }]));
  routes['POST /cart/add.js'] = [{ status: 409, body: { success: false, type: 'cart_product_unavailable', message: 'x' } }];
  crafter = new Crafter({ context });
  await crafter.cart.get();
  assert.deepEqual(JSON.parse(storage.getItem(CART_SYNCED_KEY)), { gone: 1 });
  // The same line is not sent again on the next page
  calls = [];
  routes['POST /cart/add.js'] = () => assert.fail('must not be sent again');
  await new Crafter({ context }).cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js']);
});

test('error mapping: CrafterError statusCode/type/details; a network error is cart_unavailable', async () => {
  install();
  routes['POST /cart/add.js'] = [
    { status: 409, body: { success: false, type: 'cart_product_unavailable', message: 'Not for sale', details: { productId: 'p1', reason: 'out_of_stock' } } },
    { status: 422, body: { success: false, type: 'cart_full', message: 'Full' } },
    new TypeError('no network'),
  ];
  const crafter = new Crafter({ context });
  await assert.rejects(() => crafter.cart.add({ id: 'p1' }), (error) => {
    assert.ok(error instanceof CrafterError);
    assert.equal(error.statusCode, 409);
    assert.equal(error.type, 'cart_product_unavailable');
    assert.equal(error.details.reason, 'out_of_stock');
    return true;
  });
  await assert.rejects(() => crafter.cart.add({ id: 'p1' }), { statusCode: 422, type: 'cart_full' });
  await assert.rejects(() => crafter.cart.add({ id: 'p1' }), { statusCode: 503, type: 'cart_unavailable' });
  assert.equal(domEvents.length, 0);
});

test('cross-tab: when crafter_cart_sync changes the cart is re-read and the event is emitted', async () => {
  const { win } = install();
  routes['GET /cart.js'] = () => ({ body: cartBody([line('p1', 4)]) });
  new Crafter({ context });
  const other = new Event('storage');
  other.key = CART_STORAGE_KEY;
  win.dispatchEvent(other);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(domEvents.length, 0);
  const event = new Event('storage');
  event.key = CART_SYNC_KEY;
  win.dispatchEvent(event);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(domEvents.at(-1).itemCount, 4);
});

test('an explicit store uses the localStorage store even with a context (backward compatibility)', async () => {
  const { storage } = install();
  const { LocalStorageCartStore, CartModule } = await import('../dist/index.mjs');
  const crafter = new Crafter({ context });
  const module = new CartModule(crafter.http, crafter.events, {}, { store: new LocalStorageCartStore(), cartApi: '/cart' });
  assert.equal(module.isServerBacked, false);
  await module.add({ id: 'p1', price: 2 });
  assert.equal(JSON.parse(storage.getItem(CART_STORAGE_KEY))[0].id, 'p1');
  assert.equal(calls.length, 0);
});

// ===================== Coupon (#476) =====================

test('coupon fields are returned in CartState; defaults for an old storefront response', async () => {
  install();
  routes['GET /cart.js'] = [
    {
      body: cartBody([line('p1', 2, 50)], {
        coupon: 'YUZDE10',
        discount: 10,
        total: 90,
        couponDetails: { code: 'YUZDE10', type: 'percentage', value: 10, freeProductId: null },
        couponRemoved: null,
      }),
    },
    { body: cartBody([line('p1', 1, 20)], { couponRemoved: { code: 'MIN500', reason: 'coupon_cart_total_below_minimum' } }) },
    { body: cartBody([line('p1', 3, 10)]) },
  ];
  const crafter = new Crafter({ context });
  let cart = await crafter.cart.get();
  assert.equal(cart.discount, 10);
  assert.equal(cart.total, 90);
  assert.deepEqual(cart.couponDetails, { code: 'YUZDE10', type: 'percentage', value: 10, freeProductId: null });
  assert.equal(cart.couponRemoved, null);

  cart = await crafter.cart.get();
  assert.equal(cart.coupon, null);
  assert.deepEqual(cart.couponRemoved, { code: 'MIN500', reason: 'coupon_cart_total_below_minimum' });
  assert.equal(cart.couponDetails, null);

  // A response without discount / total: discount 0, total = subtotal
  cart = await crafter.cart.get();
  assert.equal(cart.discount, 0);
  assert.equal(cart.total, 30);
  assert.equal(cart.couponDetails, null);
  assert.equal(cart.couponRemoved, null);
});

test('setCoupon: a 422 rejection is returned as CrafterCouponError (type, message, details), no event is emitted', async () => {
  install();
  routes['POST /cart/coupon.js'] = [
    {
      status: 422,
      body: { success: false, type: 'coupon_cart_total_below_minimum', message: 'Cart total must be at least 500', details: { minCartValue: 500 } },
    },
    { status: 422, body: { success: false, type: 'coupon_not_found', message: 'Coupon not found' } },
    {
      body: cartBody([line('p1', 1, 100)], {
        coupon: 'SABIT20',
        discount: 20,
        total: 80,
        couponDetails: { code: 'SABIT20', type: 'fixed', value: 20, freeProductId: null },
      }),
    },
  ];
  const crafter = new Crafter({ context });
  await assert.rejects(() => crafter.cart.setCoupon('MIN500'), (error) => {
    assert.ok(error instanceof CrafterError);
    assert.ok(error instanceof CrafterCouponError);
    assert.ok(isCouponError(error));
    assert.equal(error.statusCode, 422);
    assert.equal(error.type, CouponErrorType.CART_TOTAL_BELOW_MINIMUM);
    assert.equal(error.message, 'Cart total must be at least 500');
    assert.equal(error.details.minCartValue, 500);
    assert.equal(error.minCartValue, 500);
    return true;
  });
  await assert.rejects(() => crafter.cart.setCoupon('NOPE'), (error) => {
    assert.ok(isCouponError(error));
    assert.equal(error.type, 'coupon_not_found');
    assert.equal(error.message, 'Coupon not found');
    assert.equal(error.minCartValue, null);
    return true;
  });
  assert.equal(domEvents.length, 0);

  const cart = await crafter.cart.setCoupon('SABIT20');
  assert.equal(cart.coupon, 'SABIT20');
  assert.equal(cart.discount, 20);
  assert.equal(cart.total, 80);
  assert.equal(cart.couponDetails.type, 'fixed');
  assert.equal(domEvents.length, 1);

  // A non-coupon error is not isCouponError
  assert.equal(isCouponError(new CrafterError({ statusCode: 422, type: 'cart_full', message: 'x' })), false);
  assert.ok(COUPON_ERROR_TYPES.includes('coupon_invalid_for_product'));
});

test('removeCoupon: sends { code: null }, returns a cart without a coupon and emits the event', async () => {
  install();
  routes['POST /cart/coupon.js'] = (b) => ({ body: cartBody([line('p1', 1, 40)], { coupon: b.code }) });
  const crafter = new Crafter({ context });
  const cart = await crafter.cart.removeCoupon();
  assert.deepEqual([calls.at(-1).url, calls.at(-1).body], ['/cart/coupon.js', { code: null }]);
  assert.equal(cart.coupon, null);
  assert.equal(cart.discount, 0);
  assert.equal(cart.total, 40);
  assert.equal(cart.couponDetails, null);
  // An empty code also removes it
  await crafter.cart.setCoupon('   ');
  assert.deepEqual(calls.at(-1).body, { code: null });
  assert.equal(domEvents.length, 2);
});

test('migration: an invalid old coupon is not moved, lines are kept, the coupon key is removed', async () => {
  const { storage } = install();
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'p1', price: 99, quantity: 2 }]));
  storage.setItem(CART_COUPON_KEY, 'ESKI_GECERSIZ');
  routes['GET /cart.js'] = [{ body: cartBody() }, { body: cartBody([line('p1', 2)]) }];
  routes['POST /cart/add.js'] = (b) => ({ body: cartBody(b.items.map((i) => line(i.id, i.quantity))) });
  routes['POST /cart/coupon.js'] = [
    { status: 422, body: { success: false, type: 'coupon_inactive', message: 'Coupon is not active' } },
  ];
  const crafter = new Crafter({ context });
  const cart = await crafter.cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js', 'POST /cart/add.js', 'POST /cart/coupon.js']);
  assert.equal(cart.itemCount, 2);
  assert.equal(cart.coupon, null);
  assert.deepEqual(cart.couponRemoved, { code: 'ESKI_GECERSIZ', reason: 'coupon_inactive' });
  assert.deepEqual(JSON.parse(storage.getItem(CART_SYNCED_KEY)), { p1: 2 });
  assert.equal(storage.getItem(CART_COUPON_KEY), null);
  assert.ok(Number(storage.getItem(CART_SYNC_KEY)) > 0);

  // The next read is a plain GET; the lines are on the server
  const again = await crafter.cart.get();
  assert.equal(again.itemCount, 2);
  assert.equal(again.couponRemoved, null);
});

test('migration: a valid old coupon is moved; a server error on the coupon step keeps the keys', async () => {
  let { storage } = install();
  storage.setItem(CART_COUPON_KEY, 'GECERLI');
  routes['GET /cart.js'] = () => ({ body: cartBody([line('p1', 1, 100)]) });
  routes['POST /cart/coupon.js'] = (b) => ({
    body: cartBody([line('p1', 1, 100)], {
      coupon: b.code,
      discount: 15,
      total: 85,
      couponDetails: { code: b.code, type: 'fixed', value: 15, freeProductId: null },
    }),
  });
  let crafter = new Crafter({ context });
  let cart = await crafter.cart.get();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /cart.js', 'POST /cart/coupon.js']);
  assert.deepEqual(calls[1].body, { code: 'GECERLI' });
  assert.equal(cart.coupon, 'GECERLI');
  assert.equal(cart.total, 85);
  assert.equal(storage.getItem(CART_COUPON_KEY), null);

  ({ storage } = install());
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'p1', price: 1, quantity: 1 }]));
  storage.setItem(CART_COUPON_KEY, 'GECERLI');
  routes['GET /cart.js'] = () => ({ body: cartBody() });
  routes['POST /cart/add.js'] = (b) => ({ body: cartBody(b.items.map((i) => line(i.id, i.quantity))) });
  routes['POST /cart/coupon.js'] = [{ status: 503, body: { success: false, type: 'cart_unavailable', message: 'x' } }];
  crafter = new Crafter({ context });
  cart = await crafter.cart.get();
  assert.ok(storage.getItem(CART_STORAGE_KEY));
  assert.equal(storage.getItem(CART_COUPON_KEY), 'GECERLI');
});

test('localStorage cart: discount 0, total = subtotal, couponDetails null', async () => {
  install();
  const crafter = new Crafter();
  assert.equal(crafter.cart.isServerBacked, false);
  let cart = await crafter.cart.add({ id: 'p1', price: 25 }, 2);
  cart = await crafter.cart.setCoupon('HERHANGI');
  assert.equal(cart.coupon, 'HERHANGI');
  assert.equal(cart.subtotal, 50);
  assert.equal(cart.discount, 0);
  assert.equal(cart.total, 50);
  assert.equal(cart.couponDetails, null);
  assert.equal(cart.couponRemoved, null);
  cart = await crafter.cart.removeCoupon();
  assert.equal(cart.coupon, null);
  assert.equal(storage().getItem(CART_COUPON_KEY), null);
});

function storage() {
  return globalThis.localStorage;
}

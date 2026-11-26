// Theme runtime unit tests (#447): cart, money, language, section render, checkout, events, auto-start.
// Tests the built package (dist). Zero dependencies: node:test + fake window/document/localStorage/fetch.
// All values are synthetic.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Crafter, SDK_VERSION, CART_STORAGE_KEY, stripLocalePrefix } from '../dist/index.mjs';

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

let calls;
let queue;
let assigned;
let domEvents;

function install({ pathname = '/', search = '', context } = {}) {
  const storage = new FakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  const doc = new EventTarget();
  doc.documentElement = { lang: 'en' };
  doc.addEventListener('crafter:cart:updated', (e) => domEvents.push(['cart', e.detail]));
  doc.addEventListener('crafter:localization:changed', (e) => domEvents.push(['localization', e.detail]));
  doc.addEventListener('crafter:ready', (e) => domEvents.push(['ready', e.detail]));
  globalThis.document = doc;
  const win = new EventTarget();
  win.location = {
    pathname, search, href: `https://shop.example.test${pathname}${search}`,
    assign: (url) => assigned.push(url),
  };
  win.document = doc;
  if (context) win.__CRAFTER_CONTEXT__ = context;
  globalThis.window = win;
  return { storage, win, doc };
}

beforeEach(() => {
  calls = [];
  queue = [];
  assigned = [];
  domEvents = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const next = queue.shift() ?? { status: 200, body: {} };
    return new Response(typeof next.body === 'string' ? next.body : JSON.stringify(next.body), {
      status: next.status,
      headers: { 'content-type': next.type ?? 'application/json' },
    });
  };
});

const context = {
  sdkVersion: SDK_VERSION,
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
  routes: { cart: '/de/cart', checkout: '/checkout', localization: '/localization' },
};

test('version matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(SDK_VERSION, pkg.version);
  assert.equal(Crafter.version, pkg.version);
});

test('cart: add / update / remove; localStorage "cart" in checkout format; crafter:cart:updated', async () => {
  const { storage } = install({ context });
  const crafter = new Crafter({ context });
  await crafter.cart.add({ id: 'p1', name: 'Product A', price: '10', discountType: 'percentage', discountValue: '10', image: '/a.png' });
  await crafter.cart.add({ id: 'p1', name: 'Product A', price: 10 }, 2);
  let cart = await crafter.cart.add({ id: 'p2', name: 'Product B', price: 5 });
  const stored = JSON.parse(storage.getItem(CART_STORAGE_KEY));
  assert.deepEqual(Object.keys(stored[0]).sort(), ['discountType', 'discountValue', 'id', 'images', 'name', 'price', 'quantity']);
  assert.equal(stored[0].quantity, 3);
  assert.deepEqual(stored[0].images, ['/a.png']);
  assert.equal(cart.itemCount, 4);
  assert.equal(cart.subtotal, 9 * 3 + 5);
  assert.equal(cart.currency, 'USD');
  assert.equal(cart.items[0].image, '/a.png');

  cart = await crafter.cart.update('p1', 1);
  assert.equal(cart.itemCount, 2);
  cart = await crafter.cart.update('p2', 0);
  assert.deepEqual(cart.items.map((i) => i.id), ['p1']);
  cart = await crafter.cart.remove('p1');
  assert.equal(cart.itemCount, 0);
  assert.equal(storage.getItem(CART_STORAGE_KEY), null);

  const counts = domEvents.filter(([n]) => n === 'cart').map(([, d]) => d.itemCount);
  assert.deepEqual(counts, [1, 3, 4, 2, 1, 0]);
});

test('cart: a corrupt record is an empty cart; the old "image" field is read; the coupon is in the checkout key', async () => {
  const { storage } = install();
  storage.setItem('cart', '{bozuk');
  const crafter = new Crafter();
  assert.equal((await crafter.cart.get()).itemCount, 0);
  storage.setItem('cart', JSON.stringify([{ id: 7, name: 'X', price: 2, quantity: '2', image: '/x.png' }, { name: 'idsiz' }]));
  const cart = await crafter.cart.setCoupon('KOD10');
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].id, '7');
  assert.equal(cart.items[0].image, '/x.png');
  assert.equal(cart.coupon, 'KOD10');
  assert.equal(storage.getItem('crafter_cart_coupon'), 'KOD10');
  await crafter.cart.clear();
  assert.equal(storage.getItem('crafter_cart_coupon'), null);
  await assert.rejects(() => crafter.cart.add({}), TypeError);
});

test('cart: a change in another tab emits crafter:cart:updated', async () => {
  const { win, storage } = install();
  new Crafter();
  storage.setItem('cart', JSON.stringify([{ id: 'p1', price: 1, quantity: 2 }]));
  const event = new Event('storage');
  event.key = 'cart';
  win.dispatchEvent(event);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(domEvents.at(-1)[1].itemCount, 2);
});

test('money.format: the context rate and language; convert:false uses the store unit; plain number without a context', () => {
  install();
  const crafter = new Crafter({ context });
  assert.equal(crafter.money.currency, 'EUR');
  assert.equal(crafter.money.convert(20), 18.4);
  assert.equal(crafter.money.format(20), new Intl.NumberFormat('de', { style: 'currency', currency: 'EUR' }).format(18.4));
  assert.equal(crafter.money.format(20, { convert: false }), new Intl.NumberFormat('de', { style: 'currency', currency: 'USD' }).format(20));
  assert.equal(crafter.money.format(5, { currency: 'GBP', locale: 'en-GB' }), '£5.00');
  // JPY has no minor unit: rounding to the currency's decimals
  const yen = new Crafter({ context: { ...context, customerCurrency: 'JPY', rate: 151.237 } });
  assert.equal(yen.money.convert(1), 151);
  // If the rate is invalid, the store currency
  const bad = new Crafter({ context: { ...context, rate: 0 } });
  assert.equal(bad.money.currency, 'USD');
  assert.equal(bad.money.convert(20), 20);
  assert.equal(new Crafter().money.format(3), '3.00');
});

test('localization.get and set: POST /localization form fields, navigates to the JSON URL, emits the event', async () => {
  install({ pathname: '/de/store', search: '?page=2', context });
  const crafter = new Crafter({ context });
  assert.deepEqual(crafter.localization.get(), { language: 'de', currency: 'EUR', languages: ['en', 'de'], currencies: ['USD', 'EUR'] });

  queue.push({ status: 200, body: { success: true, location: '/store?page=2' } });
  const res = await crafter.localization.set({ language: 'en', currency: 'usd' });
  assert.equal(calls[0].url, '/localization');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[0].init.body)), { language: 'en', currency: 'USD', return_to: '/store?page=2' });
  assert.equal(res.url, '/store?page=2');
  assert.deepEqual(assigned, ['/store?page=2']);
  assert.deepEqual(domEvents.at(-1), ['localization', { language: 'en', currency: 'USD', url: '/store?page=2' }]);

  // External URLs are not accepted; reload:false does not navigate
  queue.push({ status: 200, body: { location: '//evil.example' } });
  const safe = await crafter.localization.set({ currency: 'EUR' }, { reload: false, returnTo: '/cart' });
  assert.equal(safe.url, '/');
  assert.equal(assigned.length, 1);

  queue.push({ status: 404, body: 'Not found', type: 'text/plain' });
  await assert.rejects(() => crafter.localization.set({ language: 'en' }), /404/);
});

test('sections.render: requests with ?sections=, replaces the wrapper', async () => {
  install({ pathname: '/store', search: '?sort=price' });
  const replaced = [];
  const current = { replaceWith: (next) => replaced.push(next.html) };
  globalThis.document.getElementById = (id) => (id === 'crafter-section-main' || id === 'crafter-section-announcement' ? current : null);
  globalThis.document.createElement = () => {
    const holder = {};
    Object.defineProperty(holder, 'innerHTML', { set(v) { holder.firstElementChild = { html: v }; } });
    return holder;
  };
  queue.push({ status: 200, body: { main: '<div id="crafter-section-main">new</div>', 'header-group:announcement': '<div>d</div>', missing: null } });
  const crafter = new Crafter();
  const result = await crafter.sections.render(['main', 'header-group:announcement', 'missing', 'main']);
  assert.equal(calls[0].url, '/store?sort=price&sections=main%2Cheader-group%3Aannouncement%2Cmissing');
  assert.equal(result.missing, null);
  assert.deepEqual(replaced, ['<div id="crafter-section-main">new</div>', '<div>d</div>']);
  await assert.rejects(() => crafter.sections.render([]), /1-10/);
});

test('checkout: purpose=cart, the context URL, preview parameters are kept', () => {
  install({ pathname: '/de/cart', search: '?preview_theme_id=t1&x=1', context });
  const crafter = new Crafter({ context });
  assert.equal(crafter.checkout(), '/checkout?purpose=cart&preview_theme_id=t1');
  assert.deepEqual(assigned, ['/checkout?purpose=cart&preview_theme_id=t1']);
  assert.equal(crafter.checkout({ purpose: 'balance', amount: 50, navigate: false }), '/checkout?purpose=balance&amount=50&preview_theme_id=t1');
  assert.equal(assigned.length, 1);
});

test('stripLocalePrefix', () => {
  assert.equal(stripLocalePrefix('/de/cart', '/de'), '/cart');
  assert.equal(stripLocalePrefix('/de', '/de'), '/');
  assert.equal(stripLocalePrefix('/design', '/de'), '/design');
  assert.equal(stripLocalePrefix('/cart', ''), '/cart');
});

test('IIFE: with a context window.Crafter is a ready instance and crafter:ready is emitted; otherwise it stays the class', () => {
  const code = readFileSync(new URL('../dist/crafter.min.js', import.meta.url), 'utf8');

  // As in the browser: the script's global object is window itself
  const run = (win) => {
    Object.assign(win, { window: win, CustomEvent, URL, URLSearchParams, Intl, console, fetch, localStorage: globalThis.localStorage });
    vm.runInNewContext(code, win);
  };
  const { win } = install({ context });
  run(win);
  const instance = win.Crafter;
  assert.equal(typeof instance, 'object');
  assert.equal(instance.version, SDK_VERSION);
  assert.equal(instance.context.websiteId, 'site-1');
  assert.equal(instance.http.mode, 'storefront');
  assert.equal(instance.money.currency, 'EUR');
  assert.equal(domEvents.filter(([n]) => n === 'ready').length, 1);

  const plain = install();
  run(plain.win);
  assert.equal(typeof plain.win.Crafter, 'function');
  assert.equal(plain.win.Crafter.autoInit(plain.win), null);
});

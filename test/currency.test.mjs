// Customer currency unit tests (#421, #424, #426). Tests the built package (dist): `npm test` builds first.
// Zero dependencies: node:test + fake fetch. All values are synthetic.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Crafter, CrafterError, formatMoney } from '../dist/index.mjs';

let calls = [];
let queue = [];

function reply(status, body) {
  queue.push({ status, body });
}

beforeEach(() => {
  calls = [];
  queue = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : undefined });
    const next = queue.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'content-type': 'application/json' },
    });
  };
});

const buyer = { name: 'Test Buyer', email: 'buyer@example.test' };
const cart = { providerId: 'prov-1', websiteId: 'site-1', items: [{ productId: 'p1', quantity: 2 }], coupon: 'C10', user: buyer };
const quote = (id, currency = 'EUR') => ({
  quoteId: id, kind: 'cart', storeCurrency: 'USD', storeAmount: 20, currency, amount: 18.4, rate: 0.92, expiresAt: '2026-11-23T12:30:00.000Z',
});

function direct() {
  return new Crafter({ mode: 'direct', websiteId: 'site-1', apiBase: 'https://api.test', token: 't' });
}

test('checkout and initiate send no currency by default; a given value is passed as is', async () => {
  const crafter = direct();
  await crafter.cart.checkout(cart);
  await crafter.payments.initiate({ amount: 10, providerId: 'x', user: buyer });
  await crafter.cart.checkout({ ...cart, currency: 'EUR', quoteId: 'q-1' });
  assert.equal('currency' in calls[0].body, false);
  assert.equal('quoteId' in calls[0].body, false);
  assert.equal('currency' in calls[1].body, false);
  assert.equal(calls[2].body.currency, 'EUR');
  assert.equal(calls[2].body.quoteId, 'q-1');
});

test('payments.quote: /payment/quote, websiteId from the config', async () => {
  reply(200, quote('q-1'));
  const crafter = direct();
  const seen = [];
  crafter.on('payment:quoted', (q) => seen.push(q.quoteId));
  const q = await crafter.payments.quote({ kind: 'top_up', amount: 20, currency: 'EUR' });
  assert.equal(calls[0].url, 'https://api.test/website/payment/quote');
  assert.deepEqual(calls[0].body, { kind: 'top_up', amount: 20, currency: 'EUR', websiteId: 'site-1' });
  assert.equal(q.quoteId, 'q-1');
  assert.deepEqual(seen, ['q-1']);
});

test('useCustomerCurrency: a quote is fetched, payment starts with quoteId and the quote currency; presentment is returned', async () => {
  reply(200, quote('q-1'));
  reply(200, {
    success: true, type: 'stripe', payment_id: 'pay_1', clientSecret: 's', amount: 18.4, currency: 'EUR',
    presentment: { quoteId: 'q-1', currency: 'EUR', amount: 18.4, rate: 0.92, rateDate: '2026-11-23', storeCurrency: 'USD', storeAmount: 20 },
  });
  const res = await direct().cart.checkout(cart, { useCustomerCurrency: true, customerCurrency: 'EUR' });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, {
    websiteId: 'site-1', kind: 'cart', currency: 'EUR', coupon: 'C10', items: [{ productId: 'p1', quantity: 2 }],
  });
  assert.equal(calls[1].url, 'https://api.test/website/payment/checkout');
  assert.equal(calls[1].body.quoteId, 'q-1');
  assert.equal(calls[1].body.currency, 'EUR');
  assert.equal(res.customerCurrencyDisabled, false);
  assert.equal(res.presentment.storeAmount, 20);
  assert.equal(res.stripe.presentment.storeCurrency, 'USD');
});

test('useCustomerCurrency: an expired quote is renewed once', async () => {
  reply(200, quote('q-1'));
  reply(409, { message: 'expired', type: 'presentment_quote_expired' });
  reply(200, quote('q-2'));
  reply(200, { success: true, type: 'iframe', payment_id: 'p' });
  const res = await direct().payments.initiate({ amount: 20, providerId: 'x', user: buyer }, { useCustomerCurrency: true });
  assert.equal(calls.length, 4);
  assert.equal(calls[0].body.kind, 'top_up');
  assert.equal(calls[0].body.amount, 20);
  assert.equal(calls[1].body.quoteId, 'q-1');
  assert.equal(calls[3].url, 'https://api.test/website/payment/initiate');
  assert.equal(calls[3].body.quoteId, 'q-2');
  assert.equal(res.paymentId, 'p');
});

test('useCustomerCurrency: an error is thrown if the second quote is also rejected (single renewal)', async () => {
  reply(200, quote('q-1'));
  reply(404, { message: 'missing', type: 'presentment_quote_not_found' });
  reply(200, quote('q-2'));
  reply(409, { message: 'changed', type: 'presentment_quote_mismatch' });
  await assert.rejects(direct().cart.checkout(cart, { useCustomerCurrency: true }), (err) => {
    assert.ok(err instanceof CrafterError);
    assert.equal(err.type, 'presentment_quote_mismatch');
    return true;
  });
  assert.equal(calls.length, 4);
});

test('useCustomerCurrency: if the customer currency is disabled, pays in the store currency without a quote', async () => {
  // Disabled while fetching the quote
  reply(400, { message: 'disabled', type: 'customer_currency_not_allowed' });
  reply(200, { success: true, type: 'iframe', payment_id: 'p1' });
  // Disabled while starting the payment
  reply(200, quote('q-1'));
  reply(400, { message: 'disabled', type: 'customer_currency_not_allowed' });
  reply(200, { success: true, type: 'iframe', payment_id: 'p2' });
  const crafter = direct();
  const first = await crafter.cart.checkout({ ...cart, currency: 'EUR' }, { useCustomerCurrency: true });
  assert.equal(first.customerCurrencyDisabled, true);
  assert.equal('currency' in calls[1].body, false);
  assert.equal('quoteId' in calls[1].body, false);

  const second = await crafter.cart.checkout(cart, { useCustomerCurrency: true });
  assert.equal(second.customerCurrencyDisabled, true);
  assert.equal(calls[3].body.quoteId, 'q-1');
  assert.equal('quoteId' in calls[4].body, false);
  assert.equal('currency' in calls[4].body, false);
});

test('useCustomerCurrency: other quote errors are not renewed', async () => {
  reply(400, { message: 'para birimi', type: 'payment_currency_unsupported' });
  await assert.rejects(direct().cart.checkout(cart, { useCustomerCurrency: true }), (err) => err.type === 'payment_currency_unsupported');
  assert.equal(calls.length, 1);
});

test('currencies.context and convert', async () => {
  reply(200, {
    storeCurrency: 'USD', mode: 'auto', enabled: true, currencies: ['USD', 'EUR'], currency: 'EUR', source: 'country',
    rate: 0.92, rates: { EUR: 0.92 }, markupPercent: 2, rateDate: '2026-11-23', rateSource: 'ecb',
  });
  reply(200, { storeCurrency: 'USD', currency: 'EUR', source: 'choice', rate: 0.92, rateDate: '2026-11-23', rateSource: 'ecb', amounts: [9.19, 23] });
  const crafter = direct();
  const ctx = await crafter.currencies.context({ currency: 'EUR' });
  assert.equal(calls[0].url, 'https://api.test/website/payment/currencies?websiteId=site-1&currency=EUR');
  assert.equal(ctx.rates.EUR, 0.92);
  const conv = await crafter.currencies.convert([9.99, 25], { currency: 'EUR' });
  assert.equal(calls[1].url, 'https://api.test/website/payment/currencies/convert');
  assert.deepEqual(calls[1].body, { websiteId: 'site-1', amounts: [9.99, 25], currency: 'EUR' });
  assert.deepEqual(conv.amounts, [9.19, 23]);
});

test('storefront modunda currencies.context websiteId olmadan proxy yoluna gider', async () => {
  reply(200, { storeCurrency: 'TRY', currency: 'TRY' });
  await new Crafter().currencies.context();
  assert.equal(calls[0].url, '/api/storefront/payment/currencies');
});

test('formatMoney: formats by currency and language with Intl', () => {
  const plain = (s) => s.replace(/\s/g, ' ');
  assert.equal(formatMoney(1234.5, 'USD', 'en-US'), '$1,234.50');
  assert.equal(plain(formatMoney(1234.5, 'EUR', 'de-DE')), '1.234,50 €');
  assert.equal(formatMoney(250, 'try', 'tr-TR'), '₺250,00');
  assert.equal(formatMoney('1000', 'JPY', 'en-US'), '¥1,000');
  assert.equal(formatMoney(5, 'NOPE1', 'en-US'), '5.00 NOPE1');
  assert.equal(Crafter.utils.formatMoney, formatMoney);
});

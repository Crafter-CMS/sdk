// Payment module unit tests (TASK-256). Tests the built package (dist): `npm test` builds first.
// Zero dependencies: node:test + fake fetch. No card / personal data; all values are synthetic.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  Crafter,
  CrafterError,
  CrafterOutOfStockError,
  CrafterBalanceTopUpError,
  CrafterPaymentProviderError,
  isOutOfStockError,
  isCrafterError,
  parsePaymentStatus,
  topUpMaxAmount,
} from '../dist/index.mjs';

let calls = [];
let queue = [];

function reply(status, body) {
  queue.push({ status, body });
}

beforeEach(() => {
  calls = [];
  queue = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const next = queue.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'content-type': 'application/json' },
    });
  };
});

const buyer = { name: 'Test Buyer', email: 'buyer@example.test' };

function direct(extra = {}) {
  return new Crafter({ mode: 'direct', websiteId: 'site-1', apiBase: 'https://api.test', token: 't', ...extra });
}

test('LLC: cart.checkout returns the stripe session, publishable key and tax breakdown', async () => {
  reply(200, {
    success: true,
    type: 'stripe',
    payment_id: 'pay_1',
    merchant_oid: 'oid_1',
    amount: 11.9,
    currency: 'EUR',
    clientSecret: 'pi_123_secret_abc',
    subtotal: 10,
    taxAmount: 1.9,
    taxes: [{ country: 'DE', state: null, taxType: 'vat', rate: 19, amount: 1.9 }],
  });
  const crafter = direct({ stripePublishableKey: 'pk_test_fallback' });
  const res = await crafter.cart.checkout(
    {
      providerId: 'prov-1',
      websiteId: 'site-1',
      currency: 'EUR',
      items: [{ productId: 'p1', quantity: 1 }],
      user: buyer,
      billingCountry: 'DE',
    },
    { legalTerms: { version: '2026-11', region: 'eu' } }
  );

  assert.equal(calls[0].url, 'https://api.test/website/payment/checkout');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.billingCountry, 'DE');
  assert.equal(calls[0].init.headers['x-legal-terms-version'], '2026-11');
  assert.equal(calls[0].init.headers['x-legal-terms-region'], 'eu');

  assert.equal(res.paymentId, 'pay_1');
  assert.equal(res.payment_id, 'pay_1', 'ham alanlar korunur');
  assert.deepEqual(res.stripe, {
    paymentId: 'pay_1',
    clientSecret: 'pi_123_secret_abc',
    publishableKey: 'pk_test_fallback',
    amount: 11.9,
    currency: 'EUR',
    merchantOid: 'oid_1',
    tax: {
      subtotal: 10,
      taxAmount: 1.9,
      total: 11.9,
      currency: 'EUR',
      lines: [{ country: 'DE', state: null, taxType: 'vat', rate: 19, amount: 1.9 }],
    },
  });
});

test('LLC: a publishable key returned by the backend takes precedence over the config value', async () => {
  reply(200, { success: true, type: 'stripe', payment_id: 'p', clientSecret: 's', amount: 5, currency: 'USD', publishableKey: 'pk_test_backend' });
  const res = await direct({ stripePublishableKey: 'pk_test_fallback' }).payments.initiate({ amount: 5, providerId: 'x', user: buyer });
  assert.equal(res.stripe.publishableKey, 'pk_test_backend');
  assert.equal(res.tax, null, 'null without tax info');
});

test('TR: the PayTR iframe response is returned as is, no stripe field is added', async () => {
  reply(200, { success: true, type: 'iframe', payment_id: 'p2', iframeHtml: '<iframe></iframe>', token: 'tok' });
  const crafter = direct();
  const res = await crafter.payments.initiate({ amount: 100, provider: 'paytr', user: buyer });
  assert.equal(JSON.parse(calls[0].init.body).providerId, 'paytr');
  assert.equal(calls[0].init.headers['x-legal-terms-version'], undefined);
  assert.equal(res.type, 'iframe');
  assert.equal(res.token, 'tok');
  assert.equal(res.iframeHtml, '<iframe></iframe>');
  assert.equal(res.stripe, undefined);
  assert.equal(res.paymentId, 'p2');
});

test('TR: KuveytTürk and Shopier responses are unchanged; no currency is sent (the server decides)', async () => {
  reply(200, { success: true, type: 'kuveytturk_init', payment_id: 'p3', html: '<form></form>' });
  reply(200, { success: true, type: 'redirect', payment_id: 'p4', payment_url: 'https://pay.example.test/x' });
  const crafter = direct();
  const kt = await crafter.cart.checkout({ providerId: 'kt', websiteId: 'site-1', productIds: ['a'], user: buyer });
  assert.equal('currency' in JSON.parse(calls[0].init.body), false);
  assert.equal(kt.html, '<form></form>');
  assert.equal(kt.stripe, undefined);
  const sh = await crafter.payments.initiate({ amount: 50, providerId: 'shopier', user: buyer });
  assert.equal(sh.payment_url, 'https://pay.example.test/x');
});

test('OUT_OF_STOCK: typed error and sold-out product IDs', async () => {
  reply(409, { success: false, message: 'The product(s) are out of stock.', type: 'out_of_stock', details: { productIds: ['p1', 7] } });
  const crafter = direct();
  await assert.rejects(
    crafter.cart.checkout({ providerId: 'x', websiteId: 'site-1', productIds: ['p1'], user: buyer }),
    (err) => {
      assert.ok(err instanceof CrafterOutOfStockError);
      assert.ok(err instanceof CrafterError, 'the CrafterError shape is kept');
      assert.ok(isCrafterError(err) && isOutOfStockError(err));
      assert.equal(err.statusCode, 409);
      assert.equal(err.type, 'out_of_stock');
      assert.equal(err.name, 'CrafterOutOfStockError');
      assert.deepEqual(err.productIds, ['p1', '7']);
      return true;
    }
  );
});

test('Balance limit: typed error, reason and limits', async () => {
  reply(400, {
    success: false,
    message: 'limit',
    type: 'balance_top_up_limit_exceeded',
    details: { currency: 'EUR', maxSingleUsd: 250, maxPaidUsd: 1000, maxSingleAmount: 230, remainingAmount: 900 },
  });
  reply(403, { success: false, message: 'disabled', type: 'balance_top_up_unavailable' });
  const crafter = direct();
  await assert.rejects(crafter.payments.initiate({ amount: 999, providerId: 'x', user: buyer }), (err) => {
    assert.ok(err instanceof CrafterBalanceTopUpError);
    assert.equal(err.reason, 'single_limit');
    assert.equal(err.limits.maxSingleAmount, 230);
    return true;
  });
  await assert.rejects(crafter.payments.initiate({ amount: 1, providerId: 'x', user: buyer }), (err) => {
    assert.ok(err instanceof CrafterBalanceTopUpError);
    assert.equal(err.reason, 'unavailable');
    assert.equal(err.limits, null);
    return true;
  });
});

test('Payment provider errors are typed; unknown types stay a plain CrafterError', async () => {
  reply(503, { success: false, message: 'vergi', type: 'tax_calculation_failed' });
  reply(400, { success: false, message: 'other', type: 'invalid_coupon' });
  const crafter = direct();
  await assert.rejects(crafter.payments.initiate({ amount: 1, providerId: 'x', user: buyer }), (err) => {
    assert.ok(err instanceof CrafterPaymentProviderError);
    assert.equal(err.retryable, true);
    return true;
  });
  await assert.rejects(crafter.payments.initiate({ amount: 1, providerId: 'x', user: buyer }), (err) => {
    assert.equal(err.constructor, CrafterError);
    assert.equal(err.type, 'invalid_coupon');
    return true;
  });
});

test('getTopUpPolicy: limits, paid/bonus balance and the terms flag', async () => {
  reply(200, {
    data: {
      enabled: true, closedLoop: true, currency: 'EUR', maxSingleUsd: 250, maxPaidUsd: 1000,
      maxSingleAmount: 230, remainingAmount: 120, balance: 50, paidBalance: 40, bonusBalance: 10,
    },
  });
  const policy = await direct().payments.getTopUpPolicy();
  assert.equal(calls[0].url, 'https://api.test/website/payment/balance-top-up/policy?websiteId=site-1');
  assert.equal(policy.showTerms, true);
  assert.equal(policy.paidBalance, 40);
  assert.equal(policy.bonusBalance, 10);
  assert.equal(topUpMaxAmount(policy, 500), 120);
});

test('getTopUpPolicy: in TR mode the terms text is not shown and no limit applies', async () => {
  reply(200, { enabled: true, closedLoop: false, currency: 'TRY', maxSingleUsd: 250, maxPaidUsd: 1000, maxSingleAmount: null, remainingAmount: null, balance: 10, paidBalance: 10, bonusBalance: 0 });
  const policy = await new Crafter({ apiBase: '/api/storefront' }).payments.getTopUpPolicy();
  assert.equal(calls[0].url, '/api/storefront/payment/balance-top-up/policy');
  assert.equal(policy.showTerms, false);
  assert.equal(topUpMaxAmount(policy, 5000), 5000);
});

test('Order status: delivery summary, NEEDS_REVIEW and REFUNDED', () => {
  assert.deepEqual(parsePaymentStatus('p', { status: 'COMPLETED', delivery: 'delivered' }), {
    paymentId: 'p', status: 'COMPLETED', delivery: 'delivered', deliveryStatus: 'DELIVERED', outcome: 'success', final: true,
  });
  const review = parsePaymentStatus('p', { status: 'COMPLETED', delivery: 'failed' });
  assert.equal(review.deliveryStatus, 'NEEDS_REVIEW');
  assert.equal(review.outcome, 'needs_review');
  const refunded = parsePaymentStatus('p', { status: 'REFUNDED', delivery: 'refunded' });
  assert.equal(refunded.deliveryStatus, 'REFUNDED');
  assert.equal(refunded.outcome, 'refunded');
  const delivering = parsePaymentStatus('p', { status: 'COMPLETED', delivery: 'pending' });
  assert.equal(delivering.outcome, 'processing');
  assert.equal(delivering.final, false);
  // Response without delivery info (TR / old backend)
  const plain = parsePaymentStatus('p', { status: 'COMPLETED' });
  assert.equal(plain.deliveryStatus, null);
  assert.equal(plain.outcome, 'success');
  // If the backend returns deliveryStatus in the future it is used directly
  assert.equal(parsePaymentStatus('p', { status: 'COMPLETED', deliveryStatus: 'NEEDS_REVIEW' }).deliveryStatus, 'NEEDS_REVIEW');
  assert.equal(parsePaymentStatus('p', { status: 'FAILED' }).outcome, 'failed');
});

test('waitForResult: polls until delivery finishes, continues on a network error', async () => {
  reply(200, { status: 'PENDING' });
  reply(500, { message: 'transient' });
  reply(200, { status: 'COMPLETED', delivery: 'pending' });
  reply(200, { status: 'REFUNDED', delivery: 'refunded' });
  const crafter = direct();
  const seen = [];
  crafter.events.on('payment:status', (s) => seen.push(s.outcome));
  const result = await crafter.payments.waitForResult('pay 1', { intervalMs: 1, attempts: 10 });
  assert.equal(result.outcome, 'refunded');
  assert.equal(calls.length, 4);
  assert.equal(calls[0].url, 'https://api.test/website/payment/status/pay%201');
  assert.equal(calls[0].init.headers.Authorization, undefined, 'public endpoint: no token is sent');
  assert.deepEqual(seen, ['pending', 'processing', 'refunded']);
});

# 💳 Payments Module (`crafter.payments`)

Handles topping up site balance with credit cards, debit cards, bank transfers or mobile payment methods.

---

## 📌 Methods and Usage Examples

### 1. `getPublicProviders()`
Lists the payment providers enabled for customers on the site (PayTR, Shopier, CrafterPayments, etc.), minimum/maximum amounts and bonus multipliers.

* **HTTP Route:** `GET /config/payment/public`
* **Returns:** `PublicPaymentProvider[]`
  ```typescript
  interface PublicPaymentProvider {
    id: string;             // Provider UUID (used in the initiate call!)
    provider: string;       // 'paytr', 'shopier', 'crafterpayments', etc.
    name: string;           // Name shown on screen (e.g. 'Credit Card (PayTR)')
    isActive: boolean;
    minAmount: number;      // Minimum top-up amount
    maxAmount: number;      // Maximum top-up amount
    creditMultipler: number;// Bonus multiplier (e.g. 1.10 = 10% bonus credit)
    commissionRate?: number;
  }
  ```
* **Example usage:**
  ```javascript
  const providers = await crafter.payments.getPublicProviders();
  const { currency } = await crafter.website.getInfo(); // limits are in the store currency
  providers.forEach(p => {
    console.log(`${p.name} (Min: ${Crafter.utils.formatMoney(p.minAmount, currency)} - Bonus: x${p.creditMultipler})`);
  });
  ```

---

### 2. `initiate(data)`
Starts a new payment session and gets an iframe token or a redirect URL.

* **HTTP Route:** `POST /payment/initiate`
* **Input:**
  ```typescript
  interface InitiatePaymentDto {
    amount: number;         // Amount to top up
    providerId: string;     // Provider ID from getPublicProviders()
    currency?: string;      // Not sent: the server decides the currency (only the quote's currency)
    quoteId?: string;       // Locked rate quote (payments.quote); payment in the customer currency
    user: {
      name: string;
      email: string;
      phone?: string;
      address?: string;
    };
  }
  ```
* **Returns:**
  ```typescript
  interface InitiatePaymentResponse {
    token?: string;         // PayTR iframe token
    iframeUrl?: string;     // URL to embed directly in an iframe
    paymentUrl?: string;    // External page to redirect to (Shopier, etc.)
    paymentId?: string;     // Payment tracking ID
  }
  ```
* **Example usage:**
  ```javascript
  const res = await crafter.payments.initiate({
    amount: 100,
    providerId: 'provider-uuid-paytr',
    user: {
      name: 'Jane Doe',
      email: 'ahmet@example.com',
      phone: '05551234567'
    }
  });

  if (res.iframeUrl) {
    // Embed in an iframe
    document.querySelector('#payment-iframe').src = res.iframeUrl;
  } else if (res.paymentUrl) {
    // Redirect to the external payment page
    window.location.href = res.paymentUrl;
  }
  ```

---

### 3. `check(paymentId)`
Checks whether a started payment was confirmed (a poller or a check page).

* **HTTP Route:** `POST /payment/check`
* **Returns:** `{ success: boolean, status: 'PENDING' | 'SUCCESS' | 'FAILED', paymentId: string, amount?: number }`
* **Example:**
  ```javascript
  const status = await crafter.payments.check('pay-123456');
  if (status.status === 'SUCCESS') {
    alert('Your payment was confirmed and the credit was added to your account!');
  }
  ```

---

## 🌍 Seller LLC flow (CrafterPayments + Stripe) — v1.2.0

When the seller is **Crafter Technologies LLC**, the CrafterPayments payment is taken on the page with the Stripe **Payment Element**; tax is calculated with Stripe Tax. The SDK does not guess the seller mode; the backend response decides:

* If the `initiate()` / `cart.checkout()` response has `type === 'stripe'`, it is the LLC flow and the SDK adds the `stripe` field to the response.
* `closedLoop` (`showTerms`) in the `getTopUpPolicy()` response is the seller LLC indicator for balance rules.

The TR flow (PayTR, Shopier, KuveytTürk, CrafterPayments TR) is unchanged: responses come back with the same fields, only fields such as `paymentId` and `tax` are **added**.

### 4. Starting the payment and the `stripe` session

```typescript
interface StripePaymentSession {
  paymentId: string;
  clientSecret: string;          // PaymentIntent client secret
  publishableKey: string | null; // backend response > CrafterConfig.stripePublishableKey > null
  amount: number;                // total including tax
  currency: string;
  merchantOid?: string;
  tax: PaymentTaxBreakdown | null;
}

interface PaymentTaxBreakdown {
  subtotal: number;   // excluding tax
  taxAmount: number;  // total tax
  total: number;      // vergi dahil
  currency: string;
  lines: { country: string | null; state: string | null; taxType: string | null; rate: number; amount: number }[];
}
```

> **Publishable key:** Today the backend does not return a publishable key in the payment response. Provide the key in the configuration (`new Crafter({ stripePublishableKey: 'pk_test_...' })`); if the backend returns `publishableKey` in the future, that takes precedence. The publishable key is not secret.

Cart payment (for an LLC the buyer's country is required for Stripe Tax; a postal code is also required in the US/Canada):

```javascript
const res = await crafter.cart.checkout(
  {
    websiteId: 'site-uuid',
    providerId: crafterPaymentsProvider.id,
    items: [{ productId: 'prod-1', quantity: 1 }],
    user: { name: 'Test Buyer', email: 'buyer@example.com', address: 'United States' },
    billingCountry: 'US',
    billingPostalCode: '10001',
  },
  // Optional: the accepted terms version (x-legal-terms-version / x-legal-terms-region headers)
  { legalTerms: { version: '2026-11', region: 'us' } }
);

if (res.delivered) {
  // Paid entirely with balance, the items were delivered
} else if (res.stripe) {
  // LLC: set up the Payment Element with res.stripe.clientSecret (below)
  renderTax(res.stripe.tax);
} else if (res.iframeHtml || res.html) {
  // TR: PayTR / KuveytTürk
} else if (res.payment_url || res.paymentUrl || res.redirectUrl) {
  // TR: Shopier, etc. redirect
}
```

### 5. The theme loads Stripe.js (it is not bundled in the SDK)

The SDK has zero dependencies; the theme loads Stripe.js itself and **only in the LLC flow** (Stripe.js must always be loaded from `js.stripe.com`):

```javascript
function loadStripeJs() {
  return window.Stripe
    ? Promise.resolve(window.Stripe)
    : new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.onload = () => resolve(window.Stripe);
        s.onerror = reject;
        document.head.appendChild(s);
      });
}

const StripeCtor = await loadStripeJs();
const stripe = StripeCtor(res.stripe.publishableKey);
const elements = stripe.elements({ clientSecret: res.stripe.clientSecret });
elements.create('payment').mount('#payment-element');

payButton.onclick = async () => {
  const returnUrl = new URL(location.href);
  returnUrl.searchParams.set('stripe_payment_id', res.stripe.paymentId);
  const { error } = await stripe.confirmPayment({
    elements,
    redirect: 'if_required',               // the 3DS window opens on Stripe; with a full redirect it returns to return_url
    confirmParams: { return_url: returnUrl.toString() },
  });
  if (error) return showError(error.message); // card declined, etc.; can be retried with the same form
  const result = await crafter.payments.waitForResult(res.stripe.paymentId);
  showResult(result.outcome);
};
```

For testing use the Stripe test card: `4242 4242 4242 4242`, any future date, any CVC. 3DS test: `4000 0027 6000 3184`. End-to-end example: [`examples/05-llc-checkout.html`](../examples/05-llc-checkout.html).

### 6. `getStatus(paymentId)` and `waitForResult(paymentId, options?)`

Payment and delivery status (no session required). If the Stripe webhook is late, the backend reads the payment from Stripe.

* **HTTP Route:** `GET /payment/status/:paymentId`
* **Returns:** `PaymentStatusResult`
  ```typescript
  interface PaymentStatusResult {
    paymentId: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'REFUNDED';
    delivery: 'pending' | 'delivered' | 'failed' | 'refunded' | null; // the backend's raw delivery summary
    deliveryStatus: 'PENDING' | 'DELIVERED' | 'NEEDS_REVIEW' | 'REFUNDED' | null;
    outcome: 'processing' | 'success' | 'pending' | 'failed' | 'refunded' | 'needs_review';
    final: boolean;  // whether the result is final
  }
  ```

| `status` | `delivery` | `deliveryStatus` | `outcome` | To the buyer |
| :--- | :--- | :--- | :--- | :--- |
| `PENDING` | — | `null` | `pending` | Waiting for payment confirmation |
| `COMPLETED` | `pending` | `PENDING` | `processing` | Payment received, delivery in progress |
| `COMPLETED` | `delivered` / none | `DELIVERED` / `null` | `success` | Order completed |
| `COMPLETED` | `failed` | `NEEDS_REVIEW` | `needs_review` | Payment received, delivery under review; contact support |
| `REFUNDED` | `refunded` | `REFUNDED` | `refunded` | Product sold out, payment refunded |
| `FAILED` / `CANCELED` | — | — | `failed` | Payment not received |

`waitForResult` polls until the result is final (default 20 attempts × 1.5 s); on timeout it returns the last status (usually `pending`; show "confirmation may take a few minutes"). Each poll emits a `payment:status` event.

### 7. `getTopUpPolicy(websiteId?)`

Balance top-up conditions. Requires a session; if `websiteId` is not given, the value from the configuration is used.

* **HTTP Route:** `GET /payment/balance-top-up/policy?websiteId=`
* **Returns:** `BalanceTopUpPolicy`
  ```typescript
  interface BalanceTopUpPolicy {
    enabled: boolean;        // whether top-up is enabled (enabled by a setting for an LLC)
    closedLoop: boolean;     // seller LLC: closed-loop balance rules
    showTerms: boolean;      // whether the balance terms text should be shown on the top-up screen
    currency: string;
    maxSingleUsd: number;    // single top-up cap (USD)
    maxPaidUsd: number;      // paid balance cap (USD)
    maxSingleAmount: number | null;  // store currency equivalent (null without a rate / in TR)
    remainingAmount: number | null;
    balance: number;         // paid + bonus
    paidBalance: number;
    bonusBalance: number;
  }
  ```
* `topUpMaxAmount(policy, provider.maxAmount)` gives the highest top-up amount for the form (the backend enforces the limits separately).

```javascript
const policy = await crafter.payments.getTopUpPolicy();
if (policy.closedLoop && !policy.enabled) hideTopUpForm();
if (policy.showTerms) showBalanceTerms(); // balance can only be spent in this store, cannot be cashed out, etc.
amountInput.max = topUpMaxAmount(policy, provider.maxAmount);
```

### 8. Typed payment errors

All derive from `CrafterError` (`instanceof CrafterError` and `isCrafterError` keep working) and carry the backend error code in the new `type` field.

| Class | `type` | Extra fields |
| :--- | :--- | :--- |
| `CrafterOutOfStockError` | `out_of_stock` (HTTP 409) | `productIds: string[]` |
| `CrafterBalanceTopUpError` | `balance_top_up_unavailable`, `balance_top_up_limit_exceeded`, `balance_top_up_total_limit_exceeded` | `reason: 'unavailable' \| 'single_limit' \| 'total_limit'`, `limits` |
| `CrafterPaymentProviderError` | `seller_entity_not_ready`, `tax_calculation_failed`, `tax_location_invalid`, `payment_provider_not_found`, `payment_provider_unsupported`, `payment_config_error`, `payment_initialization_failed`, `payment_failed` | `retryable: boolean` |

```javascript
import { isOutOfStockError, isBalanceTopUpError, isPaymentProviderError, PaymentErrorType } from '@crafter-cms/sdk';

try {
  await crafter.cart.checkout(order);
} catch (err) {
  if (isOutOfStockError(err)) markSoldOut(err.productIds);
  else if (isBalanceTopUpError(err)) showLimit(err.reason, err.limits);
  else if (isPaymentProviderError(err) && err.type === PaymentErrorType.TAX_LOCATION_INVALID) askPostalCode();
  else if (isPaymentProviderError(err)) showError(err.message, { retry: err.retryable });
  else throw err;
}
```

Stripe errors such as card declines come from the `stripe.confirmPayment` result (`error.message`); they do not go through the SDK.

---

## 💱 Customer currency — v1.3.0

The **server** decides the payment currency (the store currency). The SDK no longer sends `currency: 'TRY'`; if `currency` is not given the field is not sent at all. If a currency different from the store's is sent the backend returns 400 `payment_currency_mismatch`, and 400 `payment_currency_unsupported` for an unsupported currency.

The storefront decides the customer's currency (`currency` via `POST /localization`, the `crafter_currency` cookie); the SDK does not write its own cookie. In direct mode, without a cookie, a suggestion can be passed with the `customerCurrency` / `currency` parameter; if it is not allowed the server picks the country or store currency.

### 6. Price display: `crafter.currencies`

```javascript
// GET /payment/currencies?websiteId=&currency=
const ctx = await crafter.currencies.context();
// { storeCurrency: 'USD', mode: 'auto', enabled: true, currencies: ['USD', 'EUR'], currency: 'EUR',
//   source: 'country', rate: 0.92, rates: { EUR: 0.92 }, markupPercent: 2, rateDate, rateSource }

// POST /payment/currencies/convert (at most 500 amounts, order is preserved)
const { currency, amounts } = await crafter.currencies.convert(products.map((p) => p.price));
products.forEach((p, i) => (p.displayPrice = Crafter.utils.formatMoney(amounts[i], currency, 'de-DE')));
```

Converted amounts are for **display** only; the charged amount is set by the locked quote.

### 7. Payment in the customer currency (`useCustomerCurrency`)

Optional; if not given, payment starts in the store currency as it does today.

```javascript
const res = await crafter.cart.checkout(
  { websiteId, providerId, items, user, billingCountry: 'DE' },
  { useCustomerCurrency: true } // optional: customerCurrency: 'EUR'
);
// Balance top-up: crafter.payments.initiate({ amount, providerId, user }, { useCustomerCurrency: true })

if (res.customerCurrencyDisabled) {
  // The store disabled the customer currency; payment started in the store currency
}
if (res.presentment) {
  // amount / currency / subtotal / taxAmount / taxes are in the customer currency
  // res.presentment: { quoteId, currency, amount, rate, rateDate, storeCurrency, storeAmount }
}
```

Flow:

1. `POST /payment/quote` (with cart fields for `kind: 'cart'` or an amount for `kind: 'top_up'`) → `{ quoteId, storeAmount, storeCurrency, currency, amount, rate, expiresAt }` (valid ~30 min).
2. Payment starts with `quoteId` and the quote's currency.
3. 409 `presentment_quote_expired` / `presentment_quote_mismatch` or 404 `presentment_quote_not_found` → a new quote is fetched **once**.
4. 400 `customer_currency_not_allowed` → pays without a quote, in the store currency (`customerCurrencyDisabled: true`).

To fetch the quote by hand: `const q = await crafter.payments.quote({ kind: 'cart', items })`, then `cart.checkout({ ..., quoteId: q.quoteId, currency: q.currency })`.

### 8. Formatting amounts: `formatMoney`

```javascript
import { formatMoney } from '@crafter-cms/sdk'; // or Crafter.utils.formatMoney
formatMoney(9.99, 'USD', 'en-US');  // '$9.99'
formatMoney(250, 'TRY', 'tr-TR');   // '₺250,00'
formatMoney(1234.5, 'EUR', 'de-DE'); // '1.234,50 €'
```

The symbol and decimals come from the currency; themes must not hard-code 'TL' / '₺'.

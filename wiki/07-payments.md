# 💳 Ödeme İşlemleri Modülü (`crafter.payments`)

Kredi kartı, banka kartı, havale veya mobil ödeme yöntemleriyle siteye bakiye yükleme süreçlerini yönetir.

---

## 📌 Metotlar ve Kullanım Örnekleri

### 1. `getPublicProviders()`
Sitede müşterilere açık olan ödeme sağlayıcılarını (PayTR, Shopier, CrafterPayments vb.), minimum/maksimum tutarları ve bonus çarpanlarını listeler.

* **HTTP Rota:** `GET /config/payment/public`
* **Dönüş:** `PublicPaymentProvider[]`
  ```typescript
  interface PublicPaymentProvider {
    id: string;             // Sağlayıcı UUID'si (initiate çağrısında kullanılır!)
    provider: string;       // 'paytr', 'shopier', 'crafterpayments' vb.
    name: string;           // Ekranda gösterilecek isim (Örn: 'Kredi Kartı (PayTR)')
    isActive: boolean;
    minAmount: number;      // Minimum yüklenebilecek tutar
    maxAmount: number;      // Maksimum yüklenebilecek tutar
    creditMultipler: number;// Bonus çarpanı (Örn: 1.10 = %10 Bonus Kredi)
    commissionRate?: number;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const providers = await crafter.payments.getPublicProviders();
  const { currency } = await crafter.website.getInfo(); // limitler mağaza para biriminde
  providers.forEach(p => {
    console.log(`${p.name} (Min: ${Crafter.utils.formatMoney(p.minAmount, currency)} - Bonus: x${p.creditMultipler})`);
  });
  ```

---

### 2. `initiate(data)`
Yeni bir ödeme oturumu başlatır ve iframe token'ı veya yönlendirme URL'i alır.

* **HTTP Rota:** `POST /payment/initiate`
* **Girdi:**
  ```typescript
  interface InitiatePaymentDto {
    amount: number;         // Yüklenecek tutar
    providerId: string;     // getPublicProviders()'dan gelen provider ID
    currency?: string;      // Gönderilmez: para birimini sunucu belirler (yalnızca teklifin para birimi)
    quoteId?: string;       // Kilitli kur teklifi (payments.quote); müşteri para biriminde ödeme
    user: {
      name: string;
      email: string;
      phone?: string;
      address?: string;
    };
  }
  ```
* **Dönüş:**
  ```typescript
  interface InitiatePaymentResponse {
    token?: string;         // PayTR iframe token'ı
    iframeUrl?: string;     // Doğrudan iframe içine gömülecek URL
    paymentUrl?: string;    // Yönlendirilecek dış sayfa (Shopier vb.)
    paymentId?: string;     // Ödeme takip ID'si
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const res = await crafter.payments.initiate({
    amount: 100,
    providerId: 'provider-uuid-paytr',
    user: {
      name: 'Ahmet Yılmaz',
      email: 'ahmet@example.com',
      phone: '05551234567'
    }
  });

  if (res.iframeUrl) {
    // Iframe içine göm
    document.querySelector('#payment-iframe').src = res.iframeUrl;
  } else if (res.paymentUrl) {
    // Dış ödeme sayfasına yönlendir
    window.location.href = res.paymentUrl;
  }
  ```

---

### 3. `check(paymentId)`
Başlatılan bir ödemenin onaylanıp onaylanmadığını kontrol eder (Poller veya kontrol sayfası).

* **HTTP Rota:** `POST /payment/check`
* **Dönüş:** `{ success: boolean, status: 'PENDING' | 'SUCCESS' | 'FAILED', paymentId: string, amount?: number }`
* **Örnek:**
  ```javascript
  const status = await crafter.payments.check('pay-123456');
  if (status.status === 'SUCCESS') {
    alert('Ödemeniz onaylandı, krediniz hesabınıza yüklendi!');
  }
  ```

---

## 🌍 Satıcı LLC akışı (CrafterPayments + Stripe) — v1.2.0

Satıcı **Crafter Technologies LLC** iken CrafterPayments ödemesi Stripe **Payment Element** ile sayfa içinde alınır; vergi Stripe Tax ile hesaplanır. Satıcı modunu SDK tahmin etmez, backend yanıtı belirler:

* `initiate()` / `cart.checkout()` yanıtında `type === 'stripe'` ise LLC akışıdır ve SDK yanıta `stripe` alanını ekler.
* `getTopUpPolicy()` yanıtındaki `closedLoop` (`showTerms`) bakiye kuralları için satıcı LLC bilgisidir.

TR akışı (PayTR, Shopier, KuveytTürk, CrafterPayments TR) değişmedi: yanıtlar aynı alanlarla döner, yalnızca `paymentId` ve `tax` gibi alanlar **eklenir**.

### 4. Ödemeyi başlatma ve `stripe` oturumu

```typescript
interface StripePaymentSession {
  paymentId: string;
  clientSecret: string;          // PaymentIntent client secret'ı
  publishableKey: string | null; // backend yanıtı > CrafterConfig.stripePublishableKey > null
  amount: number;                // vergi dahil toplam
  currency: string;
  merchantOid?: string;
  tax: PaymentTaxBreakdown | null;
}

interface PaymentTaxBreakdown {
  subtotal: number;   // vergi hariç
  taxAmount: number;  // toplam vergi
  total: number;      // vergi dahil
  currency: string;
  lines: { country: string | null; state: string | null; taxType: string | null; rate: number; amount: number }[];
}
```

> **Publishable key:** Backend ödeme yanıtında bugün publishable key döndürmüyor. Anahtarı yapılandırmada verin (`new Crafter({ stripePublishableKey: 'pk_test_...' })`); backend ileride `publishableKey` döndürürse o önceliklidir. Publishable key gizli değildir.

Sepet ödemesi (LLC'de alıcının ülkesi Stripe Tax için zorunlu; ABD/Kanada'da posta kodu da gerekir):

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
  // İsteğe bağlı: onaylanan sözleşme sürümü (x-legal-terms-version / x-legal-terms-region başlıkları)
  { legalTerms: { version: '2026-11', region: 'us' } }
);

if (res.delivered) {
  // Bakiyeyle tamamen ödendi, ürünler teslim edildi
} else if (res.stripe) {
  // LLC: Payment Element'i res.stripe.clientSecret ile kurun (aşağıda)
  renderTax(res.stripe.tax);
} else if (res.iframeHtml || res.html) {
  // TR: PayTR / KuveytTürk
} else if (res.payment_url || res.paymentUrl || res.redirectUrl) {
  // TR: Shopier vb. yönlendirme
}
```

### 5. Stripe.js'i tema yükler (SDK'ya gömülü değildir)

SDK sıfır bağımlılıklıdır; Stripe.js'i tema kendisi ve **yalnızca LLC akışında** yükler (Stripe.js her zaman `js.stripe.com`'dan yüklenmelidir):

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
    redirect: 'if_required',               // 3DS penceresi Stripe'ta açılır; tam yönlendirmede return_url'e dönülür
    confirmParams: { return_url: returnUrl.toString() },
  });
  if (error) return showError(error.message); // kart reddi vb.; aynı formla tekrar denenebilir
  const result = await crafter.payments.waitForResult(res.stripe.paymentId);
  showResult(result.outcome);
};
```

Test için Stripe test kartı: `4242 4242 4242 4242`, ileri bir tarih, herhangi bir CVC. 3DS testi: `4000 0027 6000 3184`. Uçtan uca örnek: [`examples/05-llc-checkout.html`](../examples/05-llc-checkout.html).

### 6. `getStatus(paymentId)` ve `waitForResult(paymentId, options?)`

Ödeme ve teslimat durumu (oturum gerektirmez). Stripe webhook'u gecikirse backend ödemeyi Stripe'tan okur.

* **HTTP Rota:** `GET /payment/status/:paymentId`
* **Dönüş:** `PaymentStatusResult`
  ```typescript
  interface PaymentStatusResult {
    paymentId: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'REFUNDED';
    delivery: 'pending' | 'delivered' | 'failed' | 'refunded' | null; // backend'in ham teslimat özeti
    deliveryStatus: 'PENDING' | 'DELIVERED' | 'NEEDS_REVIEW' | 'REFUNDED' | null;
    outcome: 'processing' | 'success' | 'pending' | 'failed' | 'refunded' | 'needs_review';
    final: boolean;  // sonuç kesinleşti mi
  }
  ```

| `status` | `delivery` | `deliveryStatus` | `outcome` | Alıcıya |
| :--- | :--- | :--- | :--- | :--- |
| `PENDING` | — | `null` | `pending` | Ödeme onayı bekleniyor |
| `COMPLETED` | `pending` | `PENDING` | `processing` | Ödeme alındı, teslimat sürüyor |
| `COMPLETED` | `delivered` / yok | `DELIVERED` / `null` | `success` | Sipariş tamamlandı |
| `COMPLETED` | `failed` | `NEEDS_REVIEW` | `needs_review` | Ödeme alındı, teslimat incelemede; destek ile iletişim |
| `REFUNDED` | `refunded` | `REFUNDED` | `refunded` | Ürün tükendi, ödeme iade edildi |
| `FAILED` / `CANCELED` | — | — | `failed` | Ödeme alınmadı |

`waitForResult` sonuç kesinleşene kadar (varsayılan 20 deneme × 1,5 sn) yoklar; süre dolarsa son durumu döner (genelde `pending`; "onay birkaç dakika sürebilir" gösterin). Her yoklamada `payment:status` olayı yayılır.

### 7. `getTopUpPolicy(websiteId?)`

Bakiye yükleme koşulları. Oturum gerektirir; `websiteId` verilmezse yapılandırmadaki değer kullanılır.

* **HTTP Rota:** `GET /payment/balance-top-up/policy?websiteId=`
* **Dönüş:** `BalanceTopUpPolicy`
  ```typescript
  interface BalanceTopUpPolicy {
    enabled: boolean;        // yükleme açık mı (LLC'de ayarla açılır)
    closedLoop: boolean;     // satıcı LLC: kapalı devre bakiye kuralları
    showTerms: boolean;      // yükleme ekranında bakiye koşul metni gösterilmeli mi
    currency: string;
    maxSingleUsd: number;    // tek yükleme üst sınırı (USD)
    maxPaidUsd: number;      // ödenmiş bakiye üst sınırı (USD)
    maxSingleAmount: number | null;  // mağaza para birimi karşılığı (kur yoksa / TR'de null)
    remainingAmount: number | null;
    balance: number;         // ödenmiş + bonus
    paidBalance: number;
    bonusBalance: number;
  }
  ```
* `topUpMaxAmount(policy, provider.maxAmount)` formdaki en yüksek yükleme tutarını verir (limitleri backend ayrıca zorlar).

```javascript
const policy = await crafter.payments.getTopUpPolicy();
if (policy.closedLoop && !policy.enabled) hideTopUpForm();
if (policy.showTerms) showBalanceTerms(); // bakiye yalnızca bu mağazada harcanır, nakde çevrilmez vb.
amountInput.max = topUpMaxAmount(policy, provider.maxAmount);
```

### 8. Tipli ödeme hataları

Tümü `CrafterError`'dan türer (`instanceof CrafterError` ve `isCrafterError` çalışmaya devam eder) ve yeni `type` alanında backend hata kodunu taşır.

| Sınıf | `type` | Ek alanlar |
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

Kart reddi gibi Stripe hataları `stripe.confirmPayment` sonucundan (`error.message`) gelir; SDK'dan geçmez.

---

## 💱 Müşteri para birimi — v1.3.0

Ödemenin para birimini **sunucu** belirler (mağaza para birimi). SDK artık `currency: 'TRY'` göndermez; `currency` verilmezse alan hiç gönderilmez. Mağazanınkinden farklı bir para birimi gönderilirse backend 400 `payment_currency_mismatch`, desteklenmeyen para biriminde 400 `payment_currency_unsupported` döner.

Müşterinin para birimini vitrin belirler (`POST /localization` ile `currency`, `crafter_currency` çerezi); SDK kendi çerezini yazmaz. Direct modda çerez yoksa `customerCurrency` / `currency` parametresiyle öneri verilebilir; sunucu izinli değilse ülke ya da mağaza para birimini seçer.

### 6. Fiyat gösterimi: `crafter.currencies`

```javascript
// GET /payment/currencies?websiteId=&currency=
const ctx = await crafter.currencies.context();
// { storeCurrency: 'USD', mode: 'auto', enabled: true, currencies: ['USD', 'EUR'], currency: 'EUR',
//   source: 'country', rate: 0.92, rates: { EUR: 0.92 }, markupPercent: 2, rateDate, rateSource }

// POST /payment/currencies/convert (en fazla 500 tutar, sıra korunur)
const { currency, amounts } = await crafter.currencies.convert(products.map((p) => p.price));
products.forEach((p, i) => (p.displayPrice = Crafter.utils.formatMoney(amounts[i], currency, 'de-DE')));
```

Çevrilen tutarlar yalnızca **gösterim** içindir; tahsil edilen tutar kilitli teklifle belirlenir.

### 7. Müşteri para biriminde ödeme (`useCustomerCurrency`)

İsteğe bağlıdır; verilmezse ödeme bugünkü gibi mağaza para biriminde başlar.

```javascript
const res = await crafter.cart.checkout(
  { websiteId, providerId, items, user, billingCountry: 'DE' },
  { useCustomerCurrency: true } // isteğe bağlı: customerCurrency: 'EUR'
);
// Bakiye yükleme: crafter.payments.initiate({ amount, providerId, user }, { useCustomerCurrency: true })

if (res.customerCurrencyDisabled) {
  // Mağaza müşteri para birimini kapattı; ödeme mağaza para biriminde başladı
}
if (res.presentment) {
  // amount / currency / subtotal / taxAmount / taxes müşteri para biriminde
  // res.presentment: { quoteId, currency, amount, rate, rateDate, storeCurrency, storeAmount }
}
```

Akış:

1. `POST /payment/quote` (`kind: 'cart'` sepet alanlarıyla ya da `kind: 'top_up'` tutarla) → `{ quoteId, storeAmount, storeCurrency, currency, amount, rate, expiresAt }` (~30 dk geçerli).
2. Ödeme `quoteId` ve teklifin para birimiyle başlatılır.
3. 409 `presentment_quote_expired` / `presentment_quote_mismatch` veya 404 `presentment_quote_not_found` → **bir kez** yeni teklif alınır.
4. 400 `customer_currency_not_allowed` → teklifsiz, mağaza para biriminde ödenir (`customerCurrencyDisabled: true`).

Teklifi elle almak için: `const q = await crafter.payments.quote({ kind: 'cart', items })`, ardından `cart.checkout({ ..., quoteId: q.quoteId, currency: q.currency })`.

### 8. Tutar biçimlendirme: `formatMoney`

```javascript
import { formatMoney } from '@crafter-cms/sdk'; // ya da Crafter.utils.formatMoney
formatMoney(9.99, 'USD', 'en-US');  // '$9.99'
formatMoney(250, 'TRY', 'tr-TR');   // '₺250,00'
formatMoney(1234.5, 'EUR', 'de-DE'); // '1.234,50 €'
```

Sembol ve ondalık hane para biriminden gelir; temalarda 'TL' / '₺' sabit yazılmamalıdır.

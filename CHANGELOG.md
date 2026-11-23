# Değişiklik Günlüğü

## 1.3.0 — 2026-11-23

Ödeme para birimini sunucu belirler (#421); müşteri para biriminde fiyat gösterimi ve kilitli kur teklifiyle ödeme (#424, #426). Müşteri para biriminde ödeme isteğe bağlıdır; mevcut çağrılar aynı şekilde çalışır.

### Eklenenler
- `payments.quote({ kind, currency?, amount | sepet alanları })`: kilitli kur teklifi (`POST /payment/quote`); `payment:quoted` olayı.
- `cart.checkout()` ve `payments.initiate()`: `quoteId` alanı ve isteğe bağlı `{ useCustomerCurrency: true, customerCurrency? }`. Teklif alınır, ödeme `quoteId` ile başlar; süresi dolan / uyuşmayan / bulunamayan teklif bir kez yenilenir; `customer_currency_not_allowed` olursa ödeme mağaza para biriminde başlar (`customerCurrencyDisabled: true`). Yardımcı: `payWithQuote`.
- `crafter.currencies.context()` (`GET /payment/currencies`) ve `crafter.currencies.convert(amounts)` (`POST /payment/currencies/convert`).
- Tipler: `PresentmentQuote`, `PresentmentQuoteRequest`, `PaymentPresentment`, `CustomerCurrencyContext`, `CurrencyConversion`, `CustomerCurrencyOptions`; ödeme yanıtında ve `stripe` oturumunda `presentment`.
- `formatMoney(amount, currency, locale?)` (Intl; `Crafter.utils.formatMoney`).
- `PaymentErrorType`: `payment_currency_mismatch`, `payment_currency_unsupported` (`CrafterPaymentProviderError`), `customer_currency_not_allowed`, `presentment_quote_*`.

### Değişenler
- `cart.checkout()` artık varsayılan `currency: 'TRY'` göndermez; `currency` verilmezse alan gönderilmez ve sunucu mağaza para birimini kullanır. TRY mağazalarda davranış aynıdır; TRY dışı mağazalarda eski varsayılan backend'de 400 `payment_currency_mismatch` döneceği için bu bir düzeltmedir.
- README, wiki ve örneklerde sabit 'TL' yerine `formatMoney` kullanıldı.

## 1.2.0 — 2026-11-20

Ödeme modülü satıcı LLC akışına (CrafterPayments + Stripe Payment Element) uyarlandı (TASK-256). TR akışı (PayTR, Shopier, KuveytTürk, CrafterPayments TR) değişmedi. Kıran değişiklik yok; tüm değişiklikler eklemedir.

### Eklenenler
- `payments.initiate()` ve `cart.checkout()` yanıtlarına `stripe` (`clientSecret`, `publishableKey`, `amount`, `currency`, `tax`), `tax` (vergi kırılımı) ve `paymentId` alanları eklendi. Ham backend alanları korunur.
- `CrafterConfig.stripePublishableKey`: backend publishable key döndürmezse kullanılır.
- `payments.getStatus(paymentId)` ve `payments.waitForResult(paymentId, options?)`: ödeme ve teslimat durumu (`deliveryStatus`: `PENDING` / `DELIVERED` / `NEEDS_REVIEW` / `REFUNDED`, `outcome`).
- `payments.getTopUpPolicy(websiteId?)`: bakiye yükleme limitleri, ödenmiş / bonus bakiye, `showTerms` bayrağı; `topUpMaxAmount()` yardımcısı.
- Tipli hatalar: `CrafterOutOfStockError` (`productIds`), `CrafterBalanceTopUpError` (`reason`, `limits`), `CrafterPaymentProviderError` (`retryable`); `isOutOfStockError`, `isBalanceTopUpError`, `isPaymentProviderError`, `PaymentErrorType`.
- `CrafterError.type`: backend hata kodu (ErrorType).
- `cart.checkout()` ve `payments.initiate()`: `billingCountry`, `billingPostalCode` alanları ve isteğe bağlı `{ legalTerms }` (sözleşme onay başlıkları).
- `payment:status` olayı.
- `npm test` (node:test, sıfır bağımlılık) ve ödeme modülü birim testleri.
- `examples/05-llc-checkout.html`: Stripe test kartıyla LLC checkout örneği.

### Değişenler (uyumlu)
- `cart.checkout()` dönüş tipi `any` yerine `CheckoutPaymentResponse` (index imzalı; mevcut kod derlenmeye devam eder).
- `'cart:checkout'` olay yükü `CheckoutPaymentResponse` olarak tiplendi.
- `CrafterError.fromResponse()` bilinen ödeme hata kodlarında alt sınıf döndürür; `instanceof CrafterError` doğru kalır.

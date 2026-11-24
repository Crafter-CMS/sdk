# Değişiklik Günlüğü

## 1.5.0 — 2026-11-24

Hibrit sepet (#434): storefront içinde sepet sunucudadır. Ziyaretçi giriş yapana kadar storefront'un imzalı çerezinde,
giriş/kayıtta hesaba katılır ve cihazlar arası aynı kalır. `crafter.cart` API'si, `CartState` ve `crafter:cart:updated`
olayı değişmez. Kıran değişiklik yok.

### Eklenenler
- Sayfa bağlamında `routes.cartApi` (ör. `'/cart'`) varsa `crafter.cart` storefront uçlarını kullanır: `GET /cart.js`,
  `POST /cart/add.js`, `/cart/change.js`, `/cart/clear.js`, `/cart/coupon.js` (`credentials: 'same-origin'`,
  `X-Crafter-Locale`). Fiyat gönderilmez; tutarları sunucu güncel üründen hesaplar. Bağlam yoksa (headless) ya da eski
  storefront'ta localStorage deposu eskisi gibi çalışır; `CartModuleDeps.store` verilirse her zaman o kullanılır.
- Eski localStorage sepetinin bir kerelik taşınması: sunucu sepeti boşsa satırlar (id + adet) ve kupon gönderilir,
  ardından `cart` / `crafter_cart_coupon` anahtarları silinir. Ağ hatasında korunur, sonraki sayfada tekrar denenir.
- `CartState.removed[]` ve `CartState.adjusted[]`: satıştan kalkan / tükenen ürünler ve stoğa göre düşürülen adetler
  (sunucu bir kez bildirir).
- Sekmeler arası eşitleme: değişiklikte `crafter_cart_sync` yazılır, diğer sekmeler sepeti yeniden okuyup olay yayar.
- `crafter.cart.isServerBacked`, `CartBackend`, `LocalCartBackend`, `ServerCartBackend`, `ServerCartClient`,
  `CART_SYNC_KEY`, `cartStateFromServer`; `CartAddInput.options` (varyant / seçenek).
- Sepet uç hataları `CrafterError` olarak döner: `cart_product_unavailable` (409), `cart_full` (422),
  `cart_unavailable` (503, ağ hatası dahil).

## 1.4.0 — 2026-11-23

Temalarda SDK zorunlu (#447): storefront her v2 tema sayfasına SDK'nın tarayıcı derlemesini sürümlü adresten ekler ve
sayfa bağlamıyla kendiliğinden başlatır. Temalar sepet, para, dil ve checkout kodunu kendisi yazmaz. Kıran değişiklik yok.

### Eklenenler
- Otomatik başlatma: IIFE derlemesi `window.__CRAFTER_CONTEXT__` görürse `window.Crafter` hazır örnek olur
  (`mode: 'storefront'`, bağlamın `apiBase` / `websiteId` değerleri) ve `document`'a `crafter:ready` yayılır. Bağlam yoksa
  `window.Crafter` eskisi gibi sınıftır. `Crafter.autoInit(window)`, `crafter.context`, `CrafterConfig.context`, `CrafterPageContext`.
- `crafter.cart`: `get()`, `add(product, quantity?)`, `update(id, quantity)`, `remove(id)`, `clear()`, `setCoupon(code)`;
  hepsi `CartState` (`items`, `itemCount`, `subtotal` mağaza para biriminde, `currency`, `coupon`) döner. Depo localStorage
  `cart` / `crafter_cart_coupon` (storefront checkout'uyla aynı biçim). İç `CartStore` arayüzü: hibrit sepet (#434) gelince
  sunucu deposu takılır, API değişmez. Başka sekmedeki değişiklik de olay yayar.
- `crafter.money`: `format(amount, { convert?, currency?, locale? })`, `convert(amount)`, `currency`, `storeCurrency`, `rate`.
  Mağaza tutarı bağlamın kuruyla müşterinin para birimine çevrilir (para biriminin hanesine yuvarlanır), sayfanın dilinde
  biçimlenir; bağlam ya da kur yoksa mağaza para birimi.
- `crafter.localization`: `get()` ve `set({ language?, currency? }, { returnTo?, reload? })` (`POST /localization`, form alanları);
  `crafter:localization:changed` olayı.
- `crafter.sections.render(ids, { url?, swap? })`: `?sections=` ucundan HTML alır, `#crafter-section-<id>` sarmalayıcılarını değiştirir.
- `crafter.checkout({ purpose?, amount?, navigate? })`: `/checkout?purpose=cart` adresine gider (önizleme parametreleri korunur).
- `crafter.dom.on(name, fn)` / `emit`: `document` üzerinde `crafter:<ad>` olayları. Olay yolu: `cart:updated`, `localization:changed`.
- `Crafter.version` / `SDK_VERSION`.

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

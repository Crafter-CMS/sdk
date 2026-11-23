# Değişiklik Günlüğü

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

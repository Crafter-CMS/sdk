# Changelog

## 1.5.3 — 2026-11-27

Security fix for `lexicalToHtml`. No breaking changes for content written with the Crafter editor; upgrading is
strongly recommended for every theme or headless store that renders rich text with the SDK.

### Security
- XSS in link URLs: `link` / `autolink` `url` was only HTML-escaped, so `javascript:`, `data:` and `vbscript:` hrefs
  were rendered and ran script on click. URLs are now checked against an allowlist (`http`, `https`, `mailto`, `tel`,
  relative paths, `?query`, `#anchor`) after trimming, removing whitespace / control characters, decoding HTML entities
  and lowercasing; anything else becomes `href="#"`.
- Image `src` is checked the same way (`http`, `https`, relative); an image with an unsafe source is not rendered.
- Attribute / tag injection: heading `tag` (was interpolated as the tag name), `direction`, list `start`, image
  `width` / `height`, table cell `colSpan` / `rowSpan` and `backgroundColor`, and code `language` were written into
  markup without validation. They are now restricted to `h1`–`h6`, `ltr` / `rtl`, integers, plain CSS colors and simple
  identifiers.
- Inline `style` on text: only typographic properties with plain values are kept; `url()`, `expression()`,
  `position`, CSS escapes and comments are dropped.
- `target` is limited to `_blank`, `_self`, `_parent`, `_top`; `target="_blank"` always gets `rel="noopener noreferrer"`.

## 1.5.2 — 2026-11-26

Release preparation (#255, #258) and a cart sync fix (#434). The latest version on npm is 1.1.0; 1.2.0–1.5.1 were not published to npm and ship together with this version.
No breaking changes.

### Fixed
- Headless (`mode: 'direct'`) default API URL: the `Crafter` constructor filled `apiBase` with `/api/storefront` in every
  mode; `new Crafter({ mode: 'direct', websiteId })` requests went to the relative `/api/storefront/website/...` URL
  instead of `https://api.crafter.net.tr` (which did not work in Node). The default is now chosen by mode
  (`direct` → `https://api.crafter.net.tr`, `storefront` → `/api/storefront`); if `websiteId` is given without a mode,
  `config.mode` also becomes `'direct'`. A given `apiBase` is kept as is.

- Cart sync (#434): the localStorage cart (`cart`) was deleted by the "discard if the server cart is not empty" rule; for a
  logged-in customer with an old, unpaid server cart, the player's new selection was lost. Also, because bulk add
  (`/cart/add.js { items }`) adds quantities, a migration that ran again (two tabs, after a network error) doubled the
  quantities. It now follows the same rule as the storefront checkout: the last synced state is kept in the
  `crafter_cart_synced` record (`{ [product id]: quantity }`); lines added / whose quantity changed after that are set to
  that quantity with `/cart/add.js { items, replace: true }` (not added), a line removed from `cart` is dropped on the
  server too with `/cart/change.js { quantity: 0 }`, and unchanged lines are not sent (changes made on the server / another
  device are kept). Running again does not change the result. The `cart` key is no longer deleted (it stays as the theme
  cart); `crafter_cart_coupon` is still tried once and removed. A 4xx rejection counts that state as synced; on a network /
  server error it is retried on the next page. `replace` requires storefront PR 730 (backend `/cart/merge`
  `strategy: 'latest'` for customers, backend PR 729); an old storefront ignores the field and adds quantities.
- localStorage store: when a synced cart (one with a record) is emptied, the `cart` key becomes `'[]'` instead of being
  deleted, so emptying is reflected in the server cart too.

### Added
- `CART_SYNCED_KEY` (`'crafter_cart_synced'`), `legacyCartDiff(legacy, synced)` and the `LegacyCart` type.

### Docs
- Wiki: `03-store-and-cart.md` syncing the localStorage cart (#434).
- Wiki: `17-theme-runtime.md` (theme v2: `crafter:ready`, server cart, `money`, `localization`, `sections.render`,
  `checkout()`, DOM events). The wiki quick start was updated for the theme v2 rule (the theme does not load the SDK itself).
- Example: `examples/06-theme-v2-section.liquid` (a server-rendered mini cart section, `{% schema %}`, updates with the SDK).
- README: versioned CDN URL 1.5.2 for v1 / external pages.

## 1.5.1 — 2026-11-24

Coupon fix (#476): in the storefront cart a coupon is validated right when it is added, the cart returns the discount and
total, and an old (invalid) coupon no longer gets stuck in the cart. No breaking changes; the new fields are optional.

### Added
- `CartState.discount` (coupon discount), `CartState.total` (`subtotal - discount`, at least 0; both in the store
  currency), `CartState.couponDetails` (`code`, `type`: `'percentage' | 'fixed' | 'free_product'`, `value`,
  `freeProductId`) and `CartState.couponRemoved` (`{ code, reason }`: once, if a stored coupon became invalid and was dropped).
  The fields are passed through `ServerCartResponse` / `cartStateFromServer`; if an old storefront does not send them, the
  discount is 0, the total is the subtotal and the others are null. The localStorage cart cannot validate coupons: discount 0,
  total = subtotal, `couponDetails` null.
- `crafter.cart.removeCoupon()` (same as `setCoupon(null)`).
- `CrafterCouponError` (`minCartValue`), `CouponErrorType`, `COUPON_ERROR_TYPES`, `isCouponError(error)`. Coupon error
  codes: `coupon_not_found`, `coupon_inactive`, `coupon_usage_limit_reached`, `coupon_already_used_by_user`,
  `coupon_not_assigned_to_user`, `coupon_cart_total_below_minimum` (`details.minCartValue`),
  `coupon_invalid_for_product`, `coupon_invalid_type`.
- Types: `CartCouponDetails`, `CartCouponRemovedNote`.

### Fixed
- `crafter.cart.setCoupon(code)`: the storefront `POST /cart/coupon.js` rejects an invalid coupon with 422; the SDK throws
  it as a `CrafterCouponError` (`type`, `message` in the page language, `details`), the cart does not change and
  `crafter:cart:updated` is not emitted.
- Migrating the old localStorage cart: the coupon is moved only if the server accepts it. If the coupon step is rejected
  with a 4xx, the migrated lines are not lost, the coupon is dropped, the `cart` and `crafter_cart_coupon` keys are removed
  and `couponRemoved` is reported in the returned cart. On a network / server error the keys are kept as before.

## 1.5.0 — 2026-11-24

Hybrid cart (#434): inside the storefront the cart lives on the server. Until the visitor logs in it is kept in the
storefront's signed cookie, it is merged into the account on login/sign-up, and it stays the same across devices. The
`crafter.cart` API, `CartState` and the `crafter:cart:updated` event are unchanged. No breaking changes.

### Added
- If the page context has `routes.cartApi` (e.g. `'/cart'`), `crafter.cart` uses the storefront endpoints: `GET /cart.js`,
  `POST /cart/add.js`, `/cart/change.js`, `/cart/clear.js`, `/cart/coupon.js` (`credentials: 'same-origin'`,
  `X-Crafter-Locale`). No price is sent; the server calculates amounts from the current product. Without a context
  (headless) or on an old storefront the localStorage store works as before; if `CartModuleDeps.store` is given, it is always used.
- One-time migration of the old localStorage cart: if the server cart is empty, the lines (id + quantity) and the coupon are
  sent, then the `cart` / `crafter_cart_coupon` keys are removed. Kept on a network error and retried on the next page.
- `CartState.removed[]` and `CartState.adjusted[]`: products taken off sale / sold out and quantities reduced to match stock
  (the server reports them once).
- Cross-tab sync: `crafter_cart_sync` is written on change, other tabs re-read the cart and emit the event.
- `crafter.cart.isServerBacked`, `CartBackend`, `LocalCartBackend`, `ServerCartBackend`, `ServerCartClient`,
  `CART_SYNC_KEY`, `cartStateFromServer`; `CartAddInput.options` (variant / options).
- Cart endpoint errors are returned as `CrafterError`: `cart_product_unavailable` (409), `cart_full` (422),
  `cart_unavailable` (503, including network errors).

## 1.4.0 — 2026-11-23

SDK required in themes (#447): the storefront adds the SDK's browser build from a versioned URL to every v2 theme page and
starts it with the page context by itself. Themes do not write their own cart, money, language or checkout code. No breaking changes.

### Added
- Auto-start: if the IIFE build sees `window.__CRAFTER_CONTEXT__`, `window.Crafter` becomes a ready instance
  (`mode: 'storefront'`, the context's `apiBase` / `websiteId` values) and `crafter:ready` is dispatched on `document`. Without a
  context `window.Crafter` stays the class as before. `Crafter.autoInit(window)`, `crafter.context`, `CrafterConfig.context`, `CrafterPageContext`.
- `crafter.cart`: `get()`, `add(product, quantity?)`, `update(id, quantity)`, `remove(id)`, `clear()`, `setCoupon(code)`;
  all return `CartState` (`items`, `itemCount`, `subtotal` in the store currency, `currency`, `coupon`). The store is localStorage
  `cart` / `crafter_cart_coupon` (same format as the storefront checkout). Internal `CartStore` interface: when the hybrid cart (#434)
  arrives, a server store is plugged in and the API does not change. A change in another tab also emits the event.
- `crafter.money`: `format(amount, { convert?, currency?, locale? })`, `convert(amount)`, `currency`, `storeCurrency`, `rate`.
  The store amount is converted to the customer's currency with the context rate (rounded to the currency's decimals) and
  formatted in the page language; the store currency if there is no context or rate.
- `crafter.localization`: `get()` and `set({ language?, currency? }, { returnTo?, reload? })` (`POST /localization`, form fields);
  the `crafter:localization:changed` event.
- `crafter.sections.render(ids, { url?, swap? })`: fetches HTML from the `?sections=` endpoint and replaces the `#crafter-section-<id>` wrappers.
- `crafter.checkout({ purpose?, amount?, navigate? })`: goes to `/checkout?purpose=cart` (preview parameters are kept).
- `crafter.dom.on(name, fn)` / `emit`: `crafter:<name>` events on `document`. Event bus: `cart:updated`, `localization:changed`.
- `Crafter.version` / `SDK_VERSION`.

## 1.3.0 — 2026-11-23

The server decides the payment currency (#421); price display in the customer currency and payment with a locked rate quote (#424, #426). Paying in the customer currency is optional; existing calls work the same way.

### Added
- `payments.quote({ kind, currency?, amount | cart fields })`: locked rate quote (`POST /payment/quote`); the `payment:quoted` event.
- `cart.checkout()` and `payments.initiate()`: the `quoteId` field and an optional `{ useCustomerCurrency: true, customerCurrency? }`. A quote is fetched and payment starts with `quoteId`; an expired / mismatched / missing quote is renewed once; on `customer_currency_not_allowed` payment starts in the store currency (`customerCurrencyDisabled: true`). Helper: `payWithQuote`.
- `crafter.currencies.context()` (`GET /payment/currencies`) and `crafter.currencies.convert(amounts)` (`POST /payment/currencies/convert`).
- Types: `PresentmentQuote`, `PresentmentQuoteRequest`, `PaymentPresentment`, `CustomerCurrencyContext`, `CurrencyConversion`, `CustomerCurrencyOptions`; `presentment` in the payment response and in the `stripe` session.
- `formatMoney(amount, currency, locale?)` (Intl; `Crafter.utils.formatMoney`).
- `PaymentErrorType`: `payment_currency_mismatch`, `payment_currency_unsupported` (`CrafterPaymentProviderError`), `customer_currency_not_allowed`, `presentment_quote_*`.

### Changed
- `cart.checkout()` no longer sends a default `currency: 'TRY'`; if `currency` is not given the field is not sent and the server uses the store currency. Behavior is the same for TRY stores; for non-TRY stores the old default would return 400 `payment_currency_mismatch` from the backend, so this is a fix.
- README, wiki and examples use `formatMoney` instead of a hard-coded 'TL'.

## 1.2.0 — 2026-11-20

The payment module was adapted to the seller LLC flow (CrafterPayments + Stripe Payment Element) (TASK-256). The TR flow (PayTR, Shopier, KuveytTürk, CrafterPayments TR) is unchanged. No breaking changes; all changes are additive.

### Added
- `stripe` (`clientSecret`, `publishableKey`, `amount`, `currency`, `tax`), `tax` (tax breakdown) and `paymentId` fields were added to the `payments.initiate()` and `cart.checkout()` responses. Raw backend fields are kept.
- `CrafterConfig.stripePublishableKey`: used if the backend does not return a publishable key.
- `payments.getStatus(paymentId)` and `payments.waitForResult(paymentId, options?)`: payment and delivery status (`deliveryStatus`: `PENDING` / `DELIVERED` / `NEEDS_REVIEW` / `REFUNDED`, `outcome`).
- `payments.getTopUpPolicy(websiteId?)`: balance top-up limits, paid / bonus balance, the `showTerms` flag; the `topUpMaxAmount()` helper.
- Typed errors: `CrafterOutOfStockError` (`productIds`), `CrafterBalanceTopUpError` (`reason`, `limits`), `CrafterPaymentProviderError` (`retryable`); `isOutOfStockError`, `isBalanceTopUpError`, `isPaymentProviderError`, `PaymentErrorType`.
- `CrafterError.type`: backend error code (ErrorType).
- `cart.checkout()` and `payments.initiate()`: `billingCountry`, `billingPostalCode` fields and an optional `{ legalTerms }` (terms consent headers).
- The `payment:status` event.
- `npm test` (node:test, zero dependencies) and unit tests for the payment module.
- `examples/05-llc-checkout.html`: an LLC checkout example with a Stripe test card.

### Changed (compatible)
- The `cart.checkout()` return type is `CheckoutPaymentResponse` instead of `any` (index-signed; existing code keeps compiling).
- The `'cart:checkout'` event payload is typed as `CheckoutPaymentResponse`.
- `CrafterError.fromResponse()` returns a subclass for known payment error codes; `instanceof CrafterError` stays true.

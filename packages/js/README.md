# @crafterpayments/js

CrafterPayments tarayıcı paketi: yönlendirme, popup, modal ve gömülü checkout. / CrafterPayments browser SDK: redirect, popup, modal and embedded checkout.

[Türkçe](#türkçe) · [English](#english)

---

## Türkçe

### Kurulum

```bash
npm install @crafterpayments/js
```

CDN (sürümlü, değişmez dosya + SRI):

<!-- sri:start -->
```html
<script src="https://js.crafterpayments.com/v1/crafterpayments-0.1.0.umd.min.js"
        integrity="sha384-jI98pUMUoZoFyKSrFMS/bHc9QqfWCnyGH0j+4Rxnr8ohUgBEQe7qSxhEeRVCP7xQ"
        crossorigin="anonymous"></script>
```

| Version | File | SRI |
|---|---|---|
| 0.1.0 | `crafterpayments-0.1.0.umd.min.js` | `sha384-jI98pUMUoZoFyKSrFMS/bHc9QqfWCnyGH0j+4Rxnr8ohUgBEQe7qSxhEeRVCP7xQ` |
<!-- sri:end -->

Script etiketiyle yüklendiğinde paket `window.CrafterPayments` olarak gelir. `https://js.crafterpayments.com/v1/crafter.js` her zaman v1 kanalındaki en son sürümü verir; içeriği değiştiği için SRI ile kullanılamaz. SRI istiyorsanız sürümlü dosyayı kullanın.

### Temel kural: gizli anahtar asla tarayıcıda olmaz

- Checkout oturumu **her zaman sizin sunucunuzda** gizli anahtarla (`cp_sk_…`) açılır (`POST /v1/checkout/sessions`).
- Tarayıcıya yalnızca herkese açık anahtar (`cp_pk_…`), oturum kimliği ve gerekiyorsa `clientSecret` verilir.
- Bu pakete `cp_sk_…` (ya da `cp_rk_…`) verilirse `secret_key_in_browser` hatası fırlatılır. Böyle bir anahtar tarayıcıya ulaştıysa panelden hemen yenileyin.
- Tarayıcı olayları (`complete` vb.) **ürün teslimi için kanıt değildir**. Teslimatı webhook'a (`checkout.completed`) ya da sunucunuzdaki `GET /v1/checkout/sessions/:id` isteğine bağlayın.

### Başlatma

```js
import { loadCrafterPayments } from '@crafterpayments/js';

const crafter = await loadCrafterPayments('cp_pk_test_…');
// Sunucuda (SSR) null döner.
// Geliştirme ortamı: loadCrafterPayments(pk, { environment: 'development' })
```

### 1) Yönlendirme

```js
await crafter.redirectToCheckout({ sessionId: 'cs_test_…' });
// ya da oturumun url alanı: { url: 'https://checkout.crafterpayments.com/c/cs_test_…' }
```

Yalnızca `checkout.crafterpayments.com` üzerindeki oturum adresleri kabul edilir.

### 2) Popup (masaüstü varsayılanı)

```js
button.addEventListener('click', () => {
  const checkout = crafter.open({ sessionId, clientSecret }); // tıklamanın içinde çağırın
  checkout.on('complete', (r) => showThanks(r.orderId));
  checkout.on('cancel', () => {});
  checkout.on('error', ({ error }) => console.error(error.code));
});
```

- Checkout sayfası güvenlik gereği `Cross-Origin-Opener-Policy: same-origin` gönderir; bu yüzden popup ile açan sayfa arasında `postMessage` yoktur ve `popup.closed` güvenilir değildir.
- Sonuç iki yoldan gelir: (1) `successUrl` / `cancelUrl` sayfanız **aynı origin'de** `handleReturn()` çağırır ve sonucu `BroadcastChannel("crafter-checkout")` ile açan sekmeye iletir; (2) yedek olarak `GET /v1/checkout/sessions/:id/public` 2 saniyede bir yoklanır (en çok 10 dk; `clientSecret` gerekir).
- Popup engellenirse aynı sekmede yönlendirmeye düşülür (`onPopupBlocked: 'error'` ile bunun yerine `error` olayı).
- Mobilde (genişlik < 800 px, düşük yükseklik ya da dokunmatik dar ekran) `mode: 'auto'` yönlendirme kullanır; `mobile: 'new_tab' | 'modal'` ile değiştirilebilir.

Dönüş sayfanızda (`successUrl` / `cancelUrl`):

```js
import { handleReturn } from '@crafterpayments/js';
const result = await handleReturn(); // { sessionId, status, signed, openedByCheckout } | null
// Popup ise sekme kendini kapatır. Durumu yine sunucunuzda doğrulayın.
```

### 3) Oturumu tıklamadan sonra açmak (`createSession`)

```js
button.addEventListener('click', () => {
  crafter.open({
    mode: 'modal', // ya da 'popup'
    createSession: async () => {
      const res = await fetch('/api/checkout', { method: 'POST' }); // sizin sunucunuz
      return res.json(); // { sessionId, clientSecret }
    },
  });
});
```

Pencere ya da modal tıklama anında açılır (engelleyiciye takılmaz) ve yükleniyor gösterir; oturum gelince checkout yüklenir.

### 4) Gömülü checkout (Pro ve üzeri paketler)

Oturum `uiMode: "embedded"` ile açılmalı ve sayfanızın origin'i mağazanın **izinli adresler** listesinde olmalıdır (iframe için `frame-ancestors` bu listeden üretilir). Paket izni sunucuda kontrol edilir.

```js
const checkout = crafter.mountCheckout('#checkout', {
  clientSecret, // sessionId bundan çıkarılır
  appearance: {
    theme: 'dark',
    variables: { colorPrimary: '#7c3aed', borderRadius: '10px', fontFamily: 'Inter, sans-serif' },
  },
});
checkout.on('complete', (r) => {/* r.verified: /public ile doğrulandı mı */});
// Kaldırmak için: checkout.destroy()
```

Modal olarak: `crafter.open({ mode: 'modal', clientSecret })`. Seçenekler: `closeOnEscape` (varsayılan true), `closeOnBackdrop` (varsayılan false), `autoCloseOnComplete` (varsayılan true).

Güvenlik:
- `clientSecret` iframe adresine **yazılmaz**; iframe `ready` dedikten sonra yalnızca checkout origin'ine `postMessage` ile verilir (adres log'larına, `Referer`'a, geçmişe düşmez).
- Gelen her mesajda `event.origin` checkout origin'i ve `event.source` bu iframe olmalıdır; değilse yok sayılır.
- Kart bilgisi yalnızca ödeme sağlayıcısının kendi iframe'inde girilir. Ne sizin sayfanız ne de Crafter kodu kart verisine erişir.

### Görünüm (`appearance`)

Kart alanları (kart numarası, son kullanma, CVC) checkout sayfasında **ayrık alanlar** olarak bu token'larla çizilir. Serbest CSS yoktur; geçersiz değerler atılır ve konsola uyarı yazılır.

| Alan | Değer |
|---|---|
| `theme` | `light` · `dark` · `auto` |
| `variables.colorPrimary`, `colorBackground`, `colorText`, `colorTextSecondary`, `colorTextPlaceholder`, `colorDanger`, `colorBorder`, `colorFocusRing` | `#rgb[a]`, `#rrggbb[aa]`, `rgb()/rgba()`, `hsl()/hsla()`, `transparent` |
| `variables.fontFamily` | harf, rakam, boşluk, virgül, tırnak, `-`, `_` |
| `variables.fontSizeBase`, `borderRadius`, `borderWidth`, `spacingUnit` | `0` ya da `px` / `rem` / `em` |
| `variables.fontWeightNormal` | `normal`, `bold`, `100`–`900` |
| `showCardBrandIcon` | `true` / `false` |

Logo, mağaza adı ve diğer marka ayarları mağazanın checkout ayarlarından gelir.

### Olaylar

| Olay | Yük | Ne zaman |
|---|---|---|
| `ready` | `{ sessionId }` | Checkout yüklendi / pencere açıldı |
| `complete` | `{ sessionId, status, orderId?, verified }` | Ödeme tamamlandı |
| `cancel` | `{ sessionId, status: 'canceled', verified }` | Alıcı vazgeçti ya da oturum iptal edildi. "Geri dön" oturumu sunucuda iptal etmez. |
| `expired` | `{ sessionId, status: 'expired', verified }` | Oturumun süresi doldu |
| `payment_failed` | `{ sessionId, code? }` | Ödeme reddedildi; alıcı tekrar deneyebilir |
| `redirect_required` | `{ sessionId, url }` | iframe'de çalışmayan ödeme yöntemi; SDK ayrı pencere açar |
| `close` | `{ sessionId? }` | Modal/popup ödeme olmadan kapatıldı (`close()`) |
| `error` | `{ sessionId?, error }` | `error.code`: `embed_load_timeout`, `popup_blocked`, `api_error`, `result_timeout`, … |

`checkout.result` sonucu bir Promise olarak verir (`close()` ile `null`, hata ile reddedilir).

`verified: true`, durumun `GET /v1/checkout/sessions/:id/public` uç noktasından okunduğunu gösterir. Yine de teslimat için kanıt değildir.

### Gömülü sayfa mesaj protokolü (v1)

Checkout sayfası (`/embed/{id}`) için sözleşme. Tüm mesajlar `{ source, v: 1, type, sessionId, … }` biçimindedir.

| Yön | `source` | `type` | Alanlar |
|---|---|---|---|
| sayfa → SDK | `crafterpayments-checkout` | `ready`, `loading`, `resize`, `complete`, `cancel`, `expired`, `payment_failed`, `redirect_required`, `error` | `height` (resize), `status` (complete), `code` (payment_failed, error), `message` (error), `url` (redirect_required, https) |
| SDK → sayfa | `crafterpayments-js` | `init`, `destroy` | init: `clientSecret`, `publishableKey`, `appearance`, `locale`, `sdkVersion` |

- iframe adresi: `https://checkout.crafterpayments.com/embed/{sessionId}?locale=tr#v=1&origin=<ebeveyn origin>`. Hash sunucuya gitmez; sayfa `ready` mesajını bu origin'e gönderir.
- iframe öznitelikleri: `allow="payment"`, `sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"`.
- Popup dönüş kanalı: `BroadcastChannel("crafter-checkout")`, mesajlar `{ source: 'crafterpayments-js', v: 1, type: 'return' | 'ack', sessionId, status? }`.

### Boyut bütçesi

CDN dosyası (`crafterpayments-<sürüm>.umd.min.js`) en çok 22 KB (min) ve 8 KB (gzip) olabilir; `npm run size` ve testler bunu denetler.

### Geliştirme

```bash
npm install
npm test          # derleme + jsdom testleri + boyut + SRI kontrolü
npm run sri       # README'deki SRI hash'ini günceller (sürüm değişince)
```

Tarayıcı desteği: ES2020 (Chrome/Edge 80+, Firefox 74+, Safari 14+). `BroadcastChannel` yoksa popup sonucu yalnızca yoklamayla gelir.

---

## English

### Install

```bash
npm install @crafterpayments/js
```

CDN (versioned, immutable file + SRI):

<!-- sri:start -->
```html
<script src="https://js.crafterpayments.com/v1/crafterpayments-0.1.0.umd.min.js"
        integrity="sha384-jI98pUMUoZoFyKSrFMS/bHc9QqfWCnyGH0j+4Rxnr8ohUgBEQe7qSxhEeRVCP7xQ"
        crossorigin="anonymous"></script>
```

| Version | File | SRI |
|---|---|---|
| 0.1.0 | `crafterpayments-0.1.0.umd.min.js` | `sha384-jI98pUMUoZoFyKSrFMS/bHc9QqfWCnyGH0j+4Rxnr8ohUgBEQe7qSxhEeRVCP7xQ` |
<!-- sri:end -->

Loaded with a script tag, the package is exposed as `window.CrafterPayments`. `https://js.crafterpayments.com/v1/crafter.js` always serves the latest build on the v1 channel; its content changes, so it cannot be used with SRI. Use the versioned file when you need SRI.

### Ground rule: secret keys never reach the browser

- Checkout sessions are **always created on your server** with a secret key (`cp_sk_…`) via `POST /v1/checkout/sessions`.
- The browser only gets the publishable key (`cp_pk_…`), the session id and, when needed, the `clientSecret`.
- Passing `cp_sk_…` (or `cp_rk_…`) to this package throws `secret_key_in_browser`. If such a key reached browsers, roll it in the dashboard right away.
- Browser events (`complete`, …) are **not proof for fulfilment**. Deliver on the `checkout.completed` webhook or a server-side `GET /v1/checkout/sessions/:id`.

### Initialise

```js
import { loadCrafterPayments } from '@crafterpayments/js';

const crafter = await loadCrafterPayments('cp_pk_test_…');
// Returns null on the server (SSR).
// Development: loadCrafterPayments(pk, { environment: 'development' })
```

### 1) Redirect

```js
await crafter.redirectToCheckout({ sessionId: 'cs_test_…' });
// or the session url: { url: 'https://checkout.crafterpayments.com/c/cs_test_…' }
```

Only session URLs on `checkout.crafterpayments.com` are accepted.

### 2) Popup (desktop default)

```js
button.addEventListener('click', () => {
  const checkout = crafter.open({ sessionId, clientSecret }); // call inside the click handler
  checkout.on('complete', (r) => showThanks(r.orderId));
  checkout.on('cancel', () => {});
  checkout.on('error', ({ error }) => console.error(error.code));
});
```

- The checkout page sends `Cross-Origin-Opener-Policy: same-origin`, so there is no `postMessage` between the popup and your page, and `popup.closed` is unreliable.
- The result arrives two ways: (1) your `successUrl` / `cancelUrl` page, **on your own origin**, calls `handleReturn()`, which relays the result over `BroadcastChannel("crafter-checkout")`; (2) as a fallback, `GET /v1/checkout/sessions/:id/public` is polled every 2 s (up to 10 min; needs `clientSecret`).
- If the popup is blocked, the SDK falls back to a same-tab redirect (`onPopupBlocked: 'error'` emits `error` instead).
- On mobile (width < 800 px, short viewport or narrow touch screen) `mode: 'auto'` redirects; override with `mobile: 'new_tab' | 'modal'`.

On your return page (`successUrl` / `cancelUrl`):

```js
import { handleReturn } from '@crafterpayments/js';
const result = await handleReturn(); // { sessionId, status, signed, openedByCheckout } | null
// In a popup the tab closes itself. Still verify the status on your server.
```

### 3) Create the session after the click (`createSession`)

```js
button.addEventListener('click', () => {
  crafter.open({
    mode: 'modal', // or 'popup'
    createSession: async () => {
      const res = await fetch('/api/checkout', { method: 'POST' }); // your server
      return res.json(); // { sessionId, clientSecret }
    },
  });
});
```

The window or modal opens on the click (no popup blocker) with a loading state; checkout loads once the session arrives.

### 4) Embedded checkout (Pro plans and above)

Create the session with `uiMode: "embedded"`, and add your page origin to the store's **allowed origins** (the iframe `frame-ancestors` comes from that list). The plan is enforced by the server.

```js
const checkout = crafter.mountCheckout('#checkout', {
  clientSecret, // sessionId is derived from it
  appearance: {
    theme: 'dark',
    variables: { colorPrimary: '#7c3aed', borderRadius: '10px', fontFamily: 'Inter, sans-serif' },
  },
});
checkout.on('complete', (r) => {/* r.verified: confirmed via /public */});
// Remove with checkout.destroy()
```

As a modal: `crafter.open({ mode: 'modal', clientSecret })`. Options: `closeOnEscape` (default true), `closeOnBackdrop` (default false), `autoCloseOnComplete` (default true).

Security:
- The `clientSecret` is **never put in the iframe URL**; it is sent with `postMessage`, only to the checkout origin, after the iframe says `ready` (it stays out of URL logs, `Referer` and history).
- Every incoming message must come from the checkout origin (`event.origin`) and from this iframe (`event.source`); anything else is ignored.
- Card details are typed only into the payment provider's own iframe. Neither your page nor Crafter code can read card data.

### Appearance

The card fields (number, expiry, CVC) are rendered on the checkout page as **separate fields** using these tokens. There is no free-form CSS; invalid values are dropped with a console warning.

| Field | Value |
|---|---|
| `theme` | `light` · `dark` · `auto` |
| `variables.colorPrimary`, `colorBackground`, `colorText`, `colorTextSecondary`, `colorTextPlaceholder`, `colorDanger`, `colorBorder`, `colorFocusRing` | `#rgb[a]`, `#rrggbb[aa]`, `rgb()/rgba()`, `hsl()/hsla()`, `transparent` |
| `variables.fontFamily` | letters, digits, spaces, commas, quotes, `-`, `_` |
| `variables.fontSizeBase`, `borderRadius`, `borderWidth`, `spacingUnit` | `0` or `px` / `rem` / `em` |
| `variables.fontWeightNormal` | `normal`, `bold`, `100`–`900` |
| `showCardBrandIcon` | `true` / `false` |

Logo, store name and other branding come from the store's checkout settings.

### Events

| Event | Payload | When |
|---|---|---|
| `ready` | `{ sessionId }` | Checkout loaded / window opened |
| `complete` | `{ sessionId, status, orderId?, verified }` | Payment completed |
| `cancel` | `{ sessionId, status: 'canceled', verified }` | Buyer went back or the session was canceled. "Go back" does not cancel the session on the server. |
| `expired` | `{ sessionId, status: 'expired', verified }` | Session expired |
| `payment_failed` | `{ sessionId, code? }` | Payment declined; the buyer can retry |
| `redirect_required` | `{ sessionId, url }` | A payment method that cannot run in the iframe; the SDK opens a separate window |
| `close` | `{ sessionId? }` | Modal/popup closed without paying (`close()`) |
| `error` | `{ sessionId?, error }` | `error.code`: `embed_load_timeout`, `popup_blocked`, `api_error`, `result_timeout`, … |

`checkout.result` is a Promise of the outcome (`null` after `close()`, rejected on error).

`verified: true` means the status was read from `GET /v1/checkout/sessions/:id/public`. It is still not proof for fulfilment.

### Embedded page message protocol (v1)

Contract for the checkout page (`/embed/{id}`). Every message is `{ source, v: 1, type, sessionId, … }`.

| Direction | `source` | `type` | Fields |
|---|---|---|---|
| page → SDK | `crafterpayments-checkout` | `ready`, `loading`, `resize`, `complete`, `cancel`, `expired`, `payment_failed`, `redirect_required`, `error` | `height` (resize), `status` (complete), `code` (payment_failed, error), `message` (error), `url` (redirect_required, https) |
| SDK → page | `crafterpayments-js` | `init`, `destroy` | init: `clientSecret`, `publishableKey`, `appearance`, `locale`, `sdkVersion` |

- iframe URL: `https://checkout.crafterpayments.com/embed/{sessionId}?locale=en#v=1&origin=<parent origin>`. The hash never reaches the server; the page posts `ready` to that origin.
- iframe attributes: `allow="payment"`, `sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"`.
- Popup return channel: `BroadcastChannel("crafter-checkout")`, messages `{ source: 'crafterpayments-js', v: 1, type: 'return' | 'ack', sessionId, status? }`.

### Size budget

The CDN file (`crafterpayments-<version>.umd.min.js`) must stay within 22 KB minified and 8 KB gzip; `npm run size` and the tests enforce it.

### Development

```bash
npm install
npm test          # build + jsdom tests + size + SRI check
npm run sri       # refresh the SRI hash in this README (after a version bump)
```

Browser support: ES2020 (Chrome/Edge 80+, Firefox 74+, Safari 14+). Without `BroadcastChannel`, the popup result comes from polling only.

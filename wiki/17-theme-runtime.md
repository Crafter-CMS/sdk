# 17. Theme v2 runtime (`window.Crafter`)

On theme v2 pages the storefront **adds** the page context (`window.__CRAFTER_CONTEXT__`: store,
language, currency, rate, endpoint URLs) and the SDK's versioned browser build (`defer`) **itself** with `{{ content_for_header }}`. When the SDK
sees this context, `window.Crafter` becomes a ready instance and `crafter:ready` is dispatched on `document`.

> **Rule:** The theme does not load the SDK itself or start it with `new Crafter()`; it does not write its own cart, money formatting, language switching or checkout
> code. `crafter theme check` enforces this (`sdk_cart_storage`, `checkout_link_purpose`,
> `checkout_locale_url`, `checkout_without_sdk`, `money_reimplemented`). The theme runtime is SDK **1.5** and later.

Detailed guide: [docs.crafter.net.tr → Crafter SDK](https://docs.crafter.net.tr/tr/developers/sdk).

---

## Waiting for the SDK

The SDK is loaded with `defer`; code that may run earlier waits for `crafter:ready`:

```js
// assets/theme.js
function onCrafterReady(fn) {
  if (window.Crafter && typeof window.Crafter.cart === 'object') fn(window.Crafter);
  else document.addEventListener('crafter:ready', () => fn(window.Crafter), { once: true });
}
```

## Cart (`Crafter.cart`)

On the storefront the cart lives on the server (a signed cookie for visitors, the account once logged in); the server always calculates prices.

| Method | Description |
| :--- | :--- |
| `get()` | `CartState`: `items`, `itemCount`, `subtotal`, `discount`, `total`, `currency`, `coupon` |
| `add({ id }, quantity)` | Adds a product (`adjusted[]` if only the available stock was added) |
| `update(id, quantity)` | Changes the quantity (0 removes) |
| `remove(id)`, `clear()` | Removes the line, empties the cart |
| `setCoupon(code)`, `removeCoupon()` | Validates / removes the coupon on the server; `CrafterCouponError` if invalid |

```js
onCrafterReady((Crafter) => {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-add-to-cart]');
    if (!button) return;
    button.disabled = true;
    try {
      await Crafter.cart.add({ id: button.dataset.productId }, 1);
    } catch (error) {
      if (error.isCrafterError) alert(error.message); // in the page language
    } finally {
      button.disabled = false;
    }
  });
});
```

The first view needs no JS: the Liquid `cart` object (`cart.items`, `cart.item_count`, `cart.total_price`) renders the page
on the server. After a change, re-render the same section with `Crafter.sections.render` (below).

## Money (`Crafter.money`)

```js
Crafter.money.format(cart.total);                  // the customer's currency, the page language (same as Liquid `money`)
Crafter.money.format(balance, { convert: false }); // in the store currency
```

Do not format money with `Intl.NumberFormat` in JS (`money_reimplemented` warning).

## Language and currency (`Crafter.localization`)

```js
Crafter.localization.get();                       // { language, currency, languages, currencies }
await Crafter.localization.set({ currency: 'EUR' });
await Crafter.localization.set({ language: 'en' }, { returnTo: '/store' });
```

`set` uses the storefront's `POST /localization` endpoint and takes the page to the URL in the chosen language
(with `{ reload: false }` it does not navigate, it only emits `crafter:localization:changed`).

## Re-rendering sections (`Crafter.sections`)

`Crafter.sections.render(ids, { url?, swap? })` requests the `?sections=a,b` version of the page and replaces the
`#crafter-section-<id>` wrappers on the page with the new ones. At most 10 sections per request; a section in a section group
is requested as `<group>:<id>` (`'header-group:header'`).

```js
// When the cart changes, refresh the cart section and the counter in the header
document.addEventListener('crafter:cart:updated', () => {
  Crafter.sections.render(['main-cart', 'header-group:header']).catch(() => location.reload());
});

// Filter form: render the section with the new query without reloading the page
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = `${location.pathname}?${new URLSearchParams(new FormData(form))}`;
  await Crafter.sections.render([form.dataset.sectionFilter], { url });
  history.replaceState(null, '', url);
});
```

`{ swap: false }` does not touch the DOM, it only returns `{ [id]: html | null }`.

## Checkout

```js
Crafter.checkout();                                         // /checkout?purpose=cart
Crafter.checkout({ purpose: 'balance', amount: 100 });      // balance top-up
const url = Crafter.checkout({ navigate: false });          // URL only
```

No-JS link in Liquid: `<a href="/checkout?purpose=cart">`. The checkout URL has no language prefix; do not apply
`locale_url`. Preview parameters (`preview_token`, etc.) are kept by `Crafter.checkout()`.

## Events

All are `CustomEvent`s on `document`, with the data in `event.detail`:

| Event | When |
| :--- | :--- |
| `crafter:ready` | The SDK is ready (`detail`: the instance) |
| `crafter:cart:updated` | The cart changed (also in another tab); `detail.itemCount` |
| `crafter:localization:changed` | The language or currency changed; `detail.language`, `detail.currency` |
| `crafter:section:load`, `crafter:section:unload` | The editor re-rendered a section (emitted by the storefront); `detail.sectionId` |

Re-bind the section's JS with `crafter:section:load`; when the editor replaces the section, the old listeners are gone.

## Full example

Section file, schema and SDK usage together: [`examples/06-theme-v2-section.liquid`](../examples/06-theme-v2-section.liquid).

## Security

The SDK runs in the browser; everything you put in it is visible to visitors. An admin token, a developer token
(`crft_pat_…`), a server token (`cct_…`) or any API secret key must never be written to theme code or `assets/` files
(`crafter theme check`: `secret_embedded`).

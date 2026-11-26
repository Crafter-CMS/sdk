# @crafter-cms/sdk

[![npm version](https://img.shields.io/npm/v/@crafter-cms/sdk.svg?style=flat-square)](https://www.npmjs.com/package/@crafter-cms/sdk)
[![Bundle Size](https://img.shields.io/bundlephobia/min/@crafter-cms/sdk?style=flat-square)](https://bundlephobia.com/package/@crafter-cms/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

The official JavaScript / TypeScript client library for Crafter Storefront and headless web applications.

Built from scratch to remove hardcoded `fetch()` calls from Crafter Liquid themes, abstract API versioning (`v2` vs plain routes), manage the dual operating mode (Liquid Storefront Proxy vs external direct backend) automatically and deliver a reactive UI experience.

---

## 📖 Full Documentation (Wiki)

See the [**📚 Wiki Guides**](./wiki/README.md) for each module's detailed parameters, return models and theme coding examples:

* 🔐 [**01. Authentication (`crafter.auth`)**](./wiki/01-auth.md) — Sign-in, sign-up, in-game (/web) quick login, 2FA, OTP, password reset, Discord
* 👤 [**02. Users & Profile (`crafter.users`)**](./wiki/02-users.md) — Profile, lightweight balance, transfer, wall, 2FA settings, Discord link
* 🛒 [**03. Store & Cart (`crafter.store` & `cart`)**](./wiki/03-store-and-cart.md) — Categories, products, cart purchase, bulk discount
* 📦 [**04. Player Chest (`crafter.chest`)**](./wiki/04-chest.md) — Web inventory, using items and gifting them to friends
* 🎫 [**05. Support Tickets (`crafter.tickets`)**](./wiki/05-tickets.md) — Opening tickets, messaging, departments, closing/reopening tickets
* 📰 [**06. Posts & Pages (`posts` & `pages`)**](./wiki/06-posts-and-pages.md) — News, likes, user likes, CMS pages
* 💳 [**07. Payments (`crafter.payments`)**](./wiki/07-payments.md) — PayTR, Shopier, CrafterPayments, starting and checking payments
* 🎟️ [**08. Coupons & Codes (`coupons` & `redeemCode`)**](./wiki/08-coupons-and-redeem.md) — Cart coupon check, promotions and gift cards
* 📊 [**09. Statistics & Punishments (`statistics` & `punishments`)**](./wiki/09-statistics-and-punishments.md) — Live feed, leaderboard, ban/mute list and search
* 🌐 [**10. Servers & Voting (`servers` & `vote`)**](./wiki/10-servers-and-vote.md) — Server ping/player count, vote sites and cooldowns
* 📜 [**11. Legal Documents & Reports (`legal` & `reports`)**](./wiki/11-legal-and-reports.md) — Rules, privacy policy, rule violation reports
* 💬 [**12. Forum & Help Center (`forum` & `helpcenter`)**](./wiki/12-forum-and-helpcenter.md) — Forum topics, messages, likes, knowledge base articles
* 📝 [**13. Staff Application Forms (`staffForms`)**](./wiki/13-staff-forms.md) — Dynamic question forms and submitting applications
* 🔍 [**14. Search, SEO, LuckPerms & Site Info**](./wiki/14-search-seo-luckperms-website.md) — Live navbar search, SEO & sitemap, in-game rank
* ⚡ [**15. Event Bus & Error Handling**](./wiki/15-events-and-errors.md) — Reactive events (`crafter.on`), `CrafterError` and dual mode
* ✍️ [**16. Lexical Rich Text Engine (`crafter.utils`)**](./wiki/16-lexical-rich-text.md) — AST -> HTML/text converter and the counterpart of the Storefront Liquid filter
* 🧩 [**17. Theme v2 runtime (`window.Crafter`)**](./wiki/17-theme-runtime.md) — `crafter:ready`, server cart, money, language, `sections.render`, checkout and a sample section

---

## 🌟 Working Example Projects ([`examples/`](./examples/README.md))

Ready-made scenarios for trying out the SDK's practical integrations:
* [**`01-liquid-theme-demo.html`**](./examples/01-liquid-theme-demo.html) — Demo of live search, server ping/online players, buying a product with balance and `/web` quick login in a Storefront Liquid theme.
* [**`02-headless-node.ts`**](./examples/02-headless-node.ts) — Direct backend API calls in Node.js / headless mode, LuckPerms and the SEO sitemap.
* [**`03-lexical-showcase.html`**](./examples/03-lexical-showcase.html) — In-browser Lexical AST rendering and an HTML ➔ Lexical AST two-way test sandbox.
* [**`04-tickets-and-forum.ts`**](./examples/04-tickets-and-forum.ts) — Support ticket and forum messaging workflows (automatic Lexical conversion).
* [**`05-llc-checkout.html`**](./examples/05-llc-checkout.html) — Seller LLC cart payment (CrafterPayments), tax breakdown and delivery status.
* [**`06-theme-v2-section.liquid`**](./examples/06-theme-v2-section.liquid) — Theme v2 section: a server-rendered mini cart, `Crafter.cart`, `Crafter.sections.render`, a coupon error and a checkout link.

---

## 🚀 Key Features

- **Zero dependencies:** Needs no external npm packages. The minified IIFE is only ~18 KB (`dist/crafter.min.js`).
- **Direct Storefront Proxy support:** Works through `/api/storefront` by default. The theme needs no `websiteId` or domain configuration; the store is resolved from the hostname.
- **Clean versioning:** Only endpoints that exist solely as `v2` are called as `/v2/...`; all other endpoints are plain (`v1` is never used).
- **Fits both worlds:**
  - In Liquid themes via CDN / script tag: `window.Crafter`
  - In NPM / ESM modern bundler projects: `import { Crafter } from '@crafter-cms/sdk'`
- **Reactive event system:** Listen to balance transfers, cart purchases, chest usage and session changes in real time (`crafter.on('cart:purchased', ...)`).
- **Full type safety:** TypeScript definitions 100% aligned with the backend NestJS DTOs (`dist/index.d.ts`).
- **Smart automation:**
  - Detects the `?token=` parameter in the URL automatically for password resets.
  - One-click passwordless login with `crafter.auth.inGameAuth()` using the security hash from the in-game `/web` command.

---

## 📦 Installation & Usage

### 1. In Liquid Themes (v2: SDK required, loaded automatically)

On theme v2 pages the storefront **adds the SDK itself** with `{{ content_for_header }}` (versioned URL, `defer`) and
initializes it with `window.__CRAFTER_CONTEXT__` (store, language, currency, rate). The theme does not write `<script src>` or
`new Crafter()`; `window.Crafter` is a ready instance and `crafter:ready` is dispatched on `document`. Themes do not write their own
cart, money, language or checkout code (`crafter theme check` enforces this):

```js
// Cart (#434): on the storefront it lives on the server (a signed cookie for visitors, merged into the account on login); the server calculates the price
await Crafter.cart.add({ id }, 1);   // update(id, qty), remove(id), get(), clear()
document.addEventListener('crafter:cart:updated', (e) => (badge.textContent = e.detail.itemCount));

// Money: store amount → the customer's currency, in the page language (same as the Liquid `money` filter)
Crafter.money.format(cart.subtotal);           // '€18,40'
Crafter.money.format(balance, { convert: false });

// Language / currency: POST /localization, the page goes to the URL in the chosen language
await Crafter.localization.set({ currency: 'EUR' });   // get() → { language, currency, languages, currencies }
document.addEventListener('crafter:localization:changed', (e) => e.detail.currency);

// Re-render sections (?sections=), go to checkout (/checkout?purpose=cart)
await Crafter.sections.render(['main-cart', 'header-group:header']);
Crafter.checkout();
```

Cart and SDK events: `crafter:ready`, `crafter:cart:updated`, `crafter:localization:changed` (all on `document`,
with `event.detail`). v1 themes and external pages load the SDK themselves, as before:

```html
<script src="https://unpkg.com/@crafter-cms/sdk@1.5.2/dist/crafter.min.js"></script>
<script>window.crafter = new Crafter();</script>
```

> **In Liquid themes:** Requests go to the same-origin `/api/storefront` proxy. The proxy resolves the store tenant from the hostname automatically and securely forwards the HttpOnly token cookies to the backend.

---

### 2. In External / Headless Apps (Direct Backend Mode)

To connect directly to the backend from mobile apps, external Node/React/Vue projects or standalone panels, just set `websiteId`:

```bash
npm install @crafter-cms/sdk
```

```typescript
import { Crafter } from '@crafter-cms/sdk';

const crafter = new Crafter({
  mode: 'direct',
  websiteId: 'website-uuid-degeriniz',
  // apiBase defaults to 'https://api.crafter.net.tr'
  // token: 'jwt-access-token' // optional
});
```

---

## 🛠️ Modules & API Reference (25 Modules)

| Module | Base Proxy Path | Methods & Description |
| :--- | :--- | :--- |
| **`crafter.auth`** | `/v2/auth` *(v2)* | `signin`, `signup`, `logout`, `inGameAuth`, `refreshToken`, `forgotPassword`, `resetPassword`, `getResetTokenFromUrl`, `verifyEmail`, `resendEmail`, `validate2Fa`, `send2FaEmailCode`, `send2FaDiscordCode`, `updateTempEmail`, `getDiscordAuthUrl` |
| **`crafter.users`** | `/v2/users` & `/users` | `getProfile('me')`, `getBalance('me')` *(lightweight balance)*, `getByUsername('@user')`, `updateProfile(dto)`, `sendBalance({ targetUserId, amount })`, `changePassword(dto)`<br>**Wall:** `getWall(userId)`, `postWallMessage(userId, content)`, `replyWallMessage(userId, msgId, content)`<br>**2FA:** `get2FaStatus()`, `setupAuthenticator()`, `enableAuthenticator(code)`, `sendEmail2FaCode()`, `enableEmail2Fa(code)`, `sendDiscord2FaCode()`, `enableDiscord2Fa(code)`, `disable2Fa(dto)`, `setPrimary2FaMethod(method)`, `regenerateRecoveryCodes()`<br>**Discord:** `getDiscordStatus()`, `unlinkDiscord()` |
| **`crafter.search`** | `/metadata-search` | `metadataSearch(query, limit = 5)` *(live global search for the navbar: users, products, posts, pages)* |
| **`crafter.seo`** | `/v2/seo` *(v2)* | `getConfig()` *(site-wide meta tag templates, OG image, favicon)*, `getSitemapData()` *(dynamic sitemap URL array)* |
| **`crafter.luckperms`** | `/v2/modules/luckperms` *(v2)* | `getPlayer(usernameOrUuid)` *(the player's in-game primary rank, permissions and inherited groups)*, `getGroups()` |
| **`crafter.website`** | `/` *(root / site info)* | `getInfo()` *(site name, currency, logo, favicon and active add-on modules: discord_bot, authme, etc.)* |
| **`crafter.store`** | `/categories`, `/products`, `/config/marketplace` | `getCategories()`, `getCategory(id)`, `getProducts()`, `getProduct(id)`, `getProductsByCategory(catId)`, `getConfig()` *(bulk discount settings for the cart)* |
| **`crafter.cart` / `marketplace`** | `/marketplace` | **Cart:** `get()`, `add(product, qty?)`, `update(id, qty)`, `remove(id)`, `clear()`, `setCoupon(code)`, `removeCoupon()` *(`/cart.js` endpoints on the storefront, the coupon is validated on the server: `discount`, `total`, `couponDetails`, `CrafterCouponError` if invalid; localStorage 'cart' in headless use; `crafter:cart:updated`)*<br>`purchase({ productIds, coupon? })` *(instant purchase from site balance)*, `checkout(dto)` *(payment at a provider)* |
| **`crafter.money`** | — | `format(amount, { convert?, currency?, locale? })`, `convert(amount)`, `currency`, `storeCurrency`, `rate` *(from the page context)* |
| **`crafter.localization`** | `POST /localization` | `get()`, `set({ language?, currency? }, { returnTo?, reload? })` |
| **`crafter.sections`** | `?sections=` | `render(ids, { url?, swap? })` *(re-renders sections)* |
| **`crafter.checkout()`** | `/checkout` | `checkout({ purpose?: 'cart' \| 'balance', amount?, navigate? })` |
| **`crafter.dom`** | `document` | `on(name, fn)`, `emit(name, detail)` *(`crafter:<name>` CustomEvent)* |
| **`crafter.posts`** | `/v2/posts` *(v2)* | `list(query?)`, `getBySlug(slug)`, `get(idOrSlug)`, `like(id)`, `getUserLiked(userId, page, limit)` |
| **`crafter.pages`** | `/v2/pages` *(v2)* | `list()` *(all published pages)*, `getBySlug(slug)` |
| **`crafter.statistics`** | `/v2/statistics` *(v2)* | `get(limit = 5)` *(latest purchases, payments, sign-ups, top spenders / leaderboard)* |
| **`crafter.punishments`** | `/v2/punishments` *(v2)* | `list(page, limit)`, `search(query, type)` *(ban, mute, etc. punishment list)* |
| **`crafter.tickets`** | `/v2/tickets` *(v2)* | `list()`, `get(id)`, `create(dto)`, `reply(id, msg)`, `close(id, reason?)`, `open(id)`, `getCategories()` |
| **`crafter.chest`** | `/chest` | `getItems('me')`, `useItem(chestItemId)`, `giftItem(targetUserId, chestItemId)` |
| **`crafter.coupons`** | `/coupons` | `get(couponCode)` *(discount rate and validity check)* |
| **`crafter.redeemCode`** | `/redeem-codes` | `use(code)` *(redeem a promotion / gift card)* |
| **`crafter.servers`** | `/config/servers` | `getList()` *(live server status, online/max players, ping)* |
| **`crafter.payments`** | `/payment` & `/config/payment` | `getPublicProviders()` *(enabled payment methods and bonus rates)*, `initiate({ amount, providerId, user })`, `quote()`, `check(paymentId)` |
| **`crafter.currencies`** | `/payment/currencies` | `context()` *(customer currency, allowed currencies and rates)*, `convert(amounts)` |
| **`crafter.vote`** | `/config/vote-providers` | `getProviders()` *(active vote sites and cooldowns)*, `vote(providerId)` |
| **`crafter.legal`** | `/config/legal` | `getDocuments()` *(rules, privacy policy, terms of use)* |
| **`crafter.reports`** | `/reports` | `create(reportedUserId, { reportType, reason })` *(report a player)* |
| **`crafter.forum`** | `/forum` | `getCategories()`, `getTopics(catId)`, `getTopic(id)`, `createTopic(catId, dto)`, `addMessage(topicId, msg)`, `replyMessage(msgId, msg)`, `likeTopic(id)`, `unlikeTopic(id)`, `getStatistics()` |
| **`crafter.helpcenter`** | `/helpcenter` | `getOverview(query?)`, `getCategory(id)`, `getArticle(id)` |
| **`crafter.staffForms`** | `/staff-forms` | `list()`, `get(id)`, `apply(formId, answers)` |

---

## 💡 Practical Examples

### 1. Header Balance Box (Light & Fast)
```javascript
// Fetches only the balance and currency instead of the full profile object:
const balanceData = await crafter.users.getBalance('me');
const { balance, currency } = balanceData.data || balanceData;
// The symbol and decimals come from the currency ('TL' / '₺' are never hard-coded)
document.querySelector('#header-balance').innerText = Crafter.utils.formatMoney(balance, currency);
```

### 2. Live Navbar Search (Autocomplete)
```javascript
const results = await crafter.search.metadataSearch('vip', 5);
results.forEach(item => {
  console.log(`[${item.type.toUpperCase()}] ${item.name} - ${item.subtitle}`);
});
```

### 3. In-Game One-Click Login (/web Command)
```javascript
// Extracts the ?username=&uuid=&server_id=&hash= parameters from the URL automatically:
await crafter.auth.inGameAuth();
// ✅ The user is logged in instantly and the session is saved!
```

### 4. Password Reset (Automatic URL Token Detection)
```javascript
// Page: /auth/password/reset?token=xyz123...
await crafter.auth.resetPassword({
  new_password: 'YeniGucluSifrem123!',
  confirm_password: 'YeniGucluSifrem123!'
});
```

### 5. The Player's In-Game Rank & Permissions (LuckPerms)
```javascript
const lpData = await crafter.luckperms.getPlayer('player_name');
console.log('Primary rank:', lpData.primaryGroup); // 'vip'
```

---

## ⚡ Reaktif Event Sistemi (Event Bus)

```javascript
// When a purchase completes
crafter.on('cart:purchased', async (order) => {
  console.log('Purchase successful:', order);
  const data = await crafter.users.getBalance('me');
  document.querySelector('#header-balance').innerText = data.balance;
});

// When a balance transfer happens
crafter.on('balance:sent', (transfer) => {
  console.log('Credit sent:', transfer);
});

// On logout
crafter.on('auth:logout', () => {
  window.location.reload();
});
```

---

## 🔨 Development & Build

```bash
# Install dependencies
npm install

# TypeScript type check
npm run typecheck

# Build the production bundle (CJS, ESM, IIFE, DTS)
npm run build
```

Build outputs generated in the `dist/` folder:
- `dist/crafter.min.js`: minified bundle that runs directly in the browser for Liquid themes.
- `dist/index.mjs`: ESM output for modern bundlers (Vite, Webpack, Next.js).
- `dist/index.js`: CommonJS output for Node.js.
- `dist/index.d.ts`: 100% complete TypeScript type definitions.

---

## 📄 License

MIT © [Crafter](https://crafter.net.tr)

# 📚 Crafter SDK Developer Documentation (Wiki)

The Crafter SDK (`@crafter-cms/sdk`) is the official JavaScript/TypeScript client library for Crafter Storefront Liquid themes built for Minecraft and gaming communities, and for external (headless / React / Vue / Node.js) web applications.

The library brings all API endpoints, DTO validation, the token lifecycle (refresh token, HttpOnly cookie integration), error handling and event listeners (Event Bus) together under one roof.

---

## 🗂️ Module Guides

| No | Module Document | Areas Covered |
| :---: | :--- | :--- |
| **01** | [**Authentication (`auth`)**](./01-auth.md) | Sign-in, sign-up, in-game (/web) quick login, 2FA verification, password reset, Discord OAuth, logout |
| **02** | [**Users & Profile (`users`)**](./02-users.md) | Fetching profiles, lightweight balance lookup, balance transfer, profile wall, profile 2FA settings, Discord linking |
| **03** | [**Store & Cart (`store` & `cart`)**](./03-store-and-cart.md) | Categories, products, cart purchase, bulk discount in the cart |
| **04** | [**Chest Module (`chest`)**](./04-chest.md) | Player chest, using items, sending gifts to friends |
| **05** | [**Support Tickets (`tickets`)**](./05-tickets.md) | Listing, creating, replying to, closing and reopening tickets |
| **06** | [**Posts & Pages (`posts` & `pages`)**](./06-posts-and-pages.md) | Listing posts, slug/ID details, likes, user likes, static pages |
| **07** | [**Payments (`payments`)**](./07-payments.md) | Active payment providers (PayTR, Shopier, etc.), starting a payment (iframe/redirect), status lookup, LLC: Stripe Payment Element, tax breakdown, balance conditions, delivery status, typed payment errors, customer currency (`currencies`, rate quote), `formatMoney` |
| **08** | [**Coupons & Gift Codes (`coupons` & `redeemCode`)**](./08-coupons-and-redeem.md) | Cart coupon check, redeeming promotions and gift cards |
| **09** | [**Statistics & Punishments (`statistics` & `punishments`)**](./09-statistics-and-punishments.md) | Latest top-ups, purchases, leaderboard, punishment list and search |
| **10** | [**Servers & Voting (`servers` & `vote`)**](./10-servers-and-vote.md) | Live server status (ping, online players), vote site list and voting |
| **11** | [**Legal Documents & Reports (`legal` & `reports`)**](./11-legal-and-reports.md) | Rules, privacy policy, terms of use, abuse reports |
| **12** | [**Forum & Help Center (`forum` & `helpcenter`)**](./12-forum-and-helpcenter.md) | Forum categories, topics, messages, like/unlike, help center articles and FAQ |
| **13** | [**Staff Application Forms (`staffForms`)**](./13-staff-forms.md) | Active application forms, form fields and submitting applications |
| **14** | [**Search, SEO, LuckPerms & Site Info**](./14-search-seo-luckperms-website.md) | Live navbar search (`search`), SEO configuration & sitemap (`seo`), in-game rank (`luckperms`), site info (`website`) |
| **15** | [**Event Bus & Error Handling**](./15-events-and-errors.md) | Reactive event listening (`crafter.on`), error handling (`CrafterError`) and the dual-mode architecture |
| **16** | [**Lexical Rich Text Engine (`crafter.utils`)**](./16-lexical-rich-text.md) | `lexicalToHtml`, `lexicalToText` (excerpts) and `toLexical` (automatic wrapping) |
| **17** | [**Theme v2 runtime (`window.Crafter`)**](./17-theme-runtime.md) | Waiting for the SDK (`crafter:ready`), server cart, `money.format`, `localization`, `sections.render`, `checkout()`, DOM events, a sample section |

---

## ⚡ Quick Start

### 1. Usage in Liquid Themes (theme v2: SDK required, added by the storefront)
On theme v2 pages the storefront adds and starts the SDK itself with `{{ content_for_header }}`; the theme does not write `<script src>` or
`new Crafter()`. `window.Crafter` is a ready instance (details: [17. Theme v2 runtime](./17-theme-runtime.md)):

```js
// assets/theme.js
function onCrafterReady(fn) {
  if (window.Crafter && typeof window.Crafter.cart === 'object') fn(window.Crafter);
  else document.addEventListener('crafter:ready', () => fn(window.Crafter), { once: true });
}

onCrafterReady((Crafter) => {
  // Example: fill the lightweight balance box (money formatting via the SDK)
  Crafter.users.getBalance('me').then((res) => {
    document.querySelector('#user-balance').textContent = Crafter.money.format(res.balance, { convert: false });
  });
});
```

v1 themes and external pages load the SDK themselves: `<script src="https://unpkg.com/@crafter-cms/sdk@1.5.2/dist/crafter.min.js"></script>` and `new Crafter()`.

### 2. Usage in External / Headless Apps (NPM / Modern Bundler)
```bash
npm install @crafter-cms/sdk
```

```typescript
import { Crafter } from '@crafter-cms/sdk';

const crafter = new Crafter({
  mode: 'direct',
  websiteId: 'tenant-uuid-12345',
  // Optional token
  token: 'jwt-access-token'
});

const products = await crafter.store.getProducts();
console.log(products);
```

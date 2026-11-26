# 🌟 Crafter SDK Example Projects & Scenarios (Examples)

This folder contains end-to-end working examples that show how to use the `@crafter-cms/sdk` library both in Liquid themes (Storefront Proxy CDN) and in modern headless/Node.js projects.

---

## 📂 Example Files

| File | Platform / Environment | Scenarios Covered |
| :--- | :---: | :--- |
| [**`01-liquid-theme-demo.html`**](./01-liquid-theme-demo.html) | **Storefront (Liquid / HTML / JS)** | Live autocomplete navbar search, lightweight balance box, live server ping/player status, cart purchase, in-game `/web` quick login and reactive Event Bus listeners. |
| [**`02-headless-node.ts`**](./02-headless-node.ts) | **Headless (Node.js / TypeScript)** | Direct API mode (`mode: 'direct'`), site info, product catalogs, LuckPerms in-game rank lookup, SEO sitemap and `CrafterError` error handling. |
| [**`03-lexical-showcase.html`**](./03-lexical-showcase.html) | **Browser / Lexical Playground** | Converting a Lexical AST with all its nodes (headings, checklists, tables, code blocks, the 8 bitmask formats) to HTML and the two-way `htmlToLexical` converter. |
| [**`04-tickets-and-forum.ts`**](./04-tickets-and-forum.ts) | **TypeScript / API Integration** | Opening/replying to/closing support tickets, creating forum topics and messaging (automatic Lexical rich text conversion). |
| [**`05-llc-checkout.html`**](./05-llc-checkout.html) | **Storefront (Liquid / HTML / JS)** | Seller LLC cart payment: CrafterPayments + Stripe Payment Element (Stripe.js is loaded by the theme), Stripe Tax breakdown, the `OUT_OF_STOCK` error, 3DS return and delivery status polling. Stripe test card: `4242 4242 4242 4242`. |
| [**`06-theme-v2-section.liquid`**](./06-theme-v2-section.liquid) | **Theme v2 section (Liquid + `window.Crafter`)** | A server-rendered mini cart (Liquid `cart`), `Crafter.cart.remove` / `setCoupon` (coupon error), `Crafter.sections.render` on `crafter:cart:updated`, a checkout link with `purpose`, `{% schema %}` and a preset. SDK 1.5+; the theme does not load the SDK itself. |

---

> `01` and `05` are v1 / external page examples that add the SDK to the page themselves. In theme v2 the storefront adds the SDK itself; the theme does not write `new Crafter()` (see `06` and [wiki 17](../wiki/17-theme-runtime.md)).

## 🚀 Exploring and Running the Examples

### 1. Opening the HTML / Liquid UI Examples (`01`, `03` and `05`):
Open them directly in your browser by double-clicking, or with a local server:
```bash
# Example: with VS Code Live Server or npx serve
npx serve examples
```
Go to `http://localhost:3000/01-liquid-theme-demo.html` in the browser to see the live theme running.

### 2. Running the Node.js / TypeScript Examples (`02` and `04`):
```bash
# Can be run directly with ts-node or npx tsx:
npx tsx examples/02-headless-node.ts
npx tsx examples/04-tickets-and-forum.ts
```

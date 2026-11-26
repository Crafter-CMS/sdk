# 🔍 Search, SEO, LuckPerms & Site Info

Handles the live navbar search module (`search`), SEO meta and sitemap URLs (`seo`), players' in-game permissions and ranks (`luckperms`) and the general site add-on status (`website`).

---

## 📌 1. Live Global Search (`crafter.search`)

As the user types into the theme's navbar search box, scans all content on the site (users, store products, posts, pages) in a single request.

* **HTTP Route:** `GET /metadata-search?q=:query&limit=:limit`
* **Returns:** `SearchResultItem[]` (the SDK unwraps `res.data` automatically).
  ```typescript
  interface SearchResultItem {
    id: string;
    name: string;
    type: 'user' | 'post' | 'ticket' | 'page' | 'product';
    websiteId: string;
    subtitle: string;   // Email for a user, price for a product, slug for a post, etc.
    image: string | null;
  }
  ```
* **Example usage:**
  ```javascript
  const searchInput = document.querySelector('#header-search');
  searchInput.addEventListener('input', async (e) => {
    const val = e.target.value.trim();
    if (val.length < 2) return;

    const results = await crafter.search.metadataSearch(val, 5);
    renderDropdown(results);
  });
  ```

---

## 📌 2. SEO & Sitemap Module (`crafter.seo`)

Fetches site-wide meta tag templates and dynamic sitemap data.

### `getConfig()`
Fetches the site title template (`%title% | %site%`), the default meta description, keywords and the OpenGraph image.

* **HTTP Route:** `GET /v2/seo/config`
* **Returns:** `WebsiteSeoConfig`
* **Example:**
  ```javascript
  const seo = await crafter.seo.getConfig();
  console.log('Site OG image:', seo.ogImage);
  ```

### `getSitemapData()`
Returns the URL list of all published static pages, posts, categories and products on the site.

* **HTTP Route:** `GET /v2/seo/sitemap-data`
* **Returns:** `Array<{ path: string, lastmod: string, changefreq: string, priority: number }>`
* **Example:**
  ```javascript
  const sitemapUrls = await crafter.seo.getSitemapData();
  console.log(`The sitemap has ${sitemapUrls.length} URLs in total.`);
  ```

---

## 📌 3. LuckPerms Player Rank & Permissions (`crafter.luckperms`)

Connects to the LuckPerms database of the Minecraft server and fetches the player's in-game permission and rank status. Used to show VIP / Founder / Moderator badges on profile pages.

### `getPlayer(usernameOrUuid)`
* **HTTP Route:** `GET /v2/modules/luckperms/player/:identifier`
* **Returns:**
  ```typescript
  interface LuckPermsPlayerData {
    uuid: string;
    username: string;
    primaryGroup: string;       // Primary rank group (e.g. 'vip', 'mvp', 'default')
    inheritedGroups: string[];  // Inherited groups
    permissions: Array<{
      permission: string;
      value: number;
    }>;
  }
  ```
* **Example usage:**
  ```javascript
  const lp = await crafter.luckperms.getPlayer('player_name');
  document.querySelector('#ingame-rank-badge').innerText = lp.primaryGroup.toUpperCase();
  ```

### `getGroups()`
Returns the names of the LuckPerms groups defined on the server.

* **HTTP Route:** `GET /v2/modules/luckperms/groups`
* **Returns:** `string[]`

---

## 📌 4. General Site Info & Active Modules (`crafter.website`)

Returns the site name, default currency, logo and which add-ons are active.

### `getInfo()`
* **HTTP Route:** `GET /api/storefront` in storefront mode, `GET /website/:websiteId` in direct mode
* **Returns:**
  ```typescript
  interface WebsiteInfo {
    id: string;
    name: string;           // Server / site name
    domain?: string;
    currency: string;       // 'TRY', 'USD', 'EUR'
    logo?: string;
    favicon?: string;
    pluginModules?: {       // Map of active add-ons
      discord_bot?: { isActive: boolean };
      authme?: { isActive: boolean };
      luckperms?: { isActive: boolean };
    };
    marketplace?: MarketplaceConfig;
    servers?: ServerStatusItem[];
  }
  ```
* **Example usage:**
  ```javascript
  const siteInfo = await crafter.website.getInfo();
  console.log('Site Para Birimi:', siteInfo.currency);

  if (siteInfo.pluginModules?.luckperms?.isActive) {
    // If the LuckPerms module is enabled, show the in-game rank box on the profile
    document.querySelector('#rank-box').style.display = 'block';
  }
  ```

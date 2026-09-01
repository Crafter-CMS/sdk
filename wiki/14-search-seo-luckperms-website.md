# 🔍 Arama, SEO, LuckPerms & Site Bilgisi

Canlı navbar arama modülü (`search`), SEO meta ve sitemap URL'leri (`seo`), oyuncu oyun içi yetki ve rütbeleri (`luckperms`) ve genel site eklenti durumunu (`website`) yönetir.

---

## 📌 1. Canlı Genel Arama (`crafter.search`)

Temanın üst navbar arama kutusuna yazıldıkça tüm sitedeki içerikleri (kullanıcılar, mağaza ürünleri, duyurular, sayfalar) tek bir istekte tarar.

* **HTTP Rota:** `GET /metadata-search?q=:query&limit=:limit`
* **Dönüş:** `SearchResultItem[]` (SDK tarafından `res.data` otomatik unwrap edilir).
  ```typescript
  interface SearchResultItem {
    id: string;
    name: string;
    type: 'user' | 'post' | 'ticket' | 'page' | 'product';
    websiteId: string;
    subtitle: string;   // Kullanıcı için e-posta, ürün için fiyat, post için slug vb.
    image: string | null;
  }
  ```
* **Örnek Kullanım:**
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

## 📌 2. SEO & Sitemap Modülü (`crafter.seo`)

Site geneli meta tag şablonları ve dinamik sitemap verilerini çeker.

### `getConfig()`
Site başlık şablonu (`%title% | %site%`), varsayılan meta description, keywords ve OpenGraph görselini getirir.

* **HTTP Rota:** `GET /v2/seo/config`
* **Dönüş:** `WebsiteSeoConfig`
* **Örnek:**
  ```javascript
  const seo = await crafter.seo.getConfig();
  console.log('Site OG Görseli:', seo.ogImage);
  ```

### `getSitemapData()`
Sitede yayında olan tüm sabit sayfalar, duyurular, kategoriler ve ürünlerin URL listesini döner.

* **HTTP Rota:** `GET /v2/seo/sitemap-data`
* **Dönüş:** `Array<{ path: string, lastmod: string, changefreq: string, priority: number }>`
* **Örnek:**
  ```javascript
  const sitemapUrls = await crafter.seo.getSitemapData();
  console.log(`Sitemap'te toplam ${sitemapUrls.length} adet URL mevcut.`);
  ```

---

## 📌 3. LuckPerms Oyuncu Rütbe & Yetkileri (`crafter.luckperms`)

Minecraft sunucusundaki LuckPerms veritabanına bağlanarak oyuncunun oyun içi yetki ve rütbe durumunu getirir. Profil sayfalarında VIP / Kurucu / Moderatör rozetleri basmak için kullanılır.

### `getPlayer(usernameOrUuid)`
* **HTTP Rota:** `GET /v2/modules/luckperms/player/:identifier`
* **Dönüş:**
  ```typescript
  interface LuckPermsPlayerData {
    uuid: string;
    username: string;
    primaryGroup: string;       // Ana rütbe grubu (Örn: 'vip', 'mvp', 'default')
    inheritedGroups: string[];  // Devralınan gruplar
    permissions: Array<{
      permission: string;
      value: number;
    }>;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const lp = await crafter.luckperms.getPlayer('oyuncu_adi');
  document.querySelector('#ingame-rank-badge').innerText = lp.primaryGroup.toUpperCase();
  ```

### `getGroups()`
Sunucuda tanımlı LuckPerms gruplarının isimlerini döner.

* **HTTP Rota:** `GET /v2/modules/luckperms/groups`
* **Dönüş:** `string[]`

---

## 📌 4. Sitenin Genel Bilgileri & Aktif Modülleri (`crafter.website`)

Sitenin adını, varsayılan para birimini, logosunu ve hangi eklentilerin aktif olduğu bilgisini döner.

### `getInfo()`
* **HTTP Rota:** Storefront modunda `GET /api/storefront`, Direct modda `GET /website/:websiteId`
* **Dönüş:**
  ```typescript
  interface WebsiteInfo {
    id: string;
    name: string;           // Sunucu / Site Adı
    domain?: string;
    currency: string;       // 'TRY', 'USD', 'EUR'
    logo?: string;
    favicon?: string;
    pluginModules?: {       // Aktif eklentiler sözlüğü
      discord_bot?: { isActive: boolean };
      authme?: { isActive: boolean };
      luckperms?: { isActive: boolean };
    };
    marketplace?: MarketplaceConfig;
    servers?: ServerStatusItem[];
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const siteInfo = await crafter.website.getInfo();
  console.log('Site Para Birimi:', siteInfo.currency);

  if (siteInfo.pluginModules?.luckperms?.isActive) {
    // Luckperms modülü açıksa profilde oyun içi rank kutusunu göster
    document.querySelector('#rank-box').style.display = 'block';
  }
  ```

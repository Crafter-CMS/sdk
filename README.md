# @crafter-cms/sdk

[![npm version](https://img.shields.io/npm/v/@crafter-cms/sdk.svg?style=flat-square)](https://www.npmjs.com/package/@crafter-cms/sdk)
[![Bundle Size](https://img.shields.io/bundlephobia/min/@crafter-cms/sdk?style=flat-square)](https://bundlephobia.com/package/@crafter-cms/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

Crafter Storefront ve Headless web uygulamaları için resmi JavaScript / TypeScript istemci kütüphanesidir.

Crafter Liquid temalarındaki hardcoded `fetch()` isteklerini ortadan kaldırmak, API versiyonlamasını (`v2` vs düz rotalar) soyutlamak, çift çalışma modunu (Liquid Storefront Proxy vs Harici Doğrudan Backend) otomatik yönetmek ve reaktif bir arayüz deneyimi sunmak amacıyla sıfırdan geliştirilmiştir.

---

## 📖 Kapsamlı Dokümantasyon (Wiki)

Her modülün ayrıntılı parametreleri, dönüş modelleri ve tema kodlama örnekleri için [**📚 Wiki Rehberleri**](./wiki/README.md) dizinine göz atabilirsiniz:

* 🔐 [**01. Kimlik Doğrulama (`crafter.auth`)**](./wiki/01-auth.md) — Giriş, Kayıt, Oyun içi (/web) Hızlı Giriş, 2FA, OTP, Şifre Sıfırlama, Discord
* 👤 [**02. Kullanıcılar & Profil (`crafter.users`)**](./wiki/02-users.md) — Profil, Hafif Bakiye, Transfer, Duvar, 2FA Ayarları, Discord Bağlantısı
* 🛒 [**03. Mağaza & Sepet (`crafter.store` & `cart`)**](./wiki/03-store-and-cart.md) — Kategoriler, Ürünler, Sepet Satın Alımı, Toplu İndirim
* 📦 [**04. Oyuncu Sandığı (`crafter.chest`)**](./wiki/04-chest.md) — Web Envanteri, Eşya Kullanma ve Arkadaşa Hediye Etme
* 🎫 [**05. Destek Talepleri (`crafter.tickets`)**](./wiki/05-tickets.md) — Talep Açma, Mesajlaşma, Departmanlar, Bilet Kapatma/Açma
* 📰 [**06. Duyurular & Sayfalar (`posts` & `pages`)**](./wiki/06-posts-and-pages.md) — Haberler, Beğeniler, Kullanıcı Beğenileri, CMS Sayfaları
* 💳 [**07. Ödeme İşlemleri (`crafter.payments`)**](./wiki/07-payments.md) — PayTR, Shopier, CrafterPayments, Ödeme Başlatma ve Sorgulama
* 🎟️ [**08. Kuponlar & Kodlar (`coupons` & `redeemCode`)**](./wiki/08-coupons-and-redeem.md) — Sepet Kuponu Kontrolü, Promosyon ve Hediye Kartları
* 📊 [**09. İstatistikler & Cezalar (`statistics` & `punishments`)**](./wiki/09-statistics-and-punishments.md) — Canlı Akış, Leaderboard, Ban/Mute Listesi ve Arama
* 🌐 [**10. Sunucular & Oy Verme (`servers` & `vote`)**](./wiki/10-servers-and-vote.md) — Sunucu Ping/Oyuncu Sayısı, Oy Siteleri ve Bekleme Süreleri
* 📜 [**11. Hukuki Belgeler & Şikayet (`legal` & `reports`)**](./wiki/11-legal-and-reports.md) — Kurallar, Gizlilik Politikası, Kural İhlali Şikayeti
* 💬 [**12. Forum & Yardım Merkezi (`forum` & `helpcenter`)**](./wiki/12-forum-and-helpcenter.md) — Forum Konuları, Mesajlar, Beğeni, Bilgi Bankası Makaleleri
* 📝 [**13. Yetkili Başvuru Formları (`staffForms`)**](./wiki/13-staff-forms.md) — Dinamik Soru Formları ve Başvuru Gönderme
* 🔍 [**14. Arama, SEO, LuckPerms & Site Bilgisi**](./wiki/14-search-seo-luckperms-website.md) — Canlı Navbar Arama, SEO & Sitemap, Oyun İçi Rank
* ⚡ [**15. Event Bus & Hata Yönetimi**](./wiki/15-events-and-errors.md) — Reaktif Olaylar (`crafter.on`), `CrafterError` ve Dual-Mode
* ✍️ [**16. Lexical Zengin Metin Motoru (`crafter.utils`)**](./wiki/16-lexical-rich-text.md) — AST -> HTML/Text dönüştürücü ve Storefront Liquid filtresi eşleniği

---

## 🌟 Çalışır Durumdaki Örnek Projeler ([`examples/`](./examples/README.md))

SDK'nın pratik entegrasyonlarını test etmek için hazır senaryolar:
* [**`01-liquid-theme-demo.html`**](./examples/01-liquid-theme-demo.html) — Storefront Liquid temasında canlı arama, sunucu ping/online oyuncu, bakiye ile ürün satın alma ve `/web` hızlı giriş demosu.
* [**`02-headless-node.ts`**](./examples/02-headless-node.ts) — Node.js / Headless modda doğrudan backend API çağrıları, LuckPerms ve SEO sitemap.
* [**`03-lexical-showcase.html`**](./examples/03-lexical-showcase.html) — Tarayıcıda Lexical AST render ve HTML ➔ Lexical AST çift yönlü test sandbox'ı.
* [**`04-tickets-and-forum.ts`**](./examples/04-tickets-and-forum.ts) — Destek talebi ve forum mesajlaşma iş akışları (otomatik Lexical dönüşümü).

---

## 🚀 Öne Çıkan Özellikler

- **Sıfır Bağımlılık (Zero-dependency):** Harici hiçbir npm paketine ihtiyaç duymaz. Minified IIFE boyutu yalnızca ~18 KB (`dist/crafter.min.js`).
- **Doğrudan Storefront Proxy Uyumu:** Varsayılan olarak `/api/storefront` üzerinden çalışır. Temada `websiteId` veya domain yapılandırması gerektirmez; mağaza hostname üzerinden çözülür.
- **Kusursuz Versiyonlama:** Yalnızca `v2` olan endpointler `/v2/...` olarak çağrılır, diğer tüm endpointler düz yazılır (asla `v1` kullanılmaz).
- **Her İki Dünyaya Uygun:**
  - CDN / Script Tag ile Liquid temalarında: `window.Crafter`
  - NPM / ESM modern bundler projelerinde: `import { Crafter } from '@crafter-cms/sdk'`
- **Reaktif Event Sistemi:** Bakiye transferi, sepet satın alımı, sandık kullanımı ve oturum değişikliklerini anlık dinleme (`crafter.on('cart:purchased', ...)`).
- **Tam Tip Güvenliği:** Backend NestJS DTO'larıyla %100 uyumlu TypeScript tanımları (`dist/index.d.ts`).
- **Akıllı Otomasyonlar:**
  - Şifre sıfırlamada `?token=` parametresini URL'den otomatik algılama.
  - Oyun içi `/web` komutundan gelen güvenlik hash'i ile `crafter.auth.inGameAuth()` üzerinden tek tıkla şifresiz oturum açma.

---

## 📦 Kurulum & Kullanım

### 1. Liquid Temalarda (Storefront Proxy Modu)

`layout/theme.liquid` dosyanızda `<head>` veya sayfa sonuna ekleyin:

```html
<!-- SDK Yükleme -->
<script src="/assets/crafter.min.js"></script>

<!-- Başlatma (Sıfır konfigürasyon yeterlidir, otomatik /api/storefront kullanır) -->
<script>
  window.crafter = new Crafter();
</script>
```

> **Liquid Temalarında:** İstekler aynı origin altındaki `/api/storefront` proxy'sine yönlendirilir. Proxy, mağaza tenant'ını hostname üzerinden otomatik çözer ve HttpOnly token çerezlerini backend'e güvenle iletir.

---

### 2. Harici / Headless Uygulamalarda (Doğrudan Backend Modu)

Mobil uygulamalar, harici Node/React/Vue projeleri veya bağımsız panellerde doğrudan backend'e bağlanmak için `websiteId` belirtmeniz yeterlidir:

```bash
npm install @crafter-cms/sdk
```

```typescript
import { Crafter } from '@crafter-cms/sdk';

const crafter = new Crafter({
  mode: 'direct',
  websiteId: 'website-uuid-degeriniz',
  // apiBase varsayılan olarak 'https://api.crafter.net.tr' adresini kullanır
  // token: 'jwt-access-token' // opsiyonel
});
```

---

## 🛠️ Modüller & API Referansı (24 Modül)

| Modül | Base Proxy Yolu | Metotlar & Açıklama |
| :--- | :--- | :--- |
| **`crafter.auth`** | `/v2/auth` *(v2)* | `signin`, `signup`, `logout`, `inGameAuth`, `refreshToken`, `forgotPassword`, `resetPassword`, `getResetTokenFromUrl`, `verifyEmail`, `resendEmail`, `validate2Fa`, `send2FaEmailCode`, `send2FaDiscordCode`, `updateTempEmail`, `getDiscordAuthUrl` |
| **`crafter.users`** | `/v2/users` & `/users` | `getProfile('me')`, `getBalance('me')` *(hafif bakiye)*, `getByUsername('@user')`, `updateProfile(dto)`, `sendBalance({ targetUserId, amount })`, `changePassword(dto)`<br>**Duvar:** `getWall(userId)`, `postWallMessage(userId, content)`, `replyWallMessage(userId, msgId, content)`<br>**2FA:** `get2FaStatus()`, `setupAuthenticator()`, `enableAuthenticator(code)`, `sendEmail2FaCode()`, `enableEmail2Fa(code)`, `sendDiscord2FaCode()`, `enableDiscord2Fa(code)`, `disable2Fa(dto)`, `setPrimary2FaMethod(method)`, `regenerateRecoveryCodes()`<br>**Discord:** `getDiscordStatus()`, `unlinkDiscord()` |
| **`crafter.search`** | `/metadata-search` | `metadataSearch(query, limit = 5)` *(Navbar için canlı global arama: kullanıcılar, ürünler, duyurular, sayfalar)* |
| **`crafter.seo`** | `/v2/seo` *(v2)* | `getConfig()` *(Site geneli meta tag şablonları, OG resim, favicon)*, `getSitemapData()` *(Dinamik sitemap URL dizisi)* |
| **`crafter.luckperms`** | `/v2/modules/luckperms` *(v2)* | `getPlayer(usernameOrUuid)` *(Oyuncunun oyun içi ana rütbesi, yetkileri ve devralınan grupları)*, `getGroups()` |
| **`crafter.website`** | `/` *(Kök / Site Bilgisi)* | `getInfo()` *(Sitenin adı, para birimi, logosu, faviconu ve aktif eklenti modülleri: discord_bot, authme vb.)* |
| **`crafter.store`** | `/categories`, `/products`, `/config/marketplace` | `getCategories()`, `getCategory(id)`, `getProducts()`, `getProduct(id)`, `getProductsByCategory(catId)`, `getConfig()` *(Sepette toplu indirim ayarları)* |
| **`crafter.cart` / `marketplace`** | `/marketplace` | `purchase({ productIds, coupon? })` *(Site bakiyesinden anında satın alım)* |
| **`crafter.posts`** | `/v2/posts` *(v2)* | `list(query?)`, `getBySlug(slug)`, `get(idOrSlug)`, `like(id)`, `getUserLiked(userId, page, limit)` |
| **`crafter.pages`** | `/v2/pages` *(v2)* | `list()` *(tüm yayındaki sayfalar)*, `getBySlug(slug)` |
| **`crafter.statistics`** | `/v2/statistics` *(v2)* | `get(limit = 5)` *(Son alışverişler, ödemeler, kayıtlar, en çok yükleyenler / leaderboard)* |
| **`crafter.punishments`** | `/v2/punishments` *(v2)* | `list(page, limit)`, `search(query, type)` *(Ban, Mute vb. ceza listesi)* |
| **`crafter.tickets`** | `/v2/tickets` *(v2)* | `list()`, `get(id)`, `create(dto)`, `reply(id, msg)`, `close(id, reason?)`, `open(id)`, `getCategories()` |
| **`crafter.chest`** | `/chest` | `getItems('me')`, `useItem(chestItemId)`, `giftItem(targetUserId, chestItemId)` |
| **`crafter.coupons`** | `/coupons` | `get(couponCode)` *(İndirim oranı ve geçerlilik kontrolü)* |
| **`crafter.redeemCode`** | `/redeem-codes` | `use(code)` *(Promosyon / hediye kartı bozdurma)* |
| **`crafter.servers`** | `/config/servers` | `getList()` *(Canlı sunucu durumu, online/max oyuncu sayısı, ping)* |
| **`crafter.payments`** | `/payment` & `/config/payment` | `getPublicProviders()` *(Açık ödeme yöntemleri ve bonus oranları)*, `initiate({ amount, providerId, user })`, `check(paymentId)` |
| **`crafter.vote`** | `/config/vote-providers` | `getProviders()` *(Aktif oy siteleri ve bekleme süreleri)*, `vote(providerId)` |
| **`crafter.legal`** | `/config/legal` | `getDocuments()` *(Kurallar, gizlilik politikası, kullanım koşulları)* |
| **`crafter.reports`** | `/reports` | `create(reportedUserId, { reportType, reason })` *(Oyuncu şikayet etme)* |
| **`crafter.forum`** | `/forum` | `getCategories()`, `getTopics(catId)`, `getTopic(id)`, `createTopic(catId, dto)`, `addMessage(topicId, msg)`, `replyMessage(msgId, msg)`, `likeTopic(id)`, `unlikeTopic(id)`, `getStatistics()` |
| **`crafter.helpcenter`** | `/helpcenter` | `getOverview(query?)`, `getCategory(id)`, `getArticle(id)` |
| **`crafter.staffForms`** | `/staff-forms` | `list()`, `get(id)`, `apply(formId, answers)` |

---

## 💡 Pratik Örnekler

### 1. Header Bakiye Kutusu (Hafif & Hızlı)
```javascript
// Tam profil nesnesi yerine sadece bakiye ve para birimini çeker:
const balanceData = await crafter.users.getBalance('me');
document.querySelector('#header-balance').innerText = `${balanceData.balance} ${balanceData.currency}`;
```

### 2. Canlı Navbar Araması (Autocomplete)
```javascript
const results = await crafter.search.metadataSearch('vip', 5);
results.forEach(item => {
  console.log(`[${item.type.toUpperCase()}] ${item.name} - ${item.subtitle}`);
});
```

### 3. Oyun İçi Tek Tıkla Giriş (/web Komutu)
```javascript
// URL'deki ?username=&uuid=&server_id=&hash= parametrelerini otomatik ayıklar:
await crafter.auth.inGameAuth();
// ✅ Kullanıcı anında giriş yaptı ve oturumu kaydedildi!
```

### 4. Şifre Sıfırlama (Otomatik URL Token Algılama)
```javascript
// Sayfa: /auth/password/reset?token=xyz123...
await crafter.auth.resetPassword({
  new_password: 'YeniGucluSifrem123!',
  confirm_password: 'YeniGucluSifrem123!'
});
```

### 5. Oyuncunun Oyun İçi Rütbesi & Yetkileri (LuckPerms)
```javascript
const lpData = await crafter.luckperms.getPlayer('oyuncu_adi');
console.log('Ana Rütbe:', lpData.primaryGroup); // 'vip'
```

---

## ⚡ Reaktif Event Sistemi (Event Bus)

```javascript
// Satın alma tamamlandığında
crafter.on('cart:purchased', async (order) => {
  console.log('Satın alma başarılı:', order);
  const data = await crafter.users.getBalance('me');
  document.querySelector('#header-balance').innerText = data.balance;
});

// Bakiye transferi gerçekleştiğinde
crafter.on('balance:sent', (transfer) => {
  console.log('Kredi gönderildi:', transfer);
});

// Çıkış yapıldığında
crafter.on('auth:logout', () => {
  window.location.reload();
});
```

---

## 🔨 Geliştirme & Derleme

```bash
# Bağımlılıkları yükle
npm install

# TypeScript tip kontrolü
npm run typecheck

# Üretim paketini derle (CJS, ESM, IIFE, DTS)
npm run build
```

Derleme sonucunda `dist/` klasöründe üretilen çıktılar:
- `dist/crafter.min.js`: Liquid temaları için tarayıcıda doğrudan çalıştırılabilir minified bundle.
- `dist/index.mjs`: Modern bundlerlar (Vite, Webpack, Next.js) için ESM çıktısı.
- `dist/index.js`: Node.js ortamı için CommonJS çıktısı.
- `dist/index.d.ts`: %100 eksiksiz TypeScript tip tanımları.

---

## 📄 Lisans

MIT © [Crafter](https://crafter.net.tr)

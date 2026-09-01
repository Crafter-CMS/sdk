# 📚 Crafter SDK Geliştirici Belgeleri (Wiki)

Crafter SDK (`@crafter-cms/sdk`), Minecraft ve oyun toplulukları için geliştirilen Crafter Storefront Liquid temaları ve harici (Headless / React / Vue / Node.js) web uygulamaları için resmi JavaScript/TypeScript istemci kütüphanesidir.

Kütüphane; tüm API uç noktalarını, DTO doğrulamalarını, token yaşam döngüsünü (Refresh Token, HttpOnly Cookie entegrasyonu), hata yönetimini ve olay dinleyicilerini (Event Bus) tek bir çatı altında toplar.

---

## 🗂️ Modül Rehberleri

| No | Modül Dokümanı | Kapsadığı Alanlar |
| :---: | :--- | :--- |
| **01** | [**Kimlik Doğrulama (`auth`)**](./01-auth.md) | Giriş, Kayıt, Oyun İçi (/web) Hızlı Giriş, 2FA Doğrulama, Şifre Sıfırlama, Discord OAuth, Çıkış |
| **02** | [**Kullanıcılar & Profil (`users`)**](./02-users.md) | Profil Getirme, Hafif Bakiye Sorgulama, Bakiye Transferi, Profil Duvarı (Wall), Profil 2FA Ayarları, Discord Bağlama |
| **03** | [**Mağaza & Sepet (`store` & `cart`)**](./03-store-and-cart.md) | Kategoriler, Ürünler, Sepet Satın Alımı, Sepette Toplu İndirim (Bulk Discount) |
| **04** | [**Sandık Modülü (`chest`)**](./04-chest.md) | Oyuncu Sandığı, Eşya Kullanma, Arkadaşa Hediye Gönderme |
| **05** | [**Destek Talepleri (`tickets`)**](./05-tickets.md) | Talep Listeleme, Talep Oluşturma, Yanıtlama, Kapatma ve Yeniden Açma |
| **06** | [**Duyurular & Sayfalar (`posts` & `pages`)**](./06-posts-and-pages.md) | Duyuru Listeleme, Slug/ID Detayı, Beğenme, Kullanıcı Beğenileri, Sabit Sayfalar |
| **07** | [**Ödeme İşlemleri (`payments`)**](./07-payments.md) | Aktif Ödeme Sağlayıcıları (PayTR, Shopier vb.), Ödeme Başlatma (Iframe/Redirect), Durum Sorgulama |
| **08** | [**Kuponlar & Hediye Kodları (`coupons` & `redeemCode`)**](./08-coupons-and-redeem.md) | Sepet Kuponu Kontrolü, Promosyon ve Hediye Kartı Bozdurma |
| **09** | [**İstatistikler & Cezalar (`statistics` & `punishments`)**](./09-statistics-and-punishments.md) | Son Yüklemeler, Satın Alımlar, Lider Tablosu (Leaderboard), Ceza Listesi ve Arama |
| **10** | [**Sunucular & Oy Verme (`servers` & `vote`)**](./10-servers-and-vote.md) | Canlı Sunucu Durumu (Ping, Online Oyuncu), Oy Siteleri Listesi ve Oy Kullanma |
| **11** | [**Hukuki Belgeler & Raporlar (`legal` & `reports`)**](./11-legal-and-reports.md) | Kurallar, Gizlilik Politikası, Kullanım Şartları, Kötüye Kullanım Şikayeti (Report) |
| **12** | [**Forum & Yardım Merkezi (`forum` & `helpcenter`)**](./12-forum-and-helpcenter.md) | Forum Kategorileri, Konular, Mesajlar, Beğeni/Unlike, Yardım Merkezi Makaleleri ve SSS |
| **13** | [**Yetkili Başvuru Formları (`staffForms`)**](./13-staff-forms.md) | Aktif Başvuru Formları, Form Alanları ve Başvuru Gönderme |
| **14** | [**Arama, SEO, LuckPerms & Site Bilgisi**](./14-search-seo-luckperms-website.md) | Canlı Canlı Navbar Arama (`search`), SEO Konfigürasyonu & Sitemap (`seo`), Oyun İçi Rank (`luckperms`), Site Bilgileri (`website`) |
| **15** | [**Event Bus & Hata Yönetimi**](./15-events-and-errors.md) | Reaktif Event Dinleme (`crafter.on`), Hata Yakalama (`CrafterError`) ve Dual-Mode Mimarisi |
| **16** | [**Lexical Zengin Metin Motoru (`crafter.utils`)**](./16-lexical-rich-text.md) | `lexicalToHtml`, `lexicalToText` (özet çıkarma) ve `toLexical` (otomatik sarmalama) |

---

## ⚡ Hızlı Başlangıç

### 1. Liquid Temalarda Kullanım (Storefront CDN)
Storefront proxy üzerinden otomatik kimlik çözümlemesi yapılır (`websiteId` vermeniz gerekmez):

```html
<!-- theme.liquid içinde head veya body sonu -->
<script src="/cdn/sdk/crafter.min.js"></script>
<script>
  // Global window.crafter otomatik hazırdır (veya new Crafter() ile başlatılır)
  const crafter = new Crafter();

  // Örnek: Hafif bakiye kutusunu doldur
  crafter.users.getBalance('me').then(res => {
    document.querySelector('#user-balance').innerText = res.balance + ' ' + res.currency;
  });
</script>
```

### 2. Harici / Headless Uygulamalarda Kullanım (NPM / Modern Bundler)
```bash
npm install @crafter-cms/sdk
```

```typescript
import { Crafter } from '@crafter-cms/sdk';

const crafter = new Crafter({
  mode: 'direct',
  websiteId: 'tenant-uuid-12345',
  // İsteğe bağlı token
  token: 'jwt-access-token'
});

const products = await crafter.store.getProducts();
console.log(products);
```

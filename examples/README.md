# 🌟 Crafter SDK Örnek Projeler & Senaryolar (Examples)

Bu dizin, `@crafter-cms/sdk` kütüphanesinin hem Liquid temalarında (Storefront Proxy CDN) hem de modern Headless/Node.js projelerinde nasıl kullanılacağını gösteren uçtan uca çalışan örnekleri içerir.

---

## 📂 Örnek Dosyaları

| Dosya | Platform / Ortam | Kapsanan Senaryolar |
| :--- | :---: | :--- |
| [**`01-liquid-theme-demo.html`**](./01-liquid-theme-demo.html) | **Storefront (Liquid / HTML / JS)** | Navbar canlı autocomplete arama, hafif bakiye kutusu, canlı sunucu ping/oyuncu durumu, sepet satın alımı, in-game `/web` hızlı giriş ve reaktif Event Bus dinleyicileri. |
| [**`02-headless-node.ts`**](./02-headless-node.ts) | **Headless (Node.js / TypeScript)** | Doğrudan API modu (`mode: 'direct'`), site bilgisi, ürün katalogları, LuckPerms oyun içi rank sorgulama, SEO sitemap ve `CrafterError` hata yönetimi. |
| [**`03-lexical-showcase.html`**](./03-lexical-showcase.html) | **Tarayıcı / Lexical Test Alanı** | Lexical AST'yi tüm düğümleriyle (başlıklar, kontrol listeleri, tablolar, kod blokları, 8 bitmask formatı) HTML'e çevirme ve `htmlToLexical` çift yönlü dönüştürücü. |
| [**`04-tickets-and-forum.ts`**](./04-tickets-and-forum.ts) | **TypeScript / API Entegrasyonu** | Destek talebi açma/yanıtlama/kapatma, forum konusu oluşturma ve mesajlaşma (otomatik Lexical zengin metin dönüşümü). |
| [**`05-llc-checkout.html`**](./05-llc-checkout.html) | **Storefront (Liquid / HTML / JS)** | Satıcı LLC sepet ödemesi: CrafterPayments + Stripe Payment Element (Stripe.js tema tarafından yüklenir), Stripe Tax vergi kırılımı, `OUT_OF_STOCK` hatası, 3DS dönüşü ve teslimat durumu yoklaması. Stripe test kartı: `4242 4242 4242 4242`. |
| [**`06-theme-v2-section.liquid`**](./06-theme-v2-section.liquid) | **Tema v2 bölümü (Liquid + `window.Crafter`)** | Sunucuda çizilen mini sepet (Liquid `cart`), `Crafter.cart.remove` / `setCoupon` (kupon hatası), `crafter:cart:updated` ile `Crafter.sections.render`, `purpose`lu checkout bağlantısı, `{% schema %}` ve preset. SDK 1.5+; tema SDK'yı kendisi yüklemez. |

---

> `01` ve `05` SDK'yı sayfaya kendisi ekleyen v1 / harici sayfa örnekleridir. Tema v2'de storefront SDK'yı kendisi ekler; tema `new Crafter()` yazmaz (bkz. `06` ve [wiki 17](../wiki/17-theme-runtime.md)).

## 🚀 Örnekleri İnceleme ve Çalıştırma

### 1. HTML / Liquid Arayüz Örneklerini Açma (`01`, `03` ve `05`):
Tarayıcınızda doğrudan çift tıklayarak veya yerel bir sunucuyla açabilirsiniz:
```bash
# Örnek: VS Code Live Server veya npx serve ile
npx serve examples
```
Tarayıcıda `http://localhost:3000/01-liquid-theme-demo.html` adresine giderek çalışan canlı temayı görebilirsiniz.

### 2. Node.js / TypeScript Örneklerini Çalıştırma (`02` ve `04`):
```bash
# ts-node veya npx tsx ile doğrudan çalıştırılabilir:
npx tsx examples/02-headless-node.ts
npx tsx examples/04-tickets-and-forum.ts
```

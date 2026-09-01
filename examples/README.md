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

---

## 🚀 Örnekleri İnceleme ve Çalıştırma

### 1. HTML / Liquid Arayüz Örneklerini Açma (`01` ve `03`):
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

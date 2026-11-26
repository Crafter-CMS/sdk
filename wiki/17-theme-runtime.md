# 17. Tema v2 çalışma zamanı (`window.Crafter`)

Tema v2 sayfalarında storefront, `{{ content_for_header }}` ile sayfa bağlamını (`window.__CRAFTER_CONTEXT__`: mağaza,
dil, para birimi, kur, uç adresleri) ve SDK'nın sürümlü tarayıcı derlemesini (`defer`) **kendisi ekler**. SDK bu bağlamı
görünce `window.Crafter` hazır örnek olur ve `document`'a `crafter:ready` yayılır.

> **Kural:** Tema SDK'yı kendisi yüklemez, `new Crafter()` ile başlatmaz; sepet, para biçimi, dil değiştirme ve checkout
> kodunu kendisi yazmaz. `crafter theme check` bunları denetler (`sdk_cart_storage`, `checkout_link_purpose`,
> `checkout_locale_url`, `checkout_without_sdk`, `money_reimplemented`). Tema çalışma zamanı SDK **1.5** ve sonrasındadır.

Ayrıntılı rehber: [docs.crafter.net.tr → Crafter SDK](https://docs.crafter.net.tr/tr/developers/sdk).

---

## SDK'yı beklemek

SDK `defer` ile yüklenir; daha önce çalışabilecek kod `crafter:ready`'yi bekler:

```js
// assets/theme.js
function onCrafterReady(fn) {
  if (window.Crafter && typeof window.Crafter.cart === 'object') fn(window.Crafter);
  else document.addEventListener('crafter:ready', () => fn(window.Crafter), { once: true });
}
```

## Sepet (`Crafter.cart`)

Storefront'ta sepet sunucudadır (ziyaretçide imzalı çerez, girişte hesap); fiyatları her zaman sunucu hesaplar.

| Metot | Açıklama |
| :--- | :--- |
| `get()` | `CartState`: `items`, `itemCount`, `subtotal`, `discount`, `total`, `currency`, `coupon` |
| `add({ id }, adet)` | Ürün ekler (stok kadar eklenirse `adjusted[]`) |
| `update(id, adet)` | Adedi değiştirir (0 kaldırır) |
| `remove(id)`, `clear()` | Satırı kaldırır, sepeti boşaltır |
| `setCoupon(kod)`, `removeCoupon()` | Kuponu sunucuda doğrular / kaldırır; geçersizse `CrafterCouponError` |

```js
onCrafterReady((Crafter) => {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-add-to-cart]');
    if (!button) return;
    button.disabled = true;
    try {
      await Crafter.cart.add({ id: button.dataset.productId }, 1);
    } catch (error) {
      if (error.isCrafterError) alert(error.message); // sayfanın dilinde
    } finally {
      button.disabled = false;
    }
  });
});
```

İlk görünüm JS gerektirmez: Liquid `cart` nesnesi (`cart.items`, `cart.item_count`, `cart.total_price`) sayfayı
sunucuda çizer. Değişiklikten sonra aynı bölümü `Crafter.sections.render` ile yeniden çizin (aşağıda).

## Para (`Crafter.money`)

```js
Crafter.money.format(cart.total);                  // müşterinin para birimi, sayfanın dili (Liquid `money` ile aynı)
Crafter.money.format(balance, { convert: false }); // mağaza para biriminde
```

JS'de `Intl.NumberFormat` ile para biçimlemeyin (`money_reimplemented` uyarısı).

## Dil ve para birimi (`Crafter.localization`)

```js
Crafter.localization.get();                       // { language, currency, languages, currencies }
await Crafter.localization.set({ currency: 'EUR' });
await Crafter.localization.set({ language: 'en' }, { returnTo: '/store' });
```

`set` storefront'un `POST /localization` ucunu kullanır ve sayfayı seçilen dildeki adrese götürür
(`{ reload: false }` ile gitmez, yalnızca `crafter:localization:changed` yayar).

## Bölümleri yeniden çizmek (`Crafter.sections`)

`Crafter.sections.render(ids, { url?, swap? })` sayfanın `?sections=a,b` sürümünü ister ve sayfadaki
`#crafter-section-<id>` sarmalayıcılarını yenisiyle değiştirir. Bir istekte en çok 10 bölüm; section grubundaki bölüm
`<grup>:<id>` ile istenir (`'header-group:header'`).

```js
// Sepet değişince sepet bölümünü ve başlıktaki sayacı yenile
document.addEventListener('crafter:cart:updated', () => {
  Crafter.sections.render(['main-cart', 'header-group:header']).catch(() => location.reload());
});

// Filtre formu: sayfayı yeniden yüklemeden bölümü yeni sorguyla çiz
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = `${location.pathname}?${new URLSearchParams(new FormData(form))}`;
  await Crafter.sections.render([form.dataset.sectionFilter], { url });
  history.replaceState(null, '', url);
});
```

`{ swap: false }` DOM'a dokunmaz, yalnızca `{ [id]: html | null }` döner.

## Checkout

```js
Crafter.checkout();                                         // /checkout?purpose=cart
Crafter.checkout({ purpose: 'balance', amount: 100 });      // bakiye yükleme
const url = Crafter.checkout({ navigate: false });          // yalnızca adres
```

Liquid'de JS'siz bağlantı: `<a href="/checkout?purpose=cart">`. Checkout adresinde dil öneki yoktur; `locale_url`
uygulamayın. Önizleme parametreleri (`preview_token` vb.) `Crafter.checkout()` ile korunur.

## Olaylar

Hepsi `document` üzerinde `CustomEvent`, veri `event.detail` içinde:

| Olay | Ne zaman |
| :--- | :--- |
| `crafter:ready` | SDK hazır (`detail`: örnek) |
| `crafter:cart:updated` | Sepet değişti (başka sekmede de); `detail.itemCount` |
| `crafter:localization:changed` | Dil ya da para birimi değişti; `detail.language`, `detail.currency` |
| `crafter:section:load`, `crafter:section:unload` | Editör bir bölümü yeniden çizdi (storefront yayar); `detail.sectionId` |

Bölümün JS'ini `crafter:section:load` ile yeniden bağlayın; editör bölümü değiştirdiğinde eski dinleyiciler gider.

## Tam örnek

Bölüm dosyası, şema ve SDK kullanımı bir arada: [`examples/06-theme-v2-section.liquid`](../examples/06-theme-v2-section.liquid).

## Güvenlik

SDK tarayıcıda çalışır; içine koyduğunuz her şey ziyaretçiye görünür. Yönetim token'ı, geliştirici token'ı
(`crft_pat_…`), sunucu token'ı (`cct_…`) ya da herhangi bir API gizli anahtarı tema koduna ve `assets/` dosyalarına
yazılmaz (`crafter theme check`: `secret_embedded`).

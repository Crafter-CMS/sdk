# 🛒 Mağaza & Sepet Modülü (`crafter.store` & `crafter.cart`)

Sunucunun ürün kataloglarını listeleme, kategori bazlı filtreleme, sepette toplu indirim ayarları ve site bakiyesinden anında satın alma işlemlerini yönetir.

---

## 📌 Mağaza Modülü (`crafter.store`)

### 1. `getCategories()` & `getCategory(categoryId)`
Mağazadaki tüm kategorileri veya tek bir kategorinin detayını getirir.

* **HTTP Rota:** `GET /categories` & `GET /categories/:categoryId`
* **Dönüş:** `Category[]` (`id, name, slug, description, image, order`)
* **Örnek:**
  ```javascript
  const categories = await crafter.store.getCategories();
  categories.forEach(cat => {
    console.log(`[${cat.name}] - Slug: ${cat.slug}`);
  });
  ```

---

### 2. `getProducts()` & `getProduct(productId)`
Mağazadaki tüm ürünleri veya tek bir ürünün detayını getirir.

* **HTTP Rota:** `GET /products` & `GET /products/:productId`
* **Dönüş:** `Product[]`
  ```typescript
  interface Product {
    id: string;
    name: string;
    slug?: string;
    price: number;
    discountPrice?: number;
    category: string;       // Kategori ID'si
    server_id: string;      // Ait olduğu sunucu ID'si
    images: string[];       // Ürün görselleri dizisi
    stock: number;          // Kalan stok (-1 limitsiz)
    discountType?: 'percentage' | 'fixed' | null;
    discountValue?: number;
    server_commands?: string[];
    description?: string;
  }
  ```
* **Örnek:**
  ```javascript
  const products = await crafter.store.getProducts();
  const firstProduct = products[0];
  console.log(`${firstProduct.name} - Fiyat: ${firstProduct.price}`);
  ```

---

### 3. `getProductsByCategory(categoryId)`
Belirli bir kategoriye ait ürünleri filtreler.

* **HTTP Rota:** `GET /products/by-category/:categoryId`
* **Örnek:**
  ```javascript
  const vips = await crafter.store.getProductsByCategory('vip-kategori-id');
  ```

---

### 4. `getConfig()` (Toplu İndirim / Bulk Discount)
Yöneticinin mağaza için belirlediği genel ayarları ve aktif **sepette toplu indirim** kurallarını getirir.

* **HTTP Rota:** `GET /config/marketplace`
* **Dönüş:**
  ```typescript
  interface MarketplaceConfig {
    bulkDiscount?: {
      type: 'percentage' | 'fixed';
      amount: number;       // Örneğin %20 için 20
      expireDate?: string;  // İndirimin biteceği tarih
      products?: string[];  // İndirimin geçerli olduğu ürün ID'leri (boşsa tümü)
    } | null;
  }
  ```
* **Örnek:**
  ```javascript
  const config = await crafter.store.getConfig();
  if (config.bulkDiscount) {
    console.log(`Sepette %${config.bulkDiscount.amount} İndirim Kampanyası Aktif!`);
  }
  ```

---

## 🛍️ Sepet & Satın Alma (`crafter.cart` / `crafter.marketplace`)

### Sepet içeriği ve nerede tutulduğu (#447, #434)

`get()`, `add(product, qty?)`, `update(id, qty)`, `remove(id)`, `clear()`, `setCoupon(code)`, `removeCoupon()` hepsi
`CartState` döner: `items`, `itemCount`, `subtotal`, `discount` (kupon indirimi), `total` (`subtotal - discount`; hepsi
mağaza para biriminde), `currency`, `coupon`, `couponDetails`; storefront sepetinde ayrıca `removed[]` (satıştan kalkan /
tükenen ürün), `adjusted[]` (stoğa göre düşürülen adet) ve `couponRemoved` (geçersizleşip düşürülen kupon). Her
değişiklikte `crafter:cart:updated` yayılır.

- **Storefront içinde** (sayfa bağlamında `routes.cartApi` varsa, SDK 1.5.0+): sepet storefront'un `/cart.js`,
  `/cart/add.js`, `/cart/change.js`, `/cart/clear.js`, `/cart/coupon.js` uçlarındadır. Ziyaretçide imzalı `httpOnly`
  çerezde, giriş/kayıtta hesaba katılır ve cihazlar arası aynı kalır. Fiyat gönderilmez; sunucu güncel üründen hesaplar
  (`add({ id })` yeterli). Eski localStorage sepeti ilk işlemde bir kez sunucuya taşınır. Sekmeler arası
  `crafter_cart_sync` sinyaliyle güncellenir. Hata: `CrafterError` (`409 cart_product_unavailable`, `422 cart_full`,
  `503 cart_unavailable`).
- **Headless** (bağlam yoksa): localStorage `cart` / `crafter_cart_coupon`; fiyat `add()` ile verilen değerdir.

```js
try {
  const cart = await crafter.cart.add({ id: 'prod_123' }, 2);
  if (cart.adjusted?.length) console.log('Stok kadar eklendi');
} catch (error) {
  if (error.type === 'cart_product_unavailable') alert('Ürün şu anda satın alınamıyor');
}
```

### Kupon (#476, SDK 1.5.1+)

Storefront sepetinde `setCoupon(code)` kuponu sunucuda hemen doğrular. Geçerliyse dönen sepette `discount`, `total` ve
`couponDetails` (`code`, `type`: `'percentage' | 'fixed' | 'free_product'`, `value`, `freeProductId`) doludur. Geçersizse
`CrafterCouponError` fırlatılır (HTTP 422): `type` bir `CouponErrorType` kodudur, `message` sayfanın dilindedir ve doğrudan
gösterilebilir, `coupon_cart_total_below_minimum` için `minCartValue` (`details.minCartValue`) gelir. Reddedilen kupon
sepete yazılmaz, sepet değişmez ve olay yayılmaz. `removeCoupon()` (ya da `setCoupon(null)` / boş kod) kuponu kaldırır.

Saklı kupon sonradan geçersizleşirse (ör. ürün silinip tutar alt sınırın altına düştü) sunucu kuponu düşürür ve sepette
bir kez `couponRemoved: { code, reason }` bildirir; `reason` aynı `CouponErrorType` kodlarıdır. Eski localStorage kuponu
(`crafter_cart_coupon`) taşınırken de yalnızca sunucu kabul ederse sepete geçer; reddedilirse satırlar korunur, kupon
düşer ve `couponRemoved` bildirilir.

Kupon hata kodları (`CouponErrorType`): `coupon_not_found`, `coupon_inactive`, `coupon_usage_limit_reached`,
`coupon_already_used_by_user`, `coupon_not_assigned_to_user`, `coupon_cart_total_below_minimum`,
`coupon_invalid_for_product`, `coupon_invalid_type`.

```js
import { isCouponError } from '@crafter-cms/sdk';

try {
  const cart = await crafter.cart.setCoupon(input.value);
  showTotals(crafter.money.format(cart.discount), crafter.money.format(cart.total));
} catch (error) {
  if (isCouponError(error)) showCouponError(error.message); // sayfanın dilinde
  else throw error;
}

crafter.dom.on('cart:updated', (cart) => {
  if (cart.couponRemoved) notify(`${cart.couponRemoved.code} kuponu artık geçerli değil`);
});
```

localStorage sepeti (headless) kuponu doğrulayamaz: kodu saklar; `discount` her zaman 0, `total` = `subtotal`,
`couponDetails` null. İndirimi checkout hesaplar.

### 5. `purchase(data)` (Bakiye ile Satın Alma)
Kullanıcının site bakiyesini kullanarak sepetindeki ürünleri satın almasını sağlar.

* **HTTP Rota:** `POST /marketplace/purchase`
* **Girdi:**
  ```typescript
  interface PurchaseDto {
    productIds: string[];   // Satın alınacak ürünlerin ID dizisi
    coupon?: string;        // Opsiyonel indirim kuponu kodu (veya couponCode)
  }
  ```
* **Dönüş:**
  ```json
  {
    "success": true,
    "message": "Products purchased successfully",
    "type": "success"
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  try {
    const res = await crafter.cart.purchase({
      productIds: ['prod-uuid-1', 'prod-uuid-2'],
      coupon: 'YAZ2026' // Opsiyonel kupon kodu
    });

    alert(res.message);
    // Satın alım sonrası bakiyeyi güncelle:
    const balance = await crafter.users.getBalance('me');
    document.querySelector('#user-balance').innerText = balance.balance;
  } catch (err) {
    // Örneğin Yetersiz Bakiye durumunda (HTTP 400):
    alert('Satın alma başarısız: ' + err.message);
  }
  ```

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

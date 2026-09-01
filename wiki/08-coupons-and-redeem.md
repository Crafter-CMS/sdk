# 🎟️ Kuponlar & Hediye Kodları (`crafter.coupons` & `crafter.redeemCode`)

İndirim kuponu sorgulama, sepet indirimi kontrolü ve promosyon / hediye kartı bozdurma işlemlerini yönetir.

---

## 📌 Kupon Modülü (`crafter.coupons`)

### 1. `get(couponCode)`
Kullanıcının sepet sayfasında girdiği indirim kuponunun geçerli olup olmadığını, indirim miktarını ve sepet kısıtlamalarını kontrol eder.

* **HTTP Rota:** `GET /coupons/:couponCode`
* **Dönüş:** `CouponResponse`
  ```typescript
  interface CouponResponse {
    id?: string;
    code: string;
    minCartValue?: number;              // Minimum sepet tutarı şartı
    productId?: string | null;          // Sadece belirli bir ürüne mi özel?
    discountValue: number;              // İndirim miktarı (Örn: 20)
    discountType: 'percentage' | 'fixed'; // % mi yoksa sabit tutar mı?
    isActive: boolean;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  try {
    const coupon = await crafter.coupons.get('BAHAR2026');
    if (coupon.isActive) {
      if (coupon.discountType === 'percentage') {
        console.log(`%${coupon.discountValue} İndirim Uygulandı!`);
      } else {
        console.log(`${coupon.discountValue} TL İndirim Uygulandı!`);
      }
    }
  } catch (err) {
    alert('Geçersiz veya süresi dolmuş kupon kodu!');
  }
  ```

---

## 🎁 Hediye / Promosyon Kodları (`crafter.redeemCode`)

Yöneticilerin çekilişlerde veya YouTube sponsorluklarında dağıttığı tek kullanımlık bonus veya ürün veren kodları bozdurur.

### 2. `use(code)`
* **HTTP Rota:** `POST /redeem-codes/use`
* **Girdi:** `{ code: string }`
* **Dönüş:**
  ```typescript
  interface UseRedeemCodeResponse {
    bonus?: number;       // Yüklenen bakiye/kredi miktarı
    products?: Array<{    // Sandığa eklenen hediye ürünler
      id: string;
      name: string;
    }>;
    success?: boolean;
    message?: string;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  try {
    const res = await crafter.redeemCode.use('YOUTUBE-BONUS-100');
    if (res.bonus) {
      alert(`Tebrikler! Hesabınıza ${res.bonus} TL bakiye yüklendi.`);
    }
    if (res.products?.length) {
      alert(`Tebrikler! ${res.products.map(p => p.name).join(', ')} sandığınıza eklendi.`);
    }
  } catch (err) {
    alert('Kod kullanılamadı: ' + err.message);
  }
  ```

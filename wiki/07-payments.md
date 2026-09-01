# 💳 Ödeme İşlemleri Modülü (`crafter.payments`)

Kredi kartı, banka kartı, havale veya mobil ödeme yöntemleriyle siteye bakiye yükleme süreçlerini yönetir.

---

## 📌 Metotlar ve Kullanım Örnekleri

### 1. `getPublicProviders()`
Sitede müşterilere açık olan ödeme sağlayıcılarını (PayTR, Shopier, CrafterPayments vb.), minimum/maksimum tutarları ve bonus çarpanlarını listeler.

* **HTTP Rota:** `GET /config/payment/public`
* **Dönüş:** `PublicPaymentProvider[]`
  ```typescript
  interface PublicPaymentProvider {
    id: string;             // Sağlayıcı UUID'si (initiate çağrısında kullanılır!)
    provider: string;       // 'paytr', 'shopier', 'crafterpayments' vb.
    name: string;           // Ekranda gösterilecek isim (Örn: 'Kredi Kartı (PayTR)')
    isActive: boolean;
    minAmount: number;      // Minimum yüklenebilecek tutar
    maxAmount: number;      // Maksimum yüklenebilecek tutar
    creditMultipler: number;// Bonus çarpanı (Örn: 1.10 = %10 Bonus Kredi)
    commissionRate?: number;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const providers = await crafter.payments.getPublicProviders();
  providers.forEach(p => {
    console.log(`${p.name} (Min: ${p.minAmount} TL - Bonus: x${p.creditMultipler})`);
  });
  ```

---

### 2. `initiate(data)`
Yeni bir ödeme oturumu başlatır ve iframe token'ı veya yönlendirme URL'i alır.

* **HTTP Rota:** `POST /payment/initiate`
* **Girdi:**
  ```typescript
  interface InitiatePaymentDto {
    amount: number;         // Yüklenecek tutar
    providerId: string;     // getPublicProviders()'dan gelen provider ID
    currency?: string;      // Varsayılan: 'TRY'
    user: {
      name: string;
      email: string;
      phone?: string;
      address?: string;
    };
  }
  ```
* **Dönüş:**
  ```typescript
  interface InitiatePaymentResponse {
    token?: string;         // PayTR iframe token'ı
    iframeUrl?: string;     // Doğrudan iframe içine gömülecek URL
    paymentUrl?: string;    // Yönlendirilecek dış sayfa (Shopier vb.)
    paymentId?: string;     // Ödeme takip ID'si
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const res = await crafter.payments.initiate({
    amount: 100,
    providerId: 'provider-uuid-paytr',
    user: {
      name: 'Ahmet Yılmaz',
      email: 'ahmet@example.com',
      phone: '05551234567'
    }
  });

  if (res.iframeUrl) {
    // Iframe içine göm
    document.querySelector('#payment-iframe').src = res.iframeUrl;
  } else if (res.paymentUrl) {
    // Dış ödeme sayfasına yönlendir
    window.location.href = res.paymentUrl;
  }
  ```

---

### 3. `check(paymentId)`
Başlatılan bir ödemenin onaylanıp onaylanmadığını kontrol eder (Poller veya kontrol sayfası).

* **HTTP Rota:** `POST /payment/check`
* **Dönüş:** `{ success: boolean, status: 'PENDING' | 'SUCCESS' | 'FAILED', paymentId: string, amount?: number }`
* **Örnek:**
  ```javascript
  const status = await crafter.payments.check('pay-123456');
  if (status.status === 'SUCCESS') {
    alert('Ödemeniz onaylandı, krediniz hesabınıza yüklendi!');
  }
  ```

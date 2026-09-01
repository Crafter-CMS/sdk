# 📜 Hukuki Belgeler & Şikayetler (`crafter.legal` & `crafter.reports`)

Kullanım koşulları, kurallar, gizlilik politikası ve oyuncuların kural ihlallerini yetkililere bildirmesini yönetir.

---

## 📌 Hukuki Belgeler (`crafter.legal`)

### 1. `getDocuments()`
Yöneticinin panelden girdiği sunucu kuralları, gizlilik politikası ve kullanıcı sözleşmesini tek nesnede getirir.

* **HTTP Rota:** `GET /config/legal`
* **Dönüş:**
  ```typescript
  interface LegalDocuments {
    rules?: string;             // Sunucu & Site Kuralları HTML/Markdown
    privacy_policy?: string;    // Gizlilik Politikası
    terms_of_service?: string;  // Kullanım Şartları
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const docs = await crafter.legal.getDocuments();

  if (docs.rules) {
    document.querySelector('#server-rules').innerHTML = docs.rules;
  }
  ```

---

## 🚨 Şikayet & Rapor Modülü (`crafter.reports`)

Kullanıcıların hile yapan, küfür eden veya kural ihlalinde bulunan oyuncuları yetkililere rapor etmesini sağlar.

### 2. `create(reportedUserId, data)`
* **HTTP Rota:** `POST /reports/:reportedUserId`
* **Girdi:**
  ```typescript
  interface CreateReportDto {
    reportType: 'spam' | 'harassment' | 'inappropriate_content' | 'fraud' | 'other';
    reason: string; // Şikayet açıklaması
  }
  ```
* **Dönüş:**
  ```typescript
  interface ReportResponse {
    id: string;
    reporterId: string;
    reportedUserId: string;
    reportType: string;
    reason: string;
    status: 'pending' | 'resolved' | 'dismissed';
    createdAt: string;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  try {
    const report = await crafter.reports.create('oyuncu-uuid', {
      reportType: 'harassment',
      reason: 'Oyun içi sohbette ailevi değerlere hakaret etti.'
    });

    alert('Şikayetiniz yetkili ekibine iletildi. Bilet No: #' + report.id.slice(0, 6));
  } catch (err) {
    alert('Şikayet gönderilemedi: ' + err.message);
  }
  ```

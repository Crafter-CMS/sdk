# 📝 Yetkili Başvuru Formları (`crafter.staffForms`)

Sunucu için yetkili (Rehber, Moderatör, Mimar, Geliştirici vb.) alım formlarını listeleme, dinamik form alanlarını çizme ve başvuru gönderme süreçlerini yönetir.

---

## 📌 Metotlar ve Kullanım Örnekleri

### 1. `list()`
Açık ve aktif olan yetkili alım formlarını listeler.

* **HTTP Rota:** `GET /staff-forms`
* **Dönüş:** `StaffFormItem[]`
  ```typescript
  interface StaffFormInput {
    id: string;             // Form input alanı ID'si
    name: string;           // Soru başlığı (Örn: 'Günde kaç saat aktif olabilirsiniz?')
    type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox';
    index: number;          // Sıralama indeksi
    required?: boolean;
  }

  interface StaffFormItem {
    id: string;
    title: string;          // Örn: 'Rehber Alımları'
    description?: string;
    inputs: StaffFormInput[];
    isActive: boolean;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const forms = await crafter.staffForms.list();
  forms.forEach(f => {
    console.log(`${f.title} (${f.inputs.length} Soru) -> /basvuru/${f.id}`);
  });
  ```

---

### 2. `get(formId)`
Tek bir başvuru formunun detayını ve tüm soru alanlarını çeker.

* **HTTP Rota:** `GET /staff-forms/:formId`
* **Örnek:**
  ```javascript
  const form = await crafter.staffForms.get('form-uuid');
  form.inputs.forEach(input => {
    console.log(`[${input.type}] ${input.name}`);
  });
  ```

---

### 3. `apply(formId, answers)`
Başvuru sorularının cevaplarını sunucuya gönderir.

SDK, cevapları **iki farklı formatta da** kabul eder ve backend'in beklediği `values: [{ inputId, value }]` formatına otomatik dönüştürür:

#### Format A: Key-Value Nesnesi (Önerilen En Kolay Kullanım)
```javascript
await crafter.staffForms.apply('form-uuid', {
  'input-id-yas': 19,
  'input-id-deneyim': 'Daha önce 2 sunucuda modluk yaptım.',
  'input-id-discord': 'soro#0001'
});
```

#### Format B: Dizi Formatı
```javascript
await crafter.staffForms.apply('form-uuid', [
  { inputId: 'input-id-yas', value: '19' },
  { inputId: 'input-id-deneyim', value: '...' }
]);
```

* **Dönüş:**
  ```typescript
  interface StaffFormApplicationResponse {
    id: string;
    userId: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
  }
  ```

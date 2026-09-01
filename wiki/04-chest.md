# 📦 Oyuncu Sandığı Modülü (`crafter.chest`)

Satın alınan veya hediye edilen ürünlerin oyuna aktarılmadan önce bekletildiği web envanterini yönetir. Eşyayı oyun içi sunucuya gönderme (kullanma) ve başka bir kullanıcıya hediye etme işlemlerini kapsar.

---

## 📌 Metotlar ve Kullanım Örnekleri

### 1. `getItems(userId?)`
Kullanıcının sandığındaki eşyaları listeler.

* **HTTP Rota:** `GET /chest/:userId`
* **Varsayılan Parametre:** `'me'`
* **Dönüş:** `ChestItem[]`
  ```typescript
  interface ChestItem {
    id: string;
    product?: {
      id: string;
      name: string;
      server_id?: string;
    };
    used: boolean;      // Eşya kullanıldı mı?
    createdAt?: string;
    updatedAt?: string;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const items = await crafter.chest.getItems('me');

  // Henüz kullanılmamış aktif sandık eşyaları:
  const activeItems = items.filter(item => !item.used);
  console.log(`Sandıkta ${activeItems.length} adet teslim alınmamış eşyanız var.`);
  ```

---

### 2. `useItem(chestItemId, userId?)`
Sandıktaki bir eşyayı oyuna aktarmak üzere kullanır (Sunucuya komut gönderilir).

* **HTTP Rota:** `POST /chest/:userId/use/:chestItemId`
* **Varsayılan Parametre:** `userId = 'me'`
* **Dönüş:**
  ```json
  {
    "success": true,
    "message": "Eşya başarıyla kullanıldı ve sunucuya iletildi.",
    "item": {
      "id": "item-uuid",
      "used": true,
      "updatedAt": "2026-09-01T12:00:00.000Z"
    }
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  try {
    const res = await crafter.chest.useItem('chest-item-123');
    alert('Eşyanız oyuna teslim edildi!');
  } catch (err) {
    alert('Eşya kullanılamadı: ' + err.message);
  }
  ```

---

### 3. `giftItem(targetUserId, chestItemId, fromUserId?)`
Sandıktaki henüz kullanılmamış bir eşyayı başka bir oyuncunun sandığına hediye olarak aktarır.

* **HTTP Rota:** `POST /chest/:from/gift/:to/:chestItemId`
* **Varsayılan Parametre:** `fromUserId = 'me'`
* **Dönüş:**
  ```json
  {
    "success": true,
    "message": "Eşya başarıyla hediye edildi.",
    "newChestItem": {
      "id": "yeni-esya-id",
      "used": false
    }
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  await crafter.chest.giftItem('@ArkadasiminAdi', 'chest-item-123');
  alert('Eşya başarıyla arkadaşınıza hediye edildi!');
  ```

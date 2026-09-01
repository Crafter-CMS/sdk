# 📊 İstatistikler & Cezalar (`crafter.statistics` & `crafter.punishments`)

Sunucunun canlı akış verilerini (son satın alımlar, son ödemeler, en çok kredi yükleyenler) ve oyuncu ceza geçmişini (Ban, Mute, Warn) yönetir.

---

## 📌 İstatistikler Modülü (`crafter.statistics`)

Ana sayfadaki canlı vitrinleri ve lider tablolarını beslemek için kullanılır.

### 1. `get(limit?)`
Son ödemeleri, son mağaza satın alımlarını, son kayıt olan oyuncuları ve en çok kredi yükleyenleri (Leaderboard) tek bir istekte toplar.

* **HTTP Rota:** `GET /v2/statistics?limit=:limit`
* **Varsayılan Limit:** `5`
* **Dönüş:**
  ```typescript
  interface SiteStatistics {
    latest: {
      payments: Array<{ id: string; username: string; amount: number; paymentMethod: string; timestamp: string }>;
      purchases: Array<{ id: string; username: string; productName: string; serverName: string; amount: number; timestamp: string }>;
      signups: Array<{ id: string; username: string; timestamp: string }>;
    };
    topCreditLoaders: Array<{ id: string; username: string; totalAmount: number }>;
    totalUsers: number;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const stats = await crafter.statistics.get(5);

  // 1. Son Satın Alımlar Akışı
  stats.latest.purchases.forEach(p => {
    console.log(`${p.username}, ${p.serverName} sunucusunda ${p.productName} satın aldı.`);
  });

  // 2. Lider Tablosu (En Çok Kredi Yükleyenler)
  stats.topCreditLoaders.forEach((loader, index) => {
    console.log(`#${index + 1} - ${loader.username}: ${loader.totalAmount} TL`);
  });

  // 3. Toplam Oyuncu Sayısı
  document.querySelector('#total-users').innerText = stats.totalUsers;
  ```

---

## ⚖️ Ceza & Yasaklama Modülü (`crafter.punishments`)

Oyun sunucularındaki yasaklama (Ban), susturma (Mute), uyarı (Warn) veya atılma (Kick) kayıtlarını listeler ve arar.

### 2. `list(page?, limit?)`
Aktif ve geçmiş tüm cezaları sayfalanmış olarak listeler.

* **HTTP Rota:** `GET /v2/punishments`
* **Dönüş:**
  ```typescript
  interface PaginatedPunishmentsResponse {
    punishments: Array<{
      id: string | number;
      name: string;             // Cezalandırılan oyuncu
      reason: string;           // Ceza sebebi
      operator: string;         // Cezayı uygulayan yetkili
      punishmentType: 'ban' | 'mute' | 'kick' | 'warn';
      start: number;            // Başlangıç timestamp (ms)
      end: number;              // Bitiş timestamp (ms) (-1 sınırsız)
      active: boolean;          // Ceza halen devam ediyor mu?
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const res = await crafter.punishments.list(1, 20);
  res.punishments.forEach(p => {
    console.log(`[${p.punishmentType.toUpperCase()}] ${p.name} - Sebep: ${p.reason} (Yetkili: ${p.operator})`);
  });
  ```

---

### 3. `search(query, type?)`
Oyuncu adına ve opsiyonel ceza türüne göre anlık arama yapar.

* **HTTP Rota:** `GET /v2/punishments/search?query=:query&type=:type`
* **Örnek:**
  ```javascript
  // 'oyuncu_adi' isimli oyuncunun ban kayıtlarını ara:
  const bans = await crafter.punishments.search('oyuncu_adi', 'ban');
  ```

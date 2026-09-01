# 🌐 Sunucular & Oy Verme (`crafter.servers` & `crafter.vote`)

Bağlı Minecraft sunucularının anlık durumunu (online oyuncu sayısı, ping, IP) ve sunucu listelerindeki oy verme bağlantılarını yönetir.

---

## 📌 Sunucu Durumu Modülü (`crafter.servers`)

### 1. `getList()`
Yöneticinin sisteme tanımladığı sunucuları ve anlık ping/oyuncu sayılarını getirir.

* **HTTP Rota:** `GET /config/servers`
* **Dönüş:** `ServerStatusItem[]`
  ```typescript
  interface ServerStatusItem {
    id: string;
    name: string;           // Örn: 'Survival 1.20', 'SkyBlock'
    ip: string;             // Örn: 'oyna.sunucum.com'
    port: number;
    image?: string;
    isListed?: boolean;
    slug?: string;
    onlinePlayers?: number; // Anlık çevrim içi oyuncu sayısı
    maxPlayers?: number;    // Sunucu slot kapasitesi
    isOnline?: boolean;     // Sunucu açık mı?
    ping?: number;          // Gecikme süresi (ms)
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const servers = await crafter.servers.getList();

  let totalOnline = 0;
  servers.forEach(srv => {
    totalOnline += (srv.onlinePlayers || 0);
    console.log(`${srv.name}: ${srv.onlinePlayers}/${srv.maxPlayers} Aktif`);
  });

  document.querySelector('#total-online').innerText = totalOnline;
  ```

---

## 🗳️ Oy Verme Modülü (`crafter.vote`)

Minecraft sunucu listelerinde (Minecraft-MP, TopG vb.) sunucuya oy veren oyuncuların ödül kazanmasını yönetir.

### 2. `getProviders()`
Aktif oy sitelerini ve bekleme sürelerini (cooldown) listeler.

* **HTTP Rota:** `GET /config/vote-providers`
* **Dönüş:** `VoteProviderItem[]` (`id, name, url, cooldownHours, isActive`)
* **Örnek:**
  ```javascript
  const providers = await crafter.vote.getProviders();
  providers.forEach(p => {
    console.log(`${p.name} - ${p.url} (Her ${p.cooldownHours} saatte bir)`);
  });
  ```

---

### 3. `vote(providerId, extraData?)`
Oy verme isteğini işler ve kullanıcının bir sonraki oy verebileceği zamanı kaydeder.

* **HTTP Rota:** `POST /config/vote-providers/vote`
* **Girdi:** `{ providerId: string }`
* **Dönüş:** `{ success: true, message: string, canVoteAt?: string }`
* **Örnek:**
  ```javascript
  const res = await crafter.vote.vote('provider-uuid');
  console.log(`Oy kaydedildi! Bir sonraki oy: ${res.canVoteAt}`);
  ```

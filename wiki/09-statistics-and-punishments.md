# 📊 Statistics & Punishments (`crafter.statistics` & `crafter.punishments`)

Handles the server's live feed data (latest purchases, latest payments, top spenders) and player punishment history (ban, mute, warn).

---

## 📌 Statistics Module (`crafter.statistics`)

Used to feed the live showcases and leaderboards on the home page.

### 1. `get(limit?)`
Gathers the latest payments, latest store purchases, newest registered players and top spenders (leaderboard) in a single request.

* **HTTP Route:** `GET /v2/statistics?limit=:limit`
* **Default limit:** `5`
* **Returns:**
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
* **Example usage:**
  ```javascript
  const stats = await crafter.statistics.get(5);
  const { currency } = await crafter.website.getInfo(); // amounts are in the store currency

  // 1. Latest purchases feed
  stats.latest.purchases.forEach(p => {
    console.log(`${p.username} bought ${p.productName} on ${p.serverName}.`);
  });

  // 2. Leaderboard (top spenders)
  stats.topCreditLoaders.forEach((loader, index) => {
    console.log(`#${index + 1} - ${loader.username}: ${Crafter.utils.formatMoney(loader.totalAmount, currency)}`);
  });

  // 3. Total player count
  document.querySelector('#total-users').innerText = stats.totalUsers;
  ```

---

## ⚖️ Punishments & Bans Module (`crafter.punishments`)

Lists and searches ban, mute, warn or kick records on the game servers.

### 2. `list(page?, limit?)`
Lists all active and past punishments, paginated.

* **HTTP Route:** `GET /v2/punishments`
* **Returns:**
  ```typescript
  interface PaginatedPunishmentsResponse {
    punishments: Array<{
      id: string | number;
      name: string;             // Punished player
      reason: string;           // Punishment reason
      operator: string;         // Staff member who applied the punishment
      punishmentType: 'ban' | 'mute' | 'kick' | 'warn';
      start: number;            // Start timestamp (ms)
      end: number;              // End timestamp (ms) (-1 permanent)
      active: boolean;          // Is the punishment still in effect?
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
* **Example usage:**
  ```javascript
  const res = await crafter.punishments.list(1, 20);
  res.punishments.forEach(p => {
    console.log(`[${p.punishmentType.toUpperCase()}] ${p.name} - Sebep: ${p.reason} (Yetkili: ${p.operator})`);
  });
  ```

---

### 3. `search(query, type?)`
Searches instantly by player name and an optional punishment type.

* **HTTP Route:** `GET /v2/punishments/search?query=:query&type=:type`
* **Example:**
  ```javascript
  // Search the ban records of the player named 'player_name':
  const bans = await crafter.punishments.search('player_name', 'ban');
  ```

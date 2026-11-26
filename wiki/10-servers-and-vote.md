# 🌐 Servers & Voting (`crafter.servers` & `crafter.vote`)

Handles the live status of connected Minecraft servers (online players, ping, IP) and the voting links on server lists.

---

## 📌 Server Status Module (`crafter.servers`)

### 1. `getList()`
Fetches the servers the admin defined in the system along with live ping/player counts.

* **HTTP Route:** `GET /config/servers`
* **Returns:** `ServerStatusItem[]`
  ```typescript
  interface ServerStatusItem {
    id: string;
    name: string;           // e.g. 'Survival 1.20', 'SkyBlock'
    ip: string;             // e.g. 'play.example.com'
    port: number;
    image?: string;
    isListed?: boolean;
    slug?: string;
    onlinePlayers?: number; // Live online player count
    maxPlayers?: number;    // Server slot capacity
    isOnline?: boolean;     // Is the server up?
    ping?: number;          // Latency (ms)
  }
  ```
* **Example usage:**
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

## 🗳️ Voting Module (`crafter.vote`)

Handles rewards for players who vote for the server on Minecraft server lists (Minecraft-MP, TopG, etc.).

### 2. `getProviders()`
Lists the active vote sites and their cooldowns.

* **HTTP Route:** `GET /config/vote-providers`
* **Returns:** `VoteProviderItem[]` (`id, name, url, cooldownHours, isActive`)
* **Example:**
  ```javascript
  const providers = await crafter.vote.getProviders();
  providers.forEach(p => {
    console.log(`${p.name} - ${p.url} (every ${p.cooldownHours} hours)`);
  });
  ```

---

### 3. `vote(providerId, extraData?)`
Processes the vote request and records when the user can vote next.

* **HTTP Route:** `POST /config/vote-providers/vote`
* **Input:** `{ providerId: string }`
* **Returns:** `{ success: true, message: string, canVoteAt?: string }`
* **Example:**
  ```javascript
  const res = await crafter.vote.vote('provider-uuid');
  console.log(`Vote recorded! Next vote: ${res.canVoteAt}`);
  ```

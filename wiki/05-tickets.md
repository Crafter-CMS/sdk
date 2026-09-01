# 🎫 Destek Talepleri Modülü (`crafter.tickets`)

Kullanıcıların site üzerinden yetkililere destek talebi açmasını, mesajlaşmasını, biletleri kapatmasını ve yeniden açmasını yönetir.

---

## 📌 Metotlar ve Kullanım Örnekleri

### 1. `list()` & `get(ticketId)`
Kullanıcının tüm destek biletlerini veya belirli bir biletin tüm yazışma geçmişini getirir.

* **HTTP Rota:** `GET /v2/tickets` & `GET /v2/tickets/:ticketId`
* **Dönüş:** `Ticket[]` / `Ticket`
  ```typescript
  interface Ticket {
    id: string;
    title: string;
    category?: string;
    categoryDetails?: { id: string; name: string };
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
    createdByUserId: string;
    createdByUser?: { id: string; username: string };
    messages?: Array<{
      id?: string;
      senderId?: string;
      content: Record<string, any> | string;
      sender?: { id: string; username: string; email: string | null };
      createdAt: string;
    }>;
    createdAt: string;
    updatedAt?: string;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const tickets = await crafter.tickets.list();
  tickets.forEach(ticket => {
    console.log(`[${ticket.status}] #${ticket.id.slice(0, 8)} - ${ticket.title}`);
  });
  ```

---

### 2. `getCategories()`
Destek bileti oluştururken seçilebilecek departman/kategori listesini getirir.

* **HTTP Rota:** `GET /v2/tickets/categories`
* **Dönüş:** `TicketCategory[]` (`id, name, description`)
* **Örnek:**
  ```javascript
  const categories = await crafter.tickets.getCategories();
  const select = document.querySelector('#category-select');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.text = cat.name;
    select.appendChild(opt);
  });
  ```

---

### 3. `create(data)`
Yeni bir destek talebi oluşturur.

* **HTTP Rota:** `POST /v2/tickets`
* **Girdi:**
  ```typescript
  interface CreateTicketDto {
    title: string;
    categoryId: string; // Zorunlu!
    message: string;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const newTicket = await crafter.tickets.create({
    title: 'Ödeme yaptıktan sonra kredim gelmedi',
    categoryId: 'finans-kategori-id',
    message: 'Merhaba, 10 dakika önce PayTR üzerinden ödeme yaptım ancak bakiyem güncellenmedi.'
  });

  console.log('Bilet açıldı, ID:', newTicket.id);
  ```

---

### 4. `reply(ticketId, message)`
Açık olan bir destek talebine yeni bir yanıt mesajı gönderir.

* **HTTP Rota:** `POST /v2/tickets/:ticketId/reply`
* **Örnek Kullanım:**
  ```javascript
  const updatedTicket = await crafter.tickets.reply('ticket-123', 'Dekont ektedir: https://...');
  ```

---

### 5. `close(ticketId, reason?)` & `open(ticketId)`
Destek biletini kapatır veya çözülememişse yeniden açar.

* **HTTP Rota:** `POST /v2/tickets/:ticketId/close` & `POST /v2/tickets/:ticketId/open`
* **Örnek Kullanım:**
  ```javascript
  // Talebi kapat:
  await crafter.tickets.close('ticket-123', 'Sorunum çözüldü, teşekkürler.');

  // Yeniden aç:
  await crafter.tickets.open('ticket-123');
  ```

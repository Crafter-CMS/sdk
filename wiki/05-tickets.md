# 🎫 Support Tickets Module (`crafter.tickets`)

Lets users open support tickets to the staff through the site, exchange messages, and close and reopen tickets.

---

## 📌 Methods and Usage Examples

### 1. `list()` & `get(ticketId)`
Fetches all of the user's support tickets or the full message history of a single ticket.

* **HTTP Route:** `GET /v2/tickets` & `GET /v2/tickets/:ticketId`
* **Returns:** `Ticket[]` / `Ticket`
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
* **Example usage:**
  ```javascript
  const tickets = await crafter.tickets.list();
  tickets.forEach(ticket => {
    console.log(`[${ticket.status}] #${ticket.id.slice(0, 8)} - ${ticket.title}`);
  });
  ```

---

### 2. `getCategories()`
Fetches the department/category list to choose from when creating a support ticket.

* **HTTP Route:** `GET /v2/tickets/categories`
* **Returns:** `TicketCategory[]` (`id, name, description`)
* **Example:**
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
Creates a new support ticket.

* **HTTP Route:** `POST /v2/tickets`
* **Input:**
  ```typescript
  interface CreateTicketDto {
    title: string;
    categoryId: string; // Required!
    message: string;
  }
  ```
* **Example usage:**
  ```javascript
  const newTicket = await crafter.tickets.create({
    title: 'My credit did not arrive after paying',
    categoryId: 'billing-category-id',
    message: 'Hello, I paid via PayTR 10 minutes ago but my balance was not updated.'
  });

  console.log('Ticket opened, ID:', newTicket.id);
  ```

---

### 4. `reply(ticketId, message)`
Sends a new reply message to an open support ticket.

* **HTTP Route:** `POST /v2/tickets/:ticketId/reply`
* **Example usage:**
  ```javascript
  const updatedTicket = await crafter.tickets.reply('ticket-123', 'The receipt is attached: https://...');
  ```

---

### 5. `close(ticketId, reason?)` & `open(ticketId)`
Closes the support ticket, or reopens it if it was not resolved.

* **HTTP Route:** `POST /v2/tickets/:ticketId/close` & `POST /v2/tickets/:ticketId/open`
* **Example usage:**
  ```javascript
  // Close the ticket:
  await crafter.tickets.close('ticket-123', 'My issue is resolved, thanks.');

  // Reopen:
  await crafter.tickets.open('ticket-123');
  ```

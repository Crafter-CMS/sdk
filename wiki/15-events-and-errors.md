# ⚡ Event Bus & Error Handling

The Crafter SDK includes a built-in **event listening system (Event Bus)** and a consistent **error class (`CrafterError`)** so themes can update the UI reactively without reloading the page.

---

## 📌 Reaktif Event Bus (`crafter.on`, `crafter.off`, `crafter.once`)

When the user does something (logging in, buying, sending balance, etc.), the SDK publishes global events in the background. Themes can listen to these events to update cart counts, balance boxes or notification popups instantly.

### Standard Events You Can Listen To

| Event Name | When It Fires | Data Returned (`payload`) |
| :--- | :--- | :--- |
| **`auth:login`** | When the user signs in successfully | `{ token?: string }` |
| **`auth:logout`** | When the user logs out | `void` |
| **`auth:token_refreshed`** | When the access token is refreshed | `{ token: string }` |
| **`user:updated`** | When the user updates their profile | `UserProfile` |
| **`balance:sent`** | When balance is transferred to another player | `SendBalanceResponse` |
| **`wall:message_added`** | When a new message is posted on a profile wall | `{ userId: string, message: WallMessage }` |
| **`wall:reply_added`** | When a message on a profile wall gets a reply | `{ userId: string, wallMessageId: string, reply: WallMessageReply }` |
| **`2fa:enabled`** | When 2FA is enabled (Authenticator/Email/Discord) | `{ method: string, recoveryCodes?: string[] }` |
| **`2fa:disabled`** | When 2FA is disabled | `{ method?: string }` |
| **`discord:linked`** | When a Discord account is linked | `{ discordId: string, discordUsername: string }` |
| **`discord:unlinked`** | When a Discord account is unlinked | `void` |
| **`cart:purchased`** | When a product is bought from the store | `PurchaseResponse` |
| **`chest:item_used`** | When an item from the chest is delivered in game | `{ itemId: string, response: UseChestItemResponse }` |
| **`chest:item_gifted`**| When an item from the chest is gifted to a friend | `{ targetUserId: string, itemId: string, response: GiftChestItemResponse }` |
| **`ticket:created`** | When a new support ticket is opened | `Ticket` |
| **`ticket:replied`** | When a message is posted to a support ticket | `{ ticketId: string, response: Ticket }` |
| **`ticket:closed`** | When a support ticket is closed | `{ ticketId: string, reason?: string, response: Ticket }` |
| **`ticket:opened`** | When a support ticket is reopened | `{ ticketId: string, response: Ticket }` |
| **`forum:topic_created`**| When a new forum topic is opened | `ForumTopic` |
| **`forum:message_added`**| When a new message is posted to a forum topic | `{ topicId: string, message: any }` |
| **`forum:reply_added`** | When a forum message gets a quoted reply | `{ messageId: string, reply: any }` |
| **`forum:topic_liked`** | When a forum topic is liked | `{ topicId: string, likeCount?: number }` |
| **`forum:topic_unliked`**| When a like is removed from a forum topic | `{ topicId: string, likeCount?: number }` |
| **`post:liked`** | When a post is liked | `LikePostResponse` |
| **`redeem:used`** | When a gift / promotion code is redeemed | `UseRedeemCodeResponse` |
| **`report:created`** | When a player is reported | `ReportResponse` |
| **`vote:success`** | When a vote is cast for the server | `{ providerId: string, response: any }` |
| **`form:submitted`** | When a staff application form is submitted | `{ formId: string, response: StaffFormApplicationResponse }` |
| **`payment:initiated`** | When a payment is started (iframe/redirect) | `InitiatePaymentResponse` |
| **`payment:checked`** | When a payment status is checked | `CheckPaymentResponse` |

### Example Usage:
```javascript
// Update the header balance automatically when a purchase completes
crafter.on('cart:purchased', async (order) => {
  console.log('Purchase successful:', order);
  const data = await crafter.users.getBalance('me');
  document.querySelector('#header-balance').innerText = data.balance;
  showToast('Purchase successful! Your item was added to your chest.');
});

// Reload the page on logout
crafter.on('auth:logout', () => {
  window.location.reload();
});

// Listen once:
crafter.once('auth:login', () => {
  console.log('Logged in for the first time!');
});
```

---

## ⚠️ Error Handling (`CrafterError`)

All HTTP errors (400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Server Error) are thrown as a standard `CrafterError` object.

### `CrafterError` Properties
```typescript
class CrafterError extends Error {
  statusCode: number;           // HTTP status code (400, 401, 404, 500, etc.)
  message: string;              // Readable error message
  error?: string;               // Backend error type (e.g. 'BAD_REQUEST')
  details?: Record<string, any>;// Validation errors or details
  isCrafterError: true;
}
```

### Safe Error Handling Example:
```javascript
try {
  await crafter.cart.purchase({ productIds: ['prod-1'] });
} catch (err) {
  if (err.isCrafterError) {
    if (err.statusCode === 401) {
      alert('Please log in first.');
      window.location.href = '/auth/login';
    } else if (err.statusCode === 400) {
      alert('Error: ' + err.message); // e.g. "Insufficient balance"
    } else {
      alert('Server error: ' + err.message);
    }
  } else {
    console.error('An unknown error occurred:', err);
  }
}
```

---

## 🌐 Dual-Mode Architecture (Storefront vs Direct)

The SDK detects the environment automatically:

1. **`storefront` mode (default):**
   * Enabled automatically in Liquid themes when `websiteId` is not given.
   * All requests go to the `/api/storefront` Next.js proxy on the same origin.
   * `websiteId` is resolved automatically from the domain (hostname).
   * The `crafter_token` HttpOnly cookie is managed automatically.
2. **`direct` mode (Headless / React / Vue / Mobile / Node.js):**
2. **`direct` Modu (Headless / React / Vue / Mobile / Node.js):**
   * Enabled automatically when `websiteId` is given in the configuration.
   * Requests go directly to `https://api.crafter.net.tr/website/{v2/}:websiteId/...`.
   * The JWT token is sent in the Authorization header.

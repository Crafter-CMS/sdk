# 👤 Users & Profile Module (`crafter.users`)

Handles fetching user profile info, lightweight balance lookups, balance transfers, profile wall messages, account 2FA security settings and Discord account links.

---

## 📌 Methods and Usage Examples

### 1. `getProfile(userId?)`
Fetches the user's detailed profile info.

* **HTTP Route:** `GET /v2/users/:userId`
* **Default parameter:** `'me'` (the logged-in user).
* **Lookup by username:** the `'@username'` format is supported.
* **Returns:** `UserProfile` (`id, username, email, balance, credit, role: { name, color }, avatar, playTime, averagePlayTime, twoFactorEnabled, isOnline, likes, comments, createdAt`)
* **Example usage:**
  ```javascript
  // Kendi profilim
  const myProfile = await crafter.users.getProfile('me');
  console.log('My rank:', myProfile.role?.name, 'My playtime:', myProfile.playTime);

  // Another player's profile
  const player = await crafter.users.getByUsername('player_name');
  ```

---

### 2. `getBalance(userId?)` (Fast & Lightweight Balance)
An optimized lightweight endpoint that fetches only the balance and currency without the full profile object.

* **HTTP Route:** `GET /v2/users/:userId/balance`
* **Returns:** `{ userId: string, username: string, balance: number, currency: string }`
* **Example usage:**
  ```javascript
  // When filling the balance box in the header:
  const data = await crafter.users.getBalance('me');
  document.querySelector('#header-balance').innerText = `${data.balance} ${data.currency}`;
  ```

---

### 3. `updateProfile(data, userId?)`
Updates the user's own email address (per the backend security policy, only the email can be changed in a self-update).

* **HTTP Route:** `PUT /v2/users/:userId`
* **Input:** `{ email: string }`
* **Example usage:**
  ```javascript
  await crafter.users.updateProfile({
    email: 'new-email@example.com'
  });
  ```

---

### 4. `sendBalance(params)` (Balance Transfer)
Sends site balance to another player.

* **HTTP Route:** `POST /v2/users/:userId/balance/send`
* **Input:**
  ```typescript
  interface SendBalanceParams {
    targetUserId: string; // Target player's ID or '@username'
    amount: number;
    userId?: string;      // Sender ('me')
  }
  ```
* **Returns:**
  ```json
  {
    "success": true,
    "message": "Balance transfer completed.",
    "transfer": {
      "from": { "userId": "...", "oldBalance": 250, "newBalance": 150 },
      "to": { "userId": "...", "oldBalance": 20, "newBalance": 120 },
      "amount": 100
    }
  }
  ```
* **Example usage:**
  ```javascript
  const res = await crafter.users.sendBalance({
    targetUserId: '@Alex',
    amount: 50
  });
  alert(`${res.transfer.amount} credits transferred!`);
  ```

---

### 5. `changePassword(data, userId?)`
Changes the account password.

* **HTTP Route:** `POST /v2/users/:userId/change-password`
* **Input:** `{ currentPassword: string, newPassword: string }`
* **Example usage:**
  ```javascript
  await crafter.users.changePassword({
    currentPassword: 'EskiSifrem123!',
    newPassword: 'YeniGucluSifrem456!'
  });
  ```

---

## 💬 Profile Wall

### 6. `getWall(userId)`
Lists the messages and replies on a player's profile wall.

* **HTTP Route:** `GET /v2/users/:userId/wall`
* **Example:**
  ```javascript
  const messages = await crafter.users.getWall('target-user-id');
  messages.forEach(msg => {
    console.log(`${msg.sender.username}: ${msg.content}`);
  });
  ```

### 7. `postWallMessage(userId, content)` & `replyWallMessage(userId, messageId, content)`
Posts a message to the user's wall or a reply to an existing message.

* **HTTP Route:** `POST /v2/users/:userId/wall` and `POST /v2/users/:userId/wall/:msgId/reply`
* **Example:**
  ```javascript
  // Post a new message to the wall:
  await crafter.users.postWallMessage('target-user-id', 'Congrats, good game!');

  // Reply to an existing message:
  await crafter.users.replyWallMessage('target-user-id', 'msg-123', 'Thanks!');
  ```

---

## 🛡️ Two-Factor Authentication (2FA) Settings

### 8. `get2FaStatus()`
Looks up the user's active 2FA status, methods and remaining recovery codes.

* **HTTP Route:** `GET /v2/users/me/2fa/status`
* **Returns:**
  ```typescript
  interface TwoFactorStatusResponse {
    enabled: boolean;
    methods: string[]; // ['authenticator', 'email', 'discord']
    primaryMethod: 'authenticator' | 'email' | 'discord' | null;
    hasRecoveryCodes: boolean;
    recoveryCodesCount: number;
    discordLinked: boolean;
    discordUsername?: string;
    isEmailVerified: boolean;
  }
  ```

### 9. Google Authenticator Kurulumu
```javascript
// 1. Get the QR code and the secret key:
const setup = await crafter.users.setupAuthenticator();
document.querySelector('#qr-image').src = setup.qrCodeUrl;

// 2. Enable it by entering the 6-digit code from the app:
const res = await crafter.users.enableAuthenticator('123456');
console.log('Your recovery codes:', res.recoveryCodes);
```

### 10. `disable2Fa(data?)`
Disables 2FA protection.

* **HTTP Route:** `POST /v2/users/me/2fa/disable`
* **Input (optional):** `{ password?: string, method?: 'authenticator' | 'email' | 'discord' }`
```javascript
// To turn off all 2FA methods:
await crafter.users.disable2Fa({ password: 'MevcutSifrem123!' });

// To turn off only a specific method:
await crafter.users.disable2Fa({ method: 'email' });
```

---

## 🎮 Discord Account Link

### 11. `getDiscordStatus()` & `unlinkDiscord()`
* **HTTP Route:** `GET /v2/users/me/discord/status` & `POST /v2/users/me/discord/unlink`
* **Example:**
  ```javascript
  const discord = await crafter.users.getDiscordStatus();
  if (discord.isLinked) {
    console.log('Linked Discord account:', discord.discordUsername);
  } else {
    console.log('Discord is not linked.');
  }

  // To unlink:
  await crafter.users.unlinkDiscord();
  ```

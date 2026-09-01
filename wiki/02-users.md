# 👤 Kullanıcılar & Profil Modülü (`crafter.users`)

Kullanıcı profil bilgilerini çekme, hafif bakiye sorgulama, bakiye transferi, profil duvarı mesajları, hesap 2FA güvenlik ayarları ve Discord hesap bağlantılarını yönetir.

---

## 📌 Metotlar ve Kullanım Örnekleri

### 1. `getProfile(userId?)`
Kullanıcının detaylı profil bilgilerini getirir.

* **HTTP Rota:** `GET /v2/users/:userId`
* **Varsayılan Parametre:** `'me'` (Oturum açmış kullanıcı).
* **Kullanıcı Adı İle Sorgulama:** `'@kullanici_adi'` formatı desteklenir.
* **Dönüş:** `UserProfile` (`id, username, email, balance, credit, role: { name, color }, avatar, playTime, averagePlayTime, twoFactorEnabled, isOnline, likes, comments, createdAt`)
* **Örnek Kullanım:**
  ```javascript
  // Kendi profilim
  const myProfile = await crafter.users.getProfile('me');
  console.log('Rütbem:', myProfile.role?.name, 'Oynama Sürem:', myProfile.playTime);

  // Başka bir oyuncunun profili
  const player = await crafter.users.getByUsername('oyuncu_adi');
  ```

---

### 2. `getBalance(userId?)` (Hızlı & Hafif Bakiye)
Tam profil nesnesini çekmeden yalnızca bakiye ve para birimini çeken optimize edilmiş hafif uç nokta.

* **HTTP Rota:** `GET /v2/users/:userId/balance`
* **Dönüş:** `{ userId: string, username: string, balance: number, currency: string }`
* **Örnek Kullanım:**
  ```javascript
  // Header'daki bakiye kutusunu doldururken:
  const data = await crafter.users.getBalance('me');
  document.querySelector('#header-balance').innerText = `${data.balance} ${data.currency}`;
  ```

---

### 3. `updateProfile(data, userId?)`
Kullanıcının kendi e-posta adresini günceller (Backend güvenlik politikası gereği self-update'te sadece e-posta güncellenebilir).

* **HTTP Rota:** `PUT /v2/users/:userId`
* **Girdi:** `{ email: string }`
* **Örnek Kullanım:**
  ```javascript
  await crafter.users.updateProfile({
    email: 'yeni-eposta@example.com'
  });
  ```

---

### 4. `sendBalance(params)` (Bakiye Transferi)
Başka bir oyuncuya site bakiyesi gönderir.

* **HTTP Rota:** `POST /v2/users/:userId/balance/send`
* **Girdi:**
  ```typescript
  interface SendBalanceParams {
    targetUserId: string; // Hedef oyuncunun ID'si veya '@kullanici_adi'
    amount: number;
    userId?: string;      // Gönderen ('me')
  }
  ```
* **Dönüş:**
  ```json
  {
    "success": true,
    "message": "Bakiye transferi tamamlandı.",
    "transfer": {
      "from": { "userId": "...", "oldBalance": 250, "newBalance": 150 },
      "to": { "userId": "...", "oldBalance": 20, "newBalance": 120 },
      "amount": 100
    }
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const res = await crafter.users.sendBalance({
    targetUserId: '@Alex',
    amount: 50
  });
  alert(`${res.transfer.amount} kredi başarıyla transfer edildi!`);
  ```

---

### 5. `changePassword(data, userId?)`
Hesap şifresini değiştirir.

* **HTTP Rota:** `POST /v2/users/:userId/change-password`
* **Girdi:** `{ currentPassword: string, newPassword: string }`
* **Örnek Kullanım:**
  ```javascript
  await crafter.users.changePassword({
    currentPassword: 'EskiSifrem123!',
    newPassword: 'YeniGucluSifrem456!'
  });
  ```

---

## 💬 Profil Duvarı (Wall)

### 6. `getWall(userId)`
Bir oyuncunun profil duvarındaki mesajları ve verilen yanıtları listeler.

* **HTTP Rota:** `GET /v2/users/:userId/wall`
* **Örnek:**
  ```javascript
  const messages = await crafter.users.getWall('target-user-id');
  messages.forEach(msg => {
    console.log(`${msg.sender.username}: ${msg.content}`);
  });
  ```

### 7. `postWallMessage(userId, content)` & `replyWallMessage(userId, messageId, content)`
Kullanıcının duvarına mesaj veya var olan mesaja yanıt gönderir.

* **HTTP Rota:** `POST /v2/users/:userId/wall` ve `POST /v2/users/:userId/wall/:msgId/reply`
* **Örnek:**
  ```javascript
  // Duvara yeni mesaj yaz:
  await crafter.users.postWallMessage('target-user-id', 'Tebrikler güzel oyundu!');

  // Var olan mesaja cevap ver:
  await crafter.users.replyWallMessage('target-user-id', 'msg-123', 'Teşekkürler!');
  ```

---

## 🛡️ İki Aşamalı Doğrulama (2FA) Ayarları

### 8. `get2FaStatus()`
Kullanıcının aktif 2FA durumunu, yöntemlerini ve kalan kurtarma kodlarını sorgular.

* **HTTP Rota:** `GET /v2/users/me/2fa/status`
* **Dönüş:**
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
// 1. QR Kodunu ve gizli anahtarı al:
const setup = await crafter.users.setupAuthenticator();
document.querySelector('#qr-image').src = setup.qrCodeUrl;

// 2. Uygulamadaki 6 haneli kodu girerek aktifleştir:
const res = await crafter.users.enableAuthenticator('123456');
console.log('Kurtarma kodlarınız:', res.recoveryCodes);
```

### 10. `disable2Fa(data?)`
2FA korumasını devre dışı bırakır.

* **HTTP Rota:** `POST /v2/users/me/2fa/disable`
* **Girdi (Opsiyonel):** `{ password?: string, method?: 'authenticator' | 'email' | 'discord' }`
```javascript
// Tüm 2FA yöntemlerini kapatmak için:
await crafter.users.disable2Fa({ password: 'MevcutSifrem123!' });

// Yalnızca belirli bir yöntemi kapatmak için:
await crafter.users.disable2Fa({ method: 'email' });
```

---

## 🎮 Discord Hesap Bağlantısı

### 11. `getDiscordStatus()` & `unlinkDiscord()`
* **HTTP Rota:** `GET /v2/users/me/discord/status` & `POST /v2/users/me/discord/unlink`
* **Örnek:**
  ```javascript
  const discord = await crafter.users.getDiscordStatus();
  if (discord.isLinked) {
    console.log('Bağlı Discord Hesabı:', discord.discordUsername);
  } else {
    console.log('Discord bağlı değil.');
  }

  // Bağlantıyı koparmak için:
  await crafter.users.unlinkDiscord();
  ```

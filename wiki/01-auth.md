# 🔐 Kimlik Doğrulama Modülü (`crafter.auth`)

Kullanıcı girişi, kayıt olma, 2 aşamalı doğrulama (2FA), tek kullanımlık e-posta kodları, oyun içi hızlı giriş ve şifre sıfırlama işlemlerini yönetir.

---

## 📌 Metotlar ve Kullanım Örnekleri

### 1. `signin(data)` / `login(data)`
Kullanıcı adı ve şifre ile oturum açar.

* **HTTP Rota:** `POST /v2/auth/signin`
* **Girdi:**
  ```typescript
  interface SignInDto {
    username: string;
    password: string;
    turnstileToken?: string;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const res = await crafter.auth.signin({
    username: 'oyuncu_adi',
    password: 'GucluSifre123!',
    turnstileToken: turnstile.getResponse() // Opsiyonel
  });

  if (res.requires2FA) {
    // Kullanıcı 2FA ekranına yönlendirilir
    console.log('2FA Gerekli, yöntemler:', res.methods, 'Temp Token:', res.tempToken);
  } else if (res.requiresEmailVerification) {
    // E-posta doğrulama ekranı açılır
    console.log('E-posta onayı gerekli:', res.maskedEmail);
  } else {
    // Oturum başarıyla açıldı, token otomatik kaydedildi!
    console.log('Hoş geldiniz!');
  }
  ```

---

### 2. `signup(data)` / `register(data)`
Yeni bir kullanıcı hesabı oluşturur.

* **HTTP Rota:** `POST /v2/auth/signup`
* **Girdi:**
  ```typescript
  interface SignUpDto {
    username: string;
    email: string;
    password: string;
    confirm_password: string; // veya camelCase confirmPassword (SDK otomatik dönüştürür)
    turnstileToken?: string;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const res = await crafter.auth.signup({
    username: 'oyuncu_adi',
    email: 'oyuncu@example.com',
    password: 'GucluSifre123!',
    confirm_password: 'GucluSifre123!'
  });
  ```

---

### 3. `inGameAuth(data?)` (Oyun İçi Hızlı Giriş)
Minecraft sunucusunda `/web` veya `/site` komutu ile siteye tıklayan oyuncunun şifresiz, tek kullanımlık güvenlik hash'i ile anında oturum açmasını sağlar.

* **HTTP Rota:** `POST /v2/auth/ingame`
* **Akıllı URL Çözümlemesi:** Eğer tarayıcıda sayfa `?username=...&uuid=...&server_id=...&hash=...` parametreleriyle açılmışsa, fonksiyona hiçbir parametre vermeden tek satırda çağırabilirsiniz:
  ```javascript
  // Sayfa: https://sunucu.com/auth/ingame?username=Steve&uuid=...&server_id=...&hash=...
  await crafter.auth.inGameAuth();
  // ✅ Oyuncu anında giriş yaptı, ana sayfaya yönlendirilebilir!
  window.location.href = '/';
  ```
* **Manuel Kullanım:**
  ```javascript
  await crafter.auth.inGameAuth({
    username: 'Steve',
    uuid: '12345678-1234-1234-1234-123456789abc',
    server_id: 'survival-1',
    hash: 'güvenlik-hash-kodu'
  });
  ```

---

### 4. `resetPassword(data)` & `getResetTokenFromUrl()`
Şifre sıfırlama bağlantısındaki token ile yeni şifreyi belirler.

* **HTTP Rota:** `POST /v2/auth/reset-password`
* **Otomatik URL Token Çözümlemesi:** URL'deki `?token=...` parametresini otomatik algılar:
  ```javascript
  // Sayfa: /auth/password/reset?token=xyz123abc
  await crafter.auth.resetPassword({
    new_password: 'YeniGucluSifre123!',
    confirm_password: 'YeniGucluSifre123!'
  });
  ```
* **Manuel Kullanım:**
  ```javascript
  await crafter.auth.resetPassword({
    token: 'ozel-token',
    new_password: 'YeniGucluSifre123!',
    confirm_password: 'YeniGucluSifre123!'
  });
  ```
* **URL Kontrol Yardımcısı:**
  ```javascript
  const token = crafter.auth.getResetTokenFromUrl();
  if (!token) {
    alert('Geçersiz şifre sıfırlama linki!');
  }
  ```

---

### 5. `forgotPassword(email, turnstileToken?)`
Şifre sıfırlama e-postası talep eder.

* **HTTP Rota:** `POST /v2/auth/forgot-password`
* **Örnek Kullanım:**
  ```javascript
  await crafter.auth.forgotPassword('oyuncu@example.com');
  alert('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
  ```

---

### 6. `validate2Fa(data)` / `verify2Fa(data)`
Giriş sırasında 2FA kodu doğrulama.

* **HTTP Rota:** `POST /v2/auth/2fa/verify`
* **Örnek Kullanım:**
  ```javascript
  const res = await crafter.auth.validate2Fa({
    tempToken: 'signin-asamasindan-gelen-tempToken',
    code: '123456',
    method: 'authenticator' // 'authenticator' | 'email' | 'discord' | 'recovery_code'
  });
  ```

---

### 7. `send2FaEmailCode(tempToken)` & `send2FaDiscordCode(tempToken)`
Giriş aşamasında 2FA e-posta veya Discord doğrulama kodunu tekrar gönderme.

* **HTTP Rota:** `POST /v2/auth/2fa/send-email-code` & `POST /v2/auth/2fa/send-discord-code`

---

### 8. `verifyEmail(data)` & `resendEmail(tempToken)`
Giriş veya kayıt sırasında e-posta doğrulama OTP kodunu onaylama ve yeniden talep etme.

* **HTTP Rota:** `POST /v2/auth/verify-email` & `POST /v2/auth/resend-email`
* **Örnek:**
  ```javascript
  await crafter.auth.verifyEmail({ tempToken: '...', code: '654321' });
  ```

---

### 9. `getDiscordAuthUrl(action, redirectUri?)`
Discord ile giriş veya hesaba Discord bağlama OAuth yönlendirme linkini üretir.

* **Örnek Kullanım:**
  ```javascript
  // Giriş butonu için:
  document.querySelector('#btn-discord-login').href = 
    crafter.auth.getDiscordAuthUrl('login', window.location.origin + '/auth/callback');

  // Profilde hesap bağlama butonu için:
  document.querySelector('#btn-discord-connect').href = 
    crafter.auth.getDiscordAuthUrl('connect', window.location.href);
  ```

---

### 10. `logout()`
Kullanıcı oturumunu kapatır. Storefront proxy modunda HttpOnly `crafter_token` ve `crafter_refresh_token` çerezlerini siler, tarayıcı hafızasını temizler ve `auth:logout` olayını tetikler:

```javascript
await crafter.auth.logout();
window.location.reload();
```

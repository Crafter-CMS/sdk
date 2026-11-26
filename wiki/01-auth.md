# 🔐 Authentication Module (`crafter.auth`)

Handles user sign-in, sign-up, two-factor authentication (2FA), one-time email codes, in-game quick login and password resets.

---

## 📌 Methods and Usage Examples

### 1. `signin(data)` / `login(data)`
Signs in with a username and password.

* **HTTP Route:** `POST /v2/auth/signin`
* **Input:**
  ```typescript
  interface SignInDto {
    username: string;
    password: string;
    turnstileToken?: string;
  }
  ```
* **Example usage:**
  ```javascript
  const res = await crafter.auth.signin({
    username: 'player_name',
    password: 'GucluSifre123!',
    turnstileToken: turnstile.getResponse() // Optional
  });

  if (res.requires2FA) {
    // The user is sent to the 2FA screen
    console.log('2FA required, methods:', res.methods, 'Temp token:', res.tempToken);
  } else if (res.requiresEmailVerification) {
    // The email verification screen opens
    console.log('Email verification required:', res.maskedEmail);
  } else {
    // Signed in successfully, the token was saved automatically!
    console.log('Welcome!');
  }
  ```

---

### 2. `signup(data)` / `register(data)`
Creates a new user account.

* **HTTP Route:** `POST /v2/auth/signup`
* **Input:**
  ```typescript
  interface SignUpDto {
    username: string;
    email: string;
    password: string;
    confirm_password: string; // or camelCase confirmPassword (the SDK converts it automatically)
    turnstileToken?: string;
  }
  ```
* **Example usage:**
  ```javascript
  const res = await crafter.auth.signup({
    username: 'player_name',
    email: 'player@example.com',
    password: 'GucluSifre123!',
    confirm_password: 'GucluSifre123!'
  });
  ```

---

### 3. `inGameAuth(data?)` (In-Game Quick Login)
Instantly signs in a player who clicked through to the site with the `/web` or `/site` command on the Minecraft server, using a passwordless, single-use security hash.

* **HTTP Route:** `POST /v2/auth/ingame`
* **Smart URL parsing:** If the page was opened in the browser with the `?username=...&uuid=...&server_id=...&hash=...` parameters, you can call it in one line without any arguments:
  ```javascript
  // Page: https://example.com/auth/ingame?username=Steve&uuid=...&server_id=...&hash=...
  await crafter.auth.inGameAuth();
  // ✅ The player is signed in instantly and can be redirected to the home page!
  window.location.href = '/';
  ```
* **Manual usage:**
  ```javascript
  await crafter.auth.inGameAuth({
    username: 'Steve',
    uuid: '12345678-1234-1234-1234-123456789abc',
    server_id: 'survival-1',
    hash: 'security-hash-code'
  });
  ```

---

### 4. `resetPassword(data)` & `getResetTokenFromUrl()`
Sets the new password with the token from the password reset link.

* **HTTP Route:** `POST /v2/auth/reset-password`
* **Automatic URL token parsing:** Detects the `?token=...` parameter in the URL automatically:
  ```javascript
  // Page: /auth/password/reset?token=xyz123abc
  await crafter.auth.resetPassword({
    new_password: 'YeniGucluSifre123!',
    confirm_password: 'YeniGucluSifre123!'
  });
  ```
* **Manual usage:**
  ```javascript
  await crafter.auth.resetPassword({
    token: 'custom-token',
    new_password: 'YeniGucluSifre123!',
    confirm_password: 'YeniGucluSifre123!'
  });
  ```
* **URL check helper:**
  ```javascript
  const token = crafter.auth.getResetTokenFromUrl();
  if (!token) {
    alert('Invalid password reset link!');
  }
  ```

---

### 5. `forgotPassword(email, turnstileToken?)`
Requests a password reset email.

* **HTTP Route:** `POST /v2/auth/forgot-password`
* **Example usage:**
  ```javascript
  await crafter.auth.forgotPassword('player@example.com');
  alert('A password reset link was sent to your email address.');
  ```

---

### 6. `validate2Fa(data)` / `verify2Fa(data)`
Verifies the 2FA code during sign-in.

* **HTTP Route:** `POST /v2/auth/2fa/verify`
* **Example usage:**
  ```javascript
  const res = await crafter.auth.validate2Fa({
    tempToken: 'tempToken-from-the-signin-step',
    code: '123456',
    method: 'authenticator' // 'authenticator' | 'email' | 'discord' | 'recovery_code'
  });
  ```

---

### 7. `send2FaEmailCode(tempToken)` & `send2FaDiscordCode(tempToken)`
Resends the 2FA email or Discord verification code during sign-in.

* **HTTP Route:** `POST /v2/auth/2fa/send-email-code` & `POST /v2/auth/2fa/send-discord-code`

---

### 8. `verifyEmail(data)` & `resendEmail(tempToken)`
Confirms and re-requests the email verification OTP code during sign-in or sign-up.

* **HTTP Route:** `POST /v2/auth/verify-email` & `POST /v2/auth/resend-email`
* **Example:**
  ```javascript
  await crafter.auth.verifyEmail({ tempToken: '...', code: '654321' });
  ```

---

### 9. `getDiscordAuthUrl(action, redirectUri?)`
Builds the OAuth redirect link for signing in with Discord or linking Discord to an account.

* **Example usage:**
  ```javascript
  // For a sign-in button:
  document.querySelector('#btn-discord-login').href = 
    crafter.auth.getDiscordAuthUrl('login', window.location.origin + '/auth/callback');

  // For an account-link button on the profile:
  document.querySelector('#btn-discord-connect').href = 
    crafter.auth.getDiscordAuthUrl('connect', window.location.href);
  ```

---

### 10. `logout()`
Signs the user out. In storefront proxy mode it deletes the HttpOnly `crafter_token` and `crafter_refresh_token` cookies, clears browser storage and fires the `auth:logout` event:

```javascript
await crafter.auth.logout();
window.location.reload();
```

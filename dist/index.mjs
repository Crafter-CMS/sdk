// src/core/errors.ts
var CrafterError = class _CrafterError extends Error {
  statusCode;
  error;
  details;
  isCrafterError = true;
  constructor(payload) {
    const formattedMessage = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message || "An unexpected Crafter SDK error occurred";
    super(formattedMessage);
    this.name = "CrafterError";
    this.statusCode = payload.statusCode ?? 500;
    this.error = payload.error;
    this.details = payload.details;
    Object.setPrototypeOf(this, _CrafterError.prototype);
  }
  static fromResponse(statusCode, data) {
    if (typeof data === "string") {
      return new _CrafterError({ statusCode, message: data });
    }
    const apiError = data;
    return new _CrafterError({
      statusCode: apiError?.statusCode || statusCode,
      message: apiError?.message || `HTTP Request failed with status ${statusCode}`,
      error: apiError?.error,
      details: apiError?.details || data
    });
  }
};
function isCrafterError(err) {
  return err instanceof CrafterError || typeof err === "object" && err !== null && err.isCrafterError === true;
}

// src/core/http.ts
var HttpClient = class {
  mode;
  config;
  token = null;
  storageKey;
  constructor(config = {}) {
    this.mode = config.mode || (config.websiteId ? "direct" : "storefront");
    const defaultApiBase = this.mode === "direct" ? "https://api.crafter.net.tr" : "/api/storefront";
    this.config = {
      apiBase: defaultApiBase,
      storageKey: "crafter_token",
      ...config
    };
    this.storageKey = this.config.storageKey || "crafter_token";
    if (this.config.token) {
      this.token = this.config.token;
    } else {
      this.token = this.readTokenFromStorage();
    }
  }
  /**
   * Safe getter for stored token from localStorage
   */
  readTokenFromStorage() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        return window.localStorage.getItem(this.storageKey);
      } catch {
        return null;
      }
    }
    return null;
  }
  /**
   * Get current auth token
   */
  getToken() {
    return this.token;
  }
  /**
   * Set or clear auth token
   */
  setToken(token) {
    this.token = token;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        if (token) {
          window.localStorage.setItem(this.storageKey, token);
        } else {
          window.localStorage.removeItem(this.storageKey);
        }
      } catch {
      }
    }
    if (this.config.onTokenChange) {
      this.config.onTokenChange(token);
    }
  }
  /**
   * Clear active auth token
   */
  clearToken() {
    this.setToken(null);
  }
  /**
   * Resolves the full URL for an endpoint according to SDK operating mode:
   * 
   * Mode 1: 'storefront' (Liquid themes)
   * - Prepends '/api/storefront':
   *   /v2/auth/signin      -> /api/storefront/v2/auth/signin
   *   /products            -> /api/storefront/products
   * 
   * Mode 2: 'direct' (Headless apps, external scripts, Node)
   * - Prepends 'https://api.crafter.net.tr/website/{v2/}:websiteId/...':
   *   /v2/auth/signin      -> https://api.crafter.net.tr/website/v2/:websiteId/auth/signin
   *   /products            -> https://api.crafter.net.tr/website/:websiteId/products
   *   /payment/initiate    -> https://api.crafter.net.tr/website/payment/initiate
   */
  buildUrl(path, options) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return this.appendParams(path, options?.params);
    }
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    let fullUrl;
    if (this.mode === "direct") {
      const apiBase = (this.config.apiBase || "https://api.crafter.net.tr").replace(/\/+$/, "");
      const websiteId = this.config.websiteId;
      if (!websiteId && !cleanPath.startsWith("/payment/")) {
        console.warn(
          `[Crafter SDK] websiteId is required in 'direct' mode for endpoint "${cleanPath}". Pass websiteId in Crafter config.`
        );
      }
      if (cleanPath.startsWith("/v2/")) {
        const subPath = cleanPath.substring(4);
        fullUrl = `${apiBase}/website/v2/${websiteId}/${subPath}`;
      } else if (cleanPath.startsWith("/payment/")) {
        const subPath = cleanPath.substring(9);
        fullUrl = `${apiBase}/website/payment/${subPath}`;
      } else {
        const subPath = cleanPath.replace(/^\/+/, "");
        fullUrl = subPath ? `${apiBase}/website/${websiteId}/${subPath}` : `${apiBase}/website/${websiteId}`;
      }
    } else {
      const apiBase = (this.config.apiBase || "/api/storefront").replace(/\/+$/, "");
      fullUrl = cleanPath ? `${apiBase}${cleanPath}` : apiBase;
    }
    return this.appendParams(fullUrl, options?.params);
  }
  appendParams(url, params) {
    if (!params) return url;
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== void 0 && val !== null) {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (!queryString) return url;
    return url + (url.includes("?") ? "&" : "?") + queryString;
  }
  /**
   * Core request dispatcher with automatic credentials (cookies) & token header
   */
  async request(endpoint, options = {}) {
    const url = this.buildUrl(endpoint, options);
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...this.config.headers || {},
      ...options.headers || {}
    };
    if (!options.skipAuth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    try {
      const response = await fetch(url, {
        credentials: options.credentials || (this.mode === "storefront" ? "same-origin" : "include"),
        ...options,
        headers
      });
      const contentType = response.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      if (!response.ok) {
        throw CrafterError.fromResponse(response.status, data);
      }
      return data;
    } catch (error) {
      if (error instanceof CrafterError) {
        throw error;
      }
      throw new CrafterError({
        message: error?.message || "Network request failed",
        statusCode: 0,
        details: error
      });
    }
  }
  get(endpoint, options) {
    return this.request(endpoint, { ...options, method: "GET" });
  }
  post(endpoint, body, options) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
  }
  put(endpoint, body, options) {
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
  }
  patch(endpoint, body, options) {
    return this.request(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
  }
  delete(endpoint, options) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }
};

// src/core/events.ts
var EventEmitter = class {
  listeners = /* @__PURE__ */ new Map();
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
  once(event, handler) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      handler(data);
    };
    return this.on(event, wrapper);
  }
  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(payload);
        } catch (error) {
          console.error(`[Crafter SDK] Error in event listener for "${event}":`, error);
        }
      });
    }
  }
  /**
   * Remove all listeners for an event or all events.
   */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
};

// src/modules/auth.ts
var AuthModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Sign in user with username and password.
   * POST /v2/auth/signin
   */
  async signin(data) {
    const payload = {
      username: data.username,
      password: data.password,
      turnstileToken: data.turnstileToken
    };
    const response = await this.http.post("/v2/auth/signin", payload);
    const token = "accessToken" in response ? response.accessToken : response.token;
    if (token) {
      this.http.setToken(token);
    }
    this.events.emit("auth:login", {
      token: token || void 0
    });
    return response;
  }
  /**
   * Alias for signin.
   */
  login(data) {
    return this.signin(data);
  }
  /**
   * Register a new user.
   * POST /v2/auth/signup
   */
  async signup(data) {
    const payload = {
      username: data.username,
      email: data.email,
      password: data.password,
      confirm_password: data.confirm_password || data.confirmPassword || "",
      turnstileToken: data.turnstileToken
    };
    return this.http.post("/v2/auth/signup", payload);
  }
  /**
   * Alias for signup.
   */
  register(data) {
    return this.signup(data);
  }
  /**
   * Fast authentication for in-game players clicking web links (e.g. /web command in Minecraft).
   * If parameters are omitted, automatically extracts username, uuid, server_id, and hash from URL query params.
   * POST /v2/auth/ingame
   */
  async inGameAuth(data) {
    let username = data?.username;
    let uuid = data?.uuid;
    let server_id = data?.server_id;
    let hash = data?.hash;
    if (typeof window !== "undefined" && window.location) {
      const params = new URLSearchParams(window.location.search);
      username = username || params.get("username") || void 0;
      uuid = uuid || params.get("uuid") || void 0;
      server_id = server_id || params.get("server_id") || params.get("serverId") || void 0;
      hash = hash || params.get("hash") || void 0;
    }
    if (!username || !uuid || !server_id || !hash) {
      throw new CrafterError({
        message: "In-game authentication requires username, uuid, server_id, and hash. Ensure they are provided or present in URL query parameters.",
        statusCode: 400
      });
    }
    const payload = { username, uuid, server_id, hash };
    const response = await this.http.post("/v2/auth/ingame", payload);
    const token = "accessToken" in response ? response.accessToken : response.token;
    if (token) {
      this.http.setToken(token);
    }
    this.events.emit("auth:login", {
      token: token || void 0
    });
    return response;
  }
  /**
   * Refresh access token using refresh token.
   * POST /v2/auth/refresh-token
   */
  async refreshToken(refreshToken) {
    const response = await this.http.post("/v2/auth/refresh-token", { refreshToken });
    const token = "accessToken" in response ? response.accessToken : response.token;
    if (token) {
      this.http.setToken(token);
      this.events.emit("auth:token_refreshed", { token });
    }
    return response;
  }
  /**
   * Alias for refreshToken.
   */
  refresh(refreshToken) {
    return this.refreshToken(refreshToken);
  }
  /**
   * Request password reset email.
   * POST /v2/auth/forgot-password
   */
  async forgotPassword(email, turnstileToken) {
    return this.http.post("/v2/auth/forgot-password", { email, turnstileToken });
  }
  /**
   * Get password reset token from current URL query parameters (?token=...).
   * Returns null in SSR/Node environments or if token query param is missing.
   */
  getResetTokenFromUrl() {
    if (typeof window !== "undefined" && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("token") || null;
    }
    return null;
  }
  /**
   * Reset password with reset token.
   * If data.token is omitted, it automatically attempts to read ?token= from the URL (window.location.search).
   * POST /v2/auth/reset-password
   */
  async resetPassword(data) {
    const token = data.token || this.getResetTokenFromUrl();
    if (!token) {
      throw new CrafterError({
        message: "Password reset token is required. Please provide it in data.token or ensure ?token= is in the URL query string.",
        statusCode: 400
      });
    }
    const payload = {
      token,
      new_password: data.new_password || data.newPassword || "",
      confirm_password: data.confirm_password || data.confirmPassword || "",
      turnstileToken: data.turnstileToken
    };
    return this.http.post("/v2/auth/reset-password", payload);
  }
  /**
   * Verify email OTP code during login or signup.
   * POST /v2/auth/verify-email
   */
  async verifyEmail(data) {
    const payload = typeof data === "string" ? { token: data } : data;
    return this.http.post("/v2/auth/verify-email", payload);
  }
  /**
   * Resend verification email code during login or registration.
   * POST /v2/auth/resend-email
   */
  async resendEmail(tempToken) {
    return this.http.post("/v2/auth/resend-email", { tempToken });
  }
  /**
   * Alias for resendEmail.
   */
  async resendVerification(tempToken) {
    return this.resendEmail(tempToken);
  }
  // ===================== Login 2FA & OTP Methods =====================
  /**
   * Validate 2FA code during sign in.
   * POST /v2/auth/2fa/verify
   */
  async validate2Fa(data) {
    const response = await this.http.post("/v2/auth/2fa/verify", data);
    const token = "accessToken" in response ? response.accessToken : response.token;
    if (token) {
      this.http.setToken(token);
    }
    return response;
  }
  /**
   * Send 2FA verification code to email during login.
   * POST /v2/auth/2fa/send-email-code
   */
  async send2FaEmailCode(tempToken) {
    return this.http.post("/v2/auth/2fa/send-email-code", { tempToken });
  }
  /**
   * Send 2FA verification code/push to Discord DM during login.
   * POST /v2/auth/2fa/send-discord-code
   */
  async send2FaDiscordCode(tempToken) {
    return this.http.post("/v2/auth/2fa/send-discord-code", { tempToken });
  }
  /**
   * Update temporary @temp.com email and send verification code (for players registered in-game).
   * POST /v2/auth/update-temp-email
   */
  async updateTempEmail(tempToken, email) {
    return this.http.post("/v2/auth/update-temp-email", { tempToken, email });
  }
  // ===================== Discord OAuth =====================
  /**
   * Get Discord OAuth redirect URL for login or account connect.
   * GET /v2/auth/discord?action=login|connect&redirectUri=...
   */
  getDiscordAuthUrl(action = "login", redirectUri) {
    const params = { action, redirectUri };
    return this.http.buildUrl("/v2/auth/discord", { params });
  }
  /**
   * Sign out user and clear session token.
   * In storefront mode, notifies proxy to delete HttpOnly cookies.
   */
  async logout() {
    if (this.http.mode === "storefront") {
      try {
        await this.http.post("/v2/auth/logout", {});
      } catch {
      }
    }
    this.http.clearToken();
    this.events.emit("auth:logout");
  }
  isAuthenticated() {
    return !!this.http.getToken();
  }
  getToken() {
    return this.http.getToken();
  }
  setToken(token) {
    this.http.setToken(token);
  }
};

// src/modules/users.ts
var UsersModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get user profile by ID or current user ('me').
   * GET /v2/users/:userId
   */
  async getProfile(userId = "me") {
    return this.http.get(`/v2/users/${userId}`);
  }
  /**
   * High-performance lightweight balance check for theme headers.
   * GET /v2/users/:userId/balance
   */
  async getBalance(userId = "me") {
    const res = await this.http.get(`/v2/users/${userId}/balance`);
    return res.data || res;
  }
  /**
   * Search/get user by username.
   * GET /v2/users/@:username
   */
  async getByUsername(username) {
    const cleanUsername = username.replace(/^@/, "");
    return this.http.get(`/v2/users/@${cleanUsername}`);
  }
  /**
   * Update own user profile.
   * In backend self-update, only email can be updated.
   * PUT /v2/users/:userId
   */
  async updateProfile(data, userId = "me") {
    const payload = { email: data.email };
    const updated = await this.http.put(`/v2/users/${userId}`, payload);
    this.events.emit("user:updated", updated);
    return updated;
  }
  /**
   * Send balance to another user.
   * POST /v2/users/:sender/balance/send
   */
  async sendBalance(params) {
    const sender = params.userId || "me";
    const response = await this.http.post(`/v2/users/${sender}/balance/send`, {
      targetUserId: params.targetUserId,
      amount: params.amount
    });
    this.events.emit("balance:sent", response);
    return response;
  }
  /**
   * Change user password.
   * POST /v2/users/:userId/change-password
   */
  async changePassword(data, userId = "me") {
    const payload = {
      currentPassword: data.currentPassword || data.current_password || "",
      newPassword: data.newPassword || data.new_password || ""
    };
    return this.http.post(`/v2/users/${userId}/change-password`, payload);
  }
  // ===================== User Wall Messages =====================
  /**
   * List wall messages and replies for a user profile.
   * GET /v2/users/:userId/wall
   */
  async getWall(userId) {
    return this.http.get(`/v2/users/${userId}/wall`);
  }
  /**
   * Post a message on a user's wall.
   * POST /v2/users/:userId/wall
   */
  async postWallMessage(userId, content) {
    const res = await this.http.post(`/v2/users/${userId}/wall`, { content });
    this.events.emit("wall:message_added", { userId, message: res });
    return res;
  }
  /**
   * Reply to a wall message.
   * POST /v2/users/:userId/wall/:wallMessageId/reply
   */
  async replyWallMessage(userId, wallMessageId, content) {
    const res = await this.http.post(`/v2/users/${userId}/wall/${wallMessageId}/reply`, { content });
    this.events.emit("wall:reply_added", { userId, wallMessageId, reply: res });
    return res;
  }
  // ===================== User 2FA Management =====================
  /**
   * Check 2FA active methods status.
   * GET /v2/users/me/2fa/status
   */
  async get2FaStatus() {
    return this.http.get("/v2/users/me/2fa/status");
  }
  /**
   * Generate Google Authenticator secret & QR code.
   * POST /v2/users/me/2fa/authenticator/setup
   */
  async setupAuthenticator() {
    return this.http.post("/v2/users/me/2fa/authenticator/setup", {});
  }
  /**
   * Enable Google Authenticator with 6-digit code.
   * POST /v2/users/me/2fa/authenticator/enable
   */
  async enableAuthenticator(code) {
    const res = await this.http.post("/v2/users/me/2fa/authenticator/enable", { code });
    this.events.emit("2fa:enabled", { method: "authenticator", recoveryCodes: res?.recoveryCodes });
    return res;
  }
  /**
   * Send 2FA confirmation code to registered email.
   * POST /v2/users/me/2fa/email/send-code
   */
  async sendEmail2FaCode() {
    return this.http.post("/v2/users/me/2fa/email/send-code", {});
  }
  /**
   * Enable Email 2FA with received code.
   * POST /v2/users/me/2fa/email/enable
   */
  async enableEmail2Fa(code) {
    const res = await this.http.post("/v2/users/me/2fa/email/enable", { code });
    this.events.emit("2fa:enabled", { method: "email" });
    return res;
  }
  /**
   * Send 2FA confirmation code to user's Discord DM.
   * POST /v2/users/me/2fa/discord/send-code
   */
  async sendDiscord2FaCode() {
    return this.http.post("/v2/users/me/2fa/discord/send-code", {});
  }
  /**
   * Enable Discord 2FA with received code.
   * POST /v2/users/me/2fa/discord/enable
   */
  async enableDiscord2Fa(code) {
    const res = await this.http.post("/v2/users/me/2fa/discord/enable", { code });
    this.events.emit("2fa:enabled", { method: "discord" });
    return res;
  }
  /**
   * Disable 2FA.
   * Accepts optional password and specific method to disable.
   * POST /v2/users/me/2fa/disable
   */
  async disable2Fa(data = {}) {
    const res = await this.http.post("/v2/users/me/2fa/disable", data);
    this.events.emit("2fa:disabled", { method: data.method });
    return res;
  }
  /**
   * Set primary 2FA method.
   * PUT /v2/users/me/2fa/primary-method
   */
  async setPrimary2FaMethod(method) {
    return this.http.put("/v2/users/me/2fa/primary-method", { method });
  }
  /**
   * Regenerate 2FA backup recovery codes.
   * POST /v2/users/me/2fa/recovery-codes/regenerate
   */
  async regenerateRecoveryCodes() {
    return this.http.post("/v2/users/me/2fa/recovery-codes/regenerate", {});
  }
  // ===================== Discord Account Link =====================
  /**
   * Get user's linked Discord status.
   * GET /v2/users/me/discord/status
   */
  async getDiscordStatus() {
    const res = await this.http.get("/v2/users/me/discord/status");
    return res.data;
  }
  /**
   * Unlink Discord account.
   * POST /v2/users/me/discord/unlink
   */
  async unlinkDiscord() {
    const res = await this.http.post("/v2/users/me/discord/unlink", {});
    this.events.emit("discord:unlinked");
    return res;
  }
};

// src/modules/store.ts
var StoreModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * List all categories.
   * GET /categories
   */
  async getCategories() {
    return this.http.get("/categories");
  }
  /**
   * Get single category by ID.
   * GET /categories/:categoryId
   */
  async getCategory(categoryId) {
    return this.http.get(`/categories/${categoryId}`);
  }
  /**
   * List all products.
   * GET /products
   */
  async getProducts() {
    return this.http.get("/products");
  }
  /**
   * Get product details by product ID.
   * GET /products/:productId
   */
  async getProduct(productId) {
    return this.http.get(`/products/${productId}`);
  }
  /**
   * Get products by category ID.
   * GET /products/by-category/:categoryId
   */
  async getProductsByCategory(categoryId) {
    return this.http.get(`/products/by-category/${categoryId}`);
  }
  /**
   * Get store marketplace settings including bulk discount promotions.
   * GET /config/marketplace
   */
  async getConfig() {
    return this.http.get("/config/marketplace");
  }
};

// src/modules/cart.ts
var CartModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Complete purchase using user balance.
   * POST /marketplace/purchase
   */
  async purchase(data) {
    const payload = {
      productIds: data.productIds,
      coupon: data.coupon || data.couponCode || null
    };
    const response = await this.http.post("/marketplace/purchase", payload);
    this.events.emit("cart:purchased", response);
    return response;
  }
};

// src/modules/chest.ts
var ChestModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get user's chest items.
   * GET /chest/:userId
   */
  async getItems(userId = "me") {
    return this.http.get(`/chest/${userId}`);
  }
  /**
   * Use an item from the user's chest.
   * POST /chest/:userId/use/:chestItemId
   */
  async useItem(chestItemId, userId = "me") {
    const response = await this.http.post(`/chest/${userId}/use/${chestItemId}`, {});
    this.events.emit("chest:item_used", { itemId: chestItemId, response });
    return response;
  }
  /**
   * Gift a chest item to another user.
   * POST /chest/:from/gift/:to/:chestItemId
   */
  async giftItem(targetUserId, chestItemId, fromUserId = "me") {
    const response = await this.http.post(`/chest/${fromUserId}/gift/${targetUserId}/${chestItemId}`, {});
    this.events.emit("chest:item_gifted", { targetUserId, itemId: chestItemId, response });
    return response;
  }
};

// src/utils/lexical.ts
var IS_BOLD = 1;
var IS_ITALIC = 2;
var IS_STRIKETHROUGH = 4;
var IS_UNDERLINE = 8;
var IS_CODE = 16;
var IS_SUBSCRIPT = 32;
var IS_SUPERSCRIPT = 64;
var IS_HIGHLIGHT = 128;
function isLexicalFormat(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!obj.root || typeof obj.root !== "object") return false;
  if (obj.root.type !== "root") return false;
  if (!Array.isArray(obj.root.children)) return false;
  return true;
}
function lexicalToHtml(node, options) {
  if (!node) return "";
  if (typeof node === "string") {
    try {
      node = JSON.parse(node);
    } catch {
      return escapeHtml(node);
    }
  }
  if (node.root) {
    return lexicalToHtml(node.root, options);
  }
  if (Array.isArray(node)) {
    return node.map((n) => lexicalToHtml(n, options)).join("");
  }
  const type = node.type;
  let html = "";
  if (node.children) {
    html = lexicalToHtml(node.children, options);
  }
  const plain = options?.plainSemantic === true;
  const getBlockAttributes = (defaultClasses = "") => {
    const styles = [];
    const classes = plain ? [] : defaultClasses ? [defaultClasses] : [];
    if (node.format) {
      if (node.format === "center") {
        plain ? styles.push("text-align: center") : classes.push("text-center");
      } else if (node.format === "right") {
        plain ? styles.push("text-align: right") : classes.push("text-right");
      } else if (node.format === "justify") {
        plain ? styles.push("text-align: justify") : classes.push("text-justify");
      } else if (node.format === "left" || node.format === "start") {
        plain ? styles.push("text-align: left") : classes.push("text-left");
      }
    }
    if (node.indent && typeof node.indent === "number" && node.indent > 0) {
      styles.push(`padding-left: ${node.indent * 24}px`);
    }
    const classAttr = classes.length ? ` class="${classes.join(" ")}"` : "";
    const styleAttr = styles.length ? ` style="${styles.join("; ")}"` : "";
    const dirAttr = node.direction ? ` dir="${node.direction}"` : "";
    return { classAttr, styleAttr, dirAttr };
  };
  switch (type) {
    case "root":
      return html;
    case "paragraph": {
      const { classAttr, styleAttr, dirAttr } = getBlockAttributes(
        "mb-4 text-gray-700 leading-relaxed text-[15px]"
      );
      return `<p${classAttr}${styleAttr}${dirAttr}>${html}</p>`;
    }
    case "heading": {
      const tag = node.tag || "h2";
      const defaultClasses = tag === "h1" ? "text-3xl font-black mb-6 mt-8 tracking-tight text-gray-900" : tag === "h2" ? "text-2xl font-bold mb-4 mt-6 tracking-tight text-gray-900" : tag === "h3" ? "text-xl font-bold mb-3 mt-5 text-gray-900" : "text-lg font-bold mb-3 mt-4 text-gray-900";
      const { classAttr, styleAttr, dirAttr } = getBlockAttributes(defaultClasses);
      return `<${tag}${classAttr}${styleAttr}${dirAttr}>${html}</${tag}>`;
    }
    case "list": {
      const isCheckList = node.listType === "check";
      const isNumber = node.listType === "number";
      const listTag = isNumber ? "ol" : "ul";
      const defaultClasses = isCheckList ? "space-y-2 mb-5 list-none" : isNumber ? "list-decimal list-inside mb-5 space-y-2 text-gray-700" : "list-disc list-inside mb-5 space-y-2 text-gray-700";
      const { classAttr, styleAttr, dirAttr } = getBlockAttributes(defaultClasses);
      const startAttr = isNumber && node.start && node.start !== 1 ? ` start="${node.start}"` : "";
      return `<${listTag}${classAttr}${styleAttr}${dirAttr}${startAttr}>${html}</${listTag}>`;
    }
    case "listitem": {
      if (node.checked !== void 0) {
        const isChecked = Boolean(node.checked);
        const checkbox = `<input type="checkbox" disabled ${isChecked ? "checked " : ""}class="mr-2 inline-block rounded" />`;
        const content = plain ? html : `<span class="${isChecked ? "line-through text-gray-400" : "text-gray-700"}">${html}</span>`;
        return `<li class="flex items-center space-x-2 my-1" data-checked="${isChecked}">${checkbox}${content}</li>`;
      }
      return `<li>${html}</li>`;
    }
    case "quote": {
      const { classAttr, styleAttr, dirAttr } = getBlockAttributes(
        "border-l-4 border-primary pl-5 italic my-6 text-gray-600 bg-blue-50/50 py-3 pr-4 rounded-r-2xl"
      );
      return `<blockquote${classAttr}${styleAttr}${dirAttr}>${html}</blockquote>`;
    }
    case "link":
    case "autolink": {
      const url = escapeHtml(node.url || "#");
      const targetAttr = node.target ? ` target="${escapeHtml(node.target)}"` : "";
      const relAttr = node.rel ? ` rel="${escapeHtml(node.rel)}"` : "";
      const titleAttr = node.title ? ` title="${escapeHtml(node.title)}"` : "";
      const classAttr = plain ? "" : ' class="text-primary hover:text-blue-700 hover:underline font-bold transition-colors"';
      return `<a href="${url}"${classAttr}${targetAttr}${relAttr}${titleAttr}>${html}</a>`;
    }
    case "image":
    case "inline-image": {
      const src = escapeHtml(node.src || "");
      const alt = escapeHtml(node.altText || "");
      const classAttr = plain ? "" : ' class="rounded-2xl w-full max-h-[500px] object-cover my-8 shadow-sm border border-gray-100"';
      const widthAttr = node.width && node.width !== "inherit" ? ` width="${node.width}"` : "";
      const heightAttr = node.height && node.height !== "inherit" ? ` height="${node.height}"` : "";
      return `<img src="${src}" alt="${alt}"${classAttr}${widthAttr}${heightAttr} />`;
    }
    case "code": {
      const language = node.language || "";
      const langClass = language ? ` class="language-${escapeHtml(language)}"` : "";
      const preClass = plain ? "" : ' class="bg-gray-900 text-gray-100 p-5 rounded-2xl overflow-x-auto my-6 text-sm font-mono shadow-lg"';
      return `<pre${preClass}><code${langClass}>${html}</code></pre>`;
    }
    case "code-highlight": {
      return html;
    }
    case "table": {
      const tableClass = plain ? "" : ' class="w-full my-6 border-collapse border border-gray-200 shadow-sm rounded-lg overflow-hidden"';
      return `<div class="overflow-x-auto"><table${tableClass}><tbody>${html}</tbody></table></div>`;
    }
    case "tablerow": {
      const trClass = plain ? "" : ' class="border-b border-gray-200 even:bg-gray-50/50"';
      return `<tr${trClass}>${html}</tr>`;
    }
    case "tablecell": {
      const isHeader = Boolean(node.headerState && node.headerState > 0);
      const cellTag = isHeader ? "th" : "td";
      const colSpan = node.colSpan && node.colSpan > 1 ? ` colspan="${node.colSpan}"` : "";
      const rowSpan = node.rowSpan && node.rowSpan > 1 ? ` rowspan="${node.rowSpan}"` : "";
      const bgStyle = node.backgroundColor ? `background-color: ${node.backgroundColor};` : "";
      const styleAttr = bgStyle ? ` style="${bgStyle}"` : "";
      const cellClass = plain ? "" : isHeader ? ' class="px-4 py-3 text-left font-bold text-gray-900 bg-gray-100 border border-gray-200"' : ' class="px-4 py-3 text-gray-700 border border-gray-200"';
      return `<${cellTag}${cellClass}${colSpan}${rowSpan}${styleAttr}>${html}</${cellTag}>`;
    }
    case "horizontalrule":
    case "hr": {
      const hrClass = plain ? "" : ' class="my-8 border-t border-gray-200"';
      return `<hr${hrClass} />`;
    }
    case "linebreak":
      return `<br />`;
    case "tab":
      return `<span style="white-space: pre-wrap;">	</span>`;
    case "text": {
      let text = escapeHtml(node.text || "");
      const format = node.format || 0;
      if (format & IS_BOLD) {
        text = plain ? `<strong>${text}</strong>` : `<strong class="font-bold text-gray-900">${text}</strong>`;
      }
      if (format & IS_ITALIC) {
        text = `<em>${text}</em>`;
      }
      if (format & IS_STRIKETHROUGH) {
        text = `<s>${text}</s>`;
      }
      if (format & IS_UNDERLINE) {
        text = `<u>${text}</u>`;
      }
      if (format & IS_CODE) {
        text = plain ? `<code>${text}</code>` : `<code class="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded-lg text-sm font-mono border border-gray-200">${text}</code>`;
      }
      if (format & IS_SUBSCRIPT) {
        text = `<sub>${text}</sub>`;
      }
      if (format & IS_SUPERSCRIPT) {
        text = `<sup>${text}</sup>`;
      }
      if (format & IS_HIGHLIGHT) {
        text = `<mark class="bg-yellow-200 px-1 rounded">${text}</mark>`;
      }
      if (node.style && typeof node.style === "string") {
        text = `<span style="${escapeHtml(node.style)}">${text}</span>`;
      }
      return text;
    }
    default:
      return html || escapeHtml(node.text || "");
  }
}
function lexicalToText(node) {
  if (!node) return "";
  if (typeof node === "string") {
    try {
      node = JSON.parse(node);
    } catch {
      return node;
    }
  }
  if (node.root) {
    return lexicalToText(node.root);
  }
  if (Array.isArray(node)) {
    return node.map((n) => lexicalToText(n)).join("");
  }
  const type = node.type;
  let text = "";
  if (node.children) {
    text = lexicalToText(node.children);
  }
  switch (type) {
    case "text":
      return node.text || "";
    case "paragraph":
    case "heading":
    case "listitem":
    case "quote":
      return text ? text + " " : "";
    case "tablerow":
      return text ? text + "\n" : "";
    case "linebreak":
      return "\n";
    case "tab":
      return "	";
    default:
      return text || node.text || "";
  }
}
var lexicalToPlainText = lexicalToText;
function htmlToLexical(html) {
  if (!html || typeof html !== "string") {
    return createEmptyLexicalRoot();
  }
  if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    try {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const children = [];
      for (let i = 0; i < doc.body.childNodes.length; i++) {
        const node = domNodeToLexicalNode(doc.body.childNodes[i]);
        if (node) {
          if (Array.isArray(node)) {
            children.push(...node);
          } else {
            children.push(node);
          }
        }
      }
      return {
        root: {
          type: "root",
          format: "",
          indent: 0,
          version: 1,
          direction: null,
          children: children.length ? children : [createEmptyParagraph()]
        }
      };
    } catch {
    }
  }
  return fallbackHtmlToLexical(html);
}
function toLexical(content) {
  if (isLexicalFormat(content)) {
    return content;
  }
  const raw = String(content ?? "");
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return htmlToLexical(raw);
  }
  const lines = raw.split("\n");
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: null,
      children: lines.map((line) => ({
        type: "paragraph",
        format: "",
        indent: 0,
        version: 1,
        direction: null,
        children: [
          {
            type: "text",
            text: line,
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            version: 1
          }
        ]
      }))
    }
  };
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function createEmptyParagraph() {
  return {
    type: "paragraph",
    format: "",
    indent: 0,
    version: 1,
    direction: null,
    children: []
  };
}
function createEmptyLexicalRoot() {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: null,
      children: [createEmptyParagraph()]
    }
  };
}
function domNodeToLexicalNode(domNode, currentFormat = 0) {
  if (domNode.nodeType === Node.TEXT_NODE) {
    const text = domNode.textContent || "";
    if (!text) return null;
    return {
      type: "text",
      text,
      format: currentFormat,
      detail: 0,
      mode: "normal",
      style: "",
      version: 1
    };
  }
  if (domNode.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const el = domNode;
  const tagName = el.tagName.toLowerCase();
  let format = currentFormat;
  if (tagName === "strong" || tagName === "b") format |= IS_BOLD;
  if (tagName === "em" || tagName === "i") format |= IS_ITALIC;
  if (tagName === "s" || tagName === "del" || tagName === "strike") format |= IS_STRIKETHROUGH;
  if (tagName === "u") format |= IS_UNDERLINE;
  if (tagName === "code" && el.parentElement?.tagName.toLowerCase() !== "pre") format |= IS_CODE;
  if (tagName === "sub") format |= IS_SUBSCRIPT;
  if (tagName === "sup") format |= IS_SUPERSCRIPT;
  if (tagName === "mark") format |= IS_HIGHLIGHT;
  if (["strong", "b", "em", "i", "s", "del", "strike", "u", "sub", "sup", "mark"].includes(tagName) || tagName === "code" && el.parentElement?.tagName.toLowerCase() !== "pre" || tagName === "span") {
    const inlineChildren = [];
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = domNodeToLexicalNode(el.childNodes[i], format);
      if (child) {
        if (Array.isArray(child)) inlineChildren.push(...child);
        else inlineChildren.push(child);
      }
    }
    return inlineChildren;
  }
  const children = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = domNodeToLexicalNode(el.childNodes[i], format);
    if (child) {
      if (Array.isArray(child)) children.push(...child);
      else children.push(child);
    }
  }
  if (/^h[1-6]$/.test(tagName)) {
    return {
      type: "heading",
      tag: tagName,
      format: "",
      indent: 0,
      direction: null,
      version: 1,
      children
    };
  }
  if (tagName === "ul" || tagName === "ol") {
    return {
      type: "list",
      listType: tagName === "ol" ? "number" : "bullet",
      tag: tagName,
      format: "",
      indent: 0,
      direction: null,
      version: 1,
      children
    };
  }
  if (tagName === "li") {
    return {
      type: "listitem",
      value: 1,
      format: "",
      indent: 0,
      direction: null,
      version: 1,
      children
    };
  }
  if (tagName === "blockquote") {
    return {
      type: "quote",
      format: "",
      indent: 0,
      direction: null,
      version: 1,
      children
    };
  }
  if (tagName === "a") {
    return {
      type: "link",
      url: el.getAttribute("href") || "",
      target: el.getAttribute("target"),
      rel: el.getAttribute("rel"),
      title: el.getAttribute("title"),
      format: "",
      indent: 0,
      direction: null,
      version: 1,
      children
    };
  }
  if (tagName === "pre") {
    const codeEl = el.querySelector("code");
    const lang = codeEl?.className.match(/language-(\w+)/)?.[1] || null;
    const textContent = codeEl ? codeEl.textContent || "" : el.textContent || "";
    return {
      type: "code",
      language: lang,
      format: "",
      indent: 0,
      direction: null,
      version: 1,
      children: [
        {
          type: "text",
          text: textContent,
          format: 0,
          detail: 0,
          mode: "normal",
          style: "",
          version: 1
        }
      ]
    };
  }
  if (tagName === "img") {
    return {
      type: "image",
      src: el.getAttribute("src") || "",
      altText: el.getAttribute("alt") || "",
      version: 1
    };
  }
  if (tagName === "hr") {
    return {
      type: "horizontalrule",
      version: 1
    };
  }
  if (tagName === "br") {
    return {
      type: "linebreak",
      version: 1
    };
  }
  return {
    type: "paragraph",
    format: "",
    indent: 0,
    direction: null,
    version: 1,
    children
  };
}
function fallbackHtmlToLexical(html) {
  const clean = html.replace(/<!DOCTYPE[^>]*>/i, "").replace(/<\/?(html|head|body)[^>]*>/gi, "").trim();
  const blockRegex = /<(p|h[1-6]|ul|ol|blockquote|pre)[\s\S]*?<\/\1>/gi;
  const blocks = clean.match(blockRegex);
  if (!blocks || !blocks.length) {
    const stripped = clean.replace(/<[^>]+>/g, "");
    return {
      root: {
        type: "root",
        format: "",
        indent: 0,
        version: 1,
        direction: null,
        children: [
          {
            type: "paragraph",
            format: "",
            indent: 0,
            version: 1,
            direction: null,
            children: [
              {
                type: "text",
                text: stripped,
                format: 0,
                detail: 0,
                mode: "normal",
                style: "",
                version: 1
              }
            ]
          }
        ]
      }
    };
  }
  const children = blocks.map((block) => {
    const match = block.match(/^<([a-z0-9]+)[^>]*>([\s\S]*?)<\/\1>$/i);
    if (!match) {
      return createEmptyParagraph();
    }
    const tag = match[1].toLowerCase();
    const innerHtml = match[2];
    if (/^h[1-6]$/.test(tag)) {
      return {
        type: "heading",
        tag,
        format: "",
        indent: 0,
        direction: null,
        version: 1,
        children: [
          {
            type: "text",
            text: innerHtml.replace(/<[^>]+>/g, ""),
            format: 0,
            detail: 0,
            mode: "normal",
            style: "",
            version: 1
          }
        ]
      };
    }
    if (tag === "blockquote") {
      return {
        type: "quote",
        format: "",
        indent: 0,
        direction: null,
        version: 1,
        children: [
          {
            type: "text",
            text: innerHtml.replace(/<[^>]+>/g, ""),
            format: 0,
            detail: 0,
            mode: "normal",
            style: "",
            version: 1
          }
        ]
      };
    }
    return {
      type: "paragraph",
      format: "",
      indent: 0,
      direction: null,
      version: 1,
      children: [
        {
          type: "text",
          text: innerHtml.replace(/<[^>]+>/g, ""),
          format: 0,
          detail: 0,
          mode: "normal",
          style: "",
          version: 1
        }
      ]
    };
  });
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: null,
      children
    }
  };
}

// src/modules/tickets.ts
var TicketsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * List all tickets for current user.
   * GET /v2/tickets
   */
  async list() {
    return this.http.get("/v2/tickets");
  }
  /**
   * Alias for list.
   */
  async getTickets() {
    return this.list();
  }
  /**
   * List ticket categories.
   * GET /v2/tickets/categories
   */
  async getCategories() {
    return this.http.get("/v2/tickets/categories");
  }
  /**
   * Get single ticket by ID.
   * GET /v2/tickets/:ticketId
   */
  async get(ticketId) {
    return this.http.get(`/v2/tickets/${ticketId}`);
  }
  /**
   * Create a new support ticket.
   * Plain text message is automatically transformed to valid Lexical rich-text JSON format.
   * POST /v2/tickets
   */
  async create(data) {
    const payload = {
      ...data,
      message: toLexical(data.message)
    };
    const ticket = await this.http.post("/v2/tickets", payload);
    this.events.emit("ticket:created", ticket);
    return ticket;
  }
  /**
   * Reply to a ticket.
   * Plain text message is automatically transformed to valid Lexical rich-text JSON format.
   * POST /v2/tickets/:ticketId/reply
   */
  async reply(ticketId, replyData) {
    const rawMessage = typeof replyData === "string" ? replyData : replyData.message;
    const payload = { message: toLexical(rawMessage) };
    const response = await this.http.post(`/v2/tickets/${ticketId}/reply`, payload);
    this.events.emit("ticket:replied", { ticketId, response });
    return response;
  }
  /**
   * Close a ticket with optional resolution reason.
   * POST /v2/tickets/:ticketId/close
   */
  async close(ticketId, reason) {
    const response = await this.http.post(`/v2/tickets/${ticketId}/close`, { reason });
    this.events.emit("ticket:closed", { ticketId, reason, response });
    return response;
  }
  /**
   * Reopen a closed ticket.
   * POST /v2/tickets/:ticketId/open
   */
  async open(ticketId) {
    const response = await this.http.post(`/v2/tickets/${ticketId}/open`, {});
    this.events.emit("ticket:opened", { ticketId, response });
    return response;
  }
  /**
   * Alias for open.
   */
  async reopen(ticketId) {
    return this.open(ticketId);
  }
};

// src/modules/posts.ts
var PostsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * List posts with optional filters and pagination.
   * GET /v2/posts
   */
  async list(query) {
    return this.http.get("/v2/posts", {
      params: query
    });
  }
  /**
   * Get post by slug or ID.
   * GET /v2/posts/:idOrSlug
   */
  async getBySlug(slug) {
    return this.get(slug);
  }
  /**
   * Get post by ID or slug.
   * GET /v2/posts/:idOrSlug
   */
  async get(idOrSlug) {
    const response = await this.http.get(`/v2/posts/${idOrSlug}`);
    return response.data || response;
  }
  /**
   * Like / toggle like for a post.
   * POST /v2/posts/:id/like
   */
  async like(id) {
    const response = await this.http.post(`/v2/posts/${id}/like`, {});
    this.events.emit("post:liked", response);
    return response;
  }
  /**
   * Get posts liked by a user (e.g. for user profile favorites tab).
   * GET /v2/posts/user/:userId/liked
   */
  async getUserLiked(userId = "me", page = 1, limit = 10) {
    return this.http.get(`/v2/posts/user/${userId}/liked`, {
      params: { page, limit }
    });
  }
};

// src/modules/pages.ts
var PagesModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * List all published static pages.
   * GET /v2/pages/public
   */
  async list() {
    return this.http.get("/v2/pages/public");
  }
  /**
   * Get page details and content by slug.
   * GET /v2/pages/slug/:slug
   */
  async getBySlug(slug) {
    return this.http.get(`/v2/pages/slug/${slug}`);
  }
};

// src/modules/coupons.ts
var CouponsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Validate and get coupon discount details.
   * GET /coupons/:couponCode
   */
  async get(couponCode) {
    return this.http.get(`/coupons/${couponCode}`);
  }
};

// src/modules/redeemCode.ts
var RedeemCodeModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Redeem gift/promo code.
   * POST /redeem-codes/use
   */
  async use(code) {
    const response = await this.http.post("/redeem-codes/use", { code });
    this.events.emit("redeem:used", response);
    return response;
  }
};

// src/modules/servers.ts
var ServersModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get server list with live player counts and online status.
   * GET /config/servers
   */
  async getList() {
    return this.http.get("/config/servers");
  }
  /**
   * Alias for getList.
   */
  async list() {
    return this.getList();
  }
};

// src/modules/payments.ts
var PaymentsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get public active payment providers and bonus multipliers.
   * GET /config/payment/public
   */
  async getPublicProviders() {
    return this.http.get("/config/payment/public");
  }
  /**
   * Initiate a payment session (PayTR, Shopier, CrafterPayments etc.).
   * POST /payment/initiate
   */
  async initiate(data) {
    const payload = {
      ...data,
      providerId: data.providerId || data.provider
    };
    const response = await this.http.post("/payment/initiate", payload);
    this.events.emit("payment:initiated", response);
    return response;
  }
  /**
   * Check payment status by payment ID.
   * POST /payment/check
   */
  async check(paymentId) {
    const response = await this.http.post("/payment/check", { paymentId });
    this.events.emit("payment:checked", response);
    return response;
  }
};

// src/modules/statistics.ts
var StatisticsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get homepage statistics: latest purchases, payments, signups, leaderboard and total users.
   * GET /v2/statistics?limit=:limit
   */
  async get(limit = 5) {
    return this.http.get("/v2/statistics", {
      params: { limit }
    });
  }
};

// src/modules/punishments.ts
var PunishmentsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * List punishments with pagination.
   * GET /v2/punishments
   */
  async list(page = 1, limit = 10) {
    return this.http.get("/v2/punishments", {
      params: { page, limit }
    });
  }
  /**
   * Search punishments by player name and optional type (ban, mute etc.).
   * GET /v2/punishments/search?query=:query&type=:type
   */
  async search(query, type) {
    return this.http.get("/v2/punishments/search", {
      params: { query, type }
    });
  }
};

// src/modules/vote.ts
var VoteModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get active vote sites with player cooldowns.
   * GET /config/vote-providers
   */
  async getProviders() {
    return this.http.get("/config/vote-providers");
  }
  /**
   * Process vote request.
   * POST /config/vote-providers/vote
   */
  async vote(providerId, extraData = {}) {
    const response = await this.http.post("/config/vote-providers/vote", { providerId, ...extraData });
    this.events.emit("vote:success", { providerId, response });
    return response;
  }
};

// src/modules/legal.ts
var LegalModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get legal documents (terms of service, privacy policy, rules, refund policy etc.).
   * GET /config/legal
   */
  async getDocuments() {
    return this.http.get("/config/legal");
  }
};

// src/modules/reports.ts
var ReportsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Report a user to staff.
   * POST /reports/:reportedUserId
   */
  async create(reportedUserId, data) {
    const response = await this.http.post(`/reports/${reportedUserId}`, data);
    this.events.emit("report:created", response);
    return response;
  }
};

// src/modules/forum.ts
var ForumModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get all forum categories.
   * GET /forum/categories
   */
  async getCategories() {
    return this.http.get("/forum/categories");
  }
  /**
   * Get topics under a category.
   * GET /forum/category/:categoryId/topics
   */
  async getTopics(categoryId) {
    return this.http.get(`/forum/category/${categoryId}/topics`);
  }
  /**
   * Get topic details and messages.
   * GET /forum/topic/:topicId
   */
  async getTopic(topicId) {
    return this.http.get(`/forum/topic/${topicId}`);
  }
  /**
   * Create a new topic in a category.
   * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
   * POST /forum/category/:categoryId/topic
   */
  async createTopic(categoryId, data) {
    const payload = {
      title: data.title,
      content: toLexical(data.content)
    };
    const topic = await this.http.post(`/forum/category/${categoryId}/topic`, payload);
    this.events.emit("forum:topic_created", topic);
    return topic;
  }
  /**
   * Post a message in a topic.
   * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
   * POST /forum/topic/:topicId/message
   */
  async addMessage(topicId, content) {
    const res = await this.http.post(`/forum/topic/${topicId}/message`, { content: toLexical(content) });
    this.events.emit("forum:message_added", { topicId, message: res });
    return res;
  }
  /**
   * Reply / quote a forum message.
   * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
   * POST /forum/message/:messageId/reply
   */
  async replyMessage(messageId, content) {
    const res = await this.http.post(`/forum/message/${messageId}/reply`, { content: toLexical(content) });
    this.events.emit("forum:reply_added", { messageId, reply: res });
    return res;
  }
  /**
   * Like / toggle like for a topic.
   * POST /forum/topic/:topicId/like
   */
  async likeTopic(topicId) {
    const res = await this.http.post(`/forum/topic/${topicId}/like`, {});
    this.events.emit("forum:topic_liked", { topicId, likeCount: res?.likeCount ?? res?.data?.likeCount });
    return res;
  }
  /**
   * Unlike a topic.
   * DELETE /forum/topic/:topicId/like
   */
  async unlikeTopic(topicId) {
    const res = await this.http.delete(`/forum/topic/${topicId}/like`);
    this.events.emit("forum:topic_unliked", { topicId, likeCount: res?.likeCount ?? res?.data?.likeCount });
    return res;
  }
  /**
   * Get forum statistics (latest topics/replies).
   * GET /forum/statistics
   */
  async getStatistics() {
    return this.http.get("/forum/statistics");
  }
};

// src/modules/helpcenter.ts
var HelpcenterModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get help center overview containing categories, featured items and FAQs.
   * GET /helpcenter
   */
  async getOverview(query) {
    return this.http.get("/helpcenter", {
      params: query
    });
  }
  /**
   * Alias for getOverview.
   */
  async getCategories(query) {
    return this.getOverview(query);
  }
  /**
   * Get single help category with its articles.
   * GET /helpcenter/category/:categoryId
   */
  async getCategory(categoryId) {
    return this.http.get(`/helpcenter/category/${categoryId}`);
  }
  /**
   * Get single article details.
   * GET /helpcenter/item/:itemId
   */
  async getArticle(itemId) {
    return this.http.get(`/helpcenter/item/${itemId}`);
  }
};

// src/modules/staffForms.ts
var StaffFormsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * List open staff application forms.
   * GET /staff-forms
   */
  async list() {
    return this.http.get("/staff-forms");
  }
  /**
   * Get application form details and fields by ID.
   * GET /staff-forms/:formId
   */
  async get(formId) {
    return this.http.get(`/staff-forms/${formId}`);
  }
  /**
   * Submit an application for a staff form.
   * Accepts either an array of { inputId, value } or an object of { [inputId]: value }.
   * POST /staff-forms/:formId/apply
   */
  async apply(formId, answers) {
    const values = Array.isArray(answers) ? answers.map((item) => ({ inputId: item.inputId, value: String(item.value) })) : Object.entries(answers).map(([inputId, value]) => ({
      inputId,
      value: value !== void 0 && value !== null ? String(value) : ""
    }));
    const response = await this.http.post(`/staff-forms/${formId}/apply`, { values });
    this.events.emit("form:submitted", { formId, response });
    return response;
  }
};

// src/modules/search.ts
var SearchModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Global metadata live search across users, posts, tickets, pages, and products.
   * GET /metadata-search?q=:query&limit=:limit
   */
  async metadataSearch(query, limit = 5) {
    const res = await this.http.get("/metadata-search", {
      params: { q: query, limit }
    });
    return Array.isArray(res) ? res : res?.data || [];
  }
  /**
   * Alias for metadataSearch.
   */
  async query(searchTerm, limit = 5) {
    return this.metadataSearch(searchTerm, limit);
  }
};

// src/modules/seo.ts
var SeoModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get global website SEO configuration (meta tags, keywords, og:image, favicon etc.).
   * GET /v2/seo/config
   */
  async getConfig() {
    return this.http.get("/v2/seo/config");
  }
  /**
   * Get dynamic sitemap URL entries for all published posts, pages, categories, and products.
   * GET /v2/seo/sitemap-data
   */
  async getSitemapData() {
    return this.http.get("/v2/seo/sitemap-data");
  }
};

// src/modules/luckperms.ts
var LuckPermsModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get player's LuckPerms primary group, inherited groups, and active permissions.
   * Identifier can be a player username or Minecraft UUID.
   * GET /v2/modules/luckperms/player/:identifier
   */
  async getPlayer(identifier) {
    return this.http.get(`/v2/modules/luckperms/player/${identifier}`);
  }
  /**
   * Get list of available LuckPerms groups configured on the server.
   * GET /v2/modules/luckperms/groups
   */
  async getGroups() {
    return this.http.get("/v2/modules/luckperms/groups");
  }
};

// src/modules/website.ts
var WebsiteModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Get website general info, active plugin modules (discord_bot, authme, luckperms, etc.), and settings.
   * Resolves to GET /api/storefront in storefront mode, or GET /website/:websiteId in direct mode.
   */
  async getInfo() {
    return this.http.get("");
  }
};

// src/index.ts
var Crafter = class {
  config;
  http;
  events;
  auth;
  users;
  store;
  cart;
  marketplace;
  chest;
  tickets;
  posts;
  pages;
  coupons;
  redeemCode;
  redeemCodes;
  servers;
  payments;
  statistics;
  punishments;
  vote;
  legal;
  reports;
  forum;
  helpcenter;
  staffForms;
  search;
  seo;
  luckperms;
  website;
  utils = {
    lexicalToHtml,
    lexicalToText,
    lexicalToPlainText,
    toLexical,
    htmlToLexical,
    isLexicalFormat,
    formats: {
      IS_BOLD,
      IS_ITALIC,
      IS_STRIKETHROUGH,
      IS_UNDERLINE,
      IS_CODE,
      IS_SUBSCRIPT,
      IS_SUPERSCRIPT,
      IS_HIGHLIGHT
    }
  };
  static utils = {
    lexicalToHtml,
    lexicalToText,
    lexicalToPlainText,
    toLexical,
    htmlToLexical,
    isLexicalFormat,
    formats: {
      IS_BOLD,
      IS_ITALIC,
      IS_STRIKETHROUGH,
      IS_UNDERLINE,
      IS_CODE,
      IS_SUBSCRIPT,
      IS_SUPERSCRIPT,
      IS_HIGHLIGHT
    }
  };
  constructor(config = {}) {
    this.config = {
      apiBase: "/api/storefront",
      ...config
    };
    this.events = new EventEmitter();
    this.http = new HttpClient(this.config);
    this.auth = new AuthModule(this.http, this.events);
    this.users = new UsersModule(this.http, this.events);
    this.store = new StoreModule(this.http, this.events);
    const cartModule = new CartModule(this.http, this.events);
    this.cart = cartModule;
    this.marketplace = cartModule;
    this.chest = new ChestModule(this.http, this.events);
    this.tickets = new TicketsModule(this.http, this.events);
    this.posts = new PostsModule(this.http, this.events);
    this.pages = new PagesModule(this.http, this.events);
    this.coupons = new CouponsModule(this.http, this.events);
    const redeemModule = new RedeemCodeModule(this.http, this.events);
    this.redeemCode = redeemModule;
    this.redeemCodes = redeemModule;
    this.servers = new ServersModule(this.http, this.events);
    this.payments = new PaymentsModule(this.http, this.events);
    this.statistics = new StatisticsModule(this.http, this.events);
    this.punishments = new PunishmentsModule(this.http, this.events);
    this.vote = new VoteModule(this.http, this.events);
    this.legal = new LegalModule(this.http, this.events);
    this.reports = new ReportsModule(this.http, this.events);
    this.forum = new ForumModule(this.http, this.events);
    this.helpcenter = new HelpcenterModule(this.http, this.events);
    this.staffForms = new StaffFormsModule(this.http, this.events);
    this.search = new SearchModule(this.http, this.events);
    this.seo = new SeoModule(this.http, this.events);
    this.luckperms = new LuckPermsModule(this.http, this.events);
    this.website = new WebsiteModule(this.http, this.events);
  }
  on(event, handler) {
    return this.events.on(event, handler);
  }
  off(event, handler) {
    this.events.off(event, handler);
  }
  once(event, handler) {
    return this.events.once(event, handler);
  }
  emit(event, payload) {
    this.events.emit(event, payload);
  }
};
var index_default = Crafter;

export { AuthModule, CartModule, ChestModule, CouponsModule, Crafter, CrafterError, EventEmitter, ForumModule, HelpcenterModule, HttpClient, IS_BOLD, IS_CODE, IS_HIGHLIGHT, IS_ITALIC, IS_STRIKETHROUGH, IS_SUBSCRIPT, IS_SUPERSCRIPT, IS_UNDERLINE, LegalModule, LuckPermsModule, PagesModule, PaymentsModule, PostsModule, PunishmentsModule, RedeemCodeModule, ReportsModule, SearchModule, SeoModule, ServersModule, StaffFormsModule, StatisticsModule, StoreModule, TicketsModule, UsersModule, VoteModule, WebsiteModule, index_default as default, htmlToLexical, isCrafterError, isLexicalFormat, lexicalToHtml, lexicalToPlainText, lexicalToText, toLexical };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map
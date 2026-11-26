'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// src/core/errors.ts
var CrafterError = class _CrafterError extends Error {
  statusCode;
  error;
  /** Backend hata kodu (ErrorType), ör. 'out_of_stock', 'balance_top_up_limit_exceeded' */
  type;
  details;
  isCrafterError = true;
  constructor(payload) {
    const formattedMessage = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message || "An unexpected Crafter SDK error occurred";
    super(formattedMessage);
    this.name = "CrafterError";
    this.statusCode = payload.statusCode ?? 500;
    this.error = payload.error;
    this.type = payload.type;
    this.details = payload.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
  static fromResponse(statusCode, data) {
    if (typeof data === "string") {
      return new _CrafterError({ statusCode, message: data });
    }
    const apiError = data;
    const payload = {
      statusCode: apiError?.statusCode || statusCode,
      message: apiError?.message || `HTTP Request failed with status ${statusCode}`,
      error: apiError?.error,
      type: typeof apiError?.type === "string" ? apiError.type : void 0,
      details: apiError?.details || data
    };
    switch (payload.type) {
      case PaymentErrorType.OUT_OF_STOCK:
        return new CrafterOutOfStockError(payload);
      case PaymentErrorType.BALANCE_TOP_UP_UNAVAILABLE:
      case PaymentErrorType.BALANCE_TOP_UP_LIMIT_EXCEEDED:
      case PaymentErrorType.BALANCE_TOP_UP_TOTAL_LIMIT_EXCEEDED:
        return new CrafterBalanceTopUpError(payload);
      default:
        if (payload.type && COUPON_ERROR_TYPES.includes(payload.type)) {
          return new CrafterCouponError(payload);
        }
        if (payload.type && PAYMENT_PROVIDER_ERROR_TYPES.includes(payload.type)) {
          return new CrafterPaymentProviderError(payload);
        }
        return new _CrafterError(payload);
    }
  }
};
var PaymentErrorType = {
  OUT_OF_STOCK: "out_of_stock",
  BALANCE_TOP_UP_UNAVAILABLE: "balance_top_up_unavailable",
  BALANCE_TOP_UP_LIMIT_EXCEEDED: "balance_top_up_limit_exceeded",
  BALANCE_TOP_UP_TOTAL_LIMIT_EXCEEDED: "balance_top_up_total_limit_exceeded",
  SELLER_ENTITY_NOT_READY: "seller_entity_not_ready",
  TAX_CALCULATION_FAILED: "tax_calculation_failed",
  TAX_LOCATION_INVALID: "tax_location_invalid",
  PAYMENT_PROVIDER_NOT_FOUND: "payment_provider_not_found",
  PAYMENT_PROVIDER_UNSUPPORTED: "payment_provider_unsupported",
  PAYMENT_CONFIG_ERROR: "payment_config_error",
  PAYMENT_INITIALIZATION_FAILED: "payment_initialization_failed",
  PAYMENT_FAILED: "payment_failed",
  /** İstemcinin gönderdiği para birimi mağazanınkinden (ya da teklifinkinden) farklı */
  PAYMENT_CURRENCY_MISMATCH: "payment_currency_mismatch",
  /** Sağlayıcı / satıcı bu para birimini desteklemiyor */
  PAYMENT_CURRENCY_UNSUPPORTED: "payment_currency_unsupported",
  /** Mağaza müşteri para birimini kapattı: ödeme mağaza para biriminde */
  CUSTOMER_CURRENCY_NOT_ALLOWED: "customer_currency_not_allowed",
  /** Teklif bulunamadı / süresi doldu / sepet değişti: yeni teklif alınır */
  PRESENTMENT_QUOTE_NOT_FOUND: "presentment_quote_not_found",
  PRESENTMENT_QUOTE_EXPIRED: "presentment_quote_expired",
  PRESENTMENT_QUOTE_MISMATCH: "presentment_quote_mismatch"
};
var PAYMENT_PROVIDER_ERROR_TYPES = [
  PaymentErrorType.SELLER_ENTITY_NOT_READY,
  PaymentErrorType.TAX_CALCULATION_FAILED,
  PaymentErrorType.TAX_LOCATION_INVALID,
  PaymentErrorType.PAYMENT_PROVIDER_NOT_FOUND,
  PaymentErrorType.PAYMENT_PROVIDER_UNSUPPORTED,
  PaymentErrorType.PAYMENT_CONFIG_ERROR,
  PaymentErrorType.PAYMENT_INITIALIZATION_FAILED,
  PaymentErrorType.PAYMENT_FAILED,
  PaymentErrorType.PAYMENT_CURRENCY_UNSUPPORTED
];
var CouponErrorType = {
  NOT_FOUND: "coupon_not_found",
  INACTIVE: "coupon_inactive",
  USAGE_LIMIT_REACHED: "coupon_usage_limit_reached",
  ALREADY_USED_BY_USER: "coupon_already_used_by_user",
  NOT_ASSIGNED_TO_USER: "coupon_not_assigned_to_user",
  /** Sepet tutarı kuponun alt sınırının altında (`details.minCartValue`, mağaza para biriminde) */
  CART_TOTAL_BELOW_MINIMUM: "coupon_cart_total_below_minimum",
  INVALID_FOR_PRODUCT: "coupon_invalid_for_product",
  INVALID_TYPE: "coupon_invalid_type"
};
var COUPON_ERROR_TYPES = Object.values(CouponErrorType);
var CrafterCouponError = class extends CrafterError {
  /** `coupon_cart_total_below_minimum` ise kuponun alt sınırı (`details.minCartValue`); yoksa null */
  minCartValue;
  constructor(payload) {
    super(payload);
    this.name = "CrafterCouponError";
    const min = Number(payload.details?.minCartValue);
    this.minCartValue = payload.details?.minCartValue != null && Number.isFinite(min) ? min : null;
  }
};
var CrafterOutOfStockError = class extends CrafterError {
  /** Tükenen ürünlerin kimlikleri (`details.productIds`); backend göndermediyse boş */
  productIds;
  constructor(payload) {
    super({ ...payload, type: payload.type ?? PaymentErrorType.OUT_OF_STOCK });
    this.name = "CrafterOutOfStockError";
    const ids = payload.details?.productIds;
    this.productIds = Array.isArray(ids) ? ids.map(String) : [];
  }
};
var CrafterBalanceTopUpError = class extends CrafterError {
  reason;
  /** Limit hatalarında backend'in döndürdüğü limitler; `unavailable` için null */
  limits;
  constructor(payload) {
    super(payload);
    this.name = "CrafterBalanceTopUpError";
    this.reason = payload.type === PaymentErrorType.BALANCE_TOP_UP_LIMIT_EXCEEDED ? "single_limit" : payload.type === PaymentErrorType.BALANCE_TOP_UP_TOTAL_LIMIT_EXCEEDED ? "total_limit" : "unavailable";
    const d = payload.details;
    this.limits = this.reason !== "unavailable" && d && typeof d === "object" && ("maxSingleUsd" in d || "remainingAmount" in d) ? {
      currency: d.currency,
      maxSingleUsd: d.maxSingleUsd,
      maxPaidUsd: d.maxPaidUsd,
      maxSingleAmount: d.maxSingleAmount ?? null,
      remainingAmount: d.remainingAmount ?? null
    } : null;
  }
};
var CrafterPaymentProviderError = class extends CrafterError {
  /** Kullanıcı aynı bilgilerle biraz sonra tekrar deneyebilir mi */
  retryable;
  constructor(payload) {
    super(payload);
    this.name = "CrafterPaymentProviderError";
    this.retryable = payload.type === PaymentErrorType.SELLER_ENTITY_NOT_READY || payload.type === PaymentErrorType.TAX_CALCULATION_FAILED || payload.type === PaymentErrorType.PAYMENT_INITIALIZATION_FAILED;
  }
};
function isCrafterError(err) {
  return err instanceof CrafterError || typeof err === "object" && err !== null && err.isCrafterError === true;
}
function isOutOfStockError(err) {
  return err instanceof CrafterOutOfStockError;
}
function isBalanceTopUpError(err) {
  return err instanceof CrafterBalanceTopUpError;
}
function isCouponError(err) {
  return err instanceof CrafterCouponError || isCrafterError(err) && typeof err.type === "string" && COUPON_ERROR_TYPES.includes(err.type);
}
function isPaymentProviderError(err) {
  return err instanceof CrafterPaymentProviderError;
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
  async enableAuthenticator(code2) {
    const res = await this.http.post("/v2/users/me/2fa/authenticator/enable", { code: code2 });
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
  async enableEmail2Fa(code2) {
    const res = await this.http.post("/v2/users/me/2fa/email/enable", { code: code2 });
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
  async enableDiscord2Fa(code2) {
    const res = await this.http.post("/v2/users/me/2fa/discord/enable", { code: code2 });
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
   * List products. With no filter the full catalog is returned.
   * Groups combine; several values in one group match any of them.
   * GET /products
   */
  async getProducts(filter) {
    const params = filter ? {
      type: this.joinFilter(filter.type),
      server: this.joinFilter(filter.server),
      category: this.joinFilter(filter.category),
      tag: this.joinFilter(filter.tag),
      q: filter.q || void 0,
      priceMin: filter.priceMin,
      priceMax: filter.priceMax,
      available: filter.available
    } : void 0;
    return this.http.get("/products", params ? { params } : void 0);
  }
  /**
   * Filter groups for a storefront sidebar: price range, category, stock, type, tag and server.
   * GET /products/filters
   */
  async getFilters() {
    return this.http.get("/products/filters");
  }
  joinFilter(value) {
    if (value == null || value === "") return void 0;
    const joined = (Array.isArray(value) ? value : [value]).filter(Boolean).join(",");
    return joined || void 0;
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

// src/modules/payments.ts
function toNumber(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function parseTaxBreakdown(raw) {
  if (!raw || typeof raw.subtotal !== "number") return null;
  const subtotal = raw.subtotal;
  const taxAmount = toNumber(raw.taxAmount);
  const lines = Array.isArray(raw.taxes) ? raw.taxes.map((line) => ({
    country: line?.country ?? null,
    state: line?.state ?? null,
    taxType: line?.taxType ?? null,
    rate: toNumber(line?.rate),
    amount: toNumber(line?.amount)
  })) : [];
  const amount = raw.amount !== void 0 ? toNumber(raw.amount, NaN) : NaN;
  return {
    subtotal,
    taxAmount,
    total: Number.isFinite(amount) ? amount : round2(subtotal + taxAmount),
    currency: String(raw.currency || ""),
    lines
  };
}
function normalizePaymentResponse(raw, fallbackPublishableKey) {
  if (!raw || typeof raw !== "object") return raw;
  const paymentId = raw.paymentId ?? raw.payment_id;
  const tax = parseTaxBreakdown(raw);
  const result = { ...raw, tax };
  if (paymentId !== void 0) result.paymentId = paymentId;
  if (raw.type === "stripe" && typeof raw.clientSecret === "string" && raw.clientSecret) {
    const session = {
      paymentId: String(paymentId ?? ""),
      clientSecret: raw.clientSecret,
      publishableKey: raw.publishableKey || raw.stripePublishableKey || fallbackPublishableKey || null,
      amount: toNumber(raw.amount),
      currency: String(raw.currency || ""),
      tax
    };
    if (raw.merchant_oid) session.merchantOid = String(raw.merchant_oid);
    if (raw.presentment && typeof raw.presentment === "object") session.presentment = raw.presentment;
    result.stripe = session;
  }
  return result;
}
function legalTermsHeaders(consent) {
  if (!consent?.version) return void 0;
  const headers = { "x-legal-terms-version": consent.version };
  if (consent.region) headers["x-legal-terms-region"] = consent.region;
  return headers;
}
var QUOTE_RETRY_ERRORS = [
  PaymentErrorType.PRESENTMENT_QUOTE_EXPIRED,
  PaymentErrorType.PRESENTMENT_QUOTE_MISMATCH,
  PaymentErrorType.PRESENTMENT_QUOTE_NOT_FOUND
];
var errorType = (err) => isCrafterError(err) ? err.type : void 0;
async function payWithQuote(getQuote, pay) {
  const inStoreCurrency = async () => ({ ...await pay(null), customerCurrencyDisabled: true });
  for (let attempt = 0; ; attempt++) {
    let quote;
    try {
      quote = await getQuote();
    } catch (err) {
      if (errorType(err) === PaymentErrorType.CUSTOMER_CURRENCY_NOT_ALLOWED) return inStoreCurrency();
      throw err;
    }
    try {
      return { ...await pay(quote), customerCurrencyDisabled: false };
    } catch (err) {
      const type = errorType(err);
      if (type === PaymentErrorType.CUSTOMER_CURRENCY_NOT_ALLOWED) return inStoreCurrency();
      if (attempt === 0 && type && QUOTE_RETRY_ERRORS.includes(type)) continue;
      throw err;
    }
  }
}
var DELIVERY_STATES = ["pending", "delivered", "failed", "refunded"];
var DELIVERY_STATUSES = ["PENDING", "DELIVERED", "NEEDS_REVIEW", "REFUNDED"];
function parsePaymentStatus(paymentId, raw) {
  const body = raw && typeof raw === "object" && raw.data && typeof raw.data === "object" && !raw.status ? raw.data : raw || {};
  const status = String(body.status || "PENDING").toUpperCase();
  const rawDelivery = typeof body.delivery === "string" ? body.delivery.toLowerCase() : null;
  const delivery = DELIVERY_STATES.includes(rawDelivery) ? rawDelivery : null;
  const explicit = typeof body.deliveryStatus === "string" ? body.deliveryStatus.toUpperCase() : null;
  let deliveryStatus = explicit && DELIVERY_STATUSES.includes(explicit) ? explicit : explicit === "FAILED" ? "NEEDS_REVIEW" : null;
  if (!deliveryStatus && delivery) {
    deliveryStatus = delivery === "pending" ? "PENDING" : delivery === "delivered" ? "DELIVERED" : delivery === "refunded" ? "REFUNDED" : "NEEDS_REVIEW";
  }
  let outcome;
  if (status === "REFUNDED" || deliveryStatus === "REFUNDED") outcome = "refunded";
  else if (status === "COMPLETED" || status === "SUCCESS") {
    outcome = deliveryStatus === "NEEDS_REVIEW" ? "needs_review" : deliveryStatus === "PENDING" ? "processing" : "success";
  } else if (status === "PENDING") outcome = "pending";
  else outcome = "failed";
  return {
    paymentId,
    status,
    delivery,
    deliveryStatus,
    outcome,
    final: outcome !== "pending" && outcome !== "processing"
  };
}
function topUpMaxAmount(policy, providerMax) {
  const limits = [providerMax || 1e6];
  if (policy?.closedLoop) {
    if (typeof policy.maxSingleAmount === "number") limits.push(policy.maxSingleAmount);
    if (typeof policy.remainingAmount === "number") limits.push(policy.remainingAmount);
  }
  return Math.max(0, Math.min(...limits));
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("Aborted"));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
var PaymentsModule = class {
  constructor(http, events, options = {}) {
    this.http = http;
    this.events = events;
    this.options = options;
  }
  http;
  events;
  options;
  /**
   * Get public active payment providers and bonus multipliers.
   * GET /config/payment/public
   */
  async getPublicProviders() {
    return this.http.get("/config/payment/public");
  }
  /**
   * Initiate a payment session (PayTR, Shopier, KuveytTürk, CrafterPayments etc.).
   * Satıcı LLC + CrafterPayments iken yanıtta `stripe` (clientSecret, publishableKey, vergi) bulunur.
   * POST /payment/initiate
   */
  async initiate(data, options = {}) {
    const send = async (quote) => {
      const payload = {
        ...data,
        providerId: data.providerId || data.provider
      };
      if (quote) {
        payload.quoteId = quote.quoteId;
        payload.currency = quote.currency;
      } else if (options.useCustomerCurrency) {
        delete payload.quoteId;
        delete payload.currency;
      }
      const raw = await this.http.post("/payment/initiate", payload, {
        headers: legalTermsHeaders(options.legalTerms)
      });
      return normalizePaymentResponse(raw, this.options.stripePublishableKey);
    };
    const response = options.useCustomerCurrency ? await payWithQuote(
      () => this.quote({
        websiteId: data.websiteId,
        kind: "top_up",
        amount: data.amount,
        currency: options.customerCurrency
      }),
      send
    ) : await send(null);
    this.events.emit("payment:initiated", response);
    return response;
  }
  /**
   * Kilitli kur teklifi (~30 dk): tutar mağaza para biriminde hesaplanır, müşterinin para birimini sunucu belirler
   * (`currency` yalnızca öneridir). Ödeme `quoteId` ile başlatılır. Oturum gerektirir.
   * Mağaza müşteri para birimini kapattıysa 400 `customer_currency_not_allowed`.
   * POST /payment/quote
   */
  async quote(data) {
    const payload = { ...data };
    const websiteId = data.websiteId || this.options.websiteId;
    if (websiteId) payload.websiteId = websiteId;
    for (const key of Object.keys(payload)) if (payload[key] === void 0) delete payload[key];
    const quote = await this.http.post("/payment/quote", payload);
    this.events.emit("payment:quoted", quote);
    return quote;
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
  /**
   * Ödeme ve teslimat durumu (oturum gerektirmez). Stripe ödemesinde webhook gecikirse backend ödemeyi Stripe'tan okur.
   * GET /payment/status/:paymentId
   */
  async getStatus(paymentId) {
    const raw = await this.http.get(`/payment/status/${encodeURIComponent(paymentId)}`, {
      skipAuth: true
    });
    const result = parsePaymentStatus(paymentId, raw);
    this.events.emit("payment:status", result);
    return result;
  }
  /**
   * Ödeme sonucu kesinleşene kadar `getStatus` ile yoklar (Stripe `confirmPayment` sonrası).
   * Ödeme alındı ama teslimat sürüyorsa yoklama devam eder. Süre dolarsa son görülen durum döner.
   * Ağ hataları yutulur, yoklama sürer.
   */
  async waitForResult(paymentId, options = {}) {
    const { attempts = 20, intervalMs = 1500, signal } = options;
    let last = parsePaymentStatus(paymentId, { status: "PENDING" });
    for (let i = 0; i < attempts; i++) {
      if (signal?.aborted) break;
      try {
        last = await this.getStatus(paymentId);
        if (last.final) return last;
      } catch {
      }
      if (i < attempts - 1) {
        try {
          await sleep(intervalMs, signal);
        } catch {
          break;
        }
      }
    }
    return last;
  }
  /**
   * Bakiye yükleme koşulları: açık mı, limitler (USD ve mağaza para birimi), ödenmiş / bonus bakiye
   * ve koşul metninin gösterilip gösterilmeyeceği (`showTerms`). Oturum gerektirir.
   * GET /payment/balance-top-up/policy?websiteId=
   */
  async getTopUpPolicy(websiteId) {
    const id = websiteId || this.options.websiteId;
    const raw = await this.http.get("/payment/balance-top-up/policy", {
      params: id ? { websiteId: id } : void 0
    });
    const data = raw && typeof raw === "object" && raw.data && typeof raw.data === "object" ? raw.data : raw || {};
    const closedLoop = data.closedLoop === true;
    return {
      enabled: data.enabled === true,
      closedLoop,
      showTerms: closedLoop,
      currency: String(data.currency || ""),
      maxSingleUsd: toNumber(data.maxSingleUsd),
      maxPaidUsd: toNumber(data.maxPaidUsd),
      maxSingleAmount: typeof data.maxSingleAmount === "number" ? data.maxSingleAmount : null,
      remainingAmount: typeof data.remainingAmount === "number" ? data.remainingAmount : null,
      balance: toNumber(data.balance),
      paidBalance: toNumber(data.paidBalance),
      bonusBalance: toNumber(data.bonusBalance)
    };
  }
};

// src/modules/cart-store.ts
var CART_STORAGE_KEY = "cart";
var CART_COUPON_KEY = "crafter_cart_coupon";
var CART_SYNCED_KEY = "crafter_cart_synced";
function storage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
function normalizeLines(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => !!item && typeof item === "object" && !!item.id).map((item) => {
    const images = Array.isArray(item.images) ? item.images.filter((src) => typeof src === "string" && src) : [];
    if (!images.length && typeof item.image === "string" && item.image) images.push(item.image);
    return {
      ...item,
      id: String(item.id),
      name: typeof item.name === "string" ? item.name : "",
      price: Number(item.price) || 0,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      discountType: typeof item.discountType === "string" && item.discountType ? item.discountType : null,
      discountValue: item.discountValue != null && item.discountValue !== "" ? Number(item.discountValue) : null,
      images
    };
  });
}
var LocalStorageCartStore = class {
  async read() {
    const store = storage();
    if (!store) return [];
    try {
      return normalizeLines(JSON.parse(store.getItem(CART_STORAGE_KEY) || "[]"));
    } catch {
      return [];
    }
  }
  async write(lines) {
    const store = storage();
    if (!store) return;
    try {
      if (lines.length) store.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
      else if (store.getItem(CART_SYNCED_KEY) !== null) store.setItem(CART_STORAGE_KEY, "[]");
      else store.removeItem(CART_STORAGE_KEY);
    } catch {
    }
  }
  async readCoupon() {
    try {
      return storage()?.getItem(CART_COUPON_KEY) || null;
    } catch {
      return null;
    }
  }
  async writeCoupon(code2) {
    const store = storage();
    if (!store) return;
    try {
      if (code2) store.setItem(CART_COUPON_KEY, code2);
      else store.removeItem(CART_COUPON_KEY);
    } catch {
    }
  }
  subscribe(onChange) {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return () => {
    };
    const listener = (event) => {
      if (event.key === null || event.key === CART_STORAGE_KEY || event.key === CART_COUPON_KEY) onChange();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }
};

// src/modules/cart-server.ts
var CART_SYNC_KEY = "crafter_cart_sync";
function storage2() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
var COUPON_KINDS = ["percentage", "fixed", "free_product"];
function couponDetailsOf(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.code !== "string" || !raw.code) return null;
  if (!COUPON_KINDS.includes(raw.type)) return null;
  return {
    code: raw.code,
    type: raw.type,
    value: raw.value != null && raw.value !== "" && Number.isFinite(Number(raw.value)) ? Number(raw.value) : null,
    freeProductId: raw.freeProductId != null && raw.freeProductId !== "" ? String(raw.freeProductId) : null
  };
}
function couponRemovedOf(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.code !== "string" || !raw.code) return null;
  return { code: raw.code, reason: typeof raw.reason === "string" && raw.reason ? raw.reason : "coupon_invalid" };
}
function normalizeServerCart(raw) {
  const items = (Array.isArray(raw?.items) ? raw.items : []).filter((item) => item && typeof item === "object" && item.id !== void 0 && item.id !== null).map((item) => {
    const images = Array.isArray(item.images) ? item.images.filter((src) => typeof src === "string" && src) : [];
    return {
      ...item,
      id: String(item.id),
      name: typeof item.name === "string" ? item.name : "",
      price: num(item.price),
      unitPrice: num(item.unitPrice ?? item.price),
      quantity: Math.max(1, Math.floor(num(item.quantity) || 1)),
      lineTotal: num(item.lineTotal),
      discountType: typeof item.discountType === "string" && item.discountType ? item.discountType : null,
      discountValue: item.discountValue != null && item.discountValue !== "" ? num(item.discountValue) : null,
      images,
      image: typeof item.image === "string" && item.image ? item.image : images[0] || null
    };
  });
  const subtotal = raw?.subtotal != null ? num(raw.subtotal) : items.reduce((sum, line) => sum + line.lineTotal, 0);
  const discount = Math.max(0, num(raw?.discount));
  return {
    items,
    itemCount: raw?.itemCount != null ? num(raw.itemCount) : items.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    currency: typeof raw?.currency === "string" ? raw.currency : "",
    coupon: typeof raw?.coupon === "string" && raw.coupon ? raw.coupon : null,
    discount,
    total: raw?.total != null && raw.total !== "" ? Math.max(0, num(raw.total)) : Math.max(0, subtotal - discount),
    couponDetails: couponDetailsOf(raw?.couponDetails),
    couponRemoved: couponRemovedOf(raw?.couponRemoved),
    removed: Array.isArray(raw?.removed) ? raw.removed : [],
    adjusted: Array.isArray(raw?.adjusted) ? raw.adjusted : [],
    ...raw?.mode === "guest" || raw?.mode === "customer" ? { mode: raw.mode } : {}
  };
}
var MAX_LINE_QUANTITY = 999;
function readLegacyCart(store) {
  const stored = store.getItem(CART_STORAGE_KEY);
  const coupon = store.getItem(CART_COUPON_KEY) || null;
  if (stored === null && !coupon) return null;
  let lines = [];
  try {
    lines = normalizeLines(JSON.parse(stored || "[]"));
  } catch {
    lines = [];
  }
  const quantities = /* @__PURE__ */ new Map();
  for (const line of lines) {
    quantities.set(line.id, Math.min(MAX_LINE_QUANTITY, (quantities.get(line.id) ?? 0) + Math.min(MAX_LINE_QUANTITY, line.quantity)));
  }
  return { items: [...quantities].map(([id, quantity]) => ({ id, quantity })), coupon, present: stored !== null };
}
function readSyncedSnapshot(store) {
  try {
    const raw = JSON.parse(store.getItem(CART_SYNCED_KEY) || "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const snapshot = /* @__PURE__ */ new Map();
    for (const [id, quantity] of Object.entries(raw)) {
      const value = Math.floor(Number(quantity));
      if (id && Number.isFinite(value) && value > 0) snapshot.set(id, value);
    }
    return snapshot;
  } catch {
    return null;
  }
}
function writeSyncedSnapshot(store, items) {
  try {
    if (items === null) store.removeItem(CART_SYNCED_KEY);
    else store.setItem(CART_SYNCED_KEY, JSON.stringify(Object.fromEntries(items.map((item) => [item.id, item.quantity]))));
  } catch {
  }
}
function legacyCartDiff(legacy, synced) {
  const base = synced ?? /* @__PURE__ */ new Map();
  const current = new Set(legacy.items.map((item) => item.id));
  const set = legacy.items.filter((item) => base.get(item.id) !== item.quantity);
  const remove = legacy.present ? [...base.keys()].filter((id) => !current.has(id)) : [];
  return { set, remove };
}
var ServerCartClient = class {
  constructor(options) {
    this.options = options;
    this.base = options.cartApi.replace(/\/+$/, "") || "/cart";
  }
  options;
  migration = null;
  migrationConsumed = false;
  base;
  async get() {
    const migrated = await this.migrate();
    if (migrated && !this.migrationConsumed) {
      this.migrationConsumed = true;
      return migrated;
    }
    return this.request("GET", `${this.base}.js`);
  }
  async add(id, quantity, options) {
    await this.migrate();
    return this.mutate("add.js", { id, quantity, ...options && Object.keys(options).length ? { options } : {} });
  }
  async change(id, quantity) {
    await this.migrate();
    return this.mutate("change.js", { id, quantity });
  }
  async clear() {
    await this.migrate();
    return this.mutate("clear.js", {});
  }
  async setCoupon(code2) {
    await this.migrate();
    return this.mutate("coupon.js", { code: code2 });
  }
  /** Başka sekmede değişince çağrılır; aboneliği kaldıran fonksiyon döner */
  subscribe(onChange) {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return () => {
    };
    const listener = (event) => {
      if (event.key === CART_SYNC_KEY) onChange();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }
  /**
   * localStorage sepetini (`cart`: v1 temalar, SDK 1.4.0 ve öncesi, headless depo) sunucu sepetiyle eşitler; sayfa
   * başına bir kez, ilk işlemden önce çalışır. Kural storefront checkout'uyla aynıdır (#434 düzeltme):
   * - Son eşitlenen hal `crafter_cart_synced` kaydındadır. Ondan sonra eklenen ya da adedi değişen satır sunucuda bu
   *   adede ayarlanır (`/cart/add.js { items, replace: true }`, toplanmaz); `cart`'tan çıkarılan satır sunucudan da
   *   düşer (`/cart/change.js { quantity: 0 }`). Değişmeyen satır gönderilmez: sunucuda / başka cihazda yapılan
   *   değişiklik korunur, sunucuda olup `cart`'ta hiç olmayan satırlar kalır. İlk eşitlemede bütün satırlar yenidir.
   * - Sunucu sepeti dolu diye `cart` atılmaz (eski kural, eski ödenmemiş sunucu sepetinin yeni seçimin yerine geçmesine
   *   yol açıyordu). Tekrar çalışması (iki sekme, ağ hatası sonrası) sonucu değiştirmez; adetler katlanmaz.
   * - `cart` anahtarı kalır (tema sepeti); `cart` hiç yoksa sunucudan satır silinmez ve kayıt temizlenir.
   * - Ağ / sunucu hatasında kayıt güncellenmez, sonraki sayfada yeniden denenir; 4xx ret (ör. ürün satıştan kalktı)
   *   bu hali eşitlenmiş sayar.
   * - Kupon (`crafter_cart_coupon`) sunucu sepetinde kupon yoksa ve sunucu kabul ederse taşınır (#476); 4xx ret
   *   dönen sepette `couponRemoved: { code, reason }` olarak bir kez bildirilir. Denemeden sonra anahtar silinir.
   * Dönüş: eşitleme sırasında okunan son sepet (yoksa null).
   */
  migrate() {
    if (!this.migration) this.migration = this.runMigration();
    return this.migration;
  }
  async runMigration() {
    const store = storage2();
    if (!store) return null;
    let legacy;
    let synced;
    try {
      legacy = readLegacyCart(store);
      synced = readSyncedSnapshot(store);
      if (!legacy) {
        if (synced) store.removeItem(CART_SYNCED_KEY);
        return null;
      }
    } catch {
      return null;
    }
    const current = legacy;
    const rejected = (error) => {
      const status = error?.statusCode ?? 0;
      return status >= 400 && status < 500;
    };
    const { set, remove } = legacyCartDiff(current, synced);
    let changed = false;
    try {
      let cart = await this.request("GET", `${this.base}.js`);
      try {
        if (set.length) {
          cart = await this.request("POST", `${this.base}/add.js`, { items: set, replace: true });
          changed = true;
        }
        for (const id of remove) {
          cart = await this.request("POST", `${this.base}/change.js`, { id, quantity: 0 });
          changed = true;
        }
      } catch (error) {
        if (!rejected(error)) throw error;
        writeSyncedSnapshot(store, current.items);
        if (changed) this.ping();
        return null;
      }
      writeSyncedSnapshot(store, current.present ? current.items : null);
      if (current.coupon) {
        if (!cart.coupon) {
          try {
            cart = await this.request("POST", `${this.base}/coupon.js`, { code: current.coupon });
            changed = true;
          } catch (error) {
            if (!rejected(error)) throw error;
            cart = { ...cart, couponRemoved: { code: current.coupon, reason: error.type || "coupon_invalid" } };
          }
        }
        try {
          store.removeItem(CART_COUPON_KEY);
        } catch {
        }
      }
      if (changed) this.ping();
      return cart;
    } catch {
      if (changed) this.ping();
      return null;
    }
  }
  async mutate(path, body) {
    const cart = await this.request("POST", `${this.base}/${path}`, body);
    this.ping();
    return cart;
  }
  ping() {
    try {
      storage2()?.setItem(CART_SYNC_KEY, String(Date.now()));
    } catch {
    }
  }
  async request(method, url, body) {
    const doFetch = this.options.fetchImpl ?? (typeof fetch === "function" ? fetch : void 0);
    if (!doFetch) {
      throw new CrafterError({ statusCode: 503, type: "cart_unavailable", message: "[Crafter SDK] fetch bulunamad\u0131" });
    }
    const headers = { Accept: "application/json" };
    if (method === "POST") headers["Content-Type"] = "application/json";
    const locale = this.options.locale?.();
    if (locale) headers["X-Crafter-Locale"] = locale;
    let response;
    try {
      response = await doFetch(url, {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        ...method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}
      });
    } catch (error) {
      throw new CrafterError({
        statusCode: 503,
        type: "cart_unavailable",
        message: `[Crafter SDK] Sepete ula\u015F\u0131lamad\u0131: ${error instanceof Error ? error.message : String(error)}`
      });
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) throw CrafterError.fromResponse(response.status, data ?? `HTTP ${response.status}`);
    return normalizeServerCart(data);
  }
};

// src/core/dom-events.ts
var DOM_EVENTS = {
  ready: "crafter:ready",
  cartUpdated: "crafter:cart:updated",
  localizationChanged: "crafter:localization:changed"
};
function targetDocument() {
  return typeof document !== "undefined" ? document : void 0;
}
function dispatchDomEvent(name, detail) {
  const doc = targetDocument();
  if (!doc || typeof doc.dispatchEvent !== "function" || typeof CustomEvent !== "function") return;
  const type = name.startsWith("crafter:") ? name : `crafter:${name}`;
  try {
    doc.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (error) {
    console.error(`[Crafter SDK] "${type}" olay\u0131 yay\u0131lamad\u0131:`, error);
  }
}
var DomEvents = class {
  constructor(events) {
    this.events = events;
  }
  events;
  /** SDK olay yoluna ve `document`'a birlikte yayar */
  emit(name, detail) {
    this.events.emit(name, detail);
    dispatchDomEvent(name, detail);
  }
  /**
   * `document` üzerindeki `crafter:<name>` olayını dinler; işleyici `event.detail` alır. Aboneliği kaldıran fonksiyon döner.
   * @example crafter.dom.on('cart:updated', (cart) => badge.textContent = cart.itemCount)
   */
  on(name, handler) {
    const doc = targetDocument();
    if (!doc) return () => {
    };
    const type = name.startsWith("crafter:") ? name : `crafter:${name}`;
    const listener = (event) => handler(event?.detail);
    doc.addEventListener(type, listener);
    return () => doc.removeEventListener(type, listener);
  }
};

// src/modules/cart.ts
function discountedUnitPrice(line) {
  const price = Number(line.price) || 0;
  const discount = Number(line.discountValue) || 0;
  if (!line.discountType || discount <= 0) return price;
  return line.discountType === "percentage" ? Math.max(0, price - price * discount / 100) : Math.max(0, price - discount);
}
var MAX_QUANTITY = 999;
var LocalCartBackend = class {
  constructor(store, storeCurrency) {
    this.store = store;
    this.storeCurrency = storeCurrency;
  }
  store;
  storeCurrency;
  async get() {
    const [lines, coupon] = await Promise.all([this.store.read(), this.store.readCoupon()]);
    const items = lines.map((line) => {
      const unitPrice = discountedUnitPrice(line);
      return { ...line, image: line.images?.[0] || null, unitPrice, lineTotal: unitPrice * line.quantity };
    });
    const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);
    return {
      items,
      itemCount: items.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      currency: this.storeCurrency(),
      coupon,
      discount: 0,
      total: subtotal,
      couponDetails: null,
      couponRemoved: null
    };
  }
  async add(product, quantity) {
    const id = String(product.id);
    const lines = await this.store.read();
    const existing = lines.find((line) => line.id === id);
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
    } else {
      const images = Array.isArray(product.images) ? product.images.filter(Boolean) : product.image ? [product.image] : [];
      lines.push(
        ...normalizeLines([
          {
            id,
            name: product.name ?? "",
            price: Number(product.price) || 0,
            quantity: Math.min(MAX_QUANTITY, quantity),
            discountType: product.discountType || null,
            discountValue: product.discountValue ?? null,
            images
          }
        ])
      );
    }
    return this.commit(lines);
  }
  async update(id, quantity) {
    const lines = (await this.store.read()).map((line) => line.id === id ? { ...line, quantity: Math.min(MAX_QUANTITY, quantity) } : line).filter((line) => line.quantity > 0);
    return this.commit(lines);
  }
  async remove(id) {
    return this.commit((await this.store.read()).filter((line) => line.id !== id));
  }
  async clear() {
    await this.store.writeCoupon(null);
    return this.commit([]);
  }
  async setCoupon(code2) {
    await this.store.writeCoupon(code2);
    return this.commit(await this.store.read());
  }
  subscribe(onChange) {
    return this.store.subscribe(onChange);
  }
  async commit(lines) {
    await this.store.write(lines);
    return this.get();
  }
};
function cartStateFromServer(cart, fallbackCurrency = "") {
  return {
    items: cart.items.map((line) => ({
      ...line,
      image: line.image ?? line.images?.[0] ?? null,
      images: line.images ?? []
    })),
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    currency: cart.currency || fallbackCurrency,
    coupon: cart.coupon,
    discount: cart.discount ?? 0,
    total: cart.total ?? Math.max(0, cart.subtotal - (cart.discount ?? 0)),
    couponDetails: cart.couponDetails ?? null,
    couponRemoved: cart.couponRemoved ?? null,
    removed: cart.removed ?? [],
    adjusted: cart.adjusted ?? []
  };
}
var ServerCartBackend = class {
  constructor(client, storeCurrency) {
    this.client = client;
    this.storeCurrency = storeCurrency;
  }
  client;
  storeCurrency;
  async get() {
    return this.state(await this.client.get());
  }
  async add(product, quantity) {
    return this.state(await this.client.add(String(product.id), quantity, product.options ?? null));
  }
  async update(id, quantity) {
    return this.state(await this.client.change(id, Math.max(0, quantity)));
  }
  async remove(id) {
    return this.state(await this.client.change(id, 0));
  }
  async clear() {
    return this.state(await this.client.clear());
  }
  async setCoupon(code2) {
    return this.state(await this.client.setCoupon(code2));
  }
  subscribe(onChange) {
    return this.client.subscribe(onChange);
  }
  state(cart) {
    return cartStateFromServer(cart, this.storeCurrency());
  }
};
var CartModule = class {
  constructor(http, events, options = {}, deps = {}) {
    this.http = http;
    this.events = events;
    this.options = options;
    this.payments = new PaymentsModule(http, events, options);
    this.dom = deps.dom ?? new DomEvents(events);
    const storeCurrency = deps.storeCurrency ?? (() => "");
    this.backend = !deps.store && typeof deps.cartApi === "string" && deps.cartApi.trim() ? new ServerCartBackend(
      new ServerCartClient({ cartApi: deps.cartApi.trim(), locale: deps.locale, fetchImpl: deps.fetchImpl }),
      storeCurrency
    ) : new LocalCartBackend(deps.store ?? new LocalStorageCartStore(), storeCurrency);
    this.backend.subscribe(() => {
      void this.get().then((cart) => this.dom.emit("cart:updated", cart)).catch(() => void 0);
    });
  }
  http;
  events;
  options;
  payments;
  backend;
  dom;
  /** Sepet sunucuda mı (storefront sepet uçları) */
  get isServerBacked() {
    return this.backend instanceof ServerCartBackend;
  }
  // ===================== Sepet içeriği (#447, #434) =====================
  /** Sepetin güncel hali */
  async get() {
    return this.backend.get();
  }
  /** Ürünü ekler; sepette varsa adedi artar. `crafter:cart:updated` yayar. */
  async add(product, quantity = 1) {
    if (product?.id === void 0 || product.id === null || product.id === "") {
      throw new TypeError("[Crafter SDK] cart.add: \xFCr\xFCn id gerekli");
    }
    const amount = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(quantity) || 1)));
    return this.emit(this.backend.add(product, amount));
  }
  /** Satırın adedini ayarlar; 0 ya da altı satırı siler */
  async update(id, quantity) {
    const next = Math.min(MAX_QUANTITY, Math.floor(Number(quantity) || 0));
    return this.emit(this.backend.update(String(id), next));
  }
  async remove(id) {
    return this.emit(this.backend.remove(String(id)));
  }
  /** Sepeti ve kuponu boşaltır */
  async clear() {
    return this.emit(this.backend.clear());
  }
  /**
   * Kuponu uygular; null / boş kaldırır. Storefront sepetinde sunucu hemen doğrular (#476): geçerliyse `discount`,
   * `total`, `couponDetails` dolu döner; geçersizse `CrafterCouponError` (HTTP 422; `type`: `CouponErrorType`,
   * `message` sayfanın dilinde, `details.minCartValue`) fırlatılır, sepet değişmez ve `crafter:cart:updated` yayılmaz.
   * localStorage sepeti kuponu doğrulayamaz: kodu saklar, indirimi checkout hesaplar.
   */
  async setCoupon(code2) {
    return this.emit(this.backend.setCoupon(code2 ? String(code2).trim() || null : null));
  }
  /** Kuponu kaldırır (`setCoupon(null)`) */
  async removeCoupon() {
    return this.setCoupon(null);
  }
  async emit(pending) {
    const cart = await pending;
    this.dom.emit("cart:updated", cart);
    return cart;
  }
  // ===================== Ödeme =====================
  /**
   * Complete purchase using user balance.
   * POST /marketplace/purchase
   */
  async purchase(data) {
    const payload = {
      coupon: data.coupon || data.couponCode || null
    };
    if (data.productIds !== void 0) payload.productIds = data.productIds;
    if (data.items !== void 0) payload.items = data.items;
    if (data.quantities !== void 0) payload.quantities = data.quantities;
    const response = await this.http.post("/marketplace/purchase", payload);
    this.events.emit("cart:purchased", response);
    return response;
  }
  /**
   * Pay the cart at a provider. The charged amount is the storefront total.
   * Balance is not credited and the top-up multiplier is not applied.
   * Satıcı LLC + CrafterPayments iken yanıtta `stripe` (clientSecret, publishableKey, vergi kırılımı) bulunur.
   * Stok yetersizse `CrafterOutOfStockError` (HTTP 409, `productIds`) fırlatılır.
   * Para birimini sunucu belirler; `currency` verilmezse gönderilmez. `{ useCustomerCurrency: true }` ile önce kilitli
   * kur teklifi alınır ve ödeme müşteri para biriminde başlatılır (bkz. `payWithQuote`).
   * POST /payment/checkout
   */
  async checkout(data, options = {}) {
    const coupon = data.coupon || data.couponCode || void 0;
    const send = async (quote) => {
      const payload = this.checkoutPayload(data, coupon);
      if (quote) {
        payload.quoteId = quote.quoteId;
        payload.currency = quote.currency;
      } else if (options.useCustomerCurrency) {
        delete payload.quoteId;
        delete payload.currency;
      }
      const raw = await this.http.post("/payment/checkout", payload, {
        headers: legalTermsHeaders(options.legalTerms)
      });
      return normalizePaymentResponse(raw, this.options.stripePublishableKey);
    };
    const response = options.useCustomerCurrency ? await payWithQuote(
      () => this.payments.quote({
        websiteId: data.websiteId,
        kind: "cart",
        currency: options.customerCurrency,
        coupon,
        productIds: data.productIds,
        items: data.items,
        quantities: data.quantities
      }),
      send
    ) : await send(null);
    this.events.emit("cart:checkout", response);
    return response;
  }
  checkoutPayload(data, coupon) {
    const payload = {
      providerId: data.providerId,
      websiteId: data.websiteId,
      coupon,
      user: data.user
    };
    if (data.currency) payload.currency = data.currency;
    if (data.quoteId) payload.quoteId = data.quoteId;
    if (data.provider !== void 0) payload.provider = data.provider;
    if (data.paymentDetails !== void 0) payload.paymentDetails = data.paymentDetails;
    if (data.productIds !== void 0) payload.productIds = data.productIds;
    if (data.items !== void 0) payload.items = data.items;
    if (data.quantities !== void 0) payload.quantities = data.quantities;
    if (data.billingCountry !== void 0) payload.billingCountry = data.billingCountry;
    if (data.billingPostalCode !== void 0) payload.billingPostalCode = data.billingPostalCode;
    return payload;
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
  const plain2 = options?.plainSemantic === true;
  const getBlockAttributes = (defaultClasses = "") => {
    const styles = [];
    const classes = plain2 ? [] : defaultClasses ? [defaultClasses] : [];
    if (node.format) {
      if (node.format === "center") {
        plain2 ? styles.push("text-align: center") : classes.push("text-center");
      } else if (node.format === "right") {
        plain2 ? styles.push("text-align: right") : classes.push("text-right");
      } else if (node.format === "justify") {
        plain2 ? styles.push("text-align: justify") : classes.push("text-justify");
      } else if (node.format === "left" || node.format === "start") {
        plain2 ? styles.push("text-align: left") : classes.push("text-left");
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
        const content = plain2 ? html : `<span class="${isChecked ? "line-through text-gray-400" : "text-gray-700"}">${html}</span>`;
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
      const classAttr = plain2 ? "" : ' class="text-primary hover:text-blue-700 hover:underline font-bold transition-colors"';
      return `<a href="${url}"${classAttr}${targetAttr}${relAttr}${titleAttr}>${html}</a>`;
    }
    case "image":
    case "inline-image": {
      const src = escapeHtml(node.src || "");
      const alt = escapeHtml(node.altText || "");
      const classAttr = plain2 ? "" : ' class="rounded-2xl w-full max-h-[500px] object-cover my-8 shadow-sm border border-gray-100"';
      const widthAttr = node.width && node.width !== "inherit" ? ` width="${node.width}"` : "";
      const heightAttr = node.height && node.height !== "inherit" ? ` height="${node.height}"` : "";
      return `<img src="${src}" alt="${alt}"${classAttr}${widthAttr}${heightAttr} />`;
    }
    case "code": {
      const language = node.language || "";
      const langClass = language ? ` class="language-${escapeHtml(language)}"` : "";
      const preClass = plain2 ? "" : ' class="bg-gray-900 text-gray-100 p-5 rounded-2xl overflow-x-auto my-6 text-sm font-mono shadow-lg"';
      return `<pre${preClass}><code${langClass}>${html}</code></pre>`;
    }
    case "code-highlight": {
      return html;
    }
    case "table": {
      const tableClass = plain2 ? "" : ' class="w-full my-6 border-collapse border border-gray-200 shadow-sm rounded-lg overflow-hidden"';
      return `<div class="overflow-x-auto"><table${tableClass}><tbody>${html}</tbody></table></div>`;
    }
    case "tablerow": {
      const trClass = plain2 ? "" : ' class="border-b border-gray-200 even:bg-gray-50/50"';
      return `<tr${trClass}>${html}</tr>`;
    }
    case "tablecell": {
      const isHeader = Boolean(node.headerState && node.headerState > 0);
      const cellTag = isHeader ? "th" : "td";
      const colSpan = node.colSpan && node.colSpan > 1 ? ` colspan="${node.colSpan}"` : "";
      const rowSpan = node.rowSpan && node.rowSpan > 1 ? ` rowspan="${node.rowSpan}"` : "";
      const bgStyle = node.backgroundColor ? `background-color: ${node.backgroundColor};` : "";
      const styleAttr = bgStyle ? ` style="${bgStyle}"` : "";
      const cellClass = plain2 ? "" : isHeader ? ' class="px-4 py-3 text-left font-bold text-gray-900 bg-gray-100 border border-gray-200"' : ' class="px-4 py-3 text-gray-700 border border-gray-200"';
      return `<${cellTag}${cellClass}${colSpan}${rowSpan}${styleAttr}>${html}</${cellTag}>`;
    }
    case "horizontalrule":
    case "hr": {
      const hrClass = plain2 ? "" : ' class="my-8 border-t border-gray-200"';
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
        text = plain2 ? `<strong>${text}</strong>` : `<strong class="font-bold text-gray-900">${text}</strong>`;
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
        text = plain2 ? `<code>${text}</code>` : `<code class="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded-lg text-sm font-mono border border-gray-200">${text}</code>`;
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
  async use(code2) {
    const response = await this.http.post("/redeem-codes/use", { code: code2 });
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

// src/modules/licenses.ts
var LicensesModule = class {
  constructor(http, events) {
    this.http = http;
    this.events = events;
  }
  http;
  events;
  /**
   * Licenses owned by the signed-in user, including digital codes.
   * GET /marketplace/licenses
   */
  async list() {
    return this.http.get("/marketplace/licenses");
  }
  /**
   * Check a license key. The response does not include a digital code or a download URL.
   * GET /marketplace/licenses/verify
   */
  async verify(key) {
    const response = await this.http.get("/marketplace/licenses/verify", {
      params: { key },
      skipAuth: true
    });
    this.events.emit("license:verified", response);
    return response;
  }
  /**
   * Short-lived download URL for a license owned by the signed-in user.
   * GET /marketplace/licenses/:licenseId/download
   */
  async download(licenseId) {
    return this.http.get(`/marketplace/licenses/${licenseId}/download`);
  }
};

// src/modules/currencies.ts
var CurrenciesModule = class {
  constructor(http, events, options = {}) {
    this.http = http;
    this.events = events;
    this.options = options;
  }
  http;
  events;
  options;
  /**
   * Mağaza para birimi, izinli para birimleri, müşterinin para birimi ve kurlar.
   * `currency`: müşterinin seçimi (öneri); izinli değilse ülke / mağaza para birimi döner.
   * GET /payment/currencies?websiteId=&currency=
   */
  async context(params = {}) {
    return this.http.get("/payment/currencies", {
      params: { websiteId: params.websiteId || this.options.websiteId, currency: params.currency }
    });
  }
  /**
   * Mağaza para birimindeki tutarları (en fazla 500) müşteri para birimine çevirir; sıra korunur.
   * POST /payment/currencies/convert
   */
  async convert(amounts, params = {}) {
    const payload = { websiteId: params.websiteId || this.options.websiteId, amounts };
    if (params.currency) payload.currency = params.currency;
    return this.http.post("/payment/currencies/convert", payload);
  }
};

// src/utils/money.ts
function formatMoney(amount, currency, locale) {
  const value = typeof amount === "number" ? amount : Number(amount);
  const n = Number.isFinite(value) ? value : 0;
  const code2 = String(currency || "").trim().toUpperCase();
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code2 }).format(n);
  } catch {
    return code2 ? `${n.toFixed(2)} ${code2}` : n.toFixed(2);
  }
}

// src/modules/money.ts
var CODE = /^[A-Z]{3}$/;
function code(value) {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  return CODE.test(upper) ? upper : "";
}
function currencyDigits(currency) {
  try {
    const digits = new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
    return typeof digits === "number" ? digits : 2;
  } catch {
    return 2;
  }
}
function round(value, currency) {
  const factor = Math.pow(10, currencyDigits(currency));
  return Math.round(Number((value * factor).toFixed(6))) / factor;
}
var MoneyModule = class {
  constructor(getContext) {
    this.getContext = getContext;
  }
  getContext;
  /** Mağaza para birimi; bağlam yoksa boş */
  get storeCurrency() {
    return code(this.getContext()?.storeCurrency);
  }
  /** Müşterinin para birimi; kur geçersizse mağaza para birimi */
  get currency() {
    const ctx = this.getContext();
    const customer = code(ctx?.customerCurrency);
    return customer && this.rateOf(ctx) ? customer : this.storeCurrency;
  }
  /** 1 mağaza birimi = rate müşteri birimi; müşteri para birimi mağazanınkiyse 1 */
  get rate() {
    return this.currency === this.storeCurrency ? 1 : this.rateOf(this.getContext()) || 1;
  }
  /** Mağaza tutarını müşteri para birimine çevirir ve o birimin hanesine yuvarlar */
  convert(storeAmount) {
    const value = Number(storeAmount);
    const n = Number.isFinite(value) ? value : 0;
    const target = this.currency;
    return target ? round(n * this.rate, target) : n;
  }
  /**
   * @example Crafter.money.format(19.99)                    // '€18,40' (EUR müşteri, de)
   * @example Crafter.money.format(250, { convert: false })  // mağaza para biriminde
   */
  format(amount, options = {}) {
    const ctx = this.getContext();
    const locale = options.locale || ctx?.locale || void 0;
    const explicit = code(options.currency);
    if (explicit) return formatMoney(amount, explicit, locale);
    if (options.convert === false) {
      return this.storeCurrency ? formatMoney(amount, this.storeCurrency, locale) : plain(amount);
    }
    const target = this.currency;
    return target ? formatMoney(this.convert(amount), target, locale) : plain(amount);
  }
  rateOf(ctx) {
    const rate = Number(ctx?.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
  }
};
function plain(amount) {
  const value = Number(amount);
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

// src/core/context.ts
var CONTEXT_GLOBAL = "__CRAFTER_CONTEXT__";
function readPageContext(win = typeof window !== "undefined" ? window : void 0) {
  const raw = win?.[CONTEXT_GLOBAL];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}
function stripLocalePrefix(pathname, prefix) {
  if (!prefix || prefix === "/") return pathname || "/";
  if (pathname === prefix) return "/";
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

// src/modules/localization.ts
function safePath(value) {
  if (typeof value !== "string" || !value.trim()) return "/";
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\") || /[\u0000-\u001f\u007f]/.test(path)) return "/";
  return path;
}
var LocalizationModule = class {
  constructor(getContext, dom) {
    this.getContext = getContext;
    this.dom = dom;
  }
  getContext;
  dom;
  get() {
    const ctx = this.getContext();
    const htmlLang = typeof document !== "undefined" ? document.documentElement?.lang : "";
    const store = ctx?.storeCurrency || "";
    return {
      language: ctx?.locale || htmlLang || "",
      currency: ctx?.customerCurrency || store,
      languages: Array.isArray(ctx?.languages) ? [...ctx.languages] : [],
      currencies: Array.isArray(ctx?.currencies) ? [...ctx.currencies] : store ? [store] : []
    };
  }
  /**
   * Dili ve/veya para birimini değiştirir. Varsayılan olarak sayfa seçilen dildeki adrese gider.
   * `crafter:localization:changed` olayı (`{ language, currency, url }`) gezinmeden önce yayılır.
   */
  async set(change, options = {}) {
    const ctx = this.getContext();
    const body = new URLSearchParams();
    if (change.language) body.set("language", String(change.language));
    if (change.currency) body.set("currency", String(change.currency).toUpperCase());
    const returnTo = safePath(options.returnTo ?? currentPath(ctx));
    body.set("return_to", returnTo);
    const endpoint = ctx?.routes?.localization || "/localization";
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: body.toString()
      });
    } catch (error) {
      throw new CrafterError({ statusCode: 0, message: error?.message || "localization request failed" });
    }
    if (!response.ok) {
      throw new CrafterError({ statusCode: response.status, message: `localization: HTTP ${response.status}` });
    }
    let url = "";
    if ((response.headers.get("content-type") || "").includes("application/json")) {
      const data = await response.json().catch(() => null);
      if (data && typeof data.location === "string") url = safePath(data.location);
    }
    if (!url && response.redirected && response.url) {
      try {
        const final = new URL(response.url);
        url = safePath(final.pathname + final.search);
      } catch {
      }
    }
    if (!url) url = returnTo;
    const state = this.get();
    this.dom.emit("localization:changed", {
      language: change.language || state.language,
      currency: change.currency ? String(change.currency).toUpperCase() : state.currency,
      url
    });
    if (options.reload !== false && typeof window !== "undefined" && window.location) {
      window.location.assign(url);
    }
    return { url };
  }
};
function currentPath(ctx) {
  if (typeof window === "undefined" || !window.location) return "/";
  return stripLocalePrefix(window.location.pathname, ctx?.localePrefix) + (window.location.search || "");
}

// src/modules/sections.ts
var MAX_SECTIONS = 10;
function instanceId(key) {
  const index = key.indexOf(":");
  return index === -1 ? key : key.slice(index + 1);
}
var SectionsModule = class {
  async render(ids, options = {}) {
    const list = Array.from(new Set((ids || []).map((id) => String(id).trim()).filter(Boolean)));
    if (list.length === 0 || list.length > MAX_SECTIONS) {
      throw new CrafterError({ statusCode: 400, message: `sections.render: 1-${MAX_SECTIONS} b\xF6l\xFCm` });
    }
    const base = options.url ?? (typeof window !== "undefined" && window.location ? window.location.pathname + window.location.search : "/");
    const url = new URL(base, typeof window !== "undefined" && window.location ? window.location.href : "http://localhost");
    url.searchParams.set("sections", list.join(","));
    const response = await fetch(url.pathname + url.search, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object") {
      throw CrafterError.fromResponse(response.status || 500, data);
    }
    const result = {};
    for (const key of list) {
      const html = typeof data[key] === "string" ? data[key] : null;
      result[key] = html;
      if (html !== null && options.swap !== false) swapSection(instanceId(key), html);
    }
    return result;
  }
};
function swapSection(id, html) {
  if (typeof document === "undefined") return;
  const current = document.getElementById(`crafter-section-${id}`);
  if (!current) return;
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const next = holder.firstElementChild;
  if (next) current.replaceWith(next);
}

// src/version.ts
var SDK_VERSION = "1.5.2";

// src/index.ts
var DIRECT_API_BASE = "https://api.crafter.net.tr";
var PREVIEW_PARAMS = ["themeId", "preview_theme_id", "preview_ts", "preview_token"];
var Crafter = class _Crafter {
  static version = SDK_VERSION;
  version = SDK_VERSION;
  config;
  http;
  events;
  /** `document` olayları: `crafter.dom.on('cart:updated', fn)` */
  dom;
  /** Sayfa bağlamı (storefront'un yazdığı `window.__CRAFTER_CONTEXT__`); yoksa null */
  context;
  money;
  localization;
  sections;
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
  licenses;
  currencies;
  utils = {
    lexicalToHtml,
    lexicalToText,
    lexicalToPlainText,
    toLexical,
    htmlToLexical,
    isLexicalFormat,
    formatMoney,
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
    formatMoney,
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
    const mode = config.mode || (config.websiteId ? "direct" : "storefront");
    this.config = {
      mode,
      apiBase: mode === "direct" ? DIRECT_API_BASE : "/api/storefront",
      ...config
    };
    this.context = this.config.context ?? null;
    this.events = new EventEmitter();
    this.dom = new DomEvents(this.events);
    this.http = new HttpClient(this.config);
    const getContext = () => this.context;
    this.money = new MoneyModule(getContext);
    this.localization = new LocalizationModule(getContext, this.dom);
    this.sections = new SectionsModule();
    this.auth = new AuthModule(this.http, this.events);
    this.users = new UsersModule(this.http, this.events);
    this.store = new StoreModule(this.http, this.events);
    const cartModule = new CartModule(this.http, this.events, this.config, {
      dom: this.dom,
      storeCurrency: () => this.money.storeCurrency,
      cartApi: this.context?.routes?.cartApi ?? null,
      locale: () => this.context?.locale
    });
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
    this.payments = new PaymentsModule(this.http, this.events, this.config);
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
    this.licenses = new LicensesModule(this.http, this.events);
    this.currencies = new CurrenciesModule(this.http, this.events, this.config);
  }
  /**
   * Checkout sayfasına gider (#447). Sepet için `/checkout?purpose=cart`; checkout dil önekiyle açılmaz,
   * dili gelinen sayfadan okur. Adres sayfa bağlamından (`routes.checkout`) gelir.
   */
  checkout(options = {}) {
    const params = new URLSearchParams();
    params.set("purpose", options.purpose === "balance" ? "balance" : "cart");
    if (options.purpose === "balance" && Number(options.amount) > 0) params.set("amount", String(options.amount));
    const hasWindow = typeof window !== "undefined" && !!window.location;
    if (hasWindow) {
      const current = new URLSearchParams(window.location.search);
      for (const key of PREVIEW_PARAMS) {
        const value = current.get(key);
        if (value) params.set(key, value);
      }
    }
    const base = this.context?.routes?.checkout || "/checkout";
    const url = `${base}?${params.toString()}`;
    if (options.navigate !== false && hasWindow) window.location.assign(url);
    return url;
  }
  /**
   * Tarayıcı derlemesinin (IIFE) otomatik başlatması (#447). Sayfada `window.__CRAFTER_CONTEXT__` varsa
   * `window.Crafter` bu bağlamla kurulmuş örnek olur ve `document`'a `crafter:ready` yayılır; yoksa null döner
   * (`window.Crafter` sınıf olarak kalır, `new Crafter({...})` eskisi gibi çalışır). İkinci çağrı aynı örneği döner.
   */
  static autoInit(win = typeof window !== "undefined" ? window : void 0) {
    const context = readPageContext(win);
    if (!win || !context) return null;
    if (win.Crafter instanceof _Crafter) return win.Crafter;
    const crafter = new _Crafter({
      mode: "storefront",
      apiBase: context.apiBase || "/api/storefront",
      websiteId: context.websiteId,
      context
    });
    win.Crafter = crafter;
    const doc = win.document;
    if (doc && typeof doc.dispatchEvent === "function" && typeof CustomEvent === "function") {
      doc.dispatchEvent(new CustomEvent(DOM_EVENTS.ready, { detail: crafter }));
    }
    return crafter;
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

exports.AuthModule = AuthModule;
exports.CART_COUPON_KEY = CART_COUPON_KEY;
exports.CART_STORAGE_KEY = CART_STORAGE_KEY;
exports.CART_SYNCED_KEY = CART_SYNCED_KEY;
exports.CART_SYNC_KEY = CART_SYNC_KEY;
exports.CONTEXT_GLOBAL = CONTEXT_GLOBAL;
exports.COUPON_ERROR_TYPES = COUPON_ERROR_TYPES;
exports.CartModule = CartModule;
exports.ChestModule = ChestModule;
exports.CouponErrorType = CouponErrorType;
exports.CouponsModule = CouponsModule;
exports.Crafter = Crafter;
exports.CrafterBalanceTopUpError = CrafterBalanceTopUpError;
exports.CrafterCouponError = CrafterCouponError;
exports.CrafterError = CrafterError;
exports.CrafterOutOfStockError = CrafterOutOfStockError;
exports.CrafterPaymentProviderError = CrafterPaymentProviderError;
exports.CurrenciesModule = CurrenciesModule;
exports.DOM_EVENTS = DOM_EVENTS;
exports.DomEvents = DomEvents;
exports.EventEmitter = EventEmitter;
exports.ForumModule = ForumModule;
exports.HelpcenterModule = HelpcenterModule;
exports.HttpClient = HttpClient;
exports.IS_BOLD = IS_BOLD;
exports.IS_CODE = IS_CODE;
exports.IS_HIGHLIGHT = IS_HIGHLIGHT;
exports.IS_ITALIC = IS_ITALIC;
exports.IS_STRIKETHROUGH = IS_STRIKETHROUGH;
exports.IS_SUBSCRIPT = IS_SUBSCRIPT;
exports.IS_SUPERSCRIPT = IS_SUPERSCRIPT;
exports.IS_UNDERLINE = IS_UNDERLINE;
exports.LegalModule = LegalModule;
exports.LicensesModule = LicensesModule;
exports.LocalCartBackend = LocalCartBackend;
exports.LocalStorageCartStore = LocalStorageCartStore;
exports.LocalizationModule = LocalizationModule;
exports.LuckPermsModule = LuckPermsModule;
exports.MoneyModule = MoneyModule;
exports.PagesModule = PagesModule;
exports.PaymentErrorType = PaymentErrorType;
exports.PaymentsModule = PaymentsModule;
exports.PostsModule = PostsModule;
exports.PunishmentsModule = PunishmentsModule;
exports.RedeemCodeModule = RedeemCodeModule;
exports.ReportsModule = ReportsModule;
exports.SDK_VERSION = SDK_VERSION;
exports.SearchModule = SearchModule;
exports.SectionsModule = SectionsModule;
exports.SeoModule = SeoModule;
exports.ServerCartBackend = ServerCartBackend;
exports.ServerCartClient = ServerCartClient;
exports.ServersModule = ServersModule;
exports.StaffFormsModule = StaffFormsModule;
exports.StatisticsModule = StatisticsModule;
exports.StoreModule = StoreModule;
exports.TicketsModule = TicketsModule;
exports.UsersModule = UsersModule;
exports.VoteModule = VoteModule;
exports.WebsiteModule = WebsiteModule;
exports.cartStateFromServer = cartStateFromServer;
exports.currencyDigits = currencyDigits;
exports.default = index_default;
exports.discountedUnitPrice = discountedUnitPrice;
exports.dispatchDomEvent = dispatchDomEvent;
exports.formatMoney = formatMoney;
exports.htmlToLexical = htmlToLexical;
exports.isBalanceTopUpError = isBalanceTopUpError;
exports.isCouponError = isCouponError;
exports.isCrafterError = isCrafterError;
exports.isLexicalFormat = isLexicalFormat;
exports.isOutOfStockError = isOutOfStockError;
exports.isPaymentProviderError = isPaymentProviderError;
exports.legacyCartDiff = legacyCartDiff;
exports.legalTermsHeaders = legalTermsHeaders;
exports.lexicalToHtml = lexicalToHtml;
exports.lexicalToPlainText = lexicalToPlainText;
exports.lexicalToText = lexicalToText;
exports.normalizeLines = normalizeLines;
exports.normalizePaymentResponse = normalizePaymentResponse;
exports.normalizeServerCart = normalizeServerCart;
exports.parsePaymentStatus = parsePaymentStatus;
exports.parseTaxBreakdown = parseTaxBreakdown;
exports.payWithQuote = payWithQuote;
exports.readPageContext = readPageContext;
exports.stripLocalePrefix = stripLocalePrefix;
exports.toLexical = toLexical;
exports.topUpMaxAmount = topUpMaxAmount;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
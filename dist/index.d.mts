declare class HttpClient {
    readonly mode: 'storefront' | 'direct';
    private config;
    private token;
    private storageKey;
    constructor(config?: CrafterConfig);
    /**
     * Safe getter for stored token from localStorage
     */
    private readTokenFromStorage;
    /**
     * Get current auth token
     */
    getToken(): string | null;
    /**
     * Set or clear auth token
     */
    setToken(token: string | null): void;
    /**
     * Clear active auth token
     */
    clearToken(): void;
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
    buildUrl(path: string, options?: RequestOptions): string;
    private appendParams;
    /**
     * Core request dispatcher with automatic credentials (cookies) & token header
     */
    request<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
    get<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
    post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T>;
    put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T>;
    patch<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T>;
    delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
}

type EventHandler<T = any> = (payload: T) => void;
declare class EventEmitter {
    private listeners;
    /**
     * Subscribe to an event.
     */
    on<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
    on(event: string, handler: EventHandler): () => void;
    /**
     * Unsubscribe a handler from an event.
     */
    off<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): void;
    off(event: string, handler: EventHandler): void;
    /**
     * Subscribe to an event and automatically remove the listener after it fires once.
     */
    once<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
    once(event: string, handler: EventHandler): () => void;
    /**
     * Emit an event to all subscribers.
     */
    emit<K extends keyof CrafterEventMap>(event: K, payload: CrafterEventMap[K]): void;
    emit(event: string, payload?: any): void;
    /**
     * Remove all listeners for an event or all events.
     */
    removeAllListeners(event?: string): void;
}

/** Configuration fields used by the payment module */
type PaymentsModuleOptions = Pick<CrafterConfig, 'websiteId' | 'stripePublishableKey'>;
/** Typed tax breakdown from the Stripe Tax fields in the backend response; null if there is no `subtotal`. */
declare function parseTaxBreakdown(raw: Record<string, any> | null | undefined): PaymentTaxBreakdown | null;
/**
 * Normalizes the payment initiation / cart payment response (additive: raw fields are kept).
 * - `paymentId`: the backend returns `payment_id`; `paymentId` is filled if missing.
 * - `tax`: Stripe Tax breakdown (null if absent).
 * - `stripe`: only when `type === 'stripe'` and `clientSecret` exists (seller LLC + CrafterPayments).
 */
declare function normalizePaymentResponse<T extends Record<string, any>>(raw: T, fallbackPublishableKey?: string | null): T & InitiatePaymentResponse;
/** Terms version / region suffix the buyer accepted (CrafterPayments consent record, chargeback evidence). */
interface LegalTermsConsent {
    version: string;
    region?: string;
}
/** Terms consent headers: x-legal-terms-version / x-legal-terms-region */
declare function legalTermsHeaders(consent?: LegalTermsConsent): Record<string, string> | undefined;
/**
 * Payment in the customer currency (#424, #426): a quote is fetched, payment starts with `quoteId` and the quote's currency.
 * If the quote expired / the cart changed, a new quote is fetched once. If the store disabled the customer currency
 * (`customer_currency_not_allowed`), payment starts without a quote, in the store currency (`customerCurrencyDisabled`).
 * Other errors are thrown as is.
 */
declare function payWithQuote<T extends Record<string, any>>(getQuote: () => Promise<PresentmentQuote>, pay: (quote: PresentmentQuote | null) => Promise<T>): Promise<T & {
    customerCurrencyDisabled: boolean;
}>;
/**
 * Interprets the public status response. The backend's public `delivery` summary:
 * pending → PENDING, delivered → DELIVERED, failed → NEEDS_REVIEW (could not be delivered / under review), refunded → REFUNDED.
 * If the backend returns `deliveryStatus` in the future, that is used.
 */
declare function parsePaymentStatus(paymentId: string, raw: Record<string, any> | null | undefined): PaymentStatusResult;
/** Highest balance top-up amount for the form: provider cap, single top-up limit and the remaining paid balance allowance. */
declare function topUpMaxAmount(policy: BalanceTopUpPolicy | null | undefined, providerMax?: number): number;
declare class PaymentsModule {
    private http;
    private events;
    private options;
    constructor(http: HttpClient, events: EventEmitter, options?: PaymentsModuleOptions);
    /**
     * Get public active payment providers and bonus multipliers.
     * GET /config/payment/public
     */
    getPublicProviders(): Promise<PublicPaymentProvider[]>;
    /**
     * Initiate a payment session (PayTR, Shopier, KuveytTürk, CrafterPayments etc.).
     * When the seller is an LLC with CrafterPayments, the response includes `stripe` (clientSecret, publishableKey, tax).
     * POST /payment/initiate
     */
    initiate(data: InitiatePaymentDto | (Omit<InitiatePaymentDto, 'providerId'> & {
        provider?: string;
        providerId?: string;
    }), options?: {
        legalTerms?: LegalTermsConsent;
    } & CustomerCurrencyOptions): Promise<InitiatePaymentResponse>;
    /**
     * Locked rate quote (~30 min): the amount is calculated in the store currency, the server decides the customer's currency
     * (`currency` is only a suggestion). Payment starts with `quoteId`. Requires a session.
     * 400 `customer_currency_not_allowed` if the store disabled the customer currency.
     * POST /payment/quote
     */
    quote(data: PresentmentQuoteRequest): Promise<PresentmentQuote>;
    /**
     * Check payment status by payment ID.
     * POST /payment/check
     */
    check(paymentId: string): Promise<CheckPaymentResponse>;
    /**
     * Payment and delivery status (no session required). For a Stripe payment, if the webhook is late the backend reads the payment from Stripe.
     * GET /payment/status/:paymentId
     */
    getStatus(paymentId: string): Promise<PaymentStatusResult>;
    /**
     * Polls with `getStatus` until the payment result is final (after Stripe `confirmPayment`).
     * If the payment was received but delivery is still running, polling continues. On timeout the last seen status is returned.
     * Network errors are swallowed and polling continues.
     */
    waitForResult(paymentId: string, options?: WaitForPaymentOptions): Promise<PaymentStatusResult>;
    /**
     * Balance top-up conditions: whether enabled, limits (USD and the store currency), paid / bonus balance
     * and whether to show the terms text (`showTerms`). Requires a session.
     * GET /payment/balance-top-up/policy?websiteId=
     */
    getTopUpPolicy(websiteId?: string): Promise<BalanceTopUpPolicy>;
}

/**
 * localStorage cart store (#447): the 'cart' and 'crafter_cart_coupon' keys. Used in headless mode and on pages without
 * cart endpoints. Inside the storefront the cart lives on the server (#434, `cart-server.ts`); the `cart` record is synced
 * to the server cart by its changed lines (`crafter_cart_synced` keeps the last synced state), the coupon is moved once.
 */
/** Line in the store: the fields checkout reads */
interface StoredCartLine {
    id: string;
    name: string;
    /** Unit price in the store currency (before discount) */
    price: number;
    quantity: number;
    discountType?: string | null;
    discountValue?: number | null;
    images?: string[];
    [key: string]: unknown;
}
interface CartStore {
    read(): Promise<StoredCartLine[]>;
    write(lines: StoredCartLine[]): Promise<void>;
    readCoupon(): Promise<string | null>;
    writeCoupon(code: string | null): Promise<void>;
    /** Called when it changes in another tab or elsewhere; returns a function that unsubscribes */
    subscribe(onChange: () => void): () => void;
}
declare const CART_STORAGE_KEY = "cart";
declare const CART_COUPON_KEY = "crafter_cart_coupon";
/**
 * The last synced localStorage cart (#434 fix): `{ [product id]: quantity }`. The storefront checkout uses the same key and
 * format; lines in the `cart` record that change after this are applied to the server cart.
 */
declare const CART_SYNCED_KEY = "crafter_cart_synced";
/** Drops corrupt records; lines without an id are dropped, quantity is an integer of at least 1 */
declare function normalizeLines(raw: unknown): StoredCartLine[];
declare class LocalStorageCartStore implements CartStore {
    read(): Promise<StoredCartLine[]>;
    write(lines: StoredCartLine[]): Promise<void>;
    readCoupon(): Promise<string | null>;
    writeCoupon(code: string | null): Promise<void>;
    subscribe(onChange: () => void): () => void;
}

/**
 * Hybrid cart (#434): the storefront's cart endpoints. For a visitor the cart is kept in the storefront's signed cookie, for a
 * logged-in customer on the server; the SDK does not tell the two modes apart. The endpoints are same-origin with cookies (`credentials: 'same-origin'`).
 * No price is sent: the server calculates it from the current product.
 *   GET  /cart.js
 *   POST /cart/add.js     { id, quantity, options? } | { items: [{ id, quantity }], replace? }
 *                         (`replace: true`: the quantity is set to the given value, not added; used by the localStorage sync)
 *   POST /cart/change.js  { id, quantity }   (0 removes; id is a product id or a line key)
 *   POST /cart/clear.js
 *   POST /cart/coupon.js  { code | null }  (invalid coupon: 422 + `type`, the cart does not change; null / '' removes)
 */
/** Line returned by the server */
interface ServerCartLine {
    key?: string;
    id: string;
    productId?: string;
    name: string;
    slug?: string;
    url?: string;
    price: number;
    unitPrice: number;
    discountType?: string | null;
    discountValue?: number | null;
    quantity: number;
    lineTotal: number;
    images?: string[];
    image?: string | null;
    stock?: number;
    options?: Record<string, string> | null;
    [key: string]: unknown;
}
/** Line dropped from the cart: `not_found`, `unavailable`, `out_of_stock`, `cart_full` */
interface CartRemovedNote {
    productId: string;
    key?: string;
    name?: string | null;
    quantity: number;
    reason: string;
}
/** Line whose quantity was reduced: `stock_limit`, `max_quantity` */
interface CartAdjustedNote {
    productId: string;
    key?: string;
    name?: string | null;
    from: number;
    to: number;
    reason: string;
}
/** Details of the valid coupon in the cart (#476) */
interface CartCouponDetails {
    code: string;
    type: 'percentage' | 'fixed' | 'free_product';
    /** Percentage or amount in the store currency; may be null for `free_product` */
    value: number | null;
    /** Gift product for a `free_product` coupon; null for others */
    freeProductId: string | null;
}
/** A stored coupon became invalid and was dropped from the cart (#476); `reason` is the coupon error code (see `CouponErrorType`) */
interface CartCouponRemovedNote {
    code: string;
    reason: string;
}
interface ServerCartResponse {
    items: ServerCartLine[];
    itemCount: number;
    subtotal: number;
    currency: string;
    coupon: string | null;
    /** Coupon discount in the store currency (#476); 0 without a coupon */
    discount?: number;
    /** Amount to pay: `subtotal - discount` (at least 0), in the store currency (#476) */
    total?: number;
    /** Details of the valid coupon (#476); null without a coupon */
    couponDetails?: CartCouponDetails | null;
    /** Reported once if a stored coupon was dropped (#476); null otherwise */
    couponRemoved?: CartCouponRemovedNote | null;
    removed?: CartRemovedNote[];
    adjusted?: CartAdjustedNote[];
    mode?: 'guest' | 'customer';
}
interface ServerCartClientOptions {
    /** Root of the endpoints (the context's `routes.cartApi` value, e.g. '/cart') */
    cartApi: string;
    /** Language of product names (`X-Crafter-Locale`) */
    locale?: () => string | undefined;
    fetchImpl?: typeof fetch;
}
/** "Cart changed" signal for other tabs (timestamp only) */
declare const CART_SYNC_KEY = "crafter_cart_sync";
/** Normalizes the response into a type-safe shape; corrupt lines are dropped */
declare function normalizeServerCart(raw: any): ServerCartResponse;
/** The localStorage cart as used by the sync: only product id + quantity (the price is calculated on the server) */
interface LegacyCart {
    items: Array<{
        id: string;
        quantity: number;
    }>;
    coupon: string | null;
    /** Whether the `cart` key exists (including '[]'): if the cart was emptied, the lines are dropped on the server too */
    present: boolean;
}
/**
 * Difference of the localStorage cart to apply to the server (#434 fix; same rule as the storefront checkout):
 * `set` lines added / whose quantity changed since the last sync (the quantity is set), `remove` products that were removed.
 * Without `synced` (first sync) all lines are new. Without the `cart` key no line is removed.
 */
declare function legacyCartDiff(legacy: LegacyCart, synced: Map<string, number> | null): {
    set: Array<{
        id: string;
        quantity: number;
    }>;
    remove: string[];
};
/**
 * Client for the storefront cart endpoints. Before the first operation it syncs the localStorage cart with the server cart
 * (`migrate`); after every change it writes a `crafter_cart_sync` signal for other tabs.
 */
declare class ServerCartClient {
    private readonly options;
    private migration;
    private migrationConsumed;
    private readonly base;
    constructor(options: ServerCartClientOptions);
    get(): Promise<ServerCartResponse>;
    add(id: string, quantity: number, options?: Record<string, string> | null): Promise<ServerCartResponse>;
    change(id: string, quantity: number): Promise<ServerCartResponse>;
    clear(): Promise<ServerCartResponse>;
    setCoupon(code: string | null): Promise<ServerCartResponse>;
    /** Called when it changes in another tab; returns a function that unsubscribes */
    subscribe(onChange: () => void): () => void;
    /**
     * Syncs the localStorage cart (`cart`: v1 themes, SDK 1.4.0 and earlier, headless store) with the server cart; runs once
     * per page, before the first operation. The rule matches the storefront checkout (#434 fix):
     * - The last synced state is in the `crafter_cart_synced` record. A line added or whose quantity changed after that is set to
     *   this quantity on the server (`/cart/add.js { items, replace: true }`, not added); a line removed from `cart` is dropped
     *   on the server too (`/cart/change.js { quantity: 0 }`). Unchanged lines are not sent: changes made on the server / another
     *   device are kept, and lines that are on the server but never in `cart` stay. On the first sync all lines are new.
     * - `cart` is not discarded just because the server cart is not empty (the old rule let an old unpaid server cart replace
     *   the new selection). Running again (two tabs, after a network error) does not change the result; quantities do not double.
     * - The `cart` key stays (the theme cart); if `cart` does not exist at all, no line is removed on the server and the record is cleared.
     * - On a network / server error the record is not updated and it is retried on the next page; a 4xx rejection (e.g. the product
     *   was taken off sale) counts this state as synced.
     * - The coupon (`crafter_cart_coupon`) is moved if the server cart has no coupon and the server accepts it (#476); a 4xx rejection
     *   is reported once in the returned cart as `couponRemoved: { code, reason }`. The key is removed after the attempt.
     * Returns: the last cart read during the sync (null if none).
     */
    migrate(): Promise<ServerCartResponse | null>;
    private runMigration;
    private mutate;
    private ping;
    private request;
}

/**
 * Theme events (#447): the SDK emits changes both on its own event bus (`crafter.on('cart:updated')`) and as a
 * `crafter:<name>` CustomEvent on `document`. Themes can listen without waiting for the SDK instance:
 *   document.addEventListener('crafter:cart:updated', (e) => e.detail.itemCount)
 */
declare const DOM_EVENTS: {
    readonly ready: "crafter:ready";
    readonly cartUpdated: "crafter:cart:updated";
    readonly localizationChanged: "crafter:localization:changed";
};
type DomEventName = (typeof DOM_EVENTS)[keyof typeof DOM_EVENTS];
/** `crafter:<name>` event on `document`; silently skipped outside the browser */
declare function dispatchDomEvent(name: string, detail?: unknown): void;
declare class DomEvents {
    private events;
    constructor(events: EventEmitter);
    /** Emits on the SDK event bus and on `document` together */
    emit(name: string, detail?: unknown): void;
    /**
     * Listens for the `crafter:<name>` event on `document`; the handler receives `event.detail`. Returns a function that unsubscribes.
     * @example crafter.dom.on('cart:updated', (cart) => badge.textContent = cart.itemCount)
     */
    on(name: string, handler: (detail: any) => void): () => void;
}

/** Product to add to the cart; themes usually pass it from `data-*` attributes */
interface CartAddInput {
    id: string | number;
    name?: string;
    /** Unit price in the store currency. Not sent for the storefront cart: the server calculates the price. */
    price?: number | string;
    discountType?: string | null;
    discountValue?: number | string | null;
    image?: string | null;
    images?: string[];
    /** Variant / options (storefront cart) */
    options?: Record<string, string> | null;
}
/** Cart line: stored fields + calculated ones (in the store currency) */
interface CartLine extends StoredCartLine {
    /** First image; null if none */
    image: string | null;
    /** Unit price with the discount applied */
    unitPrice: number;
    lineTotal: number;
}
interface CartState {
    items: CartLine[];
    /** Total quantity */
    itemCount: number;
    /** Subtotal in the store currency; for display use `crafter.money.format(cart.subtotal)` */
    subtotal: number;
    /** Store currency (from the page context); empty if unknown */
    currency: string;
    coupon: string | null;
    /**
     * Coupon discount in the store currency (#476); 0 without a coupon. The localStorage cart cannot validate coupons: always 0.
     */
    discount?: number;
    /** Amount to pay: `subtotal - discount` (at least 0), in the store currency (#476) */
    total?: number;
    /** Details of the valid coupon (#476): `code`, `type`, `value`, `freeProductId`; null without a coupon (or with localStorage) */
    couponDetails?: CartCouponDetails | null;
    /**
     * Storefront cart (#476): reported once if a stored coupon was dropped because it became invalid (`code`, `reason`:
     * a `CouponErrorType` code, e.g. `coupon_cart_total_below_minimum`); null otherwise
     */
    couponRemoved?: CartCouponRemovedNote | null;
    /** Storefront cart (#434): reported once if a product that was taken off sale / sold out was dropped */
    removed?: CartRemovedNote[];
    /** Storefront cart (#434): reported once if a quantity was reduced to match stock */
    adjusted?: CartAdjustedNote[];
}
/** Cart operations; `crafter.cart` delegates to these (localStorage or the storefront server) */
interface CartBackend {
    get(): Promise<CartState>;
    add(product: CartAddInput, quantity: number): Promise<CartState>;
    update(id: string, quantity: number): Promise<CartState>;
    remove(id: string): Promise<CartState>;
    clear(): Promise<CartState>;
    setCoupon(code: string | null): Promise<CartState>;
    /** Called when it changes in another tab; returns a function that unsubscribes */
    subscribe(onChange: () => void): () => void;
}
interface CartModuleDeps {
    /** Cart store (localStorage 'cart' format). If given, this store is always used. */
    store?: CartStore;
    /**
     * Storefront cart endpoints (#434): the context's `routes.cartApi` value (e.g. '/cart'). If given, the cart lives on the server
     * (a signed cookie for visitors, the account once logged in); otherwise localStorage.
     */
    cartApi?: string | null;
    /** Language of product names in the storefront cart */
    locale?: () => string | undefined;
    /** For tests */
    fetchImpl?: typeof fetch;
    dom?: DomEvents;
    storeCurrency?: () => string;
}
/** Unit price with the discount applied: 'percentage' is a percentage, other types are a fixed amount (same rule as checkout) */
declare function discountedUnitPrice(line: Pick<StoredCartLine, 'price' | 'discountType' | 'discountValue'>): number;
/** localStorage cart (#447): headless use and pages without cart endpoints */
declare class LocalCartBackend implements CartBackend {
    private store;
    private storeCurrency;
    constructor(store: CartStore, storeCurrency: () => string);
    get(): Promise<CartState>;
    add(product: CartAddInput, quantity: number): Promise<CartState>;
    update(id: string, quantity: number): Promise<CartState>;
    remove(id: string): Promise<CartState>;
    clear(): Promise<CartState>;
    setCoupon(code: string | null): Promise<CartState>;
    subscribe(onChange: () => void): () => void;
    private commit;
}
/** Server response → `CartState` (amounts in the store currency, calculated by the server) */
declare function cartStateFromServer(cart: ServerCartResponse, fallbackCurrency?: string): CartState;
/** Storefront cart (#434): `/cart.js` and `/cart/*.js` endpoints; no price is sent */
declare class ServerCartBackend implements CartBackend {
    private client;
    private storeCurrency;
    constructor(client: ServerCartClient, storeCurrency: () => string);
    get(): Promise<CartState>;
    add(product: CartAddInput, quantity: number): Promise<CartState>;
    update(id: string, quantity: number): Promise<CartState>;
    remove(id: string): Promise<CartState>;
    clear(): Promise<CartState>;
    setCoupon(code: string | null): Promise<CartState>;
    subscribe(onChange: () => void): () => void;
    private state;
}
declare class CartModule {
    private http;
    private events;
    private options;
    private payments;
    private backend;
    private dom;
    constructor(http: HttpClient, events: EventEmitter, options?: PaymentsModuleOptions, deps?: CartModuleDeps);
    /** Whether the cart lives on the server (storefront cart endpoints) */
    get isServerBacked(): boolean;
    /** Current state of the cart */
    get(): Promise<CartState>;
    /** Adds the product; if it is already in the cart the quantity increases. Emits `crafter:cart:updated`. */
    add(product: CartAddInput, quantity?: number): Promise<CartState>;
    /** Sets the line's quantity; 0 or less removes the line */
    update(id: string | number, quantity: number): Promise<CartState>;
    remove(id: string | number): Promise<CartState>;
    /** Empties the cart and the coupon */
    clear(): Promise<CartState>;
    /**
     * Applies the coupon; null / empty removes it. In the storefront cart the server validates it right away (#476): if valid,
     * `discount`, `total` and `couponDetails` are returned filled; if invalid a `CrafterCouponError` (HTTP 422; `type`: `CouponErrorType`,
     * `message` in the page language, `details.minCartValue`) is thrown, the cart does not change and `crafter:cart:updated` is not emitted.
     * The localStorage cart cannot validate coupons: it stores the code and checkout calculates the discount.
     */
    setCoupon(code: string | null): Promise<CartState>;
    /** Removes the coupon (`setCoupon(null)`) */
    removeCoupon(): Promise<CartState>;
    private emit;
    /**
     * Complete purchase using user balance.
     * POST /marketplace/purchase
     */
    purchase(data: PurchaseDto): Promise<PurchaseResponse>;
    /**
     * Pay the cart at a provider. The charged amount is the storefront total.
     * Balance is not credited and the top-up multiplier is not applied.
     * When the seller is an LLC with CrafterPayments, the response includes `stripe` (clientSecret, publishableKey, tax breakdown).
     * If stock is insufficient a `CrafterOutOfStockError` (HTTP 409, `productIds`) is thrown.
     * The server decides the currency; if `currency` is not given it is not sent. With `{ useCustomerCurrency: true }` a locked
     * rate quote is fetched first and payment starts in the customer currency (see `payWithQuote`).
     * POST /payment/checkout
     */
    checkout(data: PurchaseDto & {
        providerId: string;
        websiteId: string;
        provider?: string;
        /** Only the quote's currency (with `quoteId`); if not given the server uses the store currency */
        currency?: string;
        /** Kilitli kur teklifi (`payments.quote`) */
        quoteId?: string;
        paymentDetails?: Record<string, any>;
        user: {
            name: string;
            email: string;
            phone?: string;
            address?: string;
        };
        /** Buyer's country (ISO 3166-1 alpha-2); the Stripe Tax location when the seller is an LLC */
        billingCountry?: string;
        /** Postal code for the US / Canada (Stripe Tax) */
        billingPostalCode?: string;
    }, options?: {
        legalTerms?: LegalTermsConsent;
    } & CustomerCurrencyOptions): Promise<CheckoutPaymentResponse>;
    private checkoutPayload;
}

/**
 * Page context (#447): the storefront writes `window.__CRAFTER_CONTEXT__` into every v2 theme page with
 * `content_for_header`. It holds no secrets or personal data; only the store, language and currency.
 * When the IIFE build sees this object it sets up the `window.Crafter` instance by itself (see `autoInit`).
 */
interface CrafterPageContext {
    /** SDK version added by the storefront that wrote the context */
    sdkVersion?: string;
    websiteId?: string;
    /** Same-origin proxy; default '/api/storefront' */
    apiBase?: string;
    /** Page language (e.g. 'en', 'pt-BR') */
    locale?: string;
    /** The store's default language */
    defaultLocale?: string;
    /** Language prefix of the page URL: '' for the default language, '/en' for the others */
    localePrefix?: string;
    /** The store's enabled languages */
    languages?: string[];
    /** Store currency (accounting unit); amounts are kept in this unit */
    storeCurrency?: string;
    /** The customer's currency; the store currency if absent */
    customerCurrency?: string;
    /** 1 store unit = rate customer units (display only) */
    rate?: number;
    /** Currencies in the selector */
    currencies?: string[];
    /** Platform URLs; checkout does not use the language prefix, it reads the language from the Referer */
    routes?: {
        cart?: string;
        checkout?: string;
        localization?: string;
        /** Root of the storefront cart endpoints (#434), e.g. '/cart' → `/cart.js`, `/cart/add.js`. If absent the cart lives in localStorage. */
        cartApi?: string;
    };
}
declare const CONTEXT_GLOBAL = "__CRAFTER_CONTEXT__";
/** Reads `window.__CRAFTER_CONTEXT__`; null if missing or not an object */
declare function readPageContext(win?: any): CrafterPageContext | null;
/** Strips the language prefix from the path: '/en/cart' → '/cart' (when the prefix is '/en') */
declare function stripLocalePrefix(pathname: string, prefix: string | undefined): string;

interface CrafterConfig {
    /**
     * Operating mode:
     * - 'storefront' (default in Liquid themes): Requests go through same-origin '/api/storefront' proxy.
     * - 'direct' (headless apps, mobile, external scripts): Requests go directly to 'https://api.crafter.net.tr/website/{v2/}...'.
     * Auto-detected: defaults to 'direct' if websiteId is provided; otherwise defaults to 'storefront'.
     */
    mode?: 'storefront' | 'direct';
    /**
     * Base API URL / path prefix.
     * In 'storefront' mode, defaults to '/api/storefront'.
     * In 'direct' mode, defaults to 'https://api.crafter.net.tr'.
     */
    apiBase?: string;
    /**
     * Website ID (Tenant ID).
     * Required in 'direct' mode.
     * Optional in Liquid themes (Storefront proxy auto-resolves tenant by hostname).
     */
    websiteId?: string;
    /**
     * Optional initial authentication token (JWT).
     */
    token?: string;
    /**
     * Key used to store/retrieve token in localStorage if client-side storage is used.
     * Defaults to 'crafter_token'
     */
    storageKey?: string;
    /**
     * Custom headers to include in every request.
     */
    headers?: Record<string, string>;
    /**
     * Callback fired when token is updated or cleared.
     */
    onTokenChange?: (token: string | null) => void;
    /**
     * Stripe publishable key (pk_test_... / pk_live_...). Used for the Payment Element when the seller is an LLC.
     * If the backend returns a key in the payment response, that one takes precedence. Not secret.
     */
    stripePublishableKey?: string;
    /**
     * Page context (#447): the storefront's `window.__CRAFTER_CONTEXT__` object. Money display, language choice and the
     * checkout URL are read from it. On theme pages the SDK provides it by itself.
     */
    context?: CrafterPageContext;
}
interface RequestOptions extends RequestInit {
    params?: Record<string, string | number | boolean | undefined>;
    skipAuth?: boolean;
}
interface CrafterApiError {
    statusCode: number;
    message: string | string[];
    error?: string;
    /** Backend error code (ErrorType), e.g. 'out_of_stock' */
    type?: string;
    details?: Record<string, any>;
}
interface SignInDto {
    username: string;
    password: string;
    turnstileToken?: string;
}
interface SignUpDto {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
    turnstileToken?: string;
}
interface AuthSuccessResponse {
    success: true;
    accessToken: string;
    refreshToken: string;
}
interface Auth2FaRequiredResponse {
    requires2FA: true;
    methods: Array<'authenticator' | 'email' | 'discord'>;
    primaryMethod: 'authenticator' | 'email' | 'discord' | string;
    tempToken: string;
    message: string;
}
interface AuthEmailVerificationRequiredResponse {
    requiresEmailVerification: true;
    isTempEmail: boolean;
    tempToken: string;
    maskedEmail?: string;
    emailToken?: string;
    message: string;
}
type AuthResponse = AuthSuccessResponse | Auth2FaRequiredResponse | AuthEmailVerificationRequiredResponse | {
    success?: boolean;
    accessToken?: string;
    refreshToken?: string;
    token?: string;
    message?: string;
    [key: string]: any;
};
interface TwoFactorValidateDto {
    tempToken: string;
    code: string;
    method?: 'authenticator' | 'email' | 'discord' | 'recovery_code';
}
interface DisableTwoFactorDto {
    password?: string;
    method?: 'authenticator' | 'email' | 'discord';
}
interface ResetPasswordDto {
    /**
     * Reset token from email.
     * Optional: If omitted in browser environments, it will be automatically extracted from the URL query param (?token=...).
     */
    token?: string;
    new_password: string;
    confirm_password: string;
    turnstileToken?: string;
}
interface InGameAuthDto {
    username: string;
    uuid: string;
    server_id: string;
    hash: string;
}
interface UserRole {
    id: string;
    name: string;
    color?: string;
    permissions?: string[];
}
interface UserProfile {
    id: string;
    username: string;
    email?: string;
    balance?: number;
    credit?: number;
    avatar?: string;
    isOnline?: boolean;
    playTime?: number;
    averagePlayTime?: number;
    role?: UserRole | string;
    discordId?: string;
    discordUsername?: string;
    twoFactorEnabled?: boolean;
    likes?: string[];
    comments?: string[];
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}
interface LightweightBalanceResponse {
    success: boolean;
    data: {
        userId: string;
        username: string;
        balance: number;
        currency?: string;
    };
}
interface UpdateOwnUserDto {
    email: string;
}
interface SendBalanceParams {
    targetUserId: string;
    amount: number;
    userId?: string;
}
interface SendBalanceResponse {
    success: boolean;
    message: string;
    transfer?: {
        from: {
            userId: string;
            email?: string;
            oldBalance: number;
            newBalance: number;
        };
        to: {
            userId: string;
            email?: string;
            oldBalance: number;
            newBalance: number;
        };
        amount: number;
    };
    [key: string]: any;
}
interface ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
interface WallMessageReply {
    id: string;
    sender: {
        id: string;
        username: string;
        avatar?: string;
    };
    content: string;
    createdAt: string;
}
interface WallMessage {
    id: string;
    sender: {
        id: string;
        username: string;
        avatar?: string;
    };
    content: string;
    replies?: WallMessageReply[];
    createdAt: string;
}
interface TwoFactorStatusResponse {
    enabled: boolean;
    methods: string[];
    primaryMethod: 'authenticator' | 'email' | 'discord' | string | null;
    hasRecoveryCodes: boolean;
    recoveryCodesCount: number;
    discordLinked: boolean;
    discordUsername?: string;
    isEmailVerified: boolean;
    [key: string]: any;
}
interface DiscordStatusData {
    isModuleActive: boolean;
    isLinked: boolean;
    discordId?: string;
    discordUsername?: string;
}
interface DiscordStatusResponse {
    success: boolean;
    data: DiscordStatusData;
}
interface Category {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    image?: string;
    order?: number;
    [key: string]: any;
}
interface Product {
    id: string;
    name: string;
    slug?: string;
    price: number;
    discountPrice?: number;
    category: string;
    server_id: string;
    type?: 'in_game' | 'digital' | 'downloadable';
    serverIds?: string[];
    deliveries?: {
        serverId: string;
        commands: string[];
    }[];
    fileUrl?: string | null;
    images: string[];
    stock: number;
    discountType?: 'percentage' | 'fixed' | null;
    discountValue?: number;
    server_commands?: string[];
    give_role_id?: string | null;
    description?: Record<string, any> | string;
    [key: string]: any;
}
interface PurchaseItemDto {
    /** Product UUID. */
    productId: string;
    /** Quantity to purchase. */
    quantity: number;
}
interface PurchaseDto {
    /** List of product UUIDs to purchase. */
    productIds?: string[];
    /** Optional coupon code to apply. */
    coupon?: string;
    /**
     * Per-product quantity list (alternative to `quantities`).
     * Each entry specifies a productId and the desired quantity.
     */
    items?: PurchaseItemDto[];
    /**
     * Product quantities as a map of productId → quantity.
     * Alternative to `items`.
     */
    quantities?: Record<string, number>;
    [key: string]: any;
}
interface PurchaseResponse {
    success: boolean;
    message: string;
    type?: string;
    orderId?: string;
    [key: string]: any;
}
interface BulkDiscountConfig {
    type: 'percentage' | 'fixed' | string;
    amount: number;
    expireDate?: string | null;
    products?: string[];
}
interface MarketplaceConfig {
    bulkDiscount?: BulkDiscountConfig | null;
    [key: string]: any;
}
interface ChestProductSummary {
    id: string;
    name: string;
    server_id?: string;
    [key: string]: any;
}
interface ChestItem {
    id: string;
    product?: ChestProductSummary;
    used: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}
interface UseChestItemResponse {
    success: boolean;
    message: string;
    item: {
        id: string;
        used: boolean;
        updatedAt: string;
    };
}
interface GiftChestItemResponse {
    success: boolean;
    message: string;
    newChestItem?: {
        id: string;
        product?: any;
        used: boolean;
    };
}
interface CouponResponse {
    id?: string;
    code: string;
    type?: string;
    minCartValue?: number;
    productId?: string | null;
    discountValue: number;
    discountType: 'percentage' | 'fixed' | string;
    freeProductId?: string | null;
    isActive: boolean;
    [key: string]: any;
}
interface UseRedeemCodeResponse {
    bonus?: number;
    products?: Array<{
        id: string;
        name: string;
    }>;
    success?: boolean;
    message?: string;
    [key: string]: any;
}
interface TicketCategory {
    id: string;
    name: string;
    description?: string;
}
type TicketCategoryDetails = TicketCategory;
interface TicketMessageSender {
    id: string;
    username: string;
    email: string | null;
}
interface TicketMessage {
    id?: string;
    senderId?: string;
    content: Record<string, any> | string;
    createdAt: string;
    sender?: TicketMessageSender;
    authorId?: string;
    authorName?: string;
    message?: string;
}
interface Ticket {
    id: string;
    title: string;
    category?: string;
    categoryDetails?: TicketCategoryDetails;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | string;
    createdByUserId: string;
    createdByUser?: {
        id: string;
        username: string;
    };
    assignedUsers?: any[];
    messages?: TicketMessage[];
    createdAt: string;
    updatedAt?: string;
    [key: string]: any;
}
interface CreateTicketDto {
    title: string;
    categoryId: string;
    message: Record<string, any> | string;
    [key: string]: any;
}
interface ReplyTicketDto {
    message: Record<string, any> | string;
}
interface PostQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    categoryId?: string;
    sortBy?: string;
}
interface PostAuthor {
    id: string;
    username: string;
    avatar?: string;
}
interface PostItem {
    id: string;
    slug: string;
    title: string;
    content: Record<string, any> | string;
    featuredImage?: string;
    coverImage?: string;
    likeCount?: number;
    viewCount?: number;
    isPinned?: boolean;
    isHot?: boolean;
    author?: PostAuthor;
    createdAt: string;
    [key: string]: any;
}
interface PaginatedPostsResponse {
    success: boolean;
    data: PostItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
interface SinglePostResponse {
    success: boolean;
    data: PostItem;
}
interface LikePostResponse {
    success: boolean;
    data: {
        liked: boolean;
        likeCount: number;
    };
    message: string;
}
interface PageItem {
    id: string;
    title: string;
    slug: string;
    content: string;
    isPublished?: boolean;
    viewCount?: number;
    updatedAt?: string;
    [key: string]: any;
}
interface ServerStatusItem {
    id: string;
    name: string;
    ip: string;
    port: number;
    image?: string;
    isListed?: boolean;
    slug?: string;
    onlinePlayers?: number;
    maxPlayers?: number;
    isOnline?: boolean;
    ping?: number;
    [key: string]: any;
}
interface InitiatePaymentUser {
    name: string;
    email: string;
    phone?: string;
    address?: string;
}
interface InitiatePaymentDto {
    amount: number;
    providerId: string;
    /**
     * The server decides the currency (the store currency). Only the locked quote's (`quoteId`) currency
     * may be sent; any other value returns 400 `payment_currency_mismatch`. If not given the field is not sent.
     */
    currency?: string;
    /** Locked rate quote (`payments.quote`); if not given, payment is in the store currency */
    quoteId?: string;
    websiteId?: string;
    user: InitiatePaymentUser;
    /** Buyer's country (ISO 3166-1 alpha-2); the Stripe Tax location when the seller is an LLC */
    billingCountry?: string;
    /** Postal code for the US / Canada (Stripe Tax) */
    billingPostalCode?: string;
    [key: string]: any;
}
/** Backend payment initiation response type. `stripe`: seller LLC + CrafterPayments (Payment Element). */
type PaymentSessionType = 'iframe' | 'redirect' | 'kuveytturk_init' | 'stripe' | (string & {});
/** Stripe Tax line (country / state, tax type, rate and amount). */
interface PaymentTaxLine {
    country: string | null;
    state: string | null;
    /** 'vat' | 'sales_tax' | 'gst' | 'hst' | 'pst' | 'qst' ... */
    taxType: string | null;
    /** Rate as a percentage (e.g. 19 = 19%) */
    rate: number;
    amount: number;
}
/** Tax breakdown and total (only when the backend returns `subtotal`, i.e. when Stripe Tax was calculated). */
interface PaymentTaxBreakdown {
    /** Amount excluding tax */
    subtotal: number;
    /** Total tax */
    taxAmount: number;
    /** Total to charge (including tax) */
    total: number;
    currency: string;
    lines: PaymentTaxLine[];
}
/**
 * CrafterPayments payment when the seller is an LLC: completed on the page with the Stripe Payment Element.
 * Stripe.js is not bundled in the SDK; the theme developer loads it (see wiki/07-payments.md).
 */
interface StripePaymentSession {
    paymentId: string;
    /** PaymentIntent client secret: `stripe.elements({ clientSecret })` */
    clientSecret: string;
    /**
     * Stripe publishable key. From the backend response if present, otherwise from `CrafterConfig.stripePublishableKey`.
     * null if neither exists (the theme must use its own key).
     */
    publishableKey: string | null;
    /** Total to charge (including tax) */
    amount: number;
    currency: string;
    merchantOid?: string;
    /** Stripe Tax breakdown; null if the backend returned no tax info */
    tax: PaymentTaxBreakdown | null;
    /** Store amount and rate for a payment in the customer currency; absent for a payment in the store currency */
    presentment?: PaymentPresentment;
}
/** Rate quote kind: cart payment or balance top-up */
type PresentmentQuoteKind = 'cart' | 'top_up';
/** `POST /payment/quote` body */
interface PresentmentQuoteRequest {
    /** Verilmezse `CrafterConfig.websiteId` */
    websiteId?: string;
    kind: PresentmentQuoteKind;
    /** Currency chosen by the customer (a suggestion); the server decides by settings and country */
    currency?: string;
    /** kind = top_up: top-up amount (in the store currency) */
    amount?: number;
    /** kind = cart: the same cart fields as `cart.checkout` */
    coupon?: string;
    productIds?: string[];
    items?: {
        productId: string;
        quantity: number;
    }[];
    quantities?: Record<string, number>;
}
/** Locked rate quote (valid ~30 min); payment starts with `quoteId` */
interface PresentmentQuote {
    quoteId: string;
    kind: PresentmentQuoteKind;
    storeCurrency: string;
    storeAmount: number;
    /** Currency and amount the customer will pay */
    currency: string;
    amount: number;
    /** 1 store unit = rate customer units (including the FX margin) */
    rate: number;
    baseRate?: number;
    markupPercent?: number;
    rateDate?: string;
    rateSource?: string;
    /** ISO tarih */
    expiresAt: string;
}
/** Customer currency info in the payment response (when paying with a quote) */
interface PaymentPresentment {
    quoteId: string;
    currency: string;
    amount: number;
    rate: number;
    rateDate?: string;
    storeCurrency: string;
    storeAmount: number;
}
/** Customer currency setting: automatic, selected currencies or disabled */
type CustomerCurrencyMode = 'auto' | 'selected' | 'off' | (string & {});
/** How the customer currency was chosen: selection (cookie / parameter), country or store currency */
type CustomerCurrencySource = 'choice' | 'country' | 'store' | (string & {});
/** `GET /payment/currencies`: context for price display and the currency selector */
interface CustomerCurrencyContext {
    storeCurrency: string;
    mode: CustomerCurrencyMode;
    /** Whether currencies other than the store currency can be shown */
    enabled: boolean;
    /** Currencies in the selector; the store currency comes first */
    currencies: string[];
    /** The customer's currency */
    currency: string;
    source: CustomerCurrencySource;
    /** 1 store unit = rate customer units (including the FX margin) */
    rate: number;
    /** Rates of the allowed currencies (for instant conversion in the selector) */
    rates: Record<string, number>;
    markupPercent: number;
    rateDate: string | null;
    rateSource: string | null;
}
/** `POST /payment/currencies/convert`: amounts in the customer currency, in request order */
interface CurrencyConversion {
    storeCurrency: string;
    currency: string;
    source: CustomerCurrencySource;
    rate: number;
    rateDate: string | null;
    rateSource: string | null;
    amounts: number[];
}
/**
 * Payment in the customer currency (optional): a locked quote is fetched first, payment starts with `quoteId`.
 * If the quote expired / the cart changed, a new quote is fetched once; if the store disabled the customer
 * currency (`customer_currency_not_allowed`), payment starts in the store currency.
 */
interface CustomerCurrencyOptions {
    useCustomerCurrency?: boolean;
    /** Currency suggestion for the quote; if not given the server decides from the cookie / country */
    customerCurrency?: string;
}
interface InitiatePaymentResponse {
    token?: string;
    iframeUrl?: string;
    paymentId?: string;
    paymentUrl?: string;
    success?: boolean;
    type?: PaymentSessionType;
    /** The backend's raw field; the SDK also returns it as `paymentId` */
    payment_id?: string;
    payment_url?: string;
    redirectUrl?: string;
    iframeHtml?: string;
    /** type = kuveytturk_init: 3D formu */
    html?: string;
    merchant_oid?: string;
    amount?: number | string;
    currency?: string;
    /** type = stripe: PaymentIntent client secret */
    clientSecret?: string;
    /** type = stripe: amount excluding tax, total tax and lines (raw fields) */
    subtotal?: number;
    taxAmount?: number;
    taxes?: PaymentTaxLine[];
    /** If the cart was paid entirely with balance, the items have been delivered; no provider redirect */
    delivered?: boolean;
    /** Added by the SDK: everything needed for the Payment Element if type = stripe, absent otherwise */
    stripe?: StripePaymentSession;
    /** Added by the SDK: tax breakdown (null if absent) */
    tax?: PaymentTaxBreakdown | null;
    /**
     * Store amount and rate when paying with a quote (in the customer currency). In this case `amount`, `currency`, `subtotal`,
     * `taxAmount` and `taxes` are in the customer currency.
     */
    presentment?: PaymentPresentment;
    /** Added by the SDK (`useCustomerCurrency`): the customer currency is disabled, payment is in the store currency */
    customerCurrencyDisabled?: boolean;
    [key: string]: any;
}
/** Cart payment (`cart.checkout`) response; same shape as the payment initiation response. */
type CheckoutPaymentResponse = InitiatePaymentResponse;
/** Backend payment record status (public status endpoint). */
type PaymentRecordStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'REFUNDED' | (string & {});
/** Delivery summary returned by the public status endpoint; null for an old backend or a payment without delivery. */
type PublicDeliveryState = 'pending' | 'delivered' | 'failed' | 'refunded' | null;
/**
 * Delivery status (same names as the backend's `deliveryStatus` values).
 * - NEEDS_REVIEW: payment received but delivery failed / is under review; a store admin must step in.
 * - REFUNDED: could not be delivered because the product sold out, and the payment was refunded automatically.
 */
type PaymentDeliveryStatus = 'PENDING' | 'DELIVERED' | 'NEEDS_REVIEW' | 'REFUNDED';
/** Result shown to the buyer after payment. */
type PaymentOutcome = 'processing' | 'success' | 'pending' | 'failed' | 'refunded' | 'needs_review';
interface PaymentStatusResult {
    paymentId: string;
    status: PaymentRecordStatus;
    /** The backend's raw delivery summary */
    delivery: PublicDeliveryState;
    /** Delivery status; null if there is no delivery info */
    deliveryStatus: PaymentDeliveryStatus | null;
    /** Combined payment + delivery result */
    outcome: PaymentOutcome;
    /** Whether the result is final (polling can stop) */
    final: boolean;
}
interface WaitForPaymentOptions {
    /** Number of attempts (default 20) */
    attempts?: number;
    /** Wait between attempts, ms (default 1500) */
    intervalMs?: number;
    signal?: AbortSignal;
}
/** Site balance top-up conditions: `GET /payment/balance-top-up/policy` */
interface BalanceTopUpPolicy {
    /** Whether balance top-up is enabled */
    enabled: boolean;
    /** Seller LLC: closed-loop balance rules and limits apply */
    closedLoop: boolean;
    /** Added by the SDK: whether the balance terms text should be shown on the top-up screen (same as closedLoop) */
    showTerms: boolean;
    /** Store currency */
    currency: string;
    /** Maximum per top-up (USD) */
    maxSingleUsd: number;
    /** Paid balance cap per store (USD) */
    maxPaidUsd: number;
    /** Store currency equivalents; null if there is no rate or in TR mode */
    maxSingleAmount: number | null;
    remainingAmount: number | null;
    /** Total balance = paid + bonus */
    balance: number;
    paidBalance: number;
    bonusBalance: number;
}
interface CheckPaymentResponse {
    success: boolean;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
    paymentId: string;
    amount?: number;
    [key: string]: any;
}
interface PublicPaymentProvider {
    id: string;
    provider: string;
    name: string;
    isActive: boolean;
    priority?: number;
    description?: string;
    minAmount: number;
    maxAmount: number;
    creditMultipler: number;
    addFeeToCustomer?: boolean;
    commissionRate?: number;
    feePercentage?: number;
    [key: string]: any;
}
interface LatestPayment {
    id: string;
    username: string;
    amount: number;
    paymentMethod: string;
    timestamp: string;
}
interface LatestPurchase {
    id: string;
    username: string;
    productName: string;
    serverName: string;
    amount: number;
    timestamp: string;
}
interface LatestSignup {
    id: string;
    username: string;
    timestamp: string;
}
interface TopCreditLoader {
    id: string;
    username: string;
    totalAmount: number;
}
interface SiteStatistics {
    latest: {
        payments: LatestPayment[];
        purchases: LatestPurchase[];
        signups: LatestSignup[];
    };
    topCreditLoaders: TopCreditLoader[];
    totalUsers: number;
    [key: string]: any;
}
interface PunishmentItem {
    id: number | string;
    name: string;
    reason: string;
    operator: string;
    punishmentType: 'ban' | 'mute' | 'kick' | 'warn' | string;
    start: number;
    end: number;
    active: boolean;
}
interface PaginatedPunishmentsResponse {
    punishments: PunishmentItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
interface VoteProviderItem {
    id: string;
    name: string;
    type?: string;
    url: string;
    cooldownHours: number;
    isActive: boolean;
    [key: string]: any;
}
interface VoteProcessResponse {
    success: boolean;
    message: string;
    canVoteAt?: string;
}
interface LegalDocuments {
    rules?: string;
    privacy_policy?: string;
    terms_of_service?: string;
    [key: string]: any;
}
type ReportType = 'spam' | 'harassment' | 'inappropriate_content' | 'fraud' | 'other';
interface CreateReportDto {
    reportType: ReportType;
    reason: string;
}
interface ReportResponse {
    id: string;
    reporterId: string;
    reportedUserId: string;
    reportType: ReportType;
    reason: string;
    status: 'pending' | 'resolved' | 'dismissed' | string;
    reporter?: {
        id: string;
        username: string;
    };
    reportedUser?: {
        id: string;
        username: string;
    };
    createdAt: string;
    [key: string]: any;
}
interface ForumCategory {
    id: string;
    name: string;
    slug: string;
    description?: string;
    topics?: any[];
    subCategories?: any[];
    [key: string]: any;
}
interface ForumMessageReply {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt?: string;
}
interface ForumMessage {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    replies?: ForumMessageReply[];
    createdAt?: string;
}
interface ForumTopic {
    id: string;
    title: string;
    slug: string;
    authorId: string;
    authorName: string;
    likeCount?: number;
    replyCount?: number;
    messages?: ForumMessage[];
    createdAt?: string;
    [key: string]: any;
}
interface LikeTopicResponse {
    success: boolean;
    likeCount: number;
    message: string;
}
interface HelpCategoryItem {
    id: string;
    name: string;
    description?: string;
    order?: number;
}
interface HelpArticleItem {
    id: string;
    title: string;
    content?: string;
    categoryId: string;
    category?: {
        id: string;
        name: string;
    };
    order?: number;
}
interface HelpFaqItem {
    id: string;
    question: string;
    answer: string;
    order?: number;
}
interface HelpcenterOverviewResponse {
    categories: HelpCategoryItem[];
    items: HelpArticleItem[];
    faqs: HelpFaqItem[];
}
interface HelpcenterCategoryDetailResponse {
    id: string;
    name: string;
    items: HelpArticleItem[];
    itemCount: number;
}
interface StaffFormInput {
    id: string;
    name: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | string;
    index: number;
    required?: boolean;
}
interface StaffFormItem {
    id: string;
    title: string;
    description?: string;
    inputs: StaffFormInput[];
    isActive: boolean;
}
interface StaffFormApplicationValue {
    inputId: string;
    value: string;
}
interface StaffFormApplicationResponse {
    id: string;
    userId: string;
    values: StaffFormApplicationValue[];
    status: 'pending' | 'accepted' | 'rejected' | string;
    createdAt: string;
    updatedAt: string;
}
interface SearchResultItem {
    id: string;
    name: string;
    type: 'user' | 'post' | 'ticket' | 'page' | 'product' | string;
    websiteId: string;
    subtitle: string;
    image: string | null;
}
interface WebsiteSeoConfig {
    metaTitleTemplate?: string;
    metaDescriptionTemplate?: string;
    defaultKeywords?: string[];
    ogImage?: string;
    favicon?: string;
    robotsTxt?: string;
    customHeadTags?: string;
    [key: string]: any;
}
interface SitemapUrlItem {
    path: string;
    lastmod: string;
    changefreq: string;
    priority: number;
}
interface LuckPermsPermissionNode {
    permission: string;
    value: number;
    server?: string;
    world?: string;
    expiry?: number;
    contexts?: string;
}
interface LuckPermsPlayerData {
    uuid: string;
    username: string;
    primaryGroup: string;
    inheritedGroups: string[];
    permissions: LuckPermsPermissionNode[];
}
interface WebsitePluginModule {
    isActive: boolean;
    config?: Record<string, any>;
    [key: string]: any;
}
interface WebsiteInfo {
    id: string;
    name: string;
    domain?: string;
    currency: string;
    logo?: string;
    favicon?: string;
    pluginModules?: Record<string, WebsitePluginModule>;
    marketplace?: MarketplaceConfig;
    servers?: ServerStatusItem[];
    [key: string]: any;
}
interface CrafterEventMap {
    'auth:login': {
        token?: string;
        [key: string]: any;
    };
    'auth:logout': void;
    'auth:token_refreshed': {
        token: string;
    };
    'user:updated': UserProfile;
    'balance:sent': SendBalanceResponse;
    'wall:message_added': {
        userId: string;
        message: WallMessage;
    };
    'wall:reply_added': {
        userId: string;
        wallMessageId: string;
        reply: WallMessageReply;
    };
    '2fa:enabled': {
        method: 'authenticator' | 'email' | 'discord';
        recoveryCodes?: string[];
    };
    '2fa:disabled': {
        method?: string;
    };
    'discord:linked': {
        discordId: string;
        discordUsername: string;
    };
    'discord:unlinked': void;
    'cart:purchased': PurchaseResponse;
    'cart:checkout': CheckoutPaymentResponse;
    /** Cart changed (add / update / remove / another tab); `crafter:cart:updated` on `document` */
    'cart:updated': CartState;
    /** Language / currency chosen; `crafter:localization:changed` on `document` */
    'localization:changed': {
        language: string;
        currency: string;
        url: string;
    };
    'license:verified': {
        valid: boolean;
        productId?: string;
        type?: string;
        downloadable?: boolean;
    };
    'chest:item_used': {
        itemId: string;
        response: UseChestItemResponse;
    };
    'chest:item_gifted': {
        targetUserId: string;
        itemId: string;
        response: GiftChestItemResponse;
    };
    'ticket:created': Ticket;
    'ticket:replied': {
        ticketId: string;
        response: Ticket;
    };
    'ticket:closed': {
        ticketId: string;
        reason?: string;
        response: Ticket;
    };
    'ticket:opened': {
        ticketId: string;
        response: Ticket;
    };
    'forum:topic_created': ForumTopic;
    'forum:message_added': {
        topicId: string;
        message: any;
    };
    'forum:reply_added': {
        messageId: string;
        reply: any;
    };
    'forum:topic_liked': {
        topicId: string;
        likeCount?: number;
    };
    'forum:topic_unliked': {
        topicId: string;
        likeCount?: number;
    };
    'post:liked': LikePostResponse;
    'redeem:used': UseRedeemCodeResponse;
    'report:created': ReportResponse;
    'vote:success': {
        providerId: string;
        response: any;
    };
    'form:submitted': {
        formId: string;
        response: StaffFormApplicationResponse;
    };
    'payment:initiated': InitiatePaymentResponse;
    'payment:checked': CheckPaymentResponse;
    'payment:status': PaymentStatusResult;
    'payment:quoted': PresentmentQuote;
}
type CrafterEventName = keyof CrafterEventMap;

declare class AuthModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Sign in user with username and password.
     * POST /v2/auth/signin
     */
    signin(data: SignInDto): Promise<AuthResponse>;
    /**
     * Alias for signin.
     */
    login(data: SignInDto): Promise<AuthResponse>;
    /**
     * Register a new user.
     * POST /v2/auth/signup
     */
    signup(data: SignUpDto | (Omit<SignUpDto, 'confirm_password'> & {
        confirmPassword: string;
    })): Promise<AuthResponse>;
    /**
     * Alias for signup.
     */
    register(data: SignUpDto | (Omit<SignUpDto, 'confirm_password'> & {
        confirmPassword: string;
    })): Promise<AuthResponse>;
    /**
     * Fast authentication for in-game players clicking web links (e.g. /web command in Minecraft).
     * If parameters are omitted, automatically extracts username, uuid, server_id, and hash from URL query params.
     * POST /v2/auth/ingame
     */
    inGameAuth(data?: Partial<InGameAuthDto>): Promise<AuthResponse>;
    /**
     * Refresh access token using refresh token.
     * POST /v2/auth/refresh-token
     */
    refreshToken(refreshToken: string): Promise<AuthResponse>;
    /**
     * Alias for refreshToken.
     */
    refresh(refreshToken: string): Promise<AuthResponse>;
    /**
     * Request password reset email.
     * POST /v2/auth/forgot-password
     */
    forgotPassword(email: string, turnstileToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Get password reset token from current URL query parameters (?token=...).
     * Returns null in SSR/Node environments or if token query param is missing.
     */
    getResetTokenFromUrl(): string | null;
    /**
     * Reset password with reset token.
     * If data.token is omitted, it automatically attempts to read ?token= from the URL (window.location.search).
     * POST /v2/auth/reset-password
     */
    resetPassword(data: ResetPasswordDto | {
        token?: string;
        newPassword?: string;
        new_password?: string;
        confirmPassword?: string;
        confirm_password?: string;
        turnstileToken?: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Verify email OTP code during login or signup.
     * POST /v2/auth/verify-email
     */
    verifyEmail(data: {
        tempToken: string;
        code: string;
    } | string): Promise<any>;
    /**
     * Resend verification email code during login or registration.
     * POST /v2/auth/resend-email
     */
    resendEmail(tempToken: string): Promise<any>;
    /**
     * Alias for resendEmail.
     */
    resendVerification(tempToken: string): Promise<any>;
    /**
     * Validate 2FA code during sign in.
     * POST /v2/auth/2fa/verify
     */
    validate2Fa(data: TwoFactorValidateDto): Promise<AuthResponse>;
    /**
     * Send 2FA verification code to email during login.
     * POST /v2/auth/2fa/send-email-code
     */
    send2FaEmailCode(tempToken: string): Promise<any>;
    /**
     * Send 2FA verification code/push to Discord DM during login.
     * POST /v2/auth/2fa/send-discord-code
     */
    send2FaDiscordCode(tempToken: string): Promise<any>;
    /**
     * Update temporary @temp.com email and send verification code (for players registered in-game).
     * POST /v2/auth/update-temp-email
     */
    updateTempEmail(tempToken: string, email: string): Promise<any>;
    /**
     * Get Discord OAuth redirect URL for login or account connect.
     * GET /v2/auth/discord?action=login|connect&redirectUri=...
     */
    getDiscordAuthUrl(action?: 'login' | 'connect', redirectUri?: string): string;
    /**
     * Sign out user and clear session token.
     * In storefront mode, notifies proxy to delete HttpOnly cookies.
     */
    logout(): Promise<void>;
    isAuthenticated(): boolean;
    getToken(): string | null;
    setToken(token: string | null): void;
}

declare class UsersModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get user profile by ID or current user ('me').
     * GET /v2/users/:userId
     */
    getProfile(userId?: string): Promise<UserProfile>;
    /**
     * High-performance lightweight balance check for theme headers.
     * GET /v2/users/:userId/balance
     */
    getBalance(userId?: string): Promise<LightweightBalanceResponse['data']>;
    /**
     * Search/get user by username.
     * GET /v2/users/@:username
     */
    getByUsername(username: string): Promise<UserProfile>;
    /**
     * Update own user profile.
     * In backend self-update, only email can be updated.
     * PUT /v2/users/:userId
     */
    updateProfile(data: UpdateOwnUserDto, userId?: string): Promise<UserProfile>;
    /**
     * Send balance to another user.
     * POST /v2/users/:sender/balance/send
     */
    sendBalance(params: SendBalanceParams): Promise<SendBalanceResponse>;
    /**
     * Change user password.
     * POST /v2/users/:userId/change-password
     */
    changePassword(data: ChangePasswordDto | {
        currentPassword?: string;
        current_password?: string;
        newPassword?: string;
        new_password?: string;
    }, userId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * List wall messages and replies for a user profile.
     * GET /v2/users/:userId/wall
     */
    getWall(userId: string): Promise<WallMessage[]>;
    /**
     * Post a message on a user's wall.
     * POST /v2/users/:userId/wall
     */
    postWallMessage(userId: string, content: string): Promise<any>;
    /**
     * Reply to a wall message.
     * POST /v2/users/:userId/wall/:wallMessageId/reply
     */
    replyWallMessage(userId: string, wallMessageId: string, content: string): Promise<any>;
    /**
     * Check 2FA active methods status.
     * GET /v2/users/me/2fa/status
     */
    get2FaStatus(): Promise<TwoFactorStatusResponse>;
    /**
     * Generate Google Authenticator secret & QR code.
     * POST /v2/users/me/2fa/authenticator/setup
     */
    setupAuthenticator(): Promise<{
        secret: string;
        qrCodeUrl: string;
    }>;
    /**
     * Enable Google Authenticator with 6-digit code.
     * POST /v2/users/me/2fa/authenticator/enable
     */
    enableAuthenticator(code: string): Promise<any>;
    /**
     * Send 2FA confirmation code to registered email.
     * POST /v2/users/me/2fa/email/send-code
     */
    sendEmail2FaCode(): Promise<any>;
    /**
     * Enable Email 2FA with received code.
     * POST /v2/users/me/2fa/email/enable
     */
    enableEmail2Fa(code: string): Promise<any>;
    /**
     * Send 2FA confirmation code to user's Discord DM.
     * POST /v2/users/me/2fa/discord/send-code
     */
    sendDiscord2FaCode(): Promise<any>;
    /**
     * Enable Discord 2FA with received code.
     * POST /v2/users/me/2fa/discord/enable
     */
    enableDiscord2Fa(code: string): Promise<any>;
    /**
     * Disable 2FA.
     * Accepts optional password and specific method to disable.
     * POST /v2/users/me/2fa/disable
     */
    disable2Fa(data?: DisableTwoFactorDto): Promise<any>;
    /**
     * Set primary 2FA method.
     * PUT /v2/users/me/2fa/primary-method
     */
    setPrimary2FaMethod(method: 'authenticator' | 'email' | 'discord'): Promise<any>;
    /**
     * Regenerate 2FA backup recovery codes.
     * POST /v2/users/me/2fa/recovery-codes/regenerate
     */
    regenerateRecoveryCodes(): Promise<{
        recoveryCodes: string[];
    }>;
    /**
     * Get user's linked Discord status.
     * GET /v2/users/me/discord/status
     */
    getDiscordStatus(): Promise<DiscordStatusData>;
    /**
     * Unlink Discord account.
     * POST /v2/users/me/discord/unlink
     */
    unlinkDiscord(): Promise<any>;
}

declare class StoreModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List all categories.
     * GET /categories
     */
    getCategories(): Promise<Category[]>;
    /**
     * Get single category by ID.
     * GET /categories/:categoryId
     */
    getCategory(categoryId: string): Promise<Category>;
    /**
     * List products. With no filter the full catalog is returned.
     * Groups combine; several values in one group match any of them.
     * GET /products
     */
    getProducts(filter?: {
        type?: string | string[];
        server?: string | string[];
        category?: string | string[];
        tag?: string | string[];
        q?: string;
        priceMin?: number;
        priceMax?: number;
        available?: boolean;
    }): Promise<Product[]>;
    /**
     * Filter groups for a storefront sidebar: price range, category, stock, type, tag and server.
     * GET /products/filters
     */
    getFilters(): Promise<{
        filters: Array<{
            id: string;
            label: string;
            type: string;
            min?: number;
            max?: number;
            values?: Array<{
                id: string;
                label: string;
                count: number;
            }>;
        }>;
    }>;
    private joinFilter;
    /**
     * Get product details by product ID.
     * GET /products/:productId
     */
    getProduct(productId: string): Promise<Product>;
    /**
     * Get products by category ID.
     * GET /products/by-category/:categoryId
     */
    getProductsByCategory(categoryId: string): Promise<Product[]>;
    /**
     * Get store marketplace settings including bulk discount promotions.
     * GET /config/marketplace
     */
    getConfig(): Promise<MarketplaceConfig>;
}

declare class ChestModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get user's chest items.
     * GET /chest/:userId
     */
    getItems(userId?: string): Promise<ChestItem[]>;
    /**
     * Use an item from the user's chest.
     * POST /chest/:userId/use/:chestItemId
     */
    useItem(chestItemId: string, userId?: string): Promise<any>;
    /**
     * Gift a chest item to another user.
     * POST /chest/:from/gift/:to/:chestItemId
     */
    giftItem(targetUserId: string, chestItemId: string, fromUserId?: string): Promise<any>;
}

declare class TicketsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List all tickets for current user.
     * GET /v2/tickets
     */
    list(): Promise<Ticket[]>;
    /**
     * Alias for list.
     */
    getTickets(): Promise<Ticket[]>;
    /**
     * List ticket categories.
     * GET /v2/tickets/categories
     */
    getCategories(): Promise<TicketCategory[]>;
    /**
     * Get single ticket by ID.
     * GET /v2/tickets/:ticketId
     */
    get(ticketId: string): Promise<Ticket>;
    /**
     * Create a new support ticket.
     * Plain text message is automatically transformed to valid Lexical rich-text JSON format.
     * POST /v2/tickets
     */
    create(data: CreateTicketDto): Promise<Ticket>;
    /**
     * Reply to a ticket.
     * Plain text message is automatically transformed to valid Lexical rich-text JSON format.
     * POST /v2/tickets/:ticketId/reply
     */
    reply(ticketId: string, replyData: ReplyTicketDto | string): Promise<Ticket>;
    /**
     * Close a ticket with optional resolution reason.
     * POST /v2/tickets/:ticketId/close
     */
    close(ticketId: string, reason?: string): Promise<Ticket>;
    /**
     * Reopen a closed ticket.
     * POST /v2/tickets/:ticketId/open
     */
    open(ticketId: string): Promise<Ticket>;
    /**
     * Alias for open.
     */
    reopen(ticketId: string): Promise<Ticket>;
}

declare class PostsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List posts with optional filters and pagination.
     * GET /v2/posts
     */
    list(query?: PostQueryDto): Promise<PaginatedPostsResponse>;
    /**
     * Get post by slug or ID.
     * GET /v2/posts/:idOrSlug
     */
    getBySlug(slug: string): Promise<PostItem>;
    /**
     * Get post by ID or slug.
     * GET /v2/posts/:idOrSlug
     */
    get(idOrSlug: string): Promise<PostItem>;
    /**
     * Like / toggle like for a post.
     * POST /v2/posts/:id/like
     */
    like(id: string): Promise<LikePostResponse>;
    /**
     * Get posts liked by a user (e.g. for user profile favorites tab).
     * GET /v2/posts/user/:userId/liked
     */
    getUserLiked(userId?: string, page?: number, limit?: number): Promise<PaginatedPostsResponse>;
}

declare class PagesModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List all published static pages.
     * GET /v2/pages/public
     */
    list(): Promise<PageItem[]>;
    /**
     * Get page details and content by slug.
     * GET /v2/pages/slug/:slug
     */
    getBySlug(slug: string): Promise<PageItem>;
}

declare class CouponsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Validate and get coupon discount details.
     * GET /coupons/:couponCode
     */
    get(couponCode: string): Promise<CouponResponse>;
}

declare class RedeemCodeModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Redeem gift/promo code.
     * POST /redeem-codes/use
     */
    use(code: string): Promise<UseRedeemCodeResponse>;
}

declare class ServersModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get server list with live player counts and online status.
     * GET /config/servers
     */
    getList(): Promise<ServerStatusItem[]>;
    /**
     * Alias for getList.
     */
    list(): Promise<ServerStatusItem[]>;
}

declare class StatisticsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get homepage statistics: latest purchases, payments, signups, leaderboard and total users.
     * GET /v2/statistics?limit=:limit
     */
    get(limit?: number): Promise<SiteStatistics>;
}

declare class PunishmentsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List punishments with pagination.
     * GET /v2/punishments
     */
    list(page?: number, limit?: number): Promise<PaginatedPunishmentsResponse>;
    /**
     * Search punishments by player name and optional type (ban, mute etc.).
     * GET /v2/punishments/search?query=:query&type=:type
     */
    search(query: string, type?: 'ban' | 'mute' | 'kick' | 'warn' | string): Promise<PunishmentItem[]>;
}

declare class VoteModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get active vote sites with player cooldowns.
     * GET /config/vote-providers
     */
    getProviders(): Promise<VoteProviderItem[]>;
    /**
     * Process vote request.
     * POST /config/vote-providers/vote
     */
    vote(providerId: string, extraData?: Record<string, any>): Promise<VoteProcessResponse>;
}

declare class LegalModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get legal documents (terms of service, privacy policy, rules, refund policy etc.).
     * GET /config/legal
     */
    getDocuments(): Promise<LegalDocuments>;
}

declare class ReportsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Report a user to staff.
     * POST /reports/:reportedUserId
     */
    create(reportedUserId: string, data: CreateReportDto): Promise<ReportResponse>;
}

declare class ForumModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get all forum categories.
     * GET /forum/categories
     */
    getCategories(): Promise<ForumCategory[]>;
    /**
     * Get topics under a category.
     * GET /forum/category/:categoryId/topics
     */
    getTopics(categoryId: string): Promise<ForumTopic[]>;
    /**
     * Get topic details and messages.
     * GET /forum/topic/:topicId
     */
    getTopic(topicId: string): Promise<ForumTopic>;
    /**
     * Create a new topic in a category.
     * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
     * POST /forum/category/:categoryId/topic
     */
    createTopic(categoryId: string, data: {
        title: string;
        content: string | Record<string, any>;
    }): Promise<ForumTopic>;
    /**
     * Post a message in a topic.
     * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
     * POST /forum/topic/:topicId/message
     */
    addMessage(topicId: string, content: string | Record<string, any>): Promise<any>;
    /**
     * Reply / quote a forum message.
     * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
     * POST /forum/message/:messageId/reply
     */
    replyMessage(messageId: string, content: string | Record<string, any>): Promise<any>;
    /**
     * Like / toggle like for a topic.
     * POST /forum/topic/:topicId/like
     */
    likeTopic(topicId: string): Promise<any>;
    /**
     * Unlike a topic.
     * DELETE /forum/topic/:topicId/like
     */
    unlikeTopic(topicId: string): Promise<any>;
    /**
     * Get forum statistics (latest topics/replies).
     * GET /forum/statistics
     */
    getStatistics(): Promise<any>;
}

declare class HelpcenterModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get help center overview containing categories, featured items and FAQs.
     * GET /helpcenter
     */
    getOverview(query?: {
        search?: string;
        faqOnly?: boolean;
        page?: number;
        limit?: number;
    }): Promise<HelpcenterOverviewResponse>;
    /**
     * Alias for getOverview.
     */
    getCategories(query?: {
        search?: string;
        faqOnly?: boolean;
        page?: number;
        limit?: number;
    }): Promise<HelpcenterOverviewResponse>;
    /**
     * Get single help category with its articles.
     * GET /helpcenter/category/:categoryId
     */
    getCategory(categoryId: string): Promise<HelpcenterCategoryDetailResponse>;
    /**
     * Get single article details.
     * GET /helpcenter/item/:itemId
     */
    getArticle(itemId: string): Promise<HelpArticleItem>;
}

declare class StaffFormsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List open staff application forms.
     * GET /staff-forms
     */
    list(): Promise<StaffFormItem[]>;
    /**
     * Get application form details and fields by ID.
     * GET /staff-forms/:formId
     */
    get(formId: string): Promise<StaffFormItem>;
    /**
     * Submit an application for a staff form.
     * Accepts either an array of { inputId, value } or an object of { [inputId]: value }.
     * POST /staff-forms/:formId/apply
     */
    apply(formId: string, answers: Record<string, any> | Array<{
        inputId: string;
        value: any;
    }>): Promise<any>;
}

declare class SearchModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Global metadata live search across users, posts, tickets, pages, and products.
     * GET /metadata-search?q=:query&limit=:limit
     */
    metadataSearch(query: string, limit?: number): Promise<SearchResultItem[]>;
    /**
     * Alias for metadataSearch.
     */
    query(searchTerm: string, limit?: number): Promise<SearchResultItem[]>;
}

declare class SeoModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get global website SEO configuration (meta tags, keywords, og:image, favicon etc.).
     * GET /v2/seo/config
     */
    getConfig(): Promise<WebsiteSeoConfig>;
    /**
     * Get dynamic sitemap URL entries for all published posts, pages, categories, and products.
     * GET /v2/seo/sitemap-data
     */
    getSitemapData(): Promise<SitemapUrlItem[]>;
}

declare class LuckPermsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get player's LuckPerms primary group, inherited groups, and active permissions.
     * Identifier can be a player username or Minecraft UUID.
     * GET /v2/modules/luckperms/player/:identifier
     */
    getPlayer(identifier: string): Promise<LuckPermsPlayerData>;
    /**
     * Get list of available LuckPerms groups configured on the server.
     * GET /v2/modules/luckperms/groups
     */
    getGroups(): Promise<string[]>;
}

declare class WebsiteModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get website general info, active plugin modules (discord_bot, authme, luckperms, etc.), and settings.
     * Resolves to GET /api/storefront in storefront mode, or GET /website/:websiteId in direct mode.
     */
    getInfo(): Promise<WebsiteInfo>;
}

interface LicenseRecord {
    id: string;
    productId: string;
    productName: string | null;
    key: string;
    type: 'in_game' | 'digital' | 'downloadable';
    code: string | null;
    hasDownload: boolean;
    status: string;
    createdAt: string;
}
interface LicenseVerification {
    valid: boolean;
    productId?: string;
    type?: string;
    downloadable?: boolean;
}
declare class LicensesModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Licenses owned by the signed-in user, including digital codes.
     * GET /marketplace/licenses
     */
    list(): Promise<LicenseRecord[]>;
    /**
     * Check a license key. The response does not include a digital code or a download URL.
     * GET /marketplace/licenses/verify
     */
    verify(key: string): Promise<LicenseVerification>;
    /**
     * Short-lived download URL for a license owned by the signed-in user.
     * GET /marketplace/licenses/:licenseId/download
     */
    download(licenseId: string): Promise<{
        url: string;
        expiresIn: number;
    }>;
}

/**
 * Customer currency (#424, #426): context and conversion for price display. The server decides the currency
 * (the storefront's `crafter_currency` cookie, country, store currency); the SDK does not write its own cookie.
 * Converted amounts are for display only; the payment amount is set by the locked quote (`payments.quote`).
 */
declare class CurrenciesModule {
    private http;
    private events;
    private options;
    constructor(http: HttpClient, events: EventEmitter, options?: Pick<CrafterConfig, 'websiteId'>);
    /**
     * Store currency, allowed currencies, the customer's currency and rates.
     * `currency`: the customer's choice (a suggestion); if not allowed, the country / store currency is returned.
     * GET /payment/currencies?websiteId=&currency=
     */
    context(params?: {
        currency?: string;
        websiteId?: string;
    }): Promise<CustomerCurrencyContext>;
    /**
     * Converts store-currency amounts (at most 500) to the customer currency; order is preserved.
     * POST /payment/currencies/convert
     */
    convert(amounts: number[], params?: {
        currency?: string;
        websiteId?: string;
    }): Promise<CurrencyConversion>;
}

interface MoneyFormatOptions {
    /**
     * If the amount is in the store currency (default) it is converted to the customer's currency with the page context's rate.
     * `false`: not converted, printed in the store currency (balance, earnings, etc.).
     */
    convert?: boolean;
    /** Given if the amount is already in this currency (e.g. a payment quote); no conversion is done */
    currency?: string;
    /** Default: the page language */
    locale?: string;
}
/** Decimals of the currency (Intl); 2 for an unknown code */
declare function currencyDigits(currency: string): number;
/**
 * Money display (#447): same rule as the storefront's `money` filter. Amounts arrive in the store currency;
 * they are converted to the customer's currency with the page context's rate and formatted in the page language. Without a context, or
 * with an invalid rate, they are shown in the store currency. Display only; the exact amount is set on the server at payment time.
 */
declare class MoneyModule {
    private getContext;
    constructor(getContext: () => CrafterPageContext | null);
    /** Store currency; empty without a context */
    get storeCurrency(): string;
    /** The customer's currency; the store currency if the rate is invalid */
    get currency(): string;
    /** 1 store unit = rate customer units; 1 if the customer currency is the store's */
    get rate(): number;
    /** Converts a store amount to the customer currency and rounds to that unit's decimals */
    convert(storeAmount: number | string): number;
    /**
     * @example Crafter.money.format(19.99)                    // '€18,40' (EUR customer, de)
     * @example Crafter.money.format(250, { convert: false })  // in the store currency
     */
    format(amount: number | string, options?: MoneyFormatOptions): string;
    private rateOf;
}

interface LocalizationState {
    /** Page language */
    language: string;
    /** The customer's currency; the store currency if absent */
    currency: string;
    languages: string[];
    currencies: string[];
}
interface LocalizationChange {
    language?: string;
    currency?: string;
}
interface LocalizationSetOptions {
    /** In-app path to return to after the choice (without prefix); defaults to the current page */
    returnTo?: string;
    /** false: the page is not reloaded, only the URL is returned (the theme handles it). Default true. */
    reload?: boolean;
}
/**
 * Language and currency (#447). The choice goes to the same endpoint as the storefront's no-JS form: `POST /localization`
 * (`language`, `currency`, `return_to`). The server writes the choice to a cookie and returns the page URL in the chosen language.
 */
declare class LocalizationModule {
    private getContext;
    private dom;
    constructor(getContext: () => CrafterPageContext | null, dom: DomEvents);
    get(): LocalizationState;
    /**
     * Changes the language and/or currency. By default the page navigates to the URL in the chosen language.
     * The `crafter:localization:changed` event (`{ language, currency, url }`) is emitted before navigating.
     */
    set(change: LocalizationChange, options?: LocalizationSetOptions): Promise<{
        url: string;
    }>;
}

interface SectionsRenderOptions {
    /** Page to render the sections for; defaults to the current page (path + query) */
    url?: string;
    /** false: the DOM is not touched, only the HTML is returned */
    swap?: boolean;
}
/**
 * Section rendering (#447): fetches the current HTML of the sections from the `?sections=a,b` endpoint and replaces the
 * `#crafter-section-<id>` wrappers on the page with the new ones. Group sections are requested as `<group>:<id>`.
 */
declare class SectionsModule {
    render(ids: string[], options?: SectionsRenderOptions): Promise<Record<string, string | null>>;
}

/**
 * Formats an amount by currency and language (Intl.NumberFormat). The symbol and decimals come from the currency;
 * 'TL' / '₺' are never hard-coded. If `locale` is not given, the runtime's language is used.
 * Falls back to `1234.50 XYZ` for an invalid currency / language code (never throws).
 *
 * @example formatMoney(9.99, 'USD', 'en-US') // '$9.99'
 * @example formatMoney(250, 'TRY', 'tr-TR')  // '₺250,00'
 */
declare function formatMoney(amount: number | string, currency: string, locale?: string | string[]): string;

/**
 * Official Lexical Format Bitmask Flags
 * @see https://lexical.dev/docs/concepts/nodes
 */
declare const IS_BOLD = 1;
declare const IS_ITALIC = 2;
declare const IS_STRIKETHROUGH = 4;
declare const IS_UNDERLINE = 8;
declare const IS_CODE = 16;
declare const IS_SUBSCRIPT = 32;
declare const IS_SUPERSCRIPT = 64;
declare const IS_HIGHLIGHT = 128;
interface SerializedLexicalNode {
    type: string;
    version: number;
    [key: string]: any;
}
interface SerializedTextNode extends SerializedLexicalNode {
    type: 'text';
    text: string;
    format: number;
    detail: number;
    mode: 'normal' | 'token' | 'segmented';
    style: string;
}
interface SerializedElementNode extends SerializedLexicalNode {
    children: SerializedLexicalNode[];
    direction: 'ltr' | 'rtl' | null;
    format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
    indent: number;
}
interface SerializedHeadingNode extends SerializedElementNode {
    type: 'heading';
    tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}
interface SerializedListNode extends SerializedElementNode {
    type: 'list';
    listType: 'bullet' | 'number' | 'check';
    start?: number;
    tag: 'ol' | 'ul';
}
interface SerializedListItemNode extends SerializedElementNode {
    type: 'listitem';
    value?: number;
    checked?: boolean;
}
interface SerializedLinkNode extends SerializedElementNode {
    type: 'link' | 'autolink';
    url: string;
    target?: string | null;
    rel?: string | null;
    title?: string | null;
}
interface SerializedQuoteNode extends SerializedElementNode {
    type: 'quote';
}
interface SerializedCodeNode extends SerializedElementNode {
    type: 'code';
    language?: string | null;
}
interface SerializedTableNode extends SerializedElementNode {
    type: 'table';
}
interface SerializedTableRowNode extends SerializedElementNode {
    type: 'tablerow';
}
interface SerializedTableCellNode extends SerializedElementNode {
    type: 'tablecell';
    colSpan?: number;
    rowSpan?: number;
    width?: number;
    headerState?: number;
    backgroundColor?: string | null;
}
interface SerializedHorizontalRuleNode extends SerializedLexicalNode {
    type: 'horizontalrule';
}
interface SerializedImageNode extends SerializedLexicalNode {
    type: 'image' | 'inline-image';
    src: string;
    altText?: string;
    width?: number | 'inherit';
    height?: number | 'inherit';
    maxWidth?: number;
    caption?: SerializedEditorState;
}
interface SerializedEditorState {
    root: SerializedRootNode;
}
interface SerializedRootNode extends SerializedElementNode {
    type: 'root';
}
interface LexicalHtmlOptions {
    /**
     * If true, generates clean semantic HTML without pre-baked Tailwind/theme utility classes.
     * Default: false (includes standard Crafter storefront theme classes).
     */
    plainSemantic?: boolean;
}
/**
 * Checks if an object conforms to official Lexical serialized EditorState AST format.
 * @see https://lexical.dev/docs/serialization
 */
declare function isLexicalFormat(obj: any): boolean;
/**
 * Converts Lexical AST node format into semantic HTML.
 * Fully compatible with official Lexical specifications and Storefront SSR Liquid filters.
 *
 * Supports:
 * - Text bitmasks: Bold (1), Italic (2), Strikethrough (4), Underline (8), Code (16), Subscript (32), Superscript (64), Highlight (128)
 * - Block alignment: left, center, right, justify, start, end
 * - Block indentation and text direction (ltr, rtl)
 * - Headings (h1-h6)
 * - Lists (bullet, number, and interactive check/todo lists)
 * - Quotes, Code blocks (with syntax language), Links, Images, Tables, Horizontal Rules, Line breaks, and Tabs.
 */
declare function lexicalToHtml(node: any, options?: LexicalHtmlOptions): string;
/**
 * Extracts pure, unformatted text from a Lexical AST.
 * Useful for excerpt cards, notification previews, and meta tags.
 */
declare function lexicalToText(node: any): string;
/**
 * Alias for lexicalToText.
 */
declare const lexicalToPlainText: typeof lexicalToText;
/**
 * Deserializes an HTML string into a valid Lexical EditorState AST.
 * Works seamlessly in browser DOM and in Node.js environments.
 *
 * @see https://lexical.dev/docs/serialization#html---lexical
 */
declare function htmlToLexical(html: string): SerializedEditorState;
/**
 * Automatically wraps plain strings or HTML into a valid Lexical rich-text JSON object.
 * If already a Lexical object, returns it unchanged.
 * Ensures 100% compatibility with backend LexicalFormatValidator.
 */
declare function toLexical(content: string | Record<string, any>): SerializedEditorState;

declare class CrafterError extends Error {
    readonly statusCode: number;
    readonly error?: string;
    /** Backend error code (ErrorType), e.g. 'out_of_stock', 'balance_top_up_limit_exceeded' */
    readonly type?: string;
    readonly details?: Record<string, any>;
    readonly isCrafterError = true;
    constructor(payload: {
        message: string | string[];
        statusCode?: number;
        error?: string;
        type?: string;
        details?: Record<string, any>;
    });
    static fromResponse(statusCode: number, data: any): CrafterError;
}
/** Backend error codes (ErrorType) related to the payment flow. */
declare const PaymentErrorType: {
    readonly OUT_OF_STOCK: "out_of_stock";
    readonly BALANCE_TOP_UP_UNAVAILABLE: "balance_top_up_unavailable";
    readonly BALANCE_TOP_UP_LIMIT_EXCEEDED: "balance_top_up_limit_exceeded";
    readonly BALANCE_TOP_UP_TOTAL_LIMIT_EXCEEDED: "balance_top_up_total_limit_exceeded";
    readonly SELLER_ENTITY_NOT_READY: "seller_entity_not_ready";
    readonly TAX_CALCULATION_FAILED: "tax_calculation_failed";
    readonly TAX_LOCATION_INVALID: "tax_location_invalid";
    readonly PAYMENT_PROVIDER_NOT_FOUND: "payment_provider_not_found";
    readonly PAYMENT_PROVIDER_UNSUPPORTED: "payment_provider_unsupported";
    readonly PAYMENT_CONFIG_ERROR: "payment_config_error";
    readonly PAYMENT_INITIALIZATION_FAILED: "payment_initialization_failed";
    readonly PAYMENT_FAILED: "payment_failed";
    /** The currency sent by the client differs from the store's (or the quote's) */
    readonly PAYMENT_CURRENCY_MISMATCH: "payment_currency_mismatch";
    /** The provider / seller does not support this currency */
    readonly PAYMENT_CURRENCY_UNSUPPORTED: "payment_currency_unsupported";
    /** The store disabled the customer currency: payment is in the store currency */
    readonly CUSTOMER_CURRENCY_NOT_ALLOWED: "customer_currency_not_allowed";
    /** Quote not found / expired / cart changed: get a new quote */
    readonly PRESENTMENT_QUOTE_NOT_FOUND: "presentment_quote_not_found";
    readonly PRESENTMENT_QUOTE_EXPIRED: "presentment_quote_expired";
    readonly PRESENTMENT_QUOTE_MISMATCH: "presentment_quote_mismatch";
};
type PaymentErrorTypeValue = (typeof PaymentErrorType)[keyof typeof PaymentErrorType];
/**
 * Coupon rejection (#476): `crafter.cart.setCoupon()` (storefront `POST /cart/coupon.js`, HTTP 422) and coupon validation.
 * The cart also reports the same codes in `couponRemoved.reason` (when a stored coupon became invalid and was dropped).
 */
declare const CouponErrorType: {
    readonly NOT_FOUND: "coupon_not_found";
    readonly INACTIVE: "coupon_inactive";
    readonly USAGE_LIMIT_REACHED: "coupon_usage_limit_reached";
    readonly ALREADY_USED_BY_USER: "coupon_already_used_by_user";
    readonly NOT_ASSIGNED_TO_USER: "coupon_not_assigned_to_user";
    /** Cart total is below the coupon's minimum (`details.minCartValue`, in the store currency) */
    readonly CART_TOTAL_BELOW_MINIMUM: "coupon_cart_total_below_minimum";
    readonly INVALID_FOR_PRODUCT: "coupon_invalid_for_product";
    readonly INVALID_TYPE: "coupon_invalid_type";
};
type CouponErrorTypeValue = (typeof CouponErrorType)[keyof typeof CouponErrorType];
/** List of coupon error codes */
declare const COUPON_ERROR_TYPES: string[];
type ErrorPayload = ConstructorParameters<typeof CrafterError>[0];
/**
 * Coupon rejected (#476). `message` is in the page language and can be shown as is; see `CouponErrorType` for `type`.
 * A rejected coupon is not written to the cart and the cart does not change.
 */
declare class CrafterCouponError extends CrafterError {
    /** The coupon's minimum (`details.minCartValue`) for `coupon_cart_total_below_minimum`; null otherwise */
    readonly minCartValue: number | null;
    constructor(payload: ErrorPayload);
}
/** Stock turned out to be insufficient when starting payment (HTTP 409, `out_of_stock`). */
declare class CrafterOutOfStockError extends CrafterError {
    /** IDs of the sold-out products (`details.productIds`); empty if the backend did not send them */
    readonly productIds: string[];
    constructor(payload: ErrorPayload);
}
/** Balance top-up limit info (from the error's `details` field). */
interface BalanceTopUpLimits {
    currency?: string;
    maxSingleUsd?: number;
    maxPaidUsd?: number;
    maxSingleAmount?: number | null;
    remainingAmount?: number | null;
}
/** Balance top-up rejected: disabled, single top-up limit or total paid balance limit exceeded. */
declare class CrafterBalanceTopUpError extends CrafterError {
    readonly reason: 'unavailable' | 'single_limit' | 'total_limit';
    /** Limits returned by the backend for limit errors; null for `unavailable` */
    readonly limits: BalanceTopUpLimits | null;
    constructor(payload: ErrorPayload);
}
/**
 * Payment provider / infrastructure error: provider not found, seller infrastructure not ready,
 * Stripe Tax could not calculate tax, payment could not start, etc. The `type` field gives the detail.
 */
declare class CrafterPaymentProviderError extends CrafterError {
    /** Whether the user can retry with the same details a little later */
    readonly retryable: boolean;
    constructor(payload: ErrorPayload);
}
declare function isCrafterError(err: unknown): err is CrafterError;
declare function isOutOfStockError(err: unknown): err is CrafterOutOfStockError;
declare function isBalanceTopUpError(err: unknown): err is CrafterBalanceTopUpError;
/** Whether this is a coupon rejection (`CrafterCouponError` or a `CrafterError` with a coupon error code) */
declare function isCouponError(err: unknown): err is CrafterCouponError;
declare function isPaymentProviderError(err: unknown): err is CrafterPaymentProviderError;

/** Package version; kept in sync with package.json (checked by a test) */
declare const SDK_VERSION = "1.5.3";

/** `crafter.checkout()` options */
interface CheckoutNavigateOptions {
    /** 'cart' (default): cart checkout; 'balance': balance top-up */
    purpose?: 'cart' | 'balance';
    /** Suggested amount for a balance top-up (in the store currency) */
    amount?: number;
    /** false: does not navigate, only returns the URL */
    navigate?: boolean;
}
declare class Crafter {
    static readonly version = "1.5.3";
    readonly version = "1.5.3";
    readonly config: CrafterConfig;
    readonly http: HttpClient;
    readonly events: EventEmitter;
    /** `document` events: `crafter.dom.on('cart:updated', fn)` */
    readonly dom: DomEvents;
    /** Page context (`window.__CRAFTER_CONTEXT__` written by the storefront); null if absent */
    readonly context: CrafterPageContext | null;
    readonly money: MoneyModule;
    readonly localization: LocalizationModule;
    readonly sections: SectionsModule;
    readonly auth: AuthModule;
    readonly users: UsersModule;
    readonly store: StoreModule;
    readonly cart: CartModule;
    readonly marketplace: CartModule;
    readonly chest: ChestModule;
    readonly tickets: TicketsModule;
    readonly posts: PostsModule;
    readonly pages: PagesModule;
    readonly coupons: CouponsModule;
    readonly redeemCode: RedeemCodeModule;
    readonly redeemCodes: RedeemCodeModule;
    readonly servers: ServersModule;
    readonly payments: PaymentsModule;
    readonly statistics: StatisticsModule;
    readonly punishments: PunishmentsModule;
    readonly vote: VoteModule;
    readonly legal: LegalModule;
    readonly reports: ReportsModule;
    readonly forum: ForumModule;
    readonly helpcenter: HelpcenterModule;
    readonly staffForms: StaffFormsModule;
    readonly search: SearchModule;
    readonly seo: SeoModule;
    readonly luckperms: LuckPermsModule;
    readonly website: WebsiteModule;
    readonly licenses: LicensesModule;
    readonly currencies: CurrenciesModule;
    readonly utils: {
        lexicalToHtml: typeof lexicalToHtml;
        lexicalToText: typeof lexicalToText;
        lexicalToPlainText: typeof lexicalToText;
        toLexical: typeof toLexical;
        htmlToLexical: typeof htmlToLexical;
        isLexicalFormat: typeof isLexicalFormat;
        formatMoney: typeof formatMoney;
        formats: {
            IS_BOLD: number;
            IS_ITALIC: number;
            IS_STRIKETHROUGH: number;
            IS_UNDERLINE: number;
            IS_CODE: number;
            IS_SUBSCRIPT: number;
            IS_SUPERSCRIPT: number;
            IS_HIGHLIGHT: number;
        };
    };
    static readonly utils: {
        lexicalToHtml: typeof lexicalToHtml;
        lexicalToText: typeof lexicalToText;
        lexicalToPlainText: typeof lexicalToText;
        toLexical: typeof toLexical;
        htmlToLexical: typeof htmlToLexical;
        isLexicalFormat: typeof isLexicalFormat;
        formatMoney: typeof formatMoney;
        formats: {
            IS_BOLD: number;
            IS_ITALIC: number;
            IS_STRIKETHROUGH: number;
            IS_UNDERLINE: number;
            IS_CODE: number;
            IS_SUBSCRIPT: number;
            IS_SUPERSCRIPT: number;
            IS_HIGHLIGHT: number;
        };
    };
    constructor(config?: CrafterConfig);
    /**
     * Goes to the checkout page (#447). `/checkout?purpose=cart` for the cart; checkout does not open with the language prefix,
     * it reads the language from the referring page. The URL comes from the page context (`routes.checkout`).
     */
    checkout(options?: CheckoutNavigateOptions): string;
    /**
     * Auto-start of the browser build (IIFE) (#447). If the page has `window.__CRAFTER_CONTEXT__`,
     * `window.Crafter` becomes an instance set up with that context and `crafter:ready` is dispatched on `document`; otherwise returns null
     * (`window.Crafter` stays the class and `new Crafter({...})` works as before). A second call returns the same instance.
     */
    static autoInit(win?: any): Crafter | null;
    on<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
    on(event: string, handler: EventHandler): () => void;
    off<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): void;
    off(event: string, handler: EventHandler): void;
    once<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
    once(event: string, handler: EventHandler): void;
    emit<K extends keyof CrafterEventMap>(event: K, payload?: CrafterEventMap[K]): void;
    emit(event: string, payload?: any): void;
}

export { type Auth2FaRequiredResponse, type AuthEmailVerificationRequiredResponse, AuthModule, type AuthResponse, type AuthSuccessResponse, type BalanceTopUpLimits, type BalanceTopUpPolicy, type BulkDiscountConfig, CART_COUPON_KEY, CART_STORAGE_KEY, CART_SYNCED_KEY, CART_SYNC_KEY, CONTEXT_GLOBAL, COUPON_ERROR_TYPES, type CartAddInput, type CartAdjustedNote, type CartBackend, type CartCouponDetails, type CartCouponRemovedNote, type CartLine, CartModule, type CartModuleDeps, type CartRemovedNote, type CartState, type CartStore, type Category, type ChangePasswordDto, type CheckPaymentResponse, type CheckoutNavigateOptions, type CheckoutPaymentResponse, type ChestItem, ChestModule, type ChestProductSummary, CouponErrorType, type CouponErrorTypeValue, type CouponResponse, CouponsModule, Crafter, type CrafterApiError, CrafterBalanceTopUpError, type CrafterConfig, CrafterCouponError, CrafterError, type CrafterEventMap, type CrafterEventName, CrafterOutOfStockError, type CrafterPageContext, CrafterPaymentProviderError, type CreateReportDto, type CreateTicketDto, CurrenciesModule, type CurrencyConversion, type CustomerCurrencyContext, type CustomerCurrencyMode, type CustomerCurrencyOptions, type CustomerCurrencySource, DOM_EVENTS, type DisableTwoFactorDto, type DiscordStatusData, type DiscordStatusResponse, type DomEventName, DomEvents, EventEmitter, type EventHandler, type ForumCategory, type ForumMessage, type ForumMessageReply, ForumModule, type ForumTopic, type GiftChestItemResponse, type HelpArticleItem, type HelpCategoryItem, type HelpFaqItem, type HelpcenterCategoryDetailResponse, HelpcenterModule, type HelpcenterOverviewResponse, HttpClient, IS_BOLD, IS_CODE, IS_HIGHLIGHT, IS_ITALIC, IS_STRIKETHROUGH, IS_SUBSCRIPT, IS_SUPERSCRIPT, IS_UNDERLINE, type InGameAuthDto, type InitiatePaymentDto, type InitiatePaymentResponse, type InitiatePaymentUser, type LatestPayment, type LatestPurchase, type LatestSignup, type LegacyCart, type LegalDocuments, LegalModule, type LegalTermsConsent, type LexicalHtmlOptions, type LicenseRecord, type LicenseVerification, LicensesModule, type LightweightBalanceResponse, type LikePostResponse, type LikeTopicResponse, LocalCartBackend, LocalStorageCartStore, type LocalizationChange, LocalizationModule, type LocalizationSetOptions, type LocalizationState, LuckPermsModule, type LuckPermsPermissionNode, type LuckPermsPlayerData, type MarketplaceConfig, type MoneyFormatOptions, MoneyModule, type PageItem, PagesModule, type PaginatedPostsResponse, type PaginatedPunishmentsResponse, type PaymentDeliveryStatus, PaymentErrorType, type PaymentErrorTypeValue, type PaymentOutcome, type PaymentPresentment, type PaymentRecordStatus, type PaymentSessionType, type PaymentStatusResult, type PaymentTaxBreakdown, type PaymentTaxLine, PaymentsModule, type PaymentsModuleOptions, type PostAuthor, type PostItem, type PostQueryDto, PostsModule, type PresentmentQuote, type PresentmentQuoteKind, type PresentmentQuoteRequest, type Product, type PublicDeliveryState, type PublicPaymentProvider, type PunishmentItem, PunishmentsModule, type PurchaseDto, type PurchaseItemDto, type PurchaseResponse, RedeemCodeModule, type ReplyTicketDto, type ReportResponse, type ReportType, ReportsModule, type RequestOptions, type ResetPasswordDto, SDK_VERSION, SearchModule, type SearchResultItem, SectionsModule, type SectionsRenderOptions, type SendBalanceParams, type SendBalanceResponse, SeoModule, type SerializedCodeNode, type SerializedEditorState, type SerializedElementNode, type SerializedHeadingNode, type SerializedHorizontalRuleNode, type SerializedImageNode, type SerializedLexicalNode, type SerializedLinkNode, type SerializedListItemNode, type SerializedListNode, type SerializedQuoteNode, type SerializedRootNode, type SerializedTableCellNode, type SerializedTableNode, type SerializedTableRowNode, type SerializedTextNode, ServerCartBackend, ServerCartClient, type ServerCartClientOptions, type ServerCartLine, type ServerCartResponse, type ServerStatusItem, ServersModule, type SignInDto, type SignUpDto, type SinglePostResponse, type SiteStatistics, type SitemapUrlItem, type StaffFormApplicationResponse, type StaffFormApplicationValue, type StaffFormInput, type StaffFormItem, StaffFormsModule, StatisticsModule, StoreModule, type StoredCartLine, type StripePaymentSession, type Ticket, type TicketCategory, type TicketCategoryDetails, type TicketMessage, type TicketMessageSender, TicketsModule, type TopCreditLoader, type TwoFactorStatusResponse, type TwoFactorValidateDto, type UpdateOwnUserDto, type UseChestItemResponse, type UseRedeemCodeResponse, type UserProfile, type UserRole, UsersModule, VoteModule, type VoteProcessResponse, type VoteProviderItem, type WaitForPaymentOptions, type WallMessage, type WallMessageReply, type WebsiteInfo, WebsiteModule, type WebsitePluginModule, type WebsiteSeoConfig, cartStateFromServer, currencyDigits, Crafter as default, discountedUnitPrice, dispatchDomEvent, formatMoney, htmlToLexical, isBalanceTopUpError, isCouponError, isCrafterError, isLexicalFormat, isOutOfStockError, isPaymentProviderError, legacyCartDiff, legalTermsHeaders, lexicalToHtml, lexicalToPlainText, lexicalToText, normalizeLines, normalizePaymentResponse, normalizeServerCart, parsePaymentStatus, parseTaxBreakdown, payWithQuote, readPageContext, stripLocalePrefix, toLexical, topUpMaxAmount };

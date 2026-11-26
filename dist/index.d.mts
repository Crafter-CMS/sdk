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

/** Payment modülünün kullandığı yapılandırma alanları */
type PaymentsModuleOptions = Pick<CrafterConfig, 'websiteId' | 'stripePublishableKey'>;
/** Backend yanıtındaki Stripe Tax alanlarından tipli vergi kırılımı; `subtotal` yoksa null. */
declare function parseTaxBreakdown(raw: Record<string, any> | null | undefined): PaymentTaxBreakdown | null;
/**
 * Ödeme başlatma / sepet ödeme yanıtını normalize eder (eklemeli: ham alanlar korunur).
 * - `paymentId`: backend `payment_id` döndürür; `paymentId` yoksa doldurulur.
 * - `tax`: Stripe Tax kırılımı (yoksa null).
 * - `stripe`: yalnızca `type === 'stripe'` ve `clientSecret` varsa (satıcı LLC + CrafterPayments).
 */
declare function normalizePaymentResponse<T extends Record<string, any>>(raw: T, fallbackPublishableKey?: string | null): T & InitiatePaymentResponse;
/** Alıcının onayladığı sözleşme sürümü / bölge eki (CrafterPayments onay kaydı, chargeback kanıtı). */
interface LegalTermsConsent {
    version: string;
    region?: string;
}
/** Sözleşme onayı başlıkları: x-legal-terms-version / x-legal-terms-region */
declare function legalTermsHeaders(consent?: LegalTermsConsent): Record<string, string> | undefined;
/**
 * Müşteri para biriminde ödeme (#424, #426): teklif alınır, ödeme `quoteId` ve teklifin para birimiyle başlatılır.
 * Teklif süresi dolduysa / sepet değiştiyse bir kez yeni teklif alınır. Mağaza müşteri para birimini kapattıysa
 * (`customer_currency_not_allowed`) ödeme teklifsiz, mağaza para biriminde başlatılır (`customerCurrencyDisabled`).
 * Diğer hatalar olduğu gibi fırlatılır.
 */
declare function payWithQuote<T extends Record<string, any>>(getQuote: () => Promise<PresentmentQuote>, pay: (quote: PresentmentQuote | null) => Promise<T>): Promise<T & {
    customerCurrencyDisabled: boolean;
}>;
/**
 * Public durum yanıtını yorumlar. Backend'in public `delivery` özeti:
 * pending → PENDING, delivered → DELIVERED, failed → NEEDS_REVIEW (teslim edilemedi / incelemede), refunded → REFUNDED.
 * Backend ileride `deliveryStatus` döndürürse o kullanılır.
 */
declare function parsePaymentStatus(paymentId: string, raw: Record<string, any> | null | undefined): PaymentStatusResult;
/** Formdaki en yüksek bakiye yükleme tutarı: sağlayıcı üst sınırı, tek yükleme limiti ve kalan ödenmiş bakiye hakkı. */
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
     * Satıcı LLC + CrafterPayments iken yanıtta `stripe` (clientSecret, publishableKey, vergi) bulunur.
     * POST /payment/initiate
     */
    initiate(data: InitiatePaymentDto | (Omit<InitiatePaymentDto, 'providerId'> & {
        provider?: string;
        providerId?: string;
    }), options?: {
        legalTerms?: LegalTermsConsent;
    } & CustomerCurrencyOptions): Promise<InitiatePaymentResponse>;
    /**
     * Kilitli kur teklifi (~30 dk): tutar mağaza para biriminde hesaplanır, müşterinin para birimini sunucu belirler
     * (`currency` yalnızca öneridir). Ödeme `quoteId` ile başlatılır. Oturum gerektirir.
     * Mağaza müşteri para birimini kapattıysa 400 `customer_currency_not_allowed`.
     * POST /payment/quote
     */
    quote(data: PresentmentQuoteRequest): Promise<PresentmentQuote>;
    /**
     * Check payment status by payment ID.
     * POST /payment/check
     */
    check(paymentId: string): Promise<CheckPaymentResponse>;
    /**
     * Ödeme ve teslimat durumu (oturum gerektirmez). Stripe ödemesinde webhook gecikirse backend ödemeyi Stripe'tan okur.
     * GET /payment/status/:paymentId
     */
    getStatus(paymentId: string): Promise<PaymentStatusResult>;
    /**
     * Ödeme sonucu kesinleşene kadar `getStatus` ile yoklar (Stripe `confirmPayment` sonrası).
     * Ödeme alındı ama teslimat sürüyorsa yoklama devam eder. Süre dolarsa son görülen durum döner.
     * Ağ hataları yutulur, yoklama sürer.
     */
    waitForResult(paymentId: string, options?: WaitForPaymentOptions): Promise<PaymentStatusResult>;
    /**
     * Bakiye yükleme koşulları: açık mı, limitler (USD ve mağaza para birimi), ödenmiş / bonus bakiye
     * ve koşul metninin gösterilip gösterilmeyeceği (`showTerms`). Oturum gerektirir.
     * GET /payment/balance-top-up/policy?websiteId=
     */
    getTopUpPolicy(websiteId?: string): Promise<BalanceTopUpPolicy>;
}

/**
 * localStorage sepet deposu (#447): 'cart' ve 'crafter_cart_coupon' anahtarları. Headless kullanımda ve sepet uçları
 * olmayan sayfalarda kullanılır. Storefront içinde sepet sunucudadır (#434, `cart-server.ts`); bu anahtarlar oradan
 * bir kez taşınıp silinir.
 */
/** Depodaki satır: checkout'un okuduğu alanlar */
interface StoredCartLine {
    id: string;
    name: string;
    /** Birim fiyat, mağaza para biriminde (indirimsiz) */
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
    /** Başka sekmede ya da dışarıda değişince çağrılır; aboneliği kaldıran fonksiyon döner */
    subscribe(onChange: () => void): () => void;
}
declare const CART_STORAGE_KEY = "cart";
declare const CART_COUPON_KEY = "crafter_cart_coupon";
/** Bozuk kayıtları ayıklar; id'siz satır atılır, miktar en az 1 tam sayı */
declare function normalizeLines(raw: unknown): StoredCartLine[];
declare class LocalStorageCartStore implements CartStore {
    read(): Promise<StoredCartLine[]>;
    write(lines: StoredCartLine[]): Promise<void>;
    readCoupon(): Promise<string | null>;
    writeCoupon(code: string | null): Promise<void>;
    subscribe(onChange: () => void): () => void;
}

/**
 * Hibrit sepet (#434): storefront'un sepet uçları. Ziyaretçide sepet storefront'un imzalı çerezinde, giriş yapmış
 * müşteride sunucuda tutulur; SDK iki modu ayırt etmez. Uçlar aynı kökenli ve çerezlidir (`credentials: 'same-origin'`).
 * Fiyat gönderilmez: sunucu güncel üründen hesaplar.
 *   GET  /cart.js
 *   POST /cart/add.js     { id, quantity, options? } | { items: [{ id, quantity }] }
 *   POST /cart/change.js  { id, quantity }   (0 siler; id ürün id'si ya da satır anahtarı)
 *   POST /cart/clear.js
 *   POST /cart/coupon.js  { code | null }  (geçersiz kupon 422 + `type`, sepet değişmez; null / '' kaldırır)
 */
/** Sunucunun döndürdüğü satır */
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
/** Sepetten düşen satır: `not_found`, `unavailable`, `out_of_stock`, `cart_full` */
interface CartRemovedNote {
    productId: string;
    key?: string;
    name?: string | null;
    quantity: number;
    reason: string;
}
/** Adedi düşürülen satır: `stock_limit`, `max_quantity` */
interface CartAdjustedNote {
    productId: string;
    key?: string;
    name?: string | null;
    from: number;
    to: number;
    reason: string;
}
/** Sepetteki geçerli kuponun ayrıntısı (#476) */
interface CartCouponDetails {
    code: string;
    type: 'percentage' | 'fixed' | 'free_product';
    /** Yüzde ya da mağaza para biriminde tutar; `free_product` için null olabilir */
    value: number | null;
    /** `free_product` kuponunda hediye ürün; diğerlerinde null */
    freeProductId: string | null;
}
/** Saklı kupon geçersizleşip sepetten düşürüldü (#476); `reason` kupon hata kodu (bkz. `CouponErrorType`) */
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
    /** Kupon indirimi, mağaza para biriminde (#476); kupon yoksa 0 */
    discount?: number;
    /** Ödenecek tutar: `subtotal - discount` (en az 0), mağaza para biriminde (#476) */
    total?: number;
    /** Geçerli kuponun ayrıntısı (#476); kupon yoksa null */
    couponDetails?: CartCouponDetails | null;
    /** Saklı kupon düşürüldüyse bir kez bildirilir (#476); yoksa null */
    couponRemoved?: CartCouponRemovedNote | null;
    removed?: CartRemovedNote[];
    adjusted?: CartAdjustedNote[];
    mode?: 'guest' | 'customer';
}
interface ServerCartClientOptions {
    /** Uçların kökü (bağlamın `routes.cartApi` değeri, ör. '/cart') */
    cartApi: string;
    /** Ürün adlarının dili (`X-Crafter-Locale`) */
    locale?: () => string | undefined;
    fetchImpl?: typeof fetch;
}
/** Başka sekmeye "sepet değişti" sinyali (yalnızca zaman damgası) */
declare const CART_SYNC_KEY = "crafter_cart_sync";
/** Yanıtı tip güvenli biçime getirir; bozuk satırlar atılır */
declare function normalizeServerCart(raw: any): ServerCartResponse;
/**
 * Storefront sepet uçlarının istemcisi. İlk işlemden önce eski localStorage sepetini bir kez sunucuya taşır
 * (`migrate`); her değişiklikten sonra diğer sekmelere `crafter_cart_sync` sinyali yazar.
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
    /** Başka sekmede değişince çağrılır; aboneliği kaldıran fonksiyon döner */
    subscribe(onChange: () => void): () => void;
    /**
     * Eski temaların localStorage sepeti (`cart`, `crafter_cart_coupon`) sayfa başına bir kez taşınır: sunucu sepeti
     * boşsa satırlar (yalnızca id + adet), kupon yoksa kupon gönderilir; ardından anahtarlar silinir. Sunucu sepeti
     * doluysa sunucudaki esas alınır ve anahtarlar yine silinir. Ağ / sunucu hatasında localStorage korunur (sonraki
     * sayfada tekrar denenir); istek reddedilirse (4xx) kayıt bozuk sayılır ve silinir.
     * Kupon yalnızca sunucu kabul ederse taşınır (#476): kupon adımı 4xx ile reddedilirse taşınan satırlar korunur,
     * kupon düşer, iki anahtar da silinir ve dönen sepette `couponRemoved: { code, reason }` bir kez bildirilir.
     * Dönüş: taşıma sırasında okunan son sepet (yoksa null).
     */
    migrate(): Promise<ServerCartResponse | null>;
    private runMigration;
    private mutate;
    private ping;
    private request;
}

/**
 * Tema olayları (#447): SDK değişiklikleri hem kendi olay yoluna (`crafter.on('cart:updated')`) hem de
 * `document` üzerine `crafter:<ad>` CustomEvent olarak yayar. Temalar SDK örneğini beklemeden dinleyebilir:
 *   document.addEventListener('crafter:cart:updated', (e) => e.detail.itemCount)
 */
declare const DOM_EVENTS: {
    readonly ready: "crafter:ready";
    readonly cartUpdated: "crafter:cart:updated";
    readonly localizationChanged: "crafter:localization:changed";
};
type DomEventName = (typeof DOM_EVENTS)[keyof typeof DOM_EVENTS];
/** `document` üzerine `crafter:<name>` olayı; tarayıcı dışında sessizce atlanır */
declare function dispatchDomEvent(name: string, detail?: unknown): void;
declare class DomEvents {
    private events;
    constructor(events: EventEmitter);
    /** SDK olay yoluna ve `document`'a birlikte yayar */
    emit(name: string, detail?: unknown): void;
    /**
     * `document` üzerindeki `crafter:<name>` olayını dinler; işleyici `event.detail` alır. Aboneliği kaldıran fonksiyon döner.
     * @example crafter.dom.on('cart:updated', (cart) => badge.textContent = cart.itemCount)
     */
    on(name: string, handler: (detail: any) => void): () => void;
}

/** Sepete eklenecek ürün; tema genelde `data-*` özniteliklerinden verir */
interface CartAddInput {
    id: string | number;
    name?: string;
    /** Birim fiyat, mağaza para biriminde. Storefront sepetinde gönderilmez: fiyatı sunucu hesaplar. */
    price?: number | string;
    discountType?: string | null;
    discountValue?: number | string | null;
    image?: string | null;
    images?: string[];
    /** Varyant / seçenekler (storefront sepeti) */
    options?: Record<string, string> | null;
}
/** Sepet satırı: depodaki alanlar + hesaplananlar (mağaza para biriminde) */
interface CartLine extends StoredCartLine {
    /** İlk görsel; yoksa null */
    image: string | null;
    /** İndirim uygulanmış birim fiyat */
    unitPrice: number;
    lineTotal: number;
}
interface CartState {
    items: CartLine[];
    /** Toplam adet */
    itemCount: number;
    /** Ara toplam, mağaza para biriminde; gösterim için `crafter.money.format(cart.subtotal)` */
    subtotal: number;
    /** Mağaza para birimi (sayfa bağlamından); bilinmiyorsa boş */
    currency: string;
    coupon: string | null;
    /**
     * Kupon indirimi, mağaza para biriminde (#476); kupon yoksa 0. localStorage sepeti kuponu doğrulayamaz: her zaman 0.
     */
    discount?: number;
    /** Ödenecek tutar: `subtotal - discount` (en az 0), mağaza para biriminde (#476) */
    total?: number;
    /** Geçerli kuponun ayrıntısı (#476): `code`, `type`, `value`, `freeProductId`; kupon yoksa (ya da localStorage) null */
    couponDetails?: CartCouponDetails | null;
    /**
     * Storefront sepeti (#476): saklı kupon geçersizleştiği için düşürüldüyse bir kez bildirilir (`code`, `reason`:
     * `CouponErrorType` kodu, ör. `coupon_cart_total_below_minimum`); yoksa null
     */
    couponRemoved?: CartCouponRemovedNote | null;
    /** Storefront sepeti (#434): satıştan kalkan / tükenen ürün düştüyse bir kez bildirilir */
    removed?: CartRemovedNote[];
    /** Storefront sepeti (#434): adet stoğa göre düşürüldüyse bir kez bildirilir */
    adjusted?: CartAdjustedNote[];
}
/** Sepetin işlemleri; `crafter.cart` bunlara devreder (localStorage ya da storefront sunucusu) */
interface CartBackend {
    get(): Promise<CartState>;
    add(product: CartAddInput, quantity: number): Promise<CartState>;
    update(id: string, quantity: number): Promise<CartState>;
    remove(id: string): Promise<CartState>;
    clear(): Promise<CartState>;
    setCoupon(code: string | null): Promise<CartState>;
    /** Başka sekmede değişince çağrılır; aboneliği kaldıran fonksiyon döner */
    subscribe(onChange: () => void): () => void;
}
interface CartModuleDeps {
    /** Sepet deposu (localStorage 'cart' biçimi). Verilirse her zaman bu depo kullanılır. */
    store?: CartStore;
    /**
     * Storefront sepet uçları (#434): bağlamın `routes.cartApi` değeri (ör. '/cart'). Verilirse sepet sunucudadır
     * (ziyaretçide imzalı çerez, giriş yapınca hesap); yoksa localStorage.
     */
    cartApi?: string | null;
    /** Storefront sepetinde ürün adlarının dili */
    locale?: () => string | undefined;
    /** Testler için */
    fetchImpl?: typeof fetch;
    dom?: DomEvents;
    storeCurrency?: () => string;
}
/** İndirim uygulanmış birim fiyat: 'percentage' yüzde, diğer tipler sabit tutar (checkout ile aynı kural) */
declare function discountedUnitPrice(line: Pick<StoredCartLine, 'price' | 'discountType' | 'discountValue'>): number;
/** localStorage sepeti (#447): headless kullanım ve sepet uçları olmayan sayfalar */
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
/** Sunucu yanıtı → `CartState` (tutarlar mağaza para biriminde, sunucu hesaplar) */
declare function cartStateFromServer(cart: ServerCartResponse, fallbackCurrency?: string): CartState;
/** Storefront sepeti (#434): `/cart.js` ve `/cart/*.js` uçları; fiyat gönderilmez */
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
    /** Sepet sunucuda mı (storefront sepet uçları) */
    get isServerBacked(): boolean;
    /** Sepetin güncel hali */
    get(): Promise<CartState>;
    /** Ürünü ekler; sepette varsa adedi artar. `crafter:cart:updated` yayar. */
    add(product: CartAddInput, quantity?: number): Promise<CartState>;
    /** Satırın adedini ayarlar; 0 ya da altı satırı siler */
    update(id: string | number, quantity: number): Promise<CartState>;
    remove(id: string | number): Promise<CartState>;
    /** Sepeti ve kuponu boşaltır */
    clear(): Promise<CartState>;
    /**
     * Kuponu uygular; null / boş kaldırır. Storefront sepetinde sunucu hemen doğrular (#476): geçerliyse `discount`,
     * `total`, `couponDetails` dolu döner; geçersizse `CrafterCouponError` (HTTP 422; `type`: `CouponErrorType`,
     * `message` sayfanın dilinde, `details.minCartValue`) fırlatılır, sepet değişmez ve `crafter:cart:updated` yayılmaz.
     * localStorage sepeti kuponu doğrulayamaz: kodu saklar, indirimi checkout hesaplar.
     */
    setCoupon(code: string | null): Promise<CartState>;
    /** Kuponu kaldırır (`setCoupon(null)`) */
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
     * Satıcı LLC + CrafterPayments iken yanıtta `stripe` (clientSecret, publishableKey, vergi kırılımı) bulunur.
     * Stok yetersizse `CrafterOutOfStockError` (HTTP 409, `productIds`) fırlatılır.
     * Para birimini sunucu belirler; `currency` verilmezse gönderilmez. `{ useCustomerCurrency: true }` ile önce kilitli
     * kur teklifi alınır ve ödeme müşteri para biriminde başlatılır (bkz. `payWithQuote`).
     * POST /payment/checkout
     */
    checkout(data: PurchaseDto & {
        providerId: string;
        websiteId: string;
        provider?: string;
        /** Yalnızca teklifin para birimi (`quoteId` ile); verilmezse sunucu mağaza para birimini kullanır */
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
        /** Alıcının ülkesi (ISO 3166-1 alpha-2); satıcı LLC iken Stripe Tax vergi konumu */
        billingCountry?: string;
        /** ABD / Kanada için posta kodu (Stripe Tax) */
        billingPostalCode?: string;
    }, options?: {
        legalTerms?: LegalTermsConsent;
    } & CustomerCurrencyOptions): Promise<CheckoutPaymentResponse>;
    private checkoutPayload;
}

/**
 * Sayfa bağlamı (#447): storefront her v2 tema sayfasına `content_for_header` ile
 * `window.__CRAFTER_CONTEXT__` yazar. Gizli bilgi ve kişisel veri içermez; yalnızca mağaza, dil ve para birimi.
 * IIFE derlemesi bu nesneyi görünce `window.Crafter` örneğini kendiliğinden kurar (bkz. `autoInit`).
 */
interface CrafterPageContext {
    /** Bağlamı yazan storefront'un eklediği SDK sürümü */
    sdkVersion?: string;
    websiteId?: string;
    /** Aynı kökenli proxy; varsayılan '/api/storefront' */
    apiBase?: string;
    /** Sayfanın dili (ör. 'en', 'pt-BR') */
    locale?: string;
    /** Mağazanın varsayılan dili */
    defaultLocale?: string;
    /** Sayfa adresinin dil öneki: varsayılan dilde '', diğerlerinde '/en' */
    localePrefix?: string;
    /** Mağazanın açık dilleri */
    languages?: string[];
    /** Mağaza para birimi (muhasebe birimi); tutarlar bu birimde tutulur */
    storeCurrency?: string;
    /** Müşterinin para birimi; yoksa mağaza para birimi */
    customerCurrency?: string;
    /** 1 mağaza birimi = rate müşteri birimi (yalnızca gösterim) */
    rate?: number;
    /** Seçicideki para birimleri */
    currencies?: string[];
    /** Platform adresleri; checkout dil önekiyle çalışmaz, dili Referer'dan okur */
    routes?: {
        cart?: string;
        checkout?: string;
        localization?: string;
        /** Storefront sepet uçlarının kökü (#434), ör. '/cart' → `/cart.js`, `/cart/add.js`. Yoksa sepet localStorage'da. */
        cartApi?: string;
    };
}
declare const CONTEXT_GLOBAL = "__CRAFTER_CONTEXT__";
/** `window.__CRAFTER_CONTEXT__` okunur; yoksa ya da nesne değilse null */
declare function readPageContext(win?: any): CrafterPageContext | null;
/** Dil önekini yoldan çıkarır: '/en/cart' → '/cart' (önek '/en' iken) */
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
     * Stripe publishable key (pk_test_... / pk_live_...). Satıcı LLC iken Payment Element için kullanılır.
     * Backend ödeme yanıtında anahtar döndürürse o önceliklidir. Gizli değildir.
     */
    stripePublishableKey?: string;
    /**
     * Sayfa bağlamı (#447): storefront'un `window.__CRAFTER_CONTEXT__` nesnesi. Para gösterimi, dil seçimi ve
     * checkout adresi buradan okunur. Tema sayfalarında SDK kendiliğinden verir.
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
    /** Backend hata kodu (ErrorType), ör. 'out_of_stock' */
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
     * Para birimini sunucu belirler (mağaza para birimi). Yalnızca kilitli teklifin (`quoteId`) para birimi
     * gönderilebilir; başka bir değer 400 `payment_currency_mismatch` döner. Verilmezse alan gönderilmez.
     */
    currency?: string;
    /** Kilitli kur teklifi (`payments.quote`); verilmezse ödeme mağaza para biriminde */
    quoteId?: string;
    websiteId?: string;
    user: InitiatePaymentUser;
    /** Alıcının ülkesi (ISO 3166-1 alpha-2); satıcı LLC iken Stripe Tax vergi konumu */
    billingCountry?: string;
    /** ABD / Kanada için posta kodu (Stripe Tax) */
    billingPostalCode?: string;
    [key: string]: any;
}
/** Backend'in ödeme başlatma yanıt türü. `stripe`: satıcı LLC + CrafterPayments (Payment Element). */
type PaymentSessionType = 'iframe' | 'redirect' | 'kuveytturk_init' | 'stripe' | (string & {});
/** Stripe Tax vergi satırı (ülke / eyalet, vergi türü, oran ve tutar). */
interface PaymentTaxLine {
    country: string | null;
    state: string | null;
    /** 'vat' | 'sales_tax' | 'gst' | 'hst' | 'pst' | 'qst' ... */
    taxType: string | null;
    /** Yüzde olarak oran (ör. 19 = %19) */
    rate: number;
    amount: number;
}
/** Vergi kırılımı ve toplam (yalnızca backend `subtotal` döndürdüğünde, yani Stripe Tax hesaplandığında). */
interface PaymentTaxBreakdown {
    /** Vergi hariç tutar */
    subtotal: number;
    /** Toplam vergi */
    taxAmount: number;
    /** Tahsil edilecek toplam (vergi dahil) */
    total: number;
    currency: string;
    lines: PaymentTaxLine[];
}
/**
 * Satıcı LLC iken CrafterPayments ödemesi: Stripe Payment Element ile sayfa içinde tamamlanır.
 * Stripe.js SDK'ya gömülü değildir; tema geliştiricisi kendisi yükler (bkz. wiki/07-payments.md).
 */
interface StripePaymentSession {
    paymentId: string;
    /** PaymentIntent client secret'ı: `stripe.elements({ clientSecret })` */
    clientSecret: string;
    /**
     * Stripe publishable key. Backend yanıtında varsa oradan, yoksa `CrafterConfig.stripePublishableKey`'den gelir.
     * İkisi de yoksa null'dır (tema kendi anahtarını kullanmalı).
     */
    publishableKey: string | null;
    /** Tahsil edilecek toplam (vergi dahil) */
    amount: number;
    currency: string;
    merchantOid?: string;
    /** Stripe Tax kırılımı; backend vergi bilgisi döndürmediyse null */
    tax: PaymentTaxBreakdown | null;
    /** Müşteri para biriminde ödemede mağaza tutarı ve kur; mağaza para biriminde ödemede yok */
    presentment?: PaymentPresentment;
}
/** Kur teklifi türü: sepet ödemesi ya da bakiye yükleme */
type PresentmentQuoteKind = 'cart' | 'top_up';
/** `POST /payment/quote` gövdesi */
interface PresentmentQuoteRequest {
    /** Verilmezse `CrafterConfig.websiteId` */
    websiteId?: string;
    kind: PresentmentQuoteKind;
    /** Müşterinin seçtiği para birimi (öneri); sunucu ayara ve ülkeye göre belirler */
    currency?: string;
    /** kind = top_up: yükleme tutarı (mağaza para biriminde) */
    amount?: number;
    /** kind = cart: `cart.checkout` ile aynı sepet alanları */
    coupon?: string;
    productIds?: string[];
    items?: {
        productId: string;
        quantity: number;
    }[];
    quantities?: Record<string, number>;
}
/** Kilitli kur teklifi (~30 dk geçerli); ödeme `quoteId` ile başlatılır */
interface PresentmentQuote {
    quoteId: string;
    kind: PresentmentQuoteKind;
    storeCurrency: string;
    storeAmount: number;
    /** Müşterinin ödeyeceği para birimi ve tutar */
    currency: string;
    amount: number;
    /** 1 mağaza birimi = rate müşteri birimi (kur payı dahil) */
    rate: number;
    baseRate?: number;
    markupPercent?: number;
    rateDate?: string;
    rateSource?: string;
    /** ISO tarih */
    expiresAt: string;
}
/** Ödeme yanıtındaki müşteri para birimi bilgisi (teklifle ödemede) */
interface PaymentPresentment {
    quoteId: string;
    currency: string;
    amount: number;
    rate: number;
    rateDate?: string;
    storeCurrency: string;
    storeAmount: number;
}
/** Müşteri para biriminin ayarı: otomatik, seçili para birimleri ya da kapalı */
type CustomerCurrencyMode = 'auto' | 'selected' | 'off' | (string & {});
/** Müşteri para birimi nasıl belirlendi: seçim (çerez / parametre), ülke ya da mağaza para birimi */
type CustomerCurrencySource = 'choice' | 'country' | 'store' | (string & {});
/** `GET /payment/currencies`: fiyat gösterimi ve para birimi seçicisi için bağlam */
interface CustomerCurrencyContext {
    storeCurrency: string;
    mode: CustomerCurrencyMode;
    /** Mağaza para biriminden başka para birimi gösterilebiliyor mu */
    enabled: boolean;
    /** Seçicideki para birimleri; mağaza para birimi ilk sırada */
    currencies: string[];
    /** Müşterinin para birimi */
    currency: string;
    source: CustomerCurrencySource;
    /** 1 mağaza birimi = rate müşteri birimi (kur payı dahil) */
    rate: number;
    /** İzinli para birimlerinin kurları (seçicide anında çeviri için) */
    rates: Record<string, number>;
    markupPercent: number;
    rateDate: string | null;
    rateSource: string | null;
}
/** `POST /payment/currencies/convert`: tutarlar istek sırasıyla müşteri para biriminde */
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
 * Müşteri para biriminde ödeme (isteğe bağlı): önce kilitli teklif alınır, ödeme `quoteId` ile başlatılır.
 * Teklifin süresi dolduysa / sepet değiştiyse bir kez yeni teklif alınır; mağaza müşteri para birimini
 * kapattıysa (`customer_currency_not_allowed`) ödeme mağaza para biriminde başlatılır.
 */
interface CustomerCurrencyOptions {
    useCustomerCurrency?: boolean;
    /** Teklif için para birimi önerisi; verilmezse sunucu çerezden / ülkeden belirler */
    customerCurrency?: string;
}
interface InitiatePaymentResponse {
    token?: string;
    iframeUrl?: string;
    paymentId?: string;
    paymentUrl?: string;
    success?: boolean;
    type?: PaymentSessionType;
    /** Backend'in ham alanı; SDK ayrıca `paymentId` olarak da döndürür */
    payment_id?: string;
    payment_url?: string;
    redirectUrl?: string;
    iframeHtml?: string;
    /** type = kuveytturk_init: 3D formu */
    html?: string;
    merchant_oid?: string;
    amount?: number | string;
    currency?: string;
    /** type = stripe: PaymentIntent client secret'ı */
    clientSecret?: string;
    /** type = stripe: vergi hariç tutar, toplam vergi ve satırlar (ham alanlar) */
    subtotal?: number;
    taxAmount?: number;
    taxes?: PaymentTaxLine[];
    /** Sepet bakiyeyle tamamen ödendiyse ürünler teslim edilmiştir; sağlayıcıya gidilmez */
    delivered?: boolean;
    /** SDK tarafından eklenir: type = stripe ise Payment Element için gereken her şey, değilse yok */
    stripe?: StripePaymentSession;
    /** SDK tarafından eklenir: vergi kırılımı (yoksa null) */
    tax?: PaymentTaxBreakdown | null;
    /**
     * Teklifle (müşteri para biriminde) ödemede mağaza tutarı ve kur. Bu durumda `amount`, `currency`, `subtotal`,
     * `taxAmount` ve `taxes` müşteri para birimindedir.
     */
    presentment?: PaymentPresentment;
    /** SDK tarafından eklenir (`useCustomerCurrency`): müşteri para birimi kapalı, ödeme mağaza para biriminde */
    customerCurrencyDisabled?: boolean;
    [key: string]: any;
}
/** Sepet ödemesi (`cart.checkout`) yanıtı; ödeme başlatma yanıtıyla aynı yapıdadır. */
type CheckoutPaymentResponse = InitiatePaymentResponse;
/** Backend ödeme kaydı durumu (public durum ucu). */
type PaymentRecordStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'REFUNDED' | (string & {});
/** Public durum ucunun döndürdüğü teslimat özeti; eski backend veya teslimatsız ödemede null. */
type PublicDeliveryState = 'pending' | 'delivered' | 'failed' | 'refunded' | null;
/**
 * Teslimat durumu (backend `deliveryStatus` değerleriyle aynı adlar).
 * - NEEDS_REVIEW: ödeme alındı ama teslimat yapılamadı / incelemede; mağaza yetkilisi müdahale etmeli.
 * - REFUNDED: ürün tükendiği için teslim edilemedi ve ödeme otomatik iade edildi.
 */
type PaymentDeliveryStatus = 'PENDING' | 'DELIVERED' | 'NEEDS_REVIEW' | 'REFUNDED';
/** Ödeme sonrası alıcıya gösterilecek sonuç. */
type PaymentOutcome = 'processing' | 'success' | 'pending' | 'failed' | 'refunded' | 'needs_review';
interface PaymentStatusResult {
    paymentId: string;
    status: PaymentRecordStatus;
    /** Backend'in ham teslimat özeti */
    delivery: PublicDeliveryState;
    /** Teslimat durumu; teslimat bilgisi yoksa null */
    deliveryStatus: PaymentDeliveryStatus | null;
    /** Ödeme + teslimat birleşik sonucu */
    outcome: PaymentOutcome;
    /** Sonuç kesinleşti mi (yoklama durdurulabilir) */
    final: boolean;
}
interface WaitForPaymentOptions {
    /** Deneme sayısı (varsayılan 20) */
    attempts?: number;
    /** Denemeler arası bekleme, ms (varsayılan 1500) */
    intervalMs?: number;
    signal?: AbortSignal;
}
/** Site bakiyesi yükleme koşulları: `GET /payment/balance-top-up/policy` */
interface BalanceTopUpPolicy {
    /** Bakiye yükleme açık mı */
    enabled: boolean;
    /** Satıcı LLC: kapalı devre bakiye kuralları ve limitler geçerli */
    closedLoop: boolean;
    /** SDK tarafından eklenir: yükleme ekranında bakiye koşul metni gösterilmeli mi (closedLoop ile aynı) */
    showTerms: boolean;
    /** Mağaza para birimi */
    currency: string;
    /** Tek yüklemede en fazla (USD) */
    maxSingleUsd: number;
    /** Mağaza başına ödenmiş bakiye üst sınırı (USD) */
    maxPaidUsd: number;
    /** Mağaza para birimi karşılıkları; kur yoksa veya TR modunda null */
    maxSingleAmount: number | null;
    remainingAmount: number | null;
    /** Toplam bakiye = ödenmiş + bonus */
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
    /** Sepet değişti (ekle / güncelle / sil / başka sekme); `document`'ta `crafter:cart:updated` */
    'cart:updated': CartState;
    /** Dil / para birimi seçildi; `document`'ta `crafter:localization:changed` */
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
 * Müşteri para birimi (#424, #426): fiyat gösterimi için bağlam ve çeviri. Para birimini sunucu belirler
 * (vitrinin `crafter_currency` çerezi, ülke, mağaza para birimi); SDK kendi çerezini yazmaz.
 * Çevrilen tutarlar yalnızca gösterim içindir; ödeme tutarı kilitli teklifle (`payments.quote`) belirlenir.
 */
declare class CurrenciesModule {
    private http;
    private events;
    private options;
    constructor(http: HttpClient, events: EventEmitter, options?: Pick<CrafterConfig, 'websiteId'>);
    /**
     * Mağaza para birimi, izinli para birimleri, müşterinin para birimi ve kurlar.
     * `currency`: müşterinin seçimi (öneri); izinli değilse ülke / mağaza para birimi döner.
     * GET /payment/currencies?websiteId=&currency=
     */
    context(params?: {
        currency?: string;
        websiteId?: string;
    }): Promise<CustomerCurrencyContext>;
    /**
     * Mağaza para birimindeki tutarları (en fazla 500) müşteri para birimine çevirir; sıra korunur.
     * POST /payment/currencies/convert
     */
    convert(amounts: number[], params?: {
        currency?: string;
        websiteId?: string;
    }): Promise<CurrencyConversion>;
}

interface MoneyFormatOptions {
    /**
     * Tutar mağaza para birimindeyse (varsayılan) sayfa bağlamının kuruyla müşterinin para birimine çevrilir.
     * `false`: çevrilmez, mağaza para biriminde basılır (bakiye, hakediş gibi).
     */
    convert?: boolean;
    /** Tutar zaten bu para birimindeyse (ör. ödeme teklifi) verilir; çeviri yapılmaz */
    currency?: string;
    /** Varsayılan: sayfanın dili */
    locale?: string;
}
/** Para biriminin ondalık hanesi (Intl); bilinmeyen kodda 2 */
declare function currencyDigits(currency: string): number;
/**
 * Para gösterimi (#447): storefront'un `money` filtresiyle aynı kural. Tutarlar mağaza para biriminde gelir;
 * sayfa bağlamındaki kurla müşterinin para birimine çevrilip sayfanın dilinde biçimlenir. Bağlam yoksa ya da
 * kur geçersizse mağaza para biriminde gösterilir. Yalnızca gösterimdir; kesin tutar ödeme anında sunucuda belirlenir.
 */
declare class MoneyModule {
    private getContext;
    constructor(getContext: () => CrafterPageContext | null);
    /** Mağaza para birimi; bağlam yoksa boş */
    get storeCurrency(): string;
    /** Müşterinin para birimi; kur geçersizse mağaza para birimi */
    get currency(): string;
    /** 1 mağaza birimi = rate müşteri birimi; müşteri para birimi mağazanınkiyse 1 */
    get rate(): number;
    /** Mağaza tutarını müşteri para birimine çevirir ve o birimin hanesine yuvarlar */
    convert(storeAmount: number | string): number;
    /**
     * @example Crafter.money.format(19.99)                    // '€18,40' (EUR müşteri, de)
     * @example Crafter.money.format(250, { convert: false })  // mağaza para biriminde
     */
    format(amount: number | string, options?: MoneyFormatOptions): string;
    private rateOf;
}

interface LocalizationState {
    /** Sayfanın dili */
    language: string;
    /** Müşterinin para birimi; yoksa mağaza para birimi */
    currency: string;
    languages: string[];
    currencies: string[];
}
interface LocalizationChange {
    language?: string;
    currency?: string;
}
interface LocalizationSetOptions {
    /** Seçimden sonra dönülecek uygulama içi yol (öneksiz); varsayılan bulunulan sayfa */
    returnTo?: string;
    /** false: sayfa yenilenmez, yalnızca adres döner (tema kendisi yönetir). Varsayılan true. */
    reload?: boolean;
}
/**
 * Dil ve para birimi (#447). Seçim storefront'un JS'siz formuyla aynı uca gider: `POST /localization`
 * (`language`, `currency`, `return_to`). Sunucu seçimi çereze yazar ve sayfanın seçilen dildeki adresini verir.
 */
declare class LocalizationModule {
    private getContext;
    private dom;
    constructor(getContext: () => CrafterPageContext | null, dom: DomEvents);
    get(): LocalizationState;
    /**
     * Dili ve/veya para birimini değiştirir. Varsayılan olarak sayfa seçilen dildeki adrese gider.
     * `crafter:localization:changed` olayı (`{ language, currency, url }`) gezinmeden önce yayılır.
     */
    set(change: LocalizationChange, options?: LocalizationSetOptions): Promise<{
        url: string;
    }>;
}

interface SectionsRenderOptions {
    /** Bölümlerin render edileceği sayfa; varsayılan bulunulan sayfa (yol + sorgu) */
    url?: string;
    /** false: DOM'a dokunulmaz, yalnızca HTML döner */
    swap?: boolean;
}
/**
 * Bölüm render (#447): `?sections=a,b` ucundan bölümlerin güncel HTML'ini alır ve sayfadaki
 * `#crafter-section-<id>` sarmalayıcılarını yenisiyle değiştirir. Grup bölümleri `<grup>:<id>` ile istenir.
 */
declare class SectionsModule {
    render(ids: string[], options?: SectionsRenderOptions): Promise<Record<string, string | null>>;
}

/**
 * Tutarı para birimi ve dile göre biçimlendirir (Intl.NumberFormat). Sembol ve ondalık hane para biriminden gelir;
 * 'TL' / '₺' sabit yazılmaz. `locale` verilmezse çalışma ortamının dili kullanılır.
 * Geçersiz para birimi / dil kodunda `1234.50 XYZ` biçimine düşer (hata fırlatmaz).
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
    /** Backend hata kodu (ErrorType), ör. 'out_of_stock', 'balance_top_up_limit_exceeded' */
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
/** Ödeme akışıyla ilgili backend hata kodları (ErrorType). */
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
    /** İstemcinin gönderdiği para birimi mağazanınkinden (ya da teklifinkinden) farklı */
    readonly PAYMENT_CURRENCY_MISMATCH: "payment_currency_mismatch";
    /** Sağlayıcı / satıcı bu para birimini desteklemiyor */
    readonly PAYMENT_CURRENCY_UNSUPPORTED: "payment_currency_unsupported";
    /** Mağaza müşteri para birimini kapattı: ödeme mağaza para biriminde */
    readonly CUSTOMER_CURRENCY_NOT_ALLOWED: "customer_currency_not_allowed";
    /** Teklif bulunamadı / süresi doldu / sepet değişti: yeni teklif alınır */
    readonly PRESENTMENT_QUOTE_NOT_FOUND: "presentment_quote_not_found";
    readonly PRESENTMENT_QUOTE_EXPIRED: "presentment_quote_expired";
    readonly PRESENTMENT_QUOTE_MISMATCH: "presentment_quote_mismatch";
};
type PaymentErrorTypeValue = (typeof PaymentErrorType)[keyof typeof PaymentErrorType];
/**
 * Kupon reddi (#476): `crafter.cart.setCoupon()` (storefront `POST /cart/coupon.js`, HTTP 422) ve kupon doğrulaması.
 * Sepet ayrıca `couponRemoved.reason` alanında aynı kodlarla bildirir (saklı kupon geçersizleşip düşürüldüyse).
 */
declare const CouponErrorType: {
    readonly NOT_FOUND: "coupon_not_found";
    readonly INACTIVE: "coupon_inactive";
    readonly USAGE_LIMIT_REACHED: "coupon_usage_limit_reached";
    readonly ALREADY_USED_BY_USER: "coupon_already_used_by_user";
    readonly NOT_ASSIGNED_TO_USER: "coupon_not_assigned_to_user";
    /** Sepet tutarı kuponun alt sınırının altında (`details.minCartValue`, mağaza para biriminde) */
    readonly CART_TOTAL_BELOW_MINIMUM: "coupon_cart_total_below_minimum";
    readonly INVALID_FOR_PRODUCT: "coupon_invalid_for_product";
    readonly INVALID_TYPE: "coupon_invalid_type";
};
type CouponErrorTypeValue = (typeof CouponErrorType)[keyof typeof CouponErrorType];
/** Kupon hata kodlarının listesi */
declare const COUPON_ERROR_TYPES: string[];
type ErrorPayload = ConstructorParameters<typeof CrafterError>[0];
/**
 * Kupon reddedildi (#476). `message` sayfanın dilinde, doğrudan gösterilebilir; `type` için `CouponErrorType`.
 * Reddedilen kupon sepete yazılmaz, sepet değişmez.
 */
declare class CrafterCouponError extends CrafterError {
    /** `coupon_cart_total_below_minimum` ise kuponun alt sınırı (`details.minCartValue`); yoksa null */
    readonly minCartValue: number | null;
    constructor(payload: ErrorPayload);
}
/** Stok ödeme başlatılırken yetersiz çıktı (HTTP 409, `out_of_stock`). */
declare class CrafterOutOfStockError extends CrafterError {
    /** Tükenen ürünlerin kimlikleri (`details.productIds`); backend göndermediyse boş */
    readonly productIds: string[];
    constructor(payload: ErrorPayload);
}
/** Bakiye yükleme limit bilgisi (hata `details` alanından). */
interface BalanceTopUpLimits {
    currency?: string;
    maxSingleUsd?: number;
    maxPaidUsd?: number;
    maxSingleAmount?: number | null;
    remainingAmount?: number | null;
}
/** Bakiye yüklemesi reddedildi: kapalı, tek yükleme limiti veya toplam ödenmiş bakiye limiti aşıldı. */
declare class CrafterBalanceTopUpError extends CrafterError {
    readonly reason: 'unavailable' | 'single_limit' | 'total_limit';
    /** Limit hatalarında backend'in döndürdüğü limitler; `unavailable` için null */
    readonly limits: BalanceTopUpLimits | null;
    constructor(payload: ErrorPayload);
}
/**
 * Ödeme sağlayıcısı / altyapı hatası: sağlayıcı bulunamadı, satıcı altyapısı hazır değil,
 * Stripe Tax vergi hesaplanamadı, ödeme başlatılamadı vb. `type` alanı ayrıntıyı verir.
 */
declare class CrafterPaymentProviderError extends CrafterError {
    /** Kullanıcı aynı bilgilerle biraz sonra tekrar deneyebilir mi */
    readonly retryable: boolean;
    constructor(payload: ErrorPayload);
}
declare function isCrafterError(err: unknown): err is CrafterError;
declare function isOutOfStockError(err: unknown): err is CrafterOutOfStockError;
declare function isBalanceTopUpError(err: unknown): err is CrafterBalanceTopUpError;
/** Kupon reddi mi (`CrafterCouponError` ya da kupon hata kodlu `CrafterError`) */
declare function isCouponError(err: unknown): err is CrafterCouponError;
declare function isPaymentProviderError(err: unknown): err is CrafterPaymentProviderError;

/** Paket sürümü; package.json ile aynı tutulur (test denetler) */
declare const SDK_VERSION = "1.5.2";

/** `crafter.checkout()` seçenekleri */
interface CheckoutNavigateOptions {
    /** 'cart' (varsayılan): sepet ödemesi; 'balance': bakiye yükleme */
    purpose?: 'cart' | 'balance';
    /** Bakiye yüklemede önerilen tutar (mağaza para biriminde) */
    amount?: number;
    /** false: gezinmez, yalnızca adresi döner */
    navigate?: boolean;
}
declare class Crafter {
    static readonly version = "1.5.2";
    readonly version = "1.5.2";
    readonly config: CrafterConfig;
    readonly http: HttpClient;
    readonly events: EventEmitter;
    /** `document` olayları: `crafter.dom.on('cart:updated', fn)` */
    readonly dom: DomEvents;
    /** Sayfa bağlamı (storefront'un yazdığı `window.__CRAFTER_CONTEXT__`); yoksa null */
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
     * Checkout sayfasına gider (#447). Sepet için `/checkout?purpose=cart`; checkout dil önekiyle açılmaz,
     * dili gelinen sayfadan okur. Adres sayfa bağlamından (`routes.checkout`) gelir.
     */
    checkout(options?: CheckoutNavigateOptions): string;
    /**
     * Tarayıcı derlemesinin (IIFE) otomatik başlatması (#447). Sayfada `window.__CRAFTER_CONTEXT__` varsa
     * `window.Crafter` bu bağlamla kurulmuş örnek olur ve `document`'a `crafter:ready` yayılır; yoksa null döner
     * (`window.Crafter` sınıf olarak kalır, `new Crafter({...})` eskisi gibi çalışır). İkinci çağrı aynı örneği döner.
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

export { type Auth2FaRequiredResponse, type AuthEmailVerificationRequiredResponse, AuthModule, type AuthResponse, type AuthSuccessResponse, type BalanceTopUpLimits, type BalanceTopUpPolicy, type BulkDiscountConfig, CART_COUPON_KEY, CART_STORAGE_KEY, CART_SYNC_KEY, CONTEXT_GLOBAL, COUPON_ERROR_TYPES, type CartAddInput, type CartAdjustedNote, type CartBackend, type CartCouponDetails, type CartCouponRemovedNote, type CartLine, CartModule, type CartModuleDeps, type CartRemovedNote, type CartState, type CartStore, type Category, type ChangePasswordDto, type CheckPaymentResponse, type CheckoutNavigateOptions, type CheckoutPaymentResponse, type ChestItem, ChestModule, type ChestProductSummary, CouponErrorType, type CouponErrorTypeValue, type CouponResponse, CouponsModule, Crafter, type CrafterApiError, CrafterBalanceTopUpError, type CrafterConfig, CrafterCouponError, CrafterError, type CrafterEventMap, type CrafterEventName, CrafterOutOfStockError, type CrafterPageContext, CrafterPaymentProviderError, type CreateReportDto, type CreateTicketDto, CurrenciesModule, type CurrencyConversion, type CustomerCurrencyContext, type CustomerCurrencyMode, type CustomerCurrencyOptions, type CustomerCurrencySource, DOM_EVENTS, type DisableTwoFactorDto, type DiscordStatusData, type DiscordStatusResponse, type DomEventName, DomEvents, EventEmitter, type EventHandler, type ForumCategory, type ForumMessage, type ForumMessageReply, ForumModule, type ForumTopic, type GiftChestItemResponse, type HelpArticleItem, type HelpCategoryItem, type HelpFaqItem, type HelpcenterCategoryDetailResponse, HelpcenterModule, type HelpcenterOverviewResponse, HttpClient, IS_BOLD, IS_CODE, IS_HIGHLIGHT, IS_ITALIC, IS_STRIKETHROUGH, IS_SUBSCRIPT, IS_SUPERSCRIPT, IS_UNDERLINE, type InGameAuthDto, type InitiatePaymentDto, type InitiatePaymentResponse, type InitiatePaymentUser, type LatestPayment, type LatestPurchase, type LatestSignup, type LegalDocuments, LegalModule, type LegalTermsConsent, type LexicalHtmlOptions, type LicenseRecord, type LicenseVerification, LicensesModule, type LightweightBalanceResponse, type LikePostResponse, type LikeTopicResponse, LocalCartBackend, LocalStorageCartStore, type LocalizationChange, LocalizationModule, type LocalizationSetOptions, type LocalizationState, LuckPermsModule, type LuckPermsPermissionNode, type LuckPermsPlayerData, type MarketplaceConfig, type MoneyFormatOptions, MoneyModule, type PageItem, PagesModule, type PaginatedPostsResponse, type PaginatedPunishmentsResponse, type PaymentDeliveryStatus, PaymentErrorType, type PaymentErrorTypeValue, type PaymentOutcome, type PaymentPresentment, type PaymentRecordStatus, type PaymentSessionType, type PaymentStatusResult, type PaymentTaxBreakdown, type PaymentTaxLine, PaymentsModule, type PaymentsModuleOptions, type PostAuthor, type PostItem, type PostQueryDto, PostsModule, type PresentmentQuote, type PresentmentQuoteKind, type PresentmentQuoteRequest, type Product, type PublicDeliveryState, type PublicPaymentProvider, type PunishmentItem, PunishmentsModule, type PurchaseDto, type PurchaseItemDto, type PurchaseResponse, RedeemCodeModule, type ReplyTicketDto, type ReportResponse, type ReportType, ReportsModule, type RequestOptions, type ResetPasswordDto, SDK_VERSION, SearchModule, type SearchResultItem, SectionsModule, type SectionsRenderOptions, type SendBalanceParams, type SendBalanceResponse, SeoModule, type SerializedCodeNode, type SerializedEditorState, type SerializedElementNode, type SerializedHeadingNode, type SerializedHorizontalRuleNode, type SerializedImageNode, type SerializedLexicalNode, type SerializedLinkNode, type SerializedListItemNode, type SerializedListNode, type SerializedQuoteNode, type SerializedRootNode, type SerializedTableCellNode, type SerializedTableNode, type SerializedTableRowNode, type SerializedTextNode, ServerCartBackend, ServerCartClient, type ServerCartClientOptions, type ServerCartLine, type ServerCartResponse, type ServerStatusItem, ServersModule, type SignInDto, type SignUpDto, type SinglePostResponse, type SiteStatistics, type SitemapUrlItem, type StaffFormApplicationResponse, type StaffFormApplicationValue, type StaffFormInput, type StaffFormItem, StaffFormsModule, StatisticsModule, StoreModule, type StoredCartLine, type StripePaymentSession, type Ticket, type TicketCategory, type TicketCategoryDetails, type TicketMessage, type TicketMessageSender, TicketsModule, type TopCreditLoader, type TwoFactorStatusResponse, type TwoFactorValidateDto, type UpdateOwnUserDto, type UseChestItemResponse, type UseRedeemCodeResponse, type UserProfile, type UserRole, UsersModule, VoteModule, type VoteProcessResponse, type VoteProviderItem, type WaitForPaymentOptions, type WallMessage, type WallMessageReply, type WebsiteInfo, WebsiteModule, type WebsitePluginModule, type WebsiteSeoConfig, cartStateFromServer, currencyDigits, Crafter as default, discountedUnitPrice, dispatchDomEvent, formatMoney, htmlToLexical, isBalanceTopUpError, isCouponError, isCrafterError, isLexicalFormat, isOutOfStockError, isPaymentProviderError, legalTermsHeaders, lexicalToHtml, lexicalToPlainText, lexicalToText, normalizeLines, normalizePaymentResponse, normalizeServerCart, parsePaymentStatus, parseTaxBreakdown, payWithQuote, readPageContext, stripLocalePrefix, toLexical, topUpMaxAmount };
